import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';

export default function VisaoGeralScreen() {
  return (
    <ScrollView className="flex-1 bg-[#f9fafb]" contentContainerStyle={{ padding: 20 }}>
      {/* Hero Moderno */}
      <View className="bg-[#1B4332] rounded-[24px] p-[24px] mb-[20px] shadow-[0_4px_20px_rgba(27,67,50,0.15)] relative overflow-hidden">
        {/* Decoration Element */}
        <View className="absolute top-[-20px] right-[-20px] w-[120px] h-[120px] bg-white/10 rounded-full" />
        <View className="absolute bottom-[-40px] right-[40px] w-[80px] h-[80px] bg-white/5 rounded-full" />

        <Text className="font-title text-white text-[28px] leading-[34px] mb-[8px]">
          Olá, <Text className="text-[#FFEE8C]">Visitante</Text>! 👋
        </Text>
        <Text className="font-sans text-white/90 text-[15px] leading-[22px] max-w-[90%]">
          Que bom te ver por aqui. Este é o seu espaço seguro para gerenciar sua jornada de cuidado.
        </Text>
      </View>

      {/* Grid de Informações (KPIs) */}
      <View className="gap-[15px]">
        {/* KPI 1 */}
        <View className="bg-white rounded-[20px] p-[20px] border-t-4 border-[#1B4332] shadow-[0_4px_15px_rgba(0,0,0,0.03)]">
          <View className="flex-row items-center gap-[10px] mb-[15px]">
            <View className="w-[40px] h-[40px] bg-[#e8f5e9] rounded-full items-center justify-center">
              <Feather name="user-check" size={20} color="#1B4332" />
            </View>
            <Text className="font-title text-[#333] text-[18px]">Matches Compatíveis</Text>
          </View>
          <Text className="font-title text-[#1B4332] text-[36px] mb-[4px]">3</Text>
          <Text className="font-sans text-[#666] text-[13px]">Profissionais encontrados</Text>
        </View>

        {/* KPI 2 */}
        <View className="bg-white rounded-[20px] p-[20px] border-t-4 border-[#F59E0B] shadow-[0_4px_15px_rgba(0,0,0,0.03)]">
          <View className="flex-row items-center gap-[10px] mb-[15px]">
            <View className="w-[40px] h-[40px] bg-[#fef3c7] rounded-full items-center justify-center">
              <Feather name="heart" size={20} color="#F59E0B" />
            </View>
            <Text className="font-title text-[#333] text-[18px]">Favoritos Salvos</Text>
          </View>
          <Text className="font-title text-[#1B4332] text-[36px] mb-[4px]">1</Text>
          <Text className="font-sans text-[#666] text-[13px]">Perfis guardados</Text>
        </View>

        {/* KPI 3 */}
        <View className="bg-white rounded-[20px] p-[20px] border-t-4 border-[#BE185D] shadow-[0_4px_15px_rgba(0,0,0,0.03)]">
          <View className="flex-row items-center gap-[10px] mb-[15px]">
            <View className="w-[40px] h-[40px] bg-[#fce7f3] rounded-full items-center justify-center">
              <Feather name="message-square" size={20} color="#BE185D" />
            </View>
            <Text className="font-title text-[#333] text-[18px]">Minhas Avaliações</Text>
          </View>
          <Text className="font-title text-[#1B4332] text-[36px] mb-[4px]">0</Text>
          <Text className="font-sans text-[#666] text-[13px]">Feedbacks enviados</Text>
        </View>
      </View>
    </ScrollView>
  );
}
