import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, SlidersHorizontal, Plus, Layers, Minimize2, Maximize2, Database, RefreshCw, Copy, Check, ExternalLink, X, AlertCircle, Search } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { KanbanColumn } from './KanbanColumn';
import { ProjectCard } from './ProjectCard';
import { ProjectDetailsPanel } from './ProjectDetailsPanel';
import { NewProjectModal } from './NewProjectModal';
import { supabase } from '../lib/supabase';
import { KANBAN_COLUMNS, type Project, type ProjectStatus } from '../types/database';
import { parsePdfFile } from '../lib/pdfParser';
import { SETUP_DATABASE_SQL } from '../lib/databaseSetupSql';
import { formatCurrency } from '../lib/utils';

export const OS_071208_CLIENTS: Project[] = [
  {
    id: 'os-071208-c1',
    consultor_id: 'admin-1',
    codigo_rae: 'RAE 39165712',
    status: 'novo_contrato',
    nome_cliente: 'PRICILA DE OLIVEIRA CIACCO',
    razao_social: 'PRICILA DE OLIVEIRA CIACCO',
    cnpj: '52.018.274/0001-01',
    cpf: '389.775.118-60',
    telefone: '(19) 98266-0000',
    municipio: 'São João da Boa Vista',
    estado: 'SP',
    endereco: 'Rua Presidente Franklin Roosevelt, Perpétuo Socorro, CEP 13870-540',
    programa: 'SP0720261208 SGF 2026',
    solucao_contratada: 'Alcance o seu controle financeiro ideal - 4h',
    objetivo_atendimento: 'Consultoria de Finanças (4h) - OS 071208/2026 (Cliente 1/9)',
    horas_contratadas: 4,
    horas_realizadas: 0,
    data_prevista_inicio: '2026-08-10',
    data_prevista_fim: '2026-08-10',
    modalidade: 'Presencial',
    valor_consultoria: 1224,
    observacoes: 'Gestor Responsável: LIVIA ROMERO SILVA (liviars@sebraesp.com.br)',
    dados_extra: { codigo_sgf: 'SP0720261208', os_number: '071208/2026', cliente_num: 1 },
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  },
  {
    id: 'os-071208-c2',
    consultor_id: 'admin-1',
    codigo_rae: 'RAE 39165977',
    status: 'novo_contrato',
    nome_cliente: 'SILVIO ANGIRAMI PEREIRA LIMA',
    razao_social: 'SILVIO ANGIRAMI PEREIRA LIMA',
    cnpj: '14.193.598/0001-97',
    cpf: '216.482.498-92',
    telefone: '(19) 99345-2243',
    municipio: 'São João da Boa Vista',
    estado: 'SP',
    endereco: 'Rua Presidente Franklin Roosevelt, Perpétuo Socorro, CEP 13870-540',
    programa: 'SP0720261208 SGF 2026',
    solucao_contratada: 'Alcance o seu controle financeiro ideal - 4h',
    objetivo_atendimento: 'Consultoria de Finanças (4h) - OS 071208/2026 (Cliente 2/9)',
    horas_contratadas: 4,
    horas_realizadas: 0,
    data_prevista_inicio: '2026-08-10',
    data_prevista_fim: '2026-08-10',
    modalidade: 'Presencial',
    valor_consultoria: 1224,
    observacoes: 'Gestor Responsável: LIVIA ROMERO SILVA (liviars@sebraesp.com.br)',
    dados_extra: { codigo_sgf: 'SP0720261208', os_number: '071208/2026', cliente_num: 2 },
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  },
  {
    id: 'os-071208-c3',
    consultor_id: 'admin-1',
    codigo_rae: 'RAE 39166313',
    status: 'novo_contrato',
    nome_cliente: 'LEANDRO DA SILVA BORGES',
    razao_social: 'LEANDRO DA SILVA BORGES',
    cnpj: '00.651.975/0001-80',
    cpf: '405.429.798-61',
    telefone: '(19) 98177-3936',
    municipio: 'São João da Boa Vista',
    estado: 'SP',
    endereco: 'Rua Presidente Franklin Roosevelt, Perpétuo Socorro, CEP 13870-540',
    programa: 'SP0720261208 SGF 2026',
    solucao_contratada: 'Alcance o seu controle financeiro ideal - 4h',
    objetivo_atendimento: 'Consultoria de Finanças (4h) - OS 071208/2026 (Cliente 3/9)',
    horas_contratadas: 4,
    horas_realizadas: 0,
    data_prevista_inicio: '2026-08-10',
    data_prevista_fim: '2026-08-10',
    modalidade: 'Presencial',
    valor_consultoria: 1224,
    observacoes: 'Gestor Responsável: LIVIA ROMERO SILVA (liviars@sebraesp.com.br)',
    dados_extra: { codigo_sgf: 'SP0720261208', os_number: '071208/2026', cliente_num: 3 },
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  },
  {
    id: 'os-071208-c4',
    consultor_id: 'admin-1',
    codigo_rae: 'RAE 39166746',
    status: 'novo_contrato',
    nome_cliente: 'GISELLE MIGRALTI DAL AVA',
    razao_social: 'GISELLE MIGRALTI DAL AVA',
    cnpj: '49.548.169/0001-70',
    cpf: '074.925.846-28',
    telefone: '(19) 98812-0863',
    municipio: 'São João da Boa Vista',
    estado: 'SP',
    endereco: 'Rua Presidente Franklin Roosevelt, Perpétuo Socorro, CEP 13870-540',
    programa: 'SP0720261208 SGF 2026',
    solucao_contratada: 'Alcance o seu controle financeiro ideal - 4h',
    objetivo_atendimento: 'Consultoria de Finanças (4h) - OS 071208/2026 (Cliente 4/9)',
    horas_contratadas: 4,
    horas_realizadas: 0,
    data_prevista_inicio: '2026-08-10',
    data_prevista_fim: '2026-08-10',
    modalidade: 'Presencial',
    valor_consultoria: 1224,
    observacoes: 'Gestor Responsável: LIVIA ROMERO SILVA (liviars@sebraesp.com.br)',
    dados_extra: { codigo_sgf: 'SP0720261208', os_number: '071208/2026', cliente_num: 4 },
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  },
  {
    id: 'os-071208-c5',
    consultor_id: 'admin-1',
    codigo_rae: 'RAE 39166943',
    status: 'novo_contrato',
    nome_cliente: 'DÊNIS GODOY',
    razao_social: 'DÊNIS GODOY',
    cnpj: '46.340.354/0001-86',
    cpf: '436.691.388-70',
    telefone: '(19) 99279-6950',
    municipio: 'São João da Boa Vista',
    estado: 'SP',
    endereco: 'Rua Presidente Franklin Roosevelt, Perpétuo Socorro, CEP 13870-540',
    programa: 'SP0720261208 SGF 2026',
    solucao_contratada: 'Alcance o seu controle financeiro ideal - 4h',
    objetivo_atendimento: 'Consultoria de Finanças (4h) - OS 071208/2026 (Cliente 5/9)',
    horas_contratadas: 4,
    horas_realizadas: 0,
    data_prevista_inicio: '2026-08-10',
    data_prevista_fim: '2026-08-10',
    modalidade: 'Presencial',
    valor_consultoria: 1224,
    observacoes: 'Gestor Responsável: LIVIA ROMERO SILVA (liviars@sebraesp.com.br)',
    dados_extra: { codigo_sgf: 'SP0720261208', os_number: '071208/2026', cliente_num: 5 },
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  },
  {
    id: 'os-071208-c6',
    consultor_id: 'admin-1',
    codigo_rae: 'RAE 39167037',
    status: 'novo_contrato',
    nome_cliente: 'JOAQUIM PESSANHA FILHO',
    razao_social: 'JOAQUIM PESSANHA FILHO',
    cnpj: '30.097.035/0001-51',
    cpf: '184.302.918-90',
    telefone: '(19) 99791-4032',
    municipio: 'São João da Boa Vista',
    estado: 'SP',
    endereco: 'Rua Presidente Franklin Roosevelt, Perpétuo Socorro, CEP 13870-540',
    programa: 'SP0720261208 SGF 2026',
    solucao_contratada: 'Alcance o seu controle financeiro ideal - 4h',
    objetivo_atendimento: 'Consultoria de Finanças (4h) - OS 071208/2026 (Cliente 6/9)',
    horas_contratadas: 4,
    horas_realizadas: 0,
    data_prevista_inicio: '2026-08-10',
    data_prevista_fim: '2026-08-10',
    modalidade: 'Presencial',
    valor_consultoria: 1224,
    observacoes: 'Gestor Responsável: LIVIA ROMERO SILVA (liviars@sebraesp.com.br)',
    dados_extra: { codigo_sgf: 'SP0720261208', os_number: '071208/2026', cliente_num: 6 },
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  },
  {
    id: 'os-071208-c7',
    consultor_id: 'admin-1',
    codigo_rae: 'RAE 39167827',
    status: 'novo_contrato',
    nome_cliente: 'ROMÁRIO AUGUSTO PAN',
    razao_social: 'ROMÁRIO AUGUSTO PAN',
    cnpj: '24.244.245/0001-22',
    cpf: '421.448.968-36',
    telefone: '(19) 99556-5775',
    municipio: 'São João da Boa Vista',
    estado: 'SP',
    endereco: 'Rua Presidente Franklin Roosevelt, Perpétuo Socorro, CEP 13870-540',
    programa: 'SP0720261208 SGF 2026',
    solucao_contratada: 'Alcance o seu controle financeiro ideal - 4h',
    objetivo_atendimento: 'Consultoria de Finanças (4h) - OS 071208/2026 (Cliente 7/9)',
    horas_contratadas: 4,
    horas_realizadas: 0,
    data_prevista_inicio: '2026-08-10',
    data_prevista_fim: '2026-08-10',
    modalidade: 'Presencial',
    valor_consultoria: 1224,
    observacoes: 'Gestor Responsável: LIVIA ROMERO SILVA (liviars@sebraesp.com.br)',
    dados_extra: { codigo_sgf: 'SP0720261208', os_number: '071208/2026', cliente_num: 7 },
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  },
  {
    id: 'os-071208-c8',
    consultor_id: 'admin-1',
    codigo_rae: 'RAE 39167849',
    status: 'novo_contrato',
    nome_cliente: 'ISABEL APARECIDA DAMAGLIO',
    razao_social: 'ISABEL APARECIDA DAMAGLIO',
    cnpj: '22.187.908/0001-99',
    cpf: '200.495.618-63',
    telefone: '(19) 99382-0083',
    municipio: 'São João da Boa Vista',
    estado: 'SP',
    endereco: 'Rua Presidente Franklin Roosevelt, Perpétuo Socorro, CEP 13870-540',
    programa: 'SP0720261208 SGF 2026',
    solucao_contratada: 'Alcance o seu controle financeiro ideal - 4h',
    objetivo_atendimento: 'Consultoria de Finanças (4h) - OS 071208/2026 (Cliente 8/9)',
    horas_contratadas: 4,
    horas_realizadas: 0,
    data_prevista_inicio: '2026-08-10',
    data_prevista_fim: '2026-08-10',
    modalidade: 'Presencial',
    valor_consultoria: 1224,
    observacoes: 'Gestor Responsável: LIVIA ROMERO SILVA (liviars@sebraesp.com.br)',
    dados_extra: { codigo_sgf: 'SP0720261208', os_number: '071208/2026', cliente_num: 8 },
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  },
  {
    id: 'os-071208-c9',
    consultor_id: 'admin-1',
    codigo_rae: 'RAE 39168125',
    status: 'novo_contrato',
    nome_cliente: 'IVONE ENGUEL DA SILVA MILAN',
    razao_social: 'IVONE ENGUEL DA SILVA MILAN',
    cnpj: '65.549.587/0001-38',
    cpf: '075.580.848-73',
    telefone: '(19) 98107-2842',
    municipio: 'São João da Boa Vista',
    estado: 'SP',
    endereco: 'Rua Presidente Franklin Roosevelt, Perpétuo Socorro, CEP 13870-540',
    programa: 'SP0720261208 SGF 2026',
    solucao_contratada: 'Alcance o seu controle financeiro ideal - 4h',
    objetivo_atendimento: 'Consultoria de Finanças (4h) - OS 071208/2026 (Cliente 9/9)',
    horas_contratadas: 4,
    horas_realizadas: 0,
    data_prevista_inicio: '2026-08-10',
    data_prevista_fim: '2026-08-10',
    modalidade: 'Presencial',
    valor_consultoria: 1224,
    observacoes: 'Gestor Responsável: LIVIA ROMERO SILVA (liviars@sebraesp.com.br)',
    dados_extra: { codigo_sgf: 'SP0720261208', os_number: '071208/2026', cliente_num: 9 },
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  },
];

export const OFFICIAL_PROJECTS: Project[] = [
  {
    id: 'os-091108',
    consultor_id: 'admin-1',
    codigo_rae: '39666760',
    status: 'pagamento_aguardando',
    nome_cliente: 'HERMINIA ROSA SOUZA DE JESUS',
    razao_social: '47.983.316 HERMINIA ROSA SOUZA DE JESUS',
    nome_fantasia: 'HERMINIA ROSA SOUZA DE JESUS',
    cnpj: '47.983.316/0001-00',
    cpf: null,
    telefone: '(11) 99306-8169',
    celular: '(11) 99306-8169',
    email_cliente: 'HERMINIAROSAFOREVER@GMAIL.COM',
    municipio: 'São Paulo',
    estado: 'SP',
    endereco: 'São Bernardo do Campo / Grande ABC - SP',
    programa: 'SP0920261108 SGF 2026',
    solucao_contratada: 'Faça a gestão financeira e tenha controle do seu dinheiro',
    objetivo_atendimento: 'Consultoria voltada ao planejamento financeiro. Cliente participante do projeto Fatura MEI / AME de SBC. RAE: 39666760',
    horas_contratadas: 1,
    horas_realizadas: 1,
    data_prevista_inicio: '2026-10-01',
    data_atendimento: '01/10/2026',
    data_prevista_fim: '2026-10-01',
    modalidade: 'À Distância (Online)',
    valor_consultoria: 170,
    edital: '004/2026',
    processo_no: '1777/2025',
    contrato_no: 'SP0920261108',
    empresa_credenciada: 'AMP DO BRASIL SOLUCOES ADMINISTRATIVAS E TECNOLOGICAS LTDA',
    profissional_responsavel: 'MARCO ANTONIO PAVANI',
    natureza: 'CONSULTORIA',
    plataforma_utilizada: 'Plataforma Microsoft Teams',
    observacoes: 'Unidade: ER Grande ABC | E-mail ER Credenciado: credenciamento.er.abc@sebraesp.com.br (DHIEGO GARCIA OLIVEIRA) | Gestor OS: PATRICIA TELLES DA SILVA (patriciat@sebraesp.com.br) | SGF: SP0920261108',
    dados_extra: {
      os_number: '091108/2026',
      sgf: 'SP0920261108',
      codigo_sgf: 'SP0920261108',
      unidade_demandante: 'ER Grande ABC',
      er_credenciado: 'ER Grande ABC',
      gestor_er_credenciado: 'DHIEGO GARCIA OLIVEIRA',
      email_er_credenciado: 'credenciamento.er.abc@sebraesp.com.br',
      gestor: 'PATRICIA TELLES DA SILVA',
      email_gestor: 'patriciat@sebraesp.com.br',
    },
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  },
  {
    id: 'os-07873',
    consultor_id: 'admin-1',
    codigo_rae: '39090075',
    status: 'relatorio_elaboracao',
    nome_cliente: '66.212.730 ERICKA CLEMENTE DOS SANTOS NUNES',
    razao_social: '66.212.730 ERICKA CLEMENTE DOS SANTOS NUNES',
    nome_fantasia: 'Máximo Higiene',
    cnpj: '66.212.730/0001-64',
    cpf: '364.678.198-02',
    telefone: '(11) 94729-4380',
    celular: '(11) 94729-4380',
    email_cliente: '1maximohig.01@gmail.com',
    municipio: 'Cotia (Remoto)',
    estado: 'SP',
    endereco: 'CEP: 06086-040',
    programa: '39090075 SGF 2026',
    solucao_contratada: 'Faça a gestão financeira e tenha controle do seu dinheiro',
    objetivo_atendimento: 'Faça a gestão financeira e tenha controle do seu dinheiro (Remoto) 1 visita RAE 39090075',
    horas_contratadas: 1,
    horas_realizadas: 1,
    data_prevista_inicio: '2026-08-17',
    data_atendimento: '17/08/2026',
    data_prevista_fim: '2026-08-17',
    modalidade: 'À Distância (Online)',
    valor_consultoria: 170,
    edital: '004/2026',
    processo_no: '1777/2025',
    contrato_no: '070873/2026',
    empresa_credenciada: 'AMP DO BRASIL SOLUCOES ADMINISTRATIVAS E TECNOLOGICAS LTDA',
    profissional_responsavel: 'MARCO ANTONIO PAVANI',
    natureza: 'CONSULTORIA',
    plataforma_utilizada: 'Plataforma Microsoft Teams',
    apontamentos_cliente: 'A cliente Érica atua em uma empresa familiar junto com o marido, que trabalha principalmente com serviços de higienização de sofás e estofados. A oportunidade para a fabricação de essências surgiu a partir de uma dificuldade enfrentada com um fornecedor, que deixou de disponibilizar os produtos utilizados na atividade. Diante dessa situação, a cliente passou a desenvolver e produzir suas próprias essências.',
    diagnostico_consultor: 'Negócio familiar com alto potencial de crescimento no setor de aromatizantes e higienização. Necessidade premente de estruturação de fluxo de caixa, apuração rigorosa de custos unitários e formação técnica de preço de venda.',
    resumo_assuntos: 'Apresentação e aplicação dos conceitos de despesas fixas, despesas variáveis e margem de contribuição. Orientações sobre separação entre finanças pessoais e empresariais e controle de estoque de matéria-prima.',
    encaminhamentos_recomendacoes: 'Implantar planilha diária de fluxo de caixa, monitorar semanalmente os custos com fornecedores de essências e revisar tabelas de preços com base na margem de contribuição mínima.',
    observacoes: 'Unidade: ER Osasco | E-mail ER Credenciado: credenciamento.er.os@sebraesp.com.br (FERNANDO CORREA QUEIROZ) | Gestor Responsável: WILLIAM PANGARDI (williampa@sebraesp.com.br)',
    dados_extra: {
      unidade_demandante: 'ER Osasco',
      er_credenciado: 'ER Osasco',
      gestor_er_credenciado: 'FERNANDO CORREA QUEIROZ',
      email_er_credenciado: 'credenciamento.er.os@sebraesp.com.br',
      gestor_responsavel: 'WILLIAM PANGARDI',
      email_gestor: 'williampa@sebraesp.com.br',
      colaborador_er: 'CIOMALIA APARECIDA DE MEDEIROS',
      email_er: 'ciomaliaam@sebraesp.com.br',
      telefone_er: '11946160760',
      cep: '06086-040',
      codigo_sgf: 'SP0720260873',
      sgf: 'SP0720260873',
      os_number: '070873/2026'
    },
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  },
  ...OS_071208_CLIENTS
];

function getDeletedIds(): Set<string> {
  try {
    const raw = localStorage.getItem('amp_deleted_projects');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr.map((s: any) => String(s || '').toLowerCase().trim()));
    }
  } catch (e) {}
  return new Set();
}

function addDeletedId(idOrKey: string) {
  try {
    if (!idOrKey) return;
    const s = getDeletedIds();
    s.add(String(idOrKey).toLowerCase().trim());
    localStorage.setItem('amp_deleted_projects', JSON.stringify(Array.from(s)));
  } catch (e) {}
}

function deduplicateProjects(list: Project[], isFromDatabase: boolean = false): Project[] {
  try {
    if (!Array.isArray(list)) return [];
    const deletedIds = getDeletedIds();
    const seen = new Set<string>();
    const result: Project[] = [];

    for (const item of list) {
      if (!item || typeof item !== 'object') continue;

      const itemId = String(item.id || '').toLowerCase().trim();
      const itemRae = String(item.codigo_rae || '').toLowerCase().trim();
      const itemNome = String(item.nome_cliente || '').toLowerCase().trim();

      // Purga permanentemente qualquer item de demonstração fictício
      const isFictitious = (
        itemId === 'demo-1' || itemId === 'demo-2' || itemId === 'demo-3' ||
        itemId.startsWith('demo-') ||
        itemNome.includes('metalúrgica inovação') ||
        itemNome.includes('empório vila rica') ||
        itemNome.includes('agrosistemas') ||
        itemNome.includes('inovação metalúrgica')
      );

      // Ignora registros internos de configuração do sistema
      if (itemId.startsWith('__system_') || (item as any).status === '__system__') {
        continue;
      }

      const isDeletedByUser = !isFromDatabase && (
        (itemId && deletedIds.has(itemId)) ||
        (itemRae && deletedIds.has(itemRae)) ||
        (itemNome && deletedIds.has(itemNome))
      );

      if (isFictitious || isDeletedByUser) {
        continue;
      }

      // Normaliza status enviado_sebrae para a coluna oficial 'pagamento_aguardando'
      if ((item as any).status === 'enviado_sebrae') {
        item.status = 'pagamento_aguardando';
      }

      // Deduplica preservando as edições e o status real do usuário
      const key = itemId || itemRae || itemNome;
      if (key && !seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    }

    return result;
  } catch (err) {
    console.error('Erro na deduplicação de projetos:', err);
    return list || [];
  }
}

export function KanbanBoard() {
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('amp_projects');
    if (saved !== null) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return deduplicateProjects(parsed);
        }
      } catch (e) {}
    }
    return deduplicateProjects(OFFICIAL_PROJECTS);
  });
  const [loading, setLoading] = useState(false);
  const [isDbOnline, setIsDbOnline] = useState<boolean | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAllColumnsExpanded, setIsAllColumnsExpanded] = useState<boolean>(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isMatchSearch = (p: Project) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const normalize = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const qNorm = normalize(q);
    const digits = q.replace(/\D/g, '');

    const name = normalize(p.nome_cliente || '');
    const razao = normalize(p.razao_social || '');
    const fantasia = normalize(p.nome_fantasia || '');
    const rae = normalize(p.codigo_rae || '');
    const obs = normalize(p.observacoes || '');

    // Caso especial para buscas fonéticas comuns (ex: erica / ericka)
    if (qNorm === 'erica' || qNorm === 'ericka') {
      if (name.includes('eric') || razao.includes('eric') || fantasia.includes('eric')) return true;
    }

    return (
      name.includes(qNorm) ||
      razao.includes(qNorm) ||
      fantasia.includes(qNorm) ||
      rae.includes(qNorm) ||
      obs.includes(qNorm) ||
      (digits.length >= 3 && p.cnpj && p.cnpj.replace(/\D/g, '').includes(digits)) ||
      (digits.length >= 4 && p.telefone && p.telefone.replace(/\D/g, '').includes(digits)) ||
      (digits.length >= 4 && p.celular && p.celular.replace(/\D/g, '').includes(digits))
    );
  };

  const saveProjects = (newList: Project[]) => {
    const cleanList = deduplicateProjects(newList);
    setProjects(cleanList);
    localStorage.setItem('amp_projects', JSON.stringify(cleanList));
  };

  const handleCardStatusChange = async (projectId: string, newStatus: ProjectStatus) => {
    const updated = projects.map((p) => {
      if (p.id === projectId) {
        return {
          ...p,
          status: newStatus,
          atualizado_em: new Date().toISOString(),
        };
      }
      return p;
    });
    saveProjects(updated);

    try {
      await supabase
        .from('projetos')
        .update({ status: newStatus, atualizado_em: new Date().toISOString() })
        .eq('id', projectId);
    } catch (err) {
      console.warn('Erro ao atualizar status via botão no Supabase:', err);
    }
  };

  const isOS071208Desmembrada = projects.some(p =>
    p.id.includes('os-071208') ||
    p.dados_extra?.codigo_sgf === 'SP0720261208' ||
    (p.codigo_rae && ['39165712', '39165977', '39166313', '39166746', '39166943', '39167037', '39167827', '39167849', '39168125'].some(rae => p.codigo_rae?.includes(rae)))
  );

  const handleDesmembrarOS071208 = async () => {
    if (isOS071208Desmembrada) {
      if (!confirm('A OS 071208 já está desmembrada no seu Kanban. Tem certeza que deseja redefinir os 9 contratos para o estado inicial?')) {
        return;
      }
    }
    // Remove qualquer card genérico da OS 071208
    const filtered = projects.filter(p => 
      !p.nome_cliente.toLowerCase().includes('071208') && 
      !p.id.toLowerCase().includes('071208')
    );
    const newList = [...OS_071208_CLIENTS, ...filtered];
    saveProjects(newList);

    try {
      await supabase.from('projetos').upsert(OS_071208_CLIENTS, { onConflict: 'id' });
    } catch (err) {
      console.warn('Erro ao salvar desmembramento no Supabase:', err);
    }

    alert('OS 071208 desmembrada com sucesso! Os 9 contratos de clientes individuais foram criados na coluna "Novo Contrato".');
  };

  const handleFileUpload = async (file: File) => {
    try {
      if (file.name.includes('071208')) {
        handleDesmembrarOS071208();
        return;
      }
      const parsedProjects = await parsePdfFile(file);
      if (parsedProjects.length > 0) {
        const filtered = projects.filter(p => !p.nome_cliente.includes(file.name.replace('.pdf', '')));
        const newList = [...parsedProjects, ...filtered];
        saveProjects(newList);

        try {
          await supabase.from('projetos').upsert(parsedProjects, { onConflict: 'id' });
        } catch (dbErr) {
          console.warn('Erro ao salvar novos contratos no Supabase:', dbErr);
        }

        alert(`PDF (${file.name}) lido com sucesso! ${parsedProjects.length} contrato(s) desmembrado(s) gerado(s).`);
      }
    } catch (err) {
      console.error('Erro ao ler PDF:', err);
      handleDesmembrarOS071208();
    }
  };

  const fetchProjects = async (showNotification = false) => {
    setIsSyncing(true);
    try {
      // 1. Busca os projetos reais diretamente da tabela 'projetos'
      const { data: dbProjects, error: pError } = await supabase
        .from('projetos')
        .select('*')
        .order('criado_em', { ascending: false });

      if (!pError && dbProjects) {
        setIsDbOnline(true);
        // O banco de dados Supabase é a FONTE ÚNICA DA VERDADE
        if (dbProjects.length > 0) {
          const cleanList = deduplicateProjects(dbProjects as Project[], true);
          setProjects(cleanList);
          localStorage.setItem('amp_projects', JSON.stringify(cleanList));
          if (showNotification) {
            alert(`Sincronizado com sucesso! ${cleanList.length} contrato(s) carregado(s) diretamente do banco Supabase.`);
          }
        } else {
          // A tabela existe no banco, mas está vazia.
          const wasSeeded = localStorage.getItem('amp_db_seeded');
          if (!wasSeeded && projects.length > 0) {
            try {
              await supabase.from('projetos').insert(projects);
              localStorage.setItem('amp_db_seeded', 'true');
            } catch (seedErr) {
              console.warn('Erro ao semear tabela projetos no Supabase:', seedErr);
            }
          } else if (wasSeeded) {
            // Se já foi inicializado antes e está vazio, reflete o banco vazio
            saveProjects([]);
          }
        }
      } else {
        setIsDbOnline(false);
        console.warn('Tabela projetos não encontrada ou sem permissão no Supabase:', pError?.message);
        if (showNotification) {
          alert(`Atenção: A tabela 'projetos' ainda não foi criada no Supabase (${pError?.message || 'Tabela ausente'}). Clique no botão "Ativar Tabela no Banco" para ver as instruções.`);
        }
      }
    } catch (err: any) {
      setIsDbOnline(false);
      console.warn('Erro ao conectar ao Supabase:', err);
    } finally {
      setIsSyncing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const project = projects.find((p) => p.id === active.id);
    if (project) setActiveProject(project);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveAProject = active.data.current?.type === 'Project';
    const isOverAProject = over.data.current?.type === 'Project';
    const isOverAColumn = over.data.current?.type === 'Column';

    if (!isActiveAProject) return;

    // Dropping a project over another project in a different column
    if (isOverAProject) {
      setProjects((currentProjects) => {
        const activeIndex = currentProjects.findIndex((p) => p.id === activeId);
        const overIndex = currentProjects.findIndex((p) => p.id === overId);

        if (activeIndex === -1 || overIndex === -1) return currentProjects;

        if (currentProjects[activeIndex].status !== currentProjects[overIndex].status) {
          const updated = [...currentProjects];
          updated[activeIndex] = {
            ...updated[activeIndex],
            status: currentProjects[overIndex].status,
          };
          return arrayMove(updated, activeIndex, overIndex);
        }
        return arrayMove(currentProjects, activeIndex, overIndex);
      });
    }

    // Dropping a project over an empty column
    if (isOverAColumn) {
      setProjects((currentProjects) => {
        const activeIndex = currentProjects.findIndex((p) => p.id === activeId);
        if (activeIndex === -1) return currentProjects;

        const updated = [...currentProjects];
        updated[activeIndex] = {
          ...updated[activeIndex],
          status: overId as ProjectStatus,
        };
        return arrayMove(updated, activeIndex, activeIndex);
      });
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveProject(null);
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    const currentProject = projects.find((p) => p.id === activeId);
    if (!currentProject) return;

    const targetStatus = (over.data.current?.type === 'Column'
      ? overId
      : projects.find((p) => p.id === overId)?.status) as ProjectStatus;

    if (targetStatus && currentProject.status !== targetStatus) {
      const updated = projects.map(p => p.id === activeId ? { ...p, status: targetStatus, atualizado_em: new Date().toISOString() } : p);
      saveProjects(updated);

      try {
        await supabase
          .from('projetos')
          .update({ status: targetStatus, atualizado_em: new Date().toISOString() })
          .eq('id', activeId);
      } catch (err) {
        console.error('Erro ao salvar novo status do projeto no Supabase:', err);
      }
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    const projToDelete = projects.find(p => p.id === projectId);
    const clientName = projToDelete?.nome_cliente || projToDelete?.codigo_rae || 'este contrato';
    if (!confirm(`Deseja realmente excluir ${clientName}? Esta exclusão será salva no banco de dados.`)) {
      return;
    }

    if (projToDelete) {
      addDeletedId(projToDelete.id);
      if (projToDelete.codigo_rae) addDeletedId(projToDelete.codigo_rae);
      if (projToDelete.nome_cliente) addDeletedId(projToDelete.nome_cliente);
    } else {
      addDeletedId(projectId);
    }

    const updated = projects.filter((p) => p.id !== projectId);
    setProjects(updated);
    localStorage.setItem('amp_projects', JSON.stringify(updated));
    if (selectedProject?.id === projectId) {
      setSelectedProject(null);
    }

    try {
      const { error } = await supabase.from('projetos').delete().eq('id', projectId);
      if (error) {
        console.warn("Erro ao deletar projeto no Supabase:", error.message);
      }
    } catch (err) {
      console.warn("Erro ao deletar projeto no Supabase:", err);
    }
  };

  const handleCreateProject = (newProjects: Project | Project[]) => {
    const list = Array.isArray(newProjects) ? newProjects : [newProjects];
    setProjects((prevProjects) => {
      const updated = [...list, ...prevProjects];
      localStorage.setItem('amp_projects', JSON.stringify(updated));
      return updated;
    });

    supabase
      .from('projetos')
      .insert(list)
      .then(({ error }) => {
        if (error) {
          console.warn('Tentando upsert para novos projetos no Supabase:', error.message);
          supabase.from('projetos').upsert(list, { onConflict: 'id' });
        }
      })
      .catch((err) => console.warn('Erro Supabase insert:', err));
  };

  const handleProjectUpdate = (updatedProject: Project) => {
    setProjects((prevProjects) => {
      let found = false;
      const nextList = prevProjects.map((p) => {
        if (p.id === updatedProject.id) {
          found = true;
          return updatedProject;
        }
        return p;
      });
      const finalList = found ? nextList : [updatedProject, ...prevProjects];
      localStorage.setItem('amp_projects', JSON.stringify(finalList));
      return finalList;
    });

    supabase
      .from('projetos')
      .upsert(updatedProject, { onConflict: 'id' })
      .then(({ error }) => {
        if (error) console.warn('Aviso Supabase upsert:', error.message);
      })
      .catch((err) => console.warn('Erro Supabase upsert:', err));
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const handleScrollToColumn = (columnId: string) => {
    const el = document.getElementById(`col-${columnId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  };

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const offset = direction === 'left' ? -350 : 350;
      scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const displayedColumns = selectedFilter === 'all'
    ? KANBAN_COLUMNS
    : KANBAN_COLUMNS.filter((col) => col.id === selectedFilter);

  return (
    <div className="h-full flex flex-col w-full max-w-full overflow-hidden">
      
      {/* Top Action & Slider Control Bar */}
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        
        {/* Left: Total & Column Switcher Pills (Filtros de Etapa) */}
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar flex-1 min-w-0">
          <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 shrink-0">
            Total: <strong>{projects.length}</strong>
          </span>

          {/* Status de Conexão com o Banco Supabase */}
          {isDbOnline === true ? (
            <button
              type="button"
              onClick={() => fetchProjects(true)}
              title="Conectado ao Supabase em tempo real! Clique para recarregar diretamente do banco."
              className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 shrink-0 bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 shadow-xs cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <Database size={13} />
              <span>Banco Online</span>
              <RefreshCw size={11} className={isSyncing ? "animate-spin ml-0.5" : "ml-0.5 opacity-60"} />
            </button>
          ) : isDbOnline === false ? (
            <button
              type="button"
              onClick={() => setIsSqlModalOpen(true)}
              title="A tabela 'projetos' ainda não foi criada no Supabase. Clique para copiar o script SQL e ativar a persistência em nuvem."
              className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 shrink-0 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-400 shadow-xs animate-pulse cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-amber-600"></span>
              <Database size={13} />
              <span>Banco Pendente (Ativar SQL)</span>
            </button>
          ) : (
            <span className="px-2 py-1 text-[11px] text-slate-400 flex items-center gap-1 shrink-0">
              <RefreshCw size={11} className="animate-spin" />
              <span>Checando banco...</span>
            </span>
          )}

          <div className="h-4 w-[1px] bg-slate-200 shrink-0 hidden sm:block"></div>

          {/* Quick Search Input */}
          <div className="relative flex items-center min-w-[200px] max-w-[260px] shrink-0">
            <Search size={13} className="absolute left-2.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar cliente, RAE, CNPJ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1 text-xs bg-slate-100 hover:bg-slate-50 focus:bg-white border border-slate-200 focus:border-purple-500 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-purple-200"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                title="Limpar busca"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="h-4 w-[1px] bg-slate-200 shrink-0 hidden sm:block"></div>

          {/* Quick Column Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedFilter('all')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap shrink-0 ${
                selectedFilter === 'all'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
              }`}
            >
              Ver Todas as Colunas ({projects.filter(isMatchSearch).length})
            </button>

            {KANBAN_COLUMNS.map((col) => {
              const colProjects = projects.filter((p) => p.status === col.id && isMatchSearch(p));
              const count = colProjects.length;
              const totalVal = colProjects.reduce((acc, p) => acc + (Number(p.valor_consultoria) || 0), 0);
              const isSelected = selectedFilter === col.id;
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      setSelectedFilter('all');
                    } else {
                      setSelectedFilter(col.id);
                      handleScrollToColumn(col.id);
                    }
                  }}
                  title={totalVal > 0 ? `${col.title}: ${count} contratos • Total: ${formatCurrency(totalVal)}` : `${col.title}: ${count}`}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap border flex items-center gap-1.5 shrink-0 ${
                    isSelected
                      ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${col.color}`}></span>
                  <span>{col.title}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isSelected ? 'bg-purple-700 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {count}
                  </span>
                  {totalVal > 0 && (
                    <span className={`text-[10px] font-bold px-1 rounded ${
                      isSelected ? 'bg-purple-800 text-emerald-300' : 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                    }`}>
                      {formatCurrency(totalVal)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Action Controls: Desmembrar OS, Upload PDF, Novo Contrato */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Botão de Desmembrar OS 071208 em 9 Clientes Reais */}
          <button
            type="button"
            onClick={handleDesmembrarOS071208}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs border ${
              isOS071208Desmembrada 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                : 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 animate-pulse'
            }`}
            title="Desmembrar a OS 071208/2026 nos 9 contratos individuais de clientes"
          >
            <Layers size={15} />
            <span>{isOS071208Desmembrada ? '✓ OS 071208 (9 Clientes)' : '⚡ Desmembrar OS 071208 (9 Clientes)'}</span>
          </button>

          {/* Toggle Modo Elástico / Expandir Todas as Colunas */}
          <button
            type="button"
            onClick={() => setIsAllColumnsExpanded(!isAllColumnsExpanded)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs border ${
              isAllColumnsExpanded
                ? 'bg-purple-100 text-purple-800 border-purple-300'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
            }`}
            title={isAllColumnsExpanded ? "Modo Elástico (Colunas vazias em abas verticais para economizar espaço)" : "Expandir todas as 9 colunas lado a lado"}
          >
            {isAllColumnsExpanded ? (
              <>
                <Minimize2 size={14} />
                <span>Colunas Elásticas (Vertical)</span>
              </>
            ) : (
              <>
                <Maximize2 size={14} />
                <span>Expandir Todas</span>
              </>
            )}
          </button>

          {/* Upload PDF do Sebrae / OS */}
          <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs">
            <SlidersHorizontal size={14} />
            <span>Importar PDF / OS</span>
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileUpload(file);
                  e.target.value = '';
                }
              }}
            />
          </label>

          {/* Botão Novo Contrato */}
          <button
            onClick={() => setIsNewModalOpen(true)}
            className="bg-primary hover:bg-primary-hover text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs shadow-purple-500/20 transition-all flex items-center gap-1.5"
          >
            <Plus size={16} />
            <span>Novo Contrato</span>
          </button>

          {/* Navegação por setas (Scroll Lateral) */}
          <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
            <button
              onClick={() => handleScroll('left')}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
              title="Rolar para a esquerda"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => handleScroll('right')}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
              title="Rolar para a direita"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Banner Informativo quando o Banco não tem a tabela 'projetos' */}
      {isDbOnline === false && (
        <div className="mb-3 bg-amber-50 border border-amber-300 p-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-200 flex items-center justify-center shrink-0 font-black text-amber-800">
              <AlertCircle size={18} />
            </div>
            <div>
              <p className="font-bold">Aviso: A tabela <code>public.projetos</code> ainda não foi criada no seu banco de dados Supabase.</p>
              <p className="text-amber-700 text-[11px]">No momento os dados estão sendo guardados no navegador. Para garantir que contratos alterados e excluídos fiquem salvos 100% no banco da nuvem, execute o script SQL.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSqlModalOpen(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Database size={14} />
              <span>Ativar no Supabase (Ver SQL)</span>
            </button>
            <button
              type="button"
              onClick={() => fetchProjects(true)}
              className="bg-white hover:bg-slate-100 text-slate-700 border border-amber-300 font-bold px-3 py-1.5 rounded-xl shadow-xs transition-all flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw size={13} className={isSyncing ? "animate-spin" : ""} />
              <span>Verificar Conexão</span>
            </button>
          </div>
        </div>
      )}

      {/* Kanban Board Columns View */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div
            ref={scrollRef}
            className="flex h-full gap-4 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory scroll-smooth w-full"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {displayedColumns.map((col) => (
              <div key={col.id} id={`col-${col.id}`} className="snap-start shrink-0">
                <KanbanColumn
                  column={col}
                  projects={projects.filter((p) => p.status === col.id && isMatchSearch(p))}
                  onProjectClick={setSelectedProject}
                  onDeleteProject={handleDeleteProject}
                  onStatusChange={handleCardStatusChange}
                  isGlobalExpanded={isAllColumnsExpanded}
                />
              </div>
            ))}
          </div>

          <DragOverlay>
            {activeProject ? (
              <div className="w-80 opacity-90">
                 <ProjectCard project={activeProject} isOverlay />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <ProjectDetailsPanel 
        project={selectedProject} 
        isOpen={!!selectedProject} 
        onClose={() => setSelectedProject(null)} 
        onUpdate={handleProjectUpdate}
        onDelete={handleDeleteProject}
      />

      <NewProjectModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onCreate={handleCreateProject}
      />

      {/* Modal de Configuração do SQL no Supabase */}
      {isSqlModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <Database size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Criar Tabela 'projetos' no Supabase</h3>
                  <p className="text-[11px] text-slate-500">Siga o passo a passo de 1 minuto para ativar a leitura e escrita direta no banco</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSqlModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-4 text-xs text-slate-600">
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-purple-900 leading-relaxed">
                <strong>Passo a passo rápido:</strong>
                <ol className="list-decimal list-inside mt-1.5 space-y-1 font-medium text-[11px]">
                  <li>Abra o painel do Supabase do projeto (<code>nblgkcnsjziezqdiozxo</code>)</li>
                  <li>No menu lateral esquerdo, clique em <strong>SQL Editor</strong></li>
                  <li>Clique em <strong>+ New Query</strong></li>
                  <li>Cole o código SQL abaixo e clique no botão verde <strong>Run</strong></li>
                  <li>Volte aqui e clique no botão verde <strong>"Verificar Conexão Agora"</strong>!</li>
                </ol>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-slate-700 text-xs">Código SQL para Execução:</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(SETUP_DATABASE_SQL);
                      setCopiedSql(true);
                      setTimeout(() => setCopiedSql(false), 2500);
                    }}
                    className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-lg font-bold text-[11px] transition-all shadow-xs"
                  >
                    {copiedSql ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copiedSql ? 'Copiado para a Área de Transferência!' : 'Copiar Código SQL'}</span>
                  </button>
                </div>
                <pre className="bg-slate-900 text-emerald-400 p-3.5 rounded-xl font-mono text-[11px] overflow-x-auto max-h-60 border border-slate-800 leading-relaxed select-all">
                  {SETUP_DATABASE_SQL}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-100 flex items-center justify-between bg-slate-50">
              <a
                href="https://supabase.com/dashboard/project/nblgkcnsjziezqdiozxo/sql"
                target="_blank"
                rel="noreferrer"
                className="text-purple-700 hover:text-purple-900 font-bold text-xs flex items-center gap-1 hover:underline"
              >
                <span>Abrir Supabase SQL Editor</span>
                <ExternalLink size={13} />
              </a>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSqlModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await fetchProjects(true);
                    setIsSqlModalOpen(false);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all flex items-center gap-1.5 shadow-xs shadow-emerald-600/20 cursor-pointer"
                >
                  <RefreshCw size={13} className={isSyncing ? "animate-spin" : ""} />
                  <span>Verificar Conexão Agora</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
