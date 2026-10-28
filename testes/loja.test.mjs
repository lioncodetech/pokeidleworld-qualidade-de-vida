// Guardas da Loja do Mark.
//
// O teste executa o modulo de verdade contra um DOM de mentira com a forma medida na loja em
// 09/10/2026: `.mks-row` com `.mks-name`, `.mks-price`, `.mks-buy`, `.mks-check` e `.mks-meta`
// ("Nv 1 · Comum · IV 137"), `.nsh-gold` no cabecalho, `.mks-fgrade` nos filtros e um botao
// "Vender (N) · …". Um guarda que so lesse o texto do arquivo passaria mesmo que a ferramenta
// vendesse um lendario.
//
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { casadoresDeRotulo } from './nucleo-de-mentira.mjs';

const fonte = readFileSync(new URL('../loja.js', import.meta.url), 'utf8');

/** Um no de mentira: so o que o modulo toca. */
function no(cls, texto = '', extras = {}) {
  return {
    className: cls,
    textContent: texto,
    // `innerText` tambem: o modulo le o popup por `innerText`, como no DOM real. Um fake so' com
    // `textContent` faz o guarda do popup passar por engano, pelo motivo errado.
    innerText: texto,
    disabled: false,
    checked: false,
    dataset: {},
    filhos: [],
    cliques: 0,
    click() {
      this.cliques += 1;
      if (this.aoClicar) this.aoClicar();
    },
    querySelector(sel) {
      return this.filhos.find((f) => casa(f, sel)) || null;
    },
    querySelectorAll(sel) {
      return this.filhos.filter((f) => casa(f, sel));
    },
    ...extras,
  };
}

// O jogo tem seletor de idioma, e a mesma loja tem de dar o mesmo resultado em qualquer um.
const EM = {
  pt: {
    // Medido na Loja do Mark em 28/10/2026. A aba "🎒 Itens" NAO existe mais: os itens
    // vendem-se na de Vender, e "↩️ Recompra" e' nova. A banca segue o jogo de hoje, senao o
    // guarda defenderia uma loja que ja' nao existe.
    abas: ['🛒 Comprar', '💰 Vender', '🐾 Pokémon', '↩️ Recompra'],
    grades: ['Fraca', 'Comum', 'Rara', 'Lendária', 'Mítica', 'Anciã', 'Divina'],
    vender: 'Vender',
    selecionarTudo: 'Selecionar tudo',
    desmarcarTudo: 'Desmarcar tudo',
    cancelar: 'Cancelar',
    venderMesmoAssim: 'Vender mesmo assim',
    linhas: 'linha(s)',
  },
  en: {
    abas: ['🛒 Buy', '💰 Sell', '🐾 Pokémon', '↩️ Buyback'],
    grades: ['Weak', 'Common', 'Rare', 'Legendary', 'Mythic', 'Ancient', 'Divine'],
    vender: 'Sell',
    selecionarTudo: 'Select all',
    desmarcarTudo: 'Deselect all',
    cancelar: 'Cancel',
    venderMesmoAssim: 'Sell anyway',
    linhas: 'line(s)',
  },
};

const casa = (n, sel) => {
  if (sel === 'button') return n.ehBotao === true;
  return String(n.className)
    .split(/\s+/)
    .includes(sel.replace(/^\./, ''));
};

/**
 * @param linhas [{nome, preco, grade}] — grade entra no texto de `.mks-meta`, como no jogo.
 */
function montarLoja({
  dinheiro = 1000,
  linhas = [],
  contagemDoJogo = null,
  filtroTrava = false,
  // o popup medido em 09/10/2026: `.mk-sellconfirm`, "Cancelar" e "Vender mesmo assim".
  // `popupDiz` e' quantos ELE declara; null nenhum popup (o jogo faz isso com 1 selecionado).
  popupDiz = 'igual',
  // A mochila do jogo: `{ 'Ultra Ball': 120 }`. Um item que nao esta' aqui nao aparece na
  // mochila — e no jogo isso quer dizer zero, nao "nao sei". `'9999+'` e' o numero truncado.
  mochila = null,
  semInventario = false,
  // A barra de quantidade medida na loja em 13/10/2026: `.nsh-num` e `.nsh-range`, de 1 a
  // `tetoDaBarra`. `semBarra` e' a loja antiga, sem ela. `barraTeimosa` e' o caso que custou
  // caro: a loja fica em 1 por mais que se escreva.
  semBarra = false,
  barraTeimosa = false,
  tetoDaBarra = 10000,
  tooltipDinamico = {},
  // O tooltip nao some ao sair de cima: serve para provar que a leitura recusa o tooltip do
  // item anterior em vez de aceitar o numero dele.
  dicaAtualFica = false,
  // Em que lingua o jogo esta': 'pt' ou 'en'. Os textos sairam do dicionario do proprio jogo.
  lingua = 'pt',
  // A lista virtual, medida em 28/10/2026: com 288 pokemon a vender so' existiam 12 `.mks-row`
  // no DOM, e a rolagem e' que dizia quais. `null` e' a lista inteira desenhada, que e' o que
  // acontece quando ela cabe — 67 itens, 67 linhas.
  porPagina = null,
} = {}) {
  const L = EM[lingua];
  const compras = [];
  const janela = no('mks-window');
  let saldo = dinheiro;

  const ouro = no('nsh-gold', `💲 ${saldo}`);
  const atualizarOuro = () => {
    ouro.textContent = `💲 ${saldo}`;
  };
  janela.filhos.push(ouro);

  // As abas sao de verdade: clicar troca a lista. Sem isto a banca tinha uma lista so' para
  // todas elas, e um item protegido aparecia na passagem dos pokemon — onde a protecao que vale
  // e' a da grade, nao a do nome.
  let abaAtiva = L.abas[2]; // a de Pokémon, que e' onde a venda comeca
  for (const rot of L.abas) {
    const t = no('nsh-tab', rot);
    Object.defineProperty(t, 'className', {
      get: () => (rot === abaAtiva ? 'nsh-tab on' : 'nsh-tab'),
    });
    t.ehBotao = true;
    t.aoClicar = () => {
      abaAtiva = rot;
    };
    janela.filhos.push(t);
  }
  /** Em que aba esta': 'Pokémon' ou 'Itens', com o nome interno do modulo. */
  const ondeEstou = () => (abaAtiva === L.abas[2] ? 'Pokémon' : 'Itens');

  for (const g of L.grades) {
    const b = no('mks-fgrade on', g);
    b.ehBotao = true;
    b.aoClicar = () => {
      if (!filtroTrava) b.className = 'mks-fgrade';
    };
    janela.filhos.push(b);
  }

  const todasAsLinhas = [];
  for (const l of linhas) {
    const linha = no('mks-row');
    const nome = no('mks-name', l.nome);
    const preco = no('mks-price', `💲${l.preco || 0}`);
    const meta = no('mks-meta', `Nv 1 · ${l.grade || 'Comum'} · IV 100`);
    const check = no('mks-check');
    check.aoClicar = () => {
      check.checked = !check.checked;
    };
    // A barra de quantidade. O campo prende o que recebe entre 1 e o teto e devolve 1 a tudo o
    // que nao entende — foi isto que se mediu no jogo, e e' o que faz a conferencia valer.
    const campo = no('nsh-num');
    const barra = no('nsh-range');
    campo.max = String(tetoDaBarra);
    barra.max = String(tetoDaBarra);
    let escolhida = 1;
    const prender = (v) => {
      const n = parseInt(v, 10);
      if (!Number.isFinite(n) || n < 1) return 1;
      return Math.min(n, tetoDaBarra);
    };
    for (const alvo of [campo, barra])
      Object.defineProperty(alvo, 'value', {
        get: () => String(escolhida),
        set(v) {
          escolhida = barraTeimosa ? 1 : prender(v);
        },
      });
    campo.dispatchEvent = () => {};
    barra.dispatchEvent = () => {};

    const comprar = no('nsh-btn mks-buy', 'Comprar');
    comprar.ehBotao = true;
    comprar.aoClicar = () => {
      const pedidas = semBarra ? 1 : prender(campo.value);
      const preco1 = l.preco || 0;
      const cabem = preco1 > 0 ? Math.min(pedidas, Math.floor(saldo / preco1)) : pedidas;
      if (cabem < 1) return;
      if (!l.naoDebita) saldo -= preco1 * cabem;
      for (let i = 0; i < cabem; i += 1) compras.push(l.nome);
      // O que se compra entra na mochila: e' la' que a conferencia do fim vai olhar.
      if (sacola && typeof sacola[l.nome] === 'number') sacola[l.nome] += cabem;
      else if (sacola && typeof sacola[l.nome]?.exato === 'number') {
        sacola[l.nome].exato += cabem;
        sacola[l.nome].title = `Quantidade: ${sacola[l.nome].exato}`;
      }
      else if (sacola && !(l.nome in sacola)) sacola[l.nome] = cabem;
      atualizarOuro();
    };
    linha.filhos.push(nome, preco, meta, check, comprar);
    if (!semBarra) linha.filhos.push(campo, barra);
    linha.quantidadeNaTela = () => escolhida;
    linha.botaoComprar = comprar;
    linha.marcar = (v) => {
      check.checked = v;
    };
    linha.aba = l.aba || null;
    janela.filhos.push(linha);
    todasAsLinhas.push(linha);
  }

  // --- a lista virtual -----------------------------------------------------------------------
  //
  // Medido em 28/10/2026: a caixa e' `.win-body.nsh-well.mks-list`, com 347 px visiveis para
  // 17600 px de rolagem e ~61 px por linha. Rolar troca as linhas desenhadas; a selecao do que
  // saiu da tela fica guardada do lado do jogo.
  const ALTURA_DA_LINHA = 61;
  // Uma linha sem `aba` mora em todas — e' o que a maioria dos testes quer. Quem declara `aba`
  // so' aparece na dela, como no jogo.
  const vivas = () =>
    todasAsLinhas.filter((l) => !l.vendida && (!l.aba || l.aba === ondeEstou()));
  const caixa = no('win-body nsh-well mks-list');
  caixa.scrollTop = 0;
  Object.defineProperty(caixa, 'scrollHeight', {
    get: () => vivas().length * ALTURA_DA_LINHA,
  });
  Object.defineProperty(caixa, 'clientHeight', {
    get: () => (porPagina || vivas().length) * ALTURA_DA_LINHA,
  });
  for (const l of todasAsLinhas) l.parentElement = caixa;

  const naTela = () => {
    const todas = vivas();
    if (!porPagina) return todas;
    const i = Math.floor(caixa.scrollTop / ALTURA_DA_LINHA);
    return todas.slice(i, i + porPagina);
  };

  // `.mks-row` passa a responder pela tela, e nao pela lista toda — e' essa a diferenca que o
  // modulo tem de aguentar. Tudo o resto continua a procurar nos filhos como antes.
  const qsaDaJanela = janela.querySelectorAll.bind(janela);
  const qsDaJanela = janela.querySelector.bind(janela);
  janela.querySelectorAll = (sel) => (sel === '.mks-row' ? naTela() : qsaDaJanela(sel));
  janela.querySelector = (sel) => (sel === '.mks-row' ? naTela()[0] || null : qsDaJanela(sel));

  /** Vende o que estiver marcado — inclusive o que a tela nao mostra, como o jogo faz. */
  const consumarVenda = () => {
    for (const l of vivas())
      if (l.querySelector('.mks-check').checked) {
        l.vendida = true;
        l.marcar(false);
      }
  };

  // O botao que marca e desmarca e' UM so', e troca de nome: "☐ Selecionar tudo" com nada
  // marcado, "☑ Desmarcar tudo" com algo marcado. Medido assim, e e' o que torna possivel
  // limpar uma selecao que esta' fora da tela.
  const btSelecionar = no('', '');
  btSelecionar.ehBotao = true;
  const algoMarcado = () => vivas().some((l) => l.querySelector('.mks-check').checked);
  Object.defineProperty(btSelecionar, 'textContent', {
    get: () => (algoMarcado() ? `☑ ${L.desmarcarTudo}` : `☐ ${L.selecionarTudo}`),
  });
  btSelecionar.aoClicar = () => {
    const marcar = !algoMarcado();
    for (const l of vivas()) l.marcar(marcar);
  };
  janela.filhos.push(btSelecionar);

  let popup = null;
  const confirmados = [];
  const cancelados = [];

  const btVender = no('', L.vender);
  btVender.ehBotao = true;
  btVender.aoClicar = () => {
    if (popupDiz === null) {
      // venda direta, sem confirmacao
      consumarVenda();
      return;
    }
    const n =
      popupDiz === 'igual'
        ? vivas().filter((l) => l.querySelector('.mks-check').checked).length
        : popupDiz;
    // 'mudo' = o jogo reescreveu o aviso e deixou de dizer quantos sao
    const aviso =
      popupDiz === 'mudo'
        ? '⚠️ CONFIRMAR VENDA DE POKÉMON\nConfira antes de prosseguir.'
        : `⚠️ CONFIRMAR VENDA DE POKÉMON\nVocê selecionou TUDO: ${n} ${L.linhas}, por 💲${n * 18000}.`;
    popup = no('mk-sellconfirm', aviso);
    const bc = no('nsh-btn nsh-btn-alt', L.cancelar);
    bc.ehBotao = true;
    bc.aoClicar = () => {
      cancelados.push(n);
      popup = null;
    };
    const bs = no('nsh-btn', L.venderMesmoAssim);
    bs.ehBotao = true;
    bs.aoClicar = () => {
      confirmados.push(n);
      consumarVenda();
      popup = null;
    };
    popup.filhos.push(bc, bs);
  };
  Object.defineProperty(btVender, 'textContent', {
    get() {
      // Conta TUDO o que esta' marcado, veja-se ou nao: e' isso que o jogo faz, e e' por isso
      // que a conferencia cruzada tem de valer por pagina.
      //
      // Sem nada marcado o botao nao traz numero nenhum — medido: com zero selecionados ele le'
      // so' "Vender". `contagemDoJogo` forca o numero para o caso em que o jogo e a tela
      // discordam, mas so' depois de haver alguma coisa marcada: um numero que nao desce nem
      // com tudo desmarcado seria outra avaria, nao esta.
      const marcados = vivas().filter((l) => l.querySelector('.mks-check').checked).length;
      const n = contagemDoJogo !== null ? contagemDoJogo : marcados;
      if (!marcados || !n) return L.vender;
      return `${L.vender} (${n}) · 💲${n * 100}`;
    },
  });
  janela.filhos.push(btVender);

  // --- a mochila -----------------------------------------------------------------------------
  //
  // Medido: `.inv-window` com `.inv-slot`, o nome no `alt` da imagem e a quantidade em
  // `.inv-qty`. O item que nao existe nao tem slot nenhum, e `9999+` e' o truncado do jogo.
  const sacola = mochila ? { ...mochila } : null;
  let invAberto = false;
  let aberturasDoInv = 0;

  const btInv = no('', '');
  btInv.title = 'Inventário';
  btInv.ehBotao = true;
  btInv.aoClicar = () => {
    invAberto = true;
    aberturasDoInv += 1;
  };

  const fecharInv = no('nsh-x', '×');
  fecharInv.ehBotao = true;
  fecharInv.aoClicar = () => {
    invAberto = false;
    slotsCache = null;
  };
  const janelaInv = no('inv-window', '');
  janelaInv.filhos.push(fecharInv);

  let observadorTooltip = null;
  class ObservadorTooltip {
    constructor(fn) { this.fn = fn; }
    observe() { observadorTooltip = this; }
    disconnect() { if (observadorTooltip === this) observadorTooltip = null; }
  }
  class EventoMouse { constructor(type) { this.type = type; } }

  /**
   * O tooltip do inventario, com a forma que ele tem no jogo — medida em 27/10/2026:
   *
   *     <div class="inv-tip">
   *       <div class="inv-tip-name">Dome Fossil ×31</div>
   *       <div class="inv-tip-qty">×31</div>
   *
   * Ha' **um so'** para o inventario inteiro, e ele some ao sair de cima do slot. E' por isso que
   * a leitura tem de conferir o nome: um tooltip ainda aberto e' do item anterior.
   */
  let dicaAtual = null;
  const montarDica = (nome, quantos) => {
    const d = no('inv-tip', `${nome} ×${quantos}`);
    d.filhos.push(no('inv-tip-name', `${nome} ×${quantos}`), no('inv-tip-qty', `×${quantos}`));
    return d;
  };

  let slotsCache = null;
  const slots = () => {
    if (!sacola) return [];
    if (slotsCache) return slotsCache;
    slotsCache = Object.entries(sacola)
      .filter(([, q]) => q !== 0)
      .map(([nome, q]) => {
        const s = no('inv-slot', '');
        const valor = typeof q === 'object' ? q : { texto: q };
        const qty = no('inv-qty', String(valor.texto), { title: valor.title || '' });
        s.filhos.push(qty);
        s.getBoundingClientRect = () => ({ x: 0, y: 0, width: 40, height: 40 });
        s.dispatchEvent = (ev) => {
          const exato = tooltipDinamico[nome];
          if (ev.type === 'mouseover' && exato) dicaAtual = montarDica(nome, exato);
          // Sair de cima apaga o tooltip, como no jogo: sem isto, o do item anterior ficava a
          // responder pelo seguinte, que e' precisamente o engano que a leitura tem de recusar.
          if (ev.type === 'mouseout' && !dicaAtualFica) dicaAtual = null;
        };
        s.querySelector = (sel) =>
          sel === 'img' ? { alt: nome } : sel === '.inv-qty' ? qty : null;
        return s;
      });
    return slotsCache;
  };

  const doc = {
    querySelector: (sel) => {
      if (sel === '.mk-sellconfirm') return popup;
      if (sel === '.inv-tip') return dicaAtual;
      if (sel === '.inv-window') return invAberto ? janelaInv : null;
      return casa(janela, sel) ? janela : janela.querySelector(sel);
    },
    querySelectorAll: (sel) => {
      if (sel === '.inv-slot') return invAberto ? slots() : [];
      if (sel === 'button') return semInventario ? [] : [btInv];
      return [];
    },
    body: {
      appendChild(x) {
        oPainel = x;
        return x;
      },
    },
    head: { appendChild() {} },
    documentElement: { appendChild() {} },
    // O painel do modulo. Antes isto devolvia um no' cego — sem `classList`, sem filhos e sem
    // ouvintes —, e por isso nada do painel era testavel: o minimizar da Loja chegou a nascer
    // sem guarda nenhuma. Agora guarda o que o modulo lhe poe.
    createElement: () => {
      const e = no('');
      e.style = {};
      const classes = new Set();
      e.classList = {
        add: (c) => classes.add(c),
        remove: (c) => classes.delete(c),
        contains: (c) => classes.has(c),
        toggle: (c, sim) => (sim === false || (sim === undefined && classes.has(c))
          ? classes.delete(c)
          : classes.add(c)),
      };
      e.classes = classes;
      e.ouvintes = {};
      e.addEventListener = (tipo, fn) => {
        (e.ouvintes[tipo] = e.ouvintes[tipo] || []).push(fn);
      };
      e.appendChild = (x) => {
        e.filhos.push(x);
        return x;
      };
      e.append = (...xs) => e.filhos.push(...xs);
      // Procura em profundidade: a barra po-e os botoes dentro de um `div`.
      e.querySelector = (sel) => {
        for (const f of e.filhos) {
          if (casa(f, sel)) return f;
          const dentro = f.querySelector?.(sel);
          if (dentro) return dentro;
        }
        return null;
      };
      return e;
    },
  };
  let oPainel = null;

  const PPX = {
    modulo: (meta, fn) => fn(),
    anotar: () => {},
    controlar: () => {},
    vez: { pedir: async () => () => {} },
  };
  // Os casadores de rotulo do nucleo DE VERDADE: sem eles este fake caia sempre para o texto
  // portugues escrito a mao, e o caminho que o jogo em ingles usa ficava sem guarda.
  Object.assign(PPX, casadoresDeRotulo({ querySelectorAll: (s) => doc.querySelectorAll(s) }));
  globalThis.PPX = PPX;

  const guardado = {};
  const mod = { exports: {} };
  const executar = new Function(
    'PPX',
    'document',
    'localStorage',
    'setTimeout',
    'addEventListener',
    'MutationObserver',
    'MouseEvent',
    'module',
    fonte,
  );
  executar(
    PPX,
    doc,
    {
      getItem: (k) => guardado[k] ?? null,
      setItem: (k, v) => {
        guardado[k] = v;
      },
    },
    (fn, ms) => globalThis.setTimeout(fn, Math.min(ms, 1)),
    () => {},
    ObservadorTooltip,
    EventoMouse,
    mod,
  );

  return {
    api: mod.exports,
    painel: () => oPainel,
    // O que ficou gravado: "lembra o modo" nao se mede no objeto em memoria.
    guardado: () => JSON.parse(guardado['lioncode:pokeidleworld:loja:cfg'] || '{}'),
    compras,
    linhas: todasAsLinhas,
    saldo: () => saldo,
    mochila: () => (sacola ? { ...sacola } : null),
    // Quantas vezes o inventario foi aberto: a conta antiga abria duas vezes por item.
    aberturasDoInv: () => aberturasDoInv,
    // Se ficou aberto: a mochila por cima do jogo estorva quem joga e quem automatiza.
    invAberto: () => invAberto,
    btVender,
    /** Os botoes de filtro de grade, para conferir quais ficaram ligados. */
    filtrosDeGrade: () => janela.filhos.filter((b) => String(b.className).includes('mks-fgrade')),
    marcados: () => vivas().filter((l) => l.querySelector('.mks-check').checked).length,
    /** O que saiu da lista por venda — e' aqui que se ve se a venda por paginas chegou ao fim. */
    vendidas: () => todasAsLinhas.filter((l) => l.vendida).length,
    rolar: (y) => {
      caixa.scrollTop = y;
    },
    naTela: () => janela.querySelectorAll('.mks-row').length,
    confirmados,
    cancelados,
    popupAberto: () => !!popup,
  };
}

const COMUM = [
  { nome: 'Ultra Ball', preco: 130, grade: 'Comum' },
  { nome: 'Small Potion', preco: 5, grade: 'Comum' },
];

test('compra exatamente a quantidade pedida, num clique so', async () => {
  const p = montarLoja({ dinheiro: 100000, linhas: COMUM });
  const r = await p.api.comprar('Ultra Ball', 5);
  assert.equal(r.comprou, 5);
  assert.equal(p.compras.filter((c) => c === 'Ultra Ball').length, 5);
  // Cinco unidades sao um pedido, nao cinco. Um clique por unidade e' o que fazia o jogo
  // deixar de acompanhar e um pedido de 10.000 acabar em 10.
  assert.equal(p.linhas[0].botaoComprar.cliques, 1);
  assert.equal(p.linhas[0].quantidadeNaTela(), 5);
});

test('pedido maior que o teto da barra sai em lotes do tamanho do teto', async () => {
  const p = montarLoja({ dinheiro: 100000000, linhas: COMUM, tetoDaBarra: 1000 });
  const r = await p.api.comprar('Ultra Ball', 2500);
  assert.equal(r.comprou, 2500);
  assert.equal(p.compras.filter((c) => c === 'Ultra Ball').length, 2500);
  // 1000 + 1000 + 500: tres cliques, e nao 2500.
  assert.equal(p.linhas[0].botaoComprar.cliques, 3);
});

test('a loja que nao aceita a quantidade nao leva clique nenhum', async () => {
  // O caso real: escreve-se 10.000 e a barra fica em 1. Clicar ali compra 1 a pensar que
  // comprou 10.000 — e e' exactamente o que acontecia.
  const p = montarLoja({ dinheiro: 100000000, linhas: COMUM, barraTeimosa: true });
  const r = await p.api.comprar('Ultra Ball', 10000);
  assert.equal(r.comprou, 0);
  assert.equal(p.linhas[0].botaoComprar.cliques, 0);
  assert.equal(p.compras.length, 0);
  assert.match(r.motivo, /pedi 10000 e a loja ficou em 1/);
});

test('loja sem barra de quantidade compra uma por clique, e nao as cegas', async () => {
  const p = montarLoja({ dinheiro: 100000, linhas: COMUM, semBarra: true });
  const r = await p.api.comprar('Ultra Ball', 4);
  assert.equal(r.comprou, 4);
  assert.equal(p.linhas[0].botaoComprar.cliques, 4);
});

test('quem diz quanto entrou e o debito, e nao o pedido', async () => {
  // A loja so' tem dinheiro para 7, mas aceita o pedido de 20: o jogo vende 7 e debita 7.
  const p = montarLoja({ dinheiro: 7 * 130, linhas: COMUM });
  const r = await p.api.comprar('Ultra Ball', 20);
  assert.equal(r.comprou, 7);
  assert.equal(r.motivo, 'dinheiro acabou');
});

test('para quando o dinheiro acaba, em vez de martelar', async () => {
  // 300 compra duas Ultra Ball (130 cada) e nao a terceira.
  const p = montarLoja({ dinheiro: 300, linhas: COMUM });
  const r = await p.api.comprar('Ultra Ball', 10);
  assert.equal(r.comprou, 2);
  assert.equal(r.motivo, 'dinheiro acabou');
});

test('para quando o jogo deixa de debitar', async () => {
  // Saldo que nao cai e o caminho mais curto para comprar mil do que nao se queria.
  const p = montarLoja({
    dinheiro: 100000,
    linhas: [{ nome: 'Ultra Ball', preco: 130, grade: 'Comum', naoDebita: true }],
  });
  const r = await p.api.comprar('Ultra Ball', 50);
  assert.equal(r.motivo, 'o jogo parou de debitar');
  const cliques = p.linhas[0].botaoComprar.cliques;
  assert.ok(cliques <= 3, `parou cedo, e nao em ${cliques} cliques`);
  assert.equal(r.comprou, 0);
});

test('venda: nao segue com um lendario marcado', async () => {
  // O filtro "funciona" (os botoes desligam), mas a lista nao se atualiza — exatamente o caso
  // de lentidao que motivou esta ferramenta. A auditoria le a linha, nao o filtro.
  const p = montarLoja({
    dinheiro: 1000,
    linhas: [
      { nome: 'Venusaur', preco: 18000, grade: 'Comum' },
      { nome: 'Mewtwo', preco: 99000, grade: 'Lendária' },
    ],
  });
  // o desmarcar automatico resolve; forco o caso mau travando o checkbox do lendario
  p.linhas[1].querySelector('.mks-check').aoClicar = () => {};
  p.linhas[1].querySelector('.mks-check').checked = true;
  const r = await p.api.prepararVenda(() => {});
  assert.equal(r.ok, false);
  assert.match(r.motivo, /Mewtwo/);
  assert.match(r.motivo, /Lendária/);
});

test('venda: desmarca o protegido sozinho e segue com o resto', async () => {
  const p = montarLoja({
    dinheiro: 1000,
    linhas: [
      { nome: 'Venusaur', preco: 18000, grade: 'Comum' },
      { nome: 'Mewtwo', preco: 99000, grade: 'Lendária' },
    ],
  });
  const r = await p.api.prepararVenda(() => {});
  assert.equal(r.ok, true);
  assert.equal(r.total, 1, 'so o comum ficou marcado');
});

test('venda de itens: desmarca somente a lista protegida e deixa o restante', async () => {
  const protegidos = [
    'Poke Card Pack',
    'Bronze Dimensional KEY',
    'Devoted Token',
    'Strange Pheromone',
    'Shiny Charizard Card',
    'Rare Pokemon Picture',
    'Bronze Boss Token',
    'Legendary Golden Ticket',
  ];
  const p = montarLoja({
    linhas: [...protegidos.map((nome) => ({ nome })), { nome: 'Bone' }, { nome: 'Bag of Pollen' }],
  });

  const r = await p.api.prepararVenda(() => {}, 'Itens');

  assert.equal(r.ok, true);
  assert.equal(r.total, 2, 'somente os dois itens comuns ficaram marcados');
  assert.deepEqual(
    p.linhas.filter((l) => l.querySelector('.mks-check').checked)
      .map((l) => l.querySelector('.mks-name').textContent),
    ['Bone', 'Bag of Pollen'],
  );
});

test('venda: para se a conta do jogo nao bate com a da tela', async () => {
  // O rotulo diz 9, o DOM mostra 1: alguem esta vendo uma lista que o outro nao ve.
  const p = montarLoja({
    dinheiro: 1000,
    linhas: [{ nome: 'Venusaur', preco: 18000, grade: 'Comum' }],
    contagemDoJogo: 9,
  });
  const r = await p.api.prepararVenda(() => {});
  assert.equal(r.ok, false);
  assert.match(r.motivo, /conta 9/);
});

test('venda: para se o filtro de grade nao desliga', async () => {
  const p = montarLoja({
    dinheiro: 1000,
    linhas: [{ nome: 'Venusaur', preco: 18000, grade: 'Comum' }],
    filtroTrava: true,
  });
  const r = await p.api.prepararVenda(() => {});
  assert.equal(r.ok, false);
  assert.match(r.motivo, /filtro nao desligou/);
});

test('venda: nunca clica no botao Vender do jogo', async () => {
  // O guarda central: a ferramenta prepara e para. O clique final e do usuario.
  const p = montarLoja({
    dinheiro: 1000,
    linhas: [
      { nome: 'Venusaur', preco: 18000, grade: 'Comum' },
      { nome: 'Mewtwo', preco: 99000, grade: 'Lendária' },
    ],
  });
  await p.api.prepararVenda(() => {});
  assert.equal(p.btVender.cliques, 0, 'a ferramenta nao vende por conta propria');
});

// ---------------------------------------------------------------------------
// O popup de confirmacao. Medido em 09/10/2026, depois de uma venda acidental:
// com um pokemon so' a venda sai DIRETA, sem popup nenhum.

const DOIS_COMUNS_EN = [
  { nome: 'Venusaur', preco: 18000, grade: 'Common' },
  { nome: 'Ivysaur', preco: 18000, grade: 'Common' },
];

const DOIS_COMUNS = [
  { nome: 'Venusaur', preco: 18000, grade: 'Comum' },
  { nome: 'Ivysaur', preco: 18000, grade: 'Comum' },
];

test('confirma o popup quando a conta dele bate com a nossa', async () => {
  const p = montarLoja({ dinheiro: 1000, linhas: DOIS_COMUNS });
  const r = await p.api.venderAgora(() => {});
  assert.deepEqual(p.confirmados, [2], 'clicou em "Vender mesmo assim"');
  assert.deepEqual(p.cancelados, []);
  assert.match(r, /Vendidos/);
});

test('cancela quando o popup declara um numero diferente do auditado', async () => {
  // A terceira fonte de verdade: a lista, o rotulo do botao e o popup tem de concordar. Se o
  // popup fala em 68 e nos contamos 2, quem esta errado nao importa — nao se vende.
  const p = montarLoja({ dinheiro: 1000, linhas: DOIS_COMUNS, popupDiz: 68 });
  const r = await p.api.venderAgora(() => {});
  assert.deepEqual(p.confirmados, [], 'nao confirmou');
  assert.deepEqual(p.cancelados, [68], 'clicou em Cancelar');
  assert.match(r, /popup diz 68/);
});

test('o popup fica fechado depois, de um jeito ou de outro', async () => {
  const p = montarLoja({ dinheiro: 1000, linhas: DOIS_COMUNS, popupDiz: 99 });
  await p.api.venderAgora(() => {});
  assert.equal(p.popupAberto(), false, 'nao deixa um popup aberto por cima do jogo');
});

test('venda sem popup nao e tratada como erro', async () => {
  // Com um selecionado o jogo nao pergunta nada. A ausencia do popup e' um caso normal.
  const p = montarLoja({ dinheiro: 1000, linhas: DOIS_COMUNS, popupDiz: null });
  const r = await p.api.venderAgora(() => {});
  assert.match(r, /Vendidos/);
});

test('popup que nao diz quantos e motivo para cancelar, nao para seguir', async () => {
  // Se um dia o jogo reescrever o aviso e tirar o numero, perde-se a terceira fonte de verdade.
  // Sem numero para conferir, o certo e' parar — nao confirmar no escuro.
  const p = montarLoja({ dinheiro: 1000, linhas: DOIS_COMUNS, popupDiz: 'mudo' });
  const r = await p.api.venderAgora(() => {});
  assert.deepEqual(p.confirmados, [], 'nao confirmou no escuro');
  assert.equal(p.cancelados.length, 1, 'cancelou');
  assert.match(r, /nao disse quantos/);
});

// --------------------------------------------------------------- abastecer pela mochila

const LOJA_BOLAS = [
  { nome: 'Ultra Ball', preco: 10 },
  { nome: 'Great Potion', preco: 5 },
];

test('abastecer le a mochila, compra a diferenca e confere no fim', async () => {
  const p = montarLoja({
    dinheiro: 100000,
    linhas: LOJA_BOLAS,
    mochila: { 'Ultra Ball': 8, 'Great Potion': 20 },
  });
  p.api.cfg.tetos = { 'Ultra Ball': 10, 'Great Potion': 20 };
  p.api.cfg.variacao = 0;

  const r = await p.api.abastecer(() => {});

  assert.equal(p.mochila()['Ultra Ball'], 10, 'comprou ate o alvo');
  assert.equal(p.compras.filter((n) => n === 'Ultra Ball').length, 2);
  assert.deepEqual(r.comprados, { 'Ultra Ball': 2, 'Great Potion': 0 });
  assert.match(r.relato.join(' | '), /Ultra Ball: 8 → 10 \(\+2\), alvo 10/);
  assert.match(r.relato.join(' | '), /Great Potion: 20\/20, nada a comprar/);
});

test('abre o inventario duas vezes, e nao duas por item', async () => {
  // Antes o laco vivia no Ciclo e abria e fechava a mochila a cada item: dezoito aberturas
  // para nove itens. Uma no inicio para saber o que ha', outra no fim para dizer o que entrou.
  const p = montarLoja({
    dinheiro: 100000,
    linhas: LOJA_BOLAS,
    mochila: { 'Ultra Ball': 0, 'Great Potion': 0 },
  });
  p.api.cfg.tetos = { 'Ultra Ball': 3, 'Great Potion': 3 };
  p.api.cfg.variacao = 0;

  await p.api.abastecer(() => {});

  assert.equal(p.aberturasDoInv(), 2);
});

test('item que nao esta na mochila tem zero, nao "nao sei"', async () => {
  // Tratar "nao apareceu" como desconhecido faria justamente os itens acabados — os que mais
  // precisam de compra — serem os unicos nunca comprados.
  const p = montarLoja({ dinheiro: 100000, linhas: LOJA_BOLAS, mochila: { 'Great Potion': 5 } });
  p.api.cfg.tetos = { 'Ultra Ball': 4 };
  p.api.cfg.variacao = 0;

  await p.api.abastecer(() => {});

  assert.equal(p.compras.filter((n) => n === 'Ultra Ball').length, 4);
});

test('9999+ nao e numero: nao compra as cegas', async () => {
  const p = montarLoja({ dinheiro: 100000, linhas: LOJA_BOLAS, mochila: { 'Ultra Ball': '9999+' } });
  p.api.cfg.tetos = { 'Ultra Ball': 20000 };

  const r = await p.api.abastecer(() => {});

  assert.deepEqual(p.compras, []);
  assert.match(r.relato.join(' '), /já passa de 9999/);
});

test('9999+ usa a quantidade exata do tooltip para completar o alvo', async () => {
  const p = montarLoja({
    dinheiro: 100000,
    linhas: LOJA_BOLAS,
    mochila: { 'Ultra Ball': { texto: '9999+', title: 'Quantidade: 12.345', exato: 12345 } },
  });
  p.api.cfg.tetos = { 'Ultra Ball': 12350 };
  p.api.cfg.variacao = 0;

  const r = await p.api.abastecer();

  assert.equal(p.compras.filter((n) => n === 'Ultra Ball').length, 5);
  assert.match(r.relato.join(' '), /12345 → 12350 \(\+5\)/);
});

test('9999+ captura o tooltip que o jogo cria somente durante o hover', async () => {
  const p = montarLoja({
    dinheiro: 100000,
    linhas: LOJA_BOLAS,
    mochila: { 'Ultra Ball': { texto: '9999+', exato: 12345 } },
    tooltipDinamico: { 'Ultra Ball': 12345 },
  });
  p.api.cfg.tetos = { 'Ultra Ball': 12350 };
  p.api.cfg.variacao = 0;

  const r = await p.api.abastecer();

  assert.equal(p.compras.filter((n) => n === 'Ultra Ball').length, 5);
  assert.match(r.relato.join(' '), /12345 → 12350 \(\+5\)/);
});

test('o numero tem de vir do tooltip DAQUELE item, e nao de um que ficou aberto', async () => {
  // **O DEFEITO QUE ISTO GUARDA FOI APANHADO NA CONTA DO DONO EM 27/10/2026.** A leitura antiga
  // punha um MutationObserver em `document.body`, juntava todos os numeros >= 10000 que
  // aparecessem em qualquer sitio da pagina e ficava com o maior. A Ultra Ball apareceu com
  // 1784953486005109 e a Great Potion com 2045511 — que era o contador "2045847 itens" do
  // cabecalho do inventario, a subir sozinho com a cacada.
  //
  // E o estrago era mudo: numero enorme contra o alvo da' "alvo cheio", entao nao se comprava
  // nada e nao havia erro nenhum. Por isso aqui so' se aceita o tooltip que **diz o nome** do
  // item que esta' a ser lido.
  const p = montarLoja({
    dinheiro: 100000,
    linhas: LOJA_BOLAS,
    mochila: { 'Ultra Ball': { texto: '9999+' }, 'Great Ball': { texto: '9999+' } },
    // So' a Ultra Ball tem tooltip, e ele fica colado depois de sair de cima dela.
    tooltipDinamico: { 'Ultra Ball': 12345 },
    dicaAtualFica: true,
  });
  p.api.cfg.tetos = { 'Great Ball': 50 };
  p.api.cfg.variacao = 0;

  const r = await p.api.abastecer();
  const texto = r.relato.join(' ');

  // A Great Ball nao pode herdar o 12345 da Ultra Ball.
  assert.ok(!/12345/.test(texto), `o numero da Ultra Ball vazou para outro item: ${texto}`);
  assert.deepEqual(p.compras, [], 'sem saber quanto tem, nao se compra "a diferenca"');
  assert.match(texto, /Great Ball: já passa de 9999/);
});

test('sem tooltip nenhum, o 9999+ continua desconhecido em vez de virar um numero', () => {
  // Nao saber e' um estado honesto. O erro de antes nao era nao saber: era **inventar** a partir
  // do primeiro numero grande que passasse na tela.
  // Lido sem os comentarios: o proprio comentario do conserto fala no observador que saiu daqui,
  // e um guarda que casasse com ele reprovaria a explicacao em vez do codigo.
  const codigo = fonte
    .split('\n')
    .filter((linha) => !/^\s*(\/\/|\*|\/\*)/.test(linha))
    .join('\n');
  assert.ok(
    !/new MutationObserver/.test(codigo),
    'a leitura nao pode voltar a ouvir a pagina inteira a procura de numeros',
  );
  assert.ok(
    !/observe\(document\.body/.test(codigo),
    'ouvir o body inteiro foi exactamente o que leu o contador do inventario como se fosse o item',
  );
  assert.match(fonte, /\.inv-tip-name/);
  assert.match(fonte, /\.inv-tip-qty/);
  // E o nome confere-se ANTES de o numero ser aceite.
  assert.match(fonte, /soONome\(nomeNaDica\) === soONome\(nome\)/);
});

test('sem conseguir abrir a mochila, nao compra nada', async () => {
  // Sem saber quanto se tem, "ate' ter X" nao e' uma conta que se possa fazer — e chutar
  // compraria o alvo inteiro por cima do que ja' havia.
  const p = montarLoja({ dinheiro: 100000, linhas: LOJA_BOLAS, semInventario: true });
  p.api.cfg.tetos = { 'Ultra Ball': 50 };

  const r = await p.api.abastecer(() => {});

  assert.deepEqual(p.compras, []);
  assert.match(r.relato.join(' '), /Nao achei o inventário/);
});

test('a variacao sorteia o alvo dentro da margem', () => {
  // Sem ela a mochila termina sempre no mesmo numero redondo, compra apos compra — e um numero
  // que se repete ao milesimo e' a coisa mais facil de reconhecer. Aqui mede-se a conta, e nao
  // a compra: sortear mil alvos custa nada, comprar mil bolas custa a banca inteira.
  const p = montarLoja({ dinheiro: 1, linhas: LOJA_BOLAS });
  p.api.cfg.variacao = 10;
  const vistos = new Set();
  for (let i = 0; i < 300; i += 1) {
    const alvo = p.api.alvoDeAgora(20000);
    assert.ok(alvo >= 18000 && alvo <= 22000, `${alvo} fora da margem de 10%`);
    vistos.add(alvo);
  }
  assert.ok(vistos.size > 50, `so ${vistos.size} alvos diferentes em 300 sorteios`);

  p.api.cfg.variacao = 0;
  assert.equal(p.api.alvoDeAgora(20000), 20000, 'zero compra exatamente ate o alvo');
});

test('variacao zero compra exatamente o alvo', async () => {
  const p = montarLoja({ dinheiro: 100000, linhas: LOJA_BOLAS, mochila: { 'Ultra Ball': 0 } });
  p.api.cfg.tetos = { 'Ultra Ball': 30 };
  p.api.cfg.variacao = 0;

  await p.api.abastecer(() => {});

  assert.equal(p.mochila()['Ultra Ball'], 30);
});

// --- conferir a mochila ---------------------------------------------------------------------
//
// O botao que faltava. Sem ele, o numero ao lado de cada item so' aparecia depois de uma compra
// — e quem quer **decidir** o alvo precisa de ver o estoque antes de gastar.

test('conferir a mochila abre uma vez, le, fecha, e diz o que falta', async () => {
  const p = montarLoja({
    dinheiro: 100000,
    linhas: COMUM,
    mochila: { 'Ultra Ball': 8, 'Small Potion': 40 },
  });
  p.api.cfg.tetos = { 'Ultra Ball': 10, 'Small Potion': 40 };

  const frase = await p.api.conferirEstoque();

  assert.equal(frase, 'Mochila lida. Falta comprar: Ultra Ball 2.');
  assert.equal(p.aberturasDoInv(), 1, 'abriu o inventário mais de uma vez');
  assert.equal(p.invAberto(), false, 'deixou a mochila aberta por cima do jogo');
  // Conferir nao compra: o botao e' para ver, e ver nao gasta.
  assert.deepEqual(p.compras, []);
  assert.deepEqual(p.mochila(), { 'Ultra Ball': 8, 'Small Potion': 40 });
});

test('item que nao esta na mochila conta como zero, nao como desconhecido', async () => {
  // E' o caso que mais importa: o item acabado nao tem slot nenhum. Tratar "nao apareceu" como
  // "nao sei" faria justamente o que falta ser o unico que nunca entra na conta.
  const p = montarLoja({ dinheiro: 100000, linhas: COMUM, mochila: { 'Small Potion': 1 } });
  p.api.cfg.tetos = { 'Ultra Ball': 10 };

  assert.equal(await p.api.conferirEstoque(), 'Mochila lida. Falta comprar: Ultra Ball 10.');
});

test('o 9999+ do jogo nao entra na conta do que falta', async () => {
  const p = montarLoja({ dinheiro: 100000, linhas: COMUM, mochila: { 'Ultra Ball': '9999+' } });
  p.api.cfg.tetos = { 'Ultra Ball': 20000 };

  assert.equal(await p.api.conferirEstoque(), 'Mochila lida. Todos os alvos estao cheios.');
});

test('sem alvo nenhum, conferir ainda le a mochila e diz-se', async () => {
  const p = montarLoja({ dinheiro: 100000, linhas: COMUM, mochila: { 'Ultra Ball': 3 } });
  p.api.cfg.tetos = {};

  assert.equal(await p.api.conferirEstoque(), 'Mochila lida. Nenhum alvo de estoque definido.');
  assert.equal(p.aberturasDoInv(), 1);
});

test('sem botao de inventario, diz que nao achou em vez de calar', async () => {
  const p = montarLoja({ linhas: COMUM, mochila: { 'Ultra Ball': 3 }, semInventario: true });
  p.api.cfg.tetos = { 'Ultra Ball': 10 };

  assert.equal(await p.api.conferirEstoque(), 'Nao achei o inventário.');
});

test('o estoque lido aparece ao lado de cada item, e o truncado fica truncado', async () => {
  // O painel mostra o que foi MEDIDO. `9999` ali seria inventar o que o jogo nao disse.
  const p = montarLoja({
    dinheiro: 100000,
    linhas: COMUM,
    mochila: { 'Ultra Ball': '9999+', 'Small Potion': 40 },
  });
  p.api.cfg.tetos = { 'Ultra Ball': 10 };
  assert.equal(p.api.rotulos['Ultra Ball'].textContent, 'Ultra Ball', 'nasceu com numero');

  await p.api.conferirEstoque();

  assert.equal(p.api.rotulos['Ultra Ball'].textContent, 'Ultra Ball · tem 9999+');
  assert.equal(p.api.rotulos['Small Potion'].textContent, 'Small Potion · tem 40');
  // Item fora da mochila e' zero, e o painel diz zero — nao fica em branco.
  assert.equal(p.api.rotulos['Hyper Potion'].textContent, 'Hyper Potion · tem 0');
});

// --- minimizar ------------------------------------------------------------------------------
//
// Este era o unico dos cinco paineis sem minimizar, e e' o mais alto de todos: nove campos de
// alvo, a margem, a venda e a agenda. Minimizado fica o que se usa todo dia.

test('o painel minimiza, lembra o modo, e o botao diz em que modo esta', () => {
  const p = montarLoja({ linhas: COMUM });
  const painel = p.painel();
  assert.ok(painel, 'o painel nao foi montado');

  const bt = painel.querySelector('.ljx-min');
  assert.ok(bt, 'nao ha botao de minimizar');
  assert.equal(bt.textContent, '–');
  assert.equal(painel.classes.has('compacto'), false);

  bt.ouvintes.click[0]();

  assert.equal(painel.classes.has('compacto'), true);
  assert.equal(bt.textContent, '□', 'o botao nao diz que ja esta minimizado');
  assert.equal(p.api.cfg.compacto, true);
  assert.equal(p.guardado().compacto, true, 'o modo nao foi gravado: morre no F5');

  bt.ouvintes.click[0]();

  assert.equal(painel.classes.has('compacto'), false);
  assert.equal(bt.textContent, '–');
});

test('minimizar nao e esconder: sao dois botoes diferentes', () => {
  // Um `×` que encolhesse, ou um `–` que escondesse, seria o pior dos dois mundos.
  const p = montarLoja({ linhas: COMUM });
  const painel = p.painel();
  const bts = painel.querySelector('.ljx-barra').filhos.at(-1).filhos;

  assert.equal(bts.length, 2);
  assert.equal(bts[1].textContent, '×');
  assert.ok(/Esconder/.test(bts[1].title));
  assert.ok(!painel.classes.has('compacto'));
});

test('o que o minimizado esconde esta marcado, e o que ele guarda nao', () => {
  // A regra do CSS esconde `.ljx-l`, `.ljx-sep` e `.ljx-detalhe`. Entao o botao da mochila e o
  // do ciclo — o uso de todo dia — nao podem levar nenhuma dessas marcas.
  const p = montarLoja({ linhas: COMUM });
  const painel = p.painel();
  const rotulo = (f) => String(f.textContent || '');
  const marcado = (f) => /ljx-(l|sep|detalhe)\b/.test(String(f.className));

  const mochila = painel.filhos.find((f) => /Conferir a mochila/.test(rotulo(f)));
  const ciclo = painel.filhos.find((f) => /Rodar o ciclo/.test(rotulo(f)));
  assert.ok(mochila && ciclo, 'os botoes do dia a dia nao estao no painel');
  assert.ok(!marcado(mochila), 'a mochila desaparece ao minimizar');
  assert.ok(!marcado(ciclo), 'o ciclo desaparece ao minimizar');

  const venda = painel.filhos.find((f) => /Preparar venda/.test(rotulo(f)));
  assert.ok(marcado(venda), 'a venda fica no modo minimizado');

  // E o mecanismo: sao as marcas mais a regra do CSS. Sem ela, as marcas nao querem dizer nada.
  const css = fonte.slice(fonte.indexOf('const CSS ='), fonte.indexOf("].join('')"));
  for (const classe of ['.ljx-l', '.ljx-sep', '.ljx-detalhe'])
    assert.ok(
      css.includes(`.ljx.compacto ${classe}`),
      `a regra do minimizado nao esconde ${classe}`,
    );
});

test('painel oferece um botao proprio para parar o ciclo', () => {
  assert.match(fonte, /⏹ Parar ciclo/);
  assert.match(fonte, /c\?\.parar\?\.\(\)/);
});

test('botao que diz so "Vender", sem o (n), nao e o botao da venda', async () => {
  // O rotulo do botao da venda e' "Vender (73) · 💲…" / "Sell (73) · 💲…". Um "Vender" pelado e'
  // outra coisa — aba, ou o botao antes de haver linha marcada — e clicar nele e' um clique que
  // nao se desfaz. Por isso aqui exige-se o `(n)` alem do rotulo.
  const p = montarLoja({
    dinheiro: 1000,
    linhas: [{ nome: 'Venusaur', preco: 18000, grade: 'Comum' }],
    contagemDoJogo: 0,
  });
  const r = await p.api.venderAgora(() => {});
  assert.equal(p.btVender.cliques, 0, 'nao clicou num botao que nao e o da venda');
  assert.match(r, /botao de vender/);
});

// --- o jogo em ingles ---------------------------------------------------------------------------
//
// O pior caso de todos vivia aqui: as grades protegidas eram casadas pelo texto português
// ("Lendária"). Com o jogo em inglês o filtro "Legendary" não era desligado E a auditoria não
// reconhecia o lendário na linha — ou seja, a ferramenta vendia um lendário.

test('em ingles: nao segue com um "Legendary" marcado', async () => {
  const p = montarLoja({
    dinheiro: 1000,
    linhas: [
      { nome: 'Venusaur', preco: 18000, grade: 'Common' },
      { nome: 'Mewtwo', preco: 99000, grade: 'Legendary' },
    ],
    lingua: 'en',
  });
  // o desmarcar automatico resolve; forco o caso mau travando o checkbox do lendario
  p.linhas[1].querySelector('.mks-check').aoClicar = () => {};
  p.linhas[1].querySelector('.mks-check').checked = true;
  const r = await p.api.prepararVenda(() => {});
  assert.equal(r.ok, false, 'tinha de parar: ha um lendario na lista');
  assert.match(r.motivo, /Mewtwo/);
  assert.match(r.motivo, /Lendária/, 'a ferramenta fala portugues, mesmo lendo o jogo em ingles');
  assert.equal(p.btVender.cliques, 0);
});

test('em ingles: desliga os filtros das grades protegidas', async () => {
  const p = montarLoja({
    dinheiro: 1000,
    linhas: [{ nome: 'Venusaur', preco: 18000, grade: 'Common' }],
    lingua: 'en',
  });
  const r = await p.api.prepararVenda(() => {});
  assert.equal(r.ok, true, r.motivo);
  const ligadas = p
    .filtrosDeGrade()
    .filter((b) => String(b.className).includes('on'))
    .map((b) => b.textContent);
  for (const g of ['Legendary', 'Mythic', 'Ancient', 'Divine'])
    assert.ok(!ligadas.includes(g), `o filtro ${g} continuou ligado`);
});

test('em ingles: o filtro que nao desliga para a venda', async () => {
  const p = montarLoja({
    dinheiro: 1000,
    linhas: [{ nome: 'Venusaur', preco: 18000, grade: 'Common' }],
    filtroTrava: true,
    lingua: 'en',
  });
  const r = await p.api.prepararVenda(() => {});
  assert.equal(r.ok, false);
  assert.match(r.motivo, /filtro nao desligou/);
});

test('em ingles: vende e confirma no popup "Sell anyway"', async () => {
  const p = montarLoja({ dinheiro: 1000, linhas: DOIS_COMUNS_EN, lingua: 'en' });
  const r = await p.api.venderAgora(() => {});
  assert.deepEqual(p.confirmados, [2], 'confirmou a venda pelo botao em ingles');
  assert.match(r, /Vendidos/);
});

test('a grade na linha vem no masculino, e tambem protege', async () => {
  // O jogo escreve a grade de dois jeitos: "Lendária" no filtro da loja e "Lendário" na linha do
  // pokemon. Conhecer so' a do filtro e' nao reconhecer o lendario que esta' marcado.
  const p = montarLoja({
    dinheiro: 1000,
    linhas: [
      { nome: 'Venusaur', preco: 18000, grade: 'Comum' },
      { nome: 'Mewtwo', preco: 99000, grade: 'Lendário' },
    ],
  });
  p.linhas[1].querySelector('.mks-check').aoClicar = () => {};
  p.linhas[1].querySelector('.mks-check').checked = true;
  const r = await p.api.prepararVenda(() => {});
  assert.equal(r.ok, false, 'tinha de parar: ha um lendario marcado');
  assert.match(r.motivo, /Mewtwo/);
});

// --- a aba dos itens e a lista virtual, medidas em 28/10/2026 ---------------------------------

test('os itens vendem-se na aba "Vender": a aba "Itens" nao existe mais', async () => {
  // O jogo tirou a aba "🎒 Itens" e passou os itens para a de Vender. Procurar pelo nome antigo
  // devolvia nada, e a venda de itens morria em "aba Itens indisponível" sem vender um item —
  // sem erro nenhum, que e' o jeito mais caro de falhar.
  const p = montarLoja({
    dinheiro: 1000,
    linhas: [{ nome: 'Air Tank', preco: 1000, grade: 'Comum', aba: 'Itens' }],
  });
  const r = await p.api.venderTudo(() => {});
  assert.doesNotMatch(r, /indispon/i, 'a aba dos itens tem de ser achada');
  assert.equal(p.vendidas(), 1, 'vendeu o item');
});

test('item protegido nao vai junto na aba dos itens', async () => {
  const p = montarLoja({
    dinheiro: 1000,
    linhas: [
      { nome: 'Air Tank', preco: 1000, grade: 'Comum', aba: 'Itens' },
      { nome: 'Devoted Token', preco: 9000, grade: 'Comum', aba: 'Itens' },
    ],
  });
  await p.api.venderTudo(() => {});
  const sobrou = p.linhas.filter((l) => !l.vendida).map((l) => l.querySelector('.mks-name').textContent);
  assert.deepEqual(sobrou, ['Devoted Token'], 'o token protegido fica');
});

test('o acento nao tira o item da lista protegida', async () => {
  // Medido no jogo em 28/10/2026: a tela escreve "Rare Pokémon Picture", com `é`, e a lista
  // protegida escreve sem acento. Comparados crus, os dois nao casam — e o item que da' nome a'
  // regra era vendido por ela.
  const p = montarLoja({
    dinheiro: 1000,
    linhas: [
      { nome: 'Air Tank', preco: 1000, grade: 'Comum', aba: 'Itens' },
      { nome: 'Rare Pokémon Picture', preco: 9000, grade: 'Comum', aba: 'Itens' },
    ],
  });
  await p.api.venderTudo(() => {});
  const sobrou = p.linhas.filter((l) => !l.vendida).map((l) => l.querySelector('.mks-name').textContent);
  assert.deepEqual(sobrou, ['Rare Pokémon Picture'], 'o acento nao desprotege');
});

test('lista virtual: vende por paginas ate acabar', async () => {
  // 30 linhas, 12 por pagina: o jogo nunca desenha mais do que uma dezena, e e' por isso que a
  // venda tem de ir por paginas em vez de "Selecionar tudo".
  const linhas = Array.from({ length: 30 }, (_, i) => ({
    nome: `Pupitar ${i}`,
    preco: 32500,
    grade: 'Comum',
  }));
  const p = montarLoja({ dinheiro: 1000, linhas, porPagina: 12 });
  assert.equal(p.naTela(), 12, 'a tela so mostra uma pagina');
  const r = await p.api.venderAgora(() => {});
  assert.equal(p.vendidas(), 30, 'vendeu as trinta');
  assert.match(r, /Vendidos 30 em 3 página/);
});

test('lista virtual: a conferencia cruzada vale por pagina, nao pela lista toda', async () => {
  // O erro que isto evita: "Selecionar tudo" marca as 30 do lado do jogo e a tela mostra 12 —
  // a auditoria via 30 contra 12 e parava, sem nunca vender nada.
  const linhas = Array.from({ length: 30 }, (_, i) => ({
    nome: `Pupitar ${i}`,
    preco: 32500,
    grade: 'Comum',
  }));
  const p = montarLoja({ dinheiro: 1000, linhas, porPagina: 12 });
  const r = await p.api.prepararVenda(() => {});
  assert.equal(r.ok, true, 'a pagina tem de ficar pronta');
  assert.equal(r.total, 12, 'uma pagina, nao a lista toda');
  assert.deepEqual(p.confirmados, [], 'preparar nao vende');
});

test('lista virtual: o lendario fora da tela nao e vendido', async () => {
  // O protegido que nasce na terceira pagina so e' visto quando se chega la. Marcar a lista
  // toda de uma vez levava-o junto sem ninguem o ter olhado.
  const linhas = Array.from({ length: 30 }, (_, i) => ({
    nome: i === 25 ? 'Mewtwo' : `Pupitar ${i}`,
    preco: 32500,
    grade: i === 25 ? 'Lendário' : 'Comum',
  }));
  const p = montarLoja({ dinheiro: 1000, linhas, porPagina: 12 });
  await p.api.venderAgora(() => {});
  const sobrou = p.linhas.filter((l) => !l.vendida).map((l) => l.querySelector('.mks-name').textContent);
  assert.deepEqual(sobrou, ['Mewtwo'], 'o lendario fica, as outras 29 vao');
});

test('lista virtual: limpa a selecao que ficou fora da tela antes de marcar', async () => {
  // O susto de 28/10/2026: depois de uma auditoria ficaram 288 pokemon marcados do lado do
  // jogo enquanto a tela mostrava doze. Desmarcar os doze deixava 276 invisiveis, prontos para
  // o clique seguinte. So o alternador limpa tudo.
  const linhas = Array.from({ length: 30 }, (_, i) => ({
    nome: i < 3 ? 'Mewtwo' : `Pupitar ${i}`,
    preco: 32500,
    grade: i < 3 ? 'Lendário' : 'Comum',
  }));
  const p = montarLoja({ dinheiro: 1000, linhas, porPagina: 12 });
  // Deixa TUDO marcado de antes, lendarios inclusive, e rola para longe deles.
  for (const l of p.linhas) l.marcar(true);
  p.rolar(12 * 61);
  const r = await p.api.prepararVenda(() => {});
  assert.equal(r.ok, true, 'tinha de conseguir partir de zero');
  assert.equal(p.marcados(), r.total, 'so ficou marcado o que a tela mostra');
  assert.ok(
    p.linhas.slice(0, 3).every((l) => !l.querySelector('.mks-check').checked),
    'os lendarios fora da tela foram desmarcados',
  );
});
