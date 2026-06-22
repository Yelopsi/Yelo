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

export default function AnalyticsScreen() {
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
            <Text className="font-title text-[26px] text-white leading-tight">Métricas & Mercado</Text>
          </View>
          <Text className="font-sans text-[15px] text-white/85 mt-1">
            Descubra como seu perfil está se saindo e o que os pacientes mais procuram na Yelo.
          </Text>
        </View>

        {/* CARD 1: VALOR DA SESSÃO */}
        <View className="mx-6 mb-6 bg-white p-6 rounded-[20px] shadow-sm border border-[#e5e7eb]">
          <View className="flex-row items-center mb-2">
            <View className="w-[45px] h-[45px] bg-[#e8f5e9] rounded-[12px] items-center justify-center mr-3">
              <Text className="text-[22px]">💳</Text>
            </View>
            <Text className="font-title text-[18px] text-[#333]">Valor da Sessão</Text>
          </View>
          <Text className="font-sans text-[14px] text-[#666] mb-6 leading-relaxed">
            Veja como o valor da sua consulta se compara à média de outros psicólogos na sua região.
          </Text>

          {/* Pseudo Bar Chart (Vertical) */}
          <View className="flex-row justify-around items-end h-[160px] border-b border-[#e0e0e0] pb-2 mb-4">
            
            {/* Seu Valor */}
            <View className="items-center">
              <Text className="font-sans font-bold text-[#1B4332] text-[13px] mb-2">R$ 150</Text>
              <View className="w-[40px] h-[100px] bg-[#1B4332] rounded-t-[6px]" />
              <Text className="font-sans text-[11px] text-[#666] mt-2 w-[60px] text-center">Seu Valor</Text>
            </View>

            {/* Cidade */}
            <View className="items-center">
              <Text className="font-sans font-bold text-[#f59e0b] text-[13px] mb-2">R$ 120</Text>
              <View className="w-[40px] h-[75px] bg-[#fcd34d] rounded-t-[6px]" />
              <Text className="font-sans text-[11px] text-[#666] mt-2 w-[60px] text-center">Média (Cidade)</Text>
            </View>

            {/* Plataforma */}
            <View className="items-center">
              <Text className="font-sans font-bold text-[#495057] text-[13px] mb-2">R$ 140</Text>
              <View className="w-[40px] h-[90px] bg-[#adb5bd] rounded-t-[6px]" />
              <Text className="font-sans text-[11px] text-[#666] mt-2 w-[70px] text-center">Média (Plataforma)</Text>
            </View>

          </View>

          {/* Analysis Text Box */}
          <View className="bg-[#f8f9fa] border-l-4 border-[#1B4332] p-4 rounded-[8px]">
            <Text className="font-sans text-[14px] text-[#444] leading-relaxed">
              ✅ Seu valor está <Text className="font-bold">competitivo</Text> em relação à média da plataforma e da sua cidade.
            </Text>
          </View>
        </View>

        {/* CARD 2: TEMAS EM ALTA */}
        <View className="mx-6 mb-6 bg-white p-6 rounded-[20px] shadow-sm border border-[#e5e7eb]">
          <View className="flex-row items-center mb-2">
            <View className="w-[45px] h-[45px] bg-[#fff3e0] rounded-[12px] items-center justify-center mr-3">
              <Text className="text-[22px]">🔥</Text>
            </View>
            <Text className="font-title text-[18px] text-[#333]">O que os pacientes buscam?</Text>
          </View>
          <Text className="font-sans text-[14px] text-[#666] mb-6 leading-relaxed">
            Os 5 temas mais procurados na plataforma nos últimos 30 dias. Ótimo para inspirar seus artigos!
          </Text>

          {/* Progress Bars em vez de Doughnut Chart */}
          <ProgressBar label="Ansiedade" percentage={85} color="#1B4332" />
          <ProgressBar label="Relacionamentos" percentage={65} color="#2D6A4F" />
          <ProgressBar label="Depressão" percentage={55} color="#40916C" />
          <ProgressBar label="TDAH" percentage={40} color="#52B788" />
          <ProgressBar label="Burnout" percentage={30} color="#74C69D" />
        </View>

        {/* CARD 3: VISIBILIDADE */}
        <View className="mx-6 mb-6 bg-white p-6 rounded-[20px] shadow-sm border border-[#e5e7eb]">
          <View className="flex-row items-center mb-2">
            <View className="w-[45px] h-[45px] bg-[#e0f2fe] rounded-[12px] items-center justify-center mr-3">
              <Text className="text-[22px]">👁️</Text>
            </View>
            <Text className="font-title text-[18px] text-[#333]">Visibilidade na Busca</Text>
          </View>
          <Text className="font-sans text-[14px] text-[#666] mb-5 leading-relaxed">
            Quantas vezes seu perfil apareceu nos resultados de busca dos pacientes nesta última semana.
          </Text>

          <View className="bg-[#f0f9ff] border border-[#bae6fd] p-5 rounded-[16px] items-center justify-center mb-4">
            <Text className="font-title text-[36px] text-[#0284c7] mb-1">142</Text>
            <Text className="font-sans text-[14px] text-[#0284c7] font-bold uppercase tracking-wider">Visualizações</Text>
            
            <View className="bg-white px-3 py-1.5 rounded-full mt-3 shadow-sm flex-row items-center border border-[#e0f2fe]">
              <Feather name="trending-up" size={14} color="#16a34a" />
              <Text className="font-sans font-bold text-[#16a34a] text-[12px] ml-1.5">+15% vs sem. passada</Text>
            </View>
          </View>

          <View className="bg-[#f8f9fa] border-l-4 border-[#0284c7] p-4 rounded-[8px]">
            <Text className="font-sans text-[14px] text-[#444] leading-relaxed">
              💡 Suas publicações recentes ajudaram a impulsionar seu perfil no ranking da plataforma!
            </Text>
          </View>
        </View>

        {/* CARD 4: FORÇA DO PERFIL */}
        <View className="mx-6 mb-6 bg-white p-6 rounded-[20px] shadow-sm border border-[#e5e7eb]">
          <View className="flex-row items-center mb-2">
            <View className="w-[45px] h-[45px] bg-[#f3e8ff] rounded-[12px] items-center justify-center mr-3">
              <Text className="text-[22px]">💪</Text>
            </View>
            <Text className="font-title text-[18px] text-[#333]">Força do seu Perfil</Text>
          </View>
          <Text className="font-sans text-[14px] text-[#666] mb-6 leading-relaxed">
            Uma comparação do quão completo está o seu perfil em relação aos tops da Yelo.
          </Text>

          {/* Progress Bars em vez de Radar Chart */}
          <ProgressBar label="Completude (Bio, Fotos)" percentage={100} color="#7e22ce" />
          <ProgressBar label="Avaliações" percentage={95} color="#9333ea" />
          <ProgressBar label="Engajamento em Artigos" percentage={60} color="#a855f7" />
          <ProgressBar label="Taxa de Resposta" percentage={90} color="#c084fc" />
        </View>

      </YeloScrollView>
    </View>
  );
}
