import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../../services/api';

export default function ReceitaScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'desempenho' | 'financeiro'>('desempenho');
  const [financials, setFinancials] = useState<any>({ kpis: {}, recentInvoices: [], activePlans: [] });
  const [analytics, setAnalytics] = useState<any>({ patientAnalytics: { total: 0 }, psiAnalytics: { total: 0 } });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resFin, resCharts] = await Promise.all([
        api.get('/api/admin/financials').catch(() => ({ data: {} })),
        api.get('/api/admin/reports/charts').catch(() => ({ data: {} })),
      ]);

      setFinancials(resFin.data || { kpis: {}, recentInvoices: [], activePlans: [] });
      setAnalytics(resCharts.data || {});
      setOfflineMode(false);
    } catch (error) {
      setOfflineMode(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
  };

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
            borderColor: '#e2e8f0',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 10,
            elevation: 3,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <TouchableOpacity
              onPress={() => router.push('/(admin)/crm')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
              }}
              activeOpacity={0.8}
            >
              <Feather name="arrow-left" size={14} color="#ffffff" />
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#ffffff' }}>
                CRM Hub
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleRefresh}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: '#ffffff',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
              }}
              activeOpacity={0.8}
            >
              <Feather name="refresh-cw" size={12} color="#1B4332" />
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#1B4332' }}>
                Atualizar
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 22, color: '#ffffff', marginTop: 8 }}>
            Inteligência & Receita 💰
          </Text>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: '#e2e8f0', marginTop: 4, lineHeight: 18 }}>
            Visão consolidada de tráfego, uso da plataforma, retenção e saúde financeira.
          </Text>
        </View>

        {/* Abas em Pílula */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: '#ffffff',
            borderRadius: 999,
            padding: 4,
            marginBottom: 18,
            borderWidth: 1,
            borderColor: '#e2e8f0',
          }}
        >
          <TouchableOpacity
            onPress={() => setActiveTab('desempenho')}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: 999,
              backgroundColor: activeTab === 'desempenho' ? '#1B4332' : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            activeOpacity={0.8}
          >
            <Text
              style={{
                fontFamily: activeTab === 'desempenho' ? 'Inter_700Bold' : 'Inter_500Medium',
                fontSize: 12,
                color: activeTab === 'desempenho' ? '#ffffff' : '#64748b',
              }}
            >
              📈 Desempenho & Uso
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('financeiro')}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: 999,
              backgroundColor: activeTab === 'financeiro' ? '#1B4332' : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            activeOpacity={0.8}
          >
            <Text
              style={{
                fontFamily: activeTab === 'financeiro' ? 'Inter_700Bold' : 'Inter_500Medium',
                fontSize: 12,
                color: activeTab === 'financeiro' ? '#ffffff' : '#64748b',
              }}
            >
              💰 Receita & Planos
            </Text>
          </TouchableOpacity>
        </View>

        {/* CONTEÚDO DA ABA: DESEMPENHO E USO */}
        {activeTab === 'desempenho' && (
          <View style={{ gap: 14 }}>
            {/* Grid de Métricas Principais */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <View
                style={{
                  flex: 1,
                  minWidth: '47%',
                  backgroundColor: '#ffffff',
                  padding: 16,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                }}
              >
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10.5, color: '#166534', textTransform: 'uppercase' }}>
                  Quest. Concluídos
                </Text>
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 22, color: '#166534', marginTop: 4 }}>
                  {analytics.demand
                    ? analytics.demand.reduce((acc: number, curr: any) => acc + (parseInt(curr.concluidos) || 0), 0)
                    : 0}
                </Text>
              </View>

              <View
                style={{
                  flex: 1,
                  minWidth: '47%',
                  backgroundColor: '#ffffff',
                  padding: 16,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                }}
              >
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10.5, color: '#b91c1c', textTransform: 'uppercase' }}>
                  Quest. Abandonados
                </Text>
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 22, color: '#b91c1c', marginTop: 4 }}>
                  {analytics.demand
                    ? analytics.demand.reduce((acc: number, curr: any) => acc + (parseInt(curr.desistencias) || 0), 0)
                    : 0}
                </Text>
              </View>

              <View
                style={{
                  flex: 1,
                  minWidth: '47%',
                  backgroundColor: '#ffffff',
                  padding: 16,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                }}
              >
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10.5, color: '#0284c7', textTransform: 'uppercase' }}>
                  Cliques Wpp (Psis)
                </Text>
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 22, color: '#0284c7', marginTop: 4 }}>
                  {analytics.whatsappClicks || 0}
                </Text>
              </View>

              <View
                style={{
                  flex: 1,
                  minWidth: '47%',
                  backgroundColor: '#ffffff',
                  padding: 16,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                }}
              >
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10.5, color: '#475569', textTransform: 'uppercase' }}>
                  Acessos ao Site
                </Text>
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 22, color: '#1e293b', marginTop: 4 }}>
                  {analytics.visits
                    ? analytics.visits.reduce((acc: number, curr: any) => acc + (parseInt(curr.total) || 0), 0)
                    : 0}
                </Text>
              </View>
            </View>

            {/* Ranking de Abandono */}
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 20,
                padding: 18,
                borderWidth: 1,
                borderColor: '#e2e8f0',
              }}
            >
              <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#b91c1c', marginBottom: 2 }}>
                Ranking de Abandono
              </Text>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                Onde os usuários mais desistem do questionário?
              </Text>

              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#1e293b' }}>
                    Pergunta 3 (Motivo da Busca)
                  </Text>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: '#ef4444' }}>
                    60% drop
                  </Text>
                </View>
                <View style={{ height: 6, backgroundColor: '#fef2f2', borderRadius: 999, overflow: 'hidden' }}>
                  <View style={{ height: '100%', width: '60%', backgroundColor: '#ef4444', borderRadius: 999 }} />
                </View>
              </View>
            </View>

            {/* Origens de Tráfego (UTMs) */}
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 20,
                padding: 18,
                borderWidth: 1,
                borderColor: '#e2e8f0',
              }}
            >
              <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#1B4332', marginBottom: 12 }}>
                Origens de Tráfego (UTMs)
              </Text>
              <View style={{ gap: 8 }}>
                {['Instagram Ads', 'Google Search', 'TikTok Orgânico'].map((utm, index) => (
                  <View
                    key={index}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: 8,
                      borderBottomWidth: index < 2 ? 1 : 0,
                      borderBottomColor: '#f1f5f9',
                    }}
                  >
                    <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: '#334155' }}>{utm}</Text>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: '#1B4332' }}>
                      {300 - index * 50}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Uso de Recursos (App) */}
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 20,
                padding: 18,
                borderWidth: 1,
                borderColor: '#e2e8f0',
              }}
            >
              <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#0284c7', marginBottom: 12 }}>
                Uso de Recursos (App)
              </Text>
              <View style={{ gap: 8 }}>
                {['Fórum Acessado', 'Artigo Lido', 'Agendamento'].map((uso, index) => (
                  <View
                    key={index}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: 8,
                      borderBottomWidth: index < 2 ? 1 : 0,
                      borderBottomColor: '#f1f5f9',
                    }}
                  >
                    <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: '#334155' }}>{uso}</Text>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: '#0284c7' }}>
                      {120 - index * 20}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* CONTEÚDO DA ABA: FINANCEIRO */}
        {activeTab === 'financeiro' && (
          <View style={{ gap: 14 }}>
            {/* Grid Financeiro */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <View
                style={{
                  flex: 1,
                  minWidth: '47%',
                  backgroundColor: '#ffffff',
                  padding: 16,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                }}
              >
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10.5, color: '#166534', textTransform: 'uppercase' }}>
                  MRR (Receita/mês)
                </Text>
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 20, color: '#166534', marginTop: 4 }}>
                  R$ {financials.kpis?.mrr?.toFixed(2) || '0.00'}
                </Text>
              </View>

              <View
                style={{
                  flex: 1,
                  minWidth: '47%',
                  backgroundColor: '#ffffff',
                  padding: 16,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                }}
              >
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10.5, color: '#b91c1c', textTransform: 'uppercase' }}>
                  Churn Rate
                </Text>
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 20, color: '#b91c1c', marginTop: 4 }}>
                  {financials.kpis?.churnRate || '0.0'}%
                </Text>
              </View>

              <View
                style={{
                  flex: 1,
                  minWidth: '47%',
                  backgroundColor: '#ffffff',
                  padding: 16,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                }}
              >
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10.5, color: '#0284c7', textTransform: 'uppercase' }}>
                  LTV (Life Time)
                </Text>
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 20, color: '#0284c7', marginTop: 4 }}>
                  R$ {financials.kpis?.ltv?.toFixed(2) || '0.00'}
                </Text>
              </View>

              <View
                style={{
                  flex: 1,
                  minWidth: '47%',
                  backgroundColor: '#ffffff',
                  padding: 16,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                }}
              >
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10.5, color: '#b45309', textTransform: 'uppercase' }}>
                  Ticket Médio
                </Text>
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 20, color: '#b45309', marginTop: 4 }}>
                  R$ {financials.kpis?.arpu?.toFixed(2) || '0.00'}
                </Text>
              </View>
            </View>

            {/* Faturas Recentes */}
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 20,
                padding: 18,
                borderWidth: 1,
                borderColor: '#e2e8f0',
              }}
            >
              <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#1e293b', marginBottom: 12 }}>
                Faturas Recentes
              </Text>
              <View style={{ gap: 10 }}>
                {loading ? (
                  <ActivityIndicator color="#1B4332" />
                ) : (financials.recentInvoices || []).slice(0, 3).map((item: any, i: number) => (
                  <View
                    key={item.id || i}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: '#e2e8f0',
                      borderRadius: 14,
                      padding: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        backgroundColor: '#ecfdf5',
                        borderRadius: 999,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 10,
                      }}
                    >
                      <Feather name="check" size={16} color="#10b981" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: 'Inter_700Bold', color: '#1e293b', fontSize: 13 }}>
                        {item.psychologistName || 'Psicólogo'}
                      </Text>
                      <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 11.5 }}>
                        R$ {item.amount?.toFixed(2) || '0.00'} • {item.status}
                      </Text>
                    </View>
                    <Text style={{ fontFamily: 'Inter_500Medium', color: '#94a3b8', fontSize: 11 }}>
                      {item.date ? new Date(item.date).toLocaleDateString('pt-BR') : ''}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Planos Ativos Resumo */}
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 20,
                padding: 18,
                borderWidth: 1,
                borderColor: '#e2e8f0',
              }}
            >
              <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#1e293b', marginBottom: 12 }}>
                Planos Ativos (Resumo)
              </Text>
              <View style={{ gap: 10 }}>
                {loading ? (
                  <ActivityIndicator color="#1B4332" />
                ) : (financials.activePlans || []).slice(0, 3).map((item: any, i: number) => (
                  <View
                    key={`plano-${i}`}
                    style={{
                      borderWidth: 1,
                      borderColor: '#e2e8f0',
                      borderRadius: 14,
                      padding: 12,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={{ fontFamily: 'Inter_700Bold', color: '#1e293b', fontSize: 13 }}>
                        {item.psychologistName || 'Psicólogo'}
                      </Text>
                      <View style={{ backgroundColor: '#e0f2fe', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                        <Text style={{ color: '#0369a1', fontFamily: 'Inter_700Bold', fontSize: 10, textTransform: 'uppercase' }}>
                          {item.planName || 'N/D'}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
                      <Text style={{ fontFamily: 'Inter_500Medium', color: '#64748b', fontSize: 11.5 }}>
                        MRR: R$ {item.mrr?.toFixed(2) || '0.00'}
                      </Text>
                      <Text style={{ fontFamily: 'Inter_400Regular', color: '#94a3b8', fontSize: 11 }}>
                        Vence: {item.nextBilling ? new Date(item.nextBilling).toLocaleDateString('pt-BR') : 'N/D'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
