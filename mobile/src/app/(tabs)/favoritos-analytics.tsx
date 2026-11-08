import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import YeloScrollView from '../../components/YeloScrollView';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';

// Paletas de cores para as barras
const TEMA_COLORS = ['#1B4332', '#2D6A4F', '#40916C', '#52B788', '#74C69D', '#95D5B2'];
const VALOR_COLORS = ['#f59e0b', '#fbbf24', '#fcd34d', '#fde68a'];
const GENERO_COLORS = ['#0284c7', '#0ea5e9', '#38bdf8', '#7dd3fc'];

// Componente helper para Barras Horizontais
const ProgressBar = ({ label, percentage, color }: { label: string; percentage: number; color: string }) => (
  <View className="mb-4">
    <View className="flex-row justify-between mb-1.5">
      <Text className="font-sans text-[14px] text-[#333] font-bold">{label}</Text>
      <Text className="font-sans text-[13px] text-[#888]">{percentage}%</Text>
    </View>
    <View className="h-[8px] bg-[#f1f3f5] rounded-full overflow-hidden">
      <View 
        style={{ width: `${Math.max(percentage, 4)}%`, backgroundColor: color }} 
        className="h-full rounded-full" 
      />
    </View>
  </View>
);

interface FavoritesProfileData {
  total: number;
  temas: Record<string, number>;
  faixaValor: Record<string, number>;
  genero: Record<string, number>;
}

export default function FavoritosAnalyticsScreen() {
  const router = useRouter();
  const [data, setData] = useState<FavoritesProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFavoritesProfile = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response = await api.get('/api/psychologists/me/favorites-profile');
      if (response.data) {
        setData(response.data);
      } else {
        setData({ total: 0, temas: {}, faixaValor: {}, genero: {} });
      }
    } catch (err: any) {
      console.error('Erro ao carregar favoritos-profile:', err);
      setError('Não foi possível carregar os dados de favoritos.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchFavoritesProfile();
  }, [fetchFavoritesProfile]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#f9fafb] items-center justify-center p-6">
        <ActivityIndicator size="large" color="#1B4332" />
        <Text className="font-sans text-[#666] text-[15px] mt-4 font-medium">
          Mapeando o perfil dos seus pacientes...
        </Text>
      </View>
    );
  }

  const total = data?.total || 0;
  const temasList = Object.entries(data?.temas || {})
    .map(([label, count]) => ({
      label,
      percentage: total > 0 ? Math.round(((count as number) / total) * 100) : 0,
      count: count as number,
    }))
    .sort((a, b) => b.count - a.count);

  const faixaValorList = Object.entries(data?.faixaValor || {})
    .map(([label, count]) => ({
      label,
      percentage: total > 0 ? Math.round(((count as number) / total) * 100) : 0,
      count: count as number,
    }))
    .sort((a, b) => b.count - a.count);

  const generoList = Object.entries(data?.genero || {})
    .map(([label, count]) => ({
      label,
      percentage: total > 0 ? Math.round(((count as number) / total) * 100) : 0,
      count: count as number,
    }))
    .sort((a, b) => b.count - a.count);

  const hasAnyData = temasList.length > 0 || faixaValorList.length > 0 || generoList.length > 0;

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <YeloScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchFavoritesProfile(true)}
            colors={['#1B4332']}
            tintColor="#1B4332"
          />
        }
      >
        
        {/* HEADER VERDE (MAIN-HEADER) */}
        <View className="mx-6 mt-6 mb-6 bg-[#1B4332] p-[22px] rounded-[16px] shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
          <View className="flex-row items-center mb-2">
            <TouchableOpacity 
              onPress={() => router.canGoBack() ? router.back() : router.navigate('/(tabs)/clinica')} 
              className="w-10 h-10 bg-white/20 rounded-full items-center justify-center mr-4"
            >
              <Feather name="arrow-left" size={20} color="white" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="font-title text-[24px] text-white leading-tight">Quem te favoritou? ❤️</Text>
            </View>
          </View>
          <Text className="font-sans text-[14px] text-white/85 mt-1 leading-relaxed">
            Entenda as características e interesses dos pacientes que salvaram seu perfil para futuras consultas.
          </Text>

          {total > 0 && (
            <View className="self-start mt-3 bg-white/20 px-3 py-1 rounded-full">
              <Text className="font-sans font-semibold text-white text-[12px]">
                {total} {total === 1 ? 'paciente te favoritou' : 'pacientes te favoritaram'}
              </Text>
            </View>
          )}
        </View>

        {/* TRATAMENTO DE ERRO */}
        {error && (
          <View className="mx-6 mb-6 bg-[#fef2f2] border border-[#fecaca] p-4 rounded-[16px] items-center">
            <Text className="font-sans text-[#b91c1c] text-[14px] text-center mb-3">
              {error}
            </Text>
            <TouchableOpacity
              onPress={() => fetchFavoritesProfile()}
              className="bg-[#1B4332] px-4 py-2 rounded-full"
            >
              <Text className="font-sans font-bold text-white text-[13px]">Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ESTADO VAZIO (ESPELHO DA WEB) */}
        {total === 0 ? (
          <View className="mx-6 mb-6 bg-white p-8 rounded-[20px] shadow-sm border border-[#e5e7eb] items-center text-center">
            <Text className="text-[52px] mb-4">🕵️‍♀️</Text>
            <Text className="font-title text-[22px] text-[#1B4332] text-center mb-2">
              Nenhum favorito ainda
            </Text>
            <Text className="font-sans text-[14px] text-[#666] text-center leading-relaxed max-w-[320px]">
              Assim que os pacientes começarem a salvar seu perfil, os dados sobre o perfil demográfico e os interesses deles aparecerão aqui.
            </Text>
          </View>
        ) : !hasAnyData ? (
          <View className="mx-6 mb-6 bg-white p-8 rounded-[20px] shadow-sm border border-[#e5e7eb] items-center text-center">
            <Text className="text-[44px] mb-3">📋</Text>
            <Text className="font-title text-[20px] text-[#1B4332] text-center mb-2">
              Dados sendo mapeados
            </Text>
            <Text className="font-sans text-[14px] text-[#666] text-center leading-relaxed max-w-[320px]">
              Você já possui pacientes que favoritaram seu perfil! À medida que eles preencherem o questionário detalhado, as preferências aparecerão aqui.
            </Text>
          </View>
        ) : (
          <>
            {/* CARD 1: PRINCIPAIS TEMAS */}
            {temasList.length > 0 && (
              <View className="mx-6 mb-6 bg-white p-6 rounded-[20px] shadow-sm border border-[#e5e7eb]">
                <View className="flex-row items-center mb-2">
                  <View className="w-[45px] h-[45px] bg-[#e8f5e9] rounded-[12px] items-center justify-center mr-3">
                    <Text className="text-[22px]">🎯</Text>
                  </View>
                  <Text className="font-title text-[18px] text-[#333]">Principais Temas</Text>
                </View>
                <Text className="font-sans text-[14px] text-[#666] mb-6 leading-relaxed">
                  Os assuntos que mais motivam os pacientes que favoritaram seu perfil a buscar terapia.
                </Text>

                {temasList.map((item, idx) => (
                  <ProgressBar
                    key={item.label}
                    label={item.label}
                    percentage={item.percentage}
                    color={TEMA_COLORS[idx % TEMA_COLORS.length]}
                  />
                ))}
              </View>
            )}

            {/* CARD 2: ORÇAMENTO MÉDIO */}
            {faixaValorList.length > 0 && (
              <View className="mx-6 mb-6 bg-white p-6 rounded-[20px] shadow-sm border border-[#e5e7eb]">
                <View className="flex-row items-center mb-2">
                  <View className="w-[45px] h-[45px] bg-[#fff3e0] rounded-[12px] items-center justify-center mr-3">
                    <Text className="text-[22px]">💰</Text>
                  </View>
                  <Text className="font-title text-[18px] text-[#333]">Orçamento Médio</Text>
                </View>
                <Text className="font-sans text-[14px] text-[#666] mb-6 leading-relaxed">
                  A faixa de valor que esses pacientes estão dispostos a investir por sessão.
                </Text>

                {faixaValorList.map((item, idx) => (
                  <ProgressBar
                    key={item.label}
                    label={item.label}
                    percentage={item.percentage}
                    color={VALOR_COLORS[idx % VALOR_COLORS.length]}
                  />
                ))}
              </View>
            )}

            {/* CARD 3: PERFIL DEMOGRÁFICO */}
            {generoList.length > 0 && (
              <View className="mx-6 mb-6 bg-white p-6 rounded-[20px] shadow-sm border border-[#e5e7eb]">
                <View className="flex-row items-center mb-2">
                  <View className="w-[45px] h-[45px] bg-[#e0f2fe] rounded-[12px] items-center justify-center mr-3">
                    <Text className="text-[22px]">👤</Text>
                  </View>
                  <Text className="font-title text-[18px] text-[#333]">Perfil Demográfico</Text>
                </View>
                <Text className="font-sans text-[14px] text-[#666] mb-6 leading-relaxed">
                  A identidade de gênero dos pacientes que demonstraram interesse no seu trabalho.
                </Text>

                {generoList.map((item, idx) => (
                  <ProgressBar
                    key={item.label}
                    label={item.label}
                    percentage={item.percentage}
                    color={GENERO_COLORS[idx % GENERO_COLORS.length]}
                  />
                ))}
              </View>
            )}
          </>
        )}

      </YeloScrollView>
    </View>
  );
}
