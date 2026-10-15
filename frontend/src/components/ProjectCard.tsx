import { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Building2, FileText, GripVertical, Phone, Clock, MessageSquare, Trash2, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { type Project, type ProjectStatus, KANBAN_COLUMNS } from '../types/database';
import { cn, maskPhone } from '../lib/utils';
import { WHATSAPP_TEMPLATES, buildWhatsAppMessage, openWhatsApp, type WhatsAppTemplateOption } from '../lib/whatsapp';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ProjectCardProps {
  project: Project;
  isOverlay?: boolean;
  onClick?: (project: Project) => void;
  onDelete?: (projectId: string) => void;
  onStatusChange?: (projectId: string, newStatus: ProjectStatus) => void;
}

export function ProjectCard({ project, isOverlay, onClick, onDelete, onStatusChange }: ProjectCardProps) {
  const [isWhatsappOpen, setIsWhatsappOpen] = useState(false);
  const whatsappMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (whatsappMenuRef.current && !whatsappMenuRef.current.contains(event.target as Node)) {
        setIsWhatsappOpen(false);
      }
    };
    if (isWhatsappOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isWhatsappOpen]);

  const handleSendTemplate = (templateId: WhatsAppTemplateOption['id'], e: React.MouseEvent) => {
    e.stopPropagation();
    const msg = buildWhatsAppMessage(templateId, project);
    openWhatsApp(project.celular || project.telefone, msg);
    setIsWhatsappOpen(false);

    if (onStatusChange) {
      if (templateId === 'lembrete' && (project.status === 'novo_contrato' || project.status === 'contato_inicial')) {
        onStatusChange(project.id, 'agendamento');
      } else if (templateId === 'convite' && project.status === 'novo_contrato') {
        onStatusChange(project.id, 'contato_inicial');
      }
    }
  };

  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: project.id,
    data: {
      type: 'Project',
      project,
    },
  });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  };

  let formattedDate = 'Hoje';
  try {
    if (project.data_atendimento) {
      formattedDate = `Atend: ${project.data_atendimento}`;
    } else if (project.criado_em) {
      const d = new Date(project.criado_em);
      if (!isNaN(d.getTime())) {
        formattedDate = format(d, "dd MMM, yyyy", { locale: ptBR });
      }
    }
  } catch (e) {
    formattedDate = project.data_atendimento ? `Atend: ${project.data_atendimento}` : 'Hoje';
  }

  // Clean phone number for WhatsApp link
  const rawPhone = String(project.telefone || project.celular || '');
  const phoneDigits = rawPhone.replace(/\D/g, '');
  const formattedWhatsapp = phoneDigits
    ? phoneDigits.startsWith('55')
      ? phoneDigits
      : `55${phoneDigits}`
    : null;

  // Build WhatsApp invite message from custom template or default
  const getWhatsAppMessage = () => {
    try {
      let template = 'Olá {nome_cliente}, tudo bem? Espero lhe encontrar bem!\n\nSou Marco Antonio, consultor credenciado ao SEBRAE e estou entrando em contato para comunicar que estamos a um passo de marcar nossa consultoria ({programa}).\n\nSegue o link para que possa escolher uma data e horário para este nosso encontro:\n👉 {link_calendario}\n\nÉ muito importante que agende uma data para darmos início ao nosso trabalho, espero e desejo muito que possa contribuir com a sua empresa.';
      let calendar = 'https://calendar.app.google/skRSHv2QBUjY9ae16';

      const saved = localStorage.getItem('amp_company_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.whatsappTemplate) template = parsed.whatsappTemplate;
        if (parsed.calendarLink) calendar = parsed.calendarLink;
      }

      const clientName = project.nome_cliente || project.razao_social || 'Cliente';
      const programa = project.programa || 'Consultoria Sebrae';

      return template
        .replace(/{nome_cliente}/g, clientName)
        .replace(/{programa}/g, programa)
        .replace(/{link_calendario}/g, calendar);
    } catch (e) {
      return `Olá ${project.nome_cliente || 'Cliente'}, sou Marco Antonio, consultor credenciado ao SEBRAE. Segue o link para agendarmos nossa consultoria: https://calendar.app.google/skRSHv2QBUjY9ae16`;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex flex-col gap-3 rounded-xl border bg-white p-4 text-left shadow-sm transition-all hover:shadow-md hover:border-primary/50 select-none cursor-pointer",
        isDragging && "opacity-30 border-primary shadow-xl scale-105",
        isOverlay && "cursor-grabbing opacity-100 shadow-2xl scale-105 rotate-2 border-primary/50 ring-2 ring-primary/20"
      )}
      onClick={() => {
        if (!isDragging && onClick) {
          onClick(project);
        }
      }}
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-slate-800 text-sm leading-tight line-clamp-2">
            {project.nome_cliente || 'Cliente Sem Nome'}
          </h3>
          <div className="flex items-center gap-1 shrink-0">
            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(project.id);
                }}
                className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                title="Excluir contrato"
              >
                <Trash2 size={15} />
              </button>
            )}
            <div
              {...attributes}
              {...listeners}
              className="text-slate-400 hover:text-slate-700 p-1 cursor-grab active:cursor-grabbing rounded hover:bg-slate-100"
              title="Arrastar card"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical size={16} />
            </div>
          </div>
        </div>

        {/* Badges: Programa, Modalidade, Carga Horária, ER SP */}
        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
          {project.programa && (
            <span className="bg-purple-100 text-purple-800 border border-purple-200 text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider">
              {project.programa}
            </span>
          )}
          {project.modalidade && (
            <span className={cn(
              "text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider border",
              (project.modalidade.toLowerCase().includes('remoto') || project.modalidade.toLowerCase().includes('online') || project.modalidade.toLowerCase().includes('distância')) && "bg-emerald-50 text-emerald-700 border-emerald-200",
              project.modalidade.toLowerCase().includes('presencial') && "bg-amber-50 text-amber-700 border-amber-200",
              project.modalidade.toLowerCase().includes('híbrido') && "bg-blue-50 text-blue-700 border-blue-200"
            )}>
              {project.modalidade}
            </span>
          )}
          {/* Carga Horária Badge */}
          <span className="bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1 shrink-0">
            <Clock size={11} className="text-sky-600 shrink-0" />
            <span>{project.horas_contratadas != null ? String(project.horas_contratadas).replace('.', ',') : 1}h</span>
          </span>
          {(project.dados_extra?.unidade_demandante || project.dados_extra?.er_credenciado) && (
            <span
              className="bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-extrabold px-2 py-0.5 rounded-md tracking-tight"
              title={project.dados_extra?.email_er_credenciado ? `Enviar para: ${project.dados_extra.email_er_credenciado}` : undefined}
            >
              {project.dados_extra?.er_credenciado || project.dados_extra?.unidade_demandante}
            </span>
          )}
        </div>
      </div>

      {/* Info: CNPJ, RAE, Telefone + WhatsApp */}
      <div className="flex flex-col gap-1.5 mt-1">
        {project.cnpj && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Building2 size={14} className="text-slate-400 shrink-0" />
            <span className="truncate">{project.cnpj}</span>
          </div>
        )}
        {project.codigo_rae && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <FileText size={14} className="text-slate-400 shrink-0" />
            <span className="truncate bg-slate-100 px-1.5 py-0.5 rounded-md text-slate-700 font-semibold" title="Código RAE / CO / OS">
              {project.codigo_rae.toUpperCase().includes('RAE') || project.codigo_rae.toUpperCase().includes('CO') || project.codigo_rae.toUpperCase().includes('OS')
                ? project.codigo_rae
                : `RAE/CO: ${project.codigo_rae}`}
            </span>
            {project.contrato_no && (
              <span className="truncate text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded font-bold">
                {project.contrato_no}
              </span>
            )}
          </div>
        )}

        {/* Telefone & Botão do WhatsApp */}
        {rawPhone && (
          <div className="relative flex items-center justify-between gap-1.5 text-xs text-slate-600 font-medium bg-slate-50/80 p-1.5 rounded-lg border border-slate-200/60 mt-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <Phone size={13} className="text-emerald-600 shrink-0" />
              <span className="truncate font-semibold text-slate-700">{maskPhone(rawPhone)}</span>
            </div>

            {/* Menu Dropdown de Mensagens Rápidas WhatsApp */}
            <div className="relative shrink-0" ref={whatsappMenuRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsWhatsappOpen(!isWhatsappOpen);
                }}
                className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2 py-1 rounded-md shadow-2xs transition-colors shrink-0 cursor-pointer"
                title="Disparar mensagem no WhatsApp (Convite, Cobrança, Retorno)"
              >
                <MessageSquare size={11} className="fill-current text-white shrink-0" />
                <span>WhatsApp</span>
                <ChevronDown size={10} className={cn("transition-transform", isWhatsappOpen && "rotate-180")} />
              </button>

              {/* Popover flutuante */}
              {isWhatsappOpen && (
                <div 
                  className="absolute right-0 bottom-full mb-1.5 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 p-1.5 z-50 flex flex-col gap-1 text-slate-800 animate-in fade-in zoom-in-95 duration-150"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-2 py-1 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Disparo Rápido</span>
                    <span className="text-[9px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">1 Clique</span>
                  </div>

                  {WHATSAPP_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={(e) => handleSendTemplate(tpl.id, e)}
                      className="flex flex-col text-left px-2 py-1.5 rounded-lg hover:bg-emerald-50/70 transition-colors group cursor-pointer border border-transparent hover:border-emerald-200"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-700">
                          {tpl.title}
                        </span>
                        <span className={cn("text-[9px] font-bold px-1.5 py-0.2 rounded-full border shrink-0", tpl.badgeColor)}>
                          {tpl.badge}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 group-hover:text-slate-600 line-clamp-1">
                        {tpl.subtitle}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer: Date & Price */}
      <div className="mt-2 flex items-center justify-between pt-2.5 border-t border-slate-100">
        <span className="text-[11px] font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-md">
          {formattedDate}
        </span>
        <span className="text-xs font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
          {project.valor_consultoria !== undefined && project.valor_consultoria !== null
            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(project.valor_consultoria)
            : 'R$ 0,00'}
        </span>
      </div>

      {/* Quick Move Status Selector */}
      {onStatusChange && (
        <div className="mt-1 flex items-center justify-between gap-1 pt-2 border-t border-slate-100/80">
          <button
            type="button"
            disabled={KANBAN_COLUMNS.findIndex(c => c.id === project.status) <= 0}
            onClick={(e) => {
              e.stopPropagation();
              const idx = KANBAN_COLUMNS.findIndex(c => c.id === project.status);
              if (idx > 0) {
                onStatusChange(project.id, KANBAN_COLUMNS[idx - 1].id);
              }
            }}
            className="p-1 rounded-md text-slate-400 hover:text-purple-700 hover:bg-purple-50 disabled:opacity-20 disabled:pointer-events-none transition-colors shrink-0"
            title="Voltar status anterior"
          >
            <ChevronLeft size={14} />
          </button>

          <select
            value={project.status}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              onStatusChange(project.id, e.target.value as ProjectStatus);
            }}
            className="flex-1 text-[10px] font-bold bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md py-1 px-1.5 text-slate-700 focus:outline-none cursor-pointer truncate"
            title="Mudar status deste contrato"
          >
            {KANBAN_COLUMNS.map((col) => (
              <option key={col.id} value={col.id}>
                Fase: {col.title}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={KANBAN_COLUMNS.findIndex(c => c.id === project.status) >= KANBAN_COLUMNS.length - 1}
            onClick={(e) => {
              e.stopPropagation();
              const idx = KANBAN_COLUMNS.findIndex(c => c.id === project.status);
              if (idx < KANBAN_COLUMNS.length - 1) {
                onStatusChange(project.id, KANBAN_COLUMNS[idx + 1].id);
              }
            }}
            className="p-1 rounded-md text-slate-400 hover:text-purple-700 hover:bg-purple-50 disabled:opacity-20 disabled:pointer-events-none transition-colors shrink-0"
            title="Avançar próximo status"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
