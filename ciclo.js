// O ciclo da loja: sai da caçada, vai ao Mark, vende, reabastece e volta para onde estava.
//
// Tudo aqui foi medido na conta real em 09/10/2026. As quatro medidas que moldaram o codigo:
//
//  - **Falar com NPC exige estar perto.** Clicar por codigo no botao de um NPC distante nao faz
//    nada, mesmo com o botao no DOM e visivel. So o NPC ao lado responde.
//  - **Os botoes de NPC nao dizem quem sao.** O nome e' desenhado no mapa; no DOM todos sao
//    `.npc-plate-btn`. Por isso aqui se tenta falar e se LE o dialogo: o unico que vale e' o que
//    se apresenta como Mark. So se tenta botao "Conversar" — "Usar maquina" e' a slot machine,
//    e apostar por engano seria o pior jeito de descobrir isso.
//  - **Andar por codigo so funciona com a tecla segurada.** `keydown` seguido de `keyup`
//    imediato nao move nada: o `keyup` cancela. Repetindo `keydown` e soltando so no fim, anda
//    um tile por tecla.
//  - **Ir em linha reta ate o alvo trava em parede.** Medido: o personagem encosta no balcao e
//    insiste para sempre. Por isso aqui se anda numa direcao so (o trajeto do mercado ate o Mark
//    e' reto para cima) e se para assim que o mapa deixa de rolar.
//
PPX.modulo(
  { id: 'ciclo', nome: 'Ciclo da loja', atalhos: 'Alt+K roda o ciclo', efeito: false, proprio: false },
  () => {
    const MINHA_VEZ = 'ciclo';

    const PASSO_MS = 130; // entre dois `keydown`; abaixo disto o jogo perde teclas
    const MAX_PASSOS = 60; // teto duro da caminhada, para nunca andar para sempre
    const PARADO_LIMITE = 3; // quantas leituras iguais ate aceitar que bateu na parede

    // Os tetos moram no modulo da loja, que e' quem tem o painel. Um dono so' para o mesmo
    // numero: dois seria o jeito mais facil de comprar pela configuracao errada.
    const tetos = () => globalThis.PPX?.loja?.cfg?.tetos || {};

    // O compasso vem do `pausa.js`, que tem um dono so': a pausa pedida e' o chao, e por cima
    // dela vai um sorteio. Sem o modulo (num teste, por exemplo) espera-se o pedido, e pronto.
    const esperar = (ms) =>
      globalThis.PPX?.pausa ? globalThis.PPX.pausa(ms) : new Promise((r) => setTimeout(r, ms));
    const botoes = () => [...document.querySelectorAll('button')];
    const porTitulo = (t) => botoes().find((b) => (b.title || '').trim() === t);
    const porTexto = (re) => botoes().find((b) => re.test((b.textContent || '').trim()));

    // --- onde estamos -----------------------------------------------------------------------

    /** "Nível 267 · Shopping" -> "Shopping". E' assim que se sabe para onde voltar. */
    const local = () => {
      const t = document.querySelector('.phud-tloc')?.textContent || '';
      const p = t.split('·');
      return p.length > 1 ? p[p.length - 1].trim() : '';
    };

    // --- caminhar ---------------------------------------------------------------------------

    const COD = { ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39 };

    const tecla = (tipo, dir) =>
      dispatchEvent(
        new KeyboardEvent(tipo, {
          key: dir,
          code: dir,
          keyCode: COD[dir],
          which: COD[dir],
          bubbles: true,
          cancelable: true,
        }),
      );

    /**
     * Onde o mapa esta', lido pela soma das posicoes dos NPCs. Nao interessa o valor: interessa
     * que ele muda quando o personagem anda e para de mudar quando ele bate numa parede.
     */
    const posicaoDoMapa = () =>
      [...document.querySelectorAll('.npc-plate-btn')]
        .map((b) => {
          const r = b.getBoundingClientRect();
          return Math.round(r.x) + Math.round(r.y);
        })
        .join(',');

    /**
     * Anda ate `passos` tiles numa direcao, parando sozinho quando o mapa deixa de rolar.
     * Devolve quantos passos tiveram efeito.
     */
    async function andar(dir, passos) {
      let andou = 0;
      let parado = 0;
      let antes = posicaoDoMapa();
      for (let i = 0; i < Math.min(passos, MAX_PASSOS); i += 1) {
        tecla('keydown', dir);
        await esperar(PASSO_MS);
        const agora = posicaoDoMapa();
        if (agora === antes) {
          parado += 1;
          if (parado >= PARADO_LIMITE) break;
        } else {
          parado = 0;
          andou += 1;
        }
        antes = agora;
      }
      tecla('keyup', dir);
      await esperar(300);
      return andou;
    }

    // --- o Mark ------------------------------------------------------------------------------

    const dialogo = () => document.querySelector('.npc-dialog');
    const fecharJanela = async () => {
      const x =
        document.querySelector('.win-overlay .nsh-x') ||
        [...document.querySelectorAll('.win-overlay button')].find(
          (b) => b.textContent.trim() === '×',
        );
      if (x) {
        x.click();
        await esperar(600);
      }
    };

    /**
     * Tenta falar com cada NPC "Conversar" ao alcance e devolve `true` se um deles for o Mark.
     *
     * So "Conversar": "Usar maquina" e' a slot machine, e apostar por engano seria o pior jeito
     * possivel de descobrir que se clicou no NPC errado.
     */
    async function acharMark() {
      const alvos = [...document.querySelectorAll('.npc-plate-btn')]
        .filter((b) => /Conversar/.test(b.textContent || ''))
        .map((b) => {
          const r = b.getBoundingClientRect();
          const dx = r.x + r.width / 2 - innerWidth / 2;
          const dy = r.y + r.height / 2 - innerHeight / 2;
          return { b, d: Math.hypot(dx, dy) };
        })
        .sort((a, z) => a.d - z.d)
        .slice(0, 4);

      for (const { b } of alvos) {
        b.click();
        await esperar(900);
        const d = dialogo();
        if (d && /\bMark\b/.test(d.innerText || '')) return true;
        if (d) await fecharJanela();
      }
      return false;
    }

    async function abrirLojaDoMark() {
      const b = porTexto(/Abrir Loja/);
      if (!b) return false;
      b.click();
      await esperar(1600);
      return !!document.querySelector('.mks-window');
    }

    // --- estoque ------------------------------------------------------------------------------

    /**
     * Quanto se tem de um item, lido do inventario. `null` quando nao da' para saber — e nao
     * saber inclui o caso real de o jogo mostrar "9999+", que e' um teto de exibicao, nao um
     * numero. Quem nao sabe quanto tem nao compra "a diferenca".
     */
    async function estoque(nome) {
      const inv = porTitulo('Inventário');
      if (!inv) return null;
      if (!document.querySelector('.inv-window')) {
        inv.click();
        await esperar(1600);
      }
      const slot = [...document.querySelectorAll('.inv-slot')].find(
        (s) => (s.querySelector('img')?.alt || '').trim() === nome,
      );
      if (!slot) return 0;
      const txt = (slot.querySelector('.inv-qty')?.textContent || '1').trim();
      if (/\+/.test(txt)) return Infinity;
      const v = parseInt(txt.replace(/\D/g, ''), 10);
      return Number.isFinite(v) ? v : null;
    }

    const fecharInventario = async () => {
      const w = document.querySelector('.inv-window');
      if (!w) return;
      const x =
        w.querySelector('.nsh-x') ||
        [...w.querySelectorAll('button')].find((b) => b.textContent.trim() === '×');
      if (x) {
        x.click();
        await esperar(700);
      }
    };

    // --- o ciclo -------------------------------------------------------------------------------

    let rodando = false;
    let contar = null;
    const relato = [];
    const nota = (txt) => {
      relato.push(txt);
      if (contar) contar(txt);
      console.log('[ciclo]', txt);
    };

    const esperarAVez = async () => {
      const vez = globalThis.PPX?.vez;
      if (!vez?.pedir) return () => {};
      return vez.pedir(MINHA_VEZ);
    };

    async function voltarPara(hunt) {
      if (!hunt) return false;
      await fecharInventario();
      await fecharJanela();
      const mapa = porTitulo('Mapa');
      if (!mapa) return false;
      mapa.click();
      await esperar(1800);
      const alvo = [...document.querySelectorAll('.hunt-marker')].find(
        (m) => (m.title || '') === `Viajar para ${hunt}` || m.textContent.trim() === hunt,
      );
      if (!alvo) {
        nota(`Nao achei "${hunt}" no mapa — voce fica onde esta'.`);
        return false;
      }
      alvo.click();
      await esperar(2500);
      return true;
    }

    /**
     * O ciclo inteiro. Cada etapa confirma que aconteceu antes da proxima: nenhuma delas e'
     * assumida. Se uma falhar, o ciclo para e tenta voltar para a cacada — ficar parado no
     * shopping e' pior do que nao ter saido.
     */
    async function rodar(vender, comprar, diz) {
      if (rodando) return;
      rodando = true;
      contar = diz || null;
      relato.length = 0;
      let soltar = null;
      const hunt = local();

      try {
        soltar = await esperarAVez();
        if (!soltar) return;
        nota(`Saindo de "${hunt}".`);

        // 1. cidade
        const cerulean = porTitulo('Voltar para Cerulean');
        if (!cerulean) {
          nota('Nao achei o botao de voltar para Cerulean. Parei.');
          return;
        }
        cerulean.click();
        await esperar(3000);

        // 2. mercado
        const mercado = porTexto(/Ir ao Mercado/);
        if (!mercado) {
          nota('Nao achei "Ir ao Mercado". Parei em Cerulean.');
          return;
        }
        mercado.click();
        await esperar(3000);

        // 3. norte ate o Mark — o trajeto e' reto, e a caminhada para sozinha na parede
        let achou = await acharMark();
        for (let tent = 0; !achou && tent < 6; tent += 1) {
          const andou = await andar('ArrowUp', 6);
          if (!andou) break;
          achou = await acharMark();
        }
        if (!achou) {
          nota('Nao cheguei ao Mark. Voltando para a caçada.');
          return;
        }
        if (!(await abrirLojaDoMark())) {
          nota('Falei com o Mark mas a loja nao abriu. Voltando.');
          return;
        }
        nota('Loja aberta.');

        // 4. venda
        if (vender) {
          const r = await vender();
          nota(r);
        }

        // 5. compras ate o teto
        if (comprar) {
          for (const [nome, teto] of Object.entries(tetos())) {
            if (!teto) continue;
            await fecharInventario();
            const tem = await estoque(nome);
            await fecharInventario();
            if (tem === Infinity) {
              nota(`${nome}: ja' passa de 9999, nao comprei.`);
              continue;
            }
            if (tem === null) {
              nota(`${nome}: nao consegui ler o estoque, nao comprei.`);
              continue;
            }
            const falta = teto - tem;
            if (falta <= 0) {
              nota(`${nome}: ${tem}/${teto}, nada a comprar.`);
              continue;
            }
            const r = await comprar(nome, falta);
            nota(`${nome}: ${tem} -> ${tem + (r?.comprou || 0)} (alvo ${teto})`);
          }
        }
      } finally {
        await fecharInventario();
        await fecharJanela();
        const voltou = await voltarPara(hunt);
        nota(voltou ? `De volta a "${hunt}".` : 'Nao consegui voltar sozinho.');
        if (soltar) soltar();
        rodando = false;
        contar = null;
      }
    }

    // A loja publica `comprar` e `venderAgora`; o ciclo so' os encadeia. Se o pacote rodar sem o
    // modulo da loja, o ciclo ainda anda ate la' e abre — so' nao compra nem vende.
    const daLoja = () => globalThis.PPX?.loja || {};

    addEventListener(
      'keydown',
      (e) => {
        if (!e.altKey || e.ctrlKey || e.shiftKey) return;
        if (e.key.toLowerCase() !== 'k') return;
        const alvo = e.target;
        if (alvo && (alvo.isContentEditable || /^(input|textarea|select)$/i.test(alvo.tagName)))
          return;
        e.preventDefault();
        e.stopPropagation();
        const l = daLoja();
        rodar(l.venderAgora, l.comprar);
      },
      true,
    );

    // --- agenda ------------------------------------------------------------------------------
    //
    // O calendario e' o mesmo arquivo do pacote do PokePixel, copiado sem alteracao: janelas de
    // horario, filtro de dias e um instante sorteado dentro da janela. A conta nao se reescreve
    // aqui — foi para ter um dono so' que ela saiu de dentro das ferramentas la'.

    const CHAVE_AG = 'lioncode:pokeidleworld:ciclo:agenda';
    let cfgAg = { dias: '', horarios: '' };
    try {
      const cru = localStorage.getItem(CHAVE_AG);
      if (cru) cfgAg = { ...cfgAg, ...JSON.parse(cru) };
    } catch (e) {
      /* fica o padrao: sem agenda */
    }

    let prazo = 0;
    let ultima = 0;

    const gravarAg = () => {
      try {
        localStorage.setItem(CHAVE_AG, JSON.stringify(cfgAg));
      } catch (e) {
        /* janela sem armazenamento: vale so para esta sessao */
      }
    };

    /**
     * Marca a proxima rodada. Reagenda-se sozinha depois de cada uma.
     *
     * O despertador e' um `setTimeout`, e em aba oculta o navegador o estrangula para uma vez
     * por minuto. Para um horario marcado isso basta — perde-se precisao de segundos, nao a
     * rodada. (Para a captura seria fatal, e por isso la' o motor e' um `MutationObserver`.)
     */
    function reagendar() {
      clearTimeout(prazo);
      const ag = globalThis.PPX?.agenda;
      if (!ag || !ag.valida?.(cfgAg)) return;
      const espera = ag.esperaDaAgenda(cfgAg, ultima);
      if (espera === null) return;
      prazo = setTimeout(async () => {
        ultima = Date.now();
        const l = globalThis.PPX?.loja || {};
        await rodar(l.venderAgora, l.comprar);
        reagendar();
      }, espera);
    }

    /**
     * O editor de agenda, para o painel da loja encaixar. O desenho e' do calendario, nao daqui:
     * o campo de dias vem dele, e o de horarios entra dentro do corpo que ele abre — assim a
     * parte de configurar abre e fecha inteira, em vez de meia dentro e meia fora.
     */
    function controlesDaAgenda(aoMudar) {
      const ag = globalThis.PPX?.agenda;
      if (!ag?.montarControles) return null;

      const horarios = document.createElement('input');
      horarios.type = 'text';
      horarios.placeholder = '08:00-09:00, 20:00-21:00';
      horarios.value = cfgAg.horarios || '';
      horarios.title = 'Janelas de horário. O ciclo roda uma vez dentro de cada uma.';

      const editor = ag.montarControles({
        resumoDe: (dias) => ag.resumo({ dias, horarios: horarios.value.trim() }),
      });
      if (!editor) return null;
      editor.campo.value = cfgAg.dias || '';

      const linha = document.createElement('div');
      linha.className = 'ljx-l';
      const rot = document.createElement('span');
      rot.textContent = 'Horários';
      linha.append(rot, horarios);
      editor.corpo.appendChild(linha);

      const guardar = () => {
        cfgAg.dias = editor.campo.value.trim();
        cfgAg.horarios = horarios.value.trim();
        gravarAg();
        reagendar();
        if (aoMudar) aoMudar(ag.resumo(cfgAg) || 'sem agenda');
      };
      editor.campo.addEventListener('change', guardar);
      horarios.addEventListener('change', guardar);
      return editor;
    }

    reagendar();

    globalThis.PPX = globalThis.PPX || {};
    globalThis.PPX.ciclo = {
      rodar,
      andar,
      acharMark,
      estoque,
      local,
      relato,
      cfgAg,
      reagendar,
      controlesDaAgenda,
      proxima: () => {
        const ag = globalThis.PPX?.agenda;
        if (!ag?.valida?.(cfgAg)) return '';
        return ag.resumo(cfgAg);
      },
    };

    if (typeof module !== 'undefined' && module.exports)
      module.exports = { rodar, andar, acharMark, estoque, local, voltarPara };
  },
);
