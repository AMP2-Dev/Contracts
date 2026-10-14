import type { Project, AnexoAdicional } from '../types/database';
import {
  DECLARACAO_SIMPLES_NACIONAL_SEBRAE_SP_NOME,
  DECLARACAO_SIMPLES_NACIONAL_SEBRAE_SP_B64,
} from '../assets/declaracaoSebraeSp';

export interface SomaAttachment {
  filename: string;
  content: string; // Base64 or Data URL
  contentType?: string;
}

export interface SendSomaPackageOptions {
  to: string;
  cc?: string;
  erName?: string;
  erGestor?: string;
  customSubject?: string;
  customBodyText?: string;
}

export interface SendSomaPackageResult {
  ok: boolean;
  messageId?: string;
  to?: string;
  cc?: string;
  attachmentsCount?: number;
  error?: string;
}

function formatDataBr(dateStr?: string | null): string {
  if (!dateStr) return new Date().toLocaleDateString('pt-BR');
  const clean = String(dateStr).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) return clean;
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    const [y, m, d] = clean.substring(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('pt-BR');
  }
  return clean;
}

export function stripDataUrlPrefix(b64OrDataUrl: string = ''): string {
  const str = String(b64OrDataUrl || '').trim();
  const commaIdx = str.indexOf(',');
  if (str.startsWith('data:') && commaIdx !== -1) {
    return str.slice(commaIdx + 1);
  }
  return str;
}

export function ensureConsultoriaCc(ccInput?: string): string {
  const list = String(ccInput || '')
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!list.some((item) => item.toLowerCase() === 'consultoria@amp.adm.br')) {
    list.unshift('consultoria@amp.adm.br');
  }
  return list.join(', ');
}

export function buildSomaPackageEmailContent(
  project: Partial<Project>,
  options: { erName?: string; erGestor?: string } = {}
) {
  const extra = project.dados_extra || {};
  const osNum = extra.os_number || project.contrato_no || project.codigo_rae || '';
  const sgfNum = extra.sgf || extra.codigo_sgf || project.contrato_no || '';
  const raeNum = String(project.codigo_rae || '').replace(/^RAE\s*/i, '').trim();
  const clientName = project.nome_cliente || project.razao_social || 'Cliente';
  const clientDoc = project.cnpj || project.cpf || '';
  const erLabel = options.erName || extra.er_credenciado || extra.unidade_demandante || 'SEBRAE-SP';
  const gestorLabel = options.erGestor || extra.gestor_er_credenciado || extra.gestor_os || '';
  const produto = project.solucao_contratada || 'Consultoria em Gestão Financeira';
  const qtdHoras = project.horas_realizadas || project.horas_contratadas || 1;
  const dataExec = formatDataBr(project.data_atendimento || project.data_prevista_inicio);
  const valorFormatado = Number(project.valor_consultoria || 170).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const profissional = project.profissional_responsavel || 'MARCO ANTONIO PAVANI';
  const empresaCredenciada =
    project.empresa_credenciada || 'AMP DO BRASIL SOLUCOES ADMINISTRATIVAS E TECNOLOGICAS LTDA';

  const includesDeclaracaoSimples = extra.incluir_declaracao_simples_sp !== false;
  const customAttachments: AnexoAdicional[] = Array.isArray(extra.anexos_adicionais) ? extra.anexos_adicionais : [];

  const docListPlain: string[] = [
    '1. Relatório de Prestação de Serviço SOMA SEBRAE devidamente assinado + Evidência de Atendimento',
    '2. Nota Fiscal de Serviços Eletrônica (NFS-e Padrão Nacional)',
  ];

  if (includesDeclaracaoSimples) {
    docListPlain.push('3. Declaração de Não Retenção do Simples Nacional (SEBRAE-SP - Lei nº 9.430/1996 e LC nº 123/2006)');
  }

  customAttachments.forEach((anx, i) => {
    docListPlain.push(`${docListPlain.length + 1}. ${anx.nome || `Anexo Adicional ${i + 1}`}`);
  });

  const docListHtml = docListPlain
    .map((item) => `<li style="margin-bottom:4px;"><strong>${item.replace(/^\d+\.\s*/, '')}</strong></li>`)
    .join('\n');

  const subject = `Prestação de Contas SOMA SEBRAE-SP - OS ${osNum} - RAE ${raeNum} - ${clientName}`;

  const text = [
    `Prezados (${erLabel}${gestorLabel ? ` - A/C ${gestorLabel}` : ''}),`,
    ``,
    `Encaminhamos em anexo os documentos oficiais referentes à prestação de serviços concluída no âmbito do Programa SOMA SEBRAE:`,
    ``,
    `- Unidade Demandante: ${erLabel}`,
    `- Nº da Ordem de Serviço (OS): ${osNum}`,
    `- Código SGF: ${sgfNum}`,
    `- Código RAE: ${raeNum}`,
    `- Cliente Atendido: ${clientName}${clientDoc ? ` (${clientDoc})` : ''}`,
    `- Produto / Solução: ${produto}`,
    `- Carga Horária Executada: ${qtdHoras} hora(s)`,
    `- Data de Execução: ${dataExec}`,
    `- Valor Total da OS: R$ ${valorFormatado}`,
    ``,
    `Documentos em anexo (PDF):`,
    ...docListPlain,
    ``,
    `Permanecemos à inteira disposição para quaisquer esclarecimentos.`,
    ``,
    `Atenciosamente,`,
    `${profissional}`,
    `${empresaCredenciada}`,
    `CNPJ: 10.682.233/0001-75`,
    `E-mail: consultoria@amp.adm.br`,
  ].join('\n');

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#1e293b;">
  <div style="max-width:660px;margin:20px auto;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(15,23,42,0.06);">
    <div style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 60%,#4338ca 100%);padding:20px 24px;color:#ffffff;">
      <div style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#a5b4fc;margin-bottom:4px;">
        Programa SOMA SEBRAE-SP • Prestação de Contas
      </div>
      <div style="font-size:18px;font-weight:bold;line-height:1.3;">
        Ordem de Serviço Nº ${osNum} • RAE ${raeNum}
      </div>
      <div style="font-size:12px;color:#e0e7ff;margin-top:4px;">
        Unidade Demandante: <strong>${erLabel}</strong>${gestorLabel ? ` • A/C: <strong>${gestorLabel}</strong>` : ''}
      </div>
    </div>

    <div style="padding:24px;font-size:13.5px;line-height:1.6;color:#334155;">
      <p style="margin-top:0;">
        Prezados <strong>${erLabel}</strong>${gestorLabel ? ` (A/C <strong>${gestorLabel}</strong>)` : ''},
      </p>
      <p>
        Encaminhamos em anexo o <strong>Pacote Oficial de Prestação de Contas</strong> referente ao atendimento realizado no âmbito do <strong>Programa SOMA SEBRAE</strong> (Edital ${project.edital || '004/2026'} • Processo ${project.processo_no || '1777/2025'}):
      </p>

      <table style="width:100%;border-collapse:collapse;margin:18px 0;font-size:12.5px;">
        <tr>
          <td style="padding:8px 12px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:bold;width:38%;color:#475569;">Unidade Demandante (ER)</td>
          <td style="padding:8px 12px;border:1px solid #cbd5e1;font-weight:bold;color:#0f172a;">${erLabel}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:bold;color:#475569;">Nº da Ordem de Serviço (OS)</td>
          <td style="padding:8px 12px;border:1px solid #cbd5e1;font-weight:bold;color:#1d4ed8;">${osNum}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:bold;color:#475569;">Código SGF / RAE</td>
          <td style="padding:8px 12px;border:1px solid #cbd5e1;color:#0f172a;">SGF: <strong>${sgfNum}</strong> • RAE: <strong>${raeNum}</strong></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:bold;color:#475569;">Cliente Atendido</td>
          <td style="padding:8px 12px;border:1px solid #cbd5e1;font-weight:bold;color:#0f172a;">${clientName}${clientDoc ? ` <span style="font-weight:normal;color:#64748b;">(${clientDoc})</span>` : ''}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:bold;color:#475569;">Produto / Solução</td>
          <td style="padding:8px 12px;border:1px solid #cbd5e1;color:#0f172a;">${produto}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:bold;color:#475569;">Data de Execução & Carga Horária</td>
          <td style="padding:8px 12px;border:1px solid #cbd5e1;color:#0f172a;"><strong>${dataExec}</strong> • <strong>${qtdHoras} hora(s)</strong></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:bold;color:#475569;">Valor Total da OS</td>
          <td style="padding:8px 12px;border:1px solid #cbd5e1;font-weight:bold;color:#047857;font-size:13.5px;">R$ ${valorFormatado}</td>
        </tr>
      </table>

      <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin:16px 0;">
        <div style="font-weight:bold;color:#166534;font-size:12.5px;margin-bottom:6px;">
          📎 Documentos Oficiais Anexados em PDF (${docListPlain.length} itens):
        </div>
        <ol style="margin:0;padding-left:18px;color:#15803d;font-size:12.5px;">
          ${docListHtml}
        </ol>
      </div>

      <p style="margin-bottom:18px;">
        Permanecemos à inteira disposição para quaisquer esclarecimentos adicionais.
      </p>

      <div style="border-top:1px solid #e2e8f0;padding-top:14px;font-size:12px;color:#475569;line-height:1.45;">
        <strong style="color:#0f172a;font-size:13px;">${profissional}</strong><br/>
        <strong>${empresaCredenciada}</strong><br/>
        CNPJ: 10.682.233/0001-75 • E-mail: <a href="mailto:consultoria@amp.adm.br" style="color:#4338ca;text-decoration:none;">consultoria@amp.adm.br</a>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, text, html };
}

const SUPABASE_EDGE_URL = 'https://eornunjxcmtyrdrihiqk.supabase.co';
const SUPABASE_EDGE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvcm51bmp4Y210eXJkcmloaXFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4Njg5NDYsImV4cCI6MjA5NzQ0NDk0Nn0.fGBiJI_Mx0qFd0lLhvC_FKDkH4To56FMFTvkhwKviV0';

export async function sendSomaPackageViaSmtp(
  project: Partial<Project>,
  options: SendSomaPackageOptions
): Promise<SendSomaPackageResult> {
  const extra = project.dados_extra || {};
  const osNum = String(extra.os_number || project.contrato_no || project.codigo_rae || 'SOMA').replace(/[^\w.-]+/g, '_');
  const raeNum = String(project.codigo_rae || '').replace(/[^\w.-]+/g, '_');

  const { subject: defaultSubject, text: defaultText, html } = buildSomaPackageEmailContent(project, {
    erName: options.erName,
    erGestor: options.erGestor,
  });

  const attachments: SomaAttachment[] = [];

  // Anexo 1: Documento anexado em termo_assinado_b64
  if (extra.termo_assinado_b64) {
    attachments.push({
      filename: extra.termo_assinado_nome || `Relatorio_Assinado_OS_${osNum}_RAE_${raeNum}.pdf`,
      content: stripDataUrlPrefix(extra.termo_assinado_b64),
      contentType: 'application/pdf',
    });
  }

  // Anexo 2: Documento anexado em nota_fiscal_b64
  if (extra.nota_fiscal_b64) {
    attachments.push({
      filename: extra.nota_fiscal_nome || `Nota_Fiscal_OS_${osNum}_RAE_${raeNum}.pdf`,
      content: stripDataUrlPrefix(extra.nota_fiscal_b64),
      contentType: 'application/pdf',
    });
  }

  // Anexo 3: Declaração de Não Retenção Simples Nacional (SEBRAE-SP)
  if (extra.incluir_declaracao_simples_sp !== false) {
    attachments.push({
      filename: DECLARACAO_SIMPLES_NACIONAL_SEBRAE_SP_NOME,
      content: stripDataUrlPrefix(DECLARACAO_SIMPLES_NACIONAL_SEBRAE_SP_B64),
      contentType: 'application/pdf',
    });
  }

  // Anexos Adicionais customizados pelo usuário (ex: Relatório de Reembolso, Comprovantes de Despesas, etc.)
  const customAttachments: AnexoAdicional[] = Array.isArray(extra.anexos_adicionais) ? extra.anexos_adicionais : [];
  customAttachments.forEach((anx, idx) => {
    if (anx && anx.b64) {
      attachments.push({
        filename: anx.nome || `Anexo_Adicional_${idx + 1}.pdf`,
        content: stripDataUrlPrefix(anx.b64),
        contentType: anx.tipo || 'application/pdf',
      });
    }
  });

  const finalCc = ensureConsultoriaCc(options.cc);

  try {
    const response = await fetch(`${SUPABASE_EDGE_URL}/functions/v1/enviar-email-smtp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_EDGE_KEY,
        Authorization: `Bearer ${SUPABASE_EDGE_KEY}`,
      },
      body: JSON.stringify({
        smtp: {
          nomeRemetente: 'AMP DO BRASIL | MARCO ANTONIO PAVANI',
          remetenteEmail: 'atendimento@amp.adm.br',
        },
        mensagem: {
          destinatario: options.to.trim(),
          copia: finalCc,
          assunto: options.customSubject || defaultSubject,
          corpo: options.customBodyText || defaultText,
          corpoHtml: html,
          anexos: attachments.map((att) => ({
            filename: att.filename,
            content: att.content,
          })),
        },
      }),
    });

    const data = await response.json().catch(() => null);

    if (response.ok && data?.sucesso) {
      return {
        ok: true,
        messageId: data.messageId,
        to: data.destinatario || options.to.trim(),
        cc: data.copia || finalCc,
        attachmentsCount: attachments.length,
      };
    }

    return {
      ok: false,
      error: data?.error || 'Erro ao processar o disparo do e-mail no servidor em nuvem.',
    };
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message || 'Erro de conexão ao disparar e-mail.',
    };
  }
}
