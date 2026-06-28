import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import api from '../../../services/api';

export default function AvaliacoesScreen() {
  const [activeTab, setActiveTab] = useState('psis');
  const [filterStar, setFilterStar] = useState('Todas');
  const [reviews, setReviews] = useState<any[]>([]);
  const [platformReviews, setPlatformReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);

  useEffect(() => {
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
        setReviews([{ id: 1, rating: 5, comment: "A plataforma tem sido ótima...", createdAt: new Date().toISOString(), Psychologist: { nome: "Dra. Camila Soares" } }]);
        setPlatformReviews([{ id: 1, rating: 4, comment: "Gostei muito dos matches...", isAnonymous: true, Patient: { nome: "Anônimo" } }]);
      } finally {
        setLoading(false);
      }
    };
    fetchReviews();
  }, []);

  const avgPsiRating = reviews.length > 0 ? (reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / reviews.length).toFixed(1) : '0.0';
  const avgPlatformRating = platformReviews.length > 0 ? (platformReviews.reduce((acc, r) => acc + (r.rating || 0), 0) / platformReviews.length).toFixed(1) : '0.0';

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {offlineMode && (
          <View className="bg-[#fef3c7] p-[12px] rounded-[12px] mb-[15px] border border-[#fde68a] flex-row items-center">
            <Feather name="wifi-off" size={16} color="#d97706" style={{ marginRight: 10 }} />
            <Text className="font-sans text-[#b45309] text-[12px] flex-1">
              Modo Offline: Mostrando dados de demonstração.
            </Text>
          </View>
        )}

        {/* Header */}
        <View className="mb-[20px]">
          <Text className="font-title text-[#1e1b4b] text-[24px]">Avaliações (NPS)</Text>
          <Text className="font-sans text-[#666] text-[14px]">Gerencie os feedbacks enviados por pacientes e doutores.</Text>
        </View>

        {/* Abas */}
        <View className="flex-row gap-[10px] mb-[20px]">
          <TouchableOpacity 
            onPress={() => setActiveTab('psis')}
            className={`flex-1 items-center justify-center py-[10px] rounded-[12px] ${activeTab === 'psis' ? 'bg-[#1e1b4b]' : 'bg-white border border-[#e2e8f0]'}`}
          >
            <Text className={`font-sans font-bold text-[12px] ${activeTab === 'psis' ? 'text-white' : 'text-[#64748b]'}`}>Psicólogos</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={() => setActiveTab('pacientes')}
            className={`flex-1 items-center justify-center py-[10px] rounded-[12px] ${activeTab === 'pacientes' ? 'bg-[#1e1b4b]' : 'bg-white border border-[#e2e8f0]'}`}
          >
            <Text className={`font-sans font-bold text-[12px] ${activeTab === 'pacientes' ? 'text-white' : 'text-[#64748b]'}`}>Pacientes (UX)</Text>
          </TouchableOpacity>
        </View>

        {/* CONTEÚDO DA ABA: PSICÓLOGOS */}
        {activeTab === 'psis' && (
          <View>
            <View className="flex-row flex-wrap justify-between gap-y-[15px] mb-[25px]">
              <View className="w-[48%] bg-white p-[15px] rounded-[12px] border-t-4 border-[#3b82f6] shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
                <Text className="font-sans text-[#64748b] text-[11px] mb-[5px]">Avaliações</Text>
                <Text className="font-title text-[#3b82f6] text-[20px]">{reviews.length}</Text>
              </View>
              
              <View className="w-[48%] bg-white p-[15px] rounded-[12px] border-t-4 border-[#f59e0b] shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
                <Text className="font-sans text-[#64748b] text-[11px] mb-[5px]">Nota Média</Text>
                <Text className="font-title text-[#f59e0b] text-[20px]">{avgPsiRating}</Text>
              </View>

              <View className="w-full bg-white p-[15px] rounded-[12px] border-t-4 border-[#10b981] shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex-row items-center justify-between">
                <View>
                  <Text className="font-sans text-[#64748b] text-[11px] mb-[5px]">Destaques na Landing Page</Text>
                  <Text className="font-title text-[#10b981] text-[20px]">
                    {reviews.filter(r => r.rating === 5).length}
                  </Text>
                </View>
                <Feather name="star" size={24} color="#10b981" />
              </View>
            </View>

            {/* Filtros Rapidos */}
            <View className="flex-row gap-[10px] mb-[15px]">
              {['Todas', '5 Estrelas', 'Reclamações'].map((f) => (
                <TouchableOpacity 
                  key={f}
                  onPress={() => setFilterStar(f)}
                  className={`px-[12px] py-[6px] rounded-full border ${filterStar === f ? 'bg-[#f1f5f9] border-[#cbd5e1]' : 'border-[#e2e8f0]'}`}
                >
                  <Text className={`font-sans text-[12px] ${filterStar === f ? 'text-[#333] font-bold' : 'text-[#64748b]'}`}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View className="gap-[15px]">
              {loading ? <ActivityIndicator color="#1e1b4b" /> : reviews.map((item, index) => (
                <View key={item.id || index} className="bg-white rounded-[16px] p-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-[#f0f0f0]">
                  <View className="flex-row justify-between items-start mb-[10px]">
                    <View>
                      <Text className="font-title text-[#333] text-[16px]">{item.Psychologist?.nome || 'Psicólogo Desconhecido'}</Text>
                      <View className="flex-row items-center mt-[4px]">
                        {[...Array(5)].map((_, i) => (
                          <Feather key={i} name="star" size={14} color={i < (item.rating || 0) ? "#f59e0b" : "#e2e8f0"} style={{marginRight: 2}} />
                        ))}
                        <Text className="font-sans text-[#f59e0b] font-bold text-[12px] ml-[5px]">{item.rating?.toFixed(1) || '0.0'}</Text>
                      </View>
                    </View>
                    <Text className="font-sans text-[#64748b] text-[11px]">
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString('pt-BR') : ''}
                    </Text>
                  </View>
                  
                  <Text className="font-sans text-[#475569] text-[14px] leading-[20px] italic mb-[15px]">
                    "{item.comment || 'Sem comentário.'}"
                  </Text>

                  <View className="flex-row gap-[10px] pt-[15px] border-t border-[#f1f5f9]">
                    <TouchableOpacity className="flex-1 bg-[#f0fdf4] border border-[#bbf7d0] py-[8px] rounded-[8px] flex-row items-center justify-center">
                      <Feather name="check-circle" size={14} color="#16a34a" />
                      <Text className="text-[#16a34a] font-sans font-bold text-[12px] ml-[5px]">Aprovar LP</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => Alert.alert('Wpp', 'Abrindo conversa...')} className="flex-1 bg-[#f1f5f9] border border-[#e2e8f0] py-[8px] rounded-[8px] flex-row items-center justify-center">
                      <Feather name="message-circle" size={14} color="#64748b" />
                      <Text className="text-[#64748b] font-sans font-bold text-[12px] ml-[5px]">Falar no Wpp</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* CONTEÚDO DA ABA: PACIENTES */}
        {activeTab === 'pacientes' && (
          <View>
            <View className="flex-row flex-wrap justify-between gap-y-[15px] mb-[25px]">
              <View className="w-[48%] bg-white p-[15px] rounded-[12px] border-t-4 border-[#3b82f6] shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
                <Text className="font-sans text-[#64748b] text-[11px] mb-[5px]">Total de Feedbacks</Text>
                <Text className="font-title text-[#3b82f6] text-[20px]">{platformReviews.length}</Text>
              </View>
              
              <View className="w-[48%] bg-white p-[15px] rounded-[12px] border-t-4 border-[#f59e0b] shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
                <Text className="font-sans text-[#64748b] text-[11px] mb-[5px]">Nota Média UX</Text>
                <Text className="font-title text-[#f59e0b] text-[20px]">{avgPlatformRating}</Text>
              </View>
            </View>

            <Text className="font-title text-[#1e293b] text-[16px] mb-[15px]">Comentários (Exit-Intent)</Text>

            <View className="gap-[15px]">
              {loading ? <ActivityIndicator color="#1e1b4b" /> : platformReviews.map((item, index) => (
                <View key={item.id || index} className="bg-white rounded-[16px] p-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-[#f0f0f0]">
                  <View className="flex-row justify-between items-start mb-[10px]">
                    <View className="bg-[#f1f5f9] px-[10px] py-[4px] rounded-[6px]">
                      <Text className="font-sans text-[#333] font-bold text-[12px]">{item.isAnonymous ? 'Anônimo' : (item.Patient?.nome || 'Usuário')}</Text>
                    </View>
                    <View className="flex-row items-center">
                      <Feather name="star" size={14} color="#f59e0b" style={{marginRight: 4}} />
                      <Text className="font-sans text-[#64748b] font-bold text-[12px]">{item.rating || 0}</Text>
                    </View>
                  </View>
                  
                  <Text className="font-sans text-[#475569] text-[14px] leading-[20px]">
                    "{item.comment || 'Sem comentário'}"
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View className="h-[120px]" />
      </ScrollView>
    </View>
  );
}
