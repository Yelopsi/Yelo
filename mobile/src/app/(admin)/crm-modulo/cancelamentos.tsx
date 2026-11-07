import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../../services/api';
import NativeSelectMenu from '../../../components/NativeSelectMenu';

export default function CancelamentosScreen() {
  const router = useRouter();
  const [filterReason, setFilterReason] = useState('Todos');
  const [surveys, setSurveys] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ total: 0, media: 0, topReason: '-' });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);

  const fetchSurveys = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterReason !== 'Todos') {
        params.motivo = filterReason;
      }
      
      const response = await api.get('/api/admin/exit-surveys', { params });
      setSurveys(response.data.list || []);
      setStats(response.data.stats || { total: 0, media: 0, topReason: '-' });
      setOfflineMode(false);
    } catch (error) {
      setOfflineMode(true);
      setSurveys([]);
      setStats({ total: 0, media: 0, topReason: '-' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const delay = setTimeout(() => {
      fetchSurveys();
    }, 200);
    return () => clearTimeout(delay);
  }, [filterReason]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSurveys();
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
                Retenção e Saídas 📉
              </Text>
              <Text style={{ fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 }}>
                Feedbacks de cancelamento e motivos de churn para análise de retenção.
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

        {/* KPIs Uniformes sem bordas vazando */}
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
                Total de Saídas
              </Text>
              <View style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="user-minus" size={14} color="#475569" />
              </View>
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 24 }}>{stats.total}</Text>
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
                Nota Média na Saída
              </Text>
              <View style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="star" size={14} color="#ef4444" />
              </View>
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#ef4444', fontSize: 24 }}>{stats.media}</Text>
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
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#64748b', fontSize: 11, textTransform: 'uppercase', marginBottom: 4 }}>
                Principal Motivo
              </Text>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 20, textTransform: 'capitalize' }}>
                {stats.topReason || 'N/A'}
              </Text>
            </View>
            <View style={{ width: 36, height: 36, borderRadius: 999, backgroundColor: '#e8f5e9', alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="pie-chart" size={18} color="#1B4332" />
            </View>
          </View>
        </View>

        <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 16, marginBottom: 12 }}>
          Histórico de Feedbacks
        </Text>

        {/* Filtro via Dropdown Nativo */}
        <View style={{ marginBottom: 16 }}>
          <NativeSelectMenu
            title="Filtrar Motivo de Cancelamento"
            options={[
              { label: 'Todos os Motivos', value: 'Todos' },
              { label: 'Motivo Financeiro', value: 'Financeiro' },
              { label: 'Dificuldades na Plataforma', value: 'Plataforma' },
              { label: 'Atendimento / Suporte', value: 'Suporte' },
              { label: 'Baixa Demanda de Pacientes', value: 'Baixa Demanda' },
            ]}
            selectedValue={filterReason}
            onSelect={(val) => setFilterReason(val)}
            style={{ width: '100%' }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#ffffff',
                borderWidth: 1,
                borderColor: '#e2e8f0',
                borderRadius: 999,
                paddingHorizontal: 16,
                paddingVertical: 10,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.03,
                shadowRadius: 3,
                elevation: 1,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Feather name="filter" size={15} color="#1B4332" />
                <Text style={{ fontFamily: 'Inter_500Medium', color: '#64748b', fontSize: 12 }}>
                  Motivo:
                </Text>
                <Text
                  style={{
                    fontFamily: 'Inter_700Bold',
                    color: '#1B4332',
                    fontSize: 13,
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  {filterReason === 'Todos' ? 'Todos os Motivos' : filterReason}
                </Text>
              </View>
              <Feather name="chevron-down" size={16} color="#1B4332" />
            </View>
          </NativeSelectMenu>
        </View>

        {/* Lista de Saídas */}
        <View style={{ gap: 12 }}>
          {loading ? (
            <ActivityIndicator color="#1B4332" style={{ marginVertical: 30 }} />
          ) : surveys.length === 0 ? (
            <View style={{ backgroundColor: '#ffffff', borderRadius: 20, padding: 30, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' }}>
              <Text style={{ fontSize: 24, marginBottom: 6 }}>🛡️</Text>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 16 }}>Nenhum cancelamento encontrado</Text>
              <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 12, marginTop: 4 }}>
                Nenhum feedback registrado para o filtro aplicado.
              </Text>
            </View>
          ) : (
            surveys.map((survey, index) => (
              <View
                key={survey.id || index}
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
                        width: 36,
                        height: 36,
                        borderRadius: 999,
                        backgroundColor: '#fef2f2',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: '#fecaca',
                      }}
                    >
                      <Feather name="user-x" size={16} color="#ef4444" />
                    </View>
                    <View>
                      <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 15 }}>
                        Psicólogo #{survey.psychologistId || survey.PsychologistId || '?'}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                        <Feather name="star" size={13} color="#f59e0b" style={{ marginRight: 2 }} />
                        <Text style={{ fontFamily: 'Inter_700Bold', color: '#f59e0b', fontSize: 12 }}>
                          {survey.avaliacao || 0}
                        </Text>
                        <Text style={{ fontFamily: 'Inter_400Regular', color: '#cbd5e1', marginHorizontal: 6 }}>•</Text>
                        <Text style={{ fontFamily: 'Inter_400Regular', color: '#94a3b8', fontSize: 11 }}>
                          {survey.createdAt ? new Date(survey.createdAt).toLocaleDateString('pt-BR') : ''}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', color: '#ef4444', fontSize: 10, textTransform: 'uppercase' }}>
                      {survey.motivo || 'N/A'}
                    </Text>
                  </View>
                </View>

                <Text style={{ fontFamily: 'Inter_400Regular', color: '#475569', fontSize: 13, lineHeight: 19, fontStyle: 'italic', marginBottom: 14 }}>
                  "{survey.detalhe || 'Sem detalhes fornecidos.'}"
                </Text>

                <View style={{ paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
                  <TouchableOpacity
                    onPress={() => Alert.alert('WhatsApp', 'Iniciando contato para acolhimento e retenção...')}
                    style={{
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
                    <Feather name="message-circle" size={14} color="#16a34a" />
                    <Text style={{ fontFamily: 'Inter_700Bold', color: '#16a34a', fontSize: 12 }}>
                      Tentar Retenção (WhatsApp)
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
