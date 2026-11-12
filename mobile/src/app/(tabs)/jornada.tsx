import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StyleSheet,
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
  <View
    style={{
      backgroundColor: '#ffffff',
      borderWidth: 1,
      borderColor: '#e5e7eb',
      borderRadius: 20,
      padding: 18,
      marginBottom: 14,
      shadowColor: '#000',
      shadowOpacity: 0.02,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    }}
  >
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
      <View
        style={{
          width: 48,
          height: 48,
          backgroundColor: colorBg,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 14,
        }}
      >
        <Text style={{ fontSize: 24 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
          <Text style={{ fontFamily: 'sans-serif', fontWeight: 'bold', fontSize: 16, color: '#1B4332' }}>
            {title}
          </Text>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 3,
              borderRadius: 999,
              backgroundColor: isUnlocked ? '#f0fdf4' : '#f1f5f9',
              borderWidth: 1,
              borderColor: isUnlocked ? '#bbf7d0' : '#e2e8f0',
            }}
          >
            <Text
              style={{
                fontFamily: 'sans-serif',
                fontWeight: '700',
                fontSize: 11,
                color: isUnlocked ? '#166534' : '#64748b',
                textTransform: 'uppercase',
              }}
            >
              {statusLabel}
            </Text>
          </View>
        </View>
        <Text style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#64748b', lineHeight: 16 }}>
          {desc}
        </Text>
      </View>
    </View>

    {/* Barra de Progresso com altura e largura explícitas */}
    <View
      style={{
        height: 8,
        width: '100%',
        backgroundColor: '#f1f5f9',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 6,
      }}
    >
      <View
        style={{
          height: 8,
          width: `${Math.max(0, Math.min(100, progressPercent))}%`,
          backgroundColor: isUnlocked ? colorText : '#94a3b8',
          borderRadius: 4,
        }}
      />
    </View>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ fontFamily: 'sans-serif', fontWeight: '600', fontSize: 11, color: '#888' }}>
        Progresso
      </Text>
      <Text style={{ fontFamily: 'sans-serif', fontWeight: '700', fontSize: 12, color: '#334155' }}>
        {progressText}
      </Text>
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
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScrollView
        style={{ flex: 1 }}
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
        <View
          style={{
            marginHorizontal: 20,
            marginTop: 20,
            marginBottom: 20,
            backgroundColor: '#1B4332',
            padding: 22,
            borderRadius: 16,
            shadowColor: '#000',
            shadowOpacity: 0.05,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <TouchableOpacity
              onPress={handleBack}
              style={{
                width: 40,
                height: 40,
                backgroundColor: 'rgba(255,255,255,0.2)',
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 14,
              }}
              activeOpacity={0.8}
            >
              <Feather name="arrow-left" size={20} color="white" />
            </TouchableOpacity>
            <Text style={{ fontFamily: 'sans-serif', fontWeight: 'bold', fontSize: 24, color: '#ffffff', flex: 1 }}>
              Sua Jornada 🚀
            </Text>
          </View>
          <Text style={{ fontFamily: 'sans-serif', fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 21 }}>
            Acompanhe seu crescimento, desbloqueie conquistas e destaque-se na plataforma!
          </Text>
        </View>

        {/* WIDGET 1: SUA EVOLUÇÃO */}
        <View
          style={{
            marginHorizontal: 20,
            marginBottom: 20,
            backgroundColor: '#ffffff',
            borderWidth: 1,
            borderColor: '#e5e7eb',
            borderRadius: 20,
            padding: 20,
            shadowColor: '#000',
            shadowOpacity: 0.02,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  backgroundColor: '#e8f5e9',
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Text style={{ fontSize: 20 }}>📈</Text>
              </View>
              <Text style={{ fontFamily: 'sans-serif', fontWeight: 'bold', fontSize: 19, color: '#1B4332' }}>
                Sua Evolução
              </Text>
            </View>
            <View
              style={{
                backgroundColor: '#f8fafc',
                borderWidth: 1,
                borderColor: '#f1f5f9',
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 999,
              }}
            >
              <Text style={{ fontFamily: 'sans-serif', fontWeight: 'bold', fontSize: 13, color: '#1B4332' }}>
                {currentLevel.label}
              </Text>
            </View>
          </View>

          {/* Barra de Progresso de XP - Dimensões rígidas com height explícito */}
          <View style={{ marginBottom: 16 }}>
            <View
              style={{
                height: 16,
                width: '100%',
                backgroundColor: '#f1f5f9',
                borderRadius: 8,
                overflow: 'hidden',
                marginBottom: 8,
              }}
            >
              <View
                style={{
                  height: 16,
                  width: `${Math.max(2, Math.min(100, progressPercent))}%`,
                  backgroundColor: '#10b981',
                  borderRadius: 8,
                }}
              />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontFamily: 'sans-serif', fontWeight: '600', fontSize: 12, color: '#64748b' }}>
                {currentLevel.label}
              </Text>
              <Text style={{ fontFamily: 'sans-serif', fontWeight: '800', fontSize: 13, color: '#0f172a' }}>
                {userXp} // {nextLevel.min} XP
              </Text>
              <Text style={{ fontFamily: 'sans-serif', fontWeight: '600', fontSize: 12, color: '#64748b' }}>
                {nextLevel.label}
              </Text>
            </View>
          </View>

          {/* Painel de Próximo Marco */}
          <View
            style={{
              backgroundColor: '#f8fafc',
              borderWidth: 1,
              borderColor: '#f1f5f9',
              padding: 14,
              borderRadius: 14,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 26, marginRight: 12 }}>🎯</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'sans-serif', fontWeight: 'bold', fontSize: 13, color: '#334155', marginBottom: 2 }}>
                Seu próximo marco:
              </Text>
              <Text style={{ fontFamily: 'sans-serif', fontSize: 12.5, color: '#64748b', lineHeight: 18 }}>
                {nextMilestoneText}
              </Text>
            </View>
          </View>
        </View>

        {/* WIDGET 2: ESPECTRO DE NÍVEIS (ALINHADO À VERSÃO WEB) */}
        <View
          style={{
            marginHorizontal: 20,
            marginBottom: 20,
            backgroundColor: '#ffffff',
            borderWidth: 1,
            borderColor: '#e5e7eb',
            borderRadius: 20,
            padding: 20,
            shadowColor: '#000',
            shadowOpacity: 0.02,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
            <View
              style={{
                width: 36,
                height: 36,
                backgroundColor: '#e8f5e9',
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 10,
              }}
            >
              <Text style={{ fontSize: 18 }}>📊</Text>
            </View>
            <Text style={{ fontFamily: 'sans-serif', fontWeight: 'bold', fontSize: 18, color: '#1B4332' }}>
              Espectro de Níveis
            </Text>
          </View>

          <View style={{ position: 'relative', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 4 }}>
            {/* Linha de Conexão Horizontal */}
            <View
              style={{
                position: 'absolute',
                top: 21,
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
                <View key={lvl.slug} style={{ alignItems: 'center', zIndex: 10, width: 56 }}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 6,
                      borderWidth: 2,
                      borderColor: isCurrent ? '#1B4332' : isPassed ? '#16a34a' : lvl.level === 5 ? '#fde68a' : '#e2e8f0',
                      backgroundColor: isCurrent ? '#1B4332' : isPassed ? '#e8f5e9' : lvl.level === 5 ? '#fef3c7' : '#ffffff',
                      shadowColor: isCurrent ? '#1B4332' : 'transparent',
                      shadowOpacity: isCurrent ? 0.25 : 0,
                      shadowRadius: 4,
                      shadowOffset: { width: 0, height: 2 },
                    }}
                  >
                    {lvl.level === 5 ? (
                      <Text style={{ fontSize: 16 }}>👑</Text>
                    ) : isPassed && !isCurrent ? (
                      <Feather name="check" size={16} color="#16a34a" />
                    ) : (
                      <Text
                        style={{
                          fontFamily: 'sans-serif',
                          fontWeight: 'bold',
                          fontSize: 13,
                          color: isCurrent ? '#ffffff' : isPassed ? '#16a34a' : '#94a3b8',
                        }}
                      >
                        {lvl.level}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={{
                      fontFamily: 'sans-serif',
                      fontSize: 10.5,
                      textAlign: 'center',
                      fontWeight: isCurrent ? '700' : isPassed ? '600' : '400',
                      color: isCurrent ? '#1B4332' : isPassed ? '#334155' : '#64748b',
                      marginBottom: 2,
                    }}
                    numberOfLines={1}
                  >
                    {lvl.short}
                  </Text>
                  <Text style={{ fontFamily: 'sans-serif', fontSize: 10, color: '#94a3b8', textAlign: 'center' }}>
                    {lvl.xpLabel}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* WIDGET 3: COMO GANHAR XP? (TODOS OS 8 CARDS OFICIAIS) */}
        <View style={{ marginHorizontal: 20, marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <View
              style={{
                width: 36,
                height: 36,
                backgroundColor: '#fef3c7',
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 10,
              }}
            >
              <Text style={{ fontSize: 18 }}>⭐</Text>
            </View>
            <Text style={{ fontFamily: 'sans-serif', fontWeight: 'bold', fontSize: 18, color: '#1B4332' }}>
              Como ganhar XP?
            </Text>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {XP_WAYS.map((item) => (
              <View
                key={item.title}
                style={{
                  width: '48%',
                  backgroundColor: '#ffffff',
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                  borderRadius: 16,
                  padding: 14,
                  marginBottom: 12,
                  shadowColor: '#000',
                  shadowOpacity: 0.02,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 2 },
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ fontSize: 22 }}>{item.icon}</Text>
                  <View style={{ backgroundColor: '#f0fdf4', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 }}>
                    <Text style={{ fontFamily: 'sans-serif', fontWeight: '800', color: '#10b981', fontSize: 11.5 }}>
                      +{item.xp} XP
                    </Text>
                  </View>
                </View>
                <Text
                  style={{ fontFamily: 'sans-serif', fontWeight: 'bold', color: '#334155', fontSize: 13, marginBottom: 2 }}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <Text style={{ fontFamily: 'sans-serif', fontSize: 11, color: '#94a3b8' }}>
                  {item.desc || 'Por ação'}
                </Text>
              </View>
            ))}
          </View>
          <View
            style={{
              backgroundColor: '#f0fdf4',
              borderWidth: 1,
              borderColor: '#bbf7d0',
              borderRadius: 14,
              padding: 12,
              marginTop: 4,
            }}
          >
            <Text style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#166534', lineHeight: 18 }}>
              🛡️ <Text style={{ fontWeight: 'bold' }}>Equilíbrio e Transparência:</Text> Todas as ações seguem limites diários justos (no Blog é permitido 1 artigo por dia para preservar a página do Blog). Seu XP fortalece sua autoridade sem alterar o equilíbrio clínico do Match.
            </Text>
          </View>
        </View>

        {/* WIDGET 4: CONQUISTAS (TODAS AS 5 BADGES OFICIAIS) */}
        <View style={{ marginHorizontal: 20, marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <View
              style={{
                width: 36,
                height: 36,
                backgroundColor: '#f3e8ff',
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 10,
              }}
            >
              <Text style={{ fontSize: 18 }}>🏆</Text>
            </View>
            <Text style={{ fontFamily: 'sans-serif', fontWeight: 'bold', fontSize: 18, color: '#1B4332' }}>
              Conquistas
            </Text>
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

          {/* 5. Pioneiro */}
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
