import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl, 
  TextInput
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import api from '../../../services/api';
import YeloToast from '../../../components/YeloToast';

export default function AdminDistribuicaoScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [periodDays, setPeriodDays] = useState<number>(30);

  const [metrics, setMetrics] = useState<any>({});
  const [suggestion, setSuggestion] = useState<string>('');
  const [alertLevel, setAlertLevel] = useState<string>('warning');
  const [psychologists, setPsychologists] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  const fetchVisibilityData = async () => {
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - periodDays);

      const startDateStr = start.toISOString().split('T')[0];
      const endDateStr = end.toISOString().split('T')[0];

      const res = await api.get(`/api/admin/analytics/visibility?startDate=${startDateStr}&endDate=${endDateStr}`);
      if (res.data) {
        setMetrics(res.data.metrics || {});
        setPsychologists(res.data.psychologists || []);
        setAlertLevel(res.data.alertLevel || 'warning');

        // Lógica de cálculo de sugestão de Ads
        const totalDemand = Number(res.data.metrics?.totalDemand || 0);
        const idealCapacity = Number(res.data.metrics?.idealCapacity || 0);
        let suggText = res.data.suggestion;

        if (idealCapacity > totalDemand) {
          const deficit = idealCapacity - totalDemand;
          const adIncrease = deficit * 2.24;
          const valFormatted = `R$ ${adIncrease.toFixed(2).replace('.', ',')}`;
          suggText = `Recomendamos adicionar ${valFormatted} em Google Ads este mês para cobrir o déficit de ${deficit} buscas e garantir 1 lead real por profissional.`;
        }

        setSuggestion(suggText || 'Volume de tráfego equilibrado com a base de psicólogos ativos.');
      }
    } catch (err: any) {
      console.error('Erro ao carregar distribuição:', err);
      setToastMessage('Falha ao carregar dados de distribuição e visibilidade.');
      setToastType('error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchVisibilityData();
  }, [periodDays]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchVisibilityData();
  }, [periodDays]);

  const filteredPsys = psychologists.filter(p => {
    if (!searchQuery) return true;
    const nameMatch = p.nome?.toLowerCase().includes(searchQuery.toLowerCase());
    const crpMatch = p.crp?.toLowerCase().includes(searchQuery.toLowerCase());
    const emailMatch = p.email?.toLowerCase().includes(searchQuery.toLowerCase());
    return nameMatch || crpMatch || emailMatch;
  });

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#f8fafc] items-center justify-center p-6">
        <ActivityIndicator size="large" color="#1B4332" />
        <Text className="font-sans text-[#64748b] mt-3">Calculando distribuição e métricas de Ads...</Text>
      </View>
    );
  }

  const alertColors: { [k: string]: { bg: string; border: string; text: string; icon: string } } = {
    warning: { bg: 'bg-[#fffbeb]', border: 'border-[#fef08a]', text: 'text-[#854d0e]', icon: '🚨' },
    danger: { bg: 'bg-[#fef2f2]', border: 'border-[#fecaca]', text: 'text-[#991b1b]', icon: '🔥' },
    success: { bg: 'bg-[#f0fdf4]', border: 'border-[#bbf7d0]', text: 'text-[#166534]', icon: '✅' },
  };
  const currentAlert = alertColors[alertLevel] || alertColors.warning;

  return (
    <View className="flex-1 bg-[#f8fafc]">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 18, paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#1B4332" />}
      >
        {/* HEADER */}
        <View className="bg-[#1B4332] rounded-[24px] p-5 mb-5 shadow-sm relative overflow-hidden">
          <View className="flex-row items-center gap-2 mb-1.5">
            <View className="w-9 h-9 rounded-full bg-[#FFEE8C] items-center justify-center">
              <Feather name="bar-chart-2" size={18} color="#1B4332" />
            </View>
            <View className="flex-1">
              <Text className="font-title text-white text-[22px]">Distribuição & Ads 📊</Text>
              <Text className="font-sans text-white/80 text-[12px]">Visibilidade justa e sugestão de investimento</Text>
            </View>
          </View>
        </View>

        {/* SELETOR DE PERÍODO */}
        <View className="flex-row gap-2 mb-4">
          {[
            { days: 7, label: '7 Dias' },
            { days: 30, label: '30 Dias' },
            { days: 90, label: '90 Dias' },
          ].map(p => (
            <TouchableOpacity
              key={p.days}
              onPress={() => setPeriodDays(p.days)}
              className={`flex-1 py-2 rounded-xl items-center border ${
                periodDays === p.days
                  ? 'bg-[#1B4332] border-[#1B4332]'
                  : 'bg-white border-[#e2e8f0]'
              }`}
            >
              <Text className={`font-sans font-bold text-[12px] ${
                periodDays === p.days ? 'text-white' : 'text-[#64748b]'
              }`}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* SUGESTÃO DE ADS / MOTOR DE DECISÃO */}
        <View className={`rounded-[20px] p-4 border ${currentAlert.bg} ${currentAlert.border} mb-4 shadow-xs`}>
          <View className="flex-row items-start gap-2.5">
            <Text className="text-[22px]">{currentAlert.icon}</Text>
            <View className="flex-1">
              <Text className="font-title text-[#0f172a] text-[15px] mb-1">
                Motor de Decisão de Ads
              </Text>
              <Text className={`font-sans text-[12.5px] leading-relaxed ${currentAlert.text}`}>
                {suggestion}
              </Text>
            </View>
          </View>
        </View>

        {/* KPIS */}
        <View className="flex-row gap-2.5 mb-2.5">
          <View className="flex-1 bg-white p-3.5 rounded-[18px] border border-[#e2e8f0] shadow-xs">
            <Text className="font-sans text-[11px] text-[#64748b] font-semibold uppercase">Demanda (Buscas)</Text>
            <Text className="font-title text-[#1B4332] text-[20px] mt-0.5">{metrics.totalDemand || 0}</Text>
          </View>

          <View className="flex-1 bg-white p-3.5 rounded-[18px] border border-[#e2e8f0] shadow-xs">
            <Text className="font-sans text-[11px] text-[#64748b] font-semibold uppercase">Psis Ativos</Text>
            <Text className="font-title text-[#1B4332] text-[20px] mt-0.5">{metrics.activePsyCount || 0}</Text>
          </View>
        </View>

        <View className="flex-row gap-2.5 mb-4">
          <View className="flex-1 bg-white p-3.5 rounded-[18px] border border-[#e2e8f0] shadow-xs">
            <Text className="font-sans text-[11px] text-[#64748b] font-semibold uppercase">Cota Ideal</Text>
            <Text className="font-title text-[#1B4332] text-[20px] mt-0.5">{metrics.idealCapacity || 0}</Text>
          </View>

          <View className="flex-1 bg-white p-3.5 rounded-[18px] border border-[#e2e8f0] shadow-xs">
            <Text className="font-sans text-[11px] text-[#64748b] font-semibold uppercase">Velocidade Média</Text>
            <Text className="font-title text-[#1B4332] text-[20px] mt-0.5">{metrics.avgVelocity || '0%'}</Text>
          </View>
        </View>

        {/* SEARCH BAR */}
        <View className="bg-white border border-[#e2e8f0] rounded-[16px] px-3.5 py-2.5 flex-row items-center gap-2 mb-3 shadow-xs">
          <Feather name="search" size={17} color="#94a3b8" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Buscar psicólogo por nome, CRP ou e-mail..."
            placeholderTextColor="#94a3b8"
            className="flex-1 font-sans text-[13.5px] text-[#1e293b]"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x-circle" size={16} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* LISTA DE PSICÓLOGOS */}
        <View className="gap-3">
          {filteredPsys.length === 0 ? (
            <View className="bg-white rounded-[20px] p-8 items-center justify-center border border-[#e2e8f0]">
              <Feather name="user-x" size={36} color="#cbd5e1" />
              <Text className="font-title text-[#475569] text-[16px] mt-2">Nenhum profissional listado</Text>
            </View>
          ) : (
            filteredPsys.map((psy: any) => {
              return (
                <View 
                  key={psy.id} 
                  className="bg-white rounded-[20px] border border-[#e2e8f0] p-4 shadow-xs"
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-1 mr-2">
                      <Text className="font-title text-[#1e293b] text-[15.5px]">
                        {psy.nome}
                      </Text>
                      <Text className="font-sans text-[#64748b] text-[11.5px]">
                        CRP: {psy.crp || 'Não inf.'} • {psy.plano || 'Sem Plano'}
                      </Text>
                    </View>

                    <View className="bg-[#f0fdf4] border border-[#bbf7d0] px-2.5 py-1 rounded-full">
                      <Text className="font-sans font-bold text-[#166534] text-[11px]">
                        {psy.clicks || 0} Clicks
                      </Text>
                    </View>
                  </View>

                  {/* Estatísticas de Funil do Psi */}
                  <View className="flex-row bg-[#f8fafc] p-2.5 rounded-xl border border-[#f1f5f9] gap-2">
                    <View className="flex-1 items-center">
                      <Text className="font-sans text-[10px] text-[#64748b] uppercase">Impressões</Text>
                      <Text className="font-title text-[#1e293b] text-[13px]">{psy.impressions || 0}</Text>
                    </View>
                    <View className="w-[1px] bg-[#e2e8f0]" />
                    <View className="flex-1 items-center">
                      <Text className="font-sans text-[10px] text-[#64748b] uppercase">Visualizações</Text>
                      <Text className="font-title text-[#1e293b] text-[13px]">{psy.views || 0}</Text>
                    </View>
                    <View className="w-[1px] bg-[#e2e8f0]" />
                    <View className="flex-1 items-center">
                      <Text className="font-sans text-[10px] text-[#64748b] uppercase">Conversão</Text>
                      <Text className="font-title text-[#166534] text-[13px]">{psy.conversionRate || '0%'}</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <YeloToast 
        message={toastMessage} 
        onDismiss={() => setToastMessage(null)} 
        type={toastType} 
      />
    </View>
  );
}

