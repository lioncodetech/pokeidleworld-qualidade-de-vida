// Loja do Mark: compra em lote e venda com auditoria.
//
// Medido na conta real em 09/10/2026, com a loja aberta:
//
//  - Comprar e' um clique por unidade, SEM confirmacao nenhuma. O saldo cai na hora (testado:
//    uma Poke Ball, 2.362.770 -> 2.362.765). Encher o estoque de Ultra Ball e' centenas de
//    cliques na mao; e' aqui que a automacao paga.
//  - Vender ja' tem filtro por grade, checkbox por linha, "Selecionar tudo" e um botao que
//    anuncia o estrago antes de acontecer: "Vender (73) · 1.314.000".
//  - Cada linha carrega a grade em texto (`.mks-meta` = "Nv 1 · Comum · IV 137"). Isso permite
//    auditar o que esta' marcado em vez de confiar que o filtro funcionou — ver `auditar()`.
//
PPX.modulo(
  { id: 'loja', nome: 'Loja do Mark', atalhos: 'Alt+L esconde · Alt+M mostra', proprio: true },
  () => {
    const CHAVE_CFG = 'lioncode:pokeidleworld:loja:cfg';
    const MINHA_VEZ = 'loja';

    // O que nunca se vende. Nao e' configuravel de proposito: a lista existe para ser chata.
    // As grades protegidas pelo NOME DO ROTULO, nao pelo texto: o jogo traduz ("Lendária" num
    // idioma, "Legendary" noutro), e casar texto portugues com o jogo em ingles fazia o filtro
    // nao desligar E a auditoria nao ver proibido nenhum — ou seja, vendia lendarios.
    const PROTEGIDAS = ['gradeLendaria', 'gradeMitica', 'gradeAncia', 'gradeDivina'];
    // Como a ferramenta as escreve nas mensagens dela, que sao em portugues de todo o modo.
    const NOME_DA_GRADE = {
      gradeLendaria: 'Lendária',
      gradeMitica: 'Mítica',
      gradeAncia: 'Anciã',
      gradeDivina: 'Divina',
    };
    /** Esta grade aparece neste texto corrido? */
    const gradeNoTexto = (nome, texto) => {
      const ppx = globalThis.PPX;
      return ppx?.contemRotulo
        ? ppx.contemRotulo(nome, texto)
        : String(texto).includes(NOME_DA_GRADE[nome]);
    };
    const ITENS_PROTEGIDOS = [
      /^Poke Card Pack$/i, /^Bronze Dimensional Key$/i, /^Devoted Token$/i,
      /^Strange Pheromone$/i, /^Shiny .+ Card$/i, /^Rare Pokemon Picture$/i,
      /^Bronze Boss Token$/i,
      /^Legendary Golden Ticket$/i,
    ];

    /**
     * O nome do item sem acento, que e' como a lista protegida o escreve.
     *
     * Medido no Deposito da Familia em 28/10/2026: a tela diz "Rare Pokémon Picture", com `é`
     * (U+00E9), e a lista diz `Rare Pokemon Picture`. Esses dois nao casam, e o que nao casa nao
     * esta' protegido — a defesa falhava exatamente no item que ela nomeia. Tira-se o acento dos
     * dois lados em vez de escrever o acento na lista: assim tambem serve para o jogo em ingles,
     * que escreve o mesmo nome sem ele.
     *
     * So' o acento sai. Emoji e pontuacao ficam de proposito: nao medi nenhum nome de item com
     * eles, e tirar o que nao se mediu e' alargar a peneira no caminho que nao tem volta.
     */
    const semAcento = (t) =>
      String(t || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .trim();

    /** Este item esta' na lista que nunca se vende? */
    const itemProtegido = (nome) => ITENS_PROTEGIDOS.some((re) => re.test(semAcento(nome)));

    // Pausa entre cliques de compra. O jogo debita no mesmo tick, mas martelar um botao de
    // compra sem respiro e' pedir para o servidor achar que e' ataque.
    const PAUSA_COMPRA = 140;

    // Pausa entre escrever a quantidade e reler o que a loja entendeu. O campo e' do React: o
    // numero so' chega ao estado do jogo depois do evento.
    const PAUSA_CAMPO = 150;

    // Teto de voltas da compra. Com a barra de quantidade cada volta leva ate' 10.000 unidades,
    // entao isto nunca aperta quem compra de verdade — aperta o laco que deixou de progredir.
    const MAX_VOLTAS = 200;

    /** A margem com que o alvo e' sorteado, em porcento. Zero compra exatamente ate' o alvo. */
    const VARIACAO_PADRAO = 3;

    const ITENS = [
      'Poké Ball',
      'Great Ball',
      'Super Ball',
      'Ultra Ball',
      'Small Potion',
      'Great Potion',
      'Ultra Potion',
      'Hyper Potion',
      'Ultimate Potion',
    ];

    // `tetos` e' estoque-alvo, nao quantidade a comprar: o ciclo compra a diferenca entre o que
    // ha' no inventario e este numero. E' o mesmo contrato do pacote do PokePixel.
    const PADRAO = { tetos: {}, variacao: VARIACAO_PADRAO, pos: null, compacto: false };

    let cfg = { ...PADRAO };
    try {
      const cru = localStorage.getItem(CHAVE_CFG);
      if (cru) cfg = { ...PADRAO, ...JSON.parse(cru) };
    } catch (e) {
      cfg = { ...PADRAO };
    }
    if (!cfg.tetos || typeof cfg.tetos !== 'object') cfg.tetos = {};

    const gravar = () => {
      try {
        localStorage.setItem(CHAVE_CFG, JSON.stringify(cfg));
      } catch (e) {
        /* janela sem armazenamento: vale so para esta sessao */
      }
    };

    // O compasso vem do `pausa.js`, que tem um dono so': a pausa pedida e' o chao, e por cima
    // dela vai um sorteio. Sem o modulo (num teste, por exemplo) espera-se o pedido, e pronto.
    const esperar = (ms) =>
      globalThis.PPX?.pausa ? globalThis.PPX.pausa(ms) : new Promise((r) => setTimeout(r, ms));

    // --- leitura da loja -------------------------------------------------------------------

    // O jogo troca de idioma (en/pt/es). Os rotulos vivem no nucleo; o `antigo` so' vale se o
    // nucleo nao tiver carregado.
    const porRotulo = (nome, antigo, { texto = false, comeca = false, raiz = null } = {}) => {
      const ppx = globalThis.PPX;
      if (ppx?.botaoPorRotulo) return ppx.botaoPorRotulo(nome, { texto, comeca, raiz });
      const onde = raiz || document;
      return [...onde.querySelectorAll('button')].find((b) =>
        antigo.test((texto ? b.textContent : b.title) || ''),
      );
    };
    /** Casa um rotulo com o texto do elemento, em qualquer idioma. */
    const eRotuloDe = (nome, texto, antigo, comeca = false) => {
      const ppx = globalThis.PPX;
      const casa = comeca ? ppx?.comecaComRotulo : ppx?.eRotulo;
      return casa ? casa(nome, texto) : antigo.test(texto || '');
    };
    const janela = () => document.querySelector('.mks-window');

    /** O saldo em dollars, lido do cabecalho da loja. `null` quando a loja nao esta aberta. */
    const saldo = () => {
      const t = janela()?.querySelector('.nsh-gold')?.textContent || '';
      const v = parseInt(t.replace(/\D/g, ''), 10);
      return Number.isFinite(v) ? v : null;
    };

    // Nome interno da aba -> aba do jogo. O nome interno continua em portugues porque tambem e'
    // o que aparece nos avisos do painel — e porque ele deixou de ser o nome que o jogo usa.
    //
    // Os itens tinham aba propria, "🎒 Itens", e deixaram de ter. Medido na Loja do Mark em
    // 28/10/2026: as abas sao "🛒 Comprar", "💰 Vender", "🐾 Pokémon" e "↩️ Recompra", e e' na de
    // Vender que os itens se vendem. Procurar por "Itens" nao achava nada, e a venda de itens
    // morria em "aba Itens indisponível" — sem erro nenhum, so' nao vendia. Por isso o nome do
    // jogo mora aqui, numa tabela, e nao no nome com que se chama a rotina.
    const ABAS = {
      'Pokémon': { rotulo: 'abaPokemon', antigo: /\bPok[ée]mon\b/i },
      Itens: { rotulo: 'vender', antigo: /\b(Vender|Sell)\b/i },
      Comprar: { rotulo: 'comprar', antigo: /\b(Comprar|Buy)\b/i },
    };

    const abrirAba = async (rotulo) => {
      const j = janela();
      if (!j) return false;
      const aba = ABAS[rotulo];
      const t = [...j.querySelectorAll('.nsh-tab')].find((x) =>
        aba
          ? eRotuloDe(aba.rotulo, x.textContent, aba.antigo, true)
          : x.textContent.includes(rotulo),
      );
      if (!t) return false;
      if (!String(t.className).includes('on')) {
        t.click();
        await esperar(700);
      }
      return true;
    };

    const linhaDoItem = (nome) =>
      [...(janela()?.querySelectorAll('.mks-row') || [])].find(
        (r) => (r.querySelector('.mks-name')?.textContent || '').trim() === nome,
      );

    // --- o inventario ------------------------------------------------------------------------
    //
    // Quem compra "ate' ter X" precisa de saber quanto ja' tem, e isso o painel da loja nao diz:
    // esta' na mochila. Antes esta leitura morava no Ciclo e abria e fechava o inventario **uma
    // vez por item** — nove aberturas para nove itens. Agora abre-se uma vez, le-se tudo, e
    // abre-se outra vez no fim para dizer quanto entrou de facto.

    const janelaInv = () => document.querySelector('.inv-window');

    async function abrirInventario() {
      if (janelaInv()) return true;
      const bt = porRotulo('inventario', /^Inventário$/);
      if (!bt) return false;
      bt.click();
      // Espera a janela existir, nao um relogio: a mochila e' uma lista grande.
      for (let i = 0; i < 12 && !janelaInv(); i += 1) await esperar(250);
      return !!janelaInv();
    }

    async function fecharInventario() {
      const w = janelaInv();
      if (!w) return;
      const x =
        w.querySelector('.nsh-x') ||
        [...w.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '×');
      if (x) {
        x.click();
        await esperar(700);
      }
    }

    /**
     * A quantidade inteira dos slots `9999+`, lida do tooltip do proprio jogo.
     *
     * **A VERSAO ANTERIOR LIA A PAGINA INTEIRA, E ISSO NAO E' UM EXAGERO.** Ela punha um
     * `MutationObserver` em `document.body`, recolhia todos os numeros >= 10000 que aparecessem
     * em qualquer sitio enquanto o rato estava parado, e ficava com **o maior**. Numa pagina viva
     * isso e' o chat, a EXP, o saldo e os contadores.
     *
     * Apanhado na conta do dono em 27/10/2026: a Ultra Ball aparecia com **1784953486005109** e a
     * Great Potion com **2045511**, enquanto o cabecalho do inventario dizia "2045847 itens" — e
     * esse cabecalho subia sozinho com a cacada. Ela estava a ler o contador do inventario.
     *
     * E o estrago era silencioso, que e' o pior: numero enorme contra o alvo da' "alvo cheio",
     * entao **nao se comprava nada e nao havia erro nenhum**.
     *
     * O jogo ja' da' a resposta certa, e com o nome ao lado dela:
     *
     *     <div class="inv-tip">
     *       <div class="inv-tip-name">Dome Fossil ×31</div>
     *       <div class="inv-tip-qty">×31</div>
     *
     * Por isso agora **le-se o tooltip daquele slot e confere-se o nome antes de aceitar o
     * numero**. Um numero sem nome ao lado nao prova a quem pertence, e era disso que vinha o erro.
     * Sem tooltip, fica sem saber — e nao saber e' um estado honesto, que a leitura ja' trata.
     */
    const soONome = (t) =>
      String(t || '')
        .replace(/[×x]\s*[\d.,]+\s*$/u, '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

    async function revelarQuantidadesExatas() {
      const truncados = [...document.querySelectorAll('.inv-slot')].filter((slot) =>
        /\+/.test(slot.querySelector('.inv-qty')?.textContent || ''),
      );
      for (const slot of truncados) {
        const nome = (slot.querySelector('img')?.alt || '').trim();
        if (!nome) continue;
        // Um slot escondido — noutra aba do inventario — nao recebe hover e nao tem tooltip.
        // Tentar na mesma nao da' erro; so' nao da' numero, e sem numero fica o `9999+`.
        try {
          const r = slot.getBoundingClientRect();
          const opts = { bubbles: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 };
          for (const tipo of ['pointerover', 'mouseover', 'mouseenter', 'mousemove'])
            slot.dispatchEvent(new MouseEvent(tipo, opts));
          await esperar(350);

          const dica = document.querySelector('.inv-tip');
          const nomeNaDica = dica?.querySelector('.inv-tip-name')?.textContent;
          // **O nome tem de bater.** O tooltip e' um so' para o inventario inteiro: se ele ainda
          // estiver a mostrar o item anterior, o numero la' dentro e' do item anterior.
          if (nomeNaDica && soONome(nomeNaDica) === soONome(nome)) {
            const texto = dica.querySelector('.inv-tip-qty')?.textContent || nomeNaDica;
            const v = parseInt(String(texto).replace(/\D/g, ''), 10);
            if (Number.isFinite(v) && v > 0) slot.dataset.ppxQuantidadeExata = String(v);
          }
        } catch (e) {
          // Sem evento de mouse, conserva o seguro `9999+` desconhecido.
        } finally {
          // Sai de cima do slot, para o tooltip do proximo nao ser o deste.
          try {
            for (const tipo of ['mouseout', 'pointerout', 'mouseleave'])
              slot.dispatchEvent(new MouseEvent(tipo, { bubbles: true }));
          } catch (e) {
            // Sair de cima e' cortesia; nao saber sair nao estraga a leitura seguinte, que
            // confere o nome de qualquer maneira.
          }
        }
      }
    }

    /**
     * Quanto ha' de cada item da lista, lido de uma vez so'.
     *
     * Um item que **nao aparece** na mochila tem zero — a mochila so' lista o que existe, e
     * tratar "nao apareceu" como "nao sei" faria justamente os itens acabados, os que mais
     * precisam de compra, serem os unicos nunca comprados. Ja' `Infinity` e' o `9999+` do jogo:
     * numero truncado nao e' numero, e quem nao sabe quanto tem nao pode comprar "a diferenca".
     */
    function lerInventario() {
      if (!janelaInv()) return null;
      const slots = [...document.querySelectorAll('.inv-slot')];
      const conta = {};
      for (const nome of ITENS) {
        const slot = slots.find((s) => (s.querySelector('img')?.alt || '').trim() === nome);
        if (!slot) {
          conta[nome] = 0;
          continue;
        }
        const qty = slot.querySelector('.inv-qty');
        const txt = (qty?.textContent || '1').trim();
        // Acima de 9999 o texto e' truncado, mas o jogo guarda o numero inteiro no tooltip que
        // aparece ao passar o mouse. Leem-se os mesmos atributos que alimentam esse tooltip;
        // nao e' preciso mover o ponteiro nem deixar a automacao dependente de uma animacao.
        const dica = [
          qty?.title,
          qty?.getAttribute?.('aria-label'),
          qty?.getAttribute?.('data-tooltip'),
          qty?.dataset?.tooltip,
          qty?.dataset?.quantity,
          slot.title,
          slot.getAttribute?.('aria-label'),
          slot.getAttribute?.('data-tooltip'),
          slot.dataset?.tooltip,
          slot.dataset?.quantity,
          slot.dataset?.ppxQuantidadeExata,
        ].find((v) => /\d[\d.,]*/.test(String(v || '')) && !/9999\+/.test(String(v || '')));
        const fonte = /\+/.test(txt) ? dica : txt;
        if (!fonte) {
          conta[nome] = Infinity;
          continue;
        }
        const v = parseInt(String(fonte).replace(/\D/g, ''), 10);
        conta[nome] = Number.isFinite(v) ? v : null;
      }
      return conta;
    }

    /**
     * O que foi lido da mochila na ultima vez, por item. Mora aqui e nao no painel porque quem
     * le' e' a compra, que corre com o painel fechado — e quando ele abrir, ja' tem o que mostrar.
     */
    let ultimoEstoque = null;

    /**
     * Abre o inventario, le, fecha, e devolve a frase.
     *
     * Isto e' o botao "conferir a mochila": sem ele, o numero ao lado de cada item so' aparecia
     * depois de uma compra — e quem quer **decidir** o alvo precisa de ver o estoque antes de
     * gastar. Abrir a mochila e' agir no jogo, entao pede a vez como qualquer outra rotina.
     */
    async function conferirEstoque(aviso = () => {}) {
      let soltar = null;
      try {
        soltar = await esperarAVez();
        if (!soltar) return 'Nao consegui a vez na fila; nao abri a mochila.';
        aviso('Abrindo o inventário…');
        if (!(await abrirInventario())) return 'Nao achei o inventário.';
        await revelarQuantidadesExatas();
        const conta = lerInventario();
        await fecharInventario();
        if (!conta) return 'Nao consegui ler o inventário.';
        pintarEstoque(conta);

        const alvos = Object.entries(cfg.tetos).filter(([, teto]) => teto > 0);
        if (!alvos.length) return 'Mochila lida. Nenhum alvo de estoque definido.';
        const faltam = alvos
          .filter(([nome, teto]) => Number.isFinite(conta[nome]) && conta[nome] < teto)
          .map(([nome, teto]) => `${nome} ${teto - conta[nome]}`);
        return faltam.length
          ? `Mochila lida. Falta comprar: ${faltam.join(', ')}.`
          : 'Mochila lida. Todos os alvos estao cheios.';
      } finally {
        if (soltar) soltar();
      }
    }

    /** A margem guardada, presa entre 0 e 50 — 50% ja' e' meio estoque de diferenca. */
    const variacaoPct = () => {
      const n = Number(cfg.variacao);
      return Number.isFinite(n) ? Math.min(50, Math.max(0, Math.round(n))) : VARIACAO_PADRAO;
    };

    /**
     * O alvo desta vez, sorteado dentro da margem.
     *
     * Sem isto a mochila termina sempre no mesmo numero redondo, compra apos compra — e um
     * numero que se repete ao milesimo e' a coisa mais facil de reconhecer numa gravacao. Com
     * 3%, um alvo de 20.000 vira algo entre 19.400 e 20.600.
     */
    const alvoDeAgora = (teto) => {
      const pct = variacaoPct();
      if (!pct) return teto;
      const margem = (Math.random() * 2 - 1) * (pct / 100);
      return Math.max(0, Math.round(teto * (1 + margem)));
    };

    /**
     * Enche a mochila ate' os alvos: le o inventario, compra a diferenca de cada item e confere
     * no fim, abrindo o inventario outra vez.
     *
     * A conferencia do fim nao e' enfeite: a compra conta cliques que debitaram, e o que
     * interessa e' quanto **entrou na mochila**. Os dois numeros discordarem e' justamente o
     * que se quer ver.
     */
    async function abastecer(aviso = () => {}) {
      const alvos = Object.entries(cfg.tetos).filter(([, teto]) => teto > 0);
      if (!alvos.length) return { relato: ['Nenhum alvo de estoque definido.'], comprados: {} };

      aviso('Abrindo o inventário para ver o que já tenho…');
      if (!(await abrirInventario()))
        return { relato: ['Nao achei o inventário. Nao comprei nada.'], comprados: {} };
      await revelarQuantidadesExatas();
      const antes = lerInventario();
      await fecharInventario();
      if (!antes) return { relato: ['Nao consegui ler o inventário. Nao comprei nada.'], comprados: {} };
      pintarEstoque(antes);

      const relato = [];
      for (const [nome, teto] of alvos) {
        const tem = antes[nome];
        if (tem === Infinity) {
          relato.push(`${nome}: já passa de 9999, não comprei.`);
          continue;
        }
        if (tem === null) {
          relato.push(`${nome}: não consegui ler o estoque, não comprei.`);
          continue;
        }
        const alvo = alvoDeAgora(teto);
        const falta = alvo - tem;
        if (falta <= 0) {
          relato.push(`${nome}: ${tem}/${teto}, nada a comprar.`);
          continue;
        }
        aviso(`${nome}: comprando ${falta}…`);
        const r = await comprar(nome, falta, aviso);
        if (r.motivo) relato.push(`${nome}: parei em ${r.comprou}/${falta} — ${r.motivo}.`);
      }

      aviso('Conferindo o inventário…');
      const comprados = {};
      if (!(await abrirInventario())) {
        relato.push('Nao consegui reabrir o inventário para conferir.');
        return { relato, comprados };
      }
      await revelarQuantidadesExatas();
      const depois = lerInventario();
      await fecharInventario();
      if (depois) pintarEstoque(depois);
      for (const [nome, teto] of alvos) {
        const a = antes[nome];
        const d = depois?.[nome];
        if (!Number.isFinite(a) || !Number.isFinite(d)) continue;
        comprados[nome] = d - a;
        relato.push(`${nome}: ${a} → ${d} (+${d - a}), alvo ${teto}.`);
      }
      return { relato, comprados };
    }

    // --- compra ----------------------------------------------------------------------------

    /**
     * Escreve no campo do jogo.
     *
     * O campo e' controlado pelo React: mexer no `.value` direto nao avisa ninguem, e o clique
     * seguinte compraria a quantidade antiga. O setter nativo mais os eventos e' o que o jogo
     * escuta. Fora do navegador (nos testes) nao ha' `HTMLInputElement`, e a atribuicao simples
     * basta — quem precisa de ser avisado ali e' o DOM de mentira.
     */
    function escrever(campo, valor) {
      const classe = globalThis.HTMLInputElement;
      const setter =
        classe && campo instanceof classe
          ? Object.getOwnPropertyDescriptor(classe.prototype, 'value')?.set
          : null;
      if (setter) setter.call(campo, String(valor));
      else campo.value = String(valor);
      campo.dispatchEvent?.(new Event('input', { bubbles: true }));
      campo.dispatchEvent?.(new Event('change', { bubbles: true }));
    }

    /**
     * Quanto a loja entendeu, lido da barra do proprio jogo e nao do campo onde se escreveu.
     *
     * Medido na loja em 13/10/2026: o campo prende o que recebe entre 1 e `max` (10.000) e
     * devolve **1** a tudo o que nao entende — zero, negativo, texto. Um 1 silencioso e' a
     * diferenca entre comprar dez mil e comprar um, e e' por isso que se confere.
     */
    const quantidadeAceita = (linha) => {
      const barra = linha?.querySelector('.nsh-range') || linha?.querySelector('.nsh-num');
      const v = parseInt(barra?.value, 10);
      return Number.isFinite(v) ? v : null;
    };

    /** O teto que o proprio campo declara. Sem ele, uma unidade por volta — nunca as cegas. */
    const tetoDoCampo = (campo) => {
      const m = parseInt(campo?.max, 10);
      return Number.isFinite(m) && m > 0 ? m : 1;
    };

    /**
     * Compra `qtd` unidades, em lotes.
     *
     * A loja ganhou uma barra de quantidade — `.nsh-num` e `.nsh-range`, de 1 a 10.000 —, e o
     * "Comprar" leva o numero que estiver nela. Antes daqui a compra era um clique por unidade
     * com a barra em 1: pedir 10.000 Ultra Ball dava 10.000 cliques, e o jogo deixava de
     * acompanhar muito antes disso — foi assim que um pedido de 10.000 virou 10 compradas.
     *
     * Para sozinha por quatro motivos, e cada um deles e' um jeito de o jogo dizer que nao da':
     * o botao sumiu, a loja nao aceitou a quantidade, o saldo nao caiu, ou o saldo nao paga nem
     * mais uma. Nenhum deles e' erro — sao limites.
     */
    async function comprar(nome, qtd, aviso) {
      if (!(await abrirAba('Comprar'))) return { comprou: 0, motivo: 'loja fechada' };
      if (!linhaDoItem(nome)) return { comprou: 0, motivo: 'item fora da loja' };

      const preco = parseInt(
        (linhaDoItem(nome).querySelector('.mks-price')?.textContent || '').replace(/\D/g, ''),
        10,
      );
      let comprou = 0;
      let parados = 0;
      let voltas = 0;

      while (comprou < qtd) {
        voltas += 1;
        if (voltas > MAX_VOLTAS) return { comprou, motivo: 'passei do limite de voltas' };

        const linha = linhaDoItem(nome);
        const botao = linha?.querySelector('.mks-buy');
        if (!botao || botao.disabled) return { comprou, motivo: 'o botao saiu do ar' };

        const antes = saldo();
        if (Number.isFinite(preco) && antes !== null && antes < preco)
          return { comprou, motivo: 'dinheiro acabou' };

        // Quanto cabe nesta volta: o que falta, o teto da barra e o que o dinheiro paga.
        const campo = linha.querySelector('.nsh-num');
        let lote = qtd - comprou;
        lote = Math.min(lote, campo ? tetoDoCampo(campo) : 1);
        if (Number.isFinite(preco) && preco > 0 && antes !== null)
          lote = Math.min(lote, Math.floor(antes / preco));
        if (lote < 1) return { comprou, motivo: 'dinheiro acabou' };

        if (campo) {
          escrever(campo, lote);
          await esperar(PAUSA_CAMPO);
          const aceite = quantidadeAceita(linha);
          if (aceite !== lote)
            return {
              comprou,
              motivo: `pedi ${lote} e a loja ficou em ${aceite === null ? '?' : aceite}`,
            };
        }

        botao.click();
        await esperar(PAUSA_COMPRA);

        const depois = saldo();
        const caiu = antes !== null && depois !== null ? antes - depois : null;
        if (caiu !== null && caiu <= 0) {
          // O jogo nao debitou: ou nao vendeu, ou nao acompanhou. Insistir as cegas e' o
          // caminho mais curto para comprar mil do que nao se queria.
          parados += 1;
          if (parados >= 3) return { comprou, motivo: 'o jogo parou de debitar' };
          continue;
        }
        parados = 0;
        // Quem diz quanto entrou e' o debito, nao o pedido: pedir mil e pagar por cem e' o jogo
        // a dizer que vendeu cem.
        const pagas =
          caiu !== null && Number.isFinite(preco) && preco > 0 ? Math.round(caiu / preco) : lote;
        comprou += Math.max(1, Math.min(lote, pagas));
        if (aviso) aviso(`${nome}: ${comprou}/${qtd}`);
      }
      return { comprou, motivo: '' };
    }

    // --- venda -----------------------------------------------------------------------------

    const grade = (linha) => {
      const meta = linha.querySelector('.mks-meta')?.textContent || '';
      const achada = PROTEGIDAS.find((g) => gradeNoTexto(g, meta));
      return achada ? NOME_DA_GRADE[achada] : '';
    };

    const marcadas = () =>
      [...(janela()?.querySelectorAll('.mks-row') || [])].filter(
        (r) => r.querySelector('.mks-check')?.checked,
      );

    /** Quantos o proprio jogo diz que vai vender, lido do rotulo do botao: "Vender (73) · …". */
    const contagemDoJogo = () => {
      const b = [...(janela()?.querySelectorAll('button') || [])].find((x) => {
        const t = (x.textContent || '').trim();
        return /\(\d+\)/.test(t) && eRotuloDe('vender', t, /^Vender\s*\(/, true);
      });
      if (!b) return null;
      const m = b.textContent.match(/\((\d+)\)/);
      return m ? parseInt(m[1], 10) : null;
    };

    // --- a lista virtual ---------------------------------------------------------------------
    //
    // A lista de venda deixou de desenhar tudo. Medido na Loja do Mark em 28/10/2026, com 288
    // pokemon a vender: existiam **12** `.mks-row` no DOM, a caixa `.mks-list` tinha 347 px de
    // altura visivel para 17600 px de rolagem, e rolar nao aumentava o numero de linhas — o jogo
    // recicla os mesmos nos.
    //
    // O estrago era este: "Selecionar tudo" marca a lista INTEIRA, do lado do jogo, e a tela so'
    // mostra uma dezena. A auditoria cruzava os dois numeros, via 288 contra 12, e parava. A
    // trava estava certa; o que estava errado era querer vender tudo de uma vez.
    //
    // A saida e' vender por paginas. Cada pagina e' o que esta' desenhado agora: marca-se so'
    // isso, confere-se que a conta do jogo bate com as linhas que se ve, vende-se, e a lista
    // encolhe. A conferencia cruzada continua inteira — passa a valer por pagina, que e' o unico
    // tamanho em que ela pode valer.

    /** A caixa que rola, lida a partir de uma linha. `null` sem lista na tela. */
    const caixaDaLista = () => janela()?.querySelector('.mks-row')?.parentElement || null;

    /** As linhas desenhadas agora — com lista virtual, so' a janela visivel. */
    const linhasNaTela = () => [...(janela()?.querySelectorAll('.mks-row') || [])];

    /** Esta linha pode ser vendida? Pokemon pela grade, itens pelo nome. */
    const permitida = (linha, aba) =>
      aba === 'Pokémon'
        ? !grade(linha)
        : !itemProtegido(linha.querySelector('.mks-name')?.textContent);

    /**
     * O botao que marca e desmarca tudo — que e' UM so', e troca de nome.
     *
     * Medido: "☐ Selecionar tudo" com nada marcado, "☑ Desmarcar tudo" com algo marcado. Quem
     * procurasse so' o primeiro nome perdia o botao justamente quando precisa dele.
     */
    const alternadorDeSelecao = () =>
      [...(janela()?.querySelectorAll('button') || [])].find(
        (b) =>
          eRotuloDe('selecionarTudo', b.textContent, /Selecionar tudo|Select all/i, true) ||
          eRotuloDe('desmarcarTudo', b.textContent, /Desmarcar tudo|Deselect all/i, true),
      ) || null;

    /**
     * Zera a selecao do jogo, inclusive o que esta' fora da tela — e diz se conseguiu.
     *
     * Desmarcar linha a linha NAO serve, e isto custou um susto: depois de uma auditoria, 288
     * pokemon ficaram marcados do lado do jogo enquanto a tela mostrava doze. Desmarcar os doze
     * deixou 276 marcados, invisiveis, prontos para serem vendidos pelo clique seguinte.
     *
     * O unico caminho que limpa tudo e' o alternador, medido em 28/10/2026:
     *
     *     11 marcados · "☐ Selecionar tudo" -> clique -> 288 · "☑ Desmarcar tudo" -> clique -> 0
     *
     * Ou seja: com algo marcado, um clique pode marcar tudo em vez de limpar. O segundo clique
     * e' que limpa. Por isso se clica ate' a conta do jogo dar zero, e nao um numero fixo de
     * vezes.
     */
    async function limparSelecao() {
      for (let i = 0; i < 4; i += 1) {
        if (!contagemDoJogo()) return true;
        const b = alternadorDeSelecao();
        if (!b) return false;
        b.click();
        await esperar(900);
      }
      return !contagemDoJogo();
    }

    /**
     * A verificacao que importa, e ela nao confia no filtro.
     *
     * Desligar as grades altas e torcer para a lista ter atualizado e' confiar num render. Aqui
     * se le a grade de cada linha que esta' marcada: se um lendario estiver marcado, ele esta'
     * marcado, tenha o filtro funcionado ou nao. E se a conta do jogo nao bater com a do DOM,
     * alguem esta' vendo uma lista que o outro nao ve — e ai nao se vende nada.
     */
    function auditar(aba = 'Pokémon') {
      const linhas = marcadas();
      const proibidos = linhas.filter((r) =>
        aba === 'Pokémon'
          ? grade(r)
          : itemProtegido(r.querySelector('.mks-name')?.textContent),
      );
      const doJogo = contagemDoJogo();
      return {
        total: linhas.length,
        doJogo,
        proibidos: proibidos.map((r) => ({
          nome: (r.querySelector('.mks-name')?.textContent || '?').trim(),
          grade: aba === 'Pokémon' ? grade(r) : 'item protegido',
          linha: r,
        })),
        divergente: doJogo !== null && doJogo !== linhas.length,
      };
    }

    /**
     * Deixa UMA pagina pronta para vender: a que esta' desenhada agora.
     *
     * Era "deixa a lista toda pronta", e deixou de poder ser desde que a lista virou virtual —
     * ver a nota da lista virtual acima. Quem vende a lista inteira chama isto em laco, uma vez
     * por pagina, que e' o que `venderAba` faz.
     *
     * `vazia: true` quer dizer "nao ha' nada para marcar nesta pagina" — ou a lista acabou, ou a
     * pagina e' toda protegida. E' diferente de erro: quem chamou rola e segue.
     */
    async function prepararVenda(aviso, aba = 'Pokémon') {
      if (!(await abrirAba(aba))) return { ok: false, motivo: `aba ${aba} indisponível` };

      // 1. desliga as grades protegidas, e confere que desligaram mesmo
      for (const nome of aba === 'Pokémon' ? PROTEGIDAS : []) {
        const b = [...janela().querySelectorAll('.mks-fgrade')].find((x) =>
          eRotuloDe(nome, x.textContent, new RegExp(`^${NOME_DA_GRADE[nome]}$`)),
        );
        if (b && String(b.className).includes('on')) {
          b.click();
          await esperar(350);
        }
      }
      await esperar(600);
      const teimosas = aba === 'Pokémon' ? [...janela().querySelectorAll('.mks-fgrade')]
        .filter(
          (b) =>
            PROTEGIDAS.some((g) => eRotuloDe(g, b.textContent, new RegExp(`^${NOME_DA_GRADE[g]}$`))) &&
            String(b.className).includes('on'),
        )
        .map((b) => b.textContent.trim()) : [];
      if (teimosas.length)
        return { ok: false, motivo: `o filtro nao desligou: ${teimosas.join(', ')}` };

      // 2. parte de zero. O que sobrou marcado de antes pode estar fora da tela, e vender o que
      // nao se viu e' o engano que nao se desfaz.
      if (!(await limparSelecao()))
        return { ok: false, motivo: 'nao consegui desmarcar o que ja estava selecionado' };

      // 3. marca a pagina que esta' na tela
      const linhas = linhasNaTela();
      if (!linhas.length) return { ok: false, motivo: 'nada selecionado', vazia: true };

      // Com a lista inteira desenhada — e' o caso dos itens, 67 linhas para 67 — o alternador
      // faz num clique o que sessenta e sete fariam. So' vale se o jogo marcar exatamente o que
      // se ve: com lista virtual ele marca o resto tambem, e ai' este atalho nao serve.
      let aproveitou = false;
      const alt = alternadorDeSelecao();
      if (alt) {
        alt.click();
        await esperar(900);
        aproveitou = (contagemDoJogo() || 0) === linhas.length;
        if (!aproveitou && !(await limparSelecao()))
          return { ok: false, motivo: 'nao consegui desmarcar o que o jogo marcou' };
      }

      if (aviso && !aproveitou) aviso(`Marcando ${linhas.length} nesta página…`);
      for (const l of linhas) {
        const c = l.querySelector('.mks-check');
        if (!c) continue;
        const quero = permitida(l, aba);
        // No atalho so' ha' que tirar os protegidos; sem ele, marca-se um a um.
        if (aproveitou ? !quero && c.checked : quero !== !!c.checked) {
          c.click();
          await esperar(140);
        }
      }
      await esperar(700);

      // 4. audita: nenhum protegido marcado, e a conta do jogo igual a' da tela
      const a = auditar(aba);
      if (a.proibidos.length)
        return {
          ok: false,
          motivo: `ainda marcado: ${a.proibidos.map((p) => `${p.nome} (${p.grade})`).join(', ')}`,
        };
      if (a.divergente)
        return { ok: false, motivo: `o jogo conta ${a.doJogo}, a tela mostra ${a.total}` };
      if (!a.total) return { ok: false, motivo: 'nada selecionado', vazia: true };

      return { ok: true, total: a.total };
    }

    // --- o painel ---------------------------------------------------------------------------

    let painel = null;
    /** Devolvido pelo nucleo: recoloca o painel no canto guardado. */
    let recolocar = () => false;
    let ocupado = false;

    const diz = (txt) => {
      const alvo = painel?.querySelector('.ljx-status');
      if (alvo) alvo.textContent = txt;
    };

    // A moldura, a barra, os botoes, o separador, o status, a rolagem e o foco vem do
    // nucleo: cinco copias da mesma folha derivam, e derivaram. Aqui fica o que e' deste
    // painel — e vem depois, por isso ganha nos empates.
    const CSS = (globalThis.PPX?.estiloDePainel?.('ljx') || '') + [
      // Cada painel nasce num canto proprio: de baixo a' direita e' o painel de captura do
      // jogo, e empilhar os quatro no mesmo lugar escondia um atras do outro. Quem arrasta
      // manda — `cfg.pos` passa por cima disto.
      '.ljx{left:360px;bottom:96px;width:272px}',
      '.ljx-l{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:3px 0}',
      '.ljx-l span{flex:1;font-size:12px;opacity:.9}',
      '.ljx input{width:62px;background:#0b0e14;color:#e6e9ef;border:1px solid #3a4152;',
      'border-radius:5px;padding:3px 5px;font:12px system-ui,sans-serif;text-align:right}',
      // Minimizado fica o que se usa todo dia: conferir a mochila e rodar o ciclo. Os alvos, a
      // margem e a agenda sao de configurar, e configurar nao se faz todo dia — este painel e' o
      // mais alto dos cinco, e era justamente o unico sem minimizar.
      '.ljx.compacto .ljx-l,.ljx.compacto .ljx-sep,.ljx.compacto .ljx-detalhe{display:none}',
    ].join('');

    /** O modo guardado, porque quem prefere um modo prefere sempre. */
    function aplicarModo() {
      if (!painel) return;
      painel.classList.toggle('compacto', cfg.compacto === true);
      const bt = painel.querySelector('.ljx-min');
      if (!bt) return;
      bt.textContent = cfg.compacto ? '□' : '–';
      bt.title = cfg.compacto ? 'Mostrar tudo' : 'Minimizar';
    }

    const campoNumero = (valor) => {
      const c = document.createElement('input');
      c.type = 'number';
      c.min = '0';
      c.value = String(valor);
      return c;
    };

    const linhaDoPainel = (rotulo, campo) => {
      const l = document.createElement('div');
      l.className = 'ljx-l';
      const r = document.createElement('span');
      r.textContent = rotulo;
      l.append(r, campo);
      // O rotulo fica a' mao porque ele muda: e' nele que se escreve quanto ha' na mochila.
      // Guardar a referencia e' mais seguro do que procura-la depois por classe.
      l.ppxRotulo = r;
      return l;
    };

    /** Os rotulos das linhas de item, por nome, para poder reescrever cada um. */
    const rotulos = {};

    /**
     * Escreve ao lado de cada item quanto ha' dele na mochila.
     *
     * Chamado tanto pelo botao de conferir como pelas duas leituras da compra — o painel mostra
     * o que foi **medido**, nunca uma conta nossa. `9999+` continua `9999+`: numero truncado nao
     * e' numero, e mostrar `9999` ali seria inventar o que o jogo nao disse.
     */
    function pintarEstoque(conta) {
      if (conta) ultimoEstoque = conta;
      for (const nome of ITENS) {
        const r = rotulos[nome];
        if (!r) continue;
        const v = ultimoEstoque?.[nome];
        if (v === undefined) r.textContent = nome;
        else if (v === null) r.textContent = `${nome} · ?`;
        else r.textContent = `${nome} · tem ${v === Infinity ? '9999+' : v}`;
      }
    }

    function montar() {
      if (painel) return painel;

      const estilo = document.createElement('style');
      estilo.textContent = CSS;
      (document.head || document.documentElement).appendChild(estilo);

      painel = document.createElement('div');
      painel.className = 'ljx';

      // A barra e' a alca de arrastar e o unico lugar com o X: arrastar pelo corpo inteiro
      // atrapalharia os campos de numero, que se clicam e se arrastam para selecionar.
      const barra = document.createElement('div');
      barra.className = 'ljx-barra';
      const titulo = document.createElement('h4');
      titulo.textContent = 'Loja do Mark';
      // Dois botoes, e eles nao sao a mesma coisa: o `–` encolhe e a janela continua a' vista;
      // o `×` esconde. Quem minimiza quer continuar a ver os botoes do dia a dia.
      const encolher = document.createElement('button');
      encolher.className = 'ljx-x ljx-min';
      encolher.addEventListener('click', () => {
        cfg.compacto = !cfg.compacto;
        gravar();
        aplicarModo();
      });

      const fechar = document.createElement('button');
      fechar.className = 'ljx-x';
      fechar.textContent = '×';
      fechar.title = 'Esconder (Alt+L traz de volta)';
      fechar.addEventListener('click', () => mostrar(false));

      const cantos = document.createElement('div');
      cantos.append(encolher, fechar);
      barra.append(titulo, cantos);
      painel.appendChild(barra);

      const legenda = document.createElement('div');
      legenda.className = 'ljx-sep';
      legenda.style.marginTop = '0';
      legenda.style.borderTop = 'none';
      legenda.textContent = 'Estoque alvo · 0 ignora';
      painel.appendChild(legenda);

      for (const nome of ITENS) {
        const campo = campoNumero(cfg.tetos[nome] || 0);
        campo.addEventListener('change', () => {
          cfg.tetos[nome] = Math.max(0, parseInt(campo.value, 10) || 0);
          campo.value = String(cfg.tetos[nome]);
          gravar();
        });
        const l = linhaDoPainel(nome, campo);
        rotulos[nome] = l.ppxRotulo;
        painel.appendChild(l);
      }
      // Se a compra ja' correu com o painel fechado, os numeros dela aparecem na abertura.
      pintarEstoque(null);

      const btMochila = document.createElement('button');
      btMochila.className = 'ljx-mochila';
      btMochila.textContent = '🎒 Conferir a mochila';
      btMochila.title = 'Abre o inventário, lê quanto há de cada item e mostra aqui do lado';
      btMochila.addEventListener('click', async () => {
        if (ocupado) {
          diz('Espere: já tem coisa rodando.');
          return;
        }
        ocupado = true;
        try {
          diz(await conferirEstoque(diz));
        } finally {
          ocupado = false;
        }
      });
      painel.appendChild(btMochila);

      const sep = document.createElement('div');
      sep.className = 'ljx-sep';
      sep.textContent = `Venda · protege ${PROTEGIDAS.join(', ')}`;
      painel.appendChild(sep);

      const cVariacao = campoNumero(variacaoPct());
      cVariacao.min = '0';
      cVariacao.max = '50';
      cVariacao.title =
        'Margem com que o alvo é sorteado a cada compra: com 3%, um alvo de 20.000 vira algo ' +
        'entre 19.400 e 20.600. Zero compra exatamente até o alvo.';
      cVariacao.addEventListener('change', () => {
        cfg.variacao = Math.min(50, Math.max(0, parseInt(cVariacao.value, 10) || 0));
        cVariacao.value = String(cfg.variacao);
        gravar();
        diz(
          cfg.variacao
            ? `Alvo sorteado em ±${cfg.variacao}% a cada compra.`
            : 'Alvo exato, sem sorteio.',
        );
      });
      painel.appendChild(linhaDoPainel('Variar o alvo em ± (%)', cVariacao));

      const btVender = document.createElement('button');
      btVender.className = 'ljx-detalhe';
      btVender.textContent = 'Preparar venda (sem vender)';
      btVender.addEventListener('click', () => rodarVenda());
      painel.appendChild(btVender);

      const btCiclo = document.createElement('button');
      btCiclo.textContent = '▶ Rodar o ciclo (Alt+K)';
      btCiclo.addEventListener('click', () => {
        const c = globalThis.PPX?.ciclo;
        if (!c) {
          diz('O módulo do ciclo não está no ar.');
          return;
        }
        diz('Ciclo rodando — acompanhe aqui.');
        c.rodar(venderTudo, comprar, diz);
      });
      painel.appendChild(btCiclo);

      const btPararCiclo = document.createElement('button');
      btPararCiclo.textContent = '⏹ Parar ciclo';
      btPararCiclo.title = 'Interrompe o ciclo antes da próxima ação';
      btPararCiclo.addEventListener('click', () => {
        const c = globalThis.PPX?.ciclo;
        diz(c?.parar?.() ? 'Parada solicitada.' : 'Nenhum ciclo está rodando.');
      });
      painel.appendChild(btPararCiclo);

      const sepAg = document.createElement('div');
      sepAg.className = 'ljx-sep';
      sepAg.textContent = 'Quando rodar sozinho';
      painel.appendChild(sepAg);

      const editor = globalThis.PPX?.ciclo?.controlesDaAgenda?.((txt) => diz(`Agenda: ${txt}`));
      if (editor) {
        editor.el.className = `${editor.el.className || ''} ljx-detalhe`.trim();
        painel.appendChild(editor.el);
      }
      else {
        const semAgenda = document.createElement('div');
        semAgenda.className = 'ljx-status';
        semAgenda.textContent = 'Agenda indisponível (módulo do ciclo fora do ar).';
        painel.appendChild(semAgenda);
      }

      const status = document.createElement('div');
      status.className = 'ljx-status';
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

    // --- as duas rotinas ---------------------------------------------------------------------

    const esperarAVez = async () => {
      const vez = globalThis.PPX?.vez;
      if (!vez?.pedir) return () => {};
      return vez.pedir(MINHA_VEZ);
    };

    /**
     * Vende de verdade: prepara, audita e so' entao clica em Vender.
     *
     * O clique so' acontece depois de tres respostas certas — filtro desligado, nenhum protegido
     * marcado, e a conta do jogo igual a' da tela. Qualquer uma falhando, nao se vende nada. O
     * teto e' a ultima trava: um numero inesperadamente grande e' sinal de que algo mudou.
     */
    // Quantas paginas no maximo, por aba. Com uma dezena de linhas por pagina isto da' folga de
    // sobra para listas de centenas, e e' a rede para o caso de a lista nunca encolher: sem ele,
    // uma pagina que se recusasse a sair rodaria para sempre.
    const TETO_DE_PAGINAS = 60;

    async function venderAba(aba, aviso = () => {}) {
      if (!janela()) return 'Loja fechada: nao vendi.';
      if (!(await abrirAba(aba)))
        return `Venda parada: aba ${aba} indisponível. Nada foi vendido.`;

      let vendidos = 0;
      let paginas = 0;
      let topo = 0;
      let motivo = '';

      while (paginas < TETO_DE_PAGINAS) {
        const caixa = caixaDaLista();
        if (caixa) {
          caixa.scrollTop = topo;
          await esperar(700);
        }
        if (!linhasNaTela().length) break;

        const r = await prepararVenda(aviso, aba);
        if (!r.ok) {
          // Pagina sem nada que se possa vender: rola e segue. So' isto justifica continuar —
          // qualquer outro motivo e' a auditoria a dizer para parar, e ai' para-se.
          const avanco = caixa?.clientHeight || 0;
          if (r.vazia && avanco > 0 && topo + avanco < caixa.scrollHeight) {
            topo += avanco;
            paginas += 1;
            continue;
          }
          if (!r.vazia) motivo = r.motivo;
          break;
        }

        const bt = [...janela().querySelectorAll('button')].find((x) => {
          const t = (x.textContent || '').trim();
          return /\(\d+\)/.test(t) && eRotuloDe('vender', t, /^Vender\s*\(/, true);
        });
        if (!bt) {
          motivo = 'nao achei o botao de vender';
          break;
        }
        const rotulo = bt.textContent.trim();
        bt.click();
        await esperar(1200);

        const conf = await confirmar(r.total);
        if (conf.cancelou) {
          motivo = conf.motivo;
          break;
        }
        vendidos += r.total;
        paginas += 1;
        // Tira o verbo (Vender/Sell/…) e deixa so' o "(12) · 230.000".
        aviso(`${aba}: página ${paginas} — vendidos ${rotulo.replace(/^[^(]*/, '')}`);
        // A lista encolheu: o topo voltou a ter o que vender, e rolar seria pular linhas.
        topo = 0;
        await esperar(1200);
      }

      if (!vendidos)
        return motivo
          ? `Venda parada: ${motivo}. Nada foi vendido.`
          : `${aba}: nada para vender.`;
      return `${aba}: Vendidos ${vendidos} em ${paginas} página(s).${
        motivo ? ` Parei depois: ${motivo}.` : ''
      }`;
    }

    const venderAgora = (aviso = () => {}) => venderAba('Pokémon', aviso);

    async function venderTudo(aviso = () => {}) {
      const pokemon = await venderAba('Pokémon', aviso);
      aviso(pokemon);
      const itens = await venderAba('Itens', aviso);
      return `${pokemon} ${itens}`;
    }

    /**
     * O popup de confirmacao da venda, medido em 09/10/2026: `.mk-sellconfirm`, com "Cancelar" e
     * "Vender mesmo assim", e um aviso que declara "68 linha(s), por 💲1.224.000".
     *
     * Esse numero e' uma TERCEIRA fonte, independente do DOM da lista e do rotulo do botao — e e'
     * a ultima antes do clique que nao volta. Se ele nao bater com o que se auditou, quem esta'
     * errado nao importa: cancela-se.
     *
     * O popup nem sempre aparece: com um pokemon so' a venda sai direta (medido, da pior maneira
     * possivel). Por isso a ausencia dele nao e' erro.
     */
    async function confirmar(esperado) {
      let caixa = null;
      for (let i = 0; i < 12 && !caixa; i += 1) {
        caixa = document.querySelector('.mk-sellconfirm');
        if (!caixa) await esperar(250);
      }
      if (!caixa) return { cancelou: false, motivo: 'sem popup' };

      // O que o popup conta mudou de palavra. Media em 09/10/2026 ele dizia "68 linha(s)"; medido
      // de novo em 28/10/2026 diz "Você vai vender 2 Pokémon por 💲65.000". Quem so' conhecia
      // "linha" nao achava numero nenhum e cancelava toda venda de pokemon — a guarda a funcionar
      // contra a propria venda. Aceita-se o substantivo em qualquer das formas que o jogo usa,
      // nos tres idiomas, e exige-se sempre um deles: um numero solto nao serve, porque o preco
      // tambem e' um numero e casaria com tudo.
      const texto = caixa.innerText || '';
      const achado = texto.match(
        /(\d+)\s*(?:linha|line|l[íi]nea|pok[ée]mon|itens|items|item|objetos)/i,
      );
      const diz = achado ? parseInt(achado[1], 10) : null;

      const porNome = (nomes, re) =>
        [...caixa.querySelectorAll('button')].find((b) =>
          nomes.some((n) => eRotuloDe(n, b.textContent, re, true)),
        );
      const cancelar = porNome(['cancelar'], /Cancelar/i);
      const seguir = porNome(['venderMesmoAssim', 'confirmar'], /Vender mesmo assim|Confirmar/i);

      const desistir = async (motivo) => {
        if (cancelar) {
          cancelar.click();
          await esperar(800);
        }
        return { cancelou: true, motivo };
      };

      if (diz === null) return desistir('O popup nao disse quantos. Cancelei.');
      if (diz !== esperado)
        return desistir(`O popup diz ${diz} e eu contei ${esperado}. Cancelei.`);
      if (!seguir) return desistir('Nao achei o botao de confirmar. Cancelei.');

      seguir.click();
      await esperar(1800);
      return { cancelou: false, motivo: '' };
    }

    /**
     * Prepara a venda e PARA. O clique final em Vender e' seu.
     *
     * Nao e' desconfianca da auditoria — e' que vender e' irreversivel e sao centenas de
     * pokemon. A auditoria custa nada; o erro custa para sempre. Um clique a mais e' barato.
     */
    async function rodarVenda() {
      if (ocupado) return;
      if (!janela()) {
        diz('Abra a loja do Mark primeiro.');
        return;
      }
      ocupado = true;
      let soltar = null;
      try {
        soltar = await esperarAVez();
        if (!soltar) return;
        diz('Aplicando filtros…');
        const r = await prepararVenda(diz);
        if (!r.ok) {
          diz(`Parado: ${r.motivo}. Nada foi vendido.`);
          return;
        }
        diz(
          `${r.total} prontos nesta página, nenhum protegido marcado. Clique em Vender no jogo.`,
        );
      } finally {
        if (soltar) soltar();
        ocupado = false;
      }
    }

    // --- liga e desliga -----------------------------------------------------------------------

    let visivel = false;
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
        // Aparecer e' aparecer na frente: abrir pelo atalho com outro painel por cima nao seria
        // abrir nada.
        globalThis.PPX?.frente?.(painel);
        // Escondido nao tem caixa para medir: se a janela mudou de tamanho enquanto ele estava
        // fora, e' agora que o canto guardado volta a valer.
        recolocar();
      } else if (painel) painel.style.display = 'none';
      globalThis.PPX?.anotar?.('loja', visivel);
    }

    addEventListener(
      'keydown',
      (e) => {
        if (!e.altKey || e.ctrlKey || e.shiftKey) return;
        const tecla = e.key.toLowerCase();
        if (tecla !== 'l' && tecla !== 'm') return;
        // Campo de texto nao dispara atalho: o jogo tem chat, e uma letra ali nao e' um comando.
        const alvo = e.target;
        if (alvo && (alvo.isContentEditable || /^(input|textarea|select)$/i.test(alvo.tagName)))
          return;
        e.preventDefault();
        e.stopPropagation();
        // Duas teclas, e nao uma que alterna: com uma so' e' preciso olhar para o ecra' antes de
        // a usar, porque ela faz o contrario do que fez da ultima vez.
        mostrar(tecla === 'm');
      },
      true,
    );

    // Volta ao que estava antes do F5. Por omissao aparece: uma ferramenta que ninguem ve' e'
    // uma ferramenta que ninguem usa, e fecha-se no × ou no menu (Alt+Q) quem nao a quiser.
    mostrar(cfg.visivel !== false);
    globalThis.PPX?.controlar?.('loja', (sim) => mostrar(sim));

    // A loja e' a camada de acoes; o ciclo so' as encadeia. A configuracao mora aqui, num lugar
    // so': dois donos para o mesmo teto seria o jeito mais facil de comprar pelo numero errado.
    globalThis.PPX = globalThis.PPX || {};
    globalThis.PPX.loja = {
      comprar,
      abastecer,
      conferirEstoque,
      prepararVenda,
      auditar,
      venderAgora,
      venderTudo,
      cfg,
      ITENS,
    };

    // Exposto so para a banca de testes, que executa este arquivo com um DOM de mentira.
    if (typeof module !== 'undefined' && module.exports)
      module.exports = {
        comprar,
        abastecer,
        conferirEstoque,
        // Os rotulos das linhas: e' neles que o estoque lido aparece, e e' isso que se confere.
        rotulos,
        lerInventario,
        alvoDeAgora,
        prepararVenda,
        auditar,
        venderAgora,
        venderTudo,
        cfg,
      };
  },
);
