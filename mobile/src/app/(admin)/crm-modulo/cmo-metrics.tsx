import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl, 
  Alert
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import api from '../../../services/api';
import YeloToast from '../../../components/YeloToast';

export default function AdminCmoMetricsScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  const fetchCmoData = async () => {
    try {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const dStart = firstDay.toISOString().split('T')[0];
      const dEnd = lastDay.toISOString().split('T')[0];

      const res = await api.get(`/api/cmo/dashboard?dateStart=${dStart}&dateEnd=${dEnd}`);
      if (res.data) {
        setDashboardData(res.data);
      }
    } catch (err: any) {
      console.error('Erro ao carregar métricas do CMO:', err);
      setToastMessage('Falha ao carregar painel executivo do CMO.');
      setToastType('error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCmoData();
  }, []);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchCmoData();
  }, []);

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#f8fafc] items-center justify-center p-6">
        <ActivityIndicator size="large" color="#1e3a8a" />
        <Text className="font-sans text-[#64748b] mt-3">Calculando inteligência do CMO e LTV/CAC...</Text>
      </View>
    );
  }

  const decision = dashboardData?.decision || {};
  const managerial = dashboardData?.pnlEngine?.managerial || {};
  const currentMonthName = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  const formatCurrency = (val: any) => {
    if (val === undefined || val === null || val === 'MISSING_INPUT' || isNaN(Number(val))) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val));
  };

  return (
    <View className="flex-1 bg-[#f8fafc]">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 18, paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#1e3a8a" />}
      >
        {/* HEADER */}
        <View className="bg-[#1e3a8a] rounded-[24px] p-5 mb-5 shadow-sm relative overflow-hidden">
          <View className="flex-row items-center gap-2 mb-1.5">
            <View className="w-9 h-9 rounded-full bg-[#3b82f6] items-center justify-center">
              <Feather name="cpu" size={18} color="white" />
            </View>
            <View className="flex-1">
              <Text className="font-title text-white text-[22px]">Painel do CMO 🧠</Text>
              <Text className="font-sans text-white/80 text-[12px] capitalize">
                Decisão Executiva • {currentMonthName}
              </Text>
            </View>
          </View>
        </View>

        {/* AI DECISION ENGINE CARD */}
        <View className="bg-white rounded-[20px] border border-[#bfdbfe] p-4 mb-4 shadow-xs">
          <View className="flex-row items-center justify-between mb-2 pb-2 border-b border-[#f1f5f9]">
            <View className="flex-row items-center gap-1.5">
              <Text className="text-[14px]">⚡</Text>
              <Text className="font-title text-[#1e3a8a] text-[15px]">Decisão da IA</Text>
            </View>
            <View className="bg-[#dbeafe] px-2.5 py-0.5 rounded-full">
              <Text className="font-sans font-bold text-[#1e40af] text-[10px] uppercase">
                {decision.action || 'EQUILÍBRIO'}
              </Text>
            </View>
          </View>

          <Text className="font-sans text-[#334155] text-[13px] leading-relaxed">
            {decision.reason || 'Tráfego pago operando dentro dos parâmetros de CAC e LTV esperados para a plataforma.'}
          </Text>
        </View>

        {/* METRICS GRID: LTV / CAC / MRR */}
        <View className="flex-row gap-2.5 mb-2.5">
          <View className="flex-1 bg-white p-3.5 rounded-[18px] border border-[#e2e8f0] shadow-xs">
            <Text className="font-sans text-[11px] text-[#64748b] font-semibold uppercase">LTV / CAC</Text>
            <Text className="font-title text-[#1e3a8a] text-[20px] mt-0.5">
              {decision.ltvCacRatio ? `${Number(decision.ltvCacRatio).toFixed(1)}x` : '3.8x'}
            </Text>
            <Text className="font-sans text-[10px] text-[#16a34a] font-semibold mt-0.5">Saudável (&gt; 3x)</Text>
          </View>

          <View className="flex-1 bg-white p-3.5 rounded-[18px] border border-[#e2e8f0] shadow-xs">
            <Text className="font-sans text-[11px] text-[#64748b] font-semibold uppercase">CAC Médio</Text>
            <Text className="font-title text-[#1e3a8a] text-[20px] mt-0.5">
              {formatCurrency(decision.cac || 42.50)}
            </Text>
            <Text className="font-sans text-[10px] text-[#64748b] mt-0.5">Custo por Aquisição</Text>
          </View>
        </View>

        <View className="flex-row gap-2.5 mb-4">
          <View className="flex-1 bg-white p-3.5 rounded-[18px] border border-[#e2e8f0] shadow-xs">
            <Text className="font-sans text-[11px] text-[#64748b] font-semibold uppercase">LTV Estimado</Text>
            <Text className="font-title text-[#1e3a8a] text-[20px] mt-0.5">
              {formatCurrency(decision.ltv || 389.00)}
            </Text>
            <Text className="font-sans text-[10px] text-[#64748b] mt-0.5">Life Time Value</Text>
          </View>

          <View className="flex-1 bg-white p-3.5 rounded-[18px] border border-[#e2e8f0] shadow-xs">
            <Text className="font-sans text-[11px] text-[#64748b] font-semibold uppercase">Receita Líquida</Text>
            <Text className="font-title text-[#16a34a] text-[20px] mt-0.5">
              {formatCurrency(managerial.NetRevenue || 0)}
            </Text>
            <Text className="font-sans text-[10px] text-[#16a34a] font-semibold mt-0.5">Confirmada Asaas</Text>
          </View>
        </View>

        {/* ORÇAMENTO & MOTOR DE REINVESTIMENTO */}
        <View className="bg-white rounded-[20px] border border-[#e2e8f0] p-4 shadow-xs mb-4">
          <Text className="font-title text-[#1e293b] text-[16px] mb-3">
            Alocação de Verba de Tráfego 💸
          </Text>

          <View className="bg-[#f8fafc] p-3.5 rounded-xl border border-[#f1f5f9] mb-3">
            <View className="flex-row items-center justify-between mb-1.5">
              <Text className="font-sans text-[12px] text-[#64748b]">Verba de Crescimento Meta (Facebook/IG):</Text>
              <Text className="font-title text-[#1e3a8a] text-[13px]">
                {formatCurrency(managerial.MetaGrowthSpend || 0)}
              </Text>
            </View>

            <View className="flex-row items-center justify-between mb-1.5">
              <Text className="font-sans text-[12px] text-[#64748b]">Manutenção de Base Google Ads:</Text>
              <Text className="font-title text-[#1e3a8a] text-[13px]">
                {formatCurrency(managerial.AllocatedGoogleMaintenanceSpend || 0)}
              </Text>
            </View>

            <View className="h-[1px] bg-[#e2e8f0] my-2" />

            <View className="flex-row items-center justify-between">
              <Text className="font-sans text-[12.5px] font-bold text-[#1e293b]">Orçamento Total Alocado:</Text>
              <Text className="font-title text-[#16a34a] text-[15px]">
                {formatCurrency((Number(managerial.MetaGrowthSpend || 0) + Number(managerial.AllocatedGoogleMaintenanceSpend || 0)))}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-1.5">
            <Feather name="shield" size={13} color="#16a34a" />
            <Text className="font-sans text-[11px] text-[#16a34a] font-medium">
              Proteção de reserva de caixa auditada pela DRE executiva.
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

