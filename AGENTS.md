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

## O mapa, os NPCs e o que foi medido sobre eles

Medido em 09/10/2026, no prédio do mercado:

- **Falar com um NPC exige estar perto dele.** Clicar por código no botão de um NPC distante não
  faz nada, mesmo com o botão presente e visível no DOM. Só o NPC ao lado do personagem responde.
- **Os botões de NPC não dizem quem são.** O nome (`Mark`, `Stone Researcher`) é desenhado no
  mapa, não existe no DOM — todos são `.npc-plate-btn` com o texto `Conversar`. O que distingue é
  a **posição relativa entre eles**, que é fixa porque é a geometria do mapa. Mas não dependa do
  índice: **fale e leia o diálogo.** E só clique em `Conversar` — `Usar máquina` é a slot
  machine, e apostar por engano é o pior jeito possível de descobrir que se errou o NPC.
- **Dá para andar por código, mas não do jeito óbvio.** `keydown` seguido de `keyup` imediato não
  move nada: o `keyup` cancela. O que funciona é repetir `keydown` (~130 ms entre eles) e só
  mandar `keyup` no fim. Um tile por `keydown`.
- **Caminhar em linha reta até o alvo trava em parede.** Ir sempre na direção do alvo encosta num
  obstáculo e fica parado para sempre. Qualquer trajeto automático precisa detectar que parou de
  se mover e desistir, em vez de insistir.

## Automação que gasta ou destrói

**Comprar e vender não são a mesma categoria de risco.** Uma compra errada custa dinheiro, que
volta. Uma venda errada apaga um pokémon, que não volta.

Para qualquer coisa que gaste: **pare quando o jogo parar de responder.** Se o saldo não cai
depois do clique, não repita — é assim que se compra mil do que não se queria.

Para qualquer coisa que destrua: **audite o estado final, não a ação que deveria tê-lo
produzido.** Não basta desligar o filtro dos lendários e seguir; leia a grade de cada linha que
ficou marcada. O filtro pode não ter re-renderizado. A linha não mente.

E **confira todas as fontes que houver.** Para a venda são três, independentes: os checkboxes no
DOM, o rótulo do botão (`Vender (73)`) e o popup de confirmação (`68 linha(s)`). Divergiu
qualquer uma, não aja. E se uma fonte **desaparecer** — um popup que deixa de dizer quantos —
isso é motivo para cancelar, não para seguir: confirmar no escuro é pior do que não vender.

**O jogo nem sempre pergunta.** Com um pokémon selecionado a venda sai direta, sem confirmação.
Então a ausência do popup não é erro, e um clique de teste "só para ver o popup" é uma venda.

**Número truncado não é número.** O inventário mostra `9999+`. Quem não sabe quanto tem não pode
comprar "a diferença" — trate como desconhecido e não aja.

**Toda rotina longa tem de saber desistir.** Andar, procurar NPC, comprar: cada uma precisa de um
sinal de "não está progredindo" e de um teto duro. Uma rotina que insiste roda em segundo plano,
sem ninguém olhando.

**Se saiu do lugar, volte — mesmo quando falhar.** O ciclo devolve o jogador à caçada no
`finally`. Parar no meio do shopping é pior do que nunca ter saído.

**Dois limites opostos não se resolvem em duas fases.** O Depósito trava o Box com a equipe
cheia e recusa deixá-la vazia. Qualquer plano em etapas fixas ("tira todos, põe todos") bate num
dos dois. Releia o estado a cada volta e faça o passo que cabe.

**"Não tenho opinião" não é "não".** O time da escada tem três estados: ausente (use o da
caçada), `''` (não troque) e um nome. Colapsar os dois primeiros tiraria o time de todas as
caçadas que a Escada usasse. Quando um campo opcional sobrepõe um valor de outro lugar,
`undefined` e vazio têm de continuar distintos — e o teste tem de cobrir os dois.

**Estado de opção não mora no `value`.** O seletor guarda o modo em `dataset.modo`, não num
`value` reservado como `'@cacada'`: um time com esse nome é improvável, mas um valor reservado é
uma cilada à espera, e evitá-la custa uma linha.

**Automação parada e calada é indistinguível de automação quebrada.** Não agir é uma decisão, e
uma decisão tem de ser dita: quem é o sujeito, em que estado ele está, que condição falta e o que
fazer para sair do impasse. A escada ficou uma noite parada porque o líder estava no Lv 1 e o
degrau mais baixo no Lv 5 — a regra estava certa e o silêncio é que não estava.

**O valor inicial de uma configuração é parte da regra.** O primeiro degrau nascia no Lv 10 por
simetria com os seguintes, e isso bastava para a ferramenta nascer sem efeito. Quando um padrão
pode produzir um estado que não faz nada, ele não é um detalhe de conveniência.

**Automação que decide *quando* não deve decidir *onde você pode estar*.** A escada leva você ao
degrau quando o nível sobe, e depois larga: sair dali à mão é seu direito. Guardar o degrau já
cumprido é o que separa "me levou" de "não me larga" — sem isso, cada batida do HUD arrastaria o
jogador de volta.

**Um teste pode passar pela guarda errada.** O teste de "não dispara duas vezes" passava mesmo
com a guarda removida, porque a segunda chamada caía noutra verificação ("já estou lá"). Só a
mutação mostrou isso. Quando duas guardas cobrem o mesmo caso feliz, o teste tem de ir ao caso em
que elas discordam.

**Quem é dono do estado tem de o guardar.** Um módulo `proprio` é a fonte da verdade da sua
própria visibilidade: o núcleo só pergunta (`PPX.visivel`) e manda aplicar (`PPX.controlar`). Se o
módulo não grava a escolha na chave dele, ela morre no F5 — e o botão do menu passa a ser um
interruptor que esquece.

**Cure o estado de depois, não o de antes.** A equipe que vai viajar é a que ficou no fim da
troca, e quem veio do Box pode vir caído. Uma preparação feita só na entrada arruma o estado
errado — o que importa é o estado no momento em que ele vai ser usado.

**`finally` é para soltar recursos, não para fazer trabalho que pode falhar.** A volta à caçada
corria num `finally` e o resultado dela não cabia na mensagem que já estava decidida — a
ferramenta dizia "montado" com o jogador parado na cidade. Trabalho cujo resultado o utilizador
precisa de saber sai do `finally` e vira um passo com nome, cuja frase se junta à do passo
anterior.

**Quando o jogo recusa sem erro, leia a tela — mas não o chat.** O jogo não devolve falha: ele
põe um aviso e não faz nada. "Cliquei e nada mudou" não é um diagnóstico; o aviso é. Escute o que
**aparece** durante a ação, e exclua o chat: ali qualquer jogador escreve qualquer coisa, e ler
dali seria deixar estranhos escolherem a mensagem de erro da ferramenta.

**Esperar um relógio custa caro no teste.** `ateQue` conta tentativas, não milissegundos. Com o
relógio, um caminho que nunca chega custa o limite inteiro em tempo real — o teste da viagem que
falha levava vinte segundos cada. A suíte caiu de 32 s para 3,6 s quando as Caçadas passaram a
contar tentativas, como os Times já faziam.

**Ordem que só se constrói não se arruma: refaça da frente para trás.** No Depósito quem vem do
Box entra sempre no fim, tirar do meio não mexe nos outros e não há nenhum jeito de reordenar.
Com essas três regras, pôr a equipe numa fila dada é um problema de prefixo: o que já está certo
na frente fica, tudo o que vem depois do primeiro erro sai e volta na ordem. Vale para qualquer
lista que só aceita acrescentar no fim.

**Quando o passo seguinte é proibido, inverta a ordem dos dois.** Com um só na equipe o jogo
recusa tirar. Então o certo entra antes de o errado sair: passa-se por dois, nunca por zero. A
saída não foi forçar o passo proibido, foi trocar a sequência.

**Um custo que o utilizador paga é uma escolha dele.** Manter a ordem desmonta quase a equipe
inteira quando o primeiro está fora do lugar. Isso não é motivo para não fazer, nem para fazer
sempre: é motivo para ser uma caixa no painel, desligada por padrão, com o custo dito.

**Confira o caminho inteiro antes do primeiro passo irreversível.** Quando a rotina tem um ponto
sem volta no meio — e no Depósito tem, porque com a equipe cheia o Box fica travado e é preciso
esvaziar antes de encher —, tudo o que ela vai precisar se confere **antes** dele.

**Aba oculta não desenha, e o que não é desenhado não existe no DOM.** As placas dos NPC
(`.npc-plate-btn`) só aparecem enquanto o motor do jogo roda. Em segundo plano ele para, e a
lista fica vazia. Toda rotina que depende de NPC precisa saber dizer isso em vez de concluir "não
achei". O mapa e as janelas, que são DOM, continuam funcionando.

**O jogo abre um anúncio depois do F5.** O passe de batalha fica por cima de tudo e impede o mapa
de desenhar. Fecha num botão "Fechar", e é a primeira coisa a fazer antes de procurar qualquer
placa.

**Pausa é chão, não média.** As esperas do pacote passam pelo `pausa.js`, que sorteia por cima do
número pedido e nunca por baixo. Os números foram medidos contra o jogo; encurtar um deles para
"parecer humano" troca discrição por falha intermitente.

**Defeito escondido por outro defeito.** Os quatro paineis sempre nasceram no mesmo canto — e o
canto do painel de captura do jogo. Isso nao incomodava ninguem porque o F5 escondia todos; quando
eles passaram a aparecer, o bug de empilhamento saiu junto com a correcao. Ao fazer algo aparecer,
procure o que estava encoberto. E lugar padrao de painel se escolhe medindo o que o jogo ja ocupa
(`getBoundingClientRect` do HUD, do chat, da barra e da captura), nao a olho.

## O resto

- Reproduza antes de consertar. Uma banca construída sobre a suposição só confirma a suposição.
- Teste e documentação na mesma tarefa, nunca depois.
- O pacote declara **apenas** `poke.idleworld.online`. Dois pacotes no mesmo site disputam atalhos.
- Nunca commitar, taguear ou publicar sem pedido explícito.
