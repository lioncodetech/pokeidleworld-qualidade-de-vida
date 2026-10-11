// Guardas do "em cima das outras": `PPX.frente` e o andar partilhado dos paineis.
//
// Isto nao e' enfeite de desenho. Os cinco paineis nasceram com o mesmo `z-index`, e com empate
// quem decide e' a ordem no DOM — a ordem em que os ficheiros carregam. O painel em que se esta'
// a mexer ficava atras de outro e nao havia nada a fazer senao fechar o de cima.
//
import assert from 'node:assert/strict';
import test from 'node:test';

import { botaoDeMentira, ler, montarNucleo, painelEm } from './nucleo-de-mentira.mjs';

test('frente devolve numeros sempre crescentes: quem foi tocado fica em cima', () => {
  const { PPX } = montarNucleo();
  const a = { style: {} };
  const b = { style: {} };

  const z1 = PPX.frente(a);
  const z2 = PPX.frente(b);
  const z3 = PPX.frente(a);

  assert.ok(z2 > z1, 'o segundo nao subiu');
  assert.ok(z3 > z2, 'voltar ao primeiro nao o trouxe para a frente');
  assert.equal(a.style.zIndex, String(z3));
  assert.equal(b.style.zIndex, String(z2));
  assert.ok(Number(a.style.zIndex) > Number(b.style.zIndex));
});

test('a contagem nasce acima do andar que os paineis pedem no CSS', () => {
  // Se o CSS pedisse o maximo, nao haveria para onde subir — era esse o defeito.
  const { PPX } = montarNucleo();
  const base = Number(ler('nucleo.js').match(/const Z_BASE = (\d+);/)[1]);

  assert.ok(PPX.frente({ style: {} }) > base, 'a frente nasce abaixo ou no proprio andar base');
});

test('a contagem volta ao inicio em vez de estourar calada', () => {
  // Um contador que passa do maximo do CSS deixa de trazer qualquer coisa para a frente, e o
  // sintoma seria exatamente o defeito original de volta, numa sessao muito longa.
  const fonte = ler('nucleo.js');
  const base = Number(fonte.match(/const Z_BASE = (\d+);/)[1]);
  const tecto = Number(fonte.match(/const Z_TECTO = (\d+);/)[1]);
  assert.ok(tecto > base);
  assert.ok(tecto < 2147483647, 'o tecto passa do maximo que o CSS aceita');

  // Nao se dao cem milhoes de cliques num teste: confere-se a regra onde ela esta' escrita, e
  // que o primeiro numero entregue ja' esta' dentro da faixa.
  assert.match(fonte, /zDaFrente >= Z_TECTO \? Z_BASE \+ 1 : zDaFrente \+ 1/);
  const z = montarNucleo().PPX.frente({ style: {} });
  assert.ok(z > base && z <= tecto, `${z} fora da faixa ${base}..${tecto}`);
});

test('frente nao se engasga com o que nao e elemento', () => {
  const { PPX } = montarNucleo();
  assert.equal(PPX.frente(null), null);
  assert.equal(PPX.frente(undefined), null);
  assert.equal(PPX.frente({}), null, 'tentou mexer no style de algo que nao tem style');
});

test('o desenho das cinco janelinhas vem do nucleo, e nenhuma o volta a copiar', () => {
  // Esta e' a guarda contra a reincidencia. Sete regras eram literalmente iguais nas cinco
  // folhas, e copia deriva: nasceram 176px, 190px e 200px de minimizado, um separador proprio,
  // e a Loja sem minimizar nenhum. O que falha e' o conjunto, nao um modulo.
  const chrome = montarNucleo().PPX.estiloDePainel('zz');
  for (const regra of ['.zz-barra{', '.zz-status{', '.zz-x{', '.zz h4{', '.zz button{'])
    assert.ok(chrome.includes(regra), `o nucleo deixou de servir ${regra}`);

  for (const [arq, pfx] of [
    ['cacadas.js', 'cjx'],
    ['escada.js', 'esx'],
    ['times.js', 'tmx'],
    ['loja.js', 'ljx'],
    ['arrumar.js', 'arx'],
  ]) {
    const fonte = ler(arq);
    assert.ok(
      fonte.includes(`estiloDePainel?.('${pfx}')`),
      `${arq} nao pede o desenho ao nucleo`,
    );
    const css = fonte.slice(fonte.indexOf('const CSS ='), fonte.indexOf("].join('')"));
    for (const regra of [`.${pfx}-barra{`, `.${pfx}-status{`, `.${pfx}-x{`, `.${pfx} h4{`])
      assert.ok(!css.includes(regra), `${arq} voltou a copiar ${regra}`);
    assert.ok(!css.includes('z-index'), `${arq} escolhe o andar por conta propria`);
    assert.match(fonte, /globalThis\.PPX\?\.painel\?\.\(painel, \{/, `${arq} nao se registra no nucleo`);
    // E nao volta a escrever o que o nucleo faz: eram cinco copias de arrasto, cada uma com
    // `mousedown` na janela — que perde o arrasto se o ponteiro sair dela — e cinco copias de
    // "aplicar a posicao", todas em pixels do canto de cima a' esquerda.
    for (const copia of ['function arrastarPor', 'function aplicarPosicao'])
      assert.ok(!fonte.includes(copia), `${arq} voltou a escrever ${copia}`);
    // E recoloca-se ao aparecer: escondido nao tem caixa para medir, e se a janela mudou de
    // tamanho enquanto ele estava fora, e' nesse momento que o canto guardado volta a valer.
    assert.match(fonte, /recolocar\(\);/, `${arq} nao se recoloca ao aparecer`);
    assert.ok(!fonte.includes("addEventListener('mousemove'"), `${arq} arrasta pela janela`);
  }
});

test('os cinco minimizam, e procuram o proprio botao pela classe', () => {
  // `.PFX-barra button` era o PRIMEIRO botao da barra: funcionava por acidente de ordem, e um
  // botao novo antes dele poria o `–` no `×`. E a Loja — o painel mais alto dos cinco — era o
  // unico que nao minimizava.
  for (const [arq, pfx] of [
    ['cacadas.js', 'cjx'],
    ['escada.js', 'esx'],
    ['times.js', 'tmx'],
    ['loja.js', 'ljx'],
    ['arrumar.js', 'arx'],
  ]) {
    const fonte = ler(arq);
    assert.ok(fonte.includes(`'${pfx}-x ${pfx}-min'`), `${arq} nao tem botao de minimizar`);
    assert.ok(
      fonte.includes(`querySelector('.${pfx}-min')`),
      `${arq} procura o botao de minimizar pela posicao`,
    );
    assert.ok(
      !fonte.includes(`querySelector('.${pfx}-barra button')`),
      `${arq} ainda procura o primeiro botao da barra`,
    );
  }
});

test('painel registado vem para a frente ao ser tocado e ao receber foco', () => {
  const n = montarNucleo();
  const el = painelEm(100, 100);

  n.PPX.painel(el);
  assert.ok(el.ouvintes.mousedown?.length, 'nao ouve o clique');
  assert.ok(el.ouvintes.focusin?.length, 'nao ouve o foco');

  el.ouvintes.mousedown[0]();
  const z = Number(el.style.zIndex);
  el.ouvintes.focusin[0]();

  assert.ok(z > 0 && Number(el.style.zIndex) > z);
});

// --- o recorte quando a janela encolhe ------------------------------------------------------
//
// O LionMultInstance rearranja as views a toda a hora, e isso encolhe a janela. As janelinhas
// aplicavam a posicao guardada so' na montagem: encolher depois deixava o painel pendurado para
// fora, sem jeito de o arrastar de volta ate' um F5.

test('janela encolhe: quem estava num canto volta ao mesmo canto, nao ao mesmo pixel', () => {
  // E' isto que `canto` resolve e que pixels do canto de cima a' esquerda nao resolvem. Em
  // 1920x863, um painel de 248x300 a (1654, 539) esta' a 18 da direita e a 24 de baixo. Numa
  // janela de 1280x700 ele tem de continuar a 18 e a 24 — e nao a 1654, que ja' nao existe.
  const n = montarNucleo({ jaMonta: true });
  const el = painelEm(1654, 539, 248, 300);

  n.PPX.painel(el, { pos: { x: 18, y: 24, direita: true, baixo: true } });
  assert.equal(el.style.left, `${1920 - 248 - 18}px`, 'nao aplicou o canto na montagem');

  n.tela(1280, 700);
  n.disparar('resize');

  assert.equal(el.style.left, `${1280 - 248 - 18}px`);
  assert.equal(el.style.top, `${700 - 300 - 24}px`);
});

test('quem nunca foi arrastado nao e tocado: o canto do CSS dele ja e relativo a borda', () => {
  const n = montarNucleo({ jaMonta: true });
  const el = painelEm(300, 200);

  n.PPX.painel(el);
  n.tela(600, 400);
  n.disparar('resize');

  assert.equal(el.style.left, '300px', 'mexeu em quem nao tinha lugar guardado');
  assert.equal(el.style.top, '200px');
});

test('escondido nao se posiciona pelo zero: quem o mostra e que o recoloca', () => {
  // Escondido nao tem caixa para medir, e posicionar pelo zero mandava-o para o canto de cima a'
  // esquerda — e' o mesmo cuidado que o menu deste nucleo ja' tinha. Por isso `painel` devolve
  // um `recolocar`, e o modulo chama-o quando o painel volta a' vista.
  const n = montarNucleo({ jaMonta: true });
  const semCaixa = painelEm(1700, 700, 0, 0);

  const recolocar = n.PPX.painel(semCaixa, { pos: { x: 18, y: 24, direita: true, baixo: true } });

  assert.equal(semCaixa.style.left, '1700px', 'posicionou um painel sem caixa');
  assert.equal(recolocar(), false, 'disse que recolocou um painel sem caixa');
});

test('arrastar guarda o canto e encaixa o painel nele', () => {
  const n = montarNucleo({ jaMonta: true });
  const el = painelEm(300, 200, 248, 300);
  const alca = painelEm(300, 200, 100, 20);
  const guardados = [];

  n.PPX.painel(el, { alca, guardar: (p) => guardados.push(p) });

  // Pegar, andar o suficiente para nao ser um clique, e soltar.
  alca.ouvintes.pointerdown[0]({ button: 0, clientX: 310, clientY: 210, pointerId: 1, preventDefault() {} });
  alca.ouvintes.pointermove[0]({ clientX: 1000, clientY: 600, pointerId: 1 });
  alca.ouvintes.pointerup[0]({ pointerId: 1 });

  assert.equal(guardados.length, 1, 'nao guardou o lugar ao soltar');
  const pos = guardados[0];
  assert.equal(pos.direita, true, 'nao mediu pela borda mais proxima');
  assert.equal(pos.baixo, true);
  // E o painel ficou encaixado exatamente no canto que foi guardado.
  assert.equal(el.style.left, `${1920 - 248 - pos.x}px`);
  assert.equal(el.style.top, `${863 - 300 - pos.y}px`);
});

test('arrastar menos de 4px e um clique, nao um arrasto', () => {
  // Sem o limiar, clicar na barra para trazer o painel para a frente gravava um lugar novo.
  const n = montarNucleo({ jaMonta: true });
  const el = painelEm(300, 200, 248, 300);
  const alca = painelEm(300, 200, 100, 20);
  const guardados = [];

  n.PPX.painel(el, { alca, guardar: (p) => guardados.push(p) });
  alca.ouvintes.pointerdown[0]({ button: 0, clientX: 310, clientY: 210, pointerId: 1, preventDefault() {} });
  alca.ouvintes.pointermove[0]({ clientX: 311, clientY: 211, pointerId: 1 });
  alca.ouvintes.pointerup[0]({ pointerId: 1 });

  assert.deepEqual(guardados, []);
  assert.equal(el.style.left, '300px');
});

test('estiloDePainel recusa prefixo que nao seja nome de classe', () => {
  // O prefixo entra numa folha de estilo: deixar passar pontuacao seria deixar escrever regra.
  const { PPX } = montarNucleo();
  assert.equal(PPX.estiloDePainel(''), '');
  assert.equal(PPX.estiloDePainel(null), '');
  assert.ok(!PPX.estiloDePainel('a{}b').includes('{}b'));
});

test('painel nao se engasga com o que nao e elemento', () => {
  const { PPX } = montarNucleo();
  // Devolve sempre algo chamavel: o modulo guarda o `recolocar` e chama-o ao mostrar o painel.
  assert.equal(PPX.painel(null)(), false);
  assert.equal(PPX.painel({})(), false);
});

test('botao dentro da barra continua a responder ao clique', () => {
  // A barra que se arrasta leva o `–` e o `×` dentro dela. Capturar o ponteiro no `pointerdown`
  // levava o `click` deles para a barra: fechar e minimizar deixaram de fazer nada, em todos os
  // cinco paineis de uma vez. O menu do nucleo escapou porque a alca dele e' so' o `⠿`.
  const n = montarNucleo({ jaMonta: true });
  const el = painelEm(300, 200, 248, 300);
  const alca = painelEm(300, 200, 248, 24);
  const bt = botaoDeMentira();
  const guardados = [];

  n.PPX.painel(el, { alca, guardar: (p) => guardados.push(p) });
  alca.ouvintes.pointerdown[0]({
    button: 0,
    target: bt,
    clientX: 310,
    clientY: 210,
    pointerId: 1,
    preventDefault() {
      bt.cancelado = true;
    },
  });
  alca.ouvintes.pointermove[0]({ clientX: 500, clientY: 400, pointerId: 1 });
  alca.ouvintes.pointerup[0]({ pointerId: 1 });

  assert.deepEqual(alca.capturas, [], 'capturou o ponteiro num aperto de botao');
  assert.equal(bt.cancelado, false, 'cancelou o pointerdown do botao');
  assert.equal(el.style.left, '300px', 'arrastou o painel a partir do botao');
  assert.deepEqual(guardados, [], 'guardou um lugar novo por causa de um clique no botao');
});

test('a captura do ponteiro so entra quando ja e arrasto', () => {
  // A captura e' o que faz o arrasto sobreviver ao ponteiro sair da janela — e e' tambem o que
  // desvia o `click`. Por isso ela espera o limiar: enquanto pode ser um clique, nao se captura.
  const n = montarNucleo({ jaMonta: true });
  const el = painelEm(300, 200, 248, 300);
  const alca = painelEm(300, 200, 248, 24);

  n.PPX.painel(el, { alca });
  alca.ouvintes.pointerdown[0]({
    button: 0,
    target: alca,
    clientX: 310,
    clientY: 210,
    pointerId: 7,
    preventDefault() {},
  });
  alca.ouvintes.pointermove[0]({ clientX: 311, clientY: 211, pointerId: 7 });
  assert.deepEqual(alca.capturas, [], 'capturou antes de o ponteiro ter andado 4px');

  alca.ouvintes.pointermove[0]({ clientX: 600, clientY: 500, pointerId: 7 });
  assert.deepEqual(alca.capturas, [7], 'nao capturou ao comecar o arrasto de verdade');

  alca.ouvintes.pointermove[0]({ clientX: 700, clientY: 520, pointerId: 7 });
  assert.deepEqual(alca.capturas, [7], 'capturou outra vez a cada passo do arrasto');

  alca.ouvintes.pointerup[0]({ pointerId: 7 });
  assert.deepEqual(alca.soltas, [7], 'nao soltou o ponteiro no fim do arrasto');
});

test('clique que nunca capturou nao tenta soltar o ponteiro', () => {
  const n = montarNucleo({ jaMonta: true });
  const el = painelEm(300, 200, 248, 300);
  const alca = painelEm(300, 200, 248, 24);

  n.PPX.painel(el, { alca });
  alca.ouvintes.pointerdown[0]({
    button: 0,
    target: alca,
    clientX: 310,
    clientY: 210,
    pointerId: 3,
    preventDefault() {},
  });
  alca.ouvintes.pointerup[0]({ pointerId: 3 });

  assert.deepEqual(alca.soltas, [], 'soltou um ponteiro que nunca foi capturado');
});

test('pegador que e ele proprio um botao continua a arrastar-se', () => {
  // E' a abinha do menu: ela e' um `button`, arrasta-se e, parada, abre o menu. Um guarda que
  // olhasse so' "ha' um botao aqui?" tirava-lhe o arrasto.
  const n = montarNucleo({ jaMonta: true });
  const el = painelEm(300, 200, 248, 300);
  const alca = painelEm(300, 200, 90, 24, { clicavel: true });
  const guardados = [];

  n.PPX.painel(el, { alca, guardar: (p) => guardados.push(p) });
  alca.ouvintes.pointerdown[0]({
    button: 0,
    target: alca,
    clientX: 310,
    clientY: 210,
    pointerId: 2,
    preventDefault() {},
  });
  alca.ouvintes.pointermove[0]({ clientX: 900, clientY: 600, pointerId: 2 });
  alca.ouvintes.pointerup[0]({ pointerId: 2 });

  assert.equal(guardados.length, 1, 'o pegador-botao deixou de arrastar');
  assert.notEqual(el.style.left, '300px');
});
