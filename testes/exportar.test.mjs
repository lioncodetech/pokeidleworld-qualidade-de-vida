import assert from 'node:assert/strict';
import test from 'node:test';
import { montarNucleo } from './nucleo-de-mentira.mjs';

/** Um núcleo com o armazenamento já semeado. */
function com(pares) {
  const n = montarNucleo();
  for (const [k, v] of Object.entries(pares)) n.loja[k] = v;
  return n;
}

const P = 'lioncode:pokeidleworld:';

test('exporta as definições do pacote com o valor tal como está guardado', () => {
  const n = com({ [P + 'loja:cfg']: '{"auto":true}', [P + 'cacadas']: '[1,2]' });
  const feito = n.PPX.exportarTudo();
  assert.deepEqual(feito.dados, { [P + 'loja:cfg']: '{"auto":true}', [P + 'cacadas']: '[1,2]' });
  assert.equal(feito.quantas, 2);
  // O texto viaja como está: reinterpretar abriria espaço para o código sair diferente do que a
  // janela de origem tem guardado.
  assert.equal(typeof feito.dados[P + 'cacadas'], 'string');
});

test('os times ficam de fora — foi o pedido', () => {
  // Um time é feito dos pokémon daquela conta. Levado para outra janela, aponta para bichos que
  // lá não existem.
  const n = com({ [P + 'times']: '{"A":[1,2,3]}', [P + 'escada']: '{"x":1}' });
  const feito = n.PPX.exportarTudo();
  assert.equal(feito.dados[P + 'times'], undefined, 'os times não podem sair no código');
  assert.deepEqual(Object.keys(feito.dados), [P + 'escada']);
});

test('a vez e o sinal entre janelas também ficam de fora, e são contados', () => {
  // A vez não é definição: é a fila a correr agora. Importada, uma janela nova nasceria com a vez
  // de outra já tomada e toda a automação ficaria à espera de alguém que não está lá.
  const n = com({
    [P + 'vez']: '{"dono":"loja"}',
    [P + 'arrumar:sinal']: '"abc"',
    [P + 'times']: '{}',
    [P + 'menu-pos']: '{"x":10}',
  });
  const feito = n.PPX.exportarTudo();
  assert.deepEqual(Object.keys(feito.dados), [P + 'menu-pos']);
  assert.equal(feito.fora, 3, 'quem ficou de fora de propósito tem de ser contado');
});

test('o que não é deste pacote não entra', () => {
  // `lioncode:gym:tarefa` é tarefa a meio, não definição — e não tem o prefixo. O resto é do jogo
  // e de outras extensões: levar isso seria exportar a sessão de outra gente.
  const n = com({
    'lioncode:gym:tarefa': '"a-meio"',
    'next-auth.session-token': 'segredo',
    'lioncode:pokepixel:cfg': '{}',
    [P + 'modulos']: '{"loja":true}',
  });
  const feito = n.PPX.exportarTudo();
  assert.deepEqual(Object.keys(feito.dados), [P + 'modulos']);
  assert.equal(feito.fora, 0, 'o que nunca foi deste pacote não é "deixado de fora", é alheio');
});

test('ferramenta nova entra sozinha no código', () => {
  // A varredura é por prefixo, não por lista escrita à mão. Lista à mão envelhece calada: a
  // ferramenta nova guarda a chave dela, ninguém se lembra de a juntar, e o utilizador descobre
  // que perdeu a configuração quando já trocou de janela.
  const n = com({ [P + 'ferramenta-que-ainda-nao-existe']: '{"a":1}' });
  const feito = n.PPX.exportarTudo();
  assert.deepEqual(Object.keys(feito.dados), [P + 'ferramenta-que-ainda-nao-existe']);
});

test('sem nada guardado, diz zero em vez de rebentar', () => {
  const feito = montarNucleo().PPX.exportarTudo();
  assert.equal(feito.quantas, 0);
  assert.deepEqual(feito.dados, {});
});

test('armazenamento trancado não derruba o menu', () => {
  // Modo anónimo e armazenamento cheio existem. O menu tem de continuar de pé: um erro aqui
  // apagaria o painel inteiro, não só o botão.
  const n = montarNucleo();
  Object.defineProperty(n.loja, 'nada', {
    get() {
      throw new Error('trancado');
    },
    enumerable: true,
  });
  assert.doesNotThrow(() => n.PPX.exportarTudo());
});

test('o código diz de onde veio e em que formato', () => {
  // Quem colar isto um dia num importador precisa de saber que é deste pacote e desta versão do
  // formato; sem isso, o importador adivinha.
  const feito = montarNucleo().PPX.exportarTudo();
  assert.equal(feito.v, 1);
  assert.equal(feito.de, 'pokeidleworld');
});

test('o botão existe no menu e é ele que chama o exportar', async () => {
  // A decisão certa num ficheiro que ninguém chama não exporta nada. A banca devolve um nó novo a
  // cada `querySelector`, por isso a ligação não se observa pelo DOM de mentira — aqui ela lê-se
  // no fonte, que é onde ela vive.
  const { ler } = await import('./nucleo-de-mentira.mjs');
  const fonte = ler('nucleo.js');
  assert.match(fonte, /class="exportar"/, 'o menu não tem o botão de exportar');
  assert.match(fonte, />Exportar tudo</);
  assert.match(fonte, /menu\.querySelector\('\.exportar'\)\.onclick/);
  assert.match(fonte, /globalThis\.PPX\.exportarTudo\(\)/);
  // O código vai para uma caixa de texto à vista: escrever na área de transferência pede permissão
  // do navegador, e dentro do LionMultInstance essa permissão não é garantida.
  assert.match(fonte, /caixaCodigo\.value = JSON\.stringify\(feito\)/);
});

test('chave sem valor vira texto vazio, não um nulo no código', () => {
  // Entre enumerar a chave e ler o valor, outra janela do jogo pode apagá-la — o `getItem`
  // devolve `null`. Sem normalizar, o código sairia com `null` ali dentro e quem o lesse um dia
  // teria de adivinhar se era "vazio" ou "não existe".
  const n = montarNucleo();
  n.loja[P + 'escada'] = null;
  const feito = n.PPX.exportarTudo();
  assert.equal(feito.dados[P + 'escada'], '', 'valor ausente tem de sair como texto vazio');
  assert.notEqual(feito.dados[P + 'escada'], null);
});

// ------------------------------------------------------------------ aplicar um código colado

test('aplica as definições do código e grava mesmo', () => {
  const n = montarNucleo();
  const feito = n.PPX.importarTudo(
    JSON.stringify({ v: 1, de: 'pokeidleworld', dados: { [P + 'escada']: '{"x":1}' } }),
  );
  assert.equal(feito.gravadas, 1);
  assert.equal(n.loja[P + 'escada'], '{"x":1}', 'o valor tem de ficar no armazenamento');
});

test('o código colado também não traz times, nem que os traga', () => {
  // A peneira do importar é a mesma do exportar de propósito. O código colado NÃO é de confiança:
  // pode vir de uma versão antiga que ainda exportava os times, ou de alguém que o editou à mão.
  // Confiar em que "o exportar já tirou" é confiar em software que não está a correr aqui.
  const n = montarNucleo();
  n.loja[P + 'times'] = '{"MEU":[9]}';
  const feito = n.PPX.importarTudo(
    JSON.stringify({ dados: { [P + 'times']: '{"ALHEIO":[1]}', [P + 'cacadas']: '[]' } }),
  );
  assert.equal(n.loja[P + 'times'], '{"MEU":[9]}', 'os meus times não podem ser substituídos');
  assert.equal(feito.gravadas, 1);
  assert.equal(feito.fora, 1);
});

test('a vez de outra janela nunca entra', () => {
  // Importar a vez faria esta janela nascer com a fila tomada por um dono que não está cá, e toda
  // a automação ficaria à espera para sempre.
  const n = montarNucleo();
  const feito = n.PPX.importarTudo(
    JSON.stringify({ dados: { [P + 'vez']: '{"dono":"loja"}', [P + 'modulos']: '{"loja":true}' } }),
  );
  assert.equal(n.loja[P + 'vez'], undefined);
  assert.equal(feito.gravadas, 1);
});

test('aceita o objeto inteiro ou só o mapa de chaves', () => {
  // Quem cola texto cola o que tem à mão; recusar por causa da embalagem seria recusar por nada.
  const n = montarNucleo();
  const feito = n.PPX.importarTudo(JSON.stringify({ [P + 'agenda']: '{"h":8}' }));
  assert.equal(feito.gravadas, 1);
  assert.equal(n.loja[P + 'agenda'], '{"h":8}');
});

test('o que não é deste pacote não é gravado', () => {
  // Um código de outra extensão, ou com a sessão do jogo dentro, não pode escrever nada aqui.
  const n = montarNucleo();
  const r = n.PPX.importarTudo(
    JSON.stringify({ 'next-auth.session-token': '"roubado"', 'lioncode:gym:tarefa': '"x"' }),
  );
  assert.ok(r.erro, 'código sem nada deste pacote tem de ser recusado');
  assert.equal(n.loja['next-auth.session-token'], undefined);
  assert.equal(n.loja['lioncode:gym:tarefa'], undefined);
});

test('valor que não é JSON não entra, para não virar lixo com cara de definição', () => {
  // O `ler` de cada ferramenta cairia no padrão dela e nunca leria isto. Gravar na mesma deixaria
  // lixo no armazenamento a parecer configuração.
  const n = montarNucleo();
  const r = n.PPX.importarTudo(JSON.stringify({ [P + 'escada']: 'isto nao e json' }));
  assert.ok(r.erro);
  assert.equal(n.loja[P + 'escada'], undefined);
});

test('texto torto é recusado com frase, não com exceção', () => {
  const n = montarNucleo();
  assert.match(n.PPX.importarTudo('{{{').erro, /JSON/);
  assert.ok(n.PPX.importarTudo('[1,2,3]').erro);
  assert.ok(n.PPX.importarTudo('').erro);
  assert.ok(n.PPX.importarTudo(null).erro);
});

test('importar não apaga o que já havia e o código não tocou', () => {
  // Importar é ganhar definições, não trocar a janela por outra.
  const n = montarNucleo();
  n.loja[P + 'loja:cfg'] = '{"meu":true}';
  n.PPX.importarTudo(JSON.stringify({ [P + 'cacadas']: '[]' }));
  assert.equal(n.loja[P + 'loja:cfg'], '{"meu":true}');
});

test('o botão de aplicar existe e manda recarregar a página', async () => {
  // As ferramentas leem o armazenamento quando montam: prometer efeito imediato seria mentir, e o
  // utilizador colaria o código outra vez a achar que não entrou.
  const { ler } = await import('./nucleo-de-mentira.mjs');
  const fonte = ler('nucleo.js');
  assert.match(fonte, /class="importar"/);
  assert.match(fonte, /globalThis\.PPX\.importarTudo\(caixaCodigo\.value\)/);
  assert.match(fonte, /Recarregue a página para valerem/);
  assert.match(fonte, /location\.reload\(\)/);
  // E a caixa deixou de ser só de leitura, senão não há onde colar.
  assert.doesNotMatch(fonte, /<textarea class="codigo" readonly>/);
});

test('o código "null" é recusado em vez de rebentar', () => {
  // `JSON.parse('null')` devolve `null`, e `Object.entries(null)` atira. Sem a guarda, colar a
  // palavra null derrubava o menu — e o menu é o controlo de tudo o resto.
  const n = montarNucleo();
  assert.doesNotThrow(() => n.PPX.importarTudo('null'));
  assert.ok(n.PPX.importarTudo('null').erro);
});

test('valor que não é texto não entra', () => {
  // `JSON.parse` aceita um número à força (`JSON.parse(5)` lê "5"), e sem a verificação do tipo o
  // armazenamento ficava com um número onde devia estar o texto que o jogo guardou.
  const n = montarNucleo();
  const r = n.PPX.importarTudo(JSON.stringify({ [P + 'escada']: 5, [P + 'agenda']: { h: 8 } }));
  assert.ok(r.erro, 'nada aproveitável nesse código');
  assert.equal(n.loja[P + 'escada'], undefined);
});

test('a caixa de colar está à vista antes de qualquer clique', async () => {
  // Publicado assim na 1.5.0 e corrigido na 1.5.1: a caixa nascia com `display: none` e só o
  // Exportar a abria. O botão Aplicar existia, mas a única forma de revelar onde colar era gerar
  // o próprio código POR CIMA do que se queria colar — ou seja, o importar não se podia usar.
  const { ler } = await import('./nucleo-de-mentira.mjs');
  const fonte = ler('nucleo.js');
  const bloco = fonte.slice(fonte.indexOf('.levar textarea {'));
  const regra = bloco.slice(0, bloco.indexOf('}'));
  assert.doesNotMatch(regra, /display:\s*none/, 'a caixa de colar não pode nascer escondida');
  assert.doesNotMatch(fonte, /caixaCodigo\.classList\.add\('aberta'\)/);
});
