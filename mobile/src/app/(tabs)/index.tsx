import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import YeloScrollView from '../../components/YeloScrollView';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
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
          api.get('/api/psychologists/me/stats?period=last30days').catch(() => ({ data: null })),
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

  // Stats da semana (7 dias) — usados no Hero, igual à web
  const contatos7d = stats?.last7DaysStats?.whatsappClicks ?? null;
  const views7d = stats?.last7DaysStats?.profileViews ?? null;
  const betterThan = stats?.betterThanPercentage ?? null;

  // KPIs do card Pacientes (30 dias) — iguais à web: kpi-whatsapp-clicks, kpi-match-impressions, kpi-taxa-escolha
  const contatosTotal = stats?.whatsappClicks ?? null;
  const matchImpressions = stats?.matchImpressions ?? null;
  const taxaClique = stats?.funnelRates?.finalConversion ?? null;

  // Comunidade — kpi-artigos, kpi-interacoes
  const artigos = stats?.blogPostCount ?? null;
  const interacoesForum = stats?.forumActivityCount ?? null;

  // Gestão resumida — agenda hoje, faturamento do mês
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
    { title: hasPhoto ? 'Foto profissional adicionada' : 'Adicionar uma foto profissional', impact: 'Obrigatório', completed: hasPhoto },
    { title: hasBio ? 'Biografia otimizada' : 'Escrever biografia (mín. 150 caracteres)', impact: 'Obrigatório', completed: hasBio },
    { title: hasCpf ? 'Documento validado' : 'Preencher CPF/CNPJ', impact: 'Obrigatório', completed: hasCpf },
    { title: hasSpecialties ? 'Especialidades definidas' : 'Definir temas de atuação', impact: 'Obrigatório', completed: hasSpecialties },
  ];
  const phase2 = [
    { title: hasForumActivity ? 'Primeira participação no fórum' : 'Responder a uma dúvida na comunidade', impact: 'Maior Visibilidade', completed: hasForumActivity },
    { title: hasArticle ? 'Primeiro artigo publicado' : 'Publicar seu primeiro artigo', impact: 'Autoridade', completed: hasArticle },
  ];

  const isPhase1Done = phase1.every(s => s.completed);
  const isPhase2Done = phase2.every(s => s.completed);

  let stepsToRender: any[] = [];
  let headerTitle = '';
  let isAdvancedPhase = false;

  if (!isPhase1Done) {
    headerTitle = '🎯 Fase 1: Primeiros passos';
    stepsToRender = [...phase1].sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
  } else if (!isPhase2Done) {
    headerTitle = '🚀 Fase 2: Próximos passos';
    stepsToRender = [...phase2].sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
  } else {
    isAdvancedPhase = true;
    headerTitle = '🔄 Fase 3: Manutenção';
    const lastForum = stats?.lastInteractions?.forum ? new Date(stats.lastInteractions.forum) : null;
    const lastArtigo = stats?.lastInteractions?.blog ? new Date(stats.lastInteractions.blog) : null;
    const diasSemForum = lastForum ? Math.floor((Date.now() - lastForum.getTime()) / (1000 * 60 * 60 * 24)) : 999;
    const diasSemArtigo = lastArtigo ? Math.floor((Date.now() - lastArtigo.getTime()) / (1000 * 60 * 60 * 24)) : 999;
    stepsToRender = [
      { title: diasSemForum <= 7 ? 'Você marcou presença na comunidade recentemente!' : 'Já deu uma passada no fórum essa semana?', impact: diasSemForum <= 7 ? 'Em dia!' : 'Comunidade', completed: diasSemForum <= 7 },
      { title: diasSemArtigo <= 30 ? 'Seu último artigo está fresquinho!' : 'Alguma ideia em mente? Que tal fazer um post no blog?', impact: diasSemArtigo <= 30 ? 'Em dia!' : 'Autoridade', completed: diasSemArtigo <= 30 },
      { title: faturamento > 0 ? 'Gestão financeira movimentada' : 'Nenhuma sessão registrada no mês', impact: 'Organização', completed: faturamento > 0 },
    ];
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
              Ative o Premium para continuar recebendo pacientes pela Yelo.
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
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* HERO CARD — "Seu crescimento essa semana" (igual à web) */}
        <LinearGradient
          colors={['#1B4332', '#2A5A40']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 24, padding: 22, marginBottom: 24, shadowColor: '#1B4332', shadowOpacity: 0.12, shadowRadius: 35, shadowOffset: { width: 0, height: 12 }, elevation: 5 }}
        >
          {/* Header: Nome + Botão */}
          <View className="flex-row justify-between items-start mb-8">
            <View className="flex-1 pr-4">
              {fotoUrl ? (
                <Image source={{ uri: fotoUrl }} style={{ width: 44, height: 44, borderRadius: 22, marginBottom: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' }} />
              ) : null}
              <Text className="font-title text-white text-[28px] mb-1">
                👋 Olá, {primeiroNome || ''}!
              </Text>
              <Text className="font-sans text-white/85 text-[15px]">Seu crescimento essa semana:</Text>
            </View>
            <TouchableOpacity className="bg-[#FFEE8C] px-4 py-3 rounded-full">
              <Text className="font-sans font-bold text-[#1B4332] text-[12px]">Melhorar perfil</Text>
            </TouchableOpacity>
          </View>

          {/* Métricas 7 dias — igual ao id="hero-contacts" e id="hero-views" da web */}
          <View className="flex-row justify-between mb-4">
            <View className="flex-1">
              {contatos7d !== null && contatos7d > 0 ? (
                <Text className="font-title text-[#FFEE8C] text-[44px] leading-tight mb-1">+{contatos7d}</Text>
              ) : (
                <Text className="font-sans text-white/70 text-[15px] mb-2 mt-1">Nenhum nesta semana</Text>
              )}
              <Text className="font-sans text-white/90 text-[12px] uppercase tracking-wider">Contatos de pacientes</Text>
            </View>
            <View className="flex-1 items-end">
              {views7d !== null && views7d > 0 ? (
                <Text className="font-title text-[#FFEE8C] text-[44px] leading-tight mb-1 text-right">+{views7d}</Text>
              ) : (
                <Text className="font-sans text-white/70 text-[15px] mb-2 mt-1 text-right">Nenhuma nesta semana</Text>
              )}
              <Text className="font-sans text-white/90 text-[12px] uppercase tracking-wider text-right">Visualizações no perfil</Text>
            </View>
          </View>

          {/* Benchmark — id="hero-benchmark-text" da web */}
          {betterThan !== null && (
            <View className="bg-white/15 self-start px-4 py-2 rounded-full">
              <Text className="font-sans text-[#d1fae5] text-[12px] font-bold">
                🔥 Seu perfil está melhor que <Text className="font-bold">{betterThan}%</Text> dos psicólogos
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
              <TouchableOpacity className="bg-[#fef3c7] border border-[#f59e0b] px-4 py-2 rounded-full">
                <Text className="font-sans font-bold text-[#b45309] text-[12px]">Ir para o Fórum</Text>
              </TouchableOpacity>
              <TouchableOpacity className="border border-[#fca5a5] px-4 py-2 rounded-full">
                <Text className="font-sans font-bold text-[#b91c1c] text-[12px]">Escrever Artigo</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* BLOCO 1: CHECKLIST — "Próximos passos para crescer" */}
        <View className="bg-white rounded-[24px] p-[22px] border border-[#e5e7eb] mb-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="font-title text-[#1B4332] text-[18px]">{headerTitle}</Text>
            <View className="bg-[#f0fdf4] px-3 py-1 rounded-[20px] border border-[#bbf7d0]">
              <Text className="font-sans text-[#1B4332] font-bold text-[11px]">
                {completedForProgress}/{totalTasks} {isAdvancedPhase ? 'em dia' : 'concluídos'}
              </Text>
            </View>
          </View>
          <View className="h-[6px] bg-[#f1f3f5] rounded-[4px] overflow-hidden mb-5">
            <View className="h-full bg-[#1B4332] rounded-[4px]" style={{ width: `${progressPercent}%` }} />
          </View>
          {stepsToRender.map((step, i) => (
            <View key={i} className={`flex-row items-center py-3 ${i < stepsToRender.length - 1 ? 'border-b border-[#f0f0f0]' : ''}`}>
              <View className={`w-[18px] h-[18px] rounded-full border-2 items-center justify-center mr-3 ${step.completed ? 'bg-[#1B4332] border-[#1B4332]' : 'border-[#ccc]'}`}>
                {step.completed && <Text className="text-white text-[10px] font-bold">✓</Text>}
              </View>
              <View className="flex-1">
                <Text className={`font-sans font-bold text-[13px] ${step.completed ? 'text-[#888] line-through' : 'text-[#333]'}`}>{step.title}</Text>
                <Text className="font-sans text-[11px] text-[#888] mt-[2px]">{step.impact}</Text>
              </View>
            </View>
          ))}
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
          <TouchableOpacity className="bg-[#1B4332] py-4 rounded-[14px] items-center">
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
                <Text className="font-sans text-[#555] text-[11px]">Artigos publicados</Text>
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
            <TouchableOpacity className="flex-1 border border-[#e5e7eb] py-3 rounded-full items-center">
              <Text className="font-sans font-bold text-[#333] text-[12px]">Escrever artigo</Text>
            </TouchableOpacity>
            <TouchableOpacity className="flex-1 border border-[#e5e7eb] py-3 rounded-full items-center">
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
          <TouchableOpacity className="flex-row items-center py-4 border-b border-[#f0f0f0]">
            <Text className="text-[18px] mr-3">📅</Text>
            <Text className="font-sans font-bold text-[#333] text-[14px] flex-1">Agenda Hoje</Text>
            <Text className="font-sans text-[#555] text-[13px]">{sessoeHoje} atends.</Text>
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center pt-4">
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
