import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import api from '../../../services/api';

export default function ReceitaScreen() {
  const [activeTab, setActiveTab] = useState('desempenho');
  const [financials, setFinancials] = useState<any>({ kpis: {}, recentInvoices: [], activePlans: [] });
  const [analytics, setAnalytics] = useState<any>({ patientAnalytics: { total: 0 }, psiAnalytics: { total: 0 } });
  const [loading, setLoading] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [resFin, resCharts] = await Promise.all([
          api.get('/api/admin/financials').catch(() => ({ data: {} })),
          api.get('/api/admin/reports/charts').catch(() => ({ data: {} }))
        ]);
        
        setFinancials(resFin.data || { kpis: {}, recentInvoices: [], activePlans: [] });
        setAnalytics(resCharts.data || {});
        setOfflineMode(false);
      } catch (error) {
        setOfflineMode(true);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {offlineMode && (
          <View className="bg-[#fef3c7] p-[12px] rounded-[12px] mb-[15px] border border-[#fde68a] flex-row items-center">
            <Feather name="wifi-off" size={16} color="#d97706" style={{ marginRight: 10 }} />
            <Text className="font-sans text-[#b45309] text-[12px] flex-1">
              Modo Offline ativado (ou dados ausentes).
            </Text>
          </View>
        )}

        {/* Header Descritivo */}
        <View className="mb-[20px]">
          <Text className="font-title text-[#1e1b4b] text-[24px]">Inteligência e Analytics</Text>
          <Text className="font-sans text-[#666] text-[14px]">Visão consolidada de tráfego, uso da plataforma e financeiro.</Text>
        </View>

        {/* Abas */}
        <View className="flex-row gap-[10px] mb-[20px]">
          <TouchableOpacity 
            onPress={() => setActiveTab('desempenho')}
            className={`flex-1 items-center justify-center py-[10px] rounded-[12px] ${activeTab === 'desempenho' ? 'bg-[#1e1b4b]' : 'bg-white border border-[#e2e8f0]'}`}
          >
            <Text className={`font-sans font-bold text-[12px] ${activeTab === 'desempenho' ? 'text-white' : 'text-[#64748b]'}`}>📈 Desempenho e Uso</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={() => setActiveTab('financeiro')}
            className={`flex-1 items-center justify-center py-[10px] rounded-[12px] ${activeTab === 'financeiro' ? 'bg-[#1e1b4b]' : 'bg-white border border-[#e2e8f0]'}`}
          >
            <Text className={`font-sans font-bold text-[12px] ${activeTab === 'financeiro' ? 'text-white' : 'text-[#64748b]'}`}>💰 Receita e Assinaturas</Text>
          </TouchableOpacity>
        </View>

        {/* CONTEÚDO DA ABA: DESEMPENHO E USO */}
        {activeTab === 'desempenho' && (
          <View>
            <View className="flex-row flex-wrap justify-between gap-y-[15px]">
              <View className="w-[48%] bg-white p-[15px] rounded-[12px] border-l-4 border-[#2E7D32] shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
                <Text className="font-sans text-[#64748b] text-[11px] mb-[5px]">Quest. Concluídos</Text>
                <Text className="font-title text-[#2E7D32] text-[22px]">
                  {analytics.demand ? analytics.demand.reduce((acc: number, curr: any) => acc + (parseInt(curr.concluidos) || 0), 0) : 0}
                </Text>
              </View>
              
              <View className="w-[48%] bg-white p-[15px] rounded-[12px] border-l-4 border-[#e74c3c] shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
                <Text className="font-sans text-[#64748b] text-[11px] mb-[5px]">Quest. Abandonados</Text>
                <Text className="font-title text-[#e74c3c] text-[22px]">
                  {analytics.demand ? analytics.demand.reduce((acc: number, curr: any) => acc + (parseInt(curr.desistencias) || 0), 0) : 0}
                </Text>
              </View>

              <View className="w-[48%] bg-white p-[15px] rounded-[12px] border-l-4 border-[#3b82f6] shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
                <Text className="font-sans text-[#64748b] text-[11px] mb-[5px]">Cliques Wpp (Psis)</Text>
                <Text className="font-title text-[#3b82f6] text-[22px]">{analytics.whatsappClicks || 0}</Text>
              </View>

              <View className="w-[48%] bg-white p-[15px] rounded-[12px] border-l-4 border-[#2c3e50] shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
                <Text className="font-sans text-[#64748b] text-[11px] mb-[5px]">Acessos ao Site</Text>
                <Text className="font-title text-[#2c3e50] text-[22px]">
                  {analytics.visits ? analytics.visits.reduce((acc: number, curr: any) => acc + (parseInt(curr.total) || 0), 0) : 0}
                </Text>
              </View>
            </View>

            {/* Tracking Drop-offs */}
            <View className="bg-white rounded-[16px] p-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] mt-[20px] border border-[#f0f0f0]">
              <Text className="font-title text-[#e74c3c] text-[16px] mb-[5px]">Ranking de Abandono</Text>
              <Text className="font-sans text-[#666] text-[12px] mb-[15px]">Onde os usuários mais desistem?</Text>
              
              <View className="gap-[10px]">
                <View className="flex-row items-center justify-between">
                  <Text className="font-sans text-[#333] text-[14px]">Pergunta 3 (Motivo)</Text>
                  <Text className="font-sans text-[#ef4444] text-[14px] font-bold">60% drop</Text>
                </View>
                <View className="h-[4px] bg-[#fef2f2] w-full rounded-full"><View className="h-full bg-[#ef4444] w-[60%] rounded-full"/></View>
              </View>
            </View>

            {/* Tracking UTMs e Uso */}
            <View className="bg-white rounded-[16px] p-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] mt-[20px] border border-[#f0f0f0]">
              <Text className="font-title text-[#1B4332] text-[16px] mb-[15px]">Origens de Tráfego (UTMs)</Text>
              <View className="gap-[10px]">
                {['Instagram Ads', 'Google Search', 'TikTok Orgânico'].map((utm, index) => (
                  <View key={index} className="flex-row items-center justify-between border-b border-[#f1f5f9] pb-[10px]">
                    <Text className="font-sans text-[#333] text-[14px]">{utm}</Text>
                    <Text className="font-title text-[#1B4332] text-[14px]">{300 - index * 50}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View className="bg-white rounded-[16px] p-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] mt-[20px] border border-[#f0f0f0]">
              <Text className="font-title text-[#0284C7] text-[16px] mb-[15px]">Uso de Recursos (App)</Text>
              <View className="gap-[10px]">
                {['Fórum Acessado', 'Artigo Lido', 'Agendamento'].map((uso, index) => (
                  <View key={index} className="flex-row items-center justify-between border-b border-[#f1f5f9] pb-[10px]">
                    <Text className="font-sans text-[#333] text-[14px]">{uso}</Text>
                    <Text className="font-title text-[#0284C7] text-[14px]">{120 - index * 20}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* CONTEÚDO DA ABA: FINANCEIRO */}
        {activeTab === 'financeiro' && (
          <View>
            <View className="flex-row flex-wrap justify-between gap-y-[15px] mb-[25px]">
              <View className="w-[48%] bg-white p-[15px] rounded-[12px] border-t-4 border-[#10b981] shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
                <Text className="font-sans text-[#64748b] text-[11px] mb-[5px]">MRR (Receita/mês)</Text>
                <Text className="font-title text-[#10b981] text-[18px]">R$ {financials.kpis?.mrr?.toFixed(2) || '0.00'}</Text>
              </View>
              
              <View className="w-[48%] bg-white p-[15px] rounded-[12px] border-t-4 border-[#ef4444] shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
                <Text className="font-sans text-[#64748b] text-[11px] mb-[5px]">Churn Rate</Text>
                <Text className="font-title text-[#ef4444] text-[18px]">{financials.kpis?.churnRate || '0.0'}%</Text>
              </View>

              <View className="w-[48%] bg-white p-[15px] rounded-[12px] border-t-4 border-[#3b82f6] shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
                <Text className="font-sans text-[#64748b] text-[11px] mb-[5px]">LTV (Life Time)</Text>
                <Text className="font-title text-[#3b82f6] text-[18px]">R$ {financials.kpis?.ltv?.toFixed(2) || '0.00'}</Text>
              </View>

              <View className="w-[48%] bg-white p-[15px] rounded-[12px] border-t-4 border-[#f59e0b] shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
                <Text className="font-sans text-[#64748b] text-[11px] mb-[5px]">Ticket Médio</Text>
                <Text className="font-title text-[#f59e0b] text-[18px]">R$ {financials.kpis?.arpu?.toFixed(2) || '0.00'}</Text>
              </View>
            </View>

            <View className="bg-white rounded-[16px] p-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] mb-[20px] border border-[#f0f0f0]">
              <Text className="font-title text-[#1e293b] text-[16px] mb-[15px]">Faturas Recentes</Text>
              <View className="gap-[10px]">
                {loading ? <ActivityIndicator color="#1e1b4b" /> : (financials.recentInvoices || []).slice(0, 3).map((item: any, i: number) => (
                  <View key={item.id || i} className="flex-row items-center border border-[#e2e8f0] rounded-[12px] p-[12px]">
                    <View className="w-[40px] h-[40px] bg-[#ecfdf5] rounded-full items-center justify-center mr-[12px]">
                      <Feather name="check" size={16} color="#10b981" />
                    </View>
                    <View className="flex-1">
                      <Text className="font-title text-[#333] text-[14px]">{item.psychologistName || 'Psicólogo'}</Text>
                      <Text className="font-sans text-[#666] text-[12px]">R$ {item.amount?.toFixed(2) || '0.00'} - {item.status}</Text>
                    </View>
                    <Text className="font-sans text-[#64748b] text-[11px]">
                      {item.date ? new Date(item.date).toLocaleDateString('pt-BR') : ''}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Planos Ativos Resumo */}
            <View className="bg-white rounded-[16px] p-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] mb-[20px] border border-[#f0f0f0]">
              <Text className="font-title text-[#1e293b] text-[16px] mb-[15px]">Planos Ativos (Resumo)</Text>
              <View className="gap-[10px]">
                {loading ? <ActivityIndicator color="#1e1b4b" /> : (financials.activePlans || []).slice(0, 3).map((item: any, i: number) => (
                  <View key={`plano-${i}`} className="border border-[#e2e8f0] rounded-[12px] p-[12px]">
                    <View className="flex-row justify-between items-start mb-[5px]">
                      <Text className="font-title text-[#333] text-[14px]">{item.psychologistName || 'Psicólogo'}</Text>
                      <View className="bg-[#eff6ff] px-[8px] py-[4px] rounded-[6px]">
                        <Text className="text-[#2563eb] font-sans font-bold text-[10px] uppercase">{item.planName || 'N/D'}</Text>
                      </View>
                    </View>
                    <View className="flex-row justify-between items-center mt-[10px] pt-[10px] border-t border-[#f1f5f9]">
                      <Text className="font-sans text-[#666] text-[12px]">MRR: R$ {item.mrr?.toFixed(2) || '0.00'}</Text>
                      <Text className="font-sans text-[#64748b] text-[12px]">Vence: {item.nextBilling ? new Date(item.nextBilling).toLocaleDateString('pt-BR') : 'N/D'}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        <View className="h-[120px]" />
      </ScrollView>
    </View>
  );
}
