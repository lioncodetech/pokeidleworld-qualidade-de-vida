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

**O estado de depois e' que manda, mesmo quando a acao foi sua.** Trocar quem esta' a subir e' um
clique na caixa do pokemon no HUD — barato, sem Deposito. Mas a ferramenta rele o HUD depois de
clicar em vez de assumir que clicou: se quem ficou na frente nao for quem ela queria, ela diz e
**nao viaja**. Um clique engolido mandaria o bicho de Lv 1 para a caçada do Lv 60.

**Espera do jogo nao e' falha do jogo.** Depois de uma troca de pokemon o HUD po-e 5 s de espera
nas outras caixas ("Troca disponível em 5s") e **recusa o clique em silencio** dentro dela. Tratar
isso como erro custaria dois minutos de castigo por cinco segundos de espera. Quando o jogo diz
quanto falta, espere o que ele disse — e quando ele nao diz, nao invente: espreite o DOM ate' um
limite, que foi como se descobriu que a troca leva 571 ms a aparecer.

**Um teste que mede o estado final pode nao medir guarda nenhuma.** "Trocar de aluno apaga o
degrau cumprido" passava com a linha removida, porque a viagem seguinte gravava o mesmo valor. A
mutacao mostrou-o. O caso que separa as duas versoes e' o aluno novo cair no **mesmo** degrau que
o anterior ja' tinha cumprido: sem apagar, a escada cala-se e deixa-o onde nao devia.

**O que corre ao carregar faz parte do caso.** O modulo confere a escada assim que a pagina abre,
e essa volta nao e' esperada por ninguem — na banca, ela ficava a correr enquanto o teste media.
Pior: `globalThis.PPX` e' um so', entao a viagem atrasada de um teste aparecia nas contas do
seguinte. A banca passou a ter um `pronto()`, e quem mede espera por ele.

**Uma porta, nao quatro.** A Nurse Joy mora nos Times, porque o Deposito mora nos Times. As
Caçadas, o Ciclo e a Escada pedem a cura por `PPX.times.curar` em vez de procurarem o NPC cada
uma por sua conta — quatro buscas pelo mesmo NPC divergiriam no primeiro dia em que o jogo
mudasse a tela.

**A fila nao e' reentrante entre donos, e isso muda a forma da API.** O Ciclo segura a vez do
inicio ao fim da ida ao mercado; se chamasse o `curar` que pede a vez, ficaria a' espera de si
proprio. Por isso ha' duas portas: `curar` (pede a vez e viaja) e `curarAqui` (nao faz nem uma
coisa nem outra, para quem ja' tem a vez e ja' esta' em Cerulean). Quando uma funcao precisa de
um recurso que o chamador ja' pode ter, ofereça as duas metades.

**Teste que dorme um tanto fixo mente na maquina ocupada.** Os testes do vigia falharam uma vez
em quatro com `setTimeout(300)` e passaram sempre com uma espera por condicao. Para medir que
algo **acontece**, espere pela condicao; so' para medir que **nada** acontece e' que se da' tempo
de sobra e se olha no fim.

**Codigo que o painel nao alcança sai.** O "Ir agora" virou um ▸ por degrau, e a opcao `forcar`
do `conferir` ficou sem chamador. Uma opcao testada que nenhum botao aciona e' divida com cara de
funcionalidade: foi removida com os testes dela, e o caminho a' mao passou a ser um so'.

**O que nao esta' no DOM nao e' o que nao existe.** O mapa tem quatro regioes e desenha so' a
aberta: a caçada de Outland existe, o marcador dela nao. Uma busca que nao acha tem de perguntar
"estou a olhar o lugar todo?" antes de concluir "nao existe" — e o arreio de teste tem de ter o
mesmo recorte, senao um mapa de mentira com tudo sempre presente da' a ferramenta quebrada por
boa.

**Travado nao e' desativado.** As placas de Orre e Nightmare tem `locked` e continuam clicaveis:
da' para olhar o mapa delas. O jogo nao recusa a viagem com um erro, so' nao te move. Ler a
classe e dizer "fica em Orre, que o seu nivel nao destranca" e' a diferenca entre um diagnostico
e um "cliquei e nada".

**Travar o estado antes de passar pelas guardas e' perder o caso.** O vigia da equipe marcava
"ja' vi este caido" e **so' depois** verificava a aba e a vez. Com a aba em segundo plano — que
e' como se joga, varias janelas — a tentativa era descartada com o estado ja' marcado, e nunca
mais havia tentativa. Guarde "quando posso tentar de novo", nunca "ja' tratei disto".

**Quem escreve na chave de outro modulo escreve DENTRO dela.** O "arrumar" po-e a posicao na
chave de cada painel; escrever o objeto todo por cima apagaria os times guardados. Ler, mexer
num campo e regravar — e um teste que ponha um time la' dentro para provar que ele sobreviveu.

**O tamanho da tela le-se como o resto do pacote le.** `innerWidth` entra pela banca; quem usa
`globalThis.innerWidth` recebe `undefined` no teste, encolhe tudo para o canto 0,0 e passa a
testar outra coisa. Foi assim que os quatro cantos "nao se sobrepoem" quase passaram sobrepostos.

**Duas aberturas, nao duas por item.** A compra abria e fechava o inventario a cada item: dezoito
idas para nove itens. Uma leitura no inicio e uma conferencia no fim dizem mais — porque contam
coisas diferentes: cliques que debitaram, e itens que entraram na mochila. Quando os dois numeros
discordam, e' isso que se quer ver.

**O que a ferramenta mede, o painel tem de mostrar.** A compra lia a mochila desde sempre, e o
numero morria na frase de status. Faltava um botao para **ver antes de gastar** — quem escolhe o
alvo precisa do estoque na hora de escolher, nao depois. O botao reusa a leitura que ja' existia
e pinta o rotulo de cada linha; `9999+` continua `9999+`, porque escrever `9999` ali seria
inventar o que o jogo nao disse.

**Janela de jogo que se abre tem de se fechar, mesmo quando a leitura deu certo.** A mochila por
cima do jogo estorva quem joga e tapa o DOM de quem automatiza. Foi a unica mutacao que sobreviveu
aos testes do botao novo: tirar o `fecharInventario` passava. O guarda e' o estado do fim —
`invAberto() === false` — e nao o facto de a funcao ter sido chamada.

**Canto medido e' ponto de partida, nao regra.** Os quatro cantos sao a medida do que o jogo
ocupa, e isso resolve a instalacao nova — nao resolve dois monitores, chat fechado, ou "modo
venda". A arrumacao passou a ter nome e lista: `lerArranjo` le' **onde os paineis estao** (a tela
manda sobre a chave, porque o arrasto so' grava ao soltar) e `aplicarArranjo` devolve-os para la',
sempre preso dentro da tela. Uma arrumacao guardada em 1920 e aplicada em 1280 poria o painel
fora da tela, e dali nem se arrasta de volta.

**Para falar com as outras janelas, use o canal que o navegador ja' tem.** Elas partilham o
`localStorage`, mas um valor gravado so' aparece no F5 seguinte — e ninguem da' F5 em seis
janelas. O evento `storage` chega as **outras** janelas do mesmo site na hora, e nao dispara na
que escreveu, o que dispensa qualquer cuidado com o proprio recado. Duas armadilhas: **gravar o
mesmo valor nao dispara evento nenhum** — por isso o recado leva um contador, e `Date.now()` nao
serve sozinho, que dois cliques no mesmo milissegundo dao o mesmo texto; e o que chega pela chave
**e' dado, nao ordem** — peneire ids conhecidos e numeros finitos antes de mexer no DOM.

**Minimizado nao e' "quase fechado": e' a ferramenta sem a oficina.** O modo compacto escondia
tudo o que nao fosse um botao, incluindo a lista e o Aplicar — ou seja, escondia justamente o que
se usa todos os dias e deixava a' vista o que se usa uma vez. A regra do CSS passou a ser uma
classe `arx-oculto` posta item a item, em vez de "esconde todo o `input`, `select` e `textarea`":
a segunda forma e' comoda e decide por acidente.

**Atalho com `Shift` e' terreno livre, mas confirme que o vizinho o ignora.** O caderno de
anotacoes declara "qualquer site" e reage a Alt+O/Alt+P **sem olhar o `shiftKey`** — se o atalho
novo fosse Alt+Shift+P, disparava os dois. Ler o `addEventListener` do vizinho custa um minuto; o
relato de "as vezes funciona" custa uma tarde. E com modificador use `e.code`, nao `e.key`: com
Alt+Shift o teclado pode devolver outra coisa em `key`.

**Atalho que depende do painel so' funciona com o painel.** O Alt+Shift+J aplica "a escolhida",
e a lista so' existe depois de o painel ser montado. Guardar a ultima usada e' o que faz o atalho
valer com a ferramenta fechada — que e' o estado em que ela vive. E o teste dessa guarda tem de
usar um nome que **nao** seja o primeiro em ordem alfabetica, senao passa pela guarda seguinte
("a primeira que houver") e nao mede nada: foi a unica mutacao que sobreviveu a' primeira volta.

**`z-index` empatado nao e' empate: e' a ordem de carregamento a decidir.** Os cinco paineis
pediam 2147483646, o maximo, e com empate manda a ordem no DOM — a ordem dos ficheiros no
manifest. O painel em que se mexia ficava atras de outro e so' se resolvia fechando o de cima.
Duas liçoes: **pedir o maximo e' nao deixar para onde subir** (o andar base baixou para
2000000000, e `PPX.frente` reparte dali para cima), e **uma contagem partilhada mora no nucleo** —
duas contagens, uma por modulo, empatariam outra vez no primeiro clique.

**Contador que cresce precisa de volta ao inicio.** Um `z-index` que passe do maximo do CSS deixa
de trazer o que quer que seja para a frente, e o sintoma e' o defeito original de volta, numa
sessao longa, sem nada no teste a reclamar. O tecto esta' muito acima do que se alcança — e ainda
assim ha' volta.

**Regra do pacote, teste do pacote.** "Todos os paineis nascem no mesmo andar e todos pedem a
frente" nao e' verificavel no teste de um modulo: o que falha e' o par. O guarda le' os cinco
ficheiros e o `Z_BASE` do nucleo e exige que casem — mudar o nucleo sozinho reprova.

**Folha de estilo copiada deriva, e deriva para onde ninguem escolheu.** As cinco janelinhas
tinham a mesma folha com o prefixo trocado: sete regras literalmente iguais nas cinco. O
resultado medido nao foi "igual": foi minimizado a 176px, 190px e 200px, um separador proprio
numa, e a Loja — o painel mais alto — sem minimizar nenhum. O desenho passou a ter um dono
(`PPX.estiloDePainel(pfx)`), e o que e' proprio de cada painel fica na folha dele, que vem depois
e ganha nos empates. Com um dono, consertar a barra de rolagem e o anel de foco custou uma linha
cada, nos cinco.

**Procurar um elemento pela posicao e' guardar uma armadilha.** O `aplicarModo` das Caçadas
procurava `.cjx-barra button` — o PRIMEIRO botao da barra. Funcionava por acidente de ordem, e um
botao novo antes dele poria o `–` no `×`. Classe propria, sempre; e a mutacao que troca uma pela
outra tem de reprovar, o que exige um guarda de pacote, nao do modulo (no fake, o primeiro botao
tambem e' o certo).

**Codigo publicado que ninguem usa e' um defeito a' espera.** O `PPX.canto` estava no nucleo,
documentado, com migracao do formato antigo escrita — e as cinco janelinhas tinham cada uma a sua
copia em pixels absolutos, que e' exactamente o esquema que o comentario dele argumenta nao
funcionar. Nao e' "codigo morto": e' a solucao certa a ser ignorada enquanto o defeito que ela
resolve acontece todos os dias. Quando se encontra uma API publicada sem chamador, a pergunta
nao e' "apago?", e' "por que e' que ninguem a usou?".

**Guardar a distancia ate' a borda mais proxima, nao o pixel.** O que fica guardado e'
`{x, y, direita, baixo}` e a posicao e' recontada a cada tamanho de tela. O formato antigo
`{x, y}` continua valido e quer dizer "do canto de cima a' esquerda" — que e' o que sempre
significou, e por isso a migracao nao perde nada na primeira abertura. O `doGuardado` e' o unico
sitio que sabe disso.

**Quando a posicao muda de significado, a assercao do teste tem de mudar de nivel.** Meia duzia de
testes do "arrumar" comparavam `deepEqual(pos, {x: 700, y: 200})`. Com o canto, os mesmos 700/200
passam a ser 712/33 contados de outras bordas — e o teste reprovava sem que nada estivesse mal.
Reescritos para medirem **onde o painel fica na tela**, que e' a garantia real, eles passaram a
sobreviver ao formato e a dizer mais.

**Fake que ignora o `style` mede sempre a mesma coisa.** A caixa dos painéis de mentira era
estatica; desde que a posicao e' medida por `getBoundingClientRect`, isso faria o teste dar o
mesmo resultado aplicasse-se o que se aplicasse. A caixa passou a seguir o `style`, e a banca
passou a aplicar a chave de cada painel na montagem — como o modulo dono faz —, senao a tela e a
chave diriam coisas diferentes a' partida, o que no jogo nao acontece.

**Escondido nao se posiciona pelo zero.** `canto.aplicar` recusa quem nao tem caixa, e por isso
`PPX.painel` devolve um `recolocar` que o modulo chama quando o painel volta a' vista. Sem isso,
uma janela que encolheu enquanto o painel estava fechado trazia-o de volta no lugar antigo.

**Fake cego nao testa painel.** A banca da Loja devolvia um no' sem `classList`, sem filhos e sem
ouvintes — e por isso nada do painel dela era mensuravel. Foi assim que ela pode ficar anos sem
minimizar sem nenhum teste a reclamar. Um `createElement` de mentira que guarde classes, filhos e
ouvintes custa vinte linhas e abre a metade da ferramenta que ninguem estava a olhar.

**Banca sem armazenamento nao mede "lembra".** A Loja gravava o modo minimizado e o teste media o
objeto em memoria: tirar o `gravar()` passava. `localStorage` de mentira tem de guardar de
verdade, senao toda a frase "sobrevive ao F5" e' indemonstravel.

**Tirar uma trava e' decisao do dono, e diz-se o que se perdeu.** O teto de "max por vez" da
venda saiu a pedido. A resposta certa nao e' discutir: e' tirar, dizer numa linha qual rede
deixou de existir, e apontar as que ficaram.

## O resto

- Reproduza antes de consertar. Uma banca construída sobre a suposição só confirma a suposição.
- Teste e documentação na mesma tarefa, nunca depois.
- O pacote declara **apenas** `poke.idleworld.online`. Dois pacotes no mesmo site disputam atalhos.
- Nunca commitar, taguear ou publicar sem pedido explícito.
