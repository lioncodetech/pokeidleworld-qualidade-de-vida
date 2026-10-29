// A ferramenta que para o desenho do jogo.
//
// Ela e' a unica do pacote que corre no mundo da PAGINA, porque o que ela toca —
// `window.__engine` — e' uma variavel do jogo, e um content script normal tem o seu proprio
// `window` e nao a ve'. Isso muda o que esta banca tem de provar: nao chega ver que a ferramenta
// funciona, e' preciso ver que ela e o menu, que vivem em lados opostos da fronteira, continuam
// a falar um com o outro.
//
// O motor aqui e' de mentira, mas e' o motor medido no jogo em 11/10/2026: um `app` do Pixi com
// `stop`/`start`, um `world` com `visible`, um `frameCount` que conta quadros, e um `animated`
// que o motor mantem sozinho.
//
// A banca da primeira versao tinha este buraco: o motor de mentira nunca destruia um sprite. Por
// isso ela nao viu o defeito que o jogo mostrou — 866 animacoes devolvidas, 865 delas de sprites
// mortos. O motor de mentira daqui destroi sprites como o verdadeiro, e ha' um teste so' para
// isso.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fonte = readFileSync(new URL('../sem-grafico.js', import.meta.url), 'utf8');

/**
 * Um motor como o do jogo: o que a ferramenta ve' quando chega.
 *
 * `frameCount` nasce alto porque o estado normal e' a cena ja' estar de pe'; quem quiser testar
 * o arranque poe-no a zero de proposito.
 */
function motorDeMentira({ quadros = 120, animacoes = 3 } = {}) {
  const contas = { parou: 0, arrancou: 0 };
  const e = {
    world: { visible: true },
    frameCount: quadros,
    animated: Array.from({ length: animacoes }, (_, i) => ({
      spr: { nome: `s${i}`, parent: {}, destroyed: false },
      a: 0,
      t: 0,
      i,
    })),
    app: {
      ticker: { started: true },
      renderer: {
        // O recolhedor do Pixi. `count` e' SO' DE LEITURA, como no jogo: escrever nele atira um
        // TypeError, e como o ficheiro da ferramenta corre em modo estrito, isso matava a batida
        // inteira — foi exatamente o que aconteceu em 11/10/2026. Um motor de mentira mais
        // simpatico do que o verdadeiro deixa passar o defeito que so' aparece no jogo.
        textureGC: {
          _count: 0,
          get count() {
            return this._count;
          },
          maxIdle: 3600,
          corridas: 0,
          rebenta: false,
          run() {
            this.corridas++;
            if (this.rebenta) throw new Error('o jogo mudou por baixo de nos');
          },
        },
      },
      stop() {
        contas.parou++;
        e.app.ticker.started = false;
      },
      start() {
        contas.arrancou++;
        e.app.ticker.started = true;
      },
    },
    contas,
    /** O que o motor faz sozinho quando um bicho morre: destroi o sprite e tira-o da lista. */
    matarUm() {
      const morto = e.animated.shift();
      if (!morto) return null;
      morto.spr.destroyed = true;
      morto.spr.parent = null;
      return morto;
    },
    /** E o que ele faz quando nasce um: poe-no na lista que tem na mao nesse momento. */
    nascerUm(nome) {
      const novo = { spr: { nome, parent: {}, destroyed: false }, a: 0, t: 0, i: 99 };
      e.animated.push(novo);
      return novo;
    },
  };
  return e;
}

/**
 * Monta a ferramenta com um mundo controlado.
 *
 * O `setInterval` corre na hora e so' uma vez: a reaplicacao de 500 em 500 ms existe porque o
 * motor recria o mundo a cada cena, e isso testa-se chamando `bater` de proposito.
 */
/** Uma animacao da pagina, como as 13 que o jogo tem a correr em modo Cartas. */
function animacaoDeMentira({ infinita = true, estado = 'running' } = {}) {
  return {
    playState: estado,
    effect: { getTiming: () => ({ iterations: infinita ? Infinity : 1 }) },
    pause() {
      this.playState = 'paused';
    },
    play() {
      this.playState = 'running';
    },
  };
}

function montar({ motor = motorDeMentira(), guardado = null, animacoes = [], menu = null } = {}) {
  const loja = guardado ? { 'lioncode:pokeidleworld:sem-grafico': JSON.stringify(guardado) } : {};
  // A escolha do menu vive na chave do nucleo, que os dois mundos partilham.
  if (menu) loja['lioncode:pokeidleworld:modulos'] = JSON.stringify(menu);
  const ouvintes = {};
  const avisos = [];
  const anunciados = [];
  let relogio = null;

  const no = () => ({ style: {}, textContent: '', remove() {} });
  const doc = {
    createElement: () => {
      const n = no();
      avisos.push(n);
      return n;
    },
    body: { appendChild() {} },
    getAnimations: () => animacoes,
  };

  const mod = { exports: {} };
  // O mundo da pagina, guardado para o poder trocar: o jogo nasce depois da ferramenta, e um
  // motor que aparece a meio e' um caso que acontece a cada carga.
  const mundo = { __engine: motor };
  new Function(
    'globalThis',
    'localStorage',
    'document',
    'addEventListener',
    'dispatchEvent',
    'CustomEvent',
    'setInterval',
    'setTimeout',
    'module',
    fonte,
  )(
    mundo,
    {
      getItem: (k) => loja[k] ?? null,
      setItem: (k, v) => {
        loja[k] = v;
      },
    },
    doc,
    (tipo, fn) => {
      (ouvintes[tipo] = ouvintes[tipo] || []).push(fn);
    },
    (evento) => {
      if (evento.type === 'ppx:sem-grafico') anunciados.push(evento.detail);
      return true;
    },
    class {
      constructor(tipo, init) {
        this.type = tipo;
        this.detail = (init || {}).detail;
      }
    },
    (fn) => {
      relogio = fn;
      return 1;
    },
    () => 0,
    mod,
  );

  return {
    api: mod.exports,
    motor,
    loja,
    anunciados,
    desenhando: () => motor && motor.app.ticker.started,
    gc: () => motor && motor.app.renderer.textureGC,
    animacoes,
    avisos: () => avisos.map((n) => n.textContent).filter(Boolean),
    /** A batida de 500 ms, que reaplica a escolha depois de o motor trocar de cena. */
    bater: () => relogio && relogio(),
    /** O jogo a nascer depois da ferramenta, como acontece a cada carga da pagina. */
    trocarMotor: (novo) => {
      mundo.__engine = novo;
    },
    tecla: (letra, extra = {}) =>
      (ouvintes.keydown || []).forEach((f) =>
        f({
          altKey: true,
          ctrlKey: false,
          shiftKey: false,
          key: letra,
          target: null,
          preventDefault() {},
          stopPropagation() {},
          ...extra,
        }),
      ),
    evento: (tipo, detail) => (ouvintes[tipo] || []).forEach((f) => f({ type: tipo, detail })),
  };
}

// --------------------------------------------------------------- parar e voltar a desenhar

test('nasce sem mexer em nada', () => {
  const p = montar();
  assert.equal(p.motor.world.visible, true, 'o mapa continua a ser desenhado');
  assert.equal(p.desenhando(), true, 'e o motor continua a desenhar');
  assert.equal(p.motor.contas.parou, 0);
});

test('Alt+G esconde o mapa e para o desenho; Alt+H traz tudo de volta', () => {
  const p = montar();

  p.tecla('g');
  assert.equal(p.motor.world.visible, false, 'o mapa sai do desenho');
  assert.equal(p.desenhando(), false, 'e o motor para de desenhar');

  p.tecla('h');
  assert.equal(p.motor.world.visible, true);
  assert.equal(p.desenhando(), true, 'o jogo volta a desenhar-se');
});

test('nao manda parar nem arrancar o que ja esta como ela quer', () => {
  // A batida corre de 500 em 500 ms para sempre. Se cada uma mandasse parar outra vez, era um
  // `stop()` a cada meio segundo durante a noite inteira — e qualquer efeito colateral do motor
  // nesse caminho passava a acontecer milhares de vezes em vez de uma.
  const p = montar();
  p.tecla('g');
  p.bater();
  p.bater();
  p.bater();
  assert.equal(p.motor.contas.parou, 1, 'parou uma vez so');
  p.tecla('h');
  p.bater();
  assert.equal(p.motor.contas.arrancou, 1, 'e arrancou uma vez so');
});

// --------------------------------------------------------------- o defeito das animacoes mortas

test('nunca toca na lista de animacoes do motor', () => {
  // Este e' o teste do defeito medido no jogo em 11/10/2026. A versao anterior tirava `animated`
  // ao motor e guardava-a para a devolver. Enquanto a lista do motor esta' vazia, um bicho que
  // morre nao pode ser tirado dela — porque ele esta' no nosso bolso — e volta ao jogo morto na
  // devolucao: 866 animacoes devolvidas, 865 de sprites destruidos. A defesa nao e' devolver
  // melhor, e' nao levar: a lista e' do motor e fica com ele.
  const p = montar({ motor: motorDeMentira({ animacoes: 4 }) });
  const listaOriginal = p.motor.animated;

  p.tecla('g');
  assert.equal(p.motor.animated, listaOriginal, 'a lista continua a ser a mesma, nao outra');

  // A vida do jogo acontece com a ferramenta ligada: bichos morrem, bichos nascem.
  p.motor.matarUm();
  p.motor.matarUm();
  const vivo = p.motor.nascerUm('novo');
  p.bater();
  p.bater();

  p.tecla('h');
  const mortos = p.motor.animated.filter((x) => x.spr.destroyed || !x.spr.parent);
  assert.deepEqual(mortos, [], 'nenhum sprite destruido voltou para a lista');
  assert.ok(p.motor.animated.includes(vivo), 'e o que nasceu entretanto continua la');
  assert.equal(p.motor.animated.length, 3, 'a lista e exatamente o que o motor tem, nada a mais');
});

// --------------------------------------------------------------- o arranque da pagina

test('nao para o desenho antes de a cena estar de pe', () => {
  // Quem recarrega com a ferramenta ligada tem o motor a nascer. Parar os quadros nesse instante
  // arrisca deixa-lo preso no arranque — e um jogo preso no arranque le-se como avaria, nao como
  // ferramenta ligada.
  const p = montar({
    motor: motorDeMentira({ quadros: 0 }),
    guardado: { mundo: true, estatico: true },
  });
  assert.equal(p.desenhando(), true, 'deixa o jogo desenhar enquanto a cena nasce');
  assert.equal(p.motor.world.visible, false, 'mas o mapa ja fica fora do desenho');

  p.motor.frameCount = 60;
  p.bater();
  assert.equal(p.desenhando(), false, 'de pe a cena, para');
});

test('voltar a desenhar nao espera por nada', () => {
  // A espera e' so' para parar. Se ela valesse tambem para o contrario, um Alt+H com o motor
  // recem-nascido deixava o ecra parado e a tecla parecia partida.
  const p = montar({
    motor: motorDeMentira({ quadros: 500 }),
    guardado: { mundo: true, estatico: true },
  });
  assert.equal(p.desenhando(), false);
  p.motor.frameCount = 0;
  p.tecla('h');
  assert.equal(p.desenhando(), true);
});

test('a cena nova nao traz o mapa de volta sozinha', () => {
  // O motor recria o mundo ao entrar numa caçada, e o `visible` que se pos vai-se com o objeto
  // antigo. Sem a batida, a ferramenta funcionava ate' a pessoa andar.
  const p = montar({ guardado: { mundo: true, estatico: false } });
  p.motor.world = { visible: true };
  p.bater();
  assert.equal(p.motor.world.visible, false);
});

test('se alguem voltar a arrancar o desenho, a batida para-o outra vez', () => {
  const p = montar({ guardado: { mundo: true, estatico: true } });
  p.motor.app.start();
  assert.equal(p.desenhando(), true);
  p.bater();
  assert.equal(p.desenhando(), false, 'a escolha vale enquanto estiver ligada, nao so uma vez');
});

test('a escolha sobrevive ao F5', () => {
  const p = montar();
  p.tecla('g');
  assert.deepEqual(JSON.parse(p.loja['lioncode:pokeidleworld:sem-grafico']), {
    mundo: true,
    estatico: true,
  });

  const q = montar({ guardado: { mundo: true, estatico: true } });
  assert.equal(q.motor.world.visible, false, 'ja nasce com o mapa fora');
  assert.equal(q.desenhando(), false);
});

test('sem motor, e com um motor sem Pixi, nao estoura', () => {
  // A ferramenta corre no `document_idle`, que pode ser antes de o jogo montar o motor. Uma
  // excecao aqui levava a pagina inteira, porque corre no mundo dela.
  montar({ motor: undefined }).tecla('g');
  const meio = montar({ motor: { world: { visible: true }, frameCount: 99 } });
  meio.tecla('g');
  assert.equal(meio.motor.world.visible, false, 'faz o que da para fazer e cala-se no resto');
});

// --------------------------------------------------------------- a conversa com o menu

test('anuncia o estado para o outro lado da fronteira', () => {
  // O menu vive no mundo isolado e nao ve' nem o motor nem esta chave. Tudo o que ele sabe vem
  // deste anuncio — se ele nao sair, o botao do menu fica a mentir.
  const p = montar();
  p.tecla('g');
  assert.deepEqual(p.anunciados.at(-1), { mundo: true, estatico: true, motor: true });
  p.tecla('h');
  assert.deepEqual(p.anunciados.at(-1), { mundo: false, estatico: false, motor: true });
});

test('o menu manda e ela obedece, sem aviso na tela', () => {
  // Quem clicou no botao do menu ja' esta' a olhar para o menu: um aviso no meio do ecra' seria
  // a dizer-lhe o que ele acabou de fazer.
  const p = montar();
  p.evento('ppx:sem-grafico:mandar', { ativo: true });
  assert.equal(p.desenhando(), false);
  assert.deepEqual(p.avisos(), [], 'nada de aviso quando o pedido veio do menu');

  p.tecla('h');
  assert.equal(p.avisos().length, 1, 'mas a tecla diz sempre em que estado se ficou');
});

test('com o desenho parado, o aviso diz que o jogo continua a jogar', () => {
  // O ecra fica uma fotografia. Sem esta frase, a ferramenta a funcionar e o jogo pendurado sao
  // a mesma imagem — e a pessoa desliga uma coisa que estava bem.
  const p = montar();
  p.tecla('g');
  assert.match(p.avisos().at(-1), /continua a jogar/);
});

test('responde a quem pergunta, porque o menu pode subir depois dela', () => {
  const p = montar({ guardado: { mundo: true, estatico: true } });
  const antes = p.anunciados.length;
  p.evento('ppx:sem-grafico:pergunta');
  assert.equal(p.anunciados.length, antes + 1);
  assert.equal(p.anunciados.at(-1).mundo, true);
});

// --------------------------------------------------------------- o teclado

test('a tecla no chat e do chat', () => {
  const p = montar();
  p.tecla('g', { target: { tagName: 'INPUT' } });
  assert.equal(p.desenhando(), true, 'escrever "g" no chat nao apaga o jogo');
});

test('so responde ao Alt sozinho', () => {
  const p = montar();
  p.tecla('g', { altKey: false });
  p.tecla('g', { ctrlKey: true });
  p.tecla('g', { shiftKey: true });
  assert.equal(p.desenhando(), true);
});

test('corre no mundo da pagina, e o manifesto diz isso', () => {
  // Sem `world: MAIN` ela nao ve' o `__engine` e nao faz absolutamente nada — e falha em
  // silencio, que e' o pior modo de falhar.
  const manifesto = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  const bloco = manifesto.content_scripts.find((c) => c.js.includes('sem-grafico.js'));
  assert.ok(bloco, 'o manifesto nao carrega a ferramenta');
  assert.equal(bloco.world, 'MAIN');
  for (const outro of manifesto.content_scripts) {
    if (outro === bloco) continue;
    assert.ok(!outro.js.includes('sem-grafico.js'), 'carregada duas vezes, em dois mundos');
  }
});

// --------------------------------------------------------------- a memoria da placa de video

test('devolve a memoria da placa quando para o desenho', () => {
  // Medido no jogo em modo Cartas: 320 MB na placa, 254 deles em folhas de sprite do mapa que
  // ninguem estava a desenhar. O recolhedor do Pixi corre no fim de cada desenho — parar o
  // desenho e' parar tambem quem limpa, e por isso esta ferramenta tem de o chamar.
  const p = montar();
  assert.equal(p.gc().corridas, 0, 'com o jogo a desenhar, nao se mete nisso');
  p.tecla('g');
  assert.equal(p.gc().corridas, 1, 'parou, devolveu');
});

test('nao escreve no estado do recolhedor do jogo', () => {
  // A primeira versao adiantava `gc.count` antes de chamar `run()`, a pensar que ele contava
  // quadros desenhados. `count` e' so' de leitura: a atribuicao atirava um TypeError e levava a
  // batida inteira — as animacoes paravam, a memoria nunca era devolvida, e nada disto dava
  // sinal a nao ser a consola do jogo. A regra verdadeira nem e' por quadros: `maxIdle` sao
  // 3600 ms e `_gcLastUsed` e' um instante, por isso ele ja' recolhe o que ninguem usa ha' 3,6
  // segundos. Nao e' preciso ajudar — e' preciso nao estorvar.
  const p = montar();
  p.tecla('g');
  for (let i = 0; i < 25; i++) p.bater();
  assert.ok(p.gc().corridas >= 2, 'a batida continua viva depois de mexer no recolhedor');
  assert.equal(p.gc()._count, 0, 'e o estado do jogo ficou como estava');
});

test('nao chama o recolhedor a cada meio segundo', () => {
  // Ele percorre todas as texturas. Correr de 500 em 500 ms a noite inteira era gastar, para
  // poupar, exatamente o que se quer poupar.
  const p = montar();
  p.tecla('g');
  for (let i = 0; i < 10; i++) p.bater();
  assert.equal(p.gc().corridas, 1, 'uma so ate aqui');
  for (let i = 0; i < 15; i++) p.bater();
  assert.equal(p.gc().corridas, 2, 'e a segunda so depois de 20 batidas');
});

test('com o jogo a desenhar outra vez, nao se mexe mais na memoria', () => {
  // A desenhar, o Pixi recolhe sozinho no fim de cada quadro. Continuar a forçar seria duas
  // mãos no mesmo volante.
  const p = montar();
  p.tecla('g');
  const quantas = p.gc().corridas;
  p.tecla('h');
  for (let i = 0; i < 30; i++) p.bater();
  assert.equal(p.gc().corridas, quantas, 'a ferramenta sai da frente');
});

test('motor sem recolhedor nao estoura', () => {
  const p = montar({ motor: motorDeMentira() });
  delete p.motor.app.renderer;
  p.tecla('g');
  assert.equal(p.desenhando(), false, 'faz o que da para fazer e cala-se no resto');
});

// --------------------------------------------------------------- o que mexe fora do motor

test('para as animacoes sem fim da pagina, e so essas', () => {
  // Medido em modo Cartas, com o Pixi ja' parado pelo proprio jogo: 13 animacoes CSS sem fim —
  // o brilho das barras de vida e a seta das noticias. Enquanto houver uma, a aba nao sossega.
  //
  // So' as infinitas: uma animacao com fim acaba sozinha, e para-la a meio deixa a tela num
  // estado que ninguem desenhou — um painel meio aberto, um aviso meio desvanecido.
  const semFim = animacaoDeMentira();
  const comFim = animacaoDeMentira({ infinita: false });
  const p = montar({ animacoes: [semFim, comFim] });

  p.tecla('g');
  assert.equal(semFim.playState, 'paused', 'o brilho sem fim para');
  assert.equal(comFim.playState, 'running', 'a que tem fim fica a acabar');

  p.tecla('h');
  assert.equal(semFim.playState, 'running', 'e volta a correr no fim');
});

test('repoe so as animacoes que ela propria parou', () => {
  // A pagina tambem pára animacoes — uma aba escondida, um painel fechado. Repor essas era
  // mandar na tela do jogo, que nao e' nosso trabalho.
  const nossa = animacaoDeMentira();
  const dela = animacaoDeMentira({ estado: 'paused' });
  const p = montar({ animacoes: [nossa, dela] });

  p.tecla('g');
  p.tecla('h');
  assert.equal(nossa.playState, 'running');
  assert.equal(dela.playState, 'paused', 'a que ja estava parada fica como a pagina a deixou');
});

test('a animacao que nasce com a ferramenta ligada tambem para', () => {
  // A moldura e' React: ela cria animacoes novas a toda a hora. Parar so' as que existiam no
  // instante da tecla dava uma ferramenta que se desfaz sozinha ao fim de um minuto.
  const p = montar();
  p.tecla('g');
  const nova = animacaoDeMentira();
  p.animacoes.push(nova);
  p.bater();
  assert.equal(nova.playState, 'paused');
});

test('pagina sem getAnimations nao estoura', () => {
  const p = montar();
  p.api.animacoesDaPagina(true);
  assert.ok(true);
});

test('se o recolhedor do jogo rebentar, desiste dele em vez de insistir', () => {
  // Ele e' codigo do jogo, e o jogo muda. Tentar de 10 em 10 segundos durante a noite enche a
  // consola — e consola cheia e' o que esconde o defeito seguinte.
  const p = montar();
  p.gc().rebenta = true;
  p.tecla('g');
  assert.equal(p.gc().corridas, 1);
  for (let i = 0; i < 60; i++) p.bater();
  assert.equal(p.gc().corridas, 1, 'tentou uma vez e nao voltou a tentar');
  assert.equal(p.desenhando(), false, 'e o resto da ferramenta continua a fazer o que faz');
});

// --------------------------------------------------------------- a chave do menu

test('desligada no menu, nao mexe em nada', () => {
  // Esta e' a unica ferramenta do pacote que o nucleo nao poe de pe': ela esta' no manifesto e
  // corre sozinha, no outro mundo. Medido no jogo em 11/10/2026: desligar a chave mudava o
  // desenho do botao e mais nada — ela continuava a parar o desenho, e o menu passava a dizer o
  // contrario do que acontecia.
  const semFim = animacaoDeMentira();
  const p = montar({
    guardado: { mundo: true, estatico: true },
    menu: { 'sem-grafico': false },
    animacoes: [semFim],
  });
  assert.equal(p.motor.world.visible, true, 'o mapa continua a ser desenhado');
  assert.equal(p.desenhando(), true, 'e o jogo continua a desenhar-se');
  assert.equal(semFim.playState, 'running', 'e as animacoes da pagina ficam como estavam');
  assert.equal(p.gc().corridas, 0, 'e nao se mexe na memoria do jogo');
});

test('desligada no menu, a tecla tambem nao e dela', () => {
  const p = montar({ menu: { 'sem-grafico': false } });
  p.tecla('g');
  assert.equal(p.desenhando(), true);
  assert.deepEqual(p.avisos(), [], 'nem responde com um aviso que nao vai cumprir');
});

test('outra ferramenta desligada no menu nao a cala', () => {
  // A chave e' por ferramenta. Ler a chave errada deixava-a muda porque o vizinho esta' desligado.
  const p = montar({ guardado: { mundo: true, estatico: true }, menu: { escada: false } });
  assert.equal(p.motor.world.visible, false, 'ela continua a fazer o que lhe pediram');
});

test('a escolha dela sobrevive a ser desligada e religada no menu', () => {
  const p = montar({ guardado: { mundo: true, estatico: true }, menu: { 'sem-grafico': false } });
  assert.equal(p.desenhando(), true);
  p.loja['lioncode:pokeidleworld:modulos'] = JSON.stringify({ 'sem-grafico': true });
  p.bater();
  assert.equal(p.desenhando(), false, 'volta ao que estava, sem ninguem ter de repetir o pedido');
});

test('para o nucleo ela e um efeito, e nao uma janela', () => {
  // `comJanela()` filtra por `!m.efeito`, e o Alt+Z esconde tudo o que esta' nessa lista. Sem
  // `efeito: true` ela ia na conta das janelas: medido no jogo em 11/10/2026, o Alt+Z deixou
  // sumico ["cacadas","times","escada","sem-grafico"] e devolveu o grafico inteiro. Esconder as
  // janelas nao e' pedir o desenho de volta.
  const nucleo = readFileSync(new URL('../nucleo.js', import.meta.url), 'utf8');
  const entrada = nucleo.slice(nucleo.indexOf("id: 'sem-grafico'"));
  const fim = entrada.indexOf('},');
  assert.match(entrada.slice(0, fim), /efeito: true/, 'o nucleo trata-a como janela');
  assert.match(
    nucleo,
    /modulos\.filter\(\(m\) => !m\.efeito && m\.aplicar/,
    'o Alt+Z deixou de filtrar por `efeito`: este teste ja nao defende nada',
  );
});

test('o jogo recem-carregado nao fica dez segundos a desenhar', () => {
  // Medido no jogo em 29/10/2026, com F5 e a ferramenta ligada: o motor so' aparece ~8 s depois
  // da carga e desenha devagar enquanto carrega, por isso chegar aos 60 quadros levou ~10 s. Dez
  // segundos de desenho a toda a velocidade com a ferramenta ligada e' o que se lia como "nao
  // funciona". O portao dos quadros supunha 30 por segundo; o jogo nao os da'.
  const motor = motorDeMentira({ quadros: 0 });
  const p = montar({ motor, guardado: { mundo: true, estatico: true } });
  assert.equal(p.desenhando(), true, 'no primeiro instante ainda se espera pela cena');

  // Quatro batidas sao 2 s: ainda dentro da espera, e o motor mal desenhou.
  for (let i = 0; i < 4; i += 1) {
    motor.frameCount += 2;
    p.bater();
  }
  assert.equal(p.desenhando(), true, 'cedo demais para parar');

  // A quinta e' o tecto: para mesmo sem os 60 quadros terem chegado.
  motor.frameCount += 2;
  p.bater();
  assert.equal(p.desenhando(), false, 'ao fim de 2,5 s para, com ou sem quadros');
  assert.ok(motor.frameCount < 60, 'e parou sem os quadros que o portao antigo exigia');
});

test('com quadros a chegar depressa, para sem esperar o tecto', () => {
  // O tecto e' uma rede, nao o caminho normal: quem desenha a 30 quadros continua a parar em dois
  // segundos, como antes.
  const motor = motorDeMentira({ quadros: 0 });
  const p = montar({ motor, guardado: { mundo: true, estatico: true } });
  motor.frameCount = 60;
  p.bater();
  assert.equal(p.desenhando(), false, 'os quadros chegaram: nao ha nada a esperar');
});

test('sem motor, as batidas nao contam como arranque', () => {
  // Uma pagina que ainda nao tem jogo nenhum nao esta' a "carregar ha' 2,5 s": quando o motor
  // aparecer, ele tem direito ao mesmo tempo de pe' que teria numa carga normal.
  const p = montar({ motor: null, guardado: { mundo: true, estatico: true } });
  for (let i = 0; i < 10; i += 1) p.bater();
  const motor = motorDeMentira({ quadros: 0 });
  p.trocarMotor(motor);
  p.bater();
  assert.equal(motor.app.ticker.started, true, 'o motor acabou de nascer: ainda nao se para');
  for (let i = 0; i < 4; i += 1) p.bater();
  assert.equal(motor.app.ticker.started, false, 'e para quando o tempo dele passar');
});
