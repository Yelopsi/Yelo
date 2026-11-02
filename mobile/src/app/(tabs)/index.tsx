import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import YeloScrollView from '../../components/YeloScrollView';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import api from '../../services/api';

export default function HomeScreen() {
  const [stats, setStats] = useState<any>(null);
  const [hojeSessoes, setHojeSessoes] = useState<any[]>([]);
  const [faturamento, setFaturamento] = useState<number>(0);
  const [psiData, setPsiData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, apptsRes, finRes, meRes] = await Promise.all([
          api.get('/api/psychologists/me/stats?period=all_time').catch(() => ({ data: null })),
          api.get('/api/appointments').catch(() => ({ data: [] })),
          api.get('/api/financials/dashboard?period=current').catch(() => ({ data: { appointments: [] } })),
          api.get('/api/psychologists/me').catch(() => ({ data: null }))
        ]);

        if (meRes.data) {
          setPsiData(meRes.data);
        } else {
          setIsOffline(true);
          return;
        }

        if (statsRes.data) {
          setStats(statsRes.data);
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

  // Checklist (Fase 1/2/3 — com dados reais)
  const hasPhoto = !!(psiData.fotoUrl && !psiData.fotoUrl.includes('placehold.co'));
  const hasBio = !!(psiData.bio && psiData.bio.length > 150);
  const hasCpf = !!(psiData.cpf && psiData.cpf.replace(/\D/g, '').length >= 11);
  const hasSpecialties = !!(psiData.temas_atuacao && psiData.temas_atuacao.length > 0);
  const hasForumActivity = (stats?.forumActivityCount || 0) > 0;
  const hasArticle = (stats?.blogPostCount || 0) > 0;

  const phase1 = [
    { title: hasPhoto ? 'Foto profissional adicionada' : 'Adicionar uma foto profissional', impact: 'Obrigatório', completed: hasPhoto, url: 'psi_meu_perfil.html' },
    { title: hasBio ? 'Biografia otimizada' : 'Escrever biografia (mín. 150 caracteres)', impact: 'Obrigatório', completed: hasBio, url: 'psi_meu_perfil.html' },
    { title: hasCpf ? 'Documento validado' : 'Preencher CPF/CNPJ', impact: 'Obrigatório', completed: hasCpf, url: 'psi_meu_perfil.html' },
    { title: hasSpecialties ? 'Especialidades definidas' : 'Definir temas de atuação', impact: 'Obrigatório', completed: hasSpecialties, url: 'psi_meu_perfil.html' },
  ];
  const phase2 = [
    { title: hasForumActivity ? 'Primeira participação no fórum' : 'Responder a uma dúvida na comunidade', impact: 'Maior Visibilidade', completed: hasForumActivity, url: 'psi_forum.html' },
    { title: hasArticle ? 'Primeiro artigo publicado' : 'Publicar seu primeiro artigo', impact: 'Autoridade', completed: hasArticle, url: 'psi_blog.html' },
  ];

  const isPhase1Done = phase1.every(s => s.completed);
  const isPhase2Done = phase2.every(s => s.completed);

  let stepsToRender: any[] = [];
  let headerTitle = '';
  let isAdvancedPhase = false;

  if (!isPhase1Done) {
    headerTitle = '🎯 Fase 1: Primeiros passos para os matches';
    stepsToRender = [...phase1].sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
  } else if (!isPhase2Done) {
    headerTitle = '🚀 Fase 2: Próximos passos para crescer';
    stepsToRender = [...phase2].sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
  } else {
    isAdvancedPhase = true;
    headerTitle = '🔄 Fase 3: Manutenção de Autoridade';

    const dateForum = stats?.lastInteractions?.forum;
    const dateComment = stats?.lastInteractions?.comment;
    const dateAnswer = stats?.lastInteractions?.answer;
    const forumDates = [
      dateForum ? new Date(dateForum) : null,
      dateComment ? new Date(dateComment) : null,
      dateAnswer ? new Date(dateAnswer) : null,
    ].filter(d => d !== null && !isNaN(d.getTime())) as Date[];
    const lastForum = forumDates.length > 0 ? new Date(Math.max(...forumDates.map(d => d.getTime()))) : null;
    const diasSemForum = lastForum ? Math.floor((Date.now() - lastForum.getTime()) / (1000 * 60 * 60 * 24)) : (stats?.diasDesdeUltimaInteracao !== undefined ? stats.diasDesdeUltimaInteracao : 999);

    const dateBlog = stats?.lastInteractions?.blog;
    const lastArtigo = dateBlog ? new Date(dateBlog) : null;
    const diasSemArtigo = lastArtigo ? Math.floor((Date.now() - lastArtigo.getTime()) / (1000 * 60 * 60 * 24)) : (stats?.diasDesdeUltimoArtigo !== undefined ? stats.diasDesdeUltimoArtigo : 999);

    const hasRecentForum = diasSemForum <= 7;
    const hasRecentArticle = diasSemArtigo <= 7;

    stepsToRender = [
      {
        title: hasRecentForum ? 'Você marcou presença na comunidade recentemente!' : 'Já deu uma passada no fórum essa semana?',
        impact: hasRecentForum ? 'Em dia!' : 'Comunidade',
        completed: hasRecentForum,
        url: 'psi_forum.html',
        isRecurring: true
      },
      {
        title: hasRecentArticle ? 'Seu último artigo está fresquinho!' : 'Alguma ideia em mente? Que tal fazer um post no blog',
        impact: hasRecentArticle ? 'Em dia!' : 'Autoridade',
        completed: hasRecentArticle,
        url: 'psi_blog.html',
        isRecurring: true
      }
    ];

    // Ordenação idêntica à web: pendentes primeiro, concluídos depois
    stepsToRender.sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
  }

  const totalTasks = stepsToRender.length;
  const completedForProgress = stepsToRender.filter(s => s.completed).length;
  const progressPercent = totalTasks > 0 ? (completedForProgress / totalTasks) * 100 : 100;

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <StatusBar style="dark" />

      {/* PAYWALL OVERLAY — igual à web: mostra banner por cima quando inativo, não bloqueia a tela */}
      {estaInativo && (
        <View
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 100,
            alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <View className="bg-white rounded-[24px] p-8 w-full max-w-[400px] items-center">
            <Text className="text-[48px] mb-4">🔒</Text>
            <Text className="font-title text-[#1B4332] text-[22px] text-center mb-3">
              Período de teste expirou
            </Text>
            <Text className="font-sans text-[#555] text-[15px] text-center leading-relaxed mb-6">
              Ative o Plano Essencial para continuar recebendo pacientes pela Yelo.
            </Text>
            <TouchableOpacity className="bg-[#1B4332] py-4 w-full rounded-[16px] items-center">
              <Text className="font-sans font-bold text-white text-[16px]">Assinar Agora</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

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

        {/* BLOCO 1: CHECKLIST — "Próximos passos para crescer / Manutenção de Autoridade" */}
        <View className="bg-white rounded-[24px] p-5 border border-[#e5e7eb] mb-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="font-title text-[#1B4332] text-[17px] flex-1 mr-2">{headerTitle}</Text>
            <View className="bg-[#f0fdf4] px-3 py-1 rounded-[20px] border border-[#bbf7d0]">
              <Text className="font-sans text-[#1B4332] font-bold text-[11px]">
                {completedForProgress}/{totalTasks} {isAdvancedPhase ? 'em dia' : 'concluídos'}
              </Text>
            </View>
          </View>

          <View className="h-[6px] bg-[#f1f3f5] rounded-[4px] overflow-hidden mb-4">
            <View className="h-full bg-[#1B4332] rounded-[4px]" style={{ width: `${progressPercent}%` }} />
          </View>

          <View className="gap-2.5">
            {stepsToRender.map((step, i) => {
              const isCompleted = step.completed;
              return (
                <TouchableOpacity
                  key={i}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (step.url === 'psi_forum.html') router.navigate('/forum');
                    else if (step.url === 'psi_blog.html') router.navigate('/blog');
                    else if (step.url === 'psi_meu_perfil.html') router.navigate('/meu_perfil');
                    else if (step.url === 'psi_financeiro.html') router.navigate('/financeiro');
                  }}
                  className={`flex-row items-center p-3.5 rounded-[16px] ${
                    isCompleted
                      ? 'bg-transparent border border-transparent opacity-70'
                      : 'bg-[#f8f9fa] border border-[#f1f3f5]'
                  }`}
                >
                  <View
                    className={`w-[18px] h-[18px] rounded-full border-2 items-center justify-center mr-3 ${
                      isCompleted
                        ? 'bg-[#1B4332] border-[#1B4332]'
                        : 'border-[#adb5bd]'
                    }`}
                  >
                    {isCompleted && <Text className="text-white text-[10px] font-bold leading-none">✓</Text>}
                  </View>
                  <View className="flex-1">
                    <Text
                      className={`font-sans font-semibold text-[13px] ${
                        isCompleted
                          ? isAdvancedPhase ? 'text-[#888]' : 'text-[#888] line-through'
                          : 'text-[#333]'
                      }`}
                    >
                      {step.title}
                    </Text>
                    {!isCompleted ? (
                      <View className="self-start bg-[#d1fae5] px-2 py-0.5 rounded-[6px] mt-1">
                        <Text className="font-sans font-bold text-[#059669] text-[10px]">
                          {step.impact}
                        </Text>
                      </View>
                    ) : isAdvancedPhase ? (
                      <Text className="font-sans text-[11px] text-[#888] mt-0.5">
                        {step.impact}
                      </Text>
                    ) : (
                      <Text className="font-sans text-[11px] text-[#888] mt-0.5">
                        {step.impact}
                      </Text>
                    )}
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
    </View>
  );
}
