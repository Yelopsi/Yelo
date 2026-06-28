import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import api from '../../../services/api';

export default function AnalyticsCrescimentoScreen() {
  const [activeTab, setActiveTab] = useState('funil');
  const [stats, setStats] = useState<any>(null);
  const [followups, setFollowups] = useState<any[]>([]);
  const [ranking, setRanking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [resFunnel, resWpp, resRanking] = await Promise.all([
          api.get('/api/admin/analytics/funnel').catch(() => ({ data: {} })),
          api.get('/api/admin/whatsapp-feedbacks').catch(() => ({ data: [] })),
          api.get('/api/admin/analytics/ranking').catch(() => ({ data: [] }))
        ]);

        setStats(resFunnel.data || {});
        setFollowups(resWpp.data || []);
        setRanking(resRanking.data || []);
        setOfflineMode(false);
      } catch (error) {
        setOfflineMode(true);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const totalVisitantes = stats?.visitas || 0;
  const iniciaramFluxo = stats?.iniciaram || 0;
  const chegaramMatch = stats?.completaram || 0;
  const cliquesWpp = stats?.whatsappClicks || 0;

  const conversao1 = totalVisitantes > 0 ? ((chegaramMatch / totalVisitantes) * 100).toFixed(1) : 0;
  const conversao2 = chegaramMatch > 0 ? ((cliquesWpp / chegaramMatch) * 100).toFixed(1) : 0;

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

        {/* Header Descritivo */}
        <View className="mb-[20px]">
          <Text className="font-title text-[#1e1b4b] text-[24px]">Growth & Conversão</Text>
          <Text className="font-sans text-[#666] text-[14px]">Métricas de produto e engajamento PLG.</Text>
        </View>

        {/* Filtros de Data */}
        <View className="bg-white rounded-[16px] p-[15px] mb-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-[#f0f0f0]">
          <View className="flex-row items-center justify-between mb-[10px]">
            <View className="flex-1 mr-[10px]">
              <Text className="font-sans text-[#64748b] text-[12px] mb-[4px]">De:</Text>
              <View className="bg-[#f1f5f9] px-[12px] py-[8px] rounded-[8px]">
                <Text className="text-[#333] font-sans">01/06/2026</Text>
              </View>
            </View>
            <View className="flex-1">
              <Text className="font-sans text-[#64748b] text-[12px] mb-[4px]">Até:</Text>
              <View className="bg-[#f1f5f9] px-[12px] py-[8px] rounded-[8px]">
                <Text className="text-[#333] font-sans">30/06/2026</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity className="bg-[#1B4332] flex-row justify-center items-center py-[10px] rounded-[8px]">
            <Feather name="filter" size={16} color="white" />
            <Text className="text-white font-sans font-bold ml-[8px]">Atualizar</Text>
          </TouchableOpacity>
        </View>

        {/* Abas */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-[20px]">
          <View className="flex-row gap-[10px]">
            <TouchableOpacity 
              onPress={() => setActiveTab('funil')}
              className={`px-[16px] py-[8px] rounded-[20px] ${activeTab === 'funil' ? 'bg-[#1e1b4b]' : 'bg-[#f1f5f9] border border-[#e2e8f0]'}`}
            >
              <Text className={`font-sans font-bold text-[12px] ${activeTab === 'funil' ? 'text-white' : 'text-[#64748b]'}`}>🎯 Funil End-to-End</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => setActiveTab('plg')}
              className={`px-[16px] py-[8px] rounded-[20px] ${activeTab === 'plg' ? 'bg-[#1e1b4b]' : 'bg-[#f1f5f9] border border-[#e2e8f0]'}`}
            >
              <Text className={`font-sans font-bold text-[12px] ${activeTab === 'plg' ? 'text-white' : 'text-[#64748b]'}`}>🤝 Conversões (PLG)</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => setActiveTab('ranking')}
              className={`px-[16px] py-[8px] rounded-[20px] ${activeTab === 'ranking' ? 'bg-[#1e1b4b]' : 'bg-[#f1f5f9] border border-[#e2e8f0]'}`}
            >
              <Text className={`font-sans font-bold text-[12px] ${activeTab === 'ranking' ? 'text-white' : 'text-[#64748b]'}`}>🏆 Ranking de Psis</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* CONTEÚDO DA ABA: FUNIL */}
        {activeTab === 'funil' && (
          <View>
            {/* Grid de KPIs */}
            <View className="flex-row flex-wrap justify-between gap-y-[15px] mb-[25px]">
              <View className="w-[48%] bg-white p-[15px] rounded-[12px] border-t-4 border-[#3b82f6] shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
                <Text className="font-sans text-[#64748b] text-[11px] mb-[5px]">Visitantes Estimados</Text>
                <Text className="font-title text-[#1e293b] text-[20px]">{totalVisitantes}</Text>
              </View>
              
              <View className="w-[48%] bg-white p-[15px] rounded-[12px] border-t-4 border-[#8b5cf6] shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
                <Text className="font-sans text-[#64748b] text-[11px] mb-[5px]">Iniciaram Fluxo</Text>
                <Text className="font-title text-[#1e293b] text-[20px]">{iniciaramFluxo}</Text>
              </View>

              <View className="w-[48%] bg-white p-[15px] rounded-[12px] border-t-4 border-[#f59e0b] shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
                <Text className="font-sans text-[#64748b] text-[11px] mb-[5px]">Chegaram ao Match</Text>
                <Text className="font-title text-[#1e293b] text-[20px]">{chegaramMatch}</Text>
              </View>

              <View className="w-[48%] bg-white p-[15px] rounded-[12px] border-t-4 border-[#10b981] shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
                <Text className="font-sans text-[#64748b] text-[11px] mb-[5px]">Pacientes (Cliques Wpp)</Text>
                <Text className="font-title text-[#1e293b] text-[20px]">{cliquesWpp}</Text>
              </View>
            </View>

            {/* Jornada Visual (Funil) */}
            <View className="bg-white rounded-[16px] p-[20px] border border-[#f0f0f0] shadow-[0_2px_10px_rgba(0,0,0,0.03)] mb-[25px]">
              <Text className="font-title text-[#1e293b] text-[16px] mb-[5px]">Jornada do Paciente</Text>
              <Text className="font-sans text-[#64748b] text-[12px] mb-[20px]">Onde estamos perdendo usuários?</Text>
              
              <View className="gap-[15px]">
                {/* Estágio 1 */}
                <View className="bg-[#f8f9fa] border border-[#e9ecef] rounded-[12px] p-[15px]">
                  <View className="flex-row justify-between items-center mb-[5px]">
                    <Text className="font-title text-[#333] text-[14px]">1. Acesso ao Site Estimado</Text>
                    <Text className="font-title text-[#1B4332] text-[18px]">{totalVisitantes}</Text>
                  </View>
                  <View className="h-[8px] bg-[#e2e8f0] rounded-full w-full">
                    <View className="h-full bg-[#3b82f6] rounded-full w-full" />
                  </View>
                </View>

                <Feather name="arrow-down" size={20} color="#cbd5e1" style={{ alignSelf: 'center' }} />

                {/* Estágio 2 */}
                <View className="bg-[#f8f9fa] border border-[#e9ecef] rounded-[12px] p-[15px]">
                  <View className="flex-row justify-between items-center mb-[5px]">
                    <Text className="font-title text-[#333] text-[14px]">2. Completou Match</Text>
                    <Text className="font-title text-[#1B4332] text-[18px]">{chegaramMatch}</Text>
                  </View>
                  <Text className="font-sans text-[#f59e0b] bg-[#fef3c7] self-start px-[8px] py-[2px] rounded-full text-[10px] font-bold mb-[8px]">{conversao1}% do tráfego inicial</Text>
                  <View className="h-[8px] bg-[#e2e8f0] rounded-full w-full">
                    <View className={`h-full bg-[#f59e0b] rounded-full`} style={{ width: `${conversao1}%` }} />
                  </View>
                </View>

                <Feather name="arrow-down" size={20} color="#cbd5e1" style={{ alignSelf: 'center' }} />

                {/* Estágio 3 */}
                <View className="bg-[#f8f9fa] border border-[#e9ecef] rounded-[12px] p-[15px]">
                  <View className="flex-row justify-between items-center mb-[5px]">
                    <Text className="font-title text-[#333] text-[14px]">3. Conversão (Wpp)</Text>
                    <Text className="font-title text-[#10b981] text-[18px]">{cliquesWpp}</Text>
                  </View>
                  <Text className="font-sans text-[#059669] bg-[#d1fae5] self-start px-[8px] py-[2px] rounded-full text-[10px] font-bold mb-[8px]">{conversao2}% da etapa anterior</Text>
                  <View className="h-[8px] bg-[#e2e8f0] rounded-full w-full">
                    <View className={`h-full bg-[#10b981] rounded-full`} style={{ width: `${conversao2}%` }} />
                  </View>
                </View>
              </View>
            </View>
            
            {/* Insights */}
            <View className="bg-[#fffbeb] border border-[#fde68a] rounded-[16px] p-[20px]">
              <View className="flex-row items-center gap-[8px] mb-[10px]">
                <Text className="text-[20px]">💡</Text>
                <Text className="font-title text-[#b45309] text-[16px]">Insights Sugeridos</Text>
              </View>
              <Text className="font-sans text-[#b45309] text-[14px] leading-relaxed">
                A conversão na página inicial está baixa. Sugerimos encurtar as primeiras 3 perguntas do formulário para evitar que as pessoas fechem a tela (60% de abandono antes da etapa 2).
              </Text>
            </View>
          </View>
        )}

        {/* CONTEÚDO DA ABA: PLG */}
        {activeTab === 'plg' && (
          <View>
            <View className="bg-white rounded-[16px] p-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] mb-[20px] border border-[#f0f0f0]">
              <Text className="font-title text-[#1e293b] text-[16px] mb-[15px]">Auditoria de Conversões</Text>
              <View className="gap-[15px]">
                {loading ? <ActivityIndicator color="#1e1b4b" /> : (followups.length > 0 ? followups.slice(0, 10).map((item, index) => (
                  <View key={item.id || index} className="border border-[#e2e8f0] rounded-[12px] p-[15px]">
                    <View className="flex-row justify-between items-start mb-[10px]">
                      <View>
                        <Text className="font-title text-[#333] text-[14px]">Paciente: {item.patientName || 'Anônimo'}</Text>
                        <Text className="font-sans text-[#666] text-[12px]">Wpp clicado em {item.date ? new Date(item.date).toLocaleDateString('pt-BR') : 'N/D'}</Text>
                      </View>
                      <View className="bg-[#dcfce7] px-[8px] py-[4px] rounded-[6px]">
                        <Text className="text-[#166534] font-bold text-[10px] uppercase">{item.status === 'completed' ? 'Negócio Fechado' : 'Em Progresso'}</Text>
                      </View>
                    </View>
                    <Text className="font-sans text-[#333] text-[12px]"><Text className="font-bold">Psicólogo(a):</Text> {item.psychologistName || 'Desconhecido'}</Text>
                  </View>
                )) : <Text className="font-sans text-[#64748b]">Nenhum clique Wpp recente.</Text>)}
              </View>
            </View>
          </View>
        )}

        {/* CONTEÚDO DA ABA: RANKING */}
        {activeTab === 'ranking' && (
          <View>
            <View className="bg-white rounded-[16px] p-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] mb-[20px] border border-[#f0f0f0]">
              <Text className="font-title text-[#1e293b] text-[16px] mb-[15px]">Top 3 Profissionais na Busca</Text>
              <View className="gap-[15px]">
                {loading ? <ActivityIndicator color="#1e1b4b" /> : (ranking.length > 0 ? ranking.slice(0, 10).map((item, index) => (
                  <View key={item.psychologistId || index} className="flex-row items-center border border-[#e2e8f0] rounded-[12px] p-[12px]">
                    <View className="w-[30px] h-[30px] bg-[#fef3c7] rounded-full items-center justify-center mr-[12px]">
                      <Text className="font-title text-[#d97706] text-[14px]">{index + 1}º</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="font-title text-[#333] text-[14px]">{item.Psychologist?.nome || 'Dr(a). Não identificado'}</Text>
                      <Text className="font-sans text-[#666] text-[12px]">{item.total_cliques} conversões (Wpp)</Text>
                    </View>
                  </View>
                )) : <Text className="font-sans text-[#64748b]">Nenhum dado de ranking disponível.</Text>)}
              </View>
            </View>
          </View>
        )}

        <View className="h-[120px]" />
      </ScrollView>
    </View>
  );
}
