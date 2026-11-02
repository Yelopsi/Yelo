import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform, Alert } from 'react-native';
import YeloScrollView from '../../components/YeloScrollView';

import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter, usePathname, useNavigation } from 'expo-router';

export default function ClinicaScreen() {
  const router = useRouter();
  const navigation = useNavigation<any>();
  const currentPath = usePathname();
  const [debugTrace, setDebugTrace] = useState<string | null>(null);

  const handleNavigate = (cardTitle: string, targetTab: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logInfo = `[${timestamp}] De: ${currentPath} -> Aba: ${targetTab} ("${cardTitle}")`;
    console.log('[DEBUG_RASTREIO_NAV]', logInfo);
    setDebugTrace(logInfo);

    try {
      if (navigation && typeof navigation.navigate === 'function') {
        navigation.navigate(targetTab);
      } else {
        router.navigate(`/(tabs)/${targetTab}` as any);
      }
    } catch (err: any) {
      console.warn('[DEBUG_RASTREIO_FALLBACK]', err);
      try {
        router.navigate(`/(tabs)/${targetTab}` as any);
      } catch (innerErr: any) {
        console.error('[DEBUG_RASTREIO_ERROR]', innerErr);
        const errMsg = `Erro ao navegar: ${innerErr?.message || innerErr}`;
        setDebugTrace(errMsg);
        Alert.alert('Rastreio de Navegação', errMsg);
      }
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

          {/* PAINEL DE DEBUG DE RASTREIO VISUAL */}
          {debugTrace && (
            <View className="mx-6 mb-4 p-3.5 bg-[#1B4332] rounded-[14px] border border-[#FFEE8C]/50 shadow-sm">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="font-sans font-bold text-[#FFEE8C] text-[12px]">🔍 Rastreio de Navegação</Text>
                <TouchableOpacity onPress={() => setDebugTrace(null)} className="px-2 py-0.5 bg-white/20 rounded-full">
                  <Text className="text-white text-[10px] font-bold">Fechar</Text>
                </TouchableOpacity>
              </View>
              <Text className="text-white text-[12px] font-mono leading-tight">{debugTrace}</Text>
            </View>
          )}

          {/* GRID DE CARDS (HUB) */}
          <View className="px-6 pb-32">
            
            {/* Card 1: Meus Pacientes */}
            <TouchableOpacity 
              onPress={() => handleNavigate('Meus Pacientes', 'pacientes')}
              className="bg-white border border-[#e5e7eb] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5"
            >
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#f0fdf4] items-center justify-center mr-5">
                <Text className="text-[24px]">👥</Text>
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[19px] mb-1">Meus Pacientes</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Carteira de pacientes e agenda de sessões.</Text>
              </View>
            </TouchableOpacity>

            {/* Card 2: Financeiro */}
            <TouchableOpacity 
              onPress={() => handleNavigate('Financeiro', 'financeiro')}
              className="bg-white border border-[#e5e7eb] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5"
            >
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#f0fdf4] items-center justify-center mr-5">
                <Text className="text-[24px]">💰</Text>
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[19px] mb-1">Financeiro</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Controle de receitas, despesas e fluxo de caixa.</Text>
              </View>
            </TouchableOpacity>

            {/* Card 3: Métricas & Mercado */}
            <TouchableOpacity 
              onPress={() => handleNavigate('Métricas & Mercado', 'analytics')}
              className="bg-white border border-[#e5e7eb] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5"
            >
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#f0fdf4] items-center justify-center mr-5">
                <Text className="text-[24px]">📊</Text>
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[19px] mb-1">Métricas & Mercado</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Análise de preços e temas em alta.</Text>
              </View>
            </TouchableOpacity>

            {/* Card 4: Análise de Favoritos */}
            <TouchableOpacity 
              onPress={() => handleNavigate('Análise de Favoritos', 'favoritos-analytics')}
              className="bg-white border border-[#e5e7eb] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5"
            >
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#f0fdf4] items-center justify-center mr-5">
                <Text className="text-[24px]">❤️</Text>
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[19px] mb-1">Análise de Favoritos</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Entenda o perfil de quem se interessa por você.</Text>
              </View>
            </TouchableOpacity>

            {/* Card 5: Calculadora */}
            <TouchableOpacity 
              onPress={() => handleNavigate('Calculadora de Honorários', 'calculadora')}
              className="bg-white border border-[#e5e7eb] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5"
            >
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#fef3c7] items-center justify-center mr-5">
                <Text className="text-[24px]">🧮</Text>
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[19px] mb-1">Calculadora de Honorários</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Descubra o valor ideal para suas sessões.</Text>
              </View>
            </TouchableOpacity>

            {/* Card 6: Manual */}
            <TouchableOpacity 
              onPress={() => handleNavigate('Manual de Conversão', 'manual-conversao')}
              className="bg-white border border-[#e5e7eb] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5"
            >
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#dcfce7] items-center justify-center mr-5">
                <Text className="text-[24px]">📘</Text>
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[19px] mb-1">Manual de Conversão</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Dicas e roteiros para falar com novos pacientes.</Text>
              </View>
            </TouchableOpacity>

          </View>
        </YeloScrollView>
      </View>
    </View>
  );
}
