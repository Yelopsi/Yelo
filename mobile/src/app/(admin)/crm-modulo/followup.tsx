import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl, 
  TextInput, 
  Alert,
  Linking
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import api from '../../../services/api';
import YeloToast from '../../../components/YeloToast';

export default function AdminFollowupScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [followups, setFollowups] = useState<any[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'scheduled' | 'not_scheduled'>('all');

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  const fetchFollowups = async () => {
    try {
      const res = await api.get('/api/admin/followups');
      if (Array.isArray(res.data)) {
        setFollowups(res.data);
      } else if (res.data?.data) {
        setFollowups(res.data.data);
      }
    } catch (err: any) {
      console.error('Erro ao buscar followups:', err);
      setToastMessage('Falha ao carregar lista de follow-up.');
      setToastType('error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFollowups();
  }, []);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchFollowups();
  }, []);

  const handleUpdateStatus = async (item: any, newStatus: string) => {
    try {
      await api.put(`/api/admin/followups/${item.id}`, { status: newStatus });
      setToastMessage(`Status atualizado para ${newStatus === 'scheduled' ? 'Agendado' : newStatus === 'not_scheduled' ? 'Não Agendou' : 'Pendente'}!`);
      setToastType('success');
      setFollowups(prev => prev.map(f => f.id === item.id ? { ...f, status: newStatus } : f));
    } catch (err: any) {
      Alert.alert('Erro', 'Não foi possível alterar o status do follow-up.');
    }
  };

  const handleOpenWhatsApp = (phone: string, targetName: string, psiName: string) => {
    if (!phone) {
      Alert.alert('Sem Telefone', 'O contato não possui número de telefone registrado.');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const prefix = cleanPhone.startsWith('55') ? '' : '55';
    const text = `Olá, ${targetName.split(' ')[0]}! Tudo bem? Sou da equipe de acolhimento da Yelo. Vi que você buscou contato com o(a) psicólogo(a) ${psiName}. Deu tudo certo com o seu atendimento? Posso ajudar em algo?`;
    Linking.openURL(`https://wa.me/${prefix}${cleanPhone}?text=${encodeURIComponent(text)}`).catch(() => {
      Alert.alert('Erro', 'Não foi possível abrir o WhatsApp.');
    });
  };

  const filteredItems = followups.filter(item => {
    const target = item.targetName || item.patientName || '';
    const psi = item.psychologistName || '';
    const phone = item.targetPhone || '';

    const matchesSearch = !searchQuery ||
      target.toLowerCase().includes(searchQuery.toLowerCase()) ||
      psi.toLowerCase().includes(searchQuery.toLowerCase()) ||
      phone.includes(searchQuery);

    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalCount = followups.length;
  const pendingCount = followups.filter(f => !f.status || f.status === 'pending').length;
  const scheduledCount = followups.filter(f => f.status === 'scheduled').length;

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#f8fafc] items-center justify-center p-6">
        <ActivityIndicator size="large" color="#1B4332" />
        <Text className="font-sans text-[#64748b] mt-3">Carregando contatos de follow-up...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#f8fafc]">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 18, paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#1B4332" />}
      >
        {/* HEADER */}
        <View className="bg-[#1B4332] rounded-[24px] p-5 mb-5 shadow-sm relative overflow-hidden">
          <View className="flex-row items-center gap-2 mb-1.5">
            <View className="w-9 h-9 rounded-full bg-[#10b981] items-center justify-center">
              <Feather name="phone-call" size={18} color="white" />
            </View>
            <View className="flex-1">
              <Text className="font-title text-white text-[22px]">Follow-up WhatsApp 📱</Text>
              <Text className="font-sans text-white/80 text-[12px]">
                Acompanhe e recupere contatos de pacientes
              </Text>
            </View>
          </View>
        </View>

        {/* KPIS */}
        <View className="flex-row gap-2.5 mb-4">
          <View className="flex-1 bg-white p-3.5 rounded-[18px] border border-[#e2e8f0] shadow-xs">
            <Text className="font-sans text-[11px] text-[#64748b] font-semibold uppercase">Total</Text>
            <Text className="font-title text-[#1B4332] text-[20px] mt-0.5">{totalCount}</Text>
          </View>

          <View className="flex-1 bg-white p-3.5 rounded-[18px] border border-[#fef08a] shadow-xs">
            <Text className="font-sans text-[11px] text-[#ca8a04] font-semibold uppercase">Pendentes</Text>
            <Text className="font-title text-[#ca8a04] text-[20px] mt-0.5">{pendingCount}</Text>
          </View>

          <View className="flex-1 bg-white p-3.5 rounded-[18px] border border-[#bbf7d0] shadow-xs">
            <Text className="font-sans text-[11px] text-[#16a34a] font-semibold uppercase">Agendados</Text>
            <Text className="font-title text-[#16a34a] text-[20px] mt-0.5">{scheduledCount}</Text>
          </View>
        </View>

        {/* SEARCH BAR */}
        <View className="bg-white border border-[#e2e8f0] rounded-[16px] px-3.5 py-2.5 flex-row items-center gap-2 mb-3 shadow-xs">
          <Feather name="search" size={17} color="#94a3b8" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Buscar por paciente, psicólogo ou telefone..."
            placeholderTextColor="#94a3b8"
            className="flex-1 font-sans text-[13.5px] text-[#1e293b]"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x-circle" size={16} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* STATUS FILTER PILLS */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
          <View className="flex-row gap-2">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'pending', label: 'Pendentes' },
              { id: 'scheduled', label: 'Agendados ✅' },
              { id: 'not_scheduled', label: 'Não Agendou ⚠️' },
            ].map(tab => (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setStatusFilter(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-full border ${
                  statusFilter === tab.id
                    ? 'bg-[#1B4332] border-[#1B4332]'
                    : 'bg-white border-[#e2e8f0]'
                }`}
              >
                <Text className={`font-sans text-[12px] font-bold ${
                  statusFilter === tab.id ? 'text-white' : 'text-[#64748b]'
                }`}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* LISTA DE FOLLOW-UP */}
        <View className="gap-3">
          {filteredItems.length === 0 ? (
            <View className="bg-white rounded-[20px] p-8 items-center justify-center border border-[#e2e8f0]">
              <Feather name="message-square" size={36} color="#cbd5e1" />
              <Text className="font-title text-[#475569] text-[16px] mt-2">Nenhum follow-up encontrado</Text>
            </View>
          ) : (
            filteredItems.map((item: any) => {
              const targetName = item.targetName || item.patientName || 'Visitante';
              const targetPhone = item.targetPhone || item.patientPhone || '';
              const psiName = item.psychologistName || 'Psicólogo';
              const isScheduled = item.status === 'scheduled';
              const isNotScheduled = item.status === 'not_scheduled';
              const dateDisplay = item.date ? new Date(item.date).toLocaleDateString('pt-BR') : '';

              return (
                <View 
                  key={item.id} 
                  className="bg-white rounded-[20px] border border-[#e2e8f0] p-4 shadow-xs"
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center gap-1.5">
                      <Feather name="clock" size={12} color="#94a3b8" />
                      <Text className="font-sans text-[11px] text-[#94a3b8]">{dateDisplay}</Text>
                    </View>

                    {/* Badge de Status */}
                    <View className={`px-2.5 py-0.5 rounded-full ${
                      isScheduled 
                        ? 'bg-[#dcfce7] border border-[#bbf7d0]' 
                        : isNotScheduled 
                        ? 'bg-[#fee2e2] border border-[#fecaca]' 
                        : 'bg-[#fef9c3] border border-[#fef08a]'
                    }`}>
                      <Text className={`font-sans font-bold text-[10px] ${
                        isScheduled ? 'text-[#166534]' : isNotScheduled ? 'text-[#dc2626]' : 'text-[#854d0e]'
                      }`}>
                        {isScheduled ? 'Agendado' : isNotScheduled ? 'Não Agendou' : 'Pendente'}
                      </Text>
                    </View>
                  </View>

                  <Text className="font-title text-[#1e293b] text-[16px] mb-0.5">
                    👤 {targetName}
                  </Text>
                  <Text className="font-sans text-[#64748b] text-[12px] mb-1">
                    📞 {targetPhone || 'Telefone não registrado'}
                  </Text>
                  <Text className="font-sans text-[#475569] text-[12.5px] mb-3">
                    Buscava atendimento com: <Text className="font-bold text-[#1B4332]">{psiName}</Text>
                  </Text>

                  {/* Ações: Status rápido + WhatsApp */}
                  <View className="flex-row gap-2 pt-2 border-t border-[#f1f5f9]">
                    <TouchableOpacity
                      onPress={() => handleUpdateStatus(item, isScheduled ? 'pending' : 'scheduled')}
                      className={`flex-1 py-2 rounded-xl items-center border ${
                        isScheduled ? 'bg-[#f0fdf4] border-[#bbf7d0]' : 'bg-[#f8fafc] border-[#cbd5e1]'
                      }`}
                      activeOpacity={0.7}
                    >
                      <Text className="font-sans text-[11px] font-bold text-[#166534]">
                        {isScheduled ? '✓ Agendado' : 'Marcar Agendado'}
                      </Text>
                    </TouchableOpacity>

                    {targetPhone ? (
                      <TouchableOpacity
                        onPress={() => handleOpenWhatsApp(targetPhone, targetName, psiName)}
                        className="bg-[#25d366] px-3.5 py-2 rounded-xl flex-row items-center gap-1.5 shadow-xs"
                        activeOpacity={0.85}
                      >
                        <Feather name="message-circle" size={14} color="white" />
                        <Text className="font-sans font-bold text-white text-[11px]">
                          WhatsApp
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <YeloToast 
        message={toastMessage} 
        onDismiss={() => setToastMessage(null)} 
        type={toastType} 
      />
    </View>
  );
}

