// Captura automatica: lanca a pokebola assim que aparece um selvagem.
//
// Por que isto existe, e nao um auto-click: medido na conta real em 09/10/2026, com o painel de
// captura aberto.
//
//  - O jogo trava o botao por ~4,4 s depois de cada lancamento. Um auto-click por tempo erra dos
//    dois lados: rapido demais bate em botao travado, devagar demais perde selvagem.
//  - Entre um selvagem e outro ha buracos. O auto-click clica no vazio; aqui so se clica quando
//    existe alvo.
//  - A lista cresce e encolhe (ja' vi de 0 a 4 linhas). Clique por coordenada acerta a linha
//    errada quando a lista muda de tamanho.
//
PPX.modulo(
  { id: 'captura', nome: 'Captura automática', atalhos: 'Alt+C liga · Alt+V desliga' },
  () => {
    const CHAVE = 'lioncode:pokeidleworld:captura';
    const MINHA_VEZ = 'captura';

    // Guarda contra martelo: o observador dispara centenas de vezes por segundo (o chat do jogo
    // sozinho ja' muda o DOM sem parar). Isto nao e' o tempo de espera do jogo — esse quem diz e'
    // o proprio botao — e' so' o piso entre duas tentativas nossas.
    const PAUSA_MINIMA = 250;

    let ativo = false;
    try {
      ativo = localStorage.getItem(CHAVE) === '1';
    } catch (e) {
      ativo = false;
    }

    let lancando = false;
    let ultimo = 0;

    /**
     * O tempo de espera do jogo e' lido do proprio botao, nunca cronometrado por nos: quando ele
     * esta' travado vem `disabled` e o texto conta para tras ("⏳ 4s"). Se amanha o jogo mudar
     * esse tempo, ou o VIP o encurtar, a ferramenta acompanha sem tocar neste arquivo.
     */
    const botaoLivre = () => {
      const b = document.querySelector('.cap-row button.cap-throw');
      return b && !b.disabled ? b : null;
    };

    /** O saldo do tipo de bola selecionado — o chip com `on`. */
    const bolas = () => {
      const n =
        document.querySelector('.cap-chip.on .cap-chip-n') ||
        document.querySelector('.cap-chip-n');
      if (!n) return null;
      const v = parseInt(String(n.textContent || '').replace(/\D/g, ''), 10);
      return Number.isFinite(v) ? v : null;
    };

    const aviso = (texto) => {
      const caixa = document.createElement('div');
      caixa.textContent = texto;
      caixa.style.cssText =
        'position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:2147483647;' +
        'background:#11151dE0;color:#e6e9ef;font:13px system-ui,sans-serif;padding:8px 14px;' +
        'opacity:.88;border:1px solid #3a4152;border-radius:8px;pointer-events:none';
      document.body.appendChild(caixa);
      setTimeout(() => caixa.remove(), 1600);
    };

    /**
     * A vez e' pedida no instante do lancamento e solta logo em seguida, em vez de ficar presa
     * enquanto a captura esta' ligada. Esta ferramenta fica ligada horas: segurar a fila todo esse
     * tempo trancaria para sempre qualquer automacao que venha depois.
     */
    // Tempo de reacao. Lancar a pokebola no mesmo instante em que o selvagem aparece e' a coisa
    // menos humana que esta ferramenta faz, e a mais facil de ver de fora.
    //
    // **So' com a aba a' vista**, e isto nao e' preguica: em segundo plano o Chrome estrangula
    // `setTimeout` para uma vez por minuto — a mesma razao pela qual o motor daqui e' um
    // observador. Esperar ali trocaria uma captura discreta por uma captura que nao acontece. E
    // numa janela escondida nao ha' ninguem a ver o compasso.
    const REACAO = 420;
    const visivel = () => document.visibilityState === 'visible';
    const esperar = (ms) =>
      globalThis.PPX?.pausa ? globalThis.PPX.pausa(ms) : new Promise((r) => setTimeout(r, ms));
    const reagir = () => (visivel() ? esperar(REACAO) : Promise.resolve());

    const esperarAVez = async () => {
      const vez = globalThis.PPX?.vez;
      // Nucleo antigo, sem fila: segue como seguia antes, em vez de nao funcionar.
      if (!vez?.pedir) return () => {};
      return vez.pedir(MINHA_VEZ);
    };

    async function tentar() {
      if (!ativo || lancando) return;
      if (Date.now() - ultimo < PAUSA_MINIMA) return;
      if (!botaoLivre()) return;

      if (bolas() === 0) {
        ligar(false);
        aviso('Sem pokébolas: captura desligada.');
        return;
      }

      lancando = true;
      let soltar = null;
      try {
        soltar = await esperarAVez();
        if (!soltar) return;
        await reagir();
        // Entre pedir a vez e recebe-la o selvagem pode ter fugido ou o botao ter travado de
        // novo: quem decide e' o estado de agora, nao o de quando se pediu.
        const b = botaoLivre();
        if (b) {
          ultimo = Date.now();
          b.click();
        }
      } finally {
        if (soltar) soltar();
        lancando = false;
      }
    }

    // O observador e' o motor, e nao um temporizador, por uma razao medida: com a aba em segundo
    // plano o Chrome estrangula `setInterval` para uma vez por minuto — e o utilizador joga em
    // nove janelas, quase todas escondidas. Mutacao de DOM continua chegando normalmente, e foi
    // confirmado que o painel e o botao sobrevivem no modo carta.
    let agendado = false;
    const agendar = () => {
      if (agendado) return;
      agendado = true;
      // Microtarefa, nao `setTimeout`: temporizador e' justamente o que o navegador estrangula
      // em segundo plano, e este agendamento tem de valer tambem nas janelas escondidas.
      Promise.resolve().then(() => {
        agendado = false;
        tentar();
      });
    };

    const observador = new MutationObserver(agendar);
    observador.observe(document.body, { childList: true, subtree: true });

    // Rede de seguranca: se por algum motivo nenhuma mutacao chegar, isto ainda tenta de vez em
    // quando. Em segundo plano vira uma vez por minuto — e' pouco, mas e' melhor que nada, e o
    // observador e' quem faz o trabalho de verdade.
    setInterval(agendar, 3000);

    function ligar(sim) {
      ativo = sim === true;
      try {
        localStorage.setItem(CHAVE, ativo ? '1' : '0');
      } catch (err) {
        /* janela sem armazenamento: vale so para esta sessao */
      }
      globalThis.PPX?.anotar?.('captura', ativo);
      if (ativo) agendar();
    }

    addEventListener(
      'keydown',
      (e) => {
        if (!e.altKey || e.ctrlKey || e.shiftKey) return;
        const tecla = e.key.toLowerCase();
        if (tecla !== 'c' && tecla !== 'v') return;
        // Campo de texto nao dispara atalho: o jogo tem chat, e um "c" ali nao e' um comando.
        const alvo = e.target;
        if (alvo && (alvo.isContentEditable || /^(input|textarea|select)$/i.test(alvo.tagName)))
          return;
        e.preventDefault();
        e.stopPropagation();
        ligar(tecla === 'c');
        aviso(ativo ? 'Captura automática ligada (Alt+C)' : 'Captura automática desligada (Alt+V)');
      },
      true,
    );

    // Diz ao menu em que estado se esta', e passa a aceitar as ordens dele.
    globalThis.PPX?.anotar?.('captura', ativo);
    globalThis.PPX?.controlar?.('captura', (sim) => ligar(sim));

    if (ativo) agendar();
  },
);
