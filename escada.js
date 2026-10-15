// Escada de caçadas: troca de caçada sozinha quando o líder sobe de nível.
//
// DOIS NIVEIS, E ELES NAO SAO A MESMA COISA. Medido em 10/10/2026:
//
//  - `.phud-tloc` da' o nivel do **treinador** ("Nível 270 · Persian"). E' ele que destranca as
//    caçadas: o `onClick` do marcador do mapa compara o nivel do jogador com o `level` da caçada
//    e recusa com um aviso se for menor.
//  - `.phud-mon .phud-lv` da' o nivel de **cada pokemon** da equipe ("Lv.263"). Nao destranca
//    nada; e' o que se esta' a subir.
//
// Esta ferramenta olha o **primeiro da equipe** — o lider, o do ⚔. Foi a escolha do dono da
// conta, e ela casa com a caixa "manter a ordem" dos Times: quem escolhe a ordem escolhe o
// lider, e o lider passa a ser o medidor.
//
// O GATILHO E' UM OBSERVADOR, NAO UM RELOGIO. Com a aba em segundo plano o `setInterval` cai
// para uma volta por minuto — e o motor do jogo para de rodar de qualquer forma. O HUD, que e'
// DOM, avisa quando muda; e' assim que a captura automatica tambem funciona.
//
// E ELA NAO PEDE A VEZ. Quem viaja e' `PPX.cacadas.ir`, que pede a vez dele — e a fila so' e'
// reentrante para o mesmo dono. Segurar a vez aqui deixaria a viagem a' espera de quem esta' a'
// espera dela, parada ate' o prazo acabar. A mesma armadilha ja' custou uma tarde nos Times.
//
PPX.modulo(
  {
    id: 'escada',
    nome: 'Escada de caçadas',
    atalhos: 'Alt+B esconde · Alt+N mostra',
    proprio: true,
  },
  () => {
    'use strict';

    const CHAVE = 'lioncode:pokeidleworld:escada';

    /** Quanto se espera antes de tentar de novo, depois de uma viagem que nao deu certo. */
    const CASTIGO = 120000;

    // --------------------------------------------------------------- o que se guarda

    const PADRAO = {
      // `[{ nivel, cacada }]`, sempre ordenados por nivel.
      degraus: [],
      // A escada esta' a correr. E' o botao Iniciar/Parar, e manda em tudo: parada, ela nao
      // forma ninguem nem olha para degrau nenhum.
      ligada: false,
      // Pausar nao e' parar: preserva aluno, degrau aplicado e andamento da pool.
      pausada: false,
      // Licenca para MUDAR DE CAÇADA sozinha. E' uma pergunta diferente de `ligada`: a escada
      // pode estar a correr — a formar o aluno, a dizer em que degrau ele deveria estar — sem
      // ter licenca para o arrastar para outro mapa. Nasce dada, que e' o que ela sempre fez,
      // e por isso quem ja' tinha a ferramenta nao ve' nada mudar.
      trocar: true,
      // O nivel do degrau que ja' foi aplicado. Sem isto, cada batida do HUD mandaria viajar
      // para o mesmo lugar outra vez.
      aplicado: null,
      // O nivel em que um pokemon se forma e sai da fila. `null` = sem formatura: a escada acaba
      // no degrau mais alto e o lider fica la', que e' como ela nasceu.
      teto: null,
      // Para onde ir quando a equipe inteira estiver formada. Vazio = fica onde estiver.
      destino: '',
      // Ja' levou a equipe formada para o destino. Serve para nao a arrastar de volta se o dono
      // sair de la' a' mao — a mesma regra do `aplicado`.
      formados: false,
      // De quem e' esta escada. O degrau cumprido e' a historia de UM aluno: trocar de pokemon
      // recomeça a contagem, e enquanto o aluno e' o mesmo a escada nunca desce.
      aluno: '',
      // No modo automatico o degrau guarda o nivel da hunt, e nao um nome fixo. A escolha e'
      // refeita para cada aluno conforme o tipo dele.
      automatico: false,
      // Times marcados formam uma fila maior do que os seis lugares da equipe.
      pool: [],
      timeAtivo: '',
      timesConcluidos: [],
      pos: null,
      compacto: false,
    };
    let cfg = { ...PADRAO };
    try {
      const cru = localStorage.getItem(CHAVE);
      if (cru) cfg = { ...cfg, ...JSON.parse(cru) };
    } catch {
      /* fica o padrao: escada vazia e desligada */
    }
    if (!Array.isArray(cfg.degraus)) cfg.degraus = [];
    if (!Array.isArray(cfg.pool)) cfg.pool = [];
    if (!Array.isArray(cfg.timesConcluidos)) cfg.timesConcluidos = [];
    const gravar = () => {
      try {
        localStorage.setItem(CHAVE, JSON.stringify(cfg));
      } catch {
        /* janela sem armazenamento: vale so' para esta sessao */
      }
    };

    const ordenar = () => cfg.degraus.sort((a, b) => a.nivel - b.nivel);

    // --------------------------------------------------------------- ler o jogo

    /**
     * O nivel do primeiro da equipe, ou null se o HUD ainda nao esta' na tela.
     *
     * `null` e' diferente de zero e tem de continuar a ser: um HUD que ainda nao carregou nao e'
     * um lider de nivel 1, e tratar os dois como a mesma coisa faria a escada disparar o degrau
     * mais baixo a cada recarga da pagina.
     */
    const numero = (txt) => {
      const n = String(txt || '').match(/(\d+)/);
      return n ? Number(n[1]) : null;
    };

    /**
     * A caixa do pokemon que esta' a subir.
     *
     * Medido em 10/10/2026: o jogo marca-a com a classe `active` e com o `title` "Nome (ativo)",
     * **e** po-e sempre na frente da fila quem acaba de ser escolhido. Dao no mesmo hoje; le-se a
     * classe porque e' o jogo a dizer quem e', e nao esta ferramenta a deduzir pela posicao.
     */
    const caixaDoLider = () =>
      document.querySelector('.phud-mon.active') || document.querySelector('.phud-mon');

    const nivelLider = () => numero(caixaDoLider()?.querySelector('.phud-lv')?.textContent);

    /** O nome do pokemon que esta' a subir, para as mensagens dizerem de quem se fala. */
    const nomeLider = () =>
      (caixaDoLider()?.querySelector('.phud-name')?.textContent || '').trim();

    /**
     * Quanto falta, em ms, ate' o jogo deixar trocar de pokemon outra vez.
     *
     * Depois de uma troca, todas as outras caixas passam 5 s com o `title` "Troca disponível em
     * 5s" — e **um clique dentro dessa janela e' recusado em silencio**, sem aviso nenhum. Foi
     * medido: clicar ali nao muda o ativo e nao acontece mais nada.
     */
    const esperaDaCaixa = (el) => {
      const s = numero((el?.getAttribute?.('title') || '').match(/dispon[ií]vel em\s*(\d+)/i)?.[1]);
      return s === null ? 0 : s * 1000;
    };

    /**
     * A equipe inteira na ordem do HUD, que e' a ordem da equipe: o primeiro e' o lider.
     *
     * Cada entrada traz o proprio elemento porque e' nele que se clica para trocar de lider —
     * **clicar no pokemon na caixa do lado po-e na frente**, dito pelo dono da conta. Isso
     * dispensa o Deposito inteiro: nao ha' nada para tirar nem para por, so' um clique.
     */
    const equipe = () =>
      [...document.querySelectorAll('.phud-mon')].map((el, i) => ({
        el,
        i,
        nome: (el.querySelector('.phud-name')?.textContent || '').trim(),
        nivel: numero(el.querySelector('.phud-lv')?.textContent),
        ativo: el.classList?.contains?.('active') === true,
        espera: esperaDaCaixa(el),
        tipos: [...el.querySelectorAll?.('img[alt]') || []]
          .map((img) => String(img.alt || '').toUpperCase())
          .filter((t) => TIPOS.has(t)),
      }));

    const TIPOS = new Set([
      'NORMAL', 'FIRE', 'WATER', 'ELECTRIC', 'GRASS', 'ICE', 'FIGHTING', 'POISON',
      'GROUND', 'FLYING', 'PSYCHIC', 'BUG', 'ROCK', 'GHOST', 'DRAGON', 'DARK', 'STEEL', 'FAIRY',
    ]);
    const FORTE = {
      FIRE: ['GRASS', 'ICE', 'BUG', 'STEEL'], WATER: ['FIRE', 'GROUND', 'ROCK'],
      ELECTRIC: ['WATER', 'FLYING'], GRASS: ['WATER', 'GROUND', 'ROCK'],
      ICE: ['GRASS', 'GROUND', 'FLYING', 'DRAGON'], FIGHTING: ['NORMAL', 'ICE', 'ROCK', 'DARK', 'STEEL'],
      POISON: ['GRASS', 'FAIRY'], GROUND: ['FIRE', 'ELECTRIC', 'POISON', 'ROCK', 'STEEL'],
      FLYING: ['GRASS', 'FIGHTING', 'BUG'], PSYCHIC: ['FIGHTING', 'POISON'],
      BUG: ['GRASS', 'PSYCHIC', 'DARK'], ROCK: ['FIRE', 'ICE', 'FLYING', 'BUG'],
      GHOST: ['PSYCHIC', 'GHOST'], DRAGON: ['DRAGON'], DARK: ['PSYCHIC', 'GHOST'],
      STEEL: ['ICE', 'ROCK', 'FAIRY'], FAIRY: ['FIGHTING', 'DRAGON', 'DARK'],
    };
    const FRACO = {
      NORMAL: ['ROCK', 'STEEL'], FIRE: ['FIRE', 'WATER', 'ROCK', 'DRAGON'],
      WATER: ['WATER', 'GRASS', 'DRAGON'], ELECTRIC: ['ELECTRIC', 'GRASS', 'DRAGON'],
      GRASS: ['FIRE', 'GRASS', 'POISON', 'FLYING', 'BUG', 'DRAGON', 'STEEL'],
      ICE: ['FIRE', 'WATER', 'ICE', 'STEEL'], FIGHTING: ['POISON', 'FLYING', 'PSYCHIC', 'BUG', 'FAIRY'],
      POISON: ['POISON', 'GROUND', 'ROCK', 'GHOST'], GROUND: ['GRASS', 'BUG'],
      FLYING: ['ELECTRIC', 'ROCK', 'STEEL'], PSYCHIC: ['PSYCHIC', 'STEEL'],
      BUG: ['FIRE', 'FIGHTING', 'POISON', 'FLYING', 'GHOST', 'STEEL', 'FAIRY'],
      ROCK: ['FIGHTING', 'GROUND', 'STEEL'], GHOST: ['DARK'], DRAGON: ['STEEL'],
      DARK: ['FIGHTING', 'DARK', 'FAIRY'], STEEL: ['FIRE', 'WATER', 'ELECTRIC', 'STEEL'],
      FAIRY: ['FIRE', 'POISON', 'STEEL'],
    };
    const IMUNE = { NORMAL: ['GHOST'], ELECTRIC: ['GROUND'], FIGHTING: ['GHOST'], POISON: ['STEEL'], GROUND: ['FLYING'], PSYCHIC: ['DARK'], GHOST: ['NORMAL'], DRAGON: ['FAIRY'] };
    const multiplicador = (ataque, defesas) => defesas.reduce((m, defesa) =>
      m * (IMUNE[ataque]?.includes(defesa) ? 0 : FORTE[ataque]?.includes(defesa) ? 2 : FRACO[ataque]?.includes(defesa) ? 0.5 : 1), 1);
    const escolherHunt = (degrau, tipos) => {
      const nivel = Number(degrau?.nivelHunt || 0);
      if (!nivel || !tipos?.length) return null;
      const doNivel = (globalThis.PPX?.cacadas?.todas?.() || [])
        .filter((h) => h.nivel === nivel && !h.trancada && h.tipos?.length)
        .map((h) => ({
          ...h,
          vantagem: Math.max(...tipos.map((t) => multiplicador(t, h.tipos))),
          perigo: Math.max(...h.tipos.map((t) => multiplicador(t, tipos))),
        }));
      const candidatas = doNivel
        .filter((h) => h.vantagem >= 1 && h.perigo <= 1)
        .sort((a, b) => b.vantagem - a.vantagem || a.nome.localeCompare(b.nome));
      if (candidatas[0]) return candidatas[0];
      if (doNivel.length && doNivel.every((h) => h.perigo > 1))
        return { nome: '', semSegura: true, nivel };
      return null;
    };

    /** Formado = chegou ao teto. Sem teto ninguem se forma, e a escada e' a de sempre. */
    const formado = (p) => Boolean(cfg.teto) && p.nivel !== null && p.nivel >= cfg.teto;

    /**
     * Quem deveria estar a subir agora: o **primeiro da equipe que ainda nao se formou**.
     *
     * Em ordem de equipe, e nao o mais baixo: a lista e' a ordem que o dono montou, e pular para
     * o menor seria inventar uma prioridade que ninguem pediu. Quem ja' passou do teto e'
     * saltado — era a regra pedida, "se o proximo for igual ou maior, pega o outro".
     *
     * `null` significa duas coisas bem diferentes conforme a equipe: se ha' pokemon no HUD, e'
     * que **todos se formaram**; se o HUD esta' vazio, e' que ainda nao se leu nada.
     */
    const proximoAluno = () => equipe().find((p) => p.nivel !== null && !formado(p)) || null;

    /** "Nível 270 · Persian" -> "Persian". */
    const local = () => {
      const t = document.querySelector('.phud-tloc')?.textContent || '';
      const p = t.split('·');
      return p.length > 1 ? p[p.length - 1].trim() : '';
    };

    /**
     * O degrau em que um lider de nivel `n` deveria estar: o mais alto que ele ja' alcancou.
     *
     * Nao e' "o degrau que acabou de passar" — e' o estado certo para aquele nivel. A diferenca
     * aparece ao ligar a escada com o lider ja' no Lv 80: o certo e' ir para o degrau de 80, e
     * nao ficar a' espera de passar pelo de 20.
     */
    const degrauPara = (n) => {
      if (n === null) return null;
      let achado = null;
      for (const d of cfg.degraus) if (d.nivel <= n && (!achado || d.nivel > achado.nivel)) achado = d;
      return achado;
    };

    /**
     * Em que nivel nasce o proximo degrau que se acrescentar.
     *
     * O primeiro nasce no **Lv 1**, e nao num numero redondo: uma escada cujo degrau mais baixo
     * esta' acima do lider nao faz nada, e foi assim que ela passou a primeira noite parada. Os
     * seguintes sobem de dez em dez, que e' so' um palpite para encurtar cliques.
     */
    const nivelDoProximo = () =>
      cfg.degraus.length ? cfg.degraus.reduce((m, d) => Math.max(m, d.nivel), 0) + 10 : 1;

    /** O degrau mais baixo da escada, que e' o unico que o jogador talvez ainda nao tenha. */
    const primeiroDegrau = () =>
      cfg.degraus.reduce((m, d) => (!m || d.nivel < m.nivel ? d : m), null);

    const alvoDoDegrau = (degrau) => {
      if (!degrau) return null;
      if (!cfg.automatico) return degrau.cacada ? { nome: degrau.cacada, vantagem: null } : null;
      return escolherHunt(degrau, equipe().find((p) => p.ativo)?.tipos || equipe()[0]?.tipos || []);
    };

    /**
     * Uma frase que explica a decisao de agora — mesmo quando a decisao e' nao fazer nada.
     *
     * Isto nasceu de a escada ficar parada sem dizer porque: o lider estava no Lv 1 e o degrau
     * mais baixo era o Lv 5, entao nao havia degrau nenhum para aplicar. A regra estava certa e
     * o silencio estava errado — uma automacao que nao age tem de dizer **o que** esta' a
     * esperar, senao e' indistinguivel de uma que quebrou.
     */
    function diagnostico() {
      if (!cfg.ligada) return 'Parada. Não faço nada sozinha — mas o "Ir agora" funciona.';
      if (cfg.pausada) return 'Pausada. Retome para continuar exatamente do mesmo ponto.';
      if (!cfg.degraus.length) return 'Sem degraus. Um degrau é "a partir do nível N, caçar aqui".';

      const n = nivelLider();
      if (n === null) return 'Ainda não li o nível do líder.';
      const quem = nomeLider() || 'o líder';

      // A formatura vem antes do degrau: quem chegou ao teto ja' nao e' o aluno, e dizer em que
      // degrau ele esta' seria responder a pergunta errada.
      if (cfg.teto) {
        const time = equipe();
        const aluno = proximoAluno();
        if (time.length && !aluno) {
          const todos = `A equipe toda chegou ao Lv ${cfg.teto}.`;
          if (!cfg.destino) return `${todos} Escolha para onde ir e eu paro a caçada lá.`;
          if (local() === cfg.destino) return `${todos} Parei a caçada em "${cfg.destino}".`;
          if (cfg.trocar !== true)
            return `${todos} Iria parar em "${cfg.destino}", mas não tenho licença para trocar de caçada.`;
          return `${todos} Falta ir para "${cfg.destino}".`;
        }
        if (aluno && aluno.i > 0)
          return (
            `${quem} Lv ${n} já se formou (teto Lv ${cfg.teto}). ` +
            `O próximo é ${aluno.nome} Lv ${aluno.nivel} — falta pô-lo na frente.`
          );
      }

      const degrau = degrauPara(n);
      if (!degrau) {
        const base = primeiroDegrau();
        return (
          `${quem} está no Lv ${n}, abaixo do primeiro degrau (Lv ${base.nivel}). ` +
          'Ponha um degrau em Lv 1 para começar já.'
        );
      }
      const alvo = alvoDoDegrau(degrau);
      if (alvo?.semSegura)
        return `${quem} Lv ${n}: todas as hunts Lv ${alvo.nivel} têm vantagem contra ele. Fico em "${local() || 'onde está'}" até o próximo marco.`;
      if (!alvo)
        return cfg.automatico
          ? `Lv ${n}: não achei hunt Lv ${degrau.nivelHunt || '?'} neutra ou vantajosa para ${quem}.`
          : `Lv ${n}: o degrau de Lv ${degrau.nivel} não tem caçada escolhida.`;
      if (local() === alvo.nome) return `${quem} Lv ${n}: em "${alvo.nome}", como manda o degrau de Lv ${degrau.nivel}.`;
      if (cfg.aplicado !== null && degrau.nivel < cfg.aplicado)
        return (
          `${quem} Lv ${n}: o degrau de Lv ${degrau.nivel} está abaixo do de Lv ${cfg.aplicado}, ` +
          'que já cumpri com ele. Não desço com o mesmo aluno.'
        );
      if (degrau.nivel === cfg.aplicado)
        return `${quem} Lv ${n}: degrau de Lv ${degrau.nivel} já cumprido. Você saiu de "${alvo.nome}" — fique à vontade.`;
      if (cfg.trocar !== true)
        return `${quem} Lv ${n}: iria para "${alvo.nome}", mas não tenho licença para trocar de caçada. Use o ▸.`;
      return `${quem} Lv ${n}: falta ir para "${alvo.nome}"${alvo.vantagem > 1 ? ' (vantagem de tipo)' : ' (dano neutro)'}.`;
    }

    // --------------------------------------------------------------- o motor

    let correndo = false;
    let esperaAte = 0;
    /** O ultimo nivel lido. So' se faz contas quando ele muda: o HUD bate a cada ponto de vida. */
    let visto = null;

    /**
     * Quanto se espera pela troca aparecer no HUD, e de quanto em quanto se olha.
     *
     * Medido: a troca levou 571 ms a aparecer. Um numero fixo seria ou curto de mais (e a
     * ferramenta diria "nao troquei" depois de ter trocado) ou lento de mais para todos os
     * casos. Por isso espreita-se de 150 em 150 ms e desiste-se aos 3 s.
     */
    const ATE_TROCAR = 3000;
    const ESPREITA = 150;
    const esperar = (ms) => globalThis.PPX?.pausa?.(ms) ?? new Promise((r) => setTimeout(r, ms));

    /**
     * Pede a vez — e so' para o clique.
     *
     * A escada, de resto, nao pede a vez: quem viaja e' `PPX.cacadas.ir`, que pede a dele, e a
     * fila so' e' reentrante para o mesmo dono. Aqui e' diferente porque **o clique no HUD e'
     * uma acao no jogo feita por esta ferramenta**, e a regra da casa e' que toda acao passa
     * pela fila. A vez e' solta antes de qualquer viagem.
     */
    const esperarAVez = async () => {
      const vez = globalThis.PPX?.vez;
      if (!vez?.pedir) return () => {};
      return vez.pedir('escada');
    };

    /**
     * Po-e `alvo` na frente da equipe, clicando nele no HUD.
     *
     * Devolve `''` se deu certo, ou a frase do que correu mal. **Confere o estado de depois, nao
     * o clique**: o clique pode ter sido engolido, ou a caixa do HUD pode ter passado a abrir uma
     * ficha em vez de trocar o lider numa atualizacao do jogo. Quem diz se trocou e' o HUD.
     *
     * Dois pokemon iguais no mesmo nivel sao indistinguiveis nesta conferencia — ela so' le' nome
     * e nivel. E' o preco de nao abrir o Deposito, e o pior caso e' dizer "nao troquei" depois de
     * ter trocado pelo gemeo certo.
     */
    async function trocarDeAluno(alvo, aviso) {
      // O jogo cala-se quando recusa: clicar dentro dos 5 s de espera nao muda nada e nao avisa
      // ninguem. Esperar e' muito mais barato do que o castigo de dois minutos, entao a espera
      // do jogo nao e' tratada como falha — e' tratada como espera.
      if (alvo.espera) return { espere: alvo.espera, diga: `O jogo só deixa trocar daqui a ${Math.ceil(alvo.espera / 1000)}s.` };

      const erro = await porNaFrente(
        alvo,
        aviso,
        `${nomeLider() || 'o líder'} chegou ao teto. Pondo ${alvo.nome} Lv ${alvo.nivel} na frente.`,
      );
      if (erro) return erro;

      // O aluno novo recomeça a escada: o degrau ja' cumprido era do anterior, e era quase de
      // certeza um degrau alto — guarda-lo mandaria o bicho de Lv 1 caçar onde o de Lv 60 caçava.
      cfg.aplicado = null;
      // Quem e' o aluno agora aprende-se no `conferir`, que le' o HUD a seguir: um dono so' para
      // cada coisa. Aqui grava-se o degrau apagado, que e' o que este passo decidiu.
      gravar();
      return null;
    }

    /**
     * Clica em `alvo` no HUD e confere, pelo HUD, que ele ficou mesmo na frente.
     *
     * Devolve `null` se deu certo, ou `{ espere, diga }`. Esta' separado de `trocarDeAluno`
     * porque ha' dois motivos diferentes para por alguem na frente — a formatura, que recomeça a
     * contagem do degrau, e a reposicao depois de o time do degrau mexer na ordem, que nao
     * recomeça nada.
     */
    async function porNaFrente(alvo, aviso, frase) {
      const soltar = await esperarAVez();
      if (!soltar) return { espere: 2000, diga: 'Outra ferramenta está agindo. Tento de novo.' };
      try {
        aviso(frase);
        alvo.el.click();
        const limite = Date.now() + ATE_TROCAR;
        while (Date.now() < limite) {
          await esperar(ESPREITA);
          if (nomeLider() === alvo.nome) break;
        }
      } finally {
        soltar();
      }

      // Quem diz se trocou e' o HUD, nao o clique: ele pode ter caido na espera, e o jogo nao
      // reclama. Seguir como se tivesse trocado mandaria o aluno errado para a caçada.
      if (nomeLider() !== alvo.nome)
        return {
          espere: 6000,
          diga:
            `Cliquei em ${alvo.nome} no HUD e quem continua à frente é ` +
            `${nomeLider() || '(não li o HUD)'}. Não troquei de aluno.`,
        };
      return null;
    }

    /**
     * Devolve a' frente o aluno que o time do degrau tirou de la'.
     *
     * O time guardado de um degrau monta a equipe INTEIRA, ordem incluida, e a ordem dele nao
     * sabe nada de formatura. Medido no jogo em 11/10/2026: o time guardado tinha um Gloom Lv 20
     * em primeiro, e viajar aplicava-o — punha na frente justamente quem ja' se tinha formado.
     *
     * O time diz QUEM esta' na equipe; a formatura diz QUEM esta' na frente, e a ultima palavra
     * e' dela. Tem de ser aqui, e nao na batida seguinte: essa leria a troca como sendo do dono
     * e apagaria o degrau que esta viagem acabou de cumprir.
     *
     * Nao mexe no degrau cumprido: o aluno nao mudou, so' a ordem foi mexida por baixo dele.
     */
    async function reporAFrente(aviso) {
      if (!cfg.teto) return '';
      const aluno = proximoAluno();
      // Sem aluno, a equipe toda esta' formada e quem trata disso e' a formatura, na batida
      // seguinte. Nao ha' ninguem para por na frente.
      if (!aluno) return '';
      const time = equipe();
      const temAtivo = time.some((p) => p.ativo);
      if (temAtivo ? aluno.ativo : aluno.i === 0) return '';

      const erro = await porNaFrente(
        aluno,
        aviso,
        `O time do degrau pôs ${nomeLider() || 'outro'} na frente. Devolvendo ${aluno.nome}.`,
      );
      return erro ? erro.diga : '';
    }

    async function montarTimeDaPool(nome, aviso) {
      const times = globalThis.PPX?.times;
      if (!times?.usar) {
        aviso('A ferramenta Times nao esta ligada — ligue-a no menu (Alt+Q).');
        return 'sem times';
      }
      if (Date.now() < esperaAte) return 'esperando';
      correndo = true;
      try {
        aviso(`Pool: montando o time "${nome}".`);
        const posto = await times.usar(nome, { aviso, voltar: false });
        if (!posto.ok) {
          esperaAte = Date.now() + CASTIGO;
          aviso(`Não montei o time "${nome}": ${posto.erro}`);
          return 'falhou';
        }
        cfg.timeAtivo = nome;
        cfg.aplicado = null;
        cfg.aluno = '';
        cfg.formados = false;
        gravar();
        aviso(`Pool: time "${nome}" pronto. Vou escolher o primeiro Pokémon abaixo do cap.`);
        return 'novo time';
      } finally {
        correndo = false;
      }
    }

    /**
     * A parte da formatura: trocar de aluno quando o da frente chega ao teto, e parar quando nao
     * houver mais aluno nenhum.
     *
     * Devolve `''` quando a escada normal deve seguir, ou uma palavra de desfecho quando este
     * passo ja' resolveu a vez de agora.
     */
    async function formatura(aviso) {
      if (cfg.automatico && cfg.pool.length && !cfg.timeAtivo) {
        const primeiro = cfg.pool.find((nome) => !cfg.timesConcluidos.includes(nome));
        if (primeiro) return montarTimeDaPool(primeiro, aviso);
      }
      const time = equipe();
      if (!time.length) return '';
      const aluno = proximoAluno();

      if (!aluno) {
        if (cfg.automatico && cfg.pool.length) {
          if (cfg.timeAtivo && !cfg.timesConcluidos.includes(cfg.timeAtivo)) {
            cfg.timesConcluidos.push(cfg.timeAtivo);
            gravar();
          }
          const proximo = cfg.pool.find((nome) => !cfg.timesConcluidos.includes(nome));
          if (proximo) return montarTimeDaPool(proximo, aviso);
        }
        // Toda a equipe passou do teto. A caçada acaba aqui.
        if (!cfg.destino) {
          aviso(diagnostico());
          return 'sem destino';
        }
        if (local() === cfg.destino) {
          if (!cfg.formados) {
            cfg.formados = true;
            gravar();
          }
          aviso(diagnostico());
          return 'formados';
        }
        // Ja' levou uma vez: se o dono saiu de la' a' mao, o lugar dele e' escolha dele.
        if (cfg.formados) {
          aviso(diagnostico());
          return 'formados';
        }
        // Parar a caçada no destino e' mudar de caçada como qualquer outra, e precisa da mesma
        // licenca.
        if (cfg.trocar !== true) {
          aviso(diagnostico());
          return 'sem licenca';
        }
        const cacadas = globalThis.PPX?.cacadas;
        if (!cacadas?.ir) {
          aviso('A ferramenta Caçadas nao esta ligada — ligue-a no menu (Alt+Q).');
          return 'sem cacadas';
        }
        if (Date.now() < esperaAte) return 'esperando';
        correndo = true;
        try {
          aviso(`Equipe formada. Parando a caçada em "${cfg.destino}".`);
          // Time vazio de proposito: ninguem precisa de equipe montada para ficar na cidade, e
          // uma troca no Deposito seria uma ida inteira ao Deposito por nada.
          const msg = await cacadas.ir(cfg.destino, aviso, { time: '' });
          if (local() === cfg.destino) {
            cfg.formados = true;
            gravar();
            aviso(diagnostico());
            return 'formados';
          }
          esperaAte = Date.now() + CASTIGO;
          aviso(`Não consegui parar em "${cfg.destino}": ${msg}`);
          return 'falhou';
        } finally {
          correndo = false;
        }
      }

      // Ha' aluno, entao a equipe nao esta' formada — se ela voltar a estar, isto conta de novo.
      if (cfg.formados) {
        cfg.formados = false;
        gravar();
      }
      // Quem ja' esta' a subir nao precisa de ser posto na frente. A classe `active` e' o jogo a
      // dizer quem e'; a posicao e' so' o que se vê quando ele nao diz.
      const temAtivo = time.some((p) => p.ativo);
      if (temAtivo ? aluno.ativo : aluno.i === 0) return '';

      if (Date.now() < esperaAte) return 'esperando';
      correndo = true;
      try {
        const falha = await trocarDeAluno(aluno, aviso);
        if (falha) {
          esperaAte = Date.now() + falha.espere;
          aviso(falha.diga);
          return 'sem trocar';
        }
      } finally {
        correndo = false;
      }
      return '';
    }

    /**
     * Confere se o lider mudou de degrau e, se mudou, viaja.
     *
     * Quem viaja e' as Caçadas: ela leva o time guardado daquela caçada, passa na Nurse Joy se
     * for preciso e confere a chegada. Esta ferramenta so' decide **quando**.
     */
    async function conferir(aviso = diz) {
      if (!cfg.ligada || cfg.pausada || correndo) return '';
      // Aba oculta: o motor do jogo para, as placas dos NPC somem e a cura fica fora de alcance.
      // O nivel tambem nao sobe, entao nao ha' o que perder em esperar a aba voltar.
      if (document.visibilityState !== 'visible') return '';

      let n = nivelLider();
      if (n === null) return '';

      // O HUD mudou, entao o que o painel diz sobre o HUD tambem muda: a equipe lida e o pedido
      // de licenca. So' esta parte — a caixa inteira nao, para nao apagar o campo do teto a meio
      // de quem o escreve.
      pintarPedido();

      // De quem e' esta escada. Primeira leitura nao e' troca: so' se apaga o degrau cumprido
      // quando havia um aluno antes e ele mudou — senao cada F5 seria uma troca de aluno, e a
      // escada recomeçaria a viajar a cada recarga da pagina.
      const quem = nomeLider();
      if (quem && cfg.aluno !== quem) {
        if (cfg.aluno) cfg.aplicado = null;
        cfg.aluno = quem;
        gravar();
      }

      if (cfg.teto) {
        const passo = await formatura(aviso);
        if (passo) return passo;
        // Trocar de aluno muda quem e' o lider, e e' o nivel dele que escolhe o degrau. Quem
        // entrou e' adotado na batida seguinte: ele vem de `proximoAluno`, abaixo do teto por
        // definicao, e nao ha' travao nenhum para decidir agora.
        n = nivelLider();
        if (n === null) return '';
      }

      const degrau = degrauPara(n);
      const alvo = alvoDoDegrau(degrau);
      if (degrau && alvo?.semSegura && degrau.nivel !== cfg.aplicado) {
        // Este marco foi avaliado e recusado por seguranca. Marca-lo impede uma tentativa a cada
        // nivel ganho; quando chegar ao proximo degrau, o numero muda e a escolha e' refeita.
        cfg.aplicado = degrau.nivel;
        gravar();
        aviso(diagnostico());
        return 'sem hunt segura';
      }
      // E ela nunca desce com o mesmo aluno. Um degrau ABAIXO do que ja' foi cumprido com ESTE
      // aluno nao e' progresso: e' um nivel mal lido, um degrau editado, ou o jogo a por outra
      // caixa como `active` — e o castigo e' arrastar um Lv 19 para a caçada dos Lv 1. Guarda-se
      // o degrau onde esta' e diz-se porque.
      if (degrau && cfg.aplicado !== null && degrau.nivel < cfg.aplicado) {
        aviso(diagnostico());
        return 'nao desco';
      }
      // Nao agir e' uma decisao como outra qualquer, e tem de ser dita. Ficar parada em silencio
      // e' indistinguivel de estar quebrada — foi o que aconteceu com o lider no Lv 1 e o
      // primeiro degrau no Lv 5.
      if (!degrau || !alvo || degrau.nivel === cfg.aplicado) {
        aviso(diagnostico());
        return 'nada a fazer';
      }

      // Ja' estar la' conta como feito: e' o caso de quem liga a escada ja' na caçada certa.
      if (local() === alvo.nome) {
        cfg.aplicado = degrau.nivel;
        gravar();
        aviso(diagnostico());
        return 'ja la';
      }

      // A licenca de viajar e' so' sobre viajar: tudo o que vem antes — formar o aluno, saber
      // em que degrau ele deveria estar, dizê-lo — ja' aconteceu. O que para aqui e' o arrasto
      // para outro mapa, e o `diagnostico` diz qual seria.
      if (cfg.trocar !== true) {
        aviso(diagnostico());
        return 'sem licenca';
      }

      const cacadas = globalThis.PPX?.cacadas;
      if (!cacadas?.ir) {
        aviso('A ferramenta Caçadas nao esta ligada — ligue-a no menu (Alt+Q).');
        return 'sem cacadas';
      }
      if (Date.now() < esperaAte) return '';

      correndo = true;
      try {
        aviso(`Lv ${n}: indo para "${alvo.nome}"${alvo.vantagem > 1 ? ' com vantagem de tipo' : ''}.`);
        // `cfg.time` ausente devolve `undefined`, que e' exatamente "use o time da caçada".
        // Os tres estados cabem num campo so': ausente, '' (nao trocar) e um nome.
        const msg = await cacadas.ir(alvo.nome, aviso, { time: cfg.automatico ? '' : cfg.time });
        if (local() === alvo.nome) {
          cfg.aplicado = degrau.nivel;
          gravar();
          const recado = await reporAFrente(aviso);
          aviso(recado || `Degrau ${degrau.nivel}: em "${alvo.nome}".`);
          return 'ok';
        }
        // Nao marcar o degrau como feito e' de proposito: a tentativa volta a valer. O castigo
        // existe para isso nao virar um martelo — uma equipe desmaiada nao se cura sozinha, e
        // tentar de dois em dois segundos nao ajudaria ninguem.
        esperaAte = Date.now() + CASTIGO;
        aviso(`Degrau ${degrau.nivel} nao deu: ${msg}`);
        return 'falhou';
      } finally {
        correndo = false;
      }
    }

    /**
     * Fica de olho no HUD.
     *
     * O HUD muda a cada ponto de vida, varias vezes por segundo numa caçada. Por isso a peneira
     * e' o proprio nivel: le-se o numero (uma leitura de DOM, barata) e so' se faz contas quando
     * ele mudou de facto.
     */
    function vigiar() {
      if (typeof MutationObserver === 'undefined' || !document.body) return null;
      const olho = new MutationObserver(() => {
        const n = nivelLider();
        if (n === visto) return;
        visto = n;
        conferir();
      });
      olho.observe(document.body, { childList: true, subtree: true, characterData: true });
      return olho;
    }

    // --------------------------------------------------------------- o painel
    //
    // O desenho e' o mesmo das Caçadas e da Loja, de proposito. As classes sao `esx`.

    let painel = null;
    /** Devolvido pelo nucleo: recoloca o painel no canto guardado. */
    let recolocar = () => false;
    /** Um clique de cada vez no ▸: o segundo so' atrapalharia o primeiro. */
    let indoAMao = false;
    let visivel = false;

    const diz = (txt) => {
      const alvo = painel?.querySelector('.esx-status');
      if (alvo) alvo.textContent = txt;
    };

    // A moldura, a barra, os botoes, o separador, o status, a rolagem e o foco vem do
    // nucleo: cinco copias da mesma folha derivam, e derivaram. Aqui fica o que e' deste
    // painel — e vem depois, por isso ganha nos empates.
    const CSS = (globalThis.PPX?.estiloDePainel?.('esx') || '') + [
      // Cada painel nasce num canto proprio: de baixo a' direita e' o painel de captura do
      // jogo, e empilhar os quatro no mesmo lugar escondia um atras do outro. Quem arrasta
      // manda — `cfg.pos` passa por cima disto.
      '.esx{right:300px;top:96px;width:252px}',
      '.esx-l{display:flex;align-items:center;gap:6px;margin:4px 0}',
      '.esx-l input{width:52px;background:#0b0e14;color:#e6e9ef;border:1px solid #3a4152;',
      'border-radius:5px;padding:3px 5px;font:12px system-ui,sans-serif}',
      '.esx-l select{flex:1;min-width:0;background:#0b0e14;color:#e6e9ef;',
      'border:1px solid #3a4152;border-radius:5px;padding:3px 5px;',
      'font:11.5px system-ui,sans-serif}',
      '.esx-l input.esx-cacada{flex:1;min-width:0;width:auto;background:#0b0e14;color:#e6e9ef;',
      'border:1px solid #3a4152;border-radius:5px;padding:3px 5px;font:11.5px system-ui,sans-serif}',
      '.esx-l button{width:auto!important;margin:0!important;padding:3px 8px!important;',
      'font-size:12px!important}',
      '.esx-lv{font-size:11.5px;opacity:.75;flex:0 0 auto}',
      '.esx-time{width:100%;margin:7px 0 0;background:#0b0e14;color:#e6e9ef;',
      'border:1px solid #3a4152;border-radius:5px;padding:3px 5px;',
      'font:11.5px system-ui,sans-serif}',
      '.esx-vazio{font-size:11.5px;opacity:.65;line-height:1.35}',
      '.esx-liga{display:flex;align-items:center;gap:6px;margin:9px 0 0;font-size:11.5px;',
      'opacity:.85;cursor:pointer}',
      '.esx-liga input{width:auto;margin:0;padding:0}',
      // Minimizado fica a escada e o interruptor, que e' o que se olha de relance.
      '.esx.compacto{width:190px}',
      '.esx-teto{width:60px!important}',
      '.esx-formabox{margin-top:9px;border-top:1px solid #2a3140;padding-top:7px}',
      '.esx-formabox .esx-lv{flex:0 0 auto}',
      '.esx-destino{flex:1;min-width:0;background:#0b0e14;color:#e6e9ef;',
      'border:1px solid #3a4152;border-radius:5px;padding:4px 6px;font:12px system-ui,sans-serif}',
      '.esx-vai{color:#9fd0ff}',
      // O Iniciar/Parar e' o comando principal do painel, entao tem o tamanho de um comando.
      // Parar e' vermelho porque parar e' o estado em que a ferramenta nao esta' a trabalhar, e
      // isso tem de se ver de relance no modo compacto.
      '.esx-ir{width:100%!important;margin:9px 0 0!important;font-weight:600}',
      '.esx-ir.esx-correndo{background:#3a2430;border-color:#6d3a4a;color:#ffc9d4}',
      // A linha de resumo existe POR o compacto esconder a formatura: uma regra que age no jogo
      // tem de estar a' vista de quem olha o painel. Ela e' o que o compacto mostra em vez dos
      // campos, e nunca o lugar do nada.
      '.esx-resumo{display:none;font-size:11.5px;opacity:.8;margin:7px 0 0;line-height:1.3}',
      '.esx.compacto .esx-resumo{display:block}',
      '.esx.compacto .esx-formabox{display:none}',
      '.esx-auto,.esx-pool{font-size:11px;margin:6px 0;line-height:1.35}',
      '.esx-pool label{display:block;margin:3px 0}',
      '.esx.compacto .esx-lista,.esx.compacto .esx-timebox,.esx.compacto .esx-novo,',
      '.esx.compacto .esx-status,.esx.compacto .esx-liga,.esx.compacto .esx-auto,',
      '.esx.compacto .esx-l .esx-fora,.esx.compacto .esx-time,.esx.compacto .esx-vazio{display:none}',
      '.esx.compacto .esx-l{margin:2px 0}',
    ].join('');

    /** O modo guardado, porque quem prefere um modo prefere sempre. */
    function aplicarModo() {
      if (!painel) return;
      painel.classList.toggle('compacto', cfg.compacto === true);
      const bt = painel.querySelector('.esx-min');
      if (!bt) return;
      bt.textContent = cfg.compacto ? '□' : '–';
      bt.title = cfg.compacto ? 'Mostrar tudo' : 'Minimizar';
    }

    /**
     * O seletor de caçada de um degrau.
     *
     * As caçadas vem das Caçadas (Alt+W), que e' quem as guarda e quem sabe viajar. Uma caçada
     * que saiu daquela lista **nao desaparece em silencio**: fica aqui, marcada, para voce ver
     * que ela sumiu em vez de descobrir quando o degrau nao disparar.
     */
    const cacadasConhecidas = () => {
      const todas = globalThis.PPX?.cacadas?.todas?.();
      if (Array.isArray(todas) && todas.length) return todas;
      return (globalThis.PPX?.cacadas?.cfg?.lista || []).map((c) => ({
        nome: c.nome,
        nivel: 0,
        regiao: '',
        trancada: false,
      }));
    };

    let nomesSabidos = new Set();
    let digitalDaLista = '';
    let listaCacadas = null;

    function encherDatalista() {
      const todas = cacadasConhecidas();
      const digital = `${todas.length}|${todas[0]?.nome || ''}|${todas.at(-1)?.nome || ''}`;
      nomesSabidos = new Set(todas.map((c) => c.nome));
      if (digital === digitalDaLista) return;
      digitalDaLista = digital;
      const lista = listaCacadas;
      if (!lista) return;
      lista.textContent = '';
      for (const c of todas) {
        const o = document.createElement('option');
        o.value = c.nome;
        o.label = [c.nivel ? `Lv ${c.nivel}` : '', c.regiao, c.trancada ? 'trancada' : '']
          .filter(Boolean)
          .join(' · ');
        lista.appendChild(o);
      }
    }

    function seletorDeCacada(degrau) {
      encherDatalista();
      const sel = document.createElement('input');
      sel.type = 'search';
      sel.className = 'esx-cacada';
      sel.placeholder = 'buscar hunt…';
      sel.setAttribute?.('list', 'esx-cacadas-do-jogo');
      sel.value = degrau.cacada || '';
      sel.addEventListener('focus', encherDatalista);
      sel.addEventListener('change', () => {
        const nome = sel.value.trim();
        if (nome && nomesSabidos.size && !nomesSabidos.has(nome)) {
          diz(`"${nome}" não está na lista de caçadas do jogo.`);
          sel.value = degrau.cacada || '';
          return;
        }
        degrau.cacada = nome;
        gravar();
        diz(nome ? `Lv ${degrau.nivel} → "${nome}".` : `Lv ${degrau.nivel} sem caçada.`);
      });
      return sel;
    }

    /**
     * O seletor de time da escada — **um so', para todos os degraus**.
     *
     * A escada e' a subida de uma equipe: sao as caçadas que mudam, nao o time. Um seletor por
     * degrau daria para escrever a mesma escolha seis vezes e errar numa delas.
     *
     * Tres estados, e eles sao mesmo tres: **o time da caçada** (cada caçada leva o que esta'
     * configurado nela, no Alt+W), **nao trocar o time** e **este time aqui**.
     *
     * O estado nao vai no `value` da opcao, vai no `dataset.modo`: um time chamado "— o time da
     * caçada —" e' improvavel, mas um `value` reservado e' uma cilada a' espera, e evita-la aqui
     * custa uma linha.
     */
    function seletorDeTime() {
      const nomes = globalThis.PPX?.times?.nomes?.() || [];
      const sel = document.createElement('select');
      sel.className = 'esx-time';

      const opcao = (modo, valor, texto) => {
        const o = document.createElement('option');
        o.dataset.modo = modo;
        o.value = valor;
        o.textContent = texto;
        sel.append(o);
        return o;
      };

      opcao('cacada', '@cacada', '— o time de cada caçada —');
      opcao('nenhum', '@nenhum', '— sem trocar o time —');
      for (const nome of nomes) opcao('time', nome, `sempre o time "${nome}"`);
      if (cfg.time && !nomes.includes(cfg.time))
        opcao('time', cfg.time, `"${cfg.time}" (não existe mais)`);

      sel.value = cfg.time === undefined ? '@cacada' : cfg.time === '' ? '@nenhum' : cfg.time;

      sel.addEventListener('change', () => {
        const modo = sel.selectedOptions[0]?.dataset.modo;
        if (modo === 'cacada') delete cfg.time;
        else cfg.time = modo === 'nenhum' ? '' : sel.value;
        gravar();
        diz(
          modo === 'cacada'
            ? 'Cada caçada leva o time que está configurado nela.'
            : modo === 'nenhum'
              ? 'Não troco o time em degrau nenhum.'
              : `Todos os degraus com o time "${cfg.time}".`,
        );
      });
      return sel;
    }

    function seletorDaPool() {
      const caixa = document.createElement('div');
      caixa.className = 'esx-pool';
      const nomes = globalThis.PPX?.times?.nomes?.() || [];
      const titulo = document.createElement('b');
      titulo.textContent = 'Times da pool para upar:';
      caixa.appendChild(titulo);
      if (!nomes.length) {
        const vazio = document.createElement('div');
        vazio.textContent = 'Guarde os times no painel Times primeiro.';
        caixa.appendChild(vazio);
      }
      for (const nome of nomes) {
        const linha = document.createElement('label');
        const check = document.createElement('input');
        check.type = 'checkbox';
        check.checked = cfg.pool.includes(nome);
        check.addEventListener('change', () => {
          cfg.pool = check.checked ? [...new Set([...cfg.pool, nome])] : cfg.pool.filter((n) => n !== nome);
          cfg.timesConcluidos = cfg.timesConcluidos.filter((n) => cfg.pool.includes(n));
          if (!cfg.pool.includes(cfg.timeAtivo)) cfg.timeAtivo = '';
          gravar();
        });
        const texto = document.createElement('span');
        texto.textContent = ` ${nome}`;
        linha.append(check, texto);
        caixa.appendChild(linha);
      }
      return caixa;
    }

    /**
     * Para onde ir quando a equipe inteira se formar.
     *
     * Sai da mesma lista das Caçadas — e por isso a cidade tem de estar guardada la' como um
     * lugar qualquer. Nao se inventa aqui um jeito proprio de viajar: quem sabe viajar e' quem
     * guarda os lugares.
     */
    function seletorDeDestino() {
      const nomes = (globalThis.PPX?.cacadas?.cfg?.lista || []).map((c) => c.nome);
      const sel = document.createElement('select');
      sel.className = 'esx-destino';

      const nenhum = document.createElement('option');
      nenhum.value = '';
      nenhum.textContent = nomes.length ? '— fico onde estiver —' : '— Caçadas desligada —';
      sel.append(nenhum);
      for (const nome of nomes) {
        const o = document.createElement('option');
        o.value = nome;
        o.textContent = `parar em "${nome}"`;
        sel.append(o);
      }
      if (cfg.destino && !nomes.includes(cfg.destino)) {
        const perdido = document.createElement('option');
        perdido.value = cfg.destino;
        perdido.textContent = `${cfg.destino} (não está guardada)`;
        sel.append(perdido);
      }

      sel.value = cfg.destino || '';
      sel.addEventListener('change', () => {
        cfg.destino = sel.value;
        gravar();
        diz(diagnostico());
      });
      return sel;
    }

    /**
     * Vai agora para a caçada de um degrau, porque o dono clicou nele.
     *
     * Isto nao e' a escada a decidir: e' o dono a escolher. Por isso marca-se o degrau do nivel
     * de agora como cumprido — senao a escada veria "o Lv 14 devia estar no degrau de Lv 10" e
     * arrastaria o jogador de volta na primeira batida do HUD, por cima do que ele acabou de
     * pedir.
     */
    async function irAoDegrau(degrau) {
      if (indoAMao) return;
      if (!degrau.cacada) {
        diz('Escolha a caçada deste degrau primeiro.');
        return;
      }
      const cacadas = globalThis.PPX?.cacadas;
      if (!cacadas?.ir) {
        diz('A ferramenta Caçadas nao esta ligada — ligue-a no menu (Alt+Q).');
        return;
      }
      if (local() === degrau.cacada) {
        diz(`Você já está em "${degrau.cacada}".`);
        return;
      }
      indoAMao = true;
      try {
        diz(`Indo para "${degrau.cacada}".`);
        const msg = await cacadas.ir(degrau.cacada, diz, { time: cfg.time });
        if (local() === degrau.cacada) {
          const meu = degrauPara(nivelLider());
          cfg.aplicado = meu ? meu.nivel : null;
          gravar();
          diz(`Em "${degrau.cacada}". Não te tiro daqui sozinha.`);
        } else diz(msg);
      } finally {
        indoAMao = false;
      }
    }

    function pintarFormatura() {
      const caixa = painel?.querySelector('.esx-formabox');
      if (!caixa) return;
      caixa.textContent = '';

      const l = document.createElement('div');
      l.className = 'esx-l';

      const rotulo = document.createElement('span');
      rotulo.className = 'esx-lv';
      rotulo.textContent = 'Formar no Lv';

      const teto = document.createElement('input');
      teto.type = 'number';
      teto.min = '1';
      teto.className = 'esx-teto';
      teto.value = cfg.teto ? String(cfg.teto) : '';
      teto.placeholder = '—';
      teto.title = 'Ao chegar neste nível, o pokémon sai da fila e o próximo vai para a frente';
      teto.addEventListener('change', () => {
        const n = Math.round(Number(teto.value) || 0);
        cfg.teto = n > 0 ? n : null;
        // Mudar o teto refaz a conta de quem esta' formado, entao o "ja' levei" nao vale mais.
        cfg.formados = false;
        gravar();
        pintarFormatura();
        diz(cfg.teto ? diagnostico() : 'Sem formatura: o líder fica no degrau mais alto.');
      });

      l.append(rotulo, teto);
      caixa.appendChild(l);

      const linhaDestino = document.createElement('div');
      linhaDestino.className = 'esx-l';
      linhaDestino.appendChild(seletorDeDestino());
      caixa.appendChild(linhaDestino);

      if (cfg.teto) {
        const quadro = document.createElement('div');
        quadro.className = 'esx-vazio';
        caixa.appendChild(quadro);
      }

      // O resto desta caixa muda com o jogo, e nao com o dono: fica no `pintarPedido`.
      pintarPedido();
    }

    /**
     * A parte da caixa da formatura que muda com o JOGO: quem ja' se formou.
     *
     * Esta' separada de `pintarFormatura` porque as duas tem donos diferentes. `pintarFormatura`
     * reconstroi a caixa inteira, campo do teto incluido, e por isso so' pode correr a convite do
     * dono — correr a cada batida do HUD apagaria o numero que ele esta' a escrever. Esta corre a
     * cada batida, porque e' do jogo que ela fala.
     */
    function pintarPedido() {
      if (!painel) return;

      const quadro = painel.querySelector('.esx-vazio');
      if (quadro) {
        const time = equipe();
        quadro.textContent = time.length
          ? time.map((p) => `${p.nome} ${p.nivel}${formado(p) ? ' ✔' : ''}`).join(' · ')
          : 'Equipe ainda não lida.';
      }
      pintarResumo();
    }

    /** O botao de arranque diz em que estado a escada esta', e nao o que se vai fazer com ele. */
    function pintarIr() {
      const bt = painel?.querySelector('.esx-ir');
      if (!bt) return;
      const correndo = cfg.ligada === true;
      bt.textContent = correndo ? '⏸ Parar' : '▶ Iniciar';
      bt.title = correndo
        ? 'A escada está correndo. Parar não apaga nada: os degraus e o teto ficam.'
        : 'Começar a seguir os degraus e o teto';
      bt.classList.toggle('esx-correndo', correndo);
    }

    /**
     * A linha que o modo compacto mostra em vez da formatura.
     *
     * O compacto escondia a formatura inteira e ela continuava a agir — e foi assim que um teto
     * Lv 15 esquecido trocou o pokemon e desceu a caçada sem aparecer em sitio nenhum do painel
     * que o dono estava a olhar. Quem age aparece, e a formatura age sozinha.
     */
    function pintarResumo() {
      const linha = painel?.querySelector('.esx-resumo');
      if (!linha) return;
      const estado = !cfg.ligada ? 'Parada' : cfg.pausada ? 'Pausada' : 'Rodando';
      const lider = nomeLider();
      const nivel = nivelLider();
      linha.textContent = [
        estado,
        lider && nivel !== null ? `${lider} Lv ${nivel}` : '',
        local() ? `em "${local()}"` : '',
        cfg.teto ? `cap Lv ${cfg.teto}` : '',
        cfg.automatico && cfg.pool.length
          ? `pool ${cfg.timesConcluidos.length}/${cfg.pool.length}`
          : '',
      ].filter(Boolean).join(' · ');
    }

    function pintarLista() {
      const caixa = painel?.querySelector('.esx-timebox');
      if (caixa) {
        caixa.textContent = '';
        caixa.appendChild(cfg.automatico ? seletorDaPool() : seletorDeTime());
      }
      const lista = painel?.querySelector('.esx-lista');
      if (!lista) return;
      lista.textContent = '';
      if (!cfg.degraus.length) {
        const vazio = document.createElement('div');
        vazio.className = 'esx-vazio';
        vazio.textContent =
          'Nenhum degrau ainda. Um degrau é "a partir do nível N, caçar em tal lugar".';
        lista.appendChild(vazio);
        return;
      }
      for (const degrau of cfg.degraus) {
        const l = document.createElement('div');
        l.className = 'esx-l';

        const rotulo = document.createElement('span');
        rotulo.className = 'esx-lv';
        rotulo.textContent = 'Lv';

        const nivel = document.createElement('input');
        nivel.type = 'number';
        nivel.min = '1';
        nivel.value = String(degrau.nivel);
        nivel.title = 'A partir deste nível do líder';
        nivel.addEventListener('change', () => {
          const n = Math.max(1, Math.round(Number(nivel.value) || 1));
          degrau.nivel = n;
          ordenar();
          gravar();
          pintarLista();
          diz(`Degrau mudou para Lv ${n}.`);
        });

        // O botao de ir mora na linha do degrau, e nao embaixo do painel: o que se quer a' mao
        // nao e' "o degrau do meu nivel", e' **aquela** caçada ali, a que se esta' a olhar.
        const vai = document.createElement('button');
        vai.className = 'esx-vai';
        vai.textContent = '▸';
        vai.title = 'Ir agora para esta caçada';
        vai.addEventListener('click', () => irAoDegrau(degrau));

        const fora = document.createElement('button');
        fora.className = 'esx-fora';
        fora.textContent = '×';
        fora.title = 'Tirar este degrau';
        fora.addEventListener('click', () => {
          cfg.degraus = cfg.degraus.filter((d) => d !== degrau);
          gravar();
          pintarLista();
          diz('Degrau tirado.');
        });

        if (cfg.automatico) {
          const alvo = document.createElement('span');
          alvo.className = 'esx-lv';
          alvo.textContent = '→ hunt Lv';
          const nivelHunt = document.createElement('input');
          nivelHunt.type = 'number';
          nivelHunt.min = '1';
          nivelHunt.value = degrau.nivelHunt ? String(degrau.nivelHunt) : '';
          nivelHunt.placeholder = 'nível';
          nivelHunt.title = 'Nível exato das hunts entre as quais a ferramenta deve escolher';
          nivelHunt.addEventListener('change', () => {
            degrau.nivelHunt = Math.max(1, Math.round(Number(nivelHunt.value) || 1));
            cfg.aplicado = null;
            gravar();
            diz(diagnostico());
          });
          l.append(rotulo, nivel, alvo, nivelHunt, fora);
        } else l.append(rotulo, nivel, seletorDeCacada(degrau), vai, fora);
        lista.appendChild(l);
      }
    }

    function montar() {
      if (painel) return painel;

      const estilo = document.createElement('style');
      estilo.textContent = CSS;
      (document.head || document.documentElement).appendChild(estilo);

      painel = document.createElement('div');
      painel.className = 'esx';

      listaCacadas = document.createElement('datalist');
      listaCacadas.id = 'esx-cacadas-do-jogo';
      painel.appendChild(listaCacadas);

      const barra = document.createElement('div');
      barra.className = 'esx-barra';
      const titulo = document.createElement('h4');
      titulo.textContent = 'Escada de caçadas';
      const minimizar = document.createElement('button');
      minimizar.className = 'esx-x esx-min';
      minimizar.textContent = '–';
      minimizar.title = 'Minimizar';
      minimizar.addEventListener('click', () => {
        cfg.compacto = !cfg.compacto;
        gravar();
        aplicarModo();
        pintarResumo();
      });
      const fechar = document.createElement('button');
      fechar.className = 'esx-x';
      fechar.textContent = '×';
      fechar.title = 'Esconder (Alt+N traz de volta)';
      fechar.addEventListener('click', () => mostrar(false));
      barra.append(titulo, minimizar, fechar);
      painel.appendChild(barra);

      const lista = document.createElement('div');
      lista.className = 'esx-lista';
      painel.appendChild(lista);

      // Uma caixa propria para o seletor do time: `pintarLista` refa-la, para a lista de times
      // guardados estar sempre fresca — um time criado depois de o painel subir tem de aparecer.
      const caixaTime = document.createElement('div');
      caixaTime.className = 'esx-timebox';
      painel.appendChild(caixaTime);

      const novo = document.createElement('button');
      novo.className = 'esx-novo';
      novo.textContent = '＋ Novo degrau';
      novo.addEventListener('click', () => {
        cfg.degraus.push({ nivel: nivelDoProximo(), cacada: '', nivelHunt: 1 });
        ordenar();
        gravar();
        pintarLista();
        diz('Escolha o nível e a caçada do degrau novo.');
      });
      painel.appendChild(novo);

      // A formatura fica numa caixa propria porque o quadro de quem ja' se formou se repinta.
      const caixaForma = document.createElement('div');
      caixaForma.className = 'esx-formabox';
      painel.appendChild(caixaForma);

      const resumo = document.createElement('div');
      resumo.className = 'esx-resumo';
      painel.appendChild(resumo);

      // O comando de arranque e' um botao, e nao a caixa: a caixa diz o que ela PODE fazer, o
      // botao diz se ela esta' a fazer. Eram a mesma chave, e por isso "desligar para nao trocar
      // de caçada" desligava tambem a formatura, sem o dizer em lado nenhum.
      const ir = document.createElement('button');
      ir.className = 'esx-ir';
      ir.addEventListener('click', () => {
        cfg.ligada = cfg.ligada !== true;
        // Iniciar recomeça a escada: o degrau certo e' o do nivel de agora, nao o de antes. E e'
        // tambem a adocao do aluno — o momento em que se decide se ele ja' estava acima do teto.
        // Iniciar recomeça a escada: o degrau certo e' o do nivel de agora, nao o de antes.
        if (cfg.ligada) cfg.aplicado = null;
        gravar();
        pintarIr();
        if (cfg.ligada) {
          diz('Iniciada. Vou olhar o nível do líder.');
          pintarFormatura();
          conferir();
        } else {
          diz('Parada. Não faço nada sozinha.');
          pintarResumo();
        }
      });
      painel.appendChild(ir);

      const pausa = document.createElement('button');
      pausa.className = 'esx-pausa';
      const pintarPausa = () => {
        pausa.textContent = cfg.pausada ? '▶ Retomar' : '⏸ Pausar';
        pausa.title = cfg.pausada
          ? 'Continuar do mesmo aluno, degrau e time da pool'
          : 'Congelar a escada sem perder o andamento';
      };
      pausa.addEventListener('click', () => {
        cfg.pausada = !cfg.pausada;
        gravar();
        pintarPausa();
        pintarResumo();
        if (cfg.pausada) diz('Pausada. Guardei o ponto exato da escada e da pool.');
        else {
          diz('Retomada. Continuando do mesmo ponto.');
          conferir();
        }
      });
      pintarPausa();
      painel.appendChild(pausa);

      const liga = document.createElement('label');
      liga.className = 'esx-liga';
      const caixa = document.createElement('input');
      caixa.type = 'checkbox';
      caixa.checked = cfg.trocar === true;
      caixa.addEventListener('change', () => {
        cfg.trocar = caixa.checked;
        gravar();
        // Dar a licenca nao recomeça nada: o aluno e' o mesmo e o degrau cumprido tambem. So'
        // se abre a porta — a batida seguinte decide se ha' para onde ir.
        if (cfg.ligada) conferir();
        else diz(diagnostico());
        pintarResumo();
      });
      const texto = document.createElement('span');
      texto.textContent = 'trocar de caçada sozinha';
      liga.append(caixa, texto);
      painel.appendChild(liga);

      const modoAuto = document.createElement('label');
      modoAuto.className = 'esx-auto';
      const auto = document.createElement('input');
      auto.type = 'checkbox';
      auto.checked = cfg.automatico === true;
      auto.addEventListener('change', () => {
        cfg.automatico = auto.checked;
        cfg.aplicado = null;
        cfg.formados = false;
        cfg.timesConcluidos = [];
        if (!cfg.automatico) cfg.timeAtivo = '';
        gravar();
        pintarLista();
        diz(cfg.automatico ? 'Modo automático: escolho a hunt pelo tipo do líder.' : 'Modo manual: cada degrau usa a hunt escolhida.');
      });
      const autoTxt = document.createElement('span');
      autoTxt.textContent = ' escolher hunt automaticamente pelo tipo';
      modoAuto.append(auto, autoTxt);
      painel.appendChild(modoAuto);

      const status = document.createElement('div');
      status.className = 'esx-status';
      painel.appendChild(status);

      // Em cima das outras ao ser tocado, e nunca pendurado para fora quando a janela encolhe.
      // Quem faz as duas coisas e' o nucleo: eram cinco copias, e o recorte do `resize` nao
      // existia em nenhuma delas.
      document.body.appendChild(painel);

      // Arrastar, lembrar o lugar, vir para a frente ao ser tocado e nao ficar pendurado para
      // fora quando a janela encolhe: tudo isto e' do nucleo. Eram cinco copias, cada uma com
      // `mousedown` na janela (que perde o arrasto se o ponteiro sair) e pixels do canto de cima
      // a' esquerda (que nao sobrevivem a encolher a janela). O `recolocar` serve para quando o
      // painel volta a' vista: escondido ele nao tem caixa para medir.
      recolocar =
        globalThis.PPX?.painel?.(painel, {
          alca: barra,
          pos: cfg.pos,
          guardar: (p) => {
            cfg.pos = p;
            gravar();
          },
        }) || (() => false);
      aplicarModo();
      pintarLista();
      pintarIr();
      pintarFormatura();
      diz(diagnostico());
      return painel;
    }

    /**
     * Mostra ou esconde o painel — e guarda a escolha.
     *
     * Guardar e' o ponto: sem isto, cada F5 devolvia o painel para o escuro e nao havia como
     * "deixar a ferramenta aparecendo". A escolha mora na chave da propria ferramenta porque,
     * para um modulo `proprio`, e' ele o dono do estado: o nucleo so' pergunta (`PPX.visivel`)
     * e manda aplicar (`PPX.controlar`).
     */
    function mostrar(sim) {
      visivel = sim === true;
      if (cfg.visivel !== visivel) {
        cfg.visivel = visivel;
        gravar();
      }
      if (visivel) {
        montar().style.display = 'block';
        globalThis.PPX?.frente?.(painel);
        // Escondido nao tem caixa para medir: se a janela mudou de tamanho enquanto ele estava
        // fora, e' agora que o canto guardado volta a valer.
        recolocar();
        pintarLista();
        pintarFormatura();
        // Abrir o painel tem de responder a' pergunta "porque e' que ela nao fez nada?".
        diz(diagnostico());
      } else if (painel) painel.style.display = 'none';
      globalThis.PPX?.anotar?.('escada', visivel);
    }

    addEventListener(
      'keydown',
      (e) => {
        if (!e.altKey || e.ctrlKey || e.shiftKey) return;
        const tecla = e.key.toLowerCase();
        if (tecla !== 'b' && tecla !== 'n') return;
        // Campo de texto nao dispara atalho: o jogo tem chat, e uma letra ali nao e' um comando.
        const t = e.target;
        if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;
        e.preventDefault();
        e.stopPropagation();
        // Duas teclas, e nao uma que alterna: com uma so' e' preciso olhar para o ecra' antes de
        // a usar, porque ela faz o contrario do que fez da ultima vez. Saiu do Alt+P porque essa
        // tecla e' das anotacoes (`geral-anotacoes`), que correm em TODOS os sites — incluindo
        // este. Duas extensoes a responder a' mesma tecla e' uma a roubar a outra.
        mostrar(tecla === 'n');
      },
      true,
    );

    // Volta ao que estava antes do F5. Por omissao aparece: uma ferramenta que ninguem ve' e'
    // uma ferramenta que ninguem usa, e fecha-se no × ou no menu (Alt+Q) quem nao a quiser.
    mostrar(cfg.visivel !== false);
    globalThis.PPX?.controlar?.('escada', (sim) => mostrar(sim));

    vigiar();
    conferir();

    globalThis.PPX = globalThis.PPX || {};
    globalThis.PPX.escada = { conferir, irAoDegrau, degrauPara, nivelLider, nivelDoProximo, diagnostico, equipe, proximoAluno, formado, cfg };

    if (typeof module !== 'undefined' && module.exports)
      module.exports = { conferir, irAoDegrau, degrauPara, nivelLider, nivelDoProximo, diagnostico, equipe, proximoAluno, formado, cfg };
  },
);
