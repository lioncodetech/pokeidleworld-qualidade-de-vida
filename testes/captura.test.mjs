// Guardas da captura automatica.
//
// O teste executa o modulo de verdade contra um DOM de mentira com a forma exata que foi medida
// na pagina do jogo em 09/10/2026: `.cap-row button.cap-throw` para lancar, `.cap-chip.on
// .cap-chip-n` para o saldo. Um guarda que so lesse o texto do arquivo passaria mesmo que a
// ferramenta nunca clicasse.
//
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const fonte = readFileSync(new URL('../captura.js', import.meta.url), 'utf8');

/** Pagina de mentira: so o que o modulo toca. */
function montarPagina({ ligado = true, travado = false, saldo = 100, temSelvagem = true } = {}) {
  const cliques = [];
  const vezPedida = [];
  let vezSolta = 0;

  const botao = {
    disabled: travado,
    click() {
      cliques.push(Date.now());
    },
  };
  const saldoNo = { textContent: String(saldo) };

  const doc = {
    querySelector(sel) {
      if (sel === '.cap-row button.cap-throw') return temSelvagem ? botao : null;
      if (sel.includes('cap-chip-n')) return saldo === null ? null : saldoNo;
      return null;
    },
    body: { appendChild() {} },
    createElement: () => ({ style: {}, remove() {}, set textContent(v) {} }),
  };

  const armazem = new Map([['lioncode:pokeidleworld:captura', ligado ? '1' : '0']]);
  const anotado = [];
  let comandar = null;
  let corpoObservador = null;

  const PPX = {
    modulo: (meta, fn) => fn(),
    anotar: (id, v) => anotado.push([id, v]),
    controlar: (id, fn) => {
      comandar = fn;
    },
    vez: {
      pedir: async (id) => {
        vezPedida.push(id);
        return () => {
          vezSolta += 1;
        };
      },
      dono: () => null,
      nome: (id) => id,
    },
  };
  globalThis.PPX = PPX;

  const executar = new Function(
    'PPX',
    'document',
    'localStorage',
    'setInterval',
    'setTimeout',
    'addEventListener',
    'MutationObserver',
    fonte,
  );
  executar(
    PPX,
    doc,
    {
      getItem: (k) => (armazem.has(k) ? armazem.get(k) : null),
      setItem: (k, v) => armazem.set(k, v),
    },
    () => 0,
    () => 0,
    () => {},
    class {
      constructor(fn) {
        corpoObservador = fn;
      }
      observe() {}
      disconnect() {}
    },
  );

  return {
    cliques,
    vezPedida,
    solturas: () => vezSolta,
    anotado,
    botao,
    chave: () => armazem.get('lioncode:pokeidleworld:captura'),
    comandar: (v) => comandar(v),
    // uma mutacao do DOM, que e o motor da ferramenta
    mexer: async () => {
      corpoObservador();
      await new Promise((r) => setTimeout(r, 0));
    },
  };
}

test('ligada, lanca quando aparece selvagem com o botao livre', async () => {
  const p = montarPagina({ ligado: true });
  await p.mexer();
  assert.equal(p.cliques.length, 1, 'lancou uma vez');
});

test('nao lanca enquanto o jogo mantem o botao travado', async () => {
  // O tempo de espera (~4,4 s) e lido do proprio botao, nunca cronometrado. Se a ferramenta
  // ignorasse `disabled`, martelaria um botao morto a cada mutacao do chat.
  const p = montarPagina({ ligado: true, travado: true });
  await p.mexer();
  assert.equal(p.cliques.length, 0, 'nao clicou em botao travado');
});

test('desligada, nao toca em nada', async () => {
  const p = montarPagina({ ligado: false });
  await p.mexer();
  assert.equal(p.cliques.length, 0);
  assert.equal(p.vezPedida.length, 0, 'nem sequer pede a vez');
});

test('sem pokebolas, desliga-se em vez de insistir', async () => {
  const p = montarPagina({ ligado: true, saldo: 0 });
  await p.mexer();
  assert.equal(p.cliques.length, 0, 'nao lanca sem bola');
  assert.equal(p.chave(), '0', 'e fica desligada, para nao insistir a cada mutacao');
});

test('pede a vez antes de agir e solta sempre depois', async () => {
  // A vez e pedida por lancamento, nao enquanto a ferramenta esta ligada: ela fica horas ligada,
  // e segurar a fila todo esse tempo trancaria qualquer automacao futura.
  const p = montarPagina({ ligado: true });
  await p.mexer();
  assert.deepEqual(p.vezPedida, ['captura'], 'pediu a vez uma vez');
  assert.equal(p.solturas(), 1, 'e soltou');
});

test('uma rajada de mutacoes nao vira uma rajada de cliques', async () => {
  // O chat do jogo muda o DOM sem parar. Sem o piso entre tentativas, cada mensagem viraria um
  // lancamento.
  const p = montarPagina({ ligado: true });
  await p.mexer();
  await p.mexer();
  await p.mexer();
  assert.equal(p.cliques.length, 1, 'so o primeiro passou');
});

test('o menu liga e desliga como o atalho', async () => {
  const p = montarPagina({ ligado: false });
  p.comandar(true);
  assert.equal(p.chave(), '1', 'o menu ligou');
  assert.ok(
    p.anotado.some(([id, v]) => id === 'captura' && v === true),
    'e o menu foi avisado do novo estado',
  );
});
