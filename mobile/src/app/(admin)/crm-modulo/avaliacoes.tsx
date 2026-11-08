import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../../services/api';

export default function AvaliacoesScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'psis' | 'pacientes'>('psis');
  const [filterStar, setFilterStar] = useState('Todas');
  const [reviews, setReviews] = useState<any[]>([]);
  const [platformReviews, setPlatformReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const [resPsis, resPacientes] = await Promise.all([
        api.get('/api/admin/reviews').catch(() => ({ data: [] })),
        api.get('/api/admin/platform-reviews').catch(() => ({ data: [] }))
      ]);
      setReviews(resPsis.data || []);
      setPlatformReviews(resPacientes.data || []);
      setOfflineMode(false);
    } catch (error) {
      setOfflineMode(true);
      setReviews([]);
      setPlatformReviews([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchReviews();
  };

  const avgPsiRating = reviews.length > 0 ? (reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / reviews.length).toFixed(1) : '0.0';
  const avgPlatformRating = platformReviews.length > 0 ? (platformReviews.reduce((acc, r) => acc + (r.rating || 0), 0) / platformReviews.length).toFixed(1) : '0.0';

  const filteredReviews = reviews.filter((r) => {
    if (filterStar === '5 Estrelas') return r.rating === 5;
    if (filterStar === 'Reclamações') return (r.rating || 0) <= 3;
    return true;
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#1B4332']} tintColor="#1B4332" />
        }
      >
        {offlineMode && (
          <View
            style={{
              backgroundColor: '#fef3c7',
              padding: 12,
              borderRadius: 14,
              marginBottom: 14,
              borderWidth: 1,
              borderColor: '#fde68a',
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <Feather name="wifi-off" size={16} color="#d97706" style={{ marginRight: 8 }} />
            <Text style={{ fontFamily: 'Inter_500Medium', color: '#b45309', fontSize: 12, flex: 1 }}>
              Modo Offline ativado (conectando aos servidores Yelo...).
            </Text>
          </View>
        )}

        {/* Header com Identidade Yelo */}
        <View
          style={{
            backgroundColor: '#1B4332',
            borderRadius: 20,
            padding: 20,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: '#2D6A4F',
            shadowColor: '#1B4332',
            shadowOpacity: 0.15,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#ffffff', fontSize: 22 }}>
                Avaliações & NPS ⭐
              </Text>
              <Text style={{ fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 }}>
                Feedbacks e notas enviadas por pacientes e psicólogos na Yelo.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(admin)/crm'))}
              style={{
                backgroundColor: 'rgba(255,255,255,0.15)',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}
              activeOpacity={0.8}
            >
              <Feather name="arrow-left" size={14} color="#ffffff" />
              <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#ffffff', fontSize: 11 }}>CRM Hub</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Abas Pílula */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          <TouchableOpacity
            onPress={() => setActiveTab('psis')}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 10,
              borderRadius: 999,
              backgroundColor: activeTab === 'psis' ? '#1B4332' : '#ffffff',
              borderWidth: 1,
              borderColor: activeTab === 'psis' ? '#1B4332' : '#e2e8f0',
            }}
            activeOpacity={0.8}
          >
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12.5, color: activeTab === 'psis' ? '#ffffff' : '#64748b' }}>
              Psicólogos ({reviews.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('pacientes')}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 10,
              borderRadius: 999,
              backgroundColor: activeTab === 'pacientes' ? '#1B4332' : '#ffffff',
              borderWidth: 1,
              borderColor: activeTab === 'pacientes' ? '#1B4332' : '#e2e8f0',
            }}
            activeOpacity={0.8}
          >
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12.5, color: activeTab === 'pacientes' ? '#ffffff' : '#64748b' }}>
              Pacientes UX ({platformReviews.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* CONTEÚDO DA ABA: PSICÓLOGOS */}
        {activeTab === 'psis' && (
          <View>
            {/* KPI Cards Uniformes sem bordas vazando */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
              <View
                style={{
                  flex: 1,
                  minWidth: '46%',
                  backgroundColor: '#ffffff',
                  padding: 16,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#64748b', fontSize: 11, textTransform: 'uppercase' }}>
                    Avaliações
                  </Text>
                  <View style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="message-square" size={14} color="#2563eb" />
                  </View>
                </View>
                <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 24 }}>{reviews.length}</Text>
              </View>

              <View
                style={{
                  flex: 1,
                  minWidth: '46%',
                  backgroundColor: '#ffffff',
                  padding: 16,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#64748b', fontSize: 11, textTransform: 'uppercase' }}>
                    Nota Média
                  </Text>
                  <View style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: '#fffbeb', alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="star" size={14} color="#f59e0b" />
                  </View>
                </View>
                <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#f59e0b', fontSize: 24 }}>{avgPsiRating}</Text>
              </View>

              <View
                style={{
                  width: '100%',
                  backgroundColor: '#ffffff',
                  padding: 16,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View>
                  <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#64748b', fontSize: 11, textTransform: 'uppercase', marginBottom: 4 }}>
                    Destaques Landing Page (Nota 5)
                  </Text>
                  <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#10b981', fontSize: 22 }}>
                    {reviews.filter((r) => r.rating === 5).length} avaliações
                  </Text>
                </View>
                <View style={{ width: 36, height: 36, borderRadius: 999, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="award" size={18} color="#10b981" />
                </View>
              </View>
            </View>

            {/* Filtros Rápidos Pílula */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {['Todas', '5 Estrelas', 'Reclamações'].map((f) => (
                <TouchableOpacity
                  key={f}
                  onPress={() => setFilterStar(f)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderRadius: 999,
                    borderWidth: 1,
                    backgroundColor: filterStar === f ? '#1B4332' : '#ffffff',
                    borderColor: filterStar === f ? '#1B4332' : '#e2e8f0',
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: filterStar === f ? '#ffffff' : '#64748b' }}>
                    {f}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Lista de Avaliações */}
            <View style={{ gap: 12 }}>
              {loading ? (
                <ActivityIndicator color="#1B4332" style={{ marginVertical: 30 }} />
              ) : filteredReviews.length === 0 ? (
                <View style={{ backgroundColor: '#ffffff', borderRadius: 20, padding: 30, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' }}>
                  <Text style={{ fontSize: 24, marginBottom: 6 }}>⭐</Text>
                  <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 16 }}>Nenhuma avaliação encontrada</Text>
                  <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 12, marginTop: 4 }}>
                    Não há registros para o filtro selecionado.
                  </Text>
                </View>
              ) : (
                filteredReviews.map((item, index) => (
                  <View
                    key={item.id || index}
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: 20,
                      padding: 16,
                      borderWidth: 1,
                      borderColor: '#e2e8f0',
                      shadowColor: '#000',
                      shadowOpacity: 0.02,
                      shadowRadius: 4,
                      elevation: 1,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 999,
                            backgroundColor: '#e8f5e9',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1,
                            borderColor: '#c8e6c9',
                          }}
                        >
                          <Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 13 }}>
                            {(item.Psychologist?.nome || 'PS').slice(0, 2).toUpperCase()}
                          </Text>
                        </View>
                        <View>
                          <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 15 }}>
                            {item.Psychologist?.nome || 'Psicólogo Desconhecido'}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                            {[...Array(5)].map((_, i) => (
                              <Feather
                                key={i}
                                name="star"
                                size={13}
                                color={i < (item.rating || 0) ? '#f59e0b' : '#e2e8f0'}
                                style={{ marginRight: 2 }}
                              />
                            ))}
                            <Text style={{ fontFamily: 'Inter_700Bold', color: '#f59e0b', fontSize: 12, marginLeft: 4 }}>
                              {item.rating?.toFixed(1) || '0.0'}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <Text style={{ fontFamily: 'Inter_400Regular', color: '#94a3b8', fontSize: 11 }}>
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString('pt-BR') : ''}
                      </Text>
                    </View>

                    <Text style={{ fontFamily: 'Inter_400Regular', color: '#475569', fontSize: 13, lineHeight: 19, fontStyle: 'italic', marginBottom: 14 }}>
                      "{item.comment || 'Sem comentário.'}"
                    </Text>

                    <View style={{ flexDirection: 'row', gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
                      <TouchableOpacity
                        onPress={() => Alert.alert('Sucesso', 'Avaliação destacada na LP com sucesso.')}
                        style={{
                          flex: 1,
                          backgroundColor: '#f0fdf4',
                          borderWidth: 1,
                          borderColor: '#bbf7d0',
                          paddingVertical: 9,
                          borderRadius: 999,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                        }}
                        activeOpacity={0.8}
                      >
                        <Feather name="check-circle" size={14} color="#16a34a" />
                        <Text style={{ fontFamily: 'Inter_700Bold', color: '#16a34a', fontSize: 12 }}>Aprovar LP</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => Alert.alert('WhatsApp', 'Abrindo conversa com o psicólogo...')}
                        style={{
                          flex: 1,
                          backgroundColor: '#f8fafc',
                          borderWidth: 1,
                          borderColor: '#e2e8f0',
                          paddingVertical: 9,
                          borderRadius: 999,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                        }}
                        activeOpacity={0.8}
                      >
                        <Feather name="message-circle" size={14} color="#64748b" />
                        <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#64748b', fontSize: 12 }}>Falar no Wpp</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {/* CONTEÚDO DA ABA: PACIENTES */}
        {activeTab === 'pacientes' && (
          <View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
              <View
                style={{
                  flex: 1,
                  minWidth: '46%',
                  backgroundColor: '#ffffff',
                  padding: 16,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#64748b', fontSize: 11, textTransform: 'uppercase' }}>
                    Total Feedbacks
                  </Text>
                  <View style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="users" size={14} color="#2563eb" />
                  </View>
                </View>
                <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 24 }}>{platformReviews.length}</Text>
              </View>

              <View
                style={{
                  flex: 1,
                  minWidth: '46%',
                  backgroundColor: '#ffffff',
                  padding: 16,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#64748b', fontSize: 11, textTransform: 'uppercase' }}>
                    Nota Média UX
                  </Text>
                  <View style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: '#fffbeb', alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="star" size={14} color="#f59e0b" />
                  </View>
                </View>
                <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#f59e0b', fontSize: 24 }}>{avgPlatformRating}</Text>
              </View>
            </View>

            <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 16, marginBottom: 12 }}>
              Comentários de Usuários (Exit-Intent)
            </Text>

            <View style={{ gap: 12 }}>
              {loading ? (
                <ActivityIndicator color="#1B4332" style={{ marginVertical: 30 }} />
              ) : platformReviews.length === 0 ? (
                <View style={{ backgroundColor: '#ffffff', borderRadius: 20, padding: 30, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' }}>
                  <Text style={{ fontSize: 24, marginBottom: 6 }}>💬</Text>
                  <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 16 }}>Nenhum feedback de UX</Text>
                  <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 12, marginTop: 4 }}>
                    Ainda não há registros de avaliação de UX de pacientes.
                  </Text>
                </View>
              ) : (
                platformReviews.map((item, index) => (
                  <View
                    key={item.id || index}
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: 20,
                      padding: 16,
                      borderWidth: 1,
                      borderColor: '#e2e8f0',
                      shadowColor: '#000',
                      shadowOpacity: 0.02,
                      shadowRadius: 4,
                      elevation: 1,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <View style={{ backgroundColor: '#e8f5e9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
                        <Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 11 }}>
                          {item.isAnonymous ? 'Anônimo' : item.Patient?.nome || 'Usuário'}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Feather name="star" size={13} color="#f59e0b" style={{ marginRight: 4 }} />
                        <Text style={{ fontFamily: 'Inter_700Bold', color: '#f59e0b', fontSize: 12 }}>{item.rating || 0}</Text>
                      </View>
                    </View>

                    <Text style={{ fontFamily: 'Inter_400Regular', color: '#475569', fontSize: 13, lineHeight: 19 }}>
                      "{item.comment || 'Sem comentário'}"
                    </Text>
                  </View>
                ))
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
