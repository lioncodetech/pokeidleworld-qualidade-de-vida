// Poke Idle World - qualidade de vida: o menu que liga e desliga as ferramentas.
//
// O nucleo e uma copia adaptada do pacote do PokePixel: mesma mecanica de menu, mesma fila.
// O que muda sao os nomes — o prefixo das chaves guardadas e o titulo na tela —, porque dois
// pacotes no mesmo navegador nao podem disputar a mesma chave de armazenamento.
//
// Cada ferramenta continua sendo o seu proprio arquivo, avaliado pelo navegador por conta propria.
// Isso e' de proposito: um erro dentro de uma nao impede as outras de carregar, que era a maior
// perda ao juntar cinco extensoes separadas numa so'.
//
// Este arquivo vem antes de todos no manifest e so' publica `PPX`; quem monta a interface e' o
// `setTimeout(0)` la' embaixo, depois de todos os modulos terem se registrado.

(() => {
  'use strict';

  const CHAVE_LIGADOS = 'lioncode:pokeidleworld:modulos';
  const CHAVE_POS = 'lioncode:pokeidleworld:menu-pos';
  const CHAVE_ABERTO = 'lioncode:pokeidleworld:menu-aberto';
  const CHAVE_VISIVEIS = 'lioncode:pokeidleworld:visiveis';
  const CHAVE_VEZ = 'lioncode:pokeidleworld:vez';
  const CHAVE_SUMICO = 'lioncode:pokeidleworld:sumico';

  const ler = (chave, padrao) => {
    try {
      return JSON.parse(localStorage.getItem(chave)) ?? padrao;
    } catch {
      return padrao;
    }
  };
  const gravar = (chave, valor) => {
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
    } catch {
      /* modo anonimo, ou armazenamento cheio: continua funcionando, so' nao lembra. */
    }
  };

  // --------------------------------------------------------------- a vez
  //
  // ATE' AQUI NAO HAVIA FILA NENHUMA. Cada ferramenta se protegia de si mesma — a venda nao comeca
  // duas vendas, o ginasio nao comeca dois ginasios — e nenhuma sabia que as outras existiam. Com
  // tres relogios automaticos no ar (venda, compra e ginasio), o cruzamento nao e' hipotese: e'
  // questao de tempo. E o cruzamento pior e' calado:
  //
  // - o ginasio da' **dois F5** no meio da corrida dele. Uma venda a meio caminho morre ali, sem
  //   dizer nada, e volta a ser tentada so' no proximo intervalo;
  // - o ginasio fecha os menus da barra de cima e as janelas abertas para conseguir abrir a dele.
  //   A janela que ele fecha pode ser a loja que a compra estava a usar;
  // - venda e compra disputam a mesma loja do Mark, cada uma lendo uma mochila que a outra esta' a
  //   mudar.
  //
  // Daqui em diante ha' uma fila: quem quer agir pede a vez, e espera a sua.
  //
  // **A vez mora na `sessionStorage`, e isso e' uma escolha, nao um detalhe.** Ela tem de
  // atravessar os F5 do ginasio — senao a venda tomaria a vez no meio da recarga, que e' justamente
  // o buraco que se quer tapar. E tem de ser **por aba**: o LionMultInstance abre varias janelas do
  // jogo ao mesmo tempo, e uma fila partilhada faria a instancia A esperar pela B sem razao
  // nenhuma. `sessionStorage` e' as duas coisas: sobrevive a' recarga e nao sai da aba.

  /** De quanto em quanto tempo quem esta' com a vez diz que ainda esta' vivo. */
  const BATIDA = 2000;
  /**
   * Sem dar sinal por este tempo, a vez e' dada por abandonada.
   *
   * Tem de ser maior do que a recarga mais lenta do ginasio: durante o F5 ninguem bate, e o
   * ginasio so' retoma depois de esperar a tela limpar (ate' 15 s). Curto demais, a venda rouba a
   * vez no meio da recarga. Longo demais, uma ferramenta que estourou segura a fila. 45 s fica com
   * folga dos dois lados.
   */
  const ABANDONO = 45000;

  const lerVez = () => {
    try {
      return JSON.parse(sessionStorage.getItem(CHAVE_VEZ)) || null;
    } catch {
      return null;
    }
  };
  const gravarVez = (valor) => {
    try {
      if (valor) sessionStorage.setItem(CHAVE_VEZ, JSON.stringify(valor));
      else sessionStorage.removeItem(CHAVE_VEZ);
    } catch {
      /* sem armazenamento: a fila vale so' em memoria, que ainda e' melhor do que nada. */
    }
  };

  /** A vez de agora, ja' descontando a abandonada. */
  const vezViva = () => {
    const vez = lerVez();
    if (!vez?.id) return null;
    if (Date.now() - Number(vez.batida || 0) > ABANDONO) {
      gravarVez(null);
      return null;
    }
    return vez;
  };

  /** Quem esta' a' espera, em ordem de chegada. So' em memoria: um F5 e todos pedem de novo. */
  const fila = [];
  let pulso = 0;
  const avisos = new Set();
  const avisar = () => {
    for (const fn of avisos) {
      try {
        fn(vezViva(), fila.map((e) => e.id));
      } catch {
        /* quem ouve nao derruba quem fala */
      }
    }
  };

  const bater = (id) => {
    const vez = lerVez();
    if (vez?.id === id) gravarVez({ ...vez, batida: Date.now() });
  };

  const tomar = (id) => {
    gravarVez({ id, desde: Date.now(), batida: Date.now() });
    clearInterval(pulso);
    pulso = setInterval(() => bater(id), BATIDA);
    avisar();
  };

  const largar = (id) => {
    const vez = lerVez();
    if (vez && vez.id !== id) return; // nao se solta a vez de outro
    clearInterval(pulso);
    pulso = 0;
    gravarVez(null);
    avisar();
    const seguinte = fila.shift();
    if (seguinte) {
      clearTimeout(seguinte.prazo);
      tomar(seguinte.id);
      seguinte.ok(() => largar(seguinte.id));
    }
  };

  const VEZ = {
    /**
     * Pede a vez e espera por ela. Devolve a funcao que a solta, ou `null` se o prazo acabou.
     *
     * Reentrante por dono: quem ja' tem a vez a recebe de volta na hora. E' o que permite ao
     * ginasio atravessar os proprios F5 — do outro lado da recarga ele pede outra vez, e a vez
     * ainda e' dele.
     */
    pedir(id, { espera = 15 * 60 * 1000 } = {}) {
      return new Promise((ok) => {
        const dono = vezViva();
        if (!dono || dono.id === id) {
          tomar(id);
          return ok(() => largar(id));
        }
        const entrada = { id, ok, prazo: 0 };
        entrada.prazo = setTimeout(() => {
          const onde = fila.indexOf(entrada);
          if (onde >= 0) fila.splice(onde, 1);
          avisar();
          ok(null);
        }, espera);
        fila.push(entrada);
        avisar();
      });
    },

    /** Quem esta' com a vez agora, ou `null`. */
    dono: () => vezViva(),

    /**
     * O nome de mostrar de uma ferramenta, para o painel que espera poder dizer por quem espera.
     *
     * "Esperando o Ginásio do dia terminar" e' uma frase; "esperando gym" e' um identificador
     * interno vazado para a tela de quem nao tem de saber que ele existe.
     */
    nome: (id) => CATALOGO.find((f) => f.id === id)?.nome || id,

    /** Quem esta' na fila, em ordem. */
    esperando: () => fila.map((e) => e.id),

    /** Sai da fila sem ter chegado a agir. */
    desistir(id) {
      for (let i = fila.length - 1; i >= 0; i -= 1)
        if (fila[i].id === id) {
          clearTimeout(fila[i].prazo);
          fila[i].ok(null);
          fila.splice(i, 1);
        }
      avisar();
    },

    /** Avisa sempre que a vez ou a fila mudam, para os paineis poderem dizer o que esperam. */
    aoMudar(fn) {
      avisos.add(fn);
      return () => avisos.delete(fn);
    },
  };

  // Uma aba que fecha no meio de uma corrida nao pode deixar a vez presa para a seguinte. Fora
  // isto, quem resolve e' o `ABANDONO`.
  addEventListener('pagehide', () => {
    const vez = lerVez();
    // So' se nao houver tarefa a atravessar a recarga: o ginasio recarrega de proposito, e ali a
    // vez TEM de continuar dele.
    if (vez && !localStorage.getItem('lioncode:gym:tarefa')) gravarVez(null);
  });

  /**
   * As ferramentas que este pacote tem, com nome e atalho, independentemente de terem conseguido
   * se registrar.
   *
   * "Sem grafico" roda no mundo da propria pagina (`world: MAIN` no manifest), porque precisa
   * alcancar o desenho do jogo. De la' ela nao enxerga este `globalThis`, so' o `localStorage`,
   * que os dois mundos partilham. Por isso ela entra no menu por esta lista, e nao pelo registro:
   * sem ela aqui, a unica ferramenta que nao daria para desligar seria justamente a que mais pesa.
   */
  const CATALOGO = [
    // `efeito` troca o verbo do botao do meio: em vez de mostrar e esconder uma janela, ele
    // liga e desliga o que a ferramenta faz — que e tudo o que a captura tem.
    {
      id: 'captura',
      nome: 'Captura automática',
      atalhos: 'Alt+C liga · Alt+V desliga',
      efeito: true,
      proprio: true,
    },
    // A loja tem janela propria (quantidades por item), entao o botao do meio mostra e esconde
    // em vez de ligar um efeito: `efeito` fica de fora.
    // Caçadas e Times tem janela propria, como a loja: o botao do meio mostra e esconde em vez
    // de ligar um efeito, entao `efeito` fica de fora.
    {
      id: 'cacadas',
      nome: 'Caçadas',
      atalhos: 'Alt+W abre o painel',
      proprio: true,
    },
    {
      id: 'times',
      nome: 'Times',
      atalhos: 'Alt+T abre o painel',
      proprio: true,
    },
    {
      id: 'escada',
      nome: 'Escada de caçadas',
      atalhos: 'Alt+P abre o painel',
      proprio: true,
    },
    {
      id: 'loja',
      nome: 'Loja do Mark',
      atalhos: 'Alt+L abre o painel',
      proprio: true,
    },
    // O ciclo nao tem janela nem estado ligado/desligado: e' uma acao que se dispara e acaba.
    {
      id: 'ciclo',
      nome: 'Ciclo da loja',
      atalhos: 'Alt+K roda o ciclo',
    },
  ];
  const modulos = CATALOGO.map((f) => ({ ...f, iniciar: null, vivo: false, erro: '' }));
  let montado = false;
  let relogio = 0;

  // Quem nunca escolheu nada fica com tudo ligado: trocar as cinco avulsas por este pacote nao
  // pode fazer a pessoa perder ferramenta nenhuma sem ter pedido.
  const escolhas = () => ler(CHAVE_LIGADOS, {});
  const ligado = (id) => escolhas()[id] !== false;

  /**
   * Mostrar e esconder atravessa o F5.
   *
   * Uma janela que a pessoa mandou sumir tem de continuar sumida na proxima carga: e' o que ela
   * pediu, e nao um estado de tela. Cada ferramenta le isto ao montar e obedece sem piscar.
   */
  const visiveis = () => ler(CHAVE_VISIVEIS, {});
  /**
   * Duas ferramentas ja' guardavam o seu estado antes deste menu existir, cada uma na sua chave, e
   * os atalhos delas continuam gravando la'. Para o menu nao virar uma segunda verdade que
   * discorda da primeira, dessas ele so' reflete o que elas informam (`proprio`).
   */
  const estaVisivel = (id) => {
    const m = modulos.find((x) => x.id === id);
    if (m && m.proprio) return m.estado === true;
    return visiveis()[id] !== false;
  };
  /** Enquanto a ferramenta nao se anuncia, o menu nao tem o que dizer sobre ela. */
  const sabido = (m) => !m.proprio || m.estado !== undefined;

  /**
   * Posicao de janelinha flutuante que sobrevive a mudar o tamanho da janela.
   *
   * Pixels contados do canto de cima a esquerda nao sobrevivem: encolher a janela — rearranjar as
   * views do LionMultInstance faz isso o tempo todo — joga a peca para fora, e o recorte que a traz
   * de volta e' definitivo, entao crescer de novo nao a devolve ao canto onde ela estava. Pior: num
   * quadrante baixo, uma peca guardada a 430px do topo simplesmente nao aparece.
   *
   * Por isso o que fica guardado e' a distancia ate' a borda mais proxima de cada eixo, e a posicao
   * e' recontada a cada tamanho de tela. Quem estava no canto de baixo a direita fica no canto de
   * baixo a direita, em qualquer quadrante, e voltar ao tamanho grande devolve tudo ao lugar.
   */
  const canto = {
    /** Le a posicao atual do elemento como distancia ate' as bordas mais proximas. */
    medir(el) {
      const c = el.getBoundingClientRect();
      const direita = c.left + c.width / 2 > innerWidth / 2;
      const baixo = c.top + c.height / 2 > innerHeight / 2;
      return {
        x: Math.round(direita ? innerWidth - c.right : c.left),
        y: Math.round(baixo ? innerHeight - c.bottom : c.top),
        direita,
        baixo,
      };
    },

    /**
     * Escreve `left`/`top` a partir do canto guardado, sempre dentro da tela.
     *
     * Devolve `false` quando nao havia o que aplicar: sem posicao guardada, ou com a peca
     * escondida — escondida ela nao tem caixa, e posicionar pelo zero a mandaria para o canto
     * errado. Quem chama reaplica quando ela volta a aparecer.
     */
    aplicar(el, guardado) {
      const pos = canto.doGuardado(guardado);
      if (!pos) return false;
      const c = el.getBoundingClientRect();
      if (!c.width && !c.height) return false;
      const x = pos.direita ? innerWidth - pos.x - c.width : pos.x;
      const y = pos.baixo ? innerHeight - pos.y - c.height : pos.y;
      const limite = (v, folga) => Math.max(0, Math.min(Math.max(0, folga), Math.round(v)));
      el.style.left = `${limite(x, innerWidth - c.width)}px`;
      el.style.top = `${limite(y, innerHeight - c.height)}px`;
      el.style.right = 'auto';
      el.style.bottom = 'auto';
      return true;
    },

    /** Aceita o formato antigo, em pixels do canto de cima a esquerda, gravado antes desta versao. */
    doGuardado(v) {
      if (!v) return null;
      if (typeof v.direita === 'boolean') return v;
      const x = parseFloat(v.x ?? v.left);
      const y = parseFloat(v.y ?? v.top);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return { x, y, direita: false, baixo: false };
    },
  };

  globalThis.PPX = {
    /** O canto guardado, partilhado por todas as janelinhas do pacote. */
    canto,

    /** A fila: quem quer agir no jogo pede a vez aqui. Ver o bloco "a vez", acima. */
    vez: VEZ,

    /** A ferramenta entrega aqui como se mostra e se esconde; o menu passa a comandar isso. */
    controlar(id, aplicar) {
      const m = modulos.find((x) => x.id === id);
      if (!m) return;
      m.aplicar = aplicar;
      desenhar();
    },

    /** O que ficou gravado da ultima vez, para a ferramenta ja' montar do jeito certo. */
    visivel: estaVisivel,

    /** A ferramenta avisa que mudou sozinha — por atalho, ou porque leu a propria chave. */
    anotar(id, valor) {
      const m = modulos.find((x) => x.id === id);
      if (!m) return;
      m.estado = valor !== false;
      // O atalho da ferramenta vale tanto quanto o botao do menu: tambem tem de atravessar o F5.
      if (!m.proprio) {
        const atual = visiveis();
        atual[id] = m.estado;
        gravar(CHAVE_VISIVEIS, atual);
      }
      if (montado) desenhar();
    },

    /**
     * Registra uma ferramenta. `iniciar` so' roda se ela estiver ligada nesta janela, e roda uma
     * vez so': os modulos foram escritos para montar na carga da pagina, nao para ir e voltar.
     */
    modulo(info, iniciar) {
      const m = modulos.find((x) => x.id === info.id);
      if (!m) return;
      m.iniciar = iniciar;
      agendarMontagem();
    },
  };

  const iniciarModulo = (m) => {
    if (m.vivo || m.erro || !m.iniciar) return;
    try {
      m.iniciar();
      m.vivo = true;
    } catch (e) {
      // Uma ferramenta que estourou nao pode levar as outras junto, nem sumir sem explicacao: o
      // menu passa a mostrar o erro ao lado do nome dela.
      m.erro = String((e && e.message) || e).slice(0, 80);
    }
  };

  const raiz = document.createElement('div');
  for (const [prop, valor] of [
    ['all', 'initial'],
    ['position', 'fixed'],
    ['z-index', '2147483646'],
    ['font', '13px system-ui, sans-serif'],
    ['color', '#e6e9ef'],
    ['visibility', 'visible'],
  ])
    raiz.style.setProperty(prop, valor, 'important');
  const sombra = raiz.attachShadow({ mode: 'open' });
  const estilo = document.createElement('style');
  estilo.textContent = `
    * { box-sizing: border-box; }
    .menu, .aba {
      position: fixed; right: 14px; bottom: 56px;
      background: #1d2433; color: #e6e9ef; border: 1px solid #3a4152; border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
      opacity: .82; transition: opacity .15s;
    }
    .menu:hover, .menu:focus-within, .aba:hover, .aba:focus { opacity: 1; }
    .menu { display: none; flex-direction: column; min-width: 232px; }
    .menu.aberto { display: flex; }
    .cabeca {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 8px; border-bottom: 1px solid #3a4152; user-select: none;
    }
    .alca { color: #8b93a5; font-size: 15px; cursor: move; touch-action: none; }
    .titulo { flex: 1; color: #e6e9ef; line-height: 1.1; }
    .titulo small { display: block; color: #6f7789; font-size: 11px; }
    .legenda {
      padding: 4px 10px 0; color: #6f7789; font-size: 11px; line-height: 1.35;
      border-top: 1px solid #2a3243; margin-top: 2px;
    }
    .fechar {
      background: none; border: 0; color: #8b93a5; cursor: pointer; font: inherit;
      padding: 0 4px; border-radius: 6px;
    }
    .fechar:hover { color: #e6e9ef; background: #2a3243; }
    ul { list-style: none; margin: 0; padding: 4px; }
    li { display: flex; align-items: center; gap: 8px; padding: 5px 6px; border-radius: 7px; }
    li:hover { background: #222a39; }
    .nome { flex: 1; }
    .nome small { display: block; color: #6f7789; }
    .nome .erro { color: #f0a9a9; }
    .olho {
      flex: none; background: #2a3243; border: 1px solid #3a4152; color: #c3c9d6;
      border-radius: 7px; padding: 2px 7px; cursor: pointer; font: inherit; font-size: 11px;
      min-width: 62px;
    }
    .olho:hover:not(:disabled) { background: #333d52; color: #e6e9ef; }
    .olho.apagado { color: #6f7789; background: #1a2030; }
    .olho:disabled { opacity: .45; cursor: default; }
    .chave {
      flex: none; width: 34px; height: 18px; border-radius: 10px; border: 1px solid #3a4152;
      background: #11151d; cursor: pointer; padding: 0; position: relative;
    }
    .chave span {
      position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%;
      background: #6f7789; transition: left .15s, background .15s;
    }
    .chave[aria-checked="true"] { background: #1e3326; border-color: #3a5a3f; }
    .chave[aria-checked="true"] span { left: 18px; background: #9ae6a8; }
    .rodape { padding: 6px 10px; border-top: 1px solid #3a4152; color: #6f7789; }
    .rodape button {
      background: #2a3243; border: 1px solid #3a4152; color: #e6e9ef; border-radius: 7px;
      padding: 3px 8px; cursor: pointer; font: inherit; margin-left: 6px;
    }
    .aba {
      display: none; align-items: center; gap: 6px; padding: 7px 11px; cursor: pointer;
      border: 1px solid #3a4152; font: inherit; color: #e6e9ef;
    }
    .aba.aberta { display: inline-flex; }
    .aba:hover { background: #2a3243; }
  `;

  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.innerHTML = `
    <div class="cabeca">
      <span class="alca" title="Arraste daqui para mover">⠿</span>
      <span class="titulo">Poke Idle World<small>qualidade de vida</small></span>
      <button class="fechar" title="Fechar o menu (Alt+Q)">—</button>
    </div>
    <ul></ul>
    <div class="legenda">
      O botão do meio mostra, esconde ou liga o efeito — e fica assim no próximo F5.
      A chave verde ativa ou desativa a ferramenta inteira nesta janela.
      <b>Alt+Z</b> esconde todas as janelas de uma vez; <b>Alt+X</b> traz de volta as que estavam à vista.
    </div>
    <div class="rodape"></div>`;
  const lista = menu.querySelector('ul');
  const rodape = menu.querySelector('.rodape');

  const aba = document.createElement('button');
  aba.className = 'aba';
  aba.textContent = 'Poke Idle';
  aba.title = 'Abrir o menu das ferramentas (Alt+Q)';

  let aberto = ler(CHAVE_ABERTO, false) === true;
  // A lista do que estava a' vista quando se escondeu tudo, ou `null` quando nao se escondeu.
  // Mora aqui em cima porque `pintar` a consulta, e ela tem de existir antes do primeiro desenho.
  let sumico = ler(CHAVE_SUMICO, null);
  const pintar = () => {
    menu.classList.toggle('aberto', aberto);
    // A abinha **nao** sai com o Alt+Z. Ela e' o menu geral, e e' por ela que se volta: quem
    // escondeu tudo costuma querer a tela do jogo limpa, nao o pacote inteiro desaparecido. Alt+Q
    // tambem abre o menu, mas depender so' do atalho e' uma porta sem macaneta para quem esqueceu.
    aba.classList.toggle('aberta', !aberto);
    // Quem acabou de aparecer so' agora tem medidas: e' aqui que ele vai para o canto guardado.
    if (montado) colocar();
  };
  const abrir = (sim) => {
    aberto = sim;
    pintar();
    gravar(CHAVE_ABERTO, sim);
  };
  menu.querySelector('.fechar').onclick = () => abrir(false);

  function desenhar() {
    lista.textContent = '';
    for (const m of modulos) {
      const li = document.createElement('li');
      const nome = document.createElement('span');
      nome.className = 'nome';
      nome.textContent = m.nome;
      const sub = document.createElement('small');
      sub.textContent = m.erro ? `erro: ${m.erro}` : m.atalhos || '';
      if (m.erro) sub.className = 'erro';
      nome.appendChild(sub);

      // Dois comandos por ferramenta, e eles nao sao a mesma coisa: o do meio mostra e esconde
      // (ou liga e desliga o efeito) sem tirar a ferramenta do ar; a chave desinstala da janela.
      const olho = document.createElement('button');
      olho.className = 'olho';
      const vendo = estaVisivel(m.id);
      const conhecido = sabido(m);
      olho.textContent = !conhecido
        ? '—'
        : m.efeito
          ? vendo
            ? 'ligado'
            : 'desligado'
          : vendo
            ? 'à vista'
            : 'oculta';
      olho.classList.toggle('apagado', !vendo);
      // Sem a ferramenta no ar nao ha' o que mostrar nem o que esconder: o botao fica apagado em
      // vez de prometer uma acao que nao aconteceria.
      olho.disabled = !ligado(m.id) || !!m.erro || !conhecido || (!m.aplicar && !m.externo);
      olho.title = m.efeito
        ? 'Liga e desliga o efeito nesta janela'
        : 'Mostra e esconde a janela desta ferramenta';
      olho.onclick = () => alternarVisivel(m);

      const chave = document.createElement('button');
      chave.className = 'chave';
      chave.setAttribute('role', 'switch');
      chave.setAttribute('aria-checked', String(ligado(m.id)));
      chave.title = ligado(m.id)
        ? 'Desativar a ferramenta nesta janela'
        : 'Ativar a ferramenta nesta janela';
      chave.appendChild(document.createElement('span'));
      chave.onclick = () => alternar(m);

      li.append(nome, olho, chave);
      lista.appendChild(li);
    }
  }

  /**
   * Mostra ou esconde, e grava.
   *
   * A ferramenta que roda no mundo da pagina nao e' alcancavel daqui por chamada de funcao: o
   * recado vai por um evento no DOM, que os dois mundos partilham.
   */
  function aplicarVisivel(m, mostrar) {
    if (m.proprio) {
      // Quem guarda e' a propria ferramenta, na chave dela; aqui so' se manda aplicar.
      m.estado = mostrar;
    } else {
      const atual = visiveis();
      atual[m.id] = mostrar;
      gravar(CHAVE_VISIVEIS, atual);
    }
    if (m.aplicar) {
      try {
        m.aplicar(mostrar);
      } catch (e) {
        m.erro = String((e && e.message) || e).slice(0, 80);
      }
    } else if (m.externo) {
      document.dispatchEvent(
        new CustomEvent('ppx-visivel', { detail: JSON.stringify({ id: m.id, mostrar }) }),
      );
    }
    desenhar();
  }

  const alternarVisivel = (m) => aplicarVisivel(m, !estaVisivel(m.id));

  /**
   * Esconder tudo, e trazer de volta exatamente o que estava a' vista.
   *
   * SAO DOIS ATALHOS, e nao um que alterna — a mesma regra de cada ferramenta deste pacote, e pelo
   * mesmo motivo: com um atalho so' nunca se sabe em que estado se esta' sem olhar, e quem aperta
   * duas vezes volta ao comeco. Alt+Z esconde, Alt+X mostra, e apertar o mesmo de novo nao desfaz
   * nada.
   *
   * **ESCONDER DUAS VEZES NAO PODE APAGAR A LISTA.** E' o unico jeito de este par se estragar:
   * com tudo ja' escondido, um segundo Alt+Z gravaria uma lista vazia por cima da boa, e o Alt+X
   * seguinte nao teria o que trazer de volta. Por isso o segundo Alt+Z nao faz nada.
   *
   * **O QUE VOLTA E' O QUE ESTAVA**, e nao tudo. Quem escondeu o Raridades ontem nao o quer de
   * volta por ter dado um Alt+Z hoje. A lista do que estava a' vista fica guardada, e e' por ela
   * que a volta se faz.
   *
   * **AS FERRAMENTAS DE EFEITO NAO ENTRAM.** "Ocultar popups" e "Sem grafico" nao tem janela
   * nenhuma na tela: o botao delas liga e desliga o que elas fazem com a pagina. Apaga-las aqui
   * nao limparia a tela — mudaria o comportamento do jogo, que nao e' o que estes atalhos prometem.
   *
   * **A ABINHA DO MENU FICA.** Ela e' o menu geral do pacote, nao uma das janelas que se quer
   * tirar da frente: o que estorva a vista do jogo sao os paineis das ferramentas. Deixa-la a'
   * vista mantem o caminho de volta a um clique, sem depender de lembrar o Alt+X.
   *
   * **A SENHA FICA, E E' REGRA, NAO GOSTO.** A caixa de login so' aparece onde ha' senha para
   * digitar — a tela em que o jogo ainda nao comecou e nao ha' vista nenhuma a desimpedir. Um
   * Alt+Z dado por engano ali escondia justamente o botao de entrar, e so' o menu do pacote o
   * trazia de volta. Ela some' pelo que a pessoa aponta, e nao de carona: o botao de esconder
   * dela, no menu. `FORA_DO_SUMICO` e' a lista de quem nao entra nesta conta.
   */
  const FORA_DO_SUMICO = ['senha'];
  const comJanela = () =>
    modulos.filter((m) => !m.efeito && m.aplicar && !FORA_DO_SUMICO.includes(m.id));

  function esconderTudo() {
    // Ja' escondido, nao ha' nada a esconder — e refazer a lista aqui seria apaga-la.
    if (Array.isArray(sumico)) return;
    const janelas = comJanela();
    sumico = janelas.filter((m) => estaVisivel(m.id)).map((m) => m.id);
    gravar(CHAVE_SUMICO, sumico);
    for (const m of janelas) if (estaVisivel(m.id)) aplicarVisivel(m, false);
    // O menu aberto por cima da tela limpa seria a unica janela restante.
    if (aberto) abrir(false);
    pintar();
    desenhar();
  }

  function mostrarTudo() {
    if (!Array.isArray(sumico)) return;
    const voltam = sumico;
    sumico = null;
    gravar(CHAVE_SUMICO, null);
    for (const m of comJanela())
      if (voltam.includes(m.id) && !estaVisivel(m.id)) aplicarVisivel(m, true);
    pintar();
    desenhar();
  }

  /**
   * Ligar vale na hora; desligar so' na proxima carga.
   *
   * As ferramentas montam a interface, prendem atalhos e deixam relogios rodando. Desfazer tudo
   * isso em ordem seria uma segunda implementacao de cada uma, so' para o botao desligar — e e'
   * exatamente onde nasceriam os bugs. Recarregar a pagina faz isso de graca e sem engano.
   */
  function alternar(m) {
    const atual = escolhas();
    const novo = !ligado(m.id);
    atual[m.id] = novo;
    gravar(CHAVE_LIGADOS, atual);
    if (novo) iniciarModulo(m);
    desenhar();
    rodape.textContent = novo ? '' : 'Desligada a partir da próxima carga da página.';
    if (!novo) {
      const botao = document.createElement('button');
      botao.textContent = 'recarregar agora';
      botao.onclick = () => location.reload();
      rodape.appendChild(botao);
    }
  }

  const dentro = (el, x, y) => {
    const r = el.getBoundingClientRect();
    el.style.left = `${Math.max(0, Math.min(x, innerWidth - r.width))}px`;
    el.style.top = `${Math.max(0, Math.min(y, innerHeight - r.height))}px`;
    el.style.right = 'auto';
    el.style.bottom = 'auto';
  };
  let pos = ler(CHAVE_POS, null);
  // So' um dos dois esta' a vista de cada vez; o escondido nao tem caixa para medir, e por isso
  // `pintar` reaplica assim que ele aparece.
  const colocar = () => {
    canto.aplicar(menu, pos);
    canto.aplicar(aba, pos);
  };

  /**
   * Arrastar, tanto pelo ⠿ do menu aberto quanto pelo proprio botao quando ele esta' minimizado.
   *
   * No botao nao da' para ter uma alca separada — ele e' do tamanho do texto. Entao ele e' as duas
   * coisas, e quem decide e' a distancia: andou menos de 4px, foi um clique e o menu abre; andou
   * mais, foi arrasto e o clique nao conta.
   */
  function arrastavel(pegador, movido, aoClicar) {
    let dx = 0;
    let dy = 0;
    let partida = null;
    let andou = false;
    pegador.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const r = movido.getBoundingClientRect();
      dx = e.clientX - r.left;
      dy = e.clientY - r.top;
      partida = { x: e.clientX, y: e.clientY };
      andou = false;
      pegador.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    pegador.addEventListener('pointermove', (e) => {
      if (!partida) return;
      if (!andou && Math.abs(e.clientX - partida.x) + Math.abs(e.clientY - partida.y) < 4) return;
      andou = true;
      dentro(movido, e.clientX - dx, e.clientY - dy);
    });
    const soltar = (e) => {
      if (!partida) return;
      partida = null;
      try {
        pegador.releasePointerCapture(e.pointerId);
      } catch {
        /* ponteiro ja solto */
      }
      if (!andou) {
        if (aoClicar) aoClicar();
        return;
      }
      pos = canto.medir(movido);
      gravar(CHAVE_POS, pos);
      colocar();
    };
    pegador.addEventListener('pointerup', soltar);
    pegador.addEventListener('pointercancel', soltar);
  }

  arrastavel(menu.querySelector('.alca'), menu);
  // O menu e o botao partilham o mesmo canto guardado: arrastar um leva o outro junto, senao
  // minimizar faria a janelinha reaparecer longe de onde o menu estava.
  arrastavel(aba, aba, () => abrir(true));

  // Rearranjar as views muda o tamanho da janela; sem isto o menu ficaria pendurado para fora.
  let ajuste = 0;
  addEventListener('resize', () => {
    clearTimeout(ajuste);
    ajuste = setTimeout(colocar, 150);
  });

  // Alt+Q abre e fecha o menu. O atalho para aqui: deixar passar dispararia tambem o que o jogo
  // tiver em Alt.
  addEventListener(
    'keydown',
    (e) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      // Alt+Z limpa a tela inteira de uma vez; Alt+X traz de volta o que estava a' vista.
      if (e.code === 'KeyZ' || e.code === 'KeyX') {
        e.preventDefault();
        e.stopPropagation();
        if (e.code === 'KeyZ') esconderTudo();
        else mostrarTudo();
        return;
      }
      if (e.code !== 'KeyQ') return;
      e.preventDefault();
      e.stopPropagation();
      abrir(!aberto);
    },
    true,
  );

  /**
   * Monta quando o DOM existir e os registros pararem de chegar.
   *
   * Os arquivos nao entram todos ao mesmo tempo: "ocultar popups" vem em `document_start`, junto
   * com este, e os outros em `document_idle`, bem depois. Um `setTimeout(0)` montaria o menu antes
   * de metade das ferramentas existir, e elas ficariam de fora da lista.
   */
  function montar() {
    if (montado) return;
    montado = true;
    for (const m of modulos) if (ligado(m.id)) iniciarModulo(m);
    sombra.append(estilo, menu, aba);
    document.body.appendChild(raiz);
    desenhar();
    pintar();
    colocar();
  }

  function agendarMontagem() {
    if (montado) {
      // Registro atrasado: entra agora, para nao ficar fora do menu nem deixar de iniciar.
      for (const m of modulos) if (ligado(m.id)) iniciarModulo(m);
      desenhar();
      return;
    }
    if (!document.body) {
      addEventListener('DOMContentLoaded', agendarMontagem, { once: true });
      return;
    }
    clearTimeout(relogio);
    relogio = setTimeout(montar, 200);
  }

  // O mundo da pagina nao alcanca este `globalThis`, so' o DOM: e' por ele que a ferramenta de la'
  // conta em que estado esta'.
  document.addEventListener('ppx-estado', (e) => {
    try {
      const { id, visivel } = JSON.parse(e.detail);
      globalThis.PPX.anotar(id, visivel);
    } catch {
      /* recado malformado: nao e' motivo para derrubar o menu */
    }
  });

  // Sem nenhuma ferramenta registrada — todas desligadas, ou todas com erro — o menu ainda precisa
  // aparecer: e' por ele que se liga qualquer uma de volta.
  if (document.body) agendarMontagem();
  else addEventListener('DOMContentLoaded', agendarMontagem, { once: true });
})();
