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
    atalhos: 'Alt+W esconde · Alt+E mostra',
    proprio: true,
  },
  () => {
    'use strict';

    const MINHA_VEZ = 'cacadas';
    const CHAVE = 'lioncode:pokeidleworld:cacadas';
    const CHAVE_CATALOGO = 'lioncode:pokeidleworld:cacadas:catalogo';
    const PRAZO_CATALOGO = 24 * 60 * 60 * 1000;
    const REGIOES = {
      kanto: { nome: 'Kanto', nivel: 0 },
      outland: { nome: 'Outland', nivel: 150 },
      orre: { nome: 'Orre', nivel: 500 },
      nightmare: { nome: 'Nightmare', nivel: 2000 },
    };

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
    /**
     * As quatro regioes do mapa, e os marcadores de cada uma.
     *
     * Medido em 10/10/2026: as placas sao `.map-areas .map-plate`, o nome esta' no `alt` da
     * imagem de dentro ("Kanto", "Outland", "Orre", "Nightmare"), a aberta leva `on` e as que o
     * nivel ainda nao destranca levam `locked` — mas **continuam clicaveis**, e da' para olhar
     * o mapa delas.
     *
     * O que importa: **o mapa so' desenha os marcadores da regiao aberta.** Era por isso que
     * mandar ir a uma caçada de Outland nao fazia nada — o marcador nao existia no DOM, e a
     * ferramenta dizia "nao achei no mapa" depois de esperar doze segundos por ele. Trocar de
     * placa leva cerca de 1 s a redesenhar: Kanto tinha 227 marcadores, Outland 47, Orre 72.
     */
    const placasDoMapa = () => [...document.querySelectorAll('.map-areas .map-plate')];
    const nomeDaPlaca = (b) => (b.querySelector('img')?.alt || '').trim();
    const primeiroMarcador = () => document.querySelector('.hunt-marker')?.title || '';

    /**
     * Procura o marcador na regiao aberta e, se nao estiver la', nas outras.
     *
     * Devolve `{ achou, regiao, travada }`. `regiao` fica vazia quando estava mesmo na que ja'
     * estava aberta — nao se diz "fui a Kanto" a quem ja' estava em Kanto.
     */
    async function procurarNoMapa(marcador) {
      if (marcador()) return { achou: true, regiao: '', travada: false };
      for (const placa of placasDoMapa()) {
        if (placa.classList?.contains?.('on')) continue;
        const antes = primeiroMarcador();
        placa.click();
        // Espera os marcadores trocarem, e nao um relogio: a regiao nova leva ~1 s a desenhar.
        await ateQue(() => primeiroMarcador() !== antes, 5000);
        if (marcador())
          return {
            achou: true,
            regiao: nomeDaPlaca(placa),
            travada: placa.classList?.contains?.('locked') === true,
          };
      }
      return { achou: false, regiao: '', travada: false };
    }

    /**
     * Abre o mapa, acha a caçada — em qualquer uma das quatro regioes — e clica nela.
     *
     * Devolve `{ ok, achou, regiao, travada }`: quem chama precisa de saber a diferenca entre
     * "nao existe esse lugar" e "existe, mas e' em Orre, que o seu nivel ainda nao destranca".
     */
    async function viajar(hunt) {
      const nada = { ok: false, achou: false, regiao: '', travada: false };
      if (!hunt) return nada;
      await fecharJanela();
      const mapa = botoes().find((b) => (b.title || '').trim() === 'Mapa');
      if (!mapa) return nada;
      mapa.click();
      const marcador = () =>
        [...document.querySelectorAll('.hunt-marker')].find(
          (m) => (m.title || '') === `Viajar para ${hunt}` || m.textContent.trim() === hunt,
        );
      // O mapa e' uma lista grande e demora a montar: espera haver marcadores, nao um relogio.
      if (!(await ateQue(() => document.querySelectorAll('.hunt-marker').length > 0, 12000)))
        return nada;

      const achado = await procurarNoMapa(marcador);
      if (!achado.achou) return { ...nada, ...achado };

      // Um instante antes de clicar, como quem olha o mapa e so' depois escolhe.
      await esperar(800);
      marcador().click();
      await ateQue(() => local() === hunt, 20000);
      return { ...achado, ok: true };
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

    // --- o catalogo do jogo ------------------------------------------------------------------
    //
    // O mapa passou a publicar a lista inteira em `/api/game/map-markers`: hoje sao 451 hunts,
    // inclusive Orre e Nightmare antes de a conta as destrancar. Ler esta fonte e' melhor do que
    // clicar nas quatro placas: uma placa bloqueada ja' nao troca de regiao (medido em 15/10/2026).
    // O DOM continua sendo a porta da viagem; o endpoint e' usado somente para listar.

    let catalogo = { quando: 0, hunts: [] };
    try {
      const cru = JSON.parse(localStorage.getItem(CHAVE_CATALOGO) || 'null');
      if (cru && Array.isArray(cru.hunts)) catalogo = cru;
    } catch {
      /* sem catalogo guardado: a lista sera lida do jogo */
    }

    const normalizarCatalogo = (resposta) =>
      (Array.isArray(resposta?.hunts) ? resposta.hunts : [])
        .filter((h) => h?.name && Number(h?.level) > 0 && REGIOES[h?.area])
        .map((h) => ({
          nome: String(h.name),
          nivel: Number(h.level),
          regiao: REGIOES[h.area].nome,
          area: String(h.area),
          tipos: [...(globalThis.PPX_TIPOS_HUNTS?.[h.name] || [])],
        }))
        .sort((a, b) =>
          a.nivel - b.nivel || a.regiao.localeCompare(b.regiao) || a.nome.localeCompare(b.nome),
        );

    const nivelTreinador = () =>
      Number((document.querySelector('.phud-tloc')?.textContent || '').match(/\d+/)?.[0] || 0);

    async function atualizarCatalogo(forcar = false) {
      const fresco = catalogo.hunts.length && Date.now() - Number(catalogo.quando || 0) < PRAZO_CATALOGO;
      if (!forcar && fresco) return catalogo.hunts;
      const resposta = await fetch('/api/game/map-markers', { credentials: 'same-origin' });
      if (!resposta.ok) throw new Error(`map-markers HTTP ${resposta.status}`);
      catalogo = { quando: Date.now(), hunts: normalizarCatalogo(await resposta.json()) };
      localStorage.setItem(CHAVE_CATALOGO, JSON.stringify(catalogo));
      return catalogo.hunts;
    }

    const todasConhecidas = () => {
      const nivel = nivelTreinador();
      const comEstado = catalogo.hunts.map((h) => ({
        ...h,
        tipos: [...(h.tipos || globalThis.PPX_TIPOS_HUNTS?.[h.nome] || [])],
        trancada: nivel < (REGIOES[h.area]?.nivel || 0),
      }));
      const porNome = new Map(comEstado.map((h) => [h.nome, h]));
      const minhas = cfg.lista.map((c) => ({ ...porNome.get(c.nome), ...c, guardada: true }));
      const guardadas = new Set(cfg.lista.map((c) => c.nome));
      return [...minhas, ...comEstado.filter((h) => !guardadas.has(h.nome))];
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

    function salvarNome(nome) {
      if (!nome) return 'Nenhuma caçada escolhida.';
      if (cfg.lista.some((c) => c.nome === nome)) return `"${nome}" ja esta na lista.`;
      cfg.lista.push({ nome, time: '' });
      gravar();
      return `Guardada: "${nome}".`;
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
     * Manda curar a equipe, se houver alguem caido.
     *
     * Quem sabe curar e' a ferramenta Times: a Nurse Joy mora no mesmo Centro Pokemon de
     * Cerulean que o Deposito, e duas ferramentas a procurarem o mesmo NPC por conta propria
     * divergiriam no primeiro dia. Sem os Times ligados, segue-se como antes — o jogo recusa a
     * viagem e a frase da equipe desmaiada ainda esta' la' para explicar.
     */
    async function curarEquipe(aviso) {
      const times = globalThis.PPX?.times;
      if (!times?.curar || !times.alguemCaido?.()) return '';
      return times.curar(aviso, { voltar: false });
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
      const conhecida = todasConhecidas().find((c) => c.nome === hunt);
      if (conhecida?.trancada)
        return `"${hunt}" fica em ${conhecida.regiao}, que o seu nivel ainda nao destranca.`;
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

      // Equipe caida nao viaja: o jogo recusa e **nao diz que recusou** — po-e um aviso na tela e
      // fica quieto. Entao cura-se antes de tentar, em vez de descobrir depois pelo aviso. Quem
      // trocou de time ja' passou pela Joy durante a montagem; esta aqui e' para quem viajou sem
      // trocar nada, que era o caso que ficava de fora.
      const falta = await curarEquipe(aviso);
      if (falta) return `Parei: ${falta}`;

      const soltar = await esperarAVez();
      if (!soltar) return 'Outra ferramenta esta agindo. Tente de novo.';
      try {
        const parar = escutarOJogo();
        const viagem = await viajar(hunt);
        if (!viagem.ok) {
          parar();
          return `Nao achei "${hunt}" no mapa, em nenhuma das regioes. Voce ficou onde estava.`;
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
        // Uma regiao travada nao diz que recusou: ela so' nao te leva. Dizer onde fica a caçada
        // e porque ela nao vale e' a diferenca entre um erro e um diagnostico.
        if (viagem.travada)
          return `"${hunt}" fica em ${viagem.regiao}, que o seu nivel ainda nao destranca.`;
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
    /** Devolvido pelo nucleo: recoloca o painel no canto guardado. */
    let recolocar = () => false;
    let visivel = false;

    const diz = (txt) => {
      const alvo = painel?.querySelector('.cjx-status');
      if (alvo) alvo.textContent = txt;
    };

    // A moldura, a barra, os botoes, o separador, o status, a rolagem e o foco vem do
    // nucleo: cinco copias da mesma folha derivam, e derivaram. Aqui fica o que e' deste
    // painel — e vem depois, por isso ganha nos empates.
    const CSS = (globalThis.PPX?.estiloDePainel?.('cjx') || '') + [
      // Cada painel nasce num canto proprio: de baixo a' direita e' o painel de captura do
      // jogo, e empilhar os quatro no mesmo lugar escondia um atras do outro. Quem arrasta
      // manda — `cfg.pos` passa por cima disto.
      '.cjx{right:18px;top:96px;width:248px}',
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
      '.cjx-filtro{display:flex;gap:5px;margin:0 0 7px}',
      '.cjx-filtro input{min-width:0;flex:1;background:#0b0e14;color:#e6e9ef;',
      'border:1px solid #3a4152;border-radius:5px;padding:5px 7px;font:11.5px system-ui,sans-serif}',
      '.cjx-filtro button{width:30px!important;margin:0!important;padding:3px!important}',
      '.cjx-meta{display:block;font-size:10px;color:#8b97a8;font-weight:400}',
      '.cjx-trancada{opacity:.58}',
      '.cjx-conta{font-size:10px;opacity:.65;margin:5px 0}',
      '.cjx-resumo{display:none;font-size:11px;opacity:.8;line-height:1.3;margin:4px 0}',
      '.cjx.compacto .cjx-resumo{display:block}',
      // Modo compacto: fica o nome da caçada e o Ir, que e' o uso de todo dia. Guardar e apagar
      // sao de arrumar a lista, e arrumar a lista nao se faz todo dia.
      '.cjx.compacto .cjx-guardar,.cjx.compacto .cjx-status,.cjx.compacto .cjx-time,',
      '.cjx.compacto .cjx-filtro,.cjx.compacto .cjx-conta,',
      '.cjx.compacto .cjx-lista,',
      '.cjx.compacto .cjx-l .cjx-fora{display:none}',
      '.cjx.compacto .cjx-l{margin:2px 0}',
    ].join('');

    /** O modo guardado, porque quem prefere um modo prefere sempre. */
    function aplicarModo() {
      if (!painel) return;
      painel.classList.toggle('compacto', cfg.compacto === true);
      // Pela classe, nao pela posicao: `.cjx-barra button` era o PRIMEIRO botao da barra, e um
      // botao novo antes dele poria o `–` no `×`.
      const bt = painel.querySelector('.cjx-min');
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

    const chao = (txt) =>
      String(txt || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    const TETO = 80;
    let filtro = '';

    function pintarLista() {
      const resumo = painel?.querySelector('.cjx-resumo');
      if (resumo)
        resumo.textContent = `${local() || 'Local não lido'} · ${catalogo.hunts.length || '…'} hunts · ${cfg.lista.length} favoritas`;
      const lista = painel?.querySelector('.cjx-lista');
      if (!lista) return;
      lista.textContent = '';
      const busca = chao(filtro.trim());
      const todas = todasConhecidas().filter(
        (c) =>
          (!cfg.compacto || c.guardada) &&
          (!busca ||
            chao(`${c.nome} ${c.nivel ? `lv ${c.nivel}` : ''} ${c.regiao || ''}`).includes(busca)),
      );
      if (!todas.length) {
        const vazio = document.createElement('div');
        vazio.className = 'cjx-vazio';
        vazio.textContent = filtro.trim()
          ? `Nada com "${filtro.trim()}".`
          : catalogo.hunts.length
            ? 'Nenhuma caçada encontrada.'
            : 'Lendo a lista de caçadas do jogo…';
        lista.appendChild(vazio);
        return;
      }
      for (const alvo of todas.slice(0, TETO)) {
        const l = document.createElement('div');
        l.className = `cjx-l${alvo.trancada ? ' cjx-trancada' : ''}`;
        const b = document.createElement('b');
        b.textContent = alvo.nome;
        if (alvo.nivel || alvo.regiao) {
          const meta = document.createElement('small');
          meta.className = 'cjx-meta';
          meta.textContent = [alvo.nivel ? `Lv ${alvo.nivel}` : '', alvo.regiao || '', alvo.trancada ? 'trancada' : '']
            .filter(Boolean)
            .join(' · ');
          b.appendChild(meta);
        }
        const usar = document.createElement('button');
        usar.textContent = '▶ Ir';
        usar.addEventListener('click', async () => {
          diz(`Indo para "${alvo.nome}"…`);
          diz(await ir(alvo.nome, diz));
        });
        const fora = document.createElement('button');
        fora.className = 'cjx-fora';
        fora.textContent = alvo.guardada ? '×' : '＋';
        fora.title = alvo.guardada ? 'Tirar dos atalhos' : 'Guardar nos atalhos';
        fora.addEventListener('click', () => {
          diz(alvo.guardada ? apagar(alvo.nome) : salvarNome(alvo.nome));
          pintarLista();
        });
        l.append(b, usar, fora);
        lista.appendChild(l);
        if (alvo.guardada) lista.appendChild(seletorDeTime(alvo));
      }
      if (todas.length > TETO) {
        const conta = document.createElement('div');
        conta.className = 'cjx-conta';
        conta.textContent = `…e mais ${todas.length - TETO}. Escreva mais no filtro.`;
        lista.appendChild(conta);
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
      encolher.className = 'cjx-x cjx-min';
      encolher.addEventListener('click', () => {
        cfg.compacto = !cfg.compacto;
        gravar();
        aplicarModo();
        pintarLista();
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

      const busca = document.createElement('div');
      busca.className = 'cjx-filtro';
      const campoBusca = document.createElement('input');
      campoBusca.type = 'search';
      campoBusca.placeholder = 'filtrar por nome, nível ou região';
      campoBusca.addEventListener('input', () => {
        filtro = campoBusca.value || '';
        pintarLista();
      });
      const atualizar = document.createElement('button');
      atualizar.textContent = '↻';
      atualizar.title = 'Reler todas as caçadas do jogo';
      atualizar.addEventListener('click', async () => {
        atualizar.disabled = true;
        diz('Relendo todas as caçadas do jogo…');
        try {
          const hunts = await atualizarCatalogo(true);
          diz(`${hunts.length} caçadas lidas do jogo.`);
          pintarLista();
        } catch (e) {
          diz(`Não consegui ler as caçadas: ${String(e?.message || e)}.`);
        } finally {
          atualizar.disabled = false;
        }
      });
      busca.append(campoBusca, atualizar);
      painel.appendChild(busca);

      const resumo = document.createElement('div');
      resumo.className = 'cjx-resumo';
      painel.appendChild(resumo);

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
      pintarLista();
      atualizarCatalogo()
        .then((hunts) => {
          pintarLista();
          if (hunts.length) diz(`${hunts.length} caçadas disponíveis.`);
        })
        .catch((e) => diz(`Não consegui ler as caçadas: ${String(e?.message || e)}.`));
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
        globalThis.PPX?.frente?.(painel);
        // Escondido nao tem caixa para medir: se a janela mudou de tamanho enquanto ele estava
        // fora, e' agora que o canto guardado volta a valer.
        recolocar();
        pintarLista();
      } else if (painel) painel.style.display = 'none';
      globalThis.PPX?.anotar?.('cacadas', visivel);
    }

    addEventListener(
      'keydown',
      (e) => {
        if (!e.altKey || e.ctrlKey || e.shiftKey) return;
        const tecla = e.key.toLowerCase();
        if (tecla !== 'w' && tecla !== 'e') return;
        // Campo de texto nao dispara atalho: o jogo tem chat, e uma letra ali nao e' um comando.
        const t = e.target;
        if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName)))
          return;
        e.preventDefault();
        e.stopPropagation();
        // Duas teclas, e nao uma que alterna: com uma so' e' preciso olhar para o ecra' antes de
        // a usar, porque ela faz o contrario do que fez da ultima vez.
        mostrar(tecla === 'e');
      },
      true,
    );

    // Volta ao que estava antes do F5. Por omissao aparece: uma ferramenta que ninguem ve' e'
    // uma ferramenta que ninguem usa, e fecha-se no × ou no menu (Alt+Q) quem nao a quiser.
    mostrar(cfg.visivel !== false);
    globalThis.PPX?.controlar?.('cacadas', (sim) => mostrar(sim));

    globalThis.PPX = globalThis.PPX || {};
    globalThis.PPX.cacadas = {
      salvar,
      apagar,
      ir,
      local,
      cfg,
      todas: () => todasConhecidas().map((c) => ({ ...c })),
      atualizar: atualizarCatalogo,
      nivelDe: (nome) => todasConhecidas().find((c) => c.nome === nome)?.nivel || 0,
    };

    if (typeof module !== 'undefined' && module.exports)
      module.exports = { salvar, salvarNome, apagar, ir, local, viajar, atualizarCatalogo, todasConhecidas, cfg };
  },
);
