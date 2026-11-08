import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import YeloScrollView from '../../components/YeloScrollView';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useNavigation } from 'expo-router';

export default function EvolucaoScreen() {
  const router = useRouter();
  const navigation = useNavigation<any>();

  const navigateTo = (targetTab: string) => {
    try {
      if (navigation && typeof navigation.navigate === 'function') {
        navigation.navigate(targetTab);
      } else {
        router.navigate(`/(tabs)/${targetTab}` as any);
      }
    } catch {
      router.navigate(`/(tabs)/${targetTab}` as any);
    }
  };

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <StatusBar style="dark" />
      <View className="flex-1">
        <YeloScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          
          {/* HEADER DA PÁGINA (main-header) */}
          <View className="mx-6 mt-6 mb-6 bg-[#1B4332] p-[22px] rounded-[16px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] justify-between">
            <View>
              <Text className="font-title text-[26px] text-white mb-2 leading-tight">
                Evolução & Comunidade
              </Text>
              <Text className="font-sans text-[16px] text-white/85">
                Acompanhe seus contatos, compartilhe conhecimento e desenvolva sua carreira.
              </Text>
            </View>
          </View>

          {/* GRID DE CARDS (HUB) EM ORDEM LÓGICA DE UX */}
          <View className="px-6 pb-32">
            
            {/* 1. ATENDIMENTO & LEADS: Histórico de Contatos */}
            <TouchableOpacity 
              onPress={() => navigateTo('historico_contatos')} 
              className="bg-white border border-[#e5e7eb] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5"
              activeOpacity={0.8}
            >
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#f0fdf4] items-center justify-center mr-5">
                <Text className="text-[24px]">📱</Text>
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[19px] mb-1">Histórico de Contatos</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Acompanhe seus leads de WhatsApp e retornos.</Text>
              </View>
            </TouchableOpacity>

            {/* 2. NETWORKING ENTRE PARES: Fórum de Discussão */}
            <TouchableOpacity 
              onPress={() => navigateTo('forum')} 
              className="bg-white border border-[#e5e7eb] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5"
              activeOpacity={0.8}
            >
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#f0fdf4] items-center justify-center mr-5">
                <Text className="text-[24px]">💬</Text>
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[19px] mb-1">Fórum de Discussão</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Intervisão clínica, debates e troca com outros psicólogos.</Text>
              </View>
            </TouchableOpacity>

            {/* 3. AUTORIDADE & BLOG: Meus Artigos */}
            <TouchableOpacity 
              onPress={() => navigateTo('blog')} 
              className="bg-white border border-[#e5e7eb] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5"
              activeOpacity={0.8}
            >
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#f0fdf4] items-center justify-center mr-5">
                <Text className="text-[24px]">✍️</Text>
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[19px] mb-1">Meus Artigos</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Escreva e publique no blog para fortalecer sua autoridade.</Text>
              </View>
            </TouchableOpacity>

            {/* 4. ATRAÇÃO & PACIENTES: Perguntas da Comunidade */}
            <TouchableOpacity 
              onPress={() => navigateTo('comunidade')} 
              className="bg-white border border-[#e5e7eb] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5"
              activeOpacity={0.8}
            >
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#f0fdf4] items-center justify-center mr-5">
                <Text className="text-[24px]">❓</Text>
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[19px] mb-1">Perguntas da Comunidade</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Responda dúvidas de pacientes e atraia novos atendimentos.</Text>
              </View>
            </TouchableOpacity>

            {/* 5. CAPACITAÇÃO & MATERIAIS: Comunidade Yelo */}
            <TouchableOpacity 
              onPress={() => navigateTo('comunidade_yelo')} 
              className="bg-white border border-[#e5e7eb] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5"
              activeOpacity={0.8}
            >
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#f0fdf4] items-center justify-center mr-5">
                <Text className="text-[24px]">🎓</Text>
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[19px] mb-1">Comunidade Yelo</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Acesse workshops gravados e biblioteca de arquivos.</Text>
              </View>
            </TouchableOpacity>

            {/* 6. CONQUISTAS & PROGRESSO: Minha Jornada */}
            <TouchableOpacity 
              onPress={() => navigateTo('jornada')} 
              className="bg-white border border-[#e5e7eb] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5"
              activeOpacity={0.8}
            >
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#f0fdf4] items-center justify-center mr-5">
                <Text className="text-[24px]">🚀</Text>
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[19px] mb-1">Minha Jornada</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Nível de autoridade, pontuação de XP e conquistas.</Text>
              </View>
            </TouchableOpacity>

          </View>
        </YeloScrollView>
      </View>
    </View>
  );
}
