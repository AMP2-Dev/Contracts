import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nblgkcnsjziezqdiozxo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ibGdrY25zanppZXpxZGlvenhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3NjgzNTgsImV4cCI6MjEwNTM0NDM1OH0.pqa4cMC1wSv-5yQltbTOkiGR33yjKBMwXugqWRxFzOQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Configura limite de payload maior para suportar 2 PDFs em Base64 (Relatório Assinado + Nota Fiscal)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb',
    },
  },
};

function stripDataUrlPrefix(b64OrDataUrl = '') {
  const str = String(b64OrDataUrl || '').trim();
  const commaIdx = str.indexOf(',');
  if (str.startsWith('data:') && commaIdx !== -1) {
    return str.slice(commaIdx + 1);
  }
  return str;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Método não permitido. Use POST.' });
  }

  try {
    const {
      to,
      cc,
      subject,
      text,
      html,
      attachments = [],
      smtpOverride = {},
    } = req.body || {};

    if (!to || !subject) {
      return res.status(400).json({
        ok: false,
        error: 'Destinatário (to) e Assunto (subject) são obrigatórios.',
      });
    }

    // Carrega configuração salva no Supabase (__system_company_config__)
    let dbConfig = {};
    try {
      const { data: configRow } = await supabase
        .from('projetos')
        .select('dados_extra')
        .eq('id', '__system_company_config__')
        .maybeSingle();
      if (configRow?.dados_extra) {
        dbConfig = configRow.dados_extra.company_config || configRow.dados_extra;
      }
    } catch (errCfg) {
      console.warn('[SEND-SOMA] Aviso ao ler config do Supabase:', errCfg?.message);
    }

    const host = smtpOverride.host || dbConfig.smtpHost || 'smtp.uni5.net';
    const port = Number(smtpOverride.port || dbConfig.smtpPort || 587);
    const user = smtpOverride.user || dbConfig.smtpUser || dbConfig.imapUser || 'consultoria@amp.adm.br';
    // Prioriza a senha ativa validada no servidor Uni5 (p5p3ALM1!200271)
    const candidatePasswords = [
      smtpOverride.pass,
      dbConfig.imapPass,
      dbConfig.smtpPass,
      'p5p3ALM1!200271',
      'p5p3ALM1!2002',
    ].filter(Boolean);

    const senderName =
      smtpOverride.senderName ||
      dbConfig.smtpSenderName ||
      'AMP DO BRASIL SOLUCOES ADMINISTRATIVAS E TECNOLOGICAS LTDA';

    // Monta os anexos para o Nodemailer
    const mailAttachments = (attachments || [])
      .filter((att) => att && att.content && att.filename)
      .map((att) => ({
        filename: att.filename,
        content: Buffer.from(stripDataUrlPrefix(att.content), 'base64'),
        contentType: att.contentType || 'application/pdf',
      }));

    // Garante que consultoria@amp.adm.br esteja sempre em cópia (CC)
    const ccList = String(cc || 'consultoria@amp.adm.br')
      .split(/[;,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!ccList.some((email) => email.toLowerCase() === 'consultoria@amp.adm.br')) {
      ccList.unshift('consultoria@amp.adm.br');
    }
    const finalCc = ccList.join(', ');

    let lastError = null;
    for (const pass of [...new Set(candidatePasswords)]) {
      try {
        const transporter = nodemailer.createTransport({
          host: host === 'imap.uni5.net' ? 'smtp.uni5.net' : host,
          port,
          secure: port === 465,
          auth: { user, pass },
          tls: { rejectUnauthorized: false },
        });

        const info = await transporter.sendMail({
          from: `"${senderName}" <${user}>`,
          replyTo: 'consultoria@amp.adm.br',
          to: String(to).trim(),
          cc: finalCc,
          subject: String(subject).trim(),
          text: text || '',
          html: html || (text ? text.replace(/\n/g, '<br/>') : ''),
          attachments: mailAttachments,
        });

        return res.status(200).json({
          ok: true,
          messageId: info.messageId,
          accepted: info.accepted,
          to: String(to).trim(),
          cc: finalCc,
          attachmentsCount: mailAttachments.length,
        });
      } catch (err) {
        lastError = err;
        console.warn(`[SEND-SOMA] Tentativa SMTP falhou (${user}):`, err?.message);
      }
    }

    throw lastError || new Error('Não foi possível autenticar no servidor SMTP.');
  } catch (error) {
    console.error('[SEND-SOMA] Erro ao enviar pacote SOMA:', error);
    return res.status(500).json({
      ok: false,
      error: error?.message || 'Erro interno ao disparar e-mail pelo SMTP da AMP.',
    });
  }
}
