import React, { useState } from 'react';
import { X, Plus, FileText, Building2, User, Clock, Layers, Users, Sparkles, DollarSign, Calendar, Mail } from 'lucide-react';
import type { Project, ProjectStatus } from '../types/database';
import { maskPhone, formatCurrency } from '../lib/utils';
import { SEBRAE_SP_ER_CREDENCIADOS, findSebraeSpErCredenciado, buildSebraeSpNfDiscriminacao } from '../lib/sebraeSpUtils';

interface EmpresaItemPrevia {
  codigoRae: string;
  nome: string;
  cnpj: string;
  celular: string;
}

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (newProjects: Project | Project[]) => void;
}

export function NewProjectModal({ isOpen, onClose, onCreate }: NewProjectModalProps) {
  // 1. DADOS DO CONTRATO (GUARDA-CHUVA)
  const [contratoNo, setContratoNo] = useState('');
  const [osNumber, setOsNumber] = useState('');
  const [unidadeDemandante, setUnidadeDemandante] = useState('');
  const [qtdEmpresas, setQtdEmpresas] = useState(''); // Deve vir em branco
  const [edital, setEdital] = useState('');
  const [processoNo, setProcessoNo] = useState('');
  const [programa, setPrograma] = useState('Consultoria Sebrae');
  const [modalidade, setModalidade] = useState('Remoto');
  const [dataAtendimento, setDataAtendimento] = useState('');
  const [horasContratadas, setHorasContratadas] = useState(''); // Deve vir em branco, suporta decimais (ex: 6 ou 6,5)

  // Gestão de Valor do Contrato (Modos de Cálculo Inteligente)
  const [modoCalculo, setModoCalculo] = useState<'hora' | 'unitario' | 'total'>('hora');
  const [valorHora, setValorHora] = useState(''); // Ex: 198,00
  const [horasRelatorio, setHorasRelatorio] = useState(''); // Ex: 4h de relatórios do contrato
  const [ratearRelatorio, setRatearRelatorio] = useState(true);
  const [valorUnitarioManual, setValorUnitarioManual] = useState('');
  const [valorTotalManual, setValorTotalManual] = useState('');

  // Estado e Município padrão do contrato
  const [estado, setEstado] = useState('SP');
  const [municipio, setMunicipio] = useState('São Paulo');

  // Empresa Credenciada e Responsável
  const [empresaCredenciada, setEmpresaCredenciada] = useState('AMP DO BRASIL SOLUCOES ADMINISTRATIVAS E TECNOLOGICAS LTDA');
  const [profissionalResponsavel, setProfissionalResponsavel] = useState('MARCO ANTONIO PAVANI');

  // 2. DADOS INDIVIDUAIS (opcional no momento da criação)
  const [codigoRaeSingle, setCodigoRaeSingle] = useState('');
  const [nomeClienteSingle, setNomeClienteSingle] = useState('');
  const [cnpjSingle, setCnpjSingle] = useState('');
  const [celularSingle, setCelularSingle] = useState('');

  // Lista opcional para adiantar dados de empresas em lote
  const [showPreenchimentoLote, setShowPreenchimentoLote] = useState(false);
  const [empresasPrevia, setEmpresasPrevia] = useState<EmpresaItemPrevia[]>([]);

  const resetForm = () => {
    setContratoNo('');
    setOsNumber('');
    setUnidadeDemandante('');
    setQtdEmpresas('');
    setEdital('004/2026');
    setProcessoNo('1777/2025');
    setPrograma('Consultoria Sebrae');
    setModalidade('Remoto');
    setDataAtendimento('');
    setHorasContratadas('');
    setModoCalculo('hora');
    setValorHora('');
    setHorasRelatorio('');
    setRatearRelatorio(true);
    setValorUnitarioManual('');
    setValorTotalManual('');
    setEstado('SP');
    setMunicipio('São Paulo');

    setCodigoRaeSingle('');
    setNomeClienteSingle('');
    setCnpjSingle('');
    setCelularSingle('');

    setShowPreenchimentoLote(false);
    setEmpresasPrevia([]);
  };

  React.useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  // Quantidade efetiva de empresas (se em branco = 1)
  const totalEmpresas = parseInt(qtdEmpresas) || 1;

  // Conversões numéricas seguras com suporte a vírgula brasileira
  const parseNum = (val: string) => parseFloat(String(val || '').replace(',', '.')) || 0;
  const parsedHoras = parseNum(horasContratadas);
  const parsedValorHora = parseNum(valorHora);
  const parsedHorasRelatorio = parseNum(horasRelatorio);

  // Cálculos dinâmicos de Valores
  let subtotalConsultoria = 0;
  let subtotalRelatorios = 0;
  let valorTotalContrato = 0;
  let valorUnitario = 0;

  if (modoCalculo === 'hora') {
    subtotalConsultoria = Math.round(totalEmpresas * parsedHoras * parsedValorHora * 100) / 100;
    subtotalRelatorios = Math.round(parsedHorasRelatorio * parsedValorHora * 100) / 100;
    valorTotalContrato = Math.round((subtotalConsultoria + subtotalRelatorios) * 100) / 100;
    if (ratearRelatorio) {
      valorUnitario = totalEmpresas > 0 ? Math.round((valorTotalContrato / totalEmpresas) * 100) / 100 : 0;
    } else {
      valorUnitario = Math.round(parsedHoras * parsedValorHora * 100) / 100;
    }
  } else if (modoCalculo === 'unitario') {
    const numUnit = parseNum(valorUnitarioManual);
    valorUnitario = Math.round(numUnit * 100) / 100;
    valorTotalContrato = Math.round(numUnit * totalEmpresas * 100) / 100;
  } else {
    // modoCalculo === 'total'
    const numTotal = parseNum(valorTotalManual);
    valorTotalContrato = Math.round(numTotal * 100) / 100;
    valorUnitario = totalEmpresas > 0 ? Math.round((numTotal / totalEmpresas) * 100) / 100 : 0;
  }

  // Sincroniza lista prévia se o usuário quiser editar na hora
  const handleQtdChange = (val: string) => {
    setQtdEmpresas(val);
    const count = parseInt(val) || 1;
    if (count > 1) {
      setEmpresasPrevia((prev) => {
        const next: EmpresaItemPrevia[] = [];
        for (let i = 0; i < count; i++) {
          const num = i + 1;
          const numStr = num < 10 ? `0${num}` : `${num}`;
          next.push({
            codigoRae: prev[i]?.codigoRae || '',
            nome: prev[i]?.nome || `${contratoNo.trim() || 'Contrato'} - Empresa ${numStr}`,
            cnpj: prev[i]?.cnpj || '',
            celular: prev[i]?.celular || '',
          });
        }
        return next;
      });
    } else {
      setEmpresasPrevia([]);
    }
  };

  const handlePreviaChange = (index: number, field: keyof EmpresaItemPrevia, value: string) => {
    setEmpresasPrevia((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  if (!isOpen) return null;

  const matchedErModal = findSebraeSpErCredenciado(unidadeDemandante, municipio);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const timestamp = Date.now();
    const count = totalEmpresas;
    const contractPrefix = contratoNo.trim() || `CONTRATO-${timestamp}`;

    const baseShared = {
      consultor_id: 'admin-1',
      status: 'novo_contrato' as ProjectStatus,
      cpf: null,
      municipio: municipio.trim() || (estado === 'RJ' ? 'Rio de Janeiro' : 'São Paulo'),
      estado: estado.trim() || 'SP',
      endereco: '',
      programa: programa.trim() || 'Consultoria Sebrae',
      solucao_contratada: 'Faça a gestão financeira e tenha controle do seu dinheiro',
      objetivo_atendimento: 'Atendimento e consultoria Sebrae agendados.',
      horas_contratadas: parsedHoras || 1,
      horas_realizadas: parsedHoras || 1,
      data_atendimento: dataAtendimento.trim() || null,
      data_prevista_inicio: dataAtendimento.trim() || new Date().toISOString().split('T')[0],
      data_prevista_fim: null,
      modalidade: modalidade,
      valor_consultoria: valorUnitario || 170,
      contrato_no: contratoNo.trim() || null,
      edital: edital.trim() || '004/2026',
      processo_no: processoNo.trim() || '1777/2025',
      empresa_credenciada: empresaCredenciada.trim() || 'AMP DO BRASIL SOLUCOES ADMINISTRATIVAS E TECNOLOGICAS LTDA',
      profissional_responsavel: profissionalResponsavel.trim() || 'MARCO ANTONIO PAVANI',
      natureza: 'CONSULTORIA',
      plataforma_utilizada: modalidade,
      observacoes: matchedErModal
        ? `Unidade: ${matchedErModal.er} | E-mail Credenciado: ${matchedErModal.email} (${matchedErModal.gestor})`
        : (count > 1 ? `Contrato Guarda-Chuva (${count} empresas no total)` : 'Demanda cadastrada pelo sistema.'),
      dados_extra: {
        os_number: osNumber.trim() || null,
        sgf: contratoNo.trim() || null,
        codigo_sgf: contratoNo.trim() || null,
        unidade_demandante: matchedErModal?.er || unidadeDemandante || null,
        er_credenciado: matchedErModal?.er || unidadeDemandante || null,
        gestor_er_credenciado: matchedErModal?.gestor || null,
        email_er_credenciado: matchedErModal?.email || null,
      },
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    };

    const projectsToCreate: Project[] = [];

    if (count === 1) {
      // Criação de 1 única empresa
      const cardTitle = nomeClienteSingle.trim() || (contratoNo.trim() ? `${contratoNo.trim()} - Empresa 01` : 'Nova Empresa');
      projectsToCreate.push({
        ...baseShared,
        id: `manual-${timestamp}-1`,
        codigo_rae: codigoRaeSingle.trim() || null,
        nome_cliente: cardTitle,
        razao_social: cardTitle,
        nome_fantasia: cardTitle,
        cnpj: cnpjSingle.trim() || null,
        telefone: celularSingle.trim() || null,
        celular: celularSingle.trim() || null,
        email_cliente: null,
      });
    } else {
      // Criação dos N cards automaticamente
      for (let i = 0; i < count; i++) {
        const num = i + 1;
        const numStr = num < 10 ? `0${num}` : `${num}`;
        const itemPrevia = empresasPrevia[i];

        const cardTitle = (itemPrevia?.nome && !itemPrevia.nome.includes('Empresa'))
          ? itemPrevia.nome.trim()
          : `${contractPrefix} - Empresa ${numStr}`;

        const cardCode = itemPrevia?.codigoRae?.trim() || null;
        const cardCnpj = itemPrevia?.cnpj?.trim() || null;
        const cardCel = itemPrevia?.celular?.trim() || null;

        projectsToCreate.push({
          ...baseShared,
          id: `manual-${timestamp}-${num}`,
          codigo_rae: cardCode,
          nome_cliente: cardTitle,
          razao_social: cardTitle,
          nome_fantasia: cardTitle,
          cnpj: cardCnpj,
          telefone: cardCel,
          celular: cardCel,
          email_cliente: null,
        });
      }
    }

    onCreate(projectsToCreate);
    resetForm();
    onClose();
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-3xl shadow-2xl z-50 p-6 md:p-8 space-y-5 font-sans border border-slate-200 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Plus size={20} className="text-primary" />
              Lançamento de Novo Contrato / Demanda
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Informe os dados do contrato para gerar os cards automaticamente no Kanban. O RAE / CO e os dados cadastrais são tratados individualmente em cada card.
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* SEÇÃO 1: DADOS DO CONTRATO (GUARDA-CHUVA) */}
          <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center justify-between border-b border-purple-200/60 pb-2.5">
              <span className="text-xs font-extrabold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={16} className="text-purple-600" />
                Dados do Contrato (Guarda-Chuva)
              </span>
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-purple-950">Qtd. de Empresas:</label>
                <input 
                  type="number"
                  min={1}
                  max={50}
                  placeholder="1"
                  value={qtdEmpresas}
                  onChange={(e) => handleQtdChange(e.target.value)}
                  className="w-16 bg-white border border-purple-300 rounded-lg px-2 py-1 text-xs text-center font-extrabold text-purple-900 placeholder:text-slate-400 focus:outline-none focus:border-primary shadow-2xs"
                  title="Deixe em branco para 1 empresa ou digite o total (ex: 9 para gerar 9 cards)"
                />
              </div>
            </div>

            {/* Linha 1: Contrato, Edital, Processo */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contrato Nº *
                </label>
                <input
                  type="text"
                  required
                  value={contratoNo}
                  onChange={(e) => setContratoNo(e.target.value)}
                  placeholder="Ex: RJ0520260103"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Edital (opcional)
                </label>
                <input
                  type="text"
                  value={edital}
                  onChange={(e) => setEdital(e.target.value)}
                  placeholder="Ex: 001/2026"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Processo Nº (opcional)
                </label>
                <input
                  type="text"
                  value={processoNo}
                  onChange={(e) => setProcessoNo(e.target.value)}
                  placeholder="Ex: 1777/2025"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Linha 2: Programa, Modalidade, Período e Horas Contratadas (Parte Superior) */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Programa Sebrae
                </label>
                <input
                  type="text"
                  list="programas-sugestoes"
                  value={programa}
                  onChange={(e) => setPrograma(e.target.value)}
                  placeholder="Ex: Consultoria Sebrae"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-primary"
                />
                <datalist id="programas-sugestoes">
                  <option value="Consultoria Sebrae" />
                  <option value="Sebraetec" />
                  <option value="Sebrae Mais" />
                  <option value="Brasil Mais" />
                  <option value="ALI - Agentes Locais" />
                  <option value="Consultoria de Gestão Financeira" />
                </datalist>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  (Remoto/Presencial)
                </label>
                <select
                  value={modalidade}
                  onChange={(e) => setModalidade(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-primary font-semibold"
                >
                  <option value="Remoto">Remoto</option>
                  <option value="Presencial">Presencial</option>
                  <option value="Online">Online</option>
                  <option value="Híbrido">Híbrido</option>
                </select>
              </div>
              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Período / Data
                </label>
                <input
                  type="text"
                  value={dataAtendimento}
                  onChange={(e) => setDataAtendimento(e.target.value)}
                  placeholder="Ex: 31/07/2026"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-primary"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-xs font-extrabold text-purple-950 mb-1 flex items-center justify-between">
                  <span>Horas Contratadas *</span>
                  <span className="text-[10px] text-purple-700 font-semibold">(ex: 6,5)</span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={horasContratadas}
                  onChange={(e) => setHorasContratadas(e.target.value)}
                  placeholder="Ex: 6.5 ou 6,5"
                  className="w-full bg-white border-2 border-purple-400 rounded-xl px-3 py-2 text-xs text-purple-950 font-black focus:outline-none focus:border-primary shadow-xs"
                />
              </div>
            </div>

            {/* Linha 3: Cálculo Inteligente e Fechamento de Valores do Contrato */}
            <div className="space-y-2.5 pt-1 border-t border-purple-200/50">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <DollarSign size={15} className="text-purple-600" />
                  <span>Fechamento de Valores do Contrato:</span>
                </label>
                <div className="flex items-center gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setModoCalculo('hora')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                      modoCalculo === 'hora'
                        ? 'bg-purple-600 text-white shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Por Valor/Hora (Sebrae)
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoCalculo('unitario')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                      modoCalculo === 'unitario'
                        ? 'bg-purple-600 text-white shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Por Empresa (OS)
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoCalculo('total')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                      modoCalculo === 'total'
                        ? 'bg-purple-600 text-white shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Total do Contrato
                  </button>
                </div>
              </div>

              {modoCalculo === 'hora' && (
                <div className="bg-white p-3.5 rounded-xl border border-purple-200 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Valor da Hora (R$)
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-bold">R$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={valorHora}
                          onChange={(e) => setValorHora(e.target.value)}
                          placeholder="Ex: 198,00"
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 font-bold focus:outline-none focus:border-primary"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Horas de Relatórios (Contrato todo)
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={horasRelatorio}
                        onChange={(e) => setHorasRelatorio(e.target.value)}
                        placeholder="Ex: 4 (opcional)"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  {/* Resumo do Cálculo Sebrae */}
                  <div className="flex items-center justify-between bg-purple-50/90 p-2.5 rounded-lg text-xs border border-purple-200 flex-wrap gap-2">
                    <div className="space-y-0.5">
                      <span className="text-purple-950 font-extrabold block text-xs">
                        Base de cálculo apurada:
                      </span>
                      <span className="text-[11px] text-purple-900 font-medium">
                        {totalEmpresas} {totalEmpresas === 1 ? 'empresa' : 'empresas'} × {parsedHoras || '6,5'}h × {formatCurrency(parsedValorHora)} = {formatCurrency(subtotalConsultoria)}
                        {parsedHorasRelatorio > 0 && ` + Relatórios (${parsedHorasRelatorio}h): ${formatCurrency(subtotalRelatorios)}`}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-slate-500 font-bold">Total do Contrato: <strong className="text-slate-900 text-xs">{formatCurrency(valorTotalContrato)}</strong></div>
                      <div className="text-purple-900 font-black text-xs">
                        Valor da OS / Empresa: <span className="underline bg-white px-1.5 py-0.5 rounded border border-purple-200">{formatCurrency(valorUnitario)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {modoCalculo === 'unitario' && (
                <div className="bg-white p-3.5 rounded-xl border border-purple-200 space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Valor da OS por Empresa (R$)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-bold">R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={valorUnitarioManual}
                        onChange={(e) => setValorUnitarioManual(e.target.value)}
                        placeholder="Ex: 1301.14 ou 1188.00"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 font-bold focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-purple-50/90 p-2.5 rounded-lg text-xs border border-purple-200">
                    <span className="text-purple-900 font-bold">
                      {totalEmpresas} {totalEmpresas === 1 ? 'empresa' : 'empresas'} × {formatCurrency(valorUnitario)}
                    </span>
                    <span className="text-purple-950 font-extrabold text-xs">
                      Total do Contrato: <strong className="bg-white px-2 py-0.5 rounded border border-purple-200">{formatCurrency(valorTotalContrato)}</strong>
                    </span>
                  </div>
                </div>
              )}

              {modoCalculo === 'total' && (
                <div className="bg-white p-3.5 rounded-xl border border-purple-200 space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Valor Total do Contrato (R$)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-bold">R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={valorTotalManual}
                        onChange={(e) => setValorTotalManual(e.target.value)}
                        placeholder="Ex: 9108.00"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 font-bold focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-purple-50/90 p-2.5 rounded-lg text-xs border border-purple-200">
                    <span className="text-purple-900 font-bold">
                      Total: {formatCurrency(valorTotalContrato)} ÷ {totalEmpresas} {totalEmpresas === 1 ? 'empresa' : 'empresas'}
                    </span>
                    <span className="text-purple-950 font-extrabold text-xs">
                      Valor por Empresa (OS): <strong className="bg-white px-2 py-0.5 rounded border border-purple-200">{formatCurrency(valorUnitario)}</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Localização Padrão & Unidade Demandante SEBRAE-SP */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Município do Contrato</label>
                <input
                  type="text"
                  value={municipio}
                  onChange={(e) => setMunicipio(e.target.value)}
                  placeholder="São Paulo"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Estado (UF)</label>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:border-primary"
                >
                  <option value="SP">SP - São Paulo</option>
                  <option value="RJ">RJ - Rio de Janeiro</option>
                  <option value="MG">MG - Minas Gerais</option>
                  <option value="ES">ES - Espírito Santo</option>
                  <option value="PR">PR - Paraná</option>
                  <option value="SC">SC - Santa Catarina</option>
                  <option value="RS">RS - Rio Grande do Sul</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
            </div>

            {estado === 'SP' && (
              <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-blue-950 mb-1">
                      Unidade Demandante (ER SP)
                    </label>
                    <select
                      value={unidadeDemandante}
                      onChange={(e) => setUnidadeDemandante(e.target.value)}
                      className="w-full bg-white border border-blue-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-bold focus:outline-none focus:border-blue-600"
                    >
                      <option value="">Selecione a ER...</option>
                      {SEBRAE_SP_ER_CREDENCIADOS.map((item) => (
                        <option key={item.er} value={item.er}>
                          {item.er}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Nº da OS (Ex: 091108/2026)
                    </label>
                    <input
                      type="text"
                      value={osNumber}
                      onChange={(e) => setOsNumber(e.target.value)}
                      placeholder="Ex: 091108/2026"
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      E-mail Credenciado (Automático)
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={matchedErModal?.email || 'Selecione a ER ao lado'}
                      className="w-full bg-emerald-50 border border-emerald-300 rounded-lg px-2.5 py-1.5 text-xs text-emerald-900 font-bold"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SEÇÃO 2: A GRANDE SACADA - CARDS GERADOS AUTOMATICAMENTE */}
          {totalEmpresas > 1 ? (
            <div className="bg-gradient-to-r from-purple-50 via-indigo-50/50 to-white border border-purple-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shadow-sm shrink-0">
                  <Sparkles size={18} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-extrabold text-purple-950">
                    Geração Automática: {totalEmpresas} Cards no Kanban
                  </h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Ao confirmar, o sistema criará imediatamente <strong>{totalEmpresas} cards</strong> na coluna <strong>"Novo Contrato"</strong>, todos vinculados ao contrato <strong>{contratoNo.trim() || 'informado'}</strong> com valor de <strong>{formatCurrency(valorUnitario)}</strong> e <strong>{horasContratadas}h</strong> contratadas.
                  </p>
                  <p className="text-[11px] text-purple-800 font-medium">
                    💡 Você poderá clicar em cada card no Kanban para preencher individualmente o <strong>RAE / CO</strong>, Nome do Cliente, CNPJ e WhatsApp!
                  </p>
                </div>
              </div>

              {/* Acordeão Opcional para adiantar dados de empresas se desejar */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowPreenchimentoLote(!showPreenchimentoLote)}
                  className="text-xs text-purple-700 hover:text-purple-900 font-semibold underline flex items-center gap-1"
                >
                  {showPreenchimentoLote ? 'Ocultar pré-visualização das empresas' : 'Deseja já adiantar o nome ou RAE/CO de alguma empresa agora? (Opcional)'}
                </button>

                {showPreenchimentoLote && (
                  <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
                    {empresasPrevia.map((emp, idx) => (
                      <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-white p-2 rounded-xl border border-purple-200 text-xs shadow-2xs">
                        <span className="sm:col-span-1 font-bold text-purple-800 text-center">#{idx + 1}</span>
                        <input
                          type="text"
                          placeholder="RAE / CO (opcional)"
                          value={emp.codigoRae}
                          onChange={(e) => handlePreviaChange(idx, 'codigoRae', e.target.value)}
                          className="sm:col-span-3 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs"
                        />
                        <input
                          type="text"
                          placeholder={`Nome da Empresa ${idx + 1}`}
                          value={emp.nome}
                          onChange={(e) => handlePreviaChange(idx, 'nome', e.target.value)}
                          className="sm:col-span-5 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-medium"
                        />
                        <input
                          type="text"
                          placeholder="CNPJ"
                          value={emp.cnpj}
                          onChange={(e) => handlePreviaChange(idx, 'cnpj', e.target.value)}
                          className="sm:col-span-3 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* SE FOR APENAS 1 EMPRESA: campos individuais opcionais para agilizar */
            <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/70 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 size={14} className="text-slate-500" />
                  Dados da Empresa / Cliente (Opcional - você também pode preencher direto no card)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Código RAE / CO (Sebrae)
                  </label>
                  <input
                    type="text"
                    value={codigoRaeSingle}
                    onChange={(e) => setCodigoRaeSingle(e.target.value)}
                    placeholder="Ex: CO RJ052026 ou RAE 070873"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome do Cliente / Empresa
                  </label>
                  <input
                    type="text"
                    value={nomeClienteSingle}
                    onChange={(e) => setNomeClienteSingle(e.target.value)}
                    placeholder="Ex: Padaria Estrela LTDA"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">CNPJ do Cliente</label>
                  <input
                    type="text"
                    value={cnpjSingle}
                    onChange={(e) => setCnpjSingle(e.target.value)}
                    placeholder="00.000.000/0001-00"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Celular / WhatsApp</label>
                  <input
                    type="text"
                    value={celularSingle}
                    onChange={(e) => setCelularSingle(maskPhone(e.target.value))}
                    placeholder="(21) 99999-9999"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {/* BOTÕES DE AÇÃO */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
            <span className="text-[11px] text-slate-500 font-medium">
              {totalEmpresas > 1 ? `Criará ${totalEmpresas} cards vinculados ao contrato` : 'Criará 1 card no Kanban'}
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-100 text-slate-600 font-semibold rounded-xl text-xs hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl text-xs shadow-md shadow-purple-500/20 flex items-center gap-1.5 transition-all"
              >
                <Plus size={16} />
                <span>
                  {totalEmpresas > 1 
                    ? `Gerar ${totalEmpresas} Cards no Kanban` 
                    : 'Gerar Card no Kanban'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
