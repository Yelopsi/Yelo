import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import api from '../../../services/api';

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
        setSurveys([
          { id: 1, psychologistId: 10, avaliacao: 3, motivo: 'Financeiro', detalhe: 'Não consigo pagar agora.', createdAt: new Date().toISOString() },
          { id: 2, psychologistId: 11, avaliacao: 2, motivo: 'Plataforma', detalhe: 'Achei confuso.', createdAt: new Date().toISOString() }
        ]);
        setStats({ total: 2, media: 2.5, topReason: 'Financeiro' });
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

        {/* Filtros */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-[15px] max-h-[40px]">
          <View className="flex-row gap-[10px]">
            {['Todos', 'Financeiro', 'Plataforma', 'Suporte', 'Baixa Demanda'].map((f) => (
              <TouchableOpacity 
                key={f}
                onPress={() => setFilterReason(f)}
                className={`px-[16px] h-[34px] justify-center rounded-full border ${filterReason === f ? 'bg-[#1e1b4b] border-[#1e1b4b]' : 'bg-white border-[#e2e8f0]'}`}
              >
                <Text className={`font-sans text-[12px] ${filterReason === f ? 'text-white font-bold' : 'text-[#64748b]'}`}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

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
