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
  { id: 'loja', nome: 'Loja do Mark', atalhos: 'Alt+L abre o painel', proprio: true },
  () => {
    const CHAVE_CFG = 'lioncode:pokeidleworld:loja:cfg';
    const MINHA_VEZ = 'loja';

    // O que nunca se vende. Nao e' configuravel de proposito: a lista existe para ser chata.
    const PROTEGIDAS = ['Lendária', 'Mítica', 'Anciã', 'Divina'];

    // Pausa entre cliques de compra. O jogo debita no mesmo tick, mas martelar um botao de
    // compra sem respiro e' pedir para o servidor achar que e' ataque.
    const PAUSA_COMPRA = 140;

    // Acima disto a venda para e pede confirmacao, por mais que os filtros estejam certos.
    const TETO_VENDA_PADRAO = 100;

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
    const PADRAO = { tetos: {}, tetoVenda: TETO_VENDA_PADRAO, pos: null };

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

    const janela = () => document.querySelector('.mks-window');

    /** O saldo em dollars, lido do cabecalho da loja. `null` quando a loja nao esta aberta. */
    const saldo = () => {
      const t = janela()?.querySelector('.nsh-gold')?.textContent || '';
      const v = parseInt(t.replace(/\D/g, ''), 10);
      return Number.isFinite(v) ? v : null;
    };

    const abrirAba = async (rotulo) => {
      const j = janela();
      if (!j) return false;
      const t = [...j.querySelectorAll('.nsh-tab')].find((x) => x.textContent.includes(rotulo));
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

    // --- compra ----------------------------------------------------------------------------

    /**
     * Compra `qtd` unidades, uma por clique. Para sozinha por tres motivos, e cada um deles e'
     * um jeito de o jogo dizer que nao da': o botao sumiu, o saldo nao caiu, ou o saldo caiu
     * abaixo do preco de mais uma. Nenhum deles e' erro — sao limites.
     */
    async function comprar(nome, qtd, aviso) {
      if (!(await abrirAba('Comprar'))) return { comprou: 0, motivo: 'loja fechada' };
      const linha = linhaDoItem(nome);
      if (!linha) return { comprou: 0, motivo: 'item fora da loja' };

      const preco = parseInt(
        (linha.querySelector('.mks-price')?.textContent || '').replace(/\D/g, ''),
        10,
      );
      let comprou = 0;
      let parados = 0;

      for (let i = 0; i < qtd; i += 1) {
        const botao = linhaDoItem(nome)?.querySelector('.mks-buy');
        if (!botao || botao.disabled) return { comprou, motivo: 'o botao saiu do ar' };

        const antes = saldo();
        if (Number.isFinite(preco) && antes !== null && antes < preco)
          return { comprou, motivo: 'dinheiro acabou' };

        botao.click();
        await esperar(PAUSA_COMPRA);

        const depois = saldo();
        if (antes !== null && depois !== null && depois >= antes) {
          // O jogo nao debitou: ou nao vendeu, ou nao acompanhou. Insistir as cegas e' o
          // caminho mais curto para comprar mil do que nao se queria.
          parados += 1;
          if (parados >= 3) return { comprou, motivo: 'o jogo parou de debitar' };
        } else {
          parados = 0;
          comprou += 1;
        }
        if (aviso && comprou % 10 === 0) aviso(`${nome}: ${comprou}/${qtd}`);
      }
      return { comprou, motivo: '' };
    }

    // --- venda -----------------------------------------------------------------------------

    const grade = (linha) => {
      const meta = linha.querySelector('.mks-meta')?.textContent || '';
      return PROTEGIDAS.find((g) => meta.includes(g)) || '';
    };

    const marcadas = () =>
      [...(janela()?.querySelectorAll('.mks-row') || [])].filter(
        (r) => r.querySelector('.mks-check')?.checked,
      );

    /** Quantos o proprio jogo diz que vai vender, lido do rotulo do botao: "Vender (73) · …". */
    const contagemDoJogo = () => {
      const b = [...(janela()?.querySelectorAll('button') || [])].find((x) =>
        /^Vender\s*\(/.test((x.textContent || '').trim()),
      );
      if (!b) return null;
      const m = b.textContent.match(/\((\d+)\)/);
      return m ? parseInt(m[1], 10) : null;
    };

    /**
     * A verificacao que importa, e ela nao confia no filtro.
     *
     * Desligar as grades altas e torcer para a lista ter atualizado e' confiar num render. Aqui
     * se le a grade de cada linha que esta' marcada: se um lendario estiver marcado, ele esta'
     * marcado, tenha o filtro funcionado ou nao. E se a conta do jogo nao bater com a do DOM,
     * alguem esta' vendo uma lista que o outro nao ve — e ai nao se vende nada.
     */
    function auditar() {
      const linhas = marcadas();
      const proibidos = linhas.filter((r) => grade(r));
      const doJogo = contagemDoJogo();
      return {
        total: linhas.length,
        doJogo,
        proibidos: proibidos.map((r) => ({
          nome: (r.querySelector('.mks-name')?.textContent || '?').trim(),
          grade: grade(r),
          linha: r,
        })),
        divergente: doJogo !== null && doJogo !== linhas.length,
      };
    }

    async function prepararVenda(aviso) {
      if (!(await abrirAba('Pokémon'))) return { ok: false, motivo: 'loja fechada' };

      // 1. desliga as grades protegidas, e confere que desligaram mesmo
      for (const nome of PROTEGIDAS) {
        const b = [...janela().querySelectorAll('.mks-fgrade')].find(
          (x) => x.textContent.trim() === nome,
        );
        if (b && String(b.className).includes('on')) {
          b.click();
          await esperar(350);
        }
      }
      await esperar(600);
      const teimosas = [...janela().querySelectorAll('.mks-fgrade')]
        .filter(
          (b) => PROTEGIDAS.includes(b.textContent.trim()) && String(b.className).includes('on'),
        )
        .map((b) => b.textContent.trim());
      if (teimosas.length)
        return { ok: false, motivo: `o filtro nao desligou: ${teimosas.join(', ')}` };

      // 2. marca tudo o que sobrou
      const sel = [...janela().querySelectorAll('button')].find((b) =>
        /Selecionar tudo/.test(b.textContent || ''),
      );
      if (sel) {
        sel.click();
        await esperar(900);
      }

      // 3. audita o que ficou marcado, e desmarca um a um o que nao devia estar
      let a = auditar();
      if (a.proibidos.length) {
        if (aviso) aviso(`${a.proibidos.length} protegidos marcados: desmarcando`);
        for (const p of a.proibidos) {
          p.linha.querySelector('.mks-check')?.click();
          await esperar(220);
        }
        await esperar(700);
        a = auditar();
      }

      if (a.proibidos.length)
        return {
          ok: false,
          motivo: `ainda marcado: ${a.proibidos.map((p) => `${p.nome} (${p.grade})`).join(', ')}`,
        };
      if (a.divergente)
        return { ok: false, motivo: `o jogo conta ${a.doJogo}, a tela mostra ${a.total}` };
      if (!a.total) return { ok: false, motivo: 'nada selecionado' };

      return { ok: true, total: a.total };
    }

    // --- o painel ---------------------------------------------------------------------------

    let painel = null;
    let ocupado = false;

    const diz = (txt) => {
      const alvo = painel?.querySelector('.ljx-status');
      if (alvo) alvo.textContent = txt;
    };

    const CSS = [
      // Cada painel nasce num canto proprio: de baixo a' direita e' o painel de captura do
      // jogo, e empilhar os quatro no mesmo lugar escondia um atras do outro. Quem arrasta
      // manda — `cfg.pos` passa por cima disto.
      '.ljx{position:fixed;left:360px;bottom:96px;z-index:2147483646;width:272px;max-height:70vh;',
      'overflow:auto;background:#11151df2;color:#e6e9ef;font:13px system-ui,sans-serif;',
      'border:1px solid #3a4152;border-radius:10px;padding:12px 13px;box-shadow:0 8px 26px #0009}',
      '.ljx-barra{display:flex;align-items:center;justify-content:space-between;cursor:move;',
      'user-select:none;margin:-4px -4px 6px}',
      '.ljx h4{margin:0;font-size:13px;letter-spacing:.3px}',
      '.ljx-x{width:auto!important;margin:0!important;padding:1px 7px!important;line-height:1;',
      'font-size:15px!important;background:transparent!important;border:none!important;',
      'opacity:.6;cursor:pointer}',
      '.ljx-x:hover{opacity:1;background:#273145!important}',
      '.ljx-l{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:3px 0}',
      '.ljx-l span{flex:1;font-size:12px;opacity:.9}',
      '.ljx input{width:62px;background:#0b0e14;color:#e6e9ef;border:1px solid #3a4152;',
      'border-radius:5px;padding:3px 5px;font:12px system-ui,sans-serif;text-align:right}',
      '.ljx button{width:100%;margin-top:8px;background:#1d2534;color:#e6e9ef;',
      'border:1px solid #3a4152;border-radius:6px;padding:7px;font:13px system-ui,sans-serif;',
      'cursor:pointer}',
      '.ljx button:hover{background:#273145}',
      '.ljx-sep{margin:11px 0 5px;border-top:1px solid #2a3140;padding-top:8px;font-size:11px;',
      'opacity:.65;text-transform:uppercase;letter-spacing:.6px}',
      '.ljx-status{margin-top:9px;font-size:11.5px;opacity:.8;min-height:15px;line-height:1.35}',
    ].join('');

    /**
     * Arrastar pela barra, e a posicao sobrevive ao F5.
     *
     * Guarda-se esquerda/topo e nao direita/baixo porque o painel passa a ser posicionado pelo
     * canto que o utilizador escolheu; e na hora de aplicar confere-se que ainda cabe na tela,
     * senao um painel largado na borda de um monitor grande some no monitor pequeno.
     */
    function arrastarPor(alca) {
      let solto = null;
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
        solto = () => {
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
      return l;
    };

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
      const fechar = document.createElement('button');
      fechar.className = 'ljx-x';
      fechar.textContent = '×';
      fechar.title = 'Esconder (Alt+L traz de volta)';
      fechar.addEventListener('click', () => mostrar(false));
      barra.append(titulo, fechar);
      painel.appendChild(barra);
      arrastarPor(barra);

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
        painel.appendChild(linhaDoPainel(nome, campo));
      }

      const sep = document.createElement('div');
      sep.className = 'ljx-sep';
      sep.textContent = `Venda · protege ${PROTEGIDAS.join(', ')}`;
      painel.appendChild(sep);

      const cTeto = campoNumero(cfg.tetoVenda);
      cTeto.min = '1';
      cTeto.addEventListener('change', () => {
        cfg.tetoVenda = Math.max(1, parseInt(cTeto.value, 10) || TETO_VENDA_PADRAO);
        cTeto.value = String(cfg.tetoVenda);
        gravar();
      });
      // "quantos de uma vez", nao IV: e' um limite de QUANTIDADE, a ultima trava antes do clique
      // que nao volta. Se a selecao vier maior do que isto, algo mudou e nao se vende.
      cTeto.title = 'Quantos pokémon no máximo por rodada. Não é IV: é quantidade.';
      painel.appendChild(linhaDoPainel('Máx. por vez (qtd)', cTeto));

      const btVender = document.createElement('button');
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
        c.rodar(venderAgora, comprar, diz);
      });
      painel.appendChild(btCiclo);

      const sepAg = document.createElement('div');
      sepAg.className = 'ljx-sep';
      sepAg.textContent = 'Quando rodar sozinho';
      painel.appendChild(sepAg);

      const editor = globalThis.PPX?.ciclo?.controlesDaAgenda?.((txt) => diz(`Agenda: ${txt}`));
      if (editor) painel.appendChild(editor.el);
      else {
        const semAgenda = document.createElement('div');
        semAgenda.className = 'ljx-status';
        semAgenda.textContent = 'Agenda indisponível (módulo do ciclo fora do ar).';
        painel.appendChild(semAgenda);
      }

      const status = document.createElement('div');
      status.className = 'ljx-status';
      painel.appendChild(status);

      document.body.appendChild(painel);
      aplicarPosicao();
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
    async function venderAgora(aviso = () => {}) {
      if (!janela()) return 'Loja fechada: nao vendi.';
      const r = await prepararVenda(aviso);
      if (!r.ok) return `Venda parada: ${r.motivo}. Nada foi vendido.`;
      if (r.total > cfg.tetoVenda)
        return `${r.total} selecionados, acima do teto de ${cfg.tetoVenda}. Nao vendi.`;

      const bt = [...janela().querySelectorAll('button')].find((x) =>
        /^Vender\s*\(/.test((x.textContent || '').trim()),
      );
      if (!bt) return 'Nao achei o botao de vender.';
      const rotulo = bt.textContent.trim();
      bt.click();
      await esperar(1200);

      const conf = await confirmar(r.total);
      if (conf.cancelou) return conf.motivo;
      return `Vendidos: ${rotulo.replace(/^Vender\s*/, '')}`;
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

      const texto = caixa.innerText || '';
      const achado = texto.match(/(\d+)\s*linha/);
      const diz = achado ? parseInt(achado[1], 10) : null;

      const botao = (re) => [...caixa.querySelectorAll('button')].find((b) => re.test(b.textContent));
      const cancelar = botao(/Cancelar/i);
      const seguir = botao(/Vender mesmo assim|Confirmar/i);

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
        if (r.total > cfg.tetoVenda) {
          diz(`${r.total} selecionados, acima do teto de ${cfg.tetoVenda}. Confira antes.`);
          return;
        }
        diz(`${r.total} prontos, nenhum protegido marcado. Clique em Vender no jogo.`);
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
      if (visivel) montar().style.display = 'block';
      else if (painel) painel.style.display = 'none';
      globalThis.PPX?.anotar?.('loja', visivel);
    }

    addEventListener(
      'keydown',
      (e) => {
        if (!e.altKey || e.ctrlKey || e.shiftKey) return;
        if (e.key.toLowerCase() !== 'l') return;
        // Campo de texto nao dispara atalho: o jogo tem chat, e um "l" ali nao e' um comando.
        const alvo = e.target;
        if (alvo && (alvo.isContentEditable || /^(input|textarea|select)$/i.test(alvo.tagName)))
          return;
        e.preventDefault();
        e.stopPropagation();
        mostrar(!visivel);
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
    globalThis.PPX.loja = { comprar, prepararVenda, auditar, venderAgora, cfg, ITENS };

    // Exposto so para a banca de testes, que executa este arquivo com um DOM de mentira.
    if (typeof module !== 'undefined' && module.exports)
      module.exports = { comprar, prepararVenda, auditar, venderAgora, cfg };
  },
);
