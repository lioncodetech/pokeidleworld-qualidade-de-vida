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
    // Os ouvintes ficam guardados para o teste poder mexer no painel como o dono mexe. O painel
    // sobe de verdade no carregamento; o que faltava era poder tocar-lhe — e e' o interruptor
    // "trocar de caçada sozinha" que decide a adocao do aluno.
    ouvintes: {},
    classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
    className: '',
    value: '',
    // O painel usa estes: `dataset.modo` no seletor de time, `selectedOptions` quando ele muda.
    dataset: {},
    selectedOptions: [],
    filhos: [],
    appendChild(x) {
      if (x) x.pai = el;
      el.filhos.push(x);
      return x;
    },
    append(...xs) {
      for (const x of xs) if (x) x.pai = el;
      el.filhos.push(...xs);
    },
    addEventListener(tipo, fn) {
      (el.ouvintes[tipo] = el.ouvintes[tipo] || []).push(fn);
    },
    removeEventListener() {},
    // Procura por classe na propria arvore. O painel sobe de verdade no carregamento; o que
    // faltava era ele achar as caixas que repinta — e e' dentro de uma delas que mora o campo do
    // teto, um dos tres sitios que adotam o aluno.
    querySelector: (sel) => {
      const alvo = String(sel).replace(/^\./, '');
      const achar = (no) => {
        for (const f of no.filhos || []) {
          if (String(f.className || '').split(/\s+/).includes(alvo)) return f;
          const a = achar(f);
          if (a) return a;
        }
        return null;
      };
      return achar(el);
    },
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0 }),
    // No DOM, `remove()` tira o no' da arvore. Um no-op aqui deixaria o teste do pedido de
    // licenca a passar com o botao ainda pendurado na caixa.
    remove() {
      const irmaos = el.pai?.filhos;
      const i = irmaos ? irmaos.indexOf(el) : -1;
      if (i >= 0) irmaos.splice(i, 1);
      el.pai = null;
    },
    click() {},
  };
  // `textContent = ''` e' como o codigo limpa uma caixa antes de a repintar. No DOM isso leva os
  // filhos; aqui tem de levar tambem, senao cada repintura empilhava uma copia e a procura
  // acharia sempre a primeira — a velha.
  let texto = '';
  Object.defineProperty(el, 'textContent', {
    get: () => texto,
    set: (v) => {
      texto = v;
      if (v === '') el.filhos.length = 0;
    },
  });
  return el;
}

/**
 * @param lider nivel do primeiro da equipe; null = HUD ainda nao carregou
 * @param onde onde o jogo diz que o jogador esta'
 * @param degraus a escada guardada
 * @param chega para onde a viagem leva de facto; null = a viagem falha e ninguem sai do lugar
 * @param semCacadas as Caçadas desligadas — a porta `PPX.cacadas` nao existe
 * @param oculto a aba em segundo plano
 * @param equipe a equipe inteira, `[{ nome, nivel }]`, na ordem do HUD; o primeiro e' o lider
 * @param teto o nivel de formatura; null = sem formatura
 * @param cliqueMudo o clique no HUD nao troca o lider — o jogo mudou por baixo
 * @param aluno de quem e' o degrau cumprido; a escada nunca desce com o mesmo aluno
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
  equipe = null,
  teto = null,
  destino = '',
  formados = false,
  aluno = '',
  // A licenca de mudar de caçada sozinha. Dada por omissao, como na ferramenta.
  trocar = true,
  // O que esta' no armazenamento ANTES de a ferramenta subir, escrito a' mao. Serve para uma
  // coisa que os outros parametros nao conseguem dizer: uma chave que **nao existe**, que e'
  // como esta' o armazenamento de quem ja' tinha a ferramenta instalada.
  cru = null,
  // A ordem em que o time guardado do degrau deixa a equipe depois de uma viagem. E' o que o
  // modulo Times faz no Deposito: monta a equipe INTEIRA, ordem incluida.
  ordemDoTime = null,
  cliqueMudo = false,
  // O HUD do jogo ainda nao esta' na tela. E' assim que a pagina abre, e e' assim que o painel
  // sobe: sem nivel para ler, logo sem como saber que ha' uma licenca para pedir.
  semHud = false,
  // A espera de 5 s que o jogo po-e em todas as outras caixas depois de uma troca.
  esperaDoJogo = false,
  // Qual caixa leva o `active`. No jogo e' sempre a primeira; serve para provar que quem manda
  // e' a classe, e nao o lugar na fila.
  ativoEm = 0,
  catalogo = [],
  tipos = {},
  automatico = false,
  pausada = false,
  pool = [],
  timeAtivo = '',
  timesConcluidos = [],
  timesGuardados = null,
} = {}) {
  let local = onde;
  let escondida = oculto;
  // A equipe e' a fonte da verdade quando ha' uma; senao, um lider so', como nos testes antigos.
  const time6 = equipe ? equipe.map((p) => ({ ...p })) : [{ nome: 'Gloom', nivel: lider }];
  const cliques = [];

  /**
   * As caixas do HUD, como o jogo as desenha — medido em 10/10/2026.
   *
   * Quem esta' a subir leva a classe `active` e o `title` "Nome (ativo)", e **esta' sempre na
   * frente**: clicar numa caixa po-e aquele pokemon no lugar 1 e empurra os outros. Depois de
   * uma troca, as outras caixas passam 5 s dizendo "Troca disponível em 5s", e um clique dentro
   * dessa janela e' recusado sem aviso nenhum.
   */
  const caixas = () => {
    if (!time6[0] || time6[0].nivel === null) return [];
    return time6.map((p, i) => ({
      ativo: i === ativoEm,
      querySelector: (s) =>
        s === '.phud-name'
          ? { textContent: p.nome }
          : s === '.phud-lv'
            ? { textContent: `Lv.${p.nivel}` }
            : null,
      querySelectorAll: (s) => s === 'img[alt]' ? (tipos[p.nome] || []).map((alt) => ({ alt })) : [],
      classList: { contains: (c) => c === 'active' && i === ativoEm },
      getAttribute: (a) =>
        a !== 'title'
          ? null
          : i === ativoEm
            ? `${p.nome} (ativo)`
            : esperaDoJogo
              ? 'Troca disponível em 5s'
              : `Selecionar ${p.nome}`,
      click: () => {
        cliques.push(p.nome);
        if (cliqueMudo || esperaDoJogo) return;
        const j = time6.indexOf(p);
        if (j > 0) time6.unshift(...time6.splice(j, 1));
      },
    }));
  };
  const viagens = [];
  // O terceiro argumento de `ir`, como a Escada o mandou. E' por ele que o time do degrau passa.
  const pedidos = [];

  const guardado = {
    'lioncode:pokeidleworld:escada': cru
      ? JSON.stringify(cru)
      : JSON.stringify({
          degraus,
          ligada,
          aplicado,
          teto,
          destino,
          formados,
          aluno,
              trocar,
          automatico,
          pausada,
          pool,
          timeAtivo,
          timesConcluidos,
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
      todas: () => catalogo,
      ir: async (nome, _aviso, opcoes) => {
        viagens.push(nome);
        pedidos.push(opcoes);
        if (chega === null) return `Cliquei para viajar, mas o jogo diz "${local}". Confira.`;
        local = chega === undefined ? nome : chega;
        // Montar o time do degrau reescreve a equipe, e a ordem dele nao sabe nada de formatura.
        if (ordemDoTime && opcoes?.time)
          time6.sort((a, b) => ordemDoTime.indexOf(a.nome) - ordemDoTime.indexOf(b.nome));
        return `Em "${local}".`;
      },
    };
  const timesMontados = [];
  if (timesGuardados)
    PPX.times = {
      nomes: () => Object.keys(timesGuardados),
      usar: async (nome) => {
        timesMontados.push(nome);
        time6.splice(0, time6.length, ...(timesGuardados[nome] || []).map((p) => ({ ...p })));
        return { ok: true, erro: '' };
      },
    };
  globalThis.PPX = PPX;

  const doc = {
    get visibilityState() {
      return escondida ? 'hidden' : 'visible';
    },
    querySelector: (sel) => {
      if (semHud && String(sel).startsWith('.phud-mon')) return null;
      if (sel === '.phud-mon.active') return caixas().find((c) => c.ativo) || null;
      if (sel === '.phud-mon') return caixas()[0] || null;
      if (sel === '.phud-tloc') return { textContent: `Nível 270 · ${local}` };
      return null;
    },
    querySelectorAll: (sel) => (sel === '.phud-mon' && !semHud ? caixas() : []),
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
    // O modulo chama `conferir()` ao carregar — e' isso que faz a escada agir no F5, e a chamada
    // nao e' esperada por ninguem. Enquanto ela corre, `correndo` cala qualquer outra. Esperar
    // por ela e' esperar pela pagina a acabar de abrir.
    //
    // E' generoso de proposito: a volta pode ter um clique no HUD, uma pausa e uma viagem pelo
    // meio. Quem nao espera o bastante nao ve' so' um teste a falhar — `globalThis.PPX` e' um
    // so', entao a viagem atrasada de um teste aparece nas contas do teste seguinte.
    pronto: () => new Promise((r) => globalThis.setTimeout(r, 30)),
    viagens,
    pedidos,
    timesMontados,
    guardado,
    cliques,
    equipeAgora: () => time6.map((p) => `${p.nome} ${p.nivel}`),
    lider: () => time6[ativoEm]?.nome ?? null,
    ondeEsta: () => local,
    // Deixa o teste abrir a aba depois do carregamento: com ela escondida, a volta do
    // carregamento nao faz nada, e o que se mede a seguir e' so' a chamada do teste.
    verAba: (sim) => {
      escondida = !sim;
    },
    subirPara: (n) => {
      time6[0].nivel = n;
    },
    // O HUD a chegar depois do painel, que e' a ordem real de uma pagina a abrir.
    chegarHud: () => {
      semHud = false;
    },
    resumo: () => doc.body.querySelector('.esx-resumo'),
    // O jogador a mexer-se por conta propria, sem passar pela escada.
    irPara: (nome) => {
      local = nome;
    },
    /**
     * Clica no botao Iniciar/Parar, como o dono clica.
     *
     * Iniciar nao e' so' gravar `ligada`: e' o momento em que a escada **adota** o aluno, e e'
     * por isso que isto se testa pelo botao e nao pela chave.
     */
    clicarIniciar: () => {
      const bt = doc.body.querySelector('.esx-ir');
      if (!bt) throw new Error('nao achei o botao Iniciar no painel');
      for (const f of bt.ouvintes.click || []) f({});
    },
    botaoIniciar: () => doc.body.querySelector('.esx-ir'),
    /**
     * Mexe na caixa "trocar de caçada sozinha", que e' a LICENCA de viajar — e nao o arranque.
     * A caixa acha-se pelo `type` porque ela e' a unica do painel.
     */
    /**
     * Escreve no campo "Formar no Lv", como o dono escreve.
     *
     * Este e' o terceiro momento de adocao: um teto escrito ABAIXO do lider de agora nao pode
     * forma-lo de surpresa — foi assim que o defeito nasceu.
     */
    escreverTeto: (n) => {
      const campo = doc.body.querySelector('.esx-teto');
      if (!campo) throw new Error('nao achei o campo do teto no painel');
      campo.value = String(n);
      for (const f of campo.ouvintes.change || []) f({});
    },
    caixaTrocar: (sim) => {
      const achar = (no) => {
        if (no?.type === 'checkbox') return no;
        for (const f of no?.filhos || []) {
          const a = achar(f);
          if (a) return a;
        }
        return null;
      };
      const cx = achar(doc.body);
      if (!cx) throw new Error('nao achei a caixa de ligar no painel');
      cx.checked = sim;
      for (const f of cx.ouvintes.change || []) f({});
    },
  };
}

test('seletor da escada usa o catalogo completo das Cacadas', () => {
  assert.match(fonte, /PPX\?\.cacadas\?\.todas\?\.\(\)/);
  assert.match(fonte, /createElement\('datalist'\)/);
  assert.match(fonte, /esx-cacadas-do-jogo/);
  assert.match(fonte, /c\.trancada \? 'trancada'/);
});

test('modo compacto esconde degraus, pool e configuracoes', () => {
  assert.match(fonte, /\.esx\.compacto \.esx-lista/);
  assert.match(fonte, /\.esx\.compacto \.esx-timebox/);
  assert.match(fonte, /\.esx\.compacto \.esx-auto/);
  assert.match(fonte, /pool \$\{cfg\.timesConcluidos\.length\}\/\$\{cfg\.pool\.length\}/);
});

test('modo automatico escolhe hunt do nivel pedido com vantagem de tipo', async () => {
  const p = montar({
    lider: 30,
    onde: 'Meowth',
    automatico: true,
    degraus: [{ nivel: 30, nivelHunt: 20, cacada: '' }],
    tipos: { Gloom: ['GRASS'] },
    catalogo: [
      { nome: 'Geodude', nivel: 20, tipos: ['ROCK', 'GROUND'], trancada: false },
      { nome: 'Growlithe', nivel: 20, tipos: ['FIRE'], trancada: false },
      { nome: 'Onix', nivel: 25, tipos: ['ROCK', 'GROUND'], trancada: false },
    ],
  });
  await p.pronto();

  assert.deepEqual(p.viagens, ['Geodude']);
});

test('modo automatico recusa hunt onde o ataque fica em desvantagem', async () => {
  const p = montar({
    lider: 30,
    automatico: true,
    degraus: [{ nivel: 30, nivelHunt: 20, cacada: '' }],
    tipos: { Gloom: ['GRASS'] },
    catalogo: [{ nome: 'Growlithe', nivel: 20, tipos: ['FIRE'], trancada: false }],
  });
  await p.pronto();

  assert.deepEqual(p.viagens, []);
  assert.equal(p.api.cfg.aplicado, 30, 'nao volta a tentar no mesmo marco');
});

test('hunt perigosa fica para tras e so tenta de novo no proximo marco', async () => {
  const p = montar({
    lider: 30,
    automatico: true,
    degraus: [
      { nivel: 30, nivelHunt: 20, cacada: '' },
      { nivel: 40, nivelHunt: 25, cacada: '' },
    ],
    tipos: { Gloom: ['GRASS'] },
    catalogo: [
      { nome: 'Growlithe', nivel: 20, tipos: ['FIRE'], trancada: false },
      { nome: 'Geodude', nivel: 25, tipos: ['ROCK'], trancada: false },
    ],
  });
  await p.pronto();
  p.subirPara(31);
  await p.api.conferir(() => {});
  assert.deepEqual(p.viagens, [], 'nao tentou outra vez antes do proximo degrau');

  p.subirPara(40);
  await p.api.conferir(() => {});
  assert.deepEqual(p.viagens, ['Geodude'], 'reavaliou ao chegar ao marco seguinte');
});

test('pausar congela e retomar continua sem apagar o degrau', async () => {
  const p = montar({ lider: 50, onde: 'Meowth', degraus: ESCADA, pausada: true });
  await p.pronto();
  await p.api.conferir(() => {});
  assert.deepEqual(p.viagens, []);

  p.api.cfg.pausada = false;
  await p.api.conferir(() => {});
  assert.deepEqual(p.viagens, ['Persian']);
  assert.match(fonte, /▶ Retomar/);
  assert.match(fonte, /⏸ Pausar/);
});

test('pool monta o primeiro time escolhido e passa ao seguinte quando todos chegam ao cap', async () => {
  const p = montar({
    automatico: true,
    pool: ['bebes', 'segundo'],
    teto: 30,
    equipe: [{ nome: 'ForaDaPool', nivel: 1 }],
    timesGuardados: {
      bebes: [{ nome: 'Bulbasaur', nivel: 30 }],
      segundo: [{ nome: 'Squirtle', nivel: 10 }],
    },
    tipos: { Bulbasaur: ['GRASS'], Squirtle: ['WATER'] },
    degraus: [{ nivel: 1, nivelHunt: 5, cacada: '' }],
    catalogo: [{ nome: 'Geodude', nivel: 5, tipos: ['ROCK'], trancada: false }],
  });
  await p.pronto();
  await p.api.conferir(() => {});
  await p.api.conferir(() => {});

  assert.deepEqual(p.timesMontados, ['bebes', 'segundo']);
  assert.equal(p.lider(), 'Squirtle');
});

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
  // A volta do carregamento e' quem faz a primeira viagem. Medir antes de ela acabar media o
  // relogio, e nao a escada.
  await p.pronto();
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
  await p.pronto();
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

// --------------------------------------------------------------- o ▸ de cada degrau
//
// O botao de ir mora na linha do degrau: o que se quer a' mao nao e' "o degrau do meu nivel", e'
// aquela caçada ali. Todos estes esperam por `pronto()` antes de medir — o modulo confere a
// escada assim que carrega, e essa volta e' parte do caso.

test('o ▸ leva aquela caçada, mesmo com a escada desligada', async () => {
  const p = montar({ degraus: ESCADA, lider: 10, onde: 'Meowth', ligada: false });
  await p.pronto();
  await p.api.irAoDegrau({ nivel: 50, cacada: 'Persian' });
  assert.deepEqual(p.viagens, ['Persian']);
  assert.equal(p.ondeEsta(), 'Persian');
});

test('ir a mao nao te faz ser arrastado de volta', async () => {
  // O Lv 14 pertence ao degrau de Lv 10, e o dono pediu o de Lv 50. Sem marcar o degrau de
  // agora como cumprido, a escada o traria de volta na primeira batida do HUD — por cima do que
  // ele acabou de pedir.
  const p = montar({ degraus: ESCADA, lider: 14, onde: 'Meowth', ligada: true });
  await p.pronto();
  p.viagens.length = 0;

  await p.api.irAoDegrau({ nivel: 50, cacada: 'Persian' });
  assert.deepEqual(p.viagens, ['Persian']);
  assert.equal(JSON.parse(p.guardado['lioncode:pokeidleworld:escada']).aplicado, 1);

  assert.equal(await p.api.conferir(() => {}), 'nada a fazer');
  assert.deepEqual(p.viagens, ['Persian'], 'uma viagem, nao duas');
  assert.equal(p.ondeEsta(), 'Persian');
});

test('o ▸ de onde voce ja esta nao viaja', async () => {
  const p = montar({ degraus: ESCADA, lider: 10, onde: 'Persian', ligada: false });
  await p.pronto();
  await p.api.irAoDegrau({ nivel: 50, cacada: 'Persian' });
  assert.deepEqual(p.viagens, []);
});

test('o ▸ de um degrau sem caçada nao faz nada', async () => {
  const p = montar({ degraus: ESCADA, lider: 10, onde: 'Meowth', ligada: false });
  await p.pronto();
  await p.api.irAoDegrau({ nivel: 20, cacada: '' });
  assert.deepEqual(p.viagens, []);
});

// --------------------------------------------------------------- formatura e rodizio

const TIME = [
  { nome: 'Gloom', nivel: 13 },
  { nome: 'Charizard', nivel: 263 },
  { nome: 'Graveler', nivel: 55 },
];

test('sem teto, a equipe atras do lider nao conta', async () => {
  // A escada nasceu assim e tem de continuar a funcionar assim: so' o lider, sem formatura.
  const p = montar({
    degraus: ESCADA,
    equipe: [{ nome: 'Gloom', nivel: 80 }, ...TIME],
    onde: 'Meowth',
  });
  await p.pronto();
  assert.deepEqual(p.viagens, ['Persian']);
  assert.deepEqual(p.cliques, [], 'ninguem e formado sem teto');
});

test('o lider abaixo do teto segue a escada, sem trocar ninguem', async () => {
  const p = montar({ degraus: ESCADA, equipe: TIME, teto: 60, onde: 'Persian' });
  await p.pronto();
  assert.deepEqual(p.viagens, ['Meowth']);
  assert.deepEqual(p.cliques, []);
});

test('lider formado: o proximo vai para a frente e a escada recomeca nele', async () => {
  // Gloom chegou ao teto; quem sobe agora e' o Charizard? Nao — ele ja' passou dos 60. E' o
  // Squirtle, o primeiro da lista que ainda nao se formou.
  const p = montar({
    degraus: ESCADA,
    equipe: [
      { nome: 'Gloom', nivel: 60 },
      { nome: 'Charizard', nivel: 263 },
      { nome: 'Squirtle', nivel: 13 },
    ],
    teto: 60,
    onde: 'Persian',
    aplicado: 50,
  });
  await p.pronto();
  assert.deepEqual(p.cliques, ['Squirtle']);
  assert.equal(p.equipeAgora()[0], 'Squirtle 13');
  // E vai para o degrau do nivel NOVO, nao do que o Gloom tinha.
  assert.deepEqual(p.viagens, ['Meowth']);
});

test('trocar de aluno apaga o degrau cumprido do anterior', async () => {
  // O degrau cumprido e' a historia do aluno anterior, e nao pode calar a viagem do novo.
  //
  // O caso em que isso aparece e' este: o Graveler cai no MESMO degrau que o Gloom ja' tinha
  // cumprido (Lv 50 → Persian), e o jogador anda-se embora para outro lugar. Sem apagar o
  // `aplicado`, a escada le "degrau 50 ja' feito, fique a' vontade" e deixa o aluno novo a
  // caçar onde nao devia. Medir so' o `aplicado` do fim nao pega isto: a viagem grava-o na
  // mesma.
  const p = montar({
    degraus: ESCADA,
    equipe: [
      { nome: 'Gloom', nivel: 60 },
      { nome: 'Graveler', nivel: 55 },
    ],
    teto: 60,
    onde: 'Meowth',
    aplicado: 50,
  });
  await p.pronto();
  assert.deepEqual(p.cliques, ['Graveler']);
  assert.deepEqual(p.viagens, ['Persian'], 'o aluno novo começa do zero');
});

test('todos formados: para a caçada no destino, e sem montar time', async () => {
  const p = montar({
    degraus: ESCADA,
    equipe: [
      { nome: 'Gloom', nivel: 60 },
      { nome: 'Charizard', nivel: 263 },
    ],
    teto: 60,
    destino: 'Persian',
    onde: 'Meowth',
  });
  await p.pronto();
  assert.deepEqual(p.viagens, ['Persian']);
  // Ninguem precisa de equipe montada para ficar parado na cidade.
  assert.deepEqual(p.pedidos, [{ time: '' }]);
  assert.equal(JSON.parse(p.guardado['lioncode:pokeidleworld:escada']).formados, true);
  assert.deepEqual(p.cliques, [], 'nao ha aluno para por na frente');
});

test('todos formados sem destino escolhido: nao viaja para lugar nenhum', async () => {
  const p = montar({
    degraus: ESCADA,
    equipe: [{ nome: 'Gloom', nivel: 60 }],
    teto: 60,
    onde: 'Meowth',
  });
  await p.pronto();
  assert.equal(await p.api.conferir(() => {}), 'sem destino');
  assert.deepEqual(p.viagens, []);
});

test('depois de parar, sair da cidade a mao e direito do dono', async () => {
  // A mesma regra do degrau cumprido: a escada leva, e depois larga.
  const p = montar({
    degraus: ESCADA,
    equipe: [{ nome: 'Gloom', nivel: 60 }],
    teto: 60,
    destino: 'Persian',
    onde: 'Persian',
  });
  await p.pronto();
  assert.equal(JSON.parse(p.guardado['lioncode:pokeidleworld:escada']).formados, true);

  p.irPara('Meowth');
  assert.equal(await p.api.conferir(() => {}), 'formados');
  assert.deepEqual(p.viagens, [], 'nao arrasta de volta');
});

test('um aluno novo desfaz a formatura da equipe', async () => {
  // Trocar um pokemon formado por um de Lv 1 tem de recomecar o ciclo, e nao ficar na cidade.
  const p = montar({
    degraus: ESCADA,
    equipe: [
      { nome: 'Gloom', nivel: 60 },
      { nome: 'Bellsprout', nivel: 1 },
    ],
    teto: 60,
    destino: 'Persian',
    onde: 'Persian',
    formados: true,
  });
  await p.pronto();
  assert.equal(JSON.parse(p.guardado['lioncode:pokeidleworld:escada']).formados, false);
  assert.deepEqual(p.cliques, ['Bellsprout']);
  assert.deepEqual(p.viagens, ['Meowth']);
});

test('clique que nao troca o lider: diz, e nao viaja por engano', async () => {
  // Se o jogo mudar e a caixa do HUD deixar de trocar o lider, a ferramenta nao pode seguir
  // como se tivesse trocado: ela viajaria com o aluno errado na frente.
  const falas = [];
  const p = montar({
    degraus: ESCADA,
    equipe: [
      { nome: 'Gloom', nivel: 60 },
      { nome: 'Venusaur', nivel: 1 },
    ],
    teto: 60,
    onde: 'Persian',
    oculto: true,
    cliqueMudo: true,
  });
  await p.pronto();
  p.verAba(true);
  assert.equal(await p.api.conferir((t) => falas.push(t)), 'sem trocar');
  assert.deepEqual(p.cliques, ['Venusaur']);
  assert.deepEqual(p.viagens, [], 'com o aluno errado na frente, nao se viaja');
  assert.match(falas.join(' '), /não troquei de aluno/i);
});

test('quem escolhe o aluno e a ordem da equipe, nao o nivel mais baixo', () => {
  const p = montar({
    equipe: [
      { nome: 'Gloom', nivel: 60 },
      { nome: 'Graveler', nivel: 55 },
      { nome: 'Bellsprout', nivel: 1 },
    ],
    teto: 60,
  });
  assert.equal(p.api.proximoAluno().nome, 'Graveler');
  assert.equal(p.api.formado({ nivel: 60 }), true);
  assert.equal(p.api.formado({ nivel: 59 }), false);
});

test('o diagnostico conta a formatura', () => {
  const p = montar({
    degraus: ESCADA,
    equipe: [
      { nome: 'Gloom', nivel: 60 },
      { nome: 'Venusaur', nivel: 1 },
    ],
    teto: 60,
    onde: 'Meowth',
  });
  assert.match(p.api.diagnostico(), /já se formou[\s\S]*teto Lv 60[\s\S]*Venusaur Lv 1/);

  const fim = montar({
    degraus: ESCADA,
    equipe: [{ nome: 'Gloom', nivel: 60 }],
    teto: 60,
    destino: 'Persian',
    onde: 'Persian',
  });
  assert.match(
    fim.api.diagnostico(),
    /equipe toda chegou ao Lv 60[\s\S]*Parei a caçada em "Persian"/,
  );
});

// --------------------------------------------------------------- o que o jogo impoe

test('a espera de 5 s do jogo nao e' + "'" + ' uma falha: nao clica, e volta depressa', async () => {
  const falas = [];
  const p = montar({
    degraus: ESCADA,
    equipe: [
      { nome: 'Gloom', nivel: 60 },
      { nome: 'Graveler', nivel: 55 },
    ],
    teto: 60,
    onde: 'Meowth',
    oculto: true,
    esperaDoJogo: true,
  });
  await p.pronto();
  p.verAba(true);
  assert.equal(await p.api.conferir((x) => falas.push(x)), 'sem trocar');
  // Clicar dentro da espera e' recusado em silencio pelo jogo: nem se tenta.
  assert.deepEqual(p.cliques, []);
  assert.deepEqual(p.viagens, []);
  assert.match(falas.join(' '), /só deixa trocar daqui a 5s/);
});

test('quem esta a subir e quem tem a classe active, nao quem esta na frente', () => {
  // Hoje dao no mesmo, porque o jogo po-e o ativo na frente. Le-se a classe de proposito: e' o
  // jogo a dizer quem e', em vez desta ferramenta a deduzir pela posicao.
  const p = montar({
    equipe: [
      { nome: 'Gloom', nivel: 13 },
      { nome: 'Graveler', nivel: 55 },
    ],
    ativoEm: 1,
    teto: 60,
  });
  assert.equal(p.api.nivelLider(), 55);
  assert.equal(p.api.proximoAluno().nome, 'Gloom');
});

// --------------------------------------------------------------- formar de surpresa, nunca
//
// O caso real, medido em 10/10/2026 na conta do dono: teto Lv 15, Gloom Lv 19 na frente, um
// Venusaur Lv 1 no fim da equipe. Na primeira batida a escada formou o Gloom, meteu o Venusaur
// na frente e desceu a caçada para os Togepi — tres coisas de uma vez, nenhuma pedida.

/** A escada dele: um degrau no Lv 1 e outro no Lv 10. */
const DELE = [
  { nivel: 1, cacada: 'Meowth' },
  { nivel: 10, cacada: 'Persian' },
];

const TIMEDELE = [
  { nome: 'Gloom', nivel: 19 },
  { nome: 'Charizard', nivel: 263 },
  { nome: 'Venusaur', nivel: 1 },
];






test('forma um atras do outro, sem parar no meio', async () => {
  // A escada tem de poder formar varias vezes seguidas: o aluno novo sobe, chega ao teto, e o
  // seguinte entra. Qualquer travao que sobrasse de uma formatura pararia a escada na primeira.
  const p = montar({
    degraus: ESCADA,
    equipe: [
      { nome: 'Gloom', nivel: 60 },
      { nome: 'Squirtle', nivel: 13 },
    ],
    teto: 60,
    onde: 'Persian',
    aplicado: 50,
  });
  await p.pronto();
  assert.deepEqual(p.cliques, ['Squirtle']);
  // O degrau passa a ser o do aluno NOVO. Guardar o 50 do que saiu mandaria o Lv 13 caçar onde
  // o Lv 60 caçava, que e' o contrario do que a escada serve para fazer.
  assert.deepEqual(p.viagens, ['Meowth'], 'e desce para o degrau de quem entrou');
  assert.equal(JSON.parse(p.guardado['lioncode:pokeidleworld:escada']).aplicado, 1);
});

// --------------------------------------------------------------- nunca desce com o mesmo aluno

test('nunca desce com o mesmo aluno', async () => {
  // Um degrau ABAIXO do que ja' foi cumprido com este aluno nao e' progresso: e' um nivel mal
  // lido, um degrau editado, ou o jogo a por outra caixa do HUD como `active`. O castigo de
  // acreditar nele e' arrastar um Lv 50 para a caçada dos Lv 1.
  const p = montar({
    degraus: ESCADA,
    lider: 50,
    onde: 'Persian',
    aplicado: 50,
    aluno: 'Gloom',
  });
  await p.pronto();

  p.subirPara(13);
  assert.equal(await p.api.conferir(() => {}), 'nao desco');
  assert.deepEqual(p.viagens, [], 'nao arrasta o Lv 50 para a caçada dos Lv 1');
  assert.equal(p.ondeEsta(), 'Persian');
});

test('e diz que nao desce, em vez de so nao descer', async () => {
  const falas = [];
  const p = montar({ degraus: ESCADA, lider: 50, onde: 'Persian', aplicado: 50, aluno: 'Gloom' });
  await p.pronto();
  p.subirPara(13);
  await p.api.conferir((t) => falas.push(t));
  assert.match(falas.at(-1), /abaixo do de Lv 50/);
  assert.match(falas.at(-1), /mesmo aluno/);
});

test('trocar de pokemon a mao recomeca a contagem', async () => {
  // A outra metade da regra: a contagem e' de UM aluno. O dono trocou o lider no HUD por conta
  // propria — sem formatura nenhuma pelo meio —, e o degrau cumprido era do que saiu. Segura-lo
  // deixaria o bicho novo a caçar onde o antigo caçava.
  const p = montar({
    degraus: ESCADA,
    equipe: [{ nome: 'Graveler', nivel: 55 }],
    onde: 'Meowth',
    aplicado: 50,
    aluno: 'Gloom',
  });
  await p.pronto();
  assert.deepEqual(p.viagens, ['Persian'], 'o aluno novo começa do zero');
  assert.equal(JSON.parse(p.guardado['lioncode:pokeidleworld:escada']).aluno, 'Graveler');
});

test('a primeira leitura nao e uma troca de aluno', async () => {
  // Sem isto, cada F5 contaria como aluno novo, apagaria o degrau cumprido e poria a escada a
  // viajar outra vez a cada recarga da pagina.
  const p = montar({ degraus: ESCADA, lider: 50, onde: 'Cerulean', aplicado: 50 });
  await p.pronto();
  const g = JSON.parse(p.guardado['lioncode:pokeidleworld:escada']);
  assert.equal(g.aluno, 'Gloom', 'aprende de quem e a escada');
  assert.equal(g.aplicado, 50, 'e nao apaga o degrau cumprido por causa disso');
  assert.deepEqual(p.viagens, []);
});

// --------------------------------------------------------------- o que age tem de aparecer

test('o compacto nao esconde a formatura sem a dizer', () => {
  // Esta foi a outra metade do defeito: o painel minimizado esconde os campos da formatura, e o
  // teto Lv 15 continuava a decidir tudo sem aparecer em sitio nenhum do painel que o dono
  // estava a olhar. Uma regra que age tem de estar a' vista.
  assert.match(fonte, /\.esx\.compacto \.esx-formabox\{display:none\}/);
  assert.match(fonte, /\.esx\.compacto \.esx-resumo\{display:block\}/);
  assert.match(fonte, /cap Lv \$\{cfg\.teto\}/, 'o resumo diz o teto que esta a valer');
});







// ------------------------------------------------------- iniciar/parar e a licenca de viajar

test('parada, nao forma nem viaja', async () => {
  const p = montar({ degraus: DELE, equipe: TIMEDELE, teto: 15, onde: 'Cerulean', ligada: false });
  await p.pronto();
  assert.deepEqual(p.viagens, []);
  assert.deepEqual(p.cliques, [], 'parada e' + ' parada: nem a formatura corre');
});

test('correndo sem licenca, forma o aluno mas nao muda de caçada', async () => {
  // As duas perguntas sao diferentes, e era isso que faltava: a escada esta' a trabalhar — poe o
  // proximo aluno na frente — sem ter licenca para arrastar ninguem para outro mapa.
  const p = montar({
    degraus: DELE,
    equipe: TIMEDELE,
    teto: 15,
    onde: 'Cerulean',
    aluno: 'Gloom',
    trocar: false,
  });
  await p.pronto();

  assert.deepEqual(p.cliques, ['Venusaur'], 'a formatura corre: o Gloom Lv 19 formou-se');
  assert.deepEqual(p.viagens, [], 'mas ela nao muda de caçada');
  assert.equal(p.ondeEsta(), 'Cerulean');
});

test('e diz para onde iria, em vez de so nao ir', async () => {
  const falas = [];
  const p = montar({ degraus: ESCADA, lider: 50, onde: 'Cerulean', trocar: false });
  await p.pronto();
  await p.api.conferir((t) => falas.push(t));
  assert.match(falas.at(-1), /iria para "Persian"/);
  assert.match(falas.at(-1), /licença/);
});

test('sem licenca, a equipe formada nao e levada para o destino', async () => {
  // O outro sitio onde ela viaja. Um deles com guarda e o outro sem seria pior do que nenhum:
  // a pessoa desmarca a caixa e a escada muda de caçada na mesma, so' que por outro caminho.
  const p = montar({
    degraus: DELE,
    equipe: [{ nome: 'Gloom', nivel: 19 }],
    teto: 15,
    destino: 'Cerulean',
    onde: 'Persian',
    aluno: 'Gloom',
    trocar: false,
  });
  await p.pronto();
  assert.deepEqual(p.viagens, []);
  assert.equal(p.ondeEsta(), 'Persian');
});

test('dar a licenca poe a escada a andar, sem recomecar nada', async () => {
  const p = montar({
    degraus: ESCADA,
    lider: 50,
    onde: 'Cerulean',
    aplicado: 1,
    aluno: 'Gloom',
    trocar: false,
  });
  await p.pronto();
  assert.deepEqual(p.viagens, []);

  p.caixaTrocar(true);
  await p.pronto();

  assert.deepEqual(p.viagens, ['Persian'], 'a porta abriu e ela foi');
  const g = JSON.parse(p.guardado['lioncode:pokeidleworld:escada']);
  assert.equal(g.trocar, true);
  assert.equal(g.aluno, 'Gloom', 'o aluno e o mesmo: dar licenca nao e adotar');
});

test('tirar a licenca nao para a escada', async () => {
  // E e' o ponto da separacao: quem desmarca a caixa quer parar de ser arrastado, nao parar a
  // ferramenta. Antes, as duas coisas eram a mesma chave.
  const p = montar({ degraus: ESCADA, lider: 50, onde: 'Persian', aplicado: 50, aluno: 'Gloom' });
  await p.pronto();
  p.caixaTrocar(false);
  const g = JSON.parse(p.guardado['lioncode:pokeidleworld:escada']);
  assert.equal(g.trocar, false);
  assert.equal(g.ligada, true, 'a escada continua correndo');
});

test('o botao diz em que estado ela esta, e nao o que o clique faz', async () => {
  const p = montar({ degraus: ESCADA, lider: 50, onde: 'Persian', ligada: false });
  await p.pronto();
  assert.match(p.botaoIniciar()?.textContent ?? '', /Iniciar/);

  p.clicarIniciar();
  await p.pronto();
  assert.match(p.botaoIniciar()?.textContent ?? '', /Parar/);

  p.clicarIniciar();
  await p.pronto();
  assert.match(p.botaoIniciar()?.textContent ?? '', /Iniciar/);
  assert.equal(JSON.parse(p.guardado['lioncode:pokeidleworld:escada']).ligada, false);
});

test('quem ja tinha a ferramenta nasce com a licenca dada', async () => {
  // A chave `trocar` nao existia no armazenamento de ninguem. Se ela nascesse falsa, toda a
  // gente que ja' usa a escada acordava com ela parada no sitio e sem explicacao. O `cru` e' o
  // armazenamento da versao anterior, letra por letra — sem a chave.
  const p = montar({
    lider: 50,
    onde: 'Cerulean',
    cru: { degraus: ESCADA, ligada: true, aplicado: null, teto: null, destino: '' },
  });
  await p.pronto();
  assert.deepEqual(p.viagens, ['Persian'], 'continua a trocar de caçada como sempre fez');
  assert.equal(JSON.parse(p.guardado['lioncode:pokeidleworld:escada']).trocar, true);
});

test('o time do degrau nao poe um formado na frente', async () => {
  // Medido no jogo em 11/10/2026. O time guardado de um degrau monta a equipe INTEIRA, ordem
  // incluida, e a ordem dele nao sabe nada de formatura: o time dele tinha um Gloom Lv 20 em
  // primeiro, e viajar aplicava-o — punha na frente justamente quem ja' se tinha formado.
  //
  // O time diz QUEM esta' na equipe; a formatura diz QUEM esta' na frente.
  const p = montar({
    degraus: [
      { nivel: 1, cacada: 'Togepi' },
      { nivel: 10, cacada: 'Diglett' },
    ],
    equipe: [
      { nome: 'Venusaur', nivel: 1 },
      { nome: 'Gloom', nivel: 20 },
      { nome: 'Charizard', nivel: 263 },
    ],
    onde: 'Cerulean',
    teto: 15,
    aluno: 'Venusaur',
    time: 'teste',
    ordemDoTime: ['Gloom', 'Charizard', 'Venusaur'],
  });
  await p.pronto();

  assert.deepEqual(p.viagens, ['Togepi'], 'a viagem acontece');
  assert.equal(p.lider(), 'Venusaur', 'e quem fica na frente e o aluno, nao o formado');
  // Medido AQUI, antes de qualquer outra batida: uma batida seguinte reporia o degrau sozinha e
  // esconderia uma reposicao que o tivesse apagado. O aluno nao mudou — so' a ordem foi mexida
  // por baixo dele —, entao o degrau cumprido continua cumprido.
  assert.equal(
    JSON.parse(p.guardado['lioncode:pokeidleworld:escada']).aplicado,
    1,
    'repor a frente nao e trocar de aluno: o degrau cumprido fica',
  );
});

test('e nao conta como aluno novo o formado que o time poe na frente', async () => {
  // A outra metade do estrago: a batida seguinte leria a troca como sendo do dono, trataria o
  // Gloom Lv 20 como aluno novo e apagaria o degrau que a viagem acabou de cumprir.
  const p = montar({
    degraus: [
      { nivel: 1, cacada: 'Togepi' },
      { nivel: 10, cacada: 'Diglett' },
    ],
    equipe: [
      { nome: 'Venusaur', nivel: 1 },
      { nome: 'Gloom', nivel: 20 },
    ],
    onde: 'Cerulean',
    teto: 15,
    aluno: 'Venusaur',
    time: 'teste',
    ordemDoTime: ['Gloom', 'Venusaur'],
  });
  await p.pronto();
  await p.api.conferir(() => {});

  const g = JSON.parse(p.guardado['lioncode:pokeidleworld:escada']);
  assert.equal(g.aluno, 'Venusaur', 'o aluno e quem a escada escolheu');
  assert.equal(g.aplicado, 1, 'e o degrau que acabou de cumprir fica cumprido');
});



test('iniciar com o lider ja acima do teto forma-o na hora', async () => {
  // O pedido de licenca saiu a pedido dele, em 11/10/2026: a formatura tem de ser automatica.
  // O caso e' o do jogo dele — um Gloom Lv 22 na frente, teto Lv 15 escrito, e Iniciar. Ela
  // forma o Gloom, poe o Venusaur Lv 1 na frente e desce para o degrau dele, sem perguntar.
  const p = montar({
    degraus: DELE,
    equipe: TIMEDELE,
    teto: 15,
    onde: 'Persian',
    ligada: false,
  });
  await p.pronto();

  p.clicarIniciar();
  await p.pronto();
  await p.api.conferir(() => {});

  assert.deepEqual(p.cliques, ['Venusaur'], 'o Gloom formou-se e o Venusaur foi para a frente');
  assert.equal(p.lider(), 'Venusaur');
});

test('iniciar refaz o degrau, em vez de confiar no que ficou', async () => {
  // Entre o Parar e o Iniciar o dono mexeu-se: foi para outra caçada a' mao. O degrau guardado
  // e' de antes dessa mexida, e confiar nele faria a escada dizer "ja cumpri, fique a' vontade"
  // e deixar o jogador onde nao devia estar.
  const p = montar({
    degraus: ESCADA,
    lider: 50,
    onde: 'Cerulean',
    aplicado: 50,
    aluno: 'Gloom',
    ligada: false,
  });
  await p.pronto();
  assert.deepEqual(p.viagens, [], 'parada, nao se mexe');

  p.clicarIniciar();
  await p.pronto();

  assert.deepEqual(p.viagens, ['Persian'], 'iniciar reavalia o degrau do nivel de agora');
});
