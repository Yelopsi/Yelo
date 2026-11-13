import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  TextInput,
  Modal,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Linking,
  Image,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import api from '../../../services/api';
import NativeSelectMenu from '../../../components/NativeSelectMenu';
import { resolvePhotoUrl } from '../../../utils/imageUrl';

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

function formatPlanDisplayName(rawPlano: any): string | null {
  if (!rawPlano) return null;
  const norm = String(rawPlano).trim().toUpperCase();
  if (!norm || norm === 'NENHUM' || norm === 'NULL' || norm === 'NONE') return null;
  const map: Record<string, string> = {
    ESSENTIAL: 'Essencial',
    ESSENCIAL: 'Essencial',
    CLINICAL: 'Clínico',
    'CLÍNICO': 'Clínico',
    CLINICO: 'Clínico',
    REFERENCE: 'Referência',
    'REFERÊNCIA': 'Referência',
    REFERENCIA: 'Referência',
    SOL: 'Referência',
  };
  if (map[norm]) return map[norm];
  const clean = String(rawPlano).trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

function formatPtBrDate(dateObj: Date): string {
  try {
    return dateObj.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  } catch (_) {
    return dateObj.toLocaleDateString('pt-BR');
  }
}

function getSubscriptionSummary(psy: any, fullData?: any) {
  const now = new Date();
  const isVip = psy?.is_exempt === true;
  const planLabel = formatPlanDisplayName(psy?.plano);

  const rawExp = psy?.planExpiresAt || fullData?.subscription?.nextDueDate || null;
  const expDate = rawExp ? new Date(rawExp) : null;
  const isEpochExpired = !!(expDate && !isNaN(expDate.getTime()) && expDate.getFullYear() < 2000);
  const hasValidExp = !!(expDate && !isNaN(expDate.getTime()) && !isEpochExpired);
  const formattedExpDate = hasValidExp && expDate ? formatPtBrDate(expDate) : null;

  const payments = Array.isArray(fullData?.payments) ? fullData.payments : [];
  const hasPaidPayments =
    (psy?.subscription_payments_count && Number(psy.subscription_payments_count) > 0) ||
    !!psy?.firstPaidAt ||
    payments.some((p: any) =>
      ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(String(p?.status || '').toUpperCase())
    );
  const hasPaidHistory = !!(
    psy?.subscriptionId ||
    fullData?.subscription?.id ||
    fullData?.asaasSubscription?.id ||
    hasPaidPayments
  );

  if (isVip) {
    return {
      planText: planLabel ? `${planLabel} (VIP)` : 'VIP (Isento)',
      planColor: '#b45309',
      expireLabel: 'Vencimento',
      expireText: 'Vitalício (VIP)',
      expireColor: '#d4af37',
    };
  }

  const isExpiredByDate = !!(hasValidExp && expDate && expDate <= now);
  const isExpired = psy?.status === 'inactive' || isExpiredByDate || isEpochExpired;

  if (psy?.status === 'pending' && !hasPaidHistory && !hasValidExp && !isEpochExpired) {
    return {
      planText: 'Nenhum',
      planColor: '#64748b',
      expireLabel: 'Vencimento',
      expireText: '-',
      expireColor: '#64748b',
    };
  }

  if (isExpired) {
    let expiredPlanText = 'Expirado';
    if (hasPaidHistory) {
      expiredPlanText = planLabel ? `Expirado (${planLabel})` : 'Expirado';
    } else if (planLabel || hasValidExp || isEpochExpired) {
      expiredPlanText = planLabel ? `Trial Expirado (${planLabel})` : 'Trial Expirado';
    }
    return {
      planText: expiredPlanText,
      planColor: '#ef4444',
      expireLabel: formattedExpDate ? 'Expirou em' : 'Expiração',
      expireText: formattedExpDate || 'Expirado',
      expireColor: '#ef4444',
    };
  }

  if (psy?.status === 'active' && !hasPaidHistory) {
    const diffHours = hasValidExp && expDate ? (expDate.getTime() - now.getTime()) / (1000 * 60 * 60) : null;
    return {
      planText: planLabel ? `Trial (${planLabel})` : 'Trial',
      planColor: '#2563eb',
      expireLabel: 'Expira em',
      expireText: formattedExpDate || '-',
      expireColor: diffHours !== null && diffHours <= 48 ? '#d97706' : '#1e293b',
    };
  }

  if (psy?.status === 'active' && (hasPaidHistory || planLabel)) {
    const cancelSuffix = psy?.cancelAtPeriodEnd ? ' (Cancelamento agendado)' : '';
    return {
      planText: `${planLabel || 'Ativo'}${cancelSuffix}`,
      planColor: psy?.cancelAtPeriodEnd ? '#d97706' : '#166534',
      expireLabel: psy?.cancelAtPeriodEnd ? 'Expira em' : 'Vencimento',
      expireText: formattedExpDate || '-',
      expireColor: '#1e293b',
    };
  }

  return {
    planText: planLabel || 'Nenhum',
    planColor: planLabel ? '#1e293b' : '#64748b',
    expireLabel: 'Vencimento',
    expireText: formattedExpDate || '-',
    expireColor: '#64748b',
  };
}

export default function AdminCRMPsicologosScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { openId } = useLocalSearchParams<{ openId?: string }>();
  const lastOpenedParamRef = useRef<string | null>(null);

  // Dados principais
  const [psychologists, setPsychologists] = useState<any[]>([]);
  const [pendingActions, setPendingActions] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any>({});
  const [founderMetrics, setFounderMetrics] = useState<any>({});
  const [stats, setStats] = useState<any>({});

  // Filtros & Paginação (Inicia em Follow-ups 📞 como na versão web)
  const [activeFilter, setActiveFilter] = useState('pending_actions');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const limit = 20;

  // Refs para controle suave de foco e teclado
  const scrollViewRef = useRef<any>(null);
  const searchBarYRef = useRef<number>(0);

  // Auto-scroll ao abrir o teclado para não cobrir o campo de busca
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(showEvent, () => {
      if (isSearchFocused && searchBarYRef.current > 0) {
        scrollViewRef.current?.scrollTo({
          y: Math.max(0, searchBarYRef.current - (insets.top + 16)),
          animated: true,
        });
      }
    });
    return () => sub.remove();
  }, [isSearchFocused, insets.top]);

  // Estados de Carregamento
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Drawer / Visão 360
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [selectedPsi, setSelectedPsi] = useState<any>(null);
  const [drawerData, setDrawerData] = useState<any>(null);
  const [drawerFullData, setDrawerFullData] = useState<any>(null);
  const [healthExpanded, setHealthExpanded] = useState(false);
  const [isExtendingTrial, setIsExtendingTrial] = useState(false);
  const [copiedAnalysisId, setCopiedAnalysisId] = useState<number | null>(null);

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
  // Carga das Métricas de Topo (MRR, Ativação, Pós-Trial, Renovação + Contadores de Pendências/KPIs)
  // -------------------------------------------------------------
  const loadHeaderMetrics = async () => {
    try {
      const [founderRes, statsRes, kpiRes, pendingRes] = await Promise.all([
        api.get('/api/admin/founder-metrics').catch(() => ({ data: {} })),
        api.get('/api/admin/stats').catch(() => ({ data: {} })),
        api.get('/api/admin/psychologists', { params: { page: 1, limit: 1 } }).catch(() => ({ data: {} })),
        api.get('/api/admin/pending-actions').catch(() => ({ data: [] })),
      ]);
      if (founderRes.data?.metrics) {
        setFounderMetrics(founderRes.data.metrics);
      }
      if (statsRes.data) {
        setStats(statsRes.data);
      }
      const actionsArray: any[] = pendingRes.data?.pendingActions || (Array.isArray(pendingRes.data) ? pendingRes.data : []);
      const countExpiring = actionsArray.filter((a) => a.actionType === 'expiring_trial').length;
      const countPaidChurn = actionsArray.filter((a) => ['paid_churn', 'billing_feedback', 'churn'].includes(a.actionType)).length;
      const countIncomplete = actionsArray.filter((a) => a.actionType === 'incomplete').length;

      setKpis((prev: any) => ({
        ...prev,
        ...(kpiRes.data?.kpis || {}),
        pending_expiring_trial: countExpiring,
        pending_paid_churn: countPaidChurn,
        pending_incomplete: countIncomplete,
      }));
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
        const allActions: any[] = res.data?.pendingActions || (Array.isArray(res.data) ? res.data : []);

        const countExpiring = allActions.filter((a) => a.actionType === 'expiring_trial').length;
        const countPaidChurn = allActions.filter((a) => ['paid_churn', 'billing_feedback', 'churn'].includes(a.actionType)).length;
        const countIncomplete = allActions.filter((a) => a.actionType === 'incomplete').length;
        setKpis((prev: any) => ({
          ...prev,
          pending_expiring_trial: countExpiring,
          pending_paid_churn: countPaidChurn,
          pending_incomplete: countIncomplete,
        }));

        let actions = [...allActions];

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
      } else if (activeFilter === 'low_performance') {
        const res = await api.get('/api/admin/psychologists/low-performance');
        let data: any[] = res.data?.psychologists || [];
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          data = data.filter(
            (a) =>
              (a.nome && a.nome.toLowerCase().includes(term)) ||
              (a.email && a.email.toLowerCase().includes(term)) ||
              (a.telefone && a.telefone.includes(term))
          );
        }
        setPsychologists(data);
        setTotalPages(1);
        setCurrentPage(1);
        setTotalItems(data.length);
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
        if (res.data?.kpis) {
          setKpis((prev: any) => ({
            ...prev,
            ...res.data.kpis,
          }));
        }
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
    setDrawerFullData(null);
    setDrawerVisible(true);
    setDrawerLoading(true);
    setAiDiagnosis(null);
    setHealthExpanded(false);
    setCopiedAnalysisId(null);

    try {
      const res = await api.get(`/api/admin/psychologists/${psy.id}/full-details`);
      setDrawerFullData(res.data || null);
      setDrawerData(res.data?.psychologist || res.data || psy);
    } catch (e) {
      console.log('Erro ao buscar detalhes completos do psicólogo:', e);
      setDrawerFullData(null);
      setDrawerData(psy);
    } finally {
      setDrawerLoading(false);
    }
  };

  useEffect(() => {
    if (openId && String(openId) !== lastOpenedParamRef.current) {
      lastOpenedParamRef.current = String(openId);
      openCSDrawer({ id: openId });
    }
  }, [openId]);

  // -------------------------------------------------------------
  // Envio de Ação / Mensagem WhatsApp (espelha sendWhatsAppAction da versão web)
  // -------------------------------------------------------------
  const handleSendAction = async (item: any, customActionType?: string) => {
    const actionType = customActionType || item.actionType || 'analysis';
    const id = item.id;
    const name = item.nome || 'Colega';
    const firstName = name.split(' ')[0];
    const phone = item.telefone || '';
    const metrics = item.metrics || {};
    const patientName = item.patientName || '';
    const feedbackToken = item.feedbackToken || '';

    setActionLoadingId(`${id}_${actionType}`);

    try {
      let msg = '';

      if (actionType === 'analysis') {
        try {
          const res = await api.get(`/api/admin/psychologists/${id}/analyze`);
          if (res.data?.message) {
            msg = res.data.message;
            api.put(`/api/admin/psychologists/${id}/analyzed`, { isProfileAnalyzed: true }).catch(() => {});
          }
        } catch (_) {}

        if (!msg) {
          const cleanBio = item.bio ? String(item.bio).replace(/<[^>]*>/g, '').trim() : '';
          const hasBio = cleanBio.length >= 30;
          const hasPrice =
            (item.valor_sessao_numero !== null && item.valor_sessao_numero !== undefined && Number(item.valor_sessao_numero) > 0) ||
            (item.valorSessao !== null && item.valorSessao !== undefined && Number(item.valorSessao) > 0);

          if (hasBio) {
            const pendenciasBlock = !hasPrice
              ? `Para darmos o próximo passo juntos e acelerar a chegada dos primeiros contatos no seu WhatsApp, recomendamos:\n\n• Definir um valor de referência para a sessão em *Ajustes > Meu Perfil* (percebemos que valores visíveis reduzem a hesitação do paciente antes do primeiro contato);\n• Compartilhar seu link com 1 ou 2 pacientes de confiança para inaugurar a seção de avaliações do seu perfil.`
              : `Como a sua apresentação e valor já estão muito bem configurados, o próximo passo de maior impacto é conquistar suas primeiras avaliações de pacientes, que funcionam como prova social e aumentam muito a conversão de visitas em mensagens.\n\n• Onde ir: *Evolução > Solicitar Avaliações*\n• O que fazer: compartilhe seu link de avaliação com 1 ou 2 pacientes ou ex-pacientes de confiança.`;

            msg = `Olá, ${firstName}! Como vai?\nAqui é o Anderson, da Yelo. 🌿\n\nPassamos para te desejar boas-vindas e compartilhar uma análise que fizemos do seu perfil agora que você iniciou sua trajetória na plataforma!\n\nLemos a sua biografia e gostamos muito da clareza e do tom acolhedor que você trouxe. A forma como você contextualizou a sua abordagem transmite muita segurança para o paciente que visita a sua página.\n\n${pendenciasBlock}\n\nSe quiser, nossa equipe pode te ajudar com ideias para estruturar sua página. Estamos totalmente à disposição por aqui! 🚀`;
          } else {
            msg = `Olá, ${firstName}! Como vai?\nAqui é o Anderson, da Yelo. 🌿\n\nPassamos para te desejar boas-vindas e compartilhar uma análise que fizemos do seu perfil agora que você iniciou sua trajetória na plataforma!\n\nAnalisamos a sua página e achamos excelente a sua iniciativa de construir sua página por aqui. Percebemos, no entanto, que a sua *biografia profissional ainda não foi preenchida*.\n\nPara quem busca terapia, a bio é o elemento mais decisivo: é através dela que o paciente compreende como funciona o seu acolhimento e se sente seguro para te chamar no WhatsApp. Sem ela, o perfil perde grande parte do potencial de conversão.\n\nPara deixar sua página completa e pronta para receber contatos, acesse seu painel em *Ajustes > Meu Perfil* e adicione um texto de apresentação simples explicando sua condução clínica.\n\nSe quiser, nossa equipe pode te ajudar com ideias para estruturar esse texto. Estamos totalmente à disposição por aqui! 🚀`;
          }
        }
      } else if (actionType === 'incomplete') {
        msg = `Olá, ${firstName}! Tudo bem? Aqui é o Anderson, da Yelo. 🌿\n\nVi que você deu o primeiro passo e iniciou o seu cadastro na nossa plataforma, mas acabou não finalizando o preenchimento do seu perfil. Eu sei bem que a rotina de atendimentos acaba engolindo o nosso tempo, né? rs\n\nPassei só para te lembrar que os seus 7 dias de teste gratuito (sem precisar cadastrar cartão de crédito) só começam a contar depois que o seu perfil estiver completo e a sua página disponível para receber pacientes!\n\nÉ a oportunidade perfeita para você testar na prática como a plataforma te conecta com pacientes direto no seu WhatsApp, lembrando que a gente não cobra nenhuma taxa ou comissão pelas suas sessões.\n\nFalta bem pouco para o seu perfil ficar ativo nas buscas! Para continuar de onde parou, basta entrar na sua conta por aqui:\nhttps://yelopsi.com.br/login\n\nSe precisar de uma mãozinha para preencher a sua bio ou tiver qualquer dúvida, é só me dar um toque respondendo esta mensagem. Sigo super à disposição por aqui!`;
      } else if (actionType === 'expired_pix_fomo') {
        const m = metrics || {};
        const approach = m.approach || 'Psicologia';

        let performanceText = '';
        if (m.startedTherapyCount > 0 || m.negotiatingCount > 0) {
          const statusDetails: string[] = [];
          if (m.startedTherapyCount > 0) {
            statusDetails.push(`*${m.startedTherapyCount} paciente(s) já iniciou(aram) terapia*`);
          }
          if (m.negotiatingCount > 0) {
            statusDetails.push(`*${m.negotiatingCount} ainda está(ão) em negociação*`);
          }
          performanceText = `alcançando *${m.appearances || 0} aparições em buscas*, *${m.views || 0} visualizações na sua página* e *${m.clicks || 0} cliques para o seu WhatsApp*. Desses contatos, sabemos que ${statusDetails.join(' e ')} com você!`;
        } else if (m.clicks > 0) {
          performanceText = `alcançando *${m.appearances || 0} aparições em buscas* e *${m.clicks || 0} pacientes chegaram a te chamar no WhatsApp* para negociar.`;
        } else {
          performanceText = `alcançando *${m.appearances || 0} aparições em buscas de pacientes*.`;
        }

        let potentialText = '';
        if (m.dealClosed) {
          potentialText = `A sua apresentação focada na *${approach}* tem um potencial gigante para continuar atraindo os pacientes certos para a sua clínica.`;
        } else if (m.clicks > 0) {
          potentialText = `A sua apresentação focada na *${approach}* tem um potencial gigante e é só questão de tempo até convertermos esses contatos em pacientes reais para a sua clínica.`;
        } else {
          potentialText = `A sua apresentação focada na *${approach}* tem um diferencial enorme e o algoritmo estava justamente aprendendo o seu perfil para te ranquear melhor.`;
        }

        msg = `Bom dia, ${firstName}! Como vai?\n\nPassando por aqui com um aviso importante: a sua assinatura da Yelo venceu ontem e, por conta disso, o seu perfil acabou entrando em pausa no sistema e saiu do ar temporariamente.\n\nComo acompanho de perto a sua trajetória, não queria deixar você perder a ótima tração que construímos juntos. O seu perfil vinha com uma visibilidade excelente — ${performanceText}\n\n${potentialText}\n\nPara o seu perfil voltar ao ar imediatamente e não quebrarmos o ritmo que o algoritmo já gerou para você, basta regularizar a assinatura.\n\nÉ bem simples: basta acessar a sua conta, ir no menu *Ajustes > Assinaturas e Planos* e atualizar a forma de pagamento.\n\nSe precisar de qualquer ajuda com o acesso, sigo totalmente à disposição. 🌿`;
      } else if (actionType === 'paid_churn') {
        const m = metrics || {};
        const churnType = item.churnType || m.churnType || 'expired_cycle';

        let X = m.clicks || item.whatsapp_clicks || 0;
        let Y = m.dealClosedCount || 0;
        let VALOR = m.sessionPrice
          ? String(m.sessionPrice).replace('.', ',')
          : item.valor_sessao_numero
          ? String(item.valor_sessao_numero).replace('.', ',')
          : '150,00';
        let approach =
          m.approach ||
          (Array.isArray(item.abordagens_tecnicas) && item.abordagens_tecnicas[0]) ||
          'Psicologia Clínica';

        try {
          const res = await api.get(`/api/admin/psychologists/${id}/full-details`);
          if (res.data) {
            const data = res.data;
            if (Array.isArray(data.whatsappLogs)) {
              const now = new Date();
              const currentMonthLogs = data.whatsappLogs.filter((log: any) => {
                const logDate = new Date(log.createdAt);
                return (
                  logDate.getMonth() === now.getMonth() &&
                  logDate.getFullYear() === now.getFullYear()
                );
              });
              if (currentMonthLogs.length > 0) {
                X = Math.max(X, currentMonthLogs.length);
                Y = currentMonthLogs.filter(
                  (log: any) => log.status === 'fechou' || log.dealClosed === 'yes' || log.dealClosed === 'started'
                ).length;
              }
            }
            const psy = data.psychologist || data;
            if (psy.valorSessao || psy.valor_sessao_numero) {
              const rawVal = parseFloat(psy.valorSessao || psy.valor_sessao_numero);
              if (!isNaN(rawVal) && rawVal > 0) {
                VALOR = rawVal.toFixed(2).replace('.', ',');
              }
            }
            if (Array.isArray(psy.abordagens_tecnicas) && psy.abordagens_tecnicas.length > 0) {
              approach = psy.abordagens_tecnicas[0];
            }
          }
        } catch (_) {}

        const contatoStr = X === 1 ? 'contato de paciente' : 'contatos de pacientes';
        const pacienteStr = Y === 1 ? 'paciente novo' : 'pacientes novos';

        let perfSnippet = '';
        if (Y > 0) {
          perfSnippet = `Dei uma olhada nos seus resultados recentes e vi que você recebeu ${X} ${contatoStr} e fechou com ${Y} ${pacienteStr} pela Yelo (o que a R$ ${VALOR} por sessão já pagou a sua assinatura com muita folga!). 🚀`;
        } else if (X > 0) {
          perfSnippet = `Dei uma olhada nos seus números e vi que você já recebeu ${X} ${contatoStr} pelo WhatsApp. O seu perfil com foco em *${approach}* estava ganhando uma tração bem legal! 🚀`;
        } else {
          perfSnippet = `O seu perfil voltado para *${approach}* tem um diferencial excelente e o algoritmo da plataforma já estava começando a posicionar você melhor nas buscas! 🌱`;
        }

        if (churnType === 'card_declined') {
          msg = `Olá, ${firstName}! Tudo bem? Aqui é o Anderson da Yelo. 🌿\n\nEstou passando para te dar um toque rápido e super importante sobre a sua conta: o nosso sistema tentou renovar automaticamente a sua assinatura mensal, mas a operadora do seu cartão recusou a cobrança (geralmente é só limite do mês virando ou um bloqueio preventivo do banco para pagamentos recorrentes online).\n\nPor conta disso, o seu perfil entrou em pausa temporária para novos pacientes.\n\n${perfSnippet}\n\nNão quero de forma alguma que você saia do ar e perca o embalo de novos agendamentos que estamos construindo juntos.\n\nPara o seu perfil voltar ao ar imediatamente, é super simples: basta acessar sua conta na Yelo, ir na aba *"Ajustes" > "Assinaturas e Planos"* e atualizar o seu cartão ou emitir um Pix.\n\nSe preferir, posso te enviar a chave Pix direto por aqui também. Qualquer dúvida, estou à disposição! 🌿`;
        } else if (churnType === 'pix_expired') {
          msg = `Olá, ${firstName}! Tudo bem? Aqui é o Anderson da Yelo. 🌿\n\nPassando rapidinho para te avisar que o código Pix de renovação da sua mensalidade da Yelo acabou vencendo e expirou no sistema.\n\nPor conta disso, o seu perfil entrou em pausa automática nas buscas de pacientes.\n\n${perfSnippet}\n\nComo não quero que você perca os pacientes que estão procurando atendimento na sua especialidade, quer que eu te envie um novo código Pix copia-e-cola direto por aqui para você reativar em 1 minuto?\n\n*(Dica: se preferir não ter que se preocupar com datas todo mês, você também pode cadastrar um cartão de crédito no seu painel em Ajustes > Assinaturas e Planos).*\n\nSigo à disposição por aqui! Um abraço. 🌿`;
        } else if (churnType === 'voluntary_refund') {
          msg = `Olá, ${firstName}! Tudo bem? Aqui é o Anderson da Yelo. 🌿\n\nVi aqui no sistema que você optou por encerrar a sua assinatura e o seu plano foi desativado.\n\nQueria te mandar essa mensagem primeiro para agradecer pelo período em que estivemos juntos e, principalmente, para te ouvir com sinceridade. Como estamos sempre aprimorando a Yelo para os psicólogos clínicos, seu feedback é precioso pra gente:\n\n${perfSnippet}\n\nO que mais pesou na sua decisão de não continuar neste momento? Faltou algum suporte nosso, o retorno de pacientes foi diferente do esperado ou foi uma questão de momento pessoal/financeiro?\n\nFico super aberto para entender e, caso queira conversar, as portas da Yelo estarão sempre abertas para você. Um grande abraço! 🌱`;
        } else {
          msg = `Olá, ${firstName}! Tudo bem? Aqui é o Anderson da Yelo. 🌿\n\nPassando para te dar um toque sobre a sua assinatura da Yelo: o seu ciclo mensal chegou ao fim e o seu perfil entrou em pausa para novas buscas.\n\n${perfSnippet}\n\nPara não quebrar a consistência que o algoritmo já gerou para você e manter o seu consultório virtual ativo recebendo pacientes, basta renovar o plano.\n\nÉ bem prático: acesse seu painel na Yelo, vá em *"Ajustes" > "Assinaturas e Planos"* e escolha o pagamento via Cartão ou Pix.\n\nSe precisar de qualquer ajuda com o acesso, estou à disposição! 🌿`;
        }
      } else if (actionType === 'churn') {
        try {
          const res = await api.post(`/api/admin/psychologists/${id}/ai-churn-message`);
          if (res.data?.whatsappCopy) msg = res.data.whatsappCopy;
        } catch (_) {}

        if (!msg) {
          const matchesCount = metrics.appearances ?? item.profile_appearances ?? 0;
          const viewsCount = metrics.views ?? 0;
          const clicksCount = metrics.clicks ?? item.whatsapp_clicks ?? 0;
          const dealYes = metrics.closedDealsCount ?? metrics.dealClosedCount ?? 0;
          const valSessao = Number(item.valor_sessao_numero || metrics.sessionPrice || 0);

          let metricsText = '';
          let feedbackText = '';
          if (clicksCount > 0) {
            const contatoStr =
              clicksCount === 1
                ? '1 paciente te chamou no WhatsApp'
                : `${clicksCount} pacientes te chamaram no WhatsApp`;
            metricsText = `Durante os testes, o seu perfil obteve:\n\n* *${matchesCount} aparições* nos resultados de matches\n* *${viewsCount} visualizações* na sua página\n* *${contatoStr}*`;
            feedbackText =
              dealYes > 0
                ? `E vimos pelo seu feedback que você já conseguiu agendar com ${dealYes} paciente(s)! 🎉`
                : `O fluxo de contatos já estava começando a ganhar tração! Com a continuidade do perfil no ar e pequenos ajustes na conversa, os agendamentos acontecem naturalmente.`;
          } else {
            metricsText = `Durante os testes, o seu perfil obteve:\n\n* *${matchesCount} aparições* nos resultados de buscas\n* *${viewsCount} visualizações* diretas na sua página`;
            feedbackText = `O seu perfil já começou a ganhar relevância nas buscas e visitas de potenciais pacientes. O próximo passo natural é a conversão dessas visitas em conversas no WhatsApp. Nossa equipe pode te ajudar a dar uma revisada rápida na apresentação para destravarmos esses contatos!`;
          }

          let mathText = '';
          if (valSessao > 0) {
            if (valSessao >= 99) {
              mathText = `Como a sua sessão é de R$ ${valSessao}, realizar apenas 1 atendimento no mês inteiro já cobre a plataforma com folga e ainda te deixa com lucro direto.`;
            } else {
              mathText = `Como a sua sessão é de R$ ${valSessao}, fechar com apenas 1 paciente no mês (que costuma realizar de 2 a 4 atendimentos, somando entre R$ ${valSessao * 2} e R$ ${valSessao * 4}) já cobre a mensalidade de R$ 99 com folga e se transforma em lucro líquido para você.`;
            }
          } else {
            mathText = `Como você atende com valor a combinar diretamente com o paciente no WhatsApp, você tem total autonomia na sua precificação e 100% de tudo o que acordar nos atendimentos fica no seu consultório, sem nenhuma taxa ou comissão da nossa parte.`;
          }

          msg = `Olá, ${firstName}! Tudo bem? Aqui é o Anderson, da equipe da Yelo. 🌿\n\nPassamos para agradecer por você ter testado a plataforma com a gente nesses últimos dias! O seu período gratuito encerrou, mas nós estávamos analisando as suas métricas e os resultados foram muito positivos.\n\n${metricsText}\n\n${feedbackText}\n\nPensando pelo seu lado financeiro: a assinatura da Yelo tem um valor fixo de R$ 99,00 mensais. ${mathText}\n\nFaria sentido para você reativarmos a sua página para não perder esse fluxo de pacientes que já estão te encontrando? Caso queira manter seu perfil no ar, basta acessar a sua conta na Yelo, ir em "Ajustes" e depois em "Assinaturas e Planos". Estamos totalmente à disposição!`;
        }
      } else if (actionType === 'expiring_trial') {
        try {
          const res = await api.post(`/api/admin/psychologists/${id}/ai-expiring-trial-message`);
          if (res.data?.whatsappCopy) msg = res.data.whatsappCopy;
        } catch (_) {}

        if (!msg) {
          const matchesCount = metrics.appearances ?? item.profile_appearances ?? 0;
          const viewsCount = metrics.views ?? 0;
          const clicksCount = metrics.clicks ?? item.whatsapp_clicks ?? 0;
          const dealYes = metrics.closedDealsCount ?? (metrics.dealClosed ? 1 : 0);
          const isToday = metrics.isToday ?? (item.reason && String(item.reason).includes('horas'));
          const expiryPhrase = isToday ? 'expira nas próximas horas' : 'expirará amanhã';
          const valSessao = Number(item.valor_sessao_numero || metrics.sessionPrice || 0);

          let metricsText = '';
          let feedbackText = '';
          if (clicksCount > 0) {
            const contatoStr =
              clicksCount === 1
                ? '1 paciente te chamou no WhatsApp'
                : `${clicksCount} pacientes te chamaram no WhatsApp`;
            metricsText = `Seu perfil obteve nestes 7 dias:\n\n* *${matchesCount} aparições* nos resultados de busca\n* *${viewsCount} visitas* diretas na sua página\n* *${contatoStr}*`;
            feedbackText =
              dealYes > 0
                ? `Notamos que você conseguiu fechar com ${dealYes} paciente(s)! 🎉 Isso comprova na prática que a sua página já está gerando pacientes reais.`
                : `Como o nosso algoritmo leva alguns dias para calibrar o perfil e as primeiras conversas já começaram a chegar, acreditamos que manter o seu consultório virtual ativo é essencial para dar continuidade a esse ritmo.`;
          } else {
            metricsText = `Seu perfil obteve nestes 7 dias:\n\n* *${matchesCount} aparições* nos resultados de busca\n* *${viewsCount} visitas* diretas na sua página`;
            feedbackText = `Como o nosso algoritmo de distribuição leva alguns dias para calibrar o seu público ideal e o seu perfil já começou a ganhar visibilidade e visitas, o próximo passo natural é a chegada dos primeiros contatos no WhatsApp. Acreditamos que manter a sua página ativa é fundamental para não perder essa tração inicial.`;
          }

          let mathText = '';
          if (valSessao > 0) {
            if (valSessao >= 99) {
              mathText = `Pensando no lado financeiro: a assinatura da Yelo é de apenas R$ 99 mensais. Como a sua sessão é R$ ${valSessao}, realizar apenas 1 atendimento no mês inteiro já cobre a plataforma com folga e ainda te deixa com lucro direto.`;
            } else {
              mathText = `Pensando no lado financeiro: a assinatura da Yelo é de apenas R$ 99 mensais e nós não cobramos nenhuma taxa ou comissão sobre os seus atendimentos. Como a sua sessão é R$ ${valSessao}, fechar com apenas 1 paciente no mês (que costuma realizar acompanhamento de 2 a 4 consultas, somando entre R$ ${valSessao * 2} e R$ ${valSessao * 4}) já cobre a mensalidade de R$ 99 com muita folga e se transforma em lucro líquido para você.`;
            }
          } else {
            mathText = `Pensando no lado financeiro: a assinatura da Yelo tem um valor fixo de R$ 99 mensais e nós *não cobramos nenhuma taxa ou comissão* sobre as suas consultas. Como você atende com valor a combinar diretamente com o paciente no WhatsApp, você tem total autonomia na sua precificação e 100% de tudo o que acordar nos atendimentos fica no seu consultório.`;
          }

          msg = `Olá, ${firstName}! Como vai?\n\nNotamos que o seu período de teste gratuito na Yelo ${expiryPhrase}, e passamos para compartilhar um panorama do seu perfil nesses primeiros 7 dias.\n\n${metricsText}\n\n${feedbackText}\n\n${mathText}\n\nFaz sentido para você mantermos a sua página ativa para continuar recebendo os pacientes que chegam pela plataforma?\n\nPara renovar, basta acessar o seu painel em *Ajustes > Assinaturas e Planos*. Estamos à disposição caso precise de qualquer apoio com o acesso! 🌿`;
        }
      } else if (actionType === 'billing_feedback') {
        const linkFeedback = feedbackToken
          ? `https://www.yelopsi.com.br/magic-feedback?token=${feedbackToken}`
          : `https://www.yelopsi.com.br/psi/dashboard`;

        const pendingCount = metrics.pendingCount || 1;
        const isFirst = metrics.isFirstFeedbackRequest !== false;

        if (isFirst) {
          let introText = '';
          if (pendingCount > 1) {
            introText = `Alguns pacientes entraram`;
          } else if (
            patientName &&
            patientName.toLowerCase() !== 'visitante' &&
            patientName.toLowerCase() !== 'um paciente'
          ) {
            introText = `O(a) paciente ${patientName} entrou`;
          } else {
            introText = `Um paciente entrou`;
          }

          msg = `Olá, ${firstName}! Tudo bem?\n\n${introText} em contato com você pela Yelo. Você pode acessar o link abaixo e informar:\n\n• A mensagem chegou?\n• O paciente iniciou a terapia?\n\nLeva menos de 1 minuto e essa informação é essencial para avaliarmos a qualidade dos encaminhamentos.\n\n*Responder agora:*\n👉 ${linkFeedback}\n\nObrigado! 🌿`;
        } else {
          let introTextRecorrente = '';
          if (pendingCount > 1) {
            introTextRecorrente = `mais alguns pacientes tentaram`;
          } else if (
            patientName &&
            patientName.toLowerCase() !== 'visitante' &&
            patientName.toLowerCase() !== 'um paciente'
          ) {
            introTextRecorrente = `o(a) paciente ${patientName} tentou`;
          } else {
            introTextRecorrente = `mais um paciente tentou`;
          }

          msg = `Olá, ${firstName}! Tudo bem?\n\nO seu perfil continua gerando resultados na Yelo! ✨\nPercebemos que ${introTextRecorrente} entrar em contato com você recentemente.\n\nPara mantermos o seu perfil forte e continuarmos te indicando no nosso ranking, precisamos apenas da sua confirmação rápida. Acesse o link abaixo e nos conte:\n\n• A mensagem chegou?\n• O paciente iniciou a terapia?\n\nLeva menos de 1 minuto!\n\n*Responder agora:*\n👉 ${linkFeedback}\n\nMuito obrigado pela parceria! 🌿`;
        }
      } else if (actionType === 'low_performance') {
        if (item.preGeneratedCopy) {
          msg = item.preGeneratedCopy;
        } else {
          try {
            const res = await api.post(`/api/admin/psychologists/${id}/ai-diagnosis`);
            if (res.data?.whatsappCopy) msg = res.data.whatsappCopy;
          } catch (_) {}
        }

        if (!msg) {
          const matchesCount = item.matches_14d ?? item.matches_30d ?? item.profile_appearances ?? 0;
          const viewsCount = item.views_14d ?? item.views_30d ?? 0;
          const clicksCount = item.clicks_14d ?? item.clicks_30d ?? item.whatsapp_clicks ?? 0;
          msg = `Olá, ${firstName}! Tudo bem? Fiz uma análise detalhada da sua performance nos últimos dias e trouxe alguns pontos para potencializarmos seus resultados: você teve *${matchesCount} aparições* em resultados de matches, *${viewsCount} visitas* no perfil e *${clicksCount} cliques* no WhatsApp.\n\nEstive acompanhando as métricas do seu perfil nesta semana e vejo uma oportunidade excelente para aumentarmos os seus contatos no WhatsApp.\n\nPara atrair mais pacientes de forma prática, recomendo:\n1. Adicionar temas de dores reais na sua bio (como ansiedade e estresse) em *Ajustes > Meu Perfil*;\n2. Solicitar 2 avaliações de pacientes antigos via *Evolução > Solicitar Avaliações*;\n3. Responder a uma dúvida recente de paciente no nosso Fórum.\n\nEsses pequenos ajustes costumam destravar a agenda de muitos profissionais por aqui. Qualquer dúvida sobre como aplicar isso, é só me chamar. Estamos juntos nessa jornada para encher a sua clínica! 🌿`;
        }
      } else if (actionType === 'conversion_failure') {
        try {
          const res = await api.post(`/api/admin/psychologists/${id}/ai-conversion-failure`);
          if (res.data?.whatsappCopy) msg = res.data.whatsappCopy;
        } catch (_) {}

        if (!msg) {
          const hasBeenSentBefore = metrics.hasBeenSentBefore === true;
          msg = hasBeenSentBefore
            ? `Olá, ${firstName}! Tudo bem?\n\nVi por aqui que novos contatos chegaram recentemente pelo seu perfil na Yelo, mas acabaram ainda não avançando para o agendamento.\n\nVocê chegou a testar as estratégias lá do *Manual de Conversão*? Queria entender com você: sente que o principal obstáculo tem sido o valor da sessão, o tempo até a resposta ou os pacientes param de responder depois da primeira mensagem?\n\nSe quiser, podemos analisar juntos como foi a última abordagem para destravar esses fechamentos! 🌿`
            : `Olá, ${firstName}! Tudo bem?\n\nEstava acompanhando as métricas do seu perfil na Yelo e é muito bom ver que a sua página está gerando interesse e atraindo cliques no WhatsApp! Notei, porém, que os últimos contatos acabaram ainda não avançando para o agendamento.\n\nQuando o paciente clica no WhatsApp, os primeiros minutos de acolhimento e a forma de conduzir a conversa até o valor da sessão fazem toda a diferença. Recomendo dar uma olhada na ferramenta *Clínica > Manual de Conversão* lá no seu painel — preparamos roteiros práticos justamente para evitar que o paciente deixe no vácuo.\n\nQualquer dúvida ou se quiser trocar uma ideia sobre a abordagem inicial, estou por aqui! 🌿`;
        }
      } else if (actionType === 'negotiation') {
        const dataNeg = metrics.dataNeg || 'alguns dias';
        const pName = patientName || 'um paciente';
        msg = `Olá, ${firstName}. Como vai?\n\nPreciso da sua ajuda com um retorno rápido.\n\nVocê estava em negociação com ${pName} desde ${dataNeg}:\n\n• Conseguiram conversar novamente?\n• O paciente iniciou a terapia?\n\nLeva menos de 1 minuto e essa informação é essencial para avaliarmos a qualidade dos encaminhamentos.\n\nPara responder, acesse sua conta na Yelo e vá até a opção *Evolução > Histórico de Contatos* e mude o status "⏳ Em negociação".\n\nObrigado! 🌿`;
      } else if (actionType === 'standard_contact') {
        if (item.status === 'pending') {
          msg = `Olá, ${firstName}! Tudo bem? Aqui é o Anderson, da Yelo. 🌿\n\nVi que você deu o primeiro passo e iniciou o seu cadastro na nossa plataforma, mas acabou não finalizando o preenchimento do seu perfil. Eu sei bem que a rotina de atendimentos acaba engolindo o nosso tempo, né? rs\n\nPassei só para te lembrar que os seus 7 dias de teste gratuito (sem precisar cadastrar cartão de crédito) só começam a contar *depois* que o seu perfil estiver completo e a sua página disponível para receber pacientes!\n\nÉ a oportunidade perfeita para você testar na prática como a plataforma te conecta com pacientes direto no seu WhatsApp, lembrando que a gente não cobra nenhuma taxa ou comissão pelas suas sessões.\n\nFalta bem pouco para o seu perfil ficar ativo nas buscas! Para continuar de onde parou, basta entrar na sua conta por aqui:\nhttps://yelopsi.com.br/login\n\nSe precisar de uma mãozinha para preencher a sua bio ou tiver qualquer dúvida, é só me dar um toque respondendo esta mensagem. Sigo super à disposição por aqui!`;
        } else if (item.status === 'inactive' && item.plano && item.plano !== 'nenhum') {
          msg = `Olá, ${firstName}! Tudo bem? Aqui é o Anderson da Yelo. 🌿\n\nEstou passando para te dar um toque rápido sobre a sua assinatura. Dei uma olhada no seu perfil e vi que ele tem muito potencial para atrair pacientes na plataforma! 🌱\n\nComo o algoritmo de distribuição da plataforma está aprendendo sobre o seu perfil, não quero que você saia do ar agora e perca o histórico que já estamos construindo.\n\nPara regularizar e manter seu consultório virtual ativo recebendo pacientes, é só acessar a sua conta na Yelo, ir na aba "Ajustes" > "Assinaturas e Planos" e atualizar o seu cartão ou emitir um novo Pix.\n\nSe precisar de alguma ajuda ou tiver qualquer dificuldade no painel, me dá um alô aqui. Um abraço! 🌿`;
        } else {
          msg = `Olá, ${firstName}! Tudo bem? Aqui é o Anderson da Yelo. 🌿\n\nPassando para acompanhar sua experiência na plataforma e saber se precisa de algum suporte no seu perfil.\n\nSigo à disposição!`;
        }
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
      const isChurn = psy.status === 'inactive' && psy.planExpiresAt && new Date(psy.planExpiresAt) < new Date();
      const endpoint = isChurn ? 'ai-churn-message' : 'ai-diagnosis';
      const res = await api.post(`/api/admin/psychologists/${psy.id}/${endpoint}`);
      if (res.data) {
        setAiDiagnosis({
          diagnosis: res.data.diagnosis || res.data.analise || 'Diagnóstico de desempenho e ROI concluídos.',
          copy: res.data.whatsappCopy || res.data.mensagem || '',
        });
      }
    } catch (e: any) {
      Alert.alert('Erro', e.response?.data?.error || e.message || 'Erro ao gerar diagnóstico de IA.');
    } finally {
      setAiDiagnosisLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Estender Período Grátis (Paridade Web)
  // -------------------------------------------------------------
  const handleExtendTrial = (psy: any, days = 7) => {
    Alert.alert(
      'Estender Período Grátis 🎁',
      `Deseja adicionar ${days} dias extras de período de teste para ${psy.nome || 'este profissional'}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: `Estender ${days} dias`,
          onPress: async () => {
            try {
              setIsExtendingTrial(true);
              const res = await api.post(`/api/admin/psychologists/${psy.id}/extend-trial`, { days });
              if (res.data?.success) {
                const newDateStr = res.data.newExpirationDate
                  ? new Date(res.data.newExpirationDate).toLocaleDateString('pt-BR')
                  : 'Atualizado';
                setDrawerData((prev: any) => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    planExpiresAt: res.data.newExpirationDate,
                    status: 'active',
                  };
                });
                setPsychologists((prev) =>
                  prev.map((p) =>
                    p.id === psy.id
                      ? { ...p, planExpiresAt: res.data.newExpirationDate, status: 'active' }
                      : p
                  )
                );
                Alert.alert('Sucesso! 🎁', `Período grátis estendido em ${days} dias!\nNovo vencimento: ${newDateStr}`);
              }
            } catch (e: any) {
              Alert.alert('Erro', e.response?.data?.error || e.message || 'Não foi possível estender o período.');
            } finally {
              setIsExtendingTrial(false);
            }
          },
        },
      ]
    );
  };

  // -------------------------------------------------------------
  // Abrir Dossiê Completo (Navegação Nativa no App)
  // -------------------------------------------------------------
  const handleOpenDossier = (psy: any) => {
    if (!psy) return;
    setDrawerVisible(false);
    router.push({
      pathname: '/(admin)/crm-modulo/detalhes-psicologo' as any,
      params: { id: String(psy.id), name: psy.nome || '' },
    });
  };

  // Render Diff Badge para Header (+X.X p.p., -X.X p.p., = 0.0 p.p.)
  const renderMetricDiff = (diff: number | undefined, prevRate?: number) => {
    if (diff === undefined || diff === null || isNaN(diff)) {
      return <Text className="font-sans text-white/50 text-[10px] mt-1">tempo real</Text>;
    }
    const diffPct = (diff * 100).toFixed(1);
    const num = parseFloat(diffPct);
    const prevHint = prevRate !== undefined && prevRate !== null && !isNaN(prevRate)
      ? `30d ant: ${(prevRate * 100).toFixed(1)}%`
      : null;

    let badge = (
      <View className="bg-white/10 px-[6px] py-[2px] rounded-[4px] mt-1 self-start flex-row items-center">
        <Text className="font-sans text-white/70 text-[10px]">= 0.0 p.p.</Text>
      </View>
    );

    if (num > 0) {
      badge = (
        <View className="bg-emerald-500/20 px-[6px] py-[2px] rounded-[4px] mt-1 self-start flex-row items-center">
          <Feather name="trending-up" size={10} color="#34d399" style={{ marginRight: 2 }} />
          <Text className="font-sans font-bold text-[#34d399] text-[10px]">+{diffPct} p.p.</Text>
        </View>
      );
    } else if (num < 0) {
      badge = (
        <View className="bg-red-500/20 px-[6px] py-[2px] rounded-[4px] mt-1 self-start flex-row items-center">
          <Feather name="trending-down" size={10} color="#f87171" style={{ marginRight: 2 }} />
          <Text className="font-sans font-bold text-[#f87171] text-[10px]">{diffPct} p.p.</Text>
        </View>
      );
    }

    return (
      <View>
        {badge}
        {prevHint ? (
          <Text className="font-sans text-white/55 text-[9.5px] mt-0.5">{prevHint}</Text>
        ) : null}
      </View>
    );
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
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={scrollViewRef}
          className="flex-1 px-4"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 160 }}
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
        {/* 1. HERO CARD SUPERIOR (GRADIENTE YELO COM BORDAS ARREDONDADAS) */}
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

          {/* Cabeçalho do Card com Botão Atualizar idêntico à Visão Geral */}
          <View className="flex-row justify-between items-start mb-5">
            <View className="flex-1 pr-3">
              <Text className="font-title text-white text-[22px] font-bold leading-tight mb-1">
                Sucesso do Psicólogo (CS)
              </Text>
              <Text className="font-sans text-white/85 text-[12px] leading-4">
                Monitoramento de saúde da assinatura, engajamento e força do perfil.
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

          {/* 4 Métricas de Topo (2 Linhas de 2 Cards - 50%/50%) */}
          <View className="gap-2.5">
            {/* Linha 1: MRR & Ativação */}
            <View className="flex-row gap-2.5">
              {/* MRR */}
              <TouchableOpacity
                onPress={() =>
                  setTooltipModal({
                    visible: true,
                    title: 'MRR',
                    desc: 'Receita Mensal Recorrente estimada baseada nas assinaturas ativas em tempo real.',
                  })
                }
                activeOpacity={0.85}
                className="flex-1 bg-white/10 rounded-2xl p-3 border border-white/15 justify-between"
              >
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="font-sans text-white/70 text-[11px] font-bold uppercase tracking-wider">
                    MRR
                  </Text>
                  <Feather name="info" size={12} color="rgba(255,255,255,0.6)" />
                </View>
                <Text className="font-title text-white text-[20px]">{mrrFormatted}</Text>
                <Text className="font-sans text-white/50 text-[10px] mt-0.5">tempo real</Text>
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
                activeOpacity={0.85}
                className="flex-1 bg-white/10 rounded-2xl p-3 border border-white/15 justify-between"
              >
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="font-sans text-white/70 text-[11px] font-bold uppercase tracking-wider">
                    Ativação
                  </Text>
                  <Feather name="info" size={12} color="rgba(255,255,255,0.6)" />
                </View>
                <Text className="font-title text-[#34d399] text-[20px]">{activationPct}</Text>
                {renderMetricDiff(founderMetrics.activationDiff, founderMetrics.prevActivationRate)}
              </TouchableOpacity>
            </View>

            {/* Linha 2: Pós-Trial & Renovação */}
            <View className="flex-row gap-2.5">
              {/* Pós-Trial */}
              <TouchableOpacity
                onPress={() =>
                  setTooltipModal({
                    visible: true,
                    title: 'Retenção Pós-Trial',
                    desc: 'Percentual de psicólogos que continuam pagantes ativos após o trial nos últimos 30 dias.',
                  })
                }
                activeOpacity={0.85}
                className="flex-1 bg-white/10 rounded-2xl p-3 border border-white/15 justify-between"
              >
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="font-sans text-white/70 text-[11px] font-bold uppercase tracking-wider">
                    Pós-Trial
                  </Text>
                  <Feather name="info" size={12} color="rgba(255,255,255,0.6)" />
                </View>
                <Text className="font-title text-[#60a5fa] text-[20px]">{postTrialPct}</Text>
                {renderMetricDiff(founderMetrics.postTrialDiff, founderMetrics.prevPostTrialRetentionRate)}
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
                activeOpacity={0.85}
                className="flex-1 bg-white/10 rounded-2xl p-3 border border-white/15 justify-between"
              >
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="font-sans text-white/70 text-[11px] font-bold uppercase tracking-wider">
                    Renovação
                  </Text>
                  <Feather name="info" size={12} color="rgba(255,255,255,0.6)" />
                </View>
                <Text className="font-title text-[#c084fc] text-[20px]">{renewalPct}</Text>
                {renderMetricDiff(founderMetrics.renewalDiff, founderMetrics.prevRenewalRate)}
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        {/* ========================================================= */}
        {/* 2. AÇÕES PRIORITÁRIAS (VERTICAL STACK RESPONSIVO WEB)      */}
        {/* ========================================================= */}
        <View className="mt-1 mb-5">
          <View className="flex-row items-center justify-between mb-2.5">
            <View className="flex-row items-center gap-2">
              <Feather name="alert-triangle" size={18} color="#f59e0b" />
              <Text className="font-title text-[#1e293b] text-[18px]">Ações Prioritárias</Text>
            </View>
            {activeFilter.startsWith('pending_') && (
              <TouchableOpacity
                onPress={() => setActiveFilter('')}
                className="bg-slate-200/80 px-2.5 py-1 rounded-full"
              >
                <Text className="font-sans text-[11px] text-[#475569] font-bold">Limpar ✕</Text>
              </TouchableOpacity>
            )}
          </View>

          <View className="gap-2.5">
            {/* Trials Acabando */}
            <TouchableOpacity
              onPress={() =>
                setActiveFilter(activeFilter === 'pending_expiring_trial' ? '' : 'pending_expiring_trial')
              }
              activeOpacity={0.85}
              className={`p-4 rounded-2xl border flex-row items-center justify-between shadow-xs ${
                activeFilter === 'pending_expiring_trial'
                  ? 'bg-[#fef3c7] border-[#d97706]'
                  : 'bg-[#fffbeb] border-[#fde68a]'
              }`}
            >
              <View className="flex-1 pr-3">
                <Text className="font-title text-[#92400e] text-[16px]">Trials Acabando</Text>
                <Text className="font-sans text-[#b45309] text-[12px] mt-0.5">
                  Vencimento nas próximas 24h
                </Text>
              </View>
              <View className="items-end">
                <Text className="font-title text-[#d97706] text-[28px] leading-tight">
                  {kpis.pending_expiring_trial || 0}
                </Text>
                <View className="flex-row items-center mt-0.5">
                  <Text className="font-sans text-[11px] text-[#b45309] font-semibold">Filtrar</Text>
                  <Feather name="chevron-right" size={13} color="#b45309" />
                </View>
              </View>
            </TouchableOpacity>

            {/* Pagamentos Falhados */}
            <TouchableOpacity
              onPress={() =>
                setActiveFilter(activeFilter === 'pending_paid_churn' ? '' : 'pending_paid_churn')
              }
              activeOpacity={0.85}
              className={`p-4 rounded-2xl border flex-row items-center justify-between shadow-xs ${
                activeFilter === 'pending_paid_churn'
                  ? 'bg-[#fee2e2] border-[#dc2626]'
                  : 'bg-[#fef2f2] border-[#fecaca]'
              }`}
            >
              <View className="flex-1 pr-3">
                <Text className="font-title text-[#991b1b] text-[16px]">Pagamentos Falhados</Text>
                <Text className="font-sans text-[#b91c1c] text-[12px] mt-0.5">
                  Necessitam de contato urgente
                </Text>
              </View>
              <View className="items-end">
                <Text className="font-title text-[#dc2626] text-[28px] leading-tight">
                  {kpis.pending_paid_churn || 0}
                </Text>
                <View className="flex-row items-center mt-0.5">
                  <Text className="font-sans text-[11px] text-[#b91c1c] font-semibold">Filtrar</Text>
                  <Feather name="chevron-right" size={13} color="#b91c1c" />
                </View>
              </View>
            </TouchableOpacity>

            {/* Perfis Incompletos */}
            <TouchableOpacity
              onPress={() =>
                setActiveFilter(activeFilter === 'pending_incomplete' ? '' : 'pending_incomplete')
              }
              activeOpacity={0.85}
              className={`p-4 rounded-2xl border flex-row items-center justify-between shadow-xs ${
                activeFilter === 'pending_incomplete'
                  ? 'bg-[#dcfce7] border-[#16a34a]'
                  : 'bg-[#f0fdf4] border-[#bbf7d0]'
              }`}
            >
              <View className="flex-1 pr-3">
                <Text className="font-title text-[#166534] text-[16px]">Perfis Incompletos</Text>
                <Text className="font-sans text-[#15803d] text-[12px] mt-0.5">
                  Pendentes há mais de 3 dias
                </Text>
              </View>
              <View className="items-end">
                <Text className="font-title text-[#16a34a] text-[28px] leading-tight">
                  {kpis.pending_incomplete ?? kpis.pending ?? 0}
                </Text>
                <View className="flex-row items-center mt-0.5">
                  <Text className="font-sans text-[11px] text-[#15803d] font-semibold">Filtrar</Text>
                  <Feather name="chevron-right" size={13} color="#15803d" />
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* ========================================================= */}
        {/* 3. STATUS DA BASE / FUNIL (2 LINHAS DE 2 CARDS + 1 FULL)   */}
        {/* ========================================================= */}
        <View className="mb-5">
          <View className="flex-row items-center justify-between mb-2.5">
            <Text className="font-title text-[#1e293b] text-[18px]">Status da Base (Funil)</Text>
            <Text className="font-sans text-[#64748b] text-[12px]">Toque para filtrar</Text>
          </View>

          <View className="gap-2.5">
            {/* Linha 1: Pagantes & Em Trial */}
            <View className="flex-row gap-2.5">
              {/* Pagantes */}
              <TouchableOpacity
                onPress={() => setActiveFilter(activeFilter === 'active_paying' ? '' : 'active_paying')}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  backgroundColor: activeFilter === 'active_paying' ? '#ecfdf5' : '#ffffff',
                  borderRadius: 16,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: activeFilter === 'active_paying' ? '#10b981' : '#e2e8f0',
                  overflow: 'hidden',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 3,
                  elevation: 1,
                }}
              >
                <View className="flex-row items-center justify-between mb-1">
                  <View className="flex-row items-center gap-1.5">
                    <Feather name="dollar-sign" size={13} color="#10b981" />
                    <Text className="font-sans font-bold text-[#475569] text-[12px]">Pagantes</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() =>
                      setTooltipModal({
                        visible: true,
                        title: 'Pagantes',
                        desc: 'Psicólogos que já assinaram e estão com o pagamento em dia.',
                      })
                    }
                  >
                    <Feather name="info" size={12} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
                <Text className="font-title text-[#10b981] text-[24px] mt-1">
                  {kpis.active_paying || 0}
                </Text>
                <Text className="font-sans text-emerald-600 font-medium text-[11px] mt-0.5">
                  {`${kpis.new_paying_month || 0} novo(s) este mês`}
                </Text>
              </TouchableOpacity>

              {/* Em Trial */}
              <TouchableOpacity
                onPress={() => setActiveFilter(activeFilter === 'active_trial' ? '' : 'active_trial')}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  backgroundColor: activeFilter === 'active_trial' ? '#eff6ff' : '#ffffff',
                  borderRadius: 16,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: activeFilter === 'active_trial' ? '#3b82f6' : '#e2e8f0',
                  overflow: 'hidden',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 3,
                  elevation: 1,
                }}
              >
                <View className="flex-row items-center justify-between mb-1">
                  <View className="flex-row items-center gap-1.5">
                    <Feather name="clock" size={13} color="#3b82f6" />
                    <Text className="font-sans font-bold text-[#475569] text-[12px]">Em Trial</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() =>
                      setTooltipModal({
                        visible: true,
                        title: 'Em Trial',
                        desc: 'Psicólogos nos 7 dias de teste grátis.',
                      })
                    }
                  >
                    <Feather name="info" size={12} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
                <Text className="font-title text-[#3b82f6] text-[24px] mt-1">
                  {kpis.active_trial || 0}
                </Text>
                <Text className="font-sans text-[#64748b] font-medium text-[11px] mt-0.5">
                  {`${kpis.new_trials_week || 0} novo(s) esta semana`}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Linha 2: Churn no Mês & Pendentes */}
            <View className="flex-row gap-2.5">
              {/* Churn no Mês */}
              <TouchableOpacity
                onPress={() => setActiveFilter(activeFilter === 'churn_month' ? '' : 'churn_month')}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  backgroundColor: activeFilter === 'churn_month' ? '#fef2f2' : '#ffffff',
                  borderRadius: 16,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: activeFilter === 'churn_month' ? '#ef4444' : '#e2e8f0',
                  overflow: 'hidden',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 3,
                  elevation: 1,
                }}
              >
                <View className="flex-row items-center justify-between mb-1">
                  <View className="flex-row items-center gap-1.5">
                    <Feather name="user-x" size={13} color="#ef4444" />
                    <Text className="font-sans font-bold text-[#475569] text-[12px]">Churn no Mês</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() =>
                      setTooltipModal({
                        visible: true,
                        title: 'Churn no Mês',
                        desc: 'Psicólogos pagantes (com ao menos 1 pagamento) que cancelaram ou expiraram no mês atual.',
                      })
                    }
                  >
                    <Feather name="info" size={12} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
                <Text className="font-title text-[#ef4444] text-[24px] mt-1">
                  {kpis.churn_month || 0}
                </Text>
                <Text className="font-sans text-[#ef4444] font-medium text-[11px] mt-0.5">Cancel./expirados no mês</Text>
              </TouchableOpacity>

              {/* Pendentes */}
              <TouchableOpacity
                onPress={() => setActiveFilter(activeFilter === 'pending' ? '' : 'pending')}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  backgroundColor: activeFilter === 'pending' ? '#fffbeb' : '#ffffff',
                  borderRadius: 16,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: activeFilter === 'pending' ? '#f59e0b' : '#e2e8f0',
                  overflow: 'hidden',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 3,
                  elevation: 1,
                }}
              >
                <View className="flex-row items-center justify-between mb-1">
                  <View className="flex-row items-center gap-1.5">
                    <Feather name="alert-circle" size={13} color="#f59e0b" />
                    <Text className="font-sans font-bold text-[#475569] text-[12px]">Pendentes</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() =>
                      setTooltipModal({
                        visible: true,
                        title: 'Pendentes',
                        desc: 'Não finalizaram o perfil. Após um certo período, irão para a lixeira.',
                      })
                    }
                  >
                    <Feather name="info" size={12} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
                <Text className="font-title text-[#f59e0b] text-[24px] mt-1">
                  {kpis.pending || 0}
                </Text>
                <Text className="font-sans text-[#b45309] font-medium text-[11px] mt-0.5">
                  {`${kpis.pending_over_3d || 0} há > 3 dias`}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Linha 3: Inativos (Full Width) */}
            <TouchableOpacity
              onPress={() => setActiveFilter(activeFilter === 'inactive' ? '' : 'inactive')}
              activeOpacity={0.8}
              style={{
                width: '100%',
                backgroundColor: activeFilter === 'inactive' ? '#fef2f2' : '#ffffff',
                borderRadius: 16,
                padding: 14,
                borderWidth: 1,
                borderColor: activeFilter === 'inactive' ? '#ef4444' : '#e2e8f0',
                overflow: 'hidden',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 3,
                elevation: 1,
              }}
            >
              <View className="flex-row items-center gap-2.5">
                <View className="w-8 h-8 rounded-full bg-red-100 items-center justify-center">
                  <Feather name="slash" size={14} color="#ef4444" />
                </View>
                <View>
                  <Text className="font-sans font-bold text-[#475569] text-[13px]">Inativos / Cancelados</Text>
                  <Text className="font-sans text-[#ef4444] text-[11px]">
                    {`Assinaturas canceladas ou expiradas${kpis.new_inactive_month ? ` (+${kpis.new_inactive_month} no mês)` : ''}`}
                  </Text>
                </View>
              </View>
              <Text className="font-title text-[#ef4444] text-[22px]">
                {kpis.inactive || 0}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ========================================================= */}
        {/* 4. ORIGENS UTM (AQUISIÇÃO - 2 LINHAS DE 2 CARDS + 1 FULL) */}
        {/* ========================================================= */}
        <View className="mb-5">
          <Text className="font-title text-[#1e293b] text-[18px] mb-2.5">Origens de Aquisição (UTM)</Text>

          <View className="gap-2.5">
            {/* Linha 1: WhatsApp & Meta / Ads */}
            <View className="flex-row gap-2.5">
              {/* WhatsApp */}
              <TouchableOpacity
                onPress={() => setActiveFilter(activeFilter === 'utm_whatsapp' ? '' : 'utm_whatsapp')}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  backgroundColor: activeFilter === 'utm_whatsapp' ? '#ecfdf5' : '#ffffff',
                  borderRadius: 16,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: activeFilter === 'utm_whatsapp' ? '#10b981' : '#e2e8f0',
                  overflow: 'hidden',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 3,
                  elevation: 1,
                }}
              >
                <Text className="font-sans font-bold text-[#10b981] text-[11px] uppercase tracking-wider mb-0.5">
                  WhatsApp
                </Text>
                <Text className="font-title text-[#10b981] text-[20px]">
                  {kpis.utm_whatsapp || 0}
                </Text>
              </TouchableOpacity>

              {/* Meta / Ads */}
              <TouchableOpacity
                onPress={() => setActiveFilter(activeFilter === 'utm_meta' ? '' : 'utm_meta')}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  backgroundColor: activeFilter === 'utm_meta' ? '#eff6ff' : '#ffffff',
                  borderRadius: 16,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: activeFilter === 'utm_meta' ? '#3b82f6' : '#e2e8f0',
                  overflow: 'hidden',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 3,
                  elevation: 1,
                }}
              >
                <Text className="font-sans font-bold text-[#3b82f6] text-[11px] uppercase tracking-wider mb-0.5">
                  Meta / Ads
                </Text>
                <Text className="font-title text-[#3b82f6] text-[20px]">
                  {kpis.utm_meta || 0}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Linha 2: Google & Instagram Bio */}
            <View className="flex-row gap-2.5">
              {/* Google */}
              <TouchableOpacity
                onPress={() => setActiveFilter(activeFilter === 'utm_google' ? '' : 'utm_google')}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  backgroundColor: activeFilter === 'utm_google' ? '#fffbeb' : '#ffffff',
                  borderRadius: 16,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: activeFilter === 'utm_google' ? '#f59e0b' : '#e2e8f0',
                  overflow: 'hidden',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 3,
                  elevation: 1,
                }}
              >
                <Text className="font-sans font-bold text-[#f59e0b] text-[11px] uppercase tracking-wider mb-0.5">
                  Google
                </Text>
                <Text className="font-title text-[#f59e0b] text-[20px]">
                  {kpis.utm_google || 0}
                </Text>
              </TouchableOpacity>

              {/* Instagram Bio */}
              <TouchableOpacity
                onPress={() =>
                  setActiveFilter(activeFilter === 'utm_instagram_bio' ? '' : 'utm_instagram_bio')
                }
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  backgroundColor: activeFilter === 'utm_instagram_bio' ? '#fdf2f8' : '#ffffff',
                  borderRadius: 16,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: activeFilter === 'utm_instagram_bio' ? '#ec4899' : '#e2e8f0',
                  overflow: 'hidden',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 3,
                  elevation: 1,
                }}
              >
                <Text className="font-sans font-bold text-[#ec4899] text-[11px] uppercase tracking-wider mb-0.5">
                  Instagram Bio
                </Text>
                <Text className="font-title text-[#ec4899] text-[20px]">
                  {kpis.utm_instagram_bio || 0}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Linha 3: Direto / Outros */}
            <TouchableOpacity
              onPress={() => setActiveFilter(activeFilter === 'utm_outros' ? '' : 'utm_outros')}
              activeOpacity={0.8}
              style={{
                width: '100%',
                backgroundColor: activeFilter === 'utm_outros' ? '#f1f5f9' : '#ffffff',
                borderRadius: 16,
                padding: 14,
                borderWidth: 1,
                borderColor: activeFilter === 'utm_outros' ? '#64748b' : '#e2e8f0',
                overflow: 'hidden',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 3,
                elevation: 1,
              }}
            >
              <Text className="font-sans font-bold text-[#475569] text-[12px] uppercase tracking-wider">
                Direto / Outros
              </Text>
              <Text className="font-title text-[#64748b] text-[20px]">
                {kpis.utm_outros || 0}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ========================================================= */}
        {/* 5. FILTRO DE STATUS DA BASE (SELETOR DROPDOWN NATIVO)     */}
        {/* ========================================================= */}
        <View className="mb-3.5">
          <NativeSelectMenu
            title="Filtrar Psicólogos por Status"
            options={[
              { label: 'Todos os Psicólogos', value: '' },
              { label: 'Follow-ups Prioritários 📞', value: 'pending_actions' },
              { label: 'Assinantes Pagantes', value: 'active_paying' },
              { label: 'Em Período Trial', value: 'active_trial' },
              { label: 'Churn Pagante no Mês 📉', value: 'churn_month' },
              { label: 'Perfis Pendentes / Incompletos', value: 'pending' },
              { label: 'Inativos / Cancelados', value: 'inactive' },
              { label: 'Profissionais VIP (Isentos)', value: 'vip' },
              { label: 'Fila CS (Não Analisados) ✨', value: 'not_analyzed' },
              { label: '🤖 Consultor IA (Baixa Performance)', value: 'low_performance' },
              { label: 'Lixeira 🗑️', value: 'deleted' },
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
                  Filtrar Categoria:
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
                  {activeFilter === 'pending_actions'
                    ? 'Follow-ups 📞'
                    : activeFilter === 'pending_expiring_trial'
                    ? 'Trials Acabando ⏳'
                    : activeFilter === 'pending_paid_churn'
                    ? 'Pagamentos Falhados 🚨'
                    : activeFilter === 'pending_incomplete'
                    ? 'Perfis Incompletos ⚠️'
                    : activeFilter === 'active_paying'
                    ? 'Pagantes'
                    : activeFilter === 'active_trial'
                    ? 'Em Trial'
                    : activeFilter === 'churn_month'
                    ? 'Churn no Mês 📉'
                    : activeFilter === 'pending'
                    ? 'Pendentes'
                    : activeFilter === 'inactive'
                    ? 'Inativos'
                    : activeFilter === 'vip'
                    ? 'VIPs'
                    : activeFilter === 'not_analyzed'
                    ? 'Fila CS ✨'
                    : activeFilter === 'low_performance'
                    ? '🤖 Consultor IA'
                    : activeFilter === 'deleted'
                    ? 'Lixeira 🗑️'
                    : 'Todos os Psicólogos'}
                </Text>
              </View>
              <Feather name="chevron-down" size={16} color="#1B4332" />
            </View>
          </NativeSelectMenu>
        </View>

        {/* ========================================================= */}
        {/* 6. BUSCA                                                   */}
        {/* ========================================================= */}
        <View
          className="mb-3.5"
          onLayout={(e) => {
            searchBarYRef.current = e.nativeEvent.layout.y;
          }}
        >
          <View
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 999,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderWidth: 1.5,
              borderColor: isSearchFocused ? '#1B4332' : '#e2e8f0',
              flexDirection: 'row',
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: isSearchFocused ? 0.08 : 0.03,
              shadowRadius: 3,
              elevation: 1,
            }}
          >
            <Feather name="search" size={17} color={isSearchFocused ? '#1B4332' : '#94a3b8'} />
            <TextInput
              placeholder="Buscar por nome, e-mail ou CRP..."
              placeholderTextColor="#94a3b8"
              value={searchTerm}
              onChangeText={setSearchTerm}
              onFocus={() => {
                setIsSearchFocused(true);
                setTimeout(() => {
                  if (searchBarYRef.current > 0) {
                    scrollViewRef.current?.scrollTo({
                      y: Math.max(0, searchBarYRef.current - (insets.top + 16)),
                      animated: true,
                    });
                  }
                }, 100);
              }}
              onBlur={() => setIsSearchFocused(false)}
              returnKeyType="search"
              onSubmitEditing={Keyboard.dismiss}
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
        </View>

        {/* ========================================================= */}
        {/* 7. LISTA DE CARDS (MODO FOLLOW-UP OU MODO PADRÃO)          */}
        {/* ========================================================= */}
        <View className="mb-2">
          {loading ? (
            <View className="py-[40px] items-center justify-center">
              <ActivityIndicator size="large" color="#1B4332" />
              <Text className="font-sans text-[#64748b] text-[13px] mt-3">Carregando CRM...</Text>
            </View>
          ) : isFollowupMode ? (
            // ================= MODO FOLLOW-UP =================
            pendingActions.length === 0 ? (
              <View
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: 18,
                  padding: 30,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                }}
              >
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
                  badgeBg = '#dcfce7';
                  badgeColor = '#15803d';
                  badgeText = 'Análise Pronta';
                } else if (item.actionType === 'low_performance') {
                  btnLabel = 'Diagnóstico (IA)';
                  btnGradient = ['#1B4332', '#2D6A4F'];
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
                  badgeBg = '#fee2e2';
                  badgeColor = '#b91c1c';
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
                  btnGradient = ['#1B4332', '#2D6A4F'];
                  btnIcon = 'users';
                  badgeBg = '#ffedd5';
                  badgeColor = '#c2410c';
                  badgeText = 'Em Negociação';
                } else if (item.actionType === 'expired_pix_fomo') {
                  btnLabel = 'Recuperar Assinatura';
                  btnGradient = ['#d97706', '#b45309'];
                  btnIcon = 'clock';
                  badgeBg = '#fef3c7';
                  badgeColor = '#b45309';
                  badgeText = 'FOMO Assinatura';
                }

                const dateStr =
                  item.actionType === 'expiring_trial' && item.planExpiresAt
                    ? new Date(item.planExpiresAt).toLocaleDateString('pt-BR', {
                        timeZone: 'America/Sao_Paulo',
                      })
                    : item.createdAt
                    ? new Date(item.createdAt).toLocaleDateString('pt-BR')
                    : item.planExpiresAt
                    ? new Date(item.planExpiresAt).toLocaleDateString('pt-BR', {
                        timeZone: 'America/Sao_Paulo',
                      })
                    : '-';

                const planoLabel = item.plano
                  ? item.plano.charAt(0).toUpperCase() + item.plano.slice(1).toLowerCase()
                  : '-';

                const hasAiDiagSent =
                  item.actionType === 'low_performance' &&
                  Array.isArray(item.aiOptimizationHistory) &&
                  item.aiOptimizationHistory.some((h: any) => h.action === 'whatsapp_ai_diagnosis');

                const itemFotoUri = item.fotoUrl ? resolvePhotoUrl(item.fotoUrl) : null;

                return (
                  <View
                    key={`${item.id}_${item.actionType}_${idx}`}
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
                    {/* Topo do Card */}
                    <View className="flex-row items-center gap-3 pb-3 border-b border-[#f1f5f9]">
                      {itemFotoUri ? (
                        <Image
                          source={{ uri: itemFotoUri }}
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: 999,
                            borderWidth: 1.5,
                            borderColor: '#e2e8f0',
                            backgroundColor: '#f8fafc',
                          }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: 999,
                            backgroundColor: '#ecfdf5',
                            borderWidth: 1.5,
                            borderColor: '#a7f3d0',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text className="font-title text-[#166534] text-[22px] font-bold">
                            {(item.nome || '?').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View className="flex-1">
                        <TouchableOpacity onPress={() => openCSDrawer(item)}>
                          <Text className="font-title text-[#1B4332] text-[17px] font-bold">
                            {item.nome || 'Sem Nome'}
                            {hasAiDiagSent ? ' 🤖📱' : ''}
                          </Text>
                        </TouchableOpacity>
                        <Text className="font-sans text-[#64748b] text-[12px] mt-0.5">
                          {item.telefone || 'Sem telefone'}
                        </Text>
                      </View>
                    </View>

                    {/* Linhas Internas */}
                    <View className="py-2.5 gap-2">
                      {/* Status da Ação */}
                      <View className="flex-row justify-between items-center py-0.5">
                        <Text className="font-sans text-[#64748b] text-[11px] font-bold uppercase tracking-wider">
                          Status da Ação
                        </Text>
                        <View
                          className="px-2.5 py-0.5 rounded-full"
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
                        <View
                          style={{
                            backgroundColor: '#f8fafc',
                            borderRadius: 12,
                            padding: 10,
                            borderWidth: 1,
                            borderColor: '#e2e8f0',
                            overflow: 'hidden',
                          }}
                        >
                          <Text className="font-sans text-[#1e293b] text-[13px] leading-5">
                            {item.reason}
                          </Text>
                        </View>
                      </View>

                      {/* Data / Previsão */}
                      <View className="flex-row justify-between items-center py-0.5">
                        <Text className="font-sans text-[#64748b] text-[11px] font-bold uppercase tracking-wider">
                          Data / Previsão
                        </Text>
                        <Text className="font-sans font-semibold text-[#1e293b] text-[13px]">
                          {dateStr}
                        </Text>
                      </View>

                      {/* Plano */}
                      <View className="flex-row justify-between items-center py-0.5">
                        <Text className="font-sans text-[#64748b] text-[11px] font-bold uppercase tracking-wider">
                          Plano
                        </Text>
                        <Text className="font-sans font-semibold text-[#1e293b] text-[13px]">
                          {planoLabel}
                        </Text>
                      </View>
                    </View>

                    {/* Rodapé: Ações CS */}
                    <View className="flex-row items-center gap-2 pt-3 border-t border-[#f1f5f9]">
                      <TouchableOpacity
                        onPress={() => handleSendAction(item)}
                        disabled={actionLoading}
                        activeOpacity={0.8}
                        style={{
                          flex: 1,
                          height: 40,
                          borderRadius: 999,
                          overflow: 'hidden',
                        }}
                      >
                        <LinearGradient
                          colors={btnGradient as any}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={{
                            width: '100%',
                            height: 40,
                            borderRadius: 999,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            paddingHorizontal: 14,
                          }}
                        >
                          {actionLoading ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Feather name={btnIcon} size={15} color="#fff" />
                              <Text className="font-sans font-bold text-white text-[13px]">
                                {btnLabel}
                              </Text>
                            </>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleDismissAction(item.id, item.actionType)}
                        activeOpacity={0.7}
                        style={{
                          height: 40,
                          paddingHorizontal: 16,
                          borderRadius: 999,
                          backgroundColor: '#fef2f2',
                          borderWidth: 1,
                          borderColor: '#fecaca',
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Feather name="x" size={14} color="#ef4444" />
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
              <View
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: 22,
                  padding: 30,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                }}
              >
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
                    {/* Topo do Card: Foto/Avatar + Nome do Profissional */}
                    <View className="flex-row items-center gap-3 pb-3 border-b border-[#f1f5f9]">
                      {psy.fotoUrl ? (
                        <Image
                          source={{ uri: resolvePhotoUrl(psy.fotoUrl) }}
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: 999,
                            borderWidth: 1.5,
                            borderColor: '#e2e8f0',
                            backgroundColor: '#f8fafc',
                          }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: 999,
                            backgroundColor: '#ecfdf5',
                            borderWidth: 1.5,
                            borderColor: '#a7f3d0',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text className="font-title text-[#166534] text-[22px] font-bold">
                            {(psy.nome || '?').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View className="flex-1">
                        <TouchableOpacity onPress={() => openCSDrawer(psy)}>
                          <View className="flex-row items-center flex-wrap gap-1.5">
                            <Text className="font-title text-[#1B4332] text-[17px] font-bold leading-tight">
                              {psy.nome || 'Sem Nome'}
                            </Text>
                            {isVip && (
                              <View className="bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-md">
                                <Text className="font-sans font-bold text-[10px] text-amber-800">⭐ VIP</Text>
                              </View>
                            )}
                            {psy.isProfileAnalyzed && (
                              <View className="bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded-md">
                                <Text className="font-sans font-bold text-[10px] text-emerald-800">✅ Pronta</Text>
                              </View>
                            )}
                          </View>
                        </TouchableOpacity>
                        <View className="flex-row items-center flex-wrap gap-x-2 gap-y-0.5 mt-1">
                          {psy.crp ? (
                            <View className="bg-slate-100 px-2 py-0.5 rounded-md">
                              <Text className="font-sans font-semibold text-[#475569] text-[11px]">
                                CRP: {psy.crp}
                              </Text>
                            </View>
                          ) : null}
                          <Text className="font-sans text-[#64748b] text-[12px]" numberOfLines={1}>
                            {psy.email || 'Sem email'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Informações Linha a Linha (Estilo Tabela Web Mobile) */}
                    <View className="py-2.5 gap-2">
                      {/* Status / Plano */}
                      <View className="flex-row justify-between items-center py-0.5">
                        <Text className="font-sans text-[#64748b] text-[11px] font-bold uppercase tracking-wider">
                          Status / Plano
                        </Text>
                        <View className="flex-row items-center gap-1.5">
                          <View
                            className="px-2.5 py-0.5 rounded-full"
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
                      <View className="flex-row justify-between items-center py-0.5">
                        <Text className="font-sans text-[#64748b] text-[11px] font-bold uppercase tracking-wider">
                          Força do Perfil
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View
                            style={{
                              width: 84,
                              height: 8,
                              backgroundColor: '#e2e8f0',
                              borderRadius: 999,
                              overflow: 'hidden',
                            }}
                          >
                            <View
                              style={{
                                width: `${Math.max(6, Math.min(100, score))}%`,
                                height: 8,
                                backgroundColor: scoreColor,
                                borderRadius: 999,
                              }}
                            />
                          </View>
                          <Text
                            style={{
                              fontFamily: 'Inter_700Bold',
                              fontSize: 12,
                              color: scoreColor,
                              minWidth: 34,
                              textAlign: 'right',
                            }}
                          >
                            {score}%
                          </Text>
                        </View>
                      </View>

                      {/* Origem (UTM) */}
                      <View className="flex-row justify-between items-center py-0.5">
                        <Text className="font-sans text-[#64748b] text-[11px] font-bold uppercase tracking-wider">
                          Origem (UTM)
                        </Text>
                        <View className="bg-slate-100 px-2.5 py-0.5 rounded-full">
                          <Text className="font-sans font-bold text-[#475569] text-[11px] uppercase">
                            {psy.utm_source || 'Direto'}
                          </Text>
                        </View>
                      </View>

                      {/* Data de Inscrição */}
                      <View className="flex-row justify-between items-center py-0.5">
                        <Text className="font-sans text-[#64748b] text-[11px] font-bold uppercase tracking-wider">
                          Data de Inscrição
                        </Text>
                        <Text className="font-sans font-medium text-[#475569] text-[12px]">{dataInscricao}</Text>
                      </View>
                    </View>

                    {/* Rodapé de Ações CS (Layout Limpo & Harmonioso em Formato Pílula) */}
                    <View className="flex-row items-center gap-2 pt-3 border-t border-[#f1f5f9]">
                      <TouchableOpacity
                        onPress={() => openCSDrawer(psy)}
                        activeOpacity={0.8}
                        style={{
                          flex: 1,
                          height: 40,
                          backgroundColor: '#ecfdf5',
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: '#a7f3d0',
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          paddingHorizontal: 12,
                        }}
                      >
                        <Feather name="eye" size={15} color="#166534" />
                        <Text className="font-sans font-bold text-[#166534] text-[13px]">
                          Visão 360
                        </Text>
                      </TouchableOpacity>

                      {psy.telefone ? (
                        <TouchableOpacity
                          onPress={() => handleSendAction(psy, 'standard_contact')}
                          activeOpacity={0.8}
                          style={{
                            height: 40,
                            paddingHorizontal: 16,
                            backgroundColor: '#10b981',
                            borderRadius: 999,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                          }}
                        >
                          <Feather name="message-circle" size={15} color="#fff" />
                          <Text className="font-sans font-bold text-white text-[13px]">WhatsApp</Text>
                        </TouchableOpacity>
                      ) : null}

                      {!isDeleted && (
                        <TouchableOpacity
                          onPress={() => handleDeletePsychologist(psy.id, psy.nome)}
                          activeOpacity={0.7}
                          style={{
                            height: 40,
                            paddingHorizontal: 14,
                            borderRadius: 999,
                            backgroundColor: '#fef2f2',
                            borderWidth: 1,
                            borderColor: '#fecaca',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 5,
                          }}
                        >
                          <Feather name="trash-2" size={14} color="#ef4444" />
                          <Text className="font-sans font-bold text-[#ef4444] text-[12px]">Excluir</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
            )
          )}
        </View>

        {/* ========================================================= */}
        {/* 8. PAGINAÇÃO                                               */}
        {/* ========================================================= */}
        {!isFollowupMode && totalItems > 0 && (
          <View
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: '#e2e8f0',
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 10,
              marginBottom: 16,
            }}
          >
            <Text className="font-sans text-[#64748b] text-[13px]">
              Mostrando {Math.min((currentPage - 1) * limit + 1, totalItems)}–
              {Math.min(currentPage * limit, totalItems)} de {totalItems}
            </Text>

            <View className="flex-row gap-[8px]">
              <TouchableOpacity
                onPress={() => fetchData(currentPage - 1)}
                disabled={currentPage <= 1}
                className={`w-[36px] h-[36px] rounded-full items-center justify-center border ${
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
                className={`w-[36px] h-[36px] rounded-full items-center justify-center border ${
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
    </KeyboardAvoidingView>

      {/* ========================================================= */}
      {/* 9. DRAWER / MODAL VISÃO 360 CS (MODERN BOTTOM SHEET)       */}
      {/* ========================================================= */}
      <Modal
        visible={drawerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDrawerVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/60">
          {/* Área de toque superior com altura mínima e dismiss ao toque */}
          <Pressable
            onPress={() => setDrawerVisible(false)}
            className="flex-1"
            style={{ minHeight: insets.top + 60 }}
          />

          {/* Bottom Sheet Card com altura controlada */}
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

            {/* Cabeçalho do Drawer */}
            <View className="bg-white px-5 py-3.5 border-b border-slate-200 flex-row justify-between items-center">
              <View className="flex-row items-center gap-2.5">
                <View className="w-9 h-9 rounded-full bg-[#e8f5e9] items-center justify-center">
                  <Feather name="activity" size={18} color="#1B4332" />
                </View>
                <View>
                  <Text className="font-title text-[#1B4332] text-[17px] font-bold">Visão de CS (360º)</Text>
                  <Text className="font-sans text-[#64748b] text-[11px]">Dossiê completo do psicólogo</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setDrawerVisible(false)}
                activeOpacity={0.7}
                className="w-9 h-9 rounded-full bg-slate-100 items-center justify-center active:bg-slate-200"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Feather name="x" size={18} color="#475569" />
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

                  const subSummary = getSubscriptionSummary(psy, drawerFullData);

                  return (
                    <>
                      {/* Cartão de Informações Básicas */}
                      <View
                        style={{
                          backgroundColor: '#ffffff',
                          borderRadius: 16,
                          padding: 16,
                          borderWidth: 1,
                          borderColor: '#e2e8f0',
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.04,
                          shadowRadius: 3,
                          elevation: 1,
                        }}
                      >
                        <View className="flex-row items-center gap-3.5 mb-3">
                          {psy.fotoUrl ? (
                            <Image
                              source={{ uri: resolvePhotoUrl(psy.fotoUrl) }}
                              style={{
                                width: 60,
                                height: 60,
                                borderRadius: 999,
                                borderWidth: 1.5,
                                borderColor: '#e2e8f0',
                                backgroundColor: '#f8fafc',
                              }}
                              resizeMode="cover"
                            />
                          ) : (
                            <View
                              style={{
                                width: 60,
                                height: 60,
                                borderRadius: 999,
                                backgroundColor: '#ecfdf5',
                                borderWidth: 1.5,
                                borderColor: '#a7f3d0',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Text className="font-title text-[#166534] text-[24px] font-bold">
                                {(psy.nome || '?').charAt(0).toUpperCase()}
                              </Text>
                            </View>
                          )}
                          <View className="flex-1">
                            <Text className="font-title text-[#1e293b] text-[18px] font-bold leading-tight">
                              {psy.nome || 'Sem Nome'}
                            </Text>
                            <Text className="font-sans text-[#64748b] text-[13px] mt-0.5">
                              {psy.email || 'Sem email'}
                            </Text>
                          </View>
                        </View>

                        <View className="flex-row flex-wrap gap-2 pt-2.5 border-t border-slate-100">
                          {psy.telefone ? (
                            <View className="bg-slate-100 px-3 py-1.5 rounded-full flex-row items-center gap-1.5">
                              <Feather name="phone" size={12} color="#64748b" />
                              <Text className="font-sans text-[#475569] text-[12px] font-medium">
                                {psy.telefone}
                              </Text>
                            </View>
                          ) : null}
                          {psy.crp ? (
                            <View className="bg-slate-100 px-3 py-1.5 rounded-full flex-row items-center gap-1.5">
                              <Feather name="award" size={12} color="#64748b" />
                              <Text className="font-sans text-[#475569] text-[12px] font-medium">
                                CRP: {psy.crp}
                              </Text>
                            </View>
                          ) : null}
                          <View className="bg-slate-100 px-3 py-1.5 rounded-full flex-row items-center gap-1.5">
                            <Feather name="calendar" size={12} color="#64748b" />
                            <Text className="font-sans text-[#475569] text-[12px] font-medium">
                              Desde:{' '}
                              {psy.createdAt
                                ? new Date(psy.createdAt).toLocaleDateString('pt-BR')
                                : '-'}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Saúde do Perfil (Colapsável) */}
                      <View
                        style={{
                          backgroundColor: '#ffffff',
                          borderRadius: 16,
                          padding: 16,
                          borderWidth: 1,
                          borderColor: '#e2e8f0',
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.04,
                          shadowRadius: 3,
                          elevation: 1,
                        }}
                      >
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => setHealthExpanded((prev) => !prev)}
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 8,
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text className="font-title text-[#1e293b] text-[16px]">Saúde do Perfil</Text>
                            <Feather
                              name={healthExpanded ? 'chevron-up' : 'chevron-down'}
                              size={18}
                              color="#64748b"
                            />
                          </View>
                          <Text
                            className="font-title text-[18px]"
                            style={{ color: scoreColor }}
                          >
                            {score}%
                          </Text>
                        </TouchableOpacity>

                        <View style={{ width: '100%', height: 8, backgroundColor: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                          <View
                            style={{ width: `${Math.max(4, Math.min(100, score))}%`, height: 8, backgroundColor: scoreColor, borderRadius: 999 }}
                          />
                        </View>

                        {/* Botão de Toggle Informativo */}
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => setHealthExpanded((prev) => !prev)}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginTop: 10,
                            paddingTop: 8,
                            borderTopWidth: 1,
                            borderTopColor: '#f1f5f9',
                          }}
                        >
                          <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', color: '#64748b', fontSize: 12 }}>
                            {healthExpanded
                              ? 'Ocultar checklist completo'
                              : `Ver checklist (${checks.filter((c) => c.ok).length}/${checks.length} concluídos)`}
                          </Text>
                          <Feather
                            name={healthExpanded ? 'chevron-up' : 'chevron-down'}
                            size={14}
                            color="#94a3b8"
                          />
                        </TouchableOpacity>

                        {/* Checklist dos 19 itens (Apenas se expandido) */}
                        {healthExpanded && (
                          <View style={{ gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
                            {checks.map((chk, i) => (
                              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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
                        )}
                      </View>

                      {/* Consultor IA (Performance) - Formatado com Bordas Arredondadas e Layout Premium */}
                      <View
                        style={{
                          borderRadius: 16,
                          overflow: 'hidden',
                          borderWidth: 1,
                          borderColor: '#c4b5fd',
                          backgroundColor: '#f5f3ff',
                          shadowColor: '#7c3aed',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.08,
                          shadowRadius: 8,
                          elevation: 2,
                        }}
                      >
                        <LinearGradient
                          colors={['#f3e8ff', '#ede9fe', '#e0e7ff']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={{ padding: 18 }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(124, 58, 237, 0.12)', alignItems: 'center', justifyContent: 'center' }}>
                              <Feather name="cpu" size={17} color="#6d28d9" />
                            </View>
                            <Text className="font-title text-[#4c1d95] text-[16px]">
                              Consultor IA (Performance)
                            </Text>
                          </View>

                          <Text className="font-sans text-[#5b21b6] text-[13px] leading-5 mb-[14px]">
                            Gere um dossiê automático de desempenho cruzando os acessos com as ferramentas que o psicólogo não utiliza.
                          </Text>

                          {aiDiagnosis && (
                            <View
                              style={{
                                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                padding: 14,
                                borderRadius: 12,
                                marginBottom: 14,
                                borderWidth: 1,
                                borderColor: '#c7d2fe',
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: 0.05,
                                shadowRadius: 3,
                                elevation: 1,
                              }}
                            >
                              <Text style={{ fontFamily: 'Cinzel_700Bold', color: '#4338ca', fontSize: 13, marginBottom: 4 }}>
                                Diagnóstico:
                              </Text>
                              <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', color: '#3730a3', fontSize: 12.5, lineHeight: 18, marginBottom: 12 }}>
                                {aiDiagnosis.diagnosis}
                              </Text>

                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <Text style={{ fontFamily: 'Cinzel_700Bold', color: '#4338ca', fontSize: 13 }}>
                                  Mensagem Sugerida:
                                </Text>
                                <TouchableOpacity
                                  activeOpacity={0.7}
                                  onPress={async () => {
                                    if (aiDiagnosis.copy) {
                                      await Clipboard.setStringAsync(aiDiagnosis.copy);
                                      Alert.alert('Copiado! 📋', 'Mensagem sugerida copiada para a área de transferência.');
                                    }
                                  }}
                                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: '#ede9fe' }}
                                >
                                  <Feather name="copy" size={12} color="#6d28d9" />
                                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#6d28d9', fontSize: 11 }}>Copiar</Text>
                                </TouchableOpacity>
                              </View>

                              <View
                                style={{
                                  backgroundColor: '#ffffff',
                                  padding: 12,
                                  borderRadius: 8,
                                  borderWidth: 1,
                                  borderColor: '#c7d2fe',
                                  borderStyle: 'dashed',
                                }}
                              >
                                <Text
                                  style={{
                                    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                                    color: '#1e293b',
                                    fontSize: 11.5,
                                    lineHeight: 16,
                                  }}
                                >
                                  {aiDiagnosis.copy}
                                </Text>
                              </View>
                            </View>
                          )}

                          <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity
                              onPress={() => handleGenerateAiDiagnosis(psy)}
                              disabled={aiDiagnosisLoading}
                              activeOpacity={0.8}
                              style={{
                                flex: 1,
                                backgroundColor: '#7c3aed',
                                height: 44,
                                paddingHorizontal: 16,
                                borderRadius: 999,
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexDirection: 'row',
                                gap: 8,
                                shadowColor: '#7c3aed',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.25,
                                shadowRadius: 4,
                                elevation: 3,
                              }}
                            >
                              {aiDiagnosisLoading ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <>
                                  <Feather name="play-circle" size={16} color="#fff" />
                                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#ffffff', fontSize: 13.5 }}>
                                    {psy.status === 'inactive' && psy.planExpiresAt && new Date(psy.planExpiresAt) < new Date()
                                      ? (aiDiagnosis ? '✨ Resgate Atualizado' : 'Gerar Resgate de Churn')
                                      : (aiDiagnosis ? '✨ Diagnóstico Atualizado' : 'Gerar Diagnóstico')}
                                  </Text>
                                </>
                              )}
                            </TouchableOpacity>

                            {aiDiagnosis?.copy && (
                              <TouchableOpacity
                                onPress={async () => {
                                  if (aiDiagnosis.copy) {
                                    await Clipboard.setStringAsync(aiDiagnosis.copy);
                                  }
                                  handleSendAction({
                                    ...psy,
                                    actionType: 'low_performance',
                                  });
                                }}
                                activeOpacity={0.8}
                                style={{
                                  backgroundColor: '#10b981',
                                  height: 44,
                                  paddingHorizontal: 16,
                                  borderRadius: 999,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexDirection: 'row',
                                  gap: 6,
                                  shadowColor: '#10b981',
                                  shadowOffset: { width: 0, height: 2 },
                                  shadowOpacity: 0.25,
                                  shadowRadius: 4,
                                  elevation: 3,
                                }}
                              >
                                <Feather name="send" size={15} color="#fff" />
                                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#ffffff', fontSize: 13.5 }}>
                                  WhatsApp
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </LinearGradient>
                      </View>

                      {/* Assinatura */}
                      <View
                        style={{
                          backgroundColor: '#ffffff',
                          borderRadius: 16,
                          padding: 18,
                          borderWidth: 1,
                          borderColor: '#e2e8f0',
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.04,
                          shadowRadius: 3,
                          elevation: 1,
                        }}
                      >
                        <Text className="font-title text-[#1e293b] text-[16px] mb-[12px]">
                          Assinatura
                        </Text>
                        <View className="flex-row justify-between gap-[12px]">
                          <View className="flex-1">
                            <Text className="font-sans text-[#64748b] text-[12px]">Plano</Text>
                            <Text
                              className="font-title text-[15px] mt-1"
                              style={{ color: subSummary.planColor }}
                            >
                              {subSummary.planText}
                            </Text>
                          </View>
                          <View className="items-end">
                            <Text className="font-sans text-[#64748b] text-[12px]">
                              {subSummary.expireLabel}
                            </Text>
                            <Text
                              className="font-title text-[15px] mt-1"
                              style={{ color: subSummary.expireColor }}
                            >
                              {subSummary.expireText}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Ações de CS - Paridade 100% com a Versão Web */}
                      <View
                        style={{
                          backgroundColor: '#ffffff',
                          borderRadius: 16,
                          padding: 18,
                          borderWidth: 1,
                          borderColor: '#e2e8f0',
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.04,
                          shadowRadius: 3,
                          elevation: 1,
                          gap: 10,
                        }}
                      >
                        <Text className="font-title text-[#1e293b] text-[16px] mb-[4px]">
                          Ações de CS
                        </Text>

                        {/* 1. WhatsApp */}
                        <TouchableOpacity
                          onPress={() => handleSendAction(psy, 'standard_contact')}
                          activeOpacity={0.8}
                          style={{
                            backgroundColor: '#10b981',
                            paddingVertical: 13,
                            borderRadius: 999,
                            alignItems: 'center',
                            flexDirection: 'row',
                            justifyContent: 'center',
                            gap: 8,
                          }}
                        >
                          <Feather name="message-circle" size={17} color="#fff" />
                          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#fff', fontSize: 14 }}>
                            Chamar no WhatsApp 📱
                          </Text>
                        </TouchableOpacity>

                        {/* 2. Análise de Perfil (IA) */}
                        <TouchableOpacity
                          onPress={async () => {
                            await handleSendAction(psy, 'analysis');
                            setCopiedAnalysisId(psy.id);
                          }}
                          activeOpacity={0.8}
                          style={{
                            backgroundColor: copiedAnalysisId === psy.id ? '#dcfce7' : '#fef08a',
                            borderWidth: 1,
                            borderColor: copiedAnalysisId === psy.id ? '#bbf7d0' : '#fde047',
                            paddingVertical: 13,
                            borderRadius: 999,
                            alignItems: 'center',
                            flexDirection: 'row',
                            justifyContent: 'center',
                            gap: 8,
                          }}
                        >
                          <Feather
                            name={copiedAnalysisId === psy.id ? 'check' : 'award'}
                            size={17}
                            color={copiedAnalysisId === psy.id ? '#166534' : '#b45309'}
                          />
                          <Text
                            style={{
                              fontFamily: 'PlusJakartaSans_700Bold',
                              color: copiedAnalysisId === psy.id ? '#166534' : '#b45309',
                              fontSize: 14,
                            }}
                          >
                            {copiedAnalysisId === psy.id ? '✨ Análise Copiada ✅' : '✨ Análise de Perfil (IA)'}
                          </Text>
                        </TouchableOpacity>

                        {/* 3. Ver Dossiê Completo (Web Parity) */}
                        <TouchableOpacity
                          onPress={() => handleOpenDossier(psy)}
                          activeOpacity={0.8}
                          style={{
                            backgroundColor: '#f8fafc',
                            borderWidth: 1,
                            borderColor: '#cbd5e1',
                            paddingVertical: 13,
                            borderRadius: 999,
                            alignItems: 'center',
                            flexDirection: 'row',
                            justifyContent: 'center',
                            gap: 8,
                          }}
                        >
                          <Feather name="folder" size={17} color="#334155" />
                          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#334155', fontSize: 14 }}>
                            Ver Dossiê Completo 🗂️
                          </Text>
                        </TouchableOpacity>

                        {/* 4. Ver Perfil Público */}
                        <TouchableOpacity
                          onPress={() => {
                            const slug = psy.slug || psy.id;
                            Linking.openURL(`https://www.yelopsi.com.br/${slug}`);
                          }}
                          activeOpacity={0.8}
                          style={{
                            backgroundColor: '#f0fdf4',
                            borderWidth: 1,
                            borderColor: '#bbf7d0',
                            paddingVertical: 13,
                            borderRadius: 999,
                            alignItems: 'center',
                            flexDirection: 'row',
                            justifyContent: 'center',
                            gap: 8,
                          }}
                        >
                          <Feather name="external-link" size={17} color="#166534" />
                          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#166534', fontSize: 14 }}>
                            Ver Perfil Público 🔗
                          </Text>
                        </TouchableOpacity>

                        {/* 5. Estender Período Grátis (Web Parity) */}
                        <TouchableOpacity
                          onPress={() => handleExtendTrial(psy, 7)}
                          disabled={isExtendingTrial}
                          activeOpacity={0.8}
                          style={{
                            backgroundColor: '#f0fdf4',
                            borderWidth: 1,
                            borderColor: '#86efac',
                            paddingVertical: 13,
                            borderRadius: 999,
                            alignItems: 'center',
                            flexDirection: 'row',
                            justifyContent: 'center',
                            gap: 8,
                          }}
                        >
                          {isExtendingTrial ? (
                            <ActivityIndicator size="small" color="#166534" />
                          ) : (
                            <>
                              <Feather name="gift" size={17} color="#166534" />
                              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#166534', fontSize: 14 }}>
                                Estender Período Grátis 🎁
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>

                        {/* 6. Conceder / Remover Isenção VIP */}
                        <TouchableOpacity
                          onPress={() => handleToggleVip(psy)}
                          activeOpacity={0.8}
                          style={{
                            backgroundColor: '#1B4332',
                            paddingVertical: 13,
                            borderRadius: 999,
                            alignItems: 'center',
                            flexDirection: 'row',
                            justifyContent: 'center',
                            gap: 8,
                          }}
                        >
                          <Feather name="star" size={17} color="#fff" />
                          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#fff', fontSize: 14 }}>
                            {isVip ? 'Remover Isenção VIP' : 'Conceder Isenção VIP ⭐'}
                          </Text>
                        </TouchableOpacity>

                        {/* 7. Expirar Perfil */}
                        <TouchableOpacity
                          onPress={() => handleExpireProfile(psy)}
                          activeOpacity={0.8}
                          style={{
                            backgroundColor: '#fef2f2',
                            borderWidth: 1,
                            borderColor: '#fecaca',
                            paddingVertical: 13,
                            borderRadius: 999,
                            alignItems: 'center',
                            flexDirection: 'row',
                            justifyContent: 'center',
                            gap: 8,
                            marginTop: 4,
                          }}
                        >
                          <Feather name="alert-circle" size={17} color="#991b1b" />
                          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#991b1b', fontSize: 14 }}>
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
