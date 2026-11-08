import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import YeloScrollView from '../../components/YeloScrollView';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useNavigation } from 'expo-router';

export default function ClinicaScreen() {
  const router = useRouter();
  const navigation = useNavigation<any>();

  const handleNavigate = (cardTitle: string, targetTab: string) => {
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
          <View className="mx-6 mt-6 mb-4 bg-[#1B4332] p-[22px] rounded-[16px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] justify-between">
            <View>
              <Text className="font-title text-[26px] text-white mb-2 leading-tight">
                Gestão da Clínica
              </Text>
              <Text className="font-sans text-[16px] text-white/85">
                Organize seus pacientes, agenda e finanças em um só lugar.
              </Text>
            </View>
          </View>

          {/* GRID DE CARDS (HUB) EM ORDEM LÓGICA DE UX */}
          <View className="px-6 pb-32">
            
            {/* 1. OPERAÇÃO DIÁRIA: Meus Pacientes */}
            <TouchableOpacity 
              onPress={() => handleNavigate('Meus Pacientes', 'pacientes')}
              className="bg-white border border-[#e5e7eb] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5"
              activeOpacity={0.8}
            >
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#f0fdf4] items-center justify-center mr-5">
                <Text className="text-[24px]">👥</Text>
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[19px] mb-1">Meus Pacientes</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Carteira de pacientes, agenda de sessões e prontuários.</Text>
              </View>
            </TouchableOpacity>

            {/* 2. OPERAÇÃO DIÁRIA: Financeiro */}
            <TouchableOpacity 
              onPress={() => handleNavigate('Financeiro', 'financeiro')}
              className="bg-white border border-[#e5e7eb] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5"
              activeOpacity={0.8}
            >
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#f0fdf4] items-center justify-center mr-5">
                <Text className="text-[24px]">💰</Text>
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[19px] mb-1">Financeiro</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Controle de receitas, despesas e fluxo de caixa.</Text>
              </View>
            </TouchableOpacity>

            {/* 3. CAPTAÇÃO & CONVERSÃO: Manual de Conversão */}
            <TouchableOpacity 
              onPress={() => handleNavigate('Manual de Conversão', 'manual-conversao')}
              className="bg-white border border-[#e5e7eb] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5"
              activeOpacity={0.8}
            >
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#dcfce7] items-center justify-center mr-5">
                <Text className="text-[24px]">📘</Text>
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[19px] mb-1">Manual de Conversão</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Dicas e roteiros para falar com novos pacientes.</Text>
              </View>
            </TouchableOpacity>

            {/* 4. CAPTAÇÃO & DEMANDA: Análise de Favoritos */}
            <TouchableOpacity 
              onPress={() => handleNavigate('Análise de Favoritos', 'favoritos-analytics')}
              className="bg-white border border-[#e5e7eb] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5"
              activeOpacity={0.8}
            >
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#f0fdf4] items-center justify-center mr-5">
                <Text className="text-[24px]">❤️</Text>
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[19px] mb-1">Análise de Favoritos</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Entenda o perfil de quem se interessa por você.</Text>
              </View>
            </TouchableOpacity>

            {/* 5. ESTRATÉGIA: Métricas & Mercado */}
            <TouchableOpacity 
              onPress={() => handleNavigate('Métricas & Mercado', 'analytics')}
              className="bg-white border border-[#e5e7eb] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5"
              activeOpacity={0.8}
            >
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#f0fdf4] items-center justify-center mr-5">
                <Text className="text-[24px]">📊</Text>
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[19px] mb-1">Métricas & Mercado</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Análise de preços e temas em alta na sua região.</Text>
              </View>
            </TouchableOpacity>

            {/* 6. APOIO & PRECIFICAÇÃO: Calculadora de Honorários */}
            <TouchableOpacity 
              onPress={() => handleNavigate('Calculadora de Honorários', 'calculadora')}
              className="bg-white border border-[#e5e7eb] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5"
              activeOpacity={0.8}
            >
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#fef3c7] items-center justify-center mr-5">
                <Text className="text-[24px]">🧮</Text>
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[19px] mb-1">Calculadora de Honorários</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Descubra e simule o valor ideal para suas sessões.</Text>
              </View>
            </TouchableOpacity>

          </View>
        </YeloScrollView>
      </View>
    </View>
  );
}
