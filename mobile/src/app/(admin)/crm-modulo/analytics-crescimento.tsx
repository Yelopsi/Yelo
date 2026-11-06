import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  Share,
  Linking,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../../services/api';

// Tipagens dos dados retornados pelas APIs de Growth
interface OverviewData {
  mrrTotal?: number;
  netNewMrr?: number;
  mrrAnterior?: number;
  novosPagantes?: number;
  trialConversionRate?: number;
  trialConversionType?: string;
  trialsAtivos?: number;
  pctDemanda?: number;
  pagantesComDemandaCount?: number;
  totalAtivos?: number;
  pagantesSemDemandaCount?: number;
  mrrSemDemanda?: number;
  churnPagantes?: number;
  taxaChurnPagantes?: number;
  mrrPerdido?: number;
  mrrComDemanda?: number;
  churnTrial?: number;
}

interface AcquisitionData {
  leadsIdentificados?: number;
  primeiroContato?: number;
  trialsIniciados?: number;
  viraramPagantes?: number;
  timeToFirstContact?: {
    medianDays: number | null;
    sampleSize: number;
  };
}

interface DemandData {
  funnel?: {
    visitas?: number;
    questionariosIniciados?: number;
    questionariosConcluidos?: number;
    matches?: number | null;
    contatos?: number;
  };
  health?: any;
}

interface MarketingData {
  spendByChannel?: {
    'Meta Ads'?: number;
    'Google Ads'?: number;
  };
  novosPagantes?: number;
  marketingNaoAtribuido?: number;
  ltvProjetado?: number;
  amostraSuficienteLTV?: boolean;
  weightedChurnRate?: number;
  sampleData?: {
    somaBaseInicial?: number;
    totalHistoricalPaidChurned?: number;
    totalCustomersAnalyzed?: number;
    unknowns?: number;
  };
  ltvObservado?: number;
  payback?: number;
  cac?: number;
  arpu?: number;
}

interface PMFRow {
  contact_group: string;
  total_psis: number;
  active_psis: number;
  churned_psis: number;
  churn_rate: number;
}

interface UpcomingTrial {
  id: string;
  nome?: string;
  telefone?: string;
  planExpiresAt: string;
  admin_billing_sent_at?: string | null;
  probability?: number;
  reason?: string;
  ai_powered?: boolean;
}

interface DrilldownPsi {
  id: string;
  nome: string;
  status: string;
  plano?: string;
  join_date?: string;
  total_contacts?: number;
  last_contact?: string;
  telefone?: string;
  days_active?: number;
}

export default function AnalyticsCrescimentoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Estados principais
  const [selectedPeriod, setSelectedPeriod] = useState<number>(30);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Dados dos endpoints
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [acquisition, setAcquisition] = useState<AcquisitionData | null>(null);
  const [demand, setDemand] = useState<DemandData | null>(null);
  const [marketing, setMarketing] = useState<MarketingData | null>(null);
  const [pmfRows, setPmfRows] = useState<PMFRow[]>([]);
  const [upcomingTrials, setUpcomingTrials] = useState<UpcomingTrial[]>([]);

  // Modais de Drilldown e IA
  const [drilldownVisible, setDrilldownVisible] = useState<boolean>(false);
  const [drilldownTitle, setDrilldownTitle] = useState<string>('');
  const [drilldownLoading, setDrilldownLoading] = useState<boolean>(false);
  const [drilldownPsis, setDrilldownPsis] = useState<DrilldownPsi[]>([]);

  const [aiModalVisible, setAiModalVisible] = useState<boolean>(false);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiInsightsText, setAiInsightsText] = useState<string>('');

  // Formatador de Moeda
  const formatBRL = (val?: number | null) => {
    const num = typeof val === 'number' && !isNaN(val) ? val : 0;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
  };

  // Carregar dados
  const fetchGrowthData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const [overviewRes, acqRes, demRes, mktRes, pmfRes, trialsRes] = await Promise.all([
        api.get(`/api/admin/growth/overview?days=${selectedPeriod}`).catch(() => ({ data: { success: false, data: null } })),
        api.get(`/api/admin/growth/acquisition?days=${selectedPeriod}`).catch(() => ({ data: { success: false, data: null } })),
        api.get(`/api/admin/growth/demand?days=${selectedPeriod}`).catch(() => ({ data: { success: false, data: null } })),
        api.get(`/api/admin/growth/marketing?days=${selectedPeriod}`).catch(() => ({ data: { success: false, data: null } })),
        api.get(`/api/admin/growth/pmf`).catch(() => ({ data: { success: false, data: [] } })),
        api.get(`/api/admin/growth/upcoming-trials`).catch(() => ({ data: { success: false, data: [] } })),
      ]);

      if (overviewRes?.data?.data) setOverview(overviewRes.data.data);
      if (acqRes?.data?.data) setAcquisition(acqRes.data.data);
      if (demRes?.data?.data) setDemand(demRes.data.data);
      if (mktRes?.data?.data) setMarketing(mktRes.data.data);
      if (Array.isArray(pmfRes?.data?.data)) setPmfRows(pmfRes.data.data);
      if (Array.isArray(trialsRes?.data?.data)) setUpcomingTrials(trialsRes.data.data);

      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Erro ao carregar dados de Growth:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    fetchGrowthData();
  }, [fetchGrowthData]);

  // Alertas / Diagnósticos Calculados
  const diagnostics = useMemo(() => {
    if (!overview) return [];
    const list: string[] = [];

    // 1. Crescimento MRR
    const netNew = overview.netNewMrr || 0;
    const mrrAnt = overview.mrrAnterior || 0;
    if (mrrAnt > 0) {
      const pct = (netNew / mrrAnt) * 100;
      if (pct > 0) {
        list.push(`🟢 MRR cresceu ${pct.toFixed(1)}% vs período anterior, puxado por ${overview.novosPagantes || 0} novos pagantes.`);
      } else if (pct < 0) {
        list.push(`🔴 MRR retraiu ${Math.abs(pct).toFixed(1)}% vs período anterior (Perda de ${formatBRL(overview.mrrPerdido || 0)} em cancelamentos).`);
      } else {
        list.push(`🟡 MRR estagnado vs período anterior.`);
      }
    } else if (netNew > 0) {
      list.push(`🟢 MRR cresceu (Adicionados ${formatBRL(netNew)}).`);
    }

    // 2. Health Rate
    const semDem = overview.pagantesSemDemandaCount || 0;
    const pctDem = overview.pctDemanda || 0;
    if (pctDem >= 80) {
      list.push(`🟢 ${pctDem.toFixed(1)}% dos psicólogos ativos receberam demanda (Excelente engajamento da vitrine).`);
    } else if (pctDem >= 50) {
      list.push(`🟡 ${pctDem.toFixed(1)}% da base recebeu demanda. Existem ${semDem} psicólogos sem contatos no período.`);
    } else {
      list.push(`🔴 ${semDem} de ${overview.totalAtivos || 0} psicólogos ativos (${(100 - pctDem).toFixed(1)}%) NÃO receberam nenhum contato no período.`);
    }

    // 3. Churn
    const churn = overview.churnPagantes || 0;
    if (churn > 0) {
      const taxa = overview.taxaChurnPagantes ? overview.taxaChurnPagantes.toFixed(1) : '0';
      list.push(`🟡 ${churn} assinantes cancelaram neste período (Taxa de churn: ${taxa}%).`);
    } else {
      list.push(`🟢 Nenhum cancelamento de assinantes registrado no período selecionado.`);
    }

    return list;
  }, [overview]);

  // Drill-down para grupos PMF e Psicólogos Sem Demanda
  const handleOpenDrilldown = async (group: string, title: string) => {
    setDrilldownTitle(title);
    setDrilldownVisible(true);
    setDrilldownLoading(true);
    setDrilldownPsis([]);

    try {
      const res = await api.get(`/api/admin/growth/pmf/details?group=${encodeURIComponent(group)}`);
      if (res?.data?.data && Array.isArray(res.data.data)) {
        setDrilldownPsis(res.data.data);
      }
    } catch (err: any) {
      Alert.alert('Erro', 'Não foi possível carregar os detalhes do grupo: ' + (err?.message || ''));
    } finally {
      setDrilldownLoading(false);
    }
  };

  // WhatsApp para Psicólogo Sem Demanda
  const handleContactPsi = (psi: DrilldownPsi) => {
    if (!psi.telefone) {
      Alert.alert('Sem WhatsApp', 'Este psicólogo não possui telefone cadastrado.');
      return;
    }
    const cleanPhone = psi.telefone.replace(/\D/g, '');
    const texto = encodeURIComponent(
      `Olá, ${psi.nome}! Tudo bem?\n\nAqui é da equipe de Sucesso da Yelo. Estou acompanhando os resultados da sua vitrine na plataforma e notei que você ainda não recebeu novos contatos de pacientes nos últimos dias. Gostaria de te ajudar a calibrar suas tags e fotos para maximizar suas indicações!`
    );
    Linking.openURL(`https://wa.me/55${cleanPhone}?text=${texto}`);
  };

  // WhatsApp para Final de Trial
  const handleContactTrial = (trial: UpcomingTrial) => {
    if (!trial.telefone) {
      Alert.alert('Sem WhatsApp', 'Este psicólogo não possui telefone cadastrado.');
      return;
    }
    const cleanPhone = trial.telefone.replace(/\D/g, '');
    const expiraDias = Math.ceil((new Date(trial.planExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const tempoTexto = expiraDias <= 1 ? 'amanhã' : `em ${expiraDias} dias`;
    const texto = encodeURIComponent(
      `Olá, ${trial.nome || 'Doutor(a)'}! Tudo bem?\n\nAqui é da equipe Yelo. Vi que seu período de teste gratuito na plataforma está finalizando ${tempoTexto}. Gostaria de saber como foi sua experiência e te apoiar na ativação do seu plano com condições exclusivas!`
    );
    Linking.openURL(`https://wa.me/55${cleanPhone}?text=${texto}`);
  };

  // Exportar Relatório em CSV via Compartilhamento Nativo
  const handleExportCSV = async () => {
    try {
      if (!overview) {
        Alert.alert('Aviso', 'Aguarde os dados carregarem para exportar.');
        return;
      }

      let csv = `\uFEFFRelatorio de Growth (Ultimos ${selectedPeriod} dias) - Yelo\n`;
      csv += `Gerado em: ${new Date().toLocaleString()}\n\n`;

      csv += `--- SAUDE FINANCEIRA E BASE ---\n`;
      csv += `MRR Total;${formatBRL(overview.mrrTotal)}\n`;
      csv += `Net New MRR;${formatBRL(overview.netNewMrr)}\n`;
      csv += `Psicologos Ativos;${overview.totalAtivos || 0}\n`;
      csv += `Novos Pagantes;${overview.novosPagantes || 0}\n`;
      csv += `Health Rate (Com Demanda);${(overview.pctDemanda || 0).toFixed(1)}%\n`;
      csv += `Psicologos Sem Demanda;${overview.pagantesSemDemandaCount || 0}\n`;
      csv += `MRR Sem Demanda;${formatBRL(overview.mrrSemDemanda)}\n`;
      csv += `Churn Pagantes;${overview.churnPagantes || 0}\n`;
      csv += `MRR Perdido;${formatBRL(overview.mrrPerdido)}\n\n`;

      if (acquisition) {
        csv += `--- FUNIL DE AQUISICAO B2B ---\n`;
        csv += `Leads Mapeados;${acquisition.leadsIdentificados || 0}\n`;
        csv += `Contatados;${acquisition.primeiroContato || 0}\n`;
        csv += `Trials Iniciados;${acquisition.trialsIniciados || 0}\n`;
        csv += `Convertidos Pagantes;${acquisition.viraramPagantes || 0}\n\n`;
      }

      if (demand?.funnel) {
        csv += `--- JORNADA DOS PACIENTES B2C ---\n`;
        csv += `Visitas no Site;${demand.funnel.visitas || 0}\n`;
        csv += `Questionarios Iniciados;${demand.funnel.questionariosIniciados || 0}\n`;
        csv += `Questionarios Concluidos;${demand.funnel.questionariosConcluidos || 0}\n`;
        csv += `Indicacoes Vitrine;${demand.funnel.matches || 0}\n`;
        csv += `Cliques WhatsApp;${demand.funnel.contatos || 0}\n`;
      }

      await Share.share({
        title: `Growth_Report_${selectedPeriod}d_Yelo.csv`,
        message: csv,
      });
    } catch (err: any) {
      Alert.alert('Erro ao exportar', err.message);
    }
  };

  // Solicitar Insights da IA
  const handleGenerateAIInsights = async () => {
    setAiModalVisible(true);
    setAiLoading(true);
    setAiInsightsText('');

    try {
      const payload = {
        overview,
        acquisition,
        demand,
        marketing,
      };

      const res = await api.post('/api/admin/analytics/growth/ai-insights', payload);
      if (res?.data?.insights) {
        setAiInsightsText(res.data.insights);
      } else {
        setAiInsightsText('Não foi possível obter recomendações automáticas para os parâmetros atuais.');
      }
    } catch (err: any) {
      setAiInsightsText('Erro ao consultar o serviço de Inteligência Estratégica: ' + (err?.message || 'Verifique a conexão'));
    } finally {
      setAiLoading(false);
    }
  };

  // Cálculos de Escala & Bússola de Marketing
  const bussolaInfo = useMemo(() => {
    const ativos = overview?.totalAtivos || 0;
    const novos = overview?.novosPagantes || 0;
    const custoPorPsi = 26.88;
    const aumentoSugerido = novos * custoPorPsi;
    const idealTotal = ativos * custoPorPsi;

    let title = `Manter Google Ads em ${formatBRL(idealTotal)}/mês`;
    let reason = `Sua base de ${ativos} psicólogos ativos exige este investimento em tráfego de demanda para manter seu índice de satisfação.`;

    if (novos > 0) {
      title = `Aumente +${formatBRL(aumentoSugerido)} no Google Ads`;
      reason = `Você ativou ${novos} novos psicólogos pagantes neste período. Para alimentá-los, aumente a verba de demanda. O orçamento ideal da plataforma agora é ${formatBRL(idealTotal)}/mês.`;
    }

    return { title, reason, idealTotal };
  }, [overview]);

  // Cálculos do Funil B2C
  const funnelB2C = useMemo(() => {
    const f = demand?.funnel || {};
    const visitas = f.visitas || 0;
    const iniciados = f.questionariosIniciados || 0;
    const concluidos = f.questionariosConcluidos || 0;
    const matches = f.matches !== null && f.matches !== undefined ? f.matches : null;
    const contatos = f.contatos || 0;

    const convIniciados = visitas > 0 ? ((iniciados / visitas) * 100).toFixed(1) + '%' : '0%';
    const convConcluidos = iniciados > 0 ? ((concluidos / iniciados) * 100).toFixed(1) + '%' : '0%';
    const psisPorBusca = concluidos > 0 && matches !== null ? (matches / concluidos).toFixed(1) + ' psis/busca' : '-';
    const baseWpp = matches !== null ? matches : concluidos;
    const convContatos = baseWpp > 0 ? ((contatos / baseWpp) * 100).toFixed(1) + '%' : '0%';

    return {
      visitas,
      iniciados,
      concluidos,
      matches: matches !== null ? String(matches) : 'Automático',
      contatos,
      convIniciados,
      convConcluidos,
      psisPorBusca,
      convContatos,
    };
  }, [demand]);

  // Cálculos do Funil B2B
  const funnelB2B = useMemo(() => {
    const a = acquisition || {};
    const leads = a.leadsIdentificados || 0;
    const contatados = a.primeiroContato || 0;
    const trials = a.trialsIniciados || 0;
    const pagantes = a.viraramPagantes || 0;

    const convContatados = leads > 0 ? ((contatados / leads) * 100).toFixed(1) + '%' : '0%';
    const convTrials = contatados > 0 ? ((trials / contatados) * 100).toFixed(1) + '%' : '0%';
    const convPagantes = trials > 0 ? ((pagantes / trials) * 100).toFixed(1) + '%' : '0%';

    return {
      leads,
      contatados,
      trials,
      pagantes,
      convContatados,
      convTrials,
      convPagantes,
    };
  }, [acquisition]);

  return (
    <View className="flex-1 bg-[#f8fafc]">
      <StatusBar style="dark" />

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: 130, // respiro premium para a bottom nav fixa
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchGrowthData(true)}
            tintColor="#1B4332"
            colors={['#1B4332']}
          />
        }
      >
        {/* ========================================================= */}
        {/* TOP BAR: BOTÃO VOLTAR CRM HUB + BADGE ADMIN              */}
        {/* ========================================================= */}
        <View className="flex-row items-center justify-between mb-3.5">
          <TouchableOpacity
            onPress={() => router.navigate('/(admin)/dashboard-hub')}
            className="flex-row items-center bg-emerald-950/40 px-3 py-2 rounded-full border border-emerald-800/40"
            activeOpacity={0.8}
          >
            <Feather name="arrow-left" size={15} color="#A7F3D0" />
            <Text className="text-emerald-100 font-sans font-bold text-xs ml-1.5">CRM Hub</Text>
          </TouchableOpacity>

          <View className="flex-row items-center bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-xs">
            <Text className="text-[11px] font-sans font-bold text-slate-700">🛡️ Admin Growth</Text>
          </View>
        </View>

        {/* ========================================================= */}
        {/* HERO CARD VERDE COM GRADIENTE E BORDAS ARREDONDADAS       */}
        {/* ========================================================= */}
        <LinearGradient
          colors={['#1B4332', '#2A5A40']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 24 }}
          className="p-5 mb-4 shadow-lg border border-emerald-800/30"
        >
          <View className="flex-row items-start justify-between">
            <View className="flex-1 mr-3">
              <Text className="font-title text-white text-2xl tracking-tight">Growth 📈</Text>
              <Text className="font-sans text-emerald-100/90 text-xs mt-1 leading-relaxed">
                Visão executiva de aquisição, conversão, retenção e economia do Yelo.
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => fetchGrowthData(false)}
              disabled={loading}
              style={{ backgroundColor: '#FFEE8C' }}
              className="flex-row items-center px-4 py-2 rounded-full shadow-xs active:opacity-80"
            >
              {loading ? (
                <ActivityIndicator size="small" color="#1B4332" />
              ) : (
                <>
                  <Feather name="refresh-cw" size={13} color="#1B4332" />
                  <Text className="text-[#1B4332] font-sans font-extrabold text-xs ml-1.5">Atualizar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Sub-ações do Header */}
          <View className="flex-row items-center justify-between mt-4 pt-3 border-t border-emerald-700/40">
            <Text className="font-sans text-emerald-200/80 text-[11px]">
              Atualizado às {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </Text>

            <TouchableOpacity
              onPress={handleExportCSV}
              className="flex-row items-center bg-white/10 px-3.5 py-1.5 rounded-full border border-white/20 active:bg-white/20"
            >
              <Feather name="download" size={12} color="#ffffff" />
              <Text className="text-white font-sans font-bold text-[11px] ml-1.5">Exportar CSV</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* ========================================================= */}
        {/* SELETOR DE PERÍODO HORIZONTAL (7D, 30D, 90D, 180D, 365D) */}
        {/* ========================================================= */}
        <View className="mb-4 -mx-4">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          >
            {[
              { id: 7, label: '7 dias' },
              { id: 30, label: '30 dias' },
              { id: 90, label: '3 meses' },
              { id: 180, label: '6 meses' },
              { id: 365, label: '12 meses' },
            ].map((p) => {
              const isActive = selectedPeriod === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => setSelectedPeriod(p.id)}
                  activeOpacity={0.8}
                  className={`px-4 py-2 rounded-full border ${
                    isActive ? 'bg-[#1B4332] border-[#1B4332]' : 'bg-white border-[#e2e8f0]'
                  }`}
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: isActive ? 0.08 : 0.02,
                    shadowRadius: 3,
                    elevation: isActive ? 2 : 1,
                  }}
                >
                  <Text
                    className={`font-sans font-bold text-[12px] ${
                      isActive ? 'text-white' : 'text-[#64748b]'
                    }`}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ========================================================= */}
        {/* BLOCO 1: DIAGNÓSTICO AUTOMÁTICO (IA & REGRAS)             */}
        {/* ========================================================= */}
        <View
          className="bg-white rounded-2xl p-4 mb-4 border border-[#e2e8f0]"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.03,
            shadowRadius: 6,
            elevation: 1,
          }}
        >
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-1.5">
              <Text className="text-[16px]">🤖</Text>
              <Text className="font-title text-[#0f172a] text-[15px]">Diagnóstico Executivo</Text>
            </View>

            <TouchableOpacity
              onPress={handleGenerateAIInsights}
              className="flex-row items-center bg-[#8b5cf6]/10 px-2.5 py-1 rounded-full border border-[#8b5cf6]/30 active:opacity-70"
            >
              <Feather name="zap" size={11} color="#7c3aed" />
              <Text className="font-sans font-bold text-[11px] text-[#7c3aed] ml-1">IA Deep Dive</Text>
            </TouchableOpacity>
          </View>

          <Text className="font-sans text-[#64748b] text-[11px] mb-3">
            Alertas automáticos para os últimos {selectedPeriod} dias:
          </Text>

          {diagnostics.length === 0 ? (
            <Text className="font-sans text-[#94a3b8] text-[12px] italic">
              Carregando indicadores para diagnóstico...
            </Text>
          ) : (
            <View className="gap-2">
              {diagnostics.map((bullet, idx) => (
                <View key={idx} className="flex-row items-start bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <Text className="font-sans text-[#334155] text-[12px] leading-relaxed flex-1">
                    {bullet}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ========================================================= */}
        {/* BLOCO 2: DECISÃO EXECUTIVA (OS 5 KPIS ESSENCIAIS)         */}
        {/* ========================================================= */}
        <View className="mb-4">
          <Text className="font-title text-[#111827] text-[16px] mb-3">
            Primeira Viewport: Decisão Executiva
          </Text>

          {/* Grid de KPIs executivos */}
          <View className="gap-3">
            {/* 1. Crescimento MRR */}
            <View
              className="bg-white rounded-2xl p-4 border border-[#e2e8f0]"
              style={{
                borderLeftWidth: 5,
                borderLeftColor: '#10b981',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.03,
                shadowRadius: 5,
                elevation: 1,
              }}
            >
              <View className="flex-row items-center justify-between mb-1">
                <Text className="font-sans font-bold text-[#64748b] text-[11px] uppercase tracking-wider">
                  Crescimento (MRR)
                </Text>
                <Feather name="trending-up" size={14} color="#10b981" />
              </View>
              <Text className="font-title text-[#10b981] text-[24px]">
                {formatBRL(overview?.mrrTotal)}
              </Text>
              <View className="mt-1 pt-1.5 border-t border-slate-100 flex-row items-center justify-between">
                <Text className="font-sans font-bold text-[12px] text-emerald-700">
                  {(overview?.netNewMrr || 0) >= 0 ? '+' : ''}
                  {formatBRL(overview?.netNewMrr)} Net New MRR
                </Text>
                <Text className="font-sans text-[11px] text-[#94a3b8]">
                  vs {formatBRL(overview?.mrrAnterior)} ant.
                </Text>
              </View>
            </View>

            {/* 2. Aquisição */}
            <View
              className="bg-white rounded-2xl p-4 border border-[#e2e8f0]"
              style={{
                borderLeftWidth: 5,
                borderLeftColor: '#3b82f6',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.03,
                shadowRadius: 5,
                elevation: 1,
              }}
            >
              <View className="flex-row items-center justify-between mb-1">
                <Text className="font-sans font-bold text-[#64748b] text-[11px] uppercase tracking-wider">
                  Aquisição
                </Text>
                <Feather name="user-plus" size={14} color="#3b82f6" />
              </View>
              <Text className="font-title text-[#3b82f6] text-[24px]">
                {overview?.novosPagantes || 0}
              </Text>
              <View className="mt-1 pt-1.5 border-t border-slate-100 flex-row items-center justify-between">
                <Text className="font-sans font-bold text-[12px] text-blue-700">
                  {(overview?.trialConversionRate || 0).toFixed(1)}% conv. de trial
                </Text>
                <Text className="font-sans text-[11px] text-[#94a3b8]">
                  ({overview?.trialsAtivos || 0} trials ativos)
                </Text>
              </View>
            </View>

            {/* 3. Health Rate (Com Demanda) */}
            <View
              className="bg-[#f5f3ff] rounded-2xl p-4 border border-[#ddd6fe]"
              style={{
                borderLeftWidth: 5,
                borderLeftColor: '#8b5cf6',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.03,
                shadowRadius: 5,
                elevation: 1,
              }}
            >
              <View className="flex-row items-center justify-between mb-1">
                <Text className="font-sans font-bold text-[#6d28d9] text-[11px] uppercase tracking-wider">
                  Health Rate (% com demanda)
                </Text>
                <Feather name="activity" size={14} color="#8b5cf6" />
              </View>
              <Text className="font-title text-[#6d28d9] text-[24px]">
                {(overview?.pctDemanda || 0).toFixed(1)}%
              </Text>
              <View className="mt-1 pt-1.5 border-t border-purple-200/60 flex-row items-center justify-between">
                <Text className="font-sans font-bold text-[12px] text-purple-900">
                  {overview?.pagantesComDemandaCount || 0} de {overview?.totalAtivos || 0} com contatos
                </Text>
                <Text className="font-sans text-[11px] text-purple-700">
                  Mediana: {acquisition?.timeToFirstContact?.medianDays !== null && acquisition?.timeToFirstContact?.medianDays !== undefined ? `${acquisition.timeToFirstContact.medianDays}d` : 'N/D'}
                </Text>
              </View>
            </View>

            {/* 4. Ação: Sem Demanda (Com Drill-Down) */}
            <TouchableOpacity
              onPress={() => handleOpenDrilldown('sem_demanda_cs', 'Psicólogos Sem Demanda (Risco de Evasão)')}
              activeOpacity={0.8}
              className="bg-white rounded-2xl p-4 border border-[#e2e8f0]"
              style={{
                borderLeftWidth: 5,
                borderLeftColor: '#f59e0b',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.03,
                shadowRadius: 5,
                elevation: 1,
              }}
            >
              <View className="flex-row items-center justify-between mb-1">
                <View className="flex-row items-center gap-1.5">
                  <Text className="font-sans font-bold text-[#b45309] text-[11px] uppercase tracking-wider">
                    Ação: Sem Demanda
                  </Text>
                  <Feather name="external-link" size={12} color="#b45309" />
                </View>
                <View className="bg-amber-100 px-2 py-0.5 rounded-full">
                  <Text className="font-sans font-bold text-[10px] text-amber-800">Toque p/ ver lista</Text>
                </View>
              </View>
              <Text className="font-title text-[#d97706] text-[24px]">
                {overview?.pagantesSemDemandaCount || 0}
              </Text>
              <View className="mt-1 pt-1.5 border-t border-slate-100 flex-row items-center justify-between">
                <Text className="font-sans font-bold text-[12px] text-amber-700">
                  {formatBRL(overview?.mrrSemDemanda)} MRR em risco
                </Text>
                <Text className="font-sans text-[11px] text-[#94a3b8]">
                  Clique para agir ↗
                </Text>
              </View>
            </TouchableOpacity>

            {/* 5. Retenção (Churn Financeiro) */}
            <View
              className="bg-white rounded-2xl p-4 border border-[#e2e8f0]"
              style={{
                borderLeftWidth: 5,
                borderLeftColor: '#ef4444',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.03,
                shadowRadius: 5,
                elevation: 1,
              }}
            >
              <View className="flex-row items-center justify-between mb-1">
                <Text className="font-sans font-bold text-[#64748b] text-[11px] uppercase tracking-wider">
                  Retenção (Churn Financeiro)
                </Text>
                <Feather name="user-x" size={14} color="#ef4444" />
              </View>
              <Text className="font-title text-[#ef4444] text-[24px]">
                {overview?.churnPagantes || 0}
              </Text>
              <View className="mt-1 pt-1.5 border-t border-slate-100 flex-row items-center justify-between">
                <Text className="font-sans font-bold text-[12px] text-rose-700">
                  {(overview?.taxaChurnPagantes || 0).toFixed(1)}% da base
                </Text>
                <Text className="font-sans text-[11px] text-rose-600 font-semibold">
                  - {formatBRL(overview?.mrrPerdido)} perdido
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ========================================================= */}
        {/* BLOCO 3: OS DOIS FUNIS (B2C PACIENTES & B2B PSICÓLOGOS)    */}
        {/* ========================================================= */}
        <View className="mb-4">
          <Text className="font-title text-[#111827] text-[16px] mb-3">
            Funis de Conversão
          </Text>

          {/* Funil 1: Pacientes (B2C) */}
          <View
            className="bg-white rounded-2xl p-4 mb-3 border border-[#e2e8f0]"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.03,
              shadowRadius: 6,
              elevation: 1,
            }}
          >
            <View className="flex-row items-center justify-between mb-1">
              <Text className="font-title text-[#111827] text-[14px]">Jornada dos Pacientes (B2C)</Text>
              <View className="bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200">
                <Text className="font-sans font-bold text-[10px] text-sky-700">Tráfego & Busca</Text>
              </View>
            </View>
            <Text className="font-sans text-[#64748b] text-[11px] mb-3">
              Da visita no site até o clique no WhatsApp do psicólogo.
            </Text>

            <View className="gap-2.5">
              {/* Etapa 1: Visitas */}
              <View className="flex-row items-center justify-between pb-2 border-b border-slate-100">
                <View className="flex-row items-center gap-2">
                  <Feather name="globe" size={14} color="#64748b" />
                  <Text className="font-sans font-semibold text-[#475569] text-[12px]">Visitas no Site</Text>
                </View>
                <Text className="font-title text-[#1e293b] text-[15px]">{funnelB2C.visitas}</Text>
              </View>

              {/* Etapa 2: Questionários Iniciados */}
              <View className="flex-row items-center justify-between pb-2 border-b border-slate-100">
                <View className="flex-row items-center gap-2">
                  <Feather name="play-circle" size={14} color="#64748b" />
                  <Text className="font-sans font-semibold text-[#475569] text-[12px]">Buscas Iniciadas</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Text className="font-title text-[#1e293b] text-[15px]">{funnelB2C.iniciados}</Text>
                  <View className="bg-emerald-50 px-2 py-0.5 rounded-full">
                    <Text className="font-sans font-bold text-[10px] text-emerald-700">{funnelB2C.convIniciados}</Text>
                  </View>
                </View>
              </View>

              {/* Etapa 3: Questionários Concluídos */}
              <View className="flex-row items-center justify-between pb-2 border-b border-slate-100">
                <View className="flex-row items-center gap-2">
                  <Feather name="check-circle" size={14} color="#64748b" />
                  <Text className="font-sans font-semibold text-[#475569] text-[12px]">Buscas Concluídas</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Text className="font-title text-[#1e293b] text-[15px]">{funnelB2C.concluidos}</Text>
                  <View className="bg-emerald-50 px-2 py-0.5 rounded-full">
                    <Text className="font-sans font-bold text-[10px] text-emerald-700">{funnelB2C.convConcluidos}</Text>
                  </View>
                </View>
              </View>

              {/* Etapa 4: Indicados na Vitrine */}
              <View className="flex-row items-center justify-between pb-2 border-b border-slate-100">
                <View className="flex-row items-center gap-2">
                  <Feather name="users" size={14} color="#64748b" />
                  <Text className="font-sans font-semibold text-[#475569] text-[12px]">Indicados (Vitrine)</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Text className="font-title text-[#1e293b] text-[15px]">{funnelB2C.matches}</Text>
                  <View className="bg-blue-50 px-2 py-0.5 rounded-full">
                    <Text className="font-sans font-bold text-[10px] text-blue-700">{funnelB2C.psisPorBusca}</Text>
                  </View>
                </View>
              </View>

              {/* Etapa 5: Cliques no WhatsApp */}
              <View className="flex-row items-center justify-between pt-1">
                <View className="flex-row items-center gap-2">
                  <Feather name="message-circle" size={15} color="#25D366" />
                  <Text className="font-sans font-bold text-[#1e293b] text-[12px]">Cliques WhatsApp</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Text className="font-title text-[#25D366] text-[16px]">{funnelB2C.contatos}</Text>
                  <View className="bg-emerald-100 px-2 py-0.5 rounded-full">
                    <Text className="font-sans font-extrabold text-[10px] text-emerald-800">{funnelB2C.convContatos}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Funil 2: Aquisição Psicólogos (B2B) */}
          <View
            className="bg-white rounded-2xl p-4 border border-[#e2e8f0]"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.03,
              shadowRadius: 6,
              elevation: 1,
            }}
          >
            <View className="flex-row items-center justify-between mb-1">
              <Text className="font-title text-[#111827] text-[14px]">Funil de Aquisição B2B</Text>
              <View className="bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                <Text className="font-sans font-bold text-[10px] text-emerald-700">Vendas & Conversão</Text>
              </View>
            </View>
            <Text className="font-sans text-[#64748b] text-[11px] mb-3">
              Conversão de leads prospectados em assinantes da plataforma.
            </Text>

            <View className="gap-2.5">
              {/* Etapa 1: Leads */}
              <View className="flex-row items-center justify-between pb-2 border-b border-slate-100">
                <View className="flex-row items-center gap-2">
                  <Feather name="target" size={14} color="#64748b" />
                  <Text className="font-sans font-semibold text-[#475569] text-[12px]">Leads (Mapeados)</Text>
                </View>
                <Text className="font-title text-[#1e293b] text-[15px]">{funnelB2B.leads}</Text>
              </View>

              {/* Etapa 2: Contatados */}
              <View className="flex-row items-center justify-between pb-2 border-b border-slate-100">
                <View className="flex-row items-center gap-2">
                  <Feather name="phone-call" size={14} color="#64748b" />
                  <Text className="font-sans font-semibold text-[#475569] text-[12px]">Contatados</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Text className="font-title text-[#1e293b] text-[15px]">{funnelB2B.contatados}</Text>
                  <View className="bg-emerald-50 px-2 py-0.5 rounded-full">
                    <Text className="font-sans font-bold text-[10px] text-emerald-700">{funnelB2B.convContatados}</Text>
                  </View>
                </View>
              </View>

              {/* Etapa 3: Cadastros Trials */}
              <View className="flex-row items-center justify-between pb-2 border-b border-slate-100">
                <View className="flex-row items-center gap-2">
                  <Feather name="user-check" size={14} color="#64748b" />
                  <Text className="font-sans font-semibold text-[#475569] text-[12px]">Cadastros (Trials)</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Text className="font-title text-[#1e293b] text-[15px]">{funnelB2B.trials}</Text>
                  <View className="bg-emerald-50 px-2 py-0.5 rounded-full">
                    <Text className="font-sans font-bold text-[10px] text-emerald-700">{funnelB2B.convTrials}</Text>
                  </View>
                </View>
              </View>

              {/* Etapa 4: Pagantes Convertidos */}
              <View className="flex-row items-center justify-between pt-1">
                <View className="flex-row items-center gap-2">
                  <Feather name="award" size={15} color="#10b981" />
                  <Text className="font-sans font-bold text-[#1e293b] text-[12px]">Pagantes Convertidos</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Text className="font-title text-[#10b981] text-[16px]">{funnelB2B.pagantes}</Text>
                  <View className="bg-emerald-100 px-2 py-0.5 rounded-full">
                    <Text className="font-sans font-extrabold text-[10px] text-emerald-800">{funnelB2B.convPagantes}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ========================================================= */}
        {/* BLOCO 4: PRÓXIMOS FINS DE TRIAL (JANELA DE 7 DIAS)        */}
        {/* ========================================================= */}
        <View className="mb-4">
          <View className="flex-row items-center justify-between mb-2">
            <View>
              <Text className="font-title text-[#111827] text-[16px]">Próximos Fins de Trial</Text>
              <Text className="font-sans text-[#64748b] text-[11px]">
                Janela crítica de conversão B2B (próximos 7 dias)
              </Text>
            </View>
            <View className="bg-amber-100 px-2.5 py-1 rounded-full border border-amber-300">
              <Text className="font-sans font-bold text-[11px] text-amber-800">
                {upcomingTrials.length} {upcomingTrials.length === 1 ? 'trial' : 'trials'}
              </Text>
            </View>
          </View>

          {upcomingTrials.length === 0 ? (
            <View className="bg-white rounded-2xl p-4 border border-[#e2e8f0] items-center justify-center">
              <Text className="font-sans text-[#94a3b8] text-[12px]">
                Nenhum trial expirando nos próximos 7 dias.
              </Text>
            </View>
          ) : (
            <View className="gap-2.5">
              {upcomingTrials.map((psi) => {
                const expires = new Date(psi.planExpiresAt);
                const diffDays = Math.ceil((expires.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                const daysColor = diffDays <= 2 ? '#ef4444' : '#f59e0b';
                const prob = psi.probability !== undefined && psi.probability !== null ? psi.probability : 50;
                const probColor = prob >= 70 ? '#10b981' : prob >= 40 ? '#f59e0b' : '#ef4444';

                return (
                  <View
                    key={psi.id}
                    className="bg-white rounded-2xl p-4 border border-[#e2e8f0]"
                    style={{
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.03,
                      shadowRadius: 5,
                      elevation: 1,
                    }}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2.5 flex-1 mr-2">
                        <View
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 999,
                            backgroundColor: '#ecfdf5',
                            borderWidth: 1.5,
                            borderColor: '#a7f3d0',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text className="font-title text-[#166534] text-[16px] font-bold">
                            {(psi.nome || '?').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View className="flex-1">
                          <Text className="font-title text-[#0f172a] text-[14px]">
                            {psi.nome || 'Psicólogo sem nome'}
                          </Text>
                          <Text className="font-sans text-[#64748b] text-[11px] mt-0.5">
                            {psi.telefone || 'Sem telefone cadastrado'}
                          </Text>
                        </View>
                      </View>

                      <View
                        className="px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: `${daysColor}15`, borderWidth: 1, borderColor: `${daysColor}40` }}
                      >
                        <Text className="font-sans font-extrabold text-[11px]" style={{ color: daysColor }}>
                          {diffDays <= 0 ? 'Expira hoje' : `Expira em ${diffDays}d`}
                        </Text>
                      </View>
                    </View>

                    {/* Chance e Razão de IA */}
                    <View className="flex-row items-center justify-between mt-3 pt-2 border-t border-slate-100">
                      <View className="flex-row items-center gap-1.5 flex-1 mr-2">
                        <Text className="font-sans text-[11px] text-[#64748b]">Chance de conversão:</Text>
                        <Text className="font-sans font-bold text-[12px]" style={{ color: probColor }}>
                          {prob}% {psi.ai_powered ? '✨' : ''}
                        </Text>
                      </View>

                      {psi.admin_billing_sent_at ? (
                        <View className="bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
                          <Text className="font-sans font-bold text-[10px] text-indigo-700">✅ Contatado</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => handleContactTrial(psi)}
                          activeOpacity={0.8}
                          className="flex-row items-center bg-[#25D366] px-3.5 py-1.5 rounded-full active:opacity-90"
                        >
                          <Feather name="message-circle" size={13} color="white" />
                          <Text className="text-white font-sans font-bold text-[11px] ml-1">Chamar</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ========================================================= */}
        {/* BLOCO 5: DEMANDA X RETENÇÃO (PMF V3)                      */}
        {/* ========================================================= */}
        <View className="mb-4">
          <Text className="font-title text-[#111827] text-[16px] mb-1">
            Demanda × Retenção
          </Text>
          <Text className="font-sans text-[#64748b] text-[11px] mb-3">
            Relação entre contatos recebidos e evasão de psicólogos.
          </Text>

          <View
            className="bg-white rounded-2xl border border-[#e2e8f0] overflow-hidden"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.03,
              shadowRadius: 5,
              elevation: 1,
            }}
          >
            {/* Header da Tabela */}
            <View className="flex-row items-center bg-slate-50 px-3.5 py-2.5 border-b border-slate-200">
              <Text className="flex-2 font-sans font-bold text-[11px] text-[#475569]">Grupo</Text>
              <Text className="flex-1 font-sans font-bold text-[11px] text-[#475569] text-center">Base</Text>
              <Text className="flex-1 font-sans font-bold text-[11px] text-[#475569] text-center">Ativos</Text>
              <Text className="flex-1 font-sans font-bold text-[11px] text-[#475569] text-right">Churn</Text>
            </View>

            {pmfRows.length === 0 ? (
              <View className="p-4 items-center justify-center">
                <Text className="font-sans text-[#94a3b8] text-[12px]">Carregando correlação PMF...</Text>
              </View>
            ) : (
              pmfRows.map((row, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => handleOpenDrilldown(row.contact_group, `Grupo PMF: ${row.contact_group}`)}
                  activeOpacity={0.7}
                  className={`flex-row items-center px-3.5 py-3 ${
                    idx < pmfRows.length - 1 ? 'border-b border-slate-100' : ''
                  }`}
                >
                  <View className="flex-2 flex-row items-center gap-1">
                    <Text className="font-sans font-bold text-[12px] text-[#1e293b]">
                      {row.contact_group}
                    </Text>
                    <Feather name="chevron-right" size={12} color="#94a3b8" />
                  </View>
                  <Text className="flex-1 font-sans text-[12px] text-[#475569] text-center">
                    {row.total_psis}
                  </Text>
                  <Text className="flex-1 font-sans font-bold text-[12px] text-emerald-600 text-center">
                    {row.active_psis}
                  </Text>
                  <View className="flex-1 items-end">
                    <Text className="font-sans font-bold text-[12px] text-rose-600">
                      {row.churn_rate}%
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>

        {/* ========================================================= */}
        {/* BLOCO 6: BÚSSOLA DE ESCALA & UNIT ECONOMICS               */}
        {/* ========================================================= */}
        <View className="mb-4">
          <Text className="font-title text-[#111827] text-[16px] mb-3">
            Economia Unitária (Unit Economics)
          </Text>

          {/* Card Bússola de Escala */}
          <View
            className="bg-[#f0fdf4] rounded-2xl p-4 mb-3 border border-[#bbf7d0]"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.03,
              shadowRadius: 5,
              elevation: 1,
            }}
          >
            <View className="flex-row items-center justify-between mb-1.5">
              <View className="flex-row items-center gap-1.5">
                <Text className="text-[14px]">💡</Text>
                <Text className="font-title text-[#166534] text-[13px]">Bússola de Escala (B2C)</Text>
              </View>
              <View className="bg-[#dcfce7] px-2 py-0.5 rounded-full border border-[#86efac]">
                <Text className="font-sans font-bold text-[10px] text-[#166534]">Fixo: R$ 26,88/psi</Text>
              </View>
            </View>
            <Text className="font-title text-[#166534] text-[15px] mb-1">
              {bussolaInfo.title}
            </Text>
            <Text className="font-sans text-[#15803d] text-[11px] leading-relaxed">
              {bussolaInfo.reason}
            </Text>
          </View>

          {/* Grid de Métricas de CAC & LTV */}
          <View className="flex-row flex-wrap gap-2.5">
            {/* CAC B2B */}
            <View className="flex-1 min-w-[145px] bg-white rounded-2xl p-3.5 border border-[#e2e8f0]">
              <Text className="font-sans font-bold text-[#64748b] text-[10px] uppercase">CAC Psicólogos (B2B)</Text>
              <Text className="font-title text-[#1e293b] text-[18px] mt-0.5">
                {marketing?.spendByChannel?.['Meta Ads'] && (acquisition?.trialsIniciados || overview?.novosPagantes)
                  ? formatBRL(
                      (marketing.spendByChannel['Meta Ads'] || 0) /
                        (acquisition?.trialsIniciados || overview?.novosPagantes || 1)
                    )
                  : 'N/D'}
              </Text>
              <Text className="font-sans text-[#94a3b8] text-[10px] mt-1">
                Gasto Meta: {formatBRL(marketing?.spendByChannel?.['Meta Ads'])}
              </Text>
            </View>

            {/* CAC B2C */}
            <View className="flex-1 min-w-[145px] bg-white rounded-2xl p-3.5 border border-[#e2e8f0]">
              <Text className="font-sans font-bold text-[#64748b] text-[10px] uppercase">CAC Demanda (B2C)</Text>
              <Text className="font-title text-[#1e293b] text-[18px] mt-0.5">
                {marketing?.spendByChannel?.['Google Ads'] && demand?.funnel?.contatos
                  ? formatBRL(
                      (marketing.spendByChannel['Google Ads'] || 0) / (demand.funnel.contatos || 1)
                    )
                  : 'N/D'}
              </Text>
              <Text className="font-sans text-[#94a3b8] text-[10px] mt-1">
                Gasto Google: {formatBRL(marketing?.spendByChannel?.['Google Ads'])}
              </Text>
            </View>

            {/* LTV Projetado */}
            <View className="flex-1 min-w-[145px] bg-white rounded-2xl p-3.5 border border-[#e2e8f0]">
              <Text className="font-sans font-bold text-[#64748b] text-[10px] uppercase">LTV Projetado</Text>
              <Text className="font-title text-[#8b5cf6] text-[18px] mt-0.5">
                {marketing?.ltvProjetado ? formatBRL(marketing.ltvProjetado) : 'N/D'}
              </Text>
              <Text className="font-sans text-[#94a3b8] text-[10px] mt-1">
                {marketing?.weightedChurnRate ? `Taxa churn: ${(marketing.weightedChurnRate * 100).toFixed(1)}%` : 'Base inicial curta'}
              </Text>
            </View>

            {/* LTV Observado */}
            <View className="flex-1 min-w-[145px] bg-white rounded-2xl p-3.5 border border-[#e2e8f0]">
              <Text className="font-sans font-bold text-[#64748b] text-[10px] uppercase">LTV Observado</Text>
              <Text className="font-title text-[#10b981] text-[18px] mt-0.5">
                {marketing?.ltvObservado ? formatBRL(marketing.ltvObservado) : 'N/D'}
              </Text>
              <Text className="font-sans text-[#94a3b8] text-[10px] mt-1">Histórico completo</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ========================================================= */}
      {/* MODAL 1: DRILL-DOWN DE PSICÓLOGOS (SEM DEMANDA / GRUPO)   */}
      {/* ========================================================= */}
      <Modal
        visible={drilldownVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDrilldownVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View
            className="bg-white rounded-t-3xl max-h-[85%] border-t border-slate-200"
            style={{ paddingBottom: Math.max(insets.bottom, 20) }}
          >
            {/* Header do Bottom Sheet */}
            <View className="px-5 pt-4 pb-3 border-b border-slate-100 flex-row items-center justify-between">
              <View className="flex-1 mr-3">
                <Text className="font-title text-[#0f172a] text-[16px]">{drilldownTitle}</Text>
                <Text className="font-sans text-[#64748b] text-[12px]">
                  {drilldownPsis.length} {drilldownPsis.length === 1 ? 'profissional' : 'profissionais'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setDrilldownVisible(false)}
                className="bg-slate-100 p-2 rounded-full active:bg-slate-200"
              >
                <Feather name="x" size={18} color="#475569" />
              </TouchableOpacity>
            </View>

            {/* Conteúdo do Drilldown */}
            {drilldownLoading ? (
              <View className="p-8 items-center justify-center">
                <ActivityIndicator size="large" color="#1B4332" />
                <Text className="font-sans text-[#64748b] text-[12px] mt-3">Carregando psicólogos...</Text>
              </View>
            ) : drilldownPsis.length === 0 ? (
              <View className="p-8 items-center justify-center">
                <Text className="font-sans text-[#94a3b8] text-[13px]">Nenhum psicólogo encontrado neste grupo.</Text>
              </View>
            ) : (
              <ScrollView className="p-5" showsVerticalScrollIndicator={false}>
                <View className="gap-3">
                  {drilldownPsis.map((psi) => (
                    <View
                      key={psi.id}
                      className="bg-slate-50 p-4 rounded-2xl border border-slate-200"
                    >
                      <View className="flex-row items-center justify-between mb-2">
                        <View className="flex-row items-center gap-2.5 flex-1 mr-2">
                          <View
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 999,
                              backgroundColor: '#ecfdf5',
                              borderWidth: 1.5,
                              borderColor: '#a7f3d0',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Text className="font-title text-[#166534] text-[16px] font-bold">
                              {(psi.nome || '?').charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <View className="flex-1">
                            <Text className="font-title text-[#0f172a] text-[15px]">{psi.nome}</Text>
                            <Text className="font-sans text-[#64748b] text-[11px] mt-0.5">
                              {psi.plano ? `Plano ${psi.plano}` : 'Em Trial'} • Ativo há {Math.floor(psi.days_active || 0)}d
                            </Text>
                          </View>
                        </View>
                        <View className="bg-white px-2.5 py-1 rounded-full border border-slate-200">
                          <Text className="font-sans font-bold text-[10px] text-slate-700">
                            {psi.total_contacts !== undefined ? `${psi.total_contacts} contatos` : '0 contatos'}
                          </Text>
                        </View>
                      </View>

                      {/* Botões de Ação Rápida */}
                      <View className="flex-row items-center gap-2 mt-2">
                        <TouchableOpacity
                          onPress={() => handleContactPsi(psi)}
                          activeOpacity={0.8}
                          className="flex-1 bg-[#25D366] flex-row items-center justify-center py-2.5 rounded-full active:opacity-90"
                        >
                          <Feather name="message-circle" size={14} color="white" />
                          <Text className="text-white font-sans font-bold text-[12px] ml-1.5">WhatsApp</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => {
                            setDrilldownVisible(false);
                            router.navigate('/(admin)/crm-modulo/psicologos');
                          }}
                          activeOpacity={0.8}
                          className="flex-1 bg-white border border-slate-300 flex-row items-center justify-center py-2.5 rounded-full active:bg-slate-100"
                        >
                          <Feather name="user" size={14} color="#0f172a" />
                          <Text className="text-[#0f172a] font-sans font-bold text-[12px] ml-1.5">Visão 360° CS</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 2: IA DEEP DIVE INSIGHTS                            */}
      {/* ========================================================= */}
      <Modal
        visible={aiModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAiModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View
            className="bg-white rounded-t-3xl max-h-[85%] border-t border-slate-200"
            style={{ paddingBottom: Math.max(insets.bottom, 20) }}
          >
            <View className="px-5 pt-4 pb-3 border-b border-slate-100 flex-row items-center justify-between">
              <View className="flex-row items-center gap-2 flex-1 mr-3">
                <Text className="text-[18px]">✨</Text>
                <Text className="font-title text-[#0f172a] text-[16px]">Inteligência de Crescimento</Text>
              </View>
              <TouchableOpacity
                onPress={() => setAiModalVisible(false)}
                className="bg-slate-100 p-2 rounded-full active:bg-slate-200"
              >
                <Feather name="x" size={18} color="#475569" />
              </TouchableOpacity>
            </View>

            {aiLoading ? (
              <View className="p-10 items-center justify-center">
                <ActivityIndicator size="large" color="#8b5cf6" />
                <Text className="font-sans text-[#64748b] text-[13px] mt-3">
                  Cruzando dados de funil, CAC e retenção com o modelo de IA...
                </Text>
              </View>
            ) : (
              <ScrollView className="p-5" showsVerticalScrollIndicator={false}>
                <View className="bg-purple-50/60 p-4 rounded-2xl border border-purple-100 mb-4">
                  <Text className="font-sans text-[#334155] text-[13px] leading-relaxed">
                    {aiInsightsText}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setAiModalVisible(false)}
                  className="bg-[#1B4332] py-3 rounded-full items-center active:opacity-90"
                >
                  <Text className="text-white font-sans font-bold text-[13px]">Entendido</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
