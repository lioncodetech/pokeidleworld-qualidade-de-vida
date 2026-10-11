// Guardas do "arrumar os painéis".
//
// O que se testa aqui nao e' o desenho — e' a conta dos cantos e, sobretudo, **quem e' dono do
// que**: a posicao de um painel mora na chave do modulo dele, e este modulo escreve la' sem
// pisar no resto do que aquele modulo guarda. Um "arrumar" que apagasse os times guardados
// seria pior do que nao arrumar nada.
//
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { montarNucleo } from './nucleo-de-mentira.mjs';

const fonte = readFileSync(new URL('../arrumar.js', import.meta.url), 'utf8');

/**
 * Um no' de mentira cuja caixa SEGUE o `style`.
 *
 * Isto deixou de ser detalhe quando a posicao passou a ser medida pelo `canto` do nucleo: ele
 * le' `getBoundingClientRect`, e uma caixa que ignora o `style` faria o teste medir sempre a
 * mesma coisa, aplicasse-se o que se aplicasse. `tamanho` null e' o painel sem caixa — fechado.
 */
function noDom(tamanho = { width: 248, height: 300 }) {
  const el = {
    style: {},
    classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
    className: '',
    textContent: '',
    filhos: [],
    appendChild(x) {
      el.filhos.push(x);
      return x;
    },
    append(...xs) {
      el.filhos.push(...xs);
    },
    ouvintes: {},
    addEventListener(tipo, fn) {
      (el.ouvintes[tipo] = el.ouvintes[tipo] || []).push(fn);
    },
    removeEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    getBoundingClientRect: () => {
      if (!tamanho) return { x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
      const x = parseFloat(el.style.left) || 0;
      const y = parseFloat(el.style.top) || 0;
      return {
        x,
        y,
        left: x,
        top: y,
        right: x + tamanho.width,
        bottom: y + tamanho.height,
        width: tamanho.width,
        height: tamanho.height,
      };
    },
    remove() {},
    click() {},
  };
  return el;
}

const CHAVES = {
  '.cjx': 'lioncode:pokeidleworld:cacadas',
  '.esx': 'lioncode:pokeidleworld:escada',
  '.tmx': 'lioncode:pokeidleworld:times',
  '.ljx': 'lioncode:pokeidleworld:loja:cfg',
};

/**
 * @param naTela quais paineis estao desenhados agora
 * @param guardado o que cada modulo ja' tem na chave dele
 * @param tela o tamanho da janela
 * @param semArmazenamento o `localStorage` a recusar escrita, como numa janela anonima
 */
function montar({
  naTela = ['.cjx', '.esx', '.tmx', '.ljx'],
  guardado = {},
  tela = { w: 1920, h: 863 },
  semArmazenamento = false,
  tamanhos = {},
  semCanto = false,
} = {}) {
  const loja = { ...guardado };
  const paineis = {};
  for (const sel of naTela) paineis[sel] = noDom(tamanhos[sel]);

  // O que o modulo dono de cada painel faz na montagem: po-e o painel no canto guardado dele.
  // Sem isto a tela e a chave diriam coisas diferentes logo a' partida, o que nao acontece no
  // jogo e faria estes testes medirem um estado impossivel.
  const nucleo = montarNucleo({ tela: { w: tela.w, h: tela.h } });
  for (const [sel, chave] of Object.entries(CHAVES)) {
    const el = paineis[sel];
    if (!el) continue;
    try {
      nucleo.PPX.canto.aplicar(el, nucleo.PPX.canto.doGuardado(JSON.parse(loja[chave] || '{}').pos));
    } catch {
      /* chave ilegivel: o painel fica onde o CSS dele pede */
    }
  }
  const ouvintes = {};
  const corpo = noDom();
  let andar = 2000000000;

  const doc = {
    querySelector: (sel) => paineis[sel] || null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    createElement: () => noDom(),
    head: noDom(),
    documentElement: noDom(),
    body: corpo,
  };

  // O modulo pede a frente por `globalThis.PPX`, nao pelo parametro — e' como o nucleo o serve
  // em producao. A banca tem de servir pelo mesmo caminho, senao o teste mede o parametro.
  const ppx = {
    modulo: (meta, fn) => fn(),
    anotar: () => {},
    controlar: () => {},
    // O `frente` e o `painel` do nucleo, reduzidos ao que importa aqui: um numero sempre maior,
    // e o engate dos dois eventos. Copiar a regra do nucleo seria testar a copia — o guarda de
    // que o nucleo faz isto mesmo esta' em `frente.test.mjs`.
    frente: (el) => {
      if (!el?.style) return null;
      andar += 1;
      el.style.zIndex = String(andar);
      return andar;
    },
    painel: (el) => {
      const aFrente = () => ppx.frente(el);
      el.addEventListener('mousedown', aFrente, true);
      el.addEventListener('focusin', aFrente, true);
    },
    estiloDePainel: () => '',
    // O `canto` de verdade, do nucleo: e' a conta que decide onde cada painel fica, e uma copia
    // dela aqui testaria a copia.
    canto: semCanto ? undefined : nucleo.PPX.canto,
  };
  globalThis.PPX = ppx;

  const mod = { exports: {} };
  new Function(
    'PPX',
    'document',
    'localStorage',
    'addEventListener',
    'removeEventListener',
    'innerWidth',
    'innerHeight',
    'module',
    fonte,
  )(
    ppx,
    doc,
    {
      getItem: (k) => loja[k] ?? null,
      setItem: (k, v) => {
        if (semArmazenamento) throw new Error('sem espaço');
        loja[k] = v;
      },
    },
    (tipo, fn) => {
      (ouvintes[tipo] = ouvintes[tipo] || []).push(fn);
    },
    () => {},
    tela.w,
    tela.h,
    mod,
  );

  return {
    api: mod.exports,
    loja,
    lido: (k) => JSON.parse(loja[k] || '{}'),
    estilo: (sel) => paineis[sel]?.style,
    // Arrastar um painel sem gravar nada: e' o estado real entre pegar e soltar.
    mover: (sel, x, y) => {
      paineis[sel].style.left = `${x}px`;
      paineis[sel].style.top = `${y}px`;
    },
    // O proprio painel do "arrumar", para conferir quem fica no modo minimizado.
    meuPainel: () => corpo.filhos.find((f) => f.className === 'arx') || null,
    disparar: (tipo, ev) => (ouvintes[tipo] || []).forEach((f) => f(ev)),
  };
}

const SINAL = 'lioncode:pokeidleworld:arrumar:sinal';
const MEU = 'lioncode:pokeidleworld:arrumar';

/** Uma chave de modulo com a posicao dada, como o arrasto a deixaria. */
const comPos = (x, y, extra = {}) => JSON.stringify({ ...extra, pos: { x, y } });


test('arruma os quatro, no DOM e na chave de cada dono', () => {
  const p = montar();

  const frase = p.api.arrumar();

  assert.match(frase, /4 painéis arrumados na tela\./);
  for (const [sel, chave] of Object.entries(CHAVES)) {
    const pos = p.lido(chave).pos;
    assert.ok(pos, `${sel} nao guardou posicao`);
    assert.equal(p.estilo(sel).left, `${pos.x}px`, `${sel} nao se mexeu na tela`);
    assert.equal(p.estilo(sel).top, `${pos.y}px`);
    // Quem nasceu preso a' direita e' solto de la': misturar `right` com `left` foi o que fez
    // um painel nascer num canto e acordar noutro.
    assert.equal(p.estilo(sel).right, 'auto');
    assert.equal(p.estilo(sel).bottom, 'auto');
  }
});

test('nao pisa no que o modulo dono ja guardava', () => {
  // Esta e' a guarda que importa: a chave dos Times tem os times guardados. Escrever a posicao
  // por cima dela, em vez de dentro dela, apagaria equipes inteiras.
  const p = montar({
    guardado: {
      'lioncode:pokeidleworld:times': JSON.stringify({
        times: { Hunt: ['Charizard | IV 149/192 · Lendária'] },
        ordem: true,
        pos: { x: 1, y: 1 },
      }),
    },
  });

  p.api.arrumar();

  const times = p.lido('lioncode:pokeidleworld:times');
  assert.deepEqual(times.times, { Hunt: ['Charizard | IV 149/192 · Lendária'] });
  assert.equal(times.ordem, true);
  assert.notDeepEqual(times.pos, { x: 1, y: 1 }, 'a posicao mudou');
});

test('painel fechado e arrumado na chave, para voltar no lugar certo', () => {
  const p = montar({ naTela: ['.cjx'] });

  const frase = p.api.arrumar();

  assert.match(frase, /1 painel arrumado na tela; 3 fechados esperam no lugar certo\./);
  for (const chave of Object.values(CHAVES)) assert.ok(p.lido(chave).pos, chave);
});

test('os cantos nao se sobrepoem, e ficam fora do que o jogo ocupa', () => {
  // Medido em 10/10/2026 numa tela de 1920x863: HUD `x 16-262, y 16-426`, barra `y 16-72`,
  // chat `x 14-342, y 613-849`, painel de captura do jogo `x 1644-1908, y 599-767`.
  const p = montar();
  p.api.arrumar();

  const caixas = p.api.PAINEIS.map((d) => {
    const pos = p.lido(d.chave).pos;
    // Altura generosa de proposito: um painel cheio e' mais alto do que o que se ve' fechado.
    return { nome: d.nome, x1: pos.x, y1: pos.y, x2: pos.x + d.largura, y2: pos.y + 300 };
  });

  const bate = (a, b) => a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
  for (let i = 0; i < caixas.length; i += 1)
    for (let j = i + 1; j < caixas.length; j += 1)
      assert.ok(!bate(caixas[i], caixas[j]), `${caixas[i].nome} em cima de ${caixas[j].nome}`);

  const doJogo = [
    { nome: 'HUD', x1: 16, y1: 16, x2: 262, y2: 426 },
    { nome: 'barra', x1: 274, y1: 16, x2: 1646, y2: 72 },
    { nome: 'chat', x1: 14, y1: 613, x2: 342, y2: 849 },
    { nome: 'captura do jogo', x1: 1644, y1: 599, x2: 1908, y2: 767 },
  ];
  for (const nosso of caixas)
    for (const dele of doJogo)
      assert.ok(!bate(nosso, dele), `${nosso.nome} em cima d${dele.nome === 'HUD' ? 'o' : 'o'} ${dele.nome}`);
});

test('tela estreita: ninguem vai parar fora dela', () => {
  // Com a janela encolhida, o canto da direita cai em x negativo — e um painel fora da tela e'
  // um painel perdido, porque nem se consegue arrasta-lo de volta.
  const p = montar({ tela: { w: 420, h: 300 } });

  p.api.arrumar();

  for (const d of p.api.PAINEIS) {
    const pos = p.lido(d.chave).pos;
    assert.ok(pos.x >= 0 && pos.x <= 420 - 60, `${d.nome} em x ${pos.x}`);
    assert.ok(pos.y >= 0 && pos.y <= 300 - 40, `${d.nome} em y ${pos.y}`);
  }
});

test('sem poder guardar, move na tela e avisa que nao fica', () => {
  const p = montar({ semArmazenamento: true });

  const frase = p.api.arrumar();

  assert.match(frase, /Não consegui guardar/);
  assert.match(frase, /voltam ao antigo no F5/);
  assert.equal(p.estilo('.cjx').left, '1654px', 'mesmo assim se mexeu');
});

test('chave ilegivel nao derruba a arrumacao dos outros', () => {
  const p = montar({ guardado: { 'lioncode:pokeidleworld:escada': '{isto nao e json' } });

  const frase = p.api.arrumar();

  assert.match(frase, /Escada de caçadas/);
  assert.ok(p.lido('lioncode:pokeidleworld:cacadas').pos, 'os outros foram arrumados');
});

// --- arrumações com nome ------------------------------------------------------------------
//
// A partir daqui o assunto e' outro: o canto medido e' so' o ponto de partida, e quem joga em
// dois monitores quer o lugar dele de volta. O que se testa e' que "guardar" le' onde os paineis
// **estao** e que "aplicar" os po-e de volta sem apagar o que o modulo dono guarda.

test('guardar le a posicao de onde os paineis estao, e aplicar devolve-os para la', () => {
  const p = montar({
    guardado: {
      'lioncode:pokeidleworld:cacadas': comPos(700, 200),
      'lioncode:pokeidleworld:escada': comPos(960, 210),
      'lioncode:pokeidleworld:times': comPos(700, 520),
      'lioncode:pokeidleworld:loja:cfg': comPos(960, 530),
    },
  });

  assert.match(p.api.guardarArranjo('dois monitores'), /“dois monitores” guardada com 4 painéis\./);
  assert.deepEqual(p.api.nomesDosArranjos(), ['dois monitores']);

  // Desarruma tudo e volta. O que se mede e' o lugar na TELA: o que fica guardado e' a distancia
  // ate' a borda mais proxima, e comparar esses numeros seria testar a forma, nao o resultado.
  p.api.arrumar();
  assert.notEqual(p.estilo('.cjx').left, '700px');

  const frase = p.api.usarArranjo('dois monitores');

  assert.match(frase, /4 painéis arrumados na tela/);
  assert.equal(p.estilo('.cjx').left, '700px');
  assert.equal(p.estilo('.cjx').top, '200px');
  assert.equal(p.estilo('.ljx').left, '960px');
  assert.equal(p.estilo('.ljx').top, '530px');
  assert.equal(p.estilo('.tmx').left, '700px');
  assert.equal(p.estilo('.tmx').top, '520px');
});

test('o lugar guardado e a distancia ate a borda mais proxima, nao o pixel', () => {
  // E' o ponto da migracao para o `canto` do nucleo. Pixels do canto de cima a' esquerda nao
  // sobrevivem a encolher a janela — e o LionMultInstance encolhe a janela a toda a hora.
  const p = montar({ tela: { w: 1920, h: 863 } });
  // Um painel no canto de baixo a' direita: 248x300 em (1650, 540).
  p.mover('.cjx', 1650, 540);

  p.api.guardarArranjo('canto de baixo');
  const guardado = p.api.cfg.arranjos['canto de baixo'].cacadas;

  assert.equal(guardado.direita, true, 'nao percebeu de que lado ele esta');
  assert.equal(guardado.baixo, true, 'nao percebeu que ele esta em baixo');
  assert.equal(guardado.x, 1920 - 1650 - 248);
  assert.equal(guardado.y, 863 - 540 - 300);
});

test('a tela manda sobre a chave: guarda onde o painel esta agora', () => {
  // O arrasto só grava ao soltar. Um painel movido e ainda nao gravado esta' onde se ve', e e'
  // esse lugar que "guardar onde estao" tem de guardar — senao o botao guarda o passado.
  const p = montar({ guardado: { 'lioncode:pokeidleworld:cacadas': comPos(10, 10) } });
  assert.equal(p.estilo('.cjx').left, '10px', 'a montagem nao aplicou a chave');

  p.mover('.cjx', 444, 333);
  p.api.guardarArranjo('agora');

  // Desarruma e volta: se tivesse guardado a chave (10,10) em vez da tela, voltaria para la'.
  p.api.arrumar();
  p.api.usarArranjo('agora');

  assert.equal(p.estilo('.cjx').left, '444px', 'guardou a chave, nao onde o painel estava');
  assert.equal(p.estilo('.cjx').top, '333px');
});

test('aplicar nao pisa no que o modulo dono guarda', () => {
  const p = montar({
    guardado: {
      'lioncode:pokeidleworld:times': comPos(700, 520, {
        times: { Hunt: ['Charizard | IV 149/192 · Lendária'] },
      }),
    },
  });
  p.api.guardarArranjo('meu');
  p.api.arrumar();

  p.api.usarArranjo('meu');

  const times = p.lido('lioncode:pokeidleworld:times');
  assert.deepEqual(times.times, { Hunt: ['Charizard | IV 149/192 · Lendária'] });
  assert.equal(p.estilo('.tmx').left, '700px', 'nao voltou para o lugar');
  assert.equal(p.estilo('.tmx').top, '520px');
  assert.ok(times.pos, 'a posicao nao ficou na chave');
});

test('monitor grande para monitor pequeno: quem estava num canto fica no mesmo canto', () => {
  // Este e' o caso que faz a arrumacao viajar e dar prejuizo: guardada em 1920x863, aplicada num
  // portatil de 1280x700. Com pixels do canto de cima a' esquerda, um painel a 1800 nascia fora
  // da tela; com a distancia ate' a borda, ele nasce a 18 da direita, que e' onde estava.
  const p = montar();
  p.mover('.cjx', 1920 - 248 - 18, 863 - 300 - 24);
  p.api.guardarArranjo('grande');

  const q = montar({
    guardado: { [MEU]: JSON.stringify(p.api.cfg), 'lioncode:pokeidleworld:cacadas': '{}' },
    tela: { w: 1280, h: 700 },
  });
  q.api.usarArranjo('grande');

  assert.equal(q.estilo('.cjx').left, `${1280 - 248 - 18}px`);
  assert.equal(q.estilo('.cjx').top, `${700 - 300 - 24}px`);
});

test('apagar tira da lista, e o que nao existe diz-se com nome', () => {
  const p = montar({ guardado: { 'lioncode:pokeidleworld:cacadas': comPos(1, 1) } });
  p.api.guardarArranjo('tarde');

  assert.equal(p.api.apagarArranjo('tarde'), '“tarde” apagada.');
  assert.deepEqual(p.api.nomesDosArranjos(), []);
  assert.equal(p.api.apagarArranjo('tarde'), 'Não tenho a arrumação “tarde”.');
  assert.equal(p.api.usarArranjo('tarde'), 'Não tenho a arrumação “tarde”.');
});

test('guardar sem nome, e sem nada na tela, recusa em vez de guardar vazio', () => {
  const p = montar({ guardado: { 'lioncode:pokeidleworld:cacadas': comPos(1, 1) } });
  assert.match(p.api.guardarArranjo('   '), /Dê um nome/);

  const vazio = montar({ naTela: [] });
  assert.match(vazio.api.guardarArranjo('nada'), /não há o que guardar/);
  assert.deepEqual(vazio.api.nomesDosArranjos(), []);
});

// --- as outras janelas --------------------------------------------------------------------

test('aplicar deixa o recado para as outras janelas, e a caixa desligada cala', () => {
  const p = montar({ guardado: { 'lioncode:pokeidleworld:cacadas': comPos(700, 200) } });
  p.api.guardarArranjo('meu');

  const frase = p.api.usarArranjo('meu');

  assert.match(frase, /Mandei às outras janelas\./);
  assert.deepEqual(
    JSON.parse(p.loja[SINAL]).arranjo.cacadas,
    p.api.cfg.arranjos.meu.cacadas,
    'o recado nao leva a arrumacao que foi aplicada',
  );

  // Dois recados iguais tem de ser dois recados: gravar o mesmo valor nao dispara `storage`
  // nenhum, e mandar de novo e' justamente o que se faz quando a primeira vez nao pegou.
  const antes = p.loja[SINAL];
  p.api.usarArranjo('meu');
  assert.notEqual(p.loja[SINAL], antes, 'o recado repetiu-se igual');

  p.api.cfg.espalhar = false;
  delete p.loja[SINAL];
  assert.doesNotMatch(p.api.usarArranjo('meu'), /outras janelas/);
  assert.equal(p.loja[SINAL], undefined, 'mandou recado com a caixa desligada');
});

test('recado de outra janela arruma esta, e lixo no recado nao mexe em nada', () => {
  const p = montar({ guardado: { 'lioncode:pokeidleworld:cacadas': comPos(5, 5) } });

  p.disparar('storage', {
    key: SINAL,
    newValue: JSON.stringify({ arranjo: { cacadas: { x: 123, y: 456 } }, t: 1 }),
  });

  assert.equal(p.estilo('.cjx').left, '123px');
  assert.equal(p.estilo('.cjx').top, '456px');
  assert.ok(p.lido('lioncode:pokeidleworld:cacadas').pos, 'nao gravou na chave do dono');

  for (const ev of [
    { key: 'outra', newValue: JSON.stringify({ arranjo: { cacadas: { x: 9, y: 9 } } }) },
    { key: SINAL, newValue: 'isto nao e json' },
    { key: SINAL, newValue: JSON.stringify({ arranjo: { cacadas: { x: 'ali', y: null } } }) },
    { key: SINAL, newValue: JSON.stringify({ arranjo: { inventado: { x: 1, y: 2 } } }) },
    { key: SINAL, newValue: null },
  ])
    p.disparar('storage', ev);

  assert.equal(p.estilo('.cjx').left, '123px', 'um recado inválido mexeu no painel');
});

// --- levar para outro navegador -----------------------------------------------------------

test('o codigo exportado entra noutra janela e traz as arrumacoes', () => {
  const p = montar({
    guardado: {
      'lioncode:pokeidleworld:cacadas': comPos(700, 200),
      'lioncode:pokeidleworld:times': comPos(700, 520),
    },
  });
  p.api.guardarArranjo('casa');

  const q = montar();
  assert.deepEqual(q.api.nomesDosArranjos(), []);

  assert.match(q.api.importar(p.api.exportar()), /1 arrumação: casa\./);
  assert.deepEqual(q.api.cfg.arranjos.casa, p.api.cfg.arranjos.casa);
  // Importar da' opcoes, nao muda a tela: quem acabou de colar um codigo nao pediu para os
  // paineis saltarem.
  assert.equal(q.estilo('.cjx').left, undefined);
  assert.deepEqual(q.api.cfg.arranjos, JSON.parse(q.loja[MEU]).arranjos, 'nao ficou gravado');
});

test('codigo torto nao apaga o que ja havia', () => {
  const p = montar({ guardado: { 'lioncode:pokeidleworld:cacadas': comPos(1, 1) } });
  p.api.guardarArranjo('minha');

  assert.match(p.api.importar('nao sou json'), /não é um JSON válido/);
  assert.match(p.api.importar('42'), /não tem arrumação nenhuma/);
  assert.match(p.api.importar('{"arranjos":{"x":{"inventado":{"x":1,"y":2}}}}'), /que eu reconheça/);
  assert.deepEqual(p.api.nomesDosArranjos(), ['minha']);

  // Mapa cru tambem serve: quem cola texto cola o que tem a' mao.
  assert.match(p.api.importar('{"outra":{"loja":{"x":12,"y":34}}}'), /1 arrumação: outra\./);
  assert.deepEqual(p.api.cfg.arranjos.outra, {
    loja: { x: 12, y: 34, direita: false, baixo: false },
  });
});

// --- o atalho e o modo minimizado -----------------------------------------------------------
//
// Aplicar uma arrumação é a ação que se repete — outra janela, outro monitor, um painel
// arrastado por engano. Então ela tem atalho, e sobrevive ao minimizar: um painel compacto que
// escondesse justamente a ferramenta dele só serviria aberto.

const teclaJ = (extra = {}) => ({
  altKey: true,
  ctrlKey: false,
  shiftKey: false,
  code: 'KeyJ',
  key: 'j',
  preventDefault() {},
  stopPropagation() {},
  ...extra,
});

test('Alt+Shift+J aplica a arrumacao escolhida; Alt+J sozinho nao aplica nada', () => {
  const p = montar({ guardado: { 'lioncode:pokeidleworld:cacadas': comPos(700, 200) } });
  p.api.guardarArranjo('meu');
  p.api.arrumar();
  assert.notEqual(p.estilo('.cjx').left, '700px');

  p.disparar('keydown', teclaJ());
  assert.notEqual(p.estilo('.cjx').left, '700px', 'o Alt+J sozinho arrumou');

  p.disparar('keydown', teclaJ({ shiftKey: true }));
  assert.equal(p.estilo('.cjx').left, '700px');
});

test('o atalho funciona com o painel fechado, pela ultima que foi usada', () => {
  // E' o caso de uso: o painel vive minimizado ou fechado, e o atalho tem de bastar. Sem guardar
  // a ultima, a lista nao existe e o atalho nao teria o que aplicar.
  //
  // A ultima usada e' de PROPOSITO a segunda em ordem alfabetica: se fosse a primeira, o teste
  // passaria pela guarda errada — a de "a primeira que houver" — e nao mediria nada.
  const base = montar();
  base.mover('.cjx', 700, 200);
  base.api.guardarArranjo('a-de-cima');
  base.mover('.cjx', 500, 100);
  base.api.guardarArranjo('b-de-baixo');
  base.api.usarArranjo('b-de-baixo');

  const q = montar({
    guardado: {
      [MEU]: JSON.stringify({ ...base.api.cfg, visivel: false }),
      'lioncode:pokeidleworld:cacadas': '{}',
    },
  });
  assert.equal(q.meuPainel(), null, 'o painel foi montado com a ferramenta fechada');

  q.disparar('keydown', teclaJ({ shiftKey: true }));

  assert.equal(q.api.escolhida(), 'b-de-baixo');
  assert.equal(q.estilo('.cjx').left, '500px', 'aplicou a primeira da lista, nao a ultima usada');
});

test('sem nenhuma guardada, o atalho diz o que fazer em vez de calar', () => {
  const p = montar();

  p.disparar('keydown', teclaJ({ shiftKey: true }));

  assert.equal(p.api.escolhida(), '');
  assert.match(p.api.aplicarEscolhida(), /Não há arrumação guardada\..*Guardar onde estão/);
  assert.equal(p.estilo('.cjx').left, undefined, 'mexeu num painel sem ter arrumação');
});

test('o atalho cala-se dentro de um campo de texto', () => {
  // O jogo tem chat: um "J" escrito ali nao e' um comando.
  const p = montar({ guardado: { 'lioncode:pokeidleworld:cacadas': comPos(700, 200) } });
  p.api.guardarArranjo('meu');
  p.api.arrumar();

  p.disparar('keydown', teclaJ({ shiftKey: true, target: { tagName: 'INPUT' } }));
  p.disparar('keydown', teclaJ({ shiftKey: true, target: { isContentEditable: true } }));

  assert.notEqual(p.estilo('.cjx').left, '700px');
});

test('a lista da frente manda sobre a ultima usada', () => {
  const p = montar({ guardado: { 'lioncode:pokeidleworld:cacadas': comPos(700, 200) } });
  p.api.guardarArranjo('a');
  p.api.usarArranjo('a');
  p.api.cfg.arranjos.b = { cacadas: { x: 11, y: 22 } };

  const lista = p.meuPainel().filhos.find((f) => /arx-lista/.test(String(f.className)));
  lista.value = 'b';

  assert.equal(p.api.escolhida(), 'b');
  p.disparar('keydown', teclaJ({ shiftKey: true }));
  assert.equal(p.estilo('.cjx').left, '11px');
});

test('minimizado guarda a lista e o Aplicar, e esconde o resto', () => {
  const p = montar();
  const filhos = p.meuPainel().filhos;
  const temClasse = (c) =>
    filhos.find((f) => String(f.className).split(/\s+/).includes(c)) || null;

  for (const c of ['arx-lista', 'arx-aplicar']) {
    const el = temClasse(c);
    assert.ok(el, `${c} não está no painel`);
    assert.doesNotMatch(String(el.className), /arx-oculto/, `${c} desaparece ao minimizar`);
  }
  // E tudo o que não é isso sai: minimizado é para ficar pequeno.
  for (const c of ['arx-codigo', 'arx-caixa', 'arx-dica', 'arx-sep'])
    assert.match(String(temClasse(c)?.className), /arx-oculto/, `${c} fica no modo minimizado`);

  // O mecanismo: é a regra do CSS que esconde, e sem ela as classes acima não querem dizer nada.
  assert.match(fonte, /\.arx\.compacto \.arx-oculto\{display:none\}/);
});

test('tocar no painel traz-no para a frente dos outros', () => {
  // Com `z-index` empatado quem ganha e' a ordem no DOM — a ordem em que os ficheiros carregam.
  // O painel em que se esta' a mexer ficava atras de outro e so' se resolvia fechando o de cima.
  const p = montar();
  const painel = p.meuPainel();
  assert.ok(painel.ouvintes.mousedown?.length, 'o painel nao ouve o clique');

  const antes = painel.style.zIndex;
  painel.ouvintes.mousedown[0]({});
  const depois = painel.style.zIndex;

  assert.notEqual(depois, antes);
  assert.ok(Number(depois) >= 2000000000, `andar ${depois} abaixo do que o CSS pede`);

  // Tocar de novo sobe outra vez: o andar nao e' "ja' esta' na frente", e' "quem foi o ultimo".
  painel.ouvintes.focusin[0]({});
  assert.ok(Number(painel.style.zIndex) > Number(depois));
});

test('painel fechado: a chave dele e lida como canto, nao como pixel', () => {
  // O painel fechado nao tem caixa, entao o unico lugar que ha' e' a chave dele — e desde a
  // migracao a chave guarda a distancia ate' a borda. Ler `{x: 18, direita: true}` como se
  // fosse 18px da ESQUERDA poria no canto errado justamente o painel que ninguem viu sair.
  const noCantoDeBaixo = JSON.stringify({ pos: { x: 18, y: 24, direita: true, baixo: true } });
  const p = montar({
    naTela: ['.esx'],
    guardado: { 'lioncode:pokeidleworld:cacadas': noCantoDeBaixo },
  });

  p.api.guardarArranjo('do fechado');
  assert.deepEqual(p.api.cfg.arranjos['do fechado'].cacadas, {
    x: 18,
    y: 24,
    direita: true,
    baixo: true,
  });

  // E aplicada noutra tela, a caçada nasce a 18 da direita — nao a 18 da esquerda.
  const q = montar({
    guardado: { [MEU]: JSON.stringify(p.api.cfg), 'lioncode:pokeidleworld:cacadas': '{}' },
    tela: { w: 1280, h: 700 },
  });
  q.api.usarArranjo('do fechado');

  assert.equal(q.estilo('.cjx').left, `${1280 - 248 - 18}px`);
  assert.equal(q.estilo('.cjx').top, `${700 - 300 - 24}px`);
});
