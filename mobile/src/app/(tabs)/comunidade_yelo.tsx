import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Linking,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import Svg, { Path, Polygon, Polyline, Line } from 'react-native-svg';
import YeloScrollView from '../../components/YeloScrollView';
import YeloToast from '../../components/YeloToast';

// Chave para armazenamento persistente dos interesses votados
const HUB_INTERESTS_STORAGE_KEY = 'yelo_hub_interests';

// Definição dos 4 pilares oficiais da Comunidade Yelo
const PILLARS_DATA = [
  {
    id: 'cafes',
    emoji: '☕',
    badge: 'Presencial & Local',
    title: 'Grupos & Cafés Clínicos',
    description:
      'Encontros periódicos presenciais em cafés e hubs terapêuticos parceiros por cidade ou região. Para criar laços reais, trocar vivências e construir parcerias duradouras.',
    highlights: [
      'Conexão face a face no seu polo regional',
      'Cultura de cooperação mútua sem competição',
      'Fortalecimento da rede de encaminhamentos',
    ],
    tagPill: '📍 Encontros Regionais',
    status: 'Em breve',
  },
  {
    id: 'intervisao',
    emoji: '🧠',
    badge: 'Troca Horizontal',
    title: 'Grupos de Intervisão',
    description:
      'Círculos seguros e acolhedores entre colegas psicólogos para discussão de casos anonimizados, alinhamento ético e suporte emocional para quem cuida.',
    highlights: [
      'Grupos reduzidos (6 a 8 profissionais)',
      'Sigilo inegociável e ambiente de não-julgamento',
      'Oxigenação da escuta e visão diagnóstica',
    ],
    tagPill: '💬 Troca entre Pares',
    status: 'Em breve',
  },
  {
    id: 'supervisao',
    emoji: '🧭',
    badge: 'Orientação Sênior',
    title: 'Supervisão com Especialistas',
    description:
      'Sessões orientadas por psicólogos com vasta bagagem clínica nas principais abordagens (TCC, Psicanálise, Fenomenologia, ACT, Sistêmica, Humanismo e mais).',
    highlights: [
      'Supervisores selecionados por referência clínica',
      'Suporte em tomadas de decisões complexas',
      'Formatos individuais e turmas exclusivas',
    ],
    tagPill: '⭐ Mestres & Supervisores',
    status: 'Em breve',
  },
  {
    id: 'workshops',
    emoji: '💡',
    badge: 'Formação Contínua',
    title: 'Workshops & Masterclasses',
    description:
      'Aulas imersivas focadas na prática com convidados renomados: manejo de crises agudas, precificação sustentável, transição de carreira e ferramentas contemporâneas.',
    highlights: [
      'Casos reais destrinchados passo a passo',
      'Fichas de intervenção e materiais prontos',
      'Certificados de horas de aperfeiçoamento',
    ],
    tagPill: '🎯 Prática Aplicada',
    status: 'Em breve',
  },
];

// Opções de votação interativa
const VOTE_OPTIONS = [
  {
    key: 'presencial',
    emoji: '☕',
    label: 'Encontros presenciais na minha região',
    title: 'Encontros Presenciais',
  },
  {
    key: 'intervisao',
    emoji: '🧠',
    label: 'Grupos de intervisão entre colegas',
    title: 'Grupos de Intervisão',
  },
  {
    key: 'supervisao',
    emoji: '🧭',
    label: 'Supervisão clínica com especialistas',
    title: 'Supervisão Clínica',
  },
  {
    key: 'workshops',
    emoji: '💡',
    label: 'Workshops e masterclasses práticas',
    title: 'Workshops Práticos',
  },
];

export default function ComunidadeYeloScreen() {
  const router = useRouter();

  // Estado dos interesses votados
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  // Mensagem toast temporária
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Animação do ponto pulsante verde no Hero
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    // Loop de pulsação suave idêntico ao `@keyframes hubPulse` do web
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.35,
            duration: 1100,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.2,
            duration: 1100,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.7,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    pulseLoop.start();

    return () => {
      pulseLoop.stop();
    };
  }, [pulseAnim, pulseOpacity]);

  // Carrega votos salvos no SecureStore ao montar o componente
  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(HUB_INTERESTS_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setSelectedInterests(parsed);
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar preferências de interesse:', err);
      }
    })();
  }, []);

  // Mostra toast animado na tela
  const showToast = (message: string) => {
    setToastMessage(message);
  };

  // Alterna o interesse da votação e salva no SecureStore
  const toggleInterest = async (key: string, title: string) => {
    let next: string[];
    const isAdding = !selectedInterests.includes(key);

    if (isAdding) {
      next = [...selectedInterests, key];
      showToast(`Interesse registrado em "${title}"! Priorizaremos essa iniciativa ✨`);
    } else {
      next = selectedInterests.filter((item) => item !== key);
    }

    setSelectedInterests(next);

    try {
      await SecureStore.setItemAsync(HUB_INTERESTS_STORAGE_KEY, JSON.stringify(next));
    } catch (err) {
      console.warn('Erro ao salvar voto local:', err);
    }
  };

  // Abre conversa do WhatsApp da Equipe Yelo
  const handleContactWhatsApp = () => {
    const message = encodeURIComponent(
      'Olá equipe Yelo! Tenho interesse em conduzir supervisão ou organizar um encontro presencial na Comunidade Yelo.'
    );
    const url = `https://wa.me/5511988887723?text=${message}`;
    Linking.openURL(url).catch((err) => {
      console.warn('Não foi possível abrir o WhatsApp:', err);
    });
  };

  return (
    <View style={styles.screenContainer}>
      {/* TOAST FLUTUANTE ESTILO WHATSAPP (DE BAIXO PRA CIMA) */}
      <YeloToast message={toastMessage} onDismiss={() => setToastMessage(null)} />

      <YeloScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* NAVEGAÇÃO DE RETORNO (hub-nav-header) */}
        <View style={styles.navHeader}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
              <Line x1="19" y1="12" x2="5" y2="12" stroke="#334155" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              <Polyline points="12 19 5 12 12 5" stroke="#334155" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.backBtnText}>Voltar para Evolução</Text>
          </TouchableOpacity>
        </View>

        {/* 1. HERO PRINCIPAL DE APRESENTAÇÃO & ANTECIPAÇÃO (hub-hero-card) */}
        <LinearGradient
          colors={['#1B4332', '#2D6A4F', '#153928']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          {/* Círculos decorativos de gradiente radial de fundo */}
          <View style={styles.heroGlowTopRight} pointerEvents="none" />
          <View style={styles.heroGlowBottomLeft} pointerEvents="none" />

          <View style={styles.heroContent}>
            {/* Pill de Categoria */}
            <View style={styles.heroPill}>
              <Text style={styles.heroPillEmoji}>🌿</Text>
              <Text style={styles.heroPillText}>COMUNIDADE CLÍNICA YELO</Text>
            </View>

            {/* Título Principal */}
            <Text style={styles.heroTitle}>
              Encontros, Intervisão & Supervisão Clínica
            </Text>

            {/* Descrição */}
            <Text style={styles.heroDescription}>
              A prática clínica não precisa ser um caminho solitário. Estamos construindo um ecossistema seguro de trocas reais para você se conectar com colegas, discutir casos com sigilo, aprofundar seu manejo técnico e fortalecer sua rede de apoio profissional.
            </Text>

            {/* Status Box com ponto pulsante */}
            <View style={styles.heroStatusBox}>
              <View style={styles.pulseContainer}>
                <Animated.View
                  style={[
                    styles.pulseRing,
                    {
                      transform: [{ scale: pulseAnim }],
                      opacity: pulseOpacity,
                    },
                  ]}
                />
                <View style={styles.pulseCoreDot} />
              </View>
              <Text style={styles.heroStatusText}>
                Em estruturação ativa •{' '}
                <Text style={styles.heroStatusHighlight}>
                  Acesso antecipado em breve aos membros
                </Text>
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* 2. CABEÇALHO DA SEÇÃO DE RECURSOS (hub-section-header) */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTagRow}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Polygon
                points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                stroke="#1B4332"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text style={styles.sectionTagText}>O QUE ESTÁ CHEGANDO PARA VOCÊ</Text>
          </View>
          <Text style={styles.sectionTitle}>Os 4 Pilares da Nova Comunidade</Text>
          <Text style={styles.sectionSubtitle}>
            Formatos pensados sob medida para responder às reais necessidades do dia a dia do psicólogo.
          </Text>
        </View>

        {/* 3. GRID DOS 4 PILARES (hub-pillars-grid) */}
        <View style={styles.pillarsList}>
          {PILLARS_DATA.map((pillar) => (
            <View key={pillar.id} style={styles.pillarCard}>
              {/* Barra superior de acentuação sutil */}
              <LinearGradient
                colors={['#1B4332', '#52B788']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.pillarAccentTop}
              />

              <View style={styles.pillarBody}>
                {/* Linha de Topo do Card */}
                <View style={styles.pillarTopRow}>
                  <View style={styles.pillarIconBox}>
                    <Text style={styles.pillarEmoji}>{pillar.emoji}</Text>
                  </View>
                  <View style={styles.pillarBadge}>
                    <Text style={styles.pillarBadgeText}>{pillar.badge}</Text>
                  </View>
                </View>

                {/* Título do Pilar */}
                <Text style={styles.pillarTitle}>{pillar.title}</Text>

                {/* Descrição */}
                <Text style={styles.pillarDesc}>{pillar.description}</Text>

                {/* Lista de Highlights com Ícone de Check */}
                <View style={styles.pillarHighlights}>
                  {pillar.highlights.map((item, idx) => (
                    <View key={idx} style={styles.highlightRow}>
                      <View style={styles.highlightCheckIcon}>
                        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                          <Polyline
                            points="20 6 9 17 4 12"
                            stroke="#10B981"
                            strokeWidth={2.8}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </Svg>
                      </View>
                      <Text style={styles.highlightText}>{item}</Text>
                    </View>
                  ))}
                </View>

                {/* Rodapé do Card */}
                <View style={styles.pillarFooter}>
                  <View style={styles.pillarTagPill}>
                    <Text style={styles.pillarTagPillText}>{pillar.tagPill}</Text>
                  </View>
                  <Text style={styles.pillarState}>{pillar.status}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* 4. VOTAÇÃO INTERATIVA: O QUE VOCÊ MAIS GOSTARIA DE VER PRIMEIRO? (hub-interactive-card) */}
        <View style={styles.interactiveCard}>
          <View style={styles.interactiveHeader}>
            <View style={styles.voteBadge}>
              <Text style={{ fontSize: 13, marginRight: 5 }}>🗳️</Text>
              <Text style={styles.voteBadgeText}>Pesquisa da Comunidade</Text>
            </View>
            <Text style={styles.interactiveTitle}>
              O que você mais gostaria de ver primeiro? 🤔
            </Text>
            <Text style={styles.interactiveSubtitle}>
              Ajude a nossa equipe a priorizar o cronograma de lançamentos. Selecione as iniciativas que fariam maior diferença para a sua rotina clínica neste momento:
            </Text>
          </View>

          {/* Opções de Votação com Toggle Interativo */}
          <View style={styles.voteOptionsList}>
            {VOTE_OPTIONS.map((opt) => {
              const isSelected = selectedInterests.includes(opt.key);
              return (
                <TouchableOpacity
                  key={opt.key}
                  activeOpacity={0.75}
                  onPress={() => toggleInterest(opt.key, opt.title)}
                  style={[
                    styles.voteOptionBtn,
                    isSelected && styles.voteOptionBtnSelected,
                  ]}
                >
                  <View style={styles.voteInfo}>
                    <Text style={styles.voteEmoji}>{opt.emoji}</Text>
                    <Text
                      style={[
                        styles.voteLabel,
                        isSelected && styles.voteLabelSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.voteCheck,
                      isSelected && styles.voteCheckSelected,
                    ]}
                  >
                    {isSelected ? (
                      <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                        <Polyline
                          points="20 6 9 17 4 12"
                          stroke="#FFFFFF"
                          strokeWidth={3}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </Svg>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 5. BANNER DE PARCERIA / LIDERANÇA DE GRUPOS (hub-host-banner) */}
        <LinearGradient
          colors={['#F0FDF4', '#ECFDF5', '#FEFCE8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hostBanner}
        >
          <View style={styles.hostPill}>
            <Text style={styles.hostPillText}>⭐ CONVITE ESPECIAL PARA COLEGAS</Text>
          </View>

          <Text style={styles.hostTitle}>
            Deseja conduzir uma supervisão ou sugerir um encontro local?
          </Text>

          <Text style={styles.hostDesc}>
            Se você é um psicólogo sênior interessado em liderar supervisões ou deseja ser um facilitador de encontros presenciais na sua cidade, a Yelo apoia e fornece a estrutura para você conectar outros profissionais.
          </Text>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleContactWhatsApp}
            style={styles.ctaBtn}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
                stroke="#FFFFFF"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text style={styles.ctaBtnText}>Falar com a Equipe Yelo</Text>
          </TouchableOpacity>
        </LinearGradient>
      </YeloScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 130, // Garante que a barra inferior de navegação não encubra o conteúdo
  },

  // Botão Voltar Topo (hub-back-btn)
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 14,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 50,
    paddingVertical: 8,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  backBtnText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#334155',
  },

  // Hero Principal (hub-hero-card)
  heroCard: {
    borderRadius: 22,
    padding: 24,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#1B4332',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  heroGlowTopRight: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255, 238, 140, 0.12)',
  },
  heroGlowBottomLeft: {
    position: 'absolute',
    bottom: -60,
    left: 20,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(82, 183, 136, 0.18)',
  },
  heroContent: {
    position: 'relative',
    zIndex: 2,
  },
  heroPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    paddingVertical: 5,
    paddingHorizontal: 13,
    borderRadius: 50,
    marginBottom: 14,
  },
  heroPillEmoji: {
    fontSize: 13,
  },
  heroPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFEE8C',
    letterSpacing: 0.4,
  },
  heroTitle: {
    fontFamily: 'NewKansas-Bold',
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 31,
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  heroDescription: {
    fontSize: 14.5,
    lineHeight: 22,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 18,
  },
  heroStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  pulseContainer: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  pulseRing: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#52B788',
  },
  pulseCoreDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#52B788',
  },
  heroStatusText: {
    flex: 1,
    fontSize: 12.5,
    color: '#FFFFFF',
    fontWeight: '600',
    lineHeight: 17,
  },
  heroStatusHighlight: {
    color: '#FFEE8C',
    fontWeight: '700',
  },

  // Cabeçalho da Seção (hub-section-header)
  sectionHeader: {
    marginBottom: 16,
    marginTop: 4,
  },
  sectionTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  sectionTagText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#1B4332',
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontFamily: 'NewKansas-Bold',
    fontSize: 21,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 27,
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },

  // Lista dos 4 Pilares (hub-pillars-grid)
  pillarsList: {
    gap: 16,
    marginBottom: 24,
  },
  pillarCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  pillarAccentTop: {
    height: 3.5,
    width: '100%',
  },
  pillarBody: {
    padding: 20,
  },
  pillarTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  pillarIconBox: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillarEmoji: {
    fontSize: 24,
  },
  pillarBadge: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 50,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillarBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  pillarTitle: {
    fontFamily: 'NewKansas-Bold',
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 24,
    marginBottom: 8,
  },
  pillarDesc: {
    fontSize: 13.8,
    lineHeight: 21,
    color: '#475569',
    marginBottom: 16,
  },
  pillarHighlights: {
    gap: 8,
    marginBottom: 18,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  highlightCheckIcon: {
    marginTop: 2,
  },
  highlightText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#334155',
    lineHeight: 18,
  },
  pillarFooter: {
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pillarTagPill: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 50,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillarTagPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  pillarState: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },

  // Card de Votação Interativa (hub-interactive-card)
  interactiveCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  interactiveHeader: {
    marginBottom: 18,
  },
  voteBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEFCE8',
    borderWidth: 1,
    borderColor: '#FEF08A',
    borderRadius: 50,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  voteBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#854D0E',
  },
  interactiveTitle: {
    fontFamily: 'NewKansas-Bold',
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 24,
    marginBottom: 6,
  },
  interactiveSubtitle: {
    fontSize: 13.5,
    color: '#64748B',
    lineHeight: 20,
  },
  voteOptionsList: {
    gap: 12,
  },
  voteOptionBtn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  voteOptionBtnSelected: {
    backgroundColor: '#F0FDF4',
    borderColor: '#10B981',
  },
  voteInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  voteEmoji: {
    fontSize: 20,
  },
  voteLabel: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E293B',
    lineHeight: 19,
  },
  voteLabelSelected: {
    color: '#166534',
  },
  voteCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteCheckSelected: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },

  // Banner de Parceria / WhatsApp (hub-host-banner)
  hostBanner: {
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    borderRadius: 20,
    padding: 22,
    shadowColor: '#166534',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  hostPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 50,
    marginBottom: 10,
  },
  hostPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#166534',
    letterSpacing: 0.4,
  },
  hostTitle: {
    fontFamily: 'NewKansas-Bold',
    fontSize: 18,
    fontWeight: '800',
    color: '#14532D',
    lineHeight: 24,
    marginBottom: 8,
  },
  hostDesc: {
    fontSize: 13.5,
    lineHeight: 20,
    color: '#374151',
    marginBottom: 18,
  },
  ctaBtn: {
    backgroundColor: '#1B4332',
    borderRadius: 50,
    paddingVertical: 13,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#1B4332',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  ctaBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
