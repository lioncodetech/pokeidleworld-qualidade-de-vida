// Arrumar os painéis: põe cada janela do pacote no canto dela, guarda arrumações suas, e manda
// a arrumação para as outras janelas abertas.
//
// POR QUE ISTO EXISTE. Os painéis são arrastáveis e o lugar sobrevive ao F5 — o que é bom até o
// dia em que se arrasta um para cima do painel de captura do jogo e não se lembra mais onde ele
// estava. Antes disto, desfazer era abrir o `localStorage` à mão.
//
// OS CANTOS NÃO SÃO GOSTO, SÃO MEDIDA. Medido em 10/10/2026, numa tela de 1920x863, o jogo
// ocupa: HUD da equipe `x 16-262, y 16-426`; barra de cima `y 16-72`; chat `x 14-342, y
// 613-849`; e o painel de captura dele `x 1644-1908, y 599-767`. Os quatro cantos daqui são o
// que sobra, e é por isso que o da Loja fica ao centro e não à esquerda: ali está o chat.
//
// MAS O CANTO MEDIDO É UM PONTO DE PARTIDA, NÃO UMA REGRA. Quem joga em dois monitores, ou com o
// chat fechado, quer o seu próprio lugar — então dá para arrastar à vontade, **guardar com um
// nome** o que ficou, e voltar a ele depois. O "cada um no seu canto" passou a ser só uma
// arrumação a mais, a que vem de fábrica.
//
// ELE NÃO TEM ESTADO DE POSIÇÃO PRÓPRIO. Quem é dono da posição de um painel é o módulo dele, na
// chave dele. Este aqui escreve naquelas chaves e mexe no DOM que já está na tela — se escrevesse
// só na chave, a arrumação só apareceria no F5 seguinte, e quem clica em "arrumar" quer ver
// arrumado agora. O que é dele são as arrumações guardadas, com nome.
//
// AS OUTRAS JANELAS. O utilizador joga em várias janelas do mesmo jogo. Elas partilham o
// `localStorage`, então uma arrumação guardada já aparece nas outras — mas só no F5 seguinte, e
// ninguém quer dar F5 em seis janelas. O evento `storage` chega às **outras** janelas do mesmo
// site na hora, e é por ele que a arrumação viaja. Para fora deste navegador (outro perfil, outra
// máquina) o caminho é o código de exportar, que é texto e se copia à mão.
//
PPX.modulo(
  {
    id: 'arrumar',
    nome: 'Arrumar os painéis',
    atalhos: 'Alt+U esconde · Alt+J mostra · Alt+Shift+J arruma',
    proprio: true,
  },
  () => {
    'use strict';

    const CHAVE = 'lioncode:pokeidleworld:arrumar';

    // A chave do recado para as outras janelas. Ela não guarda estado nenhum: é só o carimbo de
    // "aplica isto agora", e o `storage` dispara no resto das janelas quando ela muda.
    const CHAVE_SINAL = 'lioncode:pokeidleworld:arrumar:sinal';

    /**
     * Os painéis do pacote, com a chave onde cada um guarda a posição e o canto de casa.
     *
     * `canto(w, h)` recebe o tamanho da tela e devolve o ponto de cima à esquerda do painel, em
     * pixels — não em "direita: 18px", porque é `left`/`top` que o arrasto grava, e misturar as
     * duas formas foi o que fez um painel nascer num canto e acordar noutro.
     */
    const PAINEIS = [
      {
        id: 'cacadas',
        nome: 'Caçadas',
        chave: 'lioncode:pokeidleworld:cacadas',
        seletor: '.cjx',
        largura: 248,
        canto: (w) => ({ x: w - 248 - 18, y: 96 }),
      },
      {
        id: 'escada',
        nome: 'Escada de caçadas',
        chave: 'lioncode:pokeidleworld:escada',
        seletor: '.esx',
        largura: 252,
        canto: (w) => ({ x: w - 252 - 300, y: 96 }),
      },
      {
        id: 'times',
        nome: 'Times',
        chave: 'lioncode:pokeidleworld:times',
        seletor: '.tmx',
        largura: 262,
        canto: (w, h) => ({ x: w - 262 - 300, y: Math.max(96, h - 96 - 330) }),
      },
      {
        id: 'loja',
        nome: 'Loja do Mark',
        chave: 'lioncode:pokeidleworld:loja:cfg',
        seletor: '.ljx',
        largura: 272,
        canto: (w, h) => ({ x: 360, y: Math.max(96, h - 96 - 360) }),
      },
    ];

    const porId = (id) => PAINEIS.find((p) => p.id === id) || null;

    const PADRAO = { pos: null, compacto: false, arranjos: {}, espalhar: true };
    let cfg = { ...PADRAO };
    try {
      const cru = localStorage.getItem(CHAVE);
      if (cru) cfg = { ...cfg, ...JSON.parse(cru) };
    } catch {
      /* fica o padrao */
    }
    if (!cfg.arranjos || typeof cfg.arranjos !== 'object') cfg.arranjos = {};
    const gravar = () => {
      try {
        localStorage.setItem(CHAVE, JSON.stringify(cfg));
        return true;
      } catch {
        /* janela sem armazenamento: vale so' para esta sessao */
        return false;
      }
    };

    // --------------------------------------------------------------- arrumar

    /**
     * Escreve a posição na chave do módulo dono, sem tocar no resto do que ele guarda.
     *
     * Devolve false quando não deu — chave ilegível, armazenamento fechado. Um painel que não
     * se consegue guardar ainda assim se move na tela; só não sobrevive ao F5, e é melhor dizer
     * isso do que fingir que ficou.
     */
    function guardarPos(chave, pos) {
      try {
        const cru = localStorage.getItem(chave);
        const dono = cru ? JSON.parse(cru) : {};
        if (!dono || typeof dono !== 'object') return false;
        dono.pos = pos;
        localStorage.setItem(chave, JSON.stringify(dono));
        return true;
      } catch {
        return false;
      }
    }

    /**
     * O `canto` do núcleo: a conta de "distância até a borda mais próxima" que faz um lugar
     * guardado sobreviver a encolher a janela. Sem ele não há arrumação a fazer — e é melhor
     * dizer isso do que mexer nos painéis com uma conta pior, em silêncio.
     */
    const oCanto = () => globalThis.PPX?.canto || null;

    /**
     * Prende um ponto dentro da tela. Numa janela estreita o canto da direita cai em x negativo,
     * e um painel fora da tela é um painel perdido: não se consegue nem arrastá-lo de volta.
     */
    const prender = (pos, w, h) => ({
      x: Math.max(0, Math.min(Math.round(pos.x), Math.max(0, w - 60))),
      y: Math.max(0, Math.min(Math.round(pos.y), Math.max(0, h - 40))),
    });

    /**
     * Onde um painel está agora. A tela manda sobre a chave: o arrasto grava ao soltar, mas um
     * painel a meio de um arrasto, ou movido por outra via, está onde se vê.
     */
    function lerPos(p) {
      const c = oCanto();
      if (!c) return null;
      const el = document.querySelector(p.seletor);
      const r = el?.getBoundingClientRect?.();
      // Escondido nao tem caixa; entao o que vale e' o que esta' guardado na chave dele.
      if (r && (r.width || r.height)) return c.medir(el);
      try {
        const cru = localStorage.getItem(p.chave);
        return c.doGuardado(cru ? JSON.parse(cru)?.pos : null);
      } catch {
        /* chave ilegivel: este painel nao entra na arrumacao, os outros entram */
        return null;
      }
    }

    /** A arrumação de agora: o que se guarda quando se clica em "guardar onde estão". */
    function lerArranjo() {
      const a = {};
      for (const p of PAINEIS) {
        const pos = lerPos(p);
        if (pos) a[p.id] = pos;
      }
      return a;
    }

    /** A arrumação de fábrica, calculada para o tamanho da tela de agora. */
    function arranjoDosCantos() {
      const w = innerWidth || 0;
      const h = innerHeight || 0;
      const a = {};
      // `direita/baixo` falsos: os cantos medidos sao contados do canto de cima a' esquerda, e
      // esse e' um canto tao valido como os outros tres.
      for (const p of PAINEIS)
        a[p.id] = { ...prender(p.canto(w, h), w, h), direita: false, baixo: false };
      return a;
    }

    /**
     * Peneira o que veio de fora — do código de importar, ou do recado de outra janela.
     *
     * Só ids conhecidos e só números finitos passam. Devolve `null` quando não sobrou nada:
     * aplicar um arranjo vazio não é arrumar, é não fazer nada calado.
     */
    function limparArranjo(bruto) {
      if (!bruto || typeof bruto !== 'object') return null;
      const a = {};
      for (const [id, pos] of Object.entries(bruto)) {
        if (!porId(id)) continue;
        if (!pos || typeof pos !== 'object') continue;
        if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) continue;
        // As duas bandeiras dizem de que borda e' que a distancia foi contada; perde-las poria
        // o painel do canto de baixo a' direita no canto de cima a' esquerda.
        a[id] = {
          x: Math.round(pos.x),
          y: Math.round(pos.y),
          direita: pos.direita === true,
          baixo: pos.baixo === true,
        };
      }
      return Object.keys(a).length ? a : null;
    }

    /**
     * Põe os painéis do arranjo no lugar, agora: no DOM e na chave de quem é dono de cada um.
     *
     * Um painel que não está na tela — fechado, ou a ferramenta desligada — é arrumado na chave
     * dele na mesma: quando voltar, volta no lugar certo.
     */
    function aplicarArranjo(arranjo) {
      const c = oCanto();
      let naTela = 0;
      let quantos = 0;
      const semGuardar = [];
      for (const p of PAINEIS) {
        const pos = c?.doGuardado(arranjo?.[p.id]);
        if (!pos) continue;
        quantos += 1;
        const el = document.querySelector(p.seletor);
        // `aplicar` recusa quem nao tem caixa — escondido nao se posiciona pelo zero. Para esse,
        // a chave basta: o modulo dono recoloca-o quando ele voltar a' vista.
        if (el && c.aplicar(el, pos)) naTela += 1;
        if (!guardarPos(p.chave, pos)) semGuardar.push(p.nome);
      }
      return { naTela, quantos, semGuardar };
    }

    /** A frase de um `aplicarArranjo`. Diz quantos se mexeram e o que não vai sobreviver ao F5. */
    function frasear(r) {
      if (!r.quantos) return 'Esta arrumação não tem nenhum painel conhecido.';
      const base = `${r.naTela} ${r.naTela === 1 ? 'painel arrumado' : 'painéis arrumados'} na tela`;
      const resto = r.quantos - r.naTela;
      const comFechados = resto
        ? `${base}; ${resto} ${resto === 1 ? 'fechado' : 'fechados'} esperam no lugar certo.`
        : `${base}.`;
      if (!r.semGuardar.length) return comFechados;
      return `${comFechados} Não consegui guardar: ${r.semGuardar.join(', ')} — voltam ao antigo no F5.`;
    }

    /** O botão de fábrica: cada um no canto medido. */
    function arrumar() {
      if (!oCanto())
        return 'Este núcleo é antigo e não sabe posicionar painéis. Recarregue a extensão.';
      return frasear(aplicarArranjo(arranjoDosCantos()));
    }

    // ----------------------------------------------- as arrumações com nome

    /** Guarda a arrumação de agora com um nome. Sobrescreve a de mesmo nome, de propósito. */
    function guardarArranjo(nome) {
      const n = String(nome || '').trim().slice(0, 40);
      if (!n) return 'Dê um nome à arrumação.';
      const a = lerArranjo();
      if (!Object.keys(a).length)
        return 'Nenhum painel na tela nem posição guardada: não há o que guardar.';
      const tinha = Boolean(cfg.arranjos[n]);
      cfg.arranjos[n] = a;
      const ok = gravar();
      const quantos = Object.keys(a).length;
      const frase = `“${n}” ${tinha ? 'regravada' : 'guardada'} com ${quantos} ${quantos === 1 ? 'painel' : 'painéis'}.`;
      return ok ? frase : `${frase} Mas esta janela não guarda nada: morre no F5.`;
    }

    /** Volta a uma arrumação guardada, e manda-a às outras janelas se for para espalhar. */
    function usarArranjo(nome) {
      const n = String(nome || '').trim();
      const a = limparArranjo(cfg.arranjos[n]);
      if (!a) return `Não tenho a arrumação “${nome}”.`;
      // Guardar qual foi a ultima e' o que faz o atalho funcionar com o painel fechado: sem
      // isto, Alt+Shift+J so' teria resposta depois de abrir o painel e escolher na lista.
      if (cfg.ultima !== n) {
        cfg.ultima = n;
        gravar();
      }
      const frase = frasear(aplicarArranjo(a));
      return cfg.espalhar === false ? frase : `${frase}${espalhar(a) ? ' Mandei às outras janelas.' : ''}`;
    }

    function apagarArranjo(nome) {
      const n = String(nome || '').trim();
      if (!cfg.arranjos[n]) return `Não tenho a arrumação “${n}”.`;
      delete cfg.arranjos[n];
      gravar();
      return `“${n}” apagada.`;
    }

    const nomesDosArranjos = () => Object.keys(cfg.arranjos).sort((a, b) => a.localeCompare(b));

    /**
     * Qual arrumação o "Aplicar" aplica — a da lista, a última usada, ou a primeira que houver.
     *
     * A lista só existe depois de o painel ser montado, e o atalho tem de funcionar com ele
     * fechado: é para isso que serve a última usada. E a primeira que houver é para quem acabou
     * de importar um código e aperta o atalho antes de abrir qualquer coisa.
     */
    function escolhida() {
      const daLista = seletor && seletor.value ? String(seletor.value) : '';
      if (cfg.arranjos[daLista]) return daLista;
      const ultima = String(cfg.ultima || '');
      if (cfg.arranjos[ultima]) return ultima;
      return nomesDosArranjos()[0] || '';
    }

    /** O que o botão Aplicar e o Alt+Shift+J fazem. */
    function aplicarEscolhida() {
      const n = escolhida();
      if (!n) return 'Não há arrumação guardada. Arraste os painéis e clique em “Guardar onde estão”.';
      return usarArranjo(n);
    }

    // ------------------------------------------- as outras janelas, e fora

    /**
     * Deixa o recado para as outras janelas do mesmo site.
     *
     * O `storage` não dispara na janela que escreveu — por isso não há aqui nenhum cuidado para
     * não aplicar o próprio recado. O `n` existe para o recado ser sempre diferente do anterior:
     * gravar o mesmo valor não dispara evento nenhum, e mandar duas vezes a mesma arrumação é
     * exatamente o que se faz quando a primeira não pegou. `Date.now()` não serviria sozinho —
     * dois cliques no mesmo milissegundo dariam o mesmo texto, e o segundo não chegaria a ninguém.
     */
    let nRecado = 0;
    function espalhar(arranjo) {
      try {
        nRecado += 1;
        localStorage.setItem(
          CHAVE_SINAL,
          JSON.stringify({ arranjo, t: Date.now(), n: nRecado }),
        );
        return true;
      } catch {
        return false;
      }
    }

    /** O código de levar para outro navegador: as arrumações guardadas, em texto. */
    const exportar = () => JSON.stringify({ v: 1, arranjos: cfg.arranjos });

    /**
     * Lê um código de exportar. Aceita o objeto inteiro ou só o mapa de arrumações, porque quem
     * cola texto cola o que tem à mão. Nada é aplicado: importar é ganhar opções, não mudar a tela.
     */
    function importar(texto) {
      let dado = null;
      try {
        dado = JSON.parse(String(texto || ''));
      } catch {
        return 'Esse código não é um JSON válido.';
      }
      const vindos = dado && typeof dado === 'object' ? dado.arranjos || dado : null;
      if (!vindos || typeof vindos !== 'object') return 'Esse código não tem arrumação nenhuma.';
      const entraram = [];
      for (const [nome, bruto] of Object.entries(vindos)) {
        const a = limparArranjo(bruto);
        if (!a) continue;
        cfg.arranjos[String(nome).trim().slice(0, 40)] = a;
        entraram.push(nome);
      }
      if (!entraram.length) return 'Esse código não tem arrumação nenhuma que eu reconheça.';
      gravar();
      return `${entraram.length} ${entraram.length === 1 ? 'arrumação' : 'arrumações'}: ${entraram.join(', ')}.`;
    }

    // --------------------------------------------------------------- o painel

    let painel = null;
    /** Devolvido pelo nucleo: recoloca o painel no canto guardado. */
    let recolocar = () => false;
    let visivel = false;

    const diz = (txt) => {
      const alvo = painel?.querySelector('.arx-status');
      if (alvo) alvo.textContent = txt;
    };

    addEventListener('storage', (e) => {
      if (!e || e.key !== CHAVE_SINAL || !e.newValue) return;
      let a = null;
      try {
        a = limparArranjo(JSON.parse(e.newValue)?.arranjo);
      } catch {
        return;
      }
      if (!a) return;
      aplicarArranjo(a);
      diz('Arrumação recebida de outra janela.');
    });

    // A moldura, a barra, os botoes, o separador, o status, a rolagem e o foco vem do
    // nucleo: cinco copias da mesma folha derivam, e derivaram. Aqui fica o que e' deste
    // painel — e vem depois, por isso ganha nos empates.
    const CSS = (globalThis.PPX?.estiloDePainel?.('arx') || '') + [
      // O canto deste é o que sobra: em cima à esquerda, logo abaixo do HUD da equipe.
      '.arx{left:18px;top:440px;width:248px}',
      '.arx-dupla{display:flex;gap:6px}',
      '.arx-dupla button{flex:1}',
      '.arx input,.arx select,.arx textarea{width:100%;box-sizing:border-box;margin-top:8px;',
      'background:#0b0e14;color:#e6e9ef;border:1px solid #3a4152;border-radius:5px;',
      'padding:5px 6px;font:12px system-ui,sans-serif}',
      '.arx textarea{height:54px;resize:vertical;font-family:ui-monospace,monospace;font-size:11px}',
      '.arx-caixa{display:flex;align-items:center;gap:6px;margin-top:8px;font-size:11.5px;',
      'opacity:.85;cursor:pointer}',
      '.arx-caixa input{width:auto;margin:0}',
      '.arx-dica{margin-top:9px;font-size:11px;opacity:.6;line-height:1.35}',
      // Minimizado some com tudo **menos** a lista e o Aplicar: minimizar e' para ficar com a
      // ferramenta a' mao, e a ferramenta aqui e' voltar a uma arrumacao. Um painel compacto que
      // escondesse justamente isso seria um painel que so' serve aberto.
      '.arx.compacto .arx-oculto{display:none}',
      '.arx.compacto .arx-lista{margin-top:6px}',
    ].join('');

    function aplicarModo() {
      if (!painel) return;
      painel.classList.toggle('compacto', cfg.compacto === true);
      const bt = painel.querySelector('.arx-min');
      if (!bt) return;
      bt.textContent = cfg.compacto ? '□' : '–';
      bt.title = cfg.compacto ? 'Mostrar tudo' : 'Minimizar';
    }

    let seletor = null;

    /** Repinta a lista de arrumações guardadas, mantendo a escolhida se ela ainda existe. */
    function pintarArranjos() {
      if (!seletor) return;
      const antes = seletor.value;
      seletor.textContent = '';
      const nomes = nomesDosArranjos();
      if (!nomes.length) {
        const o = document.createElement('option');
        o.value = '';
        o.textContent = '— nenhuma guardada —';
        seletor.appendChild(o);
        seletor.value = '';
        return;
      }
      for (const n of nomes) {
        const o = document.createElement('option');
        o.value = n;
        o.textContent = n;
        seletor.appendChild(o);
      }
      seletor.value = nomes.includes(antes) ? antes : nomes[0];
    }

    const botao = (rotulo, titulo, fn) => {
      const b = document.createElement('button');
      b.textContent = rotulo;
      if (titulo) b.title = titulo;
      b.addEventListener('click', fn);
      return b;
    };

    function montar() {
      if (painel) return painel;

      const estilo = document.createElement('style');
      estilo.textContent = CSS;
      (document.head || document.documentElement).appendChild(estilo);

      painel = document.createElement('div');
      painel.className = 'arx';

      const barra = document.createElement('div');
      barra.className = 'arx-barra';
      const titulo = document.createElement('h4');
      titulo.textContent = 'Arrumar os painéis';
      const minimizar = document.createElement('button');
      minimizar.className = 'arx-x arx-min';
      minimizar.textContent = '–';
      minimizar.addEventListener('click', () => {
        cfg.compacto = !cfg.compacto;
        gravar();
        aplicarModo();
      });
      const fechar = document.createElement('button');
      fechar.className = 'arx-x';
      fechar.textContent = '×';
      fechar.title = 'Esconder (Alt+J traz de volta)';
      fechar.addEventListener('click', () => mostrar(false));
      barra.append(titulo, minimizar, fechar);
      painel.appendChild(barra);

      const btCantos = botao(
        '⌗ Cada um no seu canto',
        'Longe do HUD, do chat e do painel de captura do jogo',
        () => diz(arrumar()),
      );
      btCantos.className = 'arx-oculto';
      painel.appendChild(btCantos);

      // --- as arrumações suas
      const sepMeu = document.createElement('div');
      sepMeu.className = 'arx-sep arx-oculto';
      sepMeu.textContent = 'Do seu jeito';
      painel.appendChild(sepMeu);

      const nome = document.createElement('input');
      nome.type = 'text';
      nome.className = 'arx-oculto';
      nome.placeholder = 'nome da arrumação';
      nome.maxLength = 40;
      painel.appendChild(nome);

      const btGuardar = botao('💾 Guardar onde estão', 'Arraste os painéis como quiser e guarde aqui', () => {
          const frase = guardarArranjo(nome.value);
          pintarArranjos();
          if (!/^Dê um nome|^Nenhum painel/.test(frase)) {
            seletor.value = String(nome.value || '').trim().slice(0, 40);
            nome.value = '';
          }
          diz(frase);
      });
      btGuardar.className = 'arx-oculto';
      painel.appendChild(btGuardar);

      seletor = document.createElement('select');
      seletor.className = 'arx-lista';
      painel.appendChild(seletor);
      pintarArranjos();

      const btAplicar = botao(
        '✓ Aplicar',
        'Põe os painéis onde esta arrumação diz (Alt+Shift+J)',
        () => diz(aplicarEscolhida()),
      );
      btAplicar.className = 'arx-aplicar';
      painel.appendChild(btAplicar);

      const btApagar = botao('Apagar', 'Tira esta arrumação da lista', () => {
        const frase = apagarArranjo(seletor.value);
        pintarArranjos();
        diz(frase);
      });
      btApagar.className = 'arx-oculto';
      painel.appendChild(btApagar);

      const caixa = document.createElement('label');
      caixa.className = 'arx-caixa arx-oculto';
      const marca = document.createElement('input');
      marca.type = 'checkbox';
      marca.className = 'arx-espalhar';
      marca.checked = cfg.espalhar !== false;
      marca.addEventListener('change', () => {
        cfg.espalhar = marca.checked;
        gravar();
      });
      const texto = document.createElement('span');
      texto.textContent = 'aplicar nas outras janelas abertas';
      caixa.append(marca, texto);
      caixa.title =
        'As outras janelas deste jogo recebem a arrumação na hora, sem F5. Vale para "Aplicar".';
      painel.appendChild(caixa);

      // --- levar para outro navegador
      const sepFora = document.createElement('div');
      sepFora.className = 'arx-sep arx-oculto';
      sepFora.textContent = 'Levar para outro navegador';
      painel.appendChild(sepFora);

      const codigo = document.createElement('textarea');
      codigo.className = 'arx-codigo arx-oculto';
      codigo.placeholder = 'cole aqui um código e clique em aplicar';
      painel.appendChild(codigo);

      const duplaFora = document.createElement('div');
      duplaFora.className = 'arx-dupla arx-oculto';
      duplaFora.append(
        botao('Gerar', 'Escreve o código aqui em cima; copie com Ctrl+C', () => {
          codigo.value = exportar();
          codigo.select?.();
          const quantas = nomesDosArranjos().length;
          diz(
            quantas
              ? `Código de ${quantas} ${quantas === 1 ? 'arrumação' : 'arrumações'} — copie com Ctrl+C.`
              : 'Não há arrumação guardada para exportar.',
          );
        }),
        botao('Aplicar código', 'Lê o código colado e junta as arrumações dele às suas', () => {
          const frase = importar(codigo.value);
          pintarArranjos();
          diz(frase);
        }),
      );
      painel.appendChild(duplaFora);

      // Esconder e trazer de volta ja' e' do nucleo, em Alt+Z e Alt+X. Repetir aqui seria dois
      // donos para a mesma coisa — e o segundo sempre discorda do primeiro mais cedo ou mais
      // tarde. Aqui so' se diz onde isso mora.
      const dica = document.createElement('div');
      dica.className = 'arx-dica arx-oculto';
      dica.textContent =
        'Alt+Shift+J aplica a arrumação escolhida · sumir com todos: Alt+Z · trazer: Alt+X';
      painel.appendChild(dica);

      const status = document.createElement('div');
      status.className = 'arx-status';
      painel.appendChild(status);

      // Em cima das outras ao ser tocado, e nunca pendurado para fora quando a janela encolhe.
      // Quem faz as duas coisas e' o nucleo: eram cinco copias, e o recorte do `resize` nao
      // existia em nenhuma delas.
      document.body.appendChild(painel);

      // Arrastar, lembrar o lugar, vir para a frente ao ser tocado e nao ficar pendurado para
      // fora quando a janela encolhe: tudo isto e' do nucleo. Eram cinco copias, cada uma com
      // `mousedown` na janela (que perde o arrasto se o ponteiro sair) e pixels do canto de cima
      // a' esquerda (que nao sobrevivem a encolher a janela). O `recolocar` serve para quando o
      // painel volta a' vista: escondido ele nao tem caixa para medir.
      recolocar =
        globalThis.PPX?.painel?.(painel, {
          alca: barra,
          pos: cfg.pos,
          guardar: (p) => {
            cfg.pos = p;
            gravar();
          },
        }) || (() => false);
      aplicarModo();
      return painel;
    }

    function mostrar(sim) {
      visivel = sim === true;
      if (cfg.visivel !== visivel) {
        cfg.visivel = visivel;
        gravar();
      }
      if (visivel) {
        montar().style.display = 'block';
        // Aparecer e' aparecer na frente: abrir pelo atalho com outro painel por cima nao seria
        // abrir nada.
        globalThis.PPX?.frente?.(painel);
        // Escondido nao tem caixa para medir: se a janela mudou de tamanho enquanto ele estava
        // fora, e' agora que o canto guardado volta a valer.
        recolocar();
      } else if (painel) painel.style.display = 'none';
      globalThis.PPX?.anotar?.('arrumar', visivel);
    }

    // Alt+U esconde, Alt+J mostra; Alt+Shift+J aplica a arrumação escolhida sem abrir nada.
    //
    // O par é de propósito: a arrumação é a ação que se repete (outra janela, outro monitor, um
    // painel arrastado por engano), e abrir o painel para clicar num botão é o que se quer
    // evitar. `Shift` está livre em todo o pacote e em toda a loja — a única extensão de
    // "qualquer site", o caderno de anotações, só reage a Alt+O e Alt+P, e nem olha o Shift.
    //
    // Resposta do Alt+Shift+J com o painel fechado são os painéis a mexerem-se; a frase fica no
    // status para quando ele abrir. Inventar um aviso flutuante só para isto seria um segundo
    // jeito de o pacote falar.
    addEventListener(
      'keydown',
      (e) => {
        if (!e.altKey || e.ctrlKey) return;
        // `code` e nao `key`: com Alt+Shift o teclado pode devolver outra coisa em `key`.
        const j = e.code === 'KeyJ' || e.key?.toLowerCase?.() === 'j';
        const u = e.code === 'KeyU' || e.key?.toLowerCase?.() === 'u';
        if (!j && !u) return;
        // O Shift so' tem sentido com o J: Alt+Shift+H nao e' atalho nenhum, e engoli-lo aqui
        // roubaria a tecla ao jogo.
        if (e.shiftKey && !j) return;
        const t = e.target;
        if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) diz(aplicarEscolhida());
        // Duas teclas, e nao uma que alterna: Alt+U esconde, Alt+J mostra. Nao e' o Alt+H
        // porque essa tecla e' da extensao `sem-grafico`, que tambem corre neste site.
        else mostrar(j);
      },
      true,
    );

    mostrar(cfg.visivel !== false);
    globalThis.PPX?.controlar?.('arrumar', (sim) => mostrar(sim));

    globalThis.PPX = globalThis.PPX || {};
    globalThis.PPX.arrumar = { arrumar, usarArranjo, aplicarEscolhida, guardarArranjo, PAINEIS, cfg };

    if (typeof module !== 'undefined' && module.exports)
      module.exports = {
        arrumar,
        guardarPos,
        lerArranjo,
        guardarArranjo,
        usarArranjo,
        aplicarEscolhida,
        escolhida,
        apagarArranjo,
        nomesDosArranjos,
        exportar,
        importar,
        limparArranjo,
        PAINEIS,
        cfg,
      };
  },
);
