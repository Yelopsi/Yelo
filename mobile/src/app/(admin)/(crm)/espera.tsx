import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import api from '../../../services/api';

export default function AdminCRMListaEsperaScreen() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('pendentes'); // 'todos', 'pendentes'

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        setLoading(true);
        const params: any = {};
        if (searchTerm) params.search = searchTerm;
        if (activeFilter !== 'todos') params.status = activeFilter;

        const response = await api.get('/api/admin/waitlist', { params });
        
        let filtered = response.data || [];
        if (searchTerm) {
          filtered = filtered.filter((item: any) => 
            (item.nome && item.nome.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (item.email && item.email.toLowerCase().includes(searchTerm.toLowerCase()))
          );
        }
        if (activeFilter !== 'todos') {
           filtered = filtered.filter((item: any) => item.status === activeFilter);
        }
        
        setLeads(filtered);
        setOfflineMode(false);
      } catch (error) {
        setOfflineMode(true);
        setLeads([
          { id: 1, nome: 'Dr. Roberto Alves', email: 'roberto@email.com', telefone: '11999999999', status: 'pending', createdAt: new Date().toISOString() }
        ]);
      } finally {
        setLoading(false);
      }
    };

    const delay = setTimeout(() => fetchLeads(), 400);
    return () => clearTimeout(delay);
  }, [searchTerm, activeFilter]);
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
          <Text className="font-title text-[#1e1b4b] text-[24px]">Leads Inbound</Text>
          <Text className="font-sans text-[#666] text-[14px]">Profissionais que iniciaram o cadastro mas não finalizaram.</Text>
        </View>

        {/* Busca e Filtros */}
        <View className="bg-white rounded-[16px] p-[15px] mb-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
          <View className="flex-row bg-[#f1f5f9] rounded-[12px] px-[15px] py-[10px] items-center mb-[15px]">
            <Feather name="search" size={18} color="#64748b" />
            <TextInput 
              placeholder="Buscar lead..."
              placeholderTextColor="#94a3b8"
              value={searchTerm}
              onChangeText={setSearchTerm}
              className="flex-1 ml-[10px] font-sans text-[14px] text-[#333]"
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-[10px]">
              <TouchableOpacity onPress={() => setActiveFilter('todos')} className={activeFilter === 'todos' ? "bg-[#1e1b4b] px-[16px] py-[8px] rounded-[20px]" : "bg-[#f1f5f9] px-[16px] py-[8px] rounded-[20px] border border-[#e2e8f0]"}>
                <Text className={activeFilter === 'todos' ? "text-white font-sans font-bold text-[12px]" : "text-[#64748b] font-sans font-bold text-[12px]"}>Todos os Leads</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setActiveFilter('pendentes')} className={activeFilter === 'pendentes' ? "bg-[#1e1b4b] px-[16px] py-[8px] rounded-[20px]" : "bg-[#f1f5f9] px-[16px] py-[8px] rounded-[20px] border border-[#e2e8f0]"}>
                <Text className={activeFilter === 'pendentes' ? "text-white font-sans font-bold text-[12px]" : "text-[#64748b] font-sans font-bold text-[12px]"}>Apenas Pendentes</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>

        {/* Lista de Espera (Cards) */}
        <View className="gap-[15px]">
          {loading ? <ActivityIndicator color="#1e1b4b" /> : leads.map((lead, index) => {
            const initials = lead.nome ? lead.nome.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'DR';
            return (
              <View 
                key={lead.id || index}
                className="bg-white rounded-[16px] p-[16px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-[#f0f0f0]"
              >
                <View className="flex-row justify-between items-start mb-[10px]">
                  <View className="flex-row items-center flex-1">
                    <View className="w-[40px] h-[40px] bg-[#ecfdf5] rounded-full items-center justify-center mr-[12px]">
                      <Text className="font-title text-[#10b981] text-[16px]">{initials}</Text>
                    </View>
                    <View>
                      <Text className="font-title text-[#1e293b] text-[16px]">{lead.nome || 'Sem Nome'}</Text>
                      <Text className="font-sans text-[#64748b] text-[12px]">{lead.email}</Text>
                      <Text className="font-sans text-[#64748b] text-[12px]">{lead.telefone}</Text>
                    </View>
                  </View>
                  <View className="px-[8px] py-[4px] rounded-[8px] bg-[#fef2f2]">
                    <Text className="font-sans font-bold text-[10px] text-[#ef4444] uppercase">{lead.status === 'invited' ? 'Contatado' : 'Pendente'}</Text>
                  </View>
                </View>
                
                <View className="flex-row items-center justify-between border-t border-[#f1f5f9] pt-[10px]">
                  <View>
                    <Text className="font-sans text-[#64748b] text-[11px] mb-[2px]">CRP: {lead.crp || 'Não preenchido'}</Text>
                    <Text className="font-sans text-[#94a3b8] text-[11px]">Iniciou em: {new Date(lead.createdAt).toLocaleDateString('pt-BR')}</Text>
                  </View>
                  <TouchableOpacity className="flex-row items-center bg-[#f8f9fa] px-[12px] py-[6px] rounded-[8px] border border-[#e2e8f0]">
                    <Feather name="message-circle" size={14} color="#3b82f6" />
                    <Text className="text-[#3b82f6] font-sans font-bold text-[12px] ml-[6px]">Contatar Whatsapp</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
        <View className="h-[120px]" />
      </ScrollView>
    </View>
  );
}
