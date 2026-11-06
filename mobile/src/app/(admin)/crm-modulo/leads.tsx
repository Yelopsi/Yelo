import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Pressable,
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

// -------------------------------------------------------------
// Dicionário de Copys Outbound (Espelho de admin_crm_leads.js)
// -------------------------------------------------------------
const COPYS_OUTBOUND = {
  intro: `Olá, [PRIMEIRO NOME]! Tudo bem?\n\nSou Anderson Costa, psicólogo clínico e fundador da Yelo.\n\nEstamos construindo uma comunidade de psicólogos que conecta profissionais a novos pacientes e também promove troca de experiências entre colegas.\n\nAchei que a proposta poderia fazer sentido para você.\n\nPosso te explicar rapidamente como funciona? Prometo que são apenas duas mensagens. 😊`,

  pitch: `Maravilha, [PRIMEIRO NOME]! Serei bem direto, porque sei que a vida é corrida.\n\nA Yelo não é uma daquelas listas genéricas de profissionais. Nós construímos um Hub completo: o paciente responde a um questionário e nosso algoritmo faz o Match Inteligente, direcionando-o para a sua especialidade.\n\nAlém disso, a plataforma oferece ferramentas de gestão e troca de saberes 🤝:\n🧠 Fórum privado para discussões\n✍️ Blog para escrever aos usuários\n📊 Gestão financeira\n🌐 Página pública com endereço personalizado\n\nNa Yelo você tem total autonomia: define seus horários, valores, edita seu perfil, etc.\n\nComo estamos selecionando profissionais referência para esta fase, liberei **7 dias de acesso Premium gratuito para você testar na prática, sem precisar cadastrar nenhum cartão**. O que acha?\n\nwww.yelopsi.com.br/profissionais?utm_source=whatsapp&utm_medium=convite_manual`,

  followup1: `Oi, [PRIMEIRO NOME], tudo bem?\n\nConseguiu dar uma olhada no link da Yelo que te enviei?\n\nGostaria muito de ter um colega com a sua visão na nossa rede. Nossos primeiros 7 dias Premium são totalmente sem custo **(e sem pedir cartão)** para você sentir como nossa gestão e nosso algoritmo podem te ajudar na captação de pacientes de forma ética.\n\nQualquer dúvida, estou à disposição!\n\nwww.yelopsi.com.br/profissionais?utm_source=whatsapp&utm_medium=convite_manual`,

  followup2: `Olá, [PRIMEIRO NOME]!\n\nSei perfeitamente como a rotina de consultório é engolida por sessões, então não quero tomar seu tempo.\n\nEstou passando rapidinho só para deixar nosso convite em aberto. Nosso objetivo com a Yelo é eliminar o ruído de marketing e burocracia para você focar no atendimento.\nSe fizer sentido conversar depois e testar a plataforma, me dá um alô por aqui ou vem nos conhecer em www.yelopsi.com.br/profissionais?utm_source=whatsapp&utm_medium=convite_manual\n\nBons atendimentos!`,
};

// Formatação de telefone para exibição
function mascaraTelefone(tel: string): string {
  if (!tel) return '';
  const r = tel.replace(/\D/g, '');
  if (r.length === 11) return r.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
  if (r.length === 10) return r.replace(/^(\d{2})(\d{4})(\d{4}).*/, '($1) $2-$3');
  return tel;
}

export default function AdminCRMLeadsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [leads, setLeads] = useState<any[]>([]);
  const [kpis, setKpis] = useState({
    pendentes: 0,
    contatados: 0,
    aguardando: 0,
    cadastrados: 0,
    convitesWhatsapp: 0,
    convitesWhatsapp_Incompletos: 0,
    convitesWhatsapp_Trial: 0,
    convitesWhatsapp_Pagantes: 0,
  });

  // Filtro do Funil (Padrão web é 'pendentes')
  const [activeFilter, setActiveFilter] = useState('pendentes');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Modal Bottom Sheet de Copys WhatsApp
  const [modalZapLead, setModalZapLead] = useState<any | null>(null);

  // Paginação (20 por página)
  const [currentPage, setCurrentPage] = useState(1);
  const LEADS_PER_PAGE = 20;

  // Busca de leads da API
  const fetchLeads = useCallback(
    async (isManualRefresh = false) => {
      try {
        if (!isManualRefresh) setLoading(true);

        const params: any = {};
        if (activeFilter) params.filtro = activeFilter;

        const response = await api.get('/api/admin/leads', { params });
        const data = response.data || {};

        setLeads(Array.isArray(data.leads) ? data.leads : []);
        if (data.kpis) {
          setKpis({
            pendentes: Number(data.kpis.pendentes) || 0,
            contatados: Number(data.kpis.contatados) || 0,
            aguardando: Number(data.kpis.aguardando) || 0,
            cadastrados: Number(data.kpis.cadastrados) || 0,
            convitesWhatsapp: Number(data.kpis.convitesWhatsapp) || 0,
            convitesWhatsapp_Incompletos: Number(data.kpis.convitesWhatsapp_Incompletos) || 0,
            convitesWhatsapp_Trial: Number(data.kpis.convitesWhatsapp_Trial) || 0,
            convitesWhatsapp_Pagantes: Number(data.kpis.convitesWhatsapp_Pagantes) || 0,
          });
        }
        setCurrentPage(1);
      } catch (error: any) {
        console.warn('[AdminLeads] Erro ao buscar leads:', error?.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeFilter]
  );

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLeads(true);
  }, [fetchLeads]);

  // Taxa de conversão (calculada exatamente como no Admin Web)
  const leadsTrabalhados = kpis.contatados + kpis.aguardando + kpis.cadastrados;
  const taxaConversao =
    leadsTrabalhados > 0 ? ((kpis.cadastrados / leadsTrabalhados) * 100).toFixed(1) : '0.0';

  // Filtro local de busca (Nome, Telefone, Origem)
  const filteredLeads = useMemo(() => {
    if (!searchTerm.trim()) return leads;
    const term = searchTerm.toLowerCase();
    return leads.filter((l) => {
      const nome = (l.nome || '').toLowerCase();
      const tel = (l.telefone || '').replace(/\D/g, '');
      const origem = (l.origem_url || '').toLowerCase();
      return nome.includes(term) || tel.includes(term) || origem.includes(term);
    });
  }, [leads, searchTerm]);

  // Paginação
  const totalPages = Math.ceil(filteredLeads.length / LEADS_PER_PAGE) || 1;
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * LEADS_PER_PAGE;
    return filteredLeads.slice(start, start + LEADS_PER_PAGE);
  }, [filteredLeads, currentPage]);

  // Disparo de mensagem no WhatsApp com injeção automática de dados
  const handleSendWhatsAppCopy = async (lead: any, tipoCopy: keyof typeof COPYS_OUTBOUND) => {
    if (!lead || !lead.telefone) {
      Alert.alert('Atenção', 'Lead sem telefone válido cadastrado.');
      return;
    }

    try {
      setActionLoadingId(`${lead.id}_${tipoCopy}`);

      let telClean = (lead.telefone || '').replace(/\D/g, '');
      if (telClean.length === 10 || telClean.length === 11) {
        telClean = '55' + telClean;
      }

      let primeiroNome = (lead.nome || 'Colega').trim().split(' ')[0];
      if (primeiroNome.toLowerCase().includes('psicólogo') || primeiroNome.toLowerCase().includes('psi')) {
        primeiroNome = 'colega';
      }

      const template = COPYS_OUTBOUND[tipoCopy] || COPYS_OUTBOUND.intro;
      const msgFinal = template.replace(/\[PRIMEIRO NOME\]/g, primeiroNome);

      const urlApp = `whatsapp://send?phone=${telClean}&text=${encodeURIComponent(msgFinal)}`;
      const urlWeb = `https://api.whatsapp.com/send?phone=${telClean}&text=${encodeURIComponent(msgFinal)}`;

      const canOpen = await Linking.canOpenURL(urlApp);
      if (canOpen) {
        await Linking.openURL(urlApp);
      } else {
        await Linking.openURL(urlWeb);
      }

      // Registra o contato na API
      await api.put(`/api/admin/leads/${lead.id}/contato`).catch(() => {});

      // Atualiza localmente o status para Contatado
      setLeads((prev) =>
        prev.map((item) =>
          item.id === lead.id
            ? { ...item, status_funil: 'Contatado', data_ultimo_contato: new Date().toISOString() }
            : item
        )
      );

      setModalZapLead(null);
    } catch (err: any) {
      Alert.alert('Erro', 'Não foi possível abrir o WhatsApp: ' + (err.message || 'Erro desconhecido.'));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Alteração de estágio do lead
  const handleAlterarStatus = async (leadId: string, novoStatus: string) => {
    try {
      setActionLoadingId(`${leadId}_status`);
      await api.put(`/api/admin/leads/${leadId}/status`, { status: novoStatus });

      setLeads((prev) =>
        prev.map((item) => (item.id === leadId ? { ...item, status_funil: novoStatus } : item))
      );
    } catch (error: any) {
      Alert.alert('Erro', 'Não foi possível alterar o status: ' + (error?.message || 'Erro na rede.'));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Exclusão de lead
  const handleExcluirLead = (lead: any) => {
    Alert.alert(
      'Descartar Prospecto',
      `Deseja realmente remover ${lead.nome || 'este lead'} do pipeline?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Descartar',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoadingId(`${lead.id}_del`);
              await api.delete(`/api/admin/leads/${lead.id}`);
              setLeads((prev) => prev.filter((item) => item.id !== lead.id));
            } catch (err: any) {
              Alert.alert('Erro', 'Não foi possível excluir o lead: ' + (err?.message || ''));
            } finally {
              setActionLoadingId(null);
            }
          },
        },
      ]
    );
  };

  // Robô Scraper de Captação
  const handleIniciarScraper = async () => {
    Alert.alert(
      'Capturar Prospectos',
      'Deseja iniciar o robô de aquisição para rastrear novos profissionais disponíveis?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Iniciar Robô',
          onPress: async () => {
            try {
              setScraping(true);
              const res = await api.post('/api/admin/leads/scrape');
              Alert.alert('Robô Iniciado', res.data?.message || 'Varredura em execução em segundo plano.');
              setTimeout(() => {
                fetchLeads(true);
                setScraping(false);
              }, 4000);
            } catch (err: any) {
              setScraping(false);
              Alert.alert('Aviso', 'Robô de aquisição já está em execução ou serviço indisponível.');
            }
          },
        },
      ]
    );
  };

  // Exportar Leads como CSV
  const handleExportarCSV = async () => {
    try {
      if (filteredLeads.length === 0) {
        Alert.alert('Vazio', 'Nenhum lead encontrado para exportar.');
        return;
      }

      let csv = 'Profissional;Contato;Estágio;Origem\n';
      filteredLeads.forEach((l) => {
        const nome = (l.nome || '').replace(/;/g, '');
        const tel = mascaraTelefone(l.telefone || '');
        const st = l.status_funil || 'Pendente';
        const orig = (l.origem_url || 'Desconhecida').replace(/;/g, '');
        csv += `"${nome}";"${tel}";"${st}";"${orig}"\n`;
      });

      await Share.share({
        title: 'Pipeline_Leads_Yelo.csv',
        message: csv,
      });
    } catch (err: any) {
      Alert.alert('Erro ao exportar', err.message);
    }
  };

  // Semáforo SLA de Atendimento
  const renderSemaforo = (lead: any) => {
    if (lead.status_funil !== 'Contatado' || !lead.data_ultimo_contato) return null;
    const dias = Math.floor(
      (new Date().getTime() - new Date(lead.data_ultimo_contato).getTime()) / (1000 * 60 * 60 * 24)
    );

    let cor = '#10b981'; // recente
    if (dias >= 5) cor = '#ef4444'; // atrasado > 5d
    else if (dias >= 2) cor = '#f59e0b'; // atenção > 2d

    return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cor, marginRight: 6 }} />;
  };

  // Badges de Estágio do Funil
  const renderBadgeStatus = (status: string) => {
    switch (status) {
      case 'Contatado':
        return (
          <View className="bg-sky-50 border border-sky-200 px-2.5 py-0.5 rounded-full">
            <Text className="font-sans font-bold text-sky-700 text-[11px]">Contatado</Text>
          </View>
        );
      case 'Aguardando':
        return (
          <View className="bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full">
            <Text className="font-sans font-bold text-purple-700 text-[11px]">Em Negociação</Text>
          </View>
        );
      case 'Cadastrado':
        return (
          <View className="bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
            <Text className="font-sans font-bold text-emerald-700 text-[11px]">Assinante Confirmado</Text>
          </View>
        );
      default:
        return (
          <View className="bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
            <Text className="font-sans font-bold text-amber-700 text-[11px]">Oportunidade Fria</Text>
          </View>
        );
    }
  };

  return (
    <View className="flex-1 bg-[#f8fafc]">
      <StatusBar style="dark" />
      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 130 }}
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
        {/* 1. HERO CARD SUPERIOR (GRADIENTE YELO IDÊNTICO À WEB)     */}
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
                Pipeline de Vendas (Leads)
              </Text>
              <Text className="font-sans text-white/85 text-[12px] leading-4">
                Captação ativa e conversão de psicólogos para assinatura da plataforma.
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
              <Text className="font-sans text-white/70 text-[10px] uppercase font-bold">Frias</Text>
              <Text className="font-title text-[#fef08a] text-[16px]">{kpis.pendentes}</Text>
            </View>
            <View className="flex-1 bg-white/10 rounded-xl p-2 items-center">
              <Text className="font-sans text-white/70 text-[10px] uppercase font-bold">Contatados</Text>
              <Text className="font-title text-[#93c5fd] text-[16px]">{kpis.contatados}</Text>
            </View>
            <View className="flex-1 bg-white/10 rounded-xl p-2 items-center">
              <Text className="font-sans text-white/70 text-[10px] uppercase font-bold">Negociação</Text>
              <Text className="font-title text-[#d8b4fe] text-[16px]">{kpis.aguardando}</Text>
            </View>
            <View className="flex-1 bg-white/10 rounded-xl p-2 items-center">
              <Text className="font-sans text-white/70 text-[10px] uppercase font-bold">Assinantes</Text>
              <Text className="font-title text-[#86efac] text-[16px]">{kpis.cadastrados}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ========================================================= */}
        {/* 2. KPIS DE FUNIL DE VENDAS (GRID 2 COLUNAS IGUAL WEB MOBILE) */}
        {/* ========================================================= */}
        <View className="mb-5">
          <View className="flex-row items-center justify-between mb-2.5">
            <Text className="font-title text-[#1e293b] text-[18px]">Métricas do Funil</Text>
            <Text className="font-sans text-[#64748b] text-[12px]">Toque para filtrar</Text>
          </View>

          <View className="gap-2.5">
            {/* Linha 1: Oportunidades Frias & 1º Contato Feito */}
            <View className="flex-row gap-2.5">
              {/* Oportunidades Frias */}
              <TouchableOpacity
                onPress={() => setActiveFilter(activeFilter === 'pendentes' ? 'todos' : 'pendentes')}
                activeOpacity={0.8}
                className={`flex-1 bg-white rounded-2xl p-3.5 border-t-4 border-t-[#f59e0b] border border-[#e2e8f0] ${
                  activeFilter === 'pendentes' ? 'bg-amber-50/80 border-[#f59e0b]' : ''
                }`}
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.04,
                  shadowRadius: 6,
                  elevation: 2,
                }}
              >
                <View className="flex-row items-center gap-1.5 mb-1">
                  <Feather name="clock" size={13} color="#f59e0b" />
                  <Text className="font-sans font-bold text-[#475569] text-[11px]">Oport. Frias</Text>
                </View>
                <Text className="font-title text-[#f59e0b] text-[24px] mt-1">{kpis.pendentes}</Text>
                <Text className="font-sans text-[#b45309] font-medium text-[11px] mt-0.5">Sem abordagem</Text>
              </TouchableOpacity>

              {/* 1º Contato Feito */}
              <TouchableOpacity
                onPress={() => setActiveFilter(activeFilter === 'contatados' ? 'todos' : 'contatados')}
                activeOpacity={0.8}
                className={`flex-1 bg-white rounded-2xl p-3.5 border-t-4 border-t-[#3b82f6] border border-[#e2e8f0] ${
                  activeFilter === 'contatados' ? 'bg-blue-50/80 border-[#3b82f6]' : ''
                }`}
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.04,
                  shadowRadius: 6,
                  elevation: 2,
                }}
              >
                <View className="flex-row items-center gap-1.5 mb-1">
                  <Feather name="phone-call" size={13} color="#3b82f6" />
                  <Text className="font-sans font-bold text-[#475569] text-[11px]">1º Contato</Text>
                </View>
                <Text className="font-title text-[#3b82f6] text-[24px] mt-1">{kpis.contatados}</Text>
                <Text className="font-sans text-blue-600 font-medium text-[11px] mt-0.5">Aguardando feed</Text>
              </TouchableOpacity>
            </View>

            {/* Linha 2: Em Negociação & Novos Assinantes */}
            <View className="flex-row gap-2.5">
              {/* Em Negociação */}
              <TouchableOpacity
                onPress={() => setActiveFilter(activeFilter === 'aguardando' ? 'todos' : 'aguardando')}
                activeOpacity={0.8}
                className={`flex-1 bg-white rounded-2xl p-3.5 border-t-4 border-t-[#8b5cf6] border border-[#e2e8f0] ${
                  activeFilter === 'aguardando' ? 'bg-purple-50/80 border-[#8b5cf6]' : ''
                }`}
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.04,
                  shadowRadius: 6,
                  elevation: 2,
                }}
              >
                <View className="flex-row items-center gap-1.5 mb-1">
                  <Feather name="file-text" size={13} color="#8b5cf6" />
                  <Text className="font-sans font-bold text-[#475569] text-[11px]">Negociação</Text>
                </View>
                <Text className="font-title text-[#8b5cf6] text-[24px] mt-1">{kpis.aguardando}</Text>
                <Text className="font-sans text-purple-600 font-medium text-[11px] mt-0.5">Quase fechando</Text>
              </TouchableOpacity>

              {/* Novos Assinantes */}
              <TouchableOpacity
                onPress={() => setActiveFilter(activeFilter === 'cadastrados' ? 'todos' : 'cadastrados')}
                activeOpacity={0.8}
                className={`flex-1 bg-white rounded-2xl p-3.5 border-t-4 border-t-[#10b981] border border-[#e2e8f0] ${
                  activeFilter === 'cadastrados' ? 'bg-emerald-50/80 border-[#10b981]' : ''
                }`}
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.04,
                  shadowRadius: 6,
                  elevation: 2,
                }}
              >
                <View className="flex-row items-center gap-1.5 mb-1">
                  <Feather name="check-circle" size={13} color="#10b981" />
                  <Text className="font-sans font-bold text-[#475569] text-[11px]">Convertidos</Text>
                </View>
                <Text className="font-title text-[#10b981] text-[24px] mt-1">{kpis.cadastrados}</Text>
                <Text className="font-sans text-emerald-600 font-medium text-[11px] mt-0.5">Assinantes Yelo</Text>
              </TouchableOpacity>
            </View>

            {/* Linha 3: Cadastros via WPP & Taxa de Conversão */}
            <View className="flex-row gap-2.5">
              {/* Cadastros via WPP com sub-breakdown */}
              <View
                className="flex-1 bg-white rounded-2xl p-3.5 border-t-4 border-t-[#25d366] border border-[#e2e8f0]"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.04,
                  shadowRadius: 6,
                  elevation: 2,
                }}
              >
                <View className="flex-row items-center gap-1.5 mb-1">
                  <Feather name="message-circle" size={13} color="#25d366" />
                  <Text className="font-sans font-bold text-[#475569] text-[11px]">Via WhatsApp</Text>
                </View>
                <Text className="font-title text-[#25d366] text-[24px] mt-1">{kpis.convitesWhatsapp}</Text>
                <View className="mt-1 pt-1 border-t border-slate-100 gap-0.5">
                  <Text className="font-sans text-[10px] text-emerald-700">
                    <Text className="font-bold">{kpis.convitesWhatsapp_Pagantes}</Text> Pagantes
                  </Text>
                  <Text className="font-sans text-[10px] text-blue-700">
                    <Text className="font-bold">{kpis.convitesWhatsapp_Trial}</Text> em Trial
                  </Text>
                  <Text className="font-sans text-[10px] text-amber-700">
                    <Text className="font-bold">{kpis.convitesWhatsapp_Incompletos}</Text> Incompletos
                  </Text>
                </View>
              </View>

              {/* Taxa de Conversão */}
              <View
                className="flex-1 bg-white rounded-2xl p-3.5 border-t-4 border-t-[#1B4332] border border-[#e2e8f0] justify-between"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.04,
                  shadowRadius: 6,
                  elevation: 2,
                }}
              >
                <View>
                  <View className="flex-row items-center gap-1.5 mb-1">
                    <Feather name="bar-chart-2" size={13} color="#1B4332" />
                    <Text className="font-sans font-bold text-[#475569] text-[11px]">Conversão</Text>
                  </View>
                  <Text className="font-title text-[#1B4332] text-[24px] mt-1">{taxaConversao}%</Text>
                </View>
                <Text className="font-sans text-slate-500 text-[11px]">Eficiência de abordagem</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ========================================================= */}
        {/* 3. ABAS DO FUNIL (PILLS HORIZONTAIS)                      */}
        {/* ========================================================= */}
        <View className="mb-3.5 -mx-4">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          >
            {[
              { id: 'ativos', label: 'Pipeline Ativo' },
              { id: 'pendentes', label: 'Frios' },
              { id: 'contatados', label: 'Contatados' },
              { id: 'aguardando', label: 'Em Negociação' },
              { id: 'cadastrados', label: 'Convertidos' },
              { id: 'todos', label: 'Histórico (Todos)' },
            ].map((tab) => {
              const isActive = activeFilter === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setActiveFilter(tab.id)}
                  activeOpacity={0.8}
                  className={`px-4 py-2 rounded-full border ${
                    isActive ? 'bg-[#1B4332] border-[#1B4332]' : 'bg-white border-[#e2e8f0]'
                  }`}
                >
                  <Text
                    className={`font-sans font-semibold text-[13px] ${
                      isActive ? 'text-white' : 'text-[#64748b]'
                    }`}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ========================================================= */}
        {/* 4. BUSCA & AÇÕES (CAPTURAR PROSPECTOS / EXPORTAR CSV)      */}
        {/* ========================================================= */}
        <View className="mb-3.5">
          {/* Campo de Busca */}
          <View className="bg-white rounded-full px-4 py-2.5 border border-[#e2e8f0] flex-row items-center mb-2.5 shadow-xs">
            <Feather name="search" size={17} color="#94a3b8" />
            <TextInput
              placeholder="Buscar por nome, telefone ou origem..."
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

          {/* Botões de Ação B2B */}
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={handleIniciarScraper}
              disabled={scraping}
              activeOpacity={0.8}
              className="flex-1 bg-[#1B4332] py-2.5 px-3 rounded-full flex-row items-center justify-center gap-1.5 shadow-xs"
            >
              {scraping ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name="crosshair" size={14} color="#fff" />
                  <Text className="font-sans font-bold text-white text-[12px]">Capturar Leads</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleExportarCSV}
              activeOpacity={0.8}
              className="bg-white py-2.5 px-3.5 rounded-full border border-slate-200 flex-row items-center justify-center gap-1.5 shadow-xs"
            >
              <Feather name="download" size={14} color="#475569" />
              <Text className="font-sans font-bold text-[#475569] text-[12px]">Exportar CSV</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ========================================================= */}
        {/* 5. LISTA DE CARDS DE LEADS                                */}
        {/* ========================================================= */}
        <View className="mb-2">
          {loading ? (
            <View className="py-[40px] items-center justify-center">
              <ActivityIndicator size="large" color="#1B4332" />
              <Text className="font-sans text-[#64748b] text-[13px] mt-3">Carregando pipeline...</Text>
            </View>
          ) : paginatedLeads.length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center border border-[#e2e8f0]">
              <Text className="text-[28px] mb-2">🔍</Text>
              <Text className="font-title text-[#1B4332] text-[16px]">Nenhum prospecto encontrado</Text>
              <Text className="font-sans text-[#64748b] text-[13px] text-center mt-1">
                Tente alterar o filtro ou o termo de busca.
              </Text>
            </View>
          ) : (
            paginatedLeads.map((lead) => {
              const isPendente = lead.status_funil === 'Pendente';
              const safeNome = lead.nome || 'Colega';
              const primeiroNome = safeNome.split(' ')[0];

              let origemCurta = lead.origem_url || 'Desconhecida';
              try {
                if (origemCurta.startsWith('http')) {
                  origemCurta = new URL(origemCurta).hostname;
                }
              } catch (_) {}

              const isActionLoading = actionLoadingId?.startsWith(lead.id);

              return (
                <View
                  key={lead.id}
                  className="bg-white rounded-2xl p-4 mb-3 border border-[#e2e8f0]"
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 8,
                    elevation: 2,
                  }}
                >
                  {/* Topo do Card: Avatar + Nome + Badge */}
                  <View className="flex-row items-center gap-3 pb-3 border-b border-[#f1f5f9]">
                    <View
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 999,
                        backgroundColor: '#ecfdf5',
                        borderWidth: 1.5,
                        borderColor: '#a7f3d0',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text className="font-title text-[#166534] text-[20px] font-bold">
                        {primeiroNome.charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    <View className="flex-1">
                      <View className="flex-row items-center gap-1.5 flex-wrap">
                        {renderSemaforo(lead)}
                        <Text className="font-title text-[#1B4332] text-[16px] font-bold leading-tight">
                          {lead.nome || 'Sem Nome'}
                        </Text>
                        {lead.isInbound && (
                          <View className="bg-purple-100 border border-purple-300 px-1.5 py-0.5 rounded-md">
                            <Text className="font-sans font-bold text-[9px] text-purple-800">Inbound</Text>
                          </View>
                        )}
                      </View>
                      <Text className="font-sans text-[#64748b] text-[12px] mt-0.5">
                        {mascaraTelefone(lead.telefone) || 'Sem telefone'}
                      </Text>
                    </View>

                    {renderBadgeStatus(lead.status_funil)}
                  </View>

                  {/* Informações Linha a Linha */}
                  <View className="py-2.5 gap-1.5">
                    {/* Origem */}
                    <View className="flex-row justify-between items-center py-0.5">
                      <Text className="font-sans text-[#64748b] text-[11px] font-bold uppercase tracking-wider">
                        Origem / Canal
                      </Text>
                      <Text className="font-sans font-semibold text-[#334155] text-[12px]" numberOfLines={1}>
                        {origemCurta}
                      </Text>
                    </View>

                    {/* Data de Captação */}
                    <View className="flex-row justify-between items-center py-0.5">
                      <Text className="font-sans text-[#64748b] text-[11px] font-bold uppercase tracking-wider">
                        Capturado Em
                      </Text>
                      <Text className="font-sans font-medium text-[#475569] text-[12px]">
                        {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('pt-BR') : '-'}
                      </Text>
                    </View>

                    {/* Último Contato */}
                    {lead.data_ultimo_contato && (
                      <View className="flex-row justify-between items-center py-0.5">
                        <Text className="font-sans text-[#64748b] text-[11px] font-bold uppercase tracking-wider">
                          Último Contato
                        </Text>
                        <Text className="font-sans font-medium text-[#0284c7] text-[12px]">
                          {new Date(lead.data_ultimo_contato).toLocaleDateString('pt-BR')}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Rodapé de Ações B2B (Botões em Formato Pílula) */}
                  <View className="flex-row items-center gap-2 pt-3 border-t border-[#f1f5f9]">
                    {/* Botão de WhatsApp Primário */}
                    <TouchableOpacity
                      onPress={() => {
                        if (isPendente) {
                          handleSendWhatsAppCopy(lead, 'intro');
                        } else {
                          setModalZapLead(lead);
                        }
                      }}
                      activeOpacity={0.8}
                      style={{
                        flex: 1,
                        height: 40,
                        backgroundColor: isPendente ? '#10b981' : '#2563eb',
                        borderRadius: 999,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        paddingHorizontal: 14,
                      }}
                    >
                      <Feather name="message-circle" size={15} color="#fff" />
                      <Text className="font-sans font-bold text-white text-[13px]">
                        {isPendente ? '1º Contato' : 'Follow-up'}
                      </Text>
                    </TouchableOpacity>

                    {/* Mover para Negociação */}
                    <TouchableOpacity
                      onPress={() => handleAlterarStatus(lead.id, 'Aguardando')}
                      activeOpacity={0.7}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 999,
                        backgroundColor: '#fef3c7',
                        borderWidth: 1,
                        borderColor: '#fde68a',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Feather name="clock" size={15} color="#d97706" />
                    </TouchableOpacity>

                    {/* Marcar como Convertido */}
                    <TouchableOpacity
                      onPress={() => handleAlterarStatus(lead.id, 'Cadastrado')}
                      activeOpacity={0.7}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 999,
                        backgroundColor: '#e0f2fe',
                        borderWidth: 1,
                        borderColor: '#bae6fd',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Feather name="check" size={16} color="#0369a1" />
                    </TouchableOpacity>

                    {/* Excluir Lead */}
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

      {/* ========================================================= */}
      {/* 7. MODAL COPY WHATSAPP (MODERN BOTTOM SHEET)              */}
      {/* ========================================================= */}
      <Modal
        visible={!!modalZapLead}
        animationType="slide"
        transparent
        onRequestClose={() => setModalZapLead(null)}
      >
        <View className="flex-1 justify-end bg-black/60">
          <Pressable
            onPress={() => setModalZapLead(null)}
            className="flex-1"
            style={{ minHeight: insets.top + 60 }}
          />

          <View
            style={{
              maxHeight: '85%',
              paddingBottom: insets.bottom + 12,
            }}
            className="bg-[#f8fafc] rounded-t-[32px] overflow-hidden shadow-2xl"
          >
            {/* Puxador Superior */}
            <View className="items-center pt-3 pb-1 bg-white">
              <View className="w-12 h-1.5 bg-slate-300 rounded-full" />
            </View>

            {/* Cabeçalho do Modal */}
            <View className="bg-white px-5 py-3.5 border-b border-slate-200 flex-row justify-between items-center">
              <View className="flex-row items-center gap-2.5">
                <View className="w-9 h-9 rounded-xl bg-emerald-100 items-center justify-center">
                  <Feather name="message-circle" size={18} color="#059669" />
                </View>
                <View>
                  <Text className="font-title text-[#1e293b] text-[17px] font-bold">
                    Contato de Venda: {(modalZapLead?.nome || 'Colega').split(' ')[0]}
                  </Text>
                  <Text className="font-sans text-[#64748b] text-[11px]">
                    Links UTM injetados automaticamente
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setModalZapLead(null)}
                activeOpacity={0.7}
                className="w-9 h-9 rounded-full bg-slate-100 items-center justify-center"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Feather name="x" size={18} color="#475569" />
              </TouchableOpacity>
            </View>

            {/* Opções de Copys */}
            <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
              {/* Opção 1: Pitch */}
              <TouchableOpacity
                onPress={() => handleSendWhatsAppCopy(modalZapLead, 'pitch')}
                activeOpacity={0.8}
                className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs"
              >
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="font-title text-[#1e293b] text-[15px] font-bold">
                    1. Pitch / Venda Direta
                  </Text>
                  <Feather name="send" size={15} color="#10b981" />
                </View>
                <Text className="font-sans text-[#64748b] text-[12px] leading-5">
                  Apresenta a Yelo e oferece 7 dias de Teste Premium grátis sem pedir cartão.
                </Text>
              </TouchableOpacity>

              {/* Opção 2: Follow-up 1 */}
              <TouchableOpacity
                onPress={() => handleSendWhatsAppCopy(modalZapLead, 'followup1')}
                activeOpacity={0.8}
                className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs"
              >
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="font-title text-[#1e293b] text-[15px] font-bold">
                    2. Follow-up de Nutrição (Pós 2 dias)
                  </Text>
                  <Feather name="send" size={15} color="#3b82f6" />
                </View>
                <Text className="font-sans text-[#64748b] text-[12px] leading-5">
                  Lembra do link enviado e quebra objeções comuns de burocracia ou cartão.
                </Text>
              </TouchableOpacity>

              {/* Opção 3: Follow-up 2 (Break-up) */}
              <TouchableOpacity
                onPress={() => handleSendWhatsAppCopy(modalZapLead, 'followup2')}
                activeOpacity={0.8}
                className="bg-[#fef2f2] p-4 rounded-2xl border border-red-200 shadow-2xs"
              >
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="font-title text-[#b91c1c] text-[15px] font-bold">
                    3. Break-up / Despedida
                  </Text>
                  <Feather name="send" size={15} color="#ef4444" />
                </View>
                <Text className="font-sans text-[#b91c1c] text-[12px] leading-5">
                  Última tentativa de contato amigável para gerar senso de urgência.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setModalZapLead(null)}
                className="mt-2 py-3 bg-slate-100 rounded-full items-center active:bg-slate-200"
              >
                <Text className="font-sans font-bold text-[#64748b] text-[13px]">Cancelar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
