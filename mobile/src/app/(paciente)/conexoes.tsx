import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Image, 
  ActivityIndicator,
  Alert 
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import YeloScrollView from '../../components/YeloScrollView';
import api from '../../services/api';

export default function ConexoesHubScreen() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'favorites' | 'reviews'>('favorites');
  const [favorites, setFavorites] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [favRes, revRes] = await Promise.all([
        api.get('/api/patients/favorites').catch(() => ({ data: [] })),
        api.get('/api/patients/me/reviews').catch(() => ({ data: [] })),
      ]);

      if (Array.isArray(favRes.data)) setFavorites(favRes.data);
      if (Array.isArray(revRes.data)) setReviews(revRes.data);
    } catch (e) {
      console.error("Erro ao carregar conexões:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRemoveFavorite = async (id: number) => {
    try {
      await api.put('/api/patients/me/favorites', { psychologistId: id });
      setFavorites(prev => prev.filter(f => f.id !== id));
    } catch (e) {
      Alert.alert("Erro", "Não foi possível remover dos favoritos.");
    }
  };

  return (
    <YeloScrollView className="flex-1 bg-[#f9fafb]" contentContainerStyle={{ padding: 20, paddingBottom: 110 }}>
      
      {/* Header */}
      <View className="mb-[20px]">
        <Text className="font-title text-[#1B4332] text-[28px] mb-[4px]">Conexões</Text>
        <Text className="font-sans text-[#666] text-[15px]">Gerencie seus psicólogos salvos, avaliações e buscas.</Text>
      </View>

      {/* Ações Rápidas (Matches e Questionário) */}
      <View className="flex-row gap-3 mb-6">
        <TouchableOpacity 
          onPress={() => router.push('/resultados')}
          className="flex-1 bg-white p-4 rounded-[18px] border border-[#f0f0f0] shadow-sm items-center justify-center"
        >
          <View className="w-10 h-10 rounded-full bg-[#e8f5e9] items-center justify-center mb-2">
            <Feather name="users" size={20} color="#1B4332" />
          </View>
          <Text className="font-title text-[#333] text-[14px] text-center">Últimos Matches</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => router.push('/questionario')}
          className="flex-1 bg-white p-4 rounded-[18px] border border-[#f0f0f0] shadow-sm items-center justify-center"
        >
          <View className="w-10 h-10 rounded-full bg-[#e0f2fe] items-center justify-center mb-2">
            <Feather name="refresh-cw" size={20} color="#0284c7" />
          </View>
          <Text className="font-title text-[#333] text-[14px] text-center">Novo Questionário</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View className="flex-row bg-[#e9ecef] p-1 rounded-full mb-6">
        <TouchableOpacity 
          onPress={() => setActiveTab('favorites')}
          className={`flex-1 py-2.5 rounded-full items-center ${activeTab === 'favorites' ? 'bg-white shadow-sm' : ''}`}
        >
          <Text className={`font-sans font-bold text-[14px] ${activeTab === 'favorites' ? 'text-[#1B4332]' : 'text-[#666]'}`}>
            Favoritos ({favorites.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => setActiveTab('reviews')}
          className={`flex-1 py-2.5 rounded-full items-center ${activeTab === 'reviews' ? 'bg-white shadow-sm' : ''}`}
        >
          <Text className={`font-sans font-bold text-[14px] ${activeTab === 'reviews' ? 'text-[#1B4332]' : 'text-[#666]'}`}>
            Minhas Avaliações ({reviews.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Conteúdo Dinâmico */}
      {isLoading ? (
        <View className="py-12 items-center">
          <ActivityIndicator color="#1B4332" />
        </View>
      ) : activeTab === 'favorites' ? (
        favorites.length === 0 ? (
          <View className="bg-white rounded-[20px] p-8 items-center border border-[#f0f0f0]">
            <Feather name="heart" size={40} color="#ccc" />
            <Text className="font-title text-[#333] text-[18px] mt-4 mb-2 text-center">Nenhum favorito salvo</Text>
            <Text className="font-sans text-[#777] text-[14px] text-center mb-5">
              Ao explorar os psicólogos nos resultados do questionário, toque no coração para guardar os perfis aqui.
            </Text>
            <TouchableOpacity 
              onPress={() => router.push('/questionario')}
              className="bg-[#1B4332] py-2.5 px-6 rounded-full"
            >
              <Text className="text-white font-bold font-sans text-[13px]">Explorar Psicólogos</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="gap-3">
            {favorites.map((fav) => (
              <View 
                key={fav.id}
                className="bg-white rounded-[20px] p-4 border border-[#f0f0f0] shadow-sm flex-row items-center"
              >
                <Image 
                  source={{ uri: fav.fotoUrl || 'https://placehold.co/100x100/1B4332/FFF?text=Foto' }}
                  className="w-16 h-16 rounded-full mr-4 bg-[#f0f0f0]"
                />
                <View className="flex-1 mr-2">
                  <Text className="font-title text-[#333] text-[16px] mb-0.5">{fav.nome}</Text>
                  <Text className="font-sans text-[#777] text-[12px] mb-1">CRP {fav.crp}</Text>
                  <Text className="font-sans font-bold text-[#1B4332] text-[13px] mb-2">
                    {fav.valor_sessao_numero ? `R$ ${fav.valor_sessao_numero} / sessão` : 'A combinar'}
                  </Text>
                  
                  <TouchableOpacity
                    onPress={() => router.push(`/${fav.slug}` as any)}
                    className="bg-[#FFEE8C] px-3.5 py-1.5 rounded-full self-start"
                  >
                    <Text className="font-sans font-bold text-[#1B4332] text-[12px]">Ver Perfil</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity 
                  onPress={() => handleRemoveFavorite(fav.id)}
                  className="w-9 h-9 rounded-full bg-[#fef2f2] items-center justify-center self-start"
                >
                  <Feather name="trash-2" size={16} color="#e63946" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )
      ) : (
        reviews.length === 0 ? (
          <View className="bg-white rounded-[20px] p-8 items-center border border-[#f0f0f0]">
            <Feather name="message-square" size={40} color="#ccc" />
            <Text className="font-title text-[#333] text-[18px] mt-4 mb-2 text-center">Nenhuma avaliação enviada</Text>
            <Text className="font-sans text-[#777] text-[14px] text-center">
              Quando você realiza sessões e deixa seu depoimento sobre um terapeuta, ele aparecerá organizado aqui.
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {reviews.map((r) => (
              <View key={r.id} className="bg-white rounded-[20px] p-5 border border-[#f0f0f0] shadow-sm">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="font-title text-[#333] text-[15px]">
                    {r.psychologist?.nome || 'Profissional Yelo'}
                  </Text>
                  <Text className="text-[#f59e0b] text-[13px]">
                    {'★'.repeat(r.rating || 5)}
                  </Text>
                </View>
                <Text className="font-sans text-[#555] text-[14px] italic leading-5">
                  "{r.comment || 'Sem comentário por escrito.'}"
                </Text>
              </View>
            ))}
          </View>
        )
      )}

    </YeloScrollView>
  );
}
