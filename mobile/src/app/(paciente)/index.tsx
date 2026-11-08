import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Image, 
  ActivityIndicator,
  RefreshControl 
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import YeloScrollView from '../../components/YeloScrollView';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

export default function VisaoGeralScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [patientData, setPatientData] = useState<any>(null);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [meRes, favRes, revRes] = await Promise.all([
        api.get('/api/patients/me').catch(() => ({ data: null })),
        api.get('/api/patients/favorites').catch(() => ({ data: [] })),
        api.get('/api/patients/me/reviews').catch(() => ({ data: [] })),
      ]);

      if (meRes.data) setPatientData(meRes.data);
      if (Array.isArray(favRes.data)) setFavorites(favRes.data);
      if (Array.isArray(revRes.data)) setReviews(revRes.data);
    } catch (e) {
      console.error("Erro ao carregar dados do paciente:", e);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  const nomeExibicao = patientData?.nome || user?.nome || 'Paciente';
  const primeiroNome = nomeExibicao.split(' ')[0];

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#f9fafb] items-center justify-center p-6">
        <ActivityIndicator size="large" color="#1B4332" />
        <Text className="font-sans text-[#666] mt-4">Carregando seu espaço...</Text>
      </View>
    );
  }

  return (
    <YeloScrollView 
      className="flex-1 bg-[#f9fafb]" 
      contentContainerStyle={{ padding: 20, paddingBottom: 110 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1B4332']} />
      }
    >
      {/* Hero Moderno */}
      <View className="bg-[#1B4332] rounded-[24px] p-[24px] mb-[20px] shadow-[0_4px_20px_rgba(27,67,50,0.15)] relative overflow-hidden">
        {/* Decoration Element */}
        <View className="absolute top-[-20px] right-[-20px] w-[120px] h-[120px] bg-white/10 rounded-full" />
        <View className="absolute bottom-[-40px] right-[40px] w-[80px] h-[80px] bg-white/5 rounded-full" />

        <Text className="font-title text-white text-[28px] leading-[34px] mb-[8px]">
          Olá, <Text className="text-[#FFEE8C]">{primeiroNome}</Text>! 👋
        </Text>
        <Text className="font-sans text-white/90 text-[15px] leading-[22px] max-w-[90%]">
          Que bom te ver por aqui. Este é o seu espaço seguro para acompanhar seus psicólogos e sua jornada de cuidado.
        </Text>

        <TouchableOpacity 
          onPress={() => router.push('/questionario')}
          className="mt-4 bg-[#FFEE8C] self-start px-5 py-2.5 rounded-full shadow-sm"
        >
          <Text className="font-sans font-bold text-[#1B4332] text-[13px] uppercase tracking-wide">
            Fazer Novo Match ✨
          </Text>
        </TouchableOpacity>
      </View>

      {/* Grid de Informações (KPIs Reais) */}
      <View className="gap-[15px] mb-6">
        {/* KPI 1 - Meus Matches */}
        <TouchableOpacity 
          onPress={() => router.push('/(paciente)/conexoes')}
          activeOpacity={0.8}
          className="bg-white rounded-[20px] p-[20px] border-t-4 border-[#1B4332] shadow-[0_4px_15px_rgba(0,0,0,0.03)]"
        >
          <View className="flex-row items-center justify-between mb-[12px]">
            <View className="flex-row items-center gap-[10px]">
              <View className="w-[40px] h-[40px] bg-[#e8f5e9] rounded-full items-center justify-center">
                <Feather name="user-check" size={20} color="#1B4332" />
              </View>
              <Text className="font-title text-[#333] text-[18px]">Matches Ideais</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#ccc" />
          </View>
          <Text className="font-sans text-[#666] text-[14px]">
            Recomendações clínicas personalizadas para suas prioridades
          </Text>
        </TouchableOpacity>

        {/* KPI 2 - Favoritos Reais */}
        <TouchableOpacity 
          onPress={() => router.push('/(paciente)/conexoes')}
          activeOpacity={0.8}
          className="bg-white rounded-[20px] p-[20px] border-t-4 border-[#F59E0B] shadow-[0_4px_15px_rgba(0,0,0,0.03)]"
        >
          <View className="flex-row items-center justify-between mb-[12px]">
            <View className="flex-row items-center gap-[10px]">
              <View className="w-[40px] h-[40px] bg-[#fef3c7] rounded-full items-center justify-center">
                <Feather name="heart" size={20} color="#F59E0B" />
              </View>
              <Text className="font-title text-[#333] text-[18px]">Favoritos Salvos</Text>
            </View>
            <Text className="font-title text-[#1B4332] text-[28px]">{favorites.length}</Text>
          </View>
          <Text className="font-sans text-[#666] text-[13px]">
            {favorites.length === 1 ? '1 profissional guardado' : `${favorites.length} profissionais guardados`}
          </Text>
        </TouchableOpacity>

        {/* KPI 3 - Avaliações */}
        <TouchableOpacity 
          onPress={() => router.push('/(paciente)/conexoes')}
          activeOpacity={0.8}
          className="bg-white rounded-[20px] p-[20px] border-t-4 border-[#BE185D] shadow-[0_4px_15px_rgba(0,0,0,0.03)]"
        >
          <View className="flex-row items-center justify-between mb-[12px]">
            <View className="flex-row items-center gap-[10px]">
              <View className="w-[40px] h-[40px] bg-[#fce7f3] rounded-full items-center justify-center">
                <Feather name="message-square" size={20} color="#BE185D" />
              </View>
              <Text className="font-title text-[#333] text-[18px]">Minhas Avaliações</Text>
            </View>
            <Text className="font-title text-[#1B4332] text-[28px]">{reviews.length}</Text>
          </View>
          <Text className="font-sans text-[#666] text-[13px]">
            {reviews.length === 1 ? '1 feedback registrado' : `${reviews.length} feedbacks registrados`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Seção: Favoritos Recentes */}
      {favorites.length > 0 && (
        <View className="mb-6">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="font-title text-[#1B4332] text-[20px]">Salvos Recentemente</Text>
            <TouchableOpacity onPress={() => router.push('/(paciente)/conexoes')}>
              <Text className="font-sans font-bold text-[#1B4332] text-[13px]">Ver todos</Text>
            </TouchableOpacity>
          </View>

          {favorites.slice(0, 3).map((fav) => (
            <TouchableOpacity
              key={fav.id}
              activeOpacity={0.85}
              onPress={() => router.push(`/${fav.slug}` as any)}
              className="bg-white rounded-[16px] p-4 mb-3 border border-[#f0f0f0] flex-row items-center shadow-sm"
            >
              <Image 
                source={{ uri: fav.fotoUrl || 'https://placehold.co/100x100/1B4332/FFF?text=Foto' }}
                className="w-14 h-14 rounded-full mr-3.5 bg-[#f0f0f0]"
              />
              <View className="flex-1">
                <Text className="font-title text-[#333] text-[16px] mb-0.5">{fav.nome}</Text>
                <Text className="font-sans text-[#777] text-[12px] mb-1">CRP {fav.crp}</Text>
                <Text className="font-sans font-bold text-[#1B4332] text-[13px]">
                  {fav.valor_sessao_numero ? `R$ ${fav.valor_sessao_numero}` : 'Valor a combinar'}
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color="#ccc" />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Banner de Ajuda / Questionário */}
      <View className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-[20px] p-5 items-center">
        <Text className="font-title text-[#166534] text-[18px] mb-1 text-center">
          Precisa de uma nova recomendação?
        </Text>
        <Text className="font-sans text-[#15803d] text-[13px] text-center mb-4 leading-5">
          Nosso algoritmo leva menos de 2 minutos para conectar você aos psicólogos mais adequados para suas demandas atuais.
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/questionario')}
          className="bg-[#166534] py-2.5 px-6 rounded-full"
        >
          <Text className="text-white font-bold font-sans text-[13px]">Refazer Questionário</Text>
        </TouchableOpacity>
      </View>

    </YeloScrollView>
  );
}
