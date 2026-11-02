import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl 
} from 'react-native';
import YeloScrollView from '../../components/YeloScrollView';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';

const ProgressBar = ({ label, percentage, color }: { label: string; percentage: number; color: string }) => (
  <View className="mb-4">
    <View className="flex-row justify-between mb-1.5">
      <Text className="font-sans text-[14px] text-[#333] font-bold">{label}</Text>
      <Text className="font-sans text-[13px] text-[#888]">{percentage}%</Text>
    </View>
    <View className="h-[8px] bg-[#f1f3f5] rounded-full overflow-hidden">
      <View 
        style={{ width: `${Math.min(100, Math.max(0, percentage))}%`, backgroundColor: color }} 
        className="h-full rounded-full" 
      />
    </View>
  </View>
);

export default function AnalyticsScreen() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);

  const fetchAnalytics = async () => {
    try {
      const res = await api.get('/api/psychologists/me/analytics');
      setData(res.data);
    } catch (e) {
      console.error("Erro ao buscar analytics:", e);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#f9fafb] items-center justify-center p-6">
        <ActivityIndicator size="large" color="#1B4332" />
        <Text className="font-sans text-[#666] mt-4">Carregando inteligência de mercado...</Text>
      </View>
    );
  }

  const price = data?.priceComparison || {};
  const myPrice = Math.round(price.myPrice || 0);
  const cityAvg = Math.round(price.cityAverage || 0);
  const platAvg = Math.round(price.platformAverage || 0);

  // Calcula altura proporcional para as barras de preço (max 100px)
  const maxPriceVal = Math.max(myPrice, cityAvg, platAvg, 1);
  const myPriceHeight = Math.max(20, Math.round((myPrice / maxPriceVal) * 100));
  const cityAvgHeight = Math.max(20, Math.round((cityAvg / maxPriceVal) * 100));
  const platAvgHeight = Math.max(20, Math.round((platAvg / maxPriceVal) * 100));

  const topTopics = data?.topTopics || [
    { name: 'Ansiedade e Estresse', percentage: 78, match: true },
    { name: 'Autoconhecimento e Autoestima', percentage: 65, match: true },
    { name: 'Relacionamentos e Conflitos', percentage: 54, match: false },
    { name: 'Carreira e Burnout', percentage: 42, match: true },
  ];

  const betterThan = data?.betterThanPercentage || 65;

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <YeloScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1B4332']} />
        }
      >
        {/* HEADER VERDE */}
        <View className="mx-5 mt-5 mb-6 bg-[#1B4332] p-[22px] rounded-[20px] shadow-sm">
          <View className="flex-row items-center mb-2">
            <TouchableOpacity 
              onPress={() => router.canGoBack() ? router.back() : router.navigate('/(tabs)/clinica')} 
              className="w-10 h-10 bg-white/20 rounded-full items-center justify-center mr-3"
            >
              <Feather name="arrow-left" size={20} color="white" />
            </TouchableOpacity>
            <Text className="font-title text-[24px] text-white flex-1">Métricas & Mercado</Text>
          </View>
          <Text className="font-sans text-[14px] text-white/85 mt-1 leading-5">
            Dados reais sobre a busca de pacientes e o posicionamento do seu perfil na Yelo.
          </Text>
        </View>

        {/* CARD AUTORIDADE RELATIVA */}
        <View className="mx-5 mb-5 bg-[#f0fdf4] border border-[#bbf7d0] p-5 rounded-[20px] shadow-sm">
          <View className="flex-row items-center gap-3 mb-2">
            <Text className="text-[28px]">🚀</Text>
            <View className="flex-1">
              <Text className="font-title text-[#166534] text-[18px]">Desempenho Relativo</Text>
              <Text className="font-sans text-[#15803d] text-[13px] leading-5">
                Seu perfil está melhor posicionado que <Text className="font-bold">{betterThan}%</Text> dos profissionais da plataforma.
              </Text>
            </View>
          </View>
        </View>

        {/* CARD 1: VALOR DA SESSÃO */}
        <View className="mx-5 mb-5 bg-white p-6 rounded-[20px] shadow-sm border border-[#e5e7eb]">
          <View className="flex-row items-center mb-2">
            <View className="w-[42px] h-[42px] bg-[#e8f5e9] rounded-[12px] items-center justify-center mr-3">
              <Text className="text-[20px]">💳</Text>
            </View>
            <Text className="font-title text-[18px] text-[#333]">Comparativo de Valor</Text>
          </View>
          <Text className="font-sans text-[13px] text-[#666] mb-6 leading-5">
            Veja como seu valor por sessão se compara com psicólogos da sua região e da média geral.
          </Text>

          {/* Gráfico de Barras Vertical */}
          <View className="flex-row justify-around items-end h-[160px] border-b border-[#e0e0e0] pb-2 mb-4">
            {/* Seu Valor */}
            <View className="items-center">
              <Text className="font-sans font-bold text-[#1B4332] text-[13px] mb-2">
                {myPrice > 0 ? `R$ ${myPrice}` : 'A combinar'}
              </Text>
              <View style={{ height: myPriceHeight }} className="w-[42px] bg-[#1B4332] rounded-t-[8px]" />
              <Text className="font-sans text-[11px] text-[#666] mt-2 w-[65px] text-center font-medium">Seu Valor</Text>
            </View>

            {/* Cidade */}
            <View className="items-center">
              <Text className="font-sans font-bold text-[#f59e0b] text-[13px] mb-2">
                {cityAvg > 0 ? `R$ ${cityAvg}` : 'R$ 130'}
              </Text>
              <View style={{ height: cityAvgHeight }} className="w-[42px] bg-[#fcd34d] rounded-t-[8px]" />
              <Text className="font-sans text-[11px] text-[#666] mt-2 w-[65px] text-center font-medium">Sua Região</Text>
            </View>

            {/* Plataforma */}
            <View className="items-center">
              <Text className="font-sans font-bold text-[#495057] text-[13px] mb-2">
                {platAvg > 0 ? `R$ ${platAvg}` : 'R$ 140'}
              </Text>
              <View style={{ height: platAvgHeight }} className="w-[42px] bg-[#adb5bd] rounded-t-[8px]" />
              <Text className="font-sans text-[11px] text-[#666] mt-2 w-[65px] text-center font-medium">Média Yelo</Text>
            </View>
          </View>

          {/* Dica da IA */}
          <View className="bg-[#f8f9fa] border-l-4 border-[#1B4332] p-3.5 rounded-[8px]">
            <Text className="font-sans text-[13px] text-[#444] leading-5">
              💡 {myPrice <= platAvg 
                ? "Seu valor é altamente competitivo e tem ótima atratividade para novos pacientes." 
                : "Seu valor reflete sua autoridade e especialização continuada."}
            </Text>
          </View>
        </View>

        {/* CARD 2: DEMANDAS MAIS BUSCADAS */}
        <View className="mx-5 mb-5 bg-white p-6 rounded-[20px] shadow-sm border border-[#e5e7eb]">
          <View className="flex-row items-center mb-2">
            <View className="w-[42px] h-[42px] bg-[#fff3e0] rounded-[12px] items-center justify-center mr-3">
              <Text className="text-[20px]">🔥</Text>
            </View>
            <Text className="font-title text-[18px] text-[#333]">Demandas Mais Procuradas</Text>
          </View>
          <Text className="font-sans text-[13px] text-[#666] mb-5 leading-5">
            Temas com maior volume de buscas no questionário nos últimos 30 dias.
          </Text>

          {topTopics.map((topic: any, idx: number) => {
            const colors = ['#1B4332', '#2D6A4F', '#52B788', '#74C69D'];
            return (
              <ProgressBar 
                key={topic.name || idx}
                label={topic.name || topic.tema}
                percentage={topic.percentage || Math.round(topic.count ? (topic.count / 20) * 100 : 50)}
                color={colors[idx % colors.length]}
              />
            );
          })}
        </View>

      </YeloScrollView>
    </View>
  );
}
