// Guardas dos times guardados.
//
// O que se testa aqui nao e' "monta o time" — e' que ela nunca deixa a equipe pela metade. O
// Deposito trava o Box enquanto a equipe tem 6, entao montar um time obriga a esvaziar antes de
// encher: ha' um ponto sem volta no meio da rotina, e tudo o que ela vai precisar tem de estar
// conferido ANTES dele.
//
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const fonte = readFileSync(new URL('../times.js', import.meta.url), 'utf8');

/**
 * Um Deposito de mentira que se comporta como o verdadeiro: as linhas sao refeitas a cada
 * leitura (como o React faz) e o Box inteiro fica travado enquanto a equipe tem seis.
 */
function deposito({
  equipe = [],
  box = [],
  travado = false,
  semAba = false,
  semJanela = false,
  // Chamado sempre que alguem vem do Box para a equipe: e' por aqui que o teste faz chegar um
  // pokemon caido, que e' o caso que a cura so'-antes nao cobriria.
  aoTrazer = () => {},
}) {
  const est = { equipe: [...equipe], box: [...box] };
  let menor = est.equipe.length;
  const CHEIA = 6;

  const peca = (txt) => ({ textContent: txt });
  /**
   * Uma linha. Se a ficha vier como "id::Nome | meta", a linha ganha a `key` do React com esse
   * id — que e' exatamente onde o jogo guarda o `capId`.
   */
  const linha = (chave, onde) => {
    const comId = chave.includes('::');
    const id = comId ? chave.slice(0, chave.indexOf('::')) : '';
    const visivel = comId ? chave.slice(chave.indexOf('::') + 2) : chave;
    const [nome, meta] = visivel.split(' | ');
    const travada = onde === 'box' && est.equipe.length >= CHEIA;
    const no = {
      className: `nsh-chip dpt-row dpt-poke-row${travada ? ' dpt-nomove' : ''}`,
      querySelector: (sel) =>
        sel === '.dpt-name' ? peca(nome) : sel === '.dpt-meta' ? peca(meta) : null,
      click() {
        if (travado || travada) return;
        // O jogo nao deixa a equipe ficar vazia: com um so', o clique para guardar nao faz nada.
        // Medido na conta real — e e' o que obriga a troca a ser intercalada.
        if (onde === 'equipe' && est.equipe.length <= 1) return;
        const de = onde === 'box' ? est.box : est.equipe;
        const para = onde === 'box' ? est.equipe : est.box;
        const i = de.indexOf(chave);
        if (i < 0) return;
        de.splice(i, 1);
        para.push(chave);
        if (onde === 'box') aoTrazer(chave);
        if (est.equipe.length < menor) menor = est.equipe.length;
      },
    };
    if (id) no['__reactFiber$teste'] = { key: id };
    return no;
  };

  const col = (onde) => ({
    querySelectorAll: (sel) => (sel === '.dpt-poke-row' ? est[onde].map((k) => linha(k, onde)) : []),
  });

  let abaLigada = false;
  const aba = {
    get className() {
      return `nsh-tab${abaLigada ? ' on' : ''}`;
    },
    textContent: '⚔ Pokémon',
    click() {
      if (!semAba) abaLigada = true;
    },
  };

  const janela = {
    querySelectorAll: (sel) => {
      if (sel === '.dpt-col') return [col('equipe'), col('box')];
      if (sel === '.nsh-tab') return semAba ? [] : [aba];
      return [];
    },
  };

  // `aberta` separa "a janela existe" de "esta' aberta": e' o que deixa o teste ver a ida ate'
  // o Deposito, em vez de assumir que ele ja' estava na tela.
  return { est, aberta: !semJanela, janela, menorEquipe: () => menor };
}

/**
 * Um no' de mentira que aguenta ser montado.
 *
 * O painel agora sobe sozinho ao carregar — e' isso que o faz sobreviver ao F5 —, entao o teste
 * precisa de um DOM que aceite ser construido. Nao se testa o desenho aqui: so' se garante que
 * construi-lo nao estoura e nao atrapalha o que de facto se mede.
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

function montar({
  dep = {},
  vezDe = null,
  // Times ja' guardados antes desta sessao, como estao no armazenamento.
  guardadoCru = null,
  onde = 'Cerulean',
  temPlaca = true,
  placaAbre = true,
  // Quantas perguntas a janela leva para abrir depois do clique. Um numero fixo de espera
  // transformava "demorou" em "nao abriu" — foi o que aconteceu na conta real.
  demoraDepot = 0,
  noMapa = ['Persian'],
  // A caixa "manter a ordem" do painel, como ficou guardada da ultima vez.
  ordem = false,
  // O clique no marcador nao leva a lado nenhum: e' assim que o jogo recusa uma viagem.
  voltaFalha = false,
  // O que o jogo mostra na tela quando se clica no marcador, e o mesmo dito dentro do chat.
  jogoDiz = '',
  chatDiz = '',
  // Quantos da equipe estao caidos (0 de vida) no HUD do jogo.
  caidos = 0,
  // Quem vem do Box vem caido: o pokemon guardado nao se cura sozinho na caixa.
  caiDoBox = false,
  // Em Cerulean ha' tres NPC e todas as placas dizem "Conversar"; a da Joy nao e' a primeira
  // aqui de proposito, para o teste nao dar por boa uma ferramenta que dependa da ordem.
  semJoy = false,
  // Como a escolha "a' vista / oculta" ficou guardada da ultima vez; undefined = nunca escolheu.
  visivelCru = undefined,
} = {}) {
  // O que a ferramenta contou ao menu, e o que o menu pode mandar ela fazer.
  const anotados = {};
  const controles = {};
  const guardado = {};
  if (guardadoCru || ordem || visivelCru !== undefined)
    guardado['lioncode:pokeidleworld:times'] = JSON.stringify({
      times: guardadoCru || {},
      ordem,
      ...(visivelCru === undefined ? {} : { visivel: visivelCru }),
    });
  // O fake avisa quando alguem vem do Box, e e' nesse instante que o HUD ganha um caido: e' o
  // unico jeito de distinguir "curou antes" de "curou a equipe que vai mesmo viajar".
  const depo = deposito({
    ...dep,
    aoTrazer: () => {
      if (caiDoBox) vivos = Math.max(0, vivos - 1);
    },
  });
  let local = onde;
  let soltou = 0;
  const viagens = [];
  const abertas = [];

  // A cidade: a placa "Abrir Depot" e o botao de voltar a Cerulean. Em aba oculta o jogo para de
  // desenhar e as placas somem — e' o que `temPlaca: false` simula.
  const btCerulean = {
    title: 'Voltar para Cerulean',
    textContent: '',
    click() {
      local = 'Cerulean';
    },
  };
  const btMapa = { title: 'Mapa', textContent: '', click() {} };

  // --- a Nurse Joy, e a vida da equipe no HUD -------------------------------------------------
  let vivos = 6 - caidos;
  let curas = 0;
  const monstros = () =>
    Array.from({ length: 6 }, (_, i) => {
      // O terceiro de pe' esta' machucado, nao caido. Parece um detalhe e nao e': "20/24"
      // contem "0/", e uma leitura desatenta da vida chamaria a Joy para quem esta' de pe'.
      const vida = i < 6 - vivos ? '0/24' : i === 3 ? '20/24' : '24/24';
      return {
        className: 'phud-mon',
        querySelector: (sel) => (sel === '.sbar-hp .sbar-txt' ? { textContent: vida } : null),
      };
    });

  let dialogo = null;
  const btCurar = {
    textContent: '🩹 Curar equipe',
    click() {
      curas += 1;
      vivos = 6;
    },
  };
  const fechaDlg = {
    className: 'cfg-x',
    textContent: '×',
    click() {
      dialogo = null;
    },
  };
  const npc = (quem) => ({
    className: 'npc-plate-btn',
    textContent: 'Conversar',
    click() {
      dialogo = quem;
    },
  });
  // A Joy no meio: a ferramenta tem de abrir, olhar e fechar ate' achar.
  const conversas = semJoy ? [npc('Mark'), npc('Pescador')] : [npc('Mark'), npc('Joy'), npc('Pescador')];
  const dlgEl = {
    className: 'npc-dlg',
    querySelector: (sel) => (sel === '.cfg-x' ? fechaDlg : null),
  };
  const placaDepot = {
    className: 'npc-plate-btn',
    textContent: 'Abrir Depot',
    click() {
      abertas.push('depot');
      if (!placaAbre) return;
      if (demoraDepot <= 0) depo.aberta = true;
      else {
        let faltam = demoraDepot;
        depo.atraso = () => {
          faltam -= 1;
          if (faltam <= 0) depo.aberta = true;
        };
      }
    },
  };
  const marcadores = noMapa.map((nome) => ({
    className: 'hunt-marker',
    title: `Viajar para ${nome}`,
    textContent: nome,
    click() {
      viagens.push(nome);
      if (!voltaFalha) local = nome;
      if (jogoDiz) mostrarNaTela(jogoDiz, false);
      if (chatDiz) mostrarNaTela(chatDiz, true);
    },
  }));

  // Um MutationObserver de mentira, com a peneira que importa: um no' dentro do chat sabe dizer
  // que esta' dentro do chat, e e' isso que o modulo usa para nao confundir conversa de jogador
  // com resposta do jogo.
  const olhos = [];
  const mostrarNaTela = (texto, noChat) => {
    const el = {
      nodeType: 1,
      textContent: texto,
      closest: (sel) => (noChat && sel === '.chat-box' ? {} : null),
    };
    for (const o of olhos) o([{ addedNodes: [el] }]);
  };
  class ObservadorFalso {
    constructor(fn) {
      this.fn = fn;
    }
    observe() {
      olhos.push(this.fn);
    }
    disconnect() {
      const i = olhos.indexOf(this.fn);
      if (i >= 0) olhos.splice(i, 1);
    }
  }

  // A fila e' a do pacote (`PPX.vez`), como nas outras ferramentas: quem ja' esta' agindo faz
  // `pedir` devolver `null`, e e' isso que o teste simula.
  const PPX = {
    modulo: (meta, fn) => fn(),
    vez: {
      pedir: async () => (vezDe ? null : () => {
        soltou += 1;
      }),
    },
    anotar: (id, v) => {
      anotados[id] = v;
    },
    controlar: (id, fn) => {
      controles[id] = fn;
    },
  };
  globalThis.PPX = PPX;

  const doc = {
    querySelector: (sel) => {
      if (sel === '.dpt-window') {
        if (!depo.aberta && depo.atraso) depo.atraso();
        return depo.aberta ? depo.janela : null;
      }
      if (sel === '.phud-tloc') return { textContent: `Nível 270 · ${local}` };
      // O × fecha mesmo: enquanto o Deposito esta' na frente nao se alcanca o NPC, e um fake
      // que aceitasse o clique sem fechar esconderia exatamente isso.
      if (sel === '.dpt-window .nsh-x')
        return depo.aberta
          ? {
              click() {
                depo.aberta = false;
              },
            }
          : null;
      if (sel === '[class*=npc-dlg]') return dialogo ? dlgEl : null;
      return null;
    },
    querySelectorAll: (sel) => {
      if (sel === 'button')
        return [btCerulean, btMapa, ...(dialogo === 'Joy' ? [btCurar] : [])];
      if (sel === '.phud-mon') return monstros();
      if (sel === '.npc-plate-btn')
        return temPlaca && local === 'Cerulean' ? [placaDepot, ...conversas] : [];
      if (sel === '.hunt-marker') return marcadores;
      return [];
    },
    addEventListener: () => {},
    dispatchEvent: () => {},
    createElement: () => noDom(),
    head: noDom(),
    documentElement: noDom(),
    body: noDom(),
    // O `body` existe so' porque o olheiro precisa de algo para observar; o painel so' se monta
    // quando alguem o mostra, e aqui ninguem mostra.
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
    ObservadorFalso,
    mod,
  );

  return {
    api: mod.exports,
    dep: depo,
    guardado,
    viagens,
    abertas,
    soltou: () => soltou,
    ondeEsta: () => local,
    curas: () => curas,
    caidos: () => 6 - vivos,
    anotado: (id) => anotados[id],
    controlar: (id) => controles[id],
  };
}

const SEIS = [
  'Charizard | Nv 262 · IV 149/192 · Lendária',
  'Squirtle | Nv 134 · IV 90/192 · Comum',
  'Graveler | Nv 55 · IV 80/192 · Comum',
  'Venusaur | Nv 1 · IV 70/192 · Comum',
  'Parasect | Nv 1 · IV 60/192 · Comum',
  'Gloom | Nv 1 · IV 50/192 · Comum',
];
const SCYTHER = 'Scyther | Nv 1 · IV 120/192 · Lendária';

/**
 * A mesma ficha como a ferramenta a guarda: **sem o nivel**.
 *
 * As constantes acima sao o que o jogo mostra; isto e' o que entra no time guardado. A diferenca
 * e' o ponto: o Charizard sobe de nivel a cacar, e com o nivel dentro da chave o time guardado
 * hoje deixaria de casar amanha.
 */
const semNv = (k) => {
  const [nome, meta] = k.split(' | ');
  return `${nome} | ${meta
    .split('·')
    .map((x) => x.trim())
    .filter((x) => !/^Nv/i.test(x))
    .join(' · ')}`;
};
const GUARDADO = SEIS.map(semNv);
const BOX = [SCYTHER, SCYTHER, 'Exeggcute | Nv 1 · IV 126/192 · Lendária'];

test('guarda a equipe de agora com o nome que se der', async () => {
  const p = montar({ dep: { equipe: SEIS, box: BOX } });
  assert.match(await p.api.salvarTime('caçada'), /Charizard/);
  assert.deepEqual(p.api.cfg.times['caçada'], GUARDADO, 'guardou sem o nivel');
});

test('time sem nome nao se guarda', async () => {
  const p = montar({ dep: { equipe: SEIS, box: BOX } });
  assert.match(await p.api.salvarTime('  '), /nome/);
  assert.deepEqual(Object.keys(p.api.cfg.times), []);
});

test('guardar tambem abre o Deposito sozinho', async () => {
  const p = montar({ dep: { equipe: SEIS, box: BOX, semJanela: true }, onde: 'Persian' });
  assert.match(await p.api.salvarTime('caçada'), /guardado/);
  assert.deepEqual(p.abertas, ['depot']);
  assert.deepEqual(p.viagens, ['Persian'], 'guardar um time nao custa a caçada em que se estava');
});

test('sem conseguir chegar ao Deposito, nao finge que guardou', async () => {
  const p = montar({ dep: { equipe: SEIS, box: BOX, semJanela: true }, temPlaca: false });
  assert.match(await p.api.salvarTime('caçada'), /placa do Depot/);
  assert.deepEqual(Object.keys(p.api.cfg.times), []);
});

test('monta o time guardado tirando antes de pôr', async () => {
  // Com a equipe cheia o Box esta' todo travado. Uma rotina que tentasse "trocar" sem esvaziar
  // primeiro nao moveria nada — e e' isto que este teste prova.
  const p = montar({ dep: { equipe: SEIS, box: BOX } });
  p.api.cfg.times.ginasio = [...GUARDADO.slice(0, 5), semNv(SCYTHER)];
  const r = await p.api.montarTime('ginasio');
  assert.match(r, /montado/, r);
  assert.deepEqual(
    p.dep.est.equipe.map(semNv).sort(),
    p.api.cfg.times.ginasio.slice().sort(),
  );
  assert.ok(p.dep.est.box.includes(SEIS[5]), 'o que saiu foi para o Box');
});

test('nao tira ninguem se o que falta nao esta no Box', async () => {
  // Esvaziar a equipe e so' entao descobrir que o pokémon nao existe deixaria o utilizador em
  // campo com meio time. Confere-se tudo antes de mover o primeiro.
  const p = montar({ dep: { equipe: SEIS, box: BOX } });
  p.api.cfg.times.sonho = [...GUARDADO.slice(0, 5), semNv('Mewtwo | Nv 70 · IV 190/192 · Mítica')];
  const r = await p.api.montarTime('sonho');
  assert.match(r, /Nao mexi em nada/);
  // Dizer so' "Mewtwo nao esta no Box" e' quase inutil quando ha' dez: o que se quer saber e'
  // QUAL. Foi o que aconteceu de verdade — "Persian nao esta no Box", com um Persian na tela.
  assert.match(r, /IV 190\/192/, `a mensagem diz qual: ${r}`);
  assert.deepEqual(p.dep.est.equipe, SEIS, 'a equipe ficou intacta');
});

test('gemeos contam: dois Scyther iguais exigem dois no Box', async () => {
  const p = montar({ dep: { equipe: SEIS, box: [SCYTHER] } });
  p.api.cfg.times.dois = [...GUARDADO.slice(0, 4), semNv(SCYTHER), semNv(SCYTHER)];
  assert.match(await p.api.montarTime('dois'), /Nao mexi em nada/);
  assert.deepEqual(p.dep.est.equipe, SEIS);
});

test('equipe ja certa nao mexe em nada', async () => {
  const p = montar({ dep: { equipe: SEIS, box: BOX } });
  p.api.cfg.times.atual = [...GUARDADO];
  assert.match(await p.api.montarTime('atual'), /ja e/);
  assert.deepEqual(p.dep.est.equipe, SEIS);
});

test('se o clique nao move, para no meio e avisa em vez de seguir', async () => {
  const p = montar({ dep: { equipe: SEIS, box: BOX, travado: true } });
  p.api.cfg.times.x = [...GUARDADO.slice(0, 5), semNv(SCYTHER)];
  assert.match(await p.api.montarTime('x'), /Parei no meio|continua com/);
});

test('nome que nao existe nao mexe na equipe', async () => {
  const p = montar({ dep: { equipe: SEIS, box: BOX } });
  assert.match(await p.api.montarTime('nao existe'), /Nenhum time guardado/);
  assert.deepEqual(p.dep.est.equipe, SEIS);
});

test('nao tenta montar um time maior do que a equipe comporta', async () => {
  const p = montar({ dep: { equipe: SEIS, box: BOX } });
  p.api.cfg.times.sete = [...GUARDADO, semNv(SCYTHER)];
  assert.match(await p.api.montarTime('sete'), /cabem 6/);
  assert.deepEqual(p.dep.est.equipe, SEIS);
});

test('nao mexe na equipe se outra ferramenta esta com a vez', async () => {
  const p = montar({ dep: { equipe: SEIS, box: BOX }, vezDe: 'ciclo' });
  p.api.cfg.times.x = [...GUARDADO.slice(0, 5), semNv(SCYTHER)];
  assert.match(await p.api.montarTime('x'), /Outra ferramenta/);
  assert.deepEqual(p.dep.est.equipe, SEIS);
});

test('solta a vez mesmo quando para no meio', async () => {
  // Segurar a fila depois de falhar travaria todas as outras ferramentas por 45 segundos.
  const p = montar({ dep: { equipe: SEIS, box: BOX, travado: true } });
  p.api.cfg.times.x = [...GUARDADO.slice(0, 5), semNv(SCYTHER)];
  await p.api.montarTime('x');
  assert.equal(p.soltou(), 1);
});

test('apagar um time guardado nao toca na equipe do jogo', async () => {
  const p = montar({ dep: { equipe: SEIS, box: BOX } });
  p.api.cfg.times.velho = [...GUARDADO];
  assert.match(p.api.apagarTime('velho'), /apagado/);
  assert.deepEqual(p.api.nomes(), []);
  assert.deepEqual(p.dep.est.equipe, SEIS);
});


// --- a ida ate' o Deposito ---------------------------------------------------------------------

test('abre o Deposito sozinho quando ele nao esta na tela', async () => {
  const p = montar({ dep: { equipe: SEIS, box: BOX, semJanela: true }, onde: 'Cerulean' });
  p.api.cfg.times.x = [...GUARDADO.slice(0, 5), semNv(SCYTHER)];
  const r = await p.api.montarTime('x');
  assert.deepEqual(p.abertas, ['depot'], 'clicou na placa do Depot');
  assert.match(r, /montado/, r);
});

test('sai da caçada, vai a Cerulean e volta para onde estava', async () => {
  // Ficar plantado em Cerulean depois de montar o time e' pior do que nao ter saido.
  const p = montar({
    dep: { equipe: SEIS, box: BOX, semJanela: true },
    onde: 'Persian',
    noMapa: ['Persian'],
  });
  p.api.cfg.times.x = [...GUARDADO.slice(0, 5), semNv(SCYTHER)];
  await p.api.montarTime('x');
  assert.deepEqual(p.viagens, ['Persian']);
  assert.equal(p.ondeEsta(), 'Persian');
});

test('volta para a caçada mesmo quando a montagem falha', async () => {
  const p = montar({
    dep: { equipe: SEIS, box: BOX, semJanela: true, travado: true },
    onde: 'Persian',
  });
  p.api.cfg.times.x = [...GUARDADO.slice(0, 5), semNv(SCYTHER)];
  const r = await p.api.montarTime('x');
  assert.doesNotMatch(r, /montado/);
  assert.deepEqual(p.viagens, ['Persian'], 'nao deixou o jogador em Cerulean');
});

test('sem as placas na tela, diz o motivo em vez de insistir', async () => {
  // Em aba oculta o motor do jogo para e `.npc-plate-btn` fica vazio. Nao e' erro de busca: e' o
  // jogo parado, e a ferramenta tem de saber dizer isso.
  const p = montar({ dep: { equipe: SEIS, box: BOX, semJanela: true }, temPlaca: false });
  p.api.cfg.times.x = [...GUARDADO.slice(0, 5), semNv(SCYTHER)];
  assert.match(await p.api.montarTime('x'), /placa do Depot/);
});

test('clique na placa que nao abre a janela nao vira montagem no escuro', async () => {
  const p = montar({ dep: { equipe: SEIS, box: BOX, semJanela: true }, placaAbre: false });
  p.api.cfg.times.x = [...GUARDADO.slice(0, 5), semNv(SCYTHER)];
  assert.match(await p.api.montarTime('x'), /nao abriu/);
  assert.deepEqual(p.dep.est.equipe, SEIS);
});

test('com o Deposito ja aberto, nao sai do lugar', async () => {
  const p = montar({ dep: { equipe: SEIS, box: BOX }, onde: 'Persian' });
  p.api.cfg.times.x = [...GUARDADO.slice(0, 5), semNv(SCYTHER)];
  await p.api.montarTime('x');
  assert.deepEqual(p.viagens, [], 'nao viajou a toa');
  assert.deepEqual(p.abertas, []);
});


// --- o nivel nao e identidade -----------------------------------------------------------------

test('subir de nivel nao quebra o time guardado', () => {
  // E' o caso de todo dia: o Charizard caça e sobe de nivel. Com o nivel dentro da chave, o time
  // guardado ontem nao casava hoje — a ferramenta nao reconhecia ninguem e recusava montar.
  const antes = montar({ dep: { equipe: SEIS, box: BOX } });
  const guardado = antes.api.timeAtual();

  const subiu = SEIS.map((k) => k.replace(/Nv (\d+)/, (_, n) => `Nv ${Number(n) + 7}`));
  const depois = montar({ dep: { equipe: subiu, box: BOX } });

  assert.deepEqual(depois.api.timeAtual(), guardado, 'a mesma equipe, sete niveis depois');
});

test('time guardado no formato antigo, com nivel, continua servindo', async () => {
  // Quem ja' tinha times guardados nao pode perde-los numa atualizacao.
  const p = montar({
    dep: { equipe: SEIS, box: BOX },
    guardadoCru: { antigo: [...SEIS] },
  });
  assert.match(await p.api.montarTime('antigo'), /ja e/, 'reconheceu a equipe que ja esta posta');
});


test('espera a janela do Deposito abrir, mesmo que demore', async () => {
  // Na conta real o clique no Depot funcionou e a ferramenta disse "a janela nao abriu": ela
  // esperava 1,5 s fixos. Agora pergunta de novo ate' um limite, que aceita o jogo lento.
  const p = montar({ dep: { equipe: SEIS, box: BOX, semJanela: true }, demoraDepot: 4 });
  p.api.cfg.times.x = [...GUARDADO.slice(0, 5), semNv(SCYTHER)];
  const r = await p.api.montarTime('x');
  assert.match(r, /montado/, r);
});


// --- identidade por id -------------------------------------------------------------------------
//
// Medido no jogo: a `key` do React de cada linha do Deposito e' o `capId` — o mesmo id que o HUD
// da equipe traz em `teamIds`. O fake acima poe essa key quando a ficha vem como "id::Nome | ...".

const COM_ID = [
  'aaa111bbb222ccc333dd::Charizard | Nv 262 · IV 149/192 · Lendária',
  'eee444fff555ggg666hh::Squirtle | Nv 134 · IV 58/192 · Rara',
];
const GEMEO_A = 'xxx111xxx222xxx333xx::Scyther | Nv 1 · IV 120/192 · Lendária';
const GEMEO_B = 'yyy111yyy222yyy333yy::Scyther | Nv 1 · IV 120/192 · Lendária';

test('havendo id, e o id que se guarda', async () => {
  const p = montar({ dep: { equipe: COM_ID, box: [] } });
  await p.api.salvarTime('x');
  assert.deepEqual(p.api.cfg.times.x, ['#aaa111bbb222ccc333dd', '#eee444fff555ggg666hh']);
});

test('o painel mostra o nome, e nao o id', async () => {
  // Uma lista escrita "#cmub..." nao seria uma lista.
  const p = montar({ dep: { equipe: COM_ID, box: [] } });
  const r = await p.api.salvarTime('x');
  assert.match(r, /Charizard/);
  assert.doesNotMatch(r, /#aaa111/);
});

test('com id, nem o nivel nem o IV mudando quebram o time', async () => {
  // O id e' a unica coisa que nao muda. Um pokémon que evolui troca de nome e de ficha, e
  // continua sendo ele.
  const p1 = montar({ dep: { equipe: COM_ID, box: [] } });
  await p1.api.salvarTime('x');
  const guardado = p1.api.cfg.times.x;

  const evoluiu = ['aaa111bbb222ccc333dd::Charizard | Nv 300 · IV 149/192 · Lendária',
                   'eee444fff555ggg666hh::Wartortle | Nv 140 · IV 58/192 · Rara'];
  const p2 = montar({ dep: { equipe: evoluiu, box: [] } });
  p2.api.cfg.times.x = guardado;
  assert.match(await p2.api.montarTime('x'), /ja e/, 'reconheceu os dois pelo id');
});

test('gemeos identicos no texto deixam de ser intercambiaveis', async () => {
  // Dois Scyther com a mesma ficha, ids diferentes. Guardando o B, e' o B que tem de entrar.
  const p = montar({ dep: { equipe: [GEMEO_B], box: [GEMEO_A] } });
  await p.api.salvarTime('oB');
  assert.deepEqual(p.api.cfg.times.oB, ['#yyy111yyy222yyy333yy']);

  const q = montar({ dep: { equipe: [GEMEO_A], box: [GEMEO_B] } });
  q.api.cfg.times.oB = ['#yyy111yyy222yyy333yy'];
  assert.match(await q.api.montarTime('oB'), /montado/);
  assert.deepEqual(q.dep.est.equipe, [GEMEO_B], 'trouxe o B, nao o A');
});

test('time guardado por texto continua servindo depois de existir id', async () => {
  // Ninguem perde o que ja' tinha guardado. A linha vale pelas duas chaves.
  const p = montar({ dep: { equipe: COM_ID, box: [] } });
  p.api.cfg.times.antigo = ['Charizard | IV 149/192 · Lendária', 'Squirtle | IV 58/192 · Rara'];
  assert.match(await p.api.montarTime('antigo'), /ja e/);
});

test('sem a key do React, cai para o texto e segue funcionando', async () => {
  // O sufixo de `__reactFiber$` muda a cada build do jogo, e um dia pode nao estar la'.
  const p = montar({ dep: { equipe: SEIS, box: BOX } });
  await p.api.salvarTime('x');
  assert.deepEqual(p.api.cfg.times.x, GUARDADO, 'guardou pelo texto, como antes');
});


test('equipe com um so nao impede a troca: poe primeiro, tira depois', async () => {
  // O caso real que falhou: a equipe tinha UM Persian indesejado e o time pedia seis. Tirar
  // antes de pôr e' impossivel ali — o jogo nao deixa a equipe ficar vazia —, e tentar isso
  // parava com "a equipe continua com 1".
  const SEIS_P = Array.from({ length: 6 }, (_, i) => `p${i}aaaaaaaaaaaaaaaa::Persian | Nv 1 · IV ${80 + i}/192 · Comum`);
  const INTRUSO = 'zzzaaaaaaaaaaaaaaaa::Persian | Nv 1 · IV 108/192 · Incomum';
  const p = montar({ dep: { equipe: [INTRUSO], box: SEIS_P } });
  p.api.cfg.times.oito = SEIS_P.map((k) => `#${k.slice(0, k.indexOf('::'))}`);

  const r = await p.api.montarTime('oito');
  assert.match(r, /montado/, r);
  assert.equal(p.dep.est.equipe.length, 6);
  assert.ok(!p.dep.est.equipe.includes(INTRUSO), 'o intruso foi para o Box');
  assert.ok(p.dep.est.box.includes(INTRUSO));
});

test('a equipe nunca fica vazia no meio da troca', async () => {
  // Nao e' so' o resultado: o caminho tambem tem de ser valido. Uma equipe vazia a meio seria um
  // estado que o jogo recusa — e a ferramenta ficaria presa ali.
  const UM = 'aaa1aaaaaaaaaaaaaaa::Persian | Nv 1 · IV 90/192 · Comum';
  const OUTRO = 'bbb1bbbbbbbbbbbbbbb::Persian | Nv 1 · IV 91/192 · Comum';
  const p = montar({ dep: { equipe: [UM], box: [OUTRO] } });
  p.api.cfg.times.x = ['#bbb1bbbbbbbbbbbbbbb'];

  const r = await p.api.montarTime('x');

  assert.match(r, /montado/, r);
  assert.deepEqual(p.dep.est.equipe, [OUTRO]);
  // O fake anota o menor tamanho por que a equipe passou: e' o caminho que se vigia aqui, nao
  // so' o destino.
  assert.equal(p.dep.menorEquipe(), 1, 'a equipe nunca passou por zero');
});

// --------------------------------------------------------------- manter a ordem
//
// Medido no jogo em 10/10/2026: quem vem do Box entra **no fim** da equipe, tirar alguem do meio
// nao mexe na ordem dos outros, e o lider (o ⚔) e' simplesmente o primeiro da fila. Nao ha'
// nenhum jeito de reordenar dentro da coluna. Entao a ordem nao se arruma — constroi-se da
// frente para tras —, e e' isso que estes testes vigiam.

/** Os seis de sempre, cada um com o seu id, para a ordem poder ser conferida um a um. */
const ORD = [
  'o1aaaaaaaaaaaaaaaaa::Charizard | Nv 262 · IV 149/192 · Lendária',
  'o2bbbbbbbbbbbbbbbbb::Squirtle | Nv 134 · IV 90/192 · Comum',
  'o3ccccccccccccccccc::Graveler | Nv 55 · IV 80/192 · Comum',
  'o4ddddddddddddddddd::Venusaur | Nv 1 · IV 70/192 · Comum',
  'o5eeeeeeeeeeeeeeeee::Parasect | Nv 1 · IV 60/192 · Comum',
  'o6fffffffffffffffff::Gloom | Nv 1 · IV 50/192 · Comum',
];
const chave = (k) => `#${k.slice(0, k.indexOf('::'))}`;

test('com a ordem ligada, a equipe sai na fila guardada', async () => {
  // Embaralhada de proposito, e com o primeiro guardado la' no fim: e' o caso que o jeito antigo
  // dava por bom, porque os seis estavam todos la'.
  const bagunca = [ORD[3], ORD[5], ORD[0], ORD[2], ORD[4], ORD[1]];
  const p = montar({ dep: { equipe: bagunca, box: [] }, ordem: true });
  p.api.cfg.times.fila = ORD.map(chave);

  const r = await p.api.montarTime('fila');

  assert.match(r, /montado/, r);
  assert.deepEqual(p.dep.est.equipe, ORD, 'a fila ficou igual a guardada');
  // Desceu ate' dois, nao ate' um: assim que o Charizard ficou em primeiro, o Squirtle que
  // estava no fim virou o segundo sozinho. O numero esta' aqui como guarda de custo — se um dia
  // subir, a ferramenta passou a desmontar mais do que precisa.
  assert.equal(p.dep.menorEquipe(), 2, `a equipe desceu ate ${p.dep.menorEquipe()}`);
});

test('sem a ordem ligada, os mesmos seis bagunçados ja servem', async () => {
  // O contraste e' o ponto: o modo livre nao mexe em nada aqui, e e' por isso que ele continua
  // a ser o padrao — manter a ordem custa a troca quase inteira.
  const bagunca = [ORD[3], ORD[5], ORD[0], ORD[2], ORD[4], ORD[1]];
  const p = montar({ dep: { equipe: bagunca, box: [] } });
  p.api.cfg.times.fila = ORD.map(chave);

  assert.match(await p.api.montarTime('fila'), /ja e "fila"/);
  assert.deepEqual(p.dep.est.equipe, bagunca, 'nao mexeu em ninguem');
});

test('o que ja esta certo na frente nao sai', async () => {
  // Quem vem do Box entra no fim: os tres primeiros ja' certos nao precisam de se mexer, e
  // desmonta-los seria pagar tres trocas a' toa.
  const quase = [ORD[0], ORD[1], ORD[2], ORD[5], ORD[4], ORD[3]];
  const p = montar({ dep: { equipe: quase, box: [] }, ordem: true });
  p.api.cfg.times.fila = ORD.map(chave);

  const r = await p.api.montarTime('fila');

  assert.match(r, /montado/, r);
  assert.deepEqual(p.dep.est.equipe, ORD);
  // Dois fora e dois de volta: ao tirar os dois do meio, o Venusaur subiu para o lugar dele
  // sozinho. Se a ferramenta desmontasse tudo, a equipe desceria a um.
  assert.equal(p.dep.menorEquipe(), 4, `a equipe desceu ate ${p.dep.menorEquipe()}`);
});

test('com a ordem ligada, trocar o lider nao esvazia a equipe', async () => {
  // O pior caso: o que tem de ficar em primeiro esta' no Box, e a equipe tem um so'. Tirar o
  // unico e' recusado pelo jogo, entao o certo entra ANTES de o errado sair.
  const p = montar({ dep: { equipe: [ORD[4]], box: [ORD[0]] }, ordem: true });
  p.api.cfg.times.dupla = [chave(ORD[0]), chave(ORD[4])];

  const r = await p.api.montarTime('dupla');

  assert.match(r, /montado/, r);
  assert.deepEqual(p.dep.est.equipe, [ORD[0], ORD[4]], 'o lider e o primeiro da fila');
  assert.equal(p.dep.menorEquipe(), 1, 'a equipe nunca passou por zero');
});

test('a ordem so muda quando a caixa esta ligada', async () => {
  // A caixa e' do utilizador, e tem de sobreviver ao recarregar da pagina.
  const p = montar({ ordem: true, dep: { equipe: [ORD[0]], box: [] } });
  assert.equal(p.api.cfg.ordem, true, 'leu a escolha guardada');
  const q = montar({ dep: { equipe: [ORD[0]], box: [] } });
  assert.equal(q.api.cfg.ordem, false, 'o padrao e a ordem livre');
});

// --------------------------------------------------------------- a volta para a caçada
//
// Montar o time e deixar o jogador plantado em Cerulean nao e' "montado". Antes a volta corria
// dentro de um `finally` que ignorava o resultado: a ferramenta dizia "montado", o jogador ficava
// na cidade e nao havia uma palavra sobre isso. Foi o que aconteceu em 10/10/2026, com a equipe
// desmaiada — que e' precisamente o estado em que o jogo recusa sair.

const DESMAIADA_T =
  '💀 Sua equipe está desmaiada! Fale com a Enfermeira Joy para curá-la antes de ir caçar.';

/** Um time de um so', para a troca ser curta e o teste falar da volta. */
function naCacada(extra = {}) {
  const UM = 'v1aaaaaaaaaaaaaaaaa::Persian | Nv 1 · IV 90/192 · Comum';
  const DOIS = 'v2bbbbbbbbbbbbbbbbb::Persian | Nv 1 · IV 91/192 · Comum';
  const p = montar({
    // `semJanela`: o Deposito esta' fechado, como numa caçada — e' isso que obriga a ida a
    // Cerulean e, portanto, a volta, que e' o que estes testes vigiam.
    dep: { equipe: [UM], box: [DOIS], semJanela: true },
    onde: 'Persian',
    noMapa: ['Persian'],
    ...extra,
  });
  p.api.cfg.times.x = ['#v2bbbbbbbbbbbbbbbbb'];
  return p;
}

test('montou e voltou: a frase nao ganha remendo nenhum', async () => {
  const p = naCacada();
  const r = await p.api.montarTime('x');
  assert.match(r, /montado/, r);
  assert.doesNotMatch(r, /nao voltei/);
  assert.equal(p.ondeEsta(), 'Persian');
});

test('montou mas nao voltou: a frase diz as duas coisas', async () => {
  // O time esta' de pe' — isso e' verdade e tem de continuar a ser dito. O que faltava era a
  // segunda metade.
  const p = naCacada({ voltaFalha: true });

  const r = await p.api.montarTime('x');

  assert.match(r, /montado/, `o time montou mesmo: ${r}`);
  assert.match(r, /nao voltei para "Persian"/, r);
  assert.equal(p.ondeEsta(), 'Cerulean', 'ficou mesmo na cidade');
});

test('nao voltou por estar desmaiada: diz onde se cura', async () => {
  const p = naCacada({ voltaFalha: true, jogoDiz: DESMAIADA_T });

  const r = await p.api.montarTime('x');

  assert.match(r, /montado/, r);
  assert.match(r, /desmaiada/i, r);
  assert.match(r, /Nurse Joy/, `tem de dizer onde se cura: ${r}`);
});

test('"desmaiada" dito no chat nao vira motivo', async () => {
  // O chat mundial e' de toda a gente; ler dali seria deixar qualquer jogador escolher o
  // diagnostico da ferramenta.
  const p = naCacada({
    voltaFalha: true,
    chatDiz: '02:14 Fulano [321]: equipe desmaiada de novo kkkk',
  });

  const r = await p.api.montarTime('x');

  assert.match(r, /nao voltei para "Persian"/, r);
  assert.doesNotMatch(r, /Nurse Joy/);
});

test('falhou a troca E nao voltou: as duas falhas aparecem', async () => {
  // A volta vale mesmo quando a troca nao deu certo — e as duas coisas tem de ser ditas, ou o
  // jogador conserta uma e fica sem saber da outra.
  const p = montar({
    dep: { equipe: ['Gloom | Nv 1 · IV 50/192 · Comum'], box: [], semJanela: true },
    onde: 'Persian',
    noMapa: ['Persian'],
    voltaFalha: true,
  });
  p.api.cfg.times.x = ['Mewtwo | IV 190/192 · Lendária'];

  const r = await p.api.montarTime('x');

  assert.match(r, /nao esta no Box/, r);
  assert.match(r, /nao voltei para "Persian"/, r);
});

test('quem dispensa a volta nao ganha queixa de volta', async () => {
  // As Caçadas montam o time e viajam logo a seguir: voltar a' caçada velha no meio seria uma
  // viagem a' toa, e uma queixa sobre ela seria ruido.
  const p = naCacada({ voltaFalha: true });

  const r = await p.api.montarTime('x', () => {}, { voltar: false });

  assert.match(r, /montado/, r);
  assert.doesNotMatch(r, /nao voltei/);
});

// --------------------------------------------------------------- a passagem pela Nurse Joy
//
// O jogo nao deixa sair da cidade com a equipe desmaiada, e a cura so' existe num NPC — a Nurse
// Joy, no mesmo Centro Pokemon de Cerulean onde fica o Depot. Como a ferramenta ja' esta' la'
// para mexer no time, passar por ela custa alguns cliques e evita a viagem que nao acontece.

/** Uma troca curta: um na equipe, outro no Box. O que se vigia aqui e' a cura. */
function comJoy(extra = {}) {
  const UM = 'j1aaaaaaaaaaaaaaaaa::Persian | Nv 1 · IV 90/192 · Comum';
  const DOIS = 'j2bbbbbbbbbbbbbbbbb::Persian | Nv 1 · IV 91/192 · Comum';
  const p = montar({
    dep: { equipe: [UM], box: [DOIS], semJanela: true },
    onde: 'Persian',
    noMapa: ['Persian'],
    ...extra,
  });
  p.api.cfg.times.x = ['#j2bbbbbbbbbbbbbbbbb'];
  return p;
}

test('equipe caida: cura antes de mexer no time', async () => {
  const p = comJoy({ caidos: 2 });

  const r = await p.api.montarTime('x');

  assert.match(r, /montado/, r);
  assert.equal(p.caidos(), 0, 'ninguem ficou caido');
  assert.equal(p.curas(), 1, 'passou uma vez pela Joy');
});

test('equipe inteira de pe: nao incomoda a Joy', async () => {
  // Abrir uma conversa com um NPC a' toa e' barulho na tela de quem esta' a jogar.
  const p = comJoy();

  assert.match(await p.api.montarTime('x'), /montado/);
  assert.equal(p.curas(), 0, 'nao abriu conversa nenhuma');
});

test('a Joy e achada mesmo nao sendo a primeira placa', async () => {
  // Em Cerulean as tres placas dizem "Conversar": qual e' de quem so' se sabe abrindo. Depender
  // da ordem seria depender de uma coisa que o jogo nunca prometeu.
  const p = comJoy({ caidos: 1 });
  assert.match(await p.api.montarTime('x'), /montado/);
  assert.equal(p.curas(), 1);
});

test('sem a Joy por perto, a troca acontece na mesma', async () => {
  // Nao achar o NPC nao e' motivo para nao montar o time: a cura e' um extra, nao a tarefa.
  const p = comJoy({ caidos: 1, semJoy: true });

  const r = await p.api.montarTime('x');

  assert.match(r, /montado/, r);
  assert.equal(p.curas(), 0);
});

test('quem vem do Box caido tambem e curado, depois da troca', async () => {
  // Este e' o caso que "curar antes" sozinho nao cobre, e e' o motivo de haver duas passagens:
  // a equipe comeca inteira de pe', e quem chega do Box e' que vem caido. A equipe que sai da
  // cidade e' a de DEPOIS da troca.
  const p = comJoy({ caiDoBox: true });

  const r = await p.api.montarTime('x');

  assert.match(r, /montado/, r);
  assert.equal(p.caidos(), 0, 'o que veio do Box saiu curado');
  assert.equal(p.curas(), 1, 'uma passagem pela Joy, so depois da troca');
  assert.equal(p.ondeEsta(), 'Persian', 'e a viagem de volta aconteceu');
});

test('caido antes E caido depois: duas passagens, nao uma', async () => {
  const p = comJoy({ caidos: 2, caiDoBox: true });

  assert.match(await p.api.montarTime('x'), /montado/);
  assert.equal(p.caidos(), 0);
  assert.equal(p.curas(), 2, 'uma antes da troca e outra depois');
});

// --------------------------------------------------------------- o painel sobrevive ao F5
//
// Antes, cada recarga da pagina devolvia o painel para o escuro: nao havia como "deixar a
// ferramenta aparecendo". A escolha mora na chave da propria ferramenta porque, para um modulo
// `proprio`, e' ele o dono do estado — o nucleo so' pergunta e manda aplicar.

test('fechar o painel fica guardado', async () => {
  const p = montar();
  p.api.cfg.visivel = true;

  // O nucleo manda esconder, como quando se clica no "à vista" do menu (Alt+Q).
  p.controlar('times')(false);

  assert.equal(p.api.cfg.visivel, false);
  assert.match(p.guardado['lioncode:pokeidleworld:times'], /"visivel":false/);
});

test('guardado fechado, volta fechado', () => {
  const p = montar({ visivelCru: false });
  assert.equal(p.api.cfg.visivel, false);
  assert.equal(p.anotado('times'), false, 'avisou o menu que esta oculta');
});

test('sem nada guardado, o painel aparece', () => {
  // Uma ferramenta que ninguem ve' e' uma ferramenta que ninguem usa. Quem nao a quiser fecha
  // no × ou no menu, e isso tambem fica guardado.
  const p = montar();
  assert.equal(p.anotado('times'), true);
});
