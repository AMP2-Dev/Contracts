if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor() {
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
    }
  };
}
if (typeof globalThis.Path2D === 'undefined') {
  globalThis.Path2D = class Path2D {};
}

import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nblgkcnsjziezqdiozxo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ibGdrY25zanppZXpxZGlvenhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3NjgzNTgsImV4cCI6MjEwNTM0NDM1OH0.pqa4cMC1wSv-5yQltbTOkiGR33yjKBMwXugqWRxFzOQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  // Configurações CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let imapConfig = req.body?.imapConfig || {};
    let extraConfig = {};

    // Busca das configurações salvas no banco
    const { data: configRow } = await supabase
      .from('projetos')
      .select('dados_extra')
      .eq('id', '__system_company_config__')
      .maybeSingle();

    if (configRow?.dados_extra) {
      extraConfig = configRow.dados_extra.company_config || configRow.dados_extra;
      if (!imapConfig.host || !imapConfig.user || !imapConfig.pass) {
        imapConfig = {
          host: extraConfig.imapHost || extraConfig.smtpHost || 'imap.uni5.net',
          port: extraConfig.imapPort || 993,
          user: extraConfig.imapUser || extraConfig.smtpUser || '',
          pass: extraConfig.imapPass || extraConfig.smtpPass || '',
          useSSL: extraConfig.imapUseSSL !== false
        };
      }
    }

    // Se ainda não temos usuário ou senha, avisa o usuário para configurar
    if (!imapConfig.user || !imapConfig.pass) {
      return res.status(200).json({
        ok: false,
        requiresConfig: true,
        message: 'Credenciais de e-mail (IMAP) ainda não configuradas. Acesse a aba Configurações > E-mail (IMAP) para informar seu usuário e senha.'
      });
    }

    const host = String(imapConfig.host || 'mail.amp.ia.br').trim();
    const port = Number(imapConfig.port) || 993;
    const user = String(imapConfig.user).trim();
    const pass = String(imapConfig.pass);
    const useSSL = imapConfig.useSSL !== false;

    console.log(`[POLL] Conectando ao servidor IMAP: ${host}:${port} (${user})...`);

    const client = new ImapFlow({
      host,
      port,
      secure: useSSL,
      auth: { user, pass },
      logger: false,
      clientInfo: { name: 'AMP Demanda Poller', version: '1.0.0' }
    });

    await client.connect();

    const lock = await client.getMailboxLock('INBOX');
    const novosProcessados = [];
    let lastPdfError = null;

    try {
      // 1. Busca mensagens não lidas
      let uids = await client.search({ seen: false }, { uid: true });
      let isCheckingRecent = false;

      // Se não houver não lidas ou for busca forçada/reprocessamento, busca as 30 mais recentes da caixa
      if (!uids || uids.length === 0 || req.body?.force || req.body?.reprocessMessageId) {
        console.log('[POLL] Verificando as 30 mensagens mais recentes da caixa...');
        const allUids = await client.search({ all: true }, { uid: true });
        uids = (allUids || []).slice(-30);
        isCheckingRecent = true;
      } else {
        uids = uids.slice(-20); // Limita às 20 mais recentes
      }

      console.log(`[POLL] ${uids.length} mensagem(ns) selecionada(s) para análise.`);

      for (const uid of uids) {
        try {
          const msgMeta = await client.fetchOne(uid, { envelope: true, size: true }, { uid: true });
          if (!msgMeta || !msgMeta.envelope) continue;

          const messageId = msgMeta.envelope.messageId || `uid-${uid}`;
          const remetente = msgMeta.envelope.from?.[0]?.address || 'desconhecido';
          const assunto = msgMeta.envelope.subject || '(sem assunto)';
          const dataEmail = msgMeta.envelope.date ? new Date(msgMeta.envelope.date).toISOString() : new Date().toISOString();

          const isTargetReprocess = req.body?.reprocessMessageId && (
            req.body.reprocessMessageId === messageId || 
            req.body.reprocessMessageId === `uid-${uid}`
          );

          // Idempotência: verifica se este message_id já foi salvo
          const { data: existente } = await supabase
            .from('emails_processados')
            .select('id, status')
            .eq('message_id', messageId)
            .maybeSingle();

          if (existente && !req.body?.force && !isTargetReprocess) {
            console.log(`[POLL] Mensagem já registrada anteriormente: "${assunto}" (${messageId}). Pulando.`);
            continue;
          }

          const textoAssunto = (assunto || '').toLowerCase();
          const textoRemetente = (remetente || '').toLowerCase();

          // 1. Blacklist rigorosa de informativos, comunicados, avisos e e-mails administrativos
          const isBlacklisted = (
            textoAssunto.includes('sgf informa') ||
            textoAssunto.includes('academia soma') ||
            textoAssunto.includes('tira-dúvidas') ||
            textoAssunto.includes('tira duvidas') ||
            textoAssunto.includes('treinamento') ||
            textoAssunto.includes('parecer da atualização') ||
            textoAssunto.includes('atualização de dados') ||
            textoAssunto.includes('indisponibilidade') ||
            textoAssunto.includes('reconsideração de suspensão') ||
            textoAssunto.includes('reconsideracao de suspensao') ||
            textoAssunto.includes('término de vigência') ||
            textoAssunto.includes('termino de vigencia') ||
            textoAssunto.includes('canais de atendimento') ||
            textoAssunto.includes('pesquisa de satisfação') ||
            textoAssunto.includes('webinar') ||
            textoAssunto.includes('potencialize') ||
            textoAssunto.includes('cancelamento de agenda') ||
            textoAssunto.includes('automatic reply') ||
            textoAssunto.includes('aviso ') ||
            textoRemetente.includes('noreply@')
          );

          if (isBlacklisted && !isTargetReprocess) {
            console.log(`[POLL] ⏭️ Ignorando informativo/aviso: "${assunto}" (${remetente})`);
            continue;
          }

          // 2. Critérios de Qualificação Rigorosos para Demanda / OS / Proposta
          const isOS = (
            textoAssunto.includes('ordem de serviço') ||
            textoAssunto.includes('ordem de servico') ||
            /\bos\s*(?:n[º°]?\s*)?[0-9\/\-]+/i.test(textoAssunto)
          );

          const isProposta = (
            textoAssunto.includes('proposta para prestação') ||
            textoAssunto.includes('proposta de prestação') ||
            textoAssunto.includes('proposta de serviços') ||
            textoAssunto.includes('proposta de consultoria') ||
            textoAssunto.includes('proposta para analise') ||
            textoAssunto.includes('proposta para análise')
          );

          const isDemandaExplicit = (
            textoAssunto.includes('demanda de consultoria') ||
            textoAssunto.includes('atribuição de demanda') ||
            textoAssunto.includes('atribuicao de demanda') ||
            /\brae\s*[:\s]*[0-9]+/i.test(textoAssunto) ||
            /\bcódigo\s*sgf\s*[:\s]*[a-z0-9]+/i.test(textoAssunto)
          );

          const isCandidate = isTargetReprocess || isOS || isProposta || isDemandaExplicit;

          if (!isCandidate) {
            console.log(`[POLL] ⏭️ Pulando e-mail que não é OS ou Proposta: "${assunto}"`);
            continue;
          }

          // Baixa o conteúdo completo da mensagem apenas para candidatos
          const fullMessage = await client.download(uid, undefined, { uid: true });
          const parsed = await simpleParser(fullMessage.content);

          let anexoNome = null;
          let parsedPdfData = null;

          if (parsed.attachments && parsed.attachments.length > 0) {
            anexoNome = parsed.attachments.map(a => a.filename).filter(Boolean).join(', ');

            // Procura anexo PDF de Ordem de Serviço para extrair dados reais do cliente
            const osPdfAttachment = parsed.attachments.find(a => 
              a.filename && (a.filename.toLowerCase().endsWith('.pdf') || a.contentType === 'application/pdf') &&
              !a.filename.toLowerCase().includes('orienta') && !a.filename.toLowerCase().includes('reembolso')
            ) || parsed.attachments.find(a => a.filename && a.filename.toLowerCase().endsWith('.pdf'));

            if (osPdfAttachment && osPdfAttachment.content) {
              try {
                const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.js');
                globalThis.pdfjsWorker = pdfjsWorker;
                const pdfjsLib = await import('pdfjs-dist/build/pdf.js');

                const data = new Uint8Array(osPdfAttachment.content);
                const loadingTask = pdfjsLib.getDocument({
                  data,
                  useSystemFonts: true,
                  disableFontFace: true
                });
                const pdfDoc = await loadingTask.promise;
                let pdfText = '';
                for (let i = 1; i <= pdfDoc.numPages; i++) {
                  const page = await pdfDoc.getPage(i);
                  const content = await page.getTextContent();
                  pdfText += content.items.map(item => item.str).join(' ') + '\n';
                }

                if (pdfText) {
                  const osMatch = pdfText.match(/(?:N[º°]?\s*ORDEM\s*SERVIÇO|Ordem\s*de\s*Serviço\s*n[º°]?)\s*[:\s]*([0-9\/\-]+)/i);
                  const sgfMatch = pdfText.match(/CÓDIGO\s*SGF\s*[:\s]*([A-Z0-9]+)/i);
                  const unidadeMatch = pdfText.match(/UNIDADE\s*DEMANDANTE\s*[:\s]*([A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9\s\-]+?)(?=\s*GESTOR\s*RESPONSÁVEL|\s*CÓDIGO\s*SGF|\s*E-MAIL|$)/i);
                  const unidadeDemandante = unidadeMatch ? unidadeMatch[1].trim().replace(/\s+/g, ' ') : null;
                  const gestorMatch = pdfText.match(/GESTOR\s*RESPONSÁVEL\s*[:\s]*([A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]+?)(?=\s*E-MAIL|\s*CÓDIGO|$)/i);
                  const emailGestorMatch = pdfText.match(/E-MAIL\s*[:\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
                  const produtoMatch = pdfText.match(/PRODUTO\s*APLICADO\s*[:\s]*([^]+?)(?=\s*OBJETO|\s*DADOS DO|$)/i);
                  const cargaMatch =
                    pdfText.match(/CARGA\s*HORÁRIA\s*[:\s]*([0-9]+(?:[.,][0-9]+)?)/i) ||
                    pdfText.match(/NATUREZA\s*[:\s]*[^\d]*([0-9]+(?:[.,][0-9]+)?)\s*hora/i);
                  const horasContratadas = cargaMatch ? parseFloat(cargaMatch[1].replace(',', '.')) || 1 : 1;

                  const editalMatch = pdfText.match(/Edital\s*(?:n[º°]?\s*)?([0-9]{3}\/[0-9]{4})/i);
                  const edital = editalMatch ? editalMatch[1].trim() : '004/2026';
                  const processoMatch = pdfText.match(/Processo\s*(?:n[º°]?\s*)?([0-9]+\/[0-9]{4})/i);
                  const processoNo = processoMatch ? processoMatch[1].trim() : '1777/2025';
                  
                  const raeMatch = pdfText.match(/RAE\s*[:\s]*([0-9]+)/i);
                  const clienteMatch = pdfText.match(/CLIENTE\s*[:\s]*([A-ZÁÉÍÓÚÂÊÔÃÕÇ\s\-]+?)(?=\s*CONTATO|\s*E-MAIL|\s*VIGÊNCIA|$)/i);
                  const empresaFullMatch = pdfText.match(/EMPRESA\s*[:\s]*([0-9.\-\/]+)?\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ\s\-]+?)(?=\s*CLIENTE|\s*RAE|\s*CONTATO|$)/i);
                  const cnpjMatch = pdfText.match(/EMPRESA\s*[:\s]*([0-9]{2}\.[0-9]{3}\.[0-9]{3}(?:\/[0-9]{4}-[0-9]{2})?|[0-9]{2}\.[0-9]{3}\.[0-9]{3})/i) || pdfText.match(/CNPJ\s*[:\s]*([0-9.\-\/]+)/i);
                  const contatoMatch = pdfText.match(/CONTATO\s*[:\s]*([0-9\(\)\s\-]+)/i);
                  const emailClienteMatches = pdfText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi);
                  const emailCliente = emailClienteMatches ? emailClienteMatches.find(e => !e.toLowerCase().includes('sebrae') && !e.toLowerCase().includes('ampliando')) : null;
                  const valorMatch = pdfText.match(/VALOR\s*(?:TOTAL\s*DA\s*ORDEM\s*DE\s*SERVIÇO|DA\s*PRESTAÇÃO\s*DE\s*SERVIÇOS)\s*[:\s]*R\$\s*([0-9.,]+)/i);
                  const dataPrevistaMatch = pdfText.match(/DATA\s*PREVISTA\s*PARA\s*EXECUÇÃO\s*[:\s]*([0-9\/]+)/i);
                  const prefMatch = pdfText.match(/Cliente deseja agendar[^.]+?\./i);
                  const prefObs = prefMatch ? prefMatch[0].replace(/\s+/g, ' ').trim() : '';

                  const formatoMatch = pdfText.match(/FORMATO\s*DE\s*EXECUÇÃO\s*[:\s]*([A-ZÁÉÍÓÚÂÊÔÃÕÇ\s\(\)\-]+?)(?=\s*CARGA\s*HORÁRIA|\s*LOCAL|$)/i);
                  const representanteMatch = pdfText.match(/REPRESENTANTE\s*LEGAL\s*[:\s]*([A-ZÁÉÍÓÚÂÊÔÃÕÇ\s\-]+?)(?=\s*E\s*-\s*MAIL|\s*TEL|\s*CNPJ|$)/i);
                  const fornecedorMatch = pdfText.match(/DADOS\s*DO\s*FORNECEDOR\s*CREDENCIADO[\s\S]*?RAZÃO\s*SOCIAL\s*[:\s]*([A-ZÁÉÍÓÚÂÊÔÃÕÇ\s\-]+?)(?=\s*CNPJ|\s*ENDEREÇO|$)/i);
                  const naturezaMatch = pdfText.match(/NATUREZA\s*[:\s]*([A-ZÁÉÍÓÚÂÊÔÃÕÇ\s\:]+?)(?=\s*ÁREA|\s*SUBÁREA|$)/i);

                  const formatoRaw = formatoMatch ? formatoMatch[1].trim() : 'À Distância (Online)';
                  const isPresencial = /presencial/i.test(formatoRaw);
                  const plataformaUtilizada = isPresencial ? 'Presencial' : 'Plataforma Microsoft Teams';
                  const profissionalResponsavel = representanteMatch ? representanteMatch[1].trim() : 'MARCO ANTONIO PAVANI';
                  const empresaCredenciada = fornecedorMatch ? fornecedorMatch[1].trim().replace(/\s+/g, ' ') : 'AMP DO BRASIL SOLUCOES ADMINISTRATIVAS E TECNOLOGICAS LTDA';
                  const natureza = (naturezaMatch && /instrutoria/i.test(naturezaMatch[1])) ? 'INSTRUTORIA' : 'CONSULTORIA';

                  // Tabela oficial de ERs Credenciados SEBRAE-SP
                  const TABELA_ER_SP = [
                    { er: 'ER Campinas', gestor: 'EDUARDO DA COSTA SENE NETO', email: 'credenciamento.er.cp@sebraesp.com.br' },
                    { er: 'Desenvolvimento de Solucoes', gestor: 'Fatima de Oliveira', email: 'credenciamento.ugstd@sebraesp.com.br' },
                    { er: 'ER Alto Tietê', gestor: 'CRISTIANE BENTO DE SOUZA', email: 'credencimento.er.at@sebraesp.com.br' },
                    { er: 'ER Araçatuba', gestor: 'DAIANA KODAMA FERREIRA BERTACHINI', email: 'credenciamento.er.artb@sebraesp.com.br' },
                    { er: 'ER Araraquara', gestor: 'Marjorie Ambo Koto', email: 'credenciamento.er.arr@sebraesp.com.br' },
                    { er: 'ER Baixada Santista', gestor: 'ADRIANA PAULA MORAES RAMIRES RAMOS', email: 'credenciamento.er.bs@sebraesp.com.br' },
                    { er: 'ER BARRETOS', gestor: 'JOYCE COSTA HENRIQUE', email: 'credenciamento.er.brt@sebraesp.com.br' },
                    { er: 'ER Bauru', gestor: 'ANA AMELIA CORREA PRECIOSO', email: 'credenciamento.er.br@sebraesp.com.br' },
                    { er: 'ER BOTUCATU', gestor: 'FLAVIO SILVA DE OLIVEIRA', email: 'credenciamento.er.btt@sebraesp.com.br' },
                    { er: 'ER Capital Centro', gestor: 'Eurides Maria Ramalho Alves', email: 'credenciamento.er.cc@sebraesp.com.br' },
                    { er: 'ER Capital Leste I', gestor: 'DAIANNA COSTA FLORES BELO', email: 'credenciamento.er.cl1@sebraesp.com.br' },
                    { er: 'ER Capital Leste II', gestor: 'LUCIA AMELIA GOMES', email: 'credenciamento.er.cl2@sebraesp.com.br' },
                    { er: 'ER Capital Norte', gestor: 'SIMONE PERES ZAGATI', email: 'credenciamento.er.cn@sebraesp.com.br' },
                    { er: 'ER Capital Oeste', gestor: 'Taissa Telles de Abreu Lourenço', email: 'credenciamento.er.co@sebraesp.com.br' },
                    { er: 'ER Capital Sul', gestor: 'WILSON BORGES DE CARVALHO JUNIOR', email: 'credenciamento.er.cs@sebraesp.com.br' },
                    { er: 'ER Franca', gestor: 'PRISCILA PEREIRA BATISTA TOLOI', email: 'credenciamento.er.fr@sebraesp.com.br' },
                    { er: 'ER Grande ABC', gestor: 'DHIEGO GARCIA OLIVEIRA', email: 'credenciamento.er.abc@sebraesp.com.br' },
                    { er: 'ER Guaratinguetá', gestor: 'MARCELA DE BARROS LEITE VILELA', email: 'credenciamento.er.gra@sebraesp.com.br' },
                    { er: 'ER Guarulhos', gestor: 'JOSE LEANDRO DE SOUZA', email: 'credenciamento.er.gru@sebraesp.com.br' },
                    { er: 'ER Jundiaí', gestor: 'SILVIA DELLA MATRICE', email: 'credenciamento.er.jd@sebraesp.com.br' },
                    { er: 'ER Marília', gestor: 'SIDNEY GUERMANDI RAMALHO', email: 'credenciamento.er.mr@sebraesp.com.br' },
                    { er: 'ER Osasco', gestor: 'FERNANDO CORREA QUEIROZ', email: 'credenciamento.er.os@sebraesp.com.br' },
                    { er: 'ER Ourinhos', gestor: 'CAMILA DA SILVA MARQUES', email: 'credenciamento.er.or@sebraesp.com.br' },
                    { er: 'ER Piracicaba', gestor: 'ALAN ADILSON TANNO', email: 'credenciamento.er.prb@sebraesp.com.br' },
                    { er: 'ER Presidente Prudente', gestor: 'VERONICA FRANCIANE DORIA', email: 'credenciamento.er.pr@sebraesp.com.br' },
                    { er: 'ER Ribeirão Preto', gestor: 'Lederson Schwab Morais', email: 'credenciamento.er.rp@sebraesp.com.br' },
                    { er: 'ER São Carlos', gestor: 'DIEGO PEREIRA DE SOUZA', email: 'credenciamento.er.sc@sebraesp.com.br' },
                    { er: 'ER São João da Boa Vista', gestor: 'Raphael De Padua Medeiros', email: 'credenciamento.er.sjbv@sebraesp.com.br' },
                    { er: 'ER São José do Rio Preto', gestor: 'RICARDO LUCIANO PIOVESAN', email: 'credenciamento.er.sjrp@sebraesp.com.br' },
                    { er: 'ER São José dos Campos', gestor: 'Yuri Solano Sirobaba', email: 'credenciamento.er.sjc@sebraesp.com.br' },
                    { er: 'ER Sorocaba', gestor: 'SANDRO LUIS RESSIO', email: 'credenciamento.er.srb@sebraesp.com.br' },
                    { er: 'ER Sudoeste Paulista', gestor: 'ADRIANO AUGUSTO DE SOUZA', email: 'credenciamento.er.sdp@sebraesp.com.br' },
                    { er: 'ER Vale do Ribeira', gestor: 'ANDRE LUIZ DE ALMEIDA VITOR', email: 'credenciamento.er.vr@sebraesp.com.br' },
                    { er: 'ER Votuporanga', gestor: 'FRANCISCO EMIDIO NEGRINE DE SOUZA MARQUES', email: 'credenciamento.er.vot@sebraesp.com.br' },
                    { er: 'Rede Sebrae de Atendimento', gestor: 'SILA MELO DE CHIARA', email: 'credenciamento.uac@sebraesp.com.br' },
                    { er: 'UAMSF', gestor: '', email: 'credenciamento.uamsf@sebraesp.com.br' },
                    { er: 'UECS', gestor: 'MARCUS VINICIUS', email: 'credenciamento.uecs@sebraesp.com.br' },
                    { er: 'UPPRG', gestor: 'EDILNE ALVES', email: 'credenciamento.upprg@sebraesp.com.br' },
                  ];

                  const normText = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
                  const erEncontrada = unidadeDemandante
                    ? TABELA_ER_SP.find((item) => {
                        const nEr = normText(item.er);
                        const nUnid = normText(unidadeDemandante);
                        return nUnid === nEr || nUnid.includes(nEr) || nEr.includes(nUnid);
                      })
                    : null;

                  let rawContato = contatoMatch ? contatoMatch[1].trim() : '';
                  let formattedContato = rawContato;
                  const digits = rawContato.replace(/\D/g, '');
                  if (digits.length === 11) {
                    formattedContato = '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 7) + '-' + digits.slice(7);
                  } else if (digits.length === 10) {
                    formattedContato = '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 6) + '-' + digits.slice(6);
                  }

                  let rawCnpj = cnpjMatch ? cnpjMatch[1].trim() : null;
                  if (rawCnpj && !rawCnpj.includes('/')) {
                    rawCnpj = rawCnpj + '/0001-00';
                  }

                  const clienteNome = clienteMatch ? clienteMatch[1].trim() : null;
                  const empresaNome = empresaFullMatch ? empresaFullMatch[0].replace(/^EMPRESA\s*[:\s]*/i, '').replace(/\s+/g, ' ').trim() : (clienteNome || 'Empresa MEI');
                  const produtoLimpo = produtoMatch
                    ? produtoMatch[1].trim().replace(/\s+/g, ' ').replace(/\s*\(presencial\/remoto\/na.*$/i, '').trim()
                    : 'Faça a gestão financeira e tenha controle do seu dinheiro';

                  const sgfVal = sgfMatch ? sgfMatch[1].trim() : null;
                  const osVal = osMatch ? osMatch[1].trim() : null;
                  const raeVal = raeMatch ? raeMatch[1].trim() : null;
                  const dataExecVal = dataPrevistaMatch ? dataPrevistaMatch[1].trim() : new Date().toLocaleDateString('pt-BR');
                  const horasLabel = horasContratadas === 1 ? '1 hora' : `${String(horasContratadas).replace('.', ',')} horas`;
                  const naturezaLabel = natureza === 'INSTRUTORIA' ? 'Instrutoria' : 'Consultoria';

                  const nfDiscriminacao = [
                    `Edital ${edital}`,
                    `Processo ${processoNo}`,
                    `SGF nº. ${sgfVal || ''}`,
                    `RAE: ${raeVal || ''}`,
                    `OS:${osVal || ''}`,
                    `Profissional Responsável: ${profissionalResponsavel}`,
                    `Quantidade de Horas: ${horasLabel}`,
                    `Natureza: ${naturezaLabel}`,
                    `Produto: ${produtoLimpo}`,
                    `Data da execução: ${dataExecVal}`,
                    `Local (Cidade) da Prestação de Serviço : São Paulo`,
                    `Nome/Razão Social do Cliente : ${clienteNome || empresaNome}`,
                    `CPF/CNPJ: ${rawCnpj || ''}`,
                    `Dados Bancários da Empresa`,
                    `DADOS BANCÁRIOS:`,
                    `BCO: 756 - SICOOB`,
                    `AG: 3194`,
                    `CC: 9747187-9`
                  ].join('\n');

                  parsedPdfData = {
                    osNumber: osVal,
                    sgf: sgfVal,
                    contratoNo: sgfVal || osVal,
                    edital,
                    processoNo,
                    unidadeDemandante,
                    erCredenciado: erEncontrada?.er || unidadeDemandante || null,
                    gestorErCredenciado: erEncontrada?.gestor || null,
                    emailErCredenciado: erEncontrada?.email || null,
                    gestor: gestorMatch ? gestorMatch[1].trim() : null,
                    emailGestor: emailGestorMatch ? emailGestorMatch[1].trim() : null,
                    produto: produtoLimpo,
                    rae: raeVal,
                    clienteNome: clienteNome,
                    empresa: empresaNome,
                    cnpj: rawCnpj,
                    contato: formattedContato || null,
                    emailCliente: emailCliente || null,
                    horasContratadas,
                    valor: valorMatch ? parseFloat(valorMatch[1].replace('.', '').replace(',', '.')) : 170.0,
                    dataPrevista: dataPrevistaMatch ? dataPrevistaMatch[1].trim() : null,
                    prefObs: prefObs,
                    profissionalResponsavel,
                    plataformaUtilizada,
                    natureza,
                    empresaCredenciada,
                    modalidade: isPresencial ? 'Presencial' : 'À Distância (Online)',
                    nfDiscriminacao
                  };
                  console.log(`[POLL] 📄 PDF analisado com sucesso! Cliente: ${parsedPdfData.clienteNome}, RAE: ${parsedPdfData.rae}, ER: ${parsedPdfData.erCredenciado} (${parsedPdfData.emailErCredenciado})`);
                }
              } catch (pdfErr) {
                console.error('[POLL] Erro ao extrair texto do PDF:', pdfErr);
                lastPdfError = {
                  message: pdfErr?.message || String(pdfErr),
                  stack: pdfErr?.stack || null,
                  name: pdfErr?.name || null
                };
              }
            }
          }

          // Confirmação de Demanda Real (OS com anexo ou Proposta formal)
          const isRealDemanda = isTargetReprocess || isOS || isProposta || parsedPdfData?.clienteNome;

          if (isRealDemanda) {
            // Extrai dados para criação do projeto
            const raeMatch = assunto.match(/(?:nº|n°|rae|os|co)[\s:]*([0-9\/\-]+)/i);
            const codigoRae = parsedPdfData?.rae || (raeMatch ? raeMatch[1] : null);

            let clienteNome = parsedPdfData?.clienteNome || null;
            if (!clienteNome && isProposta) {
              const propostaMatch = assunto.match(/Código\s*-\s*([A-Z0-9]+)/i);
              clienteNome = propostaMatch ? `Proposta SGF ${propostaMatch[1]}` : null;
            }

            // Atualiza ou insere na tabela de emails_processados
            if (existente?.id) {
              await supabase
                .from('emails_processados')
                .update({
                  status: 'processado',
                  anexo_nome: anexoNome,
                  erro_detalhe: null
                })
                .eq('id', existente.id);
            } else {
              await supabase
                .from('emails_processados')
                .insert([{
                  message_id: messageId,
                  remetente,
                  assunto,
                  anexo_nome: anexoNome,
                  status: 'processado',
                  criado_em: dataEmail
                }]);
            }

            // Cria ou atualiza o card em projetos no Kanban SOMENTE se houver cliente real do PDF ou proposta válida
            if (parsedPdfData?.clienteNome || (isProposta && (codigoRae || parsedPdfData?.sgf))) {
              let existingProj = null;
              if (codigoRae || parsedPdfData?.osNumber) {
                const searchFilters = [];
                if (codigoRae) searchFilters.push(`codigo_rae.eq.${codigoRae}`);
                if (parsedPdfData?.osNumber) {
                  searchFilters.push(`codigo_rae.eq.${parsedPdfData.osNumber}`);
                  searchFilters.push(`observacoes.ilike.%${parsedPdfData.osNumber}%`);
                }
                const { data: p } = await supabase
                  .from('projetos')
                  .select('id')
                  .or(searchFilters.join(','))
                  .limit(1)
                  .maybeSingle();
                existingProj = p;
              }

              const projetoPayload = {
                nome_cliente: clienteNome || `Demanda via E-mail (${assunto.slice(0, 30)}...)`,
                razao_social: parsedPdfData?.empresa || clienteNome || `Demanda via E-mail`,
                nome_fantasia: clienteNome || null,
                cnpj: parsedPdfData?.cnpj || null,
                codigo_rae: codigoRae,
                telefone: parsedPdfData?.contato || null,
                celular: parsedPdfData?.contato || null,
                email_cliente: parsedPdfData?.emailCliente || null,
                municipio: 'São Paulo',
                estado: 'SP',
                status: 'novo_contrato',
                solucao_contratada: parsedPdfData?.produto || 'Consultoria Sebrae Capturada por E-mail',
                programa: parsedPdfData?.sgf ? `${parsedPdfData.sgf} SGF 2026` : 'Consultoria Sebrae',
                modalidade: parsedPdfData?.modalidade || 'À Distância (Online)',
                horas_contratadas: parsedPdfData?.horasContratadas || 1,
                horas_realizadas: parsedPdfData?.horasContratadas || 1,
                valor_consultoria: parsedPdfData?.valor || 170.00,
                data_atendimento: parsedPdfData?.dataPrevista || null,
                data_prevista_inicio: parsedPdfData?.dataPrevista || null,
                data_prevista_fim: parsedPdfData?.dataPrevista || null,
                edital: parsedPdfData?.edital || '004/2026',
                processo_no: parsedPdfData?.processoNo || '1777/2025',
                contrato_no: parsedPdfData?.contratoNo || parsedPdfData?.sgf || null,
                empresa_credenciada: parsedPdfData?.empresaCredenciada || 'AMP DO BRASIL SOLUCOES ADMINISTRATIVAS E TECNOLOGICAS LTDA',
                profissional_responsavel: parsedPdfData?.profissionalResponsavel || 'MARCO ANTONIO PAVANI',
                natureza: parsedPdfData?.natureza || 'CONSULTORIA',
                plataforma_utilizada: parsedPdfData?.plataformaUtilizada || 'Plataforma Microsoft Teams',
                observacoes: `OS nº ${parsedPdfData?.osNumber || ''} | Unidade: ${parsedPdfData?.unidadeDemandante || 'SP'} -> E-mail Credenciado: ${parsedPdfData?.emailErCredenciado || 'N/A'} (${parsedPdfData?.gestorErCredenciado || ''}) | ${parsedPdfData?.prefObs || ''} | Gestor OS: ${parsedPdfData?.gestor || 'Sebrae'} (${parsedPdfData?.emailGestor || ''})`,
                objetivo_atendimento: parsedPdfData?.prefObs ? `Consultoria Sebrae - ${parsedPdfData.prefObs}` : null,
                dados_extra: {
                  os_number: parsedPdfData?.osNumber || null,
                  sgf: parsedPdfData?.sgf || null,
                  codigo_sgf: parsedPdfData?.sgf || null,
                  unidade_demandante: parsedPdfData?.unidadeDemandante || null,
                  er_credenciado: parsedPdfData?.erCredenciado || null,
                  gestor_er_credenciado: parsedPdfData?.gestorErCredenciado || null,
                  email_er_credenciado: parsedPdfData?.emailErCredenciado || null,
                  gestor: parsedPdfData?.gestor || null,
                  email_gestor: parsedPdfData?.emailGestor || null,
                  nf_discriminacao: parsedPdfData?.nfDiscriminacao || null,
                  anexo_pdf: anexoNome
                },
                atualizado_em: new Date().toISOString()
              };

              if (existingProj?.id) {
                await supabase.from('projetos').update(projetoPayload).eq('id', existingProj.id);
                console.log(`[POLL] Card atualizado no Kanban: ID ${existingProj.id} (RAE: ${codigoRae})`);
              } else {
                const projetoId = `email-${Date.now()}-${uid}`;
                await supabase.from('projetos').insert([{
                  id: projetoId,
                  ...projetoPayload,
                  criado_em: dataEmail
                }]);
                console.log(`[POLL] Novo card criado no Kanban: ID ${projetoId} (RAE: ${codigoRae})`);
              }

              // Envia notificação imediata via Telegram ao capturar a demanda
              const telegramToken = extraConfig?.telegramBotToken;
              const telegramChat = extraConfig?.telegramChatId;
              if (telegramToken && telegramChat) {
                try {
                  const tgText = `🔔 <b>Nova Ordem de Serviço Sebrae Recebida!</b>\n\n` +
                    `📋 <b>OS:</b> ${parsedPdfData?.osNumber || codigoRae || 'N/A'}\n` +
                    `👤 <b>Cliente:</b> ${clienteNome || 'Cliente Sebrae'}\n` +
                    `🏢 <b>Empresa:</b> ${parsedPdfData?.empresa || 'MEI / Empresa'}\n` +
                    `🔢 <b>RAE:</b> ${codigoRae || 'N/A'}\n` +
                    `📞 <b>Contato:</b> ${parsedPdfData?.contato || 'N/A'}\n` +
                    `💼 <b>Solução:</b> ${parsedPdfData?.produto || 'Consultoria Sebrae'}\n` +
                    `💰 <b>Valor:</b> R$ ${(parsedPdfData?.valor || 170).toFixed(2)}\n\n` +
                    `<i>Acesse o Kanban para visualizar a demanda!</i>`;

                  await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      chat_id: telegramChat,
                      text: tgText,
                      parse_mode: 'HTML'
                    })
                  });
                  console.log('[POLL] 📲 Notificação Telegram enviada com sucesso no recebimento do e-mail!');
                } catch (tErr) {
                  console.error('[POLL] Erro ao enviar notificação Telegram:', tErr.message);
                }
              }
            }

            novosProcessados.push({
              uid,
              remetente,
              assunto,
              clienteNome,
              anexoNome,
              status: 'capturado'
            });
            console.log(`[POLL] ✅ Novo e-mail capturado com sucesso: "${assunto}"`);
          }
        } catch (msgErr) {
          console.error(`[POLL] Erro ao processar mensagem UID ${uid}:`, msgErr);
        }
      }
    } finally {
      lock.release();
      await client.logout();
    }

    return res.status(200).json({
      ok: true,
      novosContados: novosProcessados.length,
      emailsCapturados: novosProcessados,
      lastPdfError,
      message: novosProcessados.length > 0 
        ? `Sucesso! ${novosProcessados.length} nova(s) demanda(s) de e-mail capturada(s) e enviada(s) para o sistema.`
        : 'Caixa verificada com sucesso! Nenhuma nova demanda pendente no momento.'
    });

  } catch (err) {
    console.error('[POLL] Erro geral ao sincronizar:', err);
    return res.status(500).json({
      ok: false,
      error: `Erro ao conectar e sincronizar e-mails: ${err.message || String(err)}`
    });
  }
}
