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
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../../services/api';
import NativeSelectMenu from '../../../components/NativeSelectMenu';

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
      `Olá, ${psi.nome}! Tudo bem?\n\nAqui é da equipe de Sucesso da Yelo. Estou acompanhando os resultados da sua página na plataforma e notei que você ainda não recebeu novos contatos de pacientes nos últimos dias. Gostaria de te ajudar a calibrar suas tags e fotos para maximizar suas indicações!`
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
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <StatusBar style="dark" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 150, // respiro premium para a bottom nav fixa
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
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <TouchableOpacity
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(admin)/crm'))}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#ffffff',
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: '#e2e8f0',
              shadowColor: '#000',
              shadowOpacity: 0.03,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 1 },
              elevation: 1,
            }}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={16} color="#1B4332" />
            <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#1B4332', fontSize: 12, marginLeft: 6 }}>CRM Hub</Text>
          </TouchableOpacity>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#ecfdf5',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: '#a7f3d0',
              gap: 4,
            }}
          >
            <Text style={{ fontSize: 11 }}>🛡️</Text>
            <Text style={{ fontFamily: 'Inter_700Bold', color: '#166534', fontSize: 11 }}>Admin Growth</Text>
          </View>
        </View>

        {/* ========================================================= */}
        {/* HERO CARD VERDE COM GRADIENTE E BORDAS ARREDONDADAS       */}
        {/* ========================================================= */}
        <LinearGradient
          colors={['#1B4332', '#2A5A40']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 24,
            padding: 22,
            marginBottom: 16,
            shadowColor: '#1B4332',
            shadowOpacity: 0.14,
            shadowRadius: 30,
            shadowOffset: { width: 0, height: 10 },
            elevation: 5,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Efeito decorativo de fundo */}
          <View
            style={{
              position: 'absolute',
              top: -50,
              right: -50,
              width: 200,
              height: 200,
              borderRadius: 100,
              backgroundColor: 'rgba(255,255,255,0.05)',
            }}
            pointerEvents="none"
          />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#ffffff', fontSize: 24, lineHeight: 32, paddingTop: 4, marginBottom: 4 }}>
                Growth 📈
              </Text>
              <Text style={{ fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.85)', fontSize: 12, lineHeight: 18 }}>
                Visão executiva de aquisição, conversão, retenção e economia do Yelo.
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => fetchGrowthData(false)}
              disabled={loading}
              activeOpacity={0.8}
              style={{
                backgroundColor: '#FFEE8C',
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                shadowColor: '#000',
                shadowOpacity: 0.1,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 2 },
                elevation: 2,
              }}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#1B4332" />
              ) : (
                <>
                  <Feather name="refresh-cw" size={13} color="#1B4332" />
                  <Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 12 }}>Atualizar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Sub-ações do Header */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: 'rgba(255,255,255,0.15)',
            }}
          >
            <Text style={{ fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>
              Atualizado às {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </Text>

            <TouchableOpacity
              onPress={handleExportCSV}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.12)',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.25)',
                gap: 6,
              }}
            >
              <Feather name="download" size={12} color="#ffffff" />
              <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#ffffff', fontSize: 11 }}>Exportar CSV</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* ========================================================= */}
        {/* SELETOR DE PERÍODO VIA DROPDOWN (SEM SCROLL HORIZONTAL)   */}
        {/* ========================================================= */}
        <View style={{ marginBottom: 16 }}>
          <NativeSelectMenu
            title="Selecionar Período de Análise"
            options={[
              { label: 'Últimos 7 dias', value: '7' },
              { label: 'Últimos 30 dias (Padrão)', value: '30' },
              { label: 'Últimos 3 meses (90 dias)', value: '90' },
              { label: 'Últimos 6 meses (180 dias)', value: '180' },
              { label: 'Últimos 12 meses (1 ano)', value: '365' },
            ]}
            selectedValue={String(selectedPeriod)}
            onSelect={(val) => setSelectedPeriod(Number(val))}
            style={{ width: '100%' }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#ffffff',
                borderWidth: 1,
                borderColor: '#e2e8f0',
                borderRadius: 999,
                paddingHorizontal: 16,
                paddingVertical: 10,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.03,
                shadowRadius: 3,
                elevation: 1,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Feather name="clock" size={15} color="#1B4332" />
                <Text style={{ fontFamily: 'Inter_500Medium', color: '#64748b', fontSize: 12 }}>
                  Janela de Análise:
                </Text>
                <Text
                  style={{
                    fontFamily: 'Inter_700Bold',
                    color: '#1B4332',
                    fontSize: 13,
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  {selectedPeriod === 7
                    ? '7 dias'
                    : selectedPeriod === 30
                    ? '30 dias'
                    : selectedPeriod === 90
                    ? '3 meses'
                    : selectedPeriod === 180
                    ? '6 meses'
                    : '12 meses'}
                </Text>
              </View>
              <Feather name="chevron-down" size={16} color="#1B4332" />
            </View>
          </NativeSelectMenu>
        </View>

        {/* ========================================================= */}
        {/* BLOCO 1: DIAGNÓSTICO AUTOMÁTICO (IA & REGRAS)             */}
        {/* ========================================================= */}
        <View
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            padding: 16,
            marginBottom: 16,
            shadowColor: '#000',
            shadowOpacity: 0.03,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 1,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 16 }}>🤖</Text>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#0f172a', fontSize: 16 }}>
                Diagnóstico
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleGenerateAIInsights}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#e8f5e9',
                borderWidth: 1,
                borderColor: '#c8e6c9',
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderRadius: 999,
                gap: 4,
              }}
            >
              <Feather name="zap" size={11} color="#1B4332" />
              <Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 11 }}>IA Deep Dive</Text>
            </TouchableOpacity>
          </View>

          <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 11, marginBottom: 12 }}>
            Alertas automáticos baseados nos dados do período selecionado.
          </Text>

          {diagnostics.length === 0 ? (
            <Text style={{ fontFamily: 'Inter_400Regular', color: '#94a3b8', fontSize: 12, fontStyle: 'italic' }}>
              Carregando indicadores para diagnóstico...
            </Text>
          ) : (
            <View style={{ gap: 8 }}>
              {diagnostics.map((bullet, idx) => (
                <View
                  key={idx}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    backgroundColor: '#f8fafc',
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: '#edf2f7',
                  }}
                >
                  <Text style={{ fontFamily: 'Inter_400Regular', color: '#334155', fontSize: 12, lineHeight: 18, flex: 1 }}>
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
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#111827', fontSize: 16, marginBottom: 10 }}>
            Primeira Viewport: Decisão Executiva
          </Text>

          {/* Grid de KPIs executivos com Accent Stripe Interna (Zero Vazamento) */}
          <View style={{ gap: 12 }}>
            {/* 1. Crescimento MRR */}
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                padding: 16,
                overflow: 'hidden',
                shadowColor: '#000',
                shadowOpacity: 0.03,
                shadowOffset: { width: 0, height: 2 },
                shadowRadius: 6,
                elevation: 1,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Crescimento (MRR)
                </Text>
                <Feather name="trending-up" size={14} color="#10b981" />
              </View>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#10b981', fontSize: 24, marginVertical: 2 }}>
                {formatBRL(overview?.mrrTotal)}
              </Text>
              <View style={{ height: 1, backgroundColor: '#f1f5f9', marginVertical: 8 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: (overview?.netNewMrr || 0) >= 0 ? '#059669' : '#dc2626' }}>
                  {(overview?.netNewMrr || 0) >= 0 ? '+' : ''}
                  {formatBRL(overview?.netNewMrr)} Net New MRR
                </Text>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: '#94a3b8' }}>
                  vs {formatBRL(overview?.mrrAnterior)} ant.
                </Text>
              </View>
            </View>

            {/* 2. Aquisição */}
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                padding: 16,
                overflow: 'hidden',
                shadowColor: '#000',
                shadowOpacity: 0.03,
                shadowOffset: { width: 0, height: 2 },
                shadowRadius: 6,
                elevation: 1,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Aquisição
                </Text>
                <Feather name="user-plus" size={14} color="#3b82f6" />
              </View>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#3b82f6', fontSize: 24, marginVertical: 2 }}>
                {overview?.novosPagantes || 0}
              </Text>
              <View style={{ height: 1, backgroundColor: '#f1f5f9', marginVertical: 8 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#1d4ed8' }}>
                  {(overview?.trialConversionRate || 0).toFixed(1)}% conv. de trial
                </Text>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: '#94a3b8' }}>
                  ({overview?.trialsAtivos || 0} trials ativos)
                </Text>
              </View>
            </View>

            {/* 3. Health Rate (Com Demanda) */}
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                padding: 16,
                overflow: 'hidden',
                shadowColor: '#000',
                shadowOpacity: 0.03,
                shadowOffset: { width: 0, height: 2 },
                shadowRadius: 6,
                elevation: 1,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Health Rate (% com demanda)
                </Text>
                <Feather name="activity" size={14} color="#1B4332" />
              </View>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 24, marginVertical: 2 }}>
                {(overview?.pctDemanda || 0).toFixed(1)}%
              </Text>
              <View style={{ height: 1, backgroundColor: '#f1f5f9', marginVertical: 8 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#1B4332' }}>
                  {overview?.pagantesComDemandaCount || 0} de {overview?.totalAtivos || 0} com contatos
                </Text>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: '#64748b' }}>
                  Mediana: {acquisition?.timeToFirstContact?.medianDays !== null && acquisition?.timeToFirstContact?.medianDays !== undefined ? `${acquisition.timeToFirstContact.medianDays}d` : 'N/D'}
                </Text>
              </View>
            </View>

            {/* 4. Ação: Sem Demanda (Com Drill-Down) */}
            <TouchableOpacity
              onPress={() => handleOpenDrilldown('sem_demanda_cs', 'Psicólogos Sem Demanda (Risco de Evasão)')}
              activeOpacity={0.8}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                padding: 16,
                overflow: 'hidden',
                shadowColor: '#000',
                shadowOpacity: 0.03,
                shadowOffset: { width: 0, height: 2 },
                shadowRadius: 6,
                elevation: 1,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontFamily: 'Inter_700Bold', color: '#b45309', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Ação: Sem Demanda
                  </Text>
                  <Feather name="external-link" size={12} color="#b45309" />
                </View>
                <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#92400e' }}>Toque p/ ver lista</Text>
                </View>
              </View>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#d97706', fontSize: 24, marginVertical: 2 }}>
                {overview?.pagantesSemDemandaCount || 0}
              </Text>
              <View style={{ height: 1, backgroundColor: '#f1f5f9', marginVertical: 8 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#b45309' }}>
                  {formatBRL(overview?.mrrSemDemanda)} MRR em risco
                </Text>
                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#d97706' }}>
                  Ver detalhes ↗
                </Text>
              </View>
            </TouchableOpacity>

            {/* 5. Retenção (Churn Financeiro) */}
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                padding: 16,
                overflow: 'hidden',
                shadowColor: '#000',
                shadowOpacity: 0.03,
                shadowOffset: { width: 0, height: 2 },
                shadowRadius: 6,
                elevation: 1,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Retenção (Churn Financeiro)
                </Text>
                <Feather name="user-x" size={14} color="#ef4444" />
              </View>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#ef4444', fontSize: 24, marginVertical: 2 }}>
                {overview?.churnPagantes || 0}
              </Text>
              <View style={{ height: 1, backgroundColor: '#f1f5f9', marginVertical: 8 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#be123c' }}>
                  {(overview?.taxaChurnPagantes || 0).toFixed(1)}% da base
                </Text>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#e11d48' }}>
                  - {formatBRL(overview?.mrrPerdido)} perdido
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ========================================================= */}
        {/* BLOCO 3: OS DOIS FUNIS (B2C PACIENTES & B2B PSICÓLOGOS)    */}
        {/* ========================================================= */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#111827', fontSize: 16, marginBottom: 10 }}>
            Funis de Conversão
          </Text>

          {/* Funil 1: Pacientes (B2C) */}
          <View
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#e2e8f0',
              padding: 18,
              marginBottom: 12,
              shadowColor: '#000',
              shadowOpacity: 0.03,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              elevation: 1,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#111827', fontSize: 15 }}>
                Jornada dos Pacientes (B2C)
              </Text>
              <View style={{ backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#bae6fd', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 999 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#0369a1' }}>Tráfego & Demanda</Text>
              </View>
            </View>
            <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 11, marginBottom: 14 }}>
              Da visita no site até o clique no WhatsApp do psicólogo.
            </Text>

            <View style={{ gap: 10 }}>
              {/* Etapa 1: Visitas */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name="globe" size={14} color="#64748b" />
                  <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#475569', fontSize: 12 }}>Visitas no Site</Text>
                </View>
                <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 15 }}>{funnelB2C.visitas}</Text>
              </View>

              {/* Etapa 2: Questionários Iniciados */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name="play-circle" size={14} color="#64748b" />
                  <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#475569', fontSize: 12 }}>Buscas Iniciadas</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 15 }}>{funnelB2C.iniciados}</Text>
                  <View style={{ backgroundColor: '#ecfdf5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#047857' }}>{funnelB2C.convIniciados}</Text>
                  </View>
                </View>
              </View>

              {/* Etapa 3: Questionários Concluídos */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name="check-circle" size={14} color="#64748b" />
                  <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#475569', fontSize: 12 }}>Buscas Concluídas</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 15 }}>{funnelB2C.concluidos}</Text>
                  <View style={{ backgroundColor: '#ecfdf5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#047857' }}>{funnelB2C.convConcluidos}</Text>
                  </View>
                </View>
              </View>

              {/* Etapa 4: Indicados na Vitrine */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name="users" size={14} color="#64748b" />
                  <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#475569', fontSize: 12 }}>Indicados (Vitrine)</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 15 }}>{funnelB2C.matches}</Text>
                  <View style={{ backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#1d4ed8' }}>{funnelB2C.psisPorBusca}</Text>
                  </View>
                </View>
              </View>

              {/* Etapa 5: Cliques no WhatsApp */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name="message-circle" size={15} color="#25D366" />
                  <Text style={{ fontFamily: 'Inter_700Bold', color: '#1e293b', fontSize: 13 }}>Cliques WhatsApp</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#25D366', fontSize: 16 }}>{funnelB2C.contatos}</Text>
                  <View style={{ backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#166534' }}>{funnelB2C.convContatos}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Funil 2: Aquisição Psicólogos (B2B) */}
          <View
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#e2e8f0',
              padding: 18,
              shadowColor: '#000',
              shadowOpacity: 0.03,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              elevation: 1,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#111827', fontSize: 15 }}>
                Funil de Aquisição B2B
              </Text>
              <View style={{ backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 999 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#047857' }}>Vendas & Conversão</Text>
              </View>
            </View>
            <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 11, marginBottom: 14 }}>
              Conversão de leads prospectados em assinantes da plataforma.
            </Text>

            <View style={{ gap: 10 }}>
              {/* Etapa 1: Leads */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name="target" size={14} color="#64748b" />
                  <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#475569', fontSize: 12 }}>Leads Mapeados</Text>
                </View>
                <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 15 }}>{funnelB2B.leads}</Text>
              </View>

              {/* Etapa 2: Contatados */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name="phone-call" size={14} color="#64748b" />
                  <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#475569', fontSize: 12 }}>Contatados</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 15 }}>{funnelB2B.contatados}</Text>
                  <View style={{ backgroundColor: '#ecfdf5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#047857' }}>{funnelB2B.convContatados}</Text>
                  </View>
                </View>
              </View>

              {/* Etapa 3: Cadastros Trials */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name="user-check" size={14} color="#64748b" />
                  <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#475569', fontSize: 12 }}>Cadastros (Trials)</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 15 }}>{funnelB2B.trials}</Text>
                  <View style={{ backgroundColor: '#ecfdf5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#047857' }}>{funnelB2B.convTrials}</Text>
                  </View>
                </View>
              </View>

              {/* Etapa 4: Pagantes Convertidos */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name="award" size={15} color="#10b981" />
                  <Text style={{ fontFamily: 'Inter_700Bold', color: '#1e293b', fontSize: 13 }}>Pagantes Convertidos</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#10b981', fontSize: 16 }}>{funnelB2B.pagantes}</Text>
                  <View style={{ backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#166534' }}>{funnelB2B.convPagantes}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ========================================================= */}
        {/* BLOCO 4: PRÓXIMOS FINS DE TRIAL (JANELA DE 7 DIAS)        */}
        {/* ========================================================= */}
        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <View>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#111827', fontSize: 16 }}>
                Próximos Fins de Trial (7 dias)
              </Text>
              <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 11, marginTop: 1 }}>
                Psicólogos na janela crítica de conversão B2B.
              </Text>
            </View>
            <View style={{ backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fde68a', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#92400e' }}>
                {upcomingTrials.length} {upcomingTrials.length === 1 ? 'trial' : 'trials'}
              </Text>
            </View>
          </View>

          {upcomingTrials.length === 0 ? (
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                padding: 20,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontFamily: 'Inter_400Regular', color: '#94a3b8', fontSize: 12 }}>
                Nenhum trial expirando nos próximos 7 dias.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {upcomingTrials.map((psi) => {
                const expires = new Date(psi.planExpiresAt);
                const diffDays = Math.ceil((expires.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                const daysColor = diffDays <= 2 ? '#ef4444' : '#f59e0b';
                const prob = psi.probability !== undefined && psi.probability !== null ? psi.probability : 50;
                const probColor = prob >= 70 ? '#10b981' : prob >= 40 ? '#f59e0b' : '#ef4444';

                return (
                  <View
                    key={psi.id}
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: '#e2e8f0',
                      padding: 16,
                      shadowColor: '#000',
                      shadowOpacity: 0.03,
                      shadowRadius: 6,
                      shadowOffset: { width: 0, height: 2 },
                      elevation: 1,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <TouchableOpacity
                        disabled={!psi.id}
                        activeOpacity={0.7}
                        onPress={() =>
                          router.navigate({
                            pathname: '/(admin)/crm-modulo/psicologos',
                            params: { openId: String(psi.id) },
                          })
                        }
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 }}
                      >
                        {/* Foto ou Avatar Redondo */}
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
                          <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#166534', fontSize: 17 }}>
                            {(psi.nome || '?').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#0f172a', fontSize: 14 }}>
                            {psi.nome || 'Psicólogo sem nome'}
                          </Text>
                          <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 11, marginTop: 2 }}>
                            {psi.telefone || 'Sem telefone'}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      <View
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 999,
                          backgroundColor: `${daysColor}15`,
                          borderWidth: 1,
                          borderColor: `${daysColor}35`,
                        }}
                      >
                        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: daysColor }}>
                          {diffDays <= 0 ? 'Expira hoje' : `Expira em ${diffDays}d`}
                        </Text>
                      </View>
                    </View>

                    {/* Chance e Ação WhatsApp */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: 12,
                        paddingTop: 10,
                        borderTopWidth: 1,
                        borderTopColor: '#f1f5f9',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 8 }}>
                        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: '#64748b' }}>Chance de assinar:</Text>
                        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: probColor }}>
                          {prob}% {psi.ai_powered ? '✨' : ''}
                        </Text>
                      </View>

                      {psi.admin_billing_sent_at ? (
                        <View style={{ backgroundColor: '#e0e7ff', borderWidth: 1, borderColor: '#c7d2fe', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 }}>
                          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#4338ca' }}>✅ Contatado</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => handleContactTrial(psi)}
                          activeOpacity={0.8}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: '#25D366',
                            paddingHorizontal: 14,
                            paddingVertical: 6,
                            borderRadius: 999,
                            gap: 5,
                          }}
                        >
                          <Feather name="message-circle" size={13} color="#ffffff" />
                          <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 12 }}>Chamar</Text>
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
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#111827', fontSize: 16, marginBottom: 2 }}>
            Demanda × Retenção
          </Text>
          <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 11, marginBottom: 10 }}>
            Relação entre contatos recebidos e evasão de psicólogos.
          </Text>

          <View
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#e2e8f0',
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOpacity: 0.03,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              elevation: 1,
            }}
          >
            {/* Header da Tabela */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
              <Text style={{ flex: 2, fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569' }}>Grupo</Text>
              <Text style={{ flex: 1, fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569', textAlign: 'center' }}>Base</Text>
              <Text style={{ flex: 1, fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569', textAlign: 'center' }}>Ativos</Text>
              <Text style={{ flex: 1, fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569', textAlign: 'right' }}>Churn</Text>
            </View>

            {pmfRows.length === 0 ? (
              <View style={{ padding: 20, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: 'Inter_400Regular', color: '#94a3b8', fontSize: 12 }}>Carregando correlação PMF...</Text>
              </View>
            ) : (
              pmfRows.map((row, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => handleOpenDrilldown(row.contact_group, `Grupo PMF: ${row.contact_group}`)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    borderBottomWidth: idx < pmfRows.length - 1 ? 1 : 0,
                    borderBottomColor: '#f1f5f9',
                  }}
                >
                  <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#1e293b' }}>
                      {row.contact_group}
                    </Text>
                    <Feather name="chevron-right" size={12} color="#94a3b8" />
                  </View>
                  <Text style={{ flex: 1, fontFamily: 'Inter_500Medium', fontSize: 12, color: '#475569', textAlign: 'center' }}>
                    {row.total_psis}
                  </Text>
                  <Text style={{ flex: 1, fontFamily: 'Inter_700Bold', fontSize: 12, color: '#059669', textAlign: 'center' }}>
                    {row.active_psis}
                  </Text>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#e11d48' }}>
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
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#111827', fontSize: 16, marginBottom: 10 }}>
            Economia Unitária (Unit Economics)
          </Text>

          {/* Card Bússola de Escala */}
          <View
            style={{
              backgroundColor: '#f0fdf4',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#bbf7d0',
              padding: 16,
              marginBottom: 12,
              shadowColor: '#000',
              shadowOpacity: 0.03,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              elevation: 1,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 14 }}>💡</Text>
                <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#166534', fontSize: 14 }}>
                  Bússola de Escala (B2C)
                </Text>
              </View>
              <View style={{ backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#86efac', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#166534' }}>Fixo: R$ 26,88/psi</Text>
              </View>
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#166534', fontSize: 15, marginBottom: 4 }}>
              {bussolaInfo.title}
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', color: '#15803d', fontSize: 11, lineHeight: 17 }}>
              {bussolaInfo.reason}
            </Text>
          </View>

          {/* Grid de Métricas de CAC & LTV */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {/* CAC B2B */}
            <View
              style={{
                flex: 1,
                minWidth: '47%',
                backgroundColor: '#ffffff',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                padding: 14,
              }}
            >
              <Text style={{ fontFamily: 'Inter_700Bold', color: '#64748b', fontSize: 10, textTransform: 'uppercase' }}>
                CAC Psicólogos (B2B)
              </Text>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 18, marginTop: 4 }}>
                {marketing?.spendByChannel?.['Meta Ads'] && (acquisition?.trialsIniciados || overview?.novosPagantes)
                  ? formatBRL(
                      (marketing.spendByChannel['Meta Ads'] || 0) /
                        (acquisition?.trialsIniciados || overview?.novosPagantes || 1)
                    )
                  : 'N/D'}
              </Text>
              <Text style={{ fontFamily: 'Inter_400Regular', color: '#94a3b8', fontSize: 10, marginTop: 4 }}>
                Gasto Meta: {formatBRL(marketing?.spendByChannel?.['Meta Ads'])}
              </Text>
            </View>

            {/* CAC B2C */}
            <View
              style={{
                flex: 1,
                minWidth: '47%',
                backgroundColor: '#ffffff',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                padding: 14,
              }}
            >
              <Text style={{ fontFamily: 'Inter_700Bold', color: '#64748b', fontSize: 10, textTransform: 'uppercase' }}>
                CAC Demanda (B2C)
              </Text>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 18, marginTop: 4 }}>
                {marketing?.spendByChannel?.['Google Ads'] && demand?.funnel?.contatos
                  ? formatBRL(
                      (marketing.spendByChannel['Google Ads'] || 0) / (demand.funnel.contatos || 1)
                    )
                  : 'N/D'}
              </Text>
              <Text style={{ fontFamily: 'Inter_400Regular', color: '#94a3b8', fontSize: 10, marginTop: 4 }}>
                Gasto Google: {formatBRL(marketing?.spendByChannel?.['Google Ads'])}
              </Text>
            </View>

            {/* LTV Projetado */}
            <View
              style={{
                flex: 1,
                minWidth: '47%',
                backgroundColor: '#ffffff',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                padding: 14,
              }}
            >
              <Text style={{ fontFamily: 'Inter_700Bold', color: '#64748b', fontSize: 10, textTransform: 'uppercase' }}>
                LTV Projetado
              </Text>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 18, marginTop: 4 }}>
                {marketing?.ltvProjetado ? formatBRL(marketing.ltvProjetado) : 'N/D'}
              </Text>
              <Text style={{ fontFamily: 'Inter_400Regular', color: '#94a3b8', fontSize: 10, marginTop: 4 }}>
                {marketing?.weightedChurnRate ? `Taxa churn: ${(marketing.weightedChurnRate * 100).toFixed(1)}%` : 'Base inicial curta'}
              </Text>
            </View>

            {/* LTV Observado */}
            <View
              style={{
                flex: 1,
                minWidth: '47%',
                backgroundColor: '#ffffff',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                padding: 14,
              }}
            >
              <Text style={{ fontFamily: 'Inter_700Bold', color: '#64748b', fontSize: 10, textTransform: 'uppercase' }}>
                LTV Observado
              </Text>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#10b981', fontSize: 18, marginTop: 4 }}>
                {marketing?.ltvObservado ? formatBRL(marketing.ltvObservado) : 'N/D'}
              </Text>
              <Text style={{ fontFamily: 'Inter_400Regular', color: '#94a3b8', fontSize: 10, marginTop: 4 }}>
                Histórico completo
              </Text>
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
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: '#ffffff',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: '85%',
              borderTopWidth: 1,
              borderTopColor: '#e2e8f0',
              paddingBottom: Math.max(insets.bottom, 20),
            }}
          >
            {/* Header do Bottom Sheet */}
            <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#0f172a', fontSize: 16 }}>{drilldownTitle}</Text>
                <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 12, marginTop: 2 }}>
                  {drilldownPsis.length} {drilldownPsis.length === 1 ? 'profissional' : 'profissionais'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setDrilldownVisible(false)}
                activeOpacity={0.7}
                style={{
                  backgroundColor: '#f1f5f9',
                  padding: 8,
                  borderRadius: 999,
                }}
              >
                <Feather name="x" size={18} color="#475569" />
              </TouchableOpacity>
            </View>

            {/* Conteúdo do Drilldown */}
            {drilldownLoading ? (
              <View style={{ padding: 40, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color="#1B4332" />
                <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 12, marginTop: 12 }}>Carregando psicólogos...</Text>
              </View>
            ) : drilldownPsis.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: 'Inter_400Regular', color: '#94a3b8', fontSize: 13 }}>Nenhum psicólogo encontrado neste grupo.</Text>
              </View>
            ) : (
              <ScrollView style={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                <View style={{ gap: 12 }}>
                  {drilldownPsis.map((psi) => (
                    <View
                      key={psi.id}
                      style={{
                        backgroundColor: '#f8fafc',
                        padding: 16,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: '#e2e8f0',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 }}>
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
                            <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#166534', fontSize: 17 }}>
                              {(psi.nome || '?').charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#0f172a', fontSize: 15 }}>{psi.nome}</Text>
                            <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 11, marginTop: 2 }}>
                              {psi.plano ? `Plano ${psi.plano}` : 'Em Trial'} • Ativo há {Math.floor(psi.days_active || 0)}d
                            </Text>
                          </View>
                        </View>
                        <View style={{ backgroundColor: '#ffffff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: '#e2e8f0' }}>
                          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#334155' }}>
                            {psi.total_contacts !== undefined ? `${psi.total_contacts} contatos` : '0 contatos'}
                          </Text>
                        </View>
                      </View>

                      {/* Botões de Ação Rápida */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <TouchableOpacity
                          onPress={() => handleContactPsi(psi)}
                          activeOpacity={0.8}
                          style={{
                            flex: 1,
                            backgroundColor: '#25D366',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingVertical: 10,
                            borderRadius: 999,
                            gap: 6,
                          }}
                        >
                          <Feather name="message-circle" size={14} color="#ffffff" />
                          <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 12 }}>WhatsApp</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => {
                            setDrilldownVisible(false);
                            router.navigate(
                              psi.id
                                ? { pathname: '/(admin)/crm-modulo/psicologos', params: { openId: String(psi.id) } }
                                : '/(admin)/crm-modulo/psicologos'
                            );
                          }}
                          activeOpacity={0.8}
                          style={{
                            flex: 1,
                            backgroundColor: '#ffffff',
                            borderWidth: 1,
                            borderColor: '#cbd5e1',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingVertical: 10,
                            borderRadius: 999,
                            gap: 6,
                          }}
                        >
                          <Feather name="user" size={14} color="#0f172a" />
                          <Text style={{ fontFamily: 'Inter_700Bold', color: '#0f172a', fontSize: 12 }}>Visão 360° CS</Text>
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
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: '#ffffff',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: '85%',
              borderTopWidth: 1,
              borderTopColor: '#e2e8f0',
              paddingBottom: Math.max(insets.bottom, 20),
            }}
          >
            <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 12 }}>
                <Text style={{ fontSize: 18 }}>✨</Text>
                <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#0f172a', fontSize: 16 }}>Inteligência de Crescimento</Text>
              </View>
              <TouchableOpacity
                onPress={() => setAiModalVisible(false)}
                activeOpacity={0.7}
                style={{
                  backgroundColor: '#f1f5f9',
                  padding: 8,
                  borderRadius: 999,
                }}
              >
                <Feather name="x" size={18} color="#475569" />
              </TouchableOpacity>
            </View>

            {aiLoading ? (
              <View style={{ padding: 40, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color="#1B4332" />
                <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 13, marginTop: 12 }}>
                  Cruzando dados de funil, CAC e retenção com o modelo de IA...
                </Text>
              </View>
            ) : (
              <ScrollView style={{ padding: 20 }} showsVerticalScrollIndicator={false}>
                <View style={{ backgroundColor: '#f0fdf4', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#bbf7d0', marginBottom: 16 }}>
                  <Text style={{ fontFamily: 'Inter_400Regular', color: '#334155', fontSize: 13, lineHeight: 20 }}>
                    {aiInsightsText}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setAiModalVisible(false)}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: '#1B4332',
                    paddingVertical: 12,
                    borderRadius: 999,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 13 }}>Entendido</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
