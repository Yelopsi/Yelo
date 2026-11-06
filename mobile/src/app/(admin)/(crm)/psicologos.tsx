import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Linking,
  Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import api from '../../../services/api';

// -------------------------------------------------------------
// Helper: Cálculo de Força do Perfil (espelha calculateProfileHealth do Admin Web)
// -------------------------------------------------------------
export function calculateProfileHealth(psy: any) {
  if (!psy) return { score: 0, checks: [] };
  const checks = [
    { text: 'Foto de Perfil', ok: !!psy.fotoUrl },
    { text: 'Nome de Exibição', ok: !!psy.nome },
    { text: 'Número do CRP', ok: !!(psy.crp && String(psy.crp).length > 3) },
    { text: 'WhatsApp', ok: !!(psy.telefone && String(psy.telefone).length > 8) },
    { text: 'Documento (CPF/CNPJ)', ok: !!(psy.cpf || psy.cnpj || psy.document_number) },
    { text: 'Localização (CEP)', ok: !!psy.cep },
    { text: 'Link Personalizado', ok: !!psy.slug },
    { text: 'Biografia', ok: !!(psy.bio && psy.bio.trim().length >= 10) },
    { text: 'Ano de Início', ok: !!psy.ano_inicio_experiencia },
    {
      text: 'Valor da Consulta',
      ok:
        (psy.valor_sessao_numero !== null && psy.valor_sessao_numero !== undefined) ||
        (psy.valor_mensal_numero !== null && psy.valor_mensal_numero !== undefined) ||
        (psy.valorSessao !== null && psy.valorSessao !== undefined),
    },
    { text: 'Formação Acadêmica', ok: !!psy.formacao_nivel },
    {
      text: 'Redes Sociais',
      ok: !!(
        psy.instagram_url ||
        psy.linkedin_url ||
        psy.tiktok_url ||
        psy.facebook_url ||
        psy.x_url
      ),
    },
    {
      text: 'Temas de Atuação',
      ok: Array.isArray(psy.temas_atuacao) ? psy.temas_atuacao.length > 0 : !!psy.temas_atuacao,
    },
    {
      text: 'Público-Alvo',
      ok: Array.isArray(psy.publico_alvo) ? psy.publico_alvo.length > 0 : !!psy.publico_alvo,
    },
    {
      text: 'Identidade e Inclusão',
      ok: Array.isArray(psy.praticas_inclusivas)
        ? psy.praticas_inclusivas.length > 0
        : !!psy.praticas_inclusivas,
    },
    { text: 'Gênero', ok: !!psy.genero_identidade },
    {
      text: 'Abordagens e Técnicas',
      ok: Array.isArray(psy.abordagens_tecnicas)
        ? psy.abordagens_tecnicas.length > 0
        : !!psy.abordagens_tecnicas,
    },
    {
      text: 'Modalidade de Atendimento',
      ok: Array.isArray(psy.modalidade) ? psy.modalidade.length > 0 : !!psy.modalidade,
    },
    {
      text: 'Turnos Disponíveis',
      ok: Array.isArray(psy.disponibilidade_periodo)
        ? psy.disponibilidade_periodo.length > 0
        : !!psy.disponibilidade_periodo,
    },
  ];
  const okCount = checks.filter((c) => c.ok).length;
  const score = Math.round((okCount / checks.length) * 100);
  return { score, checks };
}

// -------------------------------------------------------------
// Helper: Sanitização para WhatsApp (espelha formatForWhatsApp do Admin Web)
// -------------------------------------------------------------
function formatForWhatsApp(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/^```[a-zA-Z]*\n?/gm, '')
    .replace(/```$/gm, '')
    .replace(/^["'“”](.*)["'“”]$/s, '$1')
    .replace(/^[-*_]{3,}\s*$/gm, '')
    .replace(/^#{1,6}\s*(.+)$/gm, '*$1*')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '$1: $2')
    .replace(/\*\*([^*\n]+?)\*\*/g, '*$1*')
    .replace(/__([^_\n]+?)__/g, '_$1_')
    .replace(/^[-]\s+/gm, '* ')
    .replace(/\*[ \t]+([^*\n]+?)[ \t]+\*/g, '*$1*')
    .replace(/\*[ \t]+([^*\n]+?)\*/g, '*$1*')
    .replace(/\*([^*\n]+?)[ \t]+\*/g, '*$1*')
    .replace(/_[ \t]+([^_\n]+?)[ \t]+_/g, '_$1_')
    .replace(/_[ \t]+([^_\n]+?)_/g, '_$1_')
    .replace(/_([^_\n]+?)[ \t]+_/g, '_$1_')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export default function AdminCRMPsicologosScreen() {
  // Dados principais
  const [psychologists, setPsychologists] = useState<any[]>([]);
  const [pendingActions, setPendingActions] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any>({});
  const [founderMetrics, setFounderMetrics] = useState<any>({});
  const [stats, setStats] = useState<any>({});

  // Filtros & Paginação
  const [activeFilter, setActiveFilter] = useState(''); // '' = Todos
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const limit = 20;

  // Estados de Carregamento
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Drawer / Visão 360
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [selectedPsi, setSelectedPsi] = useState<any>(null);
  const [drawerData, setDrawerData] = useState<any>(null);

  // Consultor IA no Drawer
  const [aiDiagnosis, setAiDiagnosis] = useState<{ diagnosis?: string; copy?: string } | null>(null);
  const [aiDiagnosisLoading, setAiDiagnosisLoading] = useState(false);

  // Modal de Confirmação Genérico
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Modal de Detalhes de Métrica (Tooltip)
  const [tooltipModal, setTooltipModal] = useState<{ visible: boolean; title: string; desc: string }>({
    visible: false,
    title: '',
    desc: '',
  });

  // -------------------------------------------------------------
  // Carga das Métricas de Topo (MRR, Ativação, Pós-Trial, Renovação)
  // -------------------------------------------------------------
  const loadHeaderMetrics = async () => {
    try {
      const [founderRes, statsRes] = await Promise.all([
        api.get('/api/admin/founder-metrics'),
        api.get('/api/admin/stats'),
      ]);
      if (founderRes.data?.metrics) {
        setFounderMetrics(founderRes.data.metrics);
      }
      if (statsRes.data) {
        setStats(statsRes.data);
      }
    } catch (e) {
      console.log('Erro ao buscar métricas de topo:', e);
    }
  };

  // -------------------------------------------------------------
  // Carga de Psicólogos e Ações Pendentes
  // -------------------------------------------------------------
  const fetchData = async (page = 1) => {
    try {
      // Se o filtro for de follow-up / ações pendentes
      const isPendingFilter = [
        'pending_actions',
        'pending_paid_churn',
        'pending_expiring_trial',
        'pending_incomplete',
      ].includes(activeFilter);

      if (isPendingFilter) {
        const res = await api.get('/api/admin/pending-actions');
        let actions: any[] = res.data?.pendingActions || res.data || [];

        if (activeFilter === 'pending_paid_churn') {
          actions = actions.filter((a) =>
            ['paid_churn', 'billing_feedback', 'churn'].includes(a.actionType)
          );
        } else if (activeFilter === 'pending_expiring_trial') {
          actions = actions.filter((a) => a.actionType === 'expiring_trial');
        } else if (activeFilter === 'pending_incomplete') {
          actions = actions.filter((a) => a.actionType === 'incomplete');
        }

        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          actions = actions.filter(
            (a) =>
              (a.nome && a.nome.toLowerCase().includes(term)) ||
              (a.email && a.email.toLowerCase().includes(term)) ||
              (a.telefone && a.telefone.includes(term))
          );
        }

        setPendingActions(actions);
        setTotalItems(actions.length);
        setCurrentPage(1);
        setTotalPages(1);
      } else {
        const params: any = {
          page,
          limit,
        };

        if (searchTerm.trim()) params.search = searchTerm.trim();
        if (activeFilter === 'active_paying') params.status = 'active_paying';
        else if (activeFilter === 'active_trial') params.status = 'active_trial';
        else if (activeFilter === 'churn_month') params.status = 'churn_month';
        else if (activeFilter === 'pending') params.status = 'pending';
        else if (activeFilter === 'inactive') params.status = 'inactive';
        else if (activeFilter === 'vip') params.isVip = 'true';
        else if (activeFilter === 'not_analyzed') params.notAnalyzed = 'true';
        else if (activeFilter === 'deleted') params.status = 'deleted';
        else if (activeFilter.startsWith('utm_')) params.status = activeFilter;

        const res = await api.get('/api/admin/psychologists', { params });
        const data = res.data?.data || res.data || [];
        setPsychologists(data);
        if (res.data?.kpis) setKpis(res.data.kpis);
        setTotalPages(res.data?.totalPages || 1);
        setCurrentPage(res.data?.currentPage || page);
        setTotalItems(res.data?.totalItems || data.length);
      }
    } catch (e: any) {
      console.log('Erro ao carregar psicólogos:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadHeaderMetrics();
  }, []);

  useEffect(() => {
    setLoading(true);
    const delay = setTimeout(() => {
      fetchData(1);
    }, 300);
    return () => clearTimeout(delay);
  }, [activeFilter, searchTerm]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadHeaderMetrics();
    fetchData(currentPage);
  }, [activeFilter, currentPage, searchTerm]);

  // -------------------------------------------------------------
  // Abrir Drawer Visão 360 do Psicólogo
  // -------------------------------------------------------------
  const openCSDrawer = async (psy: any) => {
    setSelectedPsi(psy);
    setDrawerVisible(true);
    setDrawerLoading(true);
    setAiDiagnosis(null);

    try {
      const res = await api.get(`/api/admin/psychologists/${psy.id}/full-details`);
      setDrawerData(res.data?.psychologist || res.data || psy);
    } catch (e) {
      console.log('Erro ao buscar detalhes completos do psicólogo:', e);
      setDrawerData(psy);
    } finally {
      setDrawerLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Envio de Ação / Mensagem WhatsApp (espelha sendWhatsAppAction)
  // -------------------------------------------------------------
  const handleSendAction = async (item: any, customActionType?: string) => {
    const actionType = customActionType || item.actionType || 'analysis';
    const id = item.id;
    const name = item.nome || 'Colega';
    const firstName = name.split(' ')[0];
    const phone = item.telefone || '';

    setActionLoadingId(`${id}_${actionType}`);

    try {
      let msg = '';

      if (actionType === 'conversion_failure') {
        try {
          const res = await api.post(`/api/admin/psychologists/${id}/ai-conversion-failure`);
          if (res.data?.whatsappCopy) msg = res.data.whatsappCopy;
        } catch (_) {}
        if (!msg) {
          msg = `Olá, ${firstName}! Tudo bem?\n\nEstava acompanhando as métricas do seu perfil na Yelo e é muito bom ver que a sua página está gerando interesse e atraindo cliques no WhatsApp! Notei, porém, que os últimos contatos acabaram ainda não avançando para o agendamento.\n\nQuando o paciente clica no WhatsApp, os primeiros minutos de acolhimento e a forma de conduzir a conversa até o valor da sessão fazem toda a diferença. Recomendo dar uma olhada na ferramenta *Clínica > Manual de Conversão* lá no seu painel — preparamos roteiros práticos justamente para evitar que o paciente deixe no vácuo.\n\nQualquer dúvida ou se quiser trocar uma ideia sobre a abordagem inicial, estou por aqui! 🌿`;
        }
      } else if (actionType === 'analysis') {
        try {
          const res = await api.get(`/api/admin/psychologists/${id}/analyze`);
          if (res.data?.message) {
            msg = res.data.message;
            api.put(`/api/admin/psychologists/${id}/analyzed`, { isProfileAnalyzed: true }).catch(() => {});
          }
        } catch (_) {}
        if (!msg) {
          msg = `Olá, ${firstName}! Como vai?\nAqui é o Anderson, da Yelo. 🌿\n\nPassamos para te desejar boas-vindas e compartilhar uma análise que fizemos do seu perfil agora que você iniciou sua trajetória na plataforma!\n\nAnalisamos a sua página e achamos excelente a sua iniciativa de construir sua vitrine por aqui. Percebemos, no entanto, que a sua *biografia profissional ainda não foi preenchida*.\n\nPara quem busca terapia, a bio é o elemento mais decisivo: é através dela que o paciente compreende como funciona o seu acolhimento e se sente seguro para te chamar no WhatsApp. Sem ela, o perfil perde grande parte do potencial de conversão.\n\nPara deixar sua página completa e pronta para receber contatos, acesse seu painel em *Ajustes > Meu Perfil* e adicione um texto de apresentação simples explicando sua condução clínica.\n\nSe quiser, nossa equipe pode te ajudar com ideias para estruturar esse texto. Estamos totalmente à disposição por aqui! 🚀`;
        }
      } else if (actionType === 'expiring_trial') {
        try {
          const res = await api.post(`/api/admin/psychologists/${id}/ai-expiring-trial-message`);
          if (res.data?.whatsappCopy) msg = res.data.whatsappCopy;
        } catch (_) {}
      } else if (actionType === 'churn') {
        try {
          const res = await api.post(`/api/admin/psychologists/${id}/ai-churn-message`);
          if (res.data?.whatsappCopy) msg = res.data.whatsappCopy;
        } catch (_) {}
      } else if (actionType === 'paid_churn') {
        try {
          const res = await api.post(`/api/admin/psychologists/${id}/ai-paid-churn-message`);
          if (res.data?.whatsappCopy) msg = res.data.whatsappCopy;
        } catch (_) {}
        if (!msg) {
          msg = `Olá, ${firstName}! Tudo bem? Aqui é o Anderson da Yelo. 🌿\n\nEstou passando para te dar um toque rápido e super importante sobre a sua conta: o nosso sistema tentou renovar automaticamente a sua assinatura mensal, mas a operadora do seu cartão recusou a cobrança.\n\nPor conta disso, o seu perfil entrou em pausa temporária para novos pacientes.\n\nNão quero de forma alguma que você saia do ar e perca o embalo de novos agendamentos que estamos construindo juntos.\n\nPara o seu perfil voltar ao ar imediatamente, acesse sua conta na Yelo, vá na aba *"Ajustes" > "Assinaturas e Planos"* e atualize seu cartão ou emita um Pix.\n\nQualquer dúvida, estou à disposição! 🌿`;
        }
      } else if (actionType === 'incomplete') {
        msg = `Olá, ${firstName}! Tudo bem? Aqui é o Anderson, da Yelo. 🌿\n\nVi que você deu o primeiro passo e iniciou o seu cadastro na nossa plataforma, mas acabou não finalizando o preenchimento do seu perfil.\n\nPassei só para te lembrar que os seus 7 dias de teste gratuito só começam a contar depois que o seu perfil estiver completo e a sua página disponível para receber pacientes!\n\nSe precisar de uma mãozinha para preencher a sua bio ou tiver qualquer dúvida, é só me dar um toque respondendo esta mensagem. Sigo super à disposição por aqui!`;
      } else if (actionType === 'low_performance') {
        try {
          const res = await api.post(`/api/admin/psychologists/${id}/ai-diagnosis`);
          if (res.data?.whatsappCopy) msg = res.data.whatsappCopy;
        } catch (_) {}
      } else if (actionType === 'negotiation') {
        msg = `Olá, ${firstName}. Como vai?\n\nPreciso da sua ajuda com um retorno rápido sobre as negociações com pacientes pela Yelo.\n\n• Conseguiram conversar novamente?\n• O paciente iniciou a terapia?\n\nLeva menos de 1 minuto e essa informação é essencial para avaliarmos a qualidade dos encaminhamentos.\n\nPara responder, acesse sua conta na Yelo e vá até a opção *Evolução > Histórico de Contatos*.\n\nObrigado! 🌿`;
      } else {
        msg = `Olá, ${firstName}! Tudo bem? Aqui é o Anderson da Yelo. 🌿\n\nPassando para acompanhar sua experiência na plataforma e saber se precisa de algum suporte no seu perfil.\n\nSigo à disposição!`;
      }

      const formattedMsg = formatForWhatsApp(msg);

      // Copia para área de transferência para segurança
      await Clipboard.setStringAsync(formattedMsg);

      // Dispara envio do WhatsApp se tiver telefone
      let cleanPhone = (phone || '').toString().replace(/\D/g, '');
      if (cleanPhone) {
        if (cleanPhone.length === 10 || cleanPhone.length === 11) {
          cleanPhone = '55' + cleanPhone;
        }
        const nativeUrl = `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(formattedMsg)}`;
        const webUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(formattedMsg)}`;

        const canOpen = await Linking.canOpenURL(nativeUrl);
        if (canOpen) {
          await Linking.openURL(nativeUrl);
        } else {
          await Linking.openURL(webUrl);
        }
      } else {
        Alert.alert(
          'Profissional Sem Telefone',
          'A mensagem foi gerada e copiada para a área de transferência com sucesso!',
          [{ text: 'OK' }]
        );
      }

      // Registra no banco via action-sent
      api
        .patch(`/api/admin/psychologists/${id}/action-sent`, {
          actionType,
          messageContent: formattedMsg,
        })
        .then(() => {
          if (activeFilter.includes('pending')) {
            fetchData(currentPage);
          }
        })
        .catch(() => {});
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Erro ao processar mensagem.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // -------------------------------------------------------------
  // Descartar Ação Pendente (espelha dismissAction)
  // -------------------------------------------------------------
  const handleDismissAction = (id: string, actionType: string) => {
    setConfirmModal({
      visible: true,
      title: 'Descartar Ação',
      message:
        'Deseja ignorar esta ação e removê-la da lista (nenhuma mensagem será enviada)?',
      onConfirm: async () => {
        try {
          await api.patch(`/api/admin/psychologists/${id}/action-sent`, {
            actionType,
            messageContent: 'Ação ignorada/descartada pelo Admin.',
          });
          setConfirmModal((prev) => ({ ...prev, visible: false }));
          fetchData(currentPage);
        } catch (e: any) {
          Alert.alert('Erro', e.message || 'Erro ao descartar ação.');
        }
      },
    });
  };

  // -------------------------------------------------------------
  // Excluir Psicólogo
  // -------------------------------------------------------------
  const handleDeletePsychologist = (id: string, name: string) => {
    setConfirmModal({
      visible: true,
      title: 'Excluir Profissional',
      message: `Tem certeza que deseja excluir o psicólogo "${name}" permanentemente?`,
      onConfirm: async () => {
        try {
          await api.delete(`/api/admin/psychologists/${id}`);
          setConfirmModal((prev) => ({ ...prev, visible: false }));
          fetchData(currentPage);
        } catch (e: any) {
          Alert.alert('Erro', e.message || 'Erro ao excluir psicólogo.');
        }
      },
    });
  };

  // -------------------------------------------------------------
  // Alternar Status VIP no Drawer
  // -------------------------------------------------------------
  const handleToggleVip = async (psy: any) => {
    const isCurrentlyVip = psy.is_exempt;
    const newPlan = isCurrentlyVip ? null : 'CLINICAL';

    try {
      await api.patch(`/api/admin/psychologists/${psy.id}/vip`, { plan: newPlan });
      Alert.alert(
        'Sucesso',
        isCurrentlyVip ? 'Isenção VIP removida.' : 'Isenção VIP concedida com sucesso!'
      );
      setDrawerData((prev: any) => ({ ...prev, is_exempt: !isCurrentlyVip }));
      fetchData(currentPage);
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Erro ao atualizar status VIP.');
    }
  };

  // -------------------------------------------------------------
  // Expirar Perfil no Drawer
  // -------------------------------------------------------------
  const handleExpireProfile = async (psy: any) => {
    setConfirmModal({
      visible: true,
      title: 'Expirar Perfil',
      message: `Deseja marcar o perfil de "${psy.nome}" como Inativo / Expirado?`,
      onConfirm: async () => {
        try {
          await api.put(`/api/admin/psychologists/${psy.id}/status`, { status: 'inactive' });
          setConfirmModal((prev) => ({ ...prev, visible: false }));
          Alert.alert('Sucesso', 'Perfil marcado como inativo.');
          setDrawerData((prev: any) => ({ ...prev, status: 'inactive' }));
          fetchData(currentPage);
        } catch (e: any) {
          Alert.alert('Erro', e.message || 'Erro ao expirar perfil.');
        }
      },
    });
  };

  // -------------------------------------------------------------
  // Gerar Diagnóstico com IA no Drawer
  // -------------------------------------------------------------
  const handleGenerateAiDiagnosis = async (psy: any) => {
    setAiDiagnosisLoading(true);
    try {
      const res = await api.post(`/api/admin/psychologists/${psy.id}/ai-diagnosis`);
      if (res.data) {
        setAiDiagnosis({
          diagnosis: res.data.diagnosis || res.data.analise || 'Diagnóstico concluído.',
          copy: res.data.whatsappCopy || res.data.mensagem || '',
        });
      }
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Erro ao gerar diagnóstico de IA.');
    } finally {
      setAiDiagnosisLoading(false);
    }
  };

  // Render Diff Badge para Header (+X.X%, -X.X%, = 0.0%)
  const renderMetricDiff = (diff: number | undefined) => {
    if (diff === undefined || diff === null || isNaN(diff)) {
      return <Text className="font-sans text-white/50 text-[10px] mt-1">tempo real</Text>;
    }
    const diffPct = (diff * 100).toFixed(1);
    const num = parseFloat(diffPct);
    if (num > 0) {
      return (
        <View className="bg-emerald-500/20 px-[6px] py-[2px] rounded-[4px] mt-1 flex-row items-center">
          <Feather name="trending-up" size={10} color="#34d399" style={{ marginRight: 2 }} />
          <Text className="font-sans font-bold text-[#34d399] text-[10px]">+{diffPct}%</Text>
        </View>
      );
    } else if (num < 0) {
      return (
        <View className="bg-red-500/20 px-[6px] py-[2px] rounded-[4px] mt-1 flex-row items-center">
          <Feather name="trending-down" size={10} color="#f87171" style={{ marginRight: 2 }} />
          <Text className="font-sans font-bold text-[#f87171] text-[10px]">{diffPct}%</Text>
        </View>
      );
    } else {
      return (
        <View className="bg-white/10 px-[6px] py-[2px] rounded-[4px] mt-1 flex-row items-center">
          <Text className="font-sans text-white/70 text-[10px]">= 0.0%</Text>
        </View>
      );
    }
  };

  const isFollowupMode = [
    'pending_actions',
    'pending_paid_churn',
    'pending_expiring_trial',
    'pending_incomplete',
  ].includes(activeFilter);

  // Formatação de MRR
  const mrrFormatted = Number(stats?.mrr || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  const activationPct =
    founderMetrics.activationRate !== undefined
      ? `${(founderMetrics.activationRate * 100).toFixed(1)}%`
      : '--';
  const postTrialPct =
    founderMetrics.postTrialRetentionRate !== undefined
      ? `${(founderMetrics.postTrialRetentionRate * 100).toFixed(1)}%`
      : '--';
  const renewalPct =
    founderMetrics.renewalRate !== undefined
      ? `${(founderMetrics.renewalRate * 100).toFixed(1)}%`
      : '--';

  return (
    <View className="flex-1 bg-[#f8fafc]">
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1B4332" />}
      >
        {/* ========================================================= */}
        {/* 1. CABEÇALHO SUPERIOR (GRADIENTE YELO #1B4332 -> #0f2b20) */}
        {/* ========================================================= */}
        <LinearGradient
          colors={['#1B4332', '#0f2b20']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="rounded-[20px] p-[20px] mb-[20px] shadow-sm"
        >
          <View className="mb-[16px]">
            <Text className="font-title text-white text-[22px]">Sucesso do Psicólogo (CS)</Text>
            <Text className="font-sans text-white/80 text-[13px] mt-1">
              Monitoramento de saúde da assinatura, engajamento e força do perfil.
            </Text>
          </View>

          {/* 4 Métricas de Topo */}
          <View className="flex-row flex-wrap gap-[10px]">
            {/* MRR */}
            <TouchableOpacity
              onPress={() =>
                setTooltipModal({
                  visible: true,
                  title: 'MRR',
                  desc: 'Receita Mensal Recorrente estimada baseada nas assinaturas ativas em tempo real.',
                })
              }
              className="bg-white/10 rounded-[14px] p-[12px] flex-1 min-w-[45%] items-center justify-center"
            >
              <View className="flex-row items-center gap-[4px] mb-1">
                <Text className="font-sans text-white/70 text-[11px] font-bold uppercase tracking-wider">
                  MRR
                </Text>
                <Feather name="info" size={12} color="rgba(255,255,255,0.6)" />
              </View>
              <Text className="font-title text-white text-[20px] text-center">{mrrFormatted}</Text>
              <Text className="font-sans text-white/50 text-[10px] mt-1 text-center">tempo real</Text>
            </TouchableOpacity>

            {/* Ativação */}
            <TouchableOpacity
              onPress={() =>
                setTooltipModal({
                  visible: true,
                  title: 'Taxa de Ativação',
                  desc: 'Percentual de psicólogos cadastrados nos últimos 30 dias que ativaram o perfil e estão prontos para atendimento.',
                })
              }
              className="bg-white/10 rounded-[14px] p-[12px] flex-1 min-w-[45%] items-center justify-center"
            >
              <View className="flex-row items-center gap-[4px] mb-1">
                <Text className="font-sans text-white/70 text-[11px] font-bold uppercase tracking-wider">
                  Ativação
                </Text>
                <Feather name="info" size={12} color="rgba(255,255,255,0.6)" />
              </View>
              <Text className="font-title text-[#10b981] text-[20px] text-center">{activationPct}</Text>
              {renderMetricDiff(founderMetrics.activationDiff)}
            </TouchableOpacity>

            {/* Pós-Trial */}
            <TouchableOpacity
              onPress={() =>
                setTooltipModal({
                  visible: true,
                  title: 'Retenção Pós-Trial',
                  desc: 'Percentual de psicólogos que continuam pagantes ativos após o trial nos últimos 30 dias.',
                })
              }
              className="bg-white/10 rounded-[14px] p-[12px] flex-1 min-w-[45%] items-center justify-center"
            >
              <View className="flex-row items-center gap-[4px] mb-1">
                <Text className="font-sans text-white/70 text-[11px] font-bold uppercase tracking-wider">
                  Pós-Trial
                </Text>
                <Feather name="info" size={12} color="rgba(255,255,255,0.6)" />
              </View>
              <Text className="font-title text-[#3b82f6] text-[20px] text-center">{postTrialPct}</Text>
              {renderMetricDiff(founderMetrics.postTrialDiff)}
            </TouchableOpacity>

            {/* Renovação */}
            <TouchableOpacity
              onPress={() =>
                setTooltipModal({
                  visible: true,
                  title: 'Renovação',
                  desc: 'Percentual de psicólogos elegíveis que renovaram a mensalidade nos últimos 30 dias.',
                })
              }
              className="bg-white/10 rounded-[14px] p-[12px] flex-1 min-w-[45%] items-center justify-center"
            >
              <View className="flex-row items-center gap-[4px] mb-1">
                <Text className="font-sans text-white/70 text-[11px] font-bold uppercase tracking-wider">
                  Renovação
                </Text>
                <Feather name="info" size={12} color="rgba(255,255,255,0.6)" />
              </View>
              <Text className="font-title text-[#a855f7] text-[20px] text-center">{renewalPct}</Text>
              {renderMetricDiff(founderMetrics.renewalDiff)}
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* ========================================================= */}
        {/* 2. AÇÕES PRIORITÁRIAS                                      */}
        {/* ========================================================= */}
        <View className="mb-[20px]">
          <View className="flex-row items-center gap-[8px] mb-[12px]">
            <Feather name="alert-triangle" size={18} color="#f59e0b" />
            <Text className="font-title text-[#1e293b] text-[18px]">Ações Prioritárias</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-[10px]">
            {/* Trials Acabando */}
            <TouchableOpacity
              onPress={() => setActiveFilter('pending_expiring_trial')}
              activeOpacity={0.8}
              className={`p-[16px] rounded-[16px] w-[180px] border ${
                activeFilter === 'pending_expiring_trial'
                  ? 'bg-[#fef3c7] border-[#d97706]'
                  : 'bg-[#fffbeb] border-[#fde68a]'
              }`}
            >
              <Text className="font-title text-[#d97706] text-[26px] mb-1">
                {kpis.pending_expiring_trial || 0}
              </Text>
              <Text className="font-title text-[#92400e] text-[15px] mb-[2px]">Trials Acabando</Text>
              <Text className="font-sans text-[#b45309] text-[12px]">Vencimento nas próximas 24h</Text>
            </TouchableOpacity>

            {/* Pagamentos Falhados */}
            <TouchableOpacity
              onPress={() => setActiveFilter('pending_paid_churn')}
              activeOpacity={0.8}
              className={`p-[16px] rounded-[16px] w-[180px] border ${
                activeFilter === 'pending_paid_churn'
                  ? 'bg-[#fee2e2] border-[#dc2626]'
                  : 'bg-[#fef2f2] border-[#fecaca]'
              }`}
            >
              <Text className="font-title text-[#dc2626] text-[26px] mb-1">
                {kpis.pending_paid_churn || 0}
              </Text>
              <Text className="font-title text-[#991b1b] text-[15px] mb-[2px]">Pagamentos Falhados</Text>
              <Text className="font-sans text-[#b91c1c] text-[12px]">Necessitam de contato urgente</Text>
            </TouchableOpacity>

            {/* Perfis Incompletos */}
            <TouchableOpacity
              onPress={() => setActiveFilter('pending_incomplete')}
              activeOpacity={0.8}
              className={`p-[16px] rounded-[16px] w-[180px] border ${
                activeFilter === 'pending_incomplete'
                  ? 'bg-[#dcfce7] border-[#16a34a]'
                  : 'bg-[#f0fdf4] border-[#bbf7d0]'
              }`}
            >
              <Text className="font-title text-[#16a34a] text-[26px] mb-1">{kpis.pending || 0}</Text>
              <Text className="font-title text-[#166534] text-[15px] mb-[2px]">Perfis Incompletos</Text>
              <Text className="font-sans text-[#15803d] text-[12px]">Pendentes há mais de 3 dias</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* ========================================================= */}
        {/* 3. FUNIL E STATUS PRINCIPAIS                               */}
        {/* ========================================================= */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-[15px] gap-[10px]">
          {/* Pagantes */}
          <TouchableOpacity
            onPress={() => setActiveFilter('active_paying')}
            activeOpacity={0.8}
            className={`bg-white rounded-[16px] p-[14px] w-[130px] border-t-4 border-[#10b981] border border-[#e2e8f0] shadow-sm items-center ${
              activeFilter === 'active_paying' ? 'bg-emerald-50 border-[#10b981]' : ''
            }`}
          >
            <View className="flex-row items-center gap-[4px] mb-[4px]">
              <Feather name="dollar-sign" size={13} color="#10b981" />
              <Text className="font-sans font-bold text-[#475569] text-[12px]">Pagantes</Text>
            </View>
            <Text className="font-title text-[#10b981] text-[22px] text-center">
              {kpis.active_paying || 0}
            </Text>
            <Text className="font-sans text-emerald-600 text-[11px] text-center mt-1">+5 este mês</Text>
          </TouchableOpacity>

          {/* Em Trial */}
          <TouchableOpacity
            onPress={() => setActiveFilter('active_trial')}
            activeOpacity={0.8}
            className={`bg-white rounded-[16px] p-[14px] w-[130px] border-t-4 border-[#3b82f6] border border-[#e2e8f0] shadow-sm items-center ${
              activeFilter === 'active_trial' ? 'bg-blue-50 border-[#3b82f6]' : ''
            }`}
          >
            <View className="flex-row items-center gap-[4px] mb-[4px]">
              <Feather name="clock" size={13} color="#3b82f6" />
              <Text className="font-sans font-bold text-[#475569] text-[12px]">Em Trial</Text>
            </View>
            <Text className="font-title text-[#3b82f6] text-[22px] text-center">
              {kpis.active_trial || 0}
            </Text>
            <Text className="font-sans text-[#64748b] text-[11px] text-center mt-1">Mantido</Text>
          </TouchableOpacity>

          {/* Churn no Mês */}
          <TouchableOpacity
            onPress={() => setActiveFilter('churn_month')}
            activeOpacity={0.8}
            className={`bg-white rounded-[16px] p-[14px] w-[130px] border-t-4 border-[#ef4444] border border-[#e2e8f0] shadow-sm items-center ${
              activeFilter === 'churn_month' ? 'bg-red-50 border-[#ef4444]' : ''
            }`}
          >
            <View className="flex-row items-center gap-[4px] mb-[4px]">
              <Feather name="user-x" size={13} color="#ef4444" />
              <Text className="font-sans font-bold text-[#475569] text-[12px]">Churn no Mês</Text>
            </View>
            <Text className="font-title text-[#ef4444] text-[22px] text-center">
              {kpis.churn_month || 0}
            </Text>
            <Text className="font-sans text-[#ef4444] text-[11px] text-center mt-1">Pagantes do mês</Text>
          </TouchableOpacity>

          {/* Pendentes */}
          <TouchableOpacity
            onPress={() => setActiveFilter('pending')}
            activeOpacity={0.8}
            className={`bg-white rounded-[16px] p-[14px] w-[130px] border-t-4 border-[#f59e0b] border border-[#e2e8f0] shadow-sm items-center ${
              activeFilter === 'pending' ? 'bg-amber-50 border-[#f59e0b]' : ''
            }`}
          >
            <View className="flex-row items-center gap-[4px] mb-[4px]">
              <Feather name="alert-circle" size={13} color="#f59e0b" />
              <Text className="font-sans font-bold text-[#475569] text-[12px]">Pendentes</Text>
            </View>
            <Text className="font-title text-[#f59e0b] text-[22px] text-center">
              {kpis.pending || 0}
            </Text>
            <Text className="font-sans text-[#b45309] text-[11px] text-center mt-1">há &gt; 3 dias</Text>
          </TouchableOpacity>

          {/* Inativos */}
          <TouchableOpacity
            onPress={() => setActiveFilter('inactive')}
            activeOpacity={0.8}
            className={`bg-white rounded-[16px] p-[14px] w-[130px] border-t-4 border-[#ef4444] border border-[#e2e8f0] shadow-sm items-center ${
              activeFilter === 'inactive' ? 'bg-red-50 border-[#ef4444]' : ''
            }`}
          >
            <View className="flex-row items-center gap-[4px] mb-[4px]">
              <Feather name="slash" size={13} color="#ef4444" />
              <Text className="font-sans font-bold text-[#475569] text-[12px]">Inativos</Text>
            </View>
            <Text className="font-title text-[#ef4444] text-[22px] text-center">
              {kpis.inactive || 0}
            </Text>
            <Text className="font-sans text-[#ef4444] text-[11px] text-center mt-1">Cancelados</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* ========================================================= */}
        {/* 4. ORIGEM (UTM)                                            */}
        {/* ========================================================= */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-[20px] gap-[10px]">
          {/* WhatsApp */}
          <TouchableOpacity
            onPress={() => setActiveFilter('utm_whatsapp')}
            activeOpacity={0.8}
            className={`bg-white rounded-[14px] p-[12px] w-[110px] border-t-4 border-[#10b981] border border-[#e2e8f0] shadow-sm items-center ${
              activeFilter === 'utm_whatsapp' ? 'bg-emerald-50' : ''
            }`}
          >
            <Text className="font-sans font-bold text-[#10b981] text-[11px] mb-1">WhatsApp</Text>
            <Text className="font-title text-[#10b981] text-[18px] text-center">
              {kpis.utm_whatsapp || 0}
            </Text>
          </TouchableOpacity>

          {/* Meta / IG */}
          <TouchableOpacity
            onPress={() => setActiveFilter('utm_meta')}
            activeOpacity={0.8}
            className={`bg-white rounded-[14px] p-[12px] w-[110px] border-t-4 border-[#3b82f6] border border-[#e2e8f0] shadow-sm items-center ${
              activeFilter === 'utm_meta' ? 'bg-blue-50' : ''
            }`}
          >
            <Text className="font-sans font-bold text-[#3b82f6] text-[11px] mb-1">Meta / IG</Text>
            <Text className="font-title text-[#3b82f6] text-[18px] text-center">{kpis.utm_meta || 0}</Text>
          </TouchableOpacity>

          {/* Google */}
          <TouchableOpacity
            onPress={() => setActiveFilter('utm_google')}
            activeOpacity={0.8}
            className={`bg-white rounded-[14px] p-[12px] w-[110px] border-t-4 border-[#f59e0b] border border-[#e2e8f0] shadow-sm items-center ${
              activeFilter === 'utm_google' ? 'bg-amber-50' : ''
            }`}
          >
            <Text className="font-sans font-bold text-[#f59e0b] text-[11px] mb-1">Google</Text>
            <Text className="font-title text-[#f59e0b] text-[18px] text-center">
              {kpis.utm_google || 0}
            </Text>
          </TouchableOpacity>

          {/* Instagram */}
          <TouchableOpacity
            onPress={() => setActiveFilter('utm_instagram_bio')}
            activeOpacity={0.8}
            className={`bg-white rounded-[14px] p-[12px] w-[110px] border-t-4 border-[#ec4899] border border-[#e2e8f0] shadow-sm items-center ${
              activeFilter === 'utm_instagram_bio' ? 'bg-pink-50' : ''
            }`}
          >
            <Text className="font-sans font-bold text-[#ec4899] text-[11px] mb-1">Instagram</Text>
            <Text className="font-title text-[#ec4899] text-[18px] text-center">
              {kpis.utm_instagram_bio || 0}
            </Text>
          </TouchableOpacity>

          {/* Outros / Direto */}
          <TouchableOpacity
            onPress={() => setActiveFilter('utm_outros')}
            activeOpacity={0.8}
            className={`bg-white rounded-[14px] p-[12px] w-[110px] border-t-4 border-[#64748b] border border-[#e2e8f0] shadow-sm items-center ${
              activeFilter === 'utm_outros' ? 'bg-slate-50' : ''
            }`}
          >
            <Text className="font-sans font-bold text-[#64748b] text-[11px] mb-1">Direto</Text>
            <Text className="font-title text-[#64748b] text-[18px] text-center">
              {kpis.utm_outros || 0}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* ========================================================= */}
        {/* 5. ABAS DO FUNIL (PILLS)                                   */}
        {/* ========================================================= */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-[15px]">
          <View className="flex-row gap-[8px]">
            {[
              { id: '', label: 'Todos' },
              { id: 'pending_actions', label: 'Follow-ups 📞' },
              { id: 'active_paying', label: 'Pagantes' },
              { id: 'active_trial', label: 'Trials' },
              { id: 'churn_month', label: 'Churn Pagante 📉' },
              { id: 'pending', label: 'Pendentes' },
              { id: 'inactive', label: 'Inativos' },
              { id: 'vip', label: 'VIPs' },
              { id: 'not_analyzed', label: 'Fila CS ✨' },
              { id: 'deleted', label: 'Lixeira 🗑️' },
            ].map((tab) => {
              const isActive = activeFilter === tab.id;
              const isFollowupTab = tab.id === 'pending_actions';

              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setActiveFilter(tab.id)}
                  className={`px-[16px] py-[8px] rounded-full border ${
                    isActive
                      ? 'bg-[#1B4332] border-[#1B4332]'
                      : isFollowupTab
                      ? 'bg-blue-50 border-[#3b82f6]'
                      : 'bg-[#f8f9fa] border-[#e2e8f0]'
                  }`}
                >
                  <Text
                    className={`font-sans font-bold text-[13px] ${
                      isActive
                        ? 'text-white'
                        : isFollowupTab
                        ? 'text-[#3b82f6]'
                        : 'text-[#64748b]'
                    }`}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* ========================================================= */}
        {/* 6. BUSCA                                                   */}
        {/* ========================================================= */}
        <View className="bg-white rounded-full px-[16px] py-[10px] border border-[#e2e8f0] flex-row items-center mb-[18px] shadow-sm">
          <Feather name="search" size={18} color="#94a3b8" />
          <TextInput
            placeholder="Buscar psicólogo..."
            placeholderTextColor="#94a3b8"
            value={searchTerm}
            onChangeText={setSearchTerm}
            className="flex-1 ml-[10px] font-sans text-[14px] text-[#1e293b]"
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm('')}>
              <Feather name="x" size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        {/* ========================================================= */}
        {/* 7. LISTA DE CARDS (MODO FOLLOW-UP OU MODO PADRÃO)          */}
        {/* ========================================================= */}
        {loading ? (
          <View className="py-[40px] items-center justify-center">
            <ActivityIndicator size="large" color="#1B4332" />
            <Text className="font-sans text-[#64748b] text-[13px] mt-3">Carregando CRM...</Text>
          </View>
        ) : isFollowupMode ? (
          // ================= MODO FOLLOW-UP =================
          pendingActions.length === 0 ? (
            <View className="bg-white rounded-[18px] p-[30px] items-center border border-[#e2e8f0]">
              <Text className="text-[28px] mb-2">🎉</Text>
              <Text className="font-title text-[#1B4332] text-[16px]">Nenhuma ação pendente!</Text>
              <Text className="font-sans text-[#64748b] text-[13px] text-center mt-1">
                Todas as tarefas prioritárias de CS estão em dia.
              </Text>
            </View>
          ) : (
            pendingActions.map((item, idx) => {
              const actionLoading = actionLoadingId === `${item.id}_${item.actionType}`;

              // Cores e labels contextuais do botão de ação primária
              let btnLabel = 'Contatar (WhatsApp)';
              let btnGradient = ['#16a34a', '#15803d'];
              let btnIcon: any = 'message-circle';
              let badgeBg = '#fef3c7';
              let badgeColor = '#b45309';
              let badgeText = item.actionType;

              if (item.actionType === 'conversion_failure') {
                btnLabel = 'Reverter Falha (IA)';
                btnGradient = ['#e11d48', '#be123c'];
                btnIcon = 'zap';
                badgeBg = '#fee2e2';
                badgeColor = '#b91c1c';
                badgeText = 'Falha Conversão';
              } else if (item.actionType === 'analysis') {
                btnLabel = 'Enviar Análise (IA)';
                btnGradient = ['#2563eb', '#1d4ed8'];
                btnIcon = 'award';
                badgeBg = '#dbeafe';
                badgeColor = '#1d4ed8';
                badgeText = 'Análise Pronta';
              } else if (item.actionType === 'low_performance') {
                btnLabel = 'Diagnóstico (IA)';
                btnGradient = ['#7c3aed', '#6d28d9'];
                btnIcon = 'cpu';
                badgeBg = '#f3e8ff';
                badgeColor = '#7c3aed';
                badgeText = 'Análise (IA)';
              } else if (item.actionType === 'expiring_trial') {
                btnLabel = 'Converter Plano (IA)';
                btnGradient = ['#d97706', '#b45309'];
                btnIcon = 'clock';
                badgeBg = '#fef08a';
                badgeColor = '#b45309';
                badgeText = 'Trial Expirando';
              } else if (item.actionType === 'churn') {
                btnLabel = 'Resgate Trial (IA)';
                btnGradient = ['#ea580c', '#c2410c'];
                btnIcon = 'life-buoy';
                badgeBg = '#ffedd5';
                badgeColor = '#c2410c';
                badgeText = 'Churn Trial';
              } else if (item.actionType === 'paid_churn') {
                btnLabel = 'Recuperar Assinante';
                btnGradient = ['#991b1b', '#7f1d1d'];
                btnIcon = 'shield';
                badgeBg = '#ffe4e6';
                badgeColor = '#be123c';
                badgeText = 'Churn Pago';
              } else if (item.actionType === 'billing_feedback') {
                btnLabel = 'Checar Contato';
                btnGradient = ['#0284c7', '#0369a1'];
                btnIcon = 'message-square';
                badgeBg = '#e0e7ff';
                badgeColor = '#4338ca';
                badgeText = 'Feedback/Cobrança';
              } else if (item.actionType === 'incomplete') {
                btnLabel = 'Ativar Perfil';
                btnGradient = ['#059669', '#047857'];
                btnIcon = 'user-check';
                badgeBg = '#fef3c7';
                badgeColor = '#b45309';
                badgeText = 'Perfil Incompleto';
              } else if (item.actionType === 'negotiation') {
                btnLabel = 'Acompanhar Negociação';
                btnGradient = ['#4f46e5', '#4338ca'];
                btnIcon = 'users';
                badgeBg = '#ffedd5';
                badgeColor = '#c2410c';
                badgeText = 'Em Negociação';
              }

              const dateStr = item.planExpiresAt
                ? new Date(item.planExpiresAt).toLocaleDateString('pt-BR')
                : item.createdAt
                ? new Date(item.createdAt).toLocaleDateString('pt-BR')
                : '-';

              return (
                <View
                  key={`${item.id}_${item.actionType}_${idx}`}
                  className="bg-white rounded-[18px] p-[16px] mb-[14px] border border-[#e2e8f0] shadow-sm"
                >
                  {/* Topo do Card */}
                  <View className="flex-row items-center gap-[12px] pb-[12px] border-b border-[#f1f5f9]">
                    <View className="w-[42px] h-[42px] rounded-full bg-[#f0fdf4] border border-[#bbf7d0] items-center justify-center">
                      <Text className="font-title text-[#166534] text-[16px]">
                        {(item.nome || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <TouchableOpacity onPress={() => openCSDrawer(item)}>
                        <Text className="font-title text-[#1B4332] text-[16px]">
                          {item.nome || 'Sem Nome'}
                        </Text>
                      </TouchableOpacity>
                      <Text className="font-sans text-[#64748b] text-[12px]">
                        {item.telefone || 'Sem telefone'}
                      </Text>
                    </View>
                  </View>

                  {/* Linhas Internas */}
                  <View className="py-[10px] gap-[8px]">
                    {/* Status da Ação */}
                    <View className="flex-row justify-between items-center">
                      <Text className="font-sans text-[#64748b] text-[11px] font-bold uppercase tracking-wider">
                        Status da Ação
                      </Text>
                      <View
                        className="px-[10px] py-[3px] rounded-full"
                        style={{ backgroundColor: badgeBg }}
                      >
                        <Text
                          className="font-sans font-bold text-[11px]"
                          style={{ color: badgeColor }}
                        >
                          {badgeText}
                        </Text>
                      </View>
                    </View>

                    {/* Motivo do Contato */}
                    <View className="mt-1">
                      <Text className="font-sans text-[#64748b] text-[11px] font-bold uppercase tracking-wider mb-1">
                        Motivo do Contato
                      </Text>
                      <View className="bg-[#f8fafc] border border-[#e2e8f0] border-l-4 border-l-[#3b82f6] p-[10px] rounded-[8px]">
                        <Text className="font-sans text-[#1e293b] text-[13px] leading-5">
                          {item.reason}
                        </Text>
                      </View>
                    </View>

                    {/* Data / Previsão */}
                    <View className="flex-row justify-between items-center pt-1">
                      <Text className="font-sans text-[#64748b] text-[11px] font-bold uppercase tracking-wider">
                        Data / Previsão
                      </Text>
                      <Text className="font-sans font-semibold text-[#1e293b] text-[13px]">
                        {dateStr}
                      </Text>
                    </View>

                    {/* Plano */}
                    <View className="flex-row justify-between items-center">
                      <Text className="font-sans text-[#64748b] text-[11px] font-bold uppercase tracking-wider">
                        Plano
                      </Text>
                      <Text className="font-sans font-semibold text-[#1e293b] text-[13px]">
                        {item.plano ? item.plano.toUpperCase() : '-'}
                      </Text>
                    </View>
                  </View>

                  {/* Rodapé: Ações CS */}
                  <View className="flex-row items-center gap-[8px] pt-[12px] border-t border-[#f1f5f9]">
                    <TouchableOpacity
                      onPress={() => handleSendAction(item)}
                      disabled={actionLoading}
                      className="flex-1 rounded-full overflow-hidden"
                    >
                      <LinearGradient
                        colors={btnGradient as any}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        className="py-[10px] px-[14px] flex-row items-center justify-center gap-[6px]"
                      >
                        {actionLoading ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Feather name={btnIcon} size={14} color="#fff" />
                            <Text className="font-sans font-bold text-white text-[13px]">
                              {btnLabel}
                            </Text>
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleDismissAction(item.id, item.actionType)}
                      className="border border-[#ef4444] px-[14px] py-[9px] rounded-full bg-white flex-row items-center gap-[4px]"
                    >
                      <Feather name="x" size={13} color="#ef4444" />
                      <Text className="font-sans font-bold text-[#ef4444] text-[12px]">Ignorar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )
        ) : (
          // ================= MODO PADRÃO =================
          psychologists.length === 0 ? (
            <View className="bg-white rounded-[18px] p-[30px] items-center border border-[#e2e8f0]">
              <Text className="text-[28px] mb-2">🔍</Text>
              <Text className="font-title text-[#1B4332] text-[16px]">Nenhum psicólogo encontrado</Text>
              <Text className="font-sans text-[#64748b] text-[13px] text-center mt-1">
                Tente ajustar os filtros ou o termo de busca.
              </Text>
            </View>
          ) : (
            psychologists.map((psy) => {
              const isVip = psy.is_exempt === true;
              const isDeleted = psy.deletedAt !== null && psy.deletedAt !== undefined;
              const { score } = calculateProfileHealth(psy);

              let statusLabel = 'Ativo';
              let statusBg = '#dcfce7';
              let statusColor = '#15803d';

              if (isDeleted) {
                statusLabel = 'Excluído';
                statusBg = '#f1f5f9';
                statusColor = '#64748b';
              } else if (isVip) {
                statusLabel = 'VIP';
                statusBg = '#fefce8';
                statusColor = '#a16207';
              } else if (psy.status === 'pending') {
                statusLabel = 'Incompleto';
                statusBg = '#ffedd5';
                statusColor = '#9a3412';
              } else if (psy.status === 'inactive') {
                statusLabel = 'Expirado';
                statusBg = '#fee2e2';
                statusColor = '#b91c1c';
              } else if (
                psy.status === 'active' &&
                !psy.subscriptionId &&
                !(psy.subscription_payments_count > 0)
              ) {
                statusLabel = 'Trial';
                statusBg = '#fef3c7';
                statusColor = '#b45309';
              }

              let scoreColor = '#ef4444';
              if (score >= 75) scoreColor = '#10b981';
              else if (score >= 50) scoreColor = '#f59e0b';

              const planoName = psy.plano
                ? psy.plano.charAt(0).toUpperCase() + psy.plano.slice(1).toLowerCase()
                : 'Nenhum';

              const dataInscricao = psy.createdAt
                ? new Date(psy.createdAt).toLocaleDateString('pt-BR')
                : '-';

              return (
                <View
                  key={psy.id}
                  className="bg-white rounded-[18px] p-[16px] mb-[14px] border border-[#e2e8f0] shadow-sm"
                >
                  {/* Topo do Card */}
                  <View className="flex-row items-center gap-[12px] pb-[12px] border-b border-[#f1f5f9]">
                    {psy.fotoUrl ? (
                      <Image
                        source={{ uri: psy.fotoUrl }}
                        className="w-[42px] h-[42px] rounded-full border border-[#e2e8f0]"
                      />
                    ) : (
                      <View className="w-[42px] h-[42px] rounded-full bg-[#f0fdf4] border border-[#bbf7d0] items-center justify-center">
                        <Text className="font-title text-[#166534] text-[16px]">
                          {(psy.nome || '?').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View className="flex-1">
                      <TouchableOpacity onPress={() => openCSDrawer(psy)}>
                        <Text className="font-title text-[#1B4332] text-[16px]">
                          {psy.nome || 'Sem Nome'}
                        </Text>
                      </TouchableOpacity>
                      <Text className="font-sans text-[#64748b] text-[12px]" numberOfLines={1}>
                        {psy.email || 'Sem email'}
                      </Text>
                    </View>
                  </View>

                  {/* Informações Linha a Linha */}
                  <View className="py-[10px] gap-[8px]">
                    {/* Status / Plano */}
                    <View className="flex-row justify-between items-center">
                      <Text className="font-sans text-[#64748b] text-[11px] font-bold uppercase tracking-wider">
                        Status / Plano
                      </Text>
                      <View className="flex-row items-center gap-[6px]">
                        <View
                          className="px-[8px] py-[2px] rounded-full"
                          style={{ backgroundColor: statusBg }}
                        >
                          <Text
                            className="font-sans font-bold text-[11px]"
                            style={{ color: statusColor }}
                          >
                            {statusLabel}
                          </Text>
                        </View>
                        <Text className="font-sans font-semibold text-[#334155] text-[12px]">
                          {planoName}
                        </Text>
                      </View>
                    </View>

                    {/* Força do Perfil */}
                    <View className="flex-row justify-between items-center">
                      <Text className="font-sans text-[#64748b] text-[11px] font-bold uppercase tracking-wider">
                        Força do Perfil
                      </Text>
                      <View className="flex-row items-center gap-[8px]">
                        <View className="w-[70px] h-[6px] bg-[#e2e8f0] rounded-full overflow-hidden">
                          <View
                            className="h-full rounded-full"
                            style={{ width: `${score}%`, backgroundColor: scoreColor }}
                          />
                        </View>
                        <Text
                          className="font-sans font-bold text-[12px]"
                          style={{ color: scoreColor }}
                        >
                          {score}%
                        </Text>
                      </View>
                    </View>

                    {/* Origem (UTM) */}
                    <View className="flex-row justify-between items-center">
                      <Text className="font-sans text-[#64748b] text-[11px] font-bold uppercase tracking-wider">
                        Origem (UTM)
                      </Text>
                      <View className="bg-[#f1f5f9] px-[8px] py-[2px] rounded-full">
                        <Text className="font-sans font-bold text-[#475569] text-[11px] uppercase">
                          {psy.utm_source || 'Direto'}
                        </Text>
                      </View>
                    </View>

                    {/* Data de Inscrição */}
                    <View className="flex-row justify-between items-center">
                      <Text className="font-sans text-[#64748b] text-[11px] font-bold uppercase tracking-wider">
                        Data de Inscrição
                      </Text>
                      <Text className="font-sans text-[#64748b] text-[12px]">{dataInscricao}</Text>
                    </View>
                  </View>

                  {/* Rodapé de Ações */}
                  <View className="flex-row items-center gap-[8px] pt-[12px] border-t border-[#f1f5f9]">
                    <TouchableOpacity
                      onPress={() => openCSDrawer(psy)}
                      className="flex-1 bg-[#f0fdf4] border border-[#bbf7d0] py-[8px] px-[14px] rounded-full flex-row items-center justify-center gap-[6px]"
                    >
                      <Feather name="eye" size={14} color="#166534" />
                      <Text className="font-sans font-bold text-[#166534] text-[13px]">
                        Visão 360
                      </Text>
                    </TouchableOpacity>

                    {!isDeleted && (
                      <TouchableOpacity
                        onPress={() => handleDeletePsychologist(psy.id, psy.nome)}
                        className="border border-[#fee2e2] px-[12px] py-[8px] rounded-full bg-white flex-row items-center gap-[4px]"
                      >
                        <Feather name="trash-2" size={13} color="#ef4444" />
                        <Text className="font-sans font-bold text-[#ef4444] text-[12px]">Excluir</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )
        )}

        {/* ========================================================= */}
        {/* 8. PAGINAÇÃO                                               */}
        {/* ========================================================= */}
        {!isFollowupMode && totalItems > 0 && (
          <View className="bg-white rounded-[16px] p-[16px] border border-[#e2e8f0] flex-row justify-between items-center mt-[10px] shadow-sm">
            <Text className="font-sans text-[#64748b] text-[13px]">
              Mostrando {Math.min((currentPage - 1) * limit + 1, totalItems)}–
              {Math.min(currentPage * limit, totalItems)} de {totalItems}
            </Text>

            <View className="flex-row gap-[8px]">
              <TouchableOpacity
                onPress={() => fetchData(currentPage - 1)}
                disabled={currentPage <= 1}
                className={`w-[36px] h-[36px] rounded-[8px] items-center justify-center border ${
                  currentPage <= 1
                    ? 'border-[#e2e8f0] opacity-40'
                    : 'border-[#cbd5e1] bg-white'
                }`}
              >
                <Feather name="chevron-left" size={18} color="#1e293b" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => fetchData(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className={`w-[36px] h-[36px] rounded-[8px] items-center justify-center border ${
                  currentPage >= totalPages
                    ? 'border-[#e2e8f0] opacity-40'
                    : 'border-[#cbd5e1] bg-white'
                }`}
              >
                <Feather name="chevron-right" size={18} color="#1e293b" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ========================================================= */}
      {/* 9. DRAWER / MODAL VISÃO 360 CS                            */}
      {/* ========================================================= */}
      <Modal visible={drawerVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-[#f8fafc] rounded-t-[26px] max-h-[90%] flex-1">
            {/* Puxador Superior */}
            <View className="w-[44px] h-[5px] bg-[#cbd5e1] rounded-full self-center mt-[12px] mb-[6px]" />

            {/* Cabeçalho do Drawer */}
            <View className="bg-white px-[20px] py-[16px] border-b border-[#e2e8f0] flex-row justify-between items-center">
              <View className="flex-row items-center gap-[8px]">
                <Feather name="activity" size={20} color="#8b5cf6" />
                <Text className="font-title text-[#1e293b] text-[18px]">Visão de CS (360º)</Text>
              </View>
              <TouchableOpacity onPress={() => setDrawerVisible(false)} className="p-[4px]">
                <Feather name="x" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Conteúdo com Scroll */}
            {drawerLoading ? (
              <View className="flex-1 items-center justify-center py-[50px]">
                <ActivityIndicator size="large" color="#1B4332" />
                <Text className="font-sans text-[#64748b] text-[13px] mt-3">
                  Carregando dados do psicólogo...
                </Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
                {(() => {
                  const psy = drawerData || selectedPsi || {};
                  const isVip = psy.is_exempt === true;
                  const { score, checks } = calculateProfileHealth(psy);

                  let scoreColor = '#ef4444';
                  if (score >= 75) scoreColor = '#10b981';
                  else if (score >= 50) scoreColor = '#f59e0b';

                  const planoName = psy.plano
                    ? psy.plano.charAt(0).toUpperCase() + psy.plano.slice(1).toLowerCase()
                    : 'Nenhum';

                  let expireText = '-';
                  if (isVip) {
                    expireText = 'Vitalício (VIP)';
                  } else if (psy.planExpiresAt) {
                    expireText = new Date(psy.planExpiresAt).toLocaleDateString('pt-BR');
                  }

                  return (
                    <>
                      {/* Cartão de Informações Básicas */}
                      <View className="bg-white rounded-[16px] p-[18px] border border-[#e2e8f0] shadow-sm">
                        <View className="flex-row items-center gap-[14px] mb-[14px]">
                          {psy.fotoUrl ? (
                            <Image
                              source={{ uri: psy.fotoUrl }}
                              className="w-[54px] h-[54px] rounded-full border border-[#e2e8f0]"
                            />
                          ) : (
                            <View className="w-[54px] h-[54px] rounded-full bg-[#f5f3ff] border border-[#ddd6fe] items-center justify-center">
                              <Text className="font-title text-[#8b5cf6] text-[22px]">
                                {(psy.nome || '?').charAt(0).toUpperCase()}
                              </Text>
                            </View>
                          )}
                          <View className="flex-1">
                            <Text className="font-title text-[#1e293b] text-[18px]">
                              {psy.nome || 'Sem Nome'}
                            </Text>
                            <Text className="font-sans text-[#64748b] text-[13px]">
                              {psy.email || 'Sem email'}
                            </Text>
                          </View>
                        </View>

                        <View className="flex-row flex-wrap gap-[8px]">
                          <View className="bg-[#f1f5f9] px-[12px] py-[5px] rounded-full">
                            <Text className="font-sans text-[#475569] text-[12px]">
                              Tel: {psy.telefone || 'N/A'}
                            </Text>
                          </View>
                          <View className="bg-[#f1f5f9] px-[12px] py-[5px] rounded-full">
                            <Text className="font-sans text-[#475569] text-[12px]">
                              CRP: {psy.crp || 'N/A'}
                            </Text>
                          </View>
                          <View className="bg-[#f1f5f9] px-[12px] py-[5px] rounded-full">
                            <Text className="font-sans text-[#475569] text-[12px]">
                              Desde:{' '}
                              {psy.createdAt
                                ? new Date(psy.createdAt).toLocaleDateString('pt-BR')
                                : '-'}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Saúde do Perfil */}
                      <View className="bg-white rounded-[16px] p-[18px] border border-[#e2e8f0] shadow-sm">
                        <View className="flex-row justify-between items-center mb-[10px]">
                          <Text className="font-title text-[#1e293b] text-[16px]">Saúde do Perfil</Text>
                          <Text
                            className="font-title text-[18px]"
                            style={{ color: scoreColor }}
                          >
                            {score}%
                          </Text>
                        </View>

                        <View className="w-full h-[8px] bg-[#e2e8f0] rounded-full overflow-hidden mb-[14px]">
                          <View
                            className="h-full rounded-full"
                            style={{ width: `${score}%`, backgroundColor: scoreColor }}
                          />
                        </View>

                        {/* Checklist dos 19 itens */}
                        <View className="gap-[8px]">
                          {checks.map((chk, i) => (
                            <View key={i} className="flex-row items-center gap-[8px]">
                              <Feather
                                name={chk.ok ? 'check-circle' : 'circle'}
                                size={15}
                                color={chk.ok ? '#10b981' : '#cbd5e1'}
                              />
                              <Text
                                className={`font-sans text-[13px] ${
                                  chk.ok ? 'text-[#334155]' : 'text-[#94a3b8]'
                                }`}
                              >
                                {chk.text}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>

                      {/* Consultor IA (Performance) */}
                      <LinearGradient
                        colors={['#f3e8ff', '#e0e7ff']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        className="rounded-[16px] p-[18px] border border-[#c4b5fd]"
                      >
                        <View className="flex-row items-center gap-[8px] mb-[6px]">
                          <Feather name="cpu" size={18} color="#4c1d95" />
                          <Text className="font-title text-[#4c1d95] text-[16px]">
                            Consultor IA (Performance)
                          </Text>
                        </View>
                        <Text className="font-sans text-[#5b21b6] text-[13px] mb-[14px]">
                          Gere um dossiê automático de desempenho cruzando os acessos com as ferramentas
                          que o psicólogo não utiliza.
                        </Text>

                        {aiDiagnosis && (
                          <View className="bg-white/80 p-[14px] rounded-[12px] mb-[14px] border border-[#a5b4fc]">
                            <Text className="font-title text-[#4338ca] text-[13px] mb-1">
                              Diagnóstico:
                            </Text>
                            <Text className="font-sans text-[#3730a3] text-[12px] mb-2 leading-5">
                              {aiDiagnosis.diagnosis}
                            </Text>

                            <Text className="font-title text-[#4338ca] text-[13px] mb-1">
                              Mensagem Sugerida:
                            </Text>
                            <View className="bg-white p-[10px] rounded-[8px] border border-dashed border-[#a5b4fc]">
                              <Text className="font-mono text-[#1e293b] text-[11px] leading-4">
                                {aiDiagnosis.copy}
                              </Text>
                            </View>
                          </View>
                        )}

                        <View className="flex-row gap-[10px]">
                          <TouchableOpacity
                            onPress={() => handleGenerateAiDiagnosis(psy)}
                            disabled={aiDiagnosisLoading}
                            className="flex-1 bg-[#7c3aed] py-[10px] px-[14px] rounded-full items-center justify-center flex-row gap-[6px]"
                          >
                            {aiDiagnosisLoading ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <>
                                <Feather name="play" size={14} color="#fff" />
                                <Text className="font-sans font-bold text-white text-[13px]">
                                  Gerar Diagnóstico
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>

                          {aiDiagnosis?.copy && (
                            <TouchableOpacity
                              onPress={() => {
                                handleSendAction({
                                  ...psy,
                                  actionType: 'low_performance',
                                });
                              }}
                              className="bg-[#10b981] py-[10px] px-[14px] rounded-full items-center justify-center flex-row gap-[6px]"
                            >
                              <Feather name="send" size={14} color="#fff" />
                              <Text className="font-sans font-bold text-white text-[13px]">
                                WhatsApp
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </LinearGradient>

                      {/* Assinatura */}
                      <View className="bg-white rounded-[16px] p-[18px] border border-[#e2e8f0] shadow-sm">
                        <Text className="font-title text-[#1e293b] text-[16px] mb-[12px]">
                          Assinatura
                        </Text>
                        <View className="flex-row justify-between">
                          <View>
                            <Text className="font-sans text-[#64748b] text-[12px]">Plano</Text>
                            <Text className="font-title text-[#1e293b] text-[15px] mt-1">
                              {planoName}
                            </Text>
                          </View>
                          <View className="items-end">
                            <Text className="font-sans text-[#64748b] text-[12px]">Vencimento</Text>
                            <Text
                              className="font-title text-[15px] mt-1"
                              style={{ color: isVip ? '#d4af37' : '#1e293b' }}
                            >
                              {expireText}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Ações de CS */}
                      <View className="bg-white rounded-[16px] p-[18px] border border-[#e2e8f0] shadow-sm gap-[10px]">
                        <Text className="font-title text-[#1e293b] text-[16px] mb-[4px]">
                          Ações de CS
                        </Text>

                        {/* WhatsApp */}
                        <TouchableOpacity
                          onPress={() => handleSendAction(psy, 'standard_contact')}
                          className="bg-[#10b981] py-[12px] rounded-full items-center flex-row justify-center gap-[6px]"
                        >
                          <Feather name="message-circle" size={16} color="#fff" />
                          <Text className="font-sans font-bold text-white text-[14px]">
                            Chamar no WhatsApp 📱
                          </Text>
                        </TouchableOpacity>

                        {/* Análise de Perfil (IA) */}
                        <TouchableOpacity
                          onPress={() => handleSendAction(psy, 'analysis')}
                          className="bg-[#fef08a] border border-[#fde047] py-[12px] rounded-full items-center flex-row justify-center gap-[6px]"
                        >
                          <Feather name="award" size={16} color="#b45309" />
                          <Text className="font-sans font-bold text-[#b45309] text-[14px]">
                            ✨ Análise de Perfil (IA)
                          </Text>
                        </TouchableOpacity>

                        {/* Ver Perfil Público */}
                        <TouchableOpacity
                          onPress={() => {
                            const slug = psy.slug || psy.id;
                            Linking.openURL(`https://www.yelopsi.com.br/psicologo/${slug}`);
                          }}
                          className="bg-[#f0fdf4] border border-[#bbf7d0] py-[12px] rounded-full items-center flex-row justify-center gap-[6px]"
                        >
                          <Feather name="external-link" size={16} color="#166534" />
                          <Text className="font-sans font-bold text-[#166534] text-[14px]">
                            Ver Perfil Público 🔗
                          </Text>
                        </TouchableOpacity>

                        {/* Gerenciar VIP */}
                        <TouchableOpacity
                          onPress={() => handleToggleVip(psy)}
                          className="bg-[#1B4332] py-[12px] rounded-full items-center flex-row justify-center gap-[6px]"
                        >
                          <Feather name="star" size={16} color="#fff" />
                          <Text className="font-sans font-bold text-white text-[14px]">
                            {isVip ? 'Remover Isenção VIP' : 'Conceder Isenção VIP ⭐'}
                          </Text>
                        </TouchableOpacity>

                        {/* Expirar Perfil */}
                        <TouchableOpacity
                          onPress={() => handleExpireProfile(psy)}
                          className="bg-[#fef2f2] border border-[#fecaca] py-[12px] rounded-full items-center flex-row justify-center gap-[6px] mt-2"
                        >
                          <Feather name="alert-circle" size={16} color="#991b1b" />
                          <Text className="font-sans font-bold text-[#991b1b] text-[14px]">
                            Expirar Perfil (Inativo) ⚠️
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  );
                })()}
                <View className="h-[40px]" />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* 10. MODAL DE CONFIRMAÇÃO GENÉRICO                         */}
      {/* ========================================================= */}
      <Modal visible={confirmModal.visible} transparent animationType="fade">
        <View className="flex-1 bg-black/50 items-center justify-center p-[20px]">
          <View className="bg-white rounded-[20px] p-[24px] w-full max-w-[340px] shadow-lg">
            <Text className="font-title text-[#1e293b] text-[18px] mb-[10px]">
              {confirmModal.title}
            </Text>
            <Text className="font-sans text-[#64748b] text-[14px] leading-5 mb-[20px]">
              {confirmModal.message}
            </Text>
            <View className="flex-row justify-end gap-[10px]">
              <TouchableOpacity
                onPress={() => setConfirmModal((prev) => ({ ...prev, visible: false }))}
                className="px-[16px] py-[8px] rounded-full bg-[#f1f5f9]"
              >
                <Text className="font-sans font-bold text-[#64748b] text-[13px]">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmModal.onConfirm}
                className="px-[18px] py-[8px] rounded-full bg-[#ef4444]"
              >
                <Text className="font-sans font-bold text-white text-[13px]">Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* 11. MODAL TOOLTIP INFORMATIVO                             */}
      {/* ========================================================= */}
      <Modal visible={tooltipModal.visible} transparent animationType="fade">
        <View className="flex-1 bg-black/50 items-center justify-center p-[20px]">
          <View className="bg-white rounded-[20px] p-[24px] w-full max-w-[340px] shadow-lg">
            <Text className="font-title text-[#1B4332] text-[18px] mb-[8px]">
              {tooltipModal.title}
            </Text>
            <Text className="font-sans text-[#475569] text-[14px] leading-5 mb-[20px]">
              {tooltipModal.desc}
            </Text>
            <TouchableOpacity
              onPress={() => setTooltipModal({ visible: false, title: '', desc: '' })}
              className="bg-[#1B4332] py-[10px] rounded-full items-center"
            >
              <Text className="font-sans font-bold text-white text-[14px]">Entendi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
