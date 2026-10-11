// Os atalhos do pacote, vistos como um catalogo unico.
//
// Tres coisas podem correr mal com um atalho, e nenhuma delas aparece numa banca de ferramenta
// isolada — cada uma passa sozinha sem saber das outras:
//
// 1. **Duas ferramentas na mesma tecla.** Uma rouba a outra, e qual delas ganha depende da ordem
//    em que carregaram. Medido em 11/10/2026: o Alt+P da Escada era tambem o do caderno de
//    anotacoes, que corre em TODOS os sites — e por isso tambem neste.
// 2. **O menu a mentir.** O que o painel anuncia e' um texto, e o que a tecla faz e' outro
//    sitio. Quando os dois se separam, o menu passa a ensinar o atalho errado — e foi assim que
//    um menu continuou a prometer "Alt+X roda o ciclo" depois de o ciclo ter mudado para Alt+K.
// 3. **O nucleo a discordar da ferramenta.** O nucleo guarda uma copia dos atalhos de cada
//    ferramenta, para o menu ter o que mostrar quando ela nao carrega. Duas verdades sobre a
//    mesma coisa divergem sempre.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ler = (nome) => readFileSync(new URL(`../${nome}`, import.meta.url), 'utf8');

/** As teclas que o caderno de anotacoes (`geral-anotacoes`) usa. Ele corre em qualquer site. */
const DO_CADERNO = ['o', 'p'];

/**
 * As da nossa `sem-grafico`, que nao esta' nesta lista porque nao e' uma janela e nao corre deste
 * lado: ela vive em `world: MAIN` e tem o teclado dela. As mesmas teclas estao ainda declaradas
 * pela extensao `pokepixel-sem-grafico`, que poe este site nos `matches` e aqui nao faz nada —
 * uma tecla nao pergunta de que extensao e', quem carregar primeiro ganha, e por isso essa tem
 * de largar este site.
 */
const DE_FORA = ['g', 'h'];

/** As do proprio nucleo, que valem em todo o pacote. */
const DO_NUCLEO = ['q', 'z', 'x'];

const FERRAMENTAS = ['captura', 'cacadas', 'times', 'arrumar', 'escada', 'loja', 'ciclo'];

/** `Alt+W esconde · Alt+E mostra` -> ['w', 'e'] */
const teclasDe = (texto) =>
  [...texto.matchAll(/Alt\+(?:Shift\+)?([A-Z])\b/g)].map((m) => m[1].toLowerCase());

/** A linha `atalhos: '...'` que a propria ferramenta declara. */
function anunciado(fonte) {
  const m = fonte.match(/atalhos:\s*'([^']+)'/);
  return m ? m[1] : null;
}

test('cada ferramenta anuncia os atalhos que tem', () => {
  for (const nome of FERRAMENTAS) {
    const texto = anunciado(ler(`${nome}.js`));
    assert.ok(texto, `${nome} nao declara atalhos`);
    assert.ok(teclasDe(texto).length > 0, `${nome} anuncia "${texto}" sem nenhuma tecla`);
  }
});

test('a tecla que o menu anuncia e a tecla que o codigo escuta', () => {
  // Sem isto, mudar o atalho num sitio e esquecer o outro deixa o menu a ensinar o errado — e
  // quem le' o menu nao tem como descobrir que ele mente a nao ser carregando na tecla.
  for (const nome of FERRAMENTAS) {
    const fonte = ler(`${nome}.js`);
    for (const tecla of teclasDe(anunciado(fonte))) {
      const escuta =
        fonte.includes(`'${tecla}'`) || fonte.includes(`Key${tecla.toUpperCase()}`);
      assert.ok(escuta, `${nome} anuncia Alt+${tecla.toUpperCase()} e nao escuta essa tecla`);
    }
  }
});

test('o nucleo nao contradiz a ferramenta sobre o atalho dela', () => {
  // O nucleo tem uma copia para o menu mostrar quando a ferramenta nao carrega. Uma copia que
  // diverge e' pior do que nenhuma: ela aparece exatamente quando ninguem pode conferir.
  const nucleo = ler('nucleo.js');
  for (const nome of FERRAMENTAS) {
    const texto = anunciado(ler(`${nome}.js`));
    assert.ok(
      nucleo.includes(`'${texto}'`),
      `o nucleo nao tem "${texto}" para a ferramenta ${nome}`,
    );
  }
});

test('duas ferramentas nunca ficam na mesma tecla', () => {
  const dono = new Map();
  for (const tecla of DO_NUCLEO) dono.set(tecla, 'nucleo');
  for (const tecla of DO_CADERNO) dono.set(tecla, 'geral-anotacoes');
  for (const tecla of DE_FORA) dono.set(tecla, 'sem-grafico');

  for (const nome of FERRAMENTAS) {
    // Deduplicado: a mesma tecla duas vezes na MESMA ferramenta e' de proposito — o Alt+J e o
    // Alt+Shift+J do Arrumar sao a mesma tecla com um modificador, e nao duas donas.
    for (const tecla of new Set(teclasDe(anunciado(ler(`${nome}.js`))))) {
      const antes = dono.get(tecla);
      assert.equal(
        antes,
        undefined,
        `Alt+${tecla.toUpperCase()} e' de ${nome} e tambem de ${antes}`,
      );
      dono.set(tecla, nome);
    }
  }
});

test('toda janela tem uma tecla para esconder e outra para mostrar', () => {
  // Um atalho so', que alterna, obriga a olhar para a tela antes de o usar: ele faz o contrario
  // do que fez da ultima vez. Pedido assim em 11/10/2026, como ja' era no PokePixel.
  const JANELAS = ['cacadas', 'times', 'arrumar', 'escada', 'loja'];
  for (const nome of JANELAS) {
    const texto = anunciado(ler(`${nome}.js`));
    assert.match(texto, /esconde/, `${nome}: "${texto}" nao diz qual tecla esconde`);
    assert.match(texto, /mostra/, `${nome}: "${texto}" nao diz qual tecla mostra`);
    assert.ok(
      new Set(teclasDe(texto)).size >= 2,
      `${nome} anuncia "${texto}" com uma tecla so`,
    );
  }
});

test('esconder e trazer de volta todas e do nucleo, e esta anunciado', () => {
  const nucleo = ler('nucleo.js');
  assert.match(nucleo, /Alt\+Z<\/b> esconde todas as janelas/);
  assert.match(nucleo, /Alt\+X<\/b> traz de volta as que estavam à vista/);
  assert.match(nucleo, /if \(e\.code === 'KeyZ'\) esconderTudo\(\);/);
});
