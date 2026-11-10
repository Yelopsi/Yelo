import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import api from '../../../services/api';
import YeloToast from '../../../components/YeloToast';

export default function ReceitaScreen() {
  const router = useRouter();

  // Tab State: Default is 'financeiro' matching the page purpose "Receita e Assinaturas"
  const [activeTab, setActiveTab] = useState<'financeiro' | 'desempenho'>('financeiro');

  // Time Filter State: 7, 30 (default), 90 days
  const [selectedDays, setSelectedDays] = useState<number>(30);

  // Data States
  const [financials, setFinancials] = useState<any>({
    kpis: {},
    recentInvoices: [],
    activePlans: [],
    insights: [],
    planDistribution: {},
  });
  const [cashFlowList, setCashFlowList] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>({});
  const [funnelData, setFunnelData] = useState<any>({});
  const [pwaData, setPwaData] = useState<any>({ total: 0 });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  const getDateRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    return { startDate: formatDate(start), endDate: formatDate(end) };
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const { startDate, endDate } = getDateRange(selectedDays);
      const query = `?startDate=${startDate}&endDate=${endDate}`;

      const [resFin, resCashFlow, resCharts, resFunnel, resPwa] = await Promise.all([
        api.get(`/api/admin/financials${query}`).catch(() => ({ data: {} })),
        api.get('/api/admin/cash-flow').catch(() => ({ data: { cashFlow: [] } })),
        api.get(`/api/admin/reports/charts${query}`).catch(() => ({ data: {} })),
        api.get(`/api/admin/analytics/funnel${query}`).catch(() => ({ data: {} })),
        api.get(`/api/admin/stats/pwa${query}`).catch(() => ({ data: { total: 0 } })),
      ]);

      if (resFin.data) {
        setFinancials(resFin.data);
      }
      if (resCashFlow.data?.cashFlow) {
        setCashFlowList(resCashFlow.data.cashFlow);
      }
      if (resCharts.data) {
        setAnalytics(resCharts.data);
      }
      if (resFunnel.data) {
        setFunnelData(resFunnel.data);
      }
      if (resPwa.data) {
        setPwaData(resPwa.data);
      }
    } catch (error: any) {
      console.error('Erro ao buscar dados de receita:', error);
      setToastMessage('Falha ao carregar inteligência financeira.');
      setToastType('error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDays]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [selectedDays]);

  // Formatters
  const formatBRL = (val: any) => {
    if (val === undefined || val === null || isNaN(Number(val))) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(val));
  };

  const formatNumber = (val: any) => {
    if (val === undefined || val === null || isNaN(Number(val))) return '0';
    return Number(val).toLocaleString('pt-BR');
  };

  const formatPercent = (val: any) => {
    if (val === undefined || val === null || isNaN(Number(val))) return '0,0%';
    return `${Number(val).toFixed(1).replace('.', ',')}%`;
  };

  const formatDateBR = (dateVal?: string | Date | null): string => {
    if (!dateVal) return '-';
    if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal.trim())) {
      const [y, m, d] = dateVal.trim().split('-');
      return `${d}/${m}/${y}`;
    }
    try {
      const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
      if (isNaN(d.getTime())) return '-';
      return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    } catch {
      return '-';
    }
  };

  const getRelativeDateLabel = (dateVal?: string | Date | null): string => {
    if (!dateVal) return 'Isento';
    const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
    if (isNaN(d.getTime())) return 'N/D';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(d);
    compareDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round((compareDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Vence hoje';
    if (diffDays === 1) return 'Vence amanhã';
    if (diffDays > 1 && diffDays <= 7) return `Vence em ${diffDays} dias`;
    return `Vence: ${formatDateBR(dateVal)}`;
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

    const diff = curr - prev;
    const pct = (diff / prev) * 100;
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

  const kpis = financials.kpis || {};

  // Plan Distribution Calculations
  const planDistEntries = useMemo(() => {
    const dist = financials.planDistribution || {};
    const total = Object.values(dist).reduce((a: number, b: any) => a + (Number(b) || 0), 0) as number;
    return Object.entries(dist)
      .map(([name, count]) => {
        const c = Number(count) || 0;
        const pct = total > 0 ? (c / total) * 100 : 0;
        return { name, count: c, pct };
      })
      .sort((a, b) => b.count - a.count);
  }, [financials.planDistribution]);

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#1B4332']}
            tintColor="#1B4332"
          />
        }
      >
        {/* ========================================================= */}
        {/* TOP BAR: VOLTAR HUB + REFRESH                             */}
        {/* ========================================================= */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <TouchableOpacity
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(admin)/crm'))}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#e8f5e9',
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: '#c8e6c9',
            }}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={16} color="#1B4332" />
            <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#1B4332', fontSize: 12, marginLeft: 6 }}>
              CRM Hub
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={fetchData}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: '#FFEE8C',
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
            }}
            activeOpacity={0.8}
          >
            <Feather name="refresh-cw" size={12} color="#1B4332" />
            <Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 11 }}>Atualizar</Text>
          </TouchableOpacity>
        </View>

        {/* ========================================================= */}
        {/* HERO HEADER: VERDE FLORESTA YELO                          */}
        {/* ========================================================= */}
        <LinearGradient
          colors={['#1B4332', '#2D6A4F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 24,
            padding: 22,
            marginBottom: 16,
            shadowColor: '#1B4332',
            shadowOpacity: 0.15,
            shadowRadius: 25,
            shadowOffset: { width: 0, height: 8 },
            elevation: 4,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: -30,
              right: -30,
              width: 150,
              height: 150,
              borderRadius: 75,
              backgroundColor: 'rgba(255,255,255,0.06)',
            }}
            pointerEvents="none"
          />

          <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 23, color: '#ffffff' }}>
            Receita e Assinaturas 💰
          </Text>
          <Text
            style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 12.5,
              color: 'rgba(255,255,255,0.85)',
              marginTop: 4,
              lineHeight: 18,
            }}
          >
            MRR, taxa de Churn, LTV, faturas Asaas e inteligência financeira.
          </Text>

          {/* CHIPS DE FILTRO DE PERÍODO (7d, 30d, 90d) */}
          <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)' }}>
            <Text
              style={{
                fontFamily: 'Inter_700Bold',
                fontSize: 10,
                color: 'rgba(255,255,255,0.7)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 6,
              }}
            >
              Período de Análise
            </Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[
                { label: '7 dias', days: 7 },
                { label: '30 dias', days: 30 },
                { label: '90 dias', days: 90 },
              ].map((p) => {
                const isSelected = selectedDays === p.days;
                return (
                  <TouchableOpacity
                    key={p.days}
                    onPress={() => setSelectedDays(p.days)}
                    style={{
                      flex: 1,
                      paddingVertical: 7,
                      borderRadius: 999,
                      backgroundColor: isSelected ? '#FFEE8C' : 'rgba(255,255,255,0.12)',
                      borderWidth: 1,
                      borderColor: isSelected ? '#FFEE8C' : 'rgba(255,255,255,0.2)',
                      alignItems: 'center',
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={{
                        fontFamily: isSelected ? 'Inter_700Bold' : 'Inter_600SemiBold',
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
          </View>
        </LinearGradient>

        {/* ========================================================= */}
        {/* ABAS EM PÍLULA                                            */}
        {/* ========================================================= */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: '#ffffff',
            borderRadius: 999,
            padding: 4,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: '#e2e8f0',
          }}
        >
          <TouchableOpacity
            onPress={() => setActiveTab('financeiro')}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: 999,
              backgroundColor: activeTab === 'financeiro' ? '#1B4332' : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            activeOpacity={0.8}
          >
            <Text
              style={{
                fontFamily: activeTab === 'financeiro' ? 'Inter_700Bold' : 'Inter_500Medium',
                fontSize: 12,
                color: activeTab === 'financeiro' ? '#ffffff' : '#64748b',
              }}
            >
              💰 Receita & Planos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('desempenho')}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: 999,
              backgroundColor: activeTab === 'desempenho' ? '#1B4332' : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            activeOpacity={0.8}
          >
            <Text
              style={{
                fontFamily: activeTab === 'desempenho' ? 'Inter_700Bold' : 'Inter_500Medium',
                fontSize: 12,
                color: activeTab === 'desempenho' ? '#ffffff' : '#64748b',
              }}
            >
              📈 Desempenho & Uso
            </Text>
          </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#1B4332" />
            <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#1B4332', fontSize: 13, marginTop: 10 }}>
              Carregando dados financeiros...
            </Text>
          </View>
        ) : (
          <>
            {/* ========================================================= */}
            {/* ABA 1: RECEITA & PLANOS                                   */}
            {/* ========================================================= */}
            {activeTab === 'financeiro' && (
              <View style={{ gap: 16 }}>
                {/* 1. GRID DOS 6 KPIS FINANCEIROS PRINCIPAIS */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {/* MRR */}
                  <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>MRR Ativo</Text>
                      {renderTrendBadge(kpis.mrr?.current || 0, kpis.mrr?.previous || 0, false)}
                    </View>
                    <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#1B4332' }}>
                      {formatBRL(kpis.mrr?.current || 0)}
                    </Text>
                    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                      Anterior: {formatBRL(kpis.mrr?.previous || 0)}
                    </Text>
                  </View>

                  {/* Churn Financeiro (Pagantes) */}
                  <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Churn Pagantes</Text>
                      {renderTrendBadge(kpis.paidChurnRate?.current ?? 0, kpis.paidChurnRate?.previous ?? 0, true)}
                    </View>
                    <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: (kpis.paidChurnRate?.current || 0) > 10 ? '#ef4444' : '#1e293b' }}>
                      {formatPercent(kpis.paidChurnRate?.current || 0)}
                    </Text>
                    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                      Saídas: {kpis.paidChurnCount?.current || 0} psis
                    </Text>
                  </View>

                  {/* Cancelamentos de Trial */}
                  <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Churn Trial</Text>
                      {renderTrendBadge(kpis.trialChurnCount?.current || 0, kpis.trialChurnCount?.previous || 0, true)}
                    </View>
                    <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#ea580c' }}>
                      {kpis.trialChurnCount?.current || 0} trials
                    </Text>
                    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                      Anterior: {kpis.trialChurnCount?.previous || 0} abandonos
                    </Text>
                  </View>

                  {/* Inadimplência */}
                  <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Inadimplência</Text>
                      {renderTrendBadge(kpis.inadimplentesCount?.current || 0, kpis.inadimplentesCount?.previous || 0, true)}
                    </View>
                    <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#d97706' }}>
                      {kpis.inadimplentesCount?.current || 0} psis
                    </Text>
                    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                      Cartão/Pix expirado
                    </Text>
                  </View>

                  {/* LTV (Projetado & Observado) */}
                  <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>LTV Projetado</Text>
                      {renderTrendBadge(kpis.ltv?.projected || 0, kpis.ltv?.previous || 0, false)}
                    </View>
                    <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#7c3aed' }}>
                      {formatBRL(kpis.ltv?.projected || 0)}
                    </Text>
                    <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#10b981', marginTop: 2 }}>
                      Obs: {formatBRL(kpis.ltv?.current || 0)}
                    </Text>
                  </View>

                  {/* Ticket Médio (ARPU) */}
                  <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Ticket Médio</Text>
                      {renderTrendBadge(kpis.arpu?.current || 0, kpis.arpu?.previous || 0, false)}
                    </View>
                    <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#1e293b' }}>
                      {formatBRL(kpis.arpu?.current || 0)}
                    </Text>
                    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                      ARPU por assinante
                    </Text>
                  </View>
                </View>

                {/* 2. INSIGHTS INTELIGENTES */}
                <View
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: '#e2e8f0',
                    padding: 16,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <Feather name="activity" size={15} color="#1B4332" />
                    <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 15, color: '#1B4332' }}>
                      Insights Inteligentes
                    </Text>
                  </View>

                  {financials.insights && financials.insights.length > 0 ? (
                    <View style={{ gap: 8 }}>
                      {financials.insights.map((insight: any, idx: number) => {
                        const isPositive = insight.type === 'positive';
                        const isNegative = insight.type === 'negative';
                        const bgColor = isPositive ? '#f0fdf4' : isNegative ? '#fef2f2' : '#fffbeb';
                        const borderColor = isPositive ? '#bbf7d0' : isNegative ? '#fecaca' : '#fde68a';
                        const iconColor = isPositive ? '#16a34a' : isNegative ? '#dc2626' : '#d97706';
                        const iconName = isPositive ? 'check-circle' : isNegative ? 'alert-circle' : 'alert-triangle';

                        return (
                          <View
                            key={idx}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              backgroundColor: bgColor,
                              borderRadius: 12,
                              padding: 10,
                              borderWidth: 1,
                              borderColor,
                              gap: 8,
                            }}
                          >
                            <Feather name={iconName} size={15} color={iconColor} />
                            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: '#1e293b', flex: 1, lineHeight: 17 }}>
                              {insight.text}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#94a3b8' }}>
                      Nenhum insight específico detectado para a janela selecionada.
                    </Text>
                  )}
                </View>

                {/* 3. PROJEÇÃO DE CRESCIMENTO (MRR) */}
                <View
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: '#e2e8f0',
                    padding: 16,
                  }}
                >
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 15, color: '#1B4332' }}>
                      Projeção Linear de MRR
                    </Text>
                    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                      Estimativa baseada no crescimento líquido diário de assinantes.
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' }}>
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>
                        30 Dias
                      </Text>
                      <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 15, color: '#1e293b', marginTop: 4 }}>
                        {formatBRL(kpis.proj30 || 0)}
                      </Text>
                    </View>

                    <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' }}>
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>
                        60 Dias
                      </Text>
                      <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 15, color: '#1e293b', marginTop: 4 }}>
                        {formatBRL(kpis.proj60 || 0)}
                      </Text>
                    </View>

                    <View style={{ flex: 1, backgroundColor: '#ecfdf5', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#a7f3d0', alignItems: 'center' }}>
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#047857', textTransform: 'uppercase' }}>
                        90 Dias
                      </Text>
                      <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 15, color: '#047857', marginTop: 4 }}>
                        {formatBRL(kpis.proj90 || 0)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* 4. DISTRIBUIÇÃO DE PLANOS ATIVOS */}
                <View
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: '#e2e8f0',
                    padding: 16,
                  }}
                >
                  <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 15, color: '#1B4332', marginBottom: 4 }}>
                    Distribuição de Planos Ativos
                  </Text>
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#64748b', marginBottom: 12 }}>
                    Proporção de psicólogos pagantes por plano contratado.
                  </Text>

                  {planDistEntries.length > 0 ? (
                    <View style={{ gap: 10 }}>
                      {planDistEntries.map((item, idx) => (
                        <View key={idx}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12.5, color: '#1e293b' }}>
                              {item.name}
                            </Text>
                            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12.5, color: '#1B4332' }}>
                              {item.count} psis ({item.pct.toFixed(0)}%)
                            </Text>
                          </View>
                          <View style={{ height: 8, backgroundColor: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                            <View
                              style={{
                                height: '100%',
                                width: `${Math.min(100, Math.max(item.pct, 4))}%`,
                                backgroundColor: idx === 0 ? '#10b981' : idx === 1 ? '#0284c7' : '#8b5cf6',
                                borderRadius: 999,
                              }}
                            />
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#94a3b8' }}>
                      Nenhum plano pago ativo encontrado no período.
                    </Text>
                  )}
                </View>

                {/* 5. HISTÓRICO DE RECEITA (ASAAS) / FLUXO DE CAIXA */}
                <View
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: '#e2e8f0',
                    padding: 16,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 15, color: '#1B4332' }}>
                      Histórico de Receita (Asaas)
                    </Text>
                    <View style={{ backgroundColor: '#ecfdf5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 9.5, color: '#059669', textTransform: 'uppercase' }}>
                        Confirmado
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#64748b', marginBottom: 12 }}>
                    Fluxo mensal de pagamentos recebidos e creditados na conta.
                  </Text>

                  {cashFlowList.length > 0 ? (
                    <View style={{ gap: 8 }}>
                      {cashFlowList.slice(0, 6).map((item, idx) => {
                        const [ano, mes] = (item.monthYear || '').split('-');
                        const dataFormatada = mes && ano ? `${mes}/${ano}` : item.monthYear || 'N/D';
                        return (
                          <View
                            key={idx}
                            style={{
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              paddingVertical: 10,
                              paddingHorizontal: 12,
                              backgroundColor: '#f8fafc',
                              borderRadius: 14,
                              borderWidth: 1,
                              borderColor: '#e2e8f0',
                            }}
                          >
                            <View>
                              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: '#1e293b' }}>
                                {dataFormatada}
                              </Text>
                              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: '#64748b', marginTop: 1 }}>
                                {item.count} pagamentos
                              </Text>
                            </View>

                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 14, color: '#10b981' }}>
                                {formatBRL(item.netValue)}
                              </Text>
                              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: '#94a3b8' }}>
                                Bruto: {formatBRL(item.grossValue)}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#94a3b8' }}>
                      Nenhum fluxo de caixa Asaas registrado.
                    </Text>
                  )}
                </View>

                {/* 6. FATURAS RECENTES */}
                <View
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: '#e2e8f0',
                    padding: 16,
                  }}
                >
                  <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 15, color: '#1B4332', marginBottom: 4 }}>
                    Faturas Recentes (Asaas)
                  </Text>
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#64748b', marginBottom: 12 }}>
                    Últimas transações processadas pelo gateway.
                  </Text>

                  {financials.recentInvoices && financials.recentInvoices.length > 0 ? (
                    <View style={{ gap: 8 }}>
                      {financials.recentInvoices.slice(0, 10).map((inv: any, idx: number) => {
                        const isPaid = inv.status === 'Paga';
                        const isLate = inv.status === 'Atrasada';
                        const statusBg = isPaid ? '#ecfdf5' : isLate ? '#fef2f2' : '#f8fafc';
                        const statusColor = isPaid ? '#059669' : isLate ? '#dc2626' : '#64748b';

                        return (
                          <View
                            key={idx}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: 12,
                              borderRadius: 14,
                              borderWidth: 1,
                              borderColor: '#e2e8f0',
                              backgroundColor: '#ffffff',
                            }}
                          >
                            <View style={{ flex: 1, paddingRight: 8 }}>
                              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12.5, color: '#1e293b' }} numberOfLines={1}>
                                {inv.psychologistName || 'Psicólogo'}
                              </Text>
                              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                                {formatDateBR(inv.date)}
                              </Text>
                            </View>

                            <View style={{ alignItems: 'flex-end', gap: 4 }}>
                              <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 13.5, color: '#1e293b' }}>
                                {formatBRL(inv.amount)}
                              </Text>
                              <View style={{ backgroundColor: statusBg, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 }}>
                                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 9.5, color: statusColor }}>
                                  {inv.status || 'Pendente'}
                                </Text>
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#94a3b8' }}>
                      Nenhuma fatura recente encontrada.
                    </Text>
                  )}
                </View>

                {/* 7. PRÓXIMOS PAGAMENTOS */}
                <View
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: '#e2e8f0',
                    padding: 16,
                  }}
                >
                  <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 15, color: '#1B4332', marginBottom: 4 }}>
                    Próximos Pagamentos
                  </Text>
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#64748b', marginBottom: 12 }}>
                    Vencimentos previstos de assinaturas ativas.
                  </Text>

                  {financials.activePlans && financials.activePlans.length > 0 ? (
                    <View style={{ gap: 8 }}>
                      {financials.activePlans.slice(0, 10).map((plan: any, idx: number) => (
                        <View
                          key={idx}
                          style={{
                            padding: 12,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: '#e2e8f0',
                            backgroundColor: '#ffffff',
                          }}
                        >
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12.5, color: '#1e293b' }} numberOfLines={1}>
                              {plan.psychologistName || 'Psicólogo'}
                            </Text>
                            <View style={{ backgroundColor: '#e0f2fe', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 9.5, color: '#0369a1', textTransform: 'uppercase' }}>
                                {plan.planName || 'N/D'}
                              </Text>
                            </View>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
                            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11.5, color: '#1B4332' }}>
                              MRR: {formatBRL(plan.mrr)}
                            </Text>
                            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#475569' }}>
                              {getRelativeDateLabel(plan.nextBilling)}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#94a3b8' }}>
                      Nenhum plano com vencimento futuro.
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* ========================================================= */}
            {/* ABA 2: DESEMPENHO & USO                                   */}
            {/* ========================================================= */}
            {activeTab === 'desempenho' && (
              <View style={{ gap: 16 }}>
                {/* 6 KPIS DE DESEMPENHO E USO (IGUAL À WEB) */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {/* Quest. Concluídos */}
                  <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#166534', textTransform: 'uppercase' }}>
                      Quest. Concluídos
                    </Text>
                    <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 20, color: '#166534', marginTop: 4 }}>
                      {analytics.demand
                        ? formatNumber(analytics.demand.reduce((acc: number, curr: any) => acc + (parseInt(curr.concluidos) || 0), 0))
                        : 0}
                    </Text>
                  </View>

                  {/* Quest. Abandonados */}
                  <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#b91c1c', textTransform: 'uppercase' }}>
                      Quest. Abandonados
                    </Text>
                    <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 20, color: '#b91c1c', marginTop: 4 }}>
                      {analytics.demand
                        ? formatNumber(analytics.demand.reduce((acc: number, curr: any) => acc + (parseInt(curr.desistencias) || 0), 0))
                        : 0}
                    </Text>
                  </View>

                  {/* Acessos ao Site */}
                  <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#0284c7', textTransform: 'uppercase' }}>
                      Acessos ao Site
                    </Text>
                    <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 20, color: '#0284c7', marginTop: 4 }}>
                      {analytics.visits
                        ? formatNumber(analytics.visits.reduce((acc: number, curr: any) => acc + (parseInt(curr.total) || 0), 0))
                        : 0}
                    </Text>
                  </View>

                  {/* Perguntas no Fórum */}
                  <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#d97706', textTransform: 'uppercase' }}>
                      Perguntas Fórum
                    </Text>
                    <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 20, color: '#d97706', marginTop: 4 }}>
                      {formatNumber(analytics.community?.questionsTotal || 0)}
                    </Text>
                  </View>

                  {/* Cliques no WhatsApp */}
                  <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#16a34a', textTransform: 'uppercase' }}>
                      Cliques WhatsApp
                    </Text>
                    <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 20, color: '#16a34a', marginTop: 4 }}>
                      {formatNumber(analytics.whatsappClicks || 0)}
                    </Text>
                  </View>

                  {/* Instalações PWA (App) */}
                  <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#475569', textTransform: 'uppercase' }}>
                      Instalações PWA
                    </Text>
                    <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 20, color: '#1e293b', marginTop: 4 }}>
                      {formatNumber(pwaData.total || 0)}
                    </Text>
                  </View>
                </View>

                {/* RANKING DE ABANDONO (DROPOFFS DO QUESTIONÁRIO REAL) */}
                <View
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: '#e2e8f0',
                    padding: 16,
                  }}
                >
                  <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 15, color: '#b91c1c', marginBottom: 2 }}>
                    Ranking de Abandono (Questionário)
                  </Text>
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#64748b', marginBottom: 12 }}>
                    Etapas onde os pacientes mais interrompem o preenchimento.
                  </Text>

                  {funnelData.abandonos && funnelData.abandonos.length > 0 ? (
                    <View style={{ gap: 8 }}>
                      {funnelData.abandonos.slice(0, 5).map((drop: any, idx: number) => (
                        <View
                          key={idx}
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            paddingVertical: 8,
                            borderBottomWidth: idx < 4 ? 1 : 0,
                            borderBottomColor: '#f1f5f9',
                          }}
                        >
                          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12.5, color: '#334155' }}>
                            Etapa {drop.step || idx + 1}
                          </Text>
                          <View style={{ backgroundColor: '#fef2f2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#b91c1c' }}>
                              {drop.count} abandonos
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#94a3b8' }}>
                      Nenhum abandono de questionário registrado no período.
                    </Text>
                  )}
                </View>

                {/* ORIGENS DE TRÁFEGO (UTMS REAIS) */}
                <View
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: '#e2e8f0',
                    padding: 16,
                  }}
                >
                  <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 15, color: '#1B4332', marginBottom: 2 }}>
                    Origens de Tráfego (UTMs)
                  </Text>
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#64748b', marginBottom: 12 }}>
                    Fontes de aquisição de demanda dos questionários iniciados.
                  </Text>

                  {funnelData.origens && funnelData.origens.length > 0 ? (
                    <View style={{ gap: 8 }}>
                      {funnelData.origens.slice(0, 5).map((utm: any, idx: number) => (
                        <View
                          key={idx}
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            paddingVertical: 8,
                            borderBottomWidth: idx < 4 ? 1 : 0,
                            borderBottomColor: '#f1f5f9',
                          }}
                        >
                          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12.5, color: '#334155' }}>
                            {utm.source || 'Direto / Orgânico'}
                          </Text>
                          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: '#1B4332' }}>
                            {utm.count} visitas
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#94a3b8' }}>
                      Nenhuma UTM rastreada para o período.
                    </Text>
                  )}
                </View>
              </View>
            )}
          </>
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
