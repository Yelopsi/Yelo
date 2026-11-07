import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl, 
  TextInput, 
  Modal, 
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';
import YeloToast from '../../components/YeloToast';
import NativeSelectMenu from '../../components/NativeSelectMenu';

export default function AdminBacklogAjustesScreen() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState<any>({});
  const [groupedList, setGroupedList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pendente' | 'em_andamento' | 'concluido'>('all');
  
  // Collapse state by page name
  const [collapsedPages, setCollapsedPages] = useState<{ [key: string]: boolean }>({});

  // Modal Novo Ajuste
  const [showNewModal, setShowNewModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPage, setNewPage] = useState('');
  const [newEnvironment, setNewEnvironment] = useState<'mobile' | 'web' | 'backend' | 'geral'>('mobile');
  const [newPriority, setNewPriority] = useState<'baixa' | 'media' | 'alta' | 'urgente'>('media');
  const [newDescription, setNewDescription] = useState('');

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  const fetchAdjustments = async () => {
    try {
      const res = await api.get('/api/admin/adjustments');
      if (res.data) {
        setStats(res.data.stats || {});
        setGroupedList(res.data.grouped || []);
      }
    } catch (err: any) {
      console.error('Erro ao carregar ajustes:', err);
      setToastMessage('Falha ao carregar a lista de ajustes.');
      setToastType('error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAdjustments();
  }, []);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchAdjustments();
  }, []);

  const togglePageCollapse = (pageName: string) => {
    setCollapsedPages(prev => ({
      ...prev,
      [pageName]: !prev[pageName]
    }));
  };

  const handleToggleStatus = async (item: any) => {
    let nextStatus = 'em_andamento';
    if (item.status === 'pendente') nextStatus = 'em_andamento';
    else if (item.status === 'em_andamento') nextStatus = 'concluido';
    else if (item.status === 'concluido') nextStatus = 'pendente';

    try {
      await api.patch(`/api/admin/adjustments/${item.id}/status`, { status: nextStatus });
      setToastMessage(`Status atualizado para ${nextStatus.replace('_', ' ')}!`);
      setToastType('success');
      fetchAdjustments();
    } catch (err: any) {
      Alert.alert('Erro', 'Não foi possível alterar o status do item.');
    }
  };

  const handleDeleteItem = (id: number) => {
    Alert.alert(
      'Remover Ajuste',
      'Tem certeza que deseja excluir este item da fila?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/admin/adjustments/${id}`);
              setToastMessage('Ajuste excluído com sucesso.');
              setToastType('info');
              fetchAdjustments();
            } catch (err) {
              Alert.alert('Erro', 'Não foi possível excluir o ajuste.');
            }
          }
        }
      ]
    );
  };

  const handleCreateAdjustment = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Atenção', 'Informe o título do ajuste.');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post('/api/admin/adjustments', {
        title: newTitle.trim(),
        target_page: newPage.trim() || 'Geral',
        environment: newEnvironment,
        priority: newPriority,
        description: newDescription.trim()
      });

      setShowNewModal(false);
      setNewTitle('');
      setNewPage('');
      setNewDescription('');
      setToastMessage('Novo ajuste adicionado com sucesso!');
      setToastType('success');
      fetchAdjustments();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Erro ao registrar ajuste.';
      Alert.alert('Erro', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtragem dos grupos e itens
  const filteredGroups = groupedList.map(group => {
    const items = group.items.filter((item: any) => {
      const matchesSearch = !searchQuery || 
        item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.target_page?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    return {
      ...group,
      filteredItems: items
    };
  }).filter(group => group.filteredItems.length > 0);

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#f8fafc] items-center justify-center p-6">
        <ActivityIndicator size="large" color="#1B4332" />
        <Text className="font-sans text-[#64748b] mt-3">Carregando backlog de ajustes...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#f8fafc]">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 18, paddingBottom: 130 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#1B4332" />}
      >
        {/* HEADER */}
        <View className="bg-[#1B4332] rounded-[24px] p-5 mb-5 shadow-sm relative overflow-hidden">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-2">
              <View className="w-10 h-10 rounded-full bg-white/10 items-center justify-center">
                <Feather name="check-square" size={20} color="#FFEE8C" />
              </View>
              <View>
                <Text className="font-title text-white text-[22px]">Central de Ajustes</Text>
                <Text className="font-sans text-white/70 text-[12px]">Notion Flow • Fila de Melhorias</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => setShowNewModal(true)}
              className="bg-[#FFEE8C] px-3.5 py-2 rounded-full flex-row items-center gap-1.5 shadow-sm"
              activeOpacity={0.8}
            >
              <Feather name="plus" size={16} color="#1B4332" />
              <Text className="font-sans font-bold text-[#1B4332] text-[12px]">Novo</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* KPI CARDS */}
        <View className="flex-row gap-2.5 mb-4">
          <View className="flex-1 bg-white p-3.5 rounded-[18px] border border-[#e2e8f0] shadow-xs">
            <Text className="font-sans text-[11px] text-[#64748b] font-semibold uppercase">Total</Text>
            <Text className="font-title text-[#1e293b] text-[20px] mt-0.5">{stats?.total || 0}</Text>
          </View>
          <View className="flex-1 bg-white p-3.5 rounded-[18px] border border-[#fef08a] shadow-xs">
            <Text className="font-sans text-[11px] text-[#ca8a04] font-semibold uppercase">Pendentes</Text>
            <Text className="font-title text-[#ca8a04] text-[20px] mt-0.5">{stats?.pendentes || 0}</Text>
          </View>
          <View className="flex-1 bg-white p-3.5 rounded-[18px] border border-[#bfdbfe] shadow-xs">
            <Text className="font-sans text-[11px] text-[#2563eb] font-semibold uppercase">Andamento</Text>
            <Text className="font-title text-[#2563eb] text-[20px] mt-0.5">{stats?.em_andamento || 0}</Text>
          </View>
          <View className="flex-1 bg-white p-3.5 rounded-[18px] border border-[#bbf7d0] shadow-xs">
            <Text className="font-sans text-[11px] text-[#16a34a] font-semibold uppercase">Concluídos</Text>
            <Text className="font-title text-[#16a34a] text-[20px] mt-0.5">{stats?.concluidos || 0}</Text>
          </View>
        </View>

        {/* SEARCH BAR */}
        <View className="bg-white border border-[#e2e8f0] rounded-[16px] px-3.5 py-2.5 flex-row items-center gap-2 mb-3 shadow-xs">
          <Feather name="search" size={17} color="#94a3b8" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Buscar por ajuste, tela ou descrição..."
            placeholderTextColor="#94a3b8"
            className="flex-1 font-sans text-[13.5px] text-[#1e293b]"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x-circle" size={16} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* STATUS FILTER DROPDOWN (NATIVO - SEM SCROLL HORIZONTAL) */}
        <View className="mb-4">
          <NativeSelectMenu
            title="Filtrar por Status do Ajuste"
            options={[
              { label: 'Todos os Status', value: 'all' },
              { label: 'Pendentes', value: 'pendente' },
              { label: 'Em Andamento', value: 'em_andamento' },
              { label: 'Concluídos', value: 'concluido' },
            ]}
            selectedValue={statusFilter}
            onSelect={(val) => setStatusFilter(val as any)}
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
                  Filtrar Status:
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
                  {statusFilter === 'all'
                    ? 'Todos'
                    : statusFilter === 'pendente'
                    ? 'Pendentes'
                    : statusFilter === 'em_andamento'
                    ? 'Em Andamento'
                    : 'Concluídos'}
                </Text>
              </View>
              <Feather name="chevron-down" size={16} color="#1B4332" />
            </View>
          </NativeSelectMenu>
        </View>

        {/* AGRUPAMENTO POR PÁGINAS (NOTION STYLE) */}
        {filteredGroups.length === 0 ? (
          <View className="bg-white rounded-[20px] p-8 items-center justify-center border border-[#e2e8f0]">
            <Feather name="inbox" size={36} color="#cbd5e1" />
            <Text className="font-title text-[#475569] text-[16px] mt-2">Nenhum ajuste encontrado</Text>
            <Text className="font-sans text-[#94a3b8] text-[12.5px] text-center mt-1">
              Todos os ajustes para este filtro estão finalizados ou não existem.
            </Text>
          </View>
        ) : (
          filteredGroups.map(group => {
            const isCollapsed = collapsedPages[group.pageName];
            return (
              <View 
                key={group.pageName} 
                className="bg-white rounded-[20px] border border-[#e2e8f0] mb-3.5 overflow-hidden shadow-xs"
              >
                {/* Header do Grupo / Página */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => togglePageCollapse(group.pageName)}
                  className="px-4 py-3 bg-[#f8fafc] border-b border-[#e2e8f0] flex-row items-center justify-between"
                >
                  <View className="flex-row items-center gap-2 flex-1 mr-2">
                    <Feather 
                      name={isCollapsed ? "chevron-right" : "chevron-down"} 
                      size={18} 
                      color="#64748b" 
                    />
                    <Text className="font-title text-[#1e293b] text-[15px]" numberOfLines={1}>
                      📄 {group.pageName}
                    </Text>
                  </View>

                  <View className="flex-row items-center gap-1.5">
                    <View className="bg-[#e0e7ff] px-2 py-0.5 rounded-full">
                      <Text className="font-sans font-bold text-[#4338ca] text-[10.5px]">
                        {group.filteredItems.length} {group.filteredItems.length === 1 ? 'item' : 'itens'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Lista de Itens do Grupo */}
                {!isCollapsed && (
                  <View className="p-3 gap-2.5">
                    {group.filteredItems.map((item: any) => {
                      const isDone = item.status === 'concluido';
                      const isInProgress = item.status === 'em_andamento';

                      const priorityColors: { [k: string]: { bg: string; text: string } } = {
                        urgente: { bg: 'bg-[#fee2e2]', text: 'text-[#dc2626]' },
                        alta: { bg: 'bg-[#ffedd5]', text: 'text-[#ea580c]' },
                        media: { bg: 'bg-[#fef9c3]', text: 'text-[#ca8a04]' },
                        baixa: { bg: 'bg-[#f1f5f9]', text: 'text-[#64748b]' }
                      };
                      const prio = priorityColors[item.priority] || priorityColors.media;

                      return (
                        <View
                          key={item.id}
                          className={`p-3 rounded-[14px] border ${
                            isDone 
                              ? 'bg-[#f8fafc] border-[#e2e8f0] opacity-75' 
                              : isInProgress
                              ? 'bg-[#eff6ff] border-[#bfdbfe]'
                              : 'bg-white border-[#e2e8f0]'
                          }`}
                        >
                          <View className="flex-row items-start justify-between gap-2 mb-1.5">
                            {/* Checkbox / Botão de Status */}
                            <TouchableOpacity
                              onPress={() => handleToggleStatus(item)}
                              className="flex-row items-start gap-2.5 flex-1"
                              activeOpacity={0.7}
                            >
                              <View 
                                className={`w-5 h-5 rounded-md items-center justify-center mt-0.5 border ${
                                  isDone 
                                    ? 'bg-[#16a34a] border-[#16a34a]' 
                                    : isInProgress 
                                    ? 'bg-[#2563eb] border-[#2563eb]' 
                                    : 'bg-white border-[#cbd5e1]'
                                }`}
                              >
                                {isDone && <Feather name="check" size={14} color="white" />}
                                {isInProgress && <Feather name="clock" size={12} color="white" />}
                              </View>

                              <View className="flex-1">
                                <Text 
                                  className={`font-sans font-bold text-[14px] leading-tight ${
                                    isDone ? 'text-[#94a3b8] line-through' : 'text-[#1e293b]'
                                  }`}
                                >
                                  {item.title}
                                </Text>
                              </View>
                            </TouchableOpacity>

                            {/* Tags e Ações */}
                            <View className="flex-row items-center gap-1.5">
                              <View className={`px-2 py-0.5 rounded-full ${prio.bg}`}>
                                <Text className={`font-sans font-bold text-[9.5px] uppercase ${prio.text}`}>
                                  {item.priority || 'média'}
                                </Text>
                              </View>

                              <TouchableOpacity
                                onPress={() => handleDeleteItem(item.id)}
                                className="p-1"
                              >
                                <Feather name="trash-2" size={14} color="#94a3b8" />
                              </TouchableOpacity>
                            </View>
                          </View>

                          {/* Descrição se houver */}
                          {item.description ? (
                            <Text className="font-sans text-[12px] text-[#475569] leading-relaxed ml-7 mb-2">
                              {item.description}
                            </Text>
                          ) : null}

                          {/* Screenshot se houver */}
                          {item.screenshot_url ? (
                            <View className="ml-7 mt-1 rounded-lg overflow-hidden border border-[#e2e8f0]">
                              <Image 
                                source={{ uri: item.screenshot_url }} 
                                style={{ width: '100%', height: 140 }}
                                resizeMode="cover"
                              />
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* MODAL NOVO AJUSTE */}
      <Modal
        visible={showNewModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowNewModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 justify-end bg-black/60"
        >
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={() => setShowNewModal(false)} 
            className="flex-1"
          />

          <View className="bg-white rounded-t-[32px] w-full max-h-[88%] shadow-2xl border-t border-[#f0f0f0] px-6 pt-3 pb-8">
            <View className="w-12 h-1.5 bg-[#d1d5db] rounded-full self-center mb-3" />

            <View className="flex-row items-center justify-between mb-4 pb-2 border-b border-[#f1f5f9]">
              <Text className="font-title text-[#1B4332] text-[19px]">Criar Novo Ajuste</Text>
              <TouchableOpacity 
                onPress={() => setShowNewModal(false)}
                className="w-8 h-8 rounded-full bg-[#f1f5f9] items-center justify-center"
              >
                <Feather name="x" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View className="mb-3">
                <Text className="font-sans text-[12px] font-semibold text-[#475569] mb-1">
                  Título do Ajuste *
                </Text>
                <TextInput
                  value={newTitle}
                  onChangeText={setNewTitle}
                  placeholder="Ex: Ajustar alinhamento do botão na tela de perfil"
                  placeholderTextColor="#94a3b8"
                  className="bg-[#f8fafc] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-[#1e293b] font-sans text-[13.5px]"
                />
              </View>

              <View className="mb-3">
                <Text className="font-sans text-[12px] font-semibold text-[#475569] mb-1">
                  Página de Destino / Arquivo
                </Text>
                <TextInput
                  value={newPage}
                  onChangeText={setNewPage}
                  placeholder="Ex: psi_dashboard.html ou meu_perfil.tsx"
                  placeholderTextColor="#94a3b8"
                  className="bg-[#f8fafc] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-[#1e293b] font-sans text-[13.5px]"
                />
              </View>

              {/* Ambiente */}
              <View className="mb-3">
                <Text className="font-sans text-[12px] font-semibold text-[#475569] mb-1">Ambiente</Text>
                <View className="flex-row gap-2">
                  {(['mobile', 'web', 'backend', 'geral'] as const).map(env => (
                    <TouchableOpacity
                      key={env}
                      onPress={() => setNewEnvironment(env)}
                      className={`flex-1 py-2 rounded-xl items-center border ${
                        newEnvironment === env
                          ? 'bg-[#1B4332] border-[#1B4332]'
                          : 'bg-[#f8fafc] border-[#cbd5e1]'
                      }`}
                    >
                      <Text
                        className={`font-sans text-[11px] font-bold uppercase ${
                          newEnvironment === env ? 'text-white' : 'text-[#64748b]'
                        }`}
                      >
                        {env}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Prioridade */}
              <View className="mb-3">
                <Text className="font-sans text-[12px] font-semibold text-[#475569] mb-1">Prioridade</Text>
                <View className="flex-row gap-2">
                  {(['baixa', 'media', 'alta', 'urgente'] as const).map(p => (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setNewPriority(p)}
                      className={`flex-1 py-2 rounded-xl items-center border ${
                        newPriority === p
                          ? 'bg-[#1B4332] border-[#1B4332]'
                          : 'bg-[#f8fafc] border-[#cbd5e1]'
                      }`}
                    >
                      <Text
                        className={`font-sans text-[11px] font-bold uppercase ${
                          newPriority === p ? 'text-white' : 'text-[#64748b]'
                        }`}
                      >
                        {p}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Descrição */}
              <View className="mb-4">
                <Text className="font-sans text-[12px] font-semibold text-[#475569] mb-1">
                  Descrição detalhada
                </Text>
                <TextInput
                  value={newDescription}
                  onChangeText={setNewDescription}
                  placeholder="Explique o que precisa ser ajustado..."
                  placeholderTextColor="#94a3b8"
                  multiline
                  numberOfLines={4}
                  style={{ minHeight: 80, textAlignVertical: 'top' }}
                  className="bg-[#f8fafc] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-[#1e293b] font-sans text-[13.5px]"
                />
              </View>

              <TouchableOpacity
                onPress={handleCreateAdjustment}
                disabled={isSubmitting}
                className="bg-[#1B4332] w-full py-3.5 rounded-[50px] items-center shadow-sm"
              >
                {isSubmitting ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="font-sans font-bold text-white text-[14px]">
                    Cadastrar Ajuste na Fila
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <YeloToast 
        message={toastMessage} 
        onDismiss={() => setToastMessage(null)} 
        type={toastType} 
      />
    </View>
  );
}

