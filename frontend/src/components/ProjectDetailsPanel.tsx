import React, { useState, useEffect } from 'react';
import { X, Save, FileText, Building2, User, Clock, CheckCircle2, MessageSquare, Mail, Camera, FileCheck, Send, Printer, Trash2, ExternalLink, FileSignature, Check, Calendar, Clipboard, AlertTriangle, RotateCcw, ShieldCheck, Shield } from 'lucide-react';
import type { Project, CompanyConfig } from '../types/database';
import { supabase } from '../lib/supabase';
import { cn, maskPhone } from '../lib/utils';
import { REPORT_ARROW_B64, REPORT_BANNER_B64, REPORT_LOGO_B64 } from '../assets/reportAssets';
import { createAutentiqueDocument } from '../lib/autentique';
import { SomaAiAssistant } from './SomaAiAssistant';
import { WHATSAPP_TEMPLATES, buildWhatsAppMessage, openWhatsApp } from '../lib/whatsapp';
import { getSavedCertificateA1, signDocumentHash } from '../lib/certificateA1';
import {
  SEBRAE_SP_ER_CREDENCIADOS,
  findSebraeSpErCredenciado,
  buildSebraeSpNfDiscriminacao,
  isSebraeSpProject,
} from '../lib/sebraeSpUtils';

interface ProjectDetailsPanelProps {
  project: Project | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedProject: Project) => void;
  onDelete?: (projectId: string) => void;
}

export function ProjectDetailsPanel({ project, isOpen, onClose, onUpdate, onDelete }: ProjectDetailsPanelProps) {
  const [formData, setFormData] = useState<Partial<Project>>(() => {
    if (project) {
      return {
        ...project,
      };
    }
    return {};
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSendingAutentique, setIsSendingAutentique] = useState(false);
  const [govCopied, setGovCopied] = useState(false);
  const [nfTextCopied, setNfTextCopied] = useState(false);
  const [erEmailCopied, setErEmailCopied] = useState(false);

  useEffect(() => {
    if (project) {
      setFormData({
        ...project
      });
    }
  }, [project]);

  // Função para colar imagem diretamente da área de transferência quando o usuário clica no botão "Colar Print"
  const handleClipboardPasteButton = async () => {
    try {
      if (!navigator.clipboard?.read) {
        alert('Seu navegador não suporta leitura direta. Clique na caixa de print do WhatsApp e pressione Ctrl + V.');
        return;
      }
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find(type => type.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const reader = new FileReader();
          reader.onloadend = () => {
            setFormData((prev) => ({
              ...prev,
              dados_extra: {
                ...(prev.dados_extra || {}),
                foto_cliente: reader.result as string,
              }
            }));
          };
          reader.readAsDataURL(blob);
          return;
        }
      }
      alert('Nenhuma imagem encontrada na área de transferência. Tire um print da tela (Win + Shift + S) e tente novamente.');
    } catch (err) {
      console.warn('Clipboard read error:', err);
      alert('Para colar o print da tela, clique na caixa tracejada do comprovante e pressione Ctrl + V.');
    }
  };

  // Handler de paste local (acionado APENAS quando o usuário foca na caixa de comprovante do WhatsApp)
  const handlePhotoBoxPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file' && items[i].type.startsWith('image/')) {
        e.preventDefault();
        e.stopPropagation();
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onloadend = () => {
            setFormData((prev) => ({
              ...prev,
              dados_extra: {
                ...(prev.dados_extra || {}),
                foto_cliente: reader.result as string,
              }
            }));
          };
          reader.readAsDataURL(blob);
        }
        return;
      }
    }
  };

  if (!project) return null;

  const handleChange = (field: keyof Project, value: any) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      // Se alterar Razão Social, atualiza também nome_cliente para manter cabeçalho e card sincronizados
      if (field === 'razao_social' && value) {
        updated.nome_cliente = value;
      }
      if (field === 'nome_cliente' && value) {
        updated.razao_social = value;
      }
      return updated;
    });
  };

  const handleSave = () => {
    if (!project.id) return;
    setIsSaving(true);
    setSaveSuccess(true);

    const parseDec = (v: any) => {
      if (v === '' || v === null || v === undefined) return null;
      const n = parseFloat(String(v).replace(',', '.'));
      return isNaN(n) ? null : n;
    };

    const updatedData: Project = {
      ...project,
      ...formData,
      horas_contratadas: parseDec(formData.horas_contratadas),
      horas_realizadas: parseDec(formData.horas_realizadas) || 0,
      valor_consultoria: parseDec(formData.valor_consultoria),
      nome_cliente: formData.nome_cliente || formData.razao_social || project.nome_cliente,
      razao_social: formData.razao_social || formData.nome_cliente || project.razao_social,
      atualizado_em: new Date().toISOString(),
    } as Project;

    // 1. Atualização Otimista Imediata (0ms de espera no Kanban!)
    onUpdate(updatedData);

    // Fecha o painel suavemente
    setTimeout(() => {
      setSaveSuccess(false);
      setIsSaving(false);
      onClose();
    }, 250);

    // 2. Gravação assíncrona no Supabase em background
    supabase
      .from('projetos')
      .upsert(updatedData, { onConflict: 'id' })
      .then(({ error }) => {
        if (error) console.warn('Aviso ao sincronizar projeto no Supabase:', error.message);
      })
      .catch((err) => {
        console.warn('Erro ao salvar projeto no Supabase:', err);
      });
  };

  // WhatsApp Pre-formatted Link
  const getWhatsAppLink = () => {
    try {
      const rawPhone = String(formData.celular || formData.telefone || '');
      const cleanPhone = rawPhone.replace(/\D/g, '');
      const clientName = formData.nome_cliente || formData.razao_social || 'Cliente';
      const programa = formData.programa || 'Consultoria Sebrae';

      let template = 'Olá {nome_cliente}, tudo bem? Espero lhe encontrar bem!\n\nSou Marco Antonio, consultor credenciado ao SEBRAE e estou entrando em contato para comunicar que estamos a um passo de marcar nossa consultoria ({programa}).\n\nSegue o link para que possa escolher uma data e horário para este nosso encontro:\n👉 {link_calendario}\n\nÉ muito importante que agende uma data para darmos início ao nosso trabalho, espero e desejo muito que possa contribuir com a sua empresa.';
      let calendar = 'https://calendar.app.google/skRSHv2QBUjY9ae16';

      const saved = localStorage.getItem('amp_company_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.whatsappTemplate) template = parsed.whatsappTemplate;
        if (parsed.calendarLink) calendar = parsed.calendarLink;
      }

      const text = template
        .replace(/{nome_cliente}/g, clientName)
        .replace(/{programa}/g, programa)
        .replace(/{link_calendario}/g, calendar);

      const targetPhone = cleanPhone.length <= 11 && !cleanPhone.startsWith('55') ? `55${cleanPhone}` : cleanPhone;
      return `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(text)}`;
    } catch (e) {
      return '#';
    }
  };

  // Email Mailto Link
  const getEmailLink = () => {
    try {
      const email = String(formData.email_cliente || '');
      const clientName = formData.nome_cliente || formData.razao_social || 'Cliente';
      const rae = formData.codigo_rae || '';
      const programa = formData.programa || 'Sebrae';
      const subject = `Agendamento de Consultoria Sebrae - ${programa} (${rae})`;
      const body = `Olá ${clientName},\n\nRecebemos a sua demanda de consultoria pelo Sebrae (${programa} - RAE: ${rae}).\n\nEstou entrando em contato para combinarmos o agendamento da nossa primeira reunião de atendimento (virtual ou presencial).\n\nPor favor, responda a esta mensagem para definirmos a melhor data e horário.\n\nAtenciosamente,\nConsultoria Credenciada Sebrae`;

      return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    } catch (e) {
      return '#';
    }
  };

  // Client Photo Upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({
          ...prev,
          dados_extra: {
            ...(prev.dados_extra || {}),
            foto_cliente: reader.result as string,
          }
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Signed Term Upload
  const handleTermUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData((prev) => ({
        ...prev,
        dados_extra: {
          ...(prev.dados_extra || {}),
          termo_assinado_nome: file.name,
          termo_assinado_data: new Date().toISOString(),
        }
      }));
    }
  };

  // NF Upload
  const handleNfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData((prev) => ({
        ...prev,
        dados_extra: {
          ...(prev.dados_extra || {}),
          nota_fiscal_nome: file.name,
          nota_fiscal_data: new Date().toISOString(),
        }
      }));
    }
  };

  // Helper date formatters for official report
  const formatDataExtenso = (dateStr?: string | null): string => {
    if (!dateStr) return '17 de agosto de 2026';
    const clean = dateStr.trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
      const [d, m, y] = clean.split('/');
      const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
      return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
      const [y, m, d] = clean.substring(0, 10).split('-');
      const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
      return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    const parsed = new Date(clean);
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    return clean;
  };

  const formatDataSimples = (dateStr?: string | null): string => {
    if (!dateStr) return '17/08/2026';
    const clean = dateStr.trim();
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
  };

  // Print / View Official SOMA SEBRAE Report with Optional A1 Signature
  const handlePrintReport = (withA1: boolean = true) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const savedCert = getSavedCertificateA1();
    const isA1Active = Boolean(withA1 && savedCert && savedCert.ativo && savedCert.pfxBase64 && savedCert.password);

    const edital = formData.edital || '004/2026';
    const processoNo = formData.processo_no || '1777/2025';
    const contratoNo = formData.contrato_no || '070873/2026';
    const empresaCredenciada = formData.empresa_credenciada || 'AMP DO BRASIL SOLUCOES ADMINISTRATIVAS E TECNOLOGICAS LTDA';
    const profissional = formData.profissional_responsavel || 'MARCO ANTONIO PAVANI';
    const natureza = formData.natureza || 'CONSULTORIA';
    const objeto = formData.solucao_contratada || 'Faça a gestão financeira e tenha controle do seu dinheiro';
    const localPrestacao = formData.municipio 
      ? (formData.municipio.includes('Remoto') ? formData.municipio : `${formData.municipio} (Remoto)`) 
      : 'Cotia (Remoto)';
    
    // Data informada no atendimento (NÃO a data de hoje que gera o relatório)
    const dataAtendimentoInformada = formData.data_atendimento || formData.data_prevista_inicio || '2026-08-17';
    const dataExecucao = formatDataSimples(dataAtendimentoInformada);
    const dataExtenso = formatDataExtenso(dataAtendimentoInformada);

    const qtdHoras = `${formData.horas_realizadas || formData.horas_contratadas || 1} horas`;
    const plataforma = formData.plataforma_utilizada || 'Plataforma Microsoft Teams';
    const nomeCliente = formData.nome_cliente || formData.razao_social || '66.212.730 ERICKA CLEMENTE DOS SANTOS NUNES';
    const cnpjCliente = formData.cnpj || '66.212.730/0001-64';
    const rawRae = String(formData.codigo_rae || '39090075');
    const rae = rawRae.replace(/\D/g, '') || rawRae;
    const cidadeRodape = formData.municipio ? String(formData.municipio).replace(/\s*\(.*?\)/g, '').trim() : 'Cotia';

    let a1SignatureData: any = null;
    if (isA1Active && savedCert) {
      try {
        const payloadToSign = `${edital}|${processoNo}|${contratoNo}|${empresaCredenciada}|${profissional}|${objeto}|${dataExecucao}|${nomeCliente}|${cnpjCliente}|${rae}`;
        a1SignatureData = signDocumentHash(savedCert.pfxBase64, savedCert.password || '', payloadToSign);
      } catch (err) {
        console.warn('Falha ao calcular assinatura criptográfica com Certificado A1:', err);
      }
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>SOMA SEBRAE - Relatório de Prestação de Serviço - ${rae}</title>
          <style>
            @page { size: A4; margin: 10mm 15mm 12mm 15mm; }
            body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #000; line-height: 1.35; padding: 10px; background: #fff; }
            .header-top { font-size: 8pt; color: #4355a2; font-family: Arial, sans-serif; margin-bottom: 2px; font-weight: normal; }
            
            .logo-container { text-align: center; margin-bottom: 12px; }
            .logo-img { height: 46px; object-fit: contain; }

            .banner-container { display: flex; align-items: center; justify-content: flex-start; gap: 8px; margin-bottom: 12px; }
            .banner-arrow-img { height: 26px; width: 26px; object-fit: contain; }
            .banner-banner-img { height: 26px; object-fit: contain; }

            table.report-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 9.5pt; }
            table.report-table th, table.report-table td { border: 1px solid #777777; padding: 3.5px 7px; text-align: left; vertical-align: middle; }
            table.report-table td.label-col { width: 38%; color: #000000; font-weight: normal; background-color: #ffffff; }
            table.report-table td.val-col { width: 62%; color: #0050b3; font-style: italic; font-weight: bold; }

            .section-box { margin-bottom: 9px; }
            .section-title { font-size: 9.5pt; font-weight: normal; margin-bottom: 2px; color: #000000; }
            .text-box { border: 1px solid #777777; min-height: 52px; padding: 6px 8px; font-size: 9pt; color: #000000; background: #ffffff; white-space: pre-wrap; line-height: 1.35; }

            .footer-date { text-align: center; font-size: 9.5pt; color: #0050b3; font-weight: bold; font-style: italic; margin-top: 22px; margin-bottom: 28px; }
            .signatures { display: flex; justify-content: space-around; text-align: center; margin-top: 25px; font-size: 9pt; color: #000000; }
            .signature-block { width: 44%; }
            .signature-line { border-top: 1px solid #000000; margin-top: 35px; padding-top: 4px; font-weight: bold; }

            .photo-section { margin-top: 22px; text-align: center; page-break-inside: avoid; }
            .photo-section h5 { font-size: 9.5pt; color: #0050b3; font-weight: bold; font-style: italic; margin-bottom: 8px; text-align: center; }
            .photo-img { max-width: 85%; max-height: 240px; border: 1px solid #bbbbbb; border-radius: 4px; object-fit: contain; }
          </style>
        </head>
        <body>
          <div class="header-top">Classificação: RESTRITA</div>

          <div class="logo-container">
            <img src="${REPORT_LOGO_B64}" class="logo-img" alt="som+a SEBRAE" />
          </div>

          <div class="banner-container">
            <img src="${REPORT_ARROW_B64}" class="banner-arrow-img" alt="↘" />
            <img src="${REPORT_BANNER_B64}" class="banner-banner-img" alt="RELATÓRIO DE PRESTAÇÃO DE SERVIÇO" />
          </div>

          <table class="report-table">
            <tr>
              <td class="label-col">Edital</td>
              <td class="val-col">${edital}</td>
            </tr>
            <tr>
              <td class="label-col">Processo Nº</td>
              <td class="val-col">${processoNo}</td>
            </tr>
            <tr>
              <td class="label-col">Contrato Nº</td>
              <td class="val-col">${contratoNo}</td>
            </tr>
            <tr>
              <td class="label-col">Razão Social da Empresa Credenciada</td>
              <td class="val-col">${empresaCredenciada}</td>
            </tr>
            <tr>
              <td class="label-col">Profissional responsável</td>
              <td class="val-col">${profissional}</td>
            </tr>
            <tr>
              <td class="label-col">Natureza</td>
              <td class="val-col">${natureza}</td>
            </tr>
            <tr>
              <td class="label-col">Objeto (produto)</td>
              <td class="val-col">${objeto}</td>
            </tr>
            <tr>
              <td class="label-col">Local da prestação de serviço (cliente)</td>
              <td class="val-col">${localPrestacao}</td>
            </tr>
            <tr>
              <td class="label-col">Data de execução</td>
              <td class="val-col">${dataExecucao}</td>
            </tr>
            <tr>
              <td class="label-col">Quantidade de horas</td>
              <td class="val-col">${qtdHoras}</td>
            </tr>
            <tr>
              <td class="label-col">Plataforma utilizada</td>
              <td class="val-col">${plataforma}</td>
            </tr>
            <tr>
              <td class="label-col">Nome do Cliente (Razão Social)</td>
              <td class="val-col">${nomeCliente}</td>
            </tr>
            <tr>
              <td class="label-col">CNPJ do Cliente</td>
              <td class="val-col">${cnpjCliente}</td>
            </tr>
            <tr>
              <td class="label-col">Código(s) RAE</td>
              <td class="val-col">${rae}</td>
            </tr>
          </table>

          <div class="section-box">
            <div class="section-title">Apontamentos do cliente (observações do cliente):</div>
            <div class="text-box">${formData.apontamentos_cliente || ''}</div>
          </div>

          <div class="section-box">
            <div class="section-title">Diagnóstico do consultor:</div>
            <div class="text-box">${formData.diagnostico_consultor || ''}</div>
          </div>

          <div class="section-box">
            <div class="section-title">Resumo dos assuntos discutidos:</div>
            <div class="text-box">${formData.resumo_assuntos || ''}</div>
          </div>

          <div class="section-box">
            <div class="section-title">Encaminhamento/recomendações:</div>
            <div class="text-box">${formData.encaminhamentos_recomendacoes || ''}</div>
          </div>

          <div class="footer-date">
            ${cidadeRodape}, ${dataExtenso}
          </div>

          <div class="signatures">
            <div class="signature-block">
              ${a1SignatureData && savedCert ? `
                <div style="border: 1.5px solid #059669; background-color: #f0fdf4; border-radius: 8px; padding: 7px 10px; margin-bottom: 6px; text-align: left; font-family: Arial, Helvetica, sans-serif; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                  <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #a7f3d0; padding-bottom: 3px; margin-bottom: 4px;">
                    <span style="font-size: 8pt; font-weight: 900; color: #065f46; letter-spacing: 0.3px;">
                      🔒 ASSINADO DIGITALMENTE (ICP-BRASIL)
                    </span>
                    <span style="font-size: 7pt; font-weight: bold; background: #059669; color: #ffffff; padding: 1px 5px; border-radius: 3px;">
                      AUTÊNTICO
                    </span>
                  </div>
                  <div style="font-size: 7.5pt; color: #1e293b; line-height: 1.35;">
                    <strong>Titular:</strong> ${savedCert.titular}<br/>
                    <strong>Documento:</strong> ${savedCert.documento} (${savedCert.tipoDocumento})<br/>
                    <strong>Autoridade:</strong> ${savedCert.emissor}<br/>
                    <strong>Data/Hora:</strong> ${a1SignatureData.timestampIso} (Brasília)<br/>
                    <strong>Hash SHA-256:</strong> <span style="font-family: monospace; font-size: 6.5pt; color: #475569;">${a1SignatureData.hashSHA256.substring(0, 32)}...</span><br/>
                    <span style="font-size: 6.5pt; color: #047857; font-style: italic;">Conformidade: MP nº 2.200-2/2001 e Lei nº 14.063/2020</span>
                  </div>
                </div>
                <div style="font-weight: bold; font-size: 8.5pt; color: #0f172a; margin-top: 2px;">
                  ${empresaCredenciada}<br/>
                  <span style="font-weight: normal; font-size: 8pt; color: #475569;">${profissional}</span>
                </div>
              ` : `
                <div class="signature-line">
                  ${empresaCredenciada}<br/>
                  <span style="font-weight: normal; font-size: 8.5pt;">${profissional}</span>
                </div>
              `}
            </div>

            <div class="signature-block">
              <div class="signature-line" style="${a1SignatureData ? 'margin-top: 55px;' : ''}">
                ${nomeCliente}<br/>
                <span style="font-weight: normal; font-size: 8.5pt;">Cliente - CNPJ: ${cnpjCliente}</span>
              </div>
            </div>
          </div>

          ${formData.dados_extra?.foto_cliente ? `
            <div class="photo-section">
              <h5>[Print Da Tela Do Atendimento (Para os atendimentos remotos) / Foto do Cliente]</h5>
              <img class="photo-img" src="${formData.dados_extra.foto_cliente}" alt="Comprovante de Atendimento" />
            </div>
          ` : ''}
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  // Disparo de Instruções e Relatório via WhatsApp para o cliente assinar
  const handleSendGovBrWhatsApp = () => {
    const phone = formData.celular || formData.telefone || project?.celular || project?.telefone;
    const savedCert = getSavedCertificateA1();
    const clientName = formData.nome_cliente || formData.razao_social || 'Cliente';
    const programa = formData.programa || 'Consultoria Sebrae';
    const rae = formData.codigo_rae ? ` (RAE: ${formData.codigo_rae})` : '';

    let msg = '';
    if (savedCert && savedCert.ativo) {
      msg = `Olá ${clientName}, tudo bem? Espero que sim!\n\nSegue o nosso Relatório Oficial de Prestação de Serviço (${programa}${rae}) *já assinado digitalmente por mim com Certificado Digital ICP-Brasil*.\n\nPor favor, providencie a sua assinatura no documento pela via de sua preferência:\n\n1. 👉 *Pelo GOV.BR Oficial (100% Gratuito):* Acesse https://assinador.iti.br com sua conta Gov.br (Prata ou Ouro), carregue o PDF anexo que estou te enviando, posicione sua assinatura no campo do Cliente e confirme.\n2. Ou caso prefira, pode assinar com seu Certificado Digital próprio ou assinatura eletrônica.\n\nAssim que assinar, me devolva o arquivo por aqui para concluirmos o processo junto ao Sebrae. Qualquer dúvida estou à disposição!`;
    } else {
      msg = buildWhatsAppMessage('assinatura_gov', formData);
    }
    openWhatsApp(phone, msg);
  };

  // E-mail com corpo e instruções para assinatura
  const getEmailReportLink = () => {
    try {
      const email = String(formData.email_cliente || '');
      const clientName = formData.nome_cliente || formData.razao_social || 'Cliente';
      const rae = formData.codigo_rae || '';
      const programa = formData.programa || 'Consultoria Sebrae';
      const savedCert = getSavedCertificateA1();
      const subject = `Relatório de Consultoria para Assinatura - ${programa} (${rae})`;
      
      let body = '';
      if (savedCert && savedCert.ativo) {
        body = `Olá ${clientName},\n\nEspero que esteja tudo bem!\n\nSegue em anexo o Relatório de Prestação de Serviço da nossa consultoria (${programa} - RAE: ${rae}), já assinado digitalmente por mim no padrão ICP-Brasil.\n\nPara colher a sua assinatura:\n1. Acesse o portal gratuito do Governo Federal: https://assinador.iti.br\n2. Faça login com sua conta GOV.BR (Prata ou Ouro)\n3. Carregue este documento PDF anexo\n4. Posicione sua assinatura digital no campo "Cliente" e confirme\n5. Baixe o PDF assinado e nos devolva respondendo a este e-mail.\n\n(Ou se preferir, pode assinar com seu próprio certificado digital ou ferramenta eletrônica).\n\nQualquer dúvida estou à total disposição!\n\nAtenciosamente,\n${savedCert.titular || formData.profissional_responsavel || 'Marco Antonio Pavani'}\n${formData.empresa_credenciada || 'AMP DO BRASIL'}`;
      } else {
        body = `Olá ${clientName},\n\nEspero que esteja tudo bem!\n\nSegue em anexo o Relatório de Prestação de Serviço da nossa consultoria (${programa} - RAE: ${rae}) para a sua assinatura digital.\n\nComo o Governo Federal disponibiliza o assinador oficial 100% gratuito (com validade jurídica plena aceita pelo Sebrae):\n1. Acesse o portal: https://assinador.iti.br\n2. Faça login com sua conta GOV.BR (Prata ou Ouro)\n3. Carregue este documento PDF anexo\n4. Posicione sua assinatura digital no campo "Cliente" e confirme\n5. Baixe o PDF assinado e me envie de volta por aqui.\n\nQualquer dúvida estou à total disposição!\n\nAtenciosamente,\n${formData.profissional_responsavel || 'Marco Antonio Pavani'}\n${formData.empresa_credenciada || 'AMP DO BRASIL'}`;
      }

      return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    } catch (e) {
      return '#';
    }
  };

  // Copiar instruções para a área de transferência
  const handleCopyGovInstructions = () => {
    const savedCert = getSavedCertificateA1();
    const clientName = formData.nome_cliente || formData.razao_social || 'Cliente';
    const programa = formData.programa || 'Consultoria Sebrae';
    const rae = formData.codigo_rae ? ` (RAE: ${formData.codigo_rae})` : '';

    let msg = '';
    if (savedCert && savedCert.ativo) {
      msg = `Olá ${clientName}, tudo bem? Espero que sim!\n\nSegue o nosso Relatório Oficial de Prestação de Serviço (${programa}${rae}) *já assinado digitalmente por mim com Certificado Digital ICP-Brasil*.\n\nPor favor, providencie a sua assinatura no documento pela via de sua preferência:\n\n1. 👉 *Pelo GOV.BR Oficial (100% Gratuito):* Acesse https://assinador.iti.br com sua conta Gov.br (Prata ou Ouro), carregue o PDF anexo que estou te enviando, posicione sua assinatura no campo do Cliente e confirme.\n2. Ou caso prefira, pode assinar com seu Certificado Digital próprio ou assinatura eletrônica.\n\nAssim que assinar, me devolva o arquivo por aqui para concluirmos o processo junto ao Sebrae. Qualquer dúvida estou à disposição!`;
    } else {
      msg = buildWhatsAppMessage('assinatura_gov', formData);
    }

    navigator.clipboard.writeText(msg).then(() => {
      setGovCopied(true);
      setTimeout(() => setGovCopied(false), 2500);
    }).catch(() => {
      alert('Instruções para assinatura:\n\n' + msg);
    });
  };

  // Atalho direto para abrir o Assinador GOV.BR oficial
  const handleOpenGovBr = () => {
    window.open('https://assinador.iti.br', '_blank');
  };

  // Envio Automático para Assinatura via Autentique API
  const handleAutentiqueSignature = async () => {
    let token = '';
    let isSandbox = true;

    try {
      const saved = localStorage.getItem('amp_company_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        token = parsed.autentiqueToken || '';
        isSandbox = parsed.autentiqueSandbox ?? true;
      }
    } catch (e) {}

    if (!token) {
      alert('Chave de API do Autentique não configurada!\n\nPor favor, acesse o menu "Configurações > Assinatura Digital" e insira seu Token da API Autentique.');
      return;
    }

    const clientName = formData.nome_cliente || formData.razao_social || 'Cliente Sebrae';
    const clientEmail = formData.email_cliente || '';
    const clientPhone = formData.celular || formData.telefone || '';

    if (!clientEmail && !clientPhone) {
      alert('Para enviar ao Autentique, preencha o E-mail ou Celular/WhatsApp do cliente no cadastro.');
      return;
    }

    setIsSendingAutentique(true);
    const result = await createAutentiqueDocument({
      token,
      sandbox: isSandbox,
      name: `Relatório SOMA Sebrae - RAE ${formData.codigo_rae || ''} - ${clientName}`,
      signerName: clientName,
      signerEmail: clientEmail || undefined,
      signerPhone: clientPhone || undefined,
      message: `Olá ${clientName}! Segue o Relatório da Consultoria Sebrae para sua assinatura eletrônica.`,
    });
    setIsSendingAutentique(false);

    if (result.success) {
      const updated = {
        ...formData,
        autentique_document_id: result.documentId || null,
        autentique_status: 'pendente',
        autentique_link: result.signUrl || null,
      } as Project;

      setFormData(updated);
      onUpdate(updated);

      let successText = `✅ Documento criado com sucesso no Autentique!\nID: ${result.documentId || 'OK'}`;
      if (result.signUrl) {
        successText += `\nLink de assinatura: ${result.signUrl}`;
      }
      alert(successText);

      if (result.signUrl) {
        window.open(result.signUrl, '_blank');
      }
    } else {
      alert(`❌ Falha ao enviar para o Autentique:\n${result.error || 'Erro desconhecido'}`);
    }
  };

  // Resolve ER Credenciado e E-mail Responsável para São Paulo
  const currentUnidadeDemandante =
    formData.dados_extra?.unidade_demandante ||
    formData.dados_extra?.er_credenciado ||
    '';
  const matchedEr = findSebraeSpErCredenciado(currentUnidadeDemandante, formData.municipio);
  const resolvedErName = matchedEr?.er || currentUnidadeDemandante || '';
  const resolvedErGestor = matchedEr?.gestor || formData.dados_extra?.gestor_er_credenciado || '';
  const resolvedErEmail = matchedEr?.email || formData.dados_extra?.email_er_credenciado || '';
  const resolvedGestorOsEmail = formData.dados_extra?.email_gestor || '';
  const generatedNfDiscriminacao = buildSebraeSpNfDiscriminacao(formData);

  const handleUnidadeDemandanteChange = (novaUnidade: string) => {
    const found = findSebraeSpErCredenciado(novaUnidade, formData.municipio);
    setFormData((prev) => ({
      ...prev,
      estado: found ? 'SP' : (prev.estado || 'SP'),
      dados_extra: {
        ...(prev.dados_extra || {}),
        unidade_demandante: novaUnidade,
        er_credenciado: found?.er || novaUnidade,
        gestor_er_credenciado: found?.gestor || '',
        email_er_credenciado: found?.email || '',
      },
    }));
  };

  const handleSendToSebrae = () => {
    const destEmail = resolvedErEmail || resolvedGestorOsEmail || 'credenciamento.uac@sebraesp.com.br';
    const ccEmail = (resolvedGestorOsEmail && resolvedGestorOsEmail !== destEmail) ? resolvedGestorOsEmail : '';
    const osNum = formData.dados_extra?.os_number || formData.contrato_no || formData.codigo_rae || '';
    const sgfNum = formData.dados_extra?.sgf || formData.dados_extra?.codigo_sgf || formData.contrato_no || '';
    const raeNum = String(formData.codigo_rae || '').replace(/^RAE\s*/i, '').trim();
    const clientName = formData.nome_cliente || formData.razao_social || 'Cliente';

    const subject = `Prestação de Contas SOMA SEBRAE-SP - OS ${osNum} - RAE ${raeNum} - ${clientName}`;
    const body = [
      `Prezados (${resolvedErName || 'Credenciamento SEBRAE-SP'}${resolvedErGestor ? ` - A/C ${resolvedErGestor}` : ''}),`,
      ``,
      `Encaminhamos em anexo os documentos referentes à prestação de serviços concluída no âmbito do Programa SOMA SEBRAE:`,
      ``,
      `- Unidade Demandante: ${resolvedErName || 'SEBRAE-SP'}`,
      `- Nº da Ordem de Serviço: ${osNum}`,
      `- Código SGF: ${sgfNum}`,
      `- Código RAE: ${raeNum}`,
      `- Cliente Atendido: ${clientName} (${formData.cnpj || formData.cpf || ''})`,
      `- Produto: ${formData.solucao_contratada || ''}`,
      `- Quantidade de Horas: ${formData.horas_realizadas || formData.horas_contratadas || 1} hora(s)`,
      `- Data de Execução: ${formatDataSimples(formData.data_atendimento || formData.data_prevista_inicio)}`,
      `- Valor Total da OS: R$ ${Number(formData.valor_consultoria || 170).toFixed(2).replace('.', ',')}`,
      ``,
      `Documentos anexos para pagamento:`,
      `1. Nota Fiscal de Serviços Eletrônica (NFS-e Nacional)`,
      `2. Relatório de Prestação de Serviço assinado (Consultor e Cliente) + Evidência/Print do Atendimento`,
      ``,
      `Atenciosamente,`,
      `${formData.profissional_responsavel || 'MARCO ANTONIO PAVANI'}`,
      `${formData.empresa_credenciada || 'AMP DO BRASIL SOLUCOES ADMINISTRATIVAS E TECNOLOGICAS LTDA'}`,
      `CNPJ: 10.682.233/0001-75`,
    ].join('\n');

    const mailtoUrl = `mailto:${encodeURIComponent(destEmail)}?${ccEmail ? `cc=${encodeURIComponent(ccEmail)}&` : ''}subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className={cn(
          "fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Slide-over Panel */}
      <div 
        className={cn(
          "fixed top-0 right-0 h-screen w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out border-l border-slate-200 font-sans",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-md w-fit">
                <FileText size={14} />
                RAE: {project.codigo_rae || 'Não informado'}
              </div>
              {isSebraeSpProject(formData) && (
                <span className="text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-1 rounded-md">
                  SEBRAE-SP {resolvedErName ? `• ${resolvedErName}` : ''}
                </span>
              )}
              {resolvedErEmail && (
                <span className="text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-md">
                  📩 {resolvedErEmail}
                </span>
              )}
            </div>
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
              {formData.nome_cliente || formData.razao_social || project.nome_cliente || 'Cliente Sem Nome'}
            </h2>
          </div>
          
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 hide-scrollbar">
          
          {/* Quick Contact Bar */}
          <section className="bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-900 p-5 rounded-2xl text-white shadow-md border border-purple-800/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2.5">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-purple-200 flex items-center gap-2">
                  <MessageSquare size={16} className="text-emerald-400" />
                  Comunicação & Agendamento Rápido
                </h3>
                <p className="text-[11px] text-purple-300/90 mt-0.5">
                  Dispare mensagens no WhatsApp em 1 clique (o card só muda de fase quando você decidir manualmente):
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href="https://calendar.app.google/skRSHv2QBUjY9ae16"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 bg-blue-600/80 hover:bg-blue-600 text-white font-semibold text-[11px] px-3 py-1.5 rounded-lg border border-blue-400/30 transition-all cursor-pointer"
                  title="Abrir Google Agenda"
                >
                  <Calendar size={13} />
                  <span>Google Agenda</span>
                </a>
                <a
                  href={getEmailLink()}
                  className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-[11px] px-3 py-1.5 rounded-lg border border-white/20 transition-all cursor-pointer"
                  title="Enviar e-mail para o cliente"
                >
                  <Mail size={13} />
                  <span>E-mail</span>
                </a>
              </div>
            </div>

            {/* Grid de Templates WhatsApp */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
              {WHATSAPP_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => {
                    const phone = formData.celular || formData.telefone || project?.celular || project?.telefone;
                    const msg = buildWhatsAppMessage(tpl.id, formData);
                    openWhatsApp(phone, msg);
                  }}
                  className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/5 hover:bg-emerald-600/90 text-left border border-white/10 hover:border-emerald-400/50 transition-all group cursor-pointer"
                >
                  <div className="p-1.5 rounded-lg bg-white/10 group-hover:bg-white/20 text-white shrink-0 mt-0.5">
                    {tpl.id === 'convite' && <Send size={14} className="text-emerald-300 group-hover:text-white" />}
                    {tpl.id === 'cobranca_1' && <Clock size={14} className="text-amber-300 group-hover:text-white" />}
                    {tpl.id === 'cobranca_urgente' && <AlertTriangle size={14} className="text-rose-300 group-hover:text-white" />}
                    {tpl.id === 'lembrete' && <Calendar size={14} className="text-sky-300 group-hover:text-white" />}
                    {tpl.id === 'retorno' && <RotateCcw size={14} className="text-purple-300 group-hover:text-white" />}
                    {tpl.id === 'assinatura_gov' && <FileSignature size={14} className="text-teal-300 group-hover:text-white" />}
                    {tpl.id === 'livre' && <MessageSquare size={14} className="text-slate-300 group-hover:text-white" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-xs font-bold text-white group-hover:text-white truncate">
                        {tpl.title}
                      </span>
                    </div>
                    <p className="text-[10px] text-purple-200/80 group-hover:text-white/90 line-clamp-2 leading-tight">
                      {tpl.subtitle}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Dados da Ordem de Serviço & Valor R$ */}
          <section className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <FileText size={16} className="text-primary" />
              Dados da Ordem de Serviço & Valor (R$)
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              <InputField 
                label="Código RAE" 
                value={formData.codigo_rae} 
                onChange={(v) => handleChange('codigo_rae', v)} 
              />
              <InputField 
                label="Nº da Ordem de Serviço (OS)" 
                value={formData.dados_extra?.os_number || ''} 
                onChange={(v) =>
                  setFormData((prev) => ({
                    ...prev,
                    dados_extra: { ...(prev.dados_extra || {}), os_number: v },
                  }))
                }
                placeholder="Ex: 091108/2026"
              />
              <InputField 
                label="Código SGF" 
                value={formData.dados_extra?.sgf || formData.dados_extra?.codigo_sgf || formData.contrato_no || ''} 
                onChange={(v) => {
                  handleChange('contrato_no', v);
                  setFormData((prev) => ({
                    ...prev,
                    contrato_no: v,
                    dados_extra: { ...(prev.dados_extra || {}), sgf: v, codigo_sgf: v },
                  }));
                }}
                placeholder="Ex: SP0920261108"
              />
              <InputField 
                label="Valor da OS (R$)" 
                type="text"
                value={formData.valor_consultoria != null ? (typeof formData.valor_consultoria === 'number' ? (Number.isInteger(formData.valor_consultoria) ? formData.valor_consultoria : Number(formData.valor_consultoria).toFixed(2)) : formData.valor_consultoria) : ''} 
                onChange={(v) => handleChange('valor_consultoria', v)} 
                placeholder="Ex: 170.00 ou 1224.00"
              />
              <InputField 
                label="Data do Atendimento / Execução" 
                type="text"
                value={formData.data_atendimento || formData.data_prevista_inicio || ''} 
                onChange={(v) => {
                  handleChange('data_atendimento', v);
                  handleChange('data_prevista_inicio', v);
                }} 
                placeholder="Ex: 01/10/2026"
              />
              <InputField 
                label="(Remoto/Presencial)" 
                value={formData.modalidade} 
                onChange={(v) => handleChange('modalidade', v)} 
              />
              <InputField 
                label="Carga Horária (Horas Contratadas)" 
                type="text"
                value={formData.horas_contratadas ?? ''} 
                onChange={(v) => handleChange('horas_contratadas', v)} 
                placeholder="Ex: 1 ou 4"
              />
              <InputField 
                label="Horas Realizadas" 
                type="text"
                value={formData.horas_realizadas ?? ''} 
                onChange={(v) => handleChange('horas_realizadas', v)} 
                placeholder="Ex: 1 ou 4"
              />
              <InputField 
                label="Programa / SGF" 
                value={formData.programa} 
                onChange={(v) => handleChange('programa', v)} 
              />
            </div>

            {/* Bloco Unidade Demandante (ER SEBRAE-SP) & Cruzamento Automático de E-mail Credenciado */}
            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-extrabold text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
                  <Mail size={15} className="text-blue-700" />
                  <span>Unidade Demandante (SEBRAE-SP) & E-mail Credenciado para Envio</span>
                </span>
                {resolvedErEmail && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(resolvedErEmail);
                      setErEmailCopied(true);
                      setTimeout(() => setErEmailCopied(false), 2500);
                    }}
                    className="inline-flex items-center gap-1 bg-blue-700 hover:bg-blue-800 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    {erEmailCopied ? <Check size={12} /> : <Clipboard size={12} />}
                    <span>{erEmailCopied ? 'E-mail Copiado!' : 'Copiar E-mail ER'}</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Unidade Demandante (ER)
                  </label>
                  <select
                    value={resolvedErName}
                    onChange={(e) => handleUnidadeDemandanteChange(e.target.value)}
                    className="w-full bg-white border border-blue-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-bold focus:outline-none focus:border-blue-600"
                  >
                    <option value="">Selecione a ER (São Paulo)...</option>
                    {SEBRAE_SP_ER_CREDENCIADOS.map((item) => (
                      <option key={item.er} value={item.er}>
                        {item.er}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Gestor do Credenciamento (ER)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={resolvedErGestor || 'Selecione a Unidade Demandante'}
                    className="w-full bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    E-mail Responsável (Envio NF/Relatório)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={resolvedErEmail || 'Selecione a Unidade Demandante'}
                    className="w-full bg-emerald-50 border border-emerald-300 rounded-lg px-2.5 py-1.5 text-xs text-emerald-900 font-bold"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Produto Aplicado / Solução Contratada</label>
              <input 
                type="text"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-primary transition-all"
                value={formData.solucao_contratada || ''}
                onChange={(e) => handleChange('solucao_contratada', e.target.value)}
              />
            </div>
          </section>

          {/* Dados do Cliente */}
          <section className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Building2 size={16} className="text-slate-400" />
              Dados do Cliente (Sebrae RAE)
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <InputField 
                label="Nome do Cliente / Razão Social" 
                value={formData.nome_cliente || formData.razao_social || ''} 
                onChange={(v) => {
                  handleChange('nome_cliente', v);
                  handleChange('razao_social', v);
                }} 
              />
              <InputField 
                label="Nome Fantasia" 
                value={formData.nome_fantasia} 
                onChange={(v) => handleChange('nome_fantasia', v)} 
              />
              <InputField 
                label="CNPJ" 
                value={formData.cnpj} 
                onChange={(v) => handleChange('cnpj', v)} 
              />
              <InputField 
                label="CPF" 
                value={formData.cpf} 
                onChange={(v) => handleChange('cpf', v)} 
              />
              <InputField 
                label="E-mail" 
                type="email"
                value={formData.email_cliente} 
                onChange={(v) => handleChange('email_cliente', v)} 
              />
              <InputField 
                label="Celular / WhatsApp" 
                value={maskPhone(formData.celular || formData.telefone || '')} 
                onChange={(v) => {
                  const masked = maskPhone(v);
                  handleChange('celular', masked);
                  handleChange('telefone', masked);
                }} 
                placeholder="(00) 00000-0000"
              />
              <InputField 
                label="Município" 
                value={formData.municipio} 
                onChange={(v) => handleChange('municipio', v)} 
              />
              <InputField 
                label="Estado (UF)" 
                value={formData.estado} 
                onChange={(v) => handleChange('estado', v)} 
              />
            </div>
          </section>

          {/* SOMA SEBRAE Official Report Parameters */}
          <section className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <FileCheck size={16} className="text-primary" />
              Relatório de Prestação de Serviço (SOMA SEBRAE)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
              <InputField 
                label="Contrato Nº" 
                value={formData.contrato_no || ''} 
                onChange={(v) => handleChange('contrato_no', v)} 
                placeholder="Ex: RJ0520260103"
              />
              <InputField 
                label="Edital" 
                value={formData.edital || ''} 
                onChange={(v) => handleChange('edital', v)} 
                placeholder="Ex: 001/2026"
              />
              <InputField 
                label="Processo Nº" 
                value={formData.processo_no || ''} 
                onChange={(v) => handleChange('processo_no', v)} 
                placeholder="Ex: 1777/2025"
              />
              <InputField 
                label="Plataforma Utilizada" 
                value={formData.plataforma_utilizada || ''} 
                onChange={(v) => handleChange('plataforma_utilizada', v)} 
                placeholder="Ex: Remoto ou Plataforma Teams"
              />
              <InputField 
                label="Natureza" 
                value={formData.natureza || ''} 
                onChange={(v) => handleChange('natureza', v)} 
                placeholder="Ex: CONSULTORIA"
              />
              <InputField 
                label="Empresa Credenciada" 
                value={formData.empresa_credenciada || ''} 
                onChange={(v) => handleChange('empresa_credenciada', v)} 
                placeholder="Ex: AMP DO BRASIL..."
              />
              <InputField 
                label="Profissional Responsável" 
                value={formData.profissional_responsavel || ''} 
                onChange={(v) => handleChange('profissional_responsavel', v)} 
                placeholder="Ex: MARCO ANTONIO PAVANI"
              />
              <InputField 
                label="Data do Atendimento (Execução)" 
                type="text"
                value={formData.data_atendimento || formData.data_prevista_inicio || ''} 
                onChange={(v) => {
                  handleChange('data_atendimento', v);
                  handleChange('data_prevista_inicio', v);
                }} 
                placeholder="Ex: 10/08/2026 ou 2026-08-10"
              />
            </div>

            {/* Assistente de IA & Voz: Gerador Automático de Relatório SOMA SEBRAE */}
            <SomaAiAssistant 
              clientContext={{
                nome_cliente: formData.nome_cliente || formData.nome_fantasia || formData.razao_social || '',
                razao_social: formData.razao_social || formData.nome_cliente || '',
                solucao_contratada: formData.solucao_contratada || '',
                programa: formData.programa || '',
                consultor: formData.profissional_responsavel || 'MARCO ANTONIO PAVANI',
              }}
              onApplyReport={(report) => {
                handleChange('apontamentos_cliente', report.apontamentos_cliente);
                handleChange('diagnostico_consultor', report.diagnostico_consultor);
                handleChange('resumo_assuntos', report.resumo_assuntos);
                handleChange('encaminhamentos_recomendacoes', report.encaminhamentos_recomendacoes);
              }}
            />

            {/* 4 Narrative Boxes */}
            <div className="space-y-3.5 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  1. Apontamentos do cliente (observações do cliente):
                </label>
                <textarea 
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary"
                  value={formData.apontamentos_cliente || ''}
                  onChange={(e) => handleChange('apontamentos_cliente', e.target.value)}
                  placeholder="Relatos, necessidades ou queixas expressas pelo cliente..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  2. Diagnóstico do consultor:
                </label>
                <textarea 
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary"
                  value={formData.diagnostico_consultor || ''}
                  onChange={(e) => handleChange('diagnostico_consultor', e.target.value)}
                  placeholder="Diagnóstico técnico das oportunidades e problemas identificados..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  3. Resumo dos assuntos discutidos:
                </label>
                <textarea 
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary"
                  value={formData.resumo_assuntos || ''}
                  onChange={(e) => handleChange('resumo_assuntos', e.target.value)}
                  placeholder="Pontos abordados durante a reunião de consultoria..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  4. Encaminhamento / recomendações:
                </label>
                <textarea 
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary"
                  value={formData.encaminhamentos_recomendacoes || ''}
                  onChange={(e) => handleChange('encaminhamentos_recomendacoes', e.target.value)}
                  placeholder="Plano de ação e recomendações finais para a empresa..."
                />
              </div>
            </div>
          </section>

          {/* Workflow Pós-Atendimento: Foto, Termo SOMA, Assinado e NF */}
          <section className="bg-purple-50/70 border border-purple-200 p-5 rounded-2xl space-y-4">
            <div>
              <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Send size={16} className="text-primary" />
                Fechamento & Envio do Pacote ao SEBRAE
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Gere o documento oficial SOMA, anexe a foto do atendimento e envie os arquivos para finalizar no Sebrae.
              </p>
            </div>

            {/* Foto do Atendimento / Print do WhatsApp (Área isolada com botão dedicado e Ctrl+V focado) */}
            <div 
              tabIndex={0}
              onPaste={handlePhotoBoxPaste}
              className="p-4 bg-white rounded-2xl border-2 border-dashed border-purple-200 hover:border-purple-400 focus:border-purple-500 focus:outline-none transition-colors space-y-3"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <span className="text-xs font-extrabold text-slate-900 block flex items-center gap-1.5">
                    <Camera size={15} className="text-primary" />
                    <span>1. Print da Conversa do WhatsApp / Comprovante de Atendimento</span>
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Insira a imagem de comprovação que será anexada ao relatório SOMA oficial.
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClipboardPasteButton}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl cursor-pointer transition-all shrink-0 flex items-center gap-1.5 shadow-xs hover:shadow-sm"
                    title="Cola automaticamente a imagem copiada na área de transferência (Print Screen)"
                  >
                    <Clipboard size={14} />
                    <span>Colar Print (Ctrl+V)</span>
                  </button>

                  <label className="bg-purple-100 hover:bg-purple-200 text-purple-900 text-xs font-bold px-3 py-1.5 rounded-xl cursor-pointer transition-colors shrink-0 flex items-center gap-1.5">
                    <Camera size={14} />
                    <span>{formData.dados_extra?.foto_cliente ? 'Alterar Arquivo' : 'Selecionar Arquivo'}</span>
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  </label>
                </div>
              </div>

              {formData.dados_extra?.foto_cliente ? (
                <div className="flex items-center gap-3 bg-purple-50 p-2.5 rounded-xl border border-purple-200">
                  <img
                    src={formData.dados_extra.foto_cliente}
                    alt="Preview WhatsApp Print"
                    className="w-16 h-16 object-cover rounded-lg border border-purple-300 shadow-xs shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-purple-950 block">✅ Print do WhatsApp Anexado!</span>
                    <p className="text-[11px] text-purple-800">
                      Esta imagem será posicionada ao final do relatório oficial SOMA para auditoria.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, dados_extra: { ...prev.dados_extra, foto_cliente: null } }))}
                    className="text-xs font-bold text-rose-600 hover:underline px-2 py-1"
                  >
                    Remover
                  </button>
                </div>
              ) : (
                <div 
                  onClick={handleClipboardPasteButton}
                  className="bg-slate-50 hover:bg-purple-50/50 border border-slate-200 hover:border-purple-300 rounded-xl p-3 text-center space-y-1 cursor-pointer transition-colors"
                >
                  <p className="text-xs font-bold text-slate-700">
                    💡 Dica: Clique aqui e use o botão <span className="text-purple-700 font-extrabold">"Colar Print (Ctrl+V)"</span> ou pressione <kbd className="bg-white border border-slate-300 px-1.5 py-0.5 rounded text-[10px] font-mono text-purple-700 font-black">Ctrl + V</kbd> nesta caixa!
                  </p>
                  <p className="text-[10px] text-slate-400">
                    A captura de tela só é inserida quando você clica aqui ou usa o botão acima.
                  </p>
                </div>
              )}
            </div>

            {/* Bloco Completo de Assinatura Digital do Relatório (Certificado A1, GOV.BR & Autentique) */}
            <div className="p-4.5 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl shadow-md space-y-4 border border-purple-900/40">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                    <FileSignature size={16} className="text-emerald-400" />
                    <span>2. Autenticação & Assinatura Digital do Relatório</span>
                  </span>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Assine automaticamente com seu Certificado A1 e envie a sua via pronta para o cliente colher a dele.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getSavedCertificateA1()?.ativo ? (
                    <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <ShieldCheck size={12} className="text-emerald-400" />
                      <span>A1 Ativo ({getSavedCertificateA1()?.titular.split(' ')[0]})</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <span>Sem Certificado A1</span>
                    </span>
                  )}
                  {formData.autentique_status && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-400/20 text-purple-300 border border-purple-400/30">
                      Autentique: {formData.autentique_status}
                    </span>
                  )}
                </div>
              </div>

              {/* Roteiro Passo a Passo: Certificado A1 + Envio ao Cliente */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Passo 1 */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col justify-between hover:bg-white/[0.08] transition-colors">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">1º Passo</span>
                      <ShieldCheck size={15} className="text-emerald-400" />
                    </div>
                    <h5 className="text-xs font-bold text-white mb-1">
                      {getSavedCertificateA1()?.ativo ? 'Gerar & Assinar (A1)' : 'Gerar Relatório SOMA'}
                    </h5>
                    <p className="text-[11px] text-slate-300 leading-snug">
                      {getSavedCertificateA1()?.ativo
                        ? `Carimba e assina digitalmente com o Certificado ICP-Brasil de ${getSavedCertificateA1()?.titular}.`
                        : 'Gera o relatório oficial SOMA com fotos e dados preenchidos para salvar em PDF.'}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-col gap-1.5">
                    {getSavedCertificateA1()?.ativo ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handlePrintReport(true)}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                          title="Gerar PDF com assinatura digital ICP-Brasil do seu certificado A1"
                        >
                          <ShieldCheck size={14} />
                          <span>Gerar Assinado (A1)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePrintReport(false)}
                          className="w-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white font-semibold text-[10px] py-1 px-2 rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer"
                          title="Visualizar modelo simples sem assinatura"
                        >
                          <Printer size={11} />
                          <span>Modelo sem A1</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handlePrintReport(false)}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                        >
                          <Printer size={13} />
                          <span>Salvar PDF</span>
                        </button>
                        <span className="text-[9px] text-purple-300 block text-center mt-0.5">
                          💡 Configure seu A1 nas Configurações
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Passo 2 */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col justify-between hover:bg-white/[0.08] transition-colors">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-black uppercase text-purple-400 tracking-wider">2º Passo</span>
                      <Send size={14} className="text-slate-400" />
                    </div>
                    <h5 className="text-xs font-bold text-white mb-1">Enviar ao Cliente</h5>
                    <p className="text-[11px] text-slate-300 leading-snug">
                      Envie seu PDF assinado para o cliente colher a assinatura dele (via GOV.BR, certificado ou eletrônica).
                    </p>
                  </div>
                  <div className="mt-3 flex gap-1.5">
                    <button
                      type="button"
                      onClick={handleSendGovBrWhatsApp}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2 px-2 rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-xs"
                      title="Disparar no WhatsApp do cliente com orientações completas"
                    >
                      <MessageSquare size={13} />
                      <span>WhatsApp</span>
                    </button>
                    <a
                      href={getEmailReportLink()}
                      className="bg-white/10 hover:bg-white/20 text-white font-bold text-xs py-2 px-2.5 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                      title="Enviar por E-mail"
                    >
                      <Mail size={13} />
                    </a>
                    <button
                      type="button"
                      onClick={handleCopyGovInstructions}
                      className="bg-white/10 hover:bg-white/20 text-white font-bold text-xs py-2 px-2.5 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                      title="Copiar texto explicativo da mensagem"
                    >
                      {govCopied ? <Check size={13} className="text-emerald-400" /> : <Clipboard size={13} />}
                    </button>
                  </div>
                </div>

                {/* Passo 3 */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col justify-between hover:bg-white/[0.08] transition-colors">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-black uppercase text-blue-400 tracking-wider">3º Passo</span>
                      <FileCheck size={14} className="text-slate-400" />
                    </div>
                    <h5 className="text-xs font-bold text-white mb-1">Cliente Devolve Assinado</h5>
                    <p className="text-[11px] text-slate-300 leading-snug">
                      Quando o cliente responder com as duas assinaturas, anexe o documento final para fechamento.
                    </p>
                  </div>
                  <div className="mt-3 flex flex-col gap-1.5">
                    <label className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs text-center">
                      <FileCheck size={14} />
                      <span>Anexar Termo Final</span>
                      <input type="file" accept=".pdf,image/*" onChange={handleTermUpload} className="hidden" />
                    </label>
                    <a
                      href="https://assinador.iti.br"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-slate-300 hover:text-white text-center underline block mt-0.5"
                      title="Link do assinador oficial GOV.BR caso queira orientar o cliente"
                    >
                      Ajuda: assinador.iti.br
                    </a>
                  </div>
                </div>
              </div>

              {/* Lembrete Prático de Envio no WhatsApp */}
              <div className="text-[11px] text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 flex items-start gap-2">
                <AlertTriangle size={15} className="shrink-0 text-amber-400 mt-0.5" />
                <span>
                  <strong>Como enviar o arquivo no WhatsApp:</strong> Ao clicar em <strong>WhatsApp</strong>, a conversa do cliente abrirá com as orientações pré-digitadas; basta arrastar o PDF gerado para dentro da janela de conversa antes de enviar.
                </span>
              </div>

              {/* Alternativa Autentique API (Caso configure Token) */}
              <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="text-[11px] text-slate-300">
                  <span>Alternativa: Envio automatizado em nuvem por e-mail? </span>
                  <span className="text-purple-300 font-semibold">Autentique API integrada.</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAutentiqueSignature}
                    disabled={isSendingAutentique}
                    className="bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white font-bold text-[11px] py-1.5 px-3 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <FileSignature size={13} />
                    <span>{isSendingAutentique ? 'Disparando...' : 'Disparar via Autentique API'}</span>
                  </button>
                  {formData.autentique_link && (
                    <a
                      href={formData.autentique_link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-purple-300 hover:text-white text-[11px] font-bold underline flex items-center gap-1 ml-1"
                    >
                      Ver no Autentique <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Upload Termo Assinado */}
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-slate-800 block">3. Termo Assinado pelo Cliente:</span>
                <span className="text-[11px] text-slate-500">
                  {formData.dados_extra?.termo_assinado_nome || 'Nenhum termo assinado anexado'}
                </span>
              </div>
              <label className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors shrink-0">
                <span>Anexar Assinado</span>
                <input type="file" accept=".pdf,image/*" onChange={handleTermUpload} className="hidden" />
              </label>
            </div>

            {/* 4. Nota Fiscal (NF) — Estrutura Oficial SOMA SEBRAE & Upload */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <span className="text-xs font-extrabold text-slate-900 block">
                    4. Nota Fiscal (NF) — Discriminação Oficial SOMA SEBRAE:
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {formData.dados_extra?.nota_fiscal_nome
                      ? `✅ Arquivo anexado: ${formData.dados_extra.nota_fiscal_nome}`
                      : 'Copie o texto padrão abaixo (item 1.1 do Manual) para emitir a NF e anexe o PDF.'}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedNfDiscriminacao);
                      setNfTextCopied(true);
                      setTimeout(() => setNfTextCopied(false), 2500);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 shadow-2xs"
                    title="Copia a discriminação completa exigida pelo SEBRAE-SP"
                  >
                    {nfTextCopied ? <Check size={13} /> : <Clipboard size={13} />}
                    <span>{nfTextCopied ? 'Discriminação Copiada!' : 'Copiar Discriminação da NF'}</span>
                  </button>

                  <label className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors shrink-0">
                    <span>Anexar NF</span>
                    <input type="file" accept=".pdf,image/*" onChange={handleNfUpload} className="hidden" />
                  </label>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold">
                  <span>Tomador SEBRAE-SP: <strong>43.728.245/0001-42</strong> • Cód. Serviço Outros Municípios: <strong>17.01 (Consultoria)</strong></span>
                  <span>Valor Total: <strong className="text-emerald-700">R$ {Number(formData.valor_consultoria || 170).toFixed(2).replace('.', ',')}</strong></span>
                </div>
                <textarea
                  readOnly
                  rows={8}
                  value={generatedNfDiscriminacao}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-[11px] text-slate-800 leading-snug focus:outline-none select-all"
                />
              </div>
            </div>

            {/* Finalizar e enviar ao SEBRAE (Cruzado com o E-mail Credenciado da ER) */}
            <div className="pt-2 space-y-2">
              {resolvedErEmail && (
                <div className="bg-blue-950 text-white rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase tracking-wider text-blue-300 font-bold block">
                      Destinatário Credenciado ({resolvedErName}):
                    </span>
                    <span className="font-extrabold text-emerald-300 truncate block">
                      {resolvedErEmail} {resolvedErGestor ? `• ${resolvedErGestor}` : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(resolvedErEmail);
                      setErEmailCopied(true);
                      setTimeout(() => setErEmailCopied(false), 2500);
                    }}
                    className="bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0 cursor-pointer flex items-center gap-1"
                  >
                    {erEmailCopied ? <Check size={12} /> : <Clipboard size={12} />}
                    <span>{erEmailCopied ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={handleSendToSebrae}
                className="w-full bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send size={16} />
                <span>
                  {resolvedErEmail
                    ? `Encaminhar Pacote SOMA para ${resolvedErName} (${resolvedErEmail})`
                    : 'Encaminhar Pacote SOMA Completo ao SEBRAE'}
                </span>
              </button>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-4 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            {saveSuccess && (
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                <CheckCircle2 size={16} /> Salvo com sucesso!
              </span>
            )}
            {onDelete && project.id && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Tem certeza que deseja excluir a demanda "${project.nome_cliente || project.codigo_rae}" do Kanban?`)) {
                    onDelete(project.id);
                    onClose();
                  }
                }}
                className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors flex items-center gap-1.5"
              >
                <Trash2 size={14} />
                <span>Excluir Demanda</span>
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-hover shadow-md shadow-purple-500/20 transition-all flex items-center gap-2 disabled:opacity-70"
            >
              <Save size={16} />
              {isSaving ? 'Salvando...' : 'Salvar & Fechar'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function InputField({ 
  label, 
  value, 
  onChange, 
  type = 'text',
  step,
  placeholder,
}: { 
  label: string; 
  value: any; 
  onChange: (val: string) => void; 
  type?: string;
  step?: string;
  placeholder?: string;
}) {
  const [localValue, setLocalValue] = useState<string>(() => (value !== null && value !== undefined ? String(value) : ''));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(value !== null && value !== undefined ? String(value) : '');
    }
  }, [value, isFocused]);

  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      <input 
        type={type}
        step={step || (type === 'number' ? 'any' : undefined)}
        placeholder={placeholder}
        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-primary transition-all font-medium"
        value={isFocused ? localValue : (value !== null && value !== undefined ? String(value) : '')}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false);
          onChange(localValue);
        }}
        onChange={(e) => {
          setLocalValue(e.target.value);
          onChange(e.target.value);
        }}
      />
    </div>
  );
}
