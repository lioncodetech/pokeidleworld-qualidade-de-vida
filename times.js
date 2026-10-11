// Times guardados: guarda equipes de seis e as remonta num clique.
//
// O TIME NAO E' UMA TELA DE TIME. Ele mora dentro do Deposito (NPC Depot, no Centro Pokemon de
// Cerulean), na aba "⚔ Pokémon": duas colunas, Equipe e Box, e setas que movem entre elas. Tudo
// o que esta' escrito abaixo foi medido ali, na conta real, em 09/10/2026.
//
PPX.modulo(
  {
    id: 'times',
    nome: 'Times',
    atalhos: 'Alt+T esconde · Alt+Y mostra',
    proprio: true,
  },
  () => {
    'use strict';

    const MINHA_VEZ = 'times';
    const CHAVE = 'lioncode:pokeidleworld:times';

    const esperarAVez = async () => {
      const vez = globalThis.PPX?.vez;
      if (!vez?.pedir) return () => {};
      return vez.pedir(MINHA_VEZ);
    };

    // --------------------------------------------------------------- o Deposito
    //
    // O que foi medido, e que decidiu cada linha daqui:
    //
    //  - A janela e' `.dpt-window`, com abas `.nsh-tab` ("🎒 Itens", "⚔ Pokémon", "👪 Família:
    //    Itens", "👪 Família: Pokémon").
    //  - Duas colunas `.dpt-col`, nesta ordem: **Equipe** e **Box**. As linhas sao BOTOES
    //    `.dpt-poke-row` com `.dpt-name`, `.dpt-meta` ("Nv 262 · IV 149/192 · Lendária") e uma seta
    //    `.dpt-arrow` (→ guarda no Box, ← traz para a Equipe).
    //  - **Com a equipe cheia, o Box inteiro fica travado**: as 123 linhas vieram com a classe
    //    `dpt-nomove` e o titulo "Equipe cheia (6)". Entao a ordem e' obrigatoria: **tirar primeiro,
    //    pôr depois.** Nao existe trocar um por um.
    //  - O Box inteiro esta' no DOM (nao e' lista virtual): nao e' preciso rolar nem usar a busca.
    //  - **Nome nao identifica ninguem**: ha' quatro Scyther. Nem nome+ficha — 123 linhas deram 104
    //    chaves distintas. Por isso a chave aqui e' nome+ficha e os gemeos sao intercambiaveis de
    //    proposito; mas eles contam, e pedir dois iguais exige dois no Box.

    const TIME_MAX = 6;
    // O compasso vem do `pausa.js`, que tem um dono so': a pausa pedida e' o chao, e por cima
    // dela vai um sorteio. Sem o modulo (num teste, por exemplo) espera-se o pedido, e pronto.
    const esperar = (ms) =>
      globalThis.PPX?.pausa ? globalThis.PPX.pausa(ms) : new Promise((r) => setTimeout(r, ms));

    const janela = () => document.querySelector('.dpt-window');

    /** "Charizard ⚔" -> "Charizard". O ⚔ marca o lider, nao faz parte do nome. */
    const soNome = (t) => (t || '').replace(/\s*⚔\s*$/, '').trim();

    /**
     * A ficha sem o nivel: "Nv 262 · IV 149/192 · Lendária" -> "IV 149/192 · Lendária".
     *
     * **Nivel nao e' identidade.** O Charizard sobe de nivel a cacar, e com o nivel dentro da
     * chave o time guardado hoje deixava de casar amanha. O IV e a grade nao mudam.
     */
    const semNivel = (meta) =>
      (meta || '')
        .split('·')
        .map((x) => x.trim())
        .filter((x) => x && !/^Nv\b/i.test(x))
        .join(' · ');

    /** A chave de texto: o que da' para ler na tela. E' a rede, nao a primeira escolha. */
    const textoDe = (linha) =>
      `${soNome(linha.querySelector('.dpt-name')?.textContent)} | ${semNivel(
        linha.querySelector('.dpt-meta')?.textContent,
      )}`;

    /**
     * O id do pokemon daquela linha — medido em 09/10/2026: **a `key` do React da propria linha
     * e' o `capId`** (`cmubb3tkcxpz38r52dgpvji5x`), o mesmo que aparece em `teamIds` no HUD.
     *
     * Isto e' interno do React, e por isso nunca e' a unica fonte: a `key` esta' no elemento da
     * linha, sem travessia nem nome de componente nem ordem de hook, mas o sufixo de
     * `__reactFiber$` muda a cada build do jogo e um dia pode simplesmente nao estar la'. Quando
     * nao estiver, vale o texto — a ferramenta fica como era antes, nao quebra.
     */
    const idDe = (linha) => {
      try {
        const k = Object.keys(linha).find((x) => x.startsWith('__reactFiber$'));
        const id = k ? linha[k]?.key : null;
        return typeof id === 'string' && /^[a-z0-9]{16,}$/i.test(id) ? id : '';
      } catch (e) {
        return '';
      }
    };

    /**
     * As duas chaves de uma linha. Guarda-se a do id quando ha' id (`#cmub...`), e a de texto
     * quando nao ha' — e na hora de casar aceita-se qualquer uma das duas, para que os times
     * guardados antes de existir id continuem a servir.
     */
    const chavesDe = (linha) => {
      const id = idDe(linha);
      return { id: id ? `#${id}` : '', texto: textoDe(linha) };
    };

    const chaveDe = (linha) => {
      const c = chavesDe(linha);
      return c.id || c.texto;
    };

    const serve = (linha, chave) => {
      const c = chavesDe(linha);
      return chave === c.id || chave === c.texto;
    };

    /** Times guardados antes disto traziam o nivel na chave; aqui eles sao trazidos ao formato. */
    const normalizar = (chave) => {
      const texto = String(chave);
      if (texto.startsWith('#')) return texto;
      const corte = texto.indexOf(' | ');
      if (corte < 0) return texto;
      return `${texto.slice(0, corte)} | ${semNivel(texto.slice(corte + 3))}`;
    };

    const colunas = () => {
      const w = janela();
      if (!w) return null;
      const cols = [...w.querySelectorAll('.dpt-col')];
      if (cols.length < 2) return null;
      const ler = (c) => [...c.querySelectorAll('.dpt-poke-row')];
      return { equipe: ler(cols[0]), box: ler(cols[1]) };
    };

    /** Troca para a aba "⚔ Pokémon" e confirma que ela ficou ligada. */
    async function abaPokemon() {
      const w = janela();
      if (!w) return false;
      const aba = [...w.querySelectorAll('.nsh-tab')].find((b) => /Pokémon/.test(b.textContent));
      if (!aba) return false;
      if (!/\bon\b/.test(aba.className)) {
        aba.click();
        await esperar(700);
      }
      return /\bon\b/.test(aba.className);
    }

    /** As fichas da equipe de agora, na ordem em que estao. */
    function timeAtual() {
      const c = colunas();
      return c ? c.equipe.map(chaveDe) : [];
    }

    /**
     * O nome de mostrar de uma chave guardada.
     *
     * A chave por id nao diz nome nenhum — por isso o time guardado leva, ao lado, o nome que
     * estava na tela quando foi guardado. Um painel que dissesse "#cmub..." nao seria um painel.
     */
    const rotulo = (chave) => {
      const texto = String(chave);
      if (!texto.startsWith('#')) return texto.split(' | ')[0];
      return cfg.nomes?.[texto] || 'esse pokémon';
    };

    /**
     * O nome COM a ficha, para as mensagens de erro.
     *
     * Dizer so' "Persian nao esta no Box" e' quase inutil quando ha' dez Persian: o que se quer
     * saber e' QUAL. A lista do painel continua curta — ali o nome basta —, mas quem parou
     * precisa do detalhe para ir conferir.
     */
    const detalhe = (chave) => {
      const texto = String(chave);
      if (texto.startsWith('#')) return `${rotulo(texto)} (guardado por id)`;
      const corte = texto.indexOf(' | ');
      if (corte < 0) return texto;
      return `${texto.slice(0, corte)} (${texto.slice(corte + 3)})`;
    };

    const soNomes = (chaves) => chaves.map(rotulo).join(', ');

    // --------------------------------------------------------------- o que se guarda

    const PADRAO = {
      times: {},
      nomes: {},
      pos: null,
      compacto: false,
      ordem: false,
      // Ligada por padrao: uma equipe caida nao caça, nao viaja e nao avisa. Foi pedida assim.
      curarSozinho: true,
    };
    let cfg = { ...PADRAO };
    try {
      const cru = localStorage.getItem(CHAVE);
      if (cru) cfg = { ...cfg, ...JSON.parse(cru) };
    } catch {
      /* fica o padrao: nenhum time guardado */
    }
    const gravar = () => {
      try {
        localStorage.setItem(CHAVE, JSON.stringify(cfg));
      } catch {
        /* janela sem armazenamento: vale so' para esta sessao */
      }
    };

    // Traz o que ja' estava guardado para o formato sem nivel, uma vez, ao carregar.
    for (const [nome, lista] of Object.entries(cfg.times))
      if (Array.isArray(lista)) cfg.times[nome] = lista.map(normalizar);

    const nomes = () => Object.keys(cfg.times).sort();

    /**
     * Guarda a equipe de agora com um nome.
     *
     * Abre o Deposito sozinho, se for preciso, e devolve o jogador a' caçada no fim — guardar um
     * time nao pode custar a caçada em que se estava.
     */
    async function salvarTime(nome, aviso = () => {}) {
      const etiqueta = (nome || '').trim();
      if (!etiqueta) return 'De um nome ao time antes de guardar.';

      const soltar = await esperarAVez();
      if (!soltar) return 'Outra ferramenta esta agindo. Tente de novo.';
      let volta = null;
      try {
        const ida = await irAoDeposito(aviso);
        volta = ida.volta;
        if (!ida.ok) return ida.motivo;
        if (!(await abaPokemon())) return 'Nao consegui abrir a aba Pokémon do Depósito.';
        const linhas = colunas()?.equipe || [];
        if (!linhas.length) return 'Nao li nenhum pokémon na equipe. Nao guardei.';
        const t = linhas.map(chaveDe);
        // Ao lado da chave guarda-se o nome que estava na tela: a chave por id nao diz nome
        // nenhum, e um painel que mostrasse "#cmub..." nao seria um painel.
        cfg.nomes = cfg.nomes || {};
        for (const linha of linhas) {
          const c = chavesDe(linha);
          if (c.id) cfg.nomes[c.id] = textoDe(linha).split(' | ')[0];
        }
        cfg.times[etiqueta] = t;
        gravar();
        return `"${etiqueta}" guardado: ${soNomes(t)}.`;
      } finally {
        if (volta) {
          await esperar(900);
          const x = document.querySelector('.dpt-window .nsh-x');
          if (x) {
            x.click();
            await esperar(1000);
          }
          await viajar(volta);
        }
        soltar();
      }
    }

    function apagarTime(nome) {
      if (!cfg.times[nome]) return 'Esse time nao existe.';
      delete cfg.times[nome];
      gravar();
      return `"${nome}" apagado.`;
    }

    // --- ir ate' o Deposito -------------------------------------------------------------------
    //
    // Medido em 09/10/2026: o Depot NAO fica numa tela a' parte. Chegando a Cerulean pelo botao
    // "Voltar para Cerulean", a placa "Abrir Depot" aparece entre as placas da cidade, ao lado da
    // "Abrir Market". Entao o caminho e' curto: cidade, placa, janela.
    //
    // Duas armadilhas medidas no mesmo dia:
    //
    //  - **Depois de um F5 o jogo abre um anuncio** (o passe de batalha) que fica por cima de
    //    tudo e impede o mapa de desenhar. Ele fecha num botao "Fechar", e e' a primeira coisa a
    //    fazer antes de procurar qualquer placa.
    //  - **As placas dos NPC so' existem enquanto a aba esta' a desenhar.** Em aba oculta o motor
    //    do jogo para, e `.npc-plate-btn` fica vazio — nao e' erro de busca, e' o jogo parado. Por
    //    isso aqui se espera pelas placas e, se elas nao vierem, diz-se isso em vez de insistir.
    //
    // A viagem de volta e' repetida aqui de proposito, como nas Caçadas: cada ferramenta do
    // pacote pode estar desligada sozinha, e depender de outra para voltar deixaria o jogador
    // plantado em Cerulean quando ela estivesse fora.

    const botoes = () => [...document.querySelectorAll('button')];
    const porTitulo = (t) => botoes().find((b) => (b.title || '').trim() === t);

    /** "Nível 270 · Persian" -> "Persian". */
    const local = () => {
      const t = document.querySelector('.phud-tloc')?.textContent || '';
      const p = t.split('·');
      return p.length > 1 ? p[p.length - 1].trim() : '';
    };

    /**
     * Ha' alguem caido na equipe?
     *
     * O HUD do jogo mostra a vida de cada um em `.phud-mon .sbar-hp .sbar-txt` ("0/24", "24/24").
     * Importa porque **o jogo nao deixa viajar com a equipe desmaiada** — e porque curar sem
     * precisar seria fazer o jogador ver uma conversa com a Joy a' toa.
     */
    const alguemCaido = () =>
      [...document.querySelectorAll('.phud-mon')].some((m) =>
        /^0\s*\//.test((m.querySelector('.sbar-hp .sbar-txt')?.textContent || '').trim()),
      );

    const botaoCurar = () =>
      [...document.querySelectorAll('button')].find((b) => /Curar equipe/i.test(b.textContent || ''));

    const fecharDialogo = () => {
      const d = document.querySelector('[class*=npc-dlg]');
      const x = d?.querySelector('.cfg-x');
      if (x) x.click();
    };

    /**
     * Passa na Nurse Joy e cura a equipe. Devolve true se curou.
     *
     * Ela fica no mesmo Centro Pokemon de Cerulean onde fica o Depot — e' de graca e e' o unico
     * jeito: nao ha' item nem botao que faca isso de longe.
     *
     * **As placas dos NPC dizem todas "Conversar"**, e qual e' de quem so' se sabe abrindo. Entao
     * abre-se uma de cada vez e procura-se o botao "Curar equipe"; a que nao for dela fecha-se e
     * segue. Em Cerulean sao tres, e a da Joy e' a primeira — mas depender dessa ordem seria
     * depender de uma coisa que o jogo nunca prometeu.
     */
    async function curarNaJoy(aviso = () => {}) {
      const placas = [...document.querySelectorAll('.npc-plate-btn')].filter((b) =>
        /Conversar/i.test(b.textContent || ''),
      );
      if (!placas.length) return false;
      aviso('Passando na Nurse Joy.');
      for (const placa of placas) {
        placa.click();
        await esperar(800);
        const bt = botaoCurar();
        if (bt) {
          bt.click();
          await esperar(1000);
          fecharDialogo();
          await esperar(600);
          return true;
        }
        fecharDialogo();
        await esperar(500);
      }
      return false;
    }

    /** O anuncio que o jogo abre depois do F5 e que segura o mapa inteiro. */
    const fecharAnuncio = async () => {
      const f = botoes().find((b) => /^Fechar$/i.test((b.textContent || '').trim()));
      if (f) {
        f.click();
        await esperar(800);
      }
    };

    /**
     * Espera uma condicao virar verdadeira, em vez de esperar um tanto fixo.
     *
     * Era isto que faltava: a janela do Deposito nao abre em 1,5 s sempre — as vezes leva mais,
     * e um numero fixo transformava "demorou" em "nao abriu". Perguntar de meio em meio segundo
     * custa nada e aceita tanto o jogo rapido quanto o lento.
     */
    async function ateQue(cond, limite = 8000) {
      // Conta tentativas em vez de olhar o relogio: na pratica da' o mesmo tempo (cada espera e'
      // de ~450 ms mais o sorteio), e deixa o teste rodar num piscar em vez de esperar de
      // verdade os dez segundos do limite.
      const voltas = Math.max(1, Math.round(limite / 450));
      for (let i = 0; i < voltas; i += 1) {
        if (cond()) return true;
        await esperar(450);
      }
      return cond();
    }

    /** Espera as placas da cidade aparecerem e devolve a que diz `re`. */
    async function placa(re, tentativas = 12) {
      for (let i = 0; i < tentativas; i += 1) {
        const p = [...document.querySelectorAll('.npc-plate-btn')].find((b) => re.test(b.textContent || ''));
        if (p) return p;
        await esperar(700);
      }
      return null;
    }

    /**
     * Escuta o que o jogo responde enquanto se tenta viajar.
     *
     * O jogo nao recusa a viagem com um erro: ele mostra um aviso e simplesmente nao sai do
     * lugar. Medido em 10/10/2026, com o lider desmaiado. Le-se o que **aparece** durante o
     * clique, e nunca o que esta' dentro do chat: ali qualquer jogador escreve qualquer coisa,
     * e ler dali seria deixar estranhos escolherem a mensagem de erro da ferramenta.
     *
     * Esta' repetido nas Caçadas de proposito, como o `viajar`: cada ferramenta do pacote pode
     * estar desligada sozinha, e uma depender da outra para isto seria trocar quinze linhas
     * repetidas por uma falha calada.
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

    /** Abre o mapa e clica no marcador da caçada — o caminho de volta. */
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

    async function viajar(hunt) {
      if (!hunt) return false;
      const mapa = porTitulo('Mapa');
      if (!mapa) return false;
      mapa.click();
      const marcador = () =>
        [...document.querySelectorAll('.hunt-marker')].find(
          (m) => (m.title || '') === `Viajar para ${hunt}`,
        );
      // O mapa e' uma lista grande e demora a montar: espera haver marcadores, nao um relogio.
      if (!(await ateQue(() => document.querySelectorAll('.hunt-marker').length > 0, 12000)))
        return false;
      // A caçada de onde se saiu pode ser de outra regiao, e o mapa so' desenha a aberta.
      if (!(await procurarNoMapa(marcador)).achou) return false;
      await esperar(700);
      marcador().click();
      await ateQue(() => local() === hunt, 20000);
      return local() === hunt;
    }

    /**
     * Garante o Deposito aberto na aba Pokemon, indo ate' la' se for preciso.
     *
     * Devolve `{ ok, motivo, volta }`. `volta` e' a caçada de onde se saiu — quem chama tem de a
     * usar no fim, mesmo quando a montagem falhar: ficar plantado em Cerulean e' pior do que nao
     * ter saido.
     */
    async function irAoDeposito(aviso = () => {}) {
      // `abriu` diz se a janela e' nossa. Uma que ja' estava na tela e' do jogador, e fechar o
      // que o jogador abriu seria mexer no que nao e' nosso.
      if (janela()) return { ok: true, volta: null, abriu: false };

      const daqui = local();
      await fecharAnuncio();

      let volta = null;
      if (daqui !== 'Cerulean') {
        const bt = porTitulo('Voltar para Cerulean');
        if (!bt)
          return { ok: false, motivo: 'Nao achei o botao de voltar para Cerulean.', volta: null };
        aviso(`Saindo de "${daqui}" para o Depósito.`);
        volta = daqui;
        bt.click();
        // Espera CHEGAR, e nao um tanto fixo: a cidade carrega mais devagar nuns dias do que
        // noutros, e continuar antes de chegar e' procurar uma placa que ainda nao existe.
        const chegou = await ateQue(() => local() === 'Cerulean', 20000);
        if (!chegou) return { ok: false, volta, motivo: 'Cliquei para ir a Cerulean e nao cheguei.' };
        await fecharAnuncio();
        await esperar(1200);
      }

      // Antes de mexer no time, cura — e' isto que o jogador pediu, e tem um motivo concreto:
      // com alguem caido o jogo nao deixa sair da cidade, e descobrir isso depois da troca
      // custa a viagem toda. So' passa na Joy se houver mesmo alguem caido.
      if (alguemCaido()) await curarNaJoy(aviso);

      const depot = await placa(/Abrir Depot/);
      if (!depot)
        return {
          ok: false,
          volta,
          motivo:
            'Nao achei a placa do Depot. Com a aba do jogo em segundo plano o mapa para de ' +
            'desenhar e as placas somem: deixe a janela do jogo visivel.',
        };

      // Um instante antes de clicar, como quem olha a tela e so' depois clica.
      await esperar(900);
      depot.click();

      // **Sao dois cliques, nao um.** Medido em 09/10/2026: a placa abre um dialogo do NPC
      // ("Depot — Guarda seus itens no depósito") com um botao `.npc-dlg-btn` escrito "Abrir
      // Depósito". Era isto que faltava: a ferramenta clicava na placa, nao via `.dpt-window` e
      // dizia que a janela nao tinha aberto — quando na verdade faltava o segundo clique.
      const confirmar = () =>
        [...document.querySelectorAll('button')].find((b) =>
          /Abrir Dep[oó]sito/i.test(b.textContent || ''),
        );
      if (await ateQue(() => !!confirmar() || !!janela(), 6000)) {
        const bt = confirmar();
        if (bt && !janela()) {
          await esperar(700);
          bt.click();
        }
      }

      if (!(await ateQue(() => !!janela(), 10000)))
        return { ok: false, volta, abriu: false, motivo: 'Cliquei no Depot e a janela nao abriu.' };
      await esperar(900);
      return { ok: true, volta, abriu: true };
    }

    /**
     * Quantos, a contar do inicio, ja' estao no lugar certo.
     *
     * So' serve para alguma coisa porque quem vem do Box entra **no fim** da equipe: o que ja'
     * esta' certo na frente nunca precisa de sair.
     */
    const prefixo = (equipe, lista) => {
      let i = 0;
      while (i < equipe.length && i < lista.length && serve(equipe[i], lista[i])) i += 1;
      return i;
    };

    /**
     * O unico passo que cabe agora, quando a ordem nao importa.
     *
     * Quem ja' serve fica onde esta'; sai o que sobra, entra o que falta.
     */
    function passoLivre(c, lista) {
      const querem = [...lista];
      const sobrando = [];
      for (const linha of c.equipe) {
        const i = querem.findIndex((k) => serve(linha, k));
        if (i >= 0) querem.splice(i, 1);
        else sobrando.push(linha);
      }
      if (!sobrando.length && !querem.length) return { acao: 'pronto' };
      if (sobrando.length && c.equipe.length > 1) return { acao: 'tirar', linha: sobrando[0] };
      if (querem.length && c.equipe.length < TIME_MAX) return { acao: 'por', chave: querem[0] };
      return { acao: 'preso' };
    }

    /**
     * O unico passo que cabe agora, quando a ordem importa.
     *
     * Medido em 10/10/2026, na conta real, e e' tudo o que ha':
     *
     *  - quem vem do Box entra **no fim** da equipe;
     *  - tirar alguem do meio nao mexe na ordem dos outros;
     *  - o lider (o ⚔) e' simplesmente o primeiro da fila, e passa sozinho para o seguinte
     *    quando o primeiro sai — **escolher a ordem e' escolher o lider**;
     *  - nao existe reordenar dentro da coluna: nenhuma seta de subir/descer, nada arrastavel.
     *
     * Entao a ordem nao se **arruma**: constroi-se da frente para tras. Tudo o que esta' depois
     * do primeiro erro tem de sair, e volta na ordem certa. E' mais caro — cinco certos e um
     * fora de lugar na frente custam a troca quase inteira —, e e' por isso que isto e' uma
     * escolha, e nao o jeito unico.
     */
    function passoEmOrdem(c, lista) {
      const p = prefixo(c.equipe, lista);
      if (p === lista.length && c.equipe.length === lista.length) return { acao: 'pronto' };
      if (c.equipe.length > p) {
        // Com um so' na equipe o jogo recusa tirar. Entao primeiro traz o certo e so' depois o
        // errado sai: a equipe passa por dois, nunca por zero.
        if (c.equipe.length === 1) return { acao: 'por', chave: lista[0] };
        return { acao: 'tirar', linha: c.equipe[p] };
      }
      if (p < lista.length) return { acao: 'por', chave: lista[p] };
      return { acao: 'preso' };
    }

    /**
     * A troca em si: vai ao Deposito e poe a equipe guardada em pe'.
     *
     * A ordem nao e' negociavel: confere TUDO antes de tirar alguem. Com a equipe cheia o Box fica
     * travado, entao e' preciso esvaziar primeiro — e esvaziar para so' depois descobrir que falta
     * um pokemon deixaria o utilizador em campo com meio time, que e' pior do que nao ter mexido.
     *
     * Anota em `saida.volta` a caçada de onde se saiu: quem chama precisa dela para devolver o
     * jogador, e precisa dela mesmo quando isto falhar no meio.
     */
    async function trocarNoDeposito(nome, alvo, aviso, voltar, saida) {
      const ida = await irAoDeposito(aviso);
      // Quem chama pode dispensar a volta: as Caçadas montam o time e viajam logo a seguir, e
      // voltar a' caçada velha no meio seria uma viagem a' toa. Se a ida FALHAR, a volta vale
      // na mesma — ninguem fica plantado em Cerulean por causa de uma opcao.
      saida.volta = voltar ? ida.volta : null;
      saida.abriu = ida.abriu === true;
      if (!ida.ok) {
        saida.volta = ida.volta;
        return ida.motivo;
      }
      if (!(await abaPokemon())) return 'Nao consegui abrir a aba Pokémon do Depósito.';

      const antes = colunas();
      if (!antes) return 'Nao achei as colunas Equipe/Box.';

      // Quem ja' esta' na equipe e serve fica; o resto sai. "Serve" aceita as duas chaves — o
      // id (exato) e o texto (a rede) —, e e' isso que faz um time guardado antes de existir
      // id continuar a servir. Consome-se o pedido casado, para que gemeos contem: dois
      // Scyther pedidos exigem dois.
      const pedidos = [...alvo];
      const saem = [];
      for (const linha of antes.equipe) {
        const i = pedidos.findIndex((k) => serve(linha, k));
        if (i >= 0) pedidos.splice(i, 1);
        else saem.push(linha);
      }
      const faltam = pedidos;
      // Com a ordem ligada, "os mesmos seis" nao basta: tem de ser os mesmos seis na mesma fila.
      const certa =
        !saem.length &&
        !faltam.length &&
        (!cfg.ordem || prefixo(antes.equipe, alvo) === alvo.length);
      if (certa) return `A equipe ja e "${nome}".`;
      if (!saem.length && !faltam.length) aviso('So a ordem esta trocada.');

      // CONFERE ANTES DE MEXER: cada um que falta tem de existir no Box.
      const livres = [...antes.box];
      for (const k of faltam) {
        const i = livres.findIndex((l) => serve(l, k));
        if (i < 0) return `${detalhe(k)} nao esta no Box. Nao mexi em nada.`;
        livres.splice(i, 1);
      }

      aviso(`Guardando ${saem.length}, trazendo ${faltam.length}.`);

      // --- a troca, intercalada --------------------------------------------------------------
      //
      // Nao da' para tirar todos e so' depois pôr. Medido em 09/10/2026, na conta real:
      //
      //  - com a equipe CHEIA (6), o Box inteiro fica travado (`dpt-nomove`) — entao e' preciso
      //    tirar antes de pôr;
      //  - com a equipe em UM, o clique para guardar nao faz nada — **o jogo nao deixa a equipe
      //    ficar vazia**. Com dois na equipe, sai qualquer um, ate' o lider (conferido).
      //
      // Os dois limites juntos nao se resolvem em duas fases: resolvem-se alternando. A cada
      // volta le-se o estado de novo e faz-se o unico passo que cabe — tirar, se houver mais de
      // um; pôr, se houver vaga. Com 6 trocas sao no maximo 13 passos; o teto de 40 e' folga,
      // e existir e' o que impede um laco eterno se o jogo parar de responder.
      const LIMITE = 40;
      let passos = 0;
      for (; passos < LIMITE; passos += 1) {
        const c = colunas();
        if (!c) return 'A janela do Depósito fechou no meio da troca. Confira.';

        const quantos = c.equipe.length;
        const passo = cfg.ordem ? passoEmOrdem(c, alvo) : passoLivre(c, alvo);

        if (passo.acao === 'pronto') break;

        if (passo.acao === 'tirar') {
          passo.linha.click();
          await esperar(650);
          if ((colunas()?.equipe.length ?? 0) >= quantos)
            return `Cliquei para guardar e a equipe continua com ${quantos}. Parei no meio — confira.`;
          continue;
        }

        if (passo.acao === 'por') {
          const k = passo.chave;
          const linha = c.box.find((l) => serve(l, k) && !/dpt-nomove/.test(l.className));
          if (!linha) return `${detalhe(k)} nao esta no Box. Parei no meio — confira.`;
          linha.click();
          await esperar(650);
          if ((colunas()?.equipe.length ?? 0) <= quantos)
            return `Cliquei para trazer "${rotulo(k)}" e a equipe nao cresceu. Parei — confira.`;
          continue;
        }

        // Nem da' para tirar nem para pôr: insistir seria martelar. Melhor dizer.
        return 'Fiquei sem passo possivel no meio da troca. Parei — confira.';
      }
      if (passos >= LIMITE) return 'A troca nao terminou no numero de passos esperado. Confira.';

      // 3. auditoria: o que ficou tem de ser o guardado, nem a mais nem a menos
      const agora = colunas()?.equipe || [];
      const conferir = [...alvo];
      for (const linha of agora) {
        const i = conferir.findIndex((k) => serve(linha, k));
        if (i < 0) return `Terminei, mas sobrou "${textoDe(linha).split(' | ')[0]}". Confira.`;
        conferir.splice(i, 1);
      }
      if (conferir.length) return `Terminei, mas faltou "${rotulo(conferir[0])}". Confira.`;
      if (cfg.ordem && prefixo(agora, alvo) !== alvo.length)
        return 'Terminei, mas a equipe nao ficou na ordem guardada. Confira.';

      return `"${nome}" montado${cfg.ordem ? ', na ordem' : ''}: ${soNomes(alvo)}.`;
  }

    /**
     * O caminho de volta, e o que dizer quando ele nao da' certo.
     *
     * A volta nao e' um detalhe de arrumacao: montar o time e deixar o jogador plantado em
     * Cerulean nao e' "montado". Antes isto corria dentro de um `finally` que ignorava o
     * resultado — a ferramenta dizia "montado" e o jogador ficava na cidade sem saber porque.
     * Foi o que aconteceu com a equipe desmaiada, em 10/10/2026.
     *
     * Devolve '' quando nao havia para onde voltar ou quando a volta correu bem; nos outros
     * casos, a frase que falta dizer.
     */
    async function voltarPara(volta, abriu, aviso = () => {}) {
      await esperar(900);
      if (abriu) {
        const x = document.querySelector('.dpt-window .nsh-x');
        if (x) {
          x.click();
          await esperar(1000);
        }
      }
      // Curar antes nao chega: quem veio do Box pode vir caido, e e' **esta** equipe, a de
      // agora, que vai sair da cidade. Quem dispensa a volta tambem passa por aqui — as
      // Caçadas viajam logo a seguir, e uma equipe caida as pararia na mesma.
      //
      // So' com a janela fora da frente: com o Deposito aberto nao se alcanca o NPC, e fechar
      // uma janela que o jogador abriu seria mexer no que nao e' nosso.
      if (!document.querySelector('.dpt-window') && alguemCaido()) await curarNaJoy(aviso);
      if (!volta) return '';
      const parar = escutarOJogo();
      const foi = await viajar(volta);
      const disse = parar();
      if (foi) return '';
      if (/desmaiad/i.test(disse))
        return (
          `Mas nao voltei para "${volta}": sua equipe esta desmaiada, e o jogo nao deixa sair ` +
          'assim. Cure com a Nurse Joy (o "Conversar" dela, em Cerulean).'
        );
      return `Mas nao voltei para "${volta}" — voce ficou em "${local() || 'nao sei onde'}".`;
    }

    /**
     * A ida a' Joy, sem o Deposito: sai da caçada, cura e devolve o jogador.
     *
     * Separada de `montarTime` porque curar e trocar de time sao coisas diferentes — a equipe
     * cai no meio de uma caçada sem que ninguem queira mexer em quem esta' nela.
     */
    async function passarNaJoy(saida, voltar, aviso) {
      const daqui = local();
      await fecharAnuncio();

      if (daqui !== 'Cerulean') {
        const bt = porTitulo('Voltar para Cerulean');
        if (!bt)
          return (
            'Nao achei o botao de voltar para Cerulean. Com a aba do jogo em segundo plano o ' +
            'mapa para de desenhar: deixe a janela do jogo visivel.'
          );
        aviso(`Equipe caída. Saindo de "${daqui}" para a Nurse Joy.`);
        if (voltar) saida.volta = daqui;
        bt.click();
        const chegou = await ateQue(() => local() === 'Cerulean', 20000);
        if (!chegou) return 'Cliquei para ir a Cerulean e nao cheguei.';
        await fecharAnuncio();
        await esperar(1200);
      }

      if (!(await curarNaJoy(aviso)))
        return 'Nao achei a Nurse Joy em Cerulean. A equipe continua caida.';
      // Quem diz se curou e' a barra de vida, nao o clique no botao.
      if (alguemCaido()) return 'Falei com a Joy e a equipe continua caida. Confira.';
      return '';
    }

    /** Quanto o vigia espera antes de tentar outra vez, depois de uma cura que nao deu. */
    const ESPERA_APOS_FALHA = 60000;

    /**
     * Cura a equipe **sem sair do lugar e sem pedir a vez**: para quem ja' esta' em Cerulean e
     * ja' tem a vez na mao.
     *
     * Existe por causa do Ciclo, que segura a vez do inicio ao fim da ida ao mercado. Se ele
     * chamasse `curar`, que pede a vez outra vez, ficaria a' espera de si proprio — a fila so' e'
     * reentrante para o mesmo dono. Quem tem a vez usa esta; quem nao tem usa `curar`.
     */
    async function curarAqui(aviso = () => {}) {
      if (!alguemCaido()) return '';
      if (local() !== 'Cerulean') return 'A Nurse Joy fica em Cerulean, e voce nao esta la.';
      if (!(await curarNaJoy(aviso))) return 'Nao achei a Nurse Joy em Cerulean.';
      return alguemCaido() ? 'Falei com a Joy e a equipe continua caida. Confira.' : '';
    }

    /**
     * Cura a equipe, de onde quer que o jogador esteja — e devolve-o para la'.
     *
     * Devolve '' quando nao havia nada a fazer ou correu tudo bem; senao, a frase do que falhou.
     * E' a porta que as outras ferramentas usam: a Joy mora aqui porque o Deposito mora aqui, e
     * duas ferramentas a procurarem o mesmo NPC por conta propria divergiriam no primeiro dia.
     */
    async function curar(aviso = () => {}, { voltar = true } = {}) {
      if (!alguemCaido()) return '';
      const soltar = await esperarAVez();
      if (!soltar) return 'Outra ferramenta esta agindo. Tente de novo.';

      const saida = { volta: null };
      let msg = '';
      try {
        msg = await passarNaJoy(saida, voltar, aviso);
      } finally {
        const falta = await voltarPara(saida.volta, false, aviso);
        if (falta) msg = msg ? `${msg} ${falta}` : falta;
        soltar();
      }
      return msg;
    }

    /**
     * Fica de olho na vida da equipe e vai a' Joy sozinho quando alguem cai.
     *
     * So' age na **mudanca**: o HUD bate varias vezes por segundo numa caçada, e reler a vida de
     * seis pokemon a cada batida seria caro por nada. E nao age com o Deposito aberto — ali a
     * janela esta' na frente do NPC, e quem a abriu foi o jogador.
     */
    function vigiarAEquipe() {
      if (typeof MutationObserver === 'undefined' || !document.body) return null;
      let agindo = false;
      // Quando se pode tentar de novo. **Nao se guarda "ja' vi este caido"**: a primeira versao
      // guardava, e bastava o pokemon cair com a aba em segundo plano — que e' como se joga,
      // varias janelas ao mesmo tempo — para a tentativa ser descartada com o estado ja'
      // marcado como visto. Dali em diante ela nunca mais tentava, e a equipe passava a noite
      // caida. Um relogio volta a tentar; uma trava nao.
      let proxima = 0;
      const olho = new MutationObserver(() => {
        if (agindo || !alguemCaido()) return;
        if (cfg.curarSozinho === false) return;
        // Aba oculta: o motor do jogo para, as placas dos NPC somem e a Joy fica fora de
        // alcance. Nao da' para curar agora — mas da' para tentar quando a aba voltar.
        if (document.visibilityState !== 'visible') return;
        // A janela esta' na frente do NPC, e quem a abriu foi o jogador.
        if (document.querySelector('.dpt-window')) return;
        if (Date.now() < proxima) return;
        agindo = true;
        (async () => {
          try {
            const m = await curar(diz);
            diz(m || 'Equipe curada na Nurse Joy.');
            // Falhou e continua caida? Tenta outra vez, mas sem martelar o jogo.
            if (m && alguemCaido()) proxima = Date.now() + ESPERA_APOS_FALHA;
          } finally {
            agindo = false;
          }
        })();
      });
      olho.observe(document.body, { childList: true, subtree: true, characterData: true });
      return olho;
    }

    /**
     * Monta no jogo um time guardado, e devolve o jogador a' caçada de onde saiu.
     *
     * A troca em si esta' em `trocarNoDeposito`; aqui ficam a vez, a volta e o que dizer no fim.
     */
    async function montarTime(nome, aviso = () => {}, { voltar = true } = {}) {
      const alvo = cfg.times[nome];
      if (!alvo?.length) return 'Nenhum time guardado com esse nome.';
      if (alvo.length > TIME_MAX) return `"${nome}" tem ${alvo.length}, e cabem ${TIME_MAX}.`;

      const soltar = await esperarAVez();
      if (!soltar) return 'Outra ferramenta esta agindo. Tente de novo.';

      // A caçada de onde se saiu. Fica aqui fora porque a volta precisa dela mesmo quando tudo
      // o que vem a seguir falhar.
      const saida = { volta: null, abriu: false };
      let msg = '';
      try {
        msg = await trocarNoDeposito(nome, alvo, aviso, voltar, saida);
      } finally {
        // A volta vale mesmo quando a troca falhou no meio: ficar plantado em Cerulean e' pior
        // do que nao ter saido.
        const falta = await voltarPara(saida.volta, saida.abriu, aviso);
        if (falta) msg = msg ? `${msg} ${falta}` : falta;
        soltar();
      }
      return msg;
    }

    // --------------------------------------------------------------- o painel

    let painel = null;
    /** Devolvido pelo nucleo: recoloca o painel no canto guardado. */
    let recolocar = () => false;
    let visivel = false;

    const diz = (txt) => {
      const alvo = painel?.querySelector('.tmx-status');
      if (alvo) alvo.textContent = txt;
    };

    // A moldura, a barra, os botoes, o separador, o status, a rolagem e o foco vem do
    // nucleo: cinco copias da mesma folha derivam, e derivaram. Aqui fica o que e' deste
    // painel — e vem depois, por isso ganha nos empates.
    const CSS = (globalThis.PPX?.estiloDePainel?.('tmx') || '') + [
      // Cada painel nasce num canto proprio: de baixo a' direita e' o painel de captura do
      // jogo, e empilhar os quatro no mesmo lugar escondia um atras do outro. Quem arrasta
      // manda — `cfg.pos` passa por cima disto.
      '.tmx{right:300px;bottom:96px;width:262px}',
      '.tmx-l{display:flex;align-items:center;gap:6px;margin:4px 0}',
      '.tmx-l b{flex:1;font-size:12.5px;color:#9fd0ff;font-weight:600;overflow:hidden;',
      'text-overflow:ellipsis;white-space:nowrap}',
      '.tmx-l button{width:auto!important;margin:0!important;padding:3px 8px!important;',
      'font-size:12px!important}',
      '.tmx-fichas{font-size:11px;opacity:.65;margin:-2px 0 6px;line-height:1.3}',
      '.tmx input{width:100%;background:#0b0e14;color:#e6e9ef;border:1px solid #3a4152;',
      'border-radius:5px;padding:4px 6px;font:12px system-ui,sans-serif}',
      '.tmx-ordem{display:flex;align-items:center;gap:6px;margin:9px 0 0;font-size:11.5px;',
      'opacity:.8;cursor:pointer}',
      '.tmx-ordem input{width:auto;margin:0;padding:0}',
      // Minimizado fica o essencial do dia a dia: a lista e o ⚔ Montar. Guardar, apagar e as
      // fichas so' servem quando se esta' a arrumar os times, que nao e' todo dia.
      '.tmx.compacto .tmx-fichas,.tmx.compacto .tmx-sep,.tmx.compacto input[type=text],',
      '.tmx.compacto .tmx-guardar,.tmx.compacto .tmx-status,.tmx.compacto .tmx-ordem,',
      '.tmx.compacto .tmx-l .tmx-fora{display:none}',
      '.tmx.compacto .tmx-l{margin:2px 0}',
    ].join('');

    /** Poe o painel no tamanho escolhido da ultima vez, e acerta o botao que o troca. */
    function aplicarModo() {
      if (!painel) return;
      painel.classList.toggle('compacto', cfg.compacto === true);
      const bt = painel.querySelector('.tmx-min');
      if (!bt) return;
      bt.textContent = cfg.compacto ? '□' : '–';
      bt.title = cfg.compacto ? 'Mostrar tudo' : 'Minimizar';
    }

    /** Redesenha a lista de times guardados. */
    function pintarLista() {
      const lista = painel?.querySelector('.tmx-lista');
      if (!lista) return;
      lista.textContent = '';
      const todos = nomes();
      if (!todos.length) {
        const vazio = document.createElement('div');
        vazio.className = 'tmx-fichas';
        vazio.textContent = 'Nenhum time guardado ainda.';
        lista.appendChild(vazio);
        return;
      }
      for (const nome of todos) {
        const l = document.createElement('div');
        l.className = 'tmx-l';
        const b = document.createElement('b');
        b.textContent = nome;
        const usar = document.createElement('button');
        usar.textContent = '⚔ Montar';
        usar.addEventListener('click', async () => {
          diz(`Montando "${nome}"…`);
          diz(await montarTime(nome, diz));
        });
        const fora = document.createElement('button');
        fora.className = 'tmx-fora';
        fora.textContent = '×';
        fora.title = 'Apagar este time guardado';
        fora.addEventListener('click', () => {
          diz(apagarTime(nome));
          pintarLista();
        });
        l.append(b, usar, fora);
        lista.appendChild(l);

        // As fichas a' vista, e nao so' os nomes: dois Exeggcute do mesmo nome podem ser pokemon
        // diferentes, e e' pela ficha que a ferramenta os distingue.
        const fichas = document.createElement('div');
        fichas.className = 'tmx-fichas';
        fichas.textContent = soNomes(cfg.times[nome]);
        lista.appendChild(fichas);
      }
    }

    function montar() {
      if (painel) return painel;

      const estilo = document.createElement('style');
      estilo.textContent = CSS;
      (document.head || document.documentElement).appendChild(estilo);

      painel = document.createElement('div');
      painel.className = 'tmx';

      const barra = document.createElement('div');
      barra.className = 'tmx-barra';
      const titulo = document.createElement('h4');
      titulo.textContent = 'Times guardados';
      const minimizar = document.createElement('button');
      minimizar.className = 'tmx-x tmx-min';
      minimizar.textContent = '–';
      minimizar.title = 'Minimizar';
      minimizar.addEventListener('click', () => {
        cfg.compacto = !cfg.compacto;
        gravar();
        aplicarModo();
      });
      const fechar = document.createElement('button');
      fechar.className = 'tmx-x';
      fechar.textContent = '×';
      fechar.title = 'Esconder (Alt+T traz de volta)';
      fechar.addEventListener('click', () => mostrar(false));
      barra.append(titulo, minimizar, fechar);
      painel.appendChild(barra);

      const lista = document.createElement('div');
      lista.className = 'tmx-lista';
      painel.appendChild(lista);

      const sep = document.createElement('div');
      sep.className = 'tmx-sep';
      sep.textContent = 'Guardar a equipe de agora';
      painel.appendChild(sep);

      const campo = document.createElement('input');
      campo.type = 'text';
      campo.placeholder = 'nome do time (ex.: caçada, ginásio)';
      painel.appendChild(campo);

      const btSalvar = document.createElement('button');
      btSalvar.className = 'tmx-guardar';
      btSalvar.textContent = '📌 Guardar esta equipe';
      btSalvar.title = 'Com o Depósito aberto.';
      btSalvar.addEventListener('click', async () => {
        diz(await salvarTime(campo.value));
        campo.value = '';
        pintarLista();
      });
      painel.appendChild(btSalvar);

      // Desligada por padrao de proposito: manter a ordem obriga a desmontar quase tudo, mesmo
      // quando cinco dos seis ja' estavam certos. Quem precisa da ordem — e do lider, que e' o
      // primeiro da fila — liga; quem so' quer os seis certos nao paga a troca inteira.
      const ordem = document.createElement('label');
      ordem.className = 'tmx-ordem';
      const caixa = document.createElement('input');
      caixa.type = 'checkbox';
      caixa.checked = cfg.ordem === true;
      caixa.addEventListener('change', () => {
        cfg.ordem = caixa.checked;
        gravar();
        diz(cfg.ordem ? 'Vou montar na ordem guardada (o 1º e o líder).' : 'Ordem livre.');
      });
      const dizOrdem = document.createElement('span');
      dizOrdem.textContent = 'manter a ordem (o 1º é o líder)';
      ordem.append(caixa, dizOrdem);
      painel.appendChild(ordem);

      // Ligada por padrao, ao contrario da ordem: curar nao desfaz nada nem custa nada, e uma
      // equipe caida para o jogo inteiro. Quem quiser ver a Joy a' mao desliga aqui.
      const cura = document.createElement('label');
      cura.className = 'tmx-ordem tmx-cura';
      const caixaCura = document.createElement('input');
      caixaCura.type = 'checkbox';
      caixaCura.checked = cfg.curarSozinho !== false;
      caixaCura.addEventListener('change', () => {
        cfg.curarSozinho = caixaCura.checked;
        gravar();
        diz(
          cfg.curarSozinho
            ? 'Vou à Nurse Joy sozinho quando a equipe cair.'
            : 'Não vou mais à Joy sozinho — a equipe caída fica caída.',
        );
      });
      const dizCura = document.createElement('span');
      dizCura.textContent = 'curar na Joy quando a equipe cair';
      cura.append(caixaCura, dizCura);
      painel.appendChild(cura);

      const status = document.createElement('div');
      status.className = 'tmx-status';
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
      globalThis.PPX?.anotar?.('times', visivel);
    }

    addEventListener(
      'keydown',
      (e) => {
        if (!e.altKey || e.ctrlKey || e.shiftKey) return;
        const tecla = e.key.toLowerCase();
        if (tecla !== 't' && tecla !== 'y') return;
        // Campo de texto nao dispara atalho: o jogo tem chat, e uma letra ali nao e' um comando.
        const t = e.target;
        if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName)))
          return;
        e.preventDefault();
        e.stopPropagation();
        // Duas teclas, e nao uma que alterna: com uma so' e' preciso olhar para o ecra' antes de
        // a usar, porque ela faz o contrario do que fez da ultima vez.
        mostrar(tecla === 'y');
      },
      true,
    );

    // Volta ao que estava antes do F5. Por omissao aparece: uma ferramenta que ninguem ve' e'
    // uma ferramenta que ninguem usa, e fecha-se no × ou no menu (Alt+Q) quem nao a quiser.
    mostrar(cfg.visivel !== false);
    globalThis.PPX?.controlar?.('times', (sim) => mostrar(sim));

    vigiarAEquipe();

    globalThis.PPX = globalThis.PPX || {};
    /**
     * A porta para as outras ferramentas do pacote.
     *
     * Devolve `{ ok, erro }` em vez do texto do painel: quem chama precisa de decidir, e decidir
     * por cima de uma frase seria ler a tela em vez de ler o resultado. `voltar: false` serve a
     * quem vai viajar a seguir — as Caçadas montam o time e seguem para a caçada.
     */
    async function usar(nome, { aviso = () => {}, voltar = true } = {}) {
      const msg = await montarTime(nome, aviso, { voltar });
      const ok = /montado|ja e "/.test(msg);
      return { ok, erro: ok ? '' : msg, msg };
    }

    globalThis.PPX.times = { salvarTime, montarTime, apagarTime, timeAtual, nomes, usar, curar, curarAqui, alguemCaido, cfg };

    if (typeof module !== 'undefined' && module.exports)
      module.exports = { salvarTime, montarTime, apagarTime, timeAtual, nomes, usar, curar, curarAqui, alguemCaido, cfg };
  },
);
