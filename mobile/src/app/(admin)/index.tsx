import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  RefreshControl, 
  ActivityIndicator, 
  Modal, 
  Animated, 
  Easing 
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import api from '../../services/api';

const emptyStats = {
  mrr: 0,
  newPatients30d: 0,
  newPsis30d: 0,
  questToday: 0,
  patients: { total: 0, active: 0, deleted: 0 },
  psychologists: { 
    total: 0, 
    active: 0, 
    deleted: 0, 
    byPlan: { Essencial: 0, Clínico: 0, Sol: 0 },
    paying: 0,
    vip: 0,
    trials: 0
  },
  questionnaires: { total: 0, deleted: 0 },
  overallConversionRate: 0,
  totalMatches: 0,
  totalClicks: 0,
  waitingListCount: 0,
  pendingReviewsCount: 0,
  isNewRecord: false,
  netGrowth90d: 0
};

export default function AdminVisaoGeralScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [cmoData, setCmoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<{ title: string; text: string } | null>(null);

  // Animação de rotação para o ícone de atualizar manual
  const spinAnim = useRef(new Animated.Value(0)).current;

  const startSpinAnimation = () => {
    spinAnim.setValue(0);
    Animated.timing(spinAnim, {
      toValue: 1,
      duration: 800,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  };

  const spinInterpolation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const fetchStats = async (isManual = false) => {
    if (isManual) {
      startSpinAnimation();
    }
    try {
      setOfflineMode(false);
      // Busca estatísticas gerais e dados de CMO simultaneamente
      const [statsRes, cmoRes] = await Promise.all([
        api.get('/api/admin/stats').catch(err => {
          console.warn('[Admin] Erro ao buscar /api/admin/stats:', err.message);
          return null;
        }),
        api.get('/api/cmo/dashboard').catch(err => {
          console.warn('[Admin] Erro ao buscar /api/cmo/dashboard:', err.message);
          return null;
        })
      ]);

      if (statsRes?.data) {
        setStats(statsRes.data);
      } else if (!stats) {
        setStats(emptyStats);
        setOfflineMode(true);
      }

      if (cmoRes?.data) {
        setCmoData(cmoRes.data);
      }
    } catch (error) {
      console.error('[Admin] Erro geral ao atualizar dados:', error);
      setOfflineMode(true);
      if (!stats) setStats(emptyStats);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Auto-refresh a cada 60 segundos (igual à web)
    const interval = setInterval(() => {
      fetchStats();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStats(true);
  }, []);

  // Formatador de Moeda (BRL)
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  // Formatador de Número
  const formatNumber = (value: number) => {
    return (value || 0).toLocaleString('pt-BR');
  };

  // Cálculo de Marcos Estratégicos (Breakeven, Saída MEI 70, Pró-labore 120)
  const currentPaying = parseInt(stats?.psychologists?.paying) || 0;
  const metaSpend = parseFloat(cmoData?.ads?.meta?.spend) || 0;
  const googleSpend = parseFloat(cmoData?.ads?.google?.spend) || 0;
  const totalAds = metaSpend + googleSpend;
  
  let breakevenTarget = Math.ceil((totalAds / 99) + 5);
  if (isNaN(breakevenTarget) || breakevenTarget < 10) breakevenTarget = 10;

  let netGrowthPerMonth = 0;
  if (stats?.netGrowth90d !== undefined && stats?.netGrowth90d !== null) {
    netGrowthPerMonth = stats.netGrowth90d / 3;
  } else {
    const rawNew30d = parseInt(stats?.newPsis30d) || 0;
    netGrowthPerMonth = rawNew30d > 0 ? (rawNew30d / 2) : 0;
  }

  const formatProjection = (target: number) => {
    const pct = target > 0 ? (currentPaying / target) * 100 : 0;
    const pctBadge = pct >= 100 ? '✓ 100%' : `▲ ${pct.toFixed(1).replace('.', ',')}%`;

    if (currentPaying >= target) return { text: 'Atingido', badge: pctBadge, achieved: true };
    if (netGrowthPerMonth <= 0) return { text: 'Estagnado', badge: pctBadge, achieved: false };

    const monthsNeeded = (target - currentPaying) / netGrowthPerMonth;
    if (monthsNeeded > 60 || !isFinite(monthsNeeded)) return { text: 'Longo Prazo', badge: pctBadge, achieved: false };

    const projDate = new Date();
    projDate.setMonth(projDate.getMonth() + Math.ceil(monthsNeeded));
    const fMonth = projDate.toLocaleString('pt-BR', { month: 'short' });
    const fYear = projDate.getFullYear();
    const dateStr = `${fMonth}/${fYear}`.replace('.', '');

    return { text: dateStr, badge: pctBadge, achieved: false };
  };

  const projBreakeven = formatProjection(breakevenTarget);
  const proj70 = formatProjection(70);
  const proj120 = formatProjection(120);

  const MAX_SCALE = Math.max(120, currentPaying, breakevenTarget);
  const progressPercent = Math.min(100, Math.max(0, (currentPaying / MAX_SCALE) * 100));

  if (loading && !stats) {
    return (
      <View className="flex-1 justify-center items-center bg-[#f8f9fa]">
        <ActivityIndicator size="large" color="#1B4332" />
        <Text className="mt-4 font-sans text-[#666] text-[13px]">Buscando dados em tempo real...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#f8f9fa]">
      <ScrollView 
        className="flex-1 px-4 pt-4" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 130 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1B4332" />
        }
      >
        {/* Banner de Modo Offline se a API estiver fora do ar */}
        {offlineMode && (
          <View className="bg-[#fef3c7] p-3 rounded-[14px] mb-4 border border-[#fde68a] flex-row items-center">
            <Feather name="wifi-off" size={16} color="#d97706" style={{ marginRight: 8 }} />
            <Text className="font-sans text-[#b45309] text-[12px] flex-1">
              Modo Offline. Conectando aos serviços da Yelo...
            </Text>
          </View>
        )}

        {/* Easter Egg: Recorde Histórico de Assinantes */}
        {stats?.isNewRecord && (
          <View className="bg-[#fffbeb] border border-[#fde68a] rounded-[16px] p-3.5 mb-4 flex-row items-center gap-3 shadow-sm">
            <Text className="text-[24px]">👑</Text>
            <View className="flex-1">
              <Text className="font-title font-bold text-[#b45309] text-[14px]">Novo Recorde Histórico!</Text>
              <Text className="font-sans text-[#92400e] text-[11px] mt-0.5">
                A plataforma alcançou o maior volume de psicólogos pagantes de sua história.
              </Text>
            </View>
          </View>
        )}

        {/* 1. HERO BLOCK (modern-hero-card) — Espelho exato da Web */}
        <LinearGradient
          colors={['#1B4332', '#2A5A40']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 24,
            padding: 22,
            marginBottom: 20,
            shadowColor: '#1B4332',
            shadowOpacity: 0.12,
            shadowRadius: 35,
            shadowOffset: { width: 0, height: 12 },
            elevation: 5,
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Efeito decorativo de fundo (radial subtle) */}
          <View className="absolute -top-[50px] -right-[50px] w-[200px] h-[200px] bg-white/5 rounded-full pointer-events-none" />

          {/* Header: Título + Botão Atualizar */}
          <View className="flex-row justify-between items-start mb-6">
            <View className="flex-1 pr-3">
              <Text className="font-title text-white text-[24px] font-bold leading-tight mb-1">
                Visão Geral da Plataforma
              </Text>
              <Text className="font-sans text-white/85 text-[13px]">
                Acompanhe as métricas e o crescimento da Yelo.
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => fetchStats(true)}
              className="bg-[#FFEE8C] px-3.5 py-2 rounded-full flex-row items-center gap-1.5 shadow-sm"
            >
              <Animated.View style={{ transform: [{ rotate: spinInterpolation }] }}>
                <Feather name="refresh-cw" size={13} color="#1B4332" />
              </Animated.View>
              <Text className="font-sans font-bold text-[#1B4332] text-[12px]">
                Atualizar
              </Text>
            </TouchableOpacity>
          </View>

          {/* Grid dos 4 KPIs Principais */}
          <View className="flex-row flex-wrap">
            {/* Receita Recorrente (MRR) */}
            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => setActiveTooltip({
                title: 'Receita Recorrente (MRR)',
                text: 'Soma das mensalidades ativas (exclui isentos/VIPs e inadimplentes).'
              })}
              className="w-1/2 pr-2 mb-4"
            >
              <Text className="font-title text-[#FFEE8C] text-[26px] font-bold leading-tight mb-1">
                {formatCurrency(stats?.mrr || 0)}
              </Text>
              <Text className="font-sans text-white/90 text-[10px] uppercase tracking-wider font-semibold">
                Receita Recorrente (MRR)
              </Text>
            </TouchableOpacity>

            {/* Novos Pacientes (30d) */}
            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => setActiveTooltip({
                title: 'Novos Pacientes (30d)',
                text: 'Pacientes que se cadastraram nos últimos 30 dias.'
              })}
              className="w-1/2 pl-2 mb-4"
            >
              <Text className="font-title text-[#FFEE8C] text-[26px] font-bold leading-tight mb-1">
                {stats?.newPatients30d ?? 0}
              </Text>
              <Text className="font-sans text-white/90 text-[10px] uppercase tracking-wider font-semibold">
                Novos Pacientes (30d)
              </Text>
            </TouchableOpacity>

            {/* Novos Psicólogos (30d) */}
            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => setActiveTooltip({
                title: 'Novos Psicólogos (30d)',
                text: 'Psicólogos que tiveram suas contas aprovadas e ativadas nos últimos 30 dias.'
              })}
              className="w-1/2 pr-2"
            >
              <Text className="font-title text-[#FFEE8C] text-[26px] font-bold leading-tight mb-1">
                {stats?.newPsis30d ?? 0}
              </Text>
              <Text className="font-sans text-white/90 text-[10px] uppercase tracking-wider font-semibold">
                Novos Psicólogos (30d)
              </Text>
            </TouchableOpacity>

            {/* Questionários (Hoje) */}
            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => setActiveTooltip({
                title: 'Questionários (Hoje)',
                text: 'Questionários iniciados e concluídos na data de hoje.'
              })}
              className="w-1/2 pl-2"
            >
              <Text className="font-title text-[#FFEE8C] text-[26px] font-bold leading-tight mb-1">
                {stats?.questToday ?? 0}
              </Text>
              <Text className="font-sans text-white/90 text-[10px] uppercase tracking-wider font-semibold">
                Questionários (Hoje)
              </Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* 2. RAIO-X DA BASE (modern-patients-card) — Espelho exato da Web */}
        <View className="bg-white rounded-[24px] p-5 mb-5 border border-[#e2e8f0] shadow-sm">
          <Text className="font-title text-[#1B4332] text-[20px] font-bold mb-4">
            Raio-X da Base
          </Text>

          {/* GRUPO 1: BASE DE PSICÓLOGOS */}
          <View className="bg-[#f8f9fa] rounded-[16px] p-4 mb-4 border border-[#f1f5f9]">
            <Text className="font-sans font-bold text-[#64748b] text-[10px] uppercase tracking-wider mb-2">
              Base de Psicólogos
            </Text>
            <View className="flex-row flex-wrap">
              {/* Total Cadastrados */}
              <View className="w-1/2 p-2 items-center">
                <Text className="font-title text-[#1B4332] text-[24px] font-bold mb-1">
                  {stats?.psychologists?.total ?? 0}
                </Text>
                <TouchableOpacity 
                  onPress={() => setActiveTooltip({
                    title: 'Total Cadastrados',
                    text: 'Todos os psicólogos já registrados na plataforma.'
                  })}
                  className="flex-row items-center justify-center gap-1"
                >
                  <Text className="font-sans text-[#64748b] text-[11px] uppercase tracking-wider text-center font-medium">
                    Total Cadastrados
                  </Text>
                  <View className="w-3.5 h-3.5 rounded-full bg-[#e2e8f0] items-center justify-center">
                    <Text className="text-[9px] font-bold text-[#64748b]">i</Text>
                  </View>
                </TouchableOpacity>
                <Text className="font-sans text-[11px] text-[#64748b] text-center mt-1">
                  Excluídos: <Text className="text-[#ef4444] font-bold">{stats?.psychologists?.deleted ?? 0}</Text>
                </Text>
              </View>

              {/* Psicólogos Ativos */}
              <View className="w-1/2 p-2 items-center">
                <Text className="font-title text-[#1B4332] text-[24px] font-bold mb-1">
                  {stats?.psychologists?.active ?? 0}
                </Text>
                <TouchableOpacity 
                  onPress={() => setActiveTooltip({
                    title: 'Psicólogos Ativos',
                    text: 'Psicólogos com assinaturas vigentes, isentos e perfil visível.'
                  })}
                  className="flex-row items-center justify-center gap-1"
                >
                  <Text className="font-sans text-[#64748b] text-[11px] uppercase tracking-wider text-center font-medium">
                    Psicólogos Ativos
                  </Text>
                  <View className="w-3.5 h-3.5 rounded-full bg-[#e2e8f0] items-center justify-center">
                    <Text className="text-[9px] font-bold text-[#64748b]">i</Text>
                  </View>
                </TouchableOpacity>
                <Text className="font-sans text-[10px] text-[#64748b] text-center mt-1">
                  Essencial: <Text className="font-semibold text-[#1e293b]">{stats?.psychologists?.byPlan?.['Essencial'] ?? 0}</Text> | Clínico: <Text className="font-semibold text-[#1e293b]">{stats?.psychologists?.byPlan?.['Clínico'] ?? 0}</Text> | Ref: <Text className="font-semibold text-[#1e293b]">{stats?.psychologists?.byPlan?.['Sol'] ?? 0}</Text>
                </Text>
              </View>

              {/* Psicólogos Pagantes */}
              <View className="w-1/2 p-2 items-center mt-2">
                <Text className="font-title text-[#1B4332] text-[24px] font-bold mb-1">
                  {stats?.psychologists?.paying ?? 0}
                </Text>
                <TouchableOpacity 
                  onPress={() => setActiveTooltip({
                    title: 'Psicólogos Pagantes',
                    text: 'Psicólogos com assinaturas vigentes (sem isenção).'
                  })}
                  className="flex-row items-center justify-center gap-1"
                >
                  <Text className="font-sans text-[#64748b] text-[11px] uppercase tracking-wider text-center font-medium">
                    Psicólogos Pagantes
                  </Text>
                  <View className="w-3.5 h-3.5 rounded-full bg-[#e2e8f0] items-center justify-center">
                    <Text className="text-[9px] font-bold text-[#64748b]">i</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Em período de teste */}
              <View className="w-1/2 p-2 items-center mt-2">
                <Text className="font-title text-[#1B4332] text-[24px] font-bold mb-1">
                  {stats?.psychologists?.trials ?? 0}
                </Text>
                <TouchableOpacity 
                  onPress={() => setActiveTooltip({
                    title: 'Em período de teste',
                    text: 'Psicólogos ativos utilizando o período de trial gratuito.'
                  })}
                  className="flex-row items-center justify-center gap-1"
                >
                  <Text className="font-sans text-[#64748b] text-[11px] uppercase tracking-wider text-center font-medium">
                    Em período de teste
                  </Text>
                  <View className="w-3.5 h-3.5 rounded-full bg-[#e2e8f0] items-center justify-center">
                    <Text className="text-[9px] font-bold text-[#64748b]">i</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* GRUPO 2: FUNIL E DEMANDA */}
          <View className="bg-[#f8f9fa] rounded-[16px] p-4 mb-5 border border-[#f1f5f9]">
            <Text className="font-sans font-bold text-[#64748b] text-[10px] uppercase tracking-wider mb-2">
              Funil e Demanda
            </Text>
            <View className="flex-row flex-wrap">
              {/* Taxa Conversão Geral */}
              <View className="w-1/2 p-2 items-center">
                <Text className="font-title text-[#1B4332] text-[24px] font-bold mb-1">
                  {stats?.overallConversionRate ?? 0}%
                </Text>
                <TouchableOpacity 
                  onPress={() => setActiveTooltip({
                    title: 'Taxa Conversão Geral',
                    text: 'Porcentagem de questionários que resultaram em um clique de contato no WhatsApp.'
                  })}
                  className="flex-row items-center justify-center gap-1"
                >
                  <Text className="font-sans text-[#64748b] text-[11px] uppercase tracking-wider text-center font-medium">
                    Taxa Conversão Geral
                  </Text>
                  <View className="w-3.5 h-3.5 rounded-full bg-[#e2e8f0] items-center justify-center">
                    <Text className="text-[9px] font-bold text-[#64748b]">i</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Total Aparições (Match) */}
              <View className="w-1/2 p-2 items-center">
                <Text className="font-title text-[#1B4332] text-[24px] font-bold mb-1">
                  {formatNumber(stats?.totalMatches)}
                </Text>
                <TouchableOpacity 
                  onPress={() => setActiveTooltip({
                    title: 'Total Aparições (Match)',
                    text: 'Volume total de questionários que geraram sugestões de psicólogos para os pacientes.'
                  })}
                  className="flex-row items-center justify-center gap-1"
                >
                  <Text className="font-sans text-[#64748b] text-[11px] uppercase tracking-wider text-center font-medium">
                    Aparições (Match)
                  </Text>
                  <View className="w-3.5 h-3.5 rounded-full bg-[#e2e8f0] items-center justify-center">
                    <Text className="text-[9px] font-bold text-[#64748b]">i</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Total Cliques (Contato) */}
              <View className="w-1/2 p-2 items-center mt-2">
                <Text className="font-title text-[#1B4332] text-[24px] font-bold mb-1">
                  {formatNumber(stats?.totalClicks)}
                </Text>
                <TouchableOpacity 
                  onPress={() => setActiveTooltip({
                    title: 'Total Cliques (Contato)',
                    text: 'Total de contatos efetivos realizados (cliques para abrir o WhatsApp dos psicólogos).'
                  })}
                  className="flex-row items-center justify-center gap-1"
                >
                  <Text className="font-sans text-[#64748b] text-[11px] uppercase tracking-wider text-center font-medium">
                    Cliques (Contato)
                  </Text>
                  <View className="w-3.5 h-3.5 rounded-full bg-[#e2e8f0] items-center justify-center">
                    <Text className="text-[9px] font-bold text-[#64748b]">i</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Fila de Espera */}
              <View className="w-1/2 p-2 items-center mt-2">
                <Text className="font-title text-[#1B4332] text-[24px] font-bold mb-1">
                  {stats?.waitingListCount ?? 0}
                </Text>
                <TouchableOpacity 
                  onPress={() => setActiveTooltip({
                    title: 'Fila de Espera',
                    text: 'Pacientes que estão aguardando contato na lista de espera.'
                  })}
                  className="flex-row items-center justify-center gap-1"
                >
                  <Text className="font-sans text-[#64748b] text-[11px] uppercase tracking-wider text-center font-medium">
                    Fila de Espera
                  </Text>
                  <View className="w-3.5 h-3.5 rounded-full bg-[#e2e8f0] items-center justify-center">
                    <Text className="text-[9px] font-bold text-[#64748b]">i</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* MARCOS ESTRATÉGICOS (PAGANTES) — Single Bar com Marcos */}
          <View style={{ borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text className="font-title text-[#1e293b] text-[15px] font-bold">
                Marcos Estratégicos (Pagantes)
              </Text>
              <View className="bg-[#f1f5f9] px-2.5 py-0.5 rounded-full">
                <Text className="font-sans text-[11px] font-bold text-[#64748b]">
                  Atual: <Text className="text-[#6366f1]">{currentPaying}</Text>
                </Text>
              </View>
            </View>

            {/* Single Progress Bar com altura fixa em pixels */}
            <View style={{ height: 16, backgroundColor: '#e2e8f0', borderRadius: 999, overflow: 'hidden', marginBottom: 14, width: '100%' }}>
              <LinearGradient
                colors={['#6366f1', '#8b5cf6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ width: `${Math.max(2, Math.min(100, progressPercent))}%`, height: 16, borderRadius: 999 }}
              />
            </View>

            {/* Marcadores Estratégicos */}
            <View style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
              {/* Breakeven */}
              <View style={{ flex: 1, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center' }}>
                <Text className="font-sans font-bold text-[#1d4ed8] text-[11px]">Breakeven</Text>
                <Text className="font-title font-bold text-[#1e293b] text-[17px] my-0.5">{breakevenTarget}</Text>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4, borderWidth: 1, borderColor: '#e2e8f0' }}>
                  <Text className="font-sans font-semibold text-[#64748b] text-[9px]">{projBreakeven.text}</Text>
                  <Text className="font-sans font-bold text-[#10b981] text-[9px]">{projBreakeven.badge}</Text>
                </View>
              </View>

              {/* Saída MEI */}
              <View style={{ flex: 1, backgroundColor: '#f5f3ff', borderWidth: 1, borderColor: '#ddd6fe', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center' }}>
                <Text className="font-sans font-bold text-[#6d28d9] text-[11px]">Saída MEI</Text>
                <Text className="font-title font-bold text-[#1e293b] text-[17px] my-0.5">70</Text>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4, borderWidth: 1, borderColor: '#e2e8f0' }}>
                  <Text className="font-sans font-semibold text-[#64748b] text-[9px]">{proj70.text}</Text>
                  <Text className="font-sans font-bold text-[#10b981] text-[9px]">{proj70.badge}</Text>
                </View>
              </View>

              {/* Pró-labore */}
              <View style={{ flex: 1, backgroundColor: '#fdf2f8', borderWidth: 1, borderColor: '#fbcfe8', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center' }}>
                <Text className="font-sans font-bold text-[#be185d] text-[11px]">Pró-labore</Text>
                <Text className="font-title font-bold text-[#1e293b] text-[17px] my-0.5">120</Text>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4, borderWidth: 1, borderColor: '#e2e8f0' }}>
                  <Text className="font-sans font-semibold text-[#64748b] text-[9px]">{proj120.text}</Text>
                  <Text className="font-sans font-bold text-[#10b981] text-[9px]">{proj120.badge}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* 3. ALERTAS E AÇÕES RÁPIDAS (modern-notifications-card) */}
        <View className="bg-white rounded-[24px] p-5 mb-5 border border-[#e2e8f0] shadow-sm">
          <Text className="font-title text-[#1B4332] text-[18px] font-bold mb-3.5">
            Alertas e Ações Rápidas
          </Text>

          {/* Candidatos na Lista de Espera */}
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => router.push('/(admin)/crm')}
            className="flex-row items-center bg-[#fef3c7] border border-[#fde68a] rounded-[16px] p-3.5 mb-3"
          >
            <Text className="text-[22px] mr-3">⏳</Text>
            <View className="flex-1">
              <Text className="font-sans text-[#333] text-[13px]">
                <Text className="font-bold text-[#b45309]">{stats?.waitingListCount || 0} Candidatos</Text> na Lista de Espera.
              </Text>
              <Text className="font-sans font-bold text-[#b45309] text-[11px] mt-0.5">
                Gerenciar agora →
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color="#b45309" />
          </TouchableOpacity>

          {/* Avaliações para Moderação */}
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => router.push('/(admin)/gestao-conteudo')}
            className="flex-row items-center bg-[#f3e8ff] border border-[#e9d5ff] rounded-[16px] p-3.5"
          >
            <Text className="text-[22px] mr-3">⭐</Text>
            <View className="flex-1">
              <Text className="font-sans text-[#333] text-[13px]">
                <Text className="font-bold text-[#6d28d9]">{stats?.pendingReviewsCount || 0} Avaliações</Text> para Moderação.
              </Text>
              <Text className="font-sans font-bold text-[#6d28d9] text-[11px] mt-0.5">
                Revisar agora →
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color="#6d28d9" />
          </TouchableOpacity>
        </View>

        {/* 4. ATIVIDADE RECENTE (modern-community-card) */}
        <View className="bg-white rounded-[24px] p-5 mb-5 border border-[#e2e8f0] shadow-sm">
          <Text className="font-title text-[#1B4332] text-[18px] font-bold mb-3">
            Atividade Recente
          </Text>
          <View className="items-center justify-center py-6">
            <Text className="text-[32px] mb-2">📡</Text>
            <Text className="font-sans text-[#64748b] text-[13px] text-center">
              Em breve você verá as atividades em tempo real aqui.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* MODAL DE TOOLTIP / EXPLICAÇÃO DE MÉTRICA */}
      <Modal
        visible={!!activeTooltip}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveTooltip(null)}
      >
        <TouchableOpacity 
          activeOpacity={1} 
          onPress={() => setActiveTooltip(null)}
          className="flex-1 bg-black/50 justify-center items-center px-6"
        >
          <View 
            className="bg-white rounded-[24px] p-6 w-full max-w-sm border border-[#e2e8f0] shadow-xl"
            onStartShouldSetResponder={() => true}
          >
            <View className="flex-row items-center gap-2 mb-3">
              <View className="w-8 h-8 rounded-full bg-[#e8f5e9] items-center justify-center">
                <Feather name="info" size={16} color="#1B4332" />
              </View>
              <Text className="font-title font-bold text-[#1B4332] text-[17px] flex-1">
                {activeTooltip?.title}
              </Text>
            </View>
            <Text className="font-sans text-[#475569] text-[14px] leading-5 mb-5">
              {activeTooltip?.text}
            </Text>
            <TouchableOpacity 
              onPress={() => setActiveTooltip(null)}
              className="bg-[#1B4332] py-2.5 rounded-full items-center justify-center"
            >
              <Text className="font-sans font-bold text-white text-[13px]">Entendi</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
