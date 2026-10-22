# Poke Idle World — qualidade de vida

Extensão de navegador para o [Poke Idle World](https://poke.idleworld.online).

| ferramenta | o que faz | atalhos |
| --- | --- | --- |
| Captura automática | lança a pokébola assim que aparece um selvagem | Alt+C liga · Alt+V desliga |
| Loja do Mark | compra em lote e vende com auditoria | Alt+L esconde · Alt+M mostra |
| Ciclo da loja | sai da caçada, vende, reabastece e volta | Alt+K roda |
| Caçadas | lista todas as caçadas do jogo, guarda favoritas e viaja num clique | Alt+W esconde · Alt+E mostra |
| Times | guarda equipes de seis e as remonta | Alt+T esconde · Alt+Y mostra |
| Escada de caçadas | troca de caçada sozinha quando o líder sobe de nível, e roda a equipe inteira até o teto | Alt+B esconde · Alt+N mostra |
| Arrumar os painéis | põe cada janela no canto dela, guarda arrumações suas e manda-as às outras janelas | Alt+U esconde · Alt+J mostra · Alt+Shift+J arruma |
| Sem gráfico | para o desenho do jogo e deixa a lógica andando | Alt+G para · Alt+H volta |

**Alt+Q** abre o menu, que liga e desliga a ferramenta sem precisar do atalho.

**Sem gráfico** é diferente das outras: ela não é uma janela, é um interruptor. Com **Alt+G** o
jogo para de se desenhar — a tela vira uma fotografia — mas **continua jogando**: medido no jogo,
18 segundos com zero quadros desenhados e o personagem andando o tempo todo. A caçada, a captura e
o nível vêm do servidor, não do desenho. **Alt+H** devolve tudo.

Ela faz mais duas coisas, e as duas vieram de medir o **modo Cartas**, onde o próprio jogo já para
o desenho:

- **Devolve a memória da placa de vídeo.** O Pixi tem um recolhedor próprio, mas ele só roda no
  fim de cada quadro desenhado — sem desenho, ninguém limpa. Medido em modo Cartas: **320 MB
  presos na placa**, 254 deles em folhas de sprite de um mapa que não estava na tela. Uma passagem
  deixou 80 MB, e voltar a desenhar trouxe de volta só o que era preciso, sozinho e sem erro.
- **Para o que mexe fora do motor.** A moldura do jogo é HTML, e tem animação própria: em modo
  Cartas sobravam **13 animações CSS sem fim** — o brilho das barras de vida e a seta das
  notícias. Enquanto houver uma delas, a aba não sossega.

Cada janela tem **duas teclas**: uma esconde, a outra mostra. Um atalho só, que alterna, obriga a
olhar para a tela antes de o usar — ele faz o contrário do que fez da última vez. **Alt+Z** esconde
de uma vez todas as que estiverem à vista, e **Alt+X** traz de volta exatamente essas.

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

**Minimizar (o `–` na barra) existe nos cinco.** A Loja do Mark era a única sem — e é o painel
mais alto de todos. Minimizada, ela fica com o que se usa todo dia: conferir a mochila e rodar o
ciclo. Os alvos, a margem e a agenda são de configurar, e configurar não se faz todo dia.

**O desenho dos painéis tem um dono.** A moldura, a barra, os botões, o `×`, o separador, a linha
de status, a barra de rolagem e o anel de foco vêm do núcleo (`PPX.estiloDePainel`). Antes eram
cinco folhas de estilo com a mesma coisa copiada e o prefixo trocado — sete regras literalmente
iguais —, e cópia deriva: o modo minimizado nasceu com três larguras diferentes e a Loja ficou sem
minimizar nenhum. O que é próprio de cada painel (o canto, a largura, as linhas dele) continua na
folha dele.

Veio de graça o que estava faltando nos cinco: **barra de rolagem fina e escura** em vez da faixa
clara nativa, e **anel de foco** visível para quem anda de Tab.

**E o lugar guardado é a distância até a borda mais próxima, não o pixel.** O LionMultInstance
rearranja as views a toda hora, e isso muda o tamanho da janela. Guardar "1654px da esquerda" não
sobrevive a isso: numa janela de 1280 o painel simplesmente não aparece, e o recorte que o traz de
volta é definitivo — crescer de novo não o devolve ao lugar. Agora quem estava a 18px da borda
direita fica a 18px da borda direita, em qualquer tamanho de janela, e voltar ao monitor grande
devolve tudo ao lugar.

Isso é o `PPX.canto`, que o menu do pacote sempre usou e que as cinco janelinhas não usavam —
cada uma tinha a sua cópia em pixels absolutos. Agora é um só: **arrastar, lembrar o lugar, vir
para a frente ao ser tocado e recolocar quando a tela muda** são todos do núcleo
(`PPX.painel`). Saíram cinco cópias de `arrastarPor` e cinco de `aplicarPosicao`.

Veio junto o arrasto melhor do núcleo: **captura de ponteiro** — o arrasto não se perde se o
cursor sair da janela, que era o que acontecia com `mousedown` na janela — e **limiar de 4px**, de
modo que clicar na barra para trazer o painel para a frente não grava um lugar novo.

O formato antigo continua a ser lido: `{x, y}` quer dizer "do canto de cima à esquerda", que é
exatamente o que ele significava antes. Nada se perde na primeira abertura.

**E o painel em que você mexe vem para a frente.** Os cinco nasciam com o mesmo `z-index`, e com
empate quem decide é a ordem no DOM — ou seja, a ordem em que os arquivos carregam. Dava nisto: o
painel em que você estava mexendo ficava atrás de outro e não havia o que fazer além de fechar o
de cima. Agora, tocar num painel (clique ou teclado) e abri-lo pelo atalho põem-no acima dos
outros. O menu (Alt+Q) continua acima de todos: é o controle, e tem de dar para clicar sempre.

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

**Comprar é "ter X", não "comprar X".** Ao rodar, ela **abre o inventário**, lê quanto você tem de
cada item, compra a diferença e **abre o inventário outra vez no fim** para dizer quanto entrou
de facto:

```
Ultra Ball: 8 → 10 (+2), alvo 10
Great Potion: 20/20, nada a comprar.
```

Os dois números — cliques que debitaram e itens que entraram na mochila — são contados
separadamente de propósito: eles discordarem é justamente o que se quer ver. São duas aberturas
do inventário no total, e não duas por item, que era o que o ciclo fazia antes (dezoito, para
nove itens).

**🎒 Conferir a mochila.** Um botão no painel: abre o inventário, lê quanto há de cada item,
fecha, e escreve o número **ao lado de cada linha** (`Ultra Ball · tem 8`). Sem ele o estoque só
aparecia depois de uma compra — e quem quer *decidir* o alvo precisa de ver quanto tem antes de
gastar. Quando o jogo escreve `9999+`, a ferramenta lê a quantidade exata que aparece no tooltip
ao passar o mouse. Como esse número não existe no HTML parado, a extensão aciona o hover de cada
slot truncado e captura o tooltip dinâmico; só mantém `9999+` quando ele não traz um número
confiável. As duas
leituras da compra pintam o mesmo lugar, então abrir o painel depois de um ciclo já mostra os
números dele.

**Variar o alvo em ± (%)**, igual ao pacote do PokePixel: com 3%, um alvo de 20.000 vira algo
entre 19.400 e 20.600, sorteado a cada compra. Sem isso a mochila termina sempre no mesmo número
redondo, compra após compra. Zero compra exatamente até o alvo.

Item que **não aparece** na mochila tem zero, não "não sei" — tratar como desconhecido faria
justamente os itens acabados, os que mais precisam de compra, serem os únicos nunca comprados.
Já o `9999+` sem quantidade exata no tooltip continua desconhecido: número truncado não é número,
e quem não sabe quanto tem não pode comprar "a diferença". Com tooltip exato, por exemplo
`12.345`, um alvo de `12.350` compra apenas 5, respeitando também a variação em porcentagem.

**O "Máx. por vez" saiu.** Era um teto que recusava a venda acima de N linhas selecionadas, e foi
retirado a pedido — quem vende clica em "Selecionar tudo", e o teto só atrapalhava. Vale dizer o
que se perdeu: era a única trava por *quantidade*. Continuam de pé as três fontes independentes
(as marcações, o número no botão e o popup), a proteção de lendária/mítica/ancião/divina e o
clique final em Vender, que continua sendo seu.

Tudo medido na loja real em 09/10/2026.

### Comprar

No painel (Alt+M) você escreve o **estoque alvo** de cada item — não a quantidade a comprar. O
ciclo lê quanto você já tem e compra só a diferença; 0 ignora o item.

**A compra vai pela barra de quantidade da loja**, medida em 13/10/2026: cada linha tem um campo
e um cursor de 1 a 10.000, e o "Comprar" leva o número que estiver ali. A ferramenta escreve o
lote, **confere na barra do próprio jogo que ele foi aceito**, e só então clica — uma vez por
lote. Pedido acima de 10.000 sai em lotes de 10.000.

Essa conferência é o conserto de um defeito real: a loja ganhou a barra, a ferramenta continuou
clicando com ela em **1**, e um pedido de 10.000 Ultra Ball acabava em 10 compradas. O campo
prende o que recebe entre 1 e o máximo e **devolve 1 a tudo o que não entende** — então clicar
sem reler é comprar uma unidade achando que se comprou mil. Se a barra não ficar no número
pedido, não há clique nenhum: ela para e diz em quanto a loja ficou.

Ela para sozinha em quatro situações, e nenhuma delas é erro — são o jogo dizendo que não dá: o
botão saiu do ar, a loja não aceitou a quantidade, o dinheiro acabou, ou **o saldo parou de
cair**. Esse último é o que importa: se o jogo deixa de debitar e a ferramenta continua clicando,
ela compra mil do que você não queria. Três cliques sem débito e ela desiste.

**Quem diz quanto entrou é o débito, não o pedido.** Pedir 1.000 e o saldo cair o preço de 100 é
o jogo dizendo que vendeu 100 — é esse o número que a ferramenta conta, e a conferência da
mochila no fim continua sendo a palavra final.

### Vender

O jogo já faz quase tudo: filtro por grade, checkbox por linha, "Selecionar tudo", e um botão que
anuncia o estrago antes de acontecer — `Vender (73) · 💲1.314.000`. O que falta é não depender da
sua memória para aplicar os filtros certos toda vez.

A preparação manual aplica o filtro, marca tudo, **audita, e para**. No ciclo automático, a mesma
auditoria é feita antes de cada venda e o clique só acontece se todas as conferências baterem.

**A auditoria não confia no filtro.** Desligar as grades altas e torcer para a lista ter
atualizado é confiar num render. Em vez disso ela lê a grade de cada linha que ficou marcada
(`.mks-meta` traz `Nv 1 · Comum · IV 137`): se um lendário está marcado, ele está marcado, tenha
o filtro funcionado ou não. Achou um protegido, desmarca e audita de novo; se persistir, para.

E há um segundo guarda: **a conta do jogo tem de bater com a da tela.** Se o botão diz 73 e o DOM
mostra 71, alguém está vendo uma lista que o outro não vê — e aí não se vende nada.

Nunca se vende Lendária, Mítica, Anciã ou Divina. Na aba de itens, nunca se vende `Poke Card
Pack`, `Bronze Dimensional KEY`, `Devoted Token`, `Strange Pheromone`, qualquer `Shiny ... Card`,
`Rare Pokemon Picture` nem `Bronze Boss Token`. A lista é fechada de propósito.

## O ciclo (Alt+K)

Faz a volta inteira sozinho:

1. anota onde você está (`.phud-tloc` diz a caçada atual);
2. volta para Cerulean e abre **Depósito → Família: Itens**;
3. move somente os sete tipos de item protegidos para o depósito da família;
4. entra no mercado, anda para o norte até o Mark e abre a loja;
5. vende Pokémon de Épica para baixo e depois os itens restantes, sempre com auditoria;
6. compra cada item até o estoque alvo, usando a quantidade exata do tooltip da mochila;
7. **volta para a caçada de onde saiu.**

O botão **⏹ Parar ciclo** solicita uma parada segura: não inicia a próxima ação, fecha a janela
que o próprio ciclo abriu e libera a fila para as outras ferramentas. Se o ciclo não estiver
rodando, o botão apenas informa isso.

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

**Não compra sem saber o estoque.** O inventário trunca a exibição em `9999+`, mas o tooltip traz
a quantidade real. O ciclo usa esse valor exato; se o tooltip não existir ou não contiver um
número, trata como desconhecido e não compra.

**Não vende se a proteção falhar.** Se o Depósito da Família não abrir ou qualquer item protegido
continuar na bolsa depois do clique, o ciclo para antes de abrir a venda. A auditoria da loja ainda
desmarca esses mesmos itens uma segunda vez como trava independente.

Itens com quantidade 1 podem aparecer sem número e sem a classe normal de linha — é o caso real
do `Bronze Boss Token`. A proteção procura os nomes na janela inteira de **Família: Itens** e
reconhece como mochila somente o slot cujo ancestral contém uma seta para a direita. Assim ela
não depende do contador, da classe da linha ou da coluna e não confunde com os itens já guardados,
que têm seta para a esquerda.

**Chega perto antes de clicar.** As placas do Depot aparecem no DOM mesmo quando estão longe e
fora da tela, mas o jogo ignora o clique distante. O ciclo mede onde a placa está, caminha até ela
e só continua depois de confirmar que a janela do Depósito abriu.

**Não viaja para o lugar errado.** Se não achar a caçada no mapa na volta, fica parado e avisa.

## O mapa tem quatro regiões, e só desenha uma

`Kanto`, `Outland` (nv 150), `Orre` (nv 500) e `Nightmare` (nv 2000). **O mapa só põe no DOM os
marcadores da região aberta** — medido em 10/10/2026: Kanto tinha 227 marcadores, Outland 47,
Orre 72, e nenhum dos outros existia ao mesmo tempo.

Era por isso que mandar ir a uma caçada de outra região **não fazia nada**: a ferramenta esperava
doze segundos por um marcador que nunca ia existir e dizia "não achei no mapa". Agora, se a
caçada não está na região aberta, ela troca de placa e procura nas outras — uma troca só, a que
serve, porque clicar na região já aberta custaria a espera por um redesenho que não vem.

| no jogo | como o código vê |
|---|---|
| as abas de região | `.map-areas .map-plate`, com o nome no `alt` da imagem de dentro |
| a região aberta | classe `on` |
| a que o nível não destranca | classe `locked` — **clicável mesmo assim**: dá para olhar o mapa dela, não para viajar |
| trocar de região | ~1 s até os marcadores trocarem |

Região travada não reclama, só não te leva. Por isso, quando a caçada está numa delas, a resposta
é **"Shadow Lugia fica em Orre, que o seu nível ainda não destranca"** em vez de "cliquei e o
jogo diz Meowth".

Vale para as duas ferramentas que viajam: as Caçadas (Alt+W) e a volta dos Times — a caçada de
onde você saiu também pode ser de outra região.

## Arrumar os painéis (Alt+J)

**Cada um no seu canto** é o botão de fábrica. Os painéis são arrastáveis e o lugar sobrevive ao
F5 — o que é bom até o dia em que você arrasta um para cima do painel de captura do jogo e não
lembra mais onde ele estava. Antes disto, desfazer era abrir o `localStorage` à mão.

Os cantos não são gosto, são medida: ficam fora do HUD, da barra de cima, do chat e do painel de
captura do próprio jogo. Um painel **fechado** também é arrumado — na chave dele, para voltar no
lugar certo quando você o abrir.

**Mas o canto medido é um ponto de partida, não uma regra.** Arraste os painéis como quiser,
escreva um nome e clique em **💾 Guardar onde estão**: aquela arrumação entra na lista e volta num
clique em **✓ Aplicar** — ou em **Alt+Shift+J**, sem abrir nada. Dá para ter "dois monitores", "só o celular", "modo venda". O que se guarda
é onde os painéis **estão** — a tela manda sobre a chave, porque o arrasto só grava ao soltar e um
painel movido está onde se vê, não onde foi gravado.

Ao aplicar, a arrumação é **presa dentro da tela**. É o caso que faz uma arrumação viajar e dar
prejuízo: guardada num monitor de 1920, aplicada num portátil de 1280, o painel nasceria fora da
tela — e um painel fora da tela não se arrasta de volta.

### O atalho, e o modo minimizado

**Alt+Shift+J aplica a arrumação escolhida.** É a ação que se repete — outra janela, outro
monitor, um painel arrastado por engano —, e abrir um painel para clicar num botão é justamente o
que se quer evitar. Com o painel fechado ele usa a última arrumação que você aplicou; se nunca
aplicou nenhuma, a primeira da lista. Com o painel aberto, manda a que está escolhida na lista.

A resposta do atalho são os painéis a mexerem-se; a frase fica no status para quando você abrir o
painel. `Shift` está livre em todo o pacote e em toda a loja: a única extensão de "qualquer site",
o caderno de anotações, só reage a Alt+O e Alt+P.

**Minimizado (o `–` na barra) esconde tudo menos a lista e o Aplicar.** Minimizar é para ficar com
a ferramenta à mão, e a ferramenta aqui é voltar a uma arrumação — um painel compacto que
escondesse justamente isso só serviria aberto.

### Levar para as outras janelas

Você joga em várias janelas do mesmo jogo. Com a caixa **aplicar nas outras janelas abertas**
ligada (é o padrão), clicar em Aplicar arruma esta janela **e as outras, na hora, sem F5** — elas
partilham o `localStorage`, e o evento `storage` chega às outras janelas do mesmo site
imediatamente. A janela que recebe diz "Arrumação recebida de outra janela".

Para fora deste navegador — outro perfil, outra máquina — o caminho é texto: **Gerar** escreve o
código das suas arrumações na caixa (Ctrl+C copia), e **Aplicar código** lê um código colado e
junta as arrumações dele às suas. Importar dá opções, não muda a tela: quem acabou de colar um
código não pediu para os painéis saltarem. Código torto não apaga o que já havia, e só ids de
painel conhecidos e números finitos passam pela peneira.

Ele não guarda posição de ninguém: escreve na chave do módulo dono, *dentro* do que já está lá.
Escrever por cima apagaria os times guardados, e há um teste só para isso.

Esconder todos continua sendo do núcleo: **Alt+Z** some com tudo, **Alt+X** traz de volta o que
estava à vista. Dois donos para a mesma coisa discordam mais cedo ou mais tarde.

## Exportar tudo (menu Alt+Q)

O menu do pacote tem um botão **Exportar tudo**: ele escreve numa caixa de texto, em JSON, tudo o
que o pacote guardou nesta janela — loja, ciclo, caçadas, escada, agenda, arrumações, que
ferramentas estão ligadas, onde cada painel está. Copie com Ctrl+C.

**Os times ficam de fora**, de propósito. Um time é feito dos pokémon *daquela* conta; levado para
outra janela ele aponta para bichos que lá não existem.

Duas outras chaves também não saem, e por motivo diferente — não são configuração:

- **a vez** (`:vez`) é a fila a correr *agora*. Quem a levasse para uma janela nova entrava com a
  vez de outra já tomada, e **toda** automação ficaria à espera de alguém que não está lá;
- **o sinal do arrumar** (`:arrumar:sinal`) é um recado de uma janela para as outras, vale por
  instantes.

O que não tem o prefixo `lioncode:pokeidleworld:` nunca entra: nem a sessão do jogo, nem outras
extensões, nem o `lioncode:gym:tarefa`, que é tarefa a meio.

A varredura é **por prefixo, não por lista escrita à mão**. É o que faz uma ferramenta futura
entrar no código sozinha: lista à mão envelhece calada — a ferramenta nova guarda a chave dela,
ninguém se lembra de a juntar, e você descobre que perdeu a configuração quando já trocou de
janela.

O código sai para uma caixa à vista e não para a área de transferência: escrever nela pede
permissão do navegador, e dentro do LionMultInstance essa permissão não é garantida.

### Aplicar código

Ao lado fica **Aplicar código**: cole um código na caixa e ele grava essas definições nesta
janela. A caixa está sempre à vista — na 1.5.0 ela nascia escondida e só o Exportar a
abria, o que tornava o Aplicar inutilizável: a única forma de revelar onde colar era gerar o
próprio código por cima do que se queria colar. Corrigido na 1.5.1. A conta diz quantas entraram e quantas ficaram de fora.

**A peneira do aplicar é a mesma do exportar, e isso é de propósito.** O código colado não é de
confiança: pode vir de uma versão antiga que ainda exportava os times, de alguém que o editou à
mão, ou de outro pacote. Confiar em que "o exportar já tirou" seria confiar em software que não
está a correr aqui. Então, ao entrar, também se recusa:

- os **times** — os seus não são substituídos, nem que o código traga uns;
- a **vez** e o **sinal do arrumar**;
- tudo sem o prefixo do pacote — um código com a sessão do jogo lá dentro não escreve nada;
- valor que não seja texto, ou que não seja JSON válido: nenhuma ferramenta o leria, e gravá-lo
  deixaria lixo no armazenamento com cara de configuração.

Aceita tanto o objeto inteiro do exportar como só o mapa de chaves — quem cola texto cola o que
tem à mão.

**Só vale depois do F5**, e o botão diz isso com um *recarregar agora* ao lado. As ferramentas leem
o armazenamento quando montam; prometer efeito imediato seria mentir, e você colaria o código
outra vez a achar que não entrou. É a mesma saída que desligar uma ferramenta já usa, pela mesma
razão.

Importar é ganhar definições, não trocar a janela por outra: o que já estava lá e o código não
mencionou fica intacto.

## A Nurse Joy, e por que ela é de todos

**Equipe caída não caça, não viaja e o jogo não diz nada.** Ele põe um aviso na tela e
simplesmente não te move. Por isso a cura deixou de ser um detalhe dos Times e virou uma porta
que o pacote inteiro usa:

| quando | o que acontece |
|---|---|
| alguém cai no meio da caçada | os Times saem da caçada, passam na Joy e **te devolvem para lá** |
| antes de trocar o time | cura antes de mexer no Depósito, e de novo no fim (quem vem do Box pode vir caído) |
| antes de viajar (Alt+W, Escada) | cura antes de tentar, em vez de descobrir pelo aviso do jogo |
| no ciclo da loja (Alt+K) | a Joy fica no caminho: ao chegar em Cerulean, passa nela |

A vigia é a caixa **"curar na Joy quando a equipe cair"**, no painel dos Times (Alt+T), **ligada
por padrão** — ao contrário de "manter a ordem", curar não desfaz nada e não custa nada. Ela só
age na *mudança* (o HUD bate várias vezes por segundo), nunca com a aba escondida (o motor do
jogo para e as placas dos NPC somem) e nunca com o Depósito aberto, porque ali a janela está na
frente do NPC e quem a abriu foi você.

**Quem diz se curou é a barra de vida, não o clique no botão.** Se a Joy responder e a equipe
continuar caída, ela diz isso em vez de mandar viajar e deixar o jogo recusar em silêncio.

Internamente são duas portas, e a diferença importa: `curar()` pede a vez e viaja; `curarAqui()`
não faz nem uma coisa nem outra, e é a que o Ciclo usa — ele já segura a vez desde o início da
ida ao mercado, e pedir de novo seria ficar à espera de si próprio.

## Caçadas (Alt+W)

Lista todas as caçadas publicadas pelo jogo — inclusive as de Outland, Orre e Nightmare antes de
a conta destrancar essas regiões. A busca aceita nome, nível ou região; cada linha mostra o nível
e a região, e avisa quando ela ainda está trancada. A lista é renovada automaticamente uma vez
por dia, e o botão **↻** força uma atualização na hora.

**📌 Guardar onde estou** acrescenta a atual às favoritas. Nas demais linhas, **+** guarda a
caçada; nas favoritas, **×** tira da lista. **▶ Ir** continua levando até ela num clique. O modo
minimizado mostra somente as favoritas, para continuar servindo como a antiga lista de atalhos.

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

## Escada de caçadas (Alt+B esconde · Alt+N mostra)

Um degrau é *"a partir do nível N, caçar em tal lugar"*. Monte a escada, ligue a caixa, e ela
troca de caçada sozinha conforme o líder sobe.

### Escolha automática por tipo e pool de times

Marque **escolher hunt automaticamente pelo tipo** para trocar o nome fixo de cada degrau por
duas faixas de nível:

```
Pokémon chega ao Lv 30  → procurar uma hunt Lv 20
Pokémon chega ao Lv 180 → procurar uma hunt Lv 150
```

A ferramenta procura no catálogo completo uma hunt daquele nível que esteja destrancada. Primeiro
prioriza uma em que o tipo do líder cause dano super-efetivo; se não houver, aceita dano neutro.
Hunts em que o ataque fique resistido ou imune são excluídas. Ela também olha a direção contrária:
se **todas** as hunts daquele nível tiverem vantagem contra o líder, permanece na hunt atual,
marca aquele degrau como avaliado e só tenta escolher novamente no próximo marco da escada. A
tabela de tipos das 451 hunts
fica dentro da própria extensão, portanto a decisão não depende de internet ou de uma API externa
durante o treino.

No mesmo modo aparecem os **times da pool para upar**. Marque quantos times guardados quiser e
defina **Formar no Lv** como level cap. A escada monta o primeiro time, sobe cada Pokémon da equipe
até o cap, monta o próximo time marcado e recomeça a escada com o nível do novo líder. Só considera
a pool concluída quando todos os Pokémon de todos os times escolhidos alcançarem o cap.

O modo manual anterior continua disponível: desmarque a escolha automática e cada degrau volta a
usar uma hunt fixa e o seletor único de time.

O botão **⏸ Pausar** congela a automação sem perder o aluno, o degrau aplicado nem o time atual da
pool. **▶ Retomar** continua exatamente desse ponto. Isso é diferente de **Parar/Iniciar**, que
reinicia a avaliação do degrau atual.

Ao minimizar, a Escada mostra somente estado, líder, local, cap e progresso da pool; degraus e
configurações somem. O painel Caçadas também deixa de listar hunts e mostra apenas local, total do
catálogo e quantidade de favoritas.

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

### Formatura: subir a equipe inteira, um de cada vez

Uma escada leva **um** pokémon do Lv 1 ao topo. A formatura é o que acontece depois: escreva um
**teto** e a escada deixa de parar no degrau mais alto.

```
Formar no Lv [60]
parar em "Cerulean"

Gloom 13 · Charizard 263 ✔ · Squirtle 134 ✔ · Graveler 55 · Venusaur 1 · Bellsprout 1
```

1. O líder chega ao teto → ele **se forma** e sai da fila.
2. O próximo da equipe vai para a frente e a escada **recomeça nele**, do degrau do nível *dele*.
3. Quem já está no teto ou acima é **saltado** — no exemplo, depois do Gloom vem o Graveler, não
   o Charizard.
4. Quando todos passaram do teto, a caçada **para**: ela te leva ao lugar escolhido e fica quieta.

O farm nunca para no meio: entre um aluno e o outro só há um clique. E o quadro de nomes embaixo
do teto diz, a qualquer momento, quem já se formou (`✔`) e quem ainda está na fila.

**Trocar de líder é um clique no pokémon, na caixa do HUD** — não precisa de Depósito nenhum.
Mesmo assim a ferramenta **não acredita no próprio clique**: depois de clicar ela relê o HUD, e
se quem ficou na frente não for quem ela queria, ela diz isso e **não viaja**. Viajar com o aluno
errado na frente seria pôr o Lv 1 na caçada do Lv 60.

**Deixar o teto em branco desliga a formatura** e a escada volta a ser o que era: o líder sobe
até o degrau mais alto e fica lá. Sair da cidade à mão depois de todos formados também é seu
direito — ela leva uma vez e larga, igual ao degrau cumprido.

### O ▸ de cada degrau

Cada linha tem um **▸** ao lado do `×`: vai agora para **aquela** caçada. O que se quer à mão não
é "o degrau do meu nível", é a caçada que você está olhando — por isso o botão mora na linha, e
não embaixo do painel.

Funciona com a escada desligada, e **ir à mão não te faz ser arrastado de volta**: ela marca o
degrau do seu nível como cumprido, senão na primeira batida do HUD ela te traria de volta por
cima do que você acabou de pedir. Se você já está lá, ela diz isso em vez de viajar.

**Quem viaja são as Caçadas (Alt+W).** Esta ferramenta só decide *quando* e *com quem*; a viagem,
a montagem do time e a passagem pela Nurse Joy vêm de lá de graça. Sem as Caçadas ligadas
ela diz isso em vez de tentar. O campo de cada degrau pesquisa no catálogo completo das Caçadas
e mostra nível, região e bloqueio nas sugestões — não é mais preciso entrar numa hunt e salvá-la
antes de montar a escada.

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
- **Trocar quem está subindo é um clique na caixa do pokémon no HUD** — medido em 10/10/2026, e é
  o que dispensa o Depósito inteiro na formatura. As caixas são `BUTTON`, e o jogo diz tudo
  sozinho:
  - quem está subindo leva a classe **`active`** e o `title` **"Gloom (ativo)"**; os outros dizem
    **"Selecionar Charizard"**;
  - clicar **põe o escolhido na frente** e empurra os outros, mantendo a ordem relativa deles;
  - a troca leva **571 ms** a aparecer no HUD. Por isso a ferramenta espreita de 150 em 150 ms
    até 3 s, em vez de dormir um número fixo e arriscar dizer "não troquei" depois de ter
    trocado;
  - depois de uma troca, as outras caixas passam **5 segundos** dizendo "Troca disponível em 5s",
    e **um clique dentro dessa janela é recusado em silêncio** — sem erro, sem aviso, sem nada.
    Essa espera não é tratada como falha: a ferramenta nem clica, diz quantos segundos faltam e
    volta a tentar logo, em vez de ficar os dois minutos de castigo parada.

  Ela lê a classe `active` em vez de olhar o lugar na fila. Hoje dá no mesmo, porque o ativo é
  sempre o primeiro; mas quem diz quem está subindo é o jogo, não a dedução desta ferramenta.
  E ela confere o HUD **depois** do clique: se quem ficou à frente não for quem ela queria, ela
  diz e não viaja.
- **Ela pede a vez só para o clique.** Quem viaja é `PPX.cacadas.ir`, que pede a dele, e a fila só
  é reentrante para o mesmo dono — segurar a vez durante a viagem deixaria a viagem esperando por
  quem está esperando por ela. Mas o clique no HUD é uma ação dela no jogo, e toda ação passa pela
  fila: ela pega a vez, clica, solta, e só então manda viajar.
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
