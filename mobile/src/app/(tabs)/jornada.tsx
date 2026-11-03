import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import api from '../../services/api';

// Definições de Níveis da Yelo (espelhando backend e web)
const LEVELS = [
  { level: 1, slug: 'nivel_iniciante', min: 0, label: 'Membro Iniciante', short: 'Iniciante', xpLabel: '0 XP', next: 500 },
  { level: 2, slug: 'nivel_verificado', min: 500, label: 'Psicólogo Verificado', short: 'Verificado', xpLabel: '500 XP', next: 1500 },
  { level: 3, slug: 'nivel_ativo', min: 1500, label: 'Perfil Ativo', short: 'Ativo', xpLabel: '1.5k XP', next: 5000 },
  { level: 4, slug: 'nivel_especialista', min: 5000, label: 'Especialista Yelo', short: 'Especialista', xpLabel: '5k XP', next: 15000 },
  { level: 5, slug: 'nivel_mentor', min: 15000, label: 'Mentor / Top Voice', short: 'Mentor', xpLabel: '15k XP', next: 15000 },
];

// Regras das Badges de Gamificação (espelhando backend e web)
const BADGE_CONFIG = {
  semeador: {
    title: 'Semeador',
    icon: '🌱',
    colorBg: '#f0fdf4',
    colorText: '#16a34a',
    desc: 'Escreva artigos no Blog (Bronze: 1 • Prata: 5 • Ouro: 15)',
    bronze: 1,
    prata: 5,
    ouro: 15,
  },
  voz_ativa: {
    title: 'Voz Ativa',
    icon: '💬',
    colorBg: '#e0f2fe',
    colorText: '#0284c7',
    desc: 'Participe do Fórum (Bronze: 10 • Prata: 50 • Ouro: 200)',
    bronze: 10,
    prata: 50,
    ouro: 200,
  },
  conselheiro: {
    title: 'Conselheiro',
    icon: '💡',
    colorBg: '#fef3c7',
    colorText: '#d97706',
    desc: 'Responda na Comunidade (Bronze: 10 • Prata: 50 • Ouro: 150)',
    bronze: 10,
    prata: 50,
    ouro: 150,
  },
  autentico: {
    title: 'Autêntico',
    icon: '🛡️',
    colorBg: '#fce7f3',
    colorText: '#db2777',
    desc: 'Preencha todos os campos obrigatórios do seu perfil.',
  },
  pioneiro: {
    title: 'Pioneiro',
    icon: '🏅',
    colorBg: '#e0e7ff',
    colorText: '#4f46e5',
    desc: 'Cadastre-se durante a fase de lançamento da plataforma.',
  },
};

// Todas as 8 formas oficiais de ganhar XP (espelhando psi_jornada.html)
const XP_WAYS = [
  { icon: '📝', title: 'Completar Perfil', xp: 500, desc: 'Único' },
  { icon: '✍️', title: 'Artigo no Blog', xp: 50, desc: '1x/dia' },
  { icon: '💡', title: 'Iniciar Discussão', xp: 25, desc: '2x/dia' },
  { icon: '🗣️', title: 'Comentar no Fórum', xp: 20, desc: '5x/dia' },
  { icon: '❓', title: 'Responder Pergunta', xp: 15, desc: '5x/dia' },
  { icon: '📲', title: 'Clique WhatsApp', xp: 10, desc: 'Por lead' },
  { icon: '❤️', title: 'Receber Like', xp: 5, desc: 'Por curtida' },
  { icon: '🔑', title: 'Login Diário', xp: 1, desc: '1x/dia' },
];

// Helper: Card de Conquista com visual premium
interface AchievementCardProps {
  icon: string;
  colorBg: string;
  colorText: string;
  title: string;
  desc: string;
  progressText: string;
  progressPercent: number;
  statusLabel: string;
  isUnlocked: boolean;
}

const AchievementCard = ({
  icon,
  colorBg,
  colorText,
  title,
  desc,
  progressText,
  progressPercent,
  statusLabel,
  isUnlocked,
}: AchievementCardProps) => (
  <View className="bg-white border border-[#e5e7eb] rounded-[20px] p-5 mb-4 shadow-sm">
    <View className="flex-row items-center mb-3">
      <View
        style={{ backgroundColor: colorBg }}
        className="w-[48px] h-[48px] rounded-[14px] items-center justify-center mr-3.5 shadow-sm"
      >
        <Text className="text-[24px]">{icon}</Text>
      </View>
      <View className="flex-1">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="font-title text-[#1B4332] text-[17px]">{title}</Text>
          <View
            className={`px-2.5 py-1 rounded-full border ${
              isUnlocked ? 'bg-[#f0fdf4] border-[#bbf7d0]' : 'bg-[#f1f5f9] border-[#e2e8f0]'
            }`}
          >
            <Text
              className={`font-sans font-bold text-[11px] ${
                isUnlocked ? 'text-[#166534]' : 'text-[#64748b]'
              }`}
            >
              {statusLabel}
            </Text>
          </View>
        </View>
        <Text className="font-sans text-[#64748b] text-[12.5px] leading-snug">{desc}</Text>
      </View>
    </View>

    {/* Barra de Progresso da Conquista */}
    <View className="h-[8px] bg-[#f1f5f9] rounded-full overflow-hidden mb-2">
      <View
        className="h-full rounded-full"
        style={{
          width: `${progressPercent}%`,
          backgroundColor: isUnlocked ? colorText : '#94a3b8',
        }}
      />
    </View>
    <View className="flex-row justify-between items-center">
      <Text className="font-sans font-semibold text-[#888] text-[12px]">Progresso</Text>
      <Text className="font-sans font-bold text-[#334155] text-[12px]">{progressText}</Text>
    </View>
  </View>
);

export default function JornadaScreen() {
  const router = useRouter();

  const [refreshing, setRefreshing] = useState(false);
  const [userXp, setUserXp] = useState(0);
  const [authorityLevel, setAuthorityLevel] = useState('nivel_iniciante');
  const [badges, setBadges] = useState<any>({});
  const [progress, setProgress] = useState<any>({});
  const [isProfileComplete, setIsProfileComplete] = useState(false);

  // Carrega os dados reais do perfil e gamificação
  const loadJornadaData = useCallback(async (isPull = false) => {
    if (isPull) setRefreshing(true);
    try {
      const res = await api.get('/api/psychologists/me');
      if (res.data) {
        setUserXp(Number(res.data.xp) || 0);
        setAuthorityLevel(res.data.authority_level || 'nivel_iniciante');
        setBadges(res.data.badges || {});
        setProgress(res.data.gamificationProgress || {});
        setIsProfileComplete(Boolean(res.data.isProfileComplete));
      }
    } catch (err: any) {
      console.warn('[JORNADA] Erro ao sincronizar dados:', err?.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadJornadaData();
    }, [loadJornadaData])
  );

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate('/(tabs)/clinica');
    }
  };

  // Nível atual e próximo nível
  const currentLevel = useMemo(() => {
    return LEVELS.find((l) => l.slug === authorityLevel) || LEVELS[0];
  }, [authorityLevel]);

  const nextLevel = useMemo(() => {
    return LEVELS.find((l) => l.min > userXp) || currentLevel;
  }, [userXp, currentLevel]);

  const progressPercent = useMemo(() => {
    if (nextLevel.min <= 0) return 100;
    return Math.min(100, Math.max(0, (userXp / nextLevel.min) * 100));
  }, [userXp, nextLevel]);

  const nextMilestoneText = useMemo(() => {
    if (currentLevel.slug === nextLevel.slug) {
      return '🏆 Incrível! Você alcançou o nível máximo de autoridade na Yelo. Continue inspirando nossa comunidade!';
    }
    const needed = Math.max(0, nextLevel.min - userXp);
    return `Você está a apenas ${needed} XP de conquistar o nível ${nextLevel.label}!`;
  }, [currentLevel, nextLevel, userXp]);

  // Cálculo das 3 badges de progressão contínua
  const getProgressBadgeData = (
    key: 'semeador' | 'voz_ativa' | 'conselheiro',
    count: number,
    unlockedTier?: string | null
  ) => {
    const cfg = BADGE_CONFIG[key];
    let target = cfg.bronze;
    let progressText = `${count}/${cfg.bronze} para Bronze`;
    let percent = (count / cfg.bronze) * 100;
    let statusLabel = 'Bloqueado';
    const isUnlocked = Boolean(unlockedTier);

    if (unlockedTier === 'ouro') {
      target = cfg.ouro;
      progressText = `${Math.min(count, target)}/${target} (Máximo)`;
      percent = 100;
      statusLabel = 'Nível Ouro 🏆';
    } else if (unlockedTier === 'prata') {
      target = cfg.ouro;
      progressText = `${count}/${target} para Ouro`;
      percent = (count / target) * 100;
      statusLabel = 'Nível Prata 🥈';
    } else if (unlockedTier === 'bronze') {
      target = cfg.prata;
      progressText = `${count}/${target} para Prata`;
      percent = (count / target) * 100;
      statusLabel = 'Nível Bronze 🥉';
    }

    return {
      title: cfg.title,
      icon: cfg.icon,
      colorBg: cfg.colorBg,
      colorText: cfg.colorText,
      desc: cfg.desc,
      progressText,
      progressPercent: Math.min(100, Math.max(0, percent)),
      statusLabel,
      isUnlocked,
    };
  };

  const semeadorData = useMemo(() => {
    const count = Number(progress.blogPostCount || progress.semeador || 0);
    return getProgressBadgeData('semeador', count, badges.semeador);
  }, [progress, badges]);

  const vozAtivaData = useMemo(() => {
    const count = Number(progress.forumActivityCount || progress.vozAtiva || 0);
    return getProgressBadgeData('voz_ativa', count, badges.voz_ativa);
  }, [progress, badges]);

  const conselheiroData = useMemo(() => {
    const count = Number(progress.answerCount || progress.conselheiro || 0);
    return getProgressBadgeData('conselheiro', count, badges.conselheiro);
  }, [progress, badges]);

  const autenticoUnlocked = Boolean(isProfileComplete || badges.autentico);
  const pioneiroUnlocked = Boolean(badges.pioneiro);

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadJornadaData(true)}
            colors={['#1B4332']}
            tintColor="#1B4332"
          />
        }
      >
        {/* HEADER PRINCIPAL */}
        <View className="mx-6 mt-6 mb-6 bg-[#1B4332] p-[22px] rounded-[16px] shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
          <View className="flex-row items-center mb-2">
            <TouchableOpacity
              onPress={handleBack}
              className="w-10 h-10 bg-white/20 rounded-full items-center justify-center mr-4"
              activeOpacity={0.8}
            >
              <Feather name="arrow-left" size={20} color="white" />
            </TouchableOpacity>
            <Text className="font-title text-[24px] text-white leading-tight flex-1">
              Sua Jornada 🚀
            </Text>
          </View>
          <Text className="font-sans text-[15px] text-white/85 mt-2 leading-relaxed">
            Acompanhe seu crescimento, desbloqueie conquistas e destaque-se na plataforma!
          </Text>
        </View>

        {/* WIDGET 1: SUA EVOLUÇÃO */}
        <View className="mx-6 mb-6 bg-white border border-[#e5e7eb] rounded-[20px] p-5 shadow-sm">
          <View className="flex-row items-center justify-between mb-5">
            <View className="flex-row items-center">
              <View className="w-[45px] h-[45px] bg-[#e8f5e9] rounded-[12px] items-center justify-center mr-3">
                <Text className="text-[20px]">📈</Text>
              </View>
              <Text className="font-title text-[#1B4332] text-[20px]">Sua Evolução</Text>
            </View>
            <View className="bg-[#f8fafc] border border-[#f1f5f9] px-3.5 py-1.5 rounded-full">
              <Text className="font-sans font-bold text-[#1B4332] text-[13px]">
                {currentLevel.label}
              </Text>
            </View>
          </View>

          {/* Barra de Progresso de XP */}
          <View className="mb-4">
            <View className="h-[16px] bg-[#f1f5f9] rounded-full overflow-hidden mb-2">
              <View
                className="h-full rounded-full bg-[#10b981]"
                style={{ width: `${progressPercent}%` }}
              />
            </View>
            <View className="flex-row justify-between items-center">
              <Text className="font-sans font-semibold text-[#64748b] text-[12px]">
                {currentLevel.label}
              </Text>
              <Text className="font-sans font-extrabold text-[#0f172a] text-[13px]">
                {userXp} // {nextLevel.min} XP
              </Text>
              <Text className="font-sans font-semibold text-[#64748b] text-[12px]">
                {nextLevel.label}
              </Text>
            </View>
          </View>

          {/* Painel de Próximo Marco */}
          <View className="bg-[#f8fafc] border border-[#f1f5f9] p-4 rounded-[14px] flex-row items-center">
            <Text className="text-[28px] mr-3">🎯</Text>
            <View className="flex-1">
              <Text className="font-sans font-bold text-[#334155] text-[14px] mb-0.5">
                Seu próximo marco:
              </Text>
              <Text className="font-sans text-[#64748b] text-[13px] leading-relaxed">
                {nextMilestoneText}
              </Text>
            </View>
          </View>
        </View>

        {/* WIDGET 2: ESPECTRO DE NÍVEIS (NOVO NO APP - ALINHADO À WEB) */}
        <View className="mx-6 mb-6 bg-white border border-[#e5e7eb] rounded-[20px] p-5 shadow-sm">
          <View className="flex-row items-center mb-5">
            <View className="w-[36px] h-[36px] bg-[#e8f5e9] rounded-[10px] items-center justify-center mr-3">
              <Text className="text-[18px]">📊</Text>
            </View>
            <Text className="font-title text-[#1B4332] text-[18px]">Espectro de Níveis</Text>
          </View>

          <View className="relative flex-row justify-between items-start pt-1">
            {/* Linha de Conexão */}
            <View
              style={{
                position: 'absolute',
                top: 20,
                left: 20,
                right: 20,
                height: 3,
                backgroundColor: '#f1f5f9',
                zIndex: 1,
              }}
            />

            {LEVELS.map((lvl) => {
              const isCurrent = lvl.slug === currentLevel.slug;
              const isPassed = userXp >= lvl.min;

              return (
                <View key={lvl.slug} className="items-center z-10" style={{ width: 60 }}>
                  <View
                    className={`w-[36px] h-[36px] rounded-full items-center justify-center mb-2 border-2 ${
                      isCurrent
                        ? 'bg-[#1B4332] border-[#1B4332] shadow-md'
                        : isPassed
                        ? 'bg-[#e8f5e9] border-[#16a34a]'
                        : lvl.level === 5
                        ? 'bg-[#fef3c7] border-[#fde68a]'
                        : 'bg-white border-[#e2e8f0]'
                    }`}
                  >
                    {lvl.level === 5 ? (
                      <Text className="text-[16px]">👑</Text>
                    ) : isPassed && !isCurrent ? (
                      <Feather name="check" size={16} color="#16a34a" />
                    ) : (
                      <Text
                        className={`font-sans font-bold text-[13px] ${
                          isCurrent
                            ? 'text-white'
                            : isPassed
                            ? 'text-[#16a34a]'
                            : 'text-[#94a3b8]'
                        }`}
                      >
                        {lvl.level}
                      </Text>
                    )}
                  </View>
                  <Text
                    className={`font-sans text-center text-[11px] leading-tight mb-0.5 ${
                      isCurrent
                        ? 'font-bold text-[#1B4332]'
                        : isPassed
                        ? 'font-semibold text-[#334155]'
                        : 'text-[#64748b]'
                    }`}
                    numberOfLines={1}
                  >
                    {lvl.short}
                  </Text>
                  <Text className="font-sans text-center text-[10px] text-[#94a3b8]">
                    {lvl.xpLabel}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* WIDGET 3: COMO GANHAR XP? (8 FORMAS COMPLETAS DA VERSÃO WEB) */}
        <View className="mx-6 mb-6">
          <View className="flex-row items-center mb-4">
            <View className="w-[36px] h-[36px] bg-[#fef3c7] rounded-[10px] items-center justify-center mr-3">
              <Text className="text-[18px]">⭐</Text>
            </View>
            <Text className="font-title text-[#1B4332] text-[18px]">Como ganhar XP?</Text>
          </View>

          <View className="flex-row flex-wrap justify-between">
            {XP_WAYS.map((item) => (
              <View
                key={item.title}
                className="w-[48%] bg-white border border-[#e5e7eb] rounded-[16px] p-3.5 mb-3 shadow-[0_2px_6px_rgba(0,0,0,0.02)]"
              >
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-[22px]">{item.icon}</Text>
                  <View className="bg-[#f0fdf4] px-2 py-0.5 rounded-full">
                    <Text className="font-sans font-extrabold text-[#10b981] text-[12px]">
                      +{item.xp} XP
                    </Text>
                  </View>
                </View>
                <Text
                  className="font-sans font-bold text-[#334155] text-[13px] mb-0.5"
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <Text className="font-sans text-[#94a3b8] text-[11px]">{item.desc || 'Por ação'}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* WIDGET 4: CONQUISTAS (TODAS AS 5 BADGES OFICIAIS DA VERSÃO WEB) */}
        <View className="mx-6 mb-6">
          <View className="flex-row items-center mb-4">
            <View className="w-[36px] h-[36px] bg-[#f3e8ff] rounded-[10px] items-center justify-center mr-3">
              <Text className="text-[18px]">🏆</Text>
            </View>
            <Text className="font-title text-[#1B4332] text-[18px]">Conquistas</Text>
          </View>

          {/* 1. Semeador */}
          <AchievementCard {...semeadorData} />

          {/* 2. Voz Ativa */}
          <AchievementCard {...vozAtivaData} />

          {/* 3. Conselheiro */}
          <AchievementCard {...conselheiroData} />

          {/* 4. Autêntico */}
          <AchievementCard
            icon={BADGE_CONFIG.autentico.icon}
            colorBg={BADGE_CONFIG.autentico.colorBg}
            colorText={BADGE_CONFIG.autentico.colorText}
            title={BADGE_CONFIG.autentico.title}
            desc={BADGE_CONFIG.autentico.desc}
            progressText={autenticoUnlocked ? '1/1' : '0/1'}
            progressPercent={autenticoUnlocked ? 100 : 0}
            statusLabel={autenticoUnlocked ? 'Conquistado 🎉' : 'Bloqueado'}
            isUnlocked={autenticoUnlocked}
          />

          {/* 5. Pioneiro (NOVO NO APP - ALINHADO À WEB) */}
          <AchievementCard
            icon={BADGE_CONFIG.pioneiro.icon}
            colorBg={BADGE_CONFIG.pioneiro.colorBg}
            colorText={BADGE_CONFIG.pioneiro.colorText}
            title={BADGE_CONFIG.pioneiro.title}
            desc={BADGE_CONFIG.pioneiro.desc}
            progressText={pioneiroUnlocked ? '1/1' : '0/1'}
            progressPercent={pioneiroUnlocked ? 100 : 0}
            statusLabel={pioneiroUnlocked ? 'Conquistado 🎉' : 'Legado'}
            isUnlocked={pioneiroUnlocked}
          />
        </View>
      </ScrollView>
    </View>
  );
}
