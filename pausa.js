// As pausas das ferramentas — e por que nenhuma delas e' um numero redondo.
//
// Todo o resto do pacote esperava sempre o mesmo tanto: 140 ms entre dois cliques de compra, 650
// entre duas trocas de pokemon, 130 entre dois passos. Funciona, mas nao se parece com gente:
// ninguem clica cem vezes com exatamente 140 ms entre cada clique. Um ritmo perfeito e' a coisa
// mais facil de reconhecer numa gravacao de eventos.
//
// Entao aqui ha' um dono so' para o compasso, e tres decisoes dentro dele:
//
//  1. **A pausa nunca encurta.** O numero que a ferramenta pede e' o chao, nao a media. Esses
//     numeros foram medidos contra o jogo — 130 ms entre teclas porque abaixo disso ele perde
//     teclas, 650 entre trocas porque e' o que a janela leva para refazer as linhas. Sortear para
//     baixo trocaria "parecer humano" por "falhar as vezes", que e' um pessimo negocio.
//  2. **O espalhamento e' proporcional ao que se pediu.** Uma espera de 140 ms varia dezenas de
//     ms; uma de 3 s varia mais de um segundo. Somar sempre o mesmo punhado de milissegundos a
//     tudo deixaria o compasso longo tao regular quanto antes.
//  3. **De vez em quando ha' uma parada maior.** Gente se distrai: olha o chat, le' uma mensagem,
//     volta. Sem isso a distribuicao fica estreita demais — regular de um jeito diferente, mas
//     ainda regular.
//
// Nada disto esconde o que a ferramenta faz: ela continua a clicar no que voce clicaria, a' vista,
// na sua tela. E' so' o compasso que deixa de ser de metronomo.

(() => {
  'use strict';

  /** Quanto, no maximo, se acrescenta por cima do que se pediu — em fracao do proprio pedido. */
  const ESPALHAMENTO = 0.6;

  /** De quantas em quantas pausas, em media, acontece uma parada maior. */
  const CHANCE_DISTRACAO = 1 / 14;
  const DISTRACAO_MIN = 600;
  const DISTRACAO_MAX = 2200;

  /**
   * O tempo que uma pausa de `ms` vai mesmo durar.
   *
   * Separado de `pausa` de proposito: assim da' para conferir a conta sem esperar por ela.
   */
  function jitter(ms) {
    const base = Number(ms) || 0;
    if (base <= 0) return 0;
    const espalhado = base + Math.random() * base * ESPALHAMENTO;
    const distraido =
      Math.random() < CHANCE_DISTRACAO
        ? DISTRACAO_MIN + Math.random() * (DISTRACAO_MAX - DISTRACAO_MIN)
        : 0;
    return Math.round(espalhado + distraido);
  }

  const pausa = (ms) => new Promise((r) => setTimeout(r, jitter(ms)));

  globalThis.PPX = globalThis.PPX || {};
  globalThis.PPX.jitter = jitter;
  globalThis.PPX.pausa = pausa;

  if (typeof module !== 'undefined' && module.exports)
    module.exports = { jitter, pausa, ESPALHAMENTO, CHANCE_DISTRACAO };
})();
