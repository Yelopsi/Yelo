import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../../services/api';
import NativeSelectMenu from '../../../components/NativeSelectMenu';

export default function AdminCRMPacientesScreen() {
  const router = useRouter();
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
      {
        text: 'Mover',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/api/admin/patients/${id}`);
            setModalVisible(false);
            fetchPacientes();
          } catch (e) {
            Alert.alert('Erro', 'Não foi possível remover o paciente.');
          }
        },
      },
    ]);
  };

  const handleRestorePatient = (id: number, name: string) => {
    Alert.alert('Restaurar Paciente', `Deseja restaurar o paciente ${name} da lixeira?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Restaurar',
        onPress: async () => {
          try {
            await api.put(`/api/admin/patients/${id}/status`, { status: 'active' });
            setModalVisible(false);
            fetchPacientes();
          } catch (e) {
            Alert.alert('Erro', 'Não foi possível restaurar o paciente.');
          }
        },
      },
    ]);
  };

  const handleForceDeletePatient = (id: number, name: string) => {
    Alert.alert('Excluir PERMANENTEMENTE', `Esta ação é irreversível. Tem certeza que deseja apagar todos os dados do paciente ${name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/api/admin/patients/${id}/force`);
            setModalVisible(false);
            fetchPacientes();
          } catch (e) {
            Alert.alert('Erro', 'Não foi possível excluir permanentemente o paciente.');
          }
        },
      },
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' }}>
        <ActivityIndicator size="large" color="#1B4332" />
        <Text style={{ marginTop: 16, fontFamily: 'Inter_500Medium', color: '#64748b', fontSize: 13 }}>
          Carregando pacientes...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1B4332']} tintColor="#1B4332" />
        }
      >
        {/* Banner de Modo Offline */}
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
                Visão 360° Pacientes 👥
              </Text>
              <Text style={{ fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 }}>
                Gestão da jornada, retenção e histórico de match na Yelo.
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

        {/* Busca e Filtros */}
        <View
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 20,
            padding: 16,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            shadowColor: '#000',
            shadowOpacity: 0.02,
            shadowRadius: 4,
            elevation: 1,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: '#f8fafc',
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 10,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#e2e8f0',
              marginBottom: 12,
            }}
          >
            <Feather name="search" size={16} color="#64748b" />
            <TextInput
              placeholder="Buscar paciente por nome, email ou ID..."
              placeholderTextColor="#94a3b8"
              value={searchTerm}
              onChangeText={setSearchTerm}
              style={{ flex: 1, marginLeft: 8, fontFamily: 'Inter_400Regular', fontSize: 13, color: '#1e293b' }}
            />
            {searchTerm.length > 0 && (
              <TouchableOpacity onPress={() => setSearchTerm('')}>
                <Feather name="x" size={14} color="#94a3b8" />
              </TouchableOpacity>
            )}
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
        <View style={{ gap: 12 }}>
          {pacientes.length === 0 ? (
            <View style={{ backgroundColor: '#ffffff', borderRadius: 20, padding: 30, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' }}>
              <Text style={{ fontSize: 24, marginBottom: 6 }}>👥</Text>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 16 }}>Nenhum paciente encontrado</Text>
              <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 12, marginTop: 4 }}>
                Não foram encontrados pacientes com os filtros atuais.
              </Text>
            </View>
          ) : (
            pacientes.map((paciente, index) => {
              const initials = paciente.nome
                ? paciente.nome
                    .split(' ')
                    .map((n: string) => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase()
                : 'PA';

              let statusColor = '#64748b';
              let statusBg = '#f1f5f9';
              let statusText = paciente.status || 'Desconhecido';

              if (paciente.status === 'active' || paciente.status === 'ativo') {
                statusColor = '#10b981';
                statusBg = '#ecfdf5';
                statusText = 'Em Terapia';
              } else if (paciente.status === 'deleted' || paciente.status === 'excluído') {
                statusColor = '#ef4444';
                statusBg = '#fee2e2';
                statusText = 'Excluído';
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
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 8 }}>
                      <View
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 999,
                          backgroundColor: '#e8f5e9',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 12,
                          borderWidth: 1,
                          borderColor: '#c8e6c9',
                        }}
                      >
                        <Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 15 }}>{initials}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 15 }} numberOfLines={1}>
                          {paciente.nome || 'Sem Nome'}
                        </Text>
                        <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 12, marginTop: 1 }} numberOfLines={1}>
                          {paciente.email}
                        </Text>
                      </View>
                    </View>
                    <View style={{ backgroundColor: statusBg, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 }}>
                      <Text style={{ fontFamily: 'Inter_700Bold', color: statusColor, fontSize: 10, textTransform: 'uppercase' }}>
                        {statusText}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 }}>
                    <Text style={{ fontFamily: 'Inter_500Medium', color: '#94a3b8', fontSize: 11 }}>
                      ID: {paciente.internalId || `YL-${paciente.id || '0000'}`}
                    </Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#e8f5e9',
                        paddingHorizontal: 12,
                        paddingVertical: 5,
                        borderRadius: 999,
                      }}
                    >
                      <Feather name="layers" size={13} color="#1B4332" />
                      <Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 11.5, marginLeft: 5 }}>
                        Dossiê 360
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Modal Dossiê 360 (Timeline) */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '85%', padding: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 12 }}>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 18 }}>Dossiê 360º do Paciente</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={{ padding: 6, borderRadius: 999, backgroundColor: '#f1f5f9' }}>
                <Feather name="x" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              {modalLoading ? (
                <ActivityIndicator size="large" color="#1B4332" style={{ marginTop: 50 }} />
              ) : (
                <View>
                  <View style={{ backgroundColor: '#f8fafc', borderRadius: 20, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                      <View
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 999,
                          backgroundColor: '#e8f5e9',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 1,
                          borderColor: '#c8e6c9',
                        }}
                      >
                        <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 20 }}>
                          {selectedPatient?.nome
                            ? selectedPatient.nome
                                .split(' ')
                                .map((n: string) => n[0])
                                .join('')
                                .substring(0, 2)
                                .toUpperCase()
                            : 'PA'}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 18 }}>
                          {selectedPatient?.nome || 'Sem Nome'}
                        </Text>
                        <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 13, marginTop: 2 }}>
                          {selectedPatient?.email}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      <Text style={{ backgroundColor: '#ffffff', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, color: '#475569', fontFamily: 'Inter_500Medium', fontSize: 11, borderWidth: 1, borderColor: '#e2e8f0' }}>
                        ID: {selectedPatient?.internalId || `YL-${selectedPatient?.id || '0000'}`}
                      </Text>
                      <Text style={{ backgroundColor: '#ffffff', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, color: '#475569', fontFamily: 'Inter_500Medium', fontSize: 11, borderWidth: 1, borderColor: '#e2e8f0' }}>
                        Cadastrado: {selectedPatient?.createdAt ? new Date(selectedPatient.createdAt).toLocaleDateString('pt-BR') : 'Desconhecido'}
                      </Text>
                    </View>

                    {/* Botões de Ação Rápida Pílula */}
                    <View style={{ flexDirection: 'row', marginTop: 14, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 14, gap: 10 }}>
                      {selectedPatient?.status === 'deleted' ? (
                        <>
                          <TouchableOpacity
                            onPress={() => handleRestorePatient(selectedPatient.id, selectedPatient.nome)}
                            style={{
                              flex: 1,
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: '#ecfdf5',
                              paddingVertical: 9,
                              borderRadius: 999,
                              borderWidth: 1,
                              borderColor: '#bbf7d0',
                              gap: 6,
                            }}
                            activeOpacity={0.8}
                          >
                            <Feather name="refresh-ccw" size={13} color="#10b981" />
                            <Text style={{ color: '#10b981', fontFamily: 'Inter_700Bold', fontSize: 12 }}>Restaurar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleForceDeletePatient(selectedPatient.id, selectedPatient.nome)}
                            style={{
                              flex: 1,
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: '#fef2f2',
                              paddingVertical: 9,
                              borderRadius: 999,
                              borderWidth: 1,
                              borderColor: '#fecaca',
                              gap: 6,
                            }}
                            activeOpacity={0.8}
                          >
                            <Feather name="trash-2" size={13} color="#ef4444" />
                            <Text style={{ color: '#ef4444', fontFamily: 'Inter_700Bold', fontSize: 12 }}>Apagar Definitivo</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <TouchableOpacity
                          onPress={() => handleDeletePatient(selectedPatient.id, selectedPatient.nome)}
                          style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#fef2f2',
                            paddingVertical: 9,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: '#fecaca',
                            gap: 6,
                          }}
                          activeOpacity={0.8}
                        >
                          <Feather name="trash" size={13} color="#ef4444" />
                          <Text style={{ color: '#ef4444', fontFamily: 'Inter_700Bold', fontSize: 12 }}>Mover p/ Lixeira</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Timeline Jornada */}
                  <View style={{ paddingHorizontal: 6 }}>
                    <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 16, marginBottom: 14 }}>
                      Jornada na Plataforma
                    </Text>

                    {patient360?.jornada && patient360.jornada.length > 0 ? (
                      patient360.jornada.map((evento: any, idx: number) => (
                        <View key={idx} style={{ flexDirection: 'row', marginBottom: 18 }}>
                          <View style={{ alignItems: 'center', marginRight: 14 }}>
                            <View style={{ width: 12, height: 12, borderRadius: 999, backgroundColor: '#10b981' }} />
                            {idx < patient360.jornada.length - 1 && (
                              <View style={{ width: 2, flex: 1, backgroundColor: '#e2e8f0', marginTop: 4 }} />
                            )}
                          </View>
                          <View style={{ flex: 1, paddingBottom: 4 }}>
                            <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 14 }}>{evento.acao}</Text>
                            <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 12, marginTop: 2 }}>{evento.detalhe}</Text>
                            <Text style={{ fontFamily: 'Inter_500Medium', color: '#94a3b8', fontSize: 10, marginTop: 4 }}>{evento.data}</Text>
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 12 }}>Nenhum histórico disponível.</Text>
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
