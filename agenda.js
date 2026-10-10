// PokePixel - qualidade de vida: o calendario partilhado das automacoes.
//
// POR QUE ISTO EXISTE. As tres ferramentas que agem sozinhas — venda, compra e ginasio — tinham a
// mesma logica de horarios escrita tres vezes, copiada de uma para a outra. Acrescentar "uma vez
// por semana" e "uma vez por mes" em tres copias seria acrescentar o mesmo defeito em tres lugares
// e corrigi-lo em dois. Entao o calendario passou a ser um so'.
//
// A IDEIA QUE ENCURTOU O PROBLEMA. "Uma vez por semana as 20h" nao e' um modo novo de agendar: e'
// a janela de horario que ja' existia, com um **filtro de dia** por cima. "Todo dia 15" tambem.
// Assim tudo partilha a mesma maquina — janela, instante sorteado dentro dela e uma rodada por
// ocorrencia — e o que muda e' so' quais dias contam.
//
// E POR QUE OS DIAS SAO UM CAMPO DE TEXTO. A primeira versao disto tinha sete caixinhas para a
// semana, um seletor de "dias do mes ou dia da semana" e outro para "primeira/ultima". Sao dez
// controles, em tres paineis que ja' vivem apertados, para dizer o que cabe em duas palavras:
// "ultima sexta". O campo de texto e' o mesmo idioma do "08:00-09:00" que ja' estava ali, e some
// quando nao e' usado — vazio quer dizer todo dia, que e' como as tres ferramentas ja' se
// comportavam.
//
// AS FUNCOES SAO PURAS DE PROPOSITO. Nada aqui toca no DOM nem no armazenamento: entra
// configuracao e um instante, sai quanto falta. E' o que permite exercitar virada de mes, ano
// bissexto e "dia 31" em `testes/agenda.test.mjs`, em vez de esperar o calendario chegar la'.

(() => {
  'use strict';

  /** Os dias da semana como o `getDay` do JavaScript os conta: 0 e' domingo. */
  const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

  /** O que se aceita escrever para cada dia. Sem acento tambem vale: ninguem escreve "sabado" com. */
  const APELIDOS = [
    ['domingo', 'dom', 'd'],
    ['segunda', 'segunda-feira', 'seg', '2a'],
    ['terca', 'terça', 'terca-feira', 'terça-feira', 'ter', '3a'],
    ['quarta', 'quarta-feira', 'qua', '4a'],
    ['quinta', 'quinta-feira', 'qui', '5a'],
    ['sexta', 'sexta-feira', 'sex', '6a'],
    ['sabado', 'sábado', 'sab', 'sáb', 's'],
  ];

  /** Os ordinais que valem antes de um dia da semana: "primeira sexta", "ultima segunda". */
  const ORDINAIS = [
    [1, ['primeira', 'primeiro', '1a', '1']],
    [2, ['segunda-do-mes', 'segundo', '2o']],
    [3, ['terceira', 'terceiro', '3a', '3']],
    [4, ['quarta-do-mes', 'quarto', '4o']],
    [-1, ['ultima', 'última', 'ultimo', 'último', 'derradeira']],
  ];

  const semAcento = (t) =>
    String(t)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim();

  /**
   * As janelas de horario lidas de "08:00-09:00, 19:00-20:00".
   *
   * Uma janela que termina antes de comecar atravessa a meia-noite: 22:00-02:00 vale assim, e
   * pertence ao dia em que **abre** — e' o unico jeito de "sexta a' noite" querer dizer o que
   * qualquer pessoa entende por isso.
   */
  const janelasDe = (texto) => {
    const achadas = [];
    for (const parte of String(texto ?? '').split(/[;,]/)) {
      const casa =
        /^\s*(\d{1,2})(?::(\d{2}))?\s*h?\s*(?:-|as|ate|até)\s*(\d{1,2})(?::(\d{2}))?\s*h?\s*$/i.exec(
          parte,
        );
      if (!casa) continue;
      const minuto = (hora, min) => (Number(hora) % 24) * 60 + (Number(min ?? 0) % 60);
      achadas.push({ inicio: minuto(casa[1], casa[2]), fim: minuto(casa[3], casa[4]) });
    }
    return achadas;
  };

  const diaDaSemanaDe = (palavra) => {
    const limpo = semAcento(palavra);
    const onde = APELIDOS.findIndex((nomes) => nomes.some((n) => semAcento(n) === limpo));
    return onde >= 0 ? onde : null;
  };

  const ordinalDe = (palavra) => {
    const limpo = semAcento(palavra);
    const achado = ORDINAIS.find(([, nomes]) => nomes.some((n) => semAcento(n) === limpo));
    return achado ? achado[0] : null;
  };

  /**
   * As regras de dia lidas de um campo de texto.
   *
   * Cada pedaco separado por virgula vira uma regra, e um dia passa se bater com **qualquer** uma
   * delas. E' por isso que nao ha' modo nenhum a escolher: "seg, 15" quer dizer segundas e o dia
   * 15, e as duas coisas juntas sao exactamente o que esta' escrito.
   *
   *   (vazio)            todo dia — e' como as tres ferramentas sempre se comportaram
   *   seg, qui           toda semana, nos dias escolhidos
   *   1, 15              todo mes, nos dias escolhidos
   *   ultimo             o ultimo dia de cada mes, seja ele 28, 29, 30 ou 31
   *   ultima sexta       todo mes, no dia da semana escolhido
   *   primeira segunda   idem, contando do inicio
   *
   * O que nao for reconhecido vira uma regra `ruim`, e nao desaparece em silencio: e' ela que faz o
   * campo ficar marcado em vez de o relogio ficar ligado sem nunca disparar.
   */
  const regrasDe = (texto) => {
    const regras = [];
    for (const parte of String(texto ?? '').split(/[;,]/)) {
      const bruto = parte.trim();
      if (!bruto) continue;
      const palavras = bruto.split(/\s+/);

      if (palavras.length === 1) {
        const semana = diaDaSemanaDe(palavras[0]);
        if (semana !== null) {
          regras.push({ tipo: 'semana', dia: semana });
          continue;
        }
        if (/^[uú]ltimo$/i.test(semAcento(palavras[0]))) {
          regras.push({ tipo: 'mes', dia: 'ultimo' });
          continue;
        }
        const n = Number(palavras[0]);
        if (Number.isInteger(n) && n >= 1 && n <= 31) {
          regras.push({ tipo: 'mes', dia: n });
          continue;
        }
      }

      if (palavras.length === 2) {
        const ordinal = ordinalDe(palavras[0]);
        const semana = diaDaSemanaDe(palavras[1]);
        if (ordinal !== null && semana !== null) {
          regras.push({ tipo: 'ordinal', ordinal, dia: semana });
          continue;
        }
      }

      regras.push({ tipo: 'ruim', texto: bruto });
    }
    return regras;
  };

  const ultimoDiaDoMes = (data) => new Date(data.getFullYear(), data.getMonth() + 1, 0).getDate();
  /** Em que semana do mes cai este dia: 1 para o primeiro, 2 para o segundo... */
  const ordinalNoMes = (data) => Math.floor((data.getDate() - 1) / 7) + 1;
  /** E' a ultima ocorrencia deste dia da semana no mes? */
  const eUltimaNoMes = (data) => data.getDate() + 7 > ultimoDiaDoMes(data);

  /**
   * Este dia conta?
   *
   * Sem regra nenhuma, todo dia conta — e' o comportamento que as ferramentas ja' tinham, e mexer
   * nele quebraria quem so' usa horarios.
   */
  const diaPassa = (data, texto) => {
    const todas = regrasDe(texto);
    // **Texto que nao se entendeu nao vira "todo dia".** Era o que acontecia, e e' o pior dos dois
    // erros: quem escreveu "ultima quarta" com um engano teria a automacao rodando **todos os
    // dias** em vez de uma vez por mes. Nao agir e' recuperavel; agir trinta vezes nao e'.
    if (todas.some((r) => r.tipo === 'ruim')) return false;
    const regras = todas;
    if (!regras.length) return true;
    return regras.some((r) => {
      if (r.tipo === 'semana') return data.getDay() === r.dia;
      if (r.tipo === 'mes')
        return r.dia === 'ultimo'
          ? data.getDate() === ultimoDiaDoMes(data)
          : data.getDate() === r.dia;
      if (r.tipo === 'ordinal')
        return (
          data.getDay() === r.dia &&
          (r.ordinal === -1 ? eUltimaNoMes(data) : ordinalNoMes(data) === r.ordinal)
        );
      return false;
    });
  };

  /**
   * Quantos dias para a frente vale a pena procurar.
   *
   * "Dia 31" pode levar dois meses para repetir, e uma agenda impossivel nao pode virar uma volta
   * infinita. 400 cobre qualquer combinacao com folga e custa nada numa conta que roda uma vez por
   * agendamento.
   */
  const HORIZONTE = 400;

  /**
   * As ocorrencias, em ordem: cada janela que abre num dia que passa no filtro.
   *
   * Comeca em ontem por causa das janelas que atravessam a meia-noite — uma que abriu as 22:00 de
   * ontem ainda esta' aberta a' 01:00 de hoje. Quem descarta o que ja' passou e' `esperaDaAgenda`.
   */
  const ocorrenciasDe = function* (cfg, agora) {
    const janelas = janelasDe(cfg?.horarios);
    if (!janelas.length) return;
    // Ordenadas dentro do dia: no texto elas podem vir em qualquer ordem.
    const ordenadas = [...janelas].sort((a, b) => a.inicio - b.inicio);
    for (let salto = -1; salto <= HORIZONTE; salto += 1) {
      const dia = new Date(agora);
      dia.setHours(0, 0, 0, 0);
      dia.setDate(dia.getDate() + salto);
      if (!diaPassa(dia, cfg?.dias)) continue;
      for (const { inicio, fim } of ordenadas) {
        const abre = new Date(dia);
        abre.setMinutes(inicio);
        const duracao = ((fim - inicio + 1440) % 1440 || 1440) * 60000;
        yield { abre: abre.getTime(), fecha: abre.getTime() + duracao };
      }
    }
  };

  /**
   * Quanto falta ate' o instante sorteado da proxima ocorrencia — ou `null` se nao ha' nenhuma.
   *
   * O instante e' sorteado **dentro** da janela, e nao na abertura: agir sempre as 08:00 em ponto
   * e' o padrao mais visivel que existe. Com a janela ja' aberta, o sorteio vale do momento atual
   * ate' o fechamento.
   *
   * `ultima` e' o carimbo da ultima rodada, e e' o que garante **uma rodada por ocorrencia**: uma
   * janela que abriu antes dela ja' foi usada. E' tambem o que faz uma ocorrencia perdida — o
   * computador estava desligado — ficar perdida, em vez de disparar de madrugada ao ligar.
   */
  const esperaDaAgenda = (cfg, ultima = 0, agora = new Date(), sorteio = Math.random) => {
    const quando = agora.getTime();
    for (const { abre, fecha } of ocorrenciasDe(cfg, agora)) {
      if (fecha <= quando || abre <= ultima) continue;
      const comeco = Math.max(abre, quando);
      if (comeco >= fecha) continue;
      return comeco - quando + sorteio() * (fecha - comeco);
    }
    return null;
  };

  /** Os pedacos do campo de dias que nao foram entendidos. Vazio quer dizer que esta' tudo certo. */
  const diasNaoEntendidos = (texto) => regrasDe(texto).filter((r) => r.tipo === 'ruim').map((r) => r.texto);

  /**
   * A agenda em uma linha, em portugues.
   *
   * O painel e' pequeno e a agenda tem varios campos; sem esta linha, saber o que ficou combinado
   * obriga a reler os controles um a um.
   */
  const resumo = (cfg) => {
    if (!janelasDe(cfg?.horarios).length) return '';
    const horas = String(cfg.horarios).trim();
    const regras = regrasDe(cfg?.dias).filter((r) => r.tipo !== 'ruim');
    if (!regras.length) return `todo dia · ${horas}`;
    const palavra = (r) => {
      if (r.tipo === 'semana') return SEMANA[r.dia];
      if (r.tipo === 'mes') return r.dia === 'ultimo' ? 'último dia do mês' : `dia ${r.dia}`;
      const qual = r.ordinal === -1 ? 'última' : `${r.ordinal}ª`;
      return `${qual} ${SEMANA[r.dia]} do mês`;
    };
    return `${regras.map(palavra).join(', ')} · ${horas}`;
  };

  /**
   * A agenda esta' completa o bastante para disparar alguma coisa?
   *
   * Serve para o painel marcar o campo que falta em vez de ligar um relogio que nunca dispara:
   * "ligado" com uma agenda impossivel e' a pior das duas mentiras.
   */
  const valida = (cfg) => {
    if (cfg?.modo === 'minutos') return true;
    if (!janelasDe(cfg?.horarios).length) return false;
    if (diasNaoEntendidos(cfg?.dias).length) return false;
    // Um dia escrito certo mas que nunca chega — nao existe: toda regra aceita acontece em algum
    // mes. Mesmo assim, confirma-se com a propria maquina, que e' quem sabe.
    return esperaDaAgenda(cfg, 0, new Date(), () => 0) !== null;
  };

  // ------------------------------------------------- do texto para os controles
  //
  // O texto continua sendo o formato guardado e a unica entrada da maquina de cima: e' ele que os
  // testes exercitam, e nada aqui muda a conta. O que muda e' quem o escreve — agora sao listas,
  // e nao a pessoa. Quem ja' tinha escrito a mao continua valendo: as listas leem o texto de volta.

  /** O estado dos controles, lido de um texto de dias. */
  const paraControles = (texto) => {
    const regras = regrasDe(texto);
    const vazio = { tipo: 'todos', semana: [], mesDias: [], ordinal: -1, dia: 5 };
    if (!regras.length) return vazio;
    if (regras.some((r) => r.tipo === 'ruim')) return { ...vazio, tipo: 'todos' };
    if (regras.every((r) => r.tipo === 'semana'))
      return { ...vazio, tipo: 'semana', semana: regras.map((r) => r.dia) };
    if (regras.every((r) => r.tipo === 'mes'))
      return { ...vazio, tipo: 'mes', mesDias: regras.map((r) => r.dia) };
    if (regras.length === 1 && regras[0].tipo === 'ordinal')
      return { ...vazio, tipo: 'ordinal', ordinal: regras[0].ordinal, dia: regras[0].dia };
    // Mistura escrita a mao ("seg, 15"): as listas nao sabem representar isso, e sobrescrever seria
    // apagar em silencio o que a pessoa montou. Fica como texto, e o painel mostra so' o resumo.
    return { ...vazio, tipo: 'texto', texto: String(texto ?? '') };
  };

  /** O texto de dias, escrito a partir do estado dos controles. */
  const deControles = (estado) => {
    if (!estado) return '';
    if (estado.tipo === 'texto') return String(estado.texto ?? '');
    if (estado.tipo === 'semana')
      return (estado.semana || [])
        .slice()
        .sort((a, b) => a - b)
        .map((d) => SEM_ACENTO[d])
        .join(', ');
    if (estado.tipo === 'mes')
      return (estado.mesDias || [])
        .slice()
        .sort((a, b) => (a === 'ultimo' ? 1 : b === 'ultimo' ? -1 : a - b))
        .join(', ');
    if (estado.tipo === 'ordinal')
      return `${ORDINAL_TEXTO[String(estado.ordinal)]} ${SEM_ACENTO[estado.dia]}`;
    return '';
  };

  /** Como cada dia e cada ordinal sao **escritos** no texto guardado. */
  const SEM_ACENTO = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
  const ORDINAL_TEXTO = { '1': 'primeira', '2': 'segundo', '3': 'terceira', '4': 'quarto', '-1': 'ultima' };

  // --------------------------------------------------------- os controles
  //
  // POR QUE AS LISTAS, DEPOIS DE EU TER ESCOLHIDO TEXTO. A primeira versao disto pedia os dias num
  // campo de texto — "ultima sexta", "1, 15" — e o argumento era o espaco: tres paineis apertados
  // nao cabem sete caixinhas e dois seletores. O argumento caiu quando a parte passou a ficar
  // **fechada**: quem configura isto o faz poucas vezes, e entao a tela pode ser larga enquanto
  // estiver aberta. Decorar uma sintaxe para usar tres vezes por ano e' o pior dos dois mundos.
  //
  // O TEXTO CONTINUA SENDO O FORMATO. O que se guarda, e o que a maquina de cima le', e' o mesmo
  // texto de antes — as listas so' o escrevem. Assim nada do calendario mudou, os testes de mesa
  // continuam valendo, e quem ja' tinha escrito a mao nao perde nada: as listas leem de volta.

  let estiloPosto = false;
  const porEstilo = () => {
    if (estiloPosto || typeof document === 'undefined') return;
    estiloPosto = true;
    const el = document.createElement('style');
    el.textContent = [
      '.ppx-ag { display: inline-flex; flex-direction: column; gap: 4px; align-items: stretch; }',
      '.ppx-ag-abre { background: #1d2433; color: #cfd6e4; border: 1px solid #2a3244;',
      '  border-radius: 6px; padding: 2px 7px; font: inherit; font-size: 12px; cursor: pointer;',
      '  display: inline-flex; gap: 6px; align-items: center; text-align: left; }',
      '.ppx-ag-abre:hover { border-color: #3d4860; }',
      '.ppx-ag-abre .seta { color: #7f8ba1; margin-left: auto; }',
      '.ppx-ag-corpo { display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-start;',
      '  background: #10151e; border: 1px solid #2a3244; border-radius: 7px; padding: 7px; }',
      '.ppx-ag-corpo[hidden] { display: none; }',
      '.ppx-ag-corpo label { display: flex; flex-direction: column; gap: 3px; font-size: 11px;',
      '  color: #8b97a8; }',
      '.ppx-ag-corpo label[hidden] { display: none; }',
      '.ppx-ag-corpo select, .ppx-ag-corpo input { background: #0d1219; color: #e7edf6;',
      '  border: 1px solid #2a3244; border-radius: 5px; padding: 3px 5px; font: inherit;',
      '  font-size: 12px; }',
      '.ppx-ag-corpo select[multiple] { padding: 2px; }',
    ].join('\n');
    document.head.append(el);
  };

  const opcao = (valor, texto) => {
    const o = document.createElement('option');
    o.value = String(valor);
    o.textContent = texto;
    return o;
  };

  /**
   * Monta o editor de dias: um botao que mostra a agenda combinada e abre as listas.
   *
   * Devolve `{ el, corpo, campo, escrever, resumir }`. `campo` e' um `input` escondido com o texto
   * — e' ele que o painel le' e grava, exactamente como lia antes. As listas so' escrevem nele e
   * disparam `change`, entao toda a fiacao que ja' existia continua de pe' e os testes de mesa
   * continuam a valer.
   *
   * `corpo` fica exposto para o painel pendurar ali os proprios controles (o modo, os minutos, os
   * horarios): assim a parte de configurar abre e fecha inteira, que foi o pedido.
   */
  const montarControles = ({ resumoDe } = {}) => {
    porEstilo();
    const el = document.createElement('div');
    el.className = 'ppx-ag';

    const abre = document.createElement('button');
    abre.type = 'button';
    abre.className = 'ppx-ag-abre';
    abre.title = 'Abrir a agenda';
    const linha = document.createElement('span');
    linha.dataset.agResumo = '';
    const seta = document.createElement('span');
    seta.className = 'seta';
    seta.textContent = '▾';
    abre.append(linha, seta);

    const corpo = document.createElement('div');
    corpo.className = 'ppx-ag-corpo';
    corpo.hidden = true;

    // O texto continua sendo o valor guardado. Escondido, porque agora quem o escreve sao as listas.
    const campo = document.createElement('input');
    campo.type = 'hidden';
    campo.setAttribute('data-dias', '');

    const tipo = document.createElement('select');
    // Marcados, porque o painel pendura os proprios controles dentro do mesmo corpo: sem isto, um
    // `querySelector('select')` daqui pega o seletor de modo da ferramenta, e nao este.
    tipo.dataset.agTipo = '';
    for (const [v, t] of [
      ['todos', 'todo dia'],
      ['semana', 'dias da semana'],
      ['mes', 'dias do mês'],
      ['ordinal', 'um dia por mês'],
    ])
      tipo.append(opcao(v, t));
    const rotuloTipo = document.createElement('label');
    rotuloTipo.append('repetir', tipo);

    const semana = document.createElement('select');
    semana.dataset.agSemana = '';
    semana.multiple = true;
    semana.size = 7;
    SEMANA.forEach((nome, i) => semana.append(opcao(i, nome)));
    const rotuloSemana = document.createElement('label');
    rotuloSemana.append('nos dias', semana);

    const mesDias = document.createElement('select');
    mesDias.dataset.agMes = '';
    mesDias.multiple = true;
    mesDias.size = 8;
    for (let d = 1; d <= 31; d += 1) mesDias.append(opcao(d, 'dia ' + d));
    mesDias.append(opcao('ultimo', 'último dia'));
    const rotuloMes = document.createElement('label');
    rotuloMes.append('nos dias', mesDias);

    const ordinal = document.createElement('select');
    ordinal.dataset.agOrdinal = '';
    for (const [v, t] of [
      ['1', 'primeira'],
      ['2', 'segunda'],
      ['3', 'terceira'],
      ['4', 'quarta'],
      ['-1', 'última'],
    ])
      ordinal.append(opcao(v, t));
    const diaUnico = document.createElement('select');
    diaUnico.dataset.agDia = '';
    SEMANA.forEach((nome, i) => diaUnico.append(opcao(i, nome)));
    const rotuloOrdinal = document.createElement('label');
    rotuloOrdinal.append('qual', ordinal);
    const rotuloDiaUnico = document.createElement('label');
    rotuloDiaUnico.append('dia', diaUnico);

    corpo.append(rotuloTipo, rotuloSemana, rotuloMes, rotuloOrdinal, rotuloDiaUnico);
    el.append(abre, corpo, campo);

    const marcados = (lista) => [...lista.selectedOptions].map((o) => o.value);

    const resumir = () => {
      linha.textContent = (resumoDe ? resumoDe(campo.value) : '') || 'todo dia';
    };

    // "A cada tantos minutos" nao tem dia nenhum para escolher. O painel diz por aqui se os dias
    // interessam; o estado vive numa variavel e nao no `hidden` de cada rotulo, senao esconder uma
    // vez seria esconder para sempre.
    let comDias = true;
    const mostrarCertos = () => {
      rotuloTipo.hidden = !comDias;
      rotuloSemana.hidden = !comDias || tipo.value !== 'semana';
      rotuloMes.hidden = !comDias || tipo.value !== 'mes';
      rotuloOrdinal.hidden = !comDias || tipo.value !== 'ordinal';
      rotuloDiaUnico.hidden = !comDias || tipo.value !== 'ordinal';
    };
    const usarDias = (sim) => {
      comDias = sim !== false;
      mostrarCertos();
      resumir();
    };

    const recolher = () => {
      const estado = {
        tipo: tipo.value,
        ordinal: Number(ordinal.value),
        dia: Number(diaUnico.value),
      };
      if (tipo.value === 'semana') estado.semana = marcados(semana).map(Number);
      if (tipo.value === 'mes')
        estado.mesDias = marcados(mesDias).map((v) => (v === 'ultimo' ? 'ultimo' : Number(v)));
      campo.value = deControles(estado);
      mostrarCertos();
      resumir();
      campo.dispatchEvent(new Event('change', { bubbles: true }));
    };

    for (const c of [tipo, semana, mesDias, ordinal, diaUnico])
      c.addEventListener('change', recolher);

    /**
     * Poe nas listas o que estiver guardado, inclusive texto escrito a' mao numa versao anterior.
     *
     * Uma mistura que as listas nao sabem representar ("seg, 15") **nao** e' sobrescrita: apagar em
     * silencio o que a pessoa montou seria pior do que nao oferecer o controle.
     */
    const escrever = (texto) => {
      campo.value = String(texto ?? '');
      const estado = paraControles(campo.value);
      tipo.value = estado.tipo === 'texto' ? 'todos' : estado.tipo;
      for (const o of semana.options) o.selected = (estado.semana || []).includes(Number(o.value));
      for (const o of mesDias.options)
        o.selected = (estado.mesDias || []).some((d) => String(d) === o.value);
      ordinal.value = String(estado.ordinal ?? -1);
      diaUnico.value = String(estado.dia ?? 5);
      mostrarCertos();
      resumir();
    };

    const alternar = (abrir = corpo.hidden) => {
      corpo.hidden = !abrir;
      seta.textContent = corpo.hidden ? '▾' : '▴';
      abre.title = corpo.hidden ? 'Abrir a agenda' : 'Fechar a agenda';
    };
    abre.addEventListener('click', () => alternar());

    mostrarCertos();
    return { el, corpo, campo, escrever, resumir, alternar, usarDias, abre };
  };

  const API = {
    SEMANA,
    SEM_ACENTO,
    montarControles,
    paraControles,
    deControles,
    janelasDe,
    regrasDe,
    diaPassa,
    diasNaoEntendidos,
    /** As proximas `quantas` ocorrencias. Para a tela e para os testes. */
    ocorrencias: (cfg, agora = new Date(), quantas = 5) => {
      const fora = [];
      for (const o of ocorrenciasDe(cfg, agora)) {
        fora.push(o);
        if (fora.length >= quantas) break;
      }
      return fora;
    },
    esperaDaAgenda,
    resumo,
    valida,
    /** O que vai no `title` e no `placeholder` do campo de dias, escrito uma vez so'. */
    DICA_DIAS:
      'Vazio: todo dia. Exemplos: "seg, qui" · "1, 15" · "último" · "última sexta" · "primeira segunda".',
    EXEMPLO_DIAS: 'todo dia',
  };

  if (typeof globalThis.PPX === 'object' && globalThis.PPX) globalThis.PPX.agenda = API;
  // Para o teste de mesa: `new Function('module', fonte)`. Ver `testes/agenda.test.mjs`.
  if (typeof module === 'object' && module) module.exports = API;
})();
