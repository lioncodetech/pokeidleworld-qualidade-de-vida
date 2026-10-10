// Guardas da escada de caçadas.
//
// O que se testa aqui nao e' "viaja" — quem viaja sao as Caçadas, e elas tem os testes delas. O
// que se vigia e' a **decisao**: qual degrau vale para o nivel de agora, quando disparar e,
// sobretudo, quando NAO disparar. Uma escada que dispara de mais fica a viajar em circulos, e um
// jogo a viajar em circulos e' pior do que um jogo parado.
//
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const fonte = readFileSync(new URL('../escada.js', import.meta.url), 'utf8');

/**
 * Um no' de mentira que aguenta ser montado.
 *
 * O painel sobe sozinho ao carregar — e' o que o faz sobreviver ao F5 —, entao o teste precisa
 * de um DOM que aceite ser construido. Nao se testa o desenho aqui.
 */
function noDom() {
  const el = {
    style: {},
    classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
    className: '',
    textContent: '',
    value: '',
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
    querySelector: () => null,
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0 }),
    remove() {},
    click() {},
  };
  return el;
}

/**
 * @param lider nivel do primeiro da equipe; null = HUD ainda nao carregou
 * @param onde onde o jogo diz que o jogador esta'
 * @param degraus a escada guardada
 * @param chega para onde a viagem leva de facto; null = a viagem falha e ninguem sai do lugar
 * @param semCacadas as Caçadas desligadas — a porta `PPX.cacadas` nao existe
 * @param oculto a aba em segundo plano
 */
function montar({
  lider = 10,
  onde = 'Meowth',
  degraus = [],
  ligada = true,
  aplicado = null,
  chega = undefined,
  // O time da escada: ausente = o de cada caçada, '' = nao trocar, um nome = esse.
  time = undefined,
  semCacadas = false,
  oculto = false,
} = {}) {
  let nivel = lider;
  let local = onde;
  const viagens = [];
  // O terceiro argumento de `ir`, como a Escada o mandou. E' por ele que o time do degrau passa.
  const pedidos = [];

  const guardado = {
    'lioncode:pokeidleworld:escada': JSON.stringify({
      degraus,
      ligada,
      aplicado,
      ...(time === undefined ? {} : { time }),
    }),
  };

  const PPX = {
    modulo: (meta, fn) => fn(),
    anotar: () => {},
    controlar: () => {},
  };
  if (!semCacadas)
    PPX.cacadas = {
      cfg: { lista: [{ nome: 'Meowth', time: '' }, { nome: 'Persian', time: '' }] },
      ir: async (nome, _aviso, opcoes) => {
        viagens.push(nome);
        pedidos.push(opcoes);
        if (chega === null) return `Cliquei para viajar, mas o jogo diz "${local}". Confira.`;
        local = chega === undefined ? nome : chega;
        return `Em "${local}".`;
      },
    };
  globalThis.PPX = PPX;

  const doc = {
    get visibilityState() {
      return oculto ? 'hidden' : 'visible';
    },
    querySelector: (sel) => {
      if (sel === '.phud-mon .phud-lv') return nivel === null ? null : { textContent: `Lv.${nivel}` };
      if (sel === '.phud-tloc') return { textContent: `Nível 270 · ${local}` };
      return null;
    },
    querySelectorAll: () => [],
    addEventListener: () => {},
    createElement: () => noDom(),
    head: noDom(),
    documentElement: noDom(),
    body: noDom(),
  };

  const mod = { exports: {} };
  new Function(
    'PPX',
    'document',
    'localStorage',
    'setTimeout',
    'addEventListener',
    'removeEventListener',
    'innerWidth',
    'innerHeight',
    'MutationObserver',
    'module',
    fonte,
  )(
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
    () => {},
    1000,
    800,
    undefined,
    mod,
  );

  return {
    api: mod.exports,
    viagens,
    pedidos,
    guardado,
    ondeEsta: () => local,
    subirPara: (n) => {
      nivel = n;
    },
    // O jogador a mexer-se por conta propria, sem passar pela escada.
    irPara: (nome) => {
      local = nome;
    },
  };
}

const ESCADA = [
  { nivel: 1, cacada: 'Meowth' },
  { nivel: 50, cacada: 'Persian' },
];

// --------------------------------------------------------------- qual degrau vale

test('o degrau e o mais alto que o nivel ja alcancou', () => {
  // Nao e' "o degrau que acabou de passar": e' o estado certo para aquele nivel. A diferenca
  // aparece ao ligar a escada com o lider ja' no Lv 80 — o certo e' ir direto para o de 50.
  const p = montar({ degraus: ESCADA, lider: 80, onde: 'Meowth' });
  assert.equal(p.api.degrauPara(80).cacada, 'Persian');
  assert.equal(p.api.degrauPara(49).cacada, 'Meowth');
  assert.equal(p.api.degrauPara(50).cacada, 'Persian');
});

test('abaixo do primeiro degrau nao ha degrau nenhum', () => {
  const p = montar({ degraus: [{ nivel: 50, cacada: 'Persian' }], lider: 10 });
  assert.equal(p.api.degrauPara(10), null);
});

test('HUD que ainda nao carregou nao e um lider de nivel 1', () => {
  // `null` tem de continuar diferente de zero: tratar os dois como a mesma coisa faria a escada
  // disparar o degrau mais baixo a cada recarga da pagina.
  const p = montar({ lider: null, degraus: ESCADA });
  assert.equal(p.api.nivelLider(), null);
  assert.equal(p.api.degrauPara(null), null);
  assert.deepEqual(p.viagens, []);
});

// --------------------------------------------------------------- quando dispara

test('passando do degrau, viaja', async () => {
  const p = montar({ degraus: ESCADA, lider: 50, onde: 'Meowth', aplicado: 1 });
  await p.api.conferir();
  assert.deepEqual(p.viagens, ['Persian']);
  assert.equal(p.ondeEsta(), 'Persian');
  assert.match(p.guardado['lioncode:pokeidleworld:escada'], /"aplicado":50/);
});

test('o mesmo degrau nao dispara duas vezes', async () => {
  // O HUD bate varias vezes por segundo numa caçada. Sem esta guarda, a escada viajaria para o
  // mesmo lugar sem parar.
  const p = montar({ degraus: ESCADA, lider: 50, onde: 'Meowth', aplicado: 1 });
  await p.api.conferir();
  await p.api.conferir();
  await p.api.conferir();
  assert.deepEqual(p.viagens, ['Persian'], 'uma viagem, nao tres');
});

test('degrau ja cumprido nao te arrasta de volta', async () => {
  // Este e' o caso que a guarda de "ja' estar la'" nao cobre, e por isso o degrau cumprido fica
  // guardado: depois de a escada te levar, voce sai dali a mao — para o Mercado, para um ginasio
  // — e a escada tem de deixar. Ela decide quando voce SOBE de degrau, nao onde voce pode estar.
  const p = montar({ degraus: ESCADA, lider: 50, onde: 'Meowth', aplicado: 1 });
  await p.api.conferir();
  assert.deepEqual(p.viagens, ['Persian']);

  p.irPara('Cerulean');
  await p.api.conferir();
  await p.api.conferir();

  assert.deepEqual(p.viagens, ['Persian'], 'nao me trouxe de volta');
  assert.equal(p.ondeEsta(), 'Cerulean');
});

test('ja estar na caçada certa conta como feito', async () => {
  // Quem liga a escada ja' no lugar certo nao precisa de viajar para lado nenhum.
  const p = montar({ degraus: ESCADA, lider: 50, onde: 'Persian' });
  await p.api.conferir();
  assert.deepEqual(p.viagens, []);
  assert.match(p.guardado['lioncode:pokeidleworld:escada'], /"aplicado":50/);
});

test('desligada nao mexe em nada', async () => {
  const p = montar({ degraus: ESCADA, lider: 50, onde: 'Meowth', ligada: false });
  await p.api.conferir();
  assert.deepEqual(p.viagens, []);
});

test('aba oculta nao viaja', async () => {
  // Com a aba em segundo plano o motor do jogo para: as placas dos NPC somem, a cura fica fora
  // de alcance e o nivel nao sobe. Nao ha' o que perder em esperar a aba voltar.
  const p = montar({ degraus: ESCADA, lider: 50, onde: 'Meowth', oculto: true });
  await p.api.conferir();
  assert.deepEqual(p.viagens, []);
});

test('subir mais um degrau depois do primeiro', async () => {
  const p = montar({
    // Caçadas diferentes de proposito: com a mesma nos dois degraus, o segundo ja' estaria
    // cumprido ao chegar — que e' o certo, mas nao prova que ele disparou.
    degraus: [...ESCADA, { nivel: 120, cacada: 'Charizard' }],
    lider: 50,
    onde: 'Meowth',
    aplicado: 1,
  });
  await p.api.conferir();
  assert.deepEqual(p.viagens, ['Persian']);
  p.subirPara(130);
  await p.api.conferir();
  assert.deepEqual(p.viagens, ['Persian', 'Charizard'], 'o degrau de 120 tambem disparou');
  assert.equal(p.ondeEsta(), 'Charizard');
});

// --------------------------------------------------------------- quando falha

test('viagem que nao acontece nao marca o degrau como feito', async () => {
  // Marcar um degrau que nao aconteceu deixaria o jogador na caçada errada para sempre. A
  // tentativa tem de continuar a valer.
  const p = montar({ degraus: ESCADA, lider: 50, onde: 'Meowth', chega: null });
  await p.api.conferir();
  assert.deepEqual(p.viagens, ['Persian']);
  assert.equal(p.ondeEsta(), 'Meowth');
  assert.doesNotMatch(p.guardado['lioncode:pokeidleworld:escada'], /"aplicado":50/);
});

test('depois de falhar, espera antes de tentar de novo', async () => {
  // Uma equipe desmaiada nao se cura sozinha: tentar de dois em dois segundos nao ajudaria
  // ninguem e encheria o jogo de cliques.
  const p = montar({ degraus: ESCADA, lider: 50, onde: 'Meowth', chega: null });
  await p.api.conferir();
  await p.api.conferir();
  await p.api.conferir();
  assert.deepEqual(p.viagens, ['Persian'], 'nao martelou');
});

test('sem as Caçadas ligadas, diz em vez de tentar', async () => {
  // Quem viaja e' a outra ferramenta. Sem ela nao ha' viagem — e isso tem de ser dito, nao
  // engolido.
  const p = montar({ degraus: ESCADA, lider: 50, onde: 'Meowth', semCacadas: true });
  assert.equal(await p.api.conferir(() => {}), 'sem cacadas');
  assert.deepEqual(p.viagens, []);
});

test('degrau sem caçada escolhida nao leva a lado nenhum', async () => {
  // Antes isto mandava viajar para "" — uma viagem para lugar nenhum, que falhava la' dentro.
  const p = montar({ degraus: [{ nivel: 1, cacada: '' }], lider: 50, onde: 'Meowth' });
  const falas = [];
  await p.api.conferir((t) => falas.push(t));
  assert.deepEqual(p.viagens, [], 'nao tentou viajar');
  assert.match(falas.join(' '), /não tem caçada/, falas.join(' '));
});

// --------------------------------------------------------------- dizer o que esta a fazer
//
// Uma automacao que nao age tem de dizer **o que** esta' a esperar. Parada e calada e'
// indistinguivel de quebrada — e foi assim que esta ferramenta passou a primeira noite.

test('lider abaixo do primeiro degrau: diz isso, e diz o que fazer', async () => {
  // O caso real: lider no Lv 1, degrau mais baixo no Lv 5, jogador parado numa cidade onde o
  // nivel nunca sobe. A regra estava certa; o silencio e' que nao estava.
  const p = montar({ degraus: [{ nivel: 5, cacada: 'Togepi' }], lider: 1, onde: 'Cerulean' });
  const falas = [];

  const r = await p.api.conferir((t) => falas.push(t));

  assert.equal(r, 'nada a fazer');
  assert.deepEqual(p.viagens, []);
  const dito = falas.join(' ');
  assert.match(dito, /Lv 1/, dito);
  assert.match(dito, /Lv 5/, 'tem de dizer qual e o primeiro degrau');
  assert.match(dito, /Lv 1 para começar/, 'tem de dizer como sair do impasse');
});

test('degrau cumprido: diz que voce esta livre para sair', async () => {
  const p = montar({ degraus: ESCADA, lider: 50, onde: 'Cerulean', aplicado: 50 });
  const falas = [];
  await p.api.conferir((t) => falas.push(t));
  assert.deepEqual(p.viagens, []);
  assert.match(falas.join(' '), /já cumprido/, falas.join(' '));
});

test('em cima do degrau certo: diz que esta no lugar', async () => {
  // A ferramenta ja' confere uma vez ao carregar, e por isso o degrau ja' esta' marcado quando
  // o teste pergunta. O que se vigia aqui e' a frase: ela tem de dizer onde se esta' e por causa
  // de que degrau, em vez de ficar muda.
  const p = montar({ degraus: ESCADA, lider: 50, onde: 'Persian' });
  const falas = [];
  await p.api.conferir((t) => falas.push(t));
  assert.deepEqual(p.viagens, []);
  assert.match(falas.join(' '), /em "Persian"/, falas.join(' '));
  assert.match(falas.join(' '), /Lv 50/, falas.join(' '));
});

test('o primeiro degrau nasce no Lv 1', () => {
  // Um degrau mais baixo que o líder nao faz nada. Nascer no Lv 10 — que era o palpite antigo,
  // aplicado tambem ao primeiro — punha a escada parada logo no primeiro uso.
  const vazia = montar({ degraus: [] });
  assert.equal(vazia.api.nivelDoProximo(), 1);
});

test('os degraus seguintes sobem de dez em dez', () => {
  const p = montar({ degraus: [{ nivel: 1, cacada: 'Togepi' }, { nivel: 15, cacada: 'Meowth' }] });
  assert.equal(p.api.nivelDoProximo(), 25);
});

// --------------------------------------------------------------- o time da escada
//
// Um time so', para todos os degraus: a escada e' a subida de uma equipe, e sao as caçadas que
// mudam, nao o time. Um seletor por degrau daria para escrever a mesma escolha seis vezes e
// errar numa delas.

test('o time da escada vai em todas as viagens', async () => {
  const p = montar({
    degraus: [
      { nivel: 1, cacada: 'Meowth' },
      { nivel: 50, cacada: 'Persian' },
    ],
    time: 'criar',
    lider: 10,
    onde: 'Cerulean',
  });
  await p.api.conferir();
  p.subirPara(60);
  await p.api.conferir();

  assert.deepEqual(p.viagens, ['Meowth', 'Persian']);
  assert.deepEqual(p.pedidos, [{ time: 'criar' }, { time: 'criar' }], 'o mesmo time nos dois');
});

test('sem time escolhido, cada caçada leva o dela', async () => {
  // Ausente nao e' "sem time": e' "nao tenho opiniao". Se a Escada mandasse '' aqui, ela tiraria
  // o time de todas as caçadas que usasse.
  const p = montar({ degraus: [{ nivel: 1, cacada: 'Meowth' }], lider: 10, onde: 'Cerulean' });
  await p.api.conferir();
  assert.deepEqual(p.pedidos, [{ time: undefined }]);
});

test('"sem trocar o time" e uma ordem, nao uma ausencia', async () => {
  const p = montar({
    degraus: [{ nivel: 1, cacada: 'Meowth' }],
    time: '',
    lider: 10,
    onde: 'Cerulean',
  });
  await p.api.conferir();
  assert.deepEqual(p.pedidos, [{ time: '' }], 'a caçada pedia um time, e a escada disse que nao');
});
