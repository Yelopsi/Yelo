import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import api from '../../../services/api';

export default function AdminCRMLeadsScreen() {
  const [modalVisible, setModalVisible] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any>({ pendentes: 0, contatados: 0, aguardando: 0, cadastrados: 0 });
  const [activeFilter, setActiveFilter] = useState('todos'); // 'todos', 'pendentes', 'followup_hoje'
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        setLoading(true);
        const params: any = {};
        if (activeFilter !== 'todos') params.filtro = activeFilter;
        // if (searchTerm) params.search = searchTerm; // Implementado no backend se necessário

        const response = await api.get('/api/admin/leads', { params });
        setLeads(response.data.leads || []);
        setKpis(response.data.kpis || { pendentes: 0, contatados: 0, aguardando: 0, cadastrados: 0 });
        setOfflineMode(false);
      } catch (error) {
        setOfflineMode(true);
        setLeads([
          { id: 1, nome_completo: 'Dr. Carlos Mendes', telefone: '(11) 98888-8888', origem: 'LinkedIn B2B', status_funil: 'Contatado' },
          { id: 2, nome_completo: 'Dra. Fernanda Silva', telefone: '(11) 99999-9999', origem: 'Instagram', status_funil: 'Pendente' }
        ]);
        setKpis({ pendentes: 50, contatados: 25, aguardando: 10, cadastrados: 5 });
      } finally {
        setLoading(false);
      }
    };
    
    const delay = setTimeout(() => fetchLeads(), 400);
    return () => clearTimeout(delay);
  }, [activeFilter, searchTerm]);

  const totalLeads = kpis.pendentes + kpis.contatados + kpis.aguardando + kpis.cadastrados;
  const conversao = totalLeads > 0 ? Math.round((kpis.cadastrados / totalLeads) * 100) : 0;

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
          <Text className="font-title text-[#1e1b4b] text-[24px]">Pipeline de Vendas</Text>
          <Text className="font-sans text-[#666] text-[14px]">Captação ativa e conversão de psicólogos.</Text>
        </View>

        {/* KPIs Horizontais */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-[20px] pb-[10px]">
          <View className="flex-row gap-[10px]">
            <View className="bg-white rounded-[16px] p-[15px] border-t-4 border-[#f59e0b] shadow-[0_2px_10px_rgba(0,0,0,0.03)] w-[120px]">
              <Text className="font-sans text-[#666] text-[12px] mb-[5px]">Oport. Frias</Text>
              <Text className="font-title text-[#f59e0b] text-[24px]">{kpis.pendentes}</Text>
            </View>
            <View className="bg-white rounded-[16px] p-[15px] border-t-4 border-[#3b82f6] shadow-[0_2px_10px_rgba(0,0,0,0.03)] w-[120px]">
              <Text className="font-sans text-[#666] text-[12px] mb-[5px]">1º Contato</Text>
              <Text className="font-title text-[#3b82f6] text-[24px]">{kpis.contatados}</Text>
            </View>
            <View className="bg-white rounded-[16px] p-[15px] border-t-4 border-[#8b5cf6] shadow-[0_2px_10px_rgba(0,0,0,0.03)] w-[120px]">
              <Text className="font-sans text-[#666] text-[12px] mb-[5px]">Negociação</Text>
              <Text className="font-title text-[#8b5cf6] text-[24px]">{kpis.aguardando}</Text>
            </View>
            <View className="bg-white rounded-[16px] p-[15px] border-t-4 border-[#10b981] shadow-[0_2px_10px_rgba(0,0,0,0.03)] w-[120px]">
              <Text className="font-sans text-[#666] text-[12px] mb-[5px]">Convertidos</Text>
              <Text className="font-title text-[#10b981] text-[24px]">{kpis.cadastrados}</Text>
            </View>
            <View className="bg-white rounded-[16px] p-[15px] border-t-4 border-[#1B4332] shadow-[0_2px_10px_rgba(0,0,0,0.03)] w-[120px]">
              <Text className="font-sans text-[#666] text-[12px] mb-[5px]">Conversão</Text>
              <Text className="font-title text-[#1B4332] text-[24px]">{conversao}%</Text>
            </View>
          </View>
        </ScrollView>

        {/* Busca, Filtros e Ações */}
        <View className="bg-white rounded-[16px] p-[15px] mb-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
          <View className="flex-row bg-[#f1f5f9] rounded-[12px] px-[15px] py-[10px] items-center mb-[15px]">
            <Feather name="search" size={18} color="#64748b" />
            <TextInput 
              placeholder="Buscar prospecto..."
              placeholderTextColor="#94a3b8"
              value={searchTerm}
              onChangeText={setSearchTerm}
              className="flex-1 ml-[10px] font-sans text-[14px] text-[#333]"
            />
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-[15px]">
            <View className="flex-row gap-[10px]">
              <TouchableOpacity onPress={() => setActiveFilter('todos')} className={activeFilter === 'todos' ? "bg-[#1e1b4b] px-[16px] py-[8px] rounded-[20px]" : "bg-[#f1f5f9] px-[16px] py-[8px] rounded-[20px] border border-[#e2e8f0]"}>
                <Text className={activeFilter === 'todos' ? "text-white font-sans font-bold text-[12px]" : "text-[#64748b] font-sans font-bold text-[12px]"}>Pipeline Ativo</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setActiveFilter('pendentes')} className={activeFilter === 'pendentes' ? "bg-[#1e1b4b] px-[16px] py-[8px] rounded-[20px]" : "bg-[#f1f5f9] px-[16px] py-[8px] rounded-[20px] border border-[#e2e8f0]"}>
                <Text className={activeFilter === 'pendentes' ? "text-white font-sans font-bold text-[12px]" : "text-[#64748b] font-sans font-bold text-[12px]"}>Frios</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setActiveFilter('followup_hoje')} className={activeFilter === 'followup_hoje' ? "bg-[#1e1b4b] px-[16px] py-[8px] rounded-[20px]" : "bg-[#f1f5f9] px-[16px] py-[8px] rounded-[20px] border border-[#e2e8f0]"}>
                <Text className={activeFilter === 'followup_hoje' ? "text-white font-sans font-bold text-[12px]" : "text-[#64748b] font-sans font-bold text-[12px]"}>Em Negociação (Hoje)</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Ações (Capturar/Exportar) */}
          <View className="flex-row gap-[10px] flex-wrap">
            <TouchableOpacity className="flex-row items-center bg-[#1e1b4b] px-[12px] py-[8px] rounded-[8px] flex-1 justify-center">
              <Feather name="crosshair" size={14} color="white" />
              <Text className="text-white font-sans font-bold text-[12px] ml-[6px]">Capturar Leads</Text>
            </TouchableOpacity>
            <TouchableOpacity className="flex-row items-center bg-[#f1f5f9] px-[12px] py-[8px] rounded-[8px] flex-1 justify-center border border-[#e2e8f0]">
              <Feather name="download" size={14} color="#64748b" />
              <Text className="text-[#64748b] font-sans font-bold text-[12px] ml-[6px]">Exportar CSV</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Lista de Leads (Cards) */}
        <View className="gap-[15px]">
          {loading ? <ActivityIndicator color="#1e1b4b" /> : leads.map((item, index) => (
            <View 
              key={item.id || index}
              className="bg-white rounded-[16px] p-[16px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-[#f0f0f0]"
            >
              <View className="flex-row justify-between items-start mb-[10px]">
                <View className="flex-row items-center flex-1">
                  <View className="w-[40px] h-[40px] bg-[#fef3c7] rounded-full items-center justify-center mr-[12px]">
                    <Text className="font-title text-[#d97706] text-[16px]">
                      {item.nome_completo ? item.nome_completo.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'PS'}
                    </Text>
                  </View>
                  <View>
                    <Text className="font-title text-[#1e293b] text-[16px]">{item.nome_completo || 'Sem Nome'}</Text>
                    <Text className="font-sans text-[#64748b] text-[12px]">Fonte: {item.origem || 'Desconhecida'}</Text>
                  </View>
                </View>
                <View className="bg-[#eff6ff] px-[8px] py-[4px] rounded-[8px]">
                  <Text className="text-[#2563eb] font-sans font-bold text-[10px] uppercase">{item.status_funil || 'Pendente'}</Text>
                </View>
              </View>
              
              <View className="flex-row items-center justify-between border-t border-[#f1f5f9] pt-[10px]">
                <Text className="font-sans text-[#64748b] text-[12px]">{item.telefone || 'Sem telefone'}</Text>
                <TouchableOpacity 
                  onPress={() => setModalVisible(true)}
                  className="flex-row items-center bg-[#25d366] px-[12px] py-[6px] rounded-[8px]"
                >
                  <Feather name="message-circle" size={14} color="white" />
                  <Text className="text-white font-sans font-bold text-[12px] ml-[6px]">Abordar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
        <View className="h-[120px]" />
      </ScrollView>

      {/* Modal Abordagem WhatsApp */}
      <Modal visible={modalVisible} animationType="fade" transparent={true}>
        <View className="flex-1 justify-center items-center bg-black/50 p-[20px]">
          <View className="bg-white rounded-[24px] w-full p-[20px] shadow-[0_10px_40px_rgba(0,0,0,0.2)]">
            <View className="flex-row justify-between items-center mb-[20px] border-b border-[#f1f5f9] pb-[15px]">
              <Text className="font-title text-[#1e293b] text-[18px]">Contato de Venda</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} className="p-[5px]">
                <Feather name="x" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text className="font-sans text-[#666] text-[14px] mb-[20px]">
              Escolha a abordagem. Links de conversão (UTM) são injetados automaticamente na mensagem.
            </Text>

            <View className="gap-[10px] mb-[20px]">
              <TouchableOpacity className="bg-[#f8f9fa] border border-[#e2e8f0] rounded-[12px] p-[12px]">
                <Text className="font-title text-[#1e293b] text-[14px] mb-[4px]">1. Pitch / Venda Direta</Text>
                <Text className="font-sans text-[#64748b] text-[12px]">Explica a Yelo e oferece Trial Premium.</Text>
              </TouchableOpacity>
              
              <TouchableOpacity className="bg-[#f8f9fa] border border-[#e2e8f0] rounded-[12px] p-[12px]">
                <Text className="font-title text-[#1e293b] text-[14px] mb-[4px]">2. Follow-up de Nutrição</Text>
                <Text className="font-sans text-[#64748b] text-[12px]">Pós 2 dias. Quebra objeção de cartão.</Text>
              </TouchableOpacity>

              <TouchableOpacity className="bg-[#fef2f2] border border-[#fecaca] rounded-[12px] p-[12px]">
                <Text className="font-title text-[#ef4444] text-[14px] mb-[4px]">3. Break-up / Despedida</Text>
                <Text className="font-sans text-[#ef4444] text-[12px]">Última tentativa de contato para criar urgência.</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              onPress={() => setModalVisible(false)}
              className="bg-[#f1f5f9] p-[12px] rounded-[12px] items-center"
            >
              <Text className="text-[#64748b] font-sans font-bold text-[14px]">Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
