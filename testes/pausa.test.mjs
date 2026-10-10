// Guardas do compasso.
//
// Duas coisas se testam aqui, e elas puxam para lados opostos: a pausa tem de VARIAR (senao nao
// adianta nada) e nunca pode ficar MENOR do que a ferramenta pediu (senao troca-se "parecer
// humano" por "falhar as vezes", que e' um pessimo negocio — os numeros pedidos foram medidos
// contra o jogo).
//
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const fonte = readFileSync(new URL('../pausa.js', import.meta.url), 'utf8');

/** Carrega o modulo com um `Math.random` que se pode guiar. */
function montar(sorteios = null) {
  let i = 0;
  const random = sorteios ? () => sorteios[i++ % sorteios.length] : Math.random;
  const mod = { exports: {} };
  new Function(
    'Math',
    'setTimeout',
    'module',
    'globalThis',
    fonte,
  )(
    // `{ ...Math }` nao copia nada: os metodos de Math nao sao enumeraveis. Por isso a copia e'
    // feita a mao — e ja' custou um teste que falhou por 'Math.round is not a function'.
    { round: Math.round, random, min: Math.min },
    (fn, ms) => globalThis.setTimeout(fn, Math.min(ms, 1)),
    mod,
    {},
  );
  return mod.exports;
}

test('a pausa nunca fica menor do que a pedida', () => {
  const { jitter } = montar();
  for (const pedido of [130, 140, 650, 1800, 3000])
    for (let i = 0; i < 400; i += 1)
      assert.ok(jitter(pedido) >= pedido, `${jitter(pedido)} < ${pedido}`);
});

test('duas pausas seguidas nao saem iguais', () => {
  // E' o ponto inteiro: cem cliques com exatamente 140 ms entre cada um e' o padrao mais facil
  // de reconhecer que existe.
  const { jitter } = montar();
  const vistos = new Set();
  for (let i = 0; i < 60; i += 1) vistos.add(jitter(140));
  assert.ok(vistos.size > 20, `so ${vistos.size} valores diferentes em 60`);
});

test('o espalhamento acompanha o tamanho do pedido', () => {
  // Somar sempre o mesmo punhado de milissegundos deixaria o compasso longo tao regular quanto
  // antes. Com o dado no maximo e sem distracao, cada pausa cresce 60% do que se pediu.
  const { jitter } = montar([1, 1]);
  assert.equal(jitter(140), 224);
  assert.equal(jitter(3000), 4800);
});

test('de vez em quando ha uma parada maior', () => {
  // Gente se distrai. Sem isto a distribuicao fica estreita demais: regular de outro jeito, mas
  // ainda regular.
  const { jitter } = montar();
  const grandes = Array.from({ length: 600 }, () => jitter(140)).filter((v) => v > 500);
  assert.ok(grandes.length > 10, `so ${grandes.length} paradas maiores em 600`);
  assert.ok(grandes.length < 150, `${grandes.length} paradas maiores em 600 e demais`);
});

test('pausa de zero continua sendo zero', () => {
  // Quem pede zero nao quer uma parada surpresa de dois segundos.
  const { jitter } = montar();
  assert.equal(jitter(0), 0);
  assert.equal(jitter(undefined), 0);
});

test('o sorteio e usado, e nao so decorativo', () => {
  // Com o dado preso no menor valor, a pausa e' exatamente a pedida: prova que o espalhamento
  // sai do sorteio e nao de um numero fixo escondido.
  // Dado no minimo para o espalhamento e no maximo para a distracao: sem acrescimo nenhum.
  const { jitter } = montar([0, 1]);
  assert.equal(jitter(140), 140);
});
