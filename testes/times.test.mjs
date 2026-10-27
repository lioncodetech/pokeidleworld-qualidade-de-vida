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
import { casadoresDeRotulo } from './nucleo-de-mentira.mjs';

const fonte = readFileSync(new URL('../times.js', import.meta.url), 'utf8');

/**
 * Um Deposito de mentira que se comporta como o verdadeiro: as linhas sao refeitas a cada
 * leitura (como o React faz) e o Box inteiro fica travado enquanto a equipe tem seis.
 */
// O jogo tem seletor de idioma, e a mesma cena tem de dar o mesmo resultado em qualquer um.
// Os textos sairam do dicionario que o proprio jogo publica.
const EM = {
  pt: {
    familiaItens: '👨‍👩‍👧 Família: Itens',
    familiaPokemon: '👨‍👩‍👧 Família: Pokémon',
    cidade: 'Voltar para Cerulean',
    mapa: 'Mapa',
    curar: '🩹 Curar equipe',
    depot: 'Abrir Depot',
    viajar: 'Viajar para',
  },
  en: {
    familiaItens: '👨‍👩‍👧 Family: Items',
    familiaPokemon: '👨‍👩‍👧 Family: Pokémon',
    cidade: 'Back to Cerulean',
    mapa: 'Map',
    curar: '🩹 Heal team',
    depot: '📦 Open Depot',
    viajar: 'Travel to',
  },
};

function deposito({
  equipe = [],
  box = [],
  itens = [],
  familiaItens = [],
  itensSemClasse = false,
  itensSoTexto = false,
  setasSemTexto = false,
  familiaEstrutura = false,
  travado = false,
  semAba = false,
  semJanela = false,
  // Chamado sempre que alguem vem do Box para a equipe: e' por aqui que o teste faz chegar um
  // pokemon caido, que e' o caso que a cura so'-antes nao cobriria.
  aoTrazer = () => {},
  lingua = 'pt',
}) {
  const L = EM[lingua];
  const est = {
    equipe: [...equipe],
    box: [...box],
    itens: [...itens],
    familiaItens: [...familiaItens],
  };
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

  let abaAtiva = '';
  const aba = {
    get className() {
      return `nsh-tab${abaAtiva === 'pokemon' ? ' on' : ''}`;
    },
    textContent: '⚔ Pokémon',
    click() {
      if (!semAba) abaAtiva = 'pokemon';
    },
  };

  // A familia tem DUAS abas. Ficar com a primeira que comece por "Família:" poria os itens
  // protegidos na aba dos pokemon.
  const abaFamPoke = {
    get className() {
      return `nsh-tab${abaAtiva === 'famPokemon' ? ' on' : ''}`;
    },
    textContent: L.familiaPokemon,
    click() {
      if (!semAba) abaAtiva = 'famPokemon';
    },
  };

  const abaItens = {
    get className() {
      return `nsh-tab${abaAtiva === 'itens' ? ' on' : ''}`;
    },
    textContent: L.familiaItens,
    click() {
      if (!semAba) abaAtiva = 'itens';
    },
  };

  const linhaItem = (item, onde) => {
    const nome = typeof item === 'string' ? item : item.nome;
    const qtd = typeof item === 'string' ? 1 : item.qtd;
    const seta = {
      className: 'dpt-arrow',
      textContent: setasSemTexto ? '' : (onde === 'bolsa' ? '▶' : '◀'),
      disabled: false,
      getBoundingClientRect: () => ({
        left: onde === 'bolsa' ? 245 : 325,
        width: 36,
      }),
      click() {
        const de = onde === 'bolsa' ? est.itens : est.familiaItens;
        const para = onde === 'bolsa' ? est.familiaItens : est.itens;
        const i = de.indexOf(item);
        if (i >= 0) para.push(...de.splice(i, 1));
      },
    };
    const img = { alt: nome, parentElement: null };
    const linha = {
      className: itensSemClasse ? 'deposit-item' : 'dpt-item-row dpt-row',
      textContent: `${nome} ${qtd} ${seta.textContent}`,
      parentElement: null,
      querySelector(sel) {
        if (sel === '.fam-n') return familiaEstrutura ? peca(nome) : null;
        if (sel === '.fam-q') return familiaEstrutura ? { value: '', placeholder: String(qtd) } : null;
        if (sel === '.dpt-name') return itensSoTexto ? null : peca(nome);
        if (sel === 'img') return itensSoTexto ? null : img;
        if (sel === 'input') return { value: String(qtd) };
        if (sel === '.dpt-arrow') return seta;
        return null;
      },
      querySelectorAll: (sel) => (sel === 'button' ? [seta] : []),
      getBoundingClientRect: () => ({
        left: onde === 'bolsa' ? 20 : 320,
        width: 240,
      }),
    };
    img.parentElement = linha;
    return linha;
  };

  const colItens = (onde) => {
    const col = {
      querySelectorAll(sel) {
        const linhas = est[onde].map((item) => linhaItem(item, onde === 'itens' ? 'bolsa' : 'familia'));
        for (const l of linhas) l.parentElement = col;
        if (sel === '.fam-line') return familiaEstrutura ? linhas : [];
        if (sel === '.dpt-item-row, .dpt-row') return itensSemClasse ? [] : linhas;
        if (sel === 'img[alt]') return linhas.map((l) => l.querySelector('img'));
        return [];
      },
    };
    return col;
  };

  const janela = {
    getBoundingClientRect: () => ({ left: 0, width: 600 }),
    querySelector: (sel) =>
      sel === '.fam-cols' && abaAtiva === 'itens' ? { className: 'fam-cols' } : null,
    querySelectorAll: (sel) => {
      if (sel === '.fam-cols .fam-col' && abaAtiva === 'itens' && familiaEstrutura)
        return [colItens('itens'), colItens('familiaItens')];
      if (sel === '.dpt-col')
        return abaAtiva === 'itens'
          ? (familiaEstrutura ? [] : [colItens('itens'), colItens('familiaItens')])
          : [col('equipe'), col('box')];
      if (sel === '.nsh-tab') return semAba ? [] : [aba, abaFamPoke, abaItens];
      if (sel === 'img[alt]' && abaAtiva === 'itens') {
        const cols = [colItens('itens'), colItens('familiaItens')];
        return itensSoTexto ? [] : cols.flatMap((c) => c.querySelectorAll('img[alt]'));
      }
      if (sel === 'button' && abaAtiva === 'itens') {
        const linhas = [
          ...est.itens.map((item) => linhaItem(item, 'bolsa')),
          ...est.familiaItens.map((item) => linhaItem(item, 'familia')),
        ];
        for (const l of linhas) l.parentElement = janela;
        return linhas.flatMap((l) => {
          const botoes = l.querySelectorAll('button');
          for (const b of botoes) b.parentElement = l;
          return botoes;
        });
      }
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
  // Em que lingua o jogo esta': 'pt' ou 'en'.
  lingua = 'pt',
  // Troca o verbo do marcador do mapa por outro: e' assim que se mede que a ferramenta confere o
  // verbo, e nao so' o nome do destino que vem depois dele.
  verboDoMarcador = null,
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
  // A Joy responde, o botao clica — e a equipe continua caida. Quem confere o clique da' isto
  // por curado; quem confere a barra de vida, nao.
  curaFalha = false,
  // Como a escolha "a' vista / oculta" ficou guardada da ultima vez; undefined = nunca escolheu.
  visivelCru = undefined,
  // A aba do jogo em segundo plano, que e' como se joga com varias janelas abertas.
  oculto = false,
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
  const L = EM[lingua];
  const depo = deposito({
    lingua,
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
    title: L.cidade,
    textContent: '',
    click() {
      local = 'Cerulean';
    },
  };
  const btMapa = { title: L.mapa, textContent: '', click() {} };

  // --- a Nurse Joy, e a vida da equipe no HUD -------------------------------------------------
  let escondida = oculto;
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
    textContent: L.curar,
    click() {
      curas += 1;
      if (!curaFalha) vivos = 6;
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
    textContent: L.depot,
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
    title: `${verboDoMarcador || L.viajar} ${nome}`,
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
  // Os casadores de rotulo do nucleo DE VERDADE: sem eles este fake caia sempre para o texto
  // portugues escrito a mao, e o caminho que o jogo em ingles usa ficava sem guarda.
  Object.assign(PPX, casadoresDeRotulo({ querySelectorAll: (s) => doc.querySelectorAll(s) }));
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
    // O vigia da equipe nao age com a aba escondida: ali o motor do jogo para, as placas dos
    // NPC somem e a Joy fica fora de alcance.
    get visibilityState() {
      return escondida ? 'hidden' : 'visible';
    },
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
    // A equipe a cair no meio de uma caçada, e o HUD a bater por causa disso. E' assim que o
    // vigia e' acordado: ele nao olha o relogio, olha a tela.
    cair: (quantos = 1) => {
      vivos = 6 - quantos;
      mostrarNaTela('tick', false);
    },
    bater: () => mostrarNaTela('tick', false),
    verAba: (sim) => {
      escondida = !sim;
    },
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

test('guarda no deposito da familia somente os itens protegidos', async () => {
  const protegidos = [
    { nome: 'Poke Card Pack', qtd: 10 },
    { nome: 'Bronze Dimensional KEY', qtd: 2 },
    { nome: 'Devoted Token', qtd: 532 },
    { nome: 'Strange Pheromone', qtd: 1 },
    { nome: 'Shiny Raichu Card', qtd: 1 },
    { nome: 'Rare Pokemon Picture', qtd: 4 },
    { nome: 'Bronze Boss Token', qtd: 3 },
    { nome: 'Legendary Golden Ticket', qtd: 1 },
  ];
  const comuns = [{ nome: 'Bone', qtd: 18 }, { nome: 'Bag of Pollen', qtd: 56504 }];
  const p = montar({ dep: { equipe: SEIS, box: BOX, itens: [...protegidos, ...comuns] } });

  const r = await p.api.protegerItensAqui(() => {});

  assert.equal(r.ok, true, r.erro);
  assert.deepEqual(r.movidos, protegidos.map((x) => x.nome));
  assert.deepEqual(p.dep.est.itens, comuns, 'itens comuns continuaram na bolsa');
  assert.deepEqual(p.dep.est.familiaItens, protegidos, 'todos os protegidos foram para a família');
});

test('Bronze Boss Token sem contador nem classe de linha tambem e encontrado', async () => {
  const token = { nome: 'Bronze Boss Token', qtd: 1 };
  const p = montar({ dep: { equipe: SEIS, box: BOX, itens: [token], itensSemClasse: true } });

  const r = await p.api.protegerItensAqui(() => {});

  assert.equal(r.ok, true, r.erro);
  assert.deepEqual(r.movidos, ['Bronze Boss Token']);
  assert.deepEqual(p.dep.est.itens, []);
  assert.deepEqual(p.dep.est.familiaItens, [token]);
});

test('procura protegidos na janela inteira sem confundir itens que ja estao na familia', async () => {
  const token = { nome: 'Bronze Boss Token', qtd: 1 };
  const pheromone = { nome: 'Strange Pheromone', qtd: 1 };
  const jaGuardado = { nome: 'Devoted Token', qtd: 532 };
  const comum = { nome: 'Bone', qtd: 18 };
  const p = montar({
    dep: {
      equipe: SEIS,
      box: BOX,
      itens: [token, pheromone, comum],
      familiaItens: [jaGuardado],
      itensSemClasse: true,
    },
  });

  const r = await p.api.protegerItensAqui(() => {});

  assert.equal(r.ok, true, r.erro);
  assert.deepEqual(r.movidos, ['Bronze Boss Token', 'Strange Pheromone']);
  assert.deepEqual(p.dep.est.itens, [comum], 'o item comum permaneceu na mochila');
  assert.deepEqual(
    p.dep.est.familiaItens,
    [jaGuardado, token, pheromone],
    'a seta para a esquerda nunca foi tratada como item da mochila',
  );
});

test('seta desenhada por CSS e reconhecida pela metade esquerda do deposito', async () => {
  const token = { nome: 'Bronze Boss Token', qtd: 1 };
  const jaGuardado = { nome: 'Poke Card Pack', qtd: 10 };
  const p = montar({
    dep: {
      equipe: SEIS,
      box: BOX,
      itens: [token],
      familiaItens: [jaGuardado],
      itensSemClasse: true,
      setasSemTexto: true,
    },
  });

  const avisos = [];
  const r = await p.api.protegerItensAqui((txt) => avisos.push(txt));

  assert.equal(r.ok, true, r.erro);
  assert.deepEqual(r.movidos, ['Bronze Boss Token']);
  assert.deepEqual(p.dep.est.itens, []);
  assert.deepEqual(p.dep.est.familiaItens, [jaGuardado, token]);
  assert.match(avisos[0], /1 item\(ns\).*1 protegido\(s\).*Bronze Boss Token/);
});

test('reconhece pelos IDs reais os nomes escondidos pelo deposito', async () => {
  const pack = { nome: 'Item #6352', qtd: 1 };
  const foto = { nome: 'Item #59195', qtd: 2 };
  const token = { nome: 'Item #70000', qtd: 1 };
  const comum = { nome: 'Item #11514', qtd: 1 };
  const p = montar({
    dep: {
      equipe: SEIS,
      box: BOX,
      itens: [pack, foto, token, comum],
      itensSemClasse: true,
      setasSemTexto: true,
    },
  });

  const avisos = [];
  const r = await p.api.protegerItensAqui((txt) => avisos.push(txt));

  assert.equal(r.ok, true, r.erro);
  assert.deepEqual(r.movidos, ['Poke Card Pack', 'Rare Pokemon Picture', 'Bronze Boss Token']);
  assert.deepEqual(p.dep.est.itens, [comum]);
  assert.deepEqual(p.dep.est.familiaItens, [pack, foto, token]);
  assert.match(avisos[0], /3 protegido\(s\).*Poke Card Pack.*Bronze Boss Token/);
});

test('usa a estrutura real da aba Familia Itens', async () => {
  const pack = { nome: 'Item #6352', qtd: 2 };
  const token = { nome: 'Item #70000', qtd: 1 };
  const ticket = { nome: 'Item #90127', qtd: 1 };
  const comum = { nome: 'Item #11514', qtd: 8 };
  const p = montar({
    dep: {
      equipe: SEIS,
      box: BOX,
      itens: [pack, token, ticket, comum],
      familiaEstrutura: true,
      itensSemClasse: true,
      itensSoTexto: true,
    },
  });

  const r = await p.api.protegerItensAqui(() => {});

  assert.equal(r.ok, true, r.erro);
  assert.deepEqual(r.movidos, ['Poke Card Pack', 'Bronze Boss Token', 'Legendary Golden Ticket']);
  assert.deepEqual(p.dep.est.itens, [comum]);
  assert.deepEqual(p.dep.est.familiaItens, [pack, token, ticket]);
});

test('acha a linha real somente pelo texto Item ID e pelo botao para a direita', async () => {
  const pack = { nome: 'Item #6352', qtd: 1 };
  const token = { nome: 'Item #70000', qtd: 1 };
  const comum = { nome: 'Item #11514', qtd: 8 };
  const p = montar({
    dep: {
      equipe: SEIS,
      box: BOX,
      itens: [pack, token, comum],
      itensSemClasse: true,
      itensSoTexto: true,
      setasSemTexto: true,
    },
  });

  const r = await p.api.protegerItensAqui(() => {});

  assert.equal(r.ok, true, r.erro);
  assert.deepEqual(r.movidos, ['Poke Card Pack', 'Bronze Boss Token']);
  assert.deepEqual(p.dep.est.itens, [comum]);
  assert.deepEqual(p.dep.est.familiaItens, [pack, token]);
});

test('usa a posicao do botao quando linha e seta nao expoem geometria nem texto', async () => {
  const token = { nome: 'Item #70000', qtd: 1 };
  const p = montar({
    dep: {
      equipe: SEIS,
      box: BOX,
      itens: [token],
      itensSemClasse: true,
      itensSoTexto: true,
      setasSemTexto: true,
    },
  });
  p.dep.janela.getBoundingClientRect = () => ({ left: 0, width: 600 });

  const r = await p.api.protegerItensAqui(() => {});

  assert.equal(r.ok, true, r.erro);
  assert.deepEqual(r.movidos, ['Bronze Boss Token']);
  assert.deepEqual(p.dep.est.itens, []);
});

test('sem a aba Familia: Itens para antes de qualquer venda', async () => {
  const p = montar({ dep: { equipe: SEIS, box: BOX, itens: ['Devoted Token'], semAba: true } });
  const r = await p.api.protegerItensAqui(() => {});
  assert.equal(r.ok, false);
  assert.match(r.erro, /Família: Itens/);
  assert.deepEqual(p.dep.est.itens, ['Devoted Token']);
});

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
  assert.match(await p.api.montarTime('x'), /nao abriu|chegar perto/);
  assert.deepEqual(p.dep.est.equipe, SEIS);
});

test('quando o clique distante falha, tenta caminhar ate o Depot', () => {
  assert.match(fonte, /Caminhando até o Depot/);
  assert.match(fonte, /aproximarDaPlaca\(depot, cancelado\)/);
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

// --------------------------------------------------------------- a Joy como porta do pacote

test('curar sai da caçada, passa na Joy e devolve o jogador', async () => {
  const p = comJoy({ caidos: 2 });

  assert.equal(await p.api.curar(), '');

  assert.equal(p.curas(), 1);
  assert.equal(p.caidos(), 0);
  assert.equal(p.ondeEsta(), 'Persian', 'voltou para a caçada');
});

test('ninguem caido: nao sai do lugar nem incomoda a Joy', async () => {
  // Abrir conversa com um NPC a' toa e' barulho na tela de quem esta' a jogar.
  const p = comJoy();

  assert.equal(await p.api.curar(), '');

  assert.equal(p.curas(), 0);
  assert.deepEqual(p.viagens, []);
});

test('curar com voltar: false deixa o jogador em Cerulean', async () => {
  // E' o que as Caçadas pedem: elas viajam logo a seguir, e uma volta no meio seria uma viagem
  // inteira para nada.
  const p = comJoy({ caidos: 1 });

  assert.equal(await p.api.curar(() => {}, { voltar: false }), '');

  assert.equal(p.curas(), 1);
  assert.equal(p.ondeEsta(), 'Cerulean');
});

test('sem a Joy por perto, curar diz e devolve o jogador na mesma', async () => {
  const p = comJoy({ caidos: 1, semJoy: true });

  const r = await p.api.curar();

  assert.match(r, /Nao achei a Nurse Joy/);
  assert.equal(p.ondeEsta(), 'Persian', 'ninguem fica plantado em Cerulean');
});

test('curarAqui nao viaja, e nao pede a vez', async () => {
  // E' a porta do Ciclo, que ja' tem a vez na mao desde o inicio da ida ao mercado: chamar a
  // outra ficaria a' espera de si proprio, porque a fila so' e' reentrante para o mesmo dono.
  const p = comJoy({ caidos: 1, onde: 'Cerulean', vezDe: 'ciclo' });

  assert.equal(await p.api.curar(), 'Outra ferramenta esta agindo. Tente de novo.');
  assert.equal(p.curas(), 0);

  assert.equal(await p.api.curarAqui(), '');
  assert.equal(p.curas(), 1, 'com a vez na mao de outro, esta ainda cura');
});

test('curarAqui fora de Cerulean recusa, em vez de viajar', async () => {
  const p = comJoy({ caidos: 1, onde: 'Persian' });

  // A frase exata importa: "nao achei a Joy" seria o que se diz **em** Cerulean, e as duas
  // passariam por uma busca de "Cerulean" no texto.
  assert.equal(await p.api.curarAqui(), 'A Nurse Joy fica em Cerulean, e voce nao esta la.');
  assert.deepEqual(p.viagens, []);
  assert.equal(p.curas(), 0);
});

/**
 * Espera por uma condicao, em vez de por um numero de milissegundos.
 *
 * Dormir um tanto fixo faz o teste falhar na maquina ocupada e passar na vazia — e um teste que
 * falha as vezes nao diz nada a ninguem. Espreita-se de 10 em 10 ms ate' 3 s.
 */
async function ate(cond, limite = 3000) {
  const fim = Date.now() + limite;
  while (Date.now() < fim) {
    if (cond()) return true;
    await new Promise((r) => setTimeout(r, 10));
  }
  return false;
}

// --------------------------------------------------------------- o vigia da equipe

test('a equipe cai no meio da caçada: vai a Joy sozinho e volta', async () => {
  const p = comJoy();
  p.cair(2);
  // A volta inteira: sair da caçada, achar a Joy, curar e viajar de novo.
  assert.ok(await ate(() => p.ondeEsta() === 'Persian' && p.curas() === 1), 'nao voltou a tempo');

  assert.equal(p.curas(), 1);
  assert.equal(p.caidos(), 0);
  assert.equal(p.ondeEsta(), 'Persian', 'voltou para a caçada sozinho');
});

test('o vigia so age na mudanca, nao a cada batida do HUD', async () => {
  // O HUD bate varias vezes por segundo numa caçada. Sem esta peneira, cada batida mandaria
  // uma ida a Cerulean.
  // Com a Joy fora de alcance a equipe **continua caida** depois da primeira ida — e e' por
  // isso que este e' o caso que importa: sem a peneira, cada batida do HUD mandaria outra
  // viagem a Cerulean, para sempre.
  const p = comJoy({ semJoy: true });
  p.cair(1);
  assert.ok(await ate(() => p.ondeEsta() === 'Persian' && p.viagens.length > 0), 'nao foi e voltou');
  const depoisDaPrimeira = p.viagens.length;
  for (let i = 0; i < 5; i += 1) p.bater();
  // Nao ha' condicao de sucesso para esperar — o que se mede e' que **nada** acontece. Entao
  // da-se tempo de sobra para o erro aparecer, se ele existir.
  await new Promise((r) => setTimeout(r, 400));

  assert.equal(p.caidos(), 1, 'a equipe continua caida, senao o caso nao e este');
  assert.equal(p.viagens.length, depoisDaPrimeira, 'uma ida a Cerulean, nao seis');
});

test('com a caixa desligada, o vigia nao se mexe', async () => {
  const p = comJoy();
  p.api.cfg.curarSozinho = false;
  p.cair(2);
  await new Promise((r) => setTimeout(r, 400));

  assert.equal(p.curas(), 0);
  assert.equal(p.caidos(), 2, 'a equipe caida fica caida, que foi o que se pediu');
});

test('com o Deposito aberto, o vigia espera', async () => {
  // A janela esta' na frente do NPC, e quem a abriu foi o jogador. Mexer no que e' dele seria
  // fechar-lhe a janela na cara.
  const p = montar({ dep: { equipe: [], box: [] }, onde: 'Cerulean' });
  p.cair(2);
  await new Promise((r) => setTimeout(r, 400));

  assert.equal(p.curas(), 0);
});

test('a Joy respondeu e a equipe continua caida: nao da por curada', async () => {
  // Quem confere o clique da' isto por curado e manda viajar; o jogo recusa a viagem em
  // silencio e a ferramenta fica a dizer que esta' tudo bem. Quem confere a barra de vida, nao.
  const p = comJoy({ caidos: 2, curaFalha: true });

  const r = await p.api.curar();

  assert.match(r, /continua caida/);
  assert.equal(p.caidos(), 2);
});

test('caiu com a aba escondida: tenta de novo quando ela volta', async () => {
  // E' o caso real que a primeira versao perdia. Ela guardava "ja vi este caido", e a aba
  // escondida fazia a tentativa ser descartada **depois** de guardar — dali em diante nunca
  // mais tentava, e a equipe passava a noite caida numa janela em segundo plano.
  const p = comJoy({ oculto: true });
  p.cair(2);
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(p.curas(), 0, 'com a aba escondida nao da para falar com a Joy');

  p.verAba(true);
  p.bater();
  assert.ok(await ate(() => p.curas() === 1), 'nao curou depois de a aba voltar');
  assert.equal(p.caidos(), 0);
});

// --- o jogo em ingles ---------------------------------------------------------------------------
//
// Era aqui que doia: guardar um time em Cerulean acabava num `porTitulo('Voltar para Cerulean')`
// que, com o jogo em ingles, nao achava botao nenhum — e a ferramenta desistia calada. Foi este o
// defeito "estou tentando criar um time novo e nao esta guardando".

test('em ingles: guarda a equipe de agora', async () => {
  const p = montar({ dep: { equipe: SEIS, box: BOX }, lingua: 'en' });
  assert.match(await p.api.salvarTime('hunt'), /Charizard/);
  assert.deepEqual(p.api.cfg.times.hunt, GUARDADO);
});

test('em ingles: guardar abre o Deposito e devolve o jogador a cacada', async () => {
  const p = montar({
    dep: { equipe: SEIS, box: BOX, semJanela: true },
    onde: 'Persian',
    lingua: 'en',
  });
  assert.match(await p.api.salvarTime('hunt'), /guardado/);
  assert.deepEqual(p.abertas, ['depot']);
  assert.deepEqual(p.viagens, ['Persian'], 'voltou pelo botao "Map" e pelo marcador em ingles');
});

test('em ingles: monta o time guardado', async () => {
  const p = montar({ dep: { equipe: SEIS, box: BOX }, lingua: 'en' });
  p.api.cfg.times.gym = [...GUARDADO.slice(0, 5), semNv(SCYTHER)];
  assert.match(await p.api.montarTime('gym'), /montado/);
});

test('em ingles: a aba "Family: Items" e a que guarda os protegidos', async () => {
  const protegidos = [{ nome: 'Devoted Token', qtd: 532 }];
  const comuns = [{ nome: 'Bone', qtd: 18 }];
  const p = montar({
    dep: { equipe: SEIS, box: BOX, itens: [...protegidos, ...comuns] },
    lingua: 'en',
  });
  const r = await p.api.protegerItensAqui(() => {});
  assert.equal(r.ok, true, r.erro);
  assert.deepEqual(p.dep.est.familiaItens, protegidos);
});

test('marcador com outro verbo nao e viagem: confere o verbo, nao so o destino', async () => {
  // O mapa tem marcadores que nao sao viagem. Casar so' o fim do titulo ("… Persian") faria a
  // ferramenta clicar em qualquer coisa que termine com o nome da caçada.
  const p = montar({
    dep: { equipe: SEIS, box: BOX, semJanela: true },
    onde: 'Persian',
    verboDoMarcador: 'Comprar em',
  });
  await p.api.salvarTime('caçada');
  assert.deepEqual(p.viagens, [], 'melhor ficar parado do que clicar no marcador errado');
});

test('a aba dos itens da familia nao se confunde com a dos pokemon', async () => {
  const protegidos = [{ nome: 'Devoted Token', qtd: 532 }];
  const p = montar({ dep: { equipe: SEIS, box: BOX, itens: [...protegidos] } });
  const r = await p.api.protegerItensAqui(() => {});
  assert.equal(r.ok, true, r.erro);
  assert.deepEqual(p.dep.est.familiaItens, protegidos, 'foi para a aba dos itens, nao a dos pokemon');
});
test('o segundo clique do Deposito e no dialogo, e nao na placa da rua', () => {
  // **DOIS BOTOES RESPONDEM PELO MESMO ROTULO, E SAO COISAS DIFERENTES.** Medido na conta do
  // dono em 27/10/2026, com o dialogo aberto:
  //
  //     .npc-plate-btn  "Abrir Depot"         <- a placa, la fora
  //     .npc-dlg-btn    "📦 Abrir Depósito"   <- o que abre mesmo a janela
  //
  // `botaoPorRotulo` devolve o primeiro do documento, e a placa vem antes. O "segundo clique"
  // voltava a clicar na placa, que so reabre o dialogo: a janela nunca aparecia, o ciclo parava
  // em "Cliquei no Depot e a janela nao abriu" e a venda inteira ficava por fazer.
  // Sem os comentarios: a explicacao do conserto cita o seletor errado de proposito, e um
  // guarda que casasse com ela reprovaria o texto em vez do codigo.
  const fonteTimes = readFileSync(new URL('../times.js', import.meta.url), 'utf8')
    .split('\n')
    .filter((linha) => !/^\s*(\/\/|\*|\/\*)/.test(linha))
    .join('\n');
  const bloco = fonteTimes.slice(fonteTimes.indexOf('const confirmar ='), fonteTimes.indexOf('const confirmar =') + 400);
  // E a caixa e' `.npc-dlg-actions`: o dialogo nao tem contentor com `npc-dlg` na classe, so
  // pecas irmas, e `[class*=npc-dlg]` cai no cabecalho, que so tem o "×". Essa foi a segunda
  // versao errada deste mesmo conserto, no mesmo dia.
  assert.match(bloco, /\.npc-dlg-actions/);
  assert.match(bloco, /raiz: caixa/);
  assert.ok(
    !/\[class\*=npc-dlg\]/.test(bloco),
    'o seletor largo cai no cabecalho do dialogo, onde o botao nao esta',
  );
  assert.ok(
    !/const confirmar = \(\) => porRotulo\('deposito', \/Abrir Dep\[oó\]sito\/i, \{ texto: true \}\);/.test(fonteTimes),
    'a procura nao pode voltar a varrer o documento inteiro: a placa da rua ganha sempre',
  );
});
