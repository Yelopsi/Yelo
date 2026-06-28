import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, RefreshControl, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import api from '../../../services/api';

export default function AdminCRMPsicologosScreen() {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPsi, setSelectedPsi] = useState<any>(null);
  const [psychologists, setPsychologists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [kpis, setKpis] = useState<any>({ total: 0, active: 0, pending: 0, inactive: 0, vip: 0, fila_cs: 0 });
  const [activeFilter, setActiveFilter] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchPsychologists = async () => {
    try {
      setOfflineMode(false);
      
      const params: any = {};
      if (activeFilter === 'active') params.status = 'active';
      if (activeFilter === 'pending') params.status = 'pending';
      if (activeFilter === 'inactive') params.status = 'inactive';
      if (activeFilter === 'deleted') params.status = 'deleted';
      if (activeFilter === 'vip') params.isVip = 'true';
      if (activeFilter === 'fila_cs') params.notAnalyzed = 'true';
      if (searchTerm) params.search = searchTerm;

      const response = await api.get('/api/admin/psychologists', { params });
      setPsychologists(response.data.data || response.data || []);
      setKpis(response.data.kpis || { total: 0, active: 0, pending: 0, inactive: 0, vip: 0, fila_cs: 0 });
    } catch (error: any) {
      console.log('Erro ao buscar psicólogos, modo offline:', error);
      setErrorMsg(error.message || 'Erro desconhecido');
      setOfflineMode(true);
      setPsychologists([
        { id: 1, name: 'Dra. Roberta Silva', email: 'roberta@email.com', plan: 'Clínico', status: 'active', createdAt: '2024-01-10T00:00:00.000Z' },
        { id: 2, name: 'Dr. Carlos Mendes', email: 'carlos@email.com', plan: 'Essencial', status: 'pending', createdAt: '2024-02-15T00:00:00.000Z' },
        { id: 3, name: 'Dra. Ana Costa', email: 'ana@email.com', plan: 'Essencial', status: 'inactive', createdAt: '2023-11-05T00:00:00.000Z' },
      ]);
      setKpis({ total: 3, active: 1, pending: 1, inactive: 1, vip: 0, fila_cs: 0 });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const delay = setTimeout(() => {
      fetchPsychologists();
    }, 400);
    return () => clearTimeout(delay);
  }, [activeFilter, searchTerm]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPsychologists();
  }, []);

  if (loading && psychologists.length === 0) {
    return (
      <View className="flex-1 justify-center items-center bg-[#f9fafb]">
        <ActivityIndicator size="large" color="#8b5cf6" />
        <Text className="mt-4 font-sans text-[#666]">Carregando psicólogos...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <ScrollView 
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
              Modo Offline: Mostrando dados de demonstração. ({errorMsg})
            </Text>
          </View>
        )}
        {/* Header Descritivo */}
        <View className="mb-[20px]">
          <Text className="font-title text-[#1e1b4b] text-[24px]">Sucesso do Psicólogo</Text>
          <Text className="font-sans text-[#666] text-[14px]">Monitoramento de saúde da assinatura, engajamento e força do perfil.</Text>
        </View>

        {/* KPIs Horizontais */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-[20px]">
          <View className="flex-row gap-[10px]">
            <View className="bg-white rounded-[16px] p-[15px] border-t-4 border-[#3498db] shadow-[0_2px_10px_rgba(0,0,0,0.03)] w-[120px]">
              <Text className="font-sans text-[#666] text-[12px] mb-[5px]">Total</Text>
              <Text className="font-title text-[#3498db] text-[24px]">{kpis.total}</Text>
            </View>
            <View className="bg-white rounded-[16px] p-[15px] border-t-4 border-[#22c55e] shadow-[0_2px_10px_rgba(0,0,0,0.03)] w-[120px]">
              <Text className="font-sans text-[#666] text-[12px] mb-[5px]">Ativos</Text>
              <Text className="font-title text-[#22c55e] text-[24px]">{kpis.active}</Text>
            </View>
            <View className="bg-white rounded-[16px] p-[15px] border-t-4 border-[#f59e0b] shadow-[0_2px_10px_rgba(0,0,0,0.03)] w-[120px]">
              <Text className="font-sans text-[#666] text-[12px] mb-[5px]">Pendentes</Text>
              <Text className="font-title text-[#f59e0b] text-[24px]">{kpis.pending}</Text>
            </View>
            <View className="bg-white rounded-[16px] p-[15px] border-t-4 border-[#ef4444] shadow-[0_2px_10px_rgba(0,0,0,0.03)] w-[120px]">
              <Text className="font-sans text-[#666] text-[12px] mb-[5px]">Inativos</Text>
              <Text className="font-title text-[#ef4444] text-[24px]">{kpis.inactive}</Text>
            </View>
            <View className="bg-white rounded-[16px] p-[15px] border-t-4 border-[#d4af37] shadow-[0_2px_10px_rgba(0,0,0,0.03)] w-[120px]">
              <Text className="font-sans text-[#666] text-[12px] mb-[5px]">VIPs</Text>
              <Text className="font-title text-[#d4af37] text-[24px]">{kpis.vip}</Text>
            </View>
          </View>
        </ScrollView>

        {/* Busca e Filtros */}
        <View className="bg-white rounded-[16px] p-[15px] mb-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
          <View className="flex-row bg-[#f1f5f9] rounded-[12px] px-[15px] py-[10px] items-center mb-[15px]">
            <Feather name="search" size={18} color="#64748b" />
            <TextInput 
              placeholder="Buscar psicólogo..."
              placeholderTextColor="#94a3b8"
              value={searchTerm}
              onChangeText={setSearchTerm}
              className="flex-1 ml-[10px] font-sans text-[14px] text-[#333]"
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-[10px]">
              <TouchableOpacity onPress={() => setActiveFilter('todos')} className={activeFilter === 'todos' ? "bg-[#1e1b4b] px-[16px] py-[8px] rounded-[20px]" : "bg-[#f1f5f9] px-[16px] py-[8px] rounded-[20px] border border-[#e2e8f0]"}>
                <Text className={activeFilter === 'todos' ? "text-white font-sans font-bold text-[12px]" : "text-[#64748b] font-sans font-bold text-[12px]"}>Todos</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setActiveFilter('active')} className={activeFilter === 'active' ? "bg-[#1e1b4b] px-[16px] py-[8px] rounded-[20px]" : "bg-[#f1f5f9] px-[16px] py-[8px] rounded-[20px] border border-[#e2e8f0]"}>
                <Text className={activeFilter === 'active' ? "text-white font-sans font-bold text-[12px]" : "text-[#64748b] font-sans font-bold text-[12px]"}>Ativos</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setActiveFilter('pending')} className={activeFilter === 'pending' ? "bg-[#1e1b4b] px-[16px] py-[8px] rounded-[20px]" : "bg-[#f1f5f9] px-[16px] py-[8px] rounded-[20px] border border-[#e2e8f0]"}>
                <Text className={activeFilter === 'pending' ? "text-white font-sans font-bold text-[12px]" : "text-[#64748b] font-sans font-bold text-[12px]"}>Pendentes</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setActiveFilter('inactive')} className={activeFilter === 'inactive' ? "bg-[#1e1b4b] px-[16px] py-[8px] rounded-[20px]" : "bg-[#f1f5f9] px-[16px] py-[8px] rounded-[20px] border border-[#e2e8f0]"}>
                <Text className={activeFilter === 'inactive' ? "text-white font-sans font-bold text-[12px]" : "text-[#64748b] font-sans font-bold text-[12px]"}>Inativos</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setActiveFilter('vip')} className={activeFilter === 'vip' ? "bg-[#1e1b4b] px-[16px] py-[8px] rounded-[20px]" : "bg-[#f1f5f9] px-[16px] py-[8px] rounded-[20px] border border-[#e2e8f0]"}>
                <Text className={activeFilter === 'vip' ? "text-white font-sans font-bold text-[12px]" : "text-[#64748b] font-sans font-bold text-[12px]"}>VIPs</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setActiveFilter('fila_cs')} className={activeFilter === 'fila_cs' ? "bg-[#7e22ce] px-[16px] py-[8px] rounded-[20px]" : "bg-[#f3e8ff] px-[16px] py-[8px] rounded-[20px] border border-[#d8b4fe]"}>
                <Text className={activeFilter === 'fila_cs' ? "text-white font-sans font-bold text-[12px]" : "text-[#7e22ce] font-sans font-bold text-[12px]"}>Fila CS ✨</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setActiveFilter('deleted')} className={activeFilter === 'deleted' ? "bg-[#ef4444] px-[16px] py-[8px] rounded-[20px]" : "bg-[#fef2f2] px-[16px] py-[8px] rounded-[20px] border border-[#fecaca]"}>
                <Text className={activeFilter === 'deleted' ? "text-white font-sans font-bold text-[12px]" : "text-[#ef4444] font-sans font-bold text-[12px]"}>Lixeira 🗑️</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>

        {/* Lista de Psicólogos (Cards Mobile no lugar da Tabela) */}
        <View className="gap-[15px]">
          {psychologists.map((psi, index) => {
            const initials = psi.nome ? psi.nome.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'PS';
            
            // Tratamento de Status
            let statusColor = '#64748b';
            let statusBg = '#f1f5f9';
            let statusText = psi.status || 'Desconhecido';
            
            if (psi.status === 'active' || psi.status === 'ativo') {
              statusColor = '#166534'; statusBg = '#dcfce7'; statusText = 'Ativo';
            } else if (psi.status === 'pending' || psi.status === 'pendente') {
              statusColor = '#9a3412'; statusBg = '#ffedd5'; statusText = 'Pendente';
            } else if (psi.status === 'inactive' || psi.status === 'inativo') {
              statusColor = '#991b1b'; statusBg = '#fee2e2'; statusText = 'Inativo';
            }

            return (
              <TouchableOpacity 
                key={psi.id || index}
                onPress={() => {
                  setSelectedPsi(psi);
                  setModalVisible(true);
                }}
                className="bg-white rounded-[16px] p-[16px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-[#f0f0f0]"
              >
                <View className="flex-row justify-between items-start mb-[10px]">
                  <View className="flex-row items-center flex-1">
                    <View className="w-[40px] h-[40px] bg-[#e0f2fe] rounded-full items-center justify-center mr-[12px]">
                      <Text className="font-title text-[#0284c7] text-[16px]">{initials}</Text>
                    </View>
                    <View>
                      <Text className="font-title text-[#1e293b] text-[16px]">{psi.nome || 'Sem Nome'}</Text>
                      <Text className="font-sans text-[#64748b] text-[12px]">
                        Plano {psi.plano || 'N/A'} • Desde {psi.createdAt ? new Date(psi.createdAt).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }) : 'N/A'}
                      </Text>
                    </View>
                  </View>
                  <View className={`px-[8px] py-[4px] rounded-[8px]`} style={{ backgroundColor: statusBg }}>
                    <Text className={`font-sans font-bold text-[10px] uppercase`} style={{ color: statusColor }}>{statusText}</Text>
                  </View>
              </View>
              
              <View className="flex-row items-center justify-between border-t border-[#f1f5f9] pt-[10px]">
                <View>
                  <Text className="font-sans text-[#64748b] text-[10px] mb-[4px]">Força do Perfil</Text>
                  <View className="w-[100px] h-[6px] bg-[#e2e8f0] rounded-full overflow-hidden">
                    <View className="w-[85%] h-full bg-[#22c55e] rounded-full" />
                  </View>
                </View>
                <TouchableOpacity className="flex-row items-center bg-[#f3e8ff] px-[12px] py-[6px] rounded-[8px]">
                  <Feather name="eye" size={14} color="#7e22ce" />
                  <Text className="text-[#7e22ce] font-sans font-bold text-[12px] ml-[6px]">Visão 360</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
          })}
        </View>
        <View className="h-[120px]" />
      </ScrollView>

      {/* Modal Visão 360 CS (Drawer Mobile) */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-[24px] h-[80%] p-[20px]">
            <View className="flex-row justify-between items-center mb-[20px] border-b border-[#f1f5f9] pb-[15px]">
              <Text className="font-title text-[#1e293b] text-[18px]">Visão de CS (360º)</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} className="p-[5px]">
                <Feather name="x" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Basic Info */}
              <View className="bg-[#f8f9fa] rounded-[16px] p-[20px] mb-[15px]">
                <View className="flex-row items-center gap-[15px] mb-[15px]">
                  <View className="w-[60px] h-[60px] rounded-full bg-[#f3e8ff] items-center justify-center">
                    <Text className="font-title text-[#8b5cf6] text-[24px]">DR</Text>
                  </View>
                  <View>
                    <Text className="font-title text-[#1e293b] text-[20px]">{selectedPsi ? selectedPsi.nome : 'Dra. Roberta Silva'}</Text>
                    <Text className="font-sans text-[#64748b] text-[14px]">{selectedPsi ? selectedPsi.email : 'roberta.silva@email.com'}</Text>
                  </View>
                </View>
                <View className="flex-row flex-wrap gap-[8px]">
                  <Text className="bg-white px-[12px] py-[6px] rounded-full text-[#475569] font-sans text-[12px] border border-[#e2e8f0]">(11) 99999-9999</Text>
                  <Text className="bg-white px-[12px] py-[6px] rounded-full text-[#475569] font-sans text-[12px] border border-[#e2e8f0]">CRP: 06/12345</Text>
                </View>
              </View>

              {/* Assinatura */}
              <View className="bg-white rounded-[16px] p-[20px] border border-[#e2e8f0] mb-[15px]">
                <Text className="font-title text-[#1e293b] text-[16px] mb-[15px]">Saúde do Perfil e Assinatura</Text>
                <View className="flex-row justify-between mb-[10px]">
                  <Text className="font-sans text-[#64748b] text-[14px]">Plano Atual</Text>
                  <Text className="font-title text-[#1e293b] text-[14px]">Clínico Mensal</Text>
                </View>
                <View className="flex-row justify-between mb-[15px]">
                  <Text className="font-sans text-[#64748b] text-[14px]">Vencimento</Text>
                  <Text className="font-title text-[#10b981] text-[14px]">10/08/2026</Text>
                </View>
                
                <View className="gap-[10px] mt-[10px]">
                  <TouchableOpacity className="bg-[#1e1b4b] p-[12px] rounded-[50px] items-center">
                    <Text className="text-white font-sans font-bold text-[14px]">Gerenciar Isenção VIP</Text>
                  </TouchableOpacity>

                  <TouchableOpacity className="bg-[#f8fafc] border border-[#cbd5e1] p-[12px] rounded-[50px] items-center">
                    <Text className="text-[#334155] font-sans font-bold text-[14px]">Ver Dossiê Completo 🗂️</Text>
                  </TouchableOpacity>

                  <TouchableOpacity className="bg-[#f0fdf4] border border-[#bbf7d0] p-[12px] rounded-[50px] items-center">
                    <Text className="text-[#166534] font-sans font-bold text-[14px]">Ver Perfil Público 🔗</Text>
                  </TouchableOpacity>

                  <TouchableOpacity className="bg-[#e0f2fe] border border-[#bae6fd] p-[12px] rounded-[50px] items-center">
                    <Text className="text-[#0369a1] font-sans font-bold text-[14px]">Chamar no WhatsApp 📱</Text>
                  </TouchableOpacity>

                  <TouchableOpacity className="bg-[#fef08a] border border-[#fde047] p-[12px] rounded-[50px] items-center">
                    <Text className="text-[#b45309] font-sans font-bold text-[14px]">✨ Análise de Perfil (IA)</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
