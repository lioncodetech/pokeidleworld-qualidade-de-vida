// Guardas do ciclo da loja.
//
// O que se testa aqui nao e' "o ciclo roda" — e' que ele desiste nos lugares certos. Um ciclo
// que anda para sempre, ou que fala com o NPC errado, ou que compra sem saber o estoque, e' pior
// do que nao existir: ele erra sozinho, em segundo plano, enquanto o utilizador nao olha.
//
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { casadoresDeRotulo } from './nucleo-de-mentira.mjs';

const fonte = readFileSync(new URL('../ciclo.js', import.meta.url), 'utf8');

function no(cls, texto = '', extra = {}) {
  return {
    className: cls,
    textContent: texto,
    // `innerText` e nao so' `textContent`: o modulo le o dialogo por `innerText`, como no DOM
    // real. Um fake sem ele faz o teste passar por engano no caso "nao achou".
    innerText: texto,
    title: '',
    cliques: 0,
    filhos: [],
    click() {
      this.cliques += 1;
      if (this.aoClicar) this.aoClicar();
    },
    getBoundingClientRect() {
      return { x: this.x || 0, y: this.y || 0, width: 40, height: 20 };
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    ...extra,
  };
}

// O jogo tem seletor de idioma, e a mesma cena tem de dar o mesmo resultado em qualquer um.
// Os textos sairam do dicionario que o proprio jogo publica.
const EM = {
  pt: {
    conversar: 'Conversar',
    maquina: 'Usar máquina',
    inventario: 'Inventário',
    mapa: 'Mapa',
    viajar: 'Viajar para',
  },
  en: {
    conversar: 'Talk',
    maquina: 'Use machine',
    inventario: 'Inventory',
    mapa: 'Map',
    viajar: 'Travel to',
  },
};

/**
 * @param parede quantos passos o mapa aceita antes de deixar de rolar
 * @param markEm indice do NPC que se apresenta como Mark; -1 para nenhum
 * @param lingua em que lingua o jogo esta': 'pt' ou 'en'
 */
function montar({
  parede = 99,
  markEm = 0,
  npcs = 3,
  estoqueDe = {},
  loc = 'Route 1',
  lingua = 'pt',
} = {}) {
  const L = EM[lingua];
  let passosDados = 0; // passos que tiveram efeito
  let teclasDadas = 0; // teclas enviadas, com ou sem efeito — e' isto que revela a insistencia
  let deslocamento = 0;
  const falados = [];
  let dialogoAberto = null;

  const placas = [];
  for (let i = 0; i < npcs; i += 1) {
    const b = no('npc-plate-btn', L.conversar);
    b.x = 100 + i * 50;
    b.y = 100;
    b.idx = i;
    b.aoClicar = () => {
      falados.push(i);
      dialogoAberto = no('npc-dialog', i === markEm ? 'Mark\n×\nVende Pokébolas.' : 'Outro NPC');
    };
    placas.push(b);
  }
  // uma "Usar máquina" no meio: a slot machine, em que nunca se pode clicar por engano
  const slot = no('npc-plate-btn', L.maquina);
  slot.x = 120;
  slot.y = 100;
  slot.aoClicar = () => {
    throw new Error('clicou na slot machine');
  };
  placas.push(slot);

  const tloc = no('phud-tloc', `Nível 267 · ${loc}`);

  const invSlots = Object.entries(estoqueDe).map(([nome, qtd]) => {
    const s = no('inv-slot');
    const valor = typeof qtd === 'object' ? qtd : { texto: qtd };
    s.querySelector = (sel) => {
      if (sel === 'img') return { alt: nome };
      if (sel === '.inv-qty') return { textContent: String(valor.texto), title: valor.title || '' };
      return null;
    };
    return s;
  });

  const btInventario = no('', L.inventario);
  btInventario.title = L.inventario;
  const btMapa = no('', L.mapa);
  btMapa.title = L.mapa;
  const viagens = [];
  const marcador = no('hunt-marker', loc);
  marcador.title = `${L.viajar} ${loc}`;
  marcador.aoClicar = () => viagens.push(loc);

  const doc = {
    querySelector(sel) {
      if (sel === '.phud-tloc') return tloc;
      if (sel === '.npc-dialog') return dialogoAberto;
      if (sel === '.inv-window' || sel === '.mks-window' || sel === '.win-overlay') return null;
      return null;
    },
    querySelectorAll(sel) {
      if (sel === '.npc-plate-btn') {
        // o mapa "rola": a posicao muda enquanto houver caminho
        for (const p of placas) p.y = 100 - deslocamento;
        return placas;
      }
      if (sel === 'button') return [btInventario, btMapa, marcador];
      if (sel === '.inv-slot') return invSlots;
      if (sel === '.hunt-marker') return [marcador];
      return [];
    },
  };

  const PPX = { modulo: (meta, fn) => fn(), vez: { pedir: async () => () => {} } };
  // Os casadores de rotulo do nucleo DE VERDADE: sem eles este fake caia sempre para o texto
  // portugues escrito a mao, e o caminho que o jogo em ingles usa ficava sem guarda.
  Object.assign(PPX, casadoresDeRotulo({ querySelectorAll: (s) => doc.querySelectorAll(s) }));
  globalThis.PPX = PPX;

  const mod = { exports: {} };
  new Function(
    'PPX',
    'document',
    'localStorage',
    'setTimeout',
    'addEventListener',
    'dispatchEvent',
    'KeyboardEvent',
    'innerWidth',
    'innerHeight',
    'console',
    'module',
    fonte,
  )(
    PPX,
    doc,
    { getItem: () => null, setItem: () => {} },
    (fn, ms) => globalThis.setTimeout(fn, Math.min(ms, 1)),
    () => {},
    (ev) => {
      if (ev.tipo !== 'keydown') return;
      teclasDadas += 1;
      if (passosDados < parede) {
        passosDados += 1;
        deslocamento += 48;
      }
    },
    class {
      constructor(tipo) {
        this.tipo = tipo;
      }
    },
    1000,
    800,
    { log() {} },
    mod,
  );

  return { api: mod.exports, passos: () => passosDados, teclas: () => teclasDadas, falados, viagens, placas };
}

test('le onde o jogador esta, para saber para onde voltar', () => {
  const p = montar({ loc: 'Viridian Forest' });
  assert.equal(p.api.local(), 'Viridian Forest');
});

test('para de andar quando o mapa deixa de rolar', async () => {
  // Sem isto o ciclo martela a parede ate o teto duro, em segundo plano, sem sair do lugar.
  // O que denuncia a insistencia e' o numero de TECLAS enviadas, nao o de passos que andaram:
  // depois da parede os passos param de contar sozinhos, e um guarda que olhasse so para eles
  // passaria mesmo sem a parada. (Este teste ja' falhou por isso.)
  const p = montar({ parede: 4 });
  const andou = await p.api.andar('ArrowUp', 40);
  assert.ok(andou <= 5, `andou ${andou}, nao os 40 pedidos`);
  assert.ok(p.teclas() <= 8, `desistiu em ${p.teclas()} teclas, sem martelar as 40`);
});

test('nunca clica na slot machine ao procurar o Mark', async () => {
  // "Usar máquina" e' aposta. Clicar por engano seria o pior jeito de descobrir o erro.
  const p = montar({ markEm: 1 });
  await p.api.acharMark(); // a banca estoura se a slot for clicada
  assert.ok(true);
});

test('o ciclo protege, vende e so depois compra', () => {
  const proteger = fonte.indexOf('await times.protegerItensAqui(nota, interrompido)');
  const vender = fonte.indexOf('await vender()', proteger);
  const comprar = fonte.indexOf('await loja.abastecer(nota)', vender);
  assert.ok(proteger >= 0, 'inclui a proteção no Depósito da Família');
  assert.ok(proteger < vender, 'protege antes de vender');
  assert.ok(vender < comprar, 'vende antes de comprar');
});

test('atalho e agenda usam a venda conjunta de pokemon e itens', () => {
  assert.match(fonte, /rodar\(l\.venderTudo \|\| l\.venderAgora, l\.comprar\)/);
  assert.ok(
    fonte.match(/rodar\(l\.venderTudo \|\| l\.venderAgora, l\.comprar\)/g)?.length >= 2,
    'atalho e agenda usam venderTudo',
  );
});

test('botao de parada interrompe um ciclo em andamento', async () => {
  const p = montar({ loc: 'Cerulean' });
  const fim = p.api.rodar(() => {}, () => {});
  assert.equal(p.api.rodando(), true);
  assert.equal(p.api.parar(), true);
  await fim;
  assert.equal(p.api.rodando(), false);
  assert.equal(p.api.parar(), false, 'parar de novo nao inventa um ciclo');
});

test('saindo de Cerulean nao tenta voltar a Cerulean pelo mapa', () => {
  assert.match(fonte, /!\/\^\(Cerulean\|Market\|Shopping\)\$\/i\.test\(hunt\)/);
});

test('reconhece o Mark pelo que o dialogo diz, nao pela posicao', async () => {
  const p = montar({ markEm: 2 });
  assert.equal(await p.api.acharMark(), true);
  assert.ok(p.falados.includes(2), 'chegou a falar com o Mark');
});

test('diz que nao achou quando nenhum NPC e o Mark', async () => {
  const p = montar({ markEm: -1 });
  assert.equal(await p.api.acharMark(), false);
});

test('"9999+" nao vira um numero: estoque desconhecido', async () => {
  // O jogo trunca a exibicao. Tratar "9999+" como 9999 faria o ciclo comprar a diferenca de um
  // numero que nao e' verdade.
  const p = montar({ estoqueDe: { 'Ultra Ball': '9999+' } });
  assert.equal(await p.api.estoque('Ultra Ball'), Infinity);
});

test('tooltip do 9999+ devolve o estoque exato', async () => {
  const p = montar({ estoqueDe: { 'Ultra Ball': { texto: '9999+', title: 'Quantidade: 54.321' } } });
  assert.equal(await p.api.estoque('Ultra Ball'), 54321);
});

test('le o estoque exato quando o jogo o mostra', async () => {
  const p = montar({ estoqueDe: { 'Great Potion': '2465' } });
  assert.equal(await p.api.estoque('Great Potion'), 2465);
});

test('item que nao esta no inventario conta como zero', async () => {
  const p = montar({ estoqueDe: {} });
  assert.equal(await p.api.estoque('Ultra Ball'), 0);
});

test('volta para a cacada de onde saiu', async () => {
  const p = montar({ loc: 'Route 1' });
  assert.equal(await p.api.voltarPara('Route 1'), true);
  assert.deepEqual(p.viagens, ['Route 1']);
});

test('nao viaja para lugar nenhum se nao achar a cacada no mapa', async () => {
  const p = montar({ loc: 'Route 1' });
  assert.equal(await p.api.voltarPara('Lugar Que Nao Existe'), false);
  assert.deepEqual(p.viagens, [], 'melhor ficar parado do que viajar para o lugar errado');
});

// --- o jogo em ingles ---------------------------------------------------------------------------
//
// Era aqui que doia: as ferramentas casavam "Inventário", "Mapa" e "Conversar" escritos a mao, e
// com o jogo em ingles elas nao achavam botao nenhum e desistiam caladas.

test('em ingles: acha o Mark pelas placas "Talk"', async () => {
  const p = montar({ markEm: 2, lingua: 'en' });
  assert.equal(await p.api.acharMark(), true);
  assert.ok(p.falados.includes(2));
});

test('em ingles: nunca clica na "Use machine"', async () => {
  const p = montar({ markEm: 1, lingua: 'en' });
  await p.api.acharMark();
  assert.ok(true);
});

test('em ingles: volta para a cacada pelo mapa', async () => {
  const p = montar({ loc: 'Route 1', lingua: 'en' });
  assert.equal(await p.api.voltarPara('Route 1'), true);
  assert.deepEqual(p.viagens, ['Route 1']);
});

test('em ingles: le o estoque pelo botao "Inventory"', async () => {
  const p = montar({ estoqueDe: { 'Poké Ball': 42 }, lingua: 'en' });
  assert.equal(await p.api.estoque('Poké Ball'), 42);
});
test('a volta procura em todas as regioes do mapa, e nao so na aba aberta', () => {
  // **MEDIDO NA CONTA DO DONO EM 27/10/2026.** Com o Kanto a' vista ha' 227 `.hunt-marker` e
  // nenhum deles e' do Outland: os marcadores das outras regioes nao existem no DOM ate' a aba
  // ser aberta. A cacada do dono e' no Outland, o ciclo voltou ao mapa no Kanto, nao achou, e
  // deixou o personagem parado em Cerulean com a cacada desligada.
  //
  // "Nao achei X no mapa" nao era verdade — era "nao achei nesta aba", e a diferenca entre as
  // duas frases e' uma hora de cacada perdida sem ninguem perceber.
  assert.match(fonte, /\.map-areas \.map-plate/);
  assert.match(fonte, /const procurar = \(\) =>/);

  // As trancadas nao se tentam: clicar nelas nao leva a lado nenhum. E a que ja' esta aberta
  // tambem nao, porque ja foi procurada antes do laco.
  assert.match(fonte, /includes\('locked'\)/);
  assert.match(fonte, /includes\('on'\)/);

  // E a mensagem acompanhou: dizer "no mapa" quando se olhou uma aba so manda procurar o defeito
  // no sitio errado.
  assert.match(fonte, /em nenhuma regiao do mapa/);
});
