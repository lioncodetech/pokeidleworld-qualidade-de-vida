import { readFileSync } from 'node:fs';

// O arreio do nucleo, partilhado pelos testes que precisam do `PPX` de verdade.
//
// O nucleo e' uma IIFE que le' globais. Aqui eles entram como parametros, que ficam em escopo
// dentro dela — e assim ele corre sem navegador e sem tocar no ficheiro. Correr o nucleo de
// verdade e' de proposito: o `canto` e' a conta que decide onde cada janelinha fica, e uma copia
// dele na banca testaria a copia.
export const ler = (nome) => readFileSync(new URL(`../${nome}`, import.meta.url), 'utf8');

/**
 * O nucleo e' uma IIFE que le' globais. Aqui eles entram como parametros, que ficam em escopo
 * dentro dela — e assim o teste corre sem navegador e sem tocar no ficheiro.
 */
export function montarNucleo({ tela = { w: 1920, h: 863 }, jaMonta = false } = {}) {
  const no = () => {
    const el = {
      style: { setProperty() {}, removeProperty() {}, getPropertyValue: () => '' },
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      className: '',
      textContent: '',
      title: '',
      filhos: [],
      appendChild(x) {
        el.filhos.push(x);
        return x;
      },
      append(...xs) {
        el.filhos.push(...xs);
      },
      addEventListener() {},
      removeEventListener() {},
      attachShadow: () => no(),
      // A captura de ponteiro e' o que faz o arrasto nao se perder quando o ponteiro sai da
    // janela; aqui basta existir.
    setPointerCapture() {},
    releasePointerCapture() {},
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0 }),
      // Devolve sempre um no': o nucleo monta o menu e escreve nos pedacos que procura. Um
      // `null` aqui faria o teste medir a banca, nao a ferramenta.
      querySelector: () => no(),
      querySelectorAll: () => [],
      remove() {},
      click() {},
      setAttribute() {},
      getAttribute: () => null,
    };
    return el;
  };

  const doc = {
    createElement: no,
    createElementNS: no,
    head: no(),
    body: no(),
    documentElement: no(),
    querySelector: () => no(),
    querySelectorAll: () => [],
    addEventListener() {},
    visibilityState: 'visible',
  };

  const loja = {};
  const antes = globalThis.PPX;
  const ouvintes = {};
  /** O que o nucleo mandou para o outro lado da fronteira, na ordem em que mandou. */
  const disparados = [];

  // `innerWidth`/`innerHeight` entram como globais e nao como parametros: o teste do recorte
  // precisa de os MUDAR no meio, que e' o que a janela faz quando o LionMultInstance rearranja
  // as views. Parametro nao se muda de fora.
  globalThis.innerWidth = tela.w;
  globalThis.innerHeight = tela.h;

  new Function(
    'localStorage',
    'document',
    'setTimeout',
    'clearTimeout',
    'setInterval',
    'addEventListener',
    'removeEventListener',
    // A ponte para a ferramenta que corre no mundo da pagina fala por eventos do DOM. Sem estes
    // dois, o nucleo rebentava ao montar — e rebentava para TODAS as ferramentas, nao so' para
    // ela.
    'dispatchEvent',
    'CustomEvent',
    ler('nucleo.js'),
  )(
    {
      getItem: (k) => loja[k] ?? null,
      setItem: (k, v) => {
        loja[k] = v;
      },
      // Enumerar e' o que o exportar precisa: ele varre o armazenamento pelo prefixo em vez de
      // uma lista escrita a mao. Sem `length`/`key` aqui, o teste mediria a banca.
      get length() {
        return Object.keys(loja).length;
      },
      key: (i) => Object.keys(loja)[i] ?? null,
    },
    doc,
    // O atraso do `resize` e' um debounce de 150 ms. Correr na hora e' o que torna o recorte
    // mensuravel; `jaMonta` fica desligado por omissao porque a montagem do menu nao e' o
    // assunto destes guardas.
    (fn) => {
      if (jaMonta) fn();
      return 0;
    },
    () => {},
    () => 0,
    (tipo, fn) => {
      (ouvintes[tipo] = ouvintes[tipo] || []).push(fn);
    },
    () => {},
    (evento) => {
      disparados.push(evento);
      return true;
    },
    class {
      constructor(tipo, init) {
        this.type = tipo;
        this.detail = (init || {}).detail;
      }
    },
  );
  const PPX = globalThis.PPX;
  globalThis.PPX = antes;
  return {
    PPX,
    /** O `localStorage` de mentira, para semear e conferir o que ficou guardado. */
    loja,
    no,
    tela: (w, h) => {
      globalThis.innerWidth = w;
      globalThis.innerHeight = h;
    },
    disparar: (tipo, detalhe) => (ouvintes[tipo] || []).forEach((f) => f({ detail: detalhe })),
    /** Os eventos que o nucleo mandou para a ferramenta do outro mundo. */
    disparados,
  };
}

/** Um painel de mentira com caixa mensuravel, como o `getBoundingClientRect` a daria. */
export function painelEm(x, y, largura = 248, altura = 300, { clicavel = false } = {}) {
  const caixa = { left: x, top: y, width: largura, height: altura, x, y };
  const el = {
    style: {},
    ouvintes: {},
    // Quando o ponteiro foi capturado, e nao so' se foi: capturar cedo de mais e' o que rouba o
    // clique de quem esta' dentro do pegador.
    capturas: [],
    soltas: [],
    addEventListener(tipo, fn) {
      (el.ouvintes[tipo] = el.ouvintes[tipo] || []).push(fn);
    },
    // `clicavel` e' o caso da abinha do menu: o pegador E' o botao, e ele tem de continuar a
    // arrastar-se. Confundi-lo com um botao DENTRO do pegador tirava o arrasto do menu inteiro.
    closest: (sel) => (clicavel && String(sel).includes('button') ? el : null),
    setPointerCapture(id) {
      el.capturas.push(id);
    },
    releasePointerCapture(id) {
      el.soltas.push(id);
    },
    getBoundingClientRect: () => ({
      ...caixa,
      left: parseFloat(el.style.left ?? caixa.left),
      top: parseFloat(el.style.top ?? caixa.top),
      x: parseFloat(el.style.left ?? caixa.x),
      y: parseFloat(el.style.top ?? caixa.y),
    }),
  };
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  return el;
}


/**
 * Um botao de mentira, como o `–` e o `×` que moram dentro da barra do painel.
 *
 * O que importa aqui e' o `closest`: e' por ele que o arrasto reconhece quem tem clique proprio.
 */
export function botaoDeMentira() {
  const bt = {
    style: {},
    cancelado: false,
    closest: (sel) => (String(sel).includes('button') ? bt : null),
  };
  return bt;
}

/**
 * Os casadores de rotulo do nucleo DE VERDADE, prontos para entrar no `PPX` de mentira dos
 * testes de cada ferramenta.
 *
 * Porque' assim: as ferramentas pedem o rotulo ao nucleo e so' caem para o texto portugues
 * quando ele nao esta' lá. Um `PPX` de mentira sem estes casadores testava sempre a queda, e o
 * caminho que o jogo em ingles usa ficava sem ninguem a olhar.
 *
 * `raiz` e' o documento de mentira do teste: o `botaoPorRotulo` do nucleo procura no documento
 * da pagina, e na banca a pagina e' outra.
 */
export function casadoresDeRotulo(raiz) {
  const { PPX } = montarNucleo();
  return {
    limparRotulo: PPX.limparRotulo,
    formasLimpas: PPX.formasLimpas,
    eRotulo: PPX.eRotulo,
    comecaComRotulo: PPX.comecaComRotulo,
    contemRotulo: PPX.contemRotulo,
    rotulos: PPX.rotulos,
    botaoPorRotulo: (nome, opcoes = {}) =>
      PPX.botaoPorRotulo(nome, { ...opcoes, raiz: opcoes.raiz || raiz }),
  };
}
