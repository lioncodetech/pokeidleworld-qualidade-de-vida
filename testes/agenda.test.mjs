// Teste de mesa do calendário das automações.
//
// `agenda.js` é um content script, mas as funções dele são puras de propósito: entra configuração e
// um instante, sai quanto falta. É o que permite exercitar aqui a virada de mês, o ano bissexto e o
// "dia 31" — em vez de esperar o calendário chegar lá para descobrir.
//
// Rode com: node --test testes/*.test.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const fonte = readFileSync(new URL('../agenda.js', import.meta.url), 'utf8');
const caixa = { exports: {} };
new Function('module', fonte)(caixa);
const agenda = caixa.exports;

/** Um instante local legível, para as asserções falarem em datas e não em milissegundos. */
const quando = (ms) => {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const abrem = (dias, agora, quantas = 4, horarios = '20:00-21:00') =>
  agenda.ocorrencias({ dias, horarios }, agora, quantas).map((o) => quando(o.abre));
/** O instante que a agenda escolheria, sem sorteio, para a conta ser conferível. */
const proxima = (cfg, agora, ultima = 0) => {
  const falta = agenda.esperaDaAgenda(cfg, ultima, agora, () => 0);
  return falta === null ? null : quando(agora.getTime() + falta);
};

// Terça-feira, 6 de outubro de 2026, 10:00.
const TERCA = new Date(2026, 9, 6, 10, 0);

test('as janelas de horario continuam sendo lidas como sempre foram', () => {
  // Este formato já existia nas três ferramentas e não podia mudar: quem já tem uma agenda montada
  // não pode perdê-la por causa de uma funcionalidade nova.
  assert.deepEqual(agenda.janelasDe('08:00-09:00'), [{ inicio: 480, fim: 540 }]);
  assert.deepEqual(agenda.janelasDe('22:00-02:00'), [{ inicio: 1320, fim: 120 }]);
  // Lixo não vira janela: um campo malpreenchido não pode virar um relógio que dispara sozinho.
  assert.deepEqual(agenda.janelasDe('qualquer coisa'), []);
  assert.deepEqual(agenda.janelasDe(''), []);
  assert.deepEqual(agenda.janelasDe(null), []);
});

test('campo de dias vazio e todo dia, como sempre foi', () => {
  // **A compatibilidade que importa.** As três ferramentas já agendavam por janela de horário, sem
  // nenhuma ideia de dia. Quem atualizar o pacote tem de continuar com a agenda que montou.
  assert.equal(agenda.diaPassa(new Date(2026, 9, 6), ''), true);
  assert.equal(agenda.diaPassa(new Date(2026, 9, 6), undefined), true);
  assert.deepEqual(abrem('', TERCA, 2), ['2026-10-05 20:00', '2026-10-06 20:00']);
});

test('toda semana, nos dias escolhidos', () => {
  // "Uma vez por semana" é um dia escrito; "vários dias na semana" são vários. Não há modo a
  // escolher: o que está escrito é o que acontece.
  assert.equal(proxima({ dias: 'seg', horarios: '20:00-21:00' }, TERCA), '2026-10-12 20:00');
  assert.deepEqual(abrem('seg, qui', TERCA, 4).slice(1), [
    '2026-10-08 20:00',
    '2026-10-12 20:00',
    '2026-10-15 20:00',
  ]);
  // Acento e abreviatura são opcionais: ninguém escreve "sábado" com acento num campo apertado.
  assert.deepEqual(agenda.regrasDe('sabado'), agenda.regrasDe('sábado'));
  assert.deepEqual(agenda.regrasDe('ter'), agenda.regrasDe('terça-feira'));
});

test('todo mes, nos dias escolhidos — e o dia que o mes nao tem nao acontece', () => {
  // **A armadilha do mensal.** Dia 31 não existe em novembro nem em fevereiro. Arrastar para o dia
  // 1 seguinte seria agir num dia que ninguém pediu; recuar para o 30 seria o mesmo. Então aquele
  // mês não tem ocorrência, e pronto.
  assert.deepEqual(abrem('31', TERCA, 4, '08:00-09:00'), [
    '2026-10-31 08:00',
    '2026-12-31 08:00',
    '2027-01-31 08:00',
    '2027-03-31 08:00',
  ]);

  // Quem quer dizer "o fim do mês" escreve `último`, e aí todo mês tem um.
  assert.deepEqual(abrem('último', TERCA, 4, '08:00-09:00'), [
    '2026-10-31 08:00',
    '2026-11-30 08:00',
    '2026-12-31 08:00',
    '2027-01-31 08:00',
  ]);
  // Fevereiro de 2028 é bissexto: 29. (A busca começa em ontem, daí o 2 de fevereiro.)
  assert.deepEqual(abrem('ultimo', new Date(2028, 1, 2), 1, '08:00-09:00'), ['2028-02-29 08:00']);

  assert.deepEqual(abrem('1, 15', TERCA, 3, '08:00-09:00'), [
    '2026-10-15 08:00',
    '2026-11-01 08:00',
    '2026-11-15 08:00',
  ]);
});

test('todo mes, por dia da semana: a primeira e a ultima', () => {
  // **A última não é a quinta.** Um mês tem quatro ou cinco sextas, e "a última" tem de ser a
  // última de cada mês, não um número fixo que às vezes não existe.
  assert.deepEqual(abrem('última sexta', TERCA, 3, '19:00-20:00'), [
    '2026-10-30 19:00',
    '2026-11-27 19:00',
    '2026-12-25 19:00',
  ]);
  // Outubro de 2026 tem cinco sextas; novembro tem quatro. Nos dois a última foi encontrada.
  assert.equal(new Date(2026, 9, 30).getDay(), 5);
  assert.equal(new Date(2026, 10, 27).getDay(), 5);

  // A primeira segunda de outubro foi dia 5 — ontem, visto da terça. A busca começa em ontem de
  // propósito (janelas que atravessam a meia-noite), mas o que já passou não é agendado.
  assert.deepEqual(abrem('primeira segunda', TERCA, 2, '09:00-10:00'), [
    '2026-10-05 09:00',
    '2026-11-02 09:00',
  ]);
  assert.equal(proxima({ dias: 'primeira segunda', horarios: '09:00-10:00' }, TERCA), '2026-11-02 09:00');
});

test('regras diferentes somam, em vez de brigar', () => {
  // "seg, 15" quer dizer segundas **e** o dia 15. É o que está escrito, e é o motivo de não haver
  // um seletor de "modo semanal ou mensal": o texto já diz tudo, e misturar é natural.
  assert.deepEqual(abrem('seg, 15', TERCA, 4), [
    '2026-10-05 20:00',
    '2026-10-12 20:00',
    '2026-10-15 20:00',
    '2026-10-19 20:00',
  ]);
});

test('o que nao foi entendido fica marcado, em vez de sumir', () => {
  // **Um pedaço ignorado em silêncio é o pior caso possível**: a pessoa acha que marcou "quarta" e
  // a automação roda todo dia, ou nenhum. Então o que não é reconhecido é dito.
  assert.deepEqual(agenda.diasNaoEntendidos('seg, blargh, 15'), ['blargh']);
  assert.deepEqual(agenda.diasNaoEntendidos('seg, qui'), []);
  assert.deepEqual(agenda.diasNaoEntendidos(''), []);
  // E uma agenda com lixo não é válida: o relógio não liga.
  assert.equal(agenda.valida({ modo: 'horarios', dias: 'seg, blargh', horarios: '08:00-09:00' }), false);
  // **E nenhum dia passa enquanto houver lixo no campo.** Esta foi uma decisão, e a primeira
  // versão errou: ignorar o pedaço ruim fazia "toda semana" virar "todo dia", porque sem regra
  // nenhuma todo dia conta. Quem escreveu "última quarta" com um engano teria a automação rodando
  // trinta vezes por mês em vez de uma. Não agir é recuperável; agir trinta vezes não é.
  assert.equal(agenda.diaPassa(new Date(2026, 9, 12), 'seg, blargh'), false);
  assert.equal(agenda.diaPassa(new Date(2026, 9, 12), 'seg'), true);
});

test('uma rodada por ocorrencia, e uma perdida fica perdida', () => {
  const cfg = { dias: 'seg', horarios: '20:00-21:00' };
  const segundaDeManha = new Date(2026, 9, 12, 8, 0);
  assert.equal(proxima(cfg, segundaDeManha), '2026-10-12 20:00');

  // Já rodou nesta janela: a próxima é só na segunda seguinte.
  const jaRodou = new Date(2026, 9, 12, 20, 30).getTime();
  assert.equal(proxima(cfg, new Date(2026, 9, 12, 20, 31), jaRodou), '2026-10-19 20:00');

  // **Ocorrência perdida fica perdida.** Computador desligado na segunda: ao ligar na terça, a
  // agenda não dispara "o que ficou devendo" — espera a próxima segunda. Disparar o atrasado seria
  // agir numa hora que ninguém escolheu, que é justamente o que estas janelas evitam.
  assert.equal(proxima(cfg, new Date(2026, 9, 13, 9, 0)), '2026-10-19 20:00');
});

test('com a janela ja aberta, o sorteio vale do agora ate o fechamento', () => {
  const cfg = { horarios: '08:00-09:00' };
  const dentro = new Date(2026, 9, 6, 8, 30);
  assert.equal(agenda.esperaDaAgenda(cfg, 0, dentro, () => 0), 0);
  // O teto é o fechamento: meia hora, e nem um minuto do dia seguinte.
  assert.equal(agenda.esperaDaAgenda(cfg, 0, dentro, () => 1) / 60000, 30);
});

test('a janela que atravessa a meia-noite pertence ao dia em que abre', () => {
  // "Sexta à noite, das 22:00 às 02:00" tem de ser a sexta, não o sábado de madrugada — é o que
  // qualquer pessoa entende por isso, e o contrário mudaria o dia escolhido sem avisar.
  const cfg = { dias: 'sex', horarios: '22:00-02:00' };
  assert.deepEqual(abrem('sex', TERCA, 2, '22:00-02:00'), ['2026-10-09 22:00', '2026-10-16 22:00']);
  // E à uma da manhã de sábado ela ainda está aberta: quem ligou o computador tarde ainda pega.
  assert.equal(agenda.esperaDaAgenda(cfg, 0, new Date(2026, 9, 10, 1, 0), () => 0), 0);
});

test('agenda impossivel devolve nulo em vez de uma volta infinita', () => {
  // Sem horário não há ocorrência nenhuma. O relógio não pode ficar procurando para sempre.
  assert.equal(agenda.esperaDaAgenda({ dias: 'seg', horarios: '' }, 0, TERCA), null);
  assert.equal(agenda.esperaDaAgenda({ dias: 'blargh', horarios: '08:00-09:00' }, 0, TERCA), null);
});

test('valida diz o que falta antes de ligar um relogio que nunca dispara', () => {
  // "Ligado" com uma agenda impossível é a pior das duas mentiras: parece que vai agir e não age.
  assert.equal(agenda.valida({ modo: 'minutos' }), true);
  assert.equal(agenda.valida({ modo: 'horarios', horarios: '08:00-09:00' }), true);
  assert.equal(agenda.valida({ modo: 'horarios', horarios: '' }), false);
  assert.equal(agenda.valida({ modo: 'horarios', horarios: '08:00-09:00', dias: 'última sexta' }), true);
  assert.equal(agenda.valida({ modo: 'horarios', horarios: '08:00-09:00', dias: 'blargh' }), false);
});

test('o resumo diz a agenda em uma linha, em portugues', () => {
  const diz = (dias, horarios = '20:00-21:00') => agenda.resumo({ dias, horarios });
  assert.equal(diz('seg, qui'), 'segunda, quinta · 20:00-21:00');
  assert.equal(diz('última sexta', '19:00-20:00'), 'última sexta do mês · 19:00-20:00');
  assert.equal(diz('1, último', '08:00-09:00'), 'dia 1, último dia do mês · 08:00-09:00');
  assert.equal(diz(''), 'todo dia · 20:00-21:00');
  // Sem horário não se anuncia nada: não há o que acontecer.
  assert.equal(diz('seg', ''), '');
});

// ---------------------------------------------------------------------------
// O guarda da regra: ninguém volta a ter o calendário em casa.

test('o calendario e um so, e quem age sozinho usa ele', () => {
  // A regra herdada do PokePixel: ninguem volta a ter o calendario em casa. La' eram tres copias
  // identicas da mesma conta de janela, e acrescentar "uma vez por semana" era acrescentar o
  // mesmo defeito em tres lugares. Aqui ha' uma automacao agendavel; a regra vale desde ela.
  const ler = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  for (const arquivo of ['ciclo.js']) {
    const fonte = ler(arquivo);
    assert.match(fonte, /PPX\?\.agenda/, `${arquivo} nao usa o calendario partilhado`);
    assert.match(fonte, /montarControles\(/, `${arquivo} nao monta o editor de agenda`);
    assert.doesNotMatch(
      fonte,
      /const minuto = \(hora, min\) =>/,
      `${arquivo} releu horario em casa`,
    );
    assert.doesNotMatch(fonte, /abre <= ultima/, `${arquivo} refez a conta da janela em casa`);
  }
  // E o calendario e carregado antes de quem o usa.
  const manifest = JSON.parse(ler('manifest.json'));
  const bloco = manifest.content_scripts.find((b) => b.js.includes('ciclo.js'));
  assert.ok(
    bloco.js.indexOf('agenda.js') >= 0 && bloco.js.indexOf('agenda.js') < bloco.js.indexOf('ciclo.js'),
    'agenda.js tem de vir antes de ciclo.js no manifest',
  );
});
