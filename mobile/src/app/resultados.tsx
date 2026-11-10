import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Image, 
  ActivityIndicator, 
  Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import YeloScrollView from '../components/YeloScrollView';
import Footer from '../components/Footer';
import PublicBottomNav from '../components/PublicBottomNav';
import PublicHeader from '../components/PublicHeader';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

function cleanHtmlBio(html?: string | null): string {
  if (!html) return '';
  return html
    .replace(/<br\s*[\/]?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function ResultadosScreen() {
  const { answers } = useLocalSearchParams();
  const { user, token } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [favorites, setFavorites] = useState<Record<number, boolean>>({});
  const [isScrolled, setIsScrolled] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [parsedAnswers, setParsedAnswers] = useState<any>({});
  const [hasLoadedMore, setHasLoadedMore] = useState(false);

  useEffect(() => {
    let currentAnswers: any = {};
    if (answers) {
      try {
        currentAnswers = JSON.parse(answers as string);
        setParsedAnswers(currentAnswers);
      } catch (e) {
        console.error("Erro ao fazer parse das respostas:", e);
      }
    }

    const fetchMatches = async () => {
      try {
        // Envia as preferências para o motor de match real do backend
        const response = await api.post('/api/psychologists/match', currentAnswers);
        const data = response.data;
        if (data && data.results) {
          setResults(data.results);
        }
      } catch (error) {
        console.error("Erro ao buscar matches:", error);
        Alert.alert("Aviso", "Não foi possível carregar os resultados ideais no momento.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMatches();
  }, [answers]);

  const handleLoadMore = async () => {
    if (isLoadingMore || hasLoadedMore) return;
    setIsLoadingMore(true);

    try {
      const currentIds = results.map(r => r.id);
      const response = await api.post('/api/psychologists/match', {
        ...parsedAnswers,
        excludeIds: currentIds,
      });

      const data = response.data;
      if (data && data.results && data.results.length > 0) {
        setResults(prev => [...prev, ...data.results]);
      }
      setHasLoadedMore(true);
    } catch (e) {
      console.error("Erro ao carregar mais psicólogos:", e);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const toggleFavorite = async (id: number) => {
    const isNowFav = !favorites[id];
    setFavorites(prev => ({ ...prev, [id]: isNowFav }));

    if (token) {
      try {
        await api.put('/api/patients/me/favorites', { psychologistId: id });
      } catch (e) {
        // Reverte se falhar
        setFavorites(prev => ({ ...prev, [id]: !isNowFav }));
      }
    }
  };

  const formatPrice = (val: any) => {
    if (!val) return 'A combinar';
    let num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[R$\s]/gi, '').replace(',', '.'));
    if (!num || isNaN(num) || num <= 0) return 'A combinar';
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Mapeia o score original (0 a 100) para a faixa perceptiva (85% a 99%) igual ao site web
  const calculateDisplayScore = (score: any, matchScore: any) => {
    const raw = parseFloat(score ?? matchScore ?? 80);
    if (isNaN(raw)) return '94.5';
    return (85 + (raw * 0.14)).toFixed(1);
  };

  const getReasonText = (profile: any) => {
    let reasons = profile.matchReasons;
    if (Array.isArray(reasons) && reasons.length > 0) {
      return reasons[0];
    }
    if (typeof reasons === 'string' && reasons.trim() !== '') {
      return reasons;
    }
    let tags = profile.tags;
    if (Array.isArray(tags) && tags.length > 0) {
      return tags[0];
    }
    if (typeof tags === 'string' && tags.trim() !== '') {
      return tags.split(',')[0].trim();
    }
    return 'Perfil altamente compatível com suas prioridades e estilo de condução.';
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-white items-center justify-center p-6">
        <ActivityIndicator size={54} color="#1B4332" />
        <Text className="text-[#1B4332] font-title text-[24px] mt-6 mb-2 text-center">
          Encontrando seus matches...
        </Text>
        <Text className="text-[#666] font-sans text-[15px] text-center">
          Analisando compatibilidade clínica com o seu perfil
        </Text>
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
          <View className="bg-[#1B4332] pt-[30px] px-[20px] pb-[120px] items-center z-0">
            <Text className="text-white font-title text-[30px] mb-[12px] text-center">
              Top Profissionais Recomendados
            </Text>
            <Text className="text-white/90 font-sans text-[16px] text-center max-w-[500px] leading-6">
              Com base nas suas respostas, selecionamos os terapeutas com maior afinidade para o seu momento de vida.
            </Text>
          </View>

          {/* RESULTS WRAPPER */}
          <View className="flex-1 px-[16px] -mt-[70px] z-10 w-full max-w-[650px] self-center pb-12">
            
            {results.length === 0 ? (
              <View 
                className="bg-white rounded-[24px] p-8 items-center border border-black/5" 
                style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.06, shadowRadius: 30 }}
              >
                <Text className="font-title text-[#1B4332] text-2xl text-center mb-3">
                  Nenhum profissional encontrado
                </Text>
                <Text className="font-sans text-[#666] text-center text-[15px] leading-6">
                  Tente ajustar suas preferências no questionário para ver mais opções que combinem com você.
                </Text>
                <TouchableOpacity 
                  onPress={() => router.replace('/questionario')} 
                  className="mt-6 bg-[#1B4332] rounded-full py-3.5 px-8"
                >
                  <Text className="text-white font-bold text-[16px]">Refazer Questionário</Text>
                </TouchableOpacity>
              </View>
            ) : (
              results.map((profile) => {
                const scoreText = calculateDisplayScore(profile.score, profile.matchScore);
                const isFav = !!favorites[profile.id];
                const isMensal = profile.tipo_cobranca === 'mensal';
                const rawPrice = isMensal 
                  ? (profile.valor_mensal_numero || profile.valor_sessao_numero) 
                  : (profile.valor_sessao_numero || profile.valor_mensal_numero);
                const priceFormatted = formatPrice(rawPrice);
                const reason = getReasonText(profile);

                return (
                  <TouchableOpacity 
                    key={profile.id} 
                    activeOpacity={0.95}
                    onPress={() => router.push(`/${profile.slug}` as any)}
                    className="bg-white rounded-[24px] mb-[24px] border border-black/5 overflow-hidden"
                    style={{
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 8 },
                      shadowOpacity: 0.08,
                      shadowRadius: 25,
                      elevation: 4
                    }}
                  >
                    {/* Header: Imagem & Badges */}
                    <View className="w-full h-[260px] bg-[#f8f9fa] relative overflow-hidden">
                      <Image 
                        source={{ uri: profile.fotoUrl || 'https://placehold.co/400x500/1B4332/FFF?text=Foto' }} 
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                      
                      {/* Match Badge */}
                      <View className="absolute top-[16px] left-[16px] bg-[#1B4332]/95 px-[14px] py-[7px] rounded-[30px] z-10 shadow-sm">
                        <Text className="text-[#FFEE8C] font-bold text-[13px] font-sans tracking-wide">
                          {scoreText}% Compatível
                        </Text>
                      </View>

                      {/* Heart Button */}
                      <TouchableOpacity 
                        onPress={() => toggleFavorite(profile.id)}
                        className="absolute top-[16px] right-[16px] w-[38px] h-[38px] bg-white/90 rounded-full items-center justify-center z-10"
                        style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8 }}
                      >
                        <Feather 
                          name="heart" 
                          size={18} 
                          color={isFav ? "#E63946" : "#666"} 
                        />
                      </TouchableOpacity>
                    </View>

                    {/* Card Body */}
                    <View className="p-[22px]">
                      <Text className="font-title text-[#1B4332] text-[24px] leading-[28px] mb-1">
                        {profile.nome}
                      </Text>
                      <Text className="font-sans font-medium text-[#777] text-[13px] mb-[16px]">
                        CRP {profile.crp}
                      </Text>

                      {/* Motivo de Recomendação (Caixa Verde Claro) */}
                      {reason ? (
                        <View className="bg-[#E8F5E9] border border-[#C8E6C9] p-[12px] rounded-[12px] mb-[16px]">
                          <Text className="font-sans font-bold text-[#1B4332] text-[11px] uppercase tracking-wider mb-1">
                            Por que recomendamos
                          </Text>
                          <Text className="font-sans text-[#1B4332] text-[13px] leading-5" numberOfLines={3}>
                            {reason}
                          </Text>
                        </View>
                      ) : null}

                      {/* Bio resumida */}
                      {profile.bio ? (
                        <Text className="font-sans text-[#555] text-[14px] leading-5 mb-[20px]" numberOfLines={3}>
                          {cleanHtmlBio(profile.bio)}
                        </Text>
                      ) : null}

                      {/* Footer: Preço & Ação */}
                      <View className="flex-row justify-between items-center pt-[16px] border-t border-[#f0f0f0]">
                        <View>
                          <Text className="font-sans font-bold text-[#888] text-[11px] uppercase tracking-wide mb-0.5">
                            Por {isMensal ? 'mês' : 'sessão'}
                          </Text>
                          <Text className="font-title text-[#1B4332] text-[22px]">
                            {priceFormatted}
                          </Text>
                        </View>

                        <TouchableOpacity 
                          onPress={() => router.push(`/${profile.slug}` as any)}
                          className="bg-[#FFEE8C] px-[24px] py-[11px] rounded-[50px]"
                          style={{ shadowColor: '#FFEE8C', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 10 }}
                        >
                          <Text className="font-sans font-extrabold text-[#1B4332] text-[14px] uppercase tracking-wide">
                            Ver Perfil
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}

            {/* Botão Ver Mais Profissionais (Carrega mais 3 psicólogos) */}
            {results.length > 0 && !hasLoadedMore && (
              <TouchableOpacity
                onPress={handleLoadMore}
                disabled={isLoadingMore}
                className="self-center bg-white border border-[#1B4332] py-3 px-8 rounded-full mb-8 mt-2 items-center justify-center flex-row shadow-sm"
              >
                {isLoadingMore ? (
                  <ActivityIndicator size="small" color="#1B4332" />
                ) : (
                  <Text className="font-sans font-bold text-[#1B4332] text-[15px]">
                    Ver mais profissionais
                  </Text>
                )}
              </TouchableOpacity>
            )}

            {/* Secundary Action (Refazer Busca) */}
            <View className="items-center mt-[24px] mb-[20px]">
              <Text className="font-sans text-[15px] text-[#666] mb-[14px]">
                Quer explorar outras possibilidades?
              </Text>
              <TouchableOpacity 
                onPress={() => router.replace('/questionario')}
                className="border border-[#1B4332] rounded-[50px] py-[10px] px-[26px]"
              >
                <Text className="font-sans font-bold text-[#1B4332] text-[15px]">
                  Refazer Questionário
                </Text>
              </TouchableOpacity>
              <Text className="font-sans font-medium text-[#888] text-[12px] mt-[14px] text-center px-4 leading-4">
                ✨ Lembre-se: O match é por nossa conta e sem compromisso. O pagamento das sessões é combinado direto com o/a psicólogo/a.
              </Text>
            </View>

          </View>

          <Footer />
        </YeloScrollView>
        <PublicBottomNav />
      </SafeAreaView>
    </View>
  );
}
