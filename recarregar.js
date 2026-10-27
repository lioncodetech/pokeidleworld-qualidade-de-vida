// Recarregar sozinho — devolve a memoria que a pagina do jogo acumula, sem ninguem ter de olhar.
//
// Por que isto existe. Medido no servidor em 22/10/2026, com quatro janelas do jogo abertas ha'
// tres horas: a fatia do LionMultInstance estava em 3,4 GB, e o renderizador mais velho sozinho em
// 1,1 GB — 946 MB deles memoria anonima, ou seja heap do processo, nao ficheiro mapeado. Numa
// maquina sem placa de video o WebGL corre por software, e cada textura e cada ladrilho que numa
// GPU viveria na placa vive ali. O patamar oscila algumas centenas de MB (o Chromium recolhe), mas
// a pagina mais velha sobe devagar e nao volta: +45 MB em meia hora, sem ninguem a jogar nela.
//
// Um F5 resolve, porque o estado do jogo e' do servidor e nao da pagina. O que faltava era nao
// ter de o fazer a mao, janela a janela, de madrugada.
//
// Tres decisoes que custaram a pensar:
//
//  1. **O prazo conta do carregamento, nao de um relogio absoluto.** Uma janela que abre com o
//     prazo ja' vencido (a maquina esteve desligada, o LMI acabou de arrancar) nao se recarrega:
//     ela ACABOU de carregar, esta' limpa. Contar do carregamento tambem e' o que torna o laco
//     impossivel — nao existe estado em que a pagina carregue e queira recarregar logo.
//  2. **Pede a vez antes de recarregar.** Recarregar no meio de uma venda e' perder a venda a
//     meio. A fila existe para isto, e aqui ela e' usada como qualquer outra ferramenta usa: quem
//     quer agir espera a sua vez. O `pagehide` do nucleo solta a vez sozinho quando a pagina sai,
//     por isso nao ha' nada a devolver do outro lado.
//  3. **Nao arranca a pagina debaixo das maos de quem esta' a jogar.** Se a aba esta' a' vista e
//     houve rato ou tecla no ultimo minuto, adia um minuto. A janela escondida — que e' o caso
//     normal, com varias janelas abertas — recarrega na hora.
//
// O relogio e' uma batida curta a comparar `Date.now()` com o prazo, e nao um `setTimeout` de
// trinta minutos: em aba oculta o navegador estrangula o temporizador para uma vez por minuto, e
// um temporizador longo acordaria tarde e errado. Comparar datas faz o estrangulamento atrasar a
// batida, nunca saltar o prazo.
PPX.modulo(
  { id: 'recarregar', nome: 'Recarregar sozinho', atalhos: 'no menu (Alt+Q)' },
  () => {
    const CHAVE = 'lioncode:pokeidleworld:recarregar';
    const MINHA_VEZ = 'recarregar';

    /** Abaixo de 5 minutos a recarga custa mais do que poupa; acima de 12 h nao e' habito. */
    const MINUTOS_MIN = 5;
    const MINUTOS_MAX = 720;
    const MINUTOS_PADRAO = 30;

    /** De quanto em quanto se confere o prazo. */
    const BATIDA = 20000;

    /** Quanto tempo depois do ultimo toque a janela a' vista ainda conta como em uso. */
    const EM_USO = 60000;

    /** Quanto se adia quando nao se pode recarregar agora. */
    const ADIAR = 60000;

    const PADRAO = { ligado: false, minutos: MINUTOS_PADRAO, visivel: true, pos: null };

    // ------------------------------------------------------------------ as decisoes, sem navegador

    /**
     * O numero de minutos que se pode mesmo usar.
     *
     * Texto vazio, letra, zero e negativo caem no padrao em vez de desligarem o relogio por
     * acidente: um campo a meio de ser escrito nao e' uma ordem para parar.
     */
    function minutosValidos(bruto) {
      const n = Math.round(Number(bruto));
      if (!Number.isFinite(n) || n <= 0) return MINUTOS_PADRAO;
      return Math.min(MINUTOS_MAX, Math.max(MINUTOS_MIN, n));
    }

    /** O instante da proxima recarga, contado de agora. */
    const prazoDe = (minutos, agora) => agora + minutosValidos(minutos) * 60000;

    /**
     * O que fazer nesta batida: `'recarregar'`, `'adiar'` ou `'esperar'`.
     *
     * - desligada, ou prazo no futuro: `esperar`;
     * - prazo vencido mas a fila ocupada, ou a janela em uso por gente: `adiar`;
     * - prazo vencido e caminho livre: `recarregar`.
     */
    function decidir({ ligado, prazo, agora, dono, aVista, ultimoToque }) {
      if (!ligado || !prazo || agora < prazo) return 'esperar';
      if (dono && dono !== MINHA_VEZ) return 'adiar';
      if (aVista && agora - Number(ultimoToque || 0) < EM_USO) return 'adiar';
      return 'recarregar';
    }

    /** Quanto falta, em minutos inteiros arredondados para cima, para dizer na tela. */
    const faltam = (prazo, agora) => Math.max(0, Math.ceil((prazo - agora) / 60000));

    // --------------------------------------------------------------------------- o estado guardado

    let cfg = { ...PADRAO };
    try {
      const guardado = JSON.parse(localStorage.getItem(CHAVE) || 'null');
      if (guardado && typeof guardado === 'object') cfg = { ...PADRAO, ...guardado };
    } catch {
      cfg = { ...PADRAO };
    }
    cfg.minutos = minutosValidos(cfg.minutos);

    const gravar = () => {
      try {
        localStorage.setItem(CHAVE, JSON.stringify(cfg));
      } catch {
        /* sem armazenamento a escolha vale so' nesta carga, que ainda e' melhor do que recusar */
      }
    };

    // O prazo NAO e' guardado: ele conta do carregamento desta pagina. Ver a decisao 1, no topo.
    let prazo = cfg.ligado ? prazoDe(cfg.minutos, Date.now()) : 0;
    let ultimoToque = 0;
    let relogio = 0;
    let recarregando = false;

    for (const tipo of ['mousedown', 'keydown', 'wheel'])
      addEventListener(tipo, () => {
        ultimoToque = Date.now();
      }, true);

    // ----------------------------------------------------------------------------------- a recarga

    async function recarregarAgora(aviso = () => {}) {
      if (recarregando) return 'ja estou a recarregar';
      recarregando = true;
      aviso('Esperando a vez para recarregar…');
      const soltar = await globalThis.PPX?.vez?.pedir?.(MINHA_VEZ, { espera: 10 * 60 * 1000 });
      if (!soltar) {
        recarregando = false;
        return 'nao consegui a vez: fica para a proxima batida';
      }
      // A vez nao se solta aqui de proposito: ela tem de valer ate' a pagina sair, senao outra
      // ferramenta comeca uma venda nos milissegundos entre este ponto e o `reload`. Quem a solta
      // e' o `pagehide` do nucleo. Se o `reload` falhar, o abandono da fila (45 s) desfaz isto.
      try {
        location.reload();
      } catch {
        soltar();
        recarregando = false;
        return 'o navegador recusou a recarga';
      }
      return 'recarregando';
    }

    function bater() {
      const agora = Date.now();
      const decisao = decidir({
        ligado: cfg.ligado,
        prazo,
        agora,
        dono: globalThis.PPX?.vez?.dono?.()?.id || '',
        aVista: document.visibilityState === 'visible',
        ultimoToque,
      });
      if (decisao === 'adiar') {
        prazo = agora + ADIAR;
        pintar();
        return;
      }
      if (decisao === 'recarregar') recarregarAgora();
      pintar();
    }

    function ligar(sim) {
      cfg.ligado = sim === true;
      gravar();
      prazo = cfg.ligado ? prazoDe(cfg.minutos, Date.now()) : 0;
      pintar();
    }

    // ------------------------------------------------------------------------------------ o painel

    let painel = null;
    let recolocar = () => false;
    let caixaLigado = null;
    let campoMinutos = null;
    let linhaConta = null;

    const diz = (texto) => {
      if (linhaConta) linhaConta.textContent = texto;
    };

    function pintar() {
      if (!painel) return;
      if (caixaLigado) caixaLigado.checked = cfg.ligado === true;
      if (campoMinutos && document.activeElement !== campoMinutos)
        campoMinutos.value = String(cfg.minutos);
      if (!cfg.ligado) return diz('Desligado: a página só recarrega no botão.');
      const q = faltam(prazo, Date.now());
      diz(q <= 1 ? 'Próxima recarga em menos de um minuto.' : `Próxima recarga em ${q} min.`);
    }

    function montar() {
      if (painel) return painel;
      painel = document.createElement('div');
      painel.className = 'rcx-painel';
      painel.style.cssText =
        'position:fixed;left:12px;top:12px;z-index:2147483600;width:236px;' +
        'background:#11151dF2;color:#e6e9ef;font:12px system-ui,sans-serif;' +
        'border:1px solid #3a4152;border-radius:10px;display:none';

      const barra = document.createElement('div');
      barra.style.cssText =
        'display:flex;align-items:center;gap:6px;padding:7px 9px;cursor:move;' +
        'border-bottom:1px solid #3a4152';
      const titulo = document.createElement('strong');
      titulo.textContent = 'Recarregar sozinho';
      titulo.style.cssText = 'flex:1;font-weight:600';
      const fechar = document.createElement('button');
      fechar.className = 'rcx-x';
      fechar.textContent = '×';
      fechar.title = 'Esconder (volta no menu, Alt+Q)';
      fechar.style.cssText =
        'background:none;border:0;color:#9aa3b2;font-size:16px;line-height:1;cursor:pointer';
      fechar.addEventListener('click', () => mostrar(false));
      barra.append(titulo, fechar);

      const corpo = document.createElement('div');
      corpo.style.cssText = 'padding:9px;display:flex;flex-direction:column;gap:8px';

      const linhaLigar = document.createElement('label');
      linhaLigar.style.cssText = 'display:flex;align-items:center;gap:7px;cursor:pointer';
      caixaLigado = document.createElement('input');
      caixaLigado.type = 'checkbox';
      caixaLigado.className = 'rcx-ligado';
      caixaLigado.addEventListener('change', () => ligar(caixaLigado.checked));
      const textoLigar = document.createElement('span');
      textoLigar.textContent = 'Recarregar a cada';
      linhaLigar.append(caixaLigado, textoLigar);

      campoMinutos = document.createElement('input');
      campoMinutos.type = 'number';
      campoMinutos.className = 'rcx-minutos';
      campoMinutos.min = String(MINUTOS_MIN);
      campoMinutos.max = String(MINUTOS_MAX);
      campoMinutos.value = String(cfg.minutos);
      campoMinutos.style.cssText =
        'width:58px;background:#0b0e14;color:#e6e9ef;border:1px solid #3a4152;' +
        'border-radius:6px;padding:3px 5px';
      const guardarMinutos = () => {
        const antes = cfg.minutos;
        cfg.minutos = minutosValidos(campoMinutos.value);
        campoMinutos.value = String(cfg.minutos);
        gravar();
        // Mudar o intervalo reconta do zero: manter o prazo antigo faria a primeira recarga sair
        // num tempo que ninguem pediu.
        if (cfg.ligado && cfg.minutos !== antes) prazo = prazoDe(cfg.minutos, Date.now());
        pintar();
      };
      campoMinutos.addEventListener('change', guardarMinutos);
      campoMinutos.addEventListener('blur', guardarMinutos);
      const min = document.createElement('span');
      min.textContent = 'min';
      linhaLigar.append(campoMinutos, min);

      linhaConta = document.createElement('div');
      linhaConta.className = 'rcx-conta';
      linhaConta.style.cssText = 'color:#9aa3b2;line-height:1.35';

      const agora = document.createElement('button');
      agora.className = 'rcx-agora';
      agora.textContent = 'Recarregar agora';
      agora.style.cssText =
        'background:#1b2130;color:#e6e9ef;border:1px solid #3a4152;border-radius:7px;' +
        'padding:5px 9px;cursor:pointer';
      agora.addEventListener('click', () => {
        recarregarAgora(diz).then((r) => {
          if (r !== 'recarregando') diz(`Não recarreguei: ${r}.`);
        });
      });

      corpo.append(linhaLigar, linhaConta, agora);
      painel.append(barra, corpo);
      document.body.appendChild(painel);

      recolocar =
        globalThis.PPX?.painel?.(painel, {
          alca: barra,
          pos: cfg.pos,
          guardar: (p) => {
            cfg.pos = p;
            gravar();
          },
        }) || (() => false);
      return painel;
    }

    function mostrar(sim) {
      const visivel = sim === true;
      if (cfg.visivel !== visivel) {
        cfg.visivel = visivel;
        gravar();
      }
      if (visivel) {
        montar().style.display = 'block';
        globalThis.PPX?.frente?.(painel);
        recolocar();
        pintar();
      } else if (painel) painel.style.display = 'none';
      globalThis.PPX?.anotar?.('recarregar', visivel);
    }

    mostrar(cfg.visivel !== false);
    globalThis.PPX?.controlar?.('recarregar', (sim) => mostrar(sim));
    relogio = setInterval(bater, BATIDA);
    pintar();

    globalThis.PPX = globalThis.PPX || {};
    globalThis.PPX.recarregar = {
      cfg,
      ligar,
      agora: recarregarAgora,
      prazo: () => prazo,
      parar: () => clearInterval(relogio),
    };

    if (typeof module !== 'undefined' && module.exports)
      module.exports = { minutosValidos, prazoDe, decidir, faltam, MINUTOS_MIN, MINUTOS_MAX, MINUTOS_PADRAO, EM_USO, ADIAR };
  },
);
