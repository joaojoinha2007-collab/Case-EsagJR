/*
 * data.js — Base analítica extraída do documento
 * "Guia TAM, SAM, SOM, market share e CAGR — WEEK Haircare" (ESAG Jr).
 *
 * Organização:
 *   SOURCES     → fontes citadas no PDF (somente os links que constam no documento)
 *   CONFIDENCE  → escala de confiança usada no PDF
 *   BASE_INPUTS → premissas/dados de entrada do cenário-base (valores do PDF)
 *   REFERENCE   → resultados publicados no PDF (para conferência, nunca usados no cálculo)
 *   ASSUMPTIONS → tabela "Informações importantes para a construção do TAM SAM SOM"
 *   MODELS      → metadados descritivos de cada modelo (recortes, canal, segmentos)
 *
 * Funciona no navegador (window.WeekData) e no Node (module.exports).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WeekData = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Fontes — URLs exatamente como aparecem nos hiperlinks do PDF        */
  /* ------------------------------------------------------------------ */
  var SOURCES = {
    fitnessEY: { label: 'Fitness Brasil (EY)', url: 'https://www.fitnessbrasil.com.br/newsfitbr/brasil-entra-de-vez-no-radar-global-do-fitness-e-isso-e-so-o-comeco-de-uma-nova-era-para-o-setor/' },
    panorama: { label: 'Fitness Brasil, Panorama Setorial 5ª ed. (2026)', url: 'https://www.fitnessbrasil.com.br/panorama-setorial-2026-5a-edicao/' },
    panoramaTamanho: { label: 'Panorama (tamanho do mercado fitness)', url: 'https://www.fitnessbrasil.com.br/newsfitbr/tamanho-do-mercado-fitness-brasileiro-os-numeros-que-a-5a-edicao-do-panorama-setorial-revela-sobre-profissionais-centros-e-negocios/' },
    fiep: { label: 'FIEP Bulletin', url: 'https://ojs.fiepbulletin.net/fiepbulletin/pt_BR/article/download/2493/4596/4934' },
    caged: { label: 'Novo CAGED', url: 'https://app.powerbi.com/view?r=eyJrIjoiNWI5NWI0ODEtYmZiYy00Mjg3LTkzNWUtY2UyYjIwMDE1YWI2IiwidCI6IjNlYzkyOTY5LTVhNTEtNGYxOC04YWM5LWVmOThmYmFmYTk3OCJ9&pageName=ReportSectionb52b07ec3b5f3ac6c749' },
    nr24: { label: 'MTE — NR-24 (2022)', url: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/arquivos/normas-regulamentadoras/nr-24-atualizada-2022.pdf' },
    ibgeTurismo2024: { label: 'IBGE — Turismo nacional 2024', url: 'https://agenciadenoticias.ibge.gov.br/agencia-noticias/2012-agencia-de-noticias/noticias/44624-gastos-com-turismo-nacional-aumentam-11-7-em-2024' },
    ibgePnadTurismo: { label: 'IBGE — PNAD Contínua Turismo', url: 'https://agenciadenoticias.ibge.gov.br/agencia-sala-de-imprensa/28568-pnad-continua-turismo-96-1-das-viagens-tinham-destinos-nacionais-em-2019.html' },
    weGreen: { label: 'We Green (Master Hotelaria)', url: 'https://www.masterhotelaria.com.br/kit-50-shampoo-e-condicionador-sustentavel-sache-15ml-ecologico' },
    naturys: { label: 'Naturys Eco (Master Hotelaria)', url: 'https://www.masterhotelaria.com.br/100-kits-amenities-sustentavel-naturys-eco-shampoo-condicionador-sabonete-20g' },
    ibgeCenso: { label: 'IBGE — Censo 2022', url: 'https://censo2022.ibge.gov.br/panorama/' },
    abep: { label: 'ABEP — Critério Brasil 2024', url: 'https://abep.org/wp-content/uploads/2024/09/01_cceb_2024.pdf' },
    cetic: { label: 'Cetic.br — TIC Domicílios 2024', url: 'https://cetic.br/pt/tics/domicilios/2024/individuos/H2/' },
    cadastur: { label: 'Ministério do Turismo, Cadastur (2º tri 2026)', url: 'https://dados.turismo.gov.br/dataset/meios-de-hospedagem' },
    fohb: { label: 'FOHB, InFOHB nº 221 (dez/2025)', url: 'https://fohb.com.br/wp-content/uploads/2026/01/InFOHB-221-Dezembro.pdf' },
    propria: { label: 'Estimativa própria', url: null }
  };

  /* ------------------------------------------------------------------ */
  /* Escala de confiança (critérios transcritos do PDF)                  */
  /* ------------------------------------------------------------------ */
  var CONFIDENCE = [
    { id: 'alta', label: 'Alta', score: 5, b2c: 'Dado oficial (IBGE, CAGED).', b2b: 'Dado oficial (IBGE).' },
    { id: 'media-alta', label: 'Média-alta', score: 4, b2c: 'Dado de entidade do setor ou derivado de dado oficial com amostra, que vale conferir.', b2b: 'Dado de entidade do setor (Fitness Brasil, FOHB) ou dado oficial antigo, que vale conferir.' },
    { id: 'media', label: 'Média', score: 3, b2c: 'Estudo acadêmico ou número derivado por conta a partir de dado oficial.', b2b: 'Estudo acadêmico ou número derivado por conta a partir de dado oficial ou setorial.' },
    { id: 'baixa-media', label: 'Baixa-média', score: 2, b2c: 'Estimativa apoiada em um dado indireto, a validar na pesquisa.', b2b: 'Estimativa apoiada em um dado indireto (por exemplo, classes A e B como referência para academias premium).' },
    { id: 'baixa', label: 'Baixa', score: 1, b2c: 'Estimativa sem dado brasileiro, a validar na pesquisa quanti.', b2b: 'Estimativa sem dado brasileiro, a validar na pesquisa.' }
  ];

  /* Status de validação — derivado da coluna "Como validar" do PDF */
  var STATUS = {
    oficial: { label: 'Dado oficial', hint: 'O PDF indica “Dado oficial, não precisa validar”.' },
    conferir: { label: 'Conferir na fonte', hint: 'Dado setorial ou cadastral: o PDF recomenda conferir/atualizar na fonte.' },
    validar: { label: 'Validar em pesquisa', hint: 'Estimativa: o PDF prevê validação em pesquisa quantitativa, qualitativa ou mapeamento.' }
  };

  /* ------------------------------------------------------------------ */
  /* Premissas do cenário-base (exatamente como adotadas no PDF)         */
  /* ------------------------------------------------------------------ */
  var BASE_INPUTS = {
    b2c: {
      alunosAcademia: 13e6,       // alunos de academia no Brasil
      pctBanhoAcademia: 0.20,     // % que toma banho na academia
      trabalhadoresCLT: 48e6,     // trabalhadores com carteira assinada
      pctBanhoTrabalho: 0.05,     // % que toma banho no trabalho
      banhosAno: 96,              // banhos/ano fora de casa (academia e trabalho usam a mesma frequência)
      viagens: 20.6e6,            // viagens com pernoite no ano
      viajantesPorViagem: 1,      // premissa conservadora: IBGE conta viagens, não pessoas
      banhosPorViagem: 3,
      preco: 3.50,                // R$ por kit de uma lavagem (varejo)
      pesoSudeste: 0.418,         // SAM — peso do Sudeste na população
      pctClassesAB: 0.31,         // SAM — classes A e B no Sudeste
      pctOnline: 0.755,           // SAM — classes A/B que compram online
      pesoSP: 0.524               // SOM — peso de SP no Sudeste
    },
    b2b: {
      academiasSudeste: 24781,
      alunosPorAcademia: 236,
      pctBanhoAcademia: 0.20,
      banhosAno: 96,
      quartosSudeste: 321616,
      ocupacao: 0.6093,
      diasAno: 365,
      kitsPorQuarto: 1,
      preco: 3.00,                // R$ por kit (B2B)
      meiosHospedagemSudeste: 7560,
      pesoSPAcademias: 0.5556,    // SAM academias — peso de SP nas academias do Sudeste
      pctPremium: 0.31,           // SAM academias — % com perfil premium
      pesoSPQuartos: 0.5084,      // SAM hotéis — peso de SP nos quartos do Sudeste
      pctHoteis: 0.8969,          // SAM hotéis — % dos quartos de SP que são hotéis/flats/resorts
      hoteisSAM: 1893,            // contagem Cadastur (hotéis, flats, hotéis-fazenda e resorts de SP)
      fatorCampinasAcademias: 0.036,
      fatorCampinasHoteis: 0.036,
      hoteisCampinas: 41          // contagem Cadastur em Campinas
    }
  };

  /* ------------------------------------------------------------------ */
  /* Resultados publicados no PDF — usados apenas para conferência       */
  /* pessoas = pessoas/viagens (B2C) ou usuários/quartos ocupados (B2B)  */
  /* volume  = lavagens ou kits por ano; valor = R$/ano                  */
  /* ------------------------------------------------------------------ */
  var REFERENCE = {
    b2c: {
      factors: { sam: 0.0978, som: 0.524 },
      tam: {
        academia: { pessoas: 2.6e6, volume: 249.6e6, valor: 873.6e6 },
        trabalho: { pessoas: 2.4e6, volume: 230.4e6, valor: 806.4e6 },
        viagem: { pessoas: 20.6e6, volume: 61.8e6, valor: 216.3e6 },
        total: { pessoas: 25.6e6, volume: 541.8e6, valor: 1896.3e6 }
      },
      sam: {
        academia: { pessoas: 254e3, volume: 24.4e6, valor: 85.4e6 },
        trabalho: { pessoas: 235e3, volume: 22.6e6, valor: 79.1e6 },
        viagem: { pessoas: 2.01e6, volume: 6.0e6, valor: 21.0e6 },
        total: { pessoas: 2.50e6, volume: 53.0e6, valor: 185.5e6 }
      },
      som: {
        academia: { pessoas: 133.1e3, volume: 12.8e6, valor: 44.7e6 },
        trabalho: { pessoas: 123.1e3, volume: 11.8e6, valor: 41.4e6 },
        viagem: { pessoas: 1.05e6, volume: 3.2e6, valor: 11.1e6 },
        total: { pessoas: 1.31e6, volume: 27.8e6, valor: 97.2e6 }
      }
    },
    b2b: {
      factors: { samAcademias: 0.1722, samHoteis: 0.4560, somAcademias: 0.036, somHoteis: 0.036 },
      tam: {
        academias: { pessoas: 1.170e6, volume: 112.3e6, valor: 336.9e6, estabelecimentos: 24781 },
        hoteis: { pessoas: 196.0e3, volume: 71.5e6, valor: 214.6e6, estabelecimentos: 7560 },
        total: { pessoas: 1.37e6, volume: 183.8e6, valor: 551.5e6, estabelecimentos: 32341 }
      },
      sam: {
        academias: { pessoas: 201.4e3, volume: 19.3e6, valor: 58.0e6, estabelecimentos: 4268 },
        hoteis: { pessoas: 89.4e3, volume: 32.6e6, valor: 97.8e6, estabelecimentos: 1893 },
        total: { pessoas: 290.8e3, volume: 51.9e6, valor: 155.8e6, estabelecimentos: 6161 }
      },
      som: {
        academias: { pessoas: 7.25e3, volume: 696e3, valor: 2.09e6, estabelecimentos: 154 },
        hoteis: { pessoas: 3217, volume: 1.17e6, valor: 3.52e6, estabelecimentos: 41 },
        total: { pessoas: 10.5e3, volume: 1.87e6, valor: 5.61e6, estabelecimentos: 195 }
      }
    }
  };

  /* ------------------------------------------------------------------ */
  /* Metadados dos modelos                                               */
  /* ------------------------------------------------------------------ */
  var MODELS = {
    b2c: {
      id: 'b2c',
      name: 'B2C',
      title: 'Venda ao consumidor final',
      channel: 'E-commerce (site da WEEK)',
      priceLabel: 'R$ 3,50 por kit de uma lavagem',
      unit: 'lavagens',
      buyer: 'Consumidor final',
      formula: 'nº de pessoas (ou viagens) que tomam banho fora de casa × lavagens fora de casa por ano × preço médio por lavagem',
      levels: {
        tam: { geo: 'Brasil', filter: 'Todas as ocasiões de banho fora de casa dos três segmentos' },
        sam: { geo: 'Sudeste', filter: 'TAM × peso do Sudeste × % classes A e B × % que compra online' },
        som: { geo: 'Estado de SP', filter: 'SAM × peso de SP no Sudeste (taxa de captura ainda não aplicada)' }
      },
      segments: [
        { id: 'academia', name: 'Academia', who: 'Alunos que tomam banho na academia', base: 'Nº de alunos × % que toma banho lá', peopleLabel: 'pessoas' },
        { id: 'trabalho', name: 'Trabalho', who: 'Quem toma banho na empresa', base: 'População ocupada (CLT) × % que toma banho no trabalho', peopleLabel: 'pessoas' },
        { id: 'viagem', name: 'Viagem', who: 'Viagens com pernoite', base: 'Nº de viagens × viajantes por viagem', peopleLabel: 'viagens' }
      ]
    },
    b2b: {
      id: 'b2b',
      name: 'B2B',
      title: 'Venda para estabelecimentos',
      channel: 'Venda direta para academias premium e hotéis',
      priceLabel: 'R$ 3,00 por kit',
      unit: 'kits',
      buyer: 'Estabelecimento (academia ou hotel); quem usa é o aluno ou o hóspede',
      formula: 'nº de kits que os estabelecimentos usam no ano × preço B2B por kit',
      levels: {
        tam: { geo: 'Sudeste', filter: 'Todas as academias e todos os quartos de hospedagem do Sudeste' },
        sam: { geo: 'Estado de SP', filter: 'TAM × peso de SP × perfil do estabelecimento (academias premium e hotéis)' },
        som: { geo: 'Campinas', filter: 'SAM × peso de Campinas no estado de SP (taxa de captura ainda não aplicada)' }
      },
      segments: [
        { id: 'academias', name: 'Academias', who: 'Academias que oferecem banho aos alunos', base: 'Nº de academias × alunos por academia × % que toma banho lá', peopleLabel: 'usuários' },
        { id: 'hoteis', name: 'Hotéis', who: 'Hotéis que colocam amenities nos quartos', base: 'Nº de quartos × taxa de ocupação × 365 dias', peopleLabel: 'quartos ocupados/noite' }
      ]
    }
  };

  /* ------------------------------------------------------------------ */
  /* Tabela de premissas (transcrição do PDF)                            */
  /* key → premissa ligada a uma entrada do motor de cálculo (para       */
  /*       sensibilidade e simulador); null quando não há ligação direta */
  /* ------------------------------------------------------------------ */
  var ASSUMPTIONS = [
    // ---------------- B2C ----------------
    { id: 'b2c-alunos', model: 'b2c', level: 'TAM', segment: 'Academia', key: 'alunosAcademia', name: 'Alunos de academia no Brasil', value: '~13 mi',
      logic: 'Dado direto de levantamento setorial. A EY cita ~15 mi em 2024; usamos 13 mi como base conservadora.',
      sources: ['fitnessEY'], confidence: 'media', status: 'conferir',
      validation: 'O Panorama Setorial 2026 não traz o total de alunos; conferir com o estudo da EY (~15 mi em 2024) e atualizar quando houver um número novo.' },
    { id: 'b2c-banho-acad', model: 'b2c', level: 'TAM', segment: 'Academia', key: 'pctBanhoAcademia', name: '% que toma banho na academia', value: '20%',
      logic: 'Não há dado brasileiro sobre banho fora de casa; estimativa a validar na pesquisa (quanti).',
      sources: ['propria'], confidence: 'baixa', status: 'validar',
      validation: 'Pesquisa de Mercado (Quanti).' },
    { id: 'b2c-freq', model: 'b2c', level: 'TAM', segment: 'Academia', key: 'banhosAno', name: 'Banhos/ano na academia', value: '96 banhos (2 por semana × 48 semanas)',
      logic: 'Estudos com praticantes brasileiros indicam 2 a 4 treinos por semana; nem todo treino termina com banho, então 2 banhos/semana. 48 semanas descontam férias e feriados. A mesma frequência é usada no segmento Trabalho.',
      sources: ['fiep'], confidence: 'media', status: 'validar',
      validation: '“Quantas vezes por semana você toma banho na academia?” — Pesquisa de Mercado (Quanti).' },
    { id: 'b2c-clt', model: 'b2c', level: 'TAM', segment: 'Trabalho', key: 'trabalhadoresCLT', name: 'Trabalhadores CLT', value: '~48 mi',
      logic: 'Estoque de vínculos celetistas ativos.',
      sources: ['caged'], confidence: 'alta', status: 'oficial',
      validation: 'Dado oficial, não precisa validar.' },
    { id: 'b2c-banho-trab', model: 'b2c', level: 'TAM', segment: 'Trabalho', key: 'pctBanhoTrabalho', name: 'Quem toma banho no trabalho', value: '5%',
      logic: 'A NR-24 exige chuveiro em atividades com sujidade ou material tóxico. Construção ≈ 2,8 mi (5,8% dos CLT); somando parte da indústria e do agro, ~10–15% têm chuveiro disponível; supondo que metade usa, ≈ 5%.',
      sources: ['nr24', 'caged'], sourceNote: 'Estimativa a partir de MTE – NR-24 (2022) e Novo CAGED (2025)', confidence: 'baixa-media', status: 'validar',
      validation: '“Você toma banho no trabalho? Quantas vezes por semana?”' },
    { id: 'b2c-viagens', model: 'b2c', level: 'TAM', segment: 'Viagem', key: 'viagens', name: 'Viagens com pernoite (no ano)', value: '20,6 mi',
      logic: 'Total de viagens com pernoite realizadas pelos moradores do Brasil no ano.',
      sources: ['ibgeTurismo2024'], confidence: 'alta', status: 'oficial',
      validation: 'Dado oficial, não precisa validar.' },
    { id: 'b2c-banho-viagem', model: 'b2c', level: 'TAM', segment: 'Viagem', key: 'banhosPorViagem', name: 'Banho por viagem', value: '3',
      logic: '75,5% das viagens têm até 5 pernoites e a mediana fica em 2 a 3 noites; 1 banho por noite × mediana ≈ 3.',
      sources: ['ibgePnadTurismo'], confidence: 'media-alta', status: 'validar',
      validation: '“Quantas noites durou sua última viagem com pernoite?” (Validar na pesquisa quanti).' },
    { id: 'b2c-preco', model: 'b2c', level: 'TAM', segment: 'Todos', key: 'preco', name: 'Preço por kit (1 lavagem)', value: 'R$ 3,50',
      logic: 'Concorrentes com sachê biodegradável de uma lavagem cobram, no atacado para hotéis: We Green R$ 0,95 (shampoo + condicionador de 15 ml) e Naturys Eco R$ 2,60 (30 ml + 30 ml + sabonete). A WEEK vende no varejo para o consumidor final, com fórmula premium, sachê biodegradável e caixa de experiência, por isso fica acima desse piso: R$ 3,50 por lavagem (≈ R$ 0,06 a R$ 0,09 por ml, contra R$ 0,03 a R$ 0,04 dos concorrentes).',
      sources: ['weGreen', 'naturys'], confidence: 'baixa-media', status: 'validar',
      validation: 'Pesquisa de Mercado (Quanti): quanto pagaria por um kit de uma lavagem.' },
    { id: 'b2c-sudeste', model: 'b2c', level: 'SAM', segment: 'Todos', key: 'pesoSudeste', name: 'Peso do Sudeste', value: '41,8%',
      logic: 'O Sudeste tem 84,8 mi dos 203,1 mi de habitantes do Brasil (84,8 ÷ 203,1 = 41,8%).',
      sources: ['ibgeCenso'], confidence: 'alta', status: 'oficial',
      validation: 'Dado oficial, não precisa validar.' },
    { id: 'b2c-ab', model: 'b2c', level: 'SAM', segment: 'Todos', key: 'pctClassesAB', name: '% classes A e B no Sudeste', value: '31%',
      logic: 'Classe A (4,0%) + B1 (6,3%) + B2 (20,7%) = 31%.',
      sources: ['abep'], confidence: 'alta', status: 'oficial',
      validation: 'Dado oficial, não precisa validar.' },
    { id: 'b2c-online', model: 'b2c', level: 'SAM', segment: 'Todos', key: 'pctOnline', name: '% de A/B que compra online', value: '75,5%',
      logic: 'Compraram online em 2024: 72% da classe A e 76% da classe B. Média ponderada pelo peso de cada classe no Sudeste: (4% × 72% + 27% × 76%) ÷ 31% ≈ 75,5%.',
      sources: ['cetic'], confidence: 'alta', status: 'oficial',
      validation: 'Dado oficial, não precisa validar.' },
    { id: 'b2c-sp', model: 'b2c', level: 'SOM', segment: 'Todos', key: 'pesoSP', name: 'Peso de SP no Sudeste', value: '52,4%',
      logic: 'O estado de SP tem 44,4 mi dos 84,8 mi de habitantes do Sudeste (44,4 ÷ 84,8 = 52,4%).',
      sources: ['ibgeCenso'], confidence: 'alta', status: 'oficial',
      validation: 'Dado oficial, não precisa validar.' },

    // ---------------- B2B ----------------
    { id: 'b2b-academias', model: 'b2b', level: 'TAM', segment: 'Academias', key: 'academiasSudeste', name: 'Academias no Sudeste', value: '24.781',
      logic: 'SP 25% + MG 11% + RJ 7% + ES 2% = 45% das 55.068 academias ativas do Brasil (45% × 55.068 = 24.781).',
      sources: ['panorama'], sourceNote: 'Fitness Brasil, Panorama Setorial 5ª ed. (2026), p. 17', confidence: 'media-alta', status: 'conferir',
      validation: 'Conferido no relatório completo (p. 17). Os percentuais por estado vêm arredondados.' },
    { id: 'b2b-alunos', model: 'b2b', level: 'TAM', segment: 'Academias', key: 'alunosPorAcademia', name: 'Alunos por academia', value: '236',
      logic: '13 mi de alunos ÷ 55.068 academias no Brasil (13 mi ÷ 55.068 = 236).',
      sources: ['fitnessEY', 'panoramaTamanho'], confidence: 'media', status: 'validar',
      validation: 'Pesquisa quali B2B: “Quantos alunos ativos vocês têm hoje?”' },
    { id: 'b2b-banho', model: 'b2b', level: 'TAM', segment: 'Academias', key: 'pctBanhoAcademia', name: '% que toma banho na academia', value: '20%',
      logic: 'Mesma premissa do B2C.',
      sources: ['propria'], confidence: 'baixa', status: 'validar',
      validation: 'Pesquisa quanti (alunos) e quali B2B (academias).' },
    { id: 'b2b-freq', model: 'b2b', level: 'TAM', segment: 'Academias', key: 'banhosAno', name: 'Banhos/ano por aluno', value: '96',
      logic: 'Mesma premissa do B2C (2 por semana × 48 semanas).',
      sources: ['fiep'], confidence: 'media', status: 'validar',
      validation: 'Pesquisa quanti: “Quantas vezes por semana você toma banho na academia?”' },
    { id: 'b2b-quartos', model: 'b2b', level: 'TAM', segment: 'Hotéis', key: 'quartosSudeste', name: 'Quartos (UHs) no Sudeste', value: '321.616',
      logic: 'SP 163.504 + MG 65.277 + RJ 77.527 + ES 15.308 unidades habitacionais, em 7.560 meios de hospedagem em operação (hotéis, pousadas, hostels, flats e resorts; sem a categoria “Outros”, que inclui campings e espaços de eventos).',
      sources: ['cadastur'], confidence: 'media-alta', status: 'conferir',
      validation: 'Cadastro oficial atualizado (2º tri 2026), mas nem todo meio de hospedagem se cadastra: o número real tende a ser maior, então a estimativa é conservadora.' },
    { id: 'b2b-ocupacao', model: 'b2b', level: 'TAM', segment: 'Hotéis', key: 'ocupacao', name: 'Taxa de ocupação no Sudeste', value: '60,93%',
      logic: 'Média de janeiro a dezembro de 2025 dos hotéis do Sudeste acompanhados pelo FOHB.',
      sources: ['fohb'], confidence: 'media-alta', status: 'validar',
      validation: 'Amostra de hotéis de rede: confirmar com hotéis independentes na quali B2B.' },
    { id: 'b2b-kits', model: 'b2b', level: 'TAM', segment: 'Hotéis', key: 'kitsPorQuarto', name: 'Kits por quarto ocupado', value: '1 por noite',
      logic: 'Cada quarto ocupado recebe 1 kit por noite (reposição diária das amenities).',
      sources: ['propria'], confidence: 'baixa-media', status: 'validar',
      validation: 'Pesquisa quali B2B: “Com que frequência vocês repõem shampoo e condicionador nos quartos?”' },
    { id: 'b2b-preco', model: 'b2b', level: 'TAM', segment: 'Todos', key: 'preco', name: 'Preço por kit (B2B)', value: 'R$ 3,00',
      logic: 'Concorrentes diretos já vendem kits de sachê biodegradável para hotéis: Naturys Eco a R$ 2,60 (shampoo + condicionador de 30 ml + sabonete) e We Green a R$ 0,95 (15 ml + 15 ml). Como a WEEK é premium, fica um pouco acima da Naturys (cerca de 15%) e abaixo do preço de varejo do B2C (R$ 3,50), porque o estabelecimento compra em volume.',
      sources: ['weGreen', 'naturys'], confidence: 'media', status: 'validar',
      validation: 'Pesquisa quali B2B e cotação com fornecedores de amenities para hotéis.' },
    { id: 'b2b-sp-acad', model: 'b2b', level: 'SAM', segment: 'Academias', key: 'pesoSPAcademias', name: 'Peso de SP nas academias do Sudeste', value: '55,56%',
      logic: 'SP tem 25% e o Sudeste 45% das academias ativas do Brasil (25% ÷ 45% = 55,56%).',
      sources: ['panorama'], sourceNote: 'Fitness Brasil, Panorama Setorial 5ª ed. (2026), p. 17', confidence: 'media-alta', status: 'conferir',
      validation: 'Conferido no relatório completo (p. 17).' },
    { id: 'b2b-premium', model: 'b2b', level: 'SAM', segment: 'Academias', key: 'pctPremium', name: '% de academias com perfil premium', value: '31%',
      logic: 'Usa como referência o peso das classes A e B no Sudeste (A 4,0% + B1 6,3% + B2 20,7% = 31%).',
      sources: ['abep'], confidence: 'baixa-media', status: 'validar',
      validation: 'Mapear academias de SP pela mensalidade (Google Maps e sites) e pela existência de vestiário.' },
    { id: 'b2b-sp-quartos', model: 'b2b', level: 'SAM', segment: 'Hotéis', key: 'pesoSPQuartos', name: 'Peso de SP nos quartos do Sudeste', value: '50,84%',
      logic: '163.504 quartos de SP ÷ 321.616 do Sudeste.',
      sources: ['cadastur'], confidence: 'alta', status: 'oficial',
      validation: 'Dado oficial, não precisa validar.' },
    { id: 'b2b-hoteis', model: 'b2b', level: 'SAM', segment: 'Hotéis', key: 'pctHoteis', name: '% dos quartos de SP que são de hotéis', value: '89,69%',
      logic: '146.653 dos 163.504 quartos de SP são de hotéis, flats, hotéis-fazenda e resorts (1.893 estabelecimentos); o resto são pousadas, hostels e similares.',
      sources: ['cadastur'], confidence: 'alta', status: 'oficial',
      validation: 'Dado oficial, não precisa validar.' },
    { id: 'b2b-camp-acad', model: 'b2b', level: 'SOM', segment: 'Academias', key: 'fatorCampinasAcademias', name: 'Peso de Campinas nas academias de SP', value: '3,60%',
      logic: 'Campinas tem 0,9% das academias ativas do Brasil e o estado de SP tem 25% (0,9% ÷ 25% = 3,60%), cerca de 496 academias.',
      sources: ['panorama'], sourceNote: 'Fitness Brasil, Panorama Setorial 5ª ed. (2026), p. 17 e 18', confidence: 'media-alta', status: 'conferir',
      validation: 'Conferido no relatório completo (p. 18). Usado no lugar do peso da população porque é a contagem real de academias.' },
    { id: 'b2b-camp-hot', model: 'b2b', level: 'SOM', segment: 'Hotéis', key: 'fatorCampinasHoteis', name: 'Peso de Campinas nos quartos de hotel de SP', value: '3,60%',
      logic: 'Campinas tem 5.274 quartos de hotel, em 41 estabelecimentos, dos 146.653 do estado (5.274 ÷ 146.653 = 3,60%).',
      sources: ['cadastur'], confidence: 'media-alta', status: 'conferir',
      validation: 'Contagem real do Cadastur (2º tri 2026). Ocupação hoteleira de Campinas em 2025: 56,87% (FOHB), um pouco abaixo da média do Sudeste.' }
  ];

  /* ------------------------------------------------------------------ */
  /* Observações metodológicas (transparência e limitações)              */
  /* ------------------------------------------------------------------ */
  var NOTES = [
    { id: 'sobreposicao', model: 'b2c', title: 'Dupla contagem de pessoas no B2C',
      text: 'Uma mesma pessoa pode treinar, tomar banho no trabalho e viajar. Por isso o PDF soma lavagens (e não pessoas) e trata o total de “pessoas atingidas” (≈ 25,6 mi no TAM) como número máximo, não como consumidores únicos. No segmento Viagem a unidade é a viagem, não a pessoa.' },
    { id: 'captura', model: 'ambos', title: 'O SOM ainda não tem taxa de captura',
      text: 'O SOM apresentado é o recorte geográfico definido no estudo (SP no B2C, Campinas no B2B) antes da aplicação de uma taxa de captura comercial. Não é previsão de vendas nem faturamento da WEEK. Quando a taxa for definida, basta multiplicar: Fator do SOM × taxa de captura.' },
    { id: 'estimativas', model: 'ambos', title: 'Frequência de uso e preço ainda são estimativas',
      text: 'O % de pessoas que tomam banho fora de casa, a frequência anual de banhos e o preço por kit estão classificados como estimativas (confiança baixa a média) e dependem das pesquisas quanti e quali previstas no projeto.' },
    { id: 'comprador', model: 'b2b', title: 'No B2B, quem compra não é quem usa',
      text: 'O comprador é o estabelecimento (academia ou hotel); quem usa o kit é o aluno ou o hóspede. “Estabelecimentos atingidos” e “pessoas atingidas” são, portanto, grandezas diferentes.' },
    { id: 'quartos', model: 'b2b', title: 'Quartos ocupados ≠ kits repostos',
      text: 'Quartos ocupados por noite e reposição de kits são variáveis distintas, ligadas pela premissa de 1 kit por quarto ocupado por noite (estimativa própria, a validar). Se a reposição for menor — por exemplo, a cada duas noites —, o volume hoteleiro cai na mesma proporção. Também há 1 hóspede por quarto ocupado como simplificação.' },
    { id: 'ocupacao-campinas', model: 'b2b', title: 'Ocupação de Campinas abaixo da média do Sudeste',
      text: 'O SOM de hotéis usa a ocupação média do Sudeste (60,93%). O próprio PDF registra que a ocupação de Campinas em 2025 foi de 56,87% (FOHB). Se essa taxa fosse aplicada, o SOM de hotéis seria proporcionalmente menor (≈ 6,7%). O valor original foi mantido.' },
    { id: 'proxies', model: 'ambos', title: 'Indicadores indiretos (proxies)',
      text: 'Alguns filtros usam aproximações: o peso populacional do Sudeste é aplicado também a trabalhadores e viagens; o perfil “premium” das academias usa como referência o peso das classes A e B (31%); alunos por academia usam a média nacional (13 mi ÷ 55.068).' },
    { id: 'arredondamento', model: 'ambos', title: 'Arredondamentos',
      text: 'O PDF arredonda valores intermediários (por exemplo, 254 mil, 6,0 mi) antes de seguir a conta. Esta plataforma recalcula tudo com precisão total e só arredonda na exibição. Por isso alguns valores podem diferir em décimos do PDF; as diferenças estão listadas no painel “Verificação de consistência”.' },
    { id: 'escopos', model: 'ambos', title: 'B2C e B2B não são somáveis',
      text: 'Os recortes geográficos são diferentes (TAM B2C = Brasil; TAM B2B = Sudeste), os preços são diferentes e parte do público pode se sobrepor (o aluno da academia premium aparece nos dois modelos). Os números de B2C e B2B devem ser lidos como cenários alternativos de entrada no mercado, não somados.' },
    { id: 'cagr', model: 'ambos', title: 'CAGR sem série histórica',
      text: 'O título do documento menciona CAGR, mas os dados não trazem série temporal nem taxa de crescimento calculada. A plataforma explica o conceito e oferece uma calculadora com valores hipotéticos informados pelo usuário — nenhuma taxa de crescimento foi inventada.' }
  ];

  return {
    SOURCES: SOURCES,
    CONFIDENCE: CONFIDENCE,
    STATUS: STATUS,
    BASE_INPUTS: BASE_INPUTS,
    REFERENCE: REFERENCE,
    MODELS: MODELS,
    ASSUMPTIONS: ASSUMPTIONS,
    NOTES: NOTES
  };
});
