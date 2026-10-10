# Poke Idle World — qualidade de vida

Extensão de navegador para o [Poke Idle World](https://poke.idleworld.online).

| ferramenta | o que faz | atalhos |
| --- | --- | --- |
| Captura automática | lança a pokébola assim que aparece um selvagem | Alt+C liga · Alt+V desliga |
| Loja do Mark | compra em lote e vende com auditoria | Alt+L abre o painel |
| Ciclo da loja | sai da caçada, vende, reabastece e volta | Alt+K roda |
| Caçadas | guarda as caçadas que você usa e volta a qualquer uma | Alt+W abre o painel |
| Times | guarda equipes de seis e as remonta | Alt+T abre o painel |
| Escada de caçadas | troca de caçada sozinha quando o líder sobe de nível | Alt+P abre o painel |

**Alt+Q** abre o menu, que liga e desliga a ferramenta sem precisar do atalho.

**Cada painel lembra se estava à vista.** O botão do meio no menu (`à vista` / `oculta`), o `×` da
barra e o atalho da ferramenta escrevem todos a mesma escolha, e ela sobrevive ao F5 — antes, cada
recarga devolvia os painéis para o escuro e não havia como deixá-los aparecendo. Numa instalação
nova eles aparecem: uma ferramenta que ninguém vê é uma ferramenta que ninguém usa.

**E cada um nasce num canto diferente.** Enquanto os paineis sumiam no F5 ninguem notava que os
quatro tinham o mesmo canto padrao, de baixo a' direita — que e' justamente onde o jogo poe o
painel de captura (medido: `x 1644-1908, y 599-767` numa tela de 1920x863). Com eles a' vista, o
empilhamento virou tres paineis escondidos atras do quarto, e o quarto por cima do jogo. Agora:
Cacadas em cima a' direita, Escada ao lado dela, Times em baixo a' direita (antes do painel do
jogo) e Loja do Mark em baixo ao centro — nenhum sobre o HUD (`x 16-262, y 16-426`), o chat
(`x 14-342, y 613-849`), a barra de cima (`y 16-72`) ou a captura. Quem arrasta manda: a posicao
guardada passa por cima do canto padrao.

## Por que não um auto-click

Tudo o que está aqui foi medido na conta real em 09/10/2026, com o painel de captura aberto.

**O jogo trava o botão por ~4,4 segundos depois de cada lançamento.** O travamento é explícito: o
botão fica `disabled` e o texto conta para trás (`⏳ 4s`, `⏳ 3s`…). A ferramenta lê esse estado em
vez de cronometrar — se o jogo mudar o tempo, ou o VIP encurtá-lo, ela acompanha sozinha. Um
auto-click por tempo erra dos dois lados: rápido demais bate em botão travado, devagar demais
perde selvagem.

**Entre um selvagem e outro há buracos.** O auto-click clica no vazio; aqui só se clica quando
existe alvo.

**A lista muda de tamanho** — foi observada de 0 a 4 linhas. Clique por coordenada acerta a linha
errada quando isso acontece.

**E funciona com a janela escondida.** Esta é a diferença que mais importa para quem joga em várias
janelas: o auto-click exige a janela visível e em posição fixa.

## Como ela espera, e por que isso importa

O motor da ferramenta é um `MutationObserver`, não um temporizador — e isso é uma decisão medida,
não estilo.

Com a aba em segundo plano, o Chrome estrangula `setInterval` para **uma vez por minuto**. Uma
ferramenta feita com temporizador simplesmente não lançaria quase nada nas janelas escondidas.
Mutação de DOM continua chegando normalmente.

Foi confirmado por medição que, com a aba oculta durante ~5,5 minutos, o painel `.cap-panel` e o
botão `.cap-throw` **continuaram existindo o tempo todo**, com os selvagens aparecendo e o DOM se
mexendo sem parar. O "modo carta" que o jogo anuncia ao perder o foco não remove o painel.

Há um `setInterval` lento como rede de segurança, para o caso de nenhuma mutação chegar. Em
segundo plano ele vira uma vez por minuto — é pouco, e é de propósito que ele não seja o motor.

## O que ela não faz

- **Não escolhe o que capturar.** Lança no primeiro selvagem com botão livre, seja ele qual for.
  Filtro por nome e nível fica para depois.
- **Não troca o tipo de pokébola.** Usa o que estiver selecionado no painel.
- **Para sozinha quando as bolas acabam**, e se desliga em vez de insistir a cada mutação.

## Automação passa pela fila

A vez é pedida no instante do lançamento e solta logo em seguida, nunca enquanto a ferramenta está
ligada. Ela fica ligada horas: segurar a fila todo esse tempo trancaria para sempre qualquer
automação que venha depois. Ver `AGENTS.md`.

## Loja do Mark

Tudo medido na loja real em 09/10/2026.

### Comprar

**Um clique compra uma unidade, e não existe confirmação nenhuma.** Encher o estoque de Ultra
Ball é centenas de cliques na mão. No painel (Alt+L) você escreve o **estoque alvo** de cada
item — não a quantidade a comprar. O ciclo lê quanto você já tem e compra só a diferença; 0
ignora o item.

Ela para sozinha em três situações, e nenhuma delas é erro — são o jogo dizendo que não dá: o
botão saiu do ar, o dinheiro acabou, ou **o saldo parou de cair**. Esse último é o que importa:
se o jogo deixa de debitar e a ferramenta continua clicando, ela compra mil do que você não
queria. Três cliques sem débito e ela desiste.

### Vender

O jogo já faz quase tudo: filtro por grade, checkbox por linha, "Selecionar tudo", e um botão que
anuncia o estrago antes de acontecer — `Vender (73) · 💲1.314.000`. O que falta é não depender da
sua memória para aplicar os filtros certos toda vez.

A ferramenta aplica o filtro, marca tudo, **audita, e para**. O clique final em Vender é seu.

**A auditoria não confia no filtro.** Desligar as grades altas e torcer para a lista ter
atualizado é confiar num render. Em vez disso ela lê a grade de cada linha que ficou marcada
(`.mks-meta` traz `Nv 1 · Comum · IV 137`): se um lendário está marcado, ele está marcado, tenha
o filtro funcionado ou não. Achou um protegido, desmarca e audita de novo; se persistir, para.

E há um segundo guarda: **a conta do jogo tem de bater com a da tela.** Se o botão diz 73 e o DOM
mostra 71, alguém está vendo uma lista que o outro não vê — e aí não se vende nada.

Nunca se vende Lendária, Mítica, Anciã ou Divina. A lista não é configurável de propósito.

## O ciclo (Alt+K)

Faz a volta inteira sozinho:

1. anota onde você está (`.phud-tloc` diz a caçada atual);
2. volta para Cerulean e entra no mercado;
3. anda para o norte até o Mark e abre a loja;
4. vende de Épica para baixo, com a auditoria;
5. compra cada item até o estoque alvo;
6. **volta para a caçada de onde saiu.**

Cada etapa confirma que aconteceu antes da seguinte — nenhuma é assumida. Se uma falhar, o ciclo
para e **mesmo assim tenta voltar para a caçada**: ficar parado no shopping é pior do que não ter
saído.

### O que o ciclo se recusa a fazer

**Não anda para sempre.** A caminhada observa se o mapa rolou; três leituras iguais e ela
desiste. Medido no jogo real: contra a parede ao norte, parou em **3 teclas** em vez de martelar
as 20 pedidas.

**Não fala com o NPC errado.** Os botões de NPC não dizem quem são — o nome é desenhado no mapa,
e no DOM todos são `Conversar`. Então o ciclo fala e **lê o diálogo**: só segue com quem se
apresenta como Mark. E só tenta botões `Conversar`, nunca `Usar máquina` — essa é a slot machine,
e apostar por engano seria o pior jeito possível de descobrir o erro.

**Não compra sem saber o estoque.** O inventário trunca a exibição em `9999+`. Isso não é um
número, então o ciclo trata como desconhecido e não compra — tratar como 9999 faria ele comprar a
diferença de uma quantidade que não é verdade.

**Não viaja para o lugar errado.** Se não achar a caçada no mapa na volta, fica parado e avisa.

## Caçadas (Alt+W)

Guarda as caçadas que você usa e volta a qualquer uma num clique. **📌 Guardar onde estou**
acrescenta a atual à lista; cada linha tem **▶ Ir** e um **×** que tira da lista.

**Não guarda cidade.** Clicar em guardar parado no Shopping, em Cerulean ou no Mercado não grava
nada — senão a lista de atalhos para caçar viraria uma lista de atalhos para ir fazer compras.

**Não diz "cheguei" sem ter chegado.** Depois de clicar no marcador ela relê onde o jogo diz que
você está. Se não bater, ela diz isso. Confirmar custa uma leitura; mentir custa uma noite parado
no mapa.

**Equipe desmaiada bloqueia a viagem**, e o jogo não devolve erro nenhum: ele mostra um aviso na
tela e simplesmente não sai do lugar. Como o líder dela era um Bellsprout Nv 1, isso aconteceu de
verdade em 10/10/2026 — e tudo o que a ferramenta sabia dizer era *"cliquei para viajar, mas o
jogo diz Cerulean"*, o que levou minutos a entender. Agora ela escuta o que apareceu na tela
durante o clique e diz: **cure com a Nurse Joy** (o "Conversar" dela, em Cerulean). Lê só o que
aparece **fora do chat** — ali qualquer jogador escreve qualquer coisa, e deixar o chat escolher a
mensagem de erro da ferramenta seria entregá-la a estranhos.

O caminho até a caçada já estava medido no ciclo da loja, e é repetido aqui de propósito: cada
ferramenta do pacote pode estar desligada sozinha, e uma depender da outra para algo tão básico
seria trocar quinze linhas repetidas por uma falha calada.

## Escada de caçadas (Alt+P)

Um degrau é *"a partir do nível N, caçar em tal lugar"*. Monte a escada, ligue a caixa, e ela
troca de caçada sozinha conforme o líder sobe.

```
Lv 1   → Meowth
Lv 50  → Persian
Lv 120 → Charizard
```

**O time é um só, para a escada inteira** — um seletor abaixo da lista, não um por degrau. A
escada é a subida de *uma* equipe: são as caçadas que mudam, não o time. São três opções, e elas
são mesmo três:

| na escada | o que acontece |
|---|---|
| — o time de cada caçada — | cada degrau leva o que você configurou nela no Alt+W (é o padrão) |
| — sem trocar o time — | viaja com a equipe que já está posta |
| sempre o time "X" | monta X antes de cada viagem |

**Quem viaja são as Caçadas (Alt+W).** Esta ferramenta só decide *quando* e *com quem*; a viagem,
a montagem do time e a passagem pela Nurse Joy vêm de lá de graça. Sem as Caçadas ligadas
ela diz isso em vez de tentar. As caçadas do menu são as que você guardou lá — uma que sumiu da
lista fica aqui marcada, em vez de desaparecer em silêncio.

### O que foi medido, e que decidiu o código

- **São dois níveis, e eles não são a mesma coisa.** `.phud-tloc` dá o nível do **treinador**
  ("Nível 270 · Persian") e é ele que destranca as caçadas — o `onClick` do marcador compara o
  seu nível com o da caçada e recusa com um aviso se for menor. `.phud-mon .phud-lv` dá o nível
  de **cada pokémon** ("Lv.263"), que não destranca nada e é o que você está subindo. A escada
  olha o primeiro da equipe, o do ⚔, e combina com a caixa "manter a ordem" dos Times: quem
  escolhe a ordem escolhe o líder, e o líder passa a ser o medidor.
- **O HUD atualiza ao vivo** — o Charizard subiu de Lv.262 para Lv.263 entre duas leituras.
- **O gatilho é um observador, não um relógio.** Com a aba em segundo plano o `setInterval` cai
  para uma volta por minuto, e o motor do jogo para de rodar. O HUD é DOM e avisa quando muda.
  Como ele bate a cada ponto de vida, a peneira é o próprio número: lê-se o nível e só se faz
  conta quando ele mudou.
- **Ela não pede a vez.** Quem viaja é `PPX.cacadas.ir`, que pede a dele, e a fila só é
  reentrante para o mesmo dono — segurar a vez aqui deixaria a viagem esperando por quem está
  esperando por ela.
- **O degrau é o mais alto que o nível já alcançou**, não "o que acabou de passar". Ligar a
  escada com o líder já no Lv 80 leva direto ao degrau de 50.
- **Abaixo do primeiro degrau ela não viaja — mas diz.** Um líder no Lv 1 com o degrau mais baixo
  no Lv 5 não tem degrau nenhum para aplicar, e isso é de propósito: um único degrau "Lv 120 →
  Charizard" não pode atirar uma equipe de nível 1 lá dentro. O que estava errado era o silêncio.
  Agora o painel diz quem é o líder, em que nível está, qual é o primeiro degrau e que basta pôr
  um degrau em Lv 1 para começar. Por isso também o primeiro degrau novo **nasce no Lv 1**.
- **O painel responde "por que é que ela não fez nada?" sempre** — ao abrir, ao ligar e a cada
  decisão. Uma automação parada e calada é indistinguível de uma quebrada, e foi exatamente assim
  que esta passou a primeira noite.
- **Cada degrau dispara uma vez, e ela não te arrasta de volta.** Depois de a escada te levar,
  você sai dali à mão para onde quiser — ela decide quando você *sobe* de degrau, não onde você
  pode estar.
- **Viagem que não aconteceu não conta como degrau cumprido**, senão você ficaria na caçada
  errada para sempre. Mas há dois minutos de castigo antes de tentar de novo: uma equipe
  desmaiada não se cura sozinha, e martelar não ajudaria.
- **Com a aba oculta ela não viaja.** As placas dos NPC somem, a cura fica fora de alcance — e o
  nível também não sobe, então não se perde nada esperando a aba voltar.

## Times (Alt+T)

O time **não é uma tela de time**: ele mora dentro do **Depósito** (NPC Depot, no Centro Pokémon
de Cerulean), aba **⚔ Pokémon**. Dê um nome (`caçada`, `ginásio`) e clique em **📌 Guardar esta
equipe**; depois **⚔ Montar** remonta aquela equipe.

**Ela vai ao Depósito sozinha.** Se a janela não estiver aberta: volta para Cerulean, fecha o
anúncio que o jogo abre depois do F5 (ele segura o mapa inteiro), clica na placa **Abrir Depot**
— que fica ali na cidade, ao lado da do Market — e no fim **volta para a caçada de onde saiu**,
mesmo que a montagem falhe no meio. Guardar um time também não pode custar a caçada em que você
estava.

**Uma condição que não dá para contornar:** as placas dos NPC só existem enquanto a aba está
desenhando. Com o jogo em segundo plano o motor para, `.npc-plate-btn` fica vazio e não há placa
nenhuma para clicar. Nesse caso ela diz isso, em vez de insistir. Deixe a janela do jogo visível
quando for montar um time.

Os dois painéis **minimizam** no `–` da barra, como no PokePixel: fica só o essencial do dia a
dia — o nome e o botão de usar — e o modo escolhido fica guardado. O `×` ao lado esconde a janela
inteira; são coisas diferentes, e quem minimiza quer continuar vendo a lista.

### Manter a ordem (e escolher o líder)

Por padrão ela monta **os seis certos, em ordem qualquer**: quem já está na equipe e serve fica
onde está. A caixa **manter a ordem (o 1º é o líder)** muda isso — a equipe sai na mesma fila em
que foi guardada.

Ela existe como escolha porque **custa**. O que foi medido em 10/10/2026, na conta real:

- quem vem do Box entra **no fim** da equipe;
- tirar alguém do meio **não mexe** na ordem dos outros;
- o **líder (o ⚔) é simplesmente o primeiro da fila**, e o segundo sobe sozinho quando o primeiro
  sai — escolher a ordem é escolher o líder;
- **não existe reordenar dentro da coluna**: nenhuma seta de subir/descer, nada arrastável.

Então a ordem não se *arruma*: constrói-se da frente para trás. Tudo o que está depois do
primeiro erro tem de sair e voltar na ordem certa. Com o primeiro fora de lugar, isso é quase a
troca inteira — por isso a caixa vem desligada, e quem só quer os seis certos não paga por ela.
O que já está certo **na frente** nunca sai, e na prática ela desmonta menos do que parece: numa
equipe com os três primeiros certos e os três últimos trocados, bastam duas saídas.

Quando a equipe está em **um** e o primeiro da fila está no Box, o certo **entra antes** de o
errado sair — a equipe passa por dois, nunca por zero, que é o que o jogo recusa.

O que foi medido no Depósito, e que decidiu o código:

- **Com a equipe cheia, o Box inteiro fica travado** (`dpt-nomove`, título "Equipe cheia (6)") —
  então é preciso tirar antes de pôr.
- **E o jogo não deixa a equipe ficar vazia.** Com um só, o clique para guardar não faz nada. Com
  dois, sai qualquer um, até o líder (conferido).
- Os dois limites juntos **não se resolvem em duas fases**: resolvem-se alternando. A cada volta
  ela relê o estado e faz o único passo que cabe — tirar, se houver mais de um; pôr, se houver
  vaga. Tentar "tirar todos e depois pôr" parava com *"a equipe continua com 1"*.
- Por isso ela **confere tudo antes de tirar alguém**. Se algum do time guardado não estiver no
  Box, não mexe em nada. Esvaziar a equipe e só então descobrir que falta um deixaria você em
  campo com meio time — pior do que não ter mexido.
- **Cada pokémon tem um id, e é por ele que se guarda.** A `key` do React de cada linha do
  Depósito é o `capId` do jogo (`cmubb3tkcxpz38r52dgpvji5x`) — o mesmo que aparece em `teamIds`
  no HUD da equipe. Com id, um Venusaur é aquele Venusaur, e não "um Venusaur qualquer com a
  mesma ficha" (você tem três).
- **Mas o id nunca é a única fonte.** Ele vem de dentro do React: a `key` está no próprio
  elemento da linha, sem travessia nem nome de componente nem ordem de hook — mas o sufixo de
  `__reactFiber$` muda a cada build do jogo e um dia pode não estar lá. Quando não estiver, vale
  o texto, e a ferramenta funciona como funcionava.
- **O texto, quando é usado, ignora o nível.** O Charizard sobe de nível caçando, e com o nível
  na chave o time guardado hoje deixava de casar amanhã. Sobra nome + IV + grade. Times guardados
  no formato antigo continuam servindo: cada linha vale pelas duas chaves.
- **São dois cliques para abrir o Depósito**, não um: a placa abre um diálogo do NPC com o botão
  "Abrir Depósito". Era isto que faltava quando ela dizia *"Cliquei no Depot e a janela nao
  abriu"* — o clique tinha funcionado.
- **Espera-se chegar, não um relógio.** Depois de clicar, ela pergunta de meio em meio segundo se
  já chegou (a cidade), se a janela abriu (o Depósito), se o marcador apareceu (o mapa). Um
  número fixo transformava "demorou" em "não abriu" — foi exatamente o erro que apareceu na conta
  real.
- **Ela passa na Nurse Joy, quando precisa.** O jogo não deixa sair da cidade com alguém
  desmaiado, e a cura só existe num NPC — que fica no mesmo Centro Pokémon do Depot. Então ela
  cura **antes** de mexer no time e **de novo depois**, se alguém tiver vindo caído do Box: a
  equipe que sai da cidade é a de depois da troca, não a de antes. Com todo mundo de pé não abre
  conversa nenhuma. A vida vem do HUD (`.phud-mon .sbar-hp .sbar-txt`, "0/24"), e **machucado não
  é caído**: `20/24` fica como está.
- **Qual das placas é a da Joy, só se sabe abrindo.** Em Cerulean as três dizem "Conversar". Ela
  abre uma de cada vez e procura o botão "Curar equipe"; a que não for, fecha e segue. Depender
  de a Joy ser a primeira seria depender de uma coisa que o jogo nunca prometeu.
- **A volta conta como parte do trabalho.** Montar o time e deixar você plantado em Cerulean não
  é "montado". A volta acontece mesmo quando a troca falhou no meio, e o que ela disser entra na
  mesma frase: *"X montado. Mas nao voltei para Persian: sua equipe esta desmaiada…"*. Antes isso
  corria num `finally` que ignorava o resultado — a ferramenta dizia "montado" e você ficava na
  cidade sem uma palavra sobre o porquê.
- **As linhas são refeitas a cada movimento** (o jogo é React), então ela relê as colunas a cada
  passo em vez de guardar referências.
- Cada clique é conferido pela contagem da coluna, e no fim ela audita: o que ficou tem de ser o
  guardado, nem a mais nem a menos.

As duas pedem a vez em `PPX.vez` antes de agir, como todas as outras.

## O compasso (`pausa.js`)

Todas as esperas do pacote passam por um dono só, e nenhuma é um número redondo. Ninguém clica
cem vezes com exatamente 140 ms entre cada clique — um ritmo perfeito é o padrão mais fácil de
reconhecer que existe.

Três regras:

- **A pausa nunca encurta.** O número pedido é o chão, não a média. Esses números foram medidos
  contra o jogo (130 ms entre teclas porque abaixo disso ele perde teclas; 650 entre trocas
  porque é o que a janela leva para refazer as linhas). Sortear para baixo trocaria "parecer
  humano" por "falhar às vezes", que é um péssimo negócio.
- **O espalhamento acompanha o tamanho do pedido** — até 60% por cima. Somar sempre o mesmo
  punhado de milissegundos deixaria o compasso longo tão regular quanto antes.
- **De vez em quando há uma parada maior** (uma em catorze, de 0,6 a 2,2 s). Gente se distrai.
  Sem isso a distribuição fica estreita demais: regular de outro jeito, mas ainda regular.

A captura ganhou **tempo de reação**: ela não lança mais a pokébola no mesmo instante em que o
selvagem aparece. Mas **só com a aba à vista** — em segundo plano o Chrome estrangula
`setTimeout` para uma vez por minuto (a mesma razão pela qual o motor dela é um observador), e
esperar ali trocaria uma captura discreta por uma captura que não acontece. Em janela escondida
não há ninguém vendo o compasso mesmo.

## Onde funciona

`poke.idleworld.online`, e só.

O pacote do PokePixel é outro, com outro repositório, e declara apenas o site dele. Dois pacotes
que declarassem o mesmo site se injetariam na mesma página e disputariam os atalhos.

## Aviso

Automatiza ações do jogo. O Poke Idle World oferece captura automática como recurso VIP; se os
termos dele proibirem automação, o risco é seu.

## Testes

```
node --test "testes/*.test.mjs"
```

Os testes executam o módulo de verdade contra um DOM de mentira com a forma medida na página. Um
guarda que apenas lesse o texto do arquivo passaria mesmo que a ferramenta nunca clicasse.

## Instalação

Pela loja de extensões do LionMultInstance, ou à mão: baixe o `.zip` da
[última release](../../releases/latest), descompacte numa pasta e aponte a extensão da janela para
ela. Ao lado do `.zip` há um `.sha256` para conferir o pacote.
