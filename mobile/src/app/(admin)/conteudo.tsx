import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import api from '../../services/api';

interface HubCardProps {
  title: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
  iconBg: string;
  accentColor: string;
  tags: string[];
  badge?: string;
  badgeBg?: string;
  badgeColor?: string;
  onPress: () => void;
}

function HubContentCard({
  title,
  description,
  icon,
  iconColor,
  iconBg,
  accentColor,
  tags,
  badge,
  badgeBg = '#f1f5f9',
  badgeColor = '#64748b',
  onPress,
}: HubCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={{
        backgroundColor: '#ffffff',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 18,
        marginBottom: 14,
        position: 'relative',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      {/* Barra de destaque superior Apple-style */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3.5,
          backgroundColor: accentColor,
        }}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            backgroundColor: iconBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Feather name={icon} size={22} color={iconColor} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {badge && (
            <View
              style={{
                backgroundColor: badgeBg,
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderRadius: 999,
              }}
            >
              <Text
                style={{
                  fontFamily: 'Inter_700Bold',
                  fontSize: 10,
                  color: badgeColor,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                }}
              >
                {badge}
              </Text>
            </View>
          )}
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              backgroundColor: '#f8fafc',
              borderWidth: 1,
              borderColor: '#e2e8f0',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="chevron-right" size={16} color="#64748b" />
          </View>
        </View>
      </View>

      <Text
        style={{
          fontFamily: 'Fraunces_700Bold',
          fontSize: 18,
          color: '#1e293b',
          marginBottom: 4,
        }}
      >
        {title}
      </Text>

      <Text
        style={{
          fontFamily: 'Inter_400Regular',
          fontSize: 13,
          color: '#64748b',
          lineHeight: 18,
          marginBottom: 12,
        }}
      >
        {description}
      </Text>

      {/* Tags / Sub-recursos em formato de pílula */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {tags.map((tag) => (
          <View
            key={tag}
            style={{
              backgroundColor: '#f8fafc',
              borderWidth: 1,
              borderColor: '#e2e8f0',
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
            }}
          >
            <Text
              style={{
                fontFamily: 'Inter_500Medium',
                fontSize: 11,
                color: '#475569',
              }}
            >
              {tag}
            </Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
}

export default function AdminConteudoHubScreen() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Métricas em tempo real do Conteúdo
  const [pendingQnaCount, setPendingQnaCount] = useState<number | null>(null);
  const [forumPostsCount, setForumPostsCount] = useState<number | null>(null);
  const [isBannerActive, setIsBannerActive] = useState<boolean | null>(null);

  const fetchHubStats = async () => {
    try {
      const [resQna, resForum, resBanner] = await Promise.all([
        api.get('/api/admin/qna/pending').catch(() => ({ data: [] })),
        api.get('/api/admin/forum/posts').catch(() => ({ data: [] })),
        api.get('/api/admin/community-event').catch(() => ({ data: {} })),
      ]);

      const qnaData = Array.isArray(resQna.data) ? resQna.data : [];
      setPendingQnaCount(qnaData.length);

      let postsData = Array.isArray(resForum.data) ? resForum.data : (resForum.data?.data || []);
      if (!Array.isArray(postsData)) postsData = [];
      setForumPostsCount(postsData.length);

      const bannerData = resBanner.data || {};
      setIsBannerActive(Boolean(bannerData.is_active));
    } catch (e) {
      console.log('Erro ao buscar status do hub de conteúdo:', e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHubStats();
  }, []);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchHubStats();
  }, []);

  const handleNavigate = (path: any) => {
    try {
      router.push(path);
    } catch (_) {
      router.navigate(path);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#f8fafc' }}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 130, // respiro premium para a barra de navegação inferior
      }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor="#1B4332"
          colors={['#1B4332']}
        />
      }
    >
      {/* ========================================================= */}
      {/* 1. CABEÇALHO HERO COM O GRADIENTE VERDE FLORESTA DA YELO   */}
      {/* ========================================================= */}
      <LinearGradient
        colors={['#1B4332', '#0f2b20']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 24,
          padding: 22,
          marginBottom: 16,
          shadowColor: '#1B4332',
          shadowOpacity: 0.18,
          shadowRadius: 25,
          shadowOffset: { width: 0, height: 8 },
          elevation: 5,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Efeito decorativo de iluminação translúcida */}
        <View
          style={{
            position: 'absolute',
            top: -40,
            right: -40,
            width: 160,
            height: 160,
            borderRadius: 80,
            backgroundColor: 'rgba(255,255,255,0.06)',
          }}
          pointerEvents="none"
        />

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.15)',
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              gap: 4,
            }}
          >
            <Text style={{ fontSize: 11 }}>✍️</Text>
            <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 11 }}>
              Hub de Conteúdo
            </Text>
          </View>

          <TouchableOpacity
            onPress={onRefresh}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.15)',
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 999,
              gap: 4,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.25)',
            }}
            activeOpacity={0.8}
          >
            <Feather name="refresh-cw" size={11} color="#ffffff" />
            <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#ffffff', fontSize: 11 }}>
              Atualizar
            </Text>
          </TouchableOpacity>
        </View>

        <Text
          style={{
            fontFamily: 'Fraunces_700Bold',
            fontSize: 24,
            lineHeight: 30,
            color: '#ffffff',
            marginBottom: 4,
          }}
        >
          Conteúdo e Comunidade
        </Text>
        <Text
          style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 13,
            color: 'rgba(255,255,255,0.85)',
            lineHeight: 18,
          }}
        >
          Modere conteúdos, fórum e avaliações.
        </Text>
      </LinearGradient>

      {/* ========================================================= */}
      {/* 2. RESUMO AO VIVO (STATUS DA MODERAÇÃO)                   */}
      {/* ========================================================= */}
      <View style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <Feather name="activity" size={15} color="#1B4332" />
          <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 15, color: '#1e293b' }}>
            Status da Moderação
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {/* Card Q&A */}
          <View
            style={{
              flex: 1,
              backgroundColor: '#ffffff',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#e2e8f0',
              padding: 12,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: '#7E22CE' }} />
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>
              Q&A Pendentes
            </Text>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 19, color: (pendingQnaCount || 0) > 0 ? '#d97706' : '#16a34a', marginTop: 2 }}>
              {pendingQnaCount !== null ? pendingQnaCount : '—'}
            </Text>
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 9.5, color: (pendingQnaCount || 0) > 0 ? '#b45309' : '#15803d', marginTop: 1 }}>
              {(pendingQnaCount || 0) > 0 ? 'Aguardando ação' : 'Fila zerada'}
            </Text>
          </View>

          {/* Card Fórum */}
          <View
            style={{
              flex: 1,
              backgroundColor: '#ffffff',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#e2e8f0',
              padding: 12,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: '#1B4332' }} />
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>
              Posts do Fórum
            </Text>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 19, color: '#1B4332', marginTop: 2 }}>
              {forumPostsCount !== null ? forumPostsCount : '—'}
            </Text>
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 9.5, color: '#64748b', marginTop: 1 }}>
              Tópicos ativos
            </Text>
          </View>

          {/* Card Banner */}
          <View
            style={{
              flex: 1,
              backgroundColor: '#ffffff',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#e2e8f0',
              padding: 12,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: '#0284C7' }} />
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>
              Banner Evento
            </Text>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 19, color: isBannerActive ? '#16a34a' : '#64748b', marginTop: 2 }}>
              {isBannerActive === null ? '—' : isBannerActive ? 'Ativo' : 'Pausado'}
            </Text>
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 9.5, color: isBannerActive ? '#15803d' : '#94a3b8', marginTop: 1 }}>
              {isBannerActive ? 'Visível no app' : 'Oculto'}
            </Text>
          </View>
        </View>
      </View>

      {/* ========================================================= */}
      {/* 3. OS 3 CARDS DO HUB (GESTÃO, MODERAÇÃO, COMUNIDADE)      */}
      {/* ========================================================= */}
      <View style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <Feather name="grid" size={15} color="#1B4332" />
          <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 15, color: '#1e293b' }}>
            Módulos de Gestão
          </Text>
        </View>

        {/* Card 1: Gestão de Conteúdo */}
        <HubContentCard
          title="Gestão de Conteúdo"
          description="Moderação de avaliações, Q&A e Blogs."
          icon="file-text"
          iconColor="#7E22CE"
          iconBg="#F3E8FF"
          accentColor="#7E22CE"
          tags={['Perguntas (Q&A)', 'Artigos de Blog', 'Páginas Estáticas', 'Avaliações']}
          badge={(pendingQnaCount || 0) > 0 ? `${pendingQnaCount} pendente(s)` : 'Moderação'}
          badgeBg={(pendingQnaCount || 0) > 0 ? '#fef3c7' : '#f3e8ff'}
          badgeColor={(pendingQnaCount || 0) > 0 ? '#b45309' : '#7e22ce'}
          onPress={() => handleNavigate('/(admin)/gestao-conteudo')}
        />

        {/* Card 2: Moderação do Fórum */}
        <HubContentCard
          title="Moderação do Fórum"
          description="Gerencie denúncias e posts da comunidade."
          icon="shield"
          iconColor="#1B4332"
          iconBg="#E8F5E9"
          accentColor="#1B4332"
          tags={['Denúncias', 'Tópicos dos Psicólogos', 'Fixar Posts', 'Comentários']}
          badge="Comunidade Psi"
          badgeBg="#dcfce7"
          badgeColor="#15803d"
          onPress={() => handleNavigate('/(admin)/moderacao-forum')}
        />

        {/* Card 3: Gestão da Comunidade */}
        <HubContentCard
          title="Gestão da Comunidade"
          description="Edite banners e links de recursos úteis."
          icon="message-circle"
          iconColor="#0284C7"
          iconBg="#E0F2FE"
          accentColor="#0284C7"
          tags={['Banner de Evento', 'Intervisão Clínica', 'Grupo VIP WhatsApp', 'Suporte']}
          badge={isBannerActive ? 'Banner Ativo' : 'Recursos'}
          badgeBg={isBannerActive ? '#e0f2fe' : '#f1f5f9'}
          badgeColor={isBannerActive ? '#0369a1' : '#64748b'}
          onPress={() => handleNavigate('/(admin)/comunidade-gestao')}
        />
      </View>

      {/* ========================================================= */}
      {/* 4. DIRETRIZES E BOAS PRÁTICAS DA COMUNIDADE YELO          */}
      {/* ========================================================= */}
      <View
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 20,
          borderWidth: 1,
          borderColor: '#e2e8f0',
          padding: 16,
          marginBottom: 10,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3.5, backgroundColor: '#10b981' }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Text style={{ fontSize: 16 }}>🌿</Text>
          <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 15, color: '#1e293b' }}>
            Diretrizes de Conteúdo & Moderação
          </Text>
        </View>

        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748b', lineHeight: 18, marginBottom: 12 }}>
          Mantenha a segurança e o alto padrão clínico da plataforma Yelo seguindo as diretrizes oficiais:
        </Text>

        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981', marginTop: 6 }} />
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#334155', flex: 1, lineHeight: 17 }}>
              <Text style={{ fontFamily: 'Inter_700Bold' }}>SLA de Q&A:</Text> Responda ou aprove perguntas de visitantes em menos de 24 horas para alimentar o SEO orgânico.
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981', marginTop: 6 }} />
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#334155', flex: 1, lineHeight: 17 }}>
              <Text style={{ fontFamily: 'Inter_700Bold' }}>Ética & CFP:</Text> Posts e comentários que violem o Código de Ética Profissional do Psicólogo devem ser removidos imediatamente.
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981', marginTop: 6 }} />
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#334155', flex: 1, lineHeight: 17 }}>
              <Text style={{ fontFamily: 'Inter_700Bold' }}>Engajamento:</Text> Mantenha o banner de evento e o grupo de intervisão atualizados mensalmente para retenção dos psicólogos.
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
