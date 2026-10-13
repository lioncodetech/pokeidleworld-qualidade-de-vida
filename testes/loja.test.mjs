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

const fonte = readFileSync(new URL('../loja.js', import.meta.url), 'utf8');

/** Um no de mentira: so o que o modulo toca. */
function no(cls, texto = '') {
  return {
    className: cls,
    textContent: texto,
    // `innerText` tambem: o modulo le o popup por `innerText`, como no DOM real. Um fake so' com
    // `textContent` faz o guarda do popup passar por engano, pelo motivo errado.
    innerText: texto,
    disabled: false,
    checked: false,
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
  };
}

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
} = {}) {
  const compras = [];
  const janela = no('mks-window');
  let saldo = dinheiro;

  const ouro = no('nsh-gold', `💲 ${saldo}`);
  const atualizarOuro = () => {
    ouro.textContent = `💲 ${saldo}`;
  };
  janela.filhos.push(ouro);

  for (const rot of ['🛒 Comprar', '💰 Vender', '🐾 Pokémon']) {
    const t = no(rot === '🛒 Comprar' ? 'nsh-tab on' : 'nsh-tab', rot);
    janela.filhos.push(t);
  }

  for (const g of ['Fraca', 'Comum', 'Rara', 'Lendária', 'Mítica', 'Anciã', 'Divina']) {
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
    janela.filhos.push(linha);
    todasAsLinhas.push(linha);
  }

  const btSelecionar = no('', '☐ Selecionar tudo');
  btSelecionar.ehBotao = true;
  btSelecionar.aoClicar = () => {
    for (const l of todasAsLinhas) l.marcar(true);
  };
  janela.filhos.push(btSelecionar);

  let popup = null;
  const confirmados = [];
  const cancelados = [];

  const btVender = no('', 'Vender');
  btVender.ehBotao = true;
  btVender.aoClicar = () => {
    if (popupDiz === null) return; // venda direta, sem confirmacao
    const n =
      popupDiz === 'igual'
        ? todasAsLinhas.filter((l) => l.querySelector('.mks-check').checked).length
        : popupDiz;
    // 'mudo' = o jogo reescreveu o aviso e deixou de dizer quantos sao
    const aviso =
      popupDiz === 'mudo'
        ? '⚠️ CONFIRMAR VENDA DE POKÉMON\nConfira antes de prosseguir.'
        : `⚠️ CONFIRMAR VENDA DE POKÉMON\nVocê selecionou TUDO: ${n} linha(s), por 💲${n * 18000}.`;
    popup = no('mk-sellconfirm', aviso);
    const bc = no('nsh-btn nsh-btn-alt', 'Cancelar');
    bc.ehBotao = true;
    bc.aoClicar = () => {
      cancelados.push(n);
      popup = null;
    };
    const bs = no('nsh-btn', 'Vender mesmo assim');
    bs.ehBotao = true;
    bs.aoClicar = () => {
      confirmados.push(n);
      popup = null;
    };
    popup.filhos.push(bc, bs);
  };
  Object.defineProperty(btVender, 'textContent', {
    get() {
      const n =
        contagemDoJogo !== null
          ? contagemDoJogo
          : todasAsLinhas.filter((l) => l.querySelector('.mks-check').checked).length;
      return n ? `Vender (${n}) · 💲${n * 100}` : 'Vender';
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
  };
  const janelaInv = no('inv-window', '');
  janelaInv.filhos.push(fecharInv);

  const slots = () => {
    if (!sacola) return [];
    return Object.entries(sacola)
      .filter(([, q]) => q !== 0)
      .map(([nome, q]) => {
        const s = no('inv-slot', '');
        const qty = no('inv-qty', String(q));
        s.filhos.push(qty);
        s.querySelector = (sel) =>
          sel === 'img' ? { alt: nome } : sel === '.inv-qty' ? qty : null;
        return s;
      });
  };

  const doc = {
    querySelector: (sel) => {
      if (sel === '.mk-sellconfirm') return popup;
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
  globalThis.PPX = PPX;

  const guardado = {};
  const mod = { exports: {} };
  const executar = new Function(
    'PPX',
    'document',
    'localStorage',
    'setTimeout',
    'addEventListener',
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
    marcados: () => todasAsLinhas.filter((l) => l.querySelector('.mks-check').checked).length,
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
