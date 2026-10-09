# Poke Idle World — qualidade de vida

Extensão de navegador para o [Poke Idle World](https://poke.idleworld.online). Por enquanto tem
uma ferramenta só: **captura automática**.

| ferramenta | o que faz | atalhos |
| --- | --- | --- |
| Captura automática | lança a pokébola assim que aparece um selvagem | Alt+C liga · Alt+V desliga |

**Alt+Q** abre o menu, que liga e desliga a ferramenta sem precisar do atalho.

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
