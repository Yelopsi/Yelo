import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import api from '../../../services/api';
import NativeSelectMenu from '../../../components/NativeSelectMenu';

export default function CancelamentosScreen() {
  const [filterReason, setFilterReason] = useState('Todos');
  const [surveys, setSurveys] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ total: 0, media: 0, topReason: '-' });
  const [loading, setLoading] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);

  useEffect(() => {
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
      }
    };
    
    // Debounce to allow user to tap filter quickly
    const delay = setTimeout(() => {
      fetchSurveys();
    }, 200);
    return () => clearTimeout(delay);
  }, [filterReason]);

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
          <Text className="font-title text-[#1e1b4b] text-[24px]">Retenção e Saídas</Text>
          <Text className="font-sans text-[#666] text-[14px]">Gerencie os feedbacks enviados pelos profissionais ao cancelar a assinatura.</Text>
        </View>

        {/* KPIs */}
        <View className="flex-row flex-wrap justify-between gap-y-[15px] mb-[25px]">
          <View className="w-[48%] bg-white p-[15px] rounded-[12px] border-t-4 border-[#333] shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
            <Text className="font-sans text-[#64748b] text-[11px] mb-[5px]">Total de Saídas</Text>
            <Text className="font-title text-[#333] text-[20px]">{stats.total}</Text>
          </View>
          
          <View className="w-[48%] bg-white p-[15px] rounded-[12px] border-t-4 border-[#E63946] shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
            <Text className="font-sans text-[#64748b] text-[11px] mb-[5px]">Nota Média na Saída</Text>
            <Text className="font-title text-[#E63946] text-[20px]">{stats.media}</Text>
          </View>

          <View className="w-full bg-white p-[15px] rounded-[12px] border-t-4 border-[#1B4332] shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
            <Text className="font-sans text-[#64748b] text-[11px] mb-[5px]">Principal Motivo</Text>
            <Text className="font-title text-[#1B4332] text-[18px] capitalize">{stats.topReason || 'N/A'}</Text>
          </View>
        </View>

        <Text className="font-title text-[#1e293b] text-[18px] mb-[15px]">Histórico de Feedbacks</Text>

        {/* Filtro via Dropdown */}
        <View className="mb-[15px]">
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

        {/* Lista de Churns */}
        <View className="gap-[15px]">
          {loading ? <ActivityIndicator color="#1e1b4b" /> : surveys.map((survey, index) => (
            <View key={survey.id || index} className="bg-white rounded-[16px] p-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-[#f0f0f0]">
              <View className="flex-row justify-between items-start mb-[10px]">
                <View>
                  <Text className="font-title text-[#333] text-[16px]">Psicólogo (ID: {survey.psychologistId || survey.PsychologistId || '?'})</Text>
                  <View className="flex-row items-center mt-[4px]">
                    <Feather name="star" size={14} color="#f59e0b" style={{marginRight: 2}} />
                    <Text className="font-sans text-[#f59e0b] font-bold text-[12px] ml-[2px]">{survey.avaliacao || 0}</Text>
                    <Text className="font-sans text-[#cbd5e1] mx-[6px]">|</Text>
                    <Text className="font-sans text-[#64748b] text-[11px]">
                      {survey.createdAt ? new Date(survey.createdAt).toLocaleDateString('pt-BR') : ''}
                    </Text>
                  </View>
                </View>
                
                <View className="bg-[#fee2e2] px-[10px] py-[4px] rounded-[6px]">
                  <Text className="font-sans text-[#ef4444] font-bold text-[10px] uppercase">{survey.motivo || 'N/A'}</Text>
                </View>
              </View>
              
              <Text className="font-sans text-[#475569] text-[14px] leading-[20px] italic mb-[15px]">
                "{survey.detalhe || 'Sem detalhes fornecidos.'}"
              </Text>

              <View className="flex-row gap-[10px] pt-[15px] border-t border-[#f1f5f9]">
                <TouchableOpacity onPress={() => Alert.alert('Wpp', 'Entrando em contato para retenção...')} className="flex-1 bg-[#f0fdf4] border border-[#bbf7d0] py-[8px] rounded-[8px] flex-row items-center justify-center">
                  <Feather name="message-circle" size={14} color="#16a34a" />
                  <Text className="text-[#16a34a] font-sans font-bold text-[12px] ml-[5px]">Tentar Retenção (Wpp)</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        <View className="h-[120px]" />
      </ScrollView>
    </View>
  );
}
