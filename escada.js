// Escada de caçadas: troca de caçada sozinha quando o líder sobe de nível.
//
// DOIS NIVEIS, E ELES NAO SAO A MESMA COISA. Medido em 10/10/2026:
//
//  - `.phud-tloc` da' o nivel do **treinador** ("Nível 270 · Persian"). E' ele que destranca as
//    caçadas: o `onClick` do marcador do mapa compara o nivel do jogador com o `level` da caçada
//    e recusa com um aviso se for menor.
//  - `.phud-mon .phud-lv` da' o nivel de **cada pokemon** da equipe ("Lv.263"). Nao destranca
//    nada; e' o que se esta' a subir.
//
// Esta ferramenta olha o **primeiro da equipe** — o lider, o do ⚔. Foi a escolha do dono da
// conta, e ela casa com a caixa "manter a ordem" dos Times: quem escolhe a ordem escolhe o
// lider, e o lider passa a ser o medidor.
//
// O GATILHO E' UM OBSERVADOR, NAO UM RELOGIO. Com a aba em segundo plano o `setInterval` cai
// para uma volta por minuto — e o motor do jogo para de rodar de qualquer forma. O HUD, que e'
// DOM, avisa quando muda; e' assim que a captura automatica tambem funciona.
//
// E ELA NAO PEDE A VEZ. Quem viaja e' `PPX.cacadas.ir`, que pede a vez dele — e a fila so' e'
// reentrante para o mesmo dono. Segurar a vez aqui deixaria a viagem a' espera de quem esta' a'
// espera dela, parada ate' o prazo acabar. A mesma armadilha ja' custou uma tarde nos Times.
//
PPX.modulo(
  {
    id: 'escada',
    nome: 'Escada de caçadas',
    atalhos: 'Alt+P abre o painel',
    proprio: true,
  },
  () => {
    'use strict';

    const CHAVE = 'lioncode:pokeidleworld:escada';

    /** Quanto se espera antes de tentar de novo, depois de uma viagem que nao deu certo. */
    const CASTIGO = 120000;

    // --------------------------------------------------------------- o que se guarda

    const PADRAO = {
      // `[{ nivel, cacada }]`, sempre ordenados por nivel.
      degraus: [],
      ligada: false,
      // O nivel do degrau que ja' foi aplicado. Sem isto, cada batida do HUD mandaria viajar
      // para o mesmo lugar outra vez.
      aplicado: null,
      pos: null,
      compacto: false,
    };
    let cfg = { ...PADRAO };
    try {
      const cru = localStorage.getItem(CHAVE);
      if (cru) cfg = { ...cfg, ...JSON.parse(cru) };
    } catch {
      /* fica o padrao: escada vazia e desligada */
    }
    if (!Array.isArray(cfg.degraus)) cfg.degraus = [];
    const gravar = () => {
      try {
        localStorage.setItem(CHAVE, JSON.stringify(cfg));
      } catch {
        /* janela sem armazenamento: vale so' para esta sessao */
      }
    };

    const ordenar = () => cfg.degraus.sort((a, b) => a.nivel - b.nivel);

    // --------------------------------------------------------------- ler o jogo

    /**
     * O nivel do primeiro da equipe, ou null se o HUD ainda nao esta' na tela.
     *
     * `null` e' diferente de zero e tem de continuar a ser: um HUD que ainda nao carregou nao e'
     * um lider de nivel 1, e tratar os dois como a mesma coisa faria a escada disparar o degrau
     * mais baixo a cada recarga da pagina.
     */
    const nivelLider = () => {
      const bruto = document.querySelector('.phud-mon .phud-lv')?.textContent || '';
      const n = bruto.match(/(\d+)/);
      return n ? Number(n[1]) : null;
    };

    /** O nome do primeiro da equipe, para as mensagens dizerem de quem se fala. */
    const nomeLider = () =>
      (document.querySelector('.phud-mon .phud-name')?.textContent || '').trim();

    /** "Nível 270 · Persian" -> "Persian". */
    const local = () => {
      const t = document.querySelector('.phud-tloc')?.textContent || '';
      const p = t.split('·');
      return p.length > 1 ? p[p.length - 1].trim() : '';
    };

    /**
     * O degrau em que um lider de nivel `n` deveria estar: o mais alto que ele ja' alcancou.
     *
     * Nao e' "o degrau que acabou de passar" — e' o estado certo para aquele nivel. A diferenca
     * aparece ao ligar a escada com o lider ja' no Lv 80: o certo e' ir para o degrau de 80, e
     * nao ficar a' espera de passar pelo de 20.
     */
    const degrauPara = (n) => {
      if (n === null) return null;
      let achado = null;
      for (const d of cfg.degraus) if (d.nivel <= n && (!achado || d.nivel > achado.nivel)) achado = d;
      return achado;
    };

    /**
     * Em que nivel nasce o proximo degrau que se acrescentar.
     *
     * O primeiro nasce no **Lv 1**, e nao num numero redondo: uma escada cujo degrau mais baixo
     * esta' acima do lider nao faz nada, e foi assim que ela passou a primeira noite parada. Os
     * seguintes sobem de dez em dez, que e' so' um palpite para encurtar cliques.
     */
    const nivelDoProximo = () =>
      cfg.degraus.length ? cfg.degraus.reduce((m, d) => Math.max(m, d.nivel), 0) + 10 : 1;

    /** O degrau mais baixo da escada, que e' o unico que o jogador talvez ainda nao tenha. */
    const primeiroDegrau = () =>
      cfg.degraus.reduce((m, d) => (!m || d.nivel < m.nivel ? d : m), null);

    /**
     * Uma frase que explica a decisao de agora — mesmo quando a decisao e' nao fazer nada.
     *
     * Isto nasceu de a escada ficar parada sem dizer porque: o lider estava no Lv 1 e o degrau
     * mais baixo era o Lv 5, entao nao havia degrau nenhum para aplicar. A regra estava certa e
     * o silencio estava errado — uma automacao que nao age tem de dizer **o que** esta' a
     * esperar, senao e' indistinguivel de uma que quebrou.
     */
    function diagnostico() {
      if (!cfg.ligada) return 'Desligada. Não troco de caçada sozinha.';
      if (!cfg.degraus.length) return 'Sem degraus. Um degrau é "a partir do nível N, caçar aqui".';

      const n = nivelLider();
      if (n === null) return 'Ainda não li o nível do líder.';
      const quem = nomeLider() || 'o líder';

      const degrau = degrauPara(n);
      if (!degrau) {
        const base = primeiroDegrau();
        return (
          `${quem} está no Lv ${n}, abaixo do primeiro degrau (Lv ${base.nivel}). ` +
          'Ponha um degrau em Lv 1 para começar já.'
        );
      }
      if (!degrau.cacada) return `Lv ${n}: o degrau de Lv ${degrau.nivel} não tem caçada escolhida.`;
      if (local() === degrau.cacada) return `${quem} Lv ${n}: em "${degrau.cacada}", como manda o degrau de Lv ${degrau.nivel}.`;
      if (degrau.nivel === cfg.aplicado)
        return `${quem} Lv ${n}: degrau de Lv ${degrau.nivel} já cumprido. Você saiu de "${degrau.cacada}" — fique à vontade.`;
      return `${quem} Lv ${n}: falta ir para "${degrau.cacada}".`;
    }

    // --------------------------------------------------------------- o motor

    let correndo = false;
    let esperaAte = 0;
    /** O ultimo nivel lido. So' se faz contas quando ele muda: o HUD bate a cada ponto de vida. */
    let visto = null;

    /**
     * Confere se o lider mudou de degrau e, se mudou, viaja.
     *
     * Quem viaja e' as Caçadas: ela leva o time guardado daquela caçada, passa na Nurse Joy se
     * for preciso e confere a chegada. Esta ferramenta so' decide **quando**.
     */
    async function conferir(aviso = diz) {
      if (!cfg.ligada || correndo) return '';
      // Aba oculta: o motor do jogo para, as placas dos NPC somem e a cura fica fora de alcance.
      // O nivel tambem nao sobe, entao nao ha' o que perder em esperar a aba voltar.
      if (document.visibilityState !== 'visible') return '';

      const n = nivelLider();
      if (n === null) return '';

      const degrau = degrauPara(n);
      // Nao agir e' uma decisao como outra qualquer, e tem de ser dita. Ficar parada em silencio
      // e' indistinguivel de estar quebrada — foi o que aconteceu com o lider no Lv 1 e o
      // primeiro degrau no Lv 5.
      if (!degrau || !degrau.cacada || degrau.nivel === cfg.aplicado) {
        aviso(diagnostico());
        return 'nada a fazer';
      }

      // Ja' estar la' conta como feito: e' o caso de quem liga a escada ja' na caçada certa.
      if (local() === degrau.cacada) {
        cfg.aplicado = degrau.nivel;
        gravar();
        aviso(diagnostico());
        return 'ja la';
      }

      const cacadas = globalThis.PPX?.cacadas;
      if (!cacadas?.ir) {
        aviso('A ferramenta Caçadas nao esta ligada — ligue-a no menu (Alt+Q).');
        return 'sem cacadas';
      }
      if (Date.now() < esperaAte) return '';

      correndo = true;
      try {
        aviso(`Lv ${n}: indo para "${degrau.cacada}".`);
        // `cfg.time` ausente devolve `undefined`, que e' exatamente "use o time da caçada".
        // Os tres estados cabem num campo so': ausente, '' (nao trocar) e um nome.
        const msg = await cacadas.ir(degrau.cacada, aviso, { time: cfg.time });
        if (local() === degrau.cacada) {
          cfg.aplicado = degrau.nivel;
          gravar();
          aviso(`Degrau ${degrau.nivel}: em "${degrau.cacada}".`);
          return 'ok';
        }
        // Nao marcar o degrau como feito e' de proposito: a tentativa volta a valer. O castigo
        // existe para isso nao virar um martelo — uma equipe desmaiada nao se cura sozinha, e
        // tentar de dois em dois segundos nao ajudaria ninguem.
        esperaAte = Date.now() + CASTIGO;
        aviso(`Degrau ${degrau.nivel} nao deu: ${msg}`);
        return 'falhou';
      } finally {
        correndo = false;
      }
    }

    /**
     * Fica de olho no HUD.
     *
     * O HUD muda a cada ponto de vida, varias vezes por segundo numa caçada. Por isso a peneira
     * e' o proprio nivel: le-se o numero (uma leitura de DOM, barata) e so' se faz contas quando
     * ele mudou de facto.
     */
    function vigiar() {
      if (typeof MutationObserver === 'undefined' || !document.body) return null;
      const olho = new MutationObserver(() => {
        const n = nivelLider();
        if (n === visto) return;
        visto = n;
        conferir();
      });
      olho.observe(document.body, { childList: true, subtree: true, characterData: true });
      return olho;
    }

    // --------------------------------------------------------------- o painel
    //
    // O desenho e' o mesmo das Caçadas e da Loja, de proposito. As classes sao `esx`.

    let painel = null;
    let visivel = false;

    const diz = (txt) => {
      const alvo = painel?.querySelector('.esx-status');
      if (alvo) alvo.textContent = txt;
    };

    const CSS = [
      // Cada painel nasce num canto proprio: de baixo a' direita e' o painel de captura do
      // jogo, e empilhar os quatro no mesmo lugar escondia um atras do outro. Quem arrasta
      // manda — `cfg.pos` passa por cima disto.
      '.esx{position:fixed;right:300px;top:96px;z-index:2147483646;width:252px;max-height:70vh;',
      'overflow:auto;background:#11151df2;color:#e6e9ef;font:13px system-ui,sans-serif;',
      'border:1px solid #3a4152;border-radius:10px;padding:12px 13px;box-shadow:0 8px 26px #0009}',
      '.esx-barra{display:flex;align-items:center;justify-content:space-between;cursor:move;',
      'user-select:none;margin:-4px -4px 6px}',
      '.esx h4{margin:0;font-size:13px;letter-spacing:.3px}',
      '.esx-x{width:auto!important;margin:0!important;padding:1px 7px!important;line-height:1;',
      'font-size:15px!important;background:transparent!important;border:none!important;',
      'opacity:.6;cursor:pointer}',
      '.esx-x:hover{opacity:1;background:#273145!important}',
      '.esx-l{display:flex;align-items:center;gap:6px;margin:4px 0}',
      '.esx-l input{width:52px;background:#0b0e14;color:#e6e9ef;border:1px solid #3a4152;',
      'border-radius:5px;padding:3px 5px;font:12px system-ui,sans-serif}',
      '.esx-l select{flex:1;min-width:0;background:#0b0e14;color:#e6e9ef;',
      'border:1px solid #3a4152;border-radius:5px;padding:3px 5px;',
      'font:11.5px system-ui,sans-serif}',
      '.esx-l button{width:auto!important;margin:0!important;padding:3px 8px!important;',
      'font-size:12px!important}',
      '.esx-lv{font-size:11.5px;opacity:.75;flex:0 0 auto}',
      '.esx-time{width:100%;margin:7px 0 0;background:#0b0e14;color:#e6e9ef;',
      'border:1px solid #3a4152;border-radius:5px;padding:3px 5px;',
      'font:11.5px system-ui,sans-serif}',
      '.esx-vazio{font-size:11.5px;opacity:.65;line-height:1.35}',
      '.esx-liga{display:flex;align-items:center;gap:6px;margin:9px 0 0;font-size:11.5px;',
      'opacity:.85;cursor:pointer}',
      '.esx-liga input{width:auto;margin:0;padding:0}',
      '.esx button{width:100%;margin-top:8px;background:#1d2534;color:#e6e9ef;',
      'border:1px solid #3a4152;border-radius:6px;padding:7px;font:13px system-ui,sans-serif;',
      'cursor:pointer}',
      '.esx button:hover{background:#273145}',
      '.esx-status{margin-top:9px;font-size:11.5px;opacity:.8;min-height:15px;line-height:1.35}',
      // Minimizado fica a escada e o interruptor, que e' o que se olha de relance.
      '.esx.compacto{width:190px}',
      '.esx.compacto .esx-novo,.esx.compacto .esx-status,.esx.compacto .esx-l .esx-fora,',
      '.esx.compacto .esx-time,.esx.compacto .esx-vazio{display:none}',
      '.esx.compacto .esx-l{margin:2px 0}',
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
      const bt = painel.querySelector('.esx-min');
      if (!bt) return;
      bt.textContent = cfg.compacto ? '□' : '–';
      bt.title = cfg.compacto ? 'Mostrar tudo' : 'Minimizar';
    }

    /**
     * O seletor de caçada de um degrau.
     *
     * As caçadas vem das Caçadas (Alt+W), que e' quem as guarda e quem sabe viajar. Uma caçada
     * que saiu daquela lista **nao desaparece em silencio**: fica aqui, marcada, para voce ver
     * que ela sumiu em vez de descobrir quando o degrau nao disparar.
     */
    function seletorDeCacada(degrau) {
      const nomes = (globalThis.PPX?.cacadas?.cfg?.lista || []).map((c) => c.nome);
      const sel = document.createElement('select');
      sel.className = 'esx-cacada';

      const nenhum = document.createElement('option');
      nenhum.value = '';
      nenhum.textContent = nomes.length ? '— escolha a caçada —' : '— Caçadas desligada —';
      sel.append(nenhum);

      for (const nome of nomes) {
        const o = document.createElement('option');
        o.value = nome;
        o.textContent = nome;
        sel.append(o);
      }
      if (degrau.cacada && !nomes.includes(degrau.cacada)) {
        const perdida = document.createElement('option');
        perdida.value = degrau.cacada;
        perdida.textContent = `${degrau.cacada} (não está guardada)`;
        sel.append(perdida);
      }

      sel.value = degrau.cacada || '';
      sel.addEventListener('change', () => {
        degrau.cacada = sel.value;
        gravar();
        diz(sel.value ? `Lv ${degrau.nivel} → "${sel.value}".` : `Lv ${degrau.nivel} sem caçada.`);
      });
      return sel;
    }

    /**
     * O seletor de time da escada — **um so', para todos os degraus**.
     *
     * A escada e' a subida de uma equipe: sao as caçadas que mudam, nao o time. Um seletor por
     * degrau daria para escrever a mesma escolha seis vezes e errar numa delas.
     *
     * Tres estados, e eles sao mesmo tres: **o time da caçada** (cada caçada leva o que esta'
     * configurado nela, no Alt+W), **nao trocar o time** e **este time aqui**.
     *
     * O estado nao vai no `value` da opcao, vai no `dataset.modo`: um time chamado "— o time da
     * caçada —" e' improvavel, mas um `value` reservado e' uma cilada a' espera, e evita-la aqui
     * custa uma linha.
     */
    function seletorDeTime() {
      const nomes = globalThis.PPX?.times?.nomes?.() || [];
      const sel = document.createElement('select');
      sel.className = 'esx-time';

      const opcao = (modo, valor, texto) => {
        const o = document.createElement('option');
        o.dataset.modo = modo;
        o.value = valor;
        o.textContent = texto;
        sel.append(o);
        return o;
      };

      opcao('cacada', '@cacada', '— o time de cada caçada —');
      opcao('nenhum', '@nenhum', '— sem trocar o time —');
      for (const nome of nomes) opcao('time', nome, `sempre o time "${nome}"`);
      if (cfg.time && !nomes.includes(cfg.time))
        opcao('time', cfg.time, `"${cfg.time}" (não existe mais)`);

      sel.value = cfg.time === undefined ? '@cacada' : cfg.time === '' ? '@nenhum' : cfg.time;

      sel.addEventListener('change', () => {
        const modo = sel.selectedOptions[0]?.dataset.modo;
        if (modo === 'cacada') delete cfg.time;
        else cfg.time = modo === 'nenhum' ? '' : sel.value;
        gravar();
        diz(
          modo === 'cacada'
            ? 'Cada caçada leva o time que está configurado nela.'
            : modo === 'nenhum'
              ? 'Não troco o time em degrau nenhum.'
              : `Todos os degraus com o time "${cfg.time}".`,
        );
      });
      return sel;
    }

    function pintarLista() {
      const caixa = painel?.querySelector('.esx-timebox');
      if (caixa) {
        caixa.textContent = '';
        caixa.appendChild(seletorDeTime());
      }
      const lista = painel?.querySelector('.esx-lista');
      if (!lista) return;
      lista.textContent = '';
      if (!cfg.degraus.length) {
        const vazio = document.createElement('div');
        vazio.className = 'esx-vazio';
        vazio.textContent =
          'Nenhum degrau ainda. Um degrau é "a partir do nível N, caçar em tal lugar".';
        lista.appendChild(vazio);
        return;
      }
      for (const degrau of cfg.degraus) {
        const l = document.createElement('div');
        l.className = 'esx-l';

        const rotulo = document.createElement('span');
        rotulo.className = 'esx-lv';
        rotulo.textContent = 'Lv';

        const nivel = document.createElement('input');
        nivel.type = 'number';
        nivel.min = '1';
        nivel.value = String(degrau.nivel);
        nivel.title = 'A partir deste nível do líder';
        nivel.addEventListener('change', () => {
          const n = Math.max(1, Math.round(Number(nivel.value) || 1));
          degrau.nivel = n;
          ordenar();
          gravar();
          pintarLista();
          diz(`Degrau mudou para Lv ${n}.`);
        });

        const fora = document.createElement('button');
        fora.className = 'esx-fora';
        fora.textContent = '×';
        fora.title = 'Tirar este degrau';
        fora.addEventListener('click', () => {
          cfg.degraus = cfg.degraus.filter((d) => d !== degrau);
          gravar();
          pintarLista();
          diz('Degrau tirado.');
        });

        l.append(rotulo, nivel, seletorDeCacada(degrau), fora);
        lista.appendChild(l);
      }
    }

    function montar() {
      if (painel) return painel;

      const estilo = document.createElement('style');
      estilo.textContent = CSS;
      (document.head || document.documentElement).appendChild(estilo);

      painel = document.createElement('div');
      painel.className = 'esx';

      const barra = document.createElement('div');
      barra.className = 'esx-barra';
      const titulo = document.createElement('h4');
      titulo.textContent = 'Escada de caçadas';
      const minimizar = document.createElement('button');
      minimizar.className = 'esx-x esx-min';
      minimizar.textContent = '–';
      minimizar.title = 'Minimizar';
      minimizar.addEventListener('click', () => {
        cfg.compacto = !cfg.compacto;
        gravar();
        aplicarModo();
      });
      const fechar = document.createElement('button');
      fechar.className = 'esx-x';
      fechar.textContent = '×';
      fechar.title = 'Esconder (Alt+P traz de volta)';
      fechar.addEventListener('click', () => mostrar(false));
      barra.append(titulo, minimizar, fechar);
      painel.appendChild(barra);
      arrastarPor(barra);

      const lista = document.createElement('div');
      lista.className = 'esx-lista';
      painel.appendChild(lista);

      // Uma caixa propria para o seletor do time: `pintarLista` refa-la, para a lista de times
      // guardados estar sempre fresca — um time criado depois de o painel subir tem de aparecer.
      const caixaTime = document.createElement('div');
      caixaTime.className = 'esx-timebox';
      painel.appendChild(caixaTime);

      const novo = document.createElement('button');
      novo.className = 'esx-novo';
      novo.textContent = '＋ Novo degrau';
      novo.addEventListener('click', () => {
        cfg.degraus.push({ nivel: nivelDoProximo(), cacada: '' });
        ordenar();
        gravar();
        pintarLista();
        diz('Escolha o nível e a caçada do degrau novo.');
      });
      painel.appendChild(novo);

      const liga = document.createElement('label');
      liga.className = 'esx-liga';
      const caixa = document.createElement('input');
      caixa.type = 'checkbox';
      caixa.checked = cfg.ligada === true;
      caixa.addEventListener('change', () => {
        cfg.ligada = caixa.checked;
        // Ligar recomeça a escada: o degrau certo e' o do nivel de agora, nao o de antes.
        if (cfg.ligada) cfg.aplicado = null;
        gravar();
        if (cfg.ligada) {
          diz('Ligada. Vou olhar o nível do líder.');
          conferir();
        } else diz('Desligada. Não troco mais de caçada sozinha.');
      });
      const texto = document.createElement('span');
      texto.textContent = 'trocar de caçada sozinha';
      liga.append(caixa, texto);
      painel.appendChild(liga);

      const status = document.createElement('div');
      status.className = 'esx-status';
      painel.appendChild(status);

      document.body.appendChild(painel);
      aplicarPosicao();
      aplicarModo();
      pintarLista();
      diz(diagnostico());
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
        // Abrir o painel tem de responder a' pergunta "porque e' que ela nao fez nada?".
        diz(diagnostico());
      } else if (painel) painel.style.display = 'none';
      globalThis.PPX?.anotar?.('escada', visivel);
    }

    addEventListener(
      'keydown',
      (e) => {
        if (!e.altKey || e.ctrlKey || e.shiftKey) return;
        if (e.key.toLowerCase() !== 'p') return;
        // Campo de texto nao dispara atalho: o jogo tem chat, e um "p" ali nao e' um comando.
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
    globalThis.PPX?.controlar?.('escada', (sim) => mostrar(sim));

    vigiar();
    conferir();

    globalThis.PPX = globalThis.PPX || {};
    globalThis.PPX.escada = { conferir, degrauPara, nivelLider, nivelDoProximo, diagnostico, cfg };

    if (typeof module !== 'undefined' && module.exports)
      module.exports = { conferir, degrauPara, nivelLider, nivelDoProximo, diagnostico, cfg };
  },
);
