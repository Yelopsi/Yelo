import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Share,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import api from '../../../services/api';
import YeloToast from '../../../components/YeloToast';
import NativeSelectMenu from '../../../components/NativeSelectMenu';

type FunilTab = 'funil' | 'conversoes' | 'ranking' | 'auditoria' | 'v6';

export default function AdminAnalyticsFunilScreen() {
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<FunilTab>('funil');
  const [periodDays, setPeriodDays] = useState<number>(30);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Dados das APIs
  const [funnelData, setFunnelData] = useState<any>(null);
  const [wppData, setWppData] = useState<any[]>([]);
  const [prevWppData, setPrevWppData] = useState<any[]>([]);
  const [wppDays, setWppDays] = useState<number>(30);
  const [rankingData, setRankingData] = useState<any[]>([]);
  const [auditoriaData, setAuditoriaData] = useState<any[]>([]);
  const [isAuditoriaLoading, setIsAuditoriaLoading] = useState(false);
  const [v6Data, setV6Data] = useState<any>(null);

  // Filtros da aba de conversões
  const [wppSearch, setWppSearch] = useState<string>('');
  const [wppStatusFilter, setWppStatusFilter] = useState<string>('todos');
  const [wppPage, setWppPage] = useState<number>(1);
  const itemsPerPage = 10;

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  // Mapeamento das perguntas do questionário
  const stepNames: Record<string, { label: string; question: string; isLegacy?: boolean }> = {
    idade: { label: 'Faixa Etária', question: 'Para começarmos, qual a sua faixa etária?' },
    responsavel_menor: { label: 'Responsável Legal', question: 'Você é o responsável legal por este paciente?' },
    pref_genero_prof: { label: 'Preferência de Gênero', question: 'Você tem preferência pelo gênero do(a) profissional?' },
    temas: { label: 'Motivo da Busca (Temas)', question: 'O que te motivou a procurar terapia agora?' },
    abordagem_ideal: { label: 'Estilo de Terapia (Abordagem)', question: 'Como o terapeuta poderia te ajudar melhor?' },
    caracteristicas_prof: { label: 'Características do Profissional', question: 'Existem características importantes para você?' },
    faixa_valor: { label: 'Faixa de Investimento / Preço', question: 'Qual a faixa de valor que você pode investir por sessão?' },
    modalidade_atendimento: { label: 'Modalidade de Atendimento', question: 'Como você prefere ser atendido(a)? (Online/Presencial)' },
    cep: { label: 'Localização (CEP)', question: 'Qual o seu CEP?' },
    final: { label: 'Geração de Resultados (Final)', question: 'Tudo pronto! Analisando respostas e gerando recomendações' },
    nome: { label: 'Preenchimento do Nome', question: 'Qual é o seu nome? (Etapa legada)', isLegacy: true },
    contato: { label: 'Preenchimento do Contato', question: 'Contato final (Etapa legada)', isLegacy: true },
    intro: { label: 'Página Inicial (Introdução)', question: 'Introdução do questionário (Etapa legada)', isLegacy: true },
  };

  const getStepInfo = (stepId: string) => {
    if (stepNames[stepId]) return stepNames[stepId];
    const formatted = stepId ? (stepId.charAt(0).toUpperCase() + stepId.slice(1)).replace(/_/g, ' ') : 'Saída Imediata';
    return { label: formatted, question: formatted, isLegacy: false };
  };

  // Carregar dados principais
  const fetchData = async () => {
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - periodDays);

      const dStart = start.toISOString().split('T')[0];
      const dEnd = end.toISOString().split('T')[0];

      const [funnelRes, wppRes, rankingRes, v6Res] = await Promise.all([
        api.get(`/api/admin/analytics/funnel?startDate=${dStart}&endDate=${dEnd}`),
        api.get(`/api/admin/whatsapp-feedbacks?startDate=${dStart}&endDate=${dEnd}&includeComparison=true`),
        api.get(`/api/admin/analytics/ranking?startDate=${dStart}&endDate=${dEnd}`).catch(() => ({ data: null })),
        api.get('/api/cmo/v6-impact').catch(() => ({ data: null })),
      ]);

      if (funnelRes.data) {
        setFunnelData(funnelRes.data);
      }

      if (wppRes.data) {
        const raw = wppRes.data;
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
          setWppData(raw.feedbacks || []);
          setPrevWppData(raw.prevFeedbacks || []);
          setWppDays(raw.days || periodDays);
        } else if (Array.isArray(raw)) {
          setWppData(raw);
        }
      }

      if (rankingRes?.data) {
        const rawR = rankingRes.data;
        const list = Array.isArray(rawR) ? rawR : rawR.ranking || [];
        setRankingData(list);
      }

      if (v6Res?.data && v6Res.data.success) {
        setV6Data(v6Res.data);
      }
    } catch (err: any) {
      console.error('Erro ao carregar Analytics de Funil:', err);
      setToastMessage('Falha ao carregar métricas de funil.');
      setToastType('error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [periodDays]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchData();
  }, [periodDays]);

  // Carregar auditoria de leads sob demanda
  const fetchAuditoriaLeads = async () => {
    setIsAuditoriaLoading(true);
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - periodDays);

      const dStart = start.toISOString().split('T')[0];
      const dEnd = end.toISOString().split('T')[0];

      const res = await api.get(`/api/admin/leads-recentes?startDate=${dStart}&endDate=${dEnd}`);
      if (res.data) {
        setAuditoriaData(Array.isArray(res.data) ? res.data : []);
        setToastMessage(`Auditoria atualizada: ${res.data.length} registros encontrados.`);
        setToastType('success');
      }
    } catch (err: any) {
      console.error('Erro ao buscar auditoria de leads:', err);
      setToastMessage('Falha ao carregar auditoria de leads.');
      setToastType('error');
    } finally {
      setIsAuditoriaLoading(false);
    }
  };

  // Formatter helpers
  const formatNumber = (val: any) => {
    if (val === undefined || val === null || isNaN(Number(val))) return '0';
    return Number(val).toLocaleString('pt-BR');
  };

  // Trend Badge Helper
  const renderTrendBadge = (curr: number, prev: number, inverseGood: boolean = false) => {
    if (prev === null || prev === undefined || isNaN(prev) || isNaN(curr)) {
      return (
        <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 }}>
          <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '700' }}>—</Text>
        </View>
      );
    }
    if (prev === 0 && curr > 0) {
      const color = inverseGood ? '#ef4444' : '#10b981';
      return (
        <View style={{ backgroundColor: color + '1a', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 }}>
          <Text style={{ color, fontSize: 10, fontWeight: '700' }}>Novo</Text>
        </View>
      );
    }
    if (prev === 0 && curr === 0) {
      return (
        <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 }}>
          <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '700' }}>0%</Text>
        </View>
      );
    }

    const pct = ((curr - prev) / prev) * 100;
    if (Math.abs(pct) < 0.1) {
      return (
        <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 }}>
          <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '700' }}>0%</Text>
        </View>
      );
    }

    const isUp = pct > 0;
    const isGood = inverseGood ? !isUp : isUp;
    const color = isGood ? '#10b981' : '#ef4444';
    const arrow = isUp ? '↑' : '↓';

    return (
      <View style={{ backgroundColor: color + '1a', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 }}>
        <Text style={{ color, fontSize: 10, fontWeight: '700' }}>
          {arrow} {Math.abs(pct).toFixed(1)}%
        </Text>
      </View>
    );
  };

  // Exportar CSV
  const handleExportCSV = async () => {
    try {
      if (!funnelData) {
        Alert.alert('Aviso', 'Aguarde os dados carregarem para exportar.');
        return;
      }

      let csv = `\uFEFFRelatorio de Funil e Conversao (${periodDays} dias) - Yelo\n`;
      csv += `Gerado em: ${new Date().toLocaleString()}\n\n`;

      csv += `--- JORNADA DO PACIENTE (FUNIL) ---\n`;
      csv += `1. Visitantes Totais;${funnelData.visitas || 0}\n`;
      csv += `2. Iniciaram Questionario;${funnelData.iniciaram || 0}\n`;
      csv += `3. Completaram Matches;${funnelData.completaram || 0}\n`;
      csv += `4. Perfis Visualizados;${funnelData.profileViews || 0}\n`;
      csv += `5. Pacientes Conquistados (Unicos);${funnelData.whatsappUnique || 0}\n`;
      csv += `Leads Distribuidos (Total Cliques);${funnelData.whatsappClicks || 0}\n`;
      csv += `Desqualificados (Menores/Regras);${funnelData.desqualificados || 0}\n\n`;

      if (funnelData.abandonos && funnelData.abandonos.length > 0) {
        csv += `--- ONDE ELES DESISTEM (ABANDONOS) ---\n`;
        csv += `Etapa;Perdas\n`;
        funnelData.abandonos.forEach((a: any) => {
          const s = getStepInfo(a.step);
          csv += `${s.label};${a.count}\n`;
        });
        csv += `\n`;
      }

      if (rankingData && rankingData.length > 0) {
        csv += `--- RANKING DE PSICOLOGOS ---\n`;
        csv += `Posicao;Nome;Busca;Visitas Diretas;Cliques WPP;Fechamentos\n`;
        rankingData.forEach((item: any, idx: number) => {
          csv += `${idx + 1};${item.nome || 'N/A'};${item.aparicoesBusca || 0};${item.visitasDiretas || 0};${item.cliquesWpp || 0};${item.fechamentos || 0}\n`;
        });
      }

      await Share.share({
        title: `Funil_Report_${periodDays}d_Yelo.csv`,
        message: csv,
      });
    } catch (err: any) {
      Alert.alert('Erro ao exportar', err.message);
    }
  };

  // Cobrança de feedback WhatsApp
  const handleRemindPsi = async (psiId: string, psiName: string) => {
    try {
      const res = await api.post(`/api/admin/whatsapp-feedbacks/remind/${psiId}`);
      if (res.data?.success) {
        setToastMessage(`Lembrete enviado para ${psiName}!`);
        setToastType('success');
        fetchData();
      } else {
        setToastMessage(res.data?.error || 'Não foi possível enviar o lembrete.');
        setToastType('error');
      }
    } catch (err: any) {
      setToastMessage('Erro ao enviar lembrete via WhatsApp.');
      setToastType('error');
    }
  };

  // Filtragem dos feedbacks de WhatsApp
  const filteredWpp = useMemo(() => {
    return wppData.filter((f: any) => {
      if (wppSearch.trim()) {
        const term = wppSearch.toLowerCase();
        const psiName = f.psychologist?.nome?.toLowerCase() || '';
        const guestName = f.guestName?.toLowerCase() || '';
        if (!psiName.includes(term) && !guestName.includes(term)) return false;
      }
      if (wppStatusFilter === 'todos') return true;
      if (wppStatusFilter === 'cobrar_agora') {
        if (f.feedbackGiven) return false;
        const ageHours = (Date.now() - new Date(f.createdAt).getTime()) / (1000 * 60 * 60);
        return ageHours > 24;
      }
      if (wppStatusFilter === 'pendente') return !f.feedbackGiven;
      if (wppStatusFilter === 'respondido') return f.feedbackGiven;
      if (wppStatusFilter === 'fechou') return f.feedbackGiven && (f.dealClosed === 'yes' || f.dealClosed === 'started');
      if (wppStatusFilter === 'nao_recebeu') return f.feedbackGiven && f.contactReceived === false;
      return true;
    });
  }, [wppData, wppSearch, wppStatusFilter]);

  const totalWppPages = Math.max(1, Math.ceil(filteredWpp.length / itemsPerPage));
  const paginatedWpp = filteredWpp.slice((wppPage - 1) * itemsPerPage, wppPage * itemsPerPage);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <ActivityIndicator size="large" color="#1B4332" />
        <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#1B4332', fontSize: 16, marginTop: 14 }}>
          Carregando Analytics de Funil...
        </Text>
        <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
          Calculando conversões, retenção do questionário e jornada dos pacientes.
        </Text>
      </View>
    );
  }

  // Cálculos de KPIs do Funil
  const visitas = Number(funnelData?.visitas || 0);
  const prevVisitas = Number(funnelData?.prevVisitas || 0);
  const iniciaram = Number(funnelData?.iniciaram || 0);
  const prevIniciaram = Number(funnelData?.prevIniciaram || 0);
  const completaram = Number(funnelData?.completaram || 0);
  const prevCompletaram = Number(funnelData?.prevCompletaram || 0);
  const profileViews = Number(funnelData?.profileViews || 0);
  const prevProfileViews = Number(funnelData?.prevProfileViews || 0);
  const whatsappUnique = Number(funnelData?.whatsappUnique || 0);
  const prevWhatsappUnique = Number(funnelData?.prevWhatsappUnique || 0);
  const whatsappClicks = Number(funnelData?.whatsappClicks || 0);
  const desqualificados = Number(funnelData?.desqualificados || 0);
  const prevDesqualificados = Number(funnelData?.prevDesqualificados || 0);

  const taxaInicio = visitas > 0 ? ((iniciaram / visitas) * 100).toFixed(1) : '0';
  const taxaCompletaram = iniciaram > 0 ? ((completaram / iniciaram) * 100).toFixed(1) : '0';
  const taxaGlobal = visitas > 0 ? ((whatsappUnique / visitas) * 100).toFixed(2) : '0';

  const abandonosCount = Math.max(0, iniciaram - completaram - desqualificados);
  const taxaDesistencia = iniciaram > 0 ? ((abandonosCount / iniciaram) * 100).toFixed(1) : '0';

  // Cálculos de KPIs de Conversões (PLG)
  const totalWppClicks = wppData.length;
  const prevTotalWppClicks = prevWppData.length;
  const wppMediaDia = wppDays > 0 ? (totalWppClicks / wppDays).toFixed(1) : '0.0';

  const feedbacksRespondidos = wppData.filter((f) => f.feedbackGiven);
  const totalRespondidos = feedbacksRespondidos.length;
  const taxaRespostaPsi = totalWppClicks > 0 ? ((totalRespondidos / totalWppClicks) * 100).toFixed(1) : '0';
  const taxaNaoResposta = totalWppClicks > 0 ? (((totalWppClicks - totalRespondidos) / totalWppClicks) * 100).toFixed(1) : '0';

  const contatosRealizados = feedbacksRespondidos.filter((f) => f.contactReceived === true).length;
  const fantasmas = feedbacksRespondidos.filter((f) => f.contactReceived === false).length;

  const fechados = feedbacksRespondidos.filter((f) => f.dealClosed === 'yes' || f.dealClosed === 'started').length;
  const emNegociacao = feedbacksRespondidos.filter((f) => f.dealClosed === 'talking').length;
  const perdidos = feedbacksRespondidos.filter(
    (f) => f.dealClosed === 'no' || f.dealClosed === 'not_started' || f.dealClosed === 'ghosted' || (f.dealClosed && f.dealClosed.startsWith('not_started_'))
  ).length;

  const taxaTrocaMensagens = totalRespondidos > 0 ? ((contatosRealizados / totalRespondidos) * 100).toFixed(1) : '0';
  const taxaFechamento = contatosRealizados > 0 ? ((fechados / contatosRealizados) * 100).toFixed(1) : '0';

  // Origens de Tráfego Agrupadas
  const canaisOrigem = (() => {
    const counts: Record<string, number> = { 'Google Ads': 0, 'Meta Ads': 0, 'Orgânico/Direto': 0, 'Outros': 0 };
    let total = 0;
    (funnelData?.origens || []).forEach((o: any) => {
      const src = (o.source || '').toLowerCase();
      const c = Number(o.count || 0);
      total += c;
      if (src.includes('google') || src.includes('gads')) counts['Google Ads'] += c;
      else if (src.includes('fb') || src.includes('meta') || src.includes('instagram') || src.includes('ig')) counts['Meta Ads'] += c;
      else if (src === 'direto' || src === 'organico' || src === 'organic' || src === '') counts['Orgânico/Direto'] += c;
      else counts['Outros'] += c;
    });
    return { counts, total };
  })();

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <StatusBar style="dark" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 130, // respiro premium para a bottom nav fixa
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="#1B4332"
            colors={['#1B4332']}
          />
        }
      >
        {/* ========================================================= */}
        {/* TOP BAR: BOTÃO VOLTAR CRM HUB + BADGE ADMIN FUNIL         */}
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
            <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#1B4332', fontSize: 12, marginLeft: 6 }}>
              CRM Hub
            </Text>
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
            <Text style={{ fontFamily: 'Inter_700Bold', color: '#166534', fontSize: 11 }}>Admin Funil</Text>
          </View>
        </View>

        {/* ========================================================= */}
        {/* HERO CARD VERDE COM GRADIENTE E BORDAS ARREDONDADAS       */}
        {/* ========================================================= */}
        <LinearGradient
          colors={['#1B4332', '#0f2b20']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 24,
            padding: 22,
            marginBottom: 16,
            shadowColor: '#1B4332',
            shadowOpacity: 0.18,
            shadowRadius: 25,
            shadowOffset: { width: 0, height: 8 },
            elevation: 5,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Efeito decorativo */}
          <View
            style={{
              position: 'absolute',
              top: -40,
              right: -40,
              width: 180,
              height: 180,
              borderRadius: 90,
              backgroundColor: 'rgba(255,255,255,0.05)',
            }}
            pointerEvents="none"
          />

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text
                style={{
                  fontFamily: 'Fraunces_700Bold',
                  fontSize: 22,
                  lineHeight: 28,
                  color: '#ffffff',
                }}
              >
                Comportamento e Funil 🎯
              </Text>
              <Text
                style={{
                  fontFamily: 'Inter_400Regular',
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.85)',
                  marginTop: 4,
                  lineHeight: 17,
                }}
              >
                Rastreamento End-to-End: De onde vêm, onde desistem e como otimizar.
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity
                onPress={fetchData}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.25)',
                }}
                activeOpacity={0.8}
              >
                <Feather name="refresh-cw" size={11} color="#ffffff" />
                <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#ffffff', fontSize: 11 }}>Atualizar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleExportCSV}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.25)',
                }}
                activeOpacity={0.8}
              >
                <Feather name="download" size={11} color="#ffffff" />
                <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#ffffff', fontSize: 11 }}>CSV</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Seletor de Período em Pílulas */}
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
            {[
              { days: 7, label: '7 dias' },
              { days: 30, label: '30 dias' },
              { days: 90, label: '3 meses' },
              { days: 365, label: '12 meses' },
            ].map((p) => {
              const isSelected = periodDays === p.days;
              return (
                <TouchableOpacity
                  key={p.days}
                  onPress={() => setPeriodDays(p.days)}
                  style={{
                    flex: 1,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: isSelected ? '#ffffff' : 'rgba(255,255,255,0.12)',
                    borderWidth: 1,
                    borderColor: isSelected ? '#ffffff' : 'rgba(255,255,255,0.2)',
                    alignItems: 'center',
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={{
                      fontFamily: isSelected ? 'Inter_700Bold' : 'Inter_500Medium',
                      fontSize: 11,
                      color: isSelected ? '#1B4332' : '#ffffff',
                    }}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </LinearGradient>

        {/* ========================================================= */}
        {/* NAVEGAÇÃO POR SEÇÃO (SELETOR DROPDOWN NATIVO)             */}
        {/* ========================================================= */}
        <View style={{ marginBottom: 16 }}>
          <NativeSelectMenu
            title="Selecionar Seção do Funil"
            options={[
              { label: '🎯 Funil End-to-End', value: 'funil' },
              { label: '🤝 Conversões (PLG)', value: 'conversoes' },
              { label: '🏆 Ranking de Psis', value: 'ranking' },
              { label: '🔎 Auditoria (Período)', value: 'auditoria' },
              { label: '⚖️ Monitor de Justiça V6', value: 'v6' },
            ]}
            selectedValue={activeTab}
            onSelect={(val) => setActiveTab(val as FunilTab)}
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
                paddingVertical: 11,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 3,
                elevation: 1,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Feather name="layers" size={15} color="#1B4332" />
                <Text style={{ fontFamily: 'Inter_500Medium', color: '#64748b', fontSize: 12 }}>
                  Seção Ativa:
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
                  {activeTab === 'funil'
                    ? '🎯 Funil End-to-End'
                    : activeTab === 'conversoes'
                    ? '🤝 Conversões (PLG)'
                    : activeTab === 'ranking'
                    ? '🏆 Ranking de Psis'
                    : activeTab === 'auditoria'
                    ? '🔎 Auditoria (Período)'
                    : '⚖️ Monitor de Justiça V6'}
                </Text>
              </View>
              <Feather name="chevron-down" size={16} color="#1B4332" />
            </View>
          </NativeSelectMenu>
        </View>

        {/* ========================================================= */}
        {/* ABA 1: FUNIL END-TO-END                                   */}
        {/* ========================================================= */}
        {activeTab === 'funil' && (
          <View>
            {/* 6 KPIs GERAIS */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {/* Visitantes */}
              <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Visitantes</Text>
                  {renderTrendBadge(visitas, prevVisitas, false)}
                </View>
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 20, color: '#1e293b' }}>{formatNumber(visitas)}</Text>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 9.5, color: '#94a3b8', marginTop: 2 }}>Acessos no site</Text>
              </View>

              {/* Iniciaram Questionário */}
              <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Iniciaram</Text>
                  {renderTrendBadge(iniciaram, prevIniciaram, false)}
                </View>
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 20, color: '#8b5cf6' }}>{formatNumber(iniciaram)}</Text>
                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 9.5, color: '#8b5cf6', marginTop: 2 }}>{taxaInicio}% das visitas (Meta: 15%)</Text>
              </View>

              {/* Concluíram Matches */}
              <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Resultados</Text>
                  {renderTrendBadge(completaram, prevCompletaram, false)}
                </View>
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 20, color: '#d97706' }}>{formatNumber(completaram)}</Text>
                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 9.5, color: '#d97706', marginTop: 2 }}>{taxaCompletaram}% concluíram (Meta: 65%)</Text>
              </View>

              {/* Pacientes Conquistados */}
              <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Conquistados</Text>
                  {renderTrendBadge(whatsappUnique, prevWhatsappUnique, false)}
                </View>
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 20, color: '#16a34a' }}>{formatNumber(whatsappUnique)}</Text>
                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 9.5, color: '#16a34a', marginTop: 2 }}>{whatsappClicks} cliques distribuídos</Text>
              </View>

              {/* Desistência */}
              <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase', marginBottom: 2 }}>Desistência</Text>
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 20, color: Number(taxaDesistencia) > 30 ? '#ef4444' : '#10b981' }}>
                  {taxaDesistencia}%
                </Text>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 9.5, color: '#94a3b8', marginTop: 2 }}>Meta: &lt; 30%</Text>
              </View>

              {/* Desqualificados */}
              <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Desqualificados</Text>
                  {renderTrendBadge(desqualificados, prevDesqualificados, true)}
                </View>
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 20, color: '#ef4444' }}>{formatNumber(desqualificados)}</Text>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 9.5, color: '#94a3b8', marginTop: 2 }}>Menores de idade</Text>
              </View>
            </View>

            {/* FUNIL VISUAL END-TO-END */}
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                padding: 16,
                marginBottom: 16,
              }}
            >
              <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#1e293b', marginBottom: 2 }}>
                Jornada do Paciente (Funil End-to-End)
              </Text>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#64748b', marginBottom: 14 }}>
                Retenção passo a passo e perda de tráfego.
              </Text>

              <View style={{ gap: 10 }}>
                {[
                  { icon: '👁️', bg: '#e0f2fe', color: '#0284c7', label: '1. Acessaram o Site', val: visitas, parent: visitas, desc: 'Visualizações no Período' },
                  { icon: '🚀', bg: '#f3e8ff', color: '#7e22ce', label: '2. Iniciaram Questionário', val: iniciaram, parent: visitas, desc: 'Clicaram em Começar' },
                  { icon: '📋', bg: '#fef3c7', color: '#d97706', label: '3. Finalizaram Matches', val: completaram, parent: iniciaram, desc: 'Chegaram aos Resultados' },
                  { icon: '👤', bg: '#e8f5e9', color: '#166534', label: '4. Visualizações de Perfis', val: profileViews, parent: completaram, desc: 'Acessos detalhados' },
                  { icon: '💬', bg: '#dcfce7', color: '#15803d', label: '5. Clicaram no WhatsApp', val: whatsappUnique, parent: profileViews, desc: `${whatsappClicks} cliques totais` },
                ].map((step, idx) => {
                  const rate = step.parent > 0 ? ((step.val / step.parent) * 100).toFixed(1) : '0';
                  const maxVal = visitas > 0 ? visitas : 1;
                  const fillPct = Math.min(100, Math.max(5, (step.val / maxVal) * 100));

                  return (
                    <View
                      key={step.label}
                      style={{
                        backgroundColor: '#f8fafc',
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: '#e2e8f0',
                        padding: 12,
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Fundo proporcional da barra de retenção */}
                      <View
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: `${fillPct}%`,
                          backgroundColor: 'rgba(27, 67, 50, 0.06)',
                        }}
                      />

                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                          <View style={{ width: 34, height: 34, borderRadius: 999, backgroundColor: step.bg, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 15 }}>{step.icon}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: '#1e293b' }}>{step.label}</Text>
                            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: '#64748b' }}>{step.desc}</Text>
                          </View>
                        </View>

                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 17, color: '#1B4332' }}>{formatNumber(step.val)}</Text>
                          {idx > 0 && (
                            <View style={{ backgroundColor: Number(rate) >= 50 ? '#dcfce7' : '#fee2e2', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, marginTop: 2 }}>
                              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 9.5, color: Number(rate) >= 50 ? '#15803d' : '#b91c1c' }}>
                                {rate}% da etapa anterior
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* DIAGNÓSTICO E INSIGHTS RECOMENDADOS */}
            <View
              style={{
                backgroundColor: '#fffbeb',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#fde68a',
                padding: 16,
                paddingLeft: 20,
                marginBottom: 16,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: '#f59e0b' }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Text style={{ fontSize: 16 }}>💡</Text>
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 15, color: '#92400e' }}>
                  Diagnóstico e Otimizações Recomendadas
                </Text>
              </View>

              <View style={{ gap: 10 }}>
                {/* Insight Topo */}
                <View style={{ borderBottomWidth: 1, borderBottomColor: '#fcd34d', paddingBottom: 8 }}>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#92400e', marginBottom: 2 }}>
                    {Number(taxaInicio) >= 15 ? '🔥 Landing Page Saudável' : '⚠️ Baixa Adesão na Landing Page'} ({taxaInicio}%)
                  </Text>
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#b45309', lineHeight: 16 }}>
                    {Number(taxaInicio) >= 15
                      ? 'O engajamento inicial superou a meta de 15%. A quebra de objeções está funcionando perfeitamente.'
                      : 'A taxa de início está abaixo de 15%. Teste chamadas para ação (CTAs) mais evidentes na primeira dobra.'}
                  </Text>
                </View>

                {/* Insight Meio */}
                <View>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#92400e', marginBottom: 2 }}>
                    {Number(taxaCompletaram) >= 65 ? '✅ Questionário Eficiente' : '📉 Atrito no Questionário'} ({taxaCompletaram}%)
                  </Text>
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#b45309', lineHeight: 16 }}>
                    {Number(taxaCompletaram) >= 65
                      ? 'Mais de 65% dos usuários que começam chegam ao final e visualizam os psicólogos recomendados.'
                      : 'Muitas pessoas abandonam o questionário. Verifique o ranking de desistências abaixo para simplificar etapas.'}
                  </Text>
                </View>
              </View>
            </View>

            {/* ONDE ELES DESISTEM? (ABANDONOS) */}
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                padding: 16,
                marginBottom: 16,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#1e293b' }}>
                  Onde eles desistem? 🚪
                </Text>
                <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#dc2626' }}>Atenção</Text>
                </View>
              </View>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#64748b', marginBottom: 12 }}>
                Perguntas do questionário onde os visitantes fecham a aba.
              </Text>

              {funnelData?.abandonos && funnelData.abandonos.length > 0 ? (
                <View style={{ gap: 10 }}>
                  {funnelData.abandonos.map((item: any) => {
                    const count = Number(item.count || 0);
                    const totalPerdas = funnelData.abandonos.reduce((acc: number, a: any) => acc + Number(a.count || 0), 0);
                    const pct = totalPerdas > 0 ? ((count / totalPerdas) * 100).toFixed(1) : '0';
                    const s = getStepInfo(item.step);

                    let barColor = '#10b981';
                    let badgeBg = '#dcfce7';
                    let badgeText = '#15803d';
                    let badgeLabel = '🟢 Normal';

                    if (Number(pct) >= 20) {
                      barColor = '#ef4444';
                      badgeBg = '#fee2e2';
                      badgeText = '#b91c1c';
                      badgeLabel = '🔴 Gargalo Alto';
                    } else if (Number(pct) >= 12) {
                      barColor = '#f59e0b';
                      badgeBg = '#fef3c7';
                      badgeText = '#b45309';
                      badgeLabel = '🟡 Atenção';
                    }

                    return (
                      <View
                        key={item.step}
                        style={{
                          backgroundColor: '#f8fafc',
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: '#e2e8f0',
                          padding: 10,
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                          <View style={{ flex: 1, paddingRight: 6 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#1e293b' }}>{s.label}</Text>
                              <View style={{ backgroundColor: badgeBg, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999 }}>
                                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 9, color: badgeText }}>{badgeLabel}</Text>
                              </View>
                            </View>
                            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10.5, color: '#64748b', fontStyle: 'italic', marginTop: 2 }}>
                              "{s.question}"
                            </Text>
                          </View>
                          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#1e293b' }}>
                            {count} perdas ({pct}%)
                          </Text>
                        </View>
                        <View style={{ height: 6, backgroundColor: '#e2e8f0', borderRadius: 999, overflow: 'hidden', marginTop: 4 }}>
                          <View style={{ width: `${Math.min(100, Number(pct) * 2.5)}%`, height: '100%', backgroundColor: barColor, borderRadius: 999 }} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#94a3b8', textAlign: 'center', paddingVertical: 10 }}>
                  Sem perdas registradas no período.
                </Text>
              )}
            </View>

            {/* CANAIS DE AQUISIÇÃO (UTMs) */}
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                padding: 16,
                marginBottom: 20,
              }}
            >
              <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#1e293b', marginBottom: 2 }}>
                Canais de Aquisição (Origens)
              </Text>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#64748b', marginBottom: 12 }}>
                Distribuição de visitantes por fonte de tráfego.
              </Text>

              <View style={{ gap: 8 }}>
                {Object.entries(canaisOrigem.counts).map(([nome, count]) => {
                  const pct = canaisOrigem.total > 0 ? ((count / canaisOrigem.total) * 100).toFixed(1) : '0';
                  return (
                    <View
                      key={nome}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: '#f8fafc',
                        padding: 10,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: '#e2e8f0',
                      }}
                    >
                      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#334155' }}>{nome}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                        <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 14, color: '#1B4332' }}>{count}</Text>
                        <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#64748b' }}>({pct}%)</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* ========================================================= */}
        {/* ABA 2: CONVERSÕES (PLG)                                   */}
        {/* ========================================================= */}
        {activeTab === 'conversoes' && (
          <View>
            {/* LINHA 1: TOPO DE FUNIL & QUALIDADE */}
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 15, color: '#1e293b', marginBottom: 8 }}>
              Topo de Funil & Qualidade dos Dados
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Cliques WPP</Text>
                  {renderTrendBadge(totalWppClicks, prevTotalWppClicks, false)}
                </View>
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 20, color: '#0284c7', marginTop: 2 }}>{totalWppClicks}</Text>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 9.5, color: '#64748b' }}>Média: {wppMediaDia}/dia</Text>
              </View>

              <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Contatos Reais</Text>
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 20, color: '#16a34a', marginTop: 2 }}>{contatosRealizados}</Text>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 9.5, color: '#64748b' }}>Confirmados pelo psi</Text>
              </View>

              <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Fantasmas</Text>
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 20, color: '#f43f5e', marginTop: 2 }}>{fantasmas}</Text>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 9.5, color: '#64748b' }}>Não enviou mensagem</Text>
              </View>

              <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Taxa Resposta</Text>
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 20, color: '#d97706', marginTop: 2 }}>{taxaRespostaPsi}%</Text>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 9.5, color: '#64748b' }}>Não resposta: {taxaNaoResposta}%</Text>
              </View>
            </View>

            {/* LINHA 2: PERFORMANCE DE VENDAS */}
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 15, color: '#1e293b', marginBottom: 8 }}>
              Performance de Vendas & Fechamentos
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              <View style={{ width: '31%', backgroundColor: '#ffffff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', padding: 10 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 9.5, color: '#64748b', textTransform: 'uppercase' }}>Fechados</Text>
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#16a34a', marginTop: 2 }}>{fechados}</Text>
                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 9, color: '#16a34a' }}>{taxaFechamento}% dos contatos</Text>
              </View>

              <View style={{ width: '31%', backgroundColor: '#ffffff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', padding: 10 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 9.5, color: '#64748b', textTransform: 'uppercase' }}>Negociando</Text>
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#eab308', marginTop: 2 }}>{emNegociacao}</Text>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 9, color: '#64748b' }}>Em conversa</Text>
              </View>

              <View style={{ width: '31%', backgroundColor: '#ffffff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', padding: 10 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 9.5, color: '#64748b', textTransform: 'uppercase' }}>Perdidos</Text>
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#ef4444', marginTop: 2 }}>{perdidos}</Text>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 9, color: '#64748b' }}>Sem acordo</Text>
              </View>
            </View>

            {/* AUDITORIA DE CONTATOS (SEARCH & LIST) */}
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                padding: 16,
                marginBottom: 20,
              }}
            >
              <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#1e293b', marginBottom: 10 }}>
                Auditoria de Contatos (Pacientes ➔ Psicólogos)
              </Text>

              {/* Barra de Busca e Filtro */}
              <View style={{ gap: 8, marginBottom: 12 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#f8fafc',
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: '#cbd5e1',
                    paddingHorizontal: 12,
                    height: 40,
                  }}
                >
                  <Feather name="search" size={15} color="#94a3b8" />
                  <TextInput
                    placeholder="Pesquisar por psicólogo ou lead..."
                    placeholderTextColor="#94a3b8"
                    value={wppSearch}
                    onChangeText={(t) => {
                      setWppSearch(t);
                      setWppPage(1);
                    }}
                    style={{ flex: 1, marginLeft: 8, fontSize: 12.5, color: '#1e293b', fontFamily: 'Inter_400Regular' }}
                  />
                </View>

                {/* Filtro de Status via Dropdown */}
                <NativeSelectMenu
                  title="Filtrar por Status de Cobrança"
                  options={[
                    { label: 'Todos os Feedbacks', value: 'todos' },
                    { label: 'Cobrar Agora (Atrasados)', value: 'cobrar_agora' },
                    { label: 'Pendente', value: 'pendente' },
                    { label: 'Respondido', value: 'respondido' },
                    { label: 'Fechou Terapia', value: 'fechou' },
                    { label: 'Não Recebeu Contato', value: 'nao_recebeu' },
                  ]}
                  selectedValue={wppStatusFilter}
                  onSelect={(val) => {
                    setWppStatusFilter(val);
                    setWppPage(1);
                  }}
                  style={{ width: '100%' }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: '#f8fafc',
                      borderWidth: 1,
                      borderColor: '#e2e8f0',
                      borderRadius: 999,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                      <Feather name="filter" size={13} color="#1B4332" />
                      <Text style={{ fontFamily: 'Inter_500Medium', color: '#64748b', fontSize: 11.5 }}>
                        Status:
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Inter_700Bold',
                          color: '#1B4332',
                          fontSize: 12,
                          flex: 1,
                        }}
                        numberOfLines={1}
                      >
                        {wppStatusFilter === 'todos'
                          ? 'Todos'
                          : wppStatusFilter === 'cobrar_agora'
                          ? 'Cobrar Agora'
                          : wppStatusFilter === 'pendente'
                          ? 'Pendente'
                          : wppStatusFilter === 'respondido'
                          ? 'Respondido'
                          : wppStatusFilter === 'fechou'
                          ? 'Fechou'
                          : 'Não Recebeu'}
                      </Text>
                    </View>
                    <Feather name="chevron-down" size={14} color="#1B4332" />
                  </View>
                </NativeSelectMenu>
              </View>

              {/* Lista de Cards de Feedback */}
              {paginatedWpp.length > 0 ? (
                <View style={{ gap: 10 }}>
                  {paginatedWpp.map((item: any) => {
                    const psiName = item.psychologist?.nome || 'Psicólogo';
                    const leadName = item.guestName || 'Paciente Anônimo';
                    const dataStr = new Date(item.createdAt).toLocaleDateString('pt-BR');
                    const fechou = item.dealClosed === 'yes' || item.dealClosed === 'started';
                    const negociando = item.dealClosed === 'talking';
                    const naoFechou = item.dealClosed && item.dealClosed !== 'pending' && !fechou && !negociando;

                    return (
                      <View
                        key={item.id}
                        style={{
                          backgroundColor: '#f8fafc',
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: '#e2e8f0',
                          padding: 12,
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                            <View style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center' }}>
                              <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#15803d' }}>
                                {psiName.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: '#1B4332', flex: 1 }} numberOfLines={1}>
                              {psiName}
                            </Text>
                          </View>
                          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 10, color: '#94a3b8' }}>{dataStr}</Text>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
                          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#64748b' }}>Paciente:</Text>
                          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#1e293b' }}>{leadName}</Text>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
                          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#64748b' }}>Origem UTM:</Text>
                          <View style={{ backgroundColor: '#e2e8f0', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999 }}>
                            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 9.5, color: '#475569' }}>
                              {item.utmSource || 'DIRETO'}
                            </Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
                          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#64748b' }}>Recebeu Mensagem?</Text>
                          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: item.contactReceived === true ? '#16a34a' : (item.contactReceived === false ? '#ef4444' : '#64748b') }}>
                            {item.contactReceived === true ? 'Sim' : (item.contactReceived === false ? 'Não' : 'Pendente')}
                          </Text>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 6 }}>
                          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#64748b' }}>Fechou Negócio?</Text>
                          <View style={{
                            backgroundColor: fechou ? '#dcfce7' : (negociando ? '#fef3c7' : (naoFechou ? '#fee2e2' : '#f1f5f9')),
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 999,
                          }}>
                            <Text style={{
                              fontFamily: 'Inter_700Bold',
                              fontSize: 10,
                              color: fechou ? '#15803d' : (negociando ? '#b45309' : (naoFechou ? '#b91c1c' : '#475569')),
                            }}>
                              {fechou ? 'Fechado' : (negociando ? 'Negociando' : (naoFechou ? 'Não Fechou' : 'Pendente'))}
                            </Text>
                          </View>
                        </View>

                        {/* Ação de Cobrança se Pendente */}
                        {!item.feedbackGiven && item.psychologist?.telefone && (
                          <TouchableOpacity
                            onPress={() => handleRemindPsi(item.psychologistId, psiName)}
                            style={{
                              backgroundColor: '#25D366',
                              borderRadius: 999,
                              paddingVertical: 6,
                              paddingHorizontal: 12,
                              alignItems: 'center',
                              flexDirection: 'row',
                              justifyContent: 'center',
                              gap: 6,
                              marginTop: 8,
                            }}
                            activeOpacity={0.8}
                          >
                            <Feather name="send" size={12} color="#ffffff" />
                            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#ffffff' }}>
                              Cobrar Feedback via WhatsApp
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}

                  {/* Paginação */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#64748b' }}>
                      Página {wppPage} de {totalWppPages} ({filteredWpp.length} contatos)
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity
                        disabled={wppPage <= 1}
                        onPress={() => setWppPage((p) => Math.max(1, p - 1))}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 999,
                          backgroundColor: wppPage <= 1 ? '#f1f5f9' : '#ffffff',
                          borderWidth: 1,
                          borderColor: '#cbd5e1',
                          opacity: wppPage <= 1 ? 0.5 : 1,
                        }}
                      >
                        <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#1e293b' }}>← Ant</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        disabled={wppPage >= totalWppPages}
                        onPress={() => setWppPage((p) => Math.min(totalWppPages, p + 1))}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 999,
                          backgroundColor: wppPage >= totalWppPages ? '#f1f5f9' : '#ffffff',
                          borderWidth: 1,
                          borderColor: '#cbd5e1',
                          opacity: wppPage >= totalWppPages ? 0.5 : 1,
                        }}
                      >
                        <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#1e293b' }}>Próx →</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ) : (
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#94a3b8', textAlign: 'center', paddingVertical: 14 }}>
                  Nenhum contato encontrado com os filtros selecionados.
                </Text>
              )}
            </View>
          </View>
        )}

        {/* ========================================================= */}
        {/* ABA 3: RANKING DE PSIS                                    */}
        {/* ========================================================= */}
        {activeTab === 'ranking' && (
          <View>
            {/* 4 KPIs DO RANKING */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Listados</Text>
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 20, color: '#8b5cf6', marginTop: 2 }}>{rankingData.length}</Text>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 9.5, color: '#64748b' }}>Profissionais ativos</Text>
              </View>

              <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Busca (Matches)</Text>
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 20, color: '#d97706', marginTop: 2 }}>
                  {formatNumber(rankingData.reduce((acc, c) => acc + Number(c.aparicoesBusca || 0), 0))}
                </Text>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 9.5, color: '#64748b' }}>Aparições no Top 3</Text>
              </View>

              <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Visitas Diretas</Text>
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 20, color: '#0284c7', marginTop: 2 }}>
                  {formatNumber(rankingData.reduce((acc, c) => acc + Number(c.visitasDiretas || 0), 0))}
                </Text>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 9.5, color: '#64748b' }}>Acessos ao perfil</Text>
              </View>

              <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Conversões WPP</Text>
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 20, color: '#16a34a', marginTop: 2 }}>
                  {formatNumber(rankingData.reduce((acc, c) => acc + Number(c.cliquesWpp || 0), 0))}
                </Text>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 9.5, color: '#64748b' }}>Cliques dos listados</Text>
              </View>
            </View>

            {/* LISTA DO RANKING */}
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                padding: 16,
                marginBottom: 20,
              }}
            >
              <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#1e293b', marginBottom: 2 }}>
                Ranking de Performance dos Psicólogos 🏆
              </Text>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#64748b', marginBottom: 14 }}>
                Profissionais com mais engajamento e conversão de pacientes.
              </Text>

              {rankingData.length > 0 ? (
                <View style={{ gap: 10 }}>
                  {rankingData.map((item: any, idx: number) => {
                    const pos = idx + 1;
                    const visitasTotais = Number(item.aparicoesBusca || 0) + Number(item.visitasDiretas || 0);
                    const convPerfil = visitasTotais > 0 ? ((Number(item.cliquesWpp || 0) / visitasTotais) * 100).toFixed(1) : '0';
                    const convFechamento = Number(item.cliquesWpp || 0) > 0 ? ((Number(item.fechamentos || 0) / Number(item.cliquesWpp)) * 100).toFixed(1) : '0';

                    let badgeColor = '#64748b';
                    let badgeBg = '#f1f5f9';
                    if (pos === 1) {
                      badgeColor = '#b45309';
                      badgeBg = '#fef3c7';
                    } else if (pos === 2) {
                      badgeColor = '#475569';
                      badgeBg = '#e2e8f0';
                    } else if (pos === 3) {
                      badgeColor = '#c2410c';
                      badgeBg = '#ffedd5';
                    }

                    return (
                      <View
                        key={item.id || idx}
                        style={{
                          backgroundColor: '#f8fafc',
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: '#e2e8f0',
                          padding: 12,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                            <View style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: badgeBg, alignItems: 'center', justifyContent: 'center' }}>
                              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: badgeColor }}>#{pos}</Text>
                            </View>
                            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: '#1e293b', flex: 1 }} numberOfLines={1}>
                              {item.nome}
                            </Text>
                          </View>
                          <View style={{ backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#15803d' }}>
                              {item.cliquesWpp || 0} wpp
                            </Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                          <View style={{ flex: 1, backgroundColor: '#ffffff', borderRadius: 10, padding: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
                            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 9.5, color: '#64748b' }}>Busca</Text>
                            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 14, color: '#1e293b', marginTop: 1 }}>{item.aparicoesBusca || 0}</Text>
                          </View>

                          <View style={{ flex: 1, backgroundColor: '#ffffff', borderRadius: 10, padding: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
                            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 9.5, color: '#64748b' }}>Diretas</Text>
                            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 14, color: '#1e293b', marginTop: 1 }}>{item.visitasDiretas || 0}</Text>
                          </View>

                          <View style={{ flex: 1, backgroundColor: '#ffffff', borderRadius: 10, padding: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
                            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 9.5, color: '#64748b' }}>Conv. WPP</Text>
                            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 14, color: '#16a34a', marginTop: 1 }}>{convPerfil}%</Text>
                          </View>

                          <View style={{ flex: 1, backgroundColor: '#ffffff', borderRadius: 10, padding: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
                            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 9.5, color: '#64748b' }}>Fechamento</Text>
                            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 14, color: '#8b5cf6', marginTop: 1 }}>{convFechamento}%</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#94a3b8', textAlign: 'center', paddingVertical: 14 }}>
                  Nenhum dado de ranking para o período selecionado.
                </Text>
              )}
            </View>
          </View>
        )}

        {/* ========================================================= */}
        {/* ABA 4: AUDITORIA (PERÍODO)                                */}
        {/* ========================================================= */}
        {activeTab === 'auditoria' && (
          <View>
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                padding: 16,
                marginBottom: 20,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#1e293b' }}>
                  🔎 Auditoria de Leads Recentes
                </Text>
                <TouchableOpacity
                  onPress={fetchAuditoriaLeads}
                  disabled={isAuditoriaLoading}
                  style={{
                    backgroundColor: '#1B4332',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 999,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  activeOpacity={0.8}
                >
                  {isAuditoriaLoading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Feather name="search" size={12} color="#ffffff" />
                  )}
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#ffffff' }}>
                    {isAuditoriaLoading ? 'Buscando...' : 'Buscar'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#64748b', marginBottom: 14 }}>
                Confira exatamente quem recebeu pacientes no período selecionado no topo para identificar favoritos ou falhas de distribuição.
              </Text>

              {auditoriaData.length > 0 ? (
                <View style={{ gap: 8 }}>
                  {auditoriaData.map((item: any, idx: number) => {
                    let badgeBg = '#ecfdf5';
                    let badgeColor = '#10b981';
                    let badgeText = 'Ativo';

                    if (item.status === 'pending') {
                      badgeBg = '#fefce8';
                      badgeColor = '#ca8a04';
                      badgeText = 'Pendente';
                    } else if (item.status === 'inactive') {
                      badgeBg = '#fef2f2';
                      badgeColor = '#ef4444';
                      badgeText = 'Inativo';
                    }

                    return (
                      <View
                        key={item.id || idx}
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          backgroundColor: '#f8fafc',
                          padding: 12,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: '#e2e8f0',
                        }}
                      >
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: '#1e293b' }}>{item.nome}</Text>
                          <View style={{ backgroundColor: badgeBg, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, alignSelf: 'flex-start', marginTop: 4 }}>
                            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 9.5, color: badgeColor }}>{badgeText}</Text>
                          </View>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#6366f1' }}>
                            {item.leads_recentes}
                          </Text>
                          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 9.5, color: '#64748b' }}>leads recebidos</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
                    Clique no botão "Buscar" acima para carregar a auditoria dos psicólogos.
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ========================================================= */}
        {/* ABA 5: MONITOR DE JUSTIÇA V6                              */}
        {/* ========================================================= */}
        {activeTab === 'v6' && (
          <View>
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                padding: 16,
                marginBottom: 20,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Feather name="shield" size={16} color="#0ea5e9" />
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#1e293b' }}>
                  Monitor de Justiça (Efeito V6 Match)
                </Text>
              </View>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#64748b', marginBottom: 14 }}>
                {v6Data?.days ? `Comparando últimos ${v6Data.days} dias vs ${v6Data.days} dias antes do deploy.` : 'Auditoria do algoritmo de recomendação.'}
              </Text>

              {/* 3 KPIs V6 */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                <View style={{ flex: 1, backgroundColor: '#f0f9ff', borderRadius: 14, borderWidth: 1, borderColor: '#bae6fd', padding: 10 }}>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 9.5, color: '#0369a1', textTransform: 'uppercase' }}>Leads</Text>
                  <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#0c4a6e', marginTop: 2 }}>
                    {v6Data?.stats?.totalLeadsAfter ?? '-'}
                  </Text>
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 9, color: '#0369a1' }}>
                    Antes: {v6Data?.stats?.totalLeadsBefore ?? '-'}
                  </Text>
                </View>

                <View style={{ flex: 1, backgroundColor: '#fff1f2', borderRadius: 14, borderWidth: 1, borderColor: '#fecdd3', padding: 10 }}>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 9.5, color: '#be123c', textTransform: 'uppercase' }}>Zerados</Text>
                  <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#881337', marginTop: 2 }}>
                    {v6Data?.stats?.starvingAfter ?? '-'}
                  </Text>
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 9, color: '#be123c' }}>
                    Antes: {v6Data?.stats?.starvingBefore ?? '-'}
                  </Text>
                </View>

                <View style={{ flex: 1, backgroundColor: '#f0fdf4', borderRadius: 14, borderWidth: 1, borderColor: '#bbf7d0', padding: 10 }}>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 9.5, color: '#15803d', textTransform: 'uppercase' }}>Top 5 %</Text>
                  <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#14532d', marginTop: 2 }}>
                    {v6Data?.stats?.concentrationAfter ? `${v6Data.stats.concentrationAfter}%` : '-'}
                  </Text>
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 9, color: '#15803d' }}>
                    Antes: {v6Data?.stats?.concentrationBefore ? `${v6Data.stats.concentrationBefore}%` : '-'}
                  </Text>
                </View>
              </View>

              {/* Tabela de Profissionais V6 */}
              {v6Data?.tableData && v6Data.tableData.length > 0 ? (
                <View style={{ gap: 8 }}>
                  {v6Data.tableData.map((row: any, idx: number) => {
                    const isPositive = Number(row.variation || 0) > 0;
                    const isNegative = Number(row.variation || 0) < 0;
                    const varColor = isPositive ? '#10b981' : (isNegative ? '#ef4444' : '#64748b');
                    const varText = isPositive ? `+${row.variation}` : String(row.variation || 0);

                    return (
                      <View
                        key={idx}
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          backgroundColor: '#f8fafc',
                          padding: 10,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: '#e2e8f0',
                        }}
                      >
                        <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#1e293b', flex: 1 }} numberOfLines={1}>
                          {row.nome}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: '#94a3b8' }}>
                            Antes: {row.leadsBefore}
                          </Text>
                          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#0f172a' }}>
                            Depois: {row.leadsAfter}
                          </Text>
                          <View style={{ backgroundColor: varColor + '1a', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999 }}>
                            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: varColor }}>
                              {varText}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#94a3b8', textAlign: 'center', paddingVertical: 14 }}>
                  Nenhum dado comparativo disponível para o Motor V6.
                </Text>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      <YeloToast
        message={toastMessage}
        onDismiss={() => setToastMessage(null)}
        type={toastType}
      />
    </View>
  );
}
