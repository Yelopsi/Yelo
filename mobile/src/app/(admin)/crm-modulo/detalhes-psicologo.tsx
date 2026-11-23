import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  RefreshControl,
  Share,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import api from '../../../services/api';

type TabKey = 'timeline' | 'payments' | 'whatsapp' | 'reviews' | 'blog' | 'forum';

interface FullDetailsResponse {
  psychologist: any;
  subscription?: any;
  stats?: {
    profileViews?: number;
    matches?: number;
    whatsappClicks?: number;
    forumActivities?: number;
  };
  blogPosts?: any[];
  forumPosts?: any[];
  forumComments?: any[];
  reviews?: any[];
  matches?: any[];
  whatsappLogs?: any[];
  payments?: any[];
  asaasSubscription?: any;
  asaasFailedReason?: string;
  asaasFailedBillingType?: string;
}

export default function AdminCRMPsicologoDetalhesScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<FullDetailsResponse | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('timeline');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDetails = useCallback(async () => {
    if (!id) return;
    try {
      const response = await api.get<FullDetailsResponse>(
        `/api/admin/psychologists/${id}/full-details`
      );
      setData(response.data);
    } catch (error: any) {
      console.error('Erro ao carregar dossiê completo:', error);
      Alert.alert('Erro', error?.message || 'Não foi possível carregar os detalhes do psicólogo.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDetails();
  }, [fetchDetails]);

  // Helpers de formatação
  const formatDateBR = (dateInput?: string | Date | null) => {
    if (!dateInput) return '-';
    try {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return '-';
      return d.toLocaleDateString('pt-BR');
    } catch {
      return '-';
    }
  };

  const formatDateTimeBR = (dateInput?: string | Date | null) => {
    if (!dateInput) return '-';
    try {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return '-';
      return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    } catch {
      return '-';
    }
  };

  const formatCurrency = (val: number | string | null | undefined) => {
    const num = typeof val === 'number' ? val : parseFloat(val || '0');
    if (isNaN(num)) return 'R$ 0,00';
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const psy = data?.psychologist;
  const stats = data?.stats || {};
  const payments = data?.payments || [];
  const whatsappLogs = data?.whatsappLogs || [];
  const reviews = data?.reviews || [];
  const blogPosts = data?.blogPosts || [];
  const forumPosts = data?.forumPosts || [];
  const forumComments = data?.forumComments || [];
  const asaasSub = data?.asaasSubscription;
  const sub = data?.subscription;

  // Calculo de expiração do plano
  const expiryInfo = useMemo(() => {
    const dateInput = psy?.planExpiresAt || asaasSub?.nextDueDate;
    if (!dateInput) return null;
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return null;
    if (d.getUTCFullYear() >= 2090) {
      return { isPerpetual: true, isExpired: false, days: 9999, text: 'Vitalício' };
    }
    const now = new Date();
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const expDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const diffMs = expDate.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const absDays = Math.abs(diffDays);
      return {
        isPerpetual: false,
        isExpired: true,
        days: absDays,
        text: absDays === 1 ? 'Expirou ontem' : `Expirou há ${absDays} dias`,
      };
    } else if (diffDays === 0) {
      return { isPerpetual: false, isExpired: false, days: 0, text: 'Vence hoje' };
    } else if (diffDays === 1) {
      return { isPerpetual: false, isExpired: false, days: 1, text: 'Vence amanhã' };
    }
    return { isPerpetual: false, isExpired: false, days: diffDays, text: `Vence em ${diffDays} dias` };
  }, [psy?.planExpiresAt, asaasSub?.nextDueDate]);

  // Conversões PLG
  const plgAgendados = useMemo(() => {
    return whatsappLogs.filter(
      (l: any) => l.dealClosed === 'yes' || l.dealClosed === 'started'
    ).length;
  }, [whatsappLogs]);

  // Eventos da Linha do Tempo
  const timelineEvents = useMemo(() => {
    const evts: any[] = [];
    blogPosts.forEach((x: any) =>
      evts.push({ type: 'blog', date: x.createdAt || x.created_at, data: x })
    );
    forumPosts.forEach((x: any) =>
      evts.push({ type: 'forum_post', date: x.createdAt, data: x })
    );
    forumComments.forEach((x: any) =>
      evts.push({ type: 'forum_comment', date: x.createdAt, data: x })
    );
    reviews.forEach((x: any) =>
      evts.push({ type: 'review', date: x.createdAt, data: x })
    );
    (data?.matches || []).forEach((x: any) =>
      evts.push({ type: 'match', date: x.createdAt, data: x })
    );

    evts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return evts;
  }, [blogPosts, forumPosts, forumComments, reviews, data?.matches]);

  // Status badge config
  const statusBadge = useMemo(() => {
    if (!psy) return { label: 'INATIVO', bg: '#f1f5f9', text: '#475569' };
    if (psy.status === 'active') {
      if (psy.is_exempt) return { label: 'VIP ⭐', bg: '#fef3c7', text: '#92400e' };
      if (!psy.subscriptionId && psy.planExpiresAt && new Date(psy.planExpiresAt) > new Date()) {
        return { label: 'TRIAL ⏳', bg: '#e0f2fe', text: '#0369a1' };
      }
      return { label: 'ATIVO ✅', bg: '#dcfce7', text: '#166534' };
    }
    if (psy.status === 'pending') {
      return { label: 'INCOMPLETO 📝', bg: '#fef9c3', text: '#854d0e' };
    }
    return { label: 'EXPIRADO ⚠️', bg: '#fee2e2', text: '#991b1b' };
  }, [psy]);

  // Ações de CS
  const handleToggleVip = async () => {
    if (!psy) return;
    const isCurrentlyVip = psy.is_exempt;
    Alert.alert(
      isCurrentlyVip ? 'Remover Isenção VIP' : 'Conceder Isenção VIP',
      isCurrentlyVip
        ? `Deseja revogar a isenção VIP de ${psy.nome}?`
        : `Deseja conceder isenção VIP vitalícia para ${psy.nome}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              setActionLoading(true);
              await api.patch(`/api/admin/psychologists/${psy.id}/vip`, {
                plan: isCurrentlyVip ? null : 'CLINICAL',
              });
              Alert.alert(
                'Sucesso',
                isCurrentlyVip ? 'Isenção VIP removida.' : 'Isenção VIP concedida com sucesso!'
              );
              fetchDetails();
            } catch (e: any) {
              Alert.alert('Erro', e.message || 'Erro ao alterar status VIP.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleExtendTrial = async () => {
    if (!psy) return;
    Alert.alert(
      'Estender Período Grátis',
      `Deseja adicionar 7 dias extras de período grátis para "${psy.nome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Adicionar 7 dias',
          onPress: async () => {
            try {
              setActionLoading(true);
              await api.post(`/api/admin/psychologists/${psy.id}/extend-trial`, { days: 7 });
              Alert.alert('Sucesso', 'Período grátis estendido em 7 dias com sucesso!');
              fetchDetails();
            } catch (e: any) {
              Alert.alert('Erro', e.message || 'Erro ao estender período.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleExpireProfile = async () => {
    if (!psy) return;
    Alert.alert(
      'Expirar Perfil',
      `Tem certeza que deseja marcar o perfil de "${psy.nome}" como INATIVO (Expirado)?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Expirar',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              await api.put(`/api/admin/psychologists/${psy.id}/status`, { status: 'inactive' });
              Alert.alert('Sucesso', 'Perfil marcado como inativo.');
              fetchDetails();
            } catch (e: any) {
              Alert.alert('Erro', e.message || 'Erro ao expirar perfil.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleCallWhatsapp = () => {
    if (!psy?.telefone) {
      Alert.alert('Aviso', 'Este psicólogo não possui telefone cadastrado.');
      return;
    }
    const tel = String(psy.telefone).replace(/\D/g, '');
    const firstName = psy.nome ? psy.nome.split(' ')[0] : 'Psicólogo(a)';
    const msg = `Olá, ${firstName}! Tudo bem? Aqui é o Anderson, da equipe Yelo. 🌿 Vi seu perfil aqui na plataforma e gostaria de conversar com você.`;
    Linking.openURL(`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`);
  };

  if (loading) {
    return (
      <View className="flex-1 bg-[#f8fafc] justify-center items-center p-6">
        <ActivityIndicator size="large" color="#1B4332" />
        <Text className="font-sans text-[#64748b] text-[15px] mt-4">
          Carregando dossiê completo...
        </Text>
      </View>
    );
  }

  if (!psy) {
    return (
      <View className="flex-1 bg-[#f8fafc] justify-center items-center p-6">
        <Feather name="alert-circle" size={44} color="#94a3b8" />
        <Text className="font-title text-[#1e293b] text-[18px] font-bold mt-3">
          Psicólogo não encontrado
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-5 bg-[#1B4332] px-6 py-2.5 rounded-full"
        >
          <Text className="text-white font-sans font-bold text-[14px]">Voltar para Lista</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#f8fafc]">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1B4332']} />
        }
      >
        {/* ========================================================= */}
        {/* 1. CABEÇALHO DO PERFIL                                   */}
        {/* ========================================================= */}
        <View className="bg-white border-b border-slate-200">
          {/* Top Banner Cover */}
          <View className="h-[90px] bg-[#1B4332] justify-between p-4 flex-row items-start">
            <View className="flex-row items-center gap-2">
              <View className="bg-white/20 px-2.5 py-1 rounded-full">
                <Text className="text-white text-[11px] font-bold uppercase tracking-wider">
                  Dossiê 360º
                </Text>
              </View>
            </View>

            {psy.slug ? (
              <TouchableOpacity
                onPress={() =>
                  Linking.openURL(`https://www.yelopsi.com.br/psicologo/${psy.slug}`)
                }
                className="bg-white/20 px-3 py-1.5 rounded-full flex-row items-center gap-1.5"
              >
                <Feather name="external-link" size={13} color="#fff" />
                <Text className="text-white font-sans text-[12px] font-bold">Ver Perfil</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Main info card */}
          <View className="px-4 pb-4">
            <View className="flex-row items-end -mt-[38px] mb-3 gap-3">
              {psy.fotoUrl ? (
                <Image
                  source={{ uri: psy.fotoUrl }}
                  className="w-[74px] h-[74px] rounded-full border-4 border-white bg-slate-100"
                  resizeMode="cover"
                />
              ) : (
                <View className="w-[74px] h-[74px] rounded-full border-4 border-white bg-[#ecfdf5] items-center justify-center">
                  <Text className="font-title text-[#166534] text-[28px] font-bold">
                    {(psy.nome || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}

              <View className="flex-1 pb-1">
                <Text className="font-title text-[#1e293b] text-[20px] font-bold leading-tight">
                  {psy.nome || 'Sem Nome'}
                </Text>
                <Text className="font-sans text-[#64748b] text-[13px] mt-0.5">
                  CRP: {psy.crp || 'Não informado'}
                </Text>
              </View>
            </View>

            {/* Badges de Status e Plano */}
            <View className="flex-row flex-wrap gap-2 mb-3">
              <View
                style={{ backgroundColor: statusBadge.bg }}
                className="px-3 py-1 rounded-full border border-black/5"
              >
                <Text
                  style={{ color: statusBadge.text }}
                  className="font-sans font-bold text-[12px]"
                >
                  {statusBadge.label}
                </Text>
              </View>

              <View className="bg-[#f1f5f9] px-3 py-1 rounded-full border border-slate-200">
                <Text className="font-sans text-[#334155] font-semibold text-[12px]">
                  Plano: {psy.plano || 'Nenhum'} {psy.is_exempt ? '(VIP)' : ''}
                </Text>
              </View>
            </View>

            {/* Informações de contato */}
            <View className="bg-[#f8fafc] rounded-xl p-3 border border-slate-200 gap-2">
              <View className="flex-row items-center justify-between">
                <Text className="font-sans text-[#64748b] text-[12px]">Email</Text>
                <Text className="font-sans text-[#1e293b] font-medium text-[13px]">
                  {psy.email || '-'}
                </Text>
              </View>

              <View className="flex-row items-center justify-between">
                <Text className="font-sans text-[#64748b] text-[12px]">Telefone</Text>
                {psy.telefone ? (
                  <TouchableOpacity
                    onPress={handleCallWhatsapp}
                    className="flex-row items-center gap-1"
                  >
                    <Text className="font-sans text-[#0369a1] font-bold text-[13px]">
                      {psy.telefone}
                    </Text>
                    <Feather name="message-circle" size={13} color="#0369a1" />
                  </TouchableOpacity>
                ) : (
                  <Text className="font-sans text-[#94a3b8] text-[13px]">-</Text>
                )}
              </View>

              <View className="flex-row items-center justify-between">
                <Text className="font-sans text-[#64748b] text-[12px]">Cidade/UF</Text>
                <Text className="font-sans text-[#1e293b] font-medium text-[13px]">
                  {psy.cidade ? `${psy.cidade} - ${psy.estado || ''}` : 'Não informado'}
                </Text>
              </View>

              <View className="flex-row items-center justify-between">
                <Text className="font-sans text-[#64748b] text-[12px]">Cadastro</Text>
                <Text className="font-sans text-[#1e293b] font-medium text-[13px]">
                  {formatDateBR(psy.createdAt)}
                </Text>
              </View>

              <View className="flex-row items-center justify-between">
                <Text className="font-sans text-[#64748b] text-[12px]">Vencimento</Text>
                {psy.is_exempt ? (
                  <Text className="font-sans text-[#ca8a04] font-bold text-[13px]">
                    Isento (VIP)
                  </Text>
                ) : psy.planExpiresAt ? (
                  <Text
                    className={`font-sans font-bold text-[13px] ${
                      expiryInfo?.isExpired ? 'text-[#dc2626]' : 'text-[#166534]'
                    }`}
                  >
                    {formatDateBR(psy.planExpiresAt)}{' '}
                    {expiryInfo ? `(${expiryInfo.text})` : ''}
                  </Text>
                ) : (
                  <Text className="font-sans text-[#94a3b8] text-[13px]">Sem assinatura</Text>
                )}
              </View>
            </View>

            {/* Aquisição / UTMs */}
            <View className="mt-3 bg-white border border-slate-200 rounded-xl p-3">
              <View className="flex-row items-center gap-1.5 mb-2">
                <Feather name="target" size={13} color="#64748b" />
                <Text className="font-sans font-bold text-[#475569] text-[11px] uppercase tracking-wider">
                  Aquisição (UTMs)
                </Text>
              </View>
              <View className="flex-row flex-wrap gap-1.5">
                <View className="bg-[#f8fafc] border border-slate-200 rounded-full px-2.5 py-1 flex-row items-center gap-1">
                  <Text className="text-[11px] text-[#94a3b8] uppercase font-bold">Src:</Text>
                  <Text className="text-[11px] text-[#0f172a] font-semibold">
                    {psy.utm_source || 'Orgânico'}
                  </Text>
                </View>
                <View className="bg-[#f8fafc] border border-slate-200 rounded-full px-2.5 py-1 flex-row items-center gap-1">
                  <Text className="text-[11px] text-[#94a3b8] uppercase font-bold">Med:</Text>
                  <Text className="text-[11px] text-[#0f172a] font-semibold">
                    {psy.utm_medium || '-'}
                  </Text>
                </View>
                <View className="bg-[#f8fafc] border border-slate-200 rounded-full px-2.5 py-1 flex-row items-center gap-1">
                  <Text className="text-[11px] text-[#94a3b8] uppercase font-bold">Camp:</Text>
                  <Text className="text-[11px] text-[#0f172a] font-semibold">
                    {psy.utm_campaign || '-'}
                  </Text>
                </View>
                <View className="bg-[#f8fafc] border border-slate-200 rounded-full px-2.5 py-1 flex-row items-center gap-1">
                  <Text className="text-[11px] text-[#94a3b8] uppercase font-bold">Cont:</Text>
                  <Text className="text-[11px] text-[#0f172a] font-semibold">
                    {psy.utm_content || '-'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ========================================================= */}
        {/* 2. STATS GRID (6 INDICADORES)                            */}
        {/* ========================================================= */}
        <View className="p-4">
          <Text className="font-title text-[#1e293b] text-[15px] font-bold mb-2.5">
            Métricas de Desempenho
          </Text>
          <View className="flex-row flex-wrap gap-2.5">
            <View className="flex-1 min-w-[100px] bg-white p-3 rounded-xl border border-slate-200">
              <Text className="font-sans text-[#64748b] text-[11px] uppercase font-semibold">
                Visualizações
              </Text>
              <Text className="font-title text-[#0f172a] text-[20px] font-bold mt-1">
                {stats.profileViews || 0}
              </Text>
            </View>

            <View className="flex-1 min-w-[100px] bg-white p-3 rounded-xl border border-slate-200">
              <Text className="font-sans text-[#64748b] text-[11px] uppercase font-semibold">
                Matches
              </Text>
              <Text className="font-title text-[#0f172a] text-[20px] font-bold mt-1">
                {stats.matches || 0}
              </Text>
            </View>

            <View className="flex-1 min-w-[100px] bg-white p-3 rounded-xl border border-slate-200">
              <Text className="font-sans text-[#64748b] text-[11px] uppercase font-semibold">
                Cliques WPP
              </Text>
              <Text className="font-title text-[#0f172a] text-[20px] font-bold mt-1">
                {stats.whatsappClicks || 0}
              </Text>
            </View>
          </View>

          <View className="flex-row flex-wrap gap-2.5 mt-2.5">
            <View className="flex-1 min-w-[100px] bg-white p-3 rounded-xl border border-slate-200">
              <Text className="font-sans text-[#64748b] text-[11px] uppercase font-semibold">
                Conversão PLG
              </Text>
              <Text className="font-title text-[#166534] text-[20px] font-bold mt-1">
                {plgAgendados}
              </Text>
            </View>

            <View className="flex-1 min-w-[100px] bg-white p-3 rounded-xl border border-slate-200">
              <Text className="font-sans text-[#64748b] text-[11px] uppercase font-semibold">
                Blog
              </Text>
              <Text className="font-title text-[#0f172a] text-[20px] font-bold mt-1">
                {blogPosts.length}
              </Text>
            </View>

            <View className="flex-1 min-w-[100px] bg-white p-3 rounded-xl border border-slate-200">
              <Text className="font-sans text-[#64748b] text-[11px] uppercase font-semibold">
                Fórum
              </Text>
              <Text className="font-title text-[#0f172a] text-[20px] font-bold mt-1">
                {stats.forumActivities || forumPosts.length + forumComments.length}
              </Text>
            </View>
          </View>
        </View>

        {/* ========================================================= */}
        {/* 3. NAVEGAÇÃO DE ABAS                                      */}
        {/* ========================================================= */}
        <View className="px-4 mb-3">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
            {[
              { key: 'timeline', label: 'Linha do Tempo', icon: 'clock', count: timelineEvents.length },
              { key: 'payments', label: 'Pagamentos', icon: 'credit-card', count: payments.length },
              { key: 'whatsapp', label: 'WhatsApp', icon: 'message-circle', count: whatsappLogs.length },
              { key: 'reviews', label: 'Avaliações', icon: 'star', count: reviews.length },
              { key: 'blog', label: 'Artigos', icon: 'file-text', count: blogPosts.length },
              { key: 'forum', label: 'Fórum', icon: 'message-square', count: forumPosts.length + forumComments.length },
            ].map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key as TabKey)}
                  className={`flex-row items-center px-4 py-2.5 rounded-full border ${
                    isActive
                      ? 'bg-[#1B4332] border-[#1B4332]'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <Feather
                    name={tab.icon as any}
                    size={14}
                    color={isActive ? '#fff' : '#64748b'}
                  />
                  <Text
                    className={`font-sans font-bold text-[13px] ml-1.5 ${
                      isActive ? 'text-white' : 'text-[#64748b]'
                    }`}
                  >
                    {tab.label}
                  </Text>
                  {tab.count > 0 && (
                    <View
                      className={`ml-1.5 px-1.5 py-0.5 rounded-full ${
                        isActive ? 'bg-white/20' : 'bg-slate-100'
                      }`}
                    >
                      <Text
                        className={`font-sans text-[11px] font-bold ${
                          isActive ? 'text-white' : 'text-[#64748b]'
                        }`}
                      >
                        {tab.count}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ========================================================= */}
        {/* 4. CONTEÚDO DAS ABAS                                      */}
        {/* ========================================================= */}
        <View className="px-4">
          {/* TAB 1: LINHA DO TEMPO */}
          {activeTab === 'timeline' && (
            <View className="bg-white rounded-2xl p-4 border border-slate-200">
              <Text className="font-title text-[#1e293b] text-[16px] font-bold mb-3">
                Histórico Recente de Atividades
              </Text>

              {timelineEvents.length === 0 ? (
                <Text className="font-sans text-[#94a3b8] text-[13px] text-center py-6">
                  Nenhuma atividade recente registrada.
                </Text>
              ) : (
                <View className="gap-3">
                  {timelineEvents.slice(0, 20).map((evt, idx) => {
                    let icon = 'activity';
                    let iconColor = '#0284c7';
                    let iconBg = '#e0f2fe';
                    let title = 'Atividade';
                    let desc = '';

                    switch (evt.type) {
                      case 'blog':
                        icon = 'file-text';
                        iconColor = '#166534';
                        iconBg = '#dcfce7';
                        title = 'Publicou Artigo no Blog';
                        desc = evt.data.titulo || evt.data.title || 'Artigo sem título';
                        break;
                      case 'forum_post':
                        icon = 'message-circle';
                        iconColor = '#7c3aed';
                        iconBg = '#f3e8ff';
                        title = 'Criou Tópico no Fórum';
                        desc = evt.data.title || 'Sem título';
                        break;
                      case 'forum_comment':
                        icon = 'corner-down-right';
                        iconColor = '#9333ea';
                        iconBg = '#faf5ff';
                        title = 'Respondeu no Fórum';
                        desc = evt.data.postTitle ? `Em: ${evt.data.postTitle}` : 'Comentário';
                        break;
                      case 'review':
                        icon = 'star';
                        iconColor = '#ca8a04';
                        iconBg = '#fef3c7';
                        title = 'Recebeu Avaliação';
                        desc = `Nota: ${evt.data.rating || evt.data.nota || 5} estrelas`;
                        break;
                      case 'match':
                        icon = 'target';
                        iconColor = '#059669';
                        iconBg = '#ecfdf5';
                        title = 'Apareceu em Busca (Match)';
                        desc = evt.data.matchTags
                          ? `Tags: ${
                              Array.isArray(evt.data.matchTags)
                                ? evt.data.matchTags.join(', ')
                                : evt.data.matchTags
                            }`
                          : 'Match realizado';
                        break;
                    }

                    return (
                      <View
                        key={idx}
                        className="flex-row items-start gap-3 pb-3 border-b border-slate-100 last:border-b-0"
                      >
                        <View
                          style={{ backgroundColor: iconBg }}
                          className="w-8 h-8 rounded-full items-center justify-center mt-0.5"
                        >
                          <Feather name={icon as any} size={15} color={iconColor} />
                        </View>
                        <View className="flex-1">
                          <View className="flex-row items-center justify-between">
                            <Text className="font-sans font-bold text-[#1e293b] text-[13px]">
                              {title}
                            </Text>
                            <Text className="font-sans text-[#94a3b8] text-[11px]">
                              {formatDateTimeBR(evt.date)}
                            </Text>
                          </View>
                          <Text
                            className="font-sans text-[#64748b] text-[12px] mt-0.5"
                            numberOfLines={2}
                          >
                            {desc}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* TAB 2: PAGAMENTOS */}
          {activeTab === 'payments' && (
            <View className="gap-3">
              {/* Banner de status da assinatura */}
              {psy.is_exempt ? (
                <View className="bg-[#fefce8] border border-[#fde047] p-4 rounded-2xl">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Feather name="star" size={16} color="#854d0e" />
                    <Text className="font-title text-[#854d0e] text-[15px] font-bold">
                      Conta Isenta (VIP)
                    </Text>
                  </View>
                  <Text className="font-sans text-[#854d0e] text-[13px] leading-5">
                    Este profissional possui isenção permanente de mensalidade autorizada pela
                    administração da Yelo. Não são emitidas faturas recorrentes no gateway.
                  </Text>
                </View>
              ) : psy.cancelAtPeriodEnd || psy.canceledAt ? (
                <View className="bg-[#fef2f2] border border-[#fca5a5] p-4 rounded-2xl">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Feather name="slash" size={16} color="#991b1b" />
                    <Text className="font-title text-[#991b1b] text-[15px] font-bold">
                      Renovação Automática Cancelada
                    </Text>
                  </View>
                  <Text className="font-sans text-[#991b1b] text-[13px] leading-5">
                    {expiryInfo?.isExpired
                      ? `O psicólogo solicitou o cancelamento e o período de acesso pago foi encerrado em ${formatDateBR(
                          psy.planExpiresAt
                        )}.`
                      : `O psicólogo cancelou a renovação. Seu plano permanecerá ativo até ${formatDateBR(
                          psy.planExpiresAt
                        )} (${expiryInfo?.text}).`}
                  </Text>
                </View>
              ) : (psy.subscriptionId || asaasSub?.id) && psy.status === 'active' ? (
                <View className="bg-[#f0fdf4] border border-[#86efac] p-4 rounded-2xl">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Feather name="repeat" size={16} color="#166534" />
                    <Text className="font-title text-[#166534] text-[15px] font-bold">
                      Assinatura Recorrente Ativa
                    </Text>
                  </View>
                  <Text className="font-sans text-[#166534] text-[13px] leading-5">
                    Próxima renovação automática programada para {formatDateBR(psy.planExpiresAt || asaasSub?.nextDueDate)}{' '}
                    {expiryInfo ? `(${expiryInfo.text})` : ''}.
                  </Text>
                </View>
              ) : !psy.subscriptionId && psy.planExpiresAt && (!expiryInfo || !expiryInfo.isExpired) ? (
                <View className="bg-[#f0f9ff] border border-[#7dd3fc] p-4 rounded-2xl">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Feather name="clock" size={16} color="#0369a1" />
                    <Text className="font-title text-[#0369a1] text-[15px] font-bold">
                      Período de Degustação Gratuita (Trial)
                    </Text>
                  </View>
                  <Text className="font-sans text-[#0369a1] text-[13px] leading-5">
                    O psicólogo está testando a plataforma gratuitamente até {formatDateBR(psy.planExpiresAt)}{' '}
                    {expiryInfo ? `(${expiryInfo.text})` : ''}.
                  </Text>
                </View>
              ) : (
                <View className="bg-[#fffbeb] border border-[#fde68a] p-4 rounded-2xl">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Feather name="alert-triangle" size={16} color="#92400e" />
                    <Text className="font-title text-[#92400e] text-[15px] font-bold">
                      Sem Assinatura Ativa
                    </Text>
                  </View>
                  <Text className="font-sans text-[#92400e] text-[13px] leading-5">
                    O perfil não possui assinatura corrente ativa.
                  </Text>
                </View>
              )}

              {/* Alerta de Falha no Gateway (se houver) */}
              {data?.asaasFailedReason ? (
                <View className="bg-[#fef2f2] border border-[#fca5a5] p-4 rounded-2xl">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Feather name="alert-octagon" size={16} color="#b91c1c" />
                    <Text className="font-title text-[#b91c1c] text-[14px] font-bold">
                      Alerta Gateway: Última Cobrança Falhou
                    </Text>
                  </View>
                  <Text className="font-sans text-[#991b1b] font-medium text-[12px]">
                    Motivo: {data.asaasFailedReason}
                  </Text>
                </View>
              ) : null}

              {/* KPI Cards de Pagamento */}
              <View className="bg-white rounded-2xl p-4 border border-slate-200 gap-3">
                <Text className="font-title text-[#1e293b] text-[15px] font-bold mb-1">
                  Resumo Financeiro
                </Text>

                <View className="flex-row justify-between py-2 border-b border-slate-100">
                  <Text className="font-sans text-[#64748b] text-[13px]">Plano Contratado</Text>
                  <Text className="font-sans font-bold text-[#1e293b] text-[13px]">
                    {psy.plano || 'Sem Plano'}
                  </Text>
                </View>

                <View className="flex-row justify-between py-2 border-b border-slate-100">
                  <Text className="font-sans text-[#64748b] text-[13px]">Vencimento do Acesso</Text>
                  <Text className="font-sans font-bold text-[#1e293b] text-[13px]">
                    {formatDateBR(psy.planExpiresAt || asaasSub?.nextDueDate)}
                  </Text>
                </View>

                <View className="flex-row justify-between py-2 border-b border-slate-100">
                  <Text className="font-sans text-[#64748b] text-[13px]">ID Asaas (Assinatura)</Text>
                  <Text className="font-sans text-[#1e293b] text-[12px] font-mono">
                    {psy.subscriptionId || asaasSub?.id || '-'}
                  </Text>
                </View>

                <View className="flex-row justify-between py-2 border-b border-slate-100">
                  <Text className="font-sans text-[#64748b] text-[13px]">Mensalidades Pagas</Text>
                  <Text className="font-sans font-bold text-[#1e293b] text-[13px]">
                    {psy.subscription_payments_count || payments.filter((p: any) => p.status === 'RECEIVED' || p.status === 'CONFIRMED').length} meses
                  </Text>
                </View>

                <View className="flex-row justify-between py-2">
                  <Text className="font-sans text-[#64748b] text-[13px]">Receita Total (LTV)</Text>
                  <Text className="font-title text-[#166534] font-bold text-[15px]">
                    {formatCurrency(psy.lifetimeRevenue || 0)}
                  </Text>
                </View>
              </View>

              {/* Lista de Faturas */}
              <View className="bg-white rounded-2xl p-4 border border-slate-200">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="font-title text-[#1e293b] text-[15px] font-bold">
                    Histórico de Faturas
                  </Text>
                  <View className="bg-slate-100 px-2.5 py-0.5 rounded-full">
                    <Text className="font-sans text-[#475569] text-[11px] font-bold">
                      {payments.length} {payments.length === 1 ? 'fatura' : 'faturas'}
                    </Text>
                  </View>
                </View>

                {payments.length === 0 ? (
                  <Text className="font-sans text-[#94a3b8] text-[13px] text-center py-6">
                    Nenhuma fatura registrada no gateway.
                  </Text>
                ) : (
                  <View className="gap-3">
                    {payments.map((pm: any, i: number) => {
                      const isPaid = ['RECEIVED', 'CONFIRMED', 'PAID'].includes(
                        String(pm.status || '').toUpperCase()
                      );
                      const isOverdue = ['OVERDUE', 'FAILED'].includes(
                        String(pm.status || '').toUpperCase()
                      );

                      return (
                        <View
                          key={i}
                          className="p-3 bg-[#f8fafc] rounded-xl border border-slate-200"
                        >
                          <View className="flex-row justify-between items-start">
                            <View className="flex-1 mr-2">
                              <Text className="font-sans font-bold text-[#1e293b] text-[13px]">
                                {pm.description || 'Fatura Yelo'}
                              </Text>
                              <Text className="font-sans text-[#64748b] text-[11px] mt-0.5">
                                Venc: {formatDateBR(pm.dueDate)} | Pag: {formatDateBR(pm.paymentDate)}
                              </Text>
                            </View>

                            <View className="items-end">
                              <Text className="font-title font-bold text-[#0f172a] text-[14px]">
                                {formatCurrency(pm.value)}
                              </Text>
                              <View
                                className={`px-2 py-0.5 rounded-full mt-1 ${
                                  isPaid
                                    ? 'bg-[#dcfce7]'
                                    : isOverdue
                                    ? 'bg-[#fee2e2]'
                                    : 'bg-[#fef9c3]'
                                }`}
                              >
                                <Text
                                  className={`font-sans text-[10px] font-bold ${
                                    isPaid
                                      ? 'text-[#166534]'
                                      : isOverdue
                                      ? 'text-[#991b1b]'
                                      : 'text-[#854d0e]'
                                  }`}
                                >
                                  {isPaid ? 'PAGO' : isOverdue ? 'ATRASADO' : 'PENDENTE'}
                                </Text>
                              </View>
                            </View>
                          </View>

                          {(pm.invoiceUrl || pm.bankSlipUrl) && (
                            <TouchableOpacity
                              onPress={() => Linking.openURL(pm.invoiceUrl || pm.bankSlipUrl)}
                              className="mt-2 pt-2 border-t border-slate-200 flex-row items-center gap-1"
                            >
                              <Feather name="external-link" size={12} color="#0369a1" />
                              <Text className="font-sans font-bold text-[#0369a1] text-[11px]">
                                Ver no Gateway Asaas
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* TAB 3: LEADS WHATSAPP */}
          {activeTab === 'whatsapp' && (
            <View className="bg-white rounded-2xl p-4 border border-slate-200">
              <Text className="font-title text-[#1e293b] text-[15px] font-bold mb-3">
                Cliques e Contatos de Pacientes
              </Text>

              {whatsappLogs.length === 0 ? (
                <Text className="font-sans text-[#94a3b8] text-[13px] text-center py-6">
                  Nenhum clique de WhatsApp registrado ainda.
                </Text>
              ) : (
                <View className="gap-2.5">
                  {whatsappLogs.map((log: any, i: number) => {
                    let dealBadge = { label: 'Sem feedback', bg: '#f1f5f9', text: '#475569' };
                    if (log.feedbackGiven) {
                      if (['yes', 'started'].includes(log.dealClosed)) {
                        dealBadge = { label: '✅ Agendou', bg: '#dcfce7', text: '#166534' };
                      } else if (log.dealClosed === 'talking') {
                        dealBadge = { label: '⏳ Em negociação', bg: '#ffedd5', text: '#c2410c' };
                      } else if (['no', 'not_started', 'ghosted'].includes(log.dealClosed)) {
                        dealBadge = { label: '💬 Não Agendou', bg: '#fef9c3', text: '#854d0e' };
                      } else {
                        dealBadge = { label: '❌ Não Contatou', bg: '#fee2e2', text: '#991b1b' };
                      }
                    }

                    return (
                      <View
                        key={i}
                        className="p-3 bg-[#f8fafc] rounded-xl border border-slate-200 flex-row items-center justify-between"
                      >
                        <View className="flex-1 mr-2">
                          <View className="flex-row items-center gap-1.5 flex-wrap">
                            <Text className="font-sans font-bold text-[#1e293b] text-[13px]">
                              {log.guestName || 'Anônimo / Não informado'}
                            </Text>
                            <View
                              style={{ backgroundColor: dealBadge.bg }}
                              className="px-2 py-0.5 rounded-full"
                            >
                              <Text
                                style={{ color: dealBadge.text }}
                                className="font-sans font-bold text-[10px]"
                              >
                                {dealBadge.label}
                              </Text>
                            </View>
                          </View>
                          <Text className="font-sans text-[#94a3b8] text-[11px] mt-1">
                            {formatDateTimeBR(log.createdAt)}
                          </Text>
                        </View>

                        {log.guestPhone ? (
                          <TouchableOpacity
                            onPress={() => {
                              const p = String(log.guestPhone).replace(/\D/g, '');
                              Linking.openURL(`https://wa.me/55${p}`);
                            }}
                            className="bg-[#10b981] px-3 py-1.5 rounded-full flex-row items-center gap-1"
                          >
                            <Feather name="message-circle" size={12} color="#fff" />
                            <Text className="font-sans font-bold text-white text-[11px]">
                              WhatsApp
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* TAB 4: AVALIAÇÕES */}
          {activeTab === 'reviews' && (
            <View className="bg-white rounded-2xl p-4 border border-slate-200">
              <Text className="font-title text-[#1e293b] text-[15px] font-bold mb-3">
                Avaliações de Pacientes
              </Text>

              {reviews.length === 0 ? (
                <Text className="font-sans text-[#94a3b8] text-[13px] text-center py-6">
                  Nenhuma avaliação registrada ainda.
                </Text>
              ) : (
                <View className="gap-3">
                  {reviews.map((rev: any, i: number) => {
                    const stars = Math.min(5, Math.max(1, rev.rating || rev.nota || 5));
                    return (
                      <View
                        key={i}
                        className="p-3 bg-[#f8fafc] rounded-xl border border-slate-200"
                      >
                        <View className="flex-row items-center gap-1 mb-1.5">
                          {Array.from({ length: 5 }).map((_, s) => (
                            <Feather
                              key={s}
                              name="star"
                              size={13}
                              color={s < stars ? '#eab308' : '#cbd5e1'}
                            />
                          ))}
                        </View>
                        <Text className="font-sans text-[#334155] text-[13px] italic">
                          "{rev.comment || rev.comentario || 'Sem comentário'}"
                        </Text>
                        <Text className="font-sans text-[#94a3b8] text-[11px] mt-2">
                          Por: {rev.patient?.nome || rev.autor || 'Paciente Anônimo'} em{' '}
                          {formatDateBR(rev.createdAt)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* TAB 5: BLOG */}
          {activeTab === 'blog' && (
            <View className="bg-white rounded-2xl p-4 border border-slate-200">
              <Text className="font-title text-[#1e293b] text-[15px] font-bold mb-3">
                Artigos Publicados no Blog
              </Text>

              {blogPosts.length === 0 ? (
                <Text className="font-sans text-[#94a3b8] text-[13px] text-center py-6">
                  Nenhum artigo publicado pelo psicólogo.
                </Text>
              ) : (
                <View className="gap-3">
                  {blogPosts.map((post: any, i: number) => (
                    <View
                      key={i}
                      className="p-3 bg-[#f8fafc] rounded-xl border border-slate-200"
                    >
                      <Text className="font-title font-bold text-[#1e293b] text-[14px]">
                        {post.titulo || post.title || 'Artigo'}
                      </Text>
                      <Text className="font-sans text-[#64748b] text-[11px] mt-1">
                        Publicado em {formatDateBR(post.createdAt || post.created_at)}
                      </Text>
                      {(post.slug || post.id) && (
                        <TouchableOpacity
                          onPress={() =>
                            Linking.openURL(
                              `https://www.yelopsi.com.br/blog/post/${post.slug || post.id}`
                            )
                          }
                          className="mt-2 pt-2 border-t border-slate-200 flex-row items-center gap-1"
                        >
                          <Feather name="external-link" size={12} color="#166534" />
                          <Text className="font-sans font-bold text-[#166534] text-[11px]">
                            Ver Post no Portal
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* TAB 6: FÓRUM */}
          {activeTab === 'forum' && (
            <View className="bg-white rounded-2xl p-4 border border-slate-200">
              <Text className="font-title text-[#1e293b] text-[15px] font-bold mb-3">
                Interações no Fórum da Comunidade
              </Text>

              {forumPosts.length === 0 && forumComments.length === 0 ? (
                <Text className="font-sans text-[#94a3b8] text-[13px] text-center py-6">
                  Nenhuma postagem ou resposta no fórum.
                </Text>
              ) : (
                <View className="gap-3">
                  {forumPosts.map((post: any, i: number) => (
                    <View
                      key={`post-${i}`}
                      className="p-3 bg-[#f8fafc] rounded-xl border border-slate-200"
                    >
                      <View className="flex-row items-center gap-1.5 mb-1">
                        <Feather name="message-circle" size={13} color="#7c3aed" />
                        <Text className="font-sans text-[11px] font-bold text-[#7c3aed] uppercase">
                          Tópico Criado
                        </Text>
                      </View>
                      <Text className="font-title font-bold text-[#1e293b] text-[14px]">
                        {post.title}
                      </Text>
                      <Text
                        className="font-sans text-[#64748b] text-[12px] mt-1"
                        numberOfLines={2}
                      >
                        {post.content || ''}
                      </Text>
                      <Text className="font-sans text-[#94a3b8] text-[11px] mt-2">
                        {formatDateBR(post.createdAt)}
                      </Text>
                    </View>
                  ))}

                  {forumComments.map((comment: any, i: number) => (
                    <View
                      key={`comm-${i}`}
                      className="p-3 bg-[#f8fafc] rounded-xl border border-slate-200"
                    >
                      <View className="flex-row items-center gap-1.5 mb-1">
                        <Feather name="corner-down-right" size={13} color="#9333ea" />
                        <Text className="font-sans text-[11px] font-bold text-[#9333ea] uppercase">
                          Resposta em: {comment.postTitle || 'Tópico'}
                        </Text>
                      </View>
                      <Text
                        className="font-sans text-[#475569] text-[12px] mt-0.5"
                        numberOfLines={2}
                      >
                        {comment.content || ''}
                      </Text>
                      <Text className="font-sans text-[#94a3b8] text-[11px] mt-2">
                        {formatDateBR(comment.createdAt)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>

        {/* ========================================================= */}
        {/* 5. AÇÕES RÁPIDAS DE CS NO RODAPÉ DO DOSSIÊ                */}
        {/* ========================================================= */}
        <View className="px-4 mt-6">
          <View className="bg-white p-4 rounded-2xl border border-slate-200 gap-2.5">
            <Text className="font-title text-[#1e293b] text-[15px] font-bold mb-1">
              Ações Rápidas de CS
            </Text>

            {/* Chamar no WhatsApp */}
            <TouchableOpacity
              onPress={handleCallWhatsapp}
              className="bg-[#e0f2fe] border border-[#bae6fd] py-3 rounded-full flex-row items-center justify-center gap-2"
            >
              <Feather name="message-circle" size={16} color="#0369a1" />
              <Text className="font-sans font-bold text-[#0369a1] text-[14px]">
                Chamar no WhatsApp 📱
              </Text>
            </TouchableOpacity>

            {/* Estender Período Grátis */}
            <TouchableOpacity
              onPress={handleExtendTrial}
              className="bg-[#f0fdf4] border border-[#bbf7d0] py-3 rounded-full flex-row items-center justify-center gap-2"
            >
              <Feather name="gift" size={16} color="#166534" />
              <Text className="font-sans font-bold text-[#166534] text-[14px]">
                Estender Período Grátis 🎁
              </Text>
            </TouchableOpacity>

            {/* Conceder / Remover Isenção VIP */}
            <TouchableOpacity
              onPress={handleToggleVip}
              className="bg-[#f0fdf4] border border-[#bbf7d0] py-3 rounded-full flex-row items-center justify-center gap-2"
            >
              <Feather name="star" size={16} color="#166534" />
              <Text className="font-sans font-bold text-[#166534] text-[14px]">
                {psy.is_exempt ? 'Remover Isenção VIP' : 'Conceder Isenção VIP ⭐'}
              </Text>
            </TouchableOpacity>

            {/* Expirar Perfil */}
            <TouchableOpacity
              onPress={handleExpireProfile}
              className="bg-[#fef2f2] border border-[#fecaca] py-3 rounded-full flex-row items-center justify-center gap-2"
            >
              <Feather name="alert-circle" size={16} color="#991b1b" />
              <Text className="font-sans font-bold text-[#991b1b] text-[14px]">
                Expirar Perfil (Inativo) ⚠️
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
