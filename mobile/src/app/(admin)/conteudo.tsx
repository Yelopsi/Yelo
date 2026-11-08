import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

interface HubCardProps {
  title: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
  iconBg: string;
  onPress: () => void;
}

function HubCard({
  title,
  description,
  icon,
  iconColor,
  iconBg,
  onPress,
}: HubCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={{
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 16,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginBottom: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 1,
      }}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          backgroundColor: iconBg,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Feather name={icon} size={22} color={iconColor} />
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: 'Fraunces_700Bold',
            fontSize: 16,
            color: '#1B4332',
            marginBottom: 3,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 12.5,
            color: '#64748b',
            lineHeight: 18,
          }}
        >
          {description}
        </Text>
      </View>

      <Feather name="chevron-right" size={18} color="#94a3b8" />
    </TouchableOpacity>
  );
}

export default function AdminConteudoHubScreen() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <StatusBar style="dark" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 130, // respiro premium para a barra de navegação inferior
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ========================================================= */}
        {/* CABEÇALHO DO HUB: CONTEÚDO E COMUNIDADE                   */}
        {/* ========================================================= */}
        <LinearGradient
          colors={['#1B4332', '#2D6A4F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 24,
            padding: 22,
            marginBottom: 20,
            shadowColor: '#1B4332',
            shadowOpacity: 0.15,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 6 },
            elevation: 4,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: -30,
              right: -30,
              width: 140,
              height: 140,
              borderRadius: 70,
              backgroundColor: 'rgba(255,255,255,0.06)',
            }}
            pointerEvents="none"
          />
          <Text
            style={{
              fontFamily: 'Fraunces_700Bold',
              fontSize: 24,
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
        {/* GRID DOS 3 CARDS IDÊNTICOS À VERSÃO WEB MOBILE            */}
        {/* ========================================================= */}
        <View>
          {/* Card 1: Gestão de Conteúdo */}
          <HubCard
            title="Gestão de Conteúdo"
            description="Moderação de avaliações, Q&A e Blogs."
            icon="file-text"
            iconColor="#7E22CE"
            iconBg="#F3E8FF"
            onPress={() => router.push('/(admin)/gestao-conteudo')}
          />

          {/* Card 2: Moderação do Fórum */}
          <HubCard
            title="Moderação do Fórum"
            description="Gerencie denúncias e posts da comunidade."
            icon="shield"
            iconColor="#1B4332"
            iconBg="#E8F5E9"
            onPress={() => router.push('/(admin)/moderacao-forum')}
          />

          {/* Card 3: Gestão da Comunidade */}
          <HubCard
            title="Gestão da Comunidade"
            description="Edite banners e links de recursos úteis."
            icon="message-circle"
            iconColor="#0284C7"
            iconBg="#E0F2FE"
            onPress={() => router.push('/(admin)/comunidade-gestao')}
          />
        </View>
      </ScrollView>
    </View>
  );
}
