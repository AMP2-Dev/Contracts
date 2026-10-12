import type { Project } from '../types/database';

export interface SebraeSpErCredenciado {
  er: string;
  gestor: string;
  email: string;
  aliases?: string[];
}

export const SEBRAE_SP_ER_CREDENCIADOS: SebraeSpErCredenciado[] = [
  { er: 'ER Campinas', gestor: 'EDUARDO DA COSTA SENE NETO', email: 'credenciamento.er.cp@sebraesp.com.br', aliases: ['campinas', 'er.cp'] },
  { er: 'Desenvolvimento de Solucoes', gestor: 'Fatima de Oliveira', email: 'credenciamento.ugstd@sebraesp.com.br', aliases: ['desenvolvimento de soluções', 'desenvolvimento de solucoes', 'ugstd'] },
  { er: 'ER Alto Tietê', gestor: 'CRISTIANE BENTO DE SOUZA', email: 'credencimento.er.at@sebraesp.com.br', aliases: ['alto tiete', 'alto tietê', 'er.at'] },
  { er: 'ER Araçatuba', gestor: 'DAIANA KODAMA FERREIRA BERTACHINI', email: 'credenciamento.er.artb@sebraesp.com.br', aliases: ['aracatuba', 'araçatuba', 'er.artb'] },
  { er: 'ER Araraquara', gestor: 'Marjorie Ambo Koto', email: 'credenciamento.er.arr@sebraesp.com.br', aliases: ['araraquara', 'er.arr'] },
  { er: 'ER Baixada Santista', gestor: 'ADRIANA PAULA MORAES RAMIRES RAMOS', email: 'credenciamento.er.bs@sebraesp.com.br', aliases: ['baixada santista', 'santos', 'er.bs'] },
  { er: 'ER BARRETOS', gestor: 'JOYCE COSTA HENRIQUE', email: 'credenciamento.er.brt@sebraesp.com.br', aliases: ['barretos', 'er.brt'] },
  { er: 'ER Bauru', gestor: 'ANA AMELIA CORREA PRECIOSO', email: 'credenciamento.er.br@sebraesp.com.br', aliases: ['bauru', 'er.br'] },
  { er: 'ER BOTUCATU', gestor: 'FLAVIO SILVA DE OLIVEIRA', email: 'credenciamento.er.btt@sebraesp.com.br', aliases: ['botucatu', 'er.btt'] },
  { er: 'ER Capital Centro', gestor: 'Eurides Maria Ramalho Alves', email: 'credenciamento.er.cc@sebraesp.com.br', aliases: ['capital centro', 'er.cc'] },
  { er: 'ER Capital Leste I', gestor: 'DAIANNA COSTA FLORES BELO', email: 'credenciamento.er.cl1@sebraesp.com.br', aliases: ['capital leste i', 'capital leste 1', 'er.cl1'] },
  { er: 'ER Capital Leste II', gestor: 'LUCIA AMELIA GOMES', email: 'credenciamento.er.cl2@sebraesp.com.br', aliases: ['capital leste ii', 'capital leste 2', 'er.cl2'] },
  { er: 'ER Capital Norte', gestor: 'SIMONE PERES ZAGATI', email: 'credenciamento.er.cn@sebraesp.com.br', aliases: ['capital norte', 'er.cn'] },
  { er: 'ER Capital Oeste', gestor: 'Taissa Telles de Abreu Lourenço', email: 'credenciamento.er.co@sebraesp.com.br', aliases: ['capital oeste', 'er.co'] },
  { er: 'ER Capital Sul', gestor: 'WILSON BORGES DE CARVALHO JUNIOR', email: 'credenciamento.er.cs@sebraesp.com.br', aliases: ['capital sul', 'er.cs'] },
  { er: 'ER Franca', gestor: 'PRISCILA PEREIRA BATISTA TOLOI', email: 'credenciamento.er.fr@sebraesp.com.br', aliases: ['franca', 'er.fr'] },
  { er: 'ER Grande ABC', gestor: 'DHIEGO GARCIA OLIVEIRA', email: 'credenciamento.er.abc@sebraesp.com.br', aliases: ['grande abc', 'abc', 'sbc', 'sao bernardo', 'santo andre', 'sao caetano', 'diadema', 'maua', 'er.abc'] },
  { er: 'ER Guaratinguetá', gestor: 'MARCELA DE BARROS LEITE VILELA', email: 'credenciamento.er.gra@sebraesp.com.br', aliases: ['guaratingueta', 'guaratinguetá', 'er.gra'] },
  { er: 'ER Guarulhos', gestor: 'JOSE LEANDRO DE SOUZA', email: 'credenciamento.er.gru@sebraesp.com.br', aliases: ['guarulhos', 'er.gru'] },
  { er: 'ER Jundiaí', gestor: 'SILVIA DELLA MATRICE', email: 'credenciamento.er.jd@sebraesp.com.br', aliases: ['jundiai', 'jundiaí', 'er.jd'] },
  { er: 'ER Marília', gestor: 'SIDNEY GUERMANDI RAMALHO', email: 'credenciamento.er.mr@sebraesp.com.br', aliases: ['marilia', 'marília', 'er.mr'] },
  { er: 'ER Osasco', gestor: 'FERNANDO CORREA QUEIROZ', email: 'credenciamento.er.os@sebraesp.com.br', aliases: ['osasco', 'cotia', 'er.os'] },
  { er: 'ER Ourinhos', gestor: 'CAMILA DA SILVA MARQUES', email: 'credenciamento.er.or@sebraesp.com.br', aliases: ['ourinhos', 'er.or'] },
  { er: 'ER Piracicaba', gestor: 'ALAN ADILSON TANNO', email: 'credenciamento.er.prb@sebraesp.com.br', aliases: ['piracicaba', 'er.prb'] },
  { er: 'ER Presidente Prudente', gestor: 'VERONICA FRANCIANE DORIA', email: 'credenciamento.er.pr@sebraesp.com.br', aliases: ['presidente prudente', 'prudente', 'er.pr'] },
  { er: 'ER Ribeirão Preto', gestor: 'Lederson Schwab Morais', email: 'credenciamento.er.rp@sebraesp.com.br', aliases: ['ribeirao preto', 'ribeirão preto', 'er.rp'] },
  { er: 'ER São Carlos', gestor: 'DIEGO PEREIRA DE SOUZA', email: 'credenciamento.er.sc@sebraesp.com.br', aliases: ['sao carlos', 'são carlos', 'er.sc'] },
  { er: 'ER São João da Boa Vista', gestor: 'Raphael De Padua Medeiros', email: 'credenciamento.er.sjbv@sebraesp.com.br', aliases: ['sao joao da boa vista', 'são joão da boa vista', 'santa cruz das palmeiras', 'er.sjbv'] },
  { er: 'ER São José do Rio Preto', gestor: 'RICARDO LUCIANO PIOVESAN', email: 'credenciamento.er.sjrp@sebraesp.com.br', aliases: ['sao jose do rio preto', 'são josé do rio preto', 'rio preto', 'er.sjrp'] },
  { er: 'ER São José dos Campos', gestor: 'Yuri Solano Sirobaba', email: 'credenciamento.er.sjc@sebraesp.com.br', aliases: ['sao jose dos campos', 'são josé dos campos', 'er.sjc'] },
  { er: 'ER Sorocaba', gestor: 'SANDRO LUIS RESSIO', email: 'credenciamento.er.srb@sebraesp.com.br', aliases: ['sorocaba', 'er.srb'] },
  { er: 'ER Sudoeste Paulista', gestor: 'ADRIANO AUGUSTO DE SOUZA', email: 'credenciamento.er.sdp@sebraesp.com.br', aliases: ['sudoeste paulista', 'itapetininga', 'itapeva', 'er.sdp'] },
  { er: 'ER Vale do Ribeira', gestor: 'ANDRE LUIZ DE ALMEIDA VITOR', email: 'credenciamento.er.vr@sebraesp.com.br', aliases: ['vale do ribeira', 'registro', 'er.vr'] },
  { er: 'ER Votuporanga', gestor: 'FRANCISCO EMIDIO NEGRINE DE SOUZA MARQUES', email: 'credenciamento.er.vot@sebraesp.com.br', aliases: ['votuporanga', 'er.vot'] },
  { er: 'Rede Sebrae de Atendimento', gestor: 'SILA MELO DE CHIARA', email: 'credenciamento.uac@sebraesp.com.br', aliases: ['rede sebrae', 'rede sebrae de atendimento', 'uac'] },
  { er: 'UAMSF', gestor: '', email: 'credenciamento.uamsf@sebraesp.com.br', aliases: ['uamsf'] },
  { er: 'UECS', gestor: 'MARCUS VINICIUS', email: 'credenciamento.uecs@sebraesp.com.br', aliases: ['uecs'] },
  { er: 'UPPRG', gestor: 'EDILNE ALVES', email: 'credenciamento.upprg@sebraesp.com.br', aliases: ['upprg'] },
];

function normalizeText(value?: string | null): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function findSebraeSpErCredenciado(unidadeDemandante?: string | null, fallbackMunicipio?: string | null): SebraeSpErCredenciado | null {
  const normUnidade = normalizeText(unidadeDemandante);
  if (normUnidade) {
    // 1. Match exato ou inclusão direta pelo nome da ER
    const direct = SEBRAE_SP_ER_CREDENCIADOS.find((item) => {
      const normEr = normalizeText(item.er);
      return normUnidade === normEr || normUnidade.includes(normEr) || normEr.includes(normUnidade);
    });
    if (direct) return direct;

    // 2. Match por aliases
    const byAlias = SEBRAE_SP_ER_CREDENCIADOS.find((item) =>
      (item.aliases || []).some((alias) => normUnidade.includes(normalizeText(alias)))
    );
    if (byAlias) return byAlias;
  }

  const normMun = normalizeText(fallbackMunicipio);
  if (normMun) {
    const byMun = SEBRAE_SP_ER_CREDENCIADOS.find((item) => {
      const normEr = normalizeText(item.er.replace(/^ER\s+/i, ''));
      if (normEr && normMun.includes(normEr)) return true;
      return (item.aliases || []).some((alias) => normMun.includes(normalizeText(alias)));
    });
    if (byMun) return byMun;
  }

  return null;
}

export function isSebraeSpProject(project: Partial<Project>): boolean {
  const uf = String(project.estado || '').toUpperCase().trim();
  const sgf = String(project.dados_extra?.sgf || project.dados_extra?.codigo_sgf || project.contrato_no || project.programa || '').toUpperCase();
  const unidade = String(project.dados_extra?.unidade_demandante || '');
  const emailGestor = String(project.dados_extra?.email_gestor || project.observacoes || '').toLowerCase();

  return (
    uf === 'SP' ||
    sgf.startsWith('SP') ||
    Boolean(unidade) ||
    emailGestor.includes('@sebraesp.com.br')
  );
}

export function formatDataBr(dateStr?: string | null): string {
  if (!dateStr) return new Date().toLocaleDateString('pt-BR');
  const clean = String(dateStr).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) return clean;
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    const [y, m, d] = clean.substring(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  return clean;
}

/**
 * Monta exatamente o corpo da Discriminação do Serviço exigido no manual "1. Nota Fiscal (NF) - SOMA SEBRAE SP"
 */
export function buildSebraeSpNfDiscriminacao(project: Partial<Project>): string {
  const edital = project.edital || '004/2026';
  const processo = project.processo_no || '1777/2025';
  const sgf =
    project.dados_extra?.sgf ||
    project.dados_extra?.codigo_sgf ||
    (project.contrato_no && String(project.contrato_no).toUpperCase().startsWith('SP') ? project.contrato_no : '') ||
    'SP0920261108';
  const rawRae = String(project.codigo_rae || '').replace(/^RAE\s*/i, '').trim() || 'N/A';
  const osNumber =
    project.dados_extra?.os_number ||
    (project.contrato_no && !String(project.contrato_no).toUpperCase().startsWith('SP') ? project.contrato_no : '') ||
    rawRae;
  const profissional = project.profissional_responsavel || 'MARCO ANTONIO PAVANI';
  const horasNum = project.horas_realizadas || project.horas_contratadas || 1;
  const horasLabel = Number(horasNum) === 1 ? '1 hora' : `${String(horasNum).replace('.', ',')} horas`;
  const naturezaRaw = project.natureza || 'Consultoria';
  const naturezaFormatted =
    naturezaRaw.toUpperCase() === 'CONSULTORIA'
      ? 'Consultoria'
      : naturezaRaw.toUpperCase() === 'INSTRUTORIA'
      ? 'Instrutoria'
      : naturezaRaw;
  const produto = String(project.solucao_contratada || project.programa || 'Faça a gestão financeira e tenha controle do seu dinheiro')
    .replace(/\s*\(presencial\/remoto\/na.*$/i, '')
    .trim();
  const dataExec = formatDataBr(project.data_atendimento || project.data_prevista_inicio);
  const cidadePrestacao = String(project.municipio || 'São Paulo')
    .replace(/\s*\(Remoto\)/i, '')
    .replace(/\s*\(Online\)/i, '')
    .trim() || 'São Paulo';
  const nomeCliente = project.nome_cliente || project.razao_social || '';
  const docCliente = project.cnpj || project.cpf || '';

  return [
    `Edital ${edital}`,
    `Processo ${processo}`,
    `SGF nº. ${sgf}`,
    `RAE: ${rawRae}`,
    `OS:${osNumber}`,
    `Profissional Responsável: ${profissional}`,
    `Quantidade de Horas: ${horasLabel}`,
    `Natureza: ${naturezaFormatted}`,
    `Produto: ${produto}`,
    `Data da execução: ${dataExec}`,
    `Local (Cidade) da Prestação de Serviço : ${cidadePrestacao}`,
    `Nome/Razão Social do Cliente : ${nomeCliente}`,
    `CPF/CNPJ: ${docCliente}`,
    `Dados Bancários da Empresa`,
    `DADOS BANCÁRIOS:`,
    `BCO: 756 - SICOOB`,
    `AG: 3194`,
    `CC: 9747187-9`,
  ].join('\n');
}
