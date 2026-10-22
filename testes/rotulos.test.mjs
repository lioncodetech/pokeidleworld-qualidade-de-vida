import test from 'node:test';
import assert from 'node:assert/strict';
import { montarNucleo, casadoresDeRotulo } from './nucleo-de-mentira.mjs';

// Os rotulos do jogo em tres linguas.
//
// O jogo tem um seletor de idioma, e as ferramentas casavam texto portugues escrito a mao: com o
// jogo em ingles, `porTitulo('Voltar para Cerulean')` devolvia null e a ferramenta desistia em
// silencio — foi assim que "criar um time novo nao guarda" apareceu. Os valores daqui nao foram
// adivinhados: sairam do dicionario que o proprio jogo publica no pacote dele (22/10/2026).
//
// O que estes guardas prendem e' o casamento, nao a lista: se alguem tirar a forma inglesa de um
// rotulo que as ferramentas usam, o primeiro teste cai.

const USADOS_PELAS_FERRAMENTAS = [
  'cidade',
  'mapa',
  'inventario',
  'conversar',
  'fechar',
  'deposito',
  'mercado',
  'curarEquipe',
  'selecionarTudo',
  'vender',
  'comprar',
  'itens',
  'familia',
  'usarMaquina',
  'abaPokemon',
  'cancelar',
  'confirmar',
  'venderMesmoAssim',
  'shopping',
  'mercadoLocal',
  'cidadeNome',
  'itemGenerico',
  'viajarPara',
];

const botao = (texto, titulo = '') => ({ textContent: texto, title: titulo, click() {} });
const docCom = (...botoes) => ({ querySelectorAll: () => botoes });

test('todo rotulo que as ferramentas usam existe e tem forma', () => {
  const { PPX } = montarNucleo();
  const nomes = PPX.rotulos.nomes();
  for (const nome of USADOS_PELAS_FERRAMENTAS) {
    assert.ok(nomes.includes(nome), `rotulo ${nome} desapareceu da tabela`);
    assert.ok(PPX.rotulos.formas(nome).length > 0, `rotulo ${nome} ficou sem forma`);
  }
});

test('nenhum rotulo esta' + ' so em portugues: o jogo em ingles tem de casar', () => {
  const { PPX } = montarNucleo();
  // Acentos e cedilha sao marca de portugues. Nomes proprios ("Pokémon", "Cerulean") e palavras
  // iguais nas duas linguas ("Item") ficam de fora de proposito.
  const soPortugues = ['Voltar para', 'Inventário', 'Fechar', 'Abrir Dep', 'Curar', 'Família'];
  for (const nome of USADOS_PELAS_FERRAMENTAS) {
    const formas = PPX.rotulos.formas(nome);
    const todasPt = formas.every((f) => soPortugues.some((p) => f.includes(p)));
    assert.equal(todasPt, false, `${nome} so tem forma portuguesa: ${formas.join(' / ')}`);
  }
});

test('limparRotulo tira emoji, acento, caixa e espaco a mais', () => {
  const { PPX } = montarNucleo();
  const l = PPX.limparRotulo;
  assert.equal(l('📦 Open Depot'), 'open depot');
  assert.equal(l('Abrir Depósito'), 'abrir deposito');
  assert.equal(l('  Voltar  para  Cerulean '), 'voltar para cerulean');
  assert.equal(l('💊 Heal team'), 'heal team');
  assert.equal(l('Vender (73) · 1.314.000'), 'vender 73 1 314 000');
  assert.equal(l(null), '');
  assert.equal(l(undefined), '');
});

test('eRotulo exige o rotulo inteiro, nas tres linguas', () => {
  const { PPX } = montarNucleo();
  for (const texto of ['Close', 'Fechar', 'Cerrar', 'FECHAR']) assert.ok(PPX.eRotulo('fechar', texto));
  // "Sell" dentro de "Sell stones" e' outro botao: clicar no errado numa ferramenta que vende
  // nao se desfaz.
  assert.equal(PPX.eRotulo('vender', 'Sell stones'), false);
  assert.equal(PPX.eRotulo('fechar', ''), false);
  assert.equal(PPX.eRotulo('rotulo-que-nao-existe', 'Close'), false);
});

test('comecaComRotulo aceita prefixo, mas nao palavra colada', () => {
  const { PPX } = montarNucleo();
  assert.ok(PPX.comecaComRotulo('vender', 'Sell (73) · 1.314.000'));
  assert.ok(PPX.comecaComRotulo('vender', 'Vender (73)'));
  assert.ok(PPX.comecaComRotulo('familia', 'Family: Items'));
  assert.ok(PPX.comecaComRotulo('fechar', 'Close'));
  assert.equal(PPX.comecaComRotulo('vender', 'Sellout (73)'), false);
  assert.equal(PPX.comecaComRotulo('vender', ''), false);
});

test('botaoPorRotulo acha pelo title e pelo texto', () => {
  const doc = docCom(
    botao('', 'Map'),
    botao('💊 Heal team'),
    botao('', 'Back to Cerulean'),
    botao('Sell (73) · 1.314.000'),
  );
  const r = casadoresDeRotulo(doc);
  assert.equal(r.botaoPorRotulo('mapa').title, 'Map');
  assert.equal(r.botaoPorRotulo('cidade').title, 'Back to Cerulean');
  assert.equal(r.botaoPorRotulo('curarEquipe', { texto: true }).textContent, '💊 Heal team');
  assert.equal(r.botaoPorRotulo('vender', { texto: true, comeca: true }).textContent.startsWith('Sell'), true);
  // Sem o `comeca`, "Sell (73)" nao e' o rotulo "Sell": e' o que impede o botao de acao de passar
  // por aba e vice-versa.
  assert.equal(r.botaoPorRotulo('vender', { texto: true }), null);
  assert.equal(r.botaoPorRotulo('deposito', { texto: true }), null);
});

test('botaoPorRotulo respeita a raiz: janela errada nao conta', () => {
  const daJanela = botao('Close');
  const janela = docCom(daJanela);
  const r = casadoresDeRotulo(docCom(botao('Close'), botao('Sell (1)')));
  assert.equal(r.botaoPorRotulo('fechar', { texto: true, raiz: janela }), daJanela);
  assert.equal(r.botaoPorRotulo('vender', { texto: true, comeca: true, raiz: janela }), null);
});

test('o mesmo rotulo casa com o jogo em qualquer das tres linguas', () => {
  const porLingua = {
    en: { cidade: 'Back to Cerulean', mapa: 'Map', inventario: 'Inventory' },
    pt: { cidade: 'Voltar para Cerulean', mapa: 'Mapa', inventario: 'Inventário' },
    es: { cidade: 'Volver a Cerulean', mapa: 'Mapa', inventario: 'Inventario' },
  };
  for (const [lingua, botoes] of Object.entries(porLingua)) {
    const doc = docCom(...Object.values(botoes).map((t) => botao('', t)));
    const r = casadoresDeRotulo(doc);
    for (const nome of Object.keys(botoes))
      assert.equal(r.botaoPorRotulo(nome)?.title, botoes[nome], `${nome} falhou em ${lingua}`);
  }
});

test('o shopping e o mercado sao cidade nas tres linguas', () => {
  const { PPX } = montarNucleo();
  for (const nome of ['Shopping Mall', 'Shopping']) assert.ok(PPX.eRotulo('shopping', nome));
  for (const nome of ['Market', 'Mercado']) assert.ok(PPX.eRotulo('mercadoLocal', nome));
  assert.ok(PPX.eRotulo('cidadeNome', 'Cerulean'));
  // Uma caçada de verdade nao pode ser confundida com cidade.
  for (const nome of ['shopping', 'mercadoLocal', 'cidadeNome'])
    assert.equal(PPX.eRotulo(nome, 'Viridian Forest'), false);
});

test('contemRotulo acha a palavra no meio, mas nao dentro de outra palavra', () => {
  const { PPX } = montarNucleo();
  // A linha do pokemon e' texto corrido, e a grade e' uma palavra no meio dele.
  assert.ok(PPX.contemRotulo('gradeLendaria', 'Nv 72 · IV 180/192 · Lendário'));
  assert.ok(PPX.contemRotulo('gradeLendaria', 'Nv 72 · Legendary · IV 180'));
  assert.ok(PPX.contemRotulo('gradeDivina', 'Nv 1 · Divine · IV 1'));
  // "Divino" dentro de "Adivinho" nao e' grade nenhuma: casar solto condenaria um pokemon comum
  // a passar por protegido — ou, ao contrario, faria a ferramenta confiar no filtro errado.
  assert.equal(PPX.contemRotulo('gradeDivina', 'Nv 9 · Adivinho · IV 100'), false);
  assert.equal(PPX.contemRotulo('gradeLendaria', 'Nv 9 · Prelendario · IV 100'), false);
  assert.equal(PPX.contemRotulo('gradeLendaria', ''), false);
});
