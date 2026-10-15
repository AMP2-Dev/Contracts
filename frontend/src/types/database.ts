export type ProjectStatus = 
  | 'novo_contrato'
  | 'contato_inicial'
  | 'agendamento'
  | 'atendimento_realizado'
  | 'relatorio_elaboracao'
  | 'relatorio_enviado'
  | 'nf_pendente'
  | 'pagamento_aguardando'
  | 'concluido';

export interface Project {
  id: string;
  consultor_id: string | null;
  codigo_rae: string | null;
  status: ProjectStatus;
  
  // Cliente
  nome_cliente: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  cnpj: string | null;
  cpf: string | null;
  telefone: string | null;
  celular: string | null;
  email_cliente: string | null;
  municipio: string | null;
  estado: string | null;
  endereco: string | null;
  
  // Atendimento
  programa: string | null;
  solucao_contratada: string | null;
  objetivo_atendimento: string | null;
  horas_contratadas: number | null;
  horas_realizadas: number;
  data_prevista_inicio: string | null;
  data_prevista_fim: string | null;
  modalidade: string | null;

  // Financeiro e Extras
  valor_consultoria: number | null;
  observacoes: string | null;
  
  // Sebrae SOMA Relatório Oficial
  edital?: string | null;
  processo_no?: string | null;
  contrato_no?: string | null;
  empresa_credenciada?: string | null;
  profissional_responsavel?: string | null;
  natureza?: string | null;
  data_atendimento?: string | null;
  plataforma_utilizada?: string | null;
  apontamentos_cliente?: string | null;
  diagnostico_consultor?: string | null;
  resumo_assuntos?: string | null;
  encaminhamentos_recomendacoes?: string | null;

  // Integração Autentique & GOV.BR
  autentique_document_id?: string | null;
  autentique_status?: 'pendente' | 'assinado' | 'recusado' | null;
  autentique_link?: string | null;

  dados_extra: any;

  criado_em: string;
  atualizado_em: string;
}

export interface KanbanColumnDef {
  id: ProjectStatus;
  title: string;
  color: string;
}

export const KANBAN_COLUMNS: KanbanColumnDef[] = [
  { id: 'novo_contrato', title: 'Novo Contrato', color: 'bg-indigo-500' },
  { id: 'contato_inicial', title: 'Contato Inicial', color: 'bg-sky-500' },
  { id: 'agendamento', title: 'Atend. Agendado', color: 'bg-amber-500' },
  { id: 'atendimento_realizado', title: 'Atend. Realizado', color: 'bg-fuchsia-500' },
  { id: 'relatorio_elaboracao', title: 'Fazendo Relatório', color: 'bg-pink-500' },
  { id: 'relatorio_enviado', title: 'Relatório Enviado', color: 'bg-purple-500' },
  { id: 'nf_pendente', title: 'NF Pendente', color: 'bg-rose-500' },
  { id: 'pagamento_aguardando', title: 'Aguard. Pagamento', color: 'bg-orange-500' },
  { id: 'concluido', title: 'Concluído', color: 'bg-emerald-500' },
];

export interface AnexoAdicional {
  id: string;
  nome: string;
  b64: string;
  tipo?: string;
  tamanho?: number;
  data: string;
}

export interface BoletoItem {
  numeroParcela: number;
  vencimento: string;
  valor: number;
  status: 'pago' | 'pendente' | 'atrasado';
  linhaDigitavel?: string;
}

export interface UserSession {
  id: string;
  email: string;
  name: string;
  companyName?: string;
  role: 'admin' | 'consultor';
  createdAt: string;
  plan?: 'promocional_ano1' | 'mensal_regular' | 'anual';
  priceMonthly?: number; // 49.90
  regularPriceMonthly?: number; // 99.90
  termsAccepted?: boolean;
  termsAcceptedAt?: string;
  subscriptionStatus?: 'ativo' | 'pendente_pagamento' | 'suspenso';
  boletosEmitidos?: BoletoItem[];
}

export interface CompanyConfig {
  logoUrl: string | null;
  companyName: string;
  primaryColor: string;
  adminEmail: string;
  pdfKeywords?: string[];
  pdfCustomRules?: string;
  
  // Servidor SMTP do Domínio Próprio
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpSenderName?: string;
  smtpUseSSL?: boolean;

  // Notificações do Telegram Bot
  telegramBotToken?: string;
  telegramChatId?: string;
  telegramEnabled?: boolean;

  // Integração Autentique
  autentiqueToken?: string;
  autentiqueSandbox?: boolean;

  // Link de Agendamento (Google Calendar / Calendly / etc) & WhatsApp Template
  calendarLink?: string;
  whatsappTemplate?: string;

  // Servidor IMAP (Entrada e Captura de E-mails / Demandas)
  imapHost?: string;
  imapPort?: number;
  imapUser?: string;
  imapPass?: string;
  imapUseSSL?: boolean;

  // Certificado Digital A1 (.pfx / .p12) para Assinatura Automática do Consultor
  certificateA1?: {
    fileName: string;
    pfxBase64: string;
    password?: string;
    titular: string;
    documento: string;
    tipoDocumento: 'CPF' | 'CNPJ' | 'OUTRO';
    emissor: string;
    validadeInicio: string;
    validadeFim: string;
    isValido: boolean;
    diasRestantes: number;
    serialNumber: string;
    ativo: boolean;
    dataUpload: string;
  };
}

