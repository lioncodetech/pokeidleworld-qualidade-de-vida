// Guardas do recarregar sozinho.
//
// O que se testa aqui nao e' "a pagina recarrega" — e' que ela NAO recarrega nos momentos em que
// recarregar custa algo: no meio de uma venda, debaixo das maos de quem esta' a jogar, ou no
// instante em que acabou de carregar. Uma recarga a mais e' uma venda perdida a meio, ou um laco
// em que a janela nunca chega a jogar.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const fonte = readFileSync(new URL('../recarregar.js', import.meta.url), 'utf8');

function noDom() {
  const el = {
    style: { cssText: '', setProperty() {}, removeProperty() {} },
    classList: { add() {}, remove() {}, contains: () => false },
    className: '',
    textContent: '',
    filhos: [],
    ouvintes: {},
    append(...f) {
      el.filhos.push(...f);
    },
    appendChild(f) {
      el.filhos.push(f);
      return f;
    },
    addEventListener(tipo, fn) {
      (el.ouvintes[tipo] = el.ouvintes[tipo] || []).push(fn);
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 236, height: 120, x: 0, y: 0 }),
  };
  return el;
}

/**
 * @param dono quem tem a vez agora ('' para ninguem)
 * @param recusaVez a fila nunca chega a esta ferramenta
 */
function montar({ guardado = null, dono = '', recusaVez = false, visivel = 'visible' } = {}) {
  const loja = guardado === null ? {} : { 'lioncode:pokeidleworld:recarregar': JSON.stringify(guardado) };
  const recargas = [];
  const soltas = [];
  let pedidos = 0;
  const ouvintes = {};
  let relogio = null;

  const PPX = {
    modulo: (meta, fn) => fn(),
    vez: {
      pedir: async (id) => {
        pedidos += 1;
        if (recusaVez) return null;
        return () => soltas.push(id);
      },
      dono: () => (dono ? { id: dono } : null),
    },
    painel: () => () => false,
    frente: () => {},
    anotar: () => {},
    controlar: () => {},
  };

  const doc = {
    get visibilityState() {
      return visivel;
    },
    body: noDom(),
    createElement: () => noDom(),
    activeElement: null,
  };

  // A ferramenta fala com o nucleo por `globalThis.PPX` — a fila, o painel, o anotar — e e' la'
  // que ela se publica. Entao o `PPX` de mentira TEM de ser o global, como no navegador: injeta-lo
  // so' como parametro deixaria a fila de fora e o teste mediria a ausencia dela.
  globalThis.PPX = PPX;

  const mod = { exports: {} };
  new Function(
    'PPX',
    'document',
    'localStorage',
    'location',
    'setInterval',
    'clearInterval',
    'addEventListener',
    'console',
    'module',
    fonte,
  )(
    PPX,
    doc,
    {
      getItem: (k) => loja[k] ?? null,
      setItem: (k, v) => {
        loja[k] = v;
      },
    },
    {
      reload: () => recargas.push(Date.now()),
    },
    (fn) => {
      // O relogio nao corre sozinho na banca: quem bate e' o teste, pela mao que ele guarda.
      relogio = fn;
      return 1;
    },
    () => {
      relogio = null;
    },
    (tipo, fn) => {
      (ouvintes[tipo] = ouvintes[tipo] || []).push(fn);
    },
    { log() {} },
    mod,
  );

  return {
    api: mod.exports,
    /** O que a ferramenta expoe no `PPX`: ligar, recarregar agora, ver o prazo. */
    tool: PPX.recarregar,
    ppx: PPX,
    loja,
    recargas,
    soltas,
    pedidos: () => pedidos,
    bater: async () => {
      if (relogio) relogio();
      // A batida pede a vez, que e' assincrono. Sem deixar as microtarefas correrem, um assert
      // aqui passaria mesmo que a recarga estivesse a caminho — e foi uma mutacao viva que o
      // mostrou.
      for (let i = 0; i < 4; i += 1) await Promise.resolve();
      await new Promise((r) => setImmediate(r));
    },
    tocar: () => (ouvintes.mousedown || []).forEach((f) => f()),
    relogioVivo: () => relogio !== null,
  };
}

// --- as decisoes -------------------------------------------------------------------------------

test('minutos invalidos caem no padrao, nao desligam o relogio', () => {
  const { api } = montar();
  for (const bruto of ['', 'abc', null, undefined, 0, -5, NaN])
    assert.equal(api.minutosValidos(bruto), api.MINUTOS_PADRAO, `${String(bruto)} devia cair no padrao`);
});

test('minutos fora da faixa encostam no limite', () => {
  const { api } = montar();
  assert.equal(api.minutosValidos(1), api.MINUTOS_MIN, 'abaixo do minimo recarregar custa mais do que poupa');
  assert.equal(api.minutosValidos(99999), api.MINUTOS_MAX);
  assert.equal(api.minutosValidos(30), 30);
  assert.equal(api.minutosValidos('45'), 45, 'o campo do painel entrega texto');
  assert.equal(api.minutosValidos(30.4), 30, 'arredonda em vez de guardar fracao de minuto');
});

test('o prazo conta de agora, em minutos', () => {
  const { api } = montar();
  assert.equal(api.prazoDe(30, 1000), 1000 + 30 * 60000);
  assert.equal(api.prazoDe('abc', 0), api.MINUTOS_PADRAO * 60000, 'minuto invalido nao vira prazo zero');
});

test('desligada nao recarrega nunca, nem com o prazo vencido', () => {
  const { api } = montar();
  assert.equal(
    api.decidir({ ligado: false, prazo: 1, agora: 9e9, dono: '', aVista: false, ultimoToque: 0 }),
    'esperar',
  );
});

test('prazo no futuro: espera', () => {
  const { api } = montar();
  assert.equal(
    api.decidir({ ligado: true, prazo: 5000, agora: 4999, dono: '', aVista: false, ultimoToque: 0 }),
    'esperar',
  );
});

test('prazo vencido e caminho livre: recarrega', () => {
  const { api } = montar();
  assert.equal(
    api.decidir({ ligado: true, prazo: 5000, agora: 5000, dono: '', aVista: false, ultimoToque: 0 }),
    'recarregar',
  );
});

test('outra ferramenta com a vez: adia, nao recarrega', () => {
  // Recarregar no meio de uma venda e' perder a venda a meio.
  const { api } = montar();
  assert.equal(
    api.decidir({ ligado: true, prazo: 1, agora: 9e9, dono: 'loja', aVista: false, ultimoToque: 0 }),
    'adiar',
  );
  // A vez desta ferramenta nao e' impedimento: ela e' reentrante por dono.
  assert.equal(
    api.decidir({ ligado: true, prazo: 1, agora: 9e9, dono: 'recarregar', aVista: false, ultimoToque: 0 }),
    'recarregar',
  );
});

test('janela a vista e tocada agora mesmo: adia', () => {
  const { api } = montar();
  const agora = 10 * 60000;
  assert.equal(
    api.decidir({ ligado: true, prazo: 1, agora, dono: '', aVista: true, ultimoToque: agora - 1000 }),
    'adiar',
    'nao se arranca a pagina debaixo das maos de quem joga',
  );
  assert.equal(
    api.decidir({ ligado: true, prazo: 1, agora, dono: '', aVista: true, ultimoToque: agora - api.EM_USO }),
    'recarregar',
    'passado o tempo de uso, recarrega',
  );
});

test('janela escondida recarrega mesmo tendo sido tocada: e o caso normal', () => {
  // Com varias janelas abertas quase todas estao escondidas, e o ultimo toque nelas e' antigo mas
  // pode nao ser: olhar o relogio do rato numa aba oculta travaria a ferramenta justamente onde
  // ela serve.
  const { api } = montar();
  const agora = 10 * 60000;
  assert.equal(
    api.decidir({ ligado: true, prazo: 1, agora, dono: '', aVista: false, ultimoToque: agora }),
    'recarregar',
  );
});

test('a conta de minutos que falta arredonda para cima', () => {
  const { api } = montar();
  assert.equal(api.faltam(60000, 0), 1);
  assert.equal(api.faltam(60001, 0), 2, 'um segundo a mais ainda e "2 min", nao "1"');
  assert.equal(api.faltam(0, 60000), 0, 'prazo passado nao vira minuto negativo');
});

// --- a ferramenta a correr ---------------------------------------------------------------------

test('a pagina que acabou de carregar nao se recarrega, mesmo ligada', async () => {
  // O prazo nao e' guardado de proposito: uma janela que abre depois de horas desligada ESTA'
  // limpa. Guardar o prazo faria a primeira batida recarregar uma pagina recem-carregada — e, no
  // pior caso, um laco de recargas.
  const p = montar({ guardado: { ligado: true, minutos: 5 } });
  await p.bater();
  assert.deepEqual(p.recargas, [], 'nada a recarregar: a pagina e nova');
  assert.ok(p.tool.prazo() > Date.now(), 'o prazo e contado deste carregamento');
});

test('vencido o prazo, recarrega uma vez e pede a vez antes', async () => {
  const p = montar({ guardado: { ligado: true, minutos: 5 } });
  // Vencer o prazo sem esperar cinco minutos: a propria ferramenta expoe o relogio dela.
  const r = await p.tool.agora();
  assert.equal(r, 'recarregando');
  assert.equal(p.recargas.length, 1);
  assert.equal(p.pedidos(), 1, 'pediu a vez antes de recarregar');
  assert.deepEqual(p.soltas, [], 'a vez segue com ela ate a pagina sair: quem a solta e o pagehide');
});

test('sem conseguir a vez, nao recarrega e diz porque', async () => {
  const p = montar({ guardado: { ligado: true, minutos: 5 }, recusaVez: true });
  const r = await p.tool.agora();
  assert.match(r, /vez/);
  assert.deepEqual(p.recargas, [], 'melhor nao recarregar do que recarregar no meio de outra coisa');
});

test('duas chamadas seguidas recarregam uma vez so', async () => {
  const p = montar({ guardado: { ligado: true, minutos: 5 } });
  const [a, b] = await Promise.all([p.tool.agora(), p.tool.agora()]);
  assert.equal(p.recargas.length, 1, `uma recarga, nao duas (${a} / ${b})`);
});

test('ligar guarda a escolha e marca o prazo; desligar apaga o prazo', () => {
  const p = montar();
  p.tool.ligar(true);
  assert.equal(JSON.parse(p.loja['lioncode:pokeidleworld:recarregar']).ligado, true);
  assert.ok(p.tool.prazo() > Date.now(), 'o prazo ficou no futuro');
  p.tool.ligar(false);
  assert.equal(p.tool.prazo(), 0);
  assert.equal(JSON.parse(p.loja['lioncode:pokeidleworld:recarregar']).ligado, false);
});

test('definicao gravada estragada nao impede a ferramenta de montar', () => {
  const p = montar({ guardado: 'isto nao e um objeto' });
  assert.ok(p.api.decidir, 'montou mesmo assim');
  assert.equal(p.recargas.length, 0);
});

test('prazo zero nunca vence: ligada sem prazo marcado so espera', () => {
  // `prazo` 0 e' "nao ha' prazo", nao "prazo no ano zero". Sem esta guarda, qualquer instante
  // seria depois dele e a janela recarregaria em laco.
  const { api } = montar();
  assert.equal(
    api.decidir({ ligado: true, prazo: 0, agora: 9e9, dono: '', aVista: false, ultimoToque: 0 }),
    'esperar',
  );
});

test('desligar no painel apaga o prazo, e nenhuma batida recarrega', async () => {
  const p = montar({ guardado: { ligado: true, minutos: 5 } });
  p.tool.ligar(false);
  await p.bater();
  assert.deepEqual(p.recargas, []);
});
