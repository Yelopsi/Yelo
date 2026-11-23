import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import api from '../../../services/api';
import NativeSelectMenu, { type NativeSelectOption } from '../../../components/NativeSelectMenu';

// -------------------------------------------------------------
// Formatadores e Utilitários
// -------------------------------------------------------------
function formatDateBR(dateString?: string | null): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('pt-BR');
  } catch {
    return '-';
  }
}

function formatDateTimeBR(dateString?: string | null): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '-';
    return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return '-';
  }
}

function formatCurrency(val?: number | string | null): string {
  if (val === undefined || val === null || val === '') return 'R$ 0,00';
  const num = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : val;
  if (isNaN(num)) return 'R$ 0,00';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function mascaraTelefone(tel?: string | null): string {
  if (!tel) return '';
  const r = tel.replace(/\D/g, '');
  if (r.length === 11) return r.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
  if (r.length === 10) return r.replace(/^(\d{2})(\d{4})(\d{4}).*/, '($1) $2-$3');
  return tel;
}

function getExpiryCountdown(dateStr?: string | null) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return null;

  const now = new Date();
  target.setHours(23, 59, 59, 999);
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const past = Math.abs(diffDays);
    return {
      isExpired: true,
      days: past,
      text: past === 0 ? 'Expirou hoje' : `Expirado há ${past} dia${past > 1 ? 's' : ''}`,
    };
  }
  if (diffDays === 0) return { isExpired: false, days: 0, text: 'Vence hoje' };
  if (diffDays === 1) return { isExpired: false, days: 1, text: 'Vence amanhã' };
  return { isExpired: false, days: diffDays, text: `Restam ${diffDays} dias` };
}

type TabType = 'timeline' | 'payments' | 'blog' | 'forum' | 'reviews' | 'whatsapp';

export default function AdminDetalhesPsicologoScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; name?: string }>();
  const psyId = params.id;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<TabType>('timeline');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!psyId) {
      Alert.alert('Erro', 'ID do psicólogo não fornecido.');
      router.back();
      return;
    }

    try {
      const res = await api.get(`/api/admin/psychologists/${psyId}/full-details`);
      setData(res.data);
    } catch (err: any) {
      console.error('[AdminDetalhesPsicologo] Erro ao carregar detalhes:', err);
      Alert.alert('Erro', 'Não foi possível carregar o dossiê do psicólogo.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [psyId, router]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDetails();
  }, [fetchDetails]);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await Clipboard.setStringAsync(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (e) {
      console.warn('Falha ao copiar:', e);
    }
  };

  const openWhatsApp = (phone?: string | null, customMsg?: string) => {
    if (!phone) {
      Alert.alert('Aviso', 'Telefone não disponível.');
      return;
    }
    const cleanNumber = phone.replace(/\D/g, '');
    const formatted = cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`;
    const textParam = customMsg ? `?text=${encodeURIComponent(customMsg)}` : '';
    const url = `https://wa.me/${formatted}${textParam}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Erro', 'Não foi possível abrir o WhatsApp.');
    });
  };

  const openExternalUrl = (url?: string | null) => {
    if (!url) return;
    Linking.openURL(url).catch(() => {
      Alert.alert('Erro', 'Não foi possível abrir o link externo.');
    });
  };

  // -------------------------------------------------------------
  // Processamento e Normalização de Dados
  // -------------------------------------------------------------
  const p = data?.psychologist || {};
  const stats = data?.stats || {};
  const sub = data?.subscription || {};
  const asaasSub = data?.asaasSubscription || {};
  const payments = (data?.payments as any[]) || [];
  const blogPosts = (data?.blogPosts as any[]) || [];
  const forumPosts = (data?.forumPosts as any[]) || [];
  const forumComments = (data?.forumComments as any[]) || [];
  const reviews = (data?.reviews as any[]) || [];
  const matches = (data?.matches as any[]) || [];
  const whatsappLogs = (data?.whatsappLogs as any[]) || [];

  // Status Badge Logic
  const statusInfo = useMemo(() => {
    const isExempt = !!p.is_exempt;
    const st = p.status || 'inactive';

    if (st === 'active') {
      if (isExempt) {
        return { label: 'VIP', bg: '#fef9c3', text: '#854d0e', border: '#fde047' };
      }
      if (!p.subscriptionId && p.planExpiresAt && new Date(p.planExpiresAt) > new Date()) {
        return { label: 'TRIAL', bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' };
      }
      return { label: 'ATIVO', bg: '#dcfce7', text: '#166534', border: '#86efac' };
    }
    if (st === 'pending') {
      return { label: 'INCOMPLETO', bg: '#fef3c7', text: '#92400e', border: '#fcd34d' };
    }
    return { label: 'EXPIRADO', bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' };
  }, [p.status, p.is_exempt, p.subscriptionId, p.planExpiresAt]);

  // Conversões PLG
  const conversoesPlg = useMemo(() => {
    return whatsappLogs.filter(
      (l: any) => l.dealClosed === 'yes' || l.dealClosed === 'started'
    ).length;
  }, [whatsappLogs]);

  // Expiry Countdown Info
  const expiryInfo = useMemo(() => {
    return getExpiryCountdown(p.planExpiresAt || asaasSub.nextDueDate);
  }, [p.planExpiresAt, asaasSub.nextDueDate]);

  // Normalização da Linha do Tempo (Timeline)
  const timelineEvents = useMemo(() => {
    const list: Array<{ type: string; date: string; title: string; desc: string; icon: any; color: string; bg: string }> = [];

    blogPosts.forEach((b: any) => {
      list.push({
        type: 'blog',
        date: b.createdAt || b.created_at,
        title: 'Publicou um Artigo',
        desc: b.titulo || 'Sem título',
        icon: 'book-open',
        color: '#2563eb',
        bg: '#eff6ff',
      });
    });

    forumPosts.forEach((fp: any) => {
      list.push({
        type: 'forum_post',
        date: fp.createdAt,
        title: 'Criou Tópico no Fórum',
        desc: fp.title || 'Sem título',
        icon: 'message-circle',
        color: '#7c3aed',
        bg: '#f5f3ff',
      });
    });

    forumComments.forEach((fc: any) => {
      list.push({
        type: 'forum_comment',
        date: fc.createdAt,
        title: 'Respondeu no Fórum',
        desc: `Em: ${fc.postTitle || 'Tópico da comunidade'}`,
        icon: 'corner-down-right',
        color: '#9333ea',
        bg: '#faf5ff',
      });
    });

    reviews.forEach((r: any) => {
      const nota = r.rating || r.nota || 5;
      list.push({
        type: 'review',
        date: r.createdAt,
        title: 'Recebeu Avaliação',
        desc: `Nota: ${nota}★ - ${r.comment ? `"${r.comment.slice(0, 70)}..."` : 'Sem comentário'}`,
        icon: 'star',
        color: '#d97706',
        bg: '#fffbeb',
      });
    });

    matches.slice(0, 15).forEach((m: any) => {
      let tags = 'Geral';
      if (m.matchTags) {
        tags = Array.isArray(m.matchTags) ? m.matchTags.join(', ') : String(m.matchTags);
      }
      list.push({
        type: 'match',
        date: m.createdAt || m.created_at,
        title: 'Apareceu em Busca (Match)',
        desc: `Tags: ${tags}`,
        icon: 'target',
        color: '#16a34a',
        bg: '#f0fdf4',
      });
    });

    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return list;
  }, [blogPosts, forumPosts, forumComments, reviews, matches]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1B4332" />
        <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748b', marginTop: 12, fontSize: 14 }}>
          Carregando dossiê completo...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {/* ------------------------------------------------------------- */}
      {/* TOP BAR / HEADER NATIVO                                        */}
      {/* ------------------------------------------------------------- */}
      <View
        style={{
          backgroundColor: '#1B4332',
          paddingTop: insets.top + 8,
          paddingBottom: 14,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.1)',
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.15)',
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 999,
            gap: 6,
          }}
        >
          <Feather name="arrow-left" size={17} color="#fff" />
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#fff', fontSize: 13 }}>
            Voltar
          </Text>
        </TouchableOpacity>

        <Text
          numberOfLines={1}
          style={{
            fontFamily: 'PlusJakartaSans_700Bold',
            color: '#fff',
            fontSize: 16,
            flex: 1,
            textAlign: 'center',
            marginHorizontal: 10,
          }}
        >
          Dossiê do Profissional
        </Text>

        {p.slug ? (
          <TouchableOpacity
            onPress={() => openExternalUrl(`https://www.yelopsi.com.br/${p.slug}`)}
            activeOpacity={0.7}
            style={{
              backgroundColor: '#f0fdf4',
              paddingHorizontal: 10,
              paddingVertical: 7,
              borderRadius: 999,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Feather name="external-link" size={13} color="#166534" />
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#166534', fontSize: 11 }}>
              Ver Perfil
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 70 }} />
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1B4332']} tintColor="#1B4332" />
        }
      >
        {/* ------------------------------------------------------------- */}
        {/* CARD PRINCIPAL DO PERFIL (Header Info)                       */}
        {/* ------------------------------------------------------------- */}
        <View
          style={{
            backgroundColor: '#ffffff',
            marginHorizontal: 16,
            marginTop: 16,
            borderRadius: 20,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: '#e2e8f0',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          {/* Cover gradient */}
          <LinearGradient
            colors={['#1B4332', '#2D6A4F']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ height: 80, width: '100%' }}
          />

          {/* Main Info */}
          <View style={{ paddingHorizontal: 16, marginTop: -40 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <Image
                source={{
                  uri: p.fotoUrl || 'https://www.yelopsi.com.br/assets/images/icon-192x192.png',
                }}
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  borderWidth: 4,
                  borderColor: '#ffffff',
                  backgroundColor: '#e2e8f0',
                }}
              />

              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
                <View
                  style={{
                    backgroundColor: statusInfo.bg,
                    borderColor: statusInfo.border,
                    borderWidth: 1,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 999,
                  }}
                >
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: statusInfo.text, fontSize: 11 }}>
                    {statusInfo.label}
                  </Text>
                </View>

                <View
                  style={{
                    backgroundColor: '#fef3c7',
                    borderColor: '#fde68a',
                    borderWidth: 1,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 999,
                  }}
                >
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#92400e', fontSize: 11 }}>
                    {p.plano || 'Sem Plano'}{p.is_exempt ? ' (VIP)' : ''}
                  </Text>
                </View>
              </View>
            </View>

            <View style={{ marginTop: 10 }}>
              <Text
                style={{
                  fontFamily: 'PlusJakartaSans_700Bold',
                  fontSize: 20,
                  color: '#0f172a',
                  lineHeight: 26,
                }}
              >
                {p.nome || 'Sem Nome'}
              </Text>
              <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: '#64748b', marginTop: 2 }}>
                CRP: {p.crp || 'Não informado'}
              </Text>
            </View>

            {/* Contatos Grid */}
            <View
              style={{
                marginTop: 16,
                paddingTop: 14,
                borderTopWidth: 1,
                borderTopColor: '#f1f5f9',
                gap: 12,
                paddingBottom: 16,
              }}
            >
              {/* Email */}
              <TouchableOpacity
                onPress={() => copyToClipboard(p.email || '', 'email')}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="mail" size={15} color="#475569" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase' }}>Email</Text>
                    <Text numberOfLines={1} style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: '#1e293b' }}>
                      {p.email || '-'}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: copiedKey === 'email' ? '#16a34a' : '#64748b' }}>
                  {copiedKey === 'email' ? 'Copiado! ✓' : 'Copiar'}
                </Text>
              </TouchableOpacity>

              {/* Telefone & WhatsApp */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="phone" size={15} color="#166534" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase' }}>Telefone</Text>
                    <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: '#1e293b' }}>
                      {mascaraTelefone(p.telefone) || 'Não informado'}
                    </Text>
                  </View>
                </View>
                {p.telefone ? (
                  <TouchableOpacity
                    onPress={() => openWhatsApp(p.telefone, `Olá, ${p.nome?.split(' ')[0]}! Tudo bem? Aqui é o suporte da Yelo.`)}
                    style={{
                      backgroundColor: '#25D366',
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Feather name="message-circle" size={13} color="#fff" />
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: '#fff' }}>
                      WhatsApp
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Localização */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="map-pin" size={15} color="#475569" />
                </View>
                <View>
                  <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase' }}>Cidade / Estado</Text>
                  <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: '#1e293b' }}>
                    {p.cidade || 'Não informada'}{p.estado ? ` - ${p.estado}` : ''}
                  </Text>
                </View>
              </View>

              {/* Datas de Cadastro & Vencimento */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 4 }}>
                <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#f1f5f9' }}>
                  <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Cadastro</Text>
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: '#1e293b', marginTop: 2 }}>
                    {formatDateBR(p.createdAt)}
                  </Text>
                </View>

                <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#f1f5f9' }}>
                  <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Vencimento</Text>
                  <Text
                    style={{
                      fontFamily: 'PlusJakartaSans_700Bold',
                      fontSize: 13,
                      color: p.is_exempt ? '#854d0e' : (expiryInfo?.isExpired ? '#dc2626' : '#166534'),
                      marginTop: 2,
                    }}
                  >
                    {p.is_exempt ? 'Isento (VIP)' : (p.planExpiresAt ? formatDateBR(p.planExpiresAt) : 'Sem data')}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ------------------------------------------------------------- */}
        {/* DADOS DE AQUISIÇÃO (UTMs)                                      */}
        {/* ------------------------------------------------------------- */}
        <View
          style={{
            backgroundColor: '#ffffff',
            marginHorizontal: 16,
            marginTop: 12,
            padding: 14,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#e2e8f0',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Feather name="trending-up" size={15} color="#475569" />
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Aquisição (UTMs)
            </Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <View style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, flexDirection: 'row', gap: 5 }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', color: '#94a3b8', fontSize: 11 }}>Source:</Text>
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#0f172a', fontSize: 11 }}>{p.utm_source || 'Orgânico'}</Text>
            </View>
            <View style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, flexDirection: 'row', gap: 5 }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', color: '#94a3b8', fontSize: 11 }}>Medium:</Text>
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#0f172a', fontSize: 11 }}>{p.utm_medium || '-'}</Text>
            </View>
            <View style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, flexDirection: 'row', gap: 5 }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', color: '#94a3b8', fontSize: 11 }}>Campaign:</Text>
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#0f172a', fontSize: 11 }}>{p.utm_campaign || '-'}</Text>
            </View>
            <View style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, flexDirection: 'row', gap: 5 }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', color: '#94a3b8', fontSize: 11 }}>Content:</Text>
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#0f172a', fontSize: 11 }}>{p.utm_content || '-'}</Text>
            </View>
          </View>
        </View>

        {/* ------------------------------------------------------------- */}
        {/* GRID DE ESTATÍSTICAS RÁPIDAS (6 KPIs)                         */}
        {/* ------------------------------------------------------------- */}
        <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {/* Visualizações */}
            <View style={{ width: '48%', backgroundColor: '#ffffff', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: '#64748b' }}>👁️ Visualizações</Text>
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, color: '#1B4332', marginTop: 4 }}>
                {stats.profileViews || 0}
              </Text>
            </View>

            {/* Matches */}
            <View style={{ width: '48%', backgroundColor: '#ffffff', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: '#64748b' }}>🎯 Matches</Text>
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, color: '#1B4332', marginTop: 4 }}>
                {stats.matches || 0}
              </Text>
            </View>

            {/* Cliques WhatsApp */}
            <View style={{ width: '48%', backgroundColor: '#ffffff', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: '#64748b' }}>💬 Cliques WhatsApp</Text>
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, color: '#1B4332', marginTop: 4 }}>
                {stats.whatsappClicks || 0}
              </Text>
            </View>

            {/* Conversões PLG */}
            <View style={{ width: '48%', backgroundColor: '#ffffff', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: '#64748b' }}>🚀 Conversões (PLG)</Text>
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, color: '#16a34a', marginTop: 4 }}>
                {conversoesPlg}
              </Text>
            </View>

            {/* Posts Blog */}
            <View style={{ width: '48%', backgroundColor: '#ffffff', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: '#64748b' }}>📝 Posts Blog</Text>
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, color: '#1B4332', marginTop: 4 }}>
                {blogPosts.length}
              </Text>
            </View>

            {/* Fórum */}
            <View style={{ width: '48%', backgroundColor: '#ffffff', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: '#64748b' }}>🗣️ Interações Fórum</Text>
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, color: '#1B4332', marginTop: 4 }}>
                {stats.forumActivities || (forumPosts.length + forumComments.length)}
              </Text>
            </View>
          </View>
        </View>

        {/* ------------------------------------------------------------- */}
        {/* MENU DROPDOWN NATIVO NO ESTILO DO DISPOSITIVO                 */}
        {/* ------------------------------------------------------------- */}
        <View style={{ marginHorizontal: 16, marginTop: 18, marginBottom: 2 }}>
          <Text
            style={{
              fontFamily: 'PlusJakartaSans_700Bold',
              fontSize: 12,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 8,
            }}
          >
            Seção do Dossiê
          </Text>

          <NativeSelectMenu
            title="Selecione a Seção do Dossiê"
            options={[
              { label: `Linha do Tempo (${timelineEvents.length})`, value: 'timeline' },
              { label: `Pagamentos & Assinatura (${payments.length})`, value: 'payments' },
              { label: `Blog & Artigos (${blogPosts.length})`, value: 'blog' },
              { label: `Atividade no Fórum (${forumPosts.length + forumComments.length})`, value: 'forum' },
              { label: `Avaliações & Feedback (${reviews.length})`, value: 'reviews' },
              { label: `Leads WhatsApp (${whatsappLogs.length})`, value: 'whatsapp' },
            ]}
            selectedValue={activeTab}
            onSelect={(val) => setActiveTab(val as TabType)}
            style={{ width: '100%' }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#ffffff',
                borderWidth: 1,
                borderColor: '#cbd5e1',
                borderRadius: 16,
                paddingHorizontal: 14,
                paddingVertical: 12,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 4,
                elevation: 2,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    backgroundColor: '#1B4332',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Feather
                    name={
                      activeTab === 'timeline'
                        ? 'clock'
                        : activeTab === 'payments'
                        ? 'credit-card'
                        : activeTab === 'blog'
                        ? 'book-open'
                        : activeTab === 'forum'
                        ? 'message-circle'
                        : activeTab === 'reviews'
                        ? 'star'
                        : 'phone-call'
                    }
                    size={16}
                    color="#ffffff"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: 'PlusJakartaSans_700Bold',
                      fontSize: 15,
                      color: '#0f172a',
                    }}
                  >
                    {activeTab === 'timeline'
                      ? 'Linha do Tempo'
                      : activeTab === 'payments'
                      ? 'Pagamentos & Assinatura'
                      : activeTab === 'blog'
                      ? 'Blog & Artigos'
                      : activeTab === 'forum'
                      ? 'Atividade no Fórum'
                      : activeTab === 'reviews'
                      ? 'Avaliações & Feedback'
                      : 'Leads WhatsApp'}
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: '#f1f5f9',
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: '#e2e8f0',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'PlusJakartaSans_700Bold',
                      color: '#475569',
                      fontSize: 11,
                    }}
                  >
                    {activeTab === 'timeline'
                      ? timelineEvents.length
                      : activeTab === 'payments'
                      ? payments.length
                      : activeTab === 'blog'
                      ? blogPosts.length
                      : activeTab === 'forum'
                      ? forumPosts.length + forumComments.length
                      : activeTab === 'reviews'
                      ? reviews.length
                      : whatsappLogs.length}
                  </Text>
                </View>
              </View>
              <Feather name="chevron-down" size={18} color="#1B4332" />
            </View>
          </NativeSelectMenu>
        </View>

        {/* ------------------------------------------------------------- */}
        {/* CONTEÚDO DAS ABAS                                             */}
        {/* ------------------------------------------------------------- */}
        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          {/* ========================================================= */}
          {/* ABA 1: LINHA DO TEMPO (TIMELINE)                          */}
          {/* ========================================================= */}
          {activeTab === 'timeline' && (
            <View>
              {timelineEvents.length === 0 ? (
                <View style={{ backgroundColor: '#fff', padding: 24, borderRadius: 16, alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', color: '#94a3b8', fontSize: 14 }}>
                    Nenhuma atividade recente registrada.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  {timelineEvents.map((ev, idx) => (
                    <View
                      key={idx}
                      style={{
                        backgroundColor: '#ffffff',
                        padding: 14,
                        borderRadius: 16,
                        borderLeftWidth: 4,
                        borderLeftColor: ev.color,
                        borderWidth: 1,
                        borderColor: '#e2e8f0',
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        gap: 12,
                      }}
                    >
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          backgroundColor: ev.bg,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Feather name={ev.icon} size={17} color={ev.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', color: '#94a3b8', fontSize: 11 }}>
                          {formatDateTimeBR(ev.date)}
                        </Text>
                        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#0f172a', fontSize: 14, marginTop: 2 }}>
                          {ev.title}
                        </Text>
                        <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', color: '#475569', fontSize: 13, marginTop: 2 }}>
                          {ev.desc}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ========================================================= */}
          {/* ABA 2: PAGAMENTOS & ASSINATURA                            */}
          {/* ========================================================= */}
          {activeTab === 'payments' && (
            <View style={{ gap: 14 }}>
              {/* Status Banner */}
              {p.cancelAtPeriodEnd || p.canceledAt ? (
                <View style={{ backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fca5a5', padding: 14, borderRadius: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 18 }}>🛑</Text>
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#991b1b' }}>
                      Renovação Automática Cancelada
                    </Text>
                  </View>
                  <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: '#7f1d1d', marginTop: 6, lineHeight: 18 }}>
                    {expiryInfo?.isExpired
                      ? `O psicólogo solicitou cancelamento e o acesso encerrou em ${formatDateBR(p.planExpiresAt)}.`
                      : `Acesso permanece ativo até ${formatDateBR(p.planExpiresAt)}. Nenhuma nova cobrança será realizada.`}
                  </Text>
                </View>
              ) : p.is_exempt ? (
                <View style={{ backgroundColor: '#fefce8', borderWidth: 1, borderColor: '#fde047', padding: 14, borderRadius: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 18 }}>⭐</Text>
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#854d0e' }}>
                      Conta Isenta (VIP) - Acesso Vitalício
                    </Text>
                  </View>
                  <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: '#713f12', marginTop: 6 }}>
                    Este profissional possui isenção permanente de mensalidade autorizada pela administração da Yelo.
                  </Text>
                </View>
              ) : (p.subscriptionId || asaasSub.id) && p.status === 'active' ? (
                <View style={{ backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#86efac', padding: 14, borderRadius: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 18 }}>🔄</Text>
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#166534' }}>
                      Assinatura Recorrente Ativa
                    </Text>
                  </View>
                  <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: '#14532d', marginTop: 6, lineHeight: 18 }}>
                    Próxima renovação automática programada para {formatDateBR(p.planExpiresAt || asaasSub.nextDueDate)} {expiryInfo ? `(${expiryInfo.text})` : ''}.
                  </Text>
                </View>
              ) : (
                <View style={{ backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', padding: 14, borderRadius: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 18 }}>⏳</Text>
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#1e40af' }}>
                      Período de Testes (Trial)
                    </Text>
                  </View>
                  <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: '#1e3a8a', marginTop: 6 }}>
                    Vencimento do teste: {formatDateBR(p.planExpiresAt)} {expiryInfo ? `(${expiryInfo.text})` : ''}.
                  </Text>
                </View>
              )}

              {/* Banner de Falha de Pagamento no Gateway (se houver) */}
              {data.asaasFailedReason ? (
                <View style={{ backgroundColor: '#fef2f2', borderWidth: 1.5, borderColor: '#ef4444', padding: 14, borderRadius: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 18 }}>⚠️</Text>
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#991b1b' }}>
                      Falha na Cobrança do Gateway
                    </Text>
                  </View>
                  <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: '#b91c1c', marginTop: 4 }}>
                    Motivo: {data.asaasFailedReason}
                  </Text>
                </View>
              ) : null}

              {/* Grid de 4 Cards de KPI Financeiro */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {/* Plano e Valor */}
                <View style={{ width: '48%', backgroundColor: '#ffffff', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' }}>
                  <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: '#64748b' }}>📦 PLANO</Text>
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: '#0f172a', marginTop: 4 }}>
                    {p.plano || sub.plan || 'Sem Plano'}
                  </Text>
                  <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: '#16a34a', marginTop: 2 }}>
                    {p.is_exempt ? 'Isento (VIP)' : (asaasSub.value ? formatCurrency(asaasSub.value) : (p.valor_mensal_numero ? `R$ ${p.valor_mensal_numero},00` : '-'))}
                  </Text>
                </View>

                {/* Vencimento */}
                <View style={{ width: '48%', backgroundColor: '#ffffff', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' }}>
                  <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: '#64748b' }}>📅 VENCIMENTO</Text>
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: '#0f172a', marginTop: 4 }}>
                    {formatDateBR(p.planExpiresAt || asaasSub.nextDueDate)}
                  </Text>
                  <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: expiryInfo?.isExpired ? '#dc2626' : '#166534', marginTop: 2 }}>
                    {expiryInfo ? expiryInfo.text : '-'}
                  </Text>
                </View>

                {/* Mensalidades Pagas */}
                <View style={{ width: '48%', backgroundColor: '#ffffff', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' }}>
                  <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: '#64748b' }}>📈 MENSALIDADES</Text>
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: '#0f172a', marginTop: 4 }}>
                    {p.subscription_payments_count || payments.filter((x: any) => ['RECEIVED', 'CONFIRMED', 'paid'].includes(x.status)).length} meses
                  </Text>
                  <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: '#64748b', marginTop: 2 }}>
                    Total: {payments.length} faturas
                  </Text>
                </View>

                {/* LTV */}
                <View style={{ width: '48%', backgroundColor: '#ffffff', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' }}>
                  <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: '#64748b' }}>💰 RECEITA TOTAL (LTV)</Text>
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: '#166534', marginTop: 4 }}>
                    {formatCurrency(p.lifetimeRevenue || payments.filter((x: any) => ['RECEIVED', 'CONFIRMED', 'paid'].includes(x.status)).reduce((s: number, c: any) => s + parseFloat(c.value || 0), 0))}
                  </Text>
                  <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: '#64748b', marginTop: 2 }}>
                    1º pgto: {formatDateBR(p.firstPaidAt || p.subscribedAt)}
                  </Text>
                </View>
              </View>

              {/* Histórico de Faturas */}
              <View style={{ marginTop: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: '#1e293b' }}>
                    🧾 Histórico de Faturas
                  </Text>
                  <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#475569', fontSize: 11 }}>
                      {payments.length} {payments.length === 1 ? 'fatura' : 'faturas'}
                    </Text>
                  </View>
                </View>

                {payments.length === 0 ? (
                  <View style={{ backgroundColor: '#fff', padding: 20, borderRadius: 16, alignItems: 'center' }}>
                    <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', color: '#94a3b8', fontSize: 13 }}>
                      Nenhum pagamento registrado no sistema.
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 10 }}>
                    {payments.map((pm: any, i: number) => {
                      const isPaid = ['RECEIVED', 'CONFIRMED', 'paid', 'PAID'].includes(pm.status);
                      const isOverdue = ['OVERDUE', 'FAILED'].includes(pm.status);
                      const bType = String(pm.billingType || '').toUpperCase();
                      const icon = bType === 'PIX' ? '💠' : (bType === 'BOLETO' ? '📄' : '💳');

                      return (
                        <View
                          key={pm.id || i}
                          style={{
                            backgroundColor: '#ffffff',
                            padding: 14,
                            borderRadius: 16,
                            borderWidth: 1,
                            borderColor: '#e2e8f0',
                            gap: 10,
                          }}
                        >
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <View style={{ flex: 1, marginRight: 10 }}>
                              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#0f172a' }}>
                                {icon} {pm.description || (bType === 'PIX' ? 'Fatura PIX' : 'Mensalidade Yelo')}
                              </Text>
                              <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: '#64748b', marginTop: 4 }}>
                                Vencimento: {formatDateBR(pm.dueDate)}
                              </Text>
                              <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: '#94a3b8' }}>
                                Pago em: {pm.paymentDate ? formatDateBR(pm.paymentDate) : 'Pendente'}
                              </Text>
                            </View>

                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: '#0f172a' }}>
                                {formatCurrency(pm.value)}
                              </Text>
                              <View
                                style={{
                                  backgroundColor: isPaid ? '#dcfce7' : (isOverdue ? '#fee2e2' : '#fef3c7'),
                                  paddingHorizontal: 8,
                                  paddingVertical: 3,
                                  borderRadius: 999,
                                  marginTop: 4,
                                }}
                              >
                                <Text
                                  style={{
                                    fontFamily: 'PlusJakartaSans_700Bold',
                                    fontSize: 10,
                                    color: isPaid ? '#166534' : (isOverdue ? '#991b1b' : '#92400e'),
                                  }}
                                >
                                  {isPaid ? 'Pago' : (isOverdue ? 'Atrasado' : 'Pendente')}
                                </Text>
                              </View>
                            </View>
                          </View>

                          {(pm.invoiceUrl || pm.bankSlipUrl) && (
                            <TouchableOpacity
                              onPress={() => openExternalUrl(pm.invoiceUrl || pm.bankSlipUrl)}
                              style={{
                                backgroundColor: '#eff6ff',
                                borderWidth: 1,
                                borderColor: '#bfdbfe',
                                paddingVertical: 7,
                                paddingHorizontal: 12,
                                borderRadius: 10,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                              }}
                            >
                              <Feather name="external-link" size={13} color="#2563eb" />
                              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#2563eb' }}>
                                Ver Fatura / Comprovante
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

          {/* ========================================================= */}
          {/* ABA 3: BLOG & ARTIGOS                                     */}
          {/* ========================================================= */}
          {activeTab === 'blog' && (
            <View>
              {blogPosts.length === 0 ? (
                <View style={{ backgroundColor: '#fff', padding: 24, borderRadius: 16, alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', color: '#94a3b8', fontSize: 14 }}>
                    Nenhum artigo publicado pelo psicólogo.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  {blogPosts.map((post: any) => (
                    <View
                      key={post.id}
                      style={{
                        backgroundColor: '#ffffff',
                        padding: 14,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: '#e2e8f0',
                      }}
                    >
                      <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#1B4332' }}>
                        {post.titulo || post.title || 'Sem título'}
                      </Text>
                      <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: '#64748b', marginTop: 4 }}>
                        Publicado em: {formatDateBR(post.createdAt || post.created_at)}
                      </Text>
                      {post.resumo ? (
                        <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: '#475569', marginTop: 6 }}>
                          {post.resumo}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ========================================================= */}
          {/* ABA 4: FÓRUM                                              */}
          {/* ========================================================= */}
          {activeTab === 'forum' && (
            <View>
              {forumPosts.length === 0 && forumComments.length === 0 ? (
                <View style={{ backgroundColor: '#fff', padding: 24, borderRadius: 16, alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', color: '#94a3b8', fontSize: 14 }}>
                    Nenhuma interação registrada no fórum.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  {forumPosts.map((fp: any) => (
                    <View
                      key={`fp-${fp.id}`}
                      style={{
                        backgroundColor: '#ffffff',
                        padding: 14,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: '#e2e8f0',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ backgroundColor: '#f5f3ff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#7c3aed', fontSize: 10 }}>TÓPICO</Text>
                        </View>
                        <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: '#94a3b8' }}>
                          {formatDateBR(fp.createdAt)}
                        </Text>
                      </View>
                      <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#1e293b', marginTop: 6 }}>
                        {fp.title || 'Sem título'}
                      </Text>
                      {fp.content ? (
                        <Text numberOfLines={2} style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: '#475569', marginTop: 4 }}>
                          {fp.content}
                        </Text>
                      ) : null}
                    </View>
                  ))}

                  {forumComments.map((fc: any) => (
                    <View
                      key={`fc-${fc.id}`}
                      style={{
                        backgroundColor: '#ffffff',
                        padding: 14,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: '#e2e8f0',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ backgroundColor: '#faf5ff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#9333ea', fontSize: 10 }}>RESPOSTA</Text>
                        </View>
                        <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: '#94a3b8' }}>
                          {formatDateBR(fc.createdAt)}
                        </Text>
                      </View>
                      <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: '#334155', marginTop: 6 }}>
                        Em: {fc.postTitle || 'Tópico do fórum'}
                      </Text>
                      <Text numberOfLines={2} style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: '#475569', marginTop: 4 }}>
                        {fc.content || fc.texto || '-'}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ========================================================= */}
          {/* ABA 5: AVALIAÇÕES & FEEDBACK                              */}
          {/* ========================================================= */}
          {activeTab === 'reviews' && (
            <View>
              {reviews.length === 0 ? (
                <View style={{ backgroundColor: '#fff', padding: 24, borderRadius: 16, alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', color: '#94a3b8', fontSize: 14 }}>
                    Nenhuma avaliação registrada para este profissional.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  {reviews.map((rev: any) => {
                    const stars = rev.rating || rev.nota || 5;
                    return (
                      <View
                        key={rev.id}
                        style={{
                          backgroundColor: '#ffffff',
                          padding: 14,
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: '#e2e8f0',
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ color: '#d97706', fontSize: 15, letterSpacing: 2 }}>
                            {'★'.repeat(stars)}{'☆'.repeat(Math.max(0, 5 - stars))}
                          </Text>
                          <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', color: '#94a3b8', fontSize: 11 }}>
                            {formatDateBR(rev.createdAt)}
                          </Text>
                        </View>
                        <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', color: '#1e293b', fontSize: 13, marginTop: 8, fontStyle: 'italic' }}>
                          "{rev.comment || rev.comentario || 'Sem comentário por escrito.'}"
                        </Text>
                        <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748b', fontSize: 11, marginTop: 8 }}>
                          Por: {rev.patient?.nome || rev.autor || 'Paciente Anônimo'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* ========================================================= */}
          {/* ABA 6: LEADS WHATSAPP                                     */}
          {/* ========================================================= */}
          {activeTab === 'whatsapp' && (
            <View>
              {whatsappLogs.length === 0 ? (
                <View style={{ backgroundColor: '#fff', padding: 24, borderRadius: 16, alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', color: '#94a3b8', fontSize: 14 }}>
                    Nenhum clique ou lead registrado no WhatsApp.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  {whatsappLogs.map((log: any, idx: number) => {
                    const hasFeedback = Boolean(log.feedbackGiven);
                    const isClosed = hasFeedback && (log.dealClosed === 'yes' || log.dealClosed === 'started');
                    const isTalking = hasFeedback && log.dealClosed === 'talking';
                    const isNoContact = hasFeedback && (
                      log.contactReceived === false ||
                      log.dealClosed === 'no_contact' ||
                      log.dealClosed === 'wpp_issue' ||
                      log.dealClosed === 'unknown'
                    );
                    const isNotClosed = hasFeedback && (
                      ['no', 'not_started', 'ghosted'].includes(log.dealClosed) ||
                      (typeof log.dealClosed === 'string' && log.dealClosed.startsWith('not_started_')) ||
                      (Boolean(log.dealClosed) && Boolean(log.contactReceived))
                    );

                    let badgeColor = '#64748b';
                    let badgeBg = '#f1f5f9';
                    let badgeLabel = '⏳ Sem feedback';

                    if (hasFeedback) {
                      if (isClosed) {
                        badgeColor = '#166534';
                        badgeBg = '#dcfce7';
                        badgeLabel = '✅ Agendou';
                      } else if (isTalking) {
                        badgeColor = '#c2410c';
                        badgeBg = '#ffedd5';
                        badgeLabel = '⏳ Em negociação';
                      } else if (isNoContact) {
                        badgeColor = '#991b1b';
                        badgeBg = '#fee2e2';
                        badgeLabel = '❌ Não contatou';
                      } else if (isNotClosed) {
                        badgeColor = '#854d0e';
                        badgeBg = '#fef9c3';
                        if (log.dealClosed === 'not_started_price') {
                          badgeLabel = '💬 Não agendou (Preço)';
                        } else if (log.dealClosed === 'not_started_schedule') {
                          badgeLabel = '💬 Não agendou (Horário)';
                        } else if (log.dealClosed === 'ghosted') {
                          badgeLabel = '💬 Não agendou (Sumiu)';
                        } else {
                          badgeLabel = '💬 Não agendou';
                        }
                      } else {
                        badgeColor = '#0369a1';
                        badgeBg = '#e0f2fe';
                        badgeLabel = '✅ Respondido';
                      }
                    } else if (log.adminWppReminderSentAt) {
                      badgeColor = '#854d0e';
                      badgeBg = '#fef9c3';
                      badgeLabel = '⚠️ Cobrado';
                    } else {
                      badgeColor = '#64748b';
                      badgeBg = '#f1f5f9';
                      badgeLabel = '⏳ Sem feedback';
                    }

                    return (
                      <View
                        key={log.id || idx}
                        style={{
                          backgroundColor: '#ffffff',
                          padding: 14,
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: '#e2e8f0',
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <View style={{ flex: 1, marginRight: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#0f172a' }}>
                              {log.guestName || 'Paciente Anônimo'}
                            </Text>
                            <View style={{ backgroundColor: badgeBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: badgeColor, fontSize: 10 }}>
                                {badgeLabel}
                              </Text>
                            </View>
                          </View>

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                            <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: '#94a3b8' }}>
                              {formatDateTimeBR(log.createdAt)}
                            </Text>
                            {log.utmSource && (
                              <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0' }}>
                                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 9.5, color: '#475569' }}>
                                  {String(log.utmSource).toUpperCase()}
                                </Text>
                              </View>
                            )}
                          </View>

                          {log.dealClosedNotes && (
                            <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: '#64748b', fontStyle: 'italic', marginTop: 3 }}>
                              "{log.dealClosedNotes}"
                            </Text>
                          )}
                        </View>

                        {log.guestPhone && (
                          <TouchableOpacity
                            onPress={() => openWhatsApp(log.guestPhone)}
                            style={{
                              backgroundColor: '#25D366',
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 999,
                            }}
                          >
                            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#fff', fontSize: 11 }}>
                              WhatsApp
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

