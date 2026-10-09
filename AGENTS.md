# Regras deste repositório

## Toda automação passa pela fila

**Qualquer ferramenta que aja sozinha no jogo tem de pedir a vez antes de agir.** Regra herdada do
pacote do PokePixel, e vale aqui desde o primeiro dia — justamente porque hoje há uma ferramenta
só. É barato entrar na fila agora e caro descobrir que falta quando já são três.

```js
const MINHA_VEZ = 'id-do-modulo';

const esperarAVez = async () => {
  const vez = globalThis.PPX?.vez;
  if (!vez?.pedir) return () => {}; // núcleo antigo: segue como antes, sem fila
  return vez.pedir(MINHA_VEZ);
};

let soltar = null;
try {
  soltar = await esperarAVez();
  if (!soltar) return;
  // agir no jogo
} finally {
  if (soltar) soltar();
}
```

**Peça a vez pelo tempo da ação, não pelo tempo em que a ferramenta está ligada.** A captura fica
ligada horas e age por alguns milissegundos a cada ~4,4 s. Segurar a fila enquanto está ligada
trancaria qualquer automação futura para sempre — o oposto do que a fila existe para fazer.

**Entre pedir a vez e recebê-la, o mundo muda.** Confira o estado outra vez depois de receber: o
selvagem pode ter fugido, o botão pode ter travado. Quem decide é o estado de agora.

## O que o jogo oferece, e o que não oferece

Este jogo **não expõe API nenhuma em JavaScript** — nada de objeto global com o estado, ao
contrário do PokePixel. É Next.js/React, e o estado vive no React Fiber, que não é contrato: a
chave muda a cada build e a estrutura não é pública.

Por isso as ferramentas falam com a página pelo **DOM**, por classes CSS (`.cap-row`,
`.cap-throw`, `.cap-chip-n`). Isso é frágil por natureza: uma mudança de layout do jogo quebra a
ferramenta. Duas consequências práticas:

- **toda leitura do DOM tem de tolerar não encontrar nada.** Elemento ausente é o caso normal, não
  o erro;
- **nunca cronometre o que a página já informa.** O tempo de espera da captura é lido do `disabled`
  do botão. Cronometrar seria fixar em código um número que o jogo pode mudar.

## Segundo plano é o caso normal, não a exceção

O utilizador joga em várias janelas ao mesmo tempo, quase todas escondidas. **`setInterval` é
estrangulado para uma vez por minuto em aba oculta** — foi medido. Temporizador não pode ser o
motor de nada aqui; use `MutationObserver`, que continua chegando.

Medido em 09/10/2026, com a aba oculta por ~5,5 minutos: o painel e o botão continuaram existindo
o tempo todo, e o DOM não parou de mudar.

## O resto

- Reproduza antes de consertar. Uma banca construída sobre a suposição só confirma a suposição.
- Teste e documentação na mesma tarefa, nunca depois.
- O pacote declara **apenas** `poke.idleworld.online`. Dois pacotes no mesmo site disputam atalhos.
- Nunca commitar, taguear ou publicar sem pedido explícito.
