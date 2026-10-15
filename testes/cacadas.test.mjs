// Guardas da caçada favorita.
//
// O que se testa aqui nao e' "viaja" — e' que ela nao guarda a cidade por engano, nao viaja por
// cima de outra ferramenta, e nao diz "cheguei" sem ter chegado. Uma ferramenta de um clique que
// mente sobre o resultado e' pior do que nenhuma: o utilizador fecha a aba achando que esta a
// cacar.
//
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const fonte = readFileSync(new URL('../cacadas.js', import.meta.url), 'utf8');

function no(cls, texto = '', extra = {}) {
  return {
    className: cls,
    // As placas do mapa distinguem-se por classe: `on` e' a regiao aberta e `locked` e' a que o
    // nivel ainda nao destranca. Sem `classList`, o modulo nao via nem uma nem outra.
    classList: { contains: (c) => cls.split(' ').includes(c) },

    textContent: texto,
    innerText: texto,
    title: '',
    cliques: 0,
    click() {
      this.cliques += 1;
      if (this.aoClicar) this.aoClicar();
    },
    ...extra,
  };
}

/**
 * @param aqui onde o jogo diz que o jogador esta'
 * @param chegaEm para onde o jogo passa a dizer que ele esta' depois de clicar; null = nao mudou
 * @param noMapa que caçadas o mapa oferece
 * @param vezDe quem esta' com a vez na sessionStorage; null = ninguem
 */
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
  aqui = 'Route 1',
  chegaEm = undefined,
  noMapa = ['Route 1'],
  // O mapa por regiao: `{ Kanto: [...], Outland: [...] }`. Sem isto, tudo fica na regiao aberta.
  regioes = null,
  regiaoAberta = null,
  // As que o nivel do treinador ainda nao destranca. Da' para olhar o mapa delas; viajar, nao.
  travadas = [],
  semMapa = false,
  vezDe = null,
  // Caçadas ja' guardadas antes desta sessao, como estao no armazenamento.
  listaCrua = null,
  // O que o jogo mostra na tela quando se clica no marcador. O jogo nao recusa a viagem com um
  // erro: ele poe um aviso e nao sai do lugar.
  jogoDiz = '',
  // O mesmo aviso, mas vindo de dentro do chat — onde qualquer jogador escreve qualquer coisa.
  chatDiz = '',
  catalogoResposta = { hunts: [] },
} = {}) {
  let local = aqui;
  const viagens = [];
  const guardado = {};
  if (listaCrua)
    guardado['lioncode:pokeidleworld:cacadas'] = JSON.stringify({ lista: listaCrua });

  // A fila e' a do pacote (`PPX.vez`): quem ja' esta' agindo faz `pedir` devolver `null`.
  const PPX = {
    modulo: (meta, fn) => fn(),
    vez: { pedir: async () => (vezDe ? null : () => {}) },
    anotar: () => {},
    controlar: () => {},
  };
  globalThis.PPX = PPX;

  const tloc = no('phud-tloc', '');
  Object.defineProperty(tloc, 'textContent', { get: () => `Nível 267 · ${local}` });

  const btMapa = no('', 'Mapa');
  btMapa.title = 'Mapa';

  /**
   * O mapa com as suas quatro regioes — medido em 10/10/2026.
   *
   * **So' os marcadores da regiao aberta existem no DOM.** E' a razao de ser deste arreio: era
   * por isso que mandar ir a uma caçada de Outland nao fazia nada, e um mapa de mentira com
   * todos os marcadores sempre presentes daria a ferramenta quebrada por boa.
   */
  const marcadorDe = (nome) => {
    const m = no('hunt-marker', nome);
    m.title = `Viajar para ${nome}`;
    m.aoClicar = () => {
      // Regiao travada nao leva ninguem: o jogo nao reclama, so' nao te move.
      if (travadas.includes(aberta)) return;
      viagens.push(nome);
      if (chegaEm !== null) local = chegaEm === undefined ? nome : chegaEm;
      if (jogoDiz) mostrarNaTela(jogoDiz, false);
      if (chatDiz) mostrarNaTela(chatDiz, true);
    };
    return m;
  };
  // Sem `regioes`, tudo o que esta' em `noMapa` fica na regiao aberta: os testes antigos nao
  // sabem o que e' regiao, e nao tem de saber.
  const mapa = regioes || { Kanto: noMapa };
  const nomesDasRegioes = Object.keys(mapa);
  let aberta = regiaoAberta || nomesDasRegioes[0];
  const marcadores = () => (mapa[aberta] || []).map(marcadorDe);

  const trocasDePlaca = [];
  const placas = () =>
    nomesDasRegioes.map((nome) => {
      const b = no(
        `map-plate${nome === aberta ? ' on' : ''}${travadas.includes(nome) ? ' locked' : ''}`,
        '',
      );
      b.querySelector = (sel) => (sel === 'img' ? { alt: nome } : null);
      b.aoClicar = () => {
        trocasDePlaca.push(nome);
        aberta = nome;
      };
      return b;
    });

  // Um MutationObserver de mentira, com a peneira que importa: um no' dentro do chat sabe dizer
  // que esta' dentro do chat, e e' isso que o modulo usa para nao confundir conversa com
  // resposta do jogo.
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

  const doc = {
    body: noDom(),
    querySelector: (sel) => (sel === '.phud-tloc' ? tloc : null),
    querySelectorAll: (sel) => {
      if (sel === 'button') return semMapa ? [] : [btMapa, ...marcadores()];
      if (sel === '.hunt-marker') return semMapa ? [] : marcadores();
      if (sel === '.map-areas .map-plate') return semMapa ? [] : placas();
      return [];
    },
    addEventListener: () => {},
    dispatchEvent: () => {},
    createElement: () => noDom(),
    head: noDom(),
    documentElement: noDom(),
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
    'fetch',
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
    async () => ({ ok: true, status: 200, json: async () => catalogoResposta }),
    mod,
  );

  return {
    api: mod.exports,
    viagens,
    guardado,
    ondeEsta: () => local,
    // Por onde o mapa passou: prova que ele NAO troca de regiao quando nao precisa.
    trocasDePlaca: () => [...trocasDePlaca],
  };
}

test('guarda a caçada onde o jogador esta', () => {
  const p = montar({ aqui: 'Viridian Forest' });
  assert.match(p.api.salvar(), /Viridian Forest/);
  assert.deepEqual(p.api.cfg.lista, [{ nome: 'Viridian Forest', time: '' }]);
});

test('o lugar guardado atravessa o F5', () => {
  const p = montar({ aqui: 'Route 4' });
  p.api.salvar();
  assert.match(Object.values(p.guardado).join(''), /Route 4/);
});

test('modo compacto mostra resumo, nao a lista de hunts', () => {
  assert.match(fonte, /\.cjx\.compacto \.cjx-lista/);
  assert.match(fonte, /className = 'cjx-resumo'/);
  assert.match(fonte, /hunts · \$\{cfg\.lista\.length\} favoritas/);
});

test('carrega do jogo todas as caçadas, inclusive as regioes ainda bloqueadas', async () => {
  const p = montar({
    listaCrua: [{ nome: 'Route 4', time: '' }],
    catalogoResposta: {
      hunts: [
        { name: 'Shadow Lugia', level: 700, area: 'orre' },
        { name: 'Route 4', level: 20, area: 'kanto' },
        { name: 'Brave Venusaur', level: 180, area: 'outland' },
        { name: 'Cerulean', level: 0, area: 'kanto' },
      ],
    },
  });

  await p.api.atualizarCatalogo(true);
  const todas = p.api.todasConhecidas();

  assert.deepEqual(
    todas.map((c) => c.nome),
    ['Route 4', 'Brave Venusaur', 'Shadow Lugia'],
    'o atalho guardado vem primeiro e o catalogo completa o resto',
  );
  assert.equal(todas[0].guardada, true);
  assert.equal(todas.find((c) => c.nome === 'Shadow Lugia').trancada, true);
  assert.equal(todas.find((c) => c.nome === 'Brave Venusaur').trancada, false);
  assert.match(p.guardado['lioncode:pokeidleworld:cacadas:catalogo'], /Shadow Lugia/);
});

test('catalogo bloqueado explica a regiao sem abrir o mapa', async () => {
  const p = montar({
    aqui: 'Meowth',
    catalogoResposta: { hunts: [{ name: 'Shadow Lugia', level: 700, area: 'orre' }] },
  });
  await p.api.atualizarCatalogo(true);

  const r = await p.api.ir('Shadow Lugia', () => {}, { time: '' });

  assert.match(r, /fica em Orre, que o seu nivel ainda nao destranca/, r);
  assert.deepEqual(p.viagens, []);
});

test('nao guarda a cidade nem a loja como se fossem caçada', () => {
  // Clicar em "guardar" parado no Shopping transformaria o atalho de voltar a' caçada num atalho
  // de ir fazer compras — e so' se descobriria depois de uma madrugada sem cacar.
  for (const lugar of ['Shopping', 'Cerulean', 'Mercado']) {
    const p = montar({ aqui: lugar });
    assert.match(p.api.salvar(), /cidade, nao caçada/, lugar);
    assert.deepEqual(p.api.cfg.lista, [], `nao gravou ${lugar}`);
  }
});

test('sem caçada escolhida, nao viaja para lugar nenhum', async () => {
  const p = montar();
  assert.match(await p.api.ir(''), /Nenhuma caçada/);
  assert.deepEqual(p.viagens, []);
});

test('a mesma caçada nao entra duas vezes na lista', () => {
  const p = montar({ aqui: 'Route 4' });
  p.api.salvar();
  assert.match(p.api.salvar(), /ja esta na lista/);
  assert.deepEqual(p.api.cfg.lista, [{ nome: 'Route 4', time: '' }]);
});

test('apagar tira da lista sem viajar para lugar nenhum', () => {
  const p = montar({ aqui: 'Route 4' });
  p.api.salvar();
  assert.match(p.api.apagar('Route 4'), /tirada/);
  assert.deepEqual(p.api.cfg.lista, []);
  assert.deepEqual(p.viagens, []);
});

test('viaja clicando no marcador do mapa', async () => {
  const p = montar({ aqui: 'Shopping', noMapa: ['Route 7', 'Route 1'] });
  assert.match(await p.api.ir('Route 7'), /Route 7/);
  assert.deepEqual(p.viagens, ['Route 7']);
});

test('ja estando la, nao abre o mapa a toa', async () => {
  const p = montar({ aqui: 'Route 7' });
  assert.match(await p.api.ir('Route 7'), /ja esta/);
  assert.deepEqual(p.viagens, []);
});

test('nao diz "cheguei" se o jogo ainda diz outro lugar', async () => {
  // O clique no marcador pode nao pegar. Confirmar custa uma leitura; mentir custa uma noite
  // parado no mapa.
  const p = montar({ aqui: 'Shopping', noMapa: ['Route 7'], chegaEm: 'Shopping' });
  const r = await p.api.ir('Route 7');
  assert.doesNotMatch(r, /^Em "/);
  assert.match(r, /Confira/);
});

test('nao viaja para lugar nenhum se a caçada nao esta no mapa', async () => {
  const p = montar({ aqui: 'Shopping', noMapa: ['Route 1'] });
  assert.match(await p.api.ir('Lugar Que Nao Existe'), /Nao achei/);
  assert.deepEqual(p.viagens, []);
});

test('sem o botao do mapa, desiste em vez de fingir', async () => {
  const p = montar({ aqui: 'Shopping', semMapa: true });
  assert.match(await p.api.ir('Route 7'), /Nao achei/);
});

test('nao puxa o personagem se outra ferramenta esta com a vez', async () => {
  // A vez mora na sessionStorage da pagina justamente porque cada extensao tem o seu mundo de
  // JavaScript: e' o unico terreno comum entre elas.
  const p = montar({ aqui: 'Shopping', noMapa: ['Route 7'], vezDe: 'ciclo' });
  assert.match(await p.api.ir('Route 7'), /Outra ferramenta/);
  assert.deepEqual(p.viagens, [], 'nao abriu o mapa por cima do ciclo');
});

test('pede e solta a vez do pacote', () => {
  // Viajar por baixo do ciclo da loja estragaria as duas coisas.
  assert.match(fonte, /esperarAVez\(\)/);
  assert.match(fonte, /finally \{[\s\S]{0,40}soltar\(\);/, 'solta a vez mesmo quando falha');
});


// --- a caçada que leva o time ------------------------------------------------------------------
//
// E' o encaixe das duas ferramentas: a caçada guarda o NOME de um time, e quem monta e' a
// ferramenta Times. O que se partilha e' a decisao, nao a rotina do Depósito.

test('caçada sem time nao chama a ferramenta Times', async () => {
  const chamadas = [];
  const p = montar({ aqui: 'Shopping', noMapa: ['Route 7'] });
  globalThis.PPX.times = {
    nomes: () => ['hunt'],
    usar: async (n) => {
      chamadas.push(n);
      return { ok: true };
    },
  };
  p.api.cfg.lista = [{ nome: 'Route 7', time: '' }];
  assert.match(await p.api.ir('Route 7'), /Route 7/);
  assert.deepEqual(chamadas, [], 'a maior parte das caçadas se faz com a equipe que ja esta posta');
});

test('caçada com time monta o time antes de viajar', async () => {
  const ordem = [];
  const p = montar({ aqui: 'Shopping', noMapa: ['Route 7'] });
  globalThis.PPX.times = {
    nomes: () => ['hunt'],
    usar: async (n, o) => {
      ordem.push(`time:${n}:volta=${o?.voltar}`);
      return { ok: true };
    },
  };
  const antes = p.viagens.length;
  p.api.cfg.lista = [{ nome: 'Route 7', time: 'hunt' }];
  assert.match(await p.api.ir('Route 7'), /Route 7/);
  assert.deepEqual(ordem, ['time:hunt:volta=false'], 'nao pede volta: ela viaja logo a seguir');
  assert.equal(p.viagens.length, antes + 1);
});

test('se o time falha, nao viaja', async () => {
  // Chegar a caçada com a equipe errada e' pior do que nao ter saido: e' uma noite inteira a
  // cacar com o time que nao se queria.
  const p = montar({ aqui: 'Shopping', noMapa: ['Route 7'] });
  globalThis.PPX.times = {
    nomes: () => ['hunt'],
    usar: async () => ({ ok: false, erro: 'o Depósito nao abriu' }),
  };
  p.api.cfg.lista = [{ nome: 'Route 7', time: 'hunt' }];
  const r = await p.api.ir('Route 7');
  assert.match(r, /nao montei o time/);
  assert.deepEqual(p.viagens, []);
});

test('ja estando na caçada, ainda monta o time que ela pede', async () => {
  const p = montar({ aqui: 'Route 7', noMapa: ['Route 7'] });
  const chamadas = [];
  globalThis.PPX.times = {
    nomes: () => ['hunt'],
    usar: async (n) => {
      chamadas.push(n);
      return { ok: true };
    },
  };
  p.api.cfg.lista = [{ nome: 'Route 7', time: 'hunt' }];
  const r = await p.api.ir('Route 7');
  assert.deepEqual(chamadas, ['hunt']);
  assert.match(r, /ja estava/);
  assert.deepEqual(p.viagens, [], 'nao viajou para onde ja estava');
});

test('com a ferramenta Times desligada, diz isso e nao viaja', async () => {
  const p = montar({ aqui: 'Shopping', noMapa: ['Route 7'] });
  globalThis.PPX.times = undefined;
  p.api.cfg.lista = [{ nome: 'Route 7', time: 'hunt' }];
  assert.match(await p.api.ir('Route 7'), /Times nao esta ligada/);
  assert.deepEqual(p.viagens, []);
});

test('lista guardada no formato antigo, so com nomes, continua servindo', () => {
  const p = montar({ aqui: 'Route 1', listaCrua: ['Route 1', 'Route 7'] });
  assert.deepEqual(p.api.cfg.lista, [
    { nome: 'Route 1', time: '' },
    { nome: 'Route 7', time: '' },
  ]);
});

// --------------------------------------------------------------- o que o jogo responde
//
// O jogo nao recusa a viagem com um erro: ele mostra um aviso e simplesmente nao sai do lugar.
// Aconteceu de verdade em 10/10/2026, com o lider desmaiado: a ferramenta so' sabia dizer que
// "o jogo continua em Cerulean", e levou minutos a descobrir o que era.

const DESMAIADA =
  '💀 Sua equipe está desmaiada! Fale com a Enfermeira Joy para curá-la antes de ir caçar.';

test('equipe desmaiada: diz o que o jogo disse, e o que fazer', async () => {
  const p = montar({
    aqui: 'Cerulean',
    noMapa: ['Persian'],
    chegaEm: null, // clicou, e o jogo nao saiu do lugar
    jogoDiz: DESMAIADA,
  });

  const r = await p.api.ir('Persian');

  assert.match(r, /desmaiada/i, r);
  assert.match(r, /Nurse Joy/, `tem de dizer onde se cura: ${r}`);
  assert.equal(p.ondeEsta(), 'Cerulean');
});

test('sem aviso nenhum, a mensagem antiga continua valendo', async () => {
  // Nao se inventa um motivo quando nao ha' um: se o jogo nao disse nada, a ferramenta so' diz
  // onde o jogador ficou.
  const p = montar({ aqui: 'Cerulean', noMapa: ['Persian'], chegaEm: null });

  const r = await p.api.ir('Persian');

  assert.match(r, /Cliquei para viajar/, r);
  assert.doesNotMatch(r, /desmaiada/i);
});

test('"desmaiada" dito no chat nao e resposta do jogo', async () => {
  // O chat mundial e' de toda a gente. Ler dali seria deixar qualquer jogador escolher a
  // mensagem de erro da ferramenta.
  const p = montar({
    aqui: 'Cerulean',
    noMapa: ['Persian'],
    chegaEm: null,
    chatDiz: '02:14 Fulano [321]: minha equipe ta desmaiada de novo kkkk',
  });

  const r = await p.api.ir('Persian');

  assert.match(r, /Cliquei para viajar/, r);
  assert.doesNotMatch(r, /Nurse Joy/);
});

test('chegando bem, o aviso nao atrapalha nada', async () => {
  const p = montar({ aqui: 'Cerulean', noMapa: ['Persian'] });
  assert.match(await p.api.ir('Persian'), /Em "Persian"/);
  assert.equal(p.ondeEsta(), 'Persian');
});

// --------------------------------------------------------------- o time mandado de fora
//
// A mesma caçada serve a niveis diferentes com equipes diferentes. Por isso quem chama pode
// mandar o time, e entao e' o dele que vale — e' o que a Escada faz, escolhendo o time no
// proprio degrau. Os tres estados sao mesmo tres, e nao se podem confundir.

test('time mandado de fora vence o time da caçada', async () => {
  const chamadas = [];
  const p = montar({ aqui: 'Shopping', noMapa: ['Route 7'] });
  globalThis.PPX.times = {
    nomes: () => ['hunt', 'ginasio'],
    usar: async (n) => {
      chamadas.push(n);
      return { ok: true };
    },
  };
  p.api.cfg.lista = [{ nome: 'Route 7', time: 'hunt' }];

  await p.api.ir('Route 7', () => {}, { time: 'ginasio' });

  assert.deepEqual(chamadas, ['ginasio'], 'montou o de fora, nao o da caçada');
});

test('nao mandar time nenhum continua a usar o da caçada', async () => {
  // `undefined` nao e' "sem time": e' "nao tenho opiniao". Confundir os dois tiraria o time de
  // todas as caçadas que a Escada usasse.
  const chamadas = [];
  const p = montar({ aqui: 'Shopping', noMapa: ['Route 7'] });
  globalThis.PPX.times = {
    nomes: () => ['hunt'],
    usar: async (n) => {
      chamadas.push(n);
      return { ok: true };
    },
  };
  p.api.cfg.lista = [{ nome: 'Route 7', time: 'hunt' }];

  await p.api.ir('Route 7', () => {}, {});

  assert.deepEqual(chamadas, ['hunt']);
});

test('mandar vazio e dizer "nao troque o time"', async () => {
  const chamadas = [];
  const p = montar({ aqui: 'Shopping', noMapa: ['Route 7'] });
  globalThis.PPX.times = {
    nomes: () => ['hunt'],
    usar: async (n) => {
      chamadas.push(n);
      return { ok: true };
    },
  };
  p.api.cfg.lista = [{ nome: 'Route 7', time: 'hunt' }];

  await p.api.ir('Route 7', () => {}, { time: '' });

  assert.deepEqual(chamadas, [], 'a caçada pedia "hunt", e quem chamou disse que nao');
});

// --------------------------------------------------------------- as quatro regioes do mapa

const MUNDO = {
  Kanto: ['Meowth', 'Persian'],
  Outland: ['Brave Venusaur'],
  Orre: ['Shadow Lugia'],
};

test('caçada noutra regiao: troca de placa e vai', async () => {
  // O mapa so' desenha os marcadores da regiao aberta. Sem procurar nas outras, a ferramenta
  // esperava doze segundos por um marcador que nunca ia existir e dizia "nao achei no mapa".
  const p = montar({ aqui: 'Meowth', regioes: MUNDO, regiaoAberta: 'Kanto' });

  const r = await p.api.ir('Brave Venusaur', () => {}, { time: '' });

  assert.match(r, /Em "Brave Venusaur"/, r);
  assert.deepEqual(p.viagens, ['Brave Venusaur']);
  // Uma troca, e so' a que serviu: clicar na regiao que ja' estava aberta custaria os cinco
  // segundos de espera por um redesenho que nunca vem.
  assert.deepEqual(p.trocasDePlaca(), ['Outland']);
});

test('caçada na regiao ja aberta: nao mexe nas placas', async () => {
  const p = montar({ aqui: 'Meowth', regioes: MUNDO, regiaoAberta: 'Kanto' });

  assert.match(await p.api.ir('Persian', () => {}, { time: '' }), /Em "Persian"/);
  assert.deepEqual(p.trocasDePlaca(), [], 'nao havia por que trocar de regiao');
});

test('regiao travada: diz onde fica, em vez de "cliquei e nada"', async () => {
  // A regiao travada deixa olhar o mapa e nao deixa viajar — e nao reclama, so' nao te move.
  const p = montar({
    aqui: 'Meowth',
    regioes: MUNDO,
    regiaoAberta: 'Kanto',
    travadas: ['Orre'],
    chegaEm: null,
  });

  const r = await p.api.ir('Shadow Lugia', () => {}, { time: '' });

  assert.match(r, /fica em Orre, que o seu nivel ainda nao destranca/, r);
  assert.deepEqual(p.viagens, []);
});

test('caçada que nao existe em regiao nenhuma', async () => {
  const p = montar({ aqui: 'Meowth', regioes: MUNDO, regiaoAberta: 'Kanto' });

  const r = await p.api.ir('Mewtwo', () => {}, { time: '' });

  assert.match(r, /em nenhuma das regioes/, r);
  assert.deepEqual(p.viagens, []);
});
