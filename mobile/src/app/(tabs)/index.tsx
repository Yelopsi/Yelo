import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Image, Share, Platform } from 'react-native';
import YeloScrollView from '../../components/YeloScrollView';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import YeloToast from '../../components/YeloToast';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

export default function HomeScreen() {
  const { user, updateUser } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [hojeSessoes, setHojeSessoes] = useState<any[]>([]);
  const [faturamento, setFaturamento] = useState<number>(0);
  const [psiData, setPsiData] = useState<any>(null);
  const [aiTips, setAiTips] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedReview, setCopiedReview] = useState(false);
  const [promoOffer, setPromoOffer] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, apptsRes, finRes, meRes, aiRes, promoRes] = await Promise.all([
          api.get('/api/psychologists/me/stats?period=all_time').catch(() => ({ data: null })),
          api.get('/api/appointments').catch(() => ({ data: [] })),
          api.get('/api/financials/dashboard?period=current').catch(() => ({ data: { appointments: [] } })),
          api.get('/api/psychologists/me').catch(() => ({ data: null })),
          api.post('/api/psychologists/me/ai-insights', {}).catch(() => ({ data: null })),
          api.get(`/api/payments/promo-eligibility?planType=ESSENTIAL&isIos=${Platform.OS === 'ios'}&platform=${Platform.OS}`).catch(() => ({ data: null })),
        ]);
        if (promoRes?.data?.eligible) {
          setPromoOffer(promoRes.data);
        }

        if (meRes.data) {
          setPsiData(meRes.data);
          if (meRes.data.fotoUrl && meRes.data.fotoUrl !== user?.fotoUrl) {
            updateUser({ fotoUrl: meRes.data.fotoUrl, nome: meRes.data.nome });
          }
        } else {
          setIsOffline(true);
          return;
        }

        if (statsRes.data) {
          setStats(statsRes.data);
        }

        if (aiRes?.data) {
          setAiTips(aiRes.data);
        }

        // Sessões de hoje
        const localTzDate = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
        const todayList = (apptsRes.data || []).filter((a: any) =>
          a.start && a.start.startsWith(localTzDate) &&
          (a.status === 'confirmed' || a.status === 'done')
        );
        setHojeSessoes(todayList);

        // Faturamento do mês
        const income = (finRes.data?.appointments || [])
          .filter((e: any) => e.status === 'done')
          .reduce((acc: number, curr: any) => acc + (curr.value || 0), 0);
        setFaturamento(income);

      } catch (err: any) {
        setIsOffline(true);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#f9fafb] items-center justify-center">
        <ActivityIndicator size="large" color="#1B4332" />
        <Text className="font-sans text-[#555] mt-4">Carregando...</Text>
      </View>
    );
  }

  if (isOffline || !psiData) {
    return (
      <View className="flex-1 bg-[#f9fafb] items-center justify-center px-8">
        <Feather name="wifi-off" size={64} color="#9ca3af" />
        <Text className="font-title text-[28px] text-center mt-6 mb-3 text-[#333]">Sem conexão</Text>
        <Text className="font-sans text-[16px] text-center text-[#666] leading-relaxed">
          Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.
        </Text>
      </View>
    );
  }

  // --- LÓGICA DE BLOQUEIO (espelhando verificarBloqueioGeral da web) ---
  // A web só bloqueia quando status === 'inactive' E o usuário não é isento (is_exempt)
  const isExempt = psiData.is_exempt === true || String(psiData.is_exempt).toLowerCase() === 'true' || psiData.is_exempt === 1;
  const estaInativo = psiData.status === 'inactive' && !isExempt;

  // --- DADOS REAIS DA API (sem nenhum fallback inventado) ---
  const primeiroNome = psiData.nome ? psiData.nome.split(' ')[0] : '';
  const fotoUrl = psiData.fotoUrl || null;

  // Stats gerais (all_time) — iguais à web (psi_visao_geral.js)
  const whatsappClicks = stats?.whatsappClicks ?? 0;
  const profileViews = stats?.profileViews ?? 0;
  const matchImpressions = stats?.matchImpressions ?? 0;
  const contatosConvertidos = stats?.contatosConvertidos ?? 0;
  const betterThan = stats?.betterThanPercentage !== undefined ? Math.min(stats.betterThanPercentage, 99) : null;

  // KPIs do card Pacientes
  const contatosTotal = stats?.whatsappClicks ?? null;
  const taxaClique = stats?.funnelRates?.finalConversion ?? null;

  // Comunidade
  const artigos = stats?.blogPostCount ?? null;
  const interacoesForum = stats?.forumActivityCount ?? null;

  // Gestão resumida
  const sessoeHoje = hojeSessoes.length;
  const fatMes = faturamento;

  // Lembrete de interação (igual à web)
  const totalInteractions = (stats?.blogPostCount || 0) + (stats?.forumActivityCount || 0) + (stats?.answerCount || 0);
  const lastInteractionDates = [
    stats?.lastInteractions?.blog ? new Date(stats.lastInteractions.blog) : null,
    stats?.lastInteractions?.forum ? new Date(stats.lastInteractions.forum) : null,
    stats?.lastInteractions?.comment ? new Date(stats.lastInteractions.comment) : null,
  ].filter(Boolean) as Date[];
  const lastInteraction = lastInteractionDates.length > 0 ? new Date(Math.max(...lastInteractionDates.map(d => d.getTime()))) : null;
  const diffDays = lastInteraction ? Math.floor((Date.now() - lastInteraction.getTime()) / (1000 * 60 * 60 * 24)) : null;
  const showReminder = totalInteractions === 0 || (diffDays !== null && diffDays >= 7);
  const reminderContext = totalInteractions === 0 ? 'ainda não interagiu' : `não interage há ${diffDays} dias`;

  // Checklist (Fase 1/2/3 — espelho idêntico de psi_visao_geral.js)
  const hasPhoto = !!(psiData.fotoUrl && !psiData.fotoUrl.includes('placehold.co'));
  const hasBio = !!(psiData.bio && psiData.bio.length > 150);
  const hasCpf = !!(psiData.cpf && psiData.cpf.replace(/\D/g, '').length >= 11);
  const hasSpecialties = !!(psiData.temas_atuacao && psiData.temas_atuacao.length > 0);
  const hasForumActivity = (stats?.forumActivityCount || 0) > 0;
  const hasArticle = (stats?.blogPostCount || 0) > 0;

  const phase1Steps = [
    { title: hasPhoto ? 'Foto profissional adicionada' : 'Adicionar uma foto profissional', impact: 'Obrigatório', completed: hasPhoto, url: 'psi_meu_perfil.html' },
    { title: hasBio ? 'Biografia otimizada' : 'Escrever biografia (mín. 150 caracteres)', impact: 'Obrigatório', completed: hasBio, url: 'psi_meu_perfil.html' },
    { title: hasCpf ? 'Documento validado' : 'Preencher CPF/CNPJ', impact: 'Obrigatório', completed: hasCpf, url: 'psi_meu_perfil.html' },
    { title: hasSpecialties ? 'Especialidades definidas' : 'Definir temas de atuação', impact: 'Obrigatório', completed: hasSpecialties, url: 'psi_meu_perfil.html' }
  ];

  const phase2Steps = [
    { title: hasForumActivity ? 'Primeira participação no fórum' : 'Responder a uma dúvida na comunidade', impact: 'Maior Visibilidade', completed: hasForumActivity, url: 'psi_forum.html' },
    { title: hasArticle ? 'Primeiro post publicado' : 'Publicar seu primeiro post', impact: 'Autoridade', completed: hasArticle, url: 'psi_blog.html' }
  ];

  const isPhase1Completed = phase1Steps.every(s => s.completed);
  const isPhase2Completed = phase2Steps.every(s => s.completed);

  let stepsToRender: any[] = [];
  let headerTitle = '';
  let isAdvancedPhase = false;

  if (!isPhase1Completed) {
    headerTitle = '🎯 Fase 1: Primeiros passos para os matches';
    stepsToRender = [...phase1Steps].sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
  } else if (!isPhase2Completed) {
    headerTitle = '🚀 Fase 2: Próximos passos para crescer';
    stepsToRender = [...phase2Steps].sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
  } else {
    isAdvancedPhase = true;
    headerTitle = '🔄 Fase 3: Manutenção de Autoridade';

    const dateBlog = stats?.lastInteractions?.blog;
    const dateForum = stats?.lastInteractions?.forum;
    const dateComment = stats?.lastInteractions?.comment;
    const dateAnswer = stats?.lastInteractions?.answer;

    const diasSemArtigo = dateBlog ? Math.floor((Date.now() - new Date(dateBlog).getTime()) / (1000 * 60 * 60 * 24)) : (stats?.diasDesdeUltimoArtigo !== undefined ? stats.diasDesdeUltimoArtigo : 999);

    const interacoesForum = [
      dateForum ? new Date(dateForum) : null,
      dateComment ? new Date(dateComment) : null,
      dateAnswer ? new Date(dateAnswer) : null
    ].filter(d => d !== null && !isNaN(d.getTime())) as Date[];

    const lastForumDate = interacoesForum.length > 0 ? new Date(Math.max(...interacoesForum.map(d => d.getTime()))) : null;
    const diasSemForum = lastForumDate ? Math.floor((Date.now() - lastForumDate.getTime()) / (1000 * 60 * 60 * 24)) : (stats?.diasDesdeUltimaInteracao !== undefined ? stats.diasDesdeUltimaInteracao : 999);

    const hasRecentArticle = diasSemArtigo <= 7;
    const hasRecentForum = diasSemForum <= 7;

    const aiMarketingTip = aiTips?.marketingTip;
    const aiContentIdea = aiTips?.contentIdea;

    // 1. INTEGRAÇÃO DA IA COM TAREFAS RECORRENTES (Blog/Fórum)
    const isForumIdea = aiContentIdea && aiContentIdea.url && aiContentIdea.url.includes('forum');
    const forumPendingTitle = isForumIdea ? aiContentIdea.title : 'Já deu uma passada no fórum essa semana?';
    stepsToRender.push({
      title: hasRecentForum ? 'Você marcou presença na comunidade recentemente!' : forumPendingTitle,
      impact: hasRecentForum ? 'Em dia!' : 'Comunidade',
      completed: hasRecentForum,
      url: 'psi_forum.html',
      isRecurring: true
    });

    const isBlogIdea = aiContentIdea && aiContentIdea.url && aiContentIdea.url.includes('blog');
    const blogPendingTitle = isBlogIdea ? aiContentIdea.title : 'Alguma ideia em mente? Que tal fazer um post no blog';
    stepsToRender.push({
      title: hasRecentArticle ? 'Seu último artigo está fresquinho!' : blogPendingTitle,
      impact: hasRecentArticle ? 'Em dia!' : 'Autoridade',
      completed: hasRecentArticle,
      url: 'psi_blog.html',
      isRecurring: true
    });

    // 2. DICAS DE MARKETING / CONVERSÃO (Sempre exibidas como Lâmpada 💡)
    const reviewCount = (typeof psiData?.reviewCount === 'number')
      ? psiData.reviewCount
      : ((typeof stats?.reviewCount === 'number') ? stats.reviewCount : 0);
    const psiSlug = psiData?.slug || psiData?.customSlug || psiData?.id || '';
    const reviewShareUrl = psiSlug ? `https://www.yelopsi.com.br/${psiSlug}/?review=true` : `https://www.yelopsi.com.br/?review=true`;

    const impressions = stats?.totalImpressions || 0;
    const views = stats?.profileViews || 0;
    const clicks = stats?.whatsappClicks || 0;
    const viewToClickRate = views > 0 ? (clicks / views) : 0;
    const myPrice = Number(psiData?.preco_consulta || 0);

    if (reviewCount === 0) {
      stepsToRender.push({
        title: 'Você ainda não tem avaliações! Peça para pacientes antigos deixarem um depoimento no seu perfil público.',
        impact: 'Prova Social',
        completed: false,
        url: '#',
        shareUrl: reviewShareUrl,
        isTip: true,
        isReviewRequest: true
      });
    } else if (reviewCount < 5) {
      stepsToRender.push({
        title: `Você já tem ${reviewCount} ${reviewCount === 1 ? 'avaliação' : 'avaliações'}! Peça para mais pacientes deixarem um depoimento no seu perfil público.`,
        impact: 'Prova Social',
        completed: false,
        url: '#',
        shareUrl: reviewShareUrl,
        isTip: true,
        isReviewRequest: true
      });
    } else if (aiMarketingTip) {
      stepsToRender.push({
        title: aiMarketingTip.title?.startsWith('✨') ? aiMarketingTip.title : `✨ ${aiMarketingTip.title}`,
        impact: aiMarketingTip.impact || 'Dica IA',
        completed: false,
        url: aiMarketingTip.url || 'psi_meu_perfil.html',
        isTip: true,
        isMarketingAI: true
      });
    } else {
      if (impressions >= 10 && (views / impressions) < 0.15) {
        stepsToRender.push({ title: 'Ajustar o início do seu texto de bio para melhorar a taxa de clique no seu perfil', impact: 'Maior Conversão', completed: false, url: 'psi_meu_perfil.html', isTip: true });
      } else if (views >= 10 && viewToClickRate >= 0.25 && myPrice > 0 && myPrice < 130) {
        stepsToRender.push({ title: 'Sua conversão está excelente! Considere reajustar o valor da sessão para valorizar sua hora clínica', impact: 'Mais Faturamento', completed: false, url: 'psi_meu_perfil.html', isTip: true });
      } else if (views >= 10 && viewToClickRate < 0.10 && myPrice > 160) {
        stepsToRender.push({ title: 'Muitas visitas, mas poucos contatos. Considere reduzir o valor da sessão temporariamente para atrair pacientes', impact: 'Mais Contatos', completed: false, url: 'psi_meu_perfil.html', isTip: true });
      } else if (views >= 5 && viewToClickRate < 0.15) {
        stepsToRender.push({ title: 'Ajustar sua página pública e foto para passar mais confiança e receber mais chamadas', impact: 'Mais Contatos', completed: false, url: 'psi_meu_perfil.html', isTip: true });
      }
    }

    stepsToRender.push({ title: 'Gestão financeira e agenda revisadas', impact: 'Organização', completed: true, url: 'psi_financeiro.html', isRecurring: true });

    stepsToRender.sort((a, b) => {
      if (a.isTip !== b.isTip) return a.isTip ? 1 : -1;
      return a.completed === b.completed ? 0 : a.completed ? 1 : -1;
    });
  }

  const validTasks = stepsToRender.filter(s => !s.isTip && s.title !== 'Gestão financeira e agenda revisadas');
  const totalTasks = validTasks.length;
  const completedForProgress = validTasks.filter(s => s.completed).length;
  const progressPercent = totalTasks > 0 ? (completedForProgress / totalTasks) * 100 : 100;

  const handleStepPress = async (step: any) => {
    if (step.isReviewRequest) {
      const psiSlug = psiData?.slug || psiData?.customSlug || psiData?.id || '';
      const publicLink = step.shareUrl || (psiSlug ? `https://www.yelopsi.com.br/${psiSlug}/?review=true` : `https://www.yelopsi.com.br/?review=true`);
      try {
        await Clipboard.setStringAsync(publicLink);
        setCopiedReview(true);
        setToastMessage('Link de avaliação copiado para a área de transferência!');
        setTimeout(() => setCopiedReview(false), 3000);
        await Share.share({
          title: 'Avalie meu atendimento',
          message: `Avalie meu atendimento na Yelo: ${publicLink}`,
          url: publicLink,
        });
      } catch (e) {
        // Ignora cancelamento da folha de compartilhamento
      }
      return;
    }

    if (step.url === 'psi_forum.html') {
      router.navigate('/forum');
    } else if (step.url === 'psi_blog.html') {
      router.navigate('/blog');
    } else if (step.url === 'psi_meu_perfil.html') {
      router.navigate('/meu_perfil');
    } else if (step.url === 'psi_financeiro.html') {
      router.navigate('/financeiro');
    }
  };

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <StatusBar style="dark" />

      <YeloScrollView
        className="flex-1 px-5 pt-6"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 130 }}
      >
        {/* HERO CARD — "Seu impacto na Yelo" (espelho exato da web) */}
        <LinearGradient
          colors={['#1B4332', '#2A5A40']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 24,
            padding: 22,
            marginBottom: 24,
            shadowColor: '#1B4332',
            shadowOpacity: 0.12,
            shadowRadius: 35,
            shadowOffset: { width: 0, height: 12 },
            elevation: 5,
          }}
        >
          {/* Header: Nome + Botão */}
          <View className="flex-row justify-between items-start mb-6">
            <View className="flex-1 pr-3">
              <Text className="font-title text-white text-[28px] mb-1">
                Olá, {primeiroNome || 'Psicólogo'}!
              </Text>
              <Text className="font-sans text-white/85 text-[15px]">
                {whatsappClicks === 0 && profileViews === 0 ? 'Fase de construção 🌱' : 'Seu impacto na Yelo:'}
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.navigate('/meu_perfil')}
              className="bg-[#FFEE8C] px-4 py-2.5 rounded-full self-start shadow-sm"
            >
              <Text className="font-sans font-bold text-[#1B4332] text-[13px]">
                Melhorar meu perfil
              </Text>
            </TouchableOpacity>
          </View>

          {/* Grid de Métricas: 2 colunas com flex-wrap (espelho exato da web) */}
          <View className="flex-row flex-wrap mb-2">
            {/* Aparições no Match */}
            {matchImpressions > 0 && (
              <View style={{ width: '50%' }} className="pr-2 mb-4">
                <Text className="font-title text-[#FFEE8C] text-[36px] leading-tight mb-1">
                  +{matchImpressions}
                </Text>
                <Text className="font-sans text-white/90 text-[11px] uppercase tracking-wider font-medium">
                  Aparições no Match
                </Text>
              </View>
            )}

            {/* Visualizações de Perfil */}
            <View style={{ width: '50%' }} className="pl-2 mb-4">
              <Text className="font-title text-[#FFEE8C] text-[36px] leading-tight mb-1">
                +{profileViews}
              </Text>
              <Text className="font-sans text-white/90 text-[11px] uppercase tracking-wider font-medium">
                Visualizações de Perfil
              </Text>
            </View>

            {/* Contatos Recebidos */}
            <View style={{ width: '50%' }} className="pr-2 mb-3">
              <Text className="font-title text-[#FFEE8C] text-[36px] leading-tight mb-1">
                +{whatsappClicks}
              </Text>
              <Text className="font-sans text-white/90 text-[11px] uppercase tracking-wider font-medium">
                Contatos Recebidos
              </Text>
            </View>

            {/* Contatos Convertidos (se houver) */}
            {contatosConvertidos > 0 && (
              <View style={{ width: '50%' }} className="pl-2 mb-3">
                <Text className="font-title text-[#FFEE8C] text-[36px] leading-tight mb-1">
                  +{contatosConvertidos}
                </Text>
                <Text className="font-sans text-white/90 text-[11px] uppercase tracking-wider font-medium">
                  Contatos Convertidos
                </Text>
              </View>
            )}
          </View>

          {/* Benchmark — espelho da web */}
          {betterThan !== null && (
            <View className="bg-white/15 self-start px-3.5 py-1.5 rounded-full mt-1">
              <Text className="font-sans text-[#d1fae5] text-[12px] font-semibold">
                🔥 Seu perfil tem um histórico melhor que <Text className="font-bold">{betterThan}%</Text> dos psicólogos
              </Text>
            </View>
          )}
        </LinearGradient>

        {/* BANNER DISCRETO DE CONDIÇÃO PROMOCIONAL (espelho de #bf-visao-geral-banner da web) */}
        {promoOffer?.eligible && (
          <View
            style={{
              backgroundColor: '#1B4332',
              borderWidth: 1.5,
              borderColor: '#F4D35E',
              borderRadius: 18,
              padding: 16,
              marginBottom: 20,
            }}
          >
            <View style={{ backgroundColor: '#FFEE8C', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, marginBottom: 6 }}>
              <Text style={{ fontFamily: 'Inter_800ExtraBold', fontSize: 10, color: '#1B4332', textTransform: 'uppercase' }}>
                Condição Especial Liberação Automática
              </Text>
            </View>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 15, color: '#ffffff', marginBottom: 3 }}>
              {promoOffer.title || '2 meses de consultório ativo por R$ 99,00'}
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12.5, color: 'rgba(255,255,255,0.88)', lineHeight: 18, marginBottom: 12 }}>
              Pague apenas 1 mês (R$ 99) e receba 60 dias completos no Plano Essencial, sem precisar de cupom.
            </Text>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.navigate('/assinatura')}
              style={{ backgroundColor: '#FFEE8C', alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999 }}
            >
              <Text style={{ fontFamily: 'Inter_800ExtraBold', fontSize: 12.5, color: '#1B4332' }}>
                Ver condição →
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* LEMBRETE DE INTERAÇÃO — id="interaction-reminder-card" da web */}
        {showReminder && (
          <View className="bg-[#fffbeb] border-l-4 border-[#f59e0b] rounded-[16px] p-5 mb-6">
            <View className="flex-row items-center mb-2">
              <Text className="text-[18px] mr-2">🌱</Text>
              <Text className="font-sans font-bold text-[#b45309] text-[15px]">Fortaleça nossa comunidade!</Text>
            </View>
            <Text className="font-sans text-[#92400e] text-[13px] leading-[20px] mb-4">
              A Yelo é feita de trocas, mas notamos que você{' '}
              <Text className="font-bold">{reminderContext}</Text> por aqui. Compartilhe um insight no fórum ou escreva um artigo para ganhar XP e aumentar sua visibilidade.
            </Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/forum')}
                className="bg-[#fef3c7] border border-[#f59e0b] px-4 py-2 rounded-full"
              >
                <Text className="font-sans font-bold text-[#b45309] text-[12px]">Ir para o Fórum</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/blog')}
                className="border border-[#fca5a5] px-4 py-2 rounded-full"
              >
                <Text className="font-sans font-bold text-[#b91c1c] text-[12px]">Escrever Artigo</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* BLOCO 1: CHECKLIST — "Fase 1 / Fase 2 / Fase 3" (espelho exato da web mobile) */}
        <View className="bg-white rounded-[24px] p-[22px] border border-[#e5e7eb] mb-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
          <View className="flex-row justify-between items-center mb-6 gap-3">
            <Text className="font-title text-[#1B4332] text-[19px] flex-1 leading-snug">
              {headerTitle}
            </Text>
            <View className="bg-[#f0fdf4] px-[14px] py-[6px] rounded-[20px] border border-[#bbf7d0] self-center">
              <Text className="font-sans font-bold text-[#1B4332] text-[12px]">
                {completedForProgress}/{totalTasks} {isAdvancedPhase ? 'em dia' : 'concluídos'}
              </Text>
            </View>
          </View>

          <View className="h-[8px] bg-[#f1f3f5] rounded-[4px] overflow-hidden mb-6">
            <View
              className="h-full bg-[#1B4332] rounded-[4px]"
              style={{ width: `${progressPercent}%` }}
            />
          </View>

          <View className="gap-3">
            {stepsToRender.map((step, i) => {
              const isCompleted = step.completed;
              const isTip = !!step.isTip;
              const isReview = !!step.isReviewRequest;
              const showCopied = isReview && copiedReview;

              return (
                <TouchableOpacity
                  key={`${step.title}-${i}`}
                  activeOpacity={0.7}
                  onPress={() => handleStepPress(step)}
                  className={`flex-row items-center px-[14px] py-[12px] rounded-[16px] ${
                    isCompleted
                      ? 'bg-transparent border border-transparent opacity-60'
                      : 'bg-[#f8f9fa] border border-[#f1f3f5]'
                  }`}
                >
                  {isTip ? (
                    <View className="w-[18px] h-[18px] items-center justify-center mr-3">
                      <Text className="text-[17px] leading-none">💡</Text>
                    </View>
                  ) : (
                    <View
                      className={`w-[18px] h-[18px] rounded-full border-2 items-center justify-center mr-3 ${
                        isCompleted
                          ? 'bg-[#1B4332] border-[#1B4332]'
                          : 'border-[#adb5bd] bg-white'
                      }`}
                    >
                      {isCompleted && (
                        <Text className="text-white text-[10px] font-bold leading-none">✓</Text>
                      )}
                    </View>
                  )}

                  <View className="flex-1">
                    <Text
                      className={`font-sans font-semibold text-[14px] leading-snug mb-1 ${
                        showCopied
                          ? 'text-[#10b981]'
                          : isCompleted
                          ? isAdvancedPhase
                            ? 'text-[#888]'
                            : 'text-[#888] line-through'
                          : 'text-[#333]'
                      }`}
                    >
                      {showCopied
                        ? '✅ Link copiado com sucesso! Envie aos pacientes.'
                        : step.title}
                    </Text>

                    {!isCompleted || isTip ? (
                      <View className="self-start bg-[#d1fae5] px-2 py-0.5 rounded-[6px]">
                        <Text className="font-sans font-bold text-[#059669] text-[11px]">
                          {step.impact}
                        </Text>
                      </View>
                    ) : isAdvancedPhase ? (
                      <Text className="font-sans text-[12px] text-[#888]">
                        {step.impact}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* BLOCO 2: PACIENTES — espelho de psi_visao_geral.html */}
        {/* kpi-whatsapp-clicks = "Novos contatos", kpi-match-impressions = "Aparições no match", kpi-taxa-escolha = "Taxa de clique" */}
        <View className="bg-white rounded-[24px] p-[22px] border border-[#e5e7eb] mb-6">
          <Text className="font-title text-[#1B4332] text-[20px] mb-5">💬 Pacientes</Text>
          <View className="flex-row flex-wrap gap-3 mb-5">
            <View className="bg-[#f8f9fa] rounded-[14px] p-4 flex-1" style={{ minWidth: '44%' }}>
              <Text className="font-title text-[#1B4332] text-[30px] leading-tight">
                {contatosTotal !== null ? contatosTotal : '—'}
              </Text>
              <Text className="font-sans text-[#555] text-[11px] mt-1">Novos contatos</Text>
            </View>
            <View className="bg-[#f8f9fa] rounded-[14px] p-4 flex-1" style={{ minWidth: '44%' }}>
              <Text className="font-title text-[#1B4332] text-[30px] leading-tight">
                {matchImpressions !== null ? matchImpressions : '—'}
              </Text>
              <Text className="font-sans text-[#555] text-[11px] mt-1">Aparições no match</Text>
            </View>
            <View className="bg-[#f8f9fa] rounded-[14px] p-4 flex-1" style={{ minWidth: '44%' }}>
              <Text className="font-title text-[#1B4332] text-[30px] leading-tight">
                {taxaClique !== null ? `${taxaClique}%` : '—'}
              </Text>
              <Text className="font-sans text-[#555] text-[11px] mt-1">Taxa de clique</Text>
            </View>
          </View>
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => router.navigate('/pacientes')}
            className="bg-[#1B4332] py-4 rounded-full items-center"
          >
            <Text className="font-sans font-bold text-white text-[15px]">Gerenciar</Text>
          </TouchableOpacity>
        </View>

        {/* BLOCO 3: AUTORIDADE / COMUNIDADE — id="kpi-artigos", id="kpi-interacoes" */}
        <View className="bg-white rounded-[24px] p-[22px] border border-[#e5e7eb] mb-6">
          <Text className="font-title text-[#1B4332] text-[20px] mb-5">🧠 Presença na comunidade</Text>
          <View className="flex-row gap-3 mb-5">
            <View className="flex-1 bg-[#f8f9fa] rounded-[14px] p-4 flex-row items-center">
              <Text className="text-[22px] mr-3">✍️</Text>
              <View>
                <Text className="font-title text-[#1B4332] text-[22px] leading-tight">
                  {artigos !== null ? artigos : '—'}
                </Text>
                <Text className="font-sans text-[#555] text-[11px]">Posts publicados</Text>
              </View>
            </View>
            <View className="flex-1 bg-[#f8f9fa] rounded-[14px] p-4 flex-row items-center">
              <Text className="text-[22px] mr-3">💬</Text>
              <View>
                <Text className="font-title text-[#1B4332] text-[22px] leading-tight">
                  {interacoesForum !== null ? interacoesForum : '—'}
                </Text>
                <Text className="font-sans text-[#555] text-[11px]">Interações no fórum</Text>
              </View>
            </View>
          </View>
          <View className="flex-row gap-3">
            <TouchableOpacity 
              onPress={() => router.navigate('/blog')}
              className="flex-1 border border-[#e5e7eb] py-3 rounded-full items-center"
            >
              <Text className="font-sans font-bold text-[#333] text-[12px]">Criar post</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => router.navigate('/forum')}
              className="flex-1 border border-[#e5e7eb] py-3 rounded-full items-center"
            >
              <Text className="font-sans font-bold text-[#333] text-[12px]">Participar do fórum</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* BLOCO 4: GESTÃO RESUMIDA — id="agenda-hoje", id="faturamento-mes" */}
        <View className="bg-white rounded-[24px] p-[22px] border border-[#e5e7eb] mb-6">
          <View className="flex-row items-center mb-4">
            <Feather name="layers" size={16} color="#555" />
            <Text className="font-sans font-bold text-[#555] text-[15px] ml-2">Gestão Resumida</Text>
          </View>
          <TouchableOpacity 
            onPress={() => router.navigate('/clinica')}
            className="flex-row items-center py-4 border-b border-[#f0f0f0]"
          >
            <Text className="text-[18px] mr-3">📅</Text>
            <Text className="font-sans font-bold text-[#333] text-[14px] flex-1">Agenda Hoje</Text>
            <Text className="font-sans text-[#555] text-[13px]">{sessoeHoje} atends.</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => router.navigate('/financeiro')}
            className="flex-row items-center pt-4"
          >
            <Text className="text-[18px] mr-3">💰</Text>
            <Text className="font-sans font-bold text-[#333] text-[14px] flex-1">Financeiro</Text>
            <Text className="font-sans text-[#555] text-[13px]">
              R$ {fatMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </Text>
          </TouchableOpacity>
        </View>

        <View className="h-[20px]" />
      </YeloScrollView>

      {/* Toast flutuante de baixo pra cima */}
      <YeloToast message={toastMessage} onDismiss={() => setToastMessage(null)} />
    </View>
  );
}
