import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import YeloScrollView from '../../components/YeloScrollView';

import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// Componente helper para Barras Horizontais
const ProgressBar = ({ label, percentage, color }: { label: string; percentage: number; color: string }) => (
  <View className="mb-4">
    <View className="flex-row justify-between mb-1.5">
      <Text className="font-sans text-[14px] text-[#333] font-bold">{label}</Text>
      <Text className="font-sans text-[13px] text-[#888]">{percentage}%</Text>
    </View>
    <View className="h-[8px] bg-[#f1f3f5] rounded-full overflow-hidden">
      <View 
        style={{ width: `${percentage}%`, backgroundColor: color }} 
        className="h-full rounded-full" 
      />
    </View>
  </View>
);

export default function FavoritosAnalyticsScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <YeloScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        
        {/* HEADER VERDE (MAIN-HEADER) */}
        <View className="mx-6 mt-6 mb-6 bg-[#1B4332] p-[22px] rounded-[16px] shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
          <View className="flex-row items-center mb-2">
            <TouchableOpacity 
              onPress={() => router.back()} 
              className="w-10 h-10 bg-white/20 rounded-full items-center justify-center mr-4"
            >
              <Feather name="arrow-left" size={20} color="white" />
            </TouchableOpacity>
            <Text className="font-title text-[26px] text-white leading-tight">Quem te favoritou? ❤️</Text>
          </View>
          <Text className="font-sans text-[15px] text-white/85 mt-1 leading-relaxed">
            Entenda as características e interesses dos pacientes que salvaram seu perfil para futuras consultas.
          </Text>
        </View>

        {/* CARD 1: PRINCIPAIS TEMAS */}
        <View className="mx-6 mb-6 bg-white p-6 rounded-[20px] shadow-sm border border-[#e5e7eb]">
          <View className="flex-row items-center mb-2">
            <View className="w-[45px] h-[45px] bg-[#e8f5e9] rounded-[12px] items-center justify-center mr-3">
              <Text className="text-[22px]">🎯</Text>
            </View>
            <Text className="font-title text-[18px] text-[#333]">Principais Temas</Text>
          </View>
          <Text className="font-sans text-[14px] text-[#666] mb-6 leading-relaxed">
            Os assuntos que mais motivam os pacientes que favoritaram seu perfil a buscar terapia.
          </Text>

          <ProgressBar label="Ansiedade" percentage={45} color="#1B4332" />
          <ProgressBar label="Burnout" percentage={30} color="#2D6A4F" />
          <ProgressBar label="Relacionamentos" percentage={15} color="#40916C" />
          <ProgressBar label="Autoestima" percentage={10} color="#52B788" />
        </View>

        {/* CARD 2: ORÇAMENTO MÉDIO */}
        <View className="mx-6 mb-6 bg-white p-6 rounded-[20px] shadow-sm border border-[#e5e7eb]">
          <View className="flex-row items-center mb-2">
            <View className="w-[45px] h-[45px] bg-[#fff3e0] rounded-[12px] items-center justify-center mr-3">
              <Text className="text-[22px]">💰</Text>
            </View>
            <Text className="font-title text-[18px] text-[#333]">Orçamento Médio</Text>
          </View>
          <Text className="font-sans text-[14px] text-[#666] mb-6 leading-relaxed">
            A faixa de valor que esses pacientes estão dispostos a investir por sessão.
          </Text>

          <ProgressBar label="R$ 100 a R$ 150" percentage={50} color="#f59e0b" />
          <ProgressBar label="R$ 150 a R$ 200" percentage={35} color="#fbbf24" />
          <ProgressBar label="Até R$ 100" percentage={10} color="#fcd34d" />
          <ProgressBar label="Acima de R$ 200" percentage={5} color="#fde68a" />
        </View>

        {/* CARD 3: PERFIL DEMOGRÁFICO */}
        <View className="mx-6 mb-6 bg-white p-6 rounded-[20px] shadow-sm border border-[#e5e7eb]">
          <View className="flex-row items-center mb-2">
            <View className="w-[45px] h-[45px] bg-[#e0f2fe] rounded-[12px] items-center justify-center mr-3">
              <Text className="text-[22px]">👤</Text>
            </View>
            <Text className="font-title text-[18px] text-[#333]">Perfil Demográfico</Text>
          </View>
          <Text className="font-sans text-[14px] text-[#666] mb-6 leading-relaxed">
            A identidade de gênero dos pacientes que demonstraram interesse no seu trabalho.
          </Text>

          <ProgressBar label="Feminino" percentage={65} color="#0284c7" />
          <ProgressBar label="Masculino" percentage={25} color="#0ea5e9" />
          <ProgressBar label="Não-binário" percentage={8} color="#38bdf8" />
          <ProgressBar label="Prefere não dizer" percentage={2} color="#7dd3fc" />
        </View>

      </YeloScrollView>
    </View>
  );
}
