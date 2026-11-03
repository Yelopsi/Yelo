import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  LayoutChangeEvent,
} from 'react-native';
import YeloScrollView from '../../components/YeloScrollView';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';

interface PriceComparisonData {
  myPrice?: number;
  cityAverage?: number;
  platformAverage?: number;
  isMensal?: boolean;
}

interface TopicData {
  topic?: string;
  name?: string;
  tema?: string;
  count?: number;
}

interface VisibilityData {
  labels: string[];
  appearances: number[];
}

interface ProfileStrengthData {
  myScores: number[];
  averageScores: number[];
}

interface AnalyticsResponse {
  priceComparison?: PriceComparisonData;
  topTopics?: TopicData[];
  visibility?: VisibilityData;
  profileStrength?: ProfileStrengthData;
  betterThanPercentage?: number;
}

const STRENGTH_CATEGORIES = [
  'Completude do Perfil',
  'Avaliações de Pacientes',
  'Engajamento no Fórum',
  'Publicação de Artigos',
  'Tempo de Resposta',
];

export default function AnalyticsScreen() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<AnalyticsResponse | null>(null);

  // Largura do termômetro para posicionamento milimétrico
  const [thermometerWidth, setThermometerWidth] = useState(0);

  const fetchAnalytics = useCallback(async (isPullRefresh = false) => {
    if (!isPullRefresh) setIsLoading(true);
    try {
      const res = await api.get('/api/psychologists/me/analytics');
      setData(res.data);
    } catch (e: any) {
      console.warn('Erro ao buscar dados de analytics:', e?.response?.data || e.message);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAnalytics(true);
  }, [fetchAnalytics]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate('/(tabs)/clinica');
    }
  };

  const formatCurrency = (val: number = 0) => {
    try {
      return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    } catch {
      return `R$ ${val.toFixed(2).replace('.', ',')}`;
    }
  };

  // --- DADOS DO CARD 1: PREÇO ---
  const priceData = data?.priceComparison;
  const myPrice = priceData?.myPrice ?? 0;
  const cityAvg = priceData?.cityAverage ?? 0;
  const platAvg = priceData?.platformAverage ?? 0;
  const isMensal = Boolean(priceData?.isMensal);

  const pricePositions = useMemo(() => {
    const maxPrice = Math.max(platAvg * 2, myPrice * 1.5, 300);
    const calcPercent = (val: number) => {
      if (maxPrice <= 0) return 50;
      return Math.min(Math.max((val / maxPrice) * 100, 10), 90);
    };

    return {
      myPos: calcPercent(myPrice),
      platPos: calcPercent(platAvg),
      cityPos: cityAvg > 0 ? calcPercent(cityAvg) : calcPercent(platAvg),
    };
  }, [myPrice, cityAvg, platAvg]);

  // Cor do badge dinâmico (terçolho do termômetro)
  const myBadgeBg = useMemo(() => {
    if (pricePositions.myPos <= 35) return '#10b981';
    if (pricePositions.myPos <= 65) return '#059669';
    return '#047857';
  }, [pricePositions.myPos]);

  // --- DADOS DO CARD 2: TEMAS EM ALTA ---
  const top3Topics = useMemo(() => {
    const list = data?.topTopics || [];
    return list.slice(0, 3).map((item) => ({
      title: item.topic || item.name || item.tema || 'Tema em Alta',
    }));
  }, [data?.topTopics]);

  // --- DADOS DO CARD 3: VISIBILIDADE ---
  const visibilityData = data?.visibility;
  const totalAppearances = useMemo(() => {
    const apps = visibilityData?.appearances || [];
    return apps.reduce((acc, curr) => acc + (Number(curr) || 0), 0);
  }, [visibilityData?.appearances]);

  const maxAppearance = useMemo(() => {
    const apps = visibilityData?.appearances || [];
    return Math.max(...apps, 1);
  }, [visibilityData?.appearances]);

  // --- DADOS DO CARD 4: FORÇA DO PERFIL ---
  const strengthData = data?.profileStrength;
  const { profilePercentage, myScoreTotal, avgScoreTotal, profileColor } = useMemo(() => {
    const myScores = strengthData?.myScores || [7, 7, 5, 4, 7];
    const avgScores = strengthData?.averageScores || [7, 7, 5, 4, 7];

    const mySum = myScores.reduce((a, b) => a + b, 0);
    const avgSum = avgScores.reduce((a, b) => a + b, 0);
    const maxPossible = STRENGTH_CATEGORIES.length * 10;
    const pct = Math.min(100, Math.max(0, Math.round((mySum / maxPossible) * 100)));

    let color = '#ef4444';
    if (pct >= 80) color = '#10b981';
    else if (pct >= 50) color = '#f59e0b';

    return {
      profilePercentage: pct,
      myScoreTotal: mySum,
      avgScoreTotal: avgSum,
      profileColor: color,
    };
  }, [strengthData]);

  if (isLoading && !refreshing) {
    return (
      <View className="flex-1 bg-[#f9fafb] items-center justify-center p-6">
        <ActivityIndicator size="large" color="#1B4332" />
        <Text className="font-sans text-[#666] mt-4">Carregando métricas e inteligência de mercado...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <YeloScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1B4332"
            colors={['#1B4332']}
          />
        }
      >
        {/* ============================================================ */}
        {/* CABEÇALHO VERDE (MAIN HEADER) */}
        {/* ============================================================ */}
        <View className="mx-6 mt-6 mb-6 bg-[#1B4332] p-[22px] rounded-[16px] shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
          <View className="flex-row items-center mb-2">
            <TouchableOpacity
              onPress={handleBack}
              className="w-10 h-10 bg-white/20 rounded-full items-center justify-center mr-4"
            >
              <Feather name="arrow-left" size={20} color="white" />
            </TouchableOpacity>
            <Text className="font-title text-[26px] text-white leading-tight">
              Métricas & Mercado
            </Text>
          </View>
          <Text className="font-sans text-[15px] text-white/85">
            Descubra como seu perfil está se saindo e o que os pacientes mais procuram na Yelo.
          </Text>
        </View>

        {/* ============================================================ */}
        {/* CARD 1: ANÁLISE DE PREÇOS (TERMÔMETRO HORIZONTAL GRADIENTE) */}
        {/* ============================================================ */}
        <View className="mx-6 mb-6 bg-white p-[25px] rounded-[20px] shadow-sm border border-[#e5e7eb]">
          <View className="flex-row items-center mb-2">
            <View className="w-[45px] h-[45px] bg-[#e8f5e9] rounded-[12px] items-center justify-center mr-3">
              <Text className="text-[22px]">💳</Text>
            </View>
            <Text className="font-title text-[20px] text-[#1B4332]">
              {isMensal ? 'Valor Mensal' : 'Valor da Sessão'}
            </Text>
          </View>
          <Text className="font-sans text-[14px] text-[#666] mb-6 leading-relaxed">
            Veja como o valor da sua consulta se compara à média de outros psicólogos na sua região.
          </Text>

          {/* ÁREA DO TERMÔMETRO */}
          <View
            className="w-full relative my-4"
            style={{ height: 130 }}
            onLayout={(e: LayoutChangeEvent) => setThermometerWidth(e.nativeEvent.layout.width)}
          >
            {/* Marcador Superior: Média da Plataforma */}
            {platAvg > 0 && thermometerWidth > 0 && (
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: (pricePositions.platPos / 100) * thermometerWidth,
                  transform: [{ translateX: -40 }],
                  alignItems: 'center',
                  width: 80,
                }}
              >
                <Text className="font-sans font-black text-[#64748b] text-[12px] text-center">
                  {formatCurrency(platAvg)}
                </Text>
                <Text className="font-sans font-bold text-[#64748b] text-[10px] text-center mb-1">
                  Média Yelo
                </Text>
                <View className="w-[2px] h-[12px] bg-[#94a3b8]" />
              </View>
            )}

            {/* Barra Gradiente Contínua (Altura 10px) */}
            <View
              style={{
                position: 'absolute',
                top: 55,
                left: 0,
                right: 0,
                height: 10,
                borderRadius: 5,
                overflow: 'hidden',
              }}
            >
              <LinearGradient
                colors={['#d1fae5', '#10b981', '#047857']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ flex: 1 }}
              />
            </View>

            {/* Marcador do Usuário (Tooltip + Ponto na Barra) */}
            {myPrice > 0 && thermometerWidth > 0 && (
              <View
                style={{
                  position: 'absolute',
                  top: 25,
                  left: (pricePositions.myPos / 100) * thermometerWidth,
                  transform: [{ translateX: -50 }],
                  alignItems: 'center',
                  width: 100,
                  zIndex: 20,
                }}
              >
                {/* Tooltip Você */}
                <View
                  style={{
                    backgroundColor: myBadgeBg,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 8,
                    shadowColor: '#000',
                    shadowOpacity: 0.15,
                    shadowRadius: 4,
                    shadowOffset: { width: 0, height: 2 },
                  }}
                >
                  <Text className="text-white font-bold text-[11px] font-sans text-center">
                    Você: {formatCurrency(myPrice)}
                  </Text>
                </View>
                {/* Triângulo da Tooltip */}
                <View
                  style={{
                    width: 0,
                    height: 0,
                    borderLeftWidth: 5,
                    borderRightWidth: 5,
                    borderTopWidth: 5,
                    borderLeftColor: 'transparent',
                    borderRightColor: 'transparent',
                    borderTopColor: myBadgeBg,
                    marginBottom: 2,
                  }}
                />
                {/* Ponto Marcador */}
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: '#ffffff',
                    borderWidth: 4,
                    borderColor: myBadgeBg,
                    shadowColor: '#000',
                    shadowOpacity: 0.2,
                    shadowRadius: 3,
                    shadowOffset: { width: 0, height: 1 },
                  }}
                />
              </View>
            )}

            {/* Marcador Inferior: Média da Região */}
            {cityAvg > 0 && thermometerWidth > 0 && (
              <View
                style={{
                  position: 'absolute',
                  top: 68,
                  left: (pricePositions.cityPos / 100) * thermometerWidth,
                  transform: [{ translateX: -40 }],
                  alignItems: 'center',
                  width: 80,
                }}
              >
                <View className="w-[2px] h-[12px] bg-[#f59e0b] mb-1" />
                <Text className="font-sans font-bold text-[#d97706] text-[10px] text-center">
                  Sua Região
                </Text>
                <Text className="font-sans font-black text-[#d97706] text-[12px] text-center">
                  {formatCurrency(cityAvg)}
                </Text>
              </View>
            )}
          </View>

          {/* Legenda dos Extremos */}
          <View className="flex-row justify-between items-center mt-2 mb-4">
            <View className="flex-row items-center bg-[#f8fafc] px-2.5 py-1 rounded-[6px] border border-[#f1f5f9]">
              <Text className="text-[12px] mr-1">🤝</Text>
              <Text className="font-sans font-bold text-[#64748b] text-[10px] tracking-wide uppercase">
                Social
              </Text>
            </View>
            <View className="flex-row items-center bg-[#f8fafc] px-2.5 py-1 rounded-[6px] border border-[#f1f5f9]">
              <Text className="font-sans font-bold text-[#64748b] text-[10px] tracking-wide uppercase mr-1">
                Particular
              </Text>
              <Text className="text-[12px]">⭐</Text>
            </View>
          </View>

          {/* Box de Análise de Preço */}
          <View className="bg-[#f8f9fa] border-l-4 border-[#1B4332] p-4 rounded-r-[8px]">
            <Text className="font-sans text-[13px] text-[#444] leading-relaxed">
              {myPrice <= 0 ? (
                'Configure o valor da sua consulta no Meu Perfil para visualizar o comparativo detalhado da sua região.'
              ) : myPrice < (cityAvg || platAvg) * 0.9 ? (
                `💡 O seu valor (${formatCurrency(myPrice)}) está mais acessível que a média da sua região (${formatCurrency(cityAvg || platAvg)}). Isso é um excelente atrativo para captar novos pacientes!`
              ) : myPrice > platAvg * 1.2 ? (
                `⚠️ O seu valor (${formatCurrency(myPrice)}) está acima da média geral (${formatCurrency(platAvg)}). Certifique-se de destacar sua experiência, especializações e diferenciais na sua biografia para justificar o investimento.`
              ) : (
                `✅ Excelente! O seu valor (${formatCurrency(myPrice)}) está perfeitamente competitivo com a média do mercado (${formatCurrency(platAvg)}).`
              )}
            </Text>
          </View>
        </View>

        {/* ============================================================ */}
        {/* CARD 2: O QUE OS PACIENTES BUSCAM? (TEMAS EM ALTA COM PÓDIO) */}
        {/* ============================================================ */}
        <View className="mx-6 mb-6 bg-white p-[25px] rounded-[20px] shadow-sm border border-[#e5e7eb]">
          <View className="flex-row items-center mb-2">
            <View className="w-[45px] h-[45px] bg-[#fff3e0] rounded-[12px] items-center justify-center mr-3">
              <Text className="text-[22px]">🔥</Text>
            </View>
            <Text className="font-title text-[20px] text-[#1B4332]">
              O que os pacientes buscam?
            </Text>
          </View>
          <Text className="font-sans text-[14px] text-[#666] mb-5 leading-relaxed">
            Os 3 temas mais procurados na plataforma nos últimos 30 dias. Ótimo para inspirar seus artigos!
          </Text>

          {/* Lista de Pódio dos 3 Temas */}
          {top3Topics.length === 0 ? (
            <View className="p-4 items-center justify-center">
              <Text className="font-sans text-[#888] italic text-[13px]">
                Ainda não há dados suficientes de temas em alta na plataforma.
              </Text>
            </View>
          ) : (
            <View className="mb-4">
              {top3Topics.map((item, index) => {
                const medals = ['🥇', '🥈', '🥉'];
                return (
                  <View
                    key={item.title + index}
                    className="flex-row items-center bg-white border border-[#f1f5f9] p-3.5 rounded-[12px] mb-2.5 shadow-sm"
                  >
                    <Text className="text-[20px] mr-3">{medals[index] || '🔹'}</Text>
                    <Text className="font-sans font-semibold text-[#334155] text-[15px] flex-1">
                      {item.title}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Box de Análise de Temas */}
          <View className="bg-[#f8f9fa] border-l-4 border-[#f59e0b] p-4 rounded-r-[8px]">
            <Text className="font-sans text-[13px] text-[#444] leading-relaxed">
              {top3Topics[0]?.title ? (
                <>
                  💡 <Text className="font-bold">{top3Topics[0].title}</Text> é a demanda número 1 dos pacientes atualmente. Adicionar esta especialidade ao seu perfil (se for sua área de atuação) ou publicar artigos sobre o tema atrairá mais pacientes para sua página!
                </>
              ) : (
                '💡 Mantenha seus temas de atuação atualizados no perfil para receber recomendações alinhadas à busca dos pacientes.'
              )}
            </Text>
          </View>
        </View>

        {/* ============================================================ */}
        {/* CARD 3: VISIBILIDADE NA BUSCA (NÚMERO GIGANTE + SPARKLINE) */}
        {/* ============================================================ */}
        <View className="mx-6 mb-6 bg-white p-[25px] rounded-[20px] shadow-sm border border-[#e5e7eb]">
          <View className="flex-row items-center mb-2">
            <View className="w-[45px] h-[45px] bg-[#e0f2fe] rounded-[12px] items-center justify-center mr-3">
              <Text className="text-[22px]">👁️</Text>
            </View>
            <Text className="font-title text-[20px] text-[#1B4332]">
              Visibilidade na Busca
            </Text>
          </View>
          <Text className="font-sans text-[14px] text-[#666] mb-5 leading-relaxed">
            Quantas vezes seu perfil apareceu nos resultados de busca dos pacientes nesta última semana.
          </Text>

          {/* Destaque Central */}
          <View className="items-center py-2 mb-4">
            <Text className="font-sans font-bold text-[#64748b] text-[12px] uppercase tracking-widest mb-1">
              Últimos 7 dias
            </Text>
            <Text className="font-black text-[54px] text-[#0f172a] leading-none mb-1">
              {totalAppearances}
            </Text>
            <Text className="font-sans text-[14px] text-[#64748b] font-medium">
              aparições nas buscas
            </Text>

            {/* Sparkline de 7 Barras */}
            {visibilityData?.appearances && visibilityData.appearances.length > 0 ? (
              <View className="flex-row items-end justify-center mt-6 space-x-2">
                {visibilityData.appearances.map((val, idx) => {
                  const barHeight = Math.max((val / maxAppearance) * 50, 6);
                  const label = visibilityData.labels[idx]?.split('/')[0] || String(idx + 1);

                  return (
                    <View key={`spark_${idx}`} className="items-center mx-1">
                      <View className="w-[18px] h-[55px] justify-end items-center">
                        <View
                          style={{
                            width: 14,
                            height: barHeight,
                            backgroundColor: val > 0 ? '#0ea5e9' : '#e2e8f0',
                            borderRadius: 4,
                          }}
                        />
                      </View>
                      <Text className="text-[10px] text-[#94a3b8] font-sans mt-1">
                        {label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>

          {/* Box de Análise de Visibilidade */}
          <View className="bg-[#f8f9fa] border-l-4 border-[#0284c7] p-4 rounded-r-[8px]">
            <Text className="font-sans text-[13px] text-[#444] leading-relaxed">
              {totalAppearances === 0 ? (
                '⚠️ Seu perfil não apareceu nos resultados nesta semana. Ter um perfil 100% completo com especialidades bem definidas é a melhor forma de reverter isso.'
              ) : totalAppearances < 10 ? (
                `💡 Seu perfil apareceu ${totalAppearances} vezes na última semana. Para impulsionar esse número, experimente interagir mais respondendo dúvidas na Comunidade!`
              ) : (
                `🔥 Excelente! Seu perfil foi visto ${totalAppearances} vezes nas buscas recentes. Sua visibilidade está em alta!`
              )}
            </Text>
          </View>
        </View>

        {/* ============================================================ */}
        {/* CARD 4: FORÇA DO SEU PERFIL (ÍNDICE + 5 CRITÉRIOS DETALHADOS) */}
        {/* ============================================================ */}
        <View className="mx-6 mb-6 bg-white p-[25px] rounded-[20px] shadow-sm border border-[#e5e7eb]">
          <View className="flex-row items-center mb-2">
            <View className="w-[45px] h-[45px] bg-[#f3e8ff] rounded-[12px] items-center justify-center mr-3">
              <Text className="text-[22px]">💪</Text>
            </View>
            <Text className="font-title text-[20px] text-[#1B4332]">
              Força do seu Perfil
            </Text>
          </View>
          <Text className="font-sans text-[14px] text-[#666] mb-5 leading-relaxed">
            Uma comparação do quão completo está o seu perfil em relação à média dos psicólogos da Yelo.
          </Text>

          {/* Barra de Progresso do Índice de Força */}
          <View className="mb-5">
            <View className="flex-row justify-between items-end mb-2">
              <Text className="font-sans font-bold text-[#334155] text-[16px]">
                Índice de Força
              </Text>
              <Text
                className="font-black text-[26px]"
                style={{ color: profileColor }}
              >
                {profilePercentage}%
              </Text>
            </View>

            <View className="w-full h-[14px] bg-[#e2e8f0] rounded-full overflow-hidden mb-5">
              <View
                style={{
                  width: `${profilePercentage}%`,
                  backgroundColor: profileColor,
                  height: '100%',
                  borderRadius: 7,
                }}
              />
            </View>

            {/* As 5 Categorias Detalhadas */}
            <View>
              {STRENGTH_CATEGORIES.map((cat, idx) => {
                const score = strengthData?.myScores?.[idx] ?? 7;
                const avg = strengthData?.averageScores?.[idx] ?? 7;
                const isGood = score >= avg || score >= 7;

                return (
                  <View
                    key={cat}
                    className="flex-row items-center justify-between bg-[#f8fafc] px-3.5 py-2.5 rounded-[10px] mb-2"
                  >
                    <View className="flex-row items-center flex-1 mr-2">
                      <Text className="text-[14px] mr-2.5">
                        {isGood ? '✅' : '⚠️'}
                      </Text>
                      <Text
                        className={`font-sans text-[13px] ${
                          isGood ? 'text-[#475569] font-medium' : 'text-[#ef4444] font-semibold'
                        }`}
                        numberOfLines={1}
                      >
                        {cat}
                      </Text>
                    </View>
                    <Text className="font-sans font-bold text-[12px] text-[#64748b]">
                      {Math.round(score)}/10
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Box de Análise da Força do Perfil */}
          <View className="bg-[#f8f9fa] border-l-4 border-[#7e22ce] p-4 rounded-r-[8px]">
            <Text className="font-sans text-[13px] text-[#444] leading-relaxed">
              {myScoreTotal >= avgScoreTotal ? (
                '✅ Parabéns! A força do seu perfil está acima da média da plataforma. Mantenha as boas avaliações e publicações para continuar no topo!'
              ) : (
                '💪 Seu perfil tem bastante espaço para crescer em relação à concorrência. Foque nos itens marcados com alerta acima para melhorar seu posicionamento nas buscas.'
              )}
            </Text>
          </View>
        </View>

      </YeloScrollView>
    </View>
  );
}
