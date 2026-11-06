import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl 
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import api from '../../../services/api';
import YeloToast from '../../../components/YeloToast';

export default function AdminAnalyticsFunilScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [periodDays, setPeriodDays] = useState<number>(30);
  const [funnelData, setFunnelData] = useState<any>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  const fetchFunnel = async () => {
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - periodDays);

      const dStart = start.toISOString().split('T')[0];
      const dEnd = end.toISOString().split('T')[0];

      const res = await api.get(`/api/admin/analytics/funnel?startDate=${dStart}&endDate=${dEnd}`);
      if (res.data) {
        setFunnelData(res.data);
      }
    } catch (err: any) {
      console.error('Erro ao carregar funil:', err);
      setToastMessage('Falha ao carregar métricas de funil.');
      setToastType('error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFunnel();
  }, [periodDays]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchFunnel();
  }, [periodDays]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#f8fafc] items-center justify-center p-6">
        <ActivityIndicator size="large" color="#1B4332" />
        <Text className="font-sans text-[#64748b] mt-3">Calculando taxas do funil de conversão...</Text>
      </View>
    );
  }

  const visitas = Number(funnelData?.visitas || 0);
  const iniciaram = Number(funnelData?.iniciaram || 0);
  const completaram = Number(funnelData?.completaram || 0);
  const profileViews = Number(funnelData?.profileViews || 0);
  const whatsappClicks = Number(funnelData?.whatsappClicks || 0);
  const whatsappUnique = Number(funnelData?.whatsappUnique || 0);

  // Taxas de conversão
  const rateIniciaram = visitas > 0 ? ((iniciaram / visitas) * 100).toFixed(1) : '0';
  const rateCompletaram = iniciaram > 0 ? ((completaram / iniciaram) * 100).toFixed(1) : '0';
  const rateClicks = completaram > 0 ? ((whatsappClicks / completaram) * 100).toFixed(1) : '0';
  const rateGeral = visitas > 0 ? ((whatsappUnique / visitas) * 100).toFixed(1) : '0';

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
            <View className="w-9 h-9 rounded-full bg-[#f59e0b] items-center justify-center">
              <Feather name="filter" size={18} color="white" />
            </View>
            <View className="flex-1">
              <Text className="font-title text-white text-[22px]">Analytics de Funil 📈</Text>
              <Text className="font-sans text-white/80 text-[12px]">
                Conversão de ponta a ponta: Visitas ➔ Match ➔ WhatsApp
              </Text>
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

        {/* ETAPAS VISUAIS DO FUNIL */}
        <View className="gap-2.5 mb-5">
          {/* Etapa 1: Visitas */}
          <View className="bg-white rounded-[18px] border border-[#e2e8f0] p-4 shadow-xs">
            <View className="flex-row items-center justify-between mb-1">
              <View className="flex-row items-center gap-2">
                <View className="w-7 h-7 rounded-full bg-[#f1f5f9] items-center justify-center">
                  <Text className="text-[12px]">🌐</Text>
                </View>
                <Text className="font-title text-[#1e293b] text-[15px]">1. Visitas no Site</Text>
              </View>
              <Text className="font-title text-[#1B4332] text-[18px]">{visitas}</Text>
            </View>
            <Text className="font-sans text-[#64748b] text-[11.5px]">Acessos únicos e visitantes recebidos</Text>
          </View>

          {/* Etapa 2: Iniciaram */}
          <View className="bg-white rounded-[18px] border border-[#e2e8f0] p-4 shadow-xs">
            <View className="flex-row items-center justify-between mb-1">
              <View className="flex-row items-center gap-2">
                <View className="w-7 h-7 rounded-full bg-[#fef3c7] items-center justify-center">
                  <Text className="text-[12px]">📝</Text>
                </View>
                <Text className="font-title text-[#1e293b] text-[15px]">2. Iniciaram Questionário</Text>
              </View>
              <View className="items-end">
                <Text className="font-title text-[#1B4332] text-[18px]">{iniciaram}</Text>
                <Text className="font-sans text-[10.5px] text-[#ca8a04] font-bold">{rateIniciaram}% das visitas</Text>
              </View>
            </View>
          </View>

          {/* Etapa 3: Concluíram */}
          <View className="bg-white rounded-[18px] border border-[#e2e8f0] p-4 shadow-xs">
            <View className="flex-row items-center justify-between mb-1">
              <View className="flex-row items-center gap-2">
                <View className="w-7 h-7 rounded-full bg-[#dcfce7] items-center justify-center">
                  <Text className="text-[12px]">✅</Text>
                </View>
                <Text className="font-title text-[#1e293b] text-[15px]">3. Completaram o Match</Text>
              </View>
              <View className="items-end">
                <Text className="font-title text-[#1B4332] text-[18px]">{completaram}</Text>
                <Text className="font-sans text-[10.5px] text-[#16a34a] font-bold">{rateCompletaram}% concluíram</Text>
              </View>
            </View>
          </View>

          {/* Etapa 4: Perfis Visualizados */}
          <View className="bg-white rounded-[18px] border border-[#e2e8f0] p-4 shadow-xs">
            <View className="flex-row items-center justify-between mb-1">
              <View className="flex-row items-center gap-2">
                <View className="w-7 h-7 rounded-full bg-[#e0f2fe] items-center justify-center">
                  <Text className="text-[12px]">👁️</Text>
                </View>
                <Text className="font-title text-[#1e293b] text-[15px]">4. Perfis Visualizados</Text>
              </View>
              <Text className="font-title text-[#1B4332] text-[18px]">{profileViews}</Text>
            </View>
          </View>

          {/* Etapa 5: WhatsApp Clicks */}
          <View className="bg-[#f0fdf4] rounded-[18px] border border-[#bbf7d0] p-4 shadow-xs">
            <View className="flex-row items-center justify-between mb-1">
              <View className="flex-row items-center gap-2">
                <View className="w-7 h-7 rounded-full bg-[#25d366] items-center justify-center">
                  <Text className="text-[12px]">💬</Text>
                </View>
                <Text className="font-title text-[#166534] text-[15px]">5. Conversões no WhatsApp</Text>
              </View>
              <View className="items-end">
                <Text className="font-title text-[#166534] text-[20px]">{whatsappClicks}</Text>
                <Text className="font-sans text-[10.5px] text-[#166534] font-bold">
                  {whatsappUnique} pacientes únicos
                </Text>
              </View>
            </View>
            <Text className="font-sans text-[#15803d] text-[11.5px] mt-1">
              Taxa de clique do Match no WhatsApp: {rateClicks}%
            </Text>
          </View>
        </View>

        {/* RESUMO DE EFICIÊNCIA GERAL */}
        <View className="bg-white rounded-[20px] border border-[#e2e8f0] p-4 shadow-xs">
          <Text className="font-title text-[#1e293b] text-[15px] mb-2.5">
            Eficiência Geral do Funil 🎯
          </Text>

          <View className="flex-row items-center justify-between bg-[#f8fafc] p-3 rounded-xl border border-[#f1f5f9] mb-2">
            <Text className="font-sans text-[12.5px] text-[#64748b]">Conversão Geral (Visitas ➔ Lead):</Text>
            <Text className="font-title text-[#1B4332] text-[16px]">{rateGeral}%</Text>
          </View>

          <View className="flex-row items-center gap-1.5 mt-1">
            <Feather name="info" size={13} color="#64748b" />
            <Text className="font-sans text-[11px] text-[#64748b]">
              Métricas consolidadas com base nos eventos e tracking nativo.
            </Text>
          </View>
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

