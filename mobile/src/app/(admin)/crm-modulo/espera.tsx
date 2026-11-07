import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Alert,
  Share,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import api from '../../../services/api';
import NativeSelectMenu from '../../../components/NativeSelectMenu';

// Máscara de Telefone
function mascaraTelefone(tel: string): string {
  if (!tel) return '';
  const r = tel.replace(/\D/g, '');
  if (r.length === 11) return r.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
  if (r.length === 10) return r.replace(/^(\d{2})(\d{4})(\d{4}).*/, '($1) $2-$3');
  return tel;
}

export default function AdminCRMListaEsperaScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('pending'); // 'all', 'pending', 'invited'
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Paginação (20 por página)
  const [currentPage, setCurrentPage] = useState(1);
  const LEADS_PER_PAGE = 20;

  // Busca dados da Lista de Espera da API
  const fetchWaitingList = useCallback(async (isManualRefresh = false) => {
    try {
      if (!isManualRefresh) setLoading(true);

      const response = await api.get('/api/psychologists/waiting-list');
      const data = response.data;
      setLeads(Array.isArray(data) ? data : []);
      setCurrentPage(1);
    } catch (error: any) {
      console.warn('[AdminWaitlist] Erro ao buscar lista de espera:', error?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchWaitingList();
  }, [fetchWaitingList]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchWaitingList(true);
  }, [fetchWaitingList]);

  // Contadores de Status
  const kpis = useMemo(() => {
    const total = leads.length;
    const pendentes = leads.filter((l) => l.status === 'pending').length;
    const convidados = leads.filter((l) => l.status === 'invited').length;
    return { total, pendentes, convidados };
  }, [leads]);

  // Filtragem (Filtro do Funil + Busca Textual)
  const filteredLeads = useMemo(() => {
    return leads.filter((item) => {
      // Filtro de estágio
      if (activeFilter !== 'all' && item.status !== activeFilter) {
        return false;
      }
      // Filtro de busca
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const nome = (item.nome || '').toLowerCase();
        const email = (item.email || '').toLowerCase();
        const crp = (item.crp || '').toLowerCase();
        const tel = (item.telefone || '').replace(/\D/g, '');
        return nome.includes(term) || email.includes(term) || crp.includes(term) || tel.includes(term);
      }
      return true;
    });
  }, [leads, activeFilter, searchTerm]);

  // Paginação
  const totalPages = Math.ceil(filteredLeads.length / LEADS_PER_PAGE) || 1;
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * LEADS_PER_PAGE;
    return filteredLeads.slice(start, start + LEADS_PER_PAGE);
  }, [filteredLeads, currentPage]);

  // Ação WhatsApp de Recuperação Inbound
  const handleContatarWhatsApp = async (lead: any) => {
    if (!lead || !lead.telefone) {
      Alert.alert('Atenção', 'Lead sem telefone válido cadastrado.');
      return;
    }

    try {
      setActionLoadingId(`${lead.id}_wpp`);

      let phone = lead.telefone.replace(/\D/g, '');
      if (phone.length === 10 || phone.length === 11) {
        phone = '55' + phone;
      }

      const firstName = lead.nome ? lead.nome.trim().split(' ')[0] : 'Profissional';
      const text = `Olá, ${firstName}! Tudo bem?\n\nAqui é da equipe da Yelo. Vimos que você iniciou o seu cadastro na plataforma mas acabou não finalizando.\n\nFicou alguma dúvida ou teve alguma dificuldade técnica? Estamos à disposição para te ajudar a liberar seu perfil!\n\nwww.yelopsi.com.br/psi-registro?utm_source=whatsapp&utm_medium=recuperacao_inbound`;

      const urlApp = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(text)}`;
      const urlWeb = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;

      const canOpen = await Linking.canOpenURL(urlApp);
      if (canOpen) {
        await Linking.openURL(urlApp);
      } else {
        await Linking.openURL(urlWeb);
      }

      // Atualiza status para 'invited' na API (usando endpoint de invite ou status)
      await api.post('/api/psychologists/waiting-list/invite', { waitingListId: lead.id }).catch(() => {});

      // Atualiza localmente
      setLeads((prev) =>
        prev.map((item) => (item.id === lead.id ? { ...item, status: 'invited' } : item))
      );
    } catch (err: any) {
      Alert.alert('Erro', 'Não foi possível acionar o WhatsApp: ' + (err?.message || ''));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Enviar Convite por E-mail
  const handleEnviarConviteEmail = async (lead: any) => {
    try {
      setActionLoadingId(`${lead.id}_email`);
      const response = await api.post('/api/psychologists/waiting-list/invite', {
        waitingListId: lead.id,
      });

      Alert.alert('Sucesso', response.data?.message || `Convite enviado para ${lead.email}.`);

      setLeads((prev) =>
        prev.map((item) => (item.id === lead.id ? { ...item, status: 'invited' } : item))
      );
    } catch (err: any) {
      Alert.alert('Erro', 'Falha ao enviar convite por e-mail: ' + (err?.message || ''));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Excluir Lead da Lista de Espera
  const handleExcluirLead = (lead: any) => {
    Alert.alert(
      'Excluir Lead',
      `Tem certeza que deseja remover ${lead.nome || 'este lead'} da lista de espera? Essa ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoadingId(`${lead.id}_del`);
              await api.delete(`/api/psychologists/waiting-list/${lead.id}`);
              setLeads((prev) => prev.filter((item) => item.id !== lead.id));
            } catch (err: any) {
              Alert.alert('Erro', 'Erro ao excluir lead: ' + (err?.message || ''));
            } finally {
              setActionLoadingId(null);
            }
          },
        },
      ]
    );
  };

  // Exportar Lista de Espera como CSV
  const handleExportarCSV = async () => {
    try {
      if (filteredLeads.length === 0) {
        Alert.alert('Vazio', 'Nenhum lead encontrado para exportar.');
        return;
      }

      let csv = 'Nome;Email;CRP;Telefone;Status;Data de Entrada\n';
      filteredLeads.forEach((l) => {
        const nome = (l.nome || '').replace(/;/g, '');
        const email = (l.email || '').replace(/;/g, '');
        const crp = (l.crp || 'N/A').replace(/;/g, '');
        const tel = mascaraTelefone(l.telefone || '');
        const st = l.status === 'invited' ? 'Convidado' : 'Pendente';
        const data = l.createdAt ? new Date(l.createdAt).toLocaleDateString('pt-BR') : '-';
        csv += `"${nome}";"${email}";"${crp}";"${tel}";"${st}";"${data}"\n`;
      });

      await Share.share({
        title: 'Leads_Inbound_Espera.csv',
        message: csv,
      });
    } catch (err: any) {
      Alert.alert('Erro ao exportar', err.message);
    }
  };

  return (
    <View className="flex-1 bg-[#f8fafc]">
      <StatusBar style="dark" />
      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 150 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1B4332" />}
      >
        {/* Barra de Navegação Superior (Voltar ao CRM Hub + Badge Admin) */}
        <View className="mb-3.5 flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(admin)/crm'))}
            activeOpacity={0.7}
            className="flex-row items-center bg-white px-3.5 py-2 rounded-full border border-slate-200 shadow-xs"
          >
            <Feather name="arrow-left" size={16} color="#1B4332" />
            <Text className="font-sans text-[#1B4332] text-xs font-semibold ml-1.5">CRM Hub</Text>
          </TouchableOpacity>

          <View className="bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full flex-row items-center gap-1.5">
            <Text className="text-[12px]">🛡️</Text>
            <Text className="font-sans font-bold text-emerald-800 text-[11px]">Admin</Text>
          </View>
        </View>

        {/* ========================================================= */}
        {/* 1. HERO CARD SUPERIOR (GRADIENTE YELO IDENTICO À WEB)     */}
        {/* ========================================================= */}
        <LinearGradient
          colors={['#1B4332', '#2A5A40']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 24,
            padding: 20,
            marginBottom: 20,
            shadowColor: '#1B4332',
            shadowOpacity: 0.12,
            shadowRadius: 35,
            shadowOffset: { width: 0, height: 12 },
            elevation: 5,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Efeito decorativo de fundo */}
          <View className="absolute -top-[50px] -right-[50px] w-[200px] h-[200px] bg-white/5 rounded-full pointer-events-none" />

          {/* Cabeçalho do Card */}
          <View className="flex-row justify-between items-start mb-4">
            <View className="flex-1 pr-3">
              <Text className="font-title text-white text-[22px] font-bold leading-tight mb-1">
                Leads Inbound (Espera)
              </Text>
              <Text className="font-sans text-white/85 text-[12px] leading-4">
                Profissionais que iniciaram o preenchimento do questionário mas não finalizaram.
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onRefresh}
              className="bg-[#FFEE8C] px-3.5 py-1.5 rounded-full flex-row items-center gap-1.5 shadow-sm"
            >
              <Feather name="refresh-cw" size={12} color="#1B4332" />
              <Text className="font-sans font-bold text-[#1B4332] text-[11px]">Atualizar</Text>
            </TouchableOpacity>
          </View>

          {/* Mini-resumo de status */}
          <View className="flex-row gap-2 pt-2 border-t border-white/10">
            <View className="flex-1 bg-white/10 rounded-xl p-2 items-center">
              <Text className="font-sans text-white/70 text-[10px] uppercase font-bold">Pendentes</Text>
              <Text className="font-title text-[#fef08a] text-[16px]">{kpis.pendentes}</Text>
            </View>
            <View className="flex-1 bg-white/10 rounded-xl p-2 items-center">
              <Text className="font-sans text-white/70 text-[10px] uppercase font-bold">Convidados</Text>
              <Text className="font-title text-[#86efac] text-[16px]">{kpis.convidados}</Text>
            </View>
            <View className="flex-1 bg-white/10 rounded-xl p-2 items-center">
              <Text className="font-sans text-white/70 text-[10px] uppercase font-bold">Total Inbound</Text>
              <Text className="font-title text-white text-[16px]">{kpis.total}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ========================================================= */}
        {/* 2. KPIS DE FUNIL DE ESPERA                                */}
        {/* ========================================================= */}
        <View className="mb-5">
          <View className="flex-row items-center justify-between mb-2.5">
            <Text className="font-title text-[#1e293b] text-[18px]">Métricas de Retenção</Text>
            <Text className="font-sans text-[#64748b] text-[12px]">Toque para filtrar</Text>
          </View>

          <View className="flex-row gap-2.5">
            {/* Apenas Pendentes */}
            <TouchableOpacity
              onPress={() => setActiveFilter(activeFilter === 'pending' ? 'all' : 'pending')}
              activeOpacity={0.8}
              style={{
                flex: 1,
                backgroundColor: activeFilter === 'pending' ? '#fffbeb' : '#ffffff',
                borderRadius: 16,
                padding: 14,
                borderWidth: 1,
                borderColor: activeFilter === 'pending' ? '#f59e0b' : '#e2e8f0',
                overflow: 'hidden',
                position: 'relative',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 3,
                elevation: 1,
              }}
            >
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3.5, backgroundColor: '#f59e0b' }} />
              <View className="flex-row items-center gap-1.5 mb-1">
                <Feather name="clock" size={13} color="#f59e0b" />
                <Text className="font-sans font-bold text-[#475569] text-[11px]">Pendentes</Text>
              </View>
              <Text className="font-title text-[#f59e0b] text-[24px] mt-1">{kpis.pendentes}</Text>
              <Text className="font-sans text-[#b45309] font-medium text-[11px] mt-0.5">Sem convite</Text>
            </TouchableOpacity>

            {/* Já Contatados */}
            <TouchableOpacity
              onPress={() => setActiveFilter(activeFilter === 'invited' ? 'all' : 'invited')}
              activeOpacity={0.8}
              style={{
                flex: 1,
                backgroundColor: activeFilter === 'invited' ? '#ecfdf5' : '#ffffff',
                borderRadius: 16,
                padding: 14,
                borderWidth: 1,
                borderColor: activeFilter === 'invited' ? '#10b981' : '#e2e8f0',
                overflow: 'hidden',
                position: 'relative',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 3,
                elevation: 1,
              }}
            >
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3.5, backgroundColor: '#10b981' }} />
              <View className="flex-row items-center gap-1.5 mb-1">
                <Feather name="check-circle" size={13} color="#10b981" />
                <Text className="font-sans font-bold text-[#475569] text-[11px]">Convidados</Text>
              </View>
              <Text className="font-title text-[#10b981] text-[24px] mt-1">{kpis.convidados}</Text>
              <Text className="font-sans text-emerald-600 font-medium text-[11px] mt-0.5">Com link enviado</Text>
            </TouchableOpacity>

            {/* Total Inbound */}
            <TouchableOpacity
              onPress={() => setActiveFilter('all')}
              activeOpacity={0.8}
              style={{
                flex: 1,
                backgroundColor: activeFilter === 'all' ? '#ecfdf5' : '#ffffff',
                borderRadius: 16,
                padding: 14,
                borderWidth: 1,
                borderColor: activeFilter === 'all' ? '#1B4332' : '#e2e8f0',
                overflow: 'hidden',
                position: 'relative',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 3,
                elevation: 1,
              }}
            >
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3.5, backgroundColor: '#1B4332' }} />
              <View className="flex-row items-center gap-1.5 mb-1">
                <Feather name="users" size={13} color="#1B4332" />
                <Text className="font-sans font-bold text-[#475569] text-[11px]">Total Fila</Text>
              </View>
              <Text className="font-title text-[#1B4332] text-[24px] mt-1">{kpis.total}</Text>
              <Text className="font-sans text-slate-500 font-medium text-[11px] mt-0.5">Questionário</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ========================================================= */}
        {/* 3. FILTRO DE STATUS DA FILA (DROPDOWN NATIVO)             */}
        {/* ========================================================= */}
        <View className="mb-3.5">
          <NativeSelectMenu
            title="Filtrar Lista de Espera"
            options={[
              { label: 'Todos os Leads da Fila', value: 'all' },
              { label: 'Apenas Pendentes (Aguardando Convite)', value: 'pending' },
              { label: 'Já Contatados / Convidados', value: 'invited' },
            ]}
            selectedValue={activeFilter}
            onSelect={(val) => {
              setActiveFilter(val);
              setCurrentPage(1);
            }}
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
                paddingVertical: 11,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
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
                  {activeFilter === 'pending'
                    ? 'Apenas Pendentes'
                    : activeFilter === 'invited'
                    ? 'Já Contatados'
                    : 'Todos os Leads da Fila'}
                </Text>
              </View>
              <Feather name="chevron-down" size={16} color="#1B4332" />
            </View>
          </NativeSelectMenu>
        </View>

        {/* ========================================================= */}
        {/* 4. BUSCA & AÇÕES (EXPORTAR CSV)                           */}
        {/* ========================================================= */}
        <View className="mb-3.5">
          <View className="bg-white rounded-full px-4 py-2.5 border border-[#e2e8f0] flex-row items-center mb-2.5 shadow-xs">
            <Feather name="search" size={17} color="#94a3b8" />
            <TextInput
              placeholder="Buscar por nome, email ou CRP..."
              placeholderTextColor="#94a3b8"
              value={searchTerm}
              onChangeText={setSearchTerm}
              className="flex-1 ml-2.5 font-sans text-[14px] text-[#1e293b]"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchTerm.length > 0 && (
              <TouchableOpacity onPress={() => setSearchTerm('')} className="p-1">
                <Feather name="x-circle" size={16} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={handleExportarCSV}
              activeOpacity={0.8}
              className="flex-1 bg-white py-2.5 px-3.5 rounded-full border border-slate-200 flex-row items-center justify-center gap-1.5 shadow-xs"
            >
              <Feather name="download" size={14} color="#475569" />
              <Text className="font-sans font-bold text-[#475569] text-[12px]">Exportar Lista (CSV)</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ========================================================= */}
        {/* 5. LISTA DE CARDS DE LEADS INBOUND                        */}
        {/* ========================================================= */}
        <View className="mb-2">
          {loading ? (
            <View className="py-[40px] items-center justify-center">
              <ActivityIndicator size="large" color="#1B4332" />
              <Text className="font-sans text-[#64748b] text-[13px] mt-3">Carregando lista de espera...</Text>
            </View>
          ) : paginatedLeads.length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center border border-[#e2e8f0]">
              <Text className="text-[28px] mb-2">🎉</Text>
              <Text className="font-title text-[#1B4332] text-[16px]">Nenhum lead com este filtro</Text>
              <Text className="font-sans text-[#64748b] text-[13px] text-center mt-1">
                Todos os profissionais inbound foram processados ou tente outro termo de busca.
              </Text>
            </View>
          ) : (
            paginatedLeads.map((lead) => {
              const isInvited = lead.status === 'invited';
              const firstName = (lead.nome || 'Colega').trim().split(' ')[0];
              const isActionLoading = actionLoadingId?.startsWith(lead.id);

              return (
                <View
                  key={lead.id}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: '#e2e8f0',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.04,
                    shadowRadius: 6,
                    elevation: 1,
                  }}
                >
                  {/* Topo do Card: Avatar + Nome + Status */}
                  <View className="flex-row items-center gap-3 pb-3 border-b border-[#f1f5f9]">
                    <View
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 999,
                        backgroundColor: '#fef3c7',
                        borderWidth: 1.5,
                        borderColor: '#fde68a',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text className="font-title text-[#b45309] text-[20px] font-bold">
                        {firstName.charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    <View className="flex-1">
                      <Text className="font-title text-[#1B4332] text-[16px] font-bold leading-tight">
                        {lead.nome || 'Sem Nome'}
                      </Text>
                      <Text className="font-sans text-[#64748b] text-[12px] mt-0.5" numberOfLines={1}>
                        {lead.email || 'Sem e-mail'}
                      </Text>
                    </View>

                    <View
                      className={`px-2.5 py-0.5 rounded-full border ${
                        isInvited
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'bg-amber-50 border-amber-200'
                      }`}
                    >
                      <Text
                        className={`font-sans font-bold text-[11px] ${
                          isInvited ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {isInvited ? 'Convidado' : 'Pendente'}
                      </Text>
                    </View>
                  </View>

                  {/* Informações Linha a Linha */}
                  <View className="py-2.5 gap-1.5">
                    {/* Telefone */}
                    <View className="flex-row justify-between items-center py-0.5">
                      <Text className="font-sans text-[#64748b] text-[11px] font-bold uppercase tracking-wider">
                        Telefone
                      </Text>
                      <Text className="font-sans font-semibold text-[#334155] text-[12px]">
                        {mascaraTelefone(lead.telefone) || 'Não informado'}
                      </Text>
                    </View>

                    {/* CRP */}
                    <View className="flex-row justify-between items-center py-0.5">
                      <Text className="font-sans text-[#64748b] text-[11px] font-bold uppercase tracking-wider">
                        CRP
                      </Text>
                      <View className="bg-slate-100 px-2 py-0.5 rounded-md">
                        <Text className="font-sans font-semibold text-[#475569] text-[11px]">
                          {lead.crp || 'Não preenchido'}
                        </Text>
                      </View>
                    </View>

                    {/* Data de Entrada */}
                    <View className="flex-row justify-between items-center py-0.5">
                      <Text className="font-sans text-[#64748b] text-[11px] font-bold uppercase tracking-wider">
                        Iniciou Cadastro Em
                      </Text>
                      <Text className="font-sans font-medium text-[#475569] text-[12px]">
                        {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('pt-BR') : '-'}
                      </Text>
                    </View>
                  </View>

                  {/* Rodapé de Ações (Botões em Formato Pílula) */}
                  <View className="flex-row items-center gap-2 pt-3 border-t border-[#f1f5f9]">
                    {/* Botão WhatsApp */}
                    <TouchableOpacity
                      onPress={() => handleContatarWhatsApp(lead)}
                      disabled={isActionLoading}
                      activeOpacity={0.8}
                      style={{
                        flex: 1,
                        height: 40,
                        backgroundColor: isInvited ? '#10b981' : '#2563eb',
                        borderRadius: 999,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        paddingHorizontal: 16,
                      }}
                    >
                      <Feather
                        name={isInvited ? 'check' : 'message-circle'}
                        size={15}
                        color="#fff"
                      />
                      <Text className="font-sans font-bold text-white text-[13px]">
                        {isInvited ? 'Reenviar WhatsApp' : 'Chamar no WhatsApp'}
                      </Text>
                    </TouchableOpacity>

                    {/* Botão Convite por E-mail */}
                    {lead.email && !isInvited && (
                      <TouchableOpacity
                        onPress={() => handleEnviarConviteEmail(lead)}
                        activeOpacity={0.7}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 999,
                          backgroundColor: '#f0fdf4',
                          borderWidth: 1,
                          borderColor: '#bbf7d0',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Feather name="mail" size={15} color="#166534" />
                      </TouchableOpacity>
                    )}

                    {/* Botão Excluir */}
                    <TouchableOpacity
                      onPress={() => handleExcluirLead(lead)}
                      activeOpacity={0.7}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 999,
                        backgroundColor: '#fef2f2',
                        borderWidth: 1,
                        borderColor: '#fecaca',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Feather name="trash-2" size={15} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* ========================================================= */}
        {/* 6. PAGINAÇÃO                                               */}
        {/* ========================================================= */}
        {filteredLeads.length > LEADS_PER_PAGE && (
          <View className="bg-white rounded-[16px] p-[16px] border border-[#e2e8f0] flex-row justify-between items-center mt-[10px] mb-4 shadow-xs">
            <Text className="font-sans text-[#64748b] text-[13px]">
              Mostrando {Math.min((currentPage - 1) * LEADS_PER_PAGE + 1, filteredLeads.length)}–
              {Math.min(currentPage * LEADS_PER_PAGE, filteredLeads.length)} de {filteredLeads.length}
            </Text>

            <View className="flex-row gap-[8px]">
              <TouchableOpacity
                onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className={`w-[36px] h-[36px] rounded-full items-center justify-center border ${
                  currentPage <= 1 ? 'border-[#e2e8f0] opacity-40' : 'border-[#cbd5e1] bg-white'
                }`}
              >
                <Feather name="chevron-left" size={18} color="#1e293b" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className={`w-[36px] h-[36px] rounded-full items-center justify-center border ${
                  currentPage >= totalPages ? 'border-[#e2e8f0] opacity-40' : 'border-[#cbd5e1] bg-white'
                }`}
              >
                <Feather name="chevron-right" size={18} color="#1e293b" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
