import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import YeloScrollView from '../components/YeloScrollView';
import Footer from '../components/Footer';
import PublicBottomNav from '../components/PublicBottomNav';
import PublicHeader from '../components/PublicHeader';
import api from '../services/api';

export default function ResultadosScreen() {
  const { answers } = useLocalSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [favorites, setFavorites] = useState<Record<number, boolean>>({});
  const [isScrolled, setIsScrolled] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [matchMessage, setMatchMessage] = useState('');

  useEffect(() => {
    let parsedAnswers = {};
    if (answers) {
      try {
        parsedAnswers = JSON.parse(answers as string);
      } catch (e) {
        console.error("Erro ao fazer parse das respostas:", e);
      }
    }

    const fetchMatches = async () => {
      try {
        // Envia as respostas do questionário para o motor de match anônimo
        const response = await api.post('/api/psychologists/match', parsedAnswers);
        const data = response.data;
        if (data && data.results) {
          setResults(data.results);
          setMatchMessage(data.message || '');
        }
      } catch (error) {
        console.error("Erro ao buscar matches:", error);
        Alert.alert("Erro", "Não foi possível carregar os resultados.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMatches();
  }, [answers]);

  const toggleFavorite = (id: number) => {
    setFavorites(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const formatPrice = (valor: number) => {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size={60} color="#1B4332" />
        <Text className="text-[#1B4332] font-title text-[24px] mt-6 mb-2">Encontrando seus matches...</Text>
        <Text className="text-[#666] font-sans text-[16px]">Analisando compatibilidade com seu perfil</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#1B4332' }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: isScrolled ? '#ffffff' : '#1B4332' }} edges={['top']}>
        <PublicHeader isScrolled={isScrolled} />
        <YeloScrollView 
          refreshColor="#1B4332" 
          contentContainerStyle={{ flexGrow: 1, backgroundColor: '#f9fafb' }}
          onScroll={(e) => setIsScrolled(e.nativeEvent.contentOffset.y > 20)}
          scrollEventThrottle={16}
        >
        
        {/* HERO SECTION */}
        <View className="bg-[#1B4332] pt-[40px] px-[20px] pb-[140px] items-center z-0">
          <Text className="text-white font-title text-[32px] mb-[15px] text-center">Top 3 Profissionais Recomendados</Text>
          <Text className="text-white/90 font-sans text-[18px] text-center max-w-[600px] leading-6">
            Com base nas suas respostas, selecionamos os 3 terapeutas com maior compatibilidade para o seu momento de vida.
          </Text>
        </View>

        {/* RESULTS WRAPPER (Negative Margin to overlap) */}
        <View className="flex-1 px-[20px] -mt-[80px] z-10 w-full max-w-[1200px] self-center pb-20">
          
          {results.length === 0 ? (
            <View className="bg-white rounded-[24px] p-8 items-center border border-black/5" style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.06, shadowRadius: 40 }}>
              <Text className="font-title text-[#1B4332] text-2xl text-center mb-4">Nenhum profissional encontrado</Text>
              <Text className="font-sans text-[#666] text-center text-lg">Tente ajustar suas preferências no questionário para ver mais opções.</Text>
              <TouchableOpacity onPress={() => router.back()} className="mt-8 bg-[#1B4332] rounded-full py-3 px-8">
                <Text className="text-white font-bold text-lg">Voltar ao Questionário</Text>
              </TouchableOpacity>
            </View>
          ) : (
            results.map((profile, index) => (
              <TouchableOpacity 
                key={profile.id} 
                activeOpacity={0.9}
                onPress={() => router.push(`/${profile.slug}` as any)}
                className="bg-white rounded-[24px] mb-[30px] border border-black/5 overflow-hidden"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.06,
                  shadowRadius: 40,
                  elevation: 4
                }}
              >
                {/* Image & Badges */}
                <View className="w-full h-[280px] bg-[#f8f9fa] relative overflow-hidden">
                  <Image 
                    source={{ uri: profile.fotoUrl || 'https://placehold.co/400x500/1B4332/FFF?text=PSI' }} 
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                  
                  {/* Match Badge */}
                  <View className="absolute top-[20px] left-[20px] bg-[#1B4332]/90 px-[16px] py-[8px] rounded-[30px] z-10">
                    <Text className="text-[#FFEE8C] font-bold text-[14px] font-sans tracking-wide">
                      {profile.matchScore || 0}% Compatível
                    </Text>
                  </View>

                {/* Heart Button */}
                <TouchableOpacity 
                  onPress={() => toggleFavorite(profile.id)}
                  className="absolute top-[20px] right-[20px] w-[40px] h-[40px] bg-white/90 rounded-full items-center justify-center z-10"
                  style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 15 }}
                >
                  <Feather 
                    name="heart" 
                    size={20} 
                    color={favorites[profile.id] ? "#E63946" : "#ccc"} 
                    fill={favorites[profile.id] ? "#E63946" : "transparent"} 
                  />
                </TouchableOpacity>
              </View>

              {/* Body */}
              <View className="p-[30px]">
                <Text className="font-title text-[#1B4332] text-[26px] leading-[30px] mb-1">{profile.nome}</Text>
                <Text className="font-sans font-medium text-[#888] text-[14px] mb-[20px]">CRP {profile.crp}</Text>

                {/* Tags */}
                {profile.matchReasons && profile.matchReasons.length > 0 && (
                  <View className="flex-row flex-wrap gap-[8px] mb-[20px]">
                    {profile.matchReasons.slice(0, 3).map((reason: string) => (
                      <View key={reason} className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-[50px] px-[14px] py-[6px]">
                        <Text className="text-[#166534] font-bold text-[12px] font-sans">{reason}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Bio */}
                <Text className="font-sans text-[#555] text-[15px] leading-6 mb-[25px]" numberOfLines={4}>
                  {profile.bio}
                </Text>

                {/* Footer (Price & CTA) */}
                <View className="flex-row justify-between items-center pt-[20px] border-t border-[#f0f0f0]">
                  <View>
                    <Text className="font-sans font-bold text-[#888] text-[12px] uppercase tracking-wide mb-1">
                      Por {profile.tipo_cobranca === 'mensal' ? 'mês' : 'sessão'}
                    </Text>
                    <Text className="font-title text-[#1B4332] text-[24px]">
                      {formatPrice(profile.valor_sessao_numero || profile.valor_mensal_numero || 0)}
                    </Text>
                  </View>

                  <TouchableOpacity 
                    onPress={() => router.push(`/${profile.slug}` as any)}
                    className="bg-[#FFEE8C] px-[28px] py-[12px] rounded-[50px]"
                    style={{ shadowColor: '#FFEE8C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 15 }}
                  >
                    <Text className="font-sans font-extrabold text-[#1B4332] text-[15px] uppercase tracking-wide">Ver Perfil</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
            ))
          )}
        </View>

        {/* Secundary Action (Refazer Busca) */}
          <View className="items-center mt-[50px]">
            <Text className="font-sans text-[17px] text-[#666] mb-[20px]">Quer explorar outras possibilidades?</Text>
            <TouchableOpacity 
              onPress={() => router.push('/questionario')}
              className="border-2 border-[#1B4332] rounded-[50px] py-[12px] px-[30px]"
            >
              <Text className="font-sans font-bold text-[#1B4332] text-[16px]">Refazer Questionário</Text>
            </TouchableOpacity>
            <Text className="font-sans font-medium text-[#888] text-[13px] mt-[12px] text-center px-4">
              ✨ Lembre-se: O match é por nossa conta e sem compromisso. O pagamento das sessões é combinado direto com o/a psicólogo/a.
            </Text>
          </View>

        <Footer />
      </YeloScrollView>
      <PublicBottomNav />
      </SafeAreaView>
    </View>
  );
}
