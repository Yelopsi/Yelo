import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import api from '../../../services/api';
import NativeSelectMenu from '../../../components/NativeSelectMenu';

export default function AdminCRMPacientesScreen() {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [pacientes, setPacientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalLoading, setModalLoading] = useState(false);
  const [patient360, setPatient360] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [activeFilter, setActiveFilter] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchPatient360 = async (id: number) => {
    try {
      setModalLoading(true);
      const response = await api.get(`/api/admin/patients/${id}/360`);
      setPatient360(response.data);
    } catch (error) {
      console.log('Erro ao buscar dados 360 do paciente', error);
      setPatient360(null);
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeletePatient = (id: number, name: string) => {
    Alert.alert('Mover para Lixeira', `Tem certeza que deseja mover o paciente ${name} para a lixeira?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Mover', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/api/admin/patients/${id}`);
            setModalVisible(false);
            fetchPacientes();
          } catch (e) {
            Alert.alert('Erro', 'Não foi possível remover o paciente.');
          }
      }}
    ]);
  };

  const handleRestorePatient = (id: number, name: string) => {
    Alert.alert('Restaurar Paciente', `Deseja restaurar o paciente ${name} da lixeira?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Restaurar', onPress: async () => {
          try {
            await api.put(`/api/admin/patients/${id}/status`, { status: 'active' });
            setModalVisible(false);
            fetchPacientes();
          } catch (e) {
            Alert.alert('Erro', 'Não foi possível restaurar o paciente.');
          }
      }}
    ]);
  };

  const handleForceDeletePatient = (id: number, name: string) => {
    Alert.alert('Excluir PERMANENTEMENTE', `Esta ação é irreversível. Tem certeza que deseja apagar todos os dados do paciente ${name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/api/admin/patients/${id}/force`);
            setModalVisible(false);
            fetchPacientes();
          } catch (e) {
            Alert.alert('Erro', 'Não foi possível excluir permanentemente o paciente.');
          }
      }}
    ]);
  };

  const fetchPacientes = async () => {
    try {
      setOfflineMode(false);
      
      const params: any = {};
      if (activeFilter === 'active') params.status = 'active';
      if (activeFilter === 'deleted') params.status = 'deleted';
      if (searchTerm) params.search = searchTerm;

      const response = await api.get('/api/admin/patients', { params });
      setPacientes(response.data.data || response.data || []);
    } catch (error) {
      console.log('Erro ao buscar pacientes, modo offline');
      setOfflineMode(true);
      setPacientes([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const delay = setTimeout(() => {
      fetchPacientes();
    }, 400);
    return () => clearTimeout(delay);
  }, [activeFilter, searchTerm]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPacientes();
  }, []);

  if (loading && pacientes.length === 0) {
    return (
      <View className="flex-1 justify-center items-center bg-[#f9fafb]">
        <ActivityIndicator size="large" color="#8b5cf6" />
        <Text className="mt-4 font-sans text-[#666]">Carregando pacientes...</Text>
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
              Modo Offline: Mostrando dados de demonstração.
            </Text>
          </View>
        )}
        {/* Header Descritivo */}
        <View className="mb-[20px]">
          <Text className="font-title text-[#1e1b4b] text-[24px]">Visão 360° Pacientes</Text>
          <Text className="font-sans text-[#666] text-[14px]">Gestão completa da jornada, retenção e histórico de match.</Text>
        </View>

        {/* Busca e Filtros */}
        <View className="bg-white rounded-[16px] p-[15px] mb-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
          <View className="flex-row bg-[#f1f5f9] rounded-[12px] px-[15px] py-[10px] items-center mb-[15px]">
            <Feather name="search" size={18} color="#64748b" />
            <TextInput 
              placeholder="Buscar paciente por nome, email ou ID..."
              placeholderTextColor="#94a3b8"
              value={searchTerm}
              onChangeText={setSearchTerm}
              className="flex-1 ml-[10px] font-sans text-[14px] text-[#333]"
            />
          </View>
          <NativeSelectMenu
            title="Filtrar Pacientes"
            options={[
              { label: 'Todos os Pacientes', value: 'todos' },
              { label: 'Pacientes Ativos', value: 'active' },
              { label: 'Lixeira (Excluídos) 🗑️', value: 'deleted' },
            ]}
            selectedValue={activeFilter}
            onSelect={(val) => setActiveFilter(val)}
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
                  Visualizando:
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
                  {activeFilter === 'active'
                    ? 'Pacientes Ativos'
                    : activeFilter === 'deleted'
                    ? 'Lixeira (Excluídos) 🗑️'
                    : 'Todos os Pacientes'}
                </Text>
              </View>
              <Feather name="chevron-down" size={16} color="#1B4332" />
            </View>
          </NativeSelectMenu>
        </View>

        {/* Lista de Pacientes (Cards) */}
        <View className="gap-[15px]">
          {pacientes.map((paciente, index) => {
            const initials = paciente.nome ? paciente.nome.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'PA';
            
            // Tratamento de Status
            let statusColor = '#64748b';
            let statusBg = '#f1f5f9';
            let statusText = paciente.status || 'Desconhecido';
            
            if (paciente.status === 'active' || paciente.status === 'ativo') {
              statusColor = '#2563eb'; statusBg = '#eff6ff'; statusText = 'Em Terapia';
            } else if (paciente.status === 'deleted' || paciente.status === 'excluído') {
              statusColor = '#991b1b'; statusBg = '#fee2e2'; statusText = 'Excluído';
            }

            return (
              <TouchableOpacity 
                key={paciente.id || index}
                onPress={() => {
                  setSelectedPatient(paciente);
                  setPatient360(null);
                  setModalVisible(true);
                  fetchPatient360(paciente.id);
                }}
                className="bg-white rounded-[16px] p-[16px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-[#f0f0f0]"
              >
                <View className="flex-row justify-between items-start mb-[10px]">
                  <View className="flex-row items-center flex-1">
                    <View className="w-[40px] h-[40px] bg-[#ecfdf5] rounded-full items-center justify-center mr-[12px]">
                      <Text className="font-title text-[#10b981] text-[16px]">{initials}</Text>
                    </View>
                    <View>
                      <Text className="font-title text-[#1e293b] text-[16px]">{paciente.nome || 'Sem Nome'}</Text>
                      <Text className="font-sans text-[#64748b] text-[12px]">{paciente.email}</Text>
                    </View>
                  </View>
                  <View className={`px-[8px] py-[4px] rounded-[8px]`} style={{ backgroundColor: statusBg }}>
                    <Text className={`font-sans font-bold text-[10px] uppercase`} style={{ color: statusColor }}>{statusText}</Text>
                  </View>
              </View>
              
              <View className="flex-row items-center justify-between border-t border-[#f1f5f9] pt-[10px]">
                <Text className="font-sans text-[#94a3b8] text-[11px]">ID: {paciente.internalId || `YL-${paciente.id || '0000'}`}</Text>
                <View className="flex-row items-center bg-[#f3e8ff] px-[12px] py-[6px] rounded-[8px]">
                  <Feather name="layers" size={14} color="#7e22ce" />
                  <Text className="text-[#7e22ce] font-sans font-bold text-[12px] ml-[6px]">Dossiê 360</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
          })}
        </View>
        <View className="h-[120px]" />
      </ScrollView>

      {/* Modal Dossiê 360 (Timeline) */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-[24px] h-[85%] p-[20px]">
            <View className="flex-row justify-between items-center mb-[20px] border-b border-[#f1f5f9] pb-[15px]">
              <Text className="font-title text-[#1e293b] text-[18px]">Dossiê 360º</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} className="p-[5px]">
                <Feather name="x" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Basic Info */}
              {modalLoading ? <ActivityIndicator size="large" color="#1e1b4b" style={{ marginTop: 50 }} /> : (
                <View>
                  <View className="bg-[#f8f9fa] rounded-[16px] p-[20px] mb-[20px]">
                    <View className="flex-row items-center gap-[15px] mb-[15px]">
                      <View className="w-[60px] h-[60px] rounded-full bg-[#ecfdf5] items-center justify-center">
                        <Text className="font-title text-[#10b981] text-[24px]">
                          {selectedPatient?.nome ? selectedPatient.nome.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'PA'}
                        </Text>
                      </View>
                      <View>
                        <Text className="font-title text-[#1e293b] text-[20px]">{selectedPatient?.nome || 'Sem Nome'}</Text>
                        <Text className="font-sans text-[#64748b] text-[14px]">{selectedPatient?.email}</Text>
                      </View>
                    </View>
                    <View className="flex-row flex-wrap gap-[8px]">
                      <Text className="bg-white px-[12px] py-[6px] rounded-full text-[#475569] font-sans text-[12px] border border-[#e2e8f0]">ID: {selectedPatient?.internalId || `YL-${selectedPatient?.id || '0000'}`}</Text>
                      <Text className="bg-white px-[12px] py-[6px] rounded-full text-[#475569] font-sans text-[12px] border border-[#e2e8f0]">
                        Cadastrado: {selectedPatient?.createdAt ? new Date(selectedPatient.createdAt).toLocaleDateString('pt-BR') : 'Desconhecido'}
                      </Text>
                    </View>
                    
                    {/* Botões de Ação Rápida */}
                    <View className="flex-row mt-[15px] border-t border-[#e2e8f0] pt-[15px]">
                      {selectedPatient?.status === 'deleted' ? (
                        <>
                          <TouchableOpacity onPress={() => handleRestorePatient(selectedPatient.id, selectedPatient.nome)} className="flex-row items-center bg-[#ecfdf5] px-[12px] py-[8px] rounded-[8px] mr-[10px]">
                            <Feather name="refresh-ccw" size={14} color="#10b981" />
                            <Text className="text-[#10b981] font-sans font-bold text-[12px] ml-[6px]">Restaurar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleForceDeletePatient(selectedPatient.id, selectedPatient.nome)} className="flex-row items-center bg-[#fef2f2] px-[12px] py-[8px] rounded-[8px]">
                            <Feather name="trash-2" size={14} color="#ef4444" />
                            <Text className="text-[#ef4444] font-sans font-bold text-[12px] ml-[6px]">Apagar Definitivo</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <TouchableOpacity onPress={() => handleDeletePatient(selectedPatient.id, selectedPatient.nome)} className="flex-row items-center bg-[#fef2f2] px-[12px] py-[8px] rounded-[8px]">
                          <Feather name="trash" size={14} color="#ef4444" />
                          <Text className="text-[#ef4444] font-sans font-bold text-[12px] ml-[6px]">Mover p/ Lixeira</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Timeline Jornada */}
                  <View className="px-[10px]">
                    <Text className="font-title text-[#1e293b] text-[16px] mb-[15px]">Jornada na Plataforma</Text>
                    
                    {patient360?.jornada && patient360.jornada.length > 0 ? patient360.jornada.map((evento: any, idx: number) => (
                      <View key={idx} className="flex-row mb-[20px]">
                        <View className="items-center mr-[15px]">
                          <View className="w-[12px] h-[12px] rounded-full bg-[#10b981]" />
                          {idx < patient360.jornada.length - 1 && <View className="w-[2px] h-full bg-[#e2e8f0] mt-[5px]" />}
                        </View>
                        <View className="flex-1 pb-[5px]">
                          <Text className="font-title text-[#333] text-[14px]">{evento.acao}</Text>
                          <Text className="font-sans text-[#64748b] text-[12px] mt-[2px]">{evento.detalhe}</Text>
                          <Text className="font-sans text-[#94a3b8] text-[10px] mt-[4px]">{evento.data}</Text>
                        </View>
                      </View>
                    )) : (
                      <Text className="font-sans text-[#64748b] text-[12px]">Nenhum histórico disponível.</Text>
                    )}
                  </View>
                </View>
              )}
            </ScrollView>

          </View>
        </View>
      </Modal>
    </View>
  );
}
