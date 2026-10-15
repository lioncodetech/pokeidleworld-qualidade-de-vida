import { writeFile } from 'node:fs/promises';

const MODIFICADORES = new Set([
  'Ancient', 'Banshee', 'Brave', 'Brute', 'Charged', 'Dark', 'Enigmatic', 'Enraged',
  'Evil', 'Freezing', 'Furious', 'Hard', 'Heavy', 'Magnetic', 'Nightmare', 'Psy',
  'Roll', 'Taekwondo', 'Tribal', 'Trickmaster', 'War',
]);

const semAcento = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const slug = (nome) => {
  let n = semAcento(nome)
    .replace(/[♀]/g, '-f').replace(/[♂]/g, '-m').replace(/[.'’]/g, '')
    .trim().toLowerCase().replace(/\s+/g, '-');
  if (n.startsWith('alolan-')) n = `${n.slice(7)}-alola`;
  if (n.startsWith('galarian-')) n = `${n.slice(9)}-galar`;
  const ajustes = {
    nidoranfe: 'nidoran-f',
    nidoranma: 'nidoran-m',
    'milch-miltank': 'miltank',
    'darmanitan-galar': 'darmanitan-galar-standard',
    'pyroar-female': 'pyroar-male',
    wormadam: 'wormadam-plant',
  };
  n = ajustes[n] || n;
  return n;
};

const especiesDaHunt = (nome) => {
  const partes = nome.split(/\s+e\s+/i);
  const primeira = partes[0].split(/\s+/);
  if (MODIFICADORES.has(primeira[0])) primeira.shift();
  const regional = ['Alolan', 'Galarian'].includes(primeira[0]) ? primeira[0] : '';
  const saida = [primeira.join(' ')];
  for (const parte of partes.slice(1))
    saida.push(regional && !/^(Alolan|Galarian)\s/i.test(parte) ? `${regional} ${parte}` : parte);
  return saida;
};

const mapa = await fetch('https://poke.idleworld.online/api/game/map-markers').then((r) => r.json());
const nomes = [...new Set(mapa.hunts.filter((h) => Number(h.level) > 0).map((h) => h.name))];
const cache = new Map();
const falhas = [];

async function tiposDe(especie) {
  const chave = slug(especie);
  if (!cache.has(chave))
    cache.set(chave, fetch(`https://pokeapi.co/api/v2/pokemon/${chave}`).then(async (r) => {
      if (!r.ok) throw new Error(`${r.status} ${chave}`);
      const p = await r.json();
      return p.types.sort((a, b) => a.slot - b.slot).map((t) => t.type.name.toUpperCase());
    }));
  return cache.get(chave);
}

const dados = {};
for (let i = 0; i < nomes.length; i += 12) {
  await Promise.all(nomes.slice(i, i + 12).map(async (nome) => {
    try {
      const grupos = await Promise.all(especiesDaHunt(nome).map(tiposDe));
      dados[nome] = [...new Set(grupos.flat())];
    } catch (e) {
      falhas.push(`${nome}: ${e.message}`);
    }
  }));
}

if (falhas.length) throw new Error(`Hunts sem tipo:\n${falhas.join('\n')}`);
const corpo = `// Gerado por scripts/gerar-tipos-hunts.mjs. Nao editar a mao.\n` +
  `// Tipos canonicos usados para comparar o atacante com cada hunt do jogo.\n` +
  `globalThis.PPX_TIPOS_HUNTS = Object.freeze(${JSON.stringify(dados, null, 2)});\n`;
await writeFile(new URL('../tipos-hunts.js', import.meta.url), corpo);
console.log(`${nomes.length} hunts gravadas em tipos-hunts.js.`);
