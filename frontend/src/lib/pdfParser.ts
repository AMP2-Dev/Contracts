import * as pdfjsLib from 'pdfjs-dist';
import type { Project } from '../types/database';
import { findSebraeSpErCredenciado, buildSebraeSpNfDiscriminacao } from './sebraeSpUtils';

// Configure pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface ParsedOSResult {
  osNumber: string | null;
  codigoSgf: string | null;
  produto: string | null;
  unidadeDemandante: string | null;
  gestorResponsavel: string | null;
  emailGestor: string | null;
  clients: Array<{
    rae: string | null;
    cpf: string | null;
    cnpj: string | null;
    nome: string | null;
    telefone: string | null;
    localAtendimento: string | null;
  }>;
}

export async function parsePdfFile(file: File): Promise<Project[]> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;

  let fullText = '';
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += pageText + '\n';
  }

  return parseOsText(fullText, file.name);
}

export function parseOsText(text: string, fileName: string): Project[] {
  const now = new Date().toISOString();

  // Extract OS Number
  const osMatch = text.match(/(?:N[º°]?\s*ORDEM\s*SERVIÇO|Ordem\s*de\s*Serviço\s*n[º°]?)\s*[:\s]*([0-9\/\-]+)/i);
  const osNumber = osMatch ? osMatch[1].trim() : null;

  // Extract SGF Code
  const sgfMatch = text.match(/CÓDIGO\s*SGF\s*[:\s]*([A-Z0-9]+)/i);
  const codigoSgf = sgfMatch ? sgfMatch[1].trim() : null;

  // Extract Unidade Demandante (ex: ER Grande ABC, ER Campinas, etc.)
  const unidadeMatch = text.match(/UNIDADE\s*DEMANDANTE\s*[:\s]*([A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9\s\-]+?)(?=\s*GESTOR\s*RESPONSÁVEL|\s*CÓDIGO\s*SGF|\s*E-MAIL|$)/i);
  const unidadeDemandante = unidadeMatch ? unidadeMatch[1].trim().replace(/\s+/g, ' ') : null;

  // Extract Gestor da OS
  const gestorMatch = text.match(/GESTOR\s*RESPONSÁVEL\s*[:\s]*([A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]+?)(?=\s*E-MAIL|\s*CÓDIGO|$)/i);
  const gestor = gestorMatch ? gestorMatch[1].trim().replace(/\s+/g, ' ') : null;

  // Extract E-mail Gestor da OS
  const emailGestorMatch = text.match(/E-MAIL\s*[:\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  const emailGestor = emailGestorMatch ? emailGestorMatch[1].trim() : null;

  // Extract Carga Horária (ex: CARGA HORÁRIA 1 ou Consultoria Padrão: 1 horas)
  const cargaMatch =
    text.match(/CARGA\s*HORÁRIA\s*[:\s]*([0-9]+(?:[.,][0-9]+)?)/i) ||
    text.match(/NATUREZA\s*[:\s]*[^\d]*([0-9]+(?:[.,][0-9]+)?)\s*hora/i);
  const horasContratadas = cargaMatch ? parseFloat(cargaMatch[1].replace(',', '.')) || 1 : 1;

  // Extract Valor da OS
  const valorMatch = text.match(/VALOR\s*(?:TOTAL\s*DA\s*ORDEM\s*DE\s*SERVIÇO|DA\s*PRESTAÇÃO\s*DE\s*SERVIÇOS)\s*[:\s]*R\$\s*([0-9.,]+)/i);
  const valorConsultoria = valorMatch
    ? parseFloat(valorMatch[1].replace(/\./g, '').replace(',', '.')) || 170
    : (horasContratadas === 1 ? 170 : 1224);

  // Extract Data Prevista para Execução
  const dataPrevistaMatch = text.match(/DATA\s*PREVISTA\s*PARA\s*EXECUÇÃO\s*[:\s]*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i);
  const dataPrevistaBr = dataPrevistaMatch ? dataPrevistaMatch[1].trim() : now.split('T')[0];

  // Extract Edital e Processo
  const editalMatch = text.match(/Edital\s*(?:n[º°]?\s*)?([0-9]{3}\/[0-9]{4})/i);
  const edital = editalMatch ? editalMatch[1].trim() : '004/2026';
  const processoMatch = text.match(/Processo\s*(?:n[º°]?\s*)?([0-9]+\/[0-9]{4})/i);
  const processoNo = processoMatch ? processoMatch[1].trim() : '1777/2025';

  // Extract Produto Aplicado (remove sufixo truncado "(presencial/remoto/na")
  const produtoMatch = text.match(/PRODUTO\s*APLICADO\s*[:\s]*([^]+?)(?=\s*OBJETO|\s*DADOS DO|$)/i);
  const produtoRaw = produtoMatch ? produtoMatch[1].trim().replace(/\s+/g, ' ') : 'Faça a gestão financeira e tenha controle do seu dinheiro';
  const produto = produtoRaw.replace(/\s*\(presencial\/remoto\/na.*$/i, '').trim();

  // Extract Modalidade
  const formatoMatch = text.match(/FORMATO\s*DE\s*EXECUÇÃO\s*[:\s]*([A-ZÁÉÍÓÚÂÊÔÃÕÇ\s\(\)\-]+?)(?=\s*CARGA\s*HORÁRIA|\s*LOCAL|$)/i);
  const formatoRaw = formatoMatch ? formatoMatch[1].trim() : '';
  const isPresencial = /presencial/i.test(formatoRaw);
  const modalidade = isPresencial ? 'Presencial' : 'À Distância (Online)';
  const plataformaUtilizada = isPresencial ? 'Presencial' : 'Plataforma Microsoft Teams';

  const representanteMatch = text.match(/REPRESENTANTE\s*LEGAL\s*[:\s]*([A-ZÁÉÍÓÚÂÊÔÃÕÇ\s\-]+?)(?=\s*E\s*-\s*MAIL|\s*TEL|\s*CNPJ|$)/i);
  const fornecedorMatch = text.match(/DADOS\s*DO\s*FORNECEDOR\s*CREDENCIADO[\s\S]*?RAZÃO\s*SOCIAL\s*[:\s]*([A-ZÁÉÍÓÚÂÊÔÃÕÇ\s\-]+?)(?=\s*CNPJ|\s*ENDEREÇO|$)/i);
  const naturezaMatch = text.match(/NATUREZA\s*[:\s]*([A-ZÁÉÍÓÚÂÊÔÃÕÇ\s\:]+?)(?=\s*ÁREA|\s*SUBÁREA|$)/i);

  const profissionalResponsavel = representanteMatch ? representanteMatch[1].trim() : 'MARCO ANTONIO PAVANI';
  const empresaCredenciada = fornecedorMatch ? fornecedorMatch[1].trim().replace(/\s+/g, ' ') : 'AMP DO BRASIL SOLUCOES ADMINISTRATIVAS E TECNOLOGICAS LTDA';
  const natureza = (naturezaMatch && /instrutoria/i.test(naturezaMatch[1])) ? 'INSTRUTORIA' : 'CONSULTORIA';
  const contratoNo = codigoSgf || osNumber;

  // Identifica se é OS de São Paulo e cruza UNIDADE DEMANDANTE com a tabela de E-mails Credenciados ER
  const isSp = Boolean(
    (codigoSgf && codigoSgf.toUpperCase().startsWith('SP')) ||
    unidadeDemandante ||
    (emailGestor && emailGestor.toLowerCase().includes('@sebraesp.com.br')) ||
    /SEBRAE[\s\-]*SP/i.test(text)
  );
  const erCredenciado = findSebraeSpErCredenciado(unidadeDemandante);
  const estadoPadrao = isSp ? 'SP' : 'RJ';
  const municipioPadrao = isSp
    ? (erCredenciado?.er.replace(/^ER\s+/i, '').replace(/^Capital.*$/i, 'São Paulo') || 'São Paulo')
    : 'Rio de Janeiro';

  // Parse Clients from DADOS DO(S) CLIENTE(S)
  const clientRegex = /Cliente\s*(\d+)[\s\S]*?Código\s*RAE\s*[:\s]*([0-9]+)[\s\S]*?CPF\s*(?:do\s*Cliente)?\s*[:\s]*([0-9.\-]+)[\s\S]*?Nome\s*(?:do\s*Cliente)?\s*[:\s]*([A-ZÁÉÍÓÚÂÊÔÃÕÇ\s\-]+?)\s*CNPJ\s*[:\s]*([0-9.\/\-]+)[\s\S]*?Telefone\s*(?:do\s*Cliente)?\s*[:\s]*(\([0-9]{2}\)\s*[0-9\-\s]+)/gi;

  const parsedClients: any[] = [];
  let match;
  while ((match = clientRegex.exec(text)) !== null) {
    parsedClients.push({
      num: match[1],
      rae: match[2],
      cpf: match[3],
      nome: match[4].trim(),
      cnpj: match[5],
      telefone: match[6].trim(),
    });
  }

  // Fallback matchers if regex is slightly off
  if (parsedClients.length === 0) {
    const clientBlocks = text.split(/Cliente\s+\d+/i);
    if (clientBlocks.length > 1) {
      for (let i = 1; i < clientBlocks.length; i++) {
        const block = clientBlocks[i];
        const raeM = block.match(/RAE\s*[:\s]*([0-9]+)/i);
        const cpfM = block.match(/CPF\s*[:\s]*([0-9.\-]+)/i);
        const cnpjM = block.match(/CNPJ\s*[:\s]*([0-9.\/\-]+)/i);
        const nomeM = block.match(/Nome\s*(?:do\s*Cliente)?\s*[:\s]*([A-ZÁÉÍÓÚÂÊÔÃÕÇ\s\-]{3,40})/i);
        const telM = block.match(/Telefone\s*(?:do\s*Cliente)?\s*[:\s]*(\([0-9]{2}\)\s*[0-9\-\s]+)/i);

        if (nomeM || raeM || cnpjM) {
          parsedClients.push({
            num: String(i),
            rae: raeM ? raeM[1] : null,
            cpf: cpfM ? cpfM[1] : null,
            nome: nomeM ? nomeM[1].trim() : `Cliente ${i}`,
            cnpj: cnpjM ? cnpjM[1] : null,
            telefone: telM ? telM[1].trim() : null,
          });
        }
      }
    }
  }

  // Formato SOMA SEBRAE SP de cliente único em DADOS DO(S) CLIENTE(S):
  // Ex: "RAE: 39666760 EMPRESA: 47.983.316 HERMÍNIA ROSA SOUZA DE JESUS CLIENTE: HERMINIA ROSA SOUZA DE JESUS CONTATO: 11 99306-8169 E-MAIL: HERMINIAROSAFOREVER@GMAIL.COM"
  if (parsedClients.length === 0) {
    const somaSectionMatch = text.match(/DADOS\s*DO\(S\)\s*CLIENTE\(S\)([\s\S]*?)(?=VIGÊNCIA|FORMATO\s*DE\s*EXECUÇÃO|$)/i);
    const searchArea = somaSectionMatch ? somaSectionMatch[1] : text;

    const singleRae = searchArea.match(/RAE\s*[:\s]*([0-9\/\-]+)/i) || text.match(/(?:RAE|RAE\s*Código)\s*[:\s]*([0-9\/\-]+)/i);
    const clienteExplicit = searchArea.match(/CLIENTE\s*[:\s]*([A-ZÁÉÍÓÚÂÊÔÃÕÇ\s\-]+?)(?=\s*CONTATO|\s*E-MAIL|\s*VIGÊNCIA|$)/i);
    const empresaExplicit = searchArea.match(/EMPRESA\s*[:\s]*([0-9.\-\/]+)?\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ\s\-]+?)(?=\s*CLIENTE|\s*CONTATO|$)/i);
    const cnpjExplicit =
      searchArea.match(/EMPRESA\s*[:\s]*([0-9]{2}\.[0-9]{3}\.[0-9]{3}(?:\/[0-9]{4}-[0-9]{2})?)/i) ||
      searchArea.match(/CNPJ\s*[:\s]*([0-9.\/\-]+)/i);
    const singleCpf = searchArea.match(/CPF\s*[:\s]*([0-9.\-]+)/i);
    const contatoExplicit = searchArea.match(/CONTATO\s*[:\s]*([0-9\(\)\s\-]+)/i);
    const emailExplicitMatches = searchArea.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi);
    const emailCliente = emailExplicitMatches
      ? emailExplicitMatches.find((e) => !e.toLowerCase().includes('sebrae') && !e.toLowerCase().includes('ampliando'))
      : null;

    let rawCnpj = cnpjExplicit ? cnpjExplicit[1].trim() : null;
    if (rawCnpj && !rawCnpj.includes('/')) {
      rawCnpj = `${rawCnpj}/0001-00`;
    }

    const nomeClienteFinal = clienteExplicit
      ? clienteExplicit[1].trim()
      : (empresaExplicit?.[2]?.trim() || fileName.replace(/\.pdf$/i, ''));

    const razaoSocialFinal = empresaExplicit
      ? `${empresaExplicit[1] ? empresaExplicit[1].trim() + ' ' : ''}${empresaExplicit[2]?.trim() || ''}`.trim()
      : nomeClienteFinal;

    const singleProject: Project = {
      id: `pdf-${osNumber ? osNumber.replace(/\D/g, '') : Date.now()}`,
      consultor_id: 'admin-1',
      codigo_rae: singleRae ? singleRae[1] : (osNumber ? `OS ${osNumber}` : `RAE-${Math.floor(1000 + Math.random() * 9000)}`),
      status: 'novo_contrato',
      nome_cliente: nomeClienteFinal,
      razao_social: razaoSocialFinal,
      cnpj: rawCnpj,
      cpf: singleCpf ? singleCpf[1] : null,
      telefone: contatoExplicit ? contatoExplicit[1].trim() : null,
      celular: contatoExplicit ? contatoExplicit[1].trim() : null,
      email_cliente: emailCliente || null,
      municipio: municipioPadrao,
      estado: estadoPadrao,
      programa: codigoSgf ? `${codigoSgf} SGF 2026` : 'Consultoria Sebrae',
      solucao_contratada: produto,
      objetivo_atendimento: `Ordem de Serviço ${osNumber || ''} - ${unidadeDemandante || 'Sebrae'}`,
      horas_contratadas: horasContratadas,
      horas_realizadas: horasContratadas,
      data_atendimento: dataPrevistaBr,
      data_prevista_inicio: dataPrevistaBr,
      data_prevista_fim: dataPrevistaBr,
      modalidade,
      valor_consultoria: valorConsultoria,
      edital,
      processo_no: processoNo,
      contrato_no: contratoNo,
      empresa_credenciada: empresaCredenciada,
      profissional_responsavel: profissionalResponsavel,
      natureza,
      plataforma_utilizada: plataformaUtilizada,
      observacoes: `Unidade: ${unidadeDemandante || erCredenciado?.er || 'N/A'} | E-mail ER Credenciado: ${erCredenciado?.email || 'N/A'} (${erCredenciado?.gestor || 'N/A'}) | Gestor OS: ${gestor || 'N/A'} (${emailGestor || 'N/A'}) | SGF: ${codigoSgf || 'N/A'}`,
      dados_extra: {
        os_number: osNumber,
        sgf: codigoSgf,
        codigo_sgf: codigoSgf,
        unidade_demandante: unidadeDemandante || erCredenciado?.er || null,
        er_credenciado: erCredenciado?.er || unidadeDemandante || null,
        gestor_er_credenciado: erCredenciado?.gestor || null,
        email_er_credenciado: erCredenciado?.email || null,
        gestor,
        email_gestor: emailGestor,
      },
      criado_em: now,
      atualizado_em: now,
    };

    singleProject.dados_extra.nf_discriminacao = buildSebraeSpNfDiscriminacao(singleProject);
    return [singleProject];
  }

  // Desmembrar: Generate 1 Project per Client
  return parsedClients.map((client, idx) => {
    const proj: Project = {
      id: `pdf-${osNumber || Date.now()}-${idx + 1}`,
      consultor_id: 'admin-1',
      codigo_rae: client.rae ? client.rae : (osNumber ? `OS ${osNumber}` : `RAE-${idx + 1}`),
      status: 'novo_contrato' as const,
      nome_cliente: client.nome,
      razao_social: client.nome,
      cnpj: client.cnpj,
      cpf: client.cpf,
      telefone: client.telefone,
      celular: client.telefone,
      municipio: municipioPadrao,
      estado: estadoPadrao,
      programa: codigoSgf ? `${codigoSgf} SGF 2026` : 'Consultoria Sebrae',
      solucao_contratada: produto,
      objetivo_atendimento: `Atendimento ${client.nome} - OS ${osNumber || ''} (Cliente ${idx + 1}/${parsedClients.length})`,
      horas_contratadas: horasContratadas,
      horas_realizadas: horasContratadas,
      data_atendimento: dataPrevistaBr,
      data_prevista_inicio: dataPrevistaBr,
      data_prevista_fim: dataPrevistaBr,
      modalidade,
      valor_consultoria: valorConsultoria,
      edital,
      processo_no: processoNo,
      contrato_no: contratoNo,
      empresa_credenciada: empresaCredenciada,
      profissional_responsavel: profissionalResponsavel,
      natureza,
      plataforma_utilizada: plataformaUtilizada,
      observacoes: `OS ${osNumber || ''} | Unidade: ${unidadeDemandante || erCredenciado?.er || 'SP'} (${erCredenciado?.email || emailGestor || ''}) | Cliente ${idx + 1}/${parsedClients.length} | Gestor: ${gestor || erCredenciado?.gestor || 'Sebrae'}`,
      dados_extra: {
        os_number: osNumber,
        sgf: codigoSgf,
        codigo_sgf: codigoSgf,
        unidade_demandante: unidadeDemandante || erCredenciado?.er || null,
        er_credenciado: erCredenciado?.er || unidadeDemandante || null,
        gestor_er_credenciado: erCredenciado?.gestor || null,
        email_er_credenciado: erCredenciado?.email || null,
        gestor,
        email_gestor: emailGestor,
        cliente_num: client.num || idx + 1,
      },
      criado_em: now,
      atualizado_em: now,
    };
    proj.dados_extra.nf_discriminacao = buildSebraeSpNfDiscriminacao(proj);
    return proj;
  });
}
