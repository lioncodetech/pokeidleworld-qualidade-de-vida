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
    const comprar = no('nsh-btn mks-buy', 'Comprar');
    comprar.ehBotao = true;
    comprar.aoClicar = () => {
      if (saldo >= (l.preco || 0)) {
        if (!l.naoDebita) saldo -= l.preco || 0;
        compras.push(l.nome);
        atualizarOuro();
      }
    };
    linha.filhos.push(nome, preco, meta, check, comprar);
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

  const doc = {
    querySelector: (sel) => {
      if (sel === '.mk-sellconfirm') return popup;
      return casa(janela, sel) ? janela : janela.querySelector(sel);
    },
    body: { appendChild() {} },
    head: { appendChild() {} },
    documentElement: { appendChild() {} },
    createElement: () => {
      const e = no('');
      e.style = {};
      e.append = () => {};
      e.appendChild = () => {};
      e.addEventListener = () => {};
      return e;
    },
  };

  const PPX = {
    modulo: (meta, fn) => fn(),
    anotar: () => {},
    controlar: () => {},
    vez: { pedir: async () => () => {} },
  };
  globalThis.PPX = PPX;

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
    { getItem: () => null, setItem: () => {} },
    (fn, ms) => globalThis.setTimeout(fn, Math.min(ms, 1)),
    () => {},
    mod,
  );

  return {
    api: mod.exports,
    compras,
    linhas: todasAsLinhas,
    saldo: () => saldo,
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

test('compra exatamente a quantidade pedida', async () => {
  const p = montarLoja({ dinheiro: 100000, linhas: COMUM });
  const r = await p.api.comprar('Ultra Ball', 5);
  assert.equal(r.comprou, 5);
  assert.equal(p.compras.filter((c) => c === 'Ultra Ball').length, 5);
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
  assert.ok(p.compras.length <= 3, `parou cedo, e nao em ${p.compras.length} cliques`);
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

test('acima do teto nao chega nem a abrir o popup', async () => {
  const p = montarLoja({ dinheiro: 1000, linhas: DOIS_COMUNS });
  p.api.cfg.tetoVenda = 1;
  const r = await p.api.venderAgora(() => {});
  assert.match(r, /acima do teto/);
  assert.equal(p.popupAberto(), false, 'nem abriu');
  assert.deepEqual(p.confirmados, []);
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
