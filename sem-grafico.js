/**
 * Sem gráfico — para o desenho do jogo, deixando a lógica a andar.
 *
 * ESTA FERRAMENTA CORRE NO MUNDO DA PÁGINA (`world: MAIN` no manifesto), e é a única do pacote
 * que corre. O motivo é um só: o que ela precisa de tocar, `window.__engine`, é uma variável da
 * página. Um content script normal tem o seu próprio `window` e não a vê — veria `undefined` e
 * não haveria nada a fazer com isso. O preço é não ter o `PPX`: o núcleo está do outro lado, e a
 * conversa entre os dois é por eventos do DOM, que atravessam a fronteira.
 *
 * Medido no jogo em 11/10/2026, com o motor a correr:
 *
 * - `app.stop()` leva os quadros a zero — 0 em 18 s — e **o jogo continua a jogar**: a posição do
 *   jogador mudou durante esses 18 s com o desenho parado. A caçada não vive no relógio do Pixi,
 *   vem do servidor. É isto que torna "o mais estático possível" seguro de deixar ligado.
 * - `world.visible = false` tira o mapa do desenho e o jogo continua na mesma. Sozinho poupa
 *   pouco tempo de CPU (0,05 ms → 0,02 ms por quadro), mas poupa o trabalho da placa gráfica, e
 *   serve de rede: se alguma coisa voltar a arrancar o desenho, o mapa fica fora dele.
 *
 * O QUE ESTA FERRAMENTA NÃO FAZ, E PORQUÊ. A primeira versão esvaziava `__engine.animated` e
 * guardava a lista para a devolver. Medido no jogo: ao fim de algum tempo ligada, devolvia **866
 * animações, das quais 865 eram de sprites já destruídos**. O mecanismo é este — quando um sprite
 * morre, o motor tira-o de `animated`; se a lista dele está vazia porque nós a levámos, o morto
 * fica no nosso bolso e volta ao jogo na devolução. Guardar estado do motor é que estava errado,
 * e não a forma de o guardar: aqui não se guarda nenhum, e por isso o defeito não pode voltar.
 */
(() => {
  'use strict';

  const CHAVE = 'lioncode:pokeidleworld:sem-grafico';

  /**
   * Com que frequência se reaplica a escolha.
   *
   * O motor recria o mundo a cada cena — entrar numa caçada, voltar à cidade — e o `visible` que
   * se pôs antes vai-se com o objeto antigo. Aplicar uma vez só dava uma ferramenta que funciona
   * até a pessoa andar.
   */
  const BATIDA = 500;

  /**
   * Quantos quadros o jogo desenha antes de se poder parar o desenho.
   *
   * Quem recarrega a página com a ferramenta ligada tem o motor a nascer: parar os quadros nesse
   * instante arriscava deixá-lo preso no arranque, e isso lê-se como uma avaria, não como uma
   * ferramenta ligada. Dois segundos a 30 quadros chegam para a cena estar de pé.
   */
  const QUADROS_ATE_PARAR = 60;

  const PADRAO = { mundo: false, estatico: false };

  let cfg = { ...PADRAO };
  try {
    const cru = localStorage.getItem(CHAVE);
    if (cru) cfg = { ...cfg, ...JSON.parse(cru) };
  } catch {
    /* janela sem armazenamento: vale so' para esta sessao */
  }

  const gravar = () => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(cfg));
    } catch {
      /* idem */
    }
  };

  const motor = () => globalThis.__engine || null;

  /**
   * A chave do menu que liga e desliga cada ferramenta nesta janela.
   *
   * Esta é a única do pacote que o núcleo não põe de pé: ela está no manifesto e corre sozinha,
   * do outro lado da fronteira. Por isso desligá-la no menu mudava o botão e mais nada — ela
   * continuava a parar o desenho, com o menu a dizer o contrário do que acontecia. O núcleo
   * escreve a escolha aqui, e os dois mundos partilham o armazenamento: lê-se a dele.
   */
  const CHAVE_LIGADOS = 'lioncode:pokeidleworld:modulos';

  function desligadaNoMenu() {
    try {
      const cru = localStorage.getItem(CHAVE_LIGADOS);
      return Boolean(cru) && JSON.parse(cru)['sem-grafico'] === false;
    } catch {
      // Sem conseguir ler, vale o que a ferramenta tem: ninguem pediu para ela parar.
      return false;
    }
  }

  /** A cena ja' esta' de pe'? Enquanto nao estiver, nao se para o desenho. */
  function cenaDePe() {
    const e = motor();
    if (!e) return false;
    return typeof e.frameCount === 'number' ? e.frameCount >= QUADROS_ATE_PARAR : true;
  }

  /**
   * Liga e desliga o desenho, e nada mais.
   *
   * Pergunta-se ao motor em que estado ele esta' em vez de o anotar aqui: a cada batida isto
   * corre outra vez, e um estado nosso que discordasse do dele seria mais uma coisa a manter
   * sincronizada — exatamente o erro que custou as 865 animacoes mortas.
   */
  function desenhar(sim) {
    const e = motor();
    const app = e && e.app;
    if (!app || typeof app.stop !== 'function' || typeof app.start !== 'function') return;
    const ligado = app.ticker ? app.ticker.started !== false : true;
    if (sim === ligado) return;
    if (sim) app.start();
    else app.stop();
  }

  /**
   * Devolve a memória da placa de vídeo que o jogo já não está a usar.
   *
   * O Pixi tem um recolhedor próprio, e ele corre no fim de cada desenho. Sem desenho ele nunca
   * corre — e é por isso que isto não é um extra, é a emenda de um buraco que esta ferramenta
   * abre: parar o desenho é parar também quem limpa.
   *
   * Medido no jogo em 11/10/2026, em modo Cartas, onde o próprio jogo já parava o desenho:
   * **320 MB na placa, 254 deles em 20 folhas de sprite do mapa de 2046×2040**. Uma passagem do
   * recolhedor deixou 80 MB. Voltar a desenhar trouxe de volta só o que era preciso — 120 MB,
   * sem um erro na consola — porque as imagens de origem continuam na página e o Pixi recarrega
   * sozinho. Por isso isto é seguro: não se deita nada fora, descarrega-se.
   *
   * CHAMA-SE `run()` E MAIS NADA. A primeira versão adiantava `gc.count` antes de chamar, a
   * pensar que ele contava quadros desenhados e que sem quadros nada envelhecia. Duas coisas
   * erradas de uma vez: `count` é só de leitura — escrever nele **atira um TypeError**, e este
   * ficheiro corre em modo estrito, por isso a batida inteira morria aí — e a regra dele nem
   * sequer é essa. `_gcLastUsed` é um instante em milissegundos e `maxIdle` são 3600 ms: ele
   * recolhe o que ninguém usa há 3,6 segundos, desenhando-se ou não. Não é preciso ajudar.
   */
  let recolhedorVivo = true;

  function devolverMemoria() {
    const e = motor();
    const gc = e && e.app && e.app.renderer && e.app.renderer.textureGC;
    if (!recolhedorVivo || !gc || typeof gc.run !== 'function') return;
    try {
      gc.run();
    } catch {
      // O recolhedor é do jogo, e o jogo muda. Se ele rebentar, desiste-se dele de vez: tentar
      // de 10 em 10 segundos para sempre enche a consola, e consola cheia é o que esconde o
      // defeito seguinte.
      recolhedorVivo = false;
    }
  }

  /** As animações da página que nós parámos — para repormos essas, e só essas. */
  const paradas = new WeakSet();

  /**
   * Para o que continua a mexer fora do motor.
   *
   * O desenho do jogo é Pixi, mas a moldura é HTML, e ela tem animação própria. Medido em modo
   * Cartas, com o Pixi já parado: **13 animações CSS sem fim** — o brilho que corre nas barras de
   * vida e a seta das notícias. Enquanto houver uma destas, o navegador não deixa a aba sossegar.
   *
   * Só as infinitas. Uma animação com fim acaba sozinha, e pará-la a meio deixa a tela num estado
   * que ninguém desenhou: um painel meio aberto, um aviso meio desvanecido.
   */
  function animacoesDaPagina(parar) {
    if (typeof document.getAnimations !== 'function') return;
    for (const a of document.getAnimations()) {
      if (parar) {
        const t = a.effect && a.effect.getTiming && a.effect.getTiming();
        if (!t || t.iterations !== Infinity || a.playState !== 'running') continue;
        a.pause();
        paradas.add(a);
      } else if (paradas.has(a)) {
        // Só as nossas: a página também pára animações, e repor uma dessas era mexer no que ela
        // decidiu.
        paradas.delete(a);
        if (a.playState === 'paused') a.play();
      }
    }
  }

  /** Batidas entre duas devoluções de memória: 20 × 500 ms = 10 s. */
  const BATIDAS_ENTRE_LIMPEZAS = 20;
  let ateALimpeza = 0;

  function aplicar() {
    const e = motor();
    if (!e) return;
    // Desligada no menu e' como se nao existisse: devolve tudo e fica a ver. A escolha dela
    // continua guardada, para voltar como estava quando a religarem.
    const alvo = desligadaNoMenu() ? PADRAO : cfg;
    if (e.world && e.world.visible === alvo.mundo) e.world.visible = !alvo.mundo;
    // Voltar a desenhar e' sempre imediato; parar espera a cena estar de pe'.
    if (!alvo.estatico || cenaDePe()) desenhar(!alvo.estatico);
    animacoesDaPagina(alvo.estatico);
    if (!alvo.estatico) {
      ateALimpeza = 0;
      return;
    }
    if (ateALimpeza-- <= 0) {
      ateALimpeza = BATIDAS_ENTRE_LIMPEZAS;
      devolverMemoria();
    }
  }

  setInterval(aplicar, BATIDA);

  // ------------------------------------------------------------------ o que se diz a quem olha

  /**
   * O aviso curto, para a tecla ter resposta.
   *
   * Uma tecla que faz uma coisa invisível — o desenho já estava parado — é indistinguível de uma
   * tecla partida. Ele diz sempre o estado em que se ficou. E com o desenho parado o jogo fica
   * uma fotografia: sem este aviso, isso lê-se como um jogo pendurado.
   */
  function aviso(texto) {
    const caixa = document.createElement('div');
    caixa.textContent = texto;
    caixa.style.cssText =
      'position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:2147483647;' +
      'background:#11151dE0;color:#e6e9ef;font:13px system-ui,sans-serif;padding:8px 14px;' +
      'opacity:.9;border:1px solid #3a4152;border-radius:8px;pointer-events:none';
    document.body.appendChild(caixa);
    setTimeout(() => caixa.remove(), 1600);
  }

  const resumo = () =>
    cfg.estatico
      ? 'Sem gráfico: desenho parado e memória devolvida, o jogo continua a jogar'
      : cfg.mundo
        ? 'Sem gráfico: mapa escondido'
        : 'Gráfico de volta ao normal';

  /** O núcleo está no outro lado da fronteira: o que passa é o evento, não o objeto. */
  const anunciar = () => {
    dispatchEvent(
      new CustomEvent('ppx:sem-grafico', { detail: { ...cfg, motor: Boolean(motor()) } }),
    );
  };

  function pedir(novo, dizer = true) {
    cfg = { ...cfg, ...novo };
    gravar();
    aplicar();
    anunciar();
    if (dizer) aviso(resumo());
  }

  // O núcleo manda por evento — é o botão do menu, do outro lado da fronteira.
  addEventListener('ppx:sem-grafico:mandar', (e) => {
    const d = e.detail || {};
    pedir({ mundo: d.ativo === true, estatico: d.ativo === true }, false);
  });
  // E pergunta o estado quando o menu sobe, que pode ser depois desta ferramenta.
  addEventListener('ppx:sem-grafico:pergunta', anunciar);

  // ------------------------------------------------------------------ as teclas

  /**
   * Duas teclas, e não uma que alterna: com uma só é preciso olhar para o ecrã antes de a usar,
   * porque ela faz o contrário do que fez da última vez. São as mesmas do PokePixel — quem usa
   * os dois jogos não tem de aprender duas coisas.
   */
  addEventListener(
    'keydown',
    (e) => {
      if (!e.altKey || e.ctrlKey || e.shiftKey) return;
      // Desligada no menu, a tecla tambem nao e' dela.
      if (desligadaNoMenu()) return;
      const tecla = e.key.toLowerCase();
      if (tecla !== 'g' && tecla !== 'h') return;
      // Campo de texto nao dispara atalho: o jogo tem chat, e uma letra ali nao e' um comando.
      const t = e.target;
      if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;
      e.preventDefault();
      e.stopPropagation();
      const ligar = tecla === 'g';
      pedir({ mundo: ligar, estatico: ligar });
    },
    true,
  );

  aplicar();
  anunciar();

  if (typeof module === 'object' && module.exports) {
    module.exports = { aplicar, desenhar, devolverMemoria, animacoesDaPagina, pedir, resumo, cfg: () => cfg };
  }
})();
