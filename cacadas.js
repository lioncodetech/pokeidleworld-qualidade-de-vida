// Atalhos para caçadas: guarda as que voce usa e volta a qualquer uma num clique.
//
// POR QUE O NOME DO LUGAR, E NAO O BOTAO. O marcador do mapa e' refeito pelo React a cada
// abertura, entao uma referencia guardada de antes nao clica em nada. O que sobrevive e' o texto
// do titulo ("Viajar para Route 7"), e e' por ele que se procura.
//
// O CAMINHO ATE' A CACADA ja' estava medido no ciclo da loja (`voltarPara`), e e' repetido aqui
// de proposito: cada ferramenta deste pacote pode estar desligada sozinha, e uma depender da
// outra para uma coisa tao basica seria trocar quinze linhas repetidas por uma falha calada. O
// que se partilha entre elas sao decisoes, nao utilitarios.
//
PPX.modulo(
  {
    id: 'cacadas',
    nome: 'Caçadas',
    atalhos: 'Alt+W abre o painel',
    proprio: true,
  },
  () => {
    'use strict';

    const MINHA_VEZ = 'cacadas';
    const CHAVE = 'lioncode:pokeidleworld:cacadas';

    // O compasso vem do `pausa.js`, que tem um dono so': a pausa pedida e' o chao, e por cima
    // dela vai um sorteio. Sem o modulo (num teste, por exemplo) espera-se o pedido, e pronto.
    const esperar = (ms) =>
      globalThis.PPX?.pausa ? globalThis.PPX.pausa(ms) : new Promise((r) => setTimeout(r, ms));
    const botoes = () => [...document.querySelectorAll('button')];

    /** "Nível 267 · Shopping" -> "Shopping". E' assim que se sabe onde o jogador esta'. */
    const local = () => {
      const t = document.querySelector('.phud-tloc')?.textContent || '';
      const p = t.split('·');
      return p.length > 1 ? p[p.length - 1].trim() : '';
    };

    const fecharJanela = async () => {
      const x =
        document.querySelector('.win-overlay .nsh-x') ||
        botoes().find((b) => b.textContent.trim() === '×');
      if (x) {
        x.click();
        await esperar(600);
      }
    };

    /**
     * Espera uma condicao virar verdadeira, em vez de esperar um tanto fixo.
     *
     * O mapa e' uma lista grande e demora a montar; nuns dias mais do que noutros. Um relogio
     * fixo transforma "demorou" em "nao achei", e foi exatamente esse o erro que apareceu no
     * Depósito.
     */
    async function ateQue(cond, limite = 12000) {
      // Conta tentativas em vez de olhar o relogio, como o modulo dos Times: na pratica da' o
      // mesmo tempo (cada espera e' de ~450 ms mais o sorteio), e deixa o teste da viagem que
      // NAO acontece rodar num piscar em vez de esperar os vinte segundos do limite.
      const voltas = Math.max(1, Math.round(limite / 450));
      for (let i = 0; i < voltas; i += 1) {
        if (cond()) return true;
        await esperar(450);
      }
      return cond();
    }

    /** Abre o mapa e clica no marcador da caçada. */
    async function viajar(hunt) {
      if (!hunt) return false;
      await fecharJanela();
      const mapa = botoes().find((b) => (b.title || '').trim() === 'Mapa');
      if (!mapa) return false;
      mapa.click();
      const marcador = () =>
        [...document.querySelectorAll('.hunt-marker')].find(
          (m) => (m.title || '') === `Viajar para ${hunt}` || m.textContent.trim() === hunt,
        );
      if (!(await ateQue(() => !!marcador(), 12000))) return false;
      // Um instante antes de clicar, como quem olha o mapa e so' depois escolhe.
      await esperar(800);
      marcador().click();
      await ateQue(() => local() === hunt, 20000);
      return true;
    }

    // --- o que se guarda ----------------------------------------------------------------------

    const PADRAO = { lista: [], pos: null, compacto: false };
    let cfg = { ...PADRAO };
    try {
      const cru = localStorage.getItem(CHAVE);
      if (cru) cfg = { ...cfg, ...JSON.parse(cru) };
    } catch (e) {
      /* fica o padrao: nenhuma caçada guardada */
    }
    /**
     * Cada caçada guardada e' `{ nome, time }` — o time e' **opcional**, e a maior parte das
     * caçadas se faz com a equipe que ja' esta' posta. Antes a lista era so' de nomes; aqui ela
     * e' trazida ao formato novo, uma vez, ao carregar.
     */
    cfg.lista = (cfg.lista || []).map((c) =>
      typeof c === 'string' ? { nome: c, time: '' } : { nome: c.nome, time: c.time || '' },
    );

    const gravar = () => {
      try {
        localStorage.setItem(CHAVE, JSON.stringify(cfg));
      } catch (e) {
        /* janela sem armazenamento: vale so' para esta sessao */
      }
    };

    /**
     * Guarda a caçada atual.
     *
     * Nao se guarda cidade: clicar em "guardar" parado no Shopping encheria a lista de atalhos
     * para ir fazer compras, e isso so' se descobriria depois de uma madrugada sem cacar.
     */
    const NAO_SAO_CACADA = ['Shopping', 'Cerulean', 'Mercado'];

    function salvar() {
      const aqui = local();
      if (!aqui) return 'Nao consegui ler onde voce esta.';
      if (NAO_SAO_CACADA.some((n) => aqui.toLowerCase() === n.toLowerCase()))
        return `"${aqui}" e' cidade, nao caçada. Nao guardei.`;
      if (cfg.lista.some((c) => c.nome === aqui)) return `"${aqui}" ja esta na lista.`;
      cfg.lista.push({ nome: aqui, time: '' });
      gravar();
      return `Guardada: "${aqui}".`;
    }

    function apagar(nome) {
      const i = cfg.lista.findIndex((c) => c.nome === nome);
      if (i < 0) return 'Essa caçada nao esta na lista.';
      cfg.lista.splice(i, 1);
      gravar();
      return `"${nome}" tirada da lista.`;
    }

    const esperarAVez = async () => {
      const vez = globalThis.PPX?.vez;
      if (!vez?.pedir) return () => {};
      return vez.pedir(MINHA_VEZ);
    };

    /**
     * Monta o time que a caçada pede, se ela pedir algum.
     *
     * Quem monta e' a ferramenta Times — e' dela essa decisao, e repetir aqui a dança do
     * Depósito seria ter duas versoes da mesma coisa a apodrecer em separado. O que se repete
     * entre ferramentas deste pacote sao caminhos basicos (abrir o mapa), nao rotinas inteiras.
     *
     * `voltar: false` porque logo a seguir se viaja para a caçada: voltar a' caçada velha no
     * meio seria uma viagem a' toa.
     */
    async function montarTime(nome, aviso) {
      if (!nome) return { ok: true };
      const times = globalThis.PPX?.times;
      if (!times?.usar)
        return { ok: false, erro: 'a ferramenta Times nao esta ligada — ligue-a no menu (Alt+Q)' };
      aviso(`Montando o time "${nome}"…`);
      return times.usar(nome, { aviso, voltar: false });
    }

    /**
     * Leva a' caçada, montando antes o time que ela pedir.
     *
     * Ja' estando la', ainda ha' o que fazer se houver time: montar. Por isso o "voce ja esta
     * em" so' vale para caçada sem time.
     */
    /**
     * Escuta o que o jogo responde enquanto se tenta viajar.
     *
     * O jogo nao recusa a viagem com um erro: ele mostra um aviso e simplesmente nao sai do
     * lugar. Sem isto a ferramenta so' sabia dizer *"cliquei e o jogo continua em Cerulean"*,
     * que nao ajuda ninguem — foi exatamente o que apareceu na conta real em 10/10/2026, com o
     * lider desmaiado, e levou minutos a entender.
     *
     * Le-se o que **aparece** depois do clique, e nunca o que esta' dentro do chat: ali qualquer
     * jogador escreve qualquer coisa, e um "desmaiada" no chat mundial nao e' uma resposta do
     * jogo. Sem MutationObserver (num teste, por exemplo) devolve vazio e tudo segue igual.
     */
    function escutarOJogo() {
      let visto = '';
      if (typeof MutationObserver === 'undefined' || !document.body) return () => '';
      const olho = new MutationObserver((lotes) => {
        if (visto) return;
        for (const lote of lotes)
          for (const no of lote.addedNodes) {
            const el = no.nodeType === 1 ? no : no.parentElement;
            if (!el || el.closest?.('.chat-box')) continue;
            const txt = (el.textContent || '').trim();
            if (txt && txt.length < 300 && /desmaiad/i.test(txt)) {
              visto = txt;
              return;
            }
          }
      });
      olho.observe(document.body, { childList: true, subtree: true });
      return () => {
        olho.disconnect();
        return visto;
      };
    }

    async function ir(hunt, aviso = () => {}, { time } = {}) {
      if (!hunt) return 'Nenhuma caçada escolhida.';
      const alvo = cfg.lista.find((c) => c.nome === hunt) || { nome: hunt, time: '' };
      // Quem chama pode mandar outro time, e entao e' o dele que vale: a Escada escolhe o time
      // no proprio degrau, porque a mesma caçada serve a niveis diferentes com equipes
      // diferentes. Nao mandar nada (`undefined`) continua a usar o time da caçada; mandar `''`
      // e' dizer "nao troque o time", e e' diferente de nao mandar nada.
      const escolhido = time === undefined ? alvo.time : time;
      const jaAqui = local() === hunt;
      if (jaAqui && !escolhido) return `Voce ja esta em "${hunt}".`;

      // A vez e' pedida **depois** do time, e nao antes: a ferramenta Times pede a vez dela, e
      // a fila so' e' reentrante para o mesmo dono. Segurando a vez aqui, a montagem ficaria a'
      // espera de quem esta' a' espera dela — parada ate' o prazo acabar.
      const posto = await montarTime(escolhido, aviso);
      if (!posto.ok) return `Parei: nao montei o time "${escolhido}" — ${posto.erro}`;
      if (jaAqui) return `Time "${escolhido}" montado. Voce ja estava em "${hunt}".`;

      const soltar = await esperarAVez();
      if (!soltar) return 'Outra ferramenta esta agindo. Tente de novo.';
      try {
        const parar = escutarOJogo();
        const ok = await viajar(hunt);
        if (!ok) {
          parar();
          return `Nao achei "${hunt}" no mapa. Voce ficou onde estava.`;
        }
        await esperar(800);
        // Confere a chegada em vez de a assumir: o clique no marcador pode nao ter pegado, e
        // dizer "cheguei" sem ter chegado custa uma noite parado no mapa.
        const agora = local();
        if (agora === hunt) {
          parar();
          return `Em "${hunt}".`;
        }
        if (/desmaiad/i.test(parar()))
          return (
            'Parei: sua equipe esta desmaiada, e o jogo nao deixa sair assim. Cure com a Nurse ' +
            'Joy (o "Conversar" dela, em Cerulean) e tente de novo.'
          );
        return `Cliquei para viajar, mas o jogo diz "${agora || 'nada'}". Confira.`;
      } finally {
        soltar();
      }
    }

    // --- o painel -----------------------------------------------------------------------------
    //
    // O desenho e' o mesmo do painel da loja, de proposito: duas janelas do mesmo pacote com dois
    // visuais seria ruido. As classes sao `cjx` para nao disputar com as `ljx`.

    let painel = null;
    let visivel = false;

    const diz = (txt) => {
      const alvo = painel?.querySelector('.cjx-status');
      if (alvo) alvo.textContent = txt;
    };

    const CSS = [
      // Cada painel nasce num canto proprio: de baixo a' direita e' o painel de captura do
      // jogo, e empilhar os quatro no mesmo lugar escondia um atras do outro. Quem arrasta
      // manda — `cfg.pos` passa por cima disto.
      '.cjx{position:fixed;right:18px;top:96px;z-index:2147483646;width:248px;max-height:70vh;',
      'overflow:auto;background:#11151df2;color:#e6e9ef;font:13px system-ui,sans-serif;',
      'border:1px solid #3a4152;border-radius:10px;padding:12px 13px;box-shadow:0 8px 26px #0009}',
      '.cjx-barra{display:flex;align-items:center;justify-content:space-between;cursor:move;',
      'user-select:none;margin:-4px -4px 6px}',
      '.cjx h4{margin:0;font-size:13px;letter-spacing:.3px}',
      '.cjx-x{width:auto!important;margin:0!important;padding:1px 7px!important;line-height:1;',
      'font-size:15px!important;background:transparent!important;border:none!important;',
      'opacity:.6;cursor:pointer}',
      '.cjx-x:hover{opacity:1;background:#273145!important}',
      '.cjx-l{display:flex;align-items:center;gap:6px;margin:4px 0}',
      '.cjx-l b{flex:1;font-size:12.5px;color:#9fd0ff;font-weight:600;overflow:hidden;',
      'text-overflow:ellipsis;white-space:nowrap}',
      '.cjx-l button{width:auto!important;margin:0!important;padding:3px 8px!important;',
      'font-size:12px!important}',
      '.cjx-vazio{font-size:11.5px;opacity:.65;line-height:1.35}',
      '.cjx-time{width:100%;margin:0 0 6px;background:#0b0e14;color:#e6e9ef;',
      'border:1px solid #3a4152;border-radius:5px;padding:3px 5px;',
      'font:11.5px system-ui,sans-serif}',
      // Sem time escolhido o seletor e' so' ruido: fica apagado ate' valer alguma coisa.
      '.cjx-time.sem{color:#8b97a8}',
      '.cjx button{width:100%;margin-top:8px;background:#1d2534;color:#e6e9ef;',
      'border:1px solid #3a4152;border-radius:6px;padding:7px;font:13px system-ui,sans-serif;',
      'cursor:pointer}',
      '.cjx button:hover{background:#273145}',
      '.cjx-status{margin-top:9px;font-size:11.5px;opacity:.8;min-height:15px;line-height:1.35}',
      // Modo compacto: fica o nome da caçada e o Ir, que e' o uso de todo dia. Guardar e apagar
      // sao de arrumar a lista, e arrumar a lista nao se faz todo dia.
      '.cjx.compacto{width:176px}',
      '.cjx.compacto .cjx-guardar,.cjx.compacto .cjx-status,.cjx.compacto .cjx-time,',
      '.cjx.compacto .cjx-l .cjx-fora{display:none}',
      '.cjx.compacto .cjx-l{margin:2px 0}',
    ].join('');

    /** Arrastar pela barra, e o lugar sobrevive ao F5. */
    function arrastarPor(alca) {
      alca.addEventListener('mousedown', (ev) => {
        if (ev.button !== 0) return;
        ev.preventDefault();
        const r = painel.getBoundingClientRect();
        const dx = ev.clientX - r.left;
        const dy = ev.clientY - r.top;
        const mover = (e) => {
          const x = Math.min(Math.max(0, e.clientX - dx), innerWidth - 60);
          const y = Math.min(Math.max(0, e.clientY - dy), innerHeight - 40);
          painel.style.left = `${x}px`;
          painel.style.top = `${y}px`;
          painel.style.right = 'auto';
          painel.style.bottom = 'auto';
        };
        const solto = () => {
          removeEventListener('mousemove', mover);
          removeEventListener('mouseup', solto);
          cfg.pos = { x: parseInt(painel.style.left, 10), y: parseInt(painel.style.top, 10) };
          gravar();
        };
        addEventListener('mousemove', mover);
        addEventListener('mouseup', solto);
      });
    }

    /** Devolve o painel para onde foi largado, se aquele lugar ainda existe nesta tela. */
    function aplicarPosicao() {
      const p = cfg.pos;
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
      if (p.x > innerWidth - 60 || p.y > innerHeight - 40) return;
      painel.style.left = `${p.x}px`;
      painel.style.top = `${p.y}px`;
      painel.style.right = 'auto';
      painel.style.bottom = 'auto';
    }

    /** O modo guardado, porque quem prefere um modo prefere sempre. */
    function aplicarModo() {
      if (!painel) return;
      painel.classList.toggle('compacto', cfg.compacto === true);
      const bt = painel.querySelector('.cjx-barra button');
      if (!bt) return;
      bt.textContent = cfg.compacto ? '□' : '–';
      bt.title = cfg.compacto ? 'Mostrar tudo' : 'Minimizar';
    }

    /**
     * O seletor de time de uma caçada.
     *
     * O time e' opcional — a maior parte das caçadas se faz com a equipe que ja' esta' posta —,
     * e um time guardado que deixou de existir **nao desaparece em silencio**: fica na lista,
     * marcado, para voce ver que ele sumiu em vez de descobrir no meio de uma troca.
     */
    function seletorDeTime(alvo) {
      const nomes = globalThis.PPX?.times?.nomes?.() || [];
      const sel = document.createElement('select');
      sel.className = 'cjx-time';

      const nenhum = document.createElement('option');
      nenhum.value = '';
      nenhum.textContent = nomes.length ? '— sem trocar o time —' : '— Times desligado —';
      sel.append(nenhum);

      for (const nome of nomes) {
        const o = document.createElement('option');
        o.value = nome;
        o.textContent = `com o time "${nome}"`;
        sel.append(o);
      }
      if (alvo.time && !nomes.includes(alvo.time)) {
        const perdido = document.createElement('option');
        perdido.value = alvo.time;
        perdido.textContent = `"${alvo.time}" (não existe mais)`;
        sel.append(perdido);
      }

      sel.value = alvo.time || '';
      sel.classList.toggle('sem', !sel.value);
      sel.addEventListener('change', () => {
        alvo.time = sel.value;
        gravar();
        sel.classList.toggle('sem', !sel.value);
        diz(
          sel.value
            ? `"${alvo.nome}" passa a montar o time "${sel.value}".`
            : `"${alvo.nome}" deixa de trocar o time.`,
        );
      });
      return sel;
    }

    function pintarLista() {
      const lista = painel?.querySelector('.cjx-lista');
      if (!lista) return;
      lista.textContent = '';
      if (!cfg.lista.length) {
        const vazio = document.createElement('div');
        vazio.className = 'cjx-vazio';
        vazio.textContent = 'Nenhuma caçada guardada ainda.';
        lista.appendChild(vazio);
        return;
      }
      for (const alvo of cfg.lista) {
        const l = document.createElement('div');
        l.className = 'cjx-l';
        const b = document.createElement('b');
        b.textContent = alvo.nome;
        const usar = document.createElement('button');
        usar.textContent = '▶ Ir';
        usar.addEventListener('click', async () => {
          diz(`Indo para "${alvo.nome}"…`);
          diz(await ir(alvo.nome, diz));
        });
        const fora = document.createElement('button');
        fora.className = 'cjx-fora';
        fora.textContent = '×';
        fora.title = 'Tirar da lista';
        fora.addEventListener('click', () => {
          diz(apagar(alvo.nome));
          pintarLista();
        });
        l.append(b, usar, fora);
        lista.appendChild(l);
        lista.appendChild(seletorDeTime(alvo));
      }
    }

    function montar() {
      if (painel) return painel;

      const estilo = document.createElement('style');
      estilo.textContent = CSS;
      (document.head || document.documentElement).appendChild(estilo);

      painel = document.createElement('div');
      painel.className = 'cjx';

      const barra = document.createElement('div');
      barra.className = 'cjx-barra';
      const titulo = document.createElement('h4');
      titulo.textContent = 'Caçadas';
      // Dois botoes, e eles nao sao a mesma coisa: o `–` encolhe a janela para o uso de todo dia
      // e ela continua a' vista; o `×` esconde. Quem minimiza quer continuar a ver a lista.
      const encolher = document.createElement('button');
      encolher.className = 'cjx-x';
      encolher.addEventListener('click', () => {
        cfg.compacto = !cfg.compacto;
        gravar();
        aplicarModo();
      });

      const fechar = document.createElement('button');
      fechar.className = 'cjx-x';
      fechar.textContent = '×';
      fechar.title = 'Esconder (Alt+W traz de volta)';
      fechar.addEventListener('click', () => mostrar(false));

      const cantos = document.createElement('div');
      cantos.append(encolher, fechar);
      barra.append(titulo, cantos);
      painel.appendChild(barra);
      arrastarPor(barra);

      const lista = document.createElement('div');
      lista.className = 'cjx-lista';
      painel.appendChild(lista);

      const btSalvar = document.createElement('button');
      btSalvar.className = 'cjx-guardar';
      btSalvar.textContent = '📌 Guardar onde estou';
      btSalvar.addEventListener('click', () => {
        diz(salvar());
        pintarLista();
      });
      painel.appendChild(btSalvar);

      const status = document.createElement('div');
      status.className = 'cjx-status';
      painel.appendChild(status);

      document.body.appendChild(painel);
      aplicarPosicao();
      aplicarModo();
      pintarLista();
      return painel;
    }

    /**
     * Mostra ou esconde o painel — e guarda a escolha.
     *
     * Guardar e' o ponto: sem isto, cada F5 devolvia o painel para o escuro e nao havia como
     * "deixar a ferramenta aparecendo". A escolha mora na chave da propria ferramenta porque,
     * para um modulo `proprio`, e' ele o dono do estado: o nucleo so' pergunta (`PPX.visivel`)
     * e manda aplicar (`PPX.controlar`).
     */
    function mostrar(sim) {
      visivel = sim === true;
      if (cfg.visivel !== visivel) {
        cfg.visivel = visivel;
        gravar();
      }
      if (visivel) {
        montar().style.display = 'block';
        pintarLista();
      } else if (painel) painel.style.display = 'none';
      globalThis.PPX?.anotar?.('cacadas', visivel);
    }

    addEventListener(
      'keydown',
      (e) => {
        if (!e.altKey || e.ctrlKey || e.shiftKey) return;
        if (e.key.toLowerCase() !== 'w') return;
        // Campo de texto nao dispara atalho: o jogo tem chat, e um "w" ali nao e' um comando.
        const t = e.target;
        if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;
        e.preventDefault();
        e.stopPropagation();
        mostrar(!visivel);
      },
      true,
    );

    // Volta ao que estava antes do F5. Por omissao aparece: uma ferramenta que ninguem ve' e'
    // uma ferramenta que ninguem usa, e fecha-se no × ou no menu (Alt+Q) quem nao a quiser.
    mostrar(cfg.visivel !== false);
    globalThis.PPX?.controlar?.('cacadas', (sim) => mostrar(sim));

    globalThis.PPX = globalThis.PPX || {};
    globalThis.PPX.cacadas = { salvar, apagar, ir, local, cfg };

    if (typeof module !== 'undefined' && module.exports)
      module.exports = { salvar, apagar, ir, local, viajar, cfg };
  },
);
