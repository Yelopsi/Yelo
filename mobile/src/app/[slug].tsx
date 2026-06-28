import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Platform } from 'react-native';
import { Feather, FontAwesome, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

const VerifiedBadge = () => (
  <Svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <Path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.918-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.337 2.25c-.416-.165-.866-.25-1.336-.25-2.21 0-3.918 1.79-3.918 4 0 .495.084.965.238 1.4-1.273.65-2.148 2.02-2.148 3.6 0 1.46.758 2.746 1.9 3.42-.047.19-.074.385-.074.58 0 2.21 1.71 4.002 3.918 4.002.47 0 .92-.086 1.336-.25.52 1.335 1.828 2.25 3.337 2.25s2.816-.915 3.337-2.25c.416.164.866.25 1.336.25 2.21 0 3.918-1.792 3.918-4 0-.195-.027-.39-.074-.58 1.14-.675 1.9-1.96 1.9-3.42z" fill="#1B4332" />
    <Path d="M16.97 8.47a1.5 1.5 0 0 1 0 2.12l-6.5 6.5a1.5 1.5 0 0 1-2.12 0l-3.5-3.5a1.5 1.5 0 1 1 2.12-2.12l2.44 2.44 5.44-5.44a1.5 1.5 0 0 1 2.12 0z" fill="white" />
  </Svg>
);

export default function PerfilPublicoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isBioExpanded, setIsBioExpanded] = useState(false);

  // MOCK DATA
  const psicologo = {
    nome: 'Dra. Ana Silva',
    fotoUrl: 'https://res.cloudinary.com/dzqmypviz/image/upload/v1779824708/yelo/profiles/profile-94.jpg',
    titulo: 'Psicóloga Clínica | Terapia Cognitivo-Comportamental',
    crp: '12/34567',
    experiencia: '6 anos',
    idade: '32 anos',
    localizacao: 'São Paulo, SP',
    atendimento: 'Online e Presencial',
    bio: 'Olá! Sou a Ana, apaixonada por saúde mental e pelo processo de autoconhecimento. Meu objetivo é te ajudar a construir ferramentas para lidar com a ansiedade, estresse e desafios do dia a dia, em um ambiente totalmente seguro e acolhedor. Acredito que a terapia é um espaço de colaboração onde juntos podemos descobrir novos caminhos e formas de lidar com as emoções, sempre com respeito ao seu tempo e à sua individualidade.',
    formacao_nivel: 'Especialização',
    formacao_desc: 'Especialista em Terapia Cognitivo-Comportamental pela USP e graduação em Psicologia pela PUC-SP.',
    temas: ['Ansiedade', 'Depressão', 'Autoestima', 'Burnout'],
    publico: ['Adultos', 'Adolescentes', 'Casais'],
    abordagens_tecnicas: ['Terapia Cognitivo-Comportamental'],
    praticas_afirmativas: ['Neurodiversidade (TDAH, Autismo)', 'LGBTQIAPN+ Friendly 🏳️‍🌈'],
    valor_sessao: '150,00',
    rating: '5.0',
    reviews_count: 12
  };

  const reviews = [
    { patientName: 'João Carlos', rating: 5, comment: 'Excelente profissional, me ajudou muito nesse momento difícil!' },
    { patientName: 'Maria Costa', rating: 5, comment: 'Muito atenciosa e pontual. Recomendo de olhos fechados.' }
  ];

  const renderTag = (text: string) => (
    <View key={text} className="bg-[#f0fdf4] border border-[#bbf7d0] px-3.5 py-1.5 rounded-[20px] mr-2 mb-2">
      <Text className="font-sans text-[#166534] text-[13px] font-semibold">{text}</Text>
    </View>
  );

  return (
    <View className="flex-1 bg-[#f9fafb]" style={{ paddingTop: insets.top }}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* CONTAINER PRINCIPAL */}
        <View className="mx-2 mt-4 bg-white rounded-[20px] p-5 mb-5 border border-[#f0f0f0] shadow-[0_4px_20px_rgba(0,0,0,0.03)] relative">

          {/* BOTÃO COMPARTILHAR EMBUTIDO */}
          <TouchableOpacity className="absolute top-4 right-4 w-10 h-10 bg-[#f9fafb] rounded-full items-center justify-center z-10">
            <Ionicons name="share-outline" size={20} color="#9ca3af" style={{ marginLeft: -1, marginTop: -2 }} />
          </TouchableOpacity>

          {/* HERO INFO */}
          <View className="items-center mb-6">
            <View className="w-[140px] h-[140px] rounded-full border-2 border-dashed border-[#1B4332] p-1 mb-4">
              <Image source={{ uri: psicologo.fotoUrl }} className="w-full h-full rounded-full" />
            </View>

            {/* NAME BREAK MOBILE */}
            <View className="items-center mb-1">
              <View className="flex-row items-center">
                <Text className="font-title text-[#1B4332] text-[32px] leading-[36px]">Dra. Ana</Text>
                <View className="ml-1 -mt-4 bg-transparent">
                  <VerifiedBadge />
                </View>
              </View>
              <Text className="font-title text-[#555] text-[24px] font-medium leading-[26px] mt-1">Silva</Text>
            </View>

            <Text className="font-sans text-[#666] text-[15px] text-center px-4 mb-4 mt-2">
              {psicologo.titulo}
            </Text>

            {/* RATING BADGE */}
            <TouchableOpacity className="flex-row items-center mb-4">
              <View className="flex-row items-center">
                <Text className="text-[18px] text-[#f59e0b]">★</Text>
                <Text className="text-[18px] text-[#f59e0b]">★</Text>
                <Text className="text-[18px] text-[#f59e0b]">★</Text>
                <Text className="text-[18px] text-[#f59e0b]">★</Text>
                <Text className="text-[18px] text-[#f59e0b]">★</Text>
              </View>
              <Text className="font-sans text-[#666] text-[14px] font-semibold ml-1.5">{psicologo.rating} de 5</Text>
            </TouchableOpacity>

            {/* HERO AUTHORITY BLOCK (PÍLULAS) */}
            <View className="flex-row flex-wrap justify-center gap-2.5 mt-1 mb-6">
              <View className="flex-row items-center gap-1.5 bg-[#f8f9fa] px-3 py-1.5 rounded-[20px] border border-[#eee]">
                <Text className="text-[13px] text-[#16a34a] font-bold">✓</Text>
                <Text className="font-sans font-semibold text-[#444] text-[13px]">CRP: {psicologo.crp}</Text>
              </View>
              <View className="flex-row items-center gap-1.5 bg-[#f8f9fa] px-3 py-1.5 rounded-[20px] border border-[#eee]">
                <Text className="text-[13px] text-[#0284c7]">🔒</Text>
                <Text className="font-sans font-semibold text-[#444] text-[13px]">Sigilo Garantido</Text>
              </View>
              <View className="flex-row items-center gap-1.5 bg-[#f8f9fa] px-3 py-1.5 rounded-[20px] border border-[#eee]">
                <Text className="text-[13px]">⭐</Text>
                <Text className="font-sans font-semibold text-[#444] text-[13px]">Profissional com {psicologo.experiencia} de experiência</Text>
              </View>
            </View>

            {/* MQ TRUST ROW */}
            <View className="flex-row flex-wrap justify-center gap-5 w-full border-b border-dashed border-[#eee] pb-6 mb-6 mt-2">
              <View className="flex-row items-center gap-1.5">
                <Feather name="check-circle" size={16} color="#16a34a" />
                <Text className="font-sans font-bold text-[#16a34a] text-[12px] uppercase tracking-wide">Verificado</Text>
              </View>
              <View className="flex-row items-center gap-1.5">
                <Feather name="shield" size={16} color="#1B4332" />
                <Text className="font-sans font-bold text-[#1B4332] text-[12px] uppercase tracking-wide">CRP Ativo</Text>
              </View>
              <View className="flex-row items-center gap-1.5">
                <Text className="text-[14px]">⭐</Text>
                <Text className="font-sans font-bold text-[#d97706] text-[12px] uppercase tracking-wide">{psicologo.experiencia}</Text>
              </View>
            </View>

            {/* MQ INFO GRID */}
            <View className="flex-row justify-center items-center gap-6 mt-2 mb-6">
              {psicologo.idade && (
                <View className="flex-row items-center gap-2">
                  <View className="w-8 h-8 rounded-[10px] bg-[#f3e8ff] items-center justify-center">
                    <Text className="text-[16px]">👤</Text>
                  </View>
                  <View>
                    <Text className="font-sans font-bold text-[#888] text-[11px] uppercase tracking-wide">Idade</Text>
                    <Text className="font-sans font-bold text-[#333] text-[15px]">{psicologo.idade}</Text>
                  </View>
                </View>
              )}
              <View className="flex-row items-center gap-2">
                <View className="w-8 h-8 rounded-[10px] bg-[#e8f5e9] items-center justify-center">
                  <Text className="text-[16px]">📍</Text>
                </View>
                <View>
                  <Text className="font-sans font-bold text-[#888] text-[11px] uppercase tracking-wide">Local</Text>
                  <Text className="font-sans font-bold text-[#333] text-[15px]">SP</Text>
                </View>
              </View>
              <View className="flex-row items-center gap-2">
                <View className="w-8 h-8 rounded-[10px] bg-[#e0f2fe] items-center justify-center">
                  <Text className="text-[16px]">💻</Text>
                </View>
                <View>
                  <Text className="font-sans font-bold text-[#888] text-[11px] uppercase tracking-wide">Atende</Text>
                  <Text className="font-sans font-bold text-[#333] text-[15px]">Online</Text>
                </View>
              </View>
            </View>
          </View>

          {/* SOBRE MIM */}
          <View className="mb-12 mt-6">
            <Text className="font-title-regular text-[#1B4332] text-[22px] mb-1">Sobre Mim</Text>
            <Text className="font-sans text-[#666] text-[14px] mb-6 border-b border-[#f0f0f0] pb-4">Conheça um pouco mais sobre minha trajetória.</Text>
            <View className="bg-[#f9fafb] p-5 rounded-[16px] border border-[#f0f0f0]">
              <Text
                className="font-sans text-[#444] text-[15px] leading-[24px] text-left"
                numberOfLines={isBioExpanded ? undefined : 5}
              >
                {psicologo.bio}
              </Text>
              {psicologo.bio.length > 350 && (
                <TouchableOpacity onPress={() => setIsBioExpanded(!isBioExpanded)} className="mt-3">
                  <Text className="font-sans font-bold text-[#1B4332] text-[15px] underline">
                    {isBioExpanded ? 'Mostrar menos' : 'Ler mais sobre mim'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* FORMAÇÃO */}
          <View className="mb-12">
            <Text className="font-title-regular text-[#1B4332] text-[22px] mb-1">Formação Acadêmica</Text>
            <Text className="font-sans text-[#666] text-[14px] mb-6 border-b border-[#f0f0f0] pb-4">Minha base de conhecimento.</Text>

            <View className="flex-row items-start gap-4">
              <View className="w-[45px] h-[45px] bg-[#e0f2fe] rounded-[12px] items-center justify-center mt-1">
                <Text className="text-[24px]">🎓</Text>
              </View>
              <View className="flex-1">
                <Text className="font-title-regular text-[#333] text-[17px] mb-1">{psicologo.formacao_nivel}</Text>
                <Text className="font-sans text-[#666] text-[14px] leading-[22px]">{psicologo.formacao_desc}</Text>
              </View>
            </View>
          </View>

          {/* ESPECIALIDADES */}
          <View className="mb-10">
            <Text className="font-title-regular text-[#1B4332] text-[22px] mb-1">Especialidades</Text>
            <Text className="font-sans text-[#666] text-[14px] mb-6 border-b border-[#f0f0f0] pb-4">Áreas de maior foco de estudo.</Text>

            <Text className="font-sans font-bold text-[#888] text-[14px] mb-3 uppercase tracking-wide">Temas de Atuação</Text>
            <View className="flex-row flex-wrap mb-4">
              {psicologo.temas.map(renderTag)}
            </View>

            <Text className="font-sans font-bold text-[#888] text-[14px] mb-3 uppercase tracking-wide">Público-Alvo</Text>
            <View className="flex-row flex-wrap mb-4">
              {psicologo.publico.map(renderTag)}
            </View>

            <Text className="font-sans font-bold text-[#888] text-[14px] mb-3 uppercase tracking-wide">Abordagem Técnica</Text>
            <View className="flex-row flex-wrap mb-4">
              {psicologo.abordagens_tecnicas.map(renderTag)}
            </View>

            <Text className="font-sans font-bold text-[#888] text-[14px] mb-3 uppercase tracking-wide">Práticas Afirmativas</Text>
            <View className="flex-row flex-wrap">
              {psicologo.praticas_afirmativas.map(renderTag)}
            </View>
          </View>
        </View>

        {/* AVALIAÇÕES */}
        <View className="mx-2 bg-white rounded-[20px] p-5 mb-5 border border-[#f0f0f0] shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
          <Text className="font-title-regular text-[#1B4332] text-[26px] mb-1">Avaliações ({psicologo.reviews_count})</Text>
          <Text className="font-sans text-[#666] text-[14px] mb-5 border-b border-[#f0f0f0] pb-3">Experiências e relatos de pessoas.</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6 -mx-5 px-5">
            {reviews.map((r, i) => (
              <TouchableOpacity key={i} className="bg-[#f8f9fa] border border-[#e9ecef] rounded-[16px] p-5 w-[300px] mr-4">
                <View className="flex-row justify-between items-center mb-2.5">
                  <Text className="font-title-regular text-[#333] text-[15px]">{r.patientName.split(' ').map(n => n[0] + '.').join(' ')}</Text>
                  <Text className="text-[#f59e0b] text-[14px]">{'★'.repeat(r.rating)}</Text>
                </View>
                <Text className="font-sans text-[#555] text-[14px] italic leading-[22px]">"{r.comment}"</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity className="self-center bg-transparent border-2 border-[#1B4332] py-2.5 px-6 rounded-full items-center">
            <Text className="font-sans font-bold text-[#1B4332] text-[14px]">Ver todas as {psicologo.reviews_count} avaliações</Text>
          </TouchableOpacity>
        </View>

        {/* REDES SOCIAIS */}
        <View className="mx-2 bg-white rounded-[20px] p-5 mb-8 border border-[#f0f0f0] shadow-[0_4px_20px_rgba(0,0,0,0.03)] items-center">
          <Text className="font-title-regular text-[#1B4332] text-[20px] mb-4">Me acompanhe nas redes sociais</Text>
          <View className="flex-row items-center justify-center gap-4">
            {['instagram', 'linkedin', 'facebook'].map(social => (
              <TouchableOpacity key={social} className="w-[44px] h-[44px] bg-[#f8f9fa] rounded-full border border-[#e0e0e0] items-center justify-center">
                <Feather name={social as any} size={20} color="#555" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

      </ScrollView>

      {/* BOTTOM CTA (STICKY) */}
      <View className="absolute bottom-0 left-0 right-0 bg-white/95 px-5 py-4 flex-row items-center justify-between shadow-[0_-4px_20px_rgba(0,0,0,0.08)]" style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === 'ios' ? 34 : 16, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' }}>
        <View className="flex-col justify-center flex-shrink mr-2">
          <Text className="font-sans font-bold text-[#888] text-[11px] uppercase tracking-wide mb-1">Por Sessão</Text>
          <Text className="font-title-regular text-[#1B4332] text-[32px] leading-[32px]" numberOfLines={1} adjustsFontSizeToFit>R$ {psicologo.valor_sessao}</Text>
        </View>
        <TouchableOpacity className="bg-[#1B4332] px-5 py-3.5 rounded-[50px] flex-row items-center justify-center gap-2 shadow-[0_4px_15px_rgba(27,67,50,0.2)] flex-shrink-0">
          <FontAwesome name="whatsapp" size={20} color="white" />
          <Text className="font-sans font-bold text-white text-[15px]">Falar pelo WhatsApp</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
