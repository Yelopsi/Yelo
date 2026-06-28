import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import api from '../../services/api';

const fallbackStats = {
  mrr: 42500,
  newPatients: 145,
  newPsychologists: 32,
  questionnairesToday: 18,
  patients: { total: 1205, active: 1100, deleted: 105 },
  psychologists: { total: 450, active: 400, deleted: 50, plans: { essencial: 100, clinico: 250, sol: 50 } },
  questionnaires: { total: 3200, deleted: 120 },
  conversionRate: 15.2,
  totalMatches: 4520,
  totalClicks: 890,
  waitingList: 12,
  pendingReviews: 5
};

export default function AdminVisaoGeralScreen() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);

  const fetchStats = async () => {
    try {
      setOfflineMode(false);
      // Chamada real para o seu backend Web!
      const response = await api.get('/api/admin/stats');
      setStats(response.data);
    } catch (error) {
      console.log('Erro ao buscar stats, entrando em modo offline', error);
      setOfflineMode(true);
      setStats(fallbackStats);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStats();
  }, []);

  // Formatador de Moeda (BR)
  const formatCurrency = (value: number) => {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (loading && !stats) {
    return (
      <View className="flex-1 justify-center items-center bg-[#f9fafb]">
        <ActivityIndicator size="large" color="#8b5cf6" />
        <Text className="mt-4 font-sans text-[#666]">Buscando dados em tempo real...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      className="flex-1 bg-[#f9fafb]" 
      contentContainerStyle={{ padding: 20 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8b5cf6" />
      }
    >
      {/* Banner de Modo Offline */}
      {offlineMode && (
        <View className="bg-[#fef3c7] p-[12px] rounded-[12px] mb-[15px] border border-[#fde68a] flex-row items-center">
          <Feather name="wifi-off" size={16} color="#d97706" style={{ marginRight: 10 }} />
          <Text className="font-sans text-[#b45309] text-[12px] flex-1">
            Modo Offline Ativo. Mostrando dados de demonstração.
          </Text>
        </View>
      )}

      {/* Hero Moderno */}
      <View className="bg-[#1e1b4b] rounded-[24px] p-[24px] mb-[20px] shadow-[0_4px_20px_rgba(30,27,75,0.15)] relative overflow-hidden">
        <View className="absolute top-[-20px] right-[-20px] w-[120px] h-[120px] bg-white/5 rounded-full" />
        <View className="absolute bottom-[-40px] right-[40px] w-[80px] h-[80px] bg-white/5 rounded-full" />

        <View className="flex-row justify-between items-start mb-[8px]">
          <View className="flex-1">
            <Text className="font-title text-white text-[26px] leading-[32px] mb-[4px]">
              Visão Geral da <Text className="text-[#8b5cf6]">Plataforma</Text>
            </Text>
            <Text className="font-sans text-white/90 text-[14px] leading-[20px] mb-[20px]">
              Acompanhe as métricas e o crescimento.
            </Text>
          </View>
          <TouchableOpacity onPress={onRefresh} className="bg-white/10 p-[8px] rounded-full flex-row items-center gap-[4px]">
            <Feather name="refresh-cw" size={14} color="white" />
            <Text className="text-white font-sans text-[12px] font-bold">Atualizar</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row justify-between bg-white/10 rounded-[16px] p-[15px] items-center mb-[10px]">
          <View>
            <Text className="text-white/70 font-sans text-[12px] uppercase tracking-wider mb-[4px]">Receita Recorrente (MRR)</Text>
            <Text className="text-white font-title text-[24px]">{formatCurrency(stats?.mrr || 0)}</Text>
          </View>
          <View className="w-[40px] h-[40px] bg-[#8b5cf6] rounded-full items-center justify-center">
            <Feather name="dollar-sign" size={20} color="white" />
          </View>
        </View>
      </View>

      {/* Grid de KPIs - Novas Contas e Hoje */}
      <View className="flex-row gap-[10px] mb-[10px]">
        <View className="flex-1 bg-white rounded-[16px] p-[15px] border-t-4 border-[#8b5cf6] shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
          <Text className="font-sans text-[#666] text-[12px] mb-[5px]">Novos Pacientes</Text>
          <Text className="font-title text-[#1e1b4b] text-[24px]">{stats?.newPatients30d || 0}</Text>
          <Text className="font-sans text-[#8b5cf6] text-[10px] mt-[2px]">(30 dias)</Text>
        </View>
        <View className="flex-1 bg-white rounded-[16px] p-[15px] border-t-4 border-[#0ea5e9] shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
          <Text className="font-sans text-[#666] text-[12px] mb-[5px]">Novos Psicólogos</Text>
          <Text className="font-title text-[#1e1b4b] text-[24px]">{stats?.newPsis30d || 0}</Text>
          <Text className="font-sans text-[#0ea5e9] text-[10px] mt-[2px]">(30 dias)</Text>
        </View>
        <View className="flex-1 bg-white rounded-[16px] p-[15px] border-t-4 border-[#22c55e] shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
          <Text className="font-sans text-[#666] text-[12px] mb-[5px]">Questionários</Text>
          <Text className="font-title text-[#1e1b4b] text-[24px]">{stats?.questToday || 0}</Text>
          <Text className="font-sans text-[#22c55e] text-[10px] mt-[2px]">(Hoje)</Text>
        </View>
      </View>

      {/* Alertas e Ações Rápidas */}
      <View className="bg-white rounded-[20px] p-[20px] mb-[20px] border border-[#f0f0f0] shadow-[0_4px_15px_rgba(0,0,0,0.02)]">
        <Text className="font-title text-[#1e1b4b] text-[18px] mb-[15px]">Alertas e Ações Rápidas</Text>
        
        <TouchableOpacity className="flex-row items-center bg-[#fef3c7] rounded-[12px] p-[12px] mb-[10px]">
          <Text className="text-[20px] mr-[12px]">⏳</Text>
          <View className="flex-1">
            <Text className="font-sans text-[#333] text-[14px]">
              <Text className="font-bold text-[#b45309]">{stats?.waitingListCount || 0} Candidatos</Text> na Lista de Espera.
            </Text>
            <Text className="font-sans text-[#b45309] font-bold text-[11px] mt-[2px]">Gerenciar agora</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity className="flex-row items-center bg-[#f3e8ff] rounded-[12px] p-[12px]">
          <Text className="text-[20px] mr-[12px]">⭐</Text>
          <View className="flex-1">
            <Text className="font-sans text-[#333] text-[14px]">
              <Text className="font-bold text-[#6d28d9]">{stats?.pendingReviewsCount || 0} Avaliações</Text> para Moderação.
            </Text>
            <Text className="font-sans text-[#6d28d9] font-bold text-[11px] mt-[2px]">Revisar agora</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Raio-X da Base */}
      <View className="bg-white rounded-[20px] p-[20px] mb-[20px] border border-[#f0f0f0] shadow-[0_4px_15px_rgba(0,0,0,0.02)]">
        <Text className="font-title text-[#1e1b4b] text-[18px] mb-[15px]">Raio-X da Base</Text>
        
        {/* Pacientes Ativos */}
        <View className="py-[12px] border-b border-[#f0f0f0]">
          <View className="flex-row justify-between items-center mb-[4px]">
            <Text className="font-sans font-bold text-[#333] text-[14px]">Pacientes Ativos</Text>
            <Text className="font-title text-[#1e1b4b] text-[18px]">{stats?.patients?.active || 0}</Text>
          </View>
          <Text className="font-sans text-[#666] text-[11px]">Total: <Text className="font-bold">{stats?.patients?.total || 0}</Text> | Excluídos: <Text className="text-red-500 font-bold">{stats?.patients?.deleted || 0}</Text></Text>
        </View>

        {/* Psicólogos Ativos */}
        <View className="py-[12px] border-b border-[#f0f0f0]">
          <View className="flex-row justify-between items-center mb-[4px]">
            <Text className="font-sans font-bold text-[#333] text-[14px]">Psicólogos Ativos</Text>
            <Text className="font-title text-[#1e1b4b] text-[18px]">{stats?.psychologists?.active || 0}</Text>
          </View>
          <Text className="font-sans text-[#666] text-[11px] mb-[2px]">Total: <Text className="font-bold">{stats?.psychologists?.total || 0}</Text> | Excluídos: <Text className="text-red-500 font-bold">{stats?.psychologists?.deleted || 0}</Text></Text>
          <Text className="font-sans text-[#888] text-[10px]">Essencial: {stats?.psychologists?.byPlan?.['Essencial'] || 0} | Clínico: {stats?.psychologists?.byPlan?.['Clínico'] || 0} | Ref: {stats?.psychologists?.byPlan?.['Sol'] || 0}</Text>
        </View>

        {/* Questionários Concluídos */}
        <View className="py-[12px] border-b border-[#f0f0f0]">
          <View className="flex-row justify-between items-center mb-[4px]">
            <Text className="font-sans font-bold text-[#333] text-[14px]">Questionários Concluídos</Text>
            <Text className="font-title text-[#1e1b4b] text-[18px]">{stats?.questionnaires?.total || 0}</Text>
          </View>
          <Text className="font-sans text-[#666] text-[11px]">Desistências: <Text className="text-red-500 font-bold">{stats?.questionnaires?.deleted || 0}</Text></Text>
        </View>

        {/* Métricas de Conversão */}
        <View className="flex-row mt-[12px] gap-[10px]">
          <View className="flex-1 bg-[#f9fafb] p-[10px] rounded-[10px] items-center">
            <Text className="font-title text-[#8b5cf6] text-[16px]">{stats?.overallConversionRate || 0}%</Text>
            <Text className="font-sans text-[#666] text-[9px] text-center mt-[2px]">Taxa Conversão</Text>
          </View>
          <View className="flex-1 bg-[#f9fafb] p-[10px] rounded-[10px] items-center">
            <Text className="font-title text-[#1e1b4b] text-[16px]">{stats?.totalMatches || 0}</Text>
            <Text className="font-sans text-[#666] text-[9px] text-center mt-[2px]">Aparições (Match)</Text>
          </View>
          <View className="flex-1 bg-[#f9fafb] p-[10px] rounded-[10px] items-center">
            <Text className="font-title text-[#1e1b4b] text-[16px]">{stats?.totalClicks || 0}</Text>
            <Text className="font-sans text-[#666] text-[9px] text-center mt-[2px]">Cliques (Contato)</Text>
          </View>
        </View>
      </View>

      {/* Gráfico (Placeholder) */}
      <View className="bg-white rounded-[20px] p-[20px] mb-[20px] border border-[#f0f0f0] shadow-[0_4px_15px_rgba(0,0,0,0.02)]">
        <Text className="font-title text-[#1e1b4b] text-[18px] mb-[15px]">Novos Usuários (6 Meses)</Text>
        <View className="h-[150px] bg-[#f9fafb] rounded-[12px] items-center justify-center border border-dashed border-[#d1d5db]">
          <Feather name="bar-chart" size={32} color="#d1d5db" />
          <Text className="font-sans text-[#9ca3af] text-[12px] mt-[10px]">Gráfico disponível em breve</Text>
        </View>
      </View>

      {/* Padding para a bottom nav */}
      <View className="h-[100px]" />
    </ScrollView>
  );
}
