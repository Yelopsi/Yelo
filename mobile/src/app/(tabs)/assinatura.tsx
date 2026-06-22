import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import YeloScrollView from '../../components/YeloScrollView';

import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function AssinaturaScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <YeloScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        
        {/* HEADER */}
        <View className="mx-4 mt-4 mb-6 bg-white py-6 px-4 rounded-[20px] items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#f0f0f0]">
          <TouchableOpacity onPress={() => router.back()} className="absolute top-4 left-4 w-10 h-10 bg-[#f1f3f5] rounded-full items-center justify-center">
            <Feather name="arrow-left" size={20} color="#1B4332" />
          </TouchableOpacity>
          <Text className="font-title text-[#1B4332] text-[24px] mb-2 mt-4 text-center">Sua Assinatura 💎</Text>
          <Text className="font-sans text-[#666] text-[16px] text-center leading-relaxed">
            Gerencie seu plano, acesse benefícios e eleve sua carreira.
          </Text>
        </View>

        {/* TRIAL BANNER (Mobile: Coluna Centralizada) */}
        <View className="mx-4 bg-[#f0fdf4] border border-[#bbf7d0] p-5 rounded-[20px] mb-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex-col items-center justify-center gap-3">
          <Text className="text-[40px] leading-[40px]">🎁</Text>
          <View className="items-center">
            <Text className="font-title text-[#166534] text-[20px] mb-2 text-center">Você está no período de teste grátis!</Text>
            <Text className="font-sans text-[#15803d] text-[15px] leading-relaxed text-center">
              Você ainda tem <Text className="font-bold">14 dias</Text> para conhecer e testar a plataforma. Não exigimos cartão de crédito agora.
            </Text>
          </View>
        </View>

        {/* PLANS GRID */}
        <View className="px-4 mb-6">
          
          {/* PLANO ESSENCIAL / PREMIUM */}
          <View className="bg-white border-2 border-[#1B4332] rounded-[24px] py-6 px-5 shadow-[0_10px_40px_rgba(27,67,50,0.1)] mb-6 relative">
            <View className="absolute -top-4 self-center bg-[#FFEE8C] px-5 py-1.5 rounded-[50px] shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
              <Text className="font-sans font-bold text-[#1B4332] text-[12px] tracking-wide">🔥 LICENÇA FUNDADOR</Text>
            </View>

            <Text className="font-title text-[#1B4332] text-[24px] text-center mb-4 mt-2">Plano Premium Yelo</Text>
            
            <View className="items-center mb-6">
              <View className="flex-row items-end justify-center mb-2">
                <Text className="font-sans font-bold text-[#adb5bd] text-[16px] line-through mr-2 mb-1">R$ 199</Text>
                <Text className="font-title text-[#1B4332] text-[40px] leading-[40px]">R$ 99</Text>
                <Text className="font-sans font-medium text-[#888] text-[15px] ml-1 mb-1">/mês</Text>
              </View>
              <Text className="font-sans font-bold text-[#16a34a] text-[11px] text-center uppercase tracking-wide">
                14 dias de teste grátis{'\n'}Não precisa de cartão
              </Text>
            </View>

            <View className="flex-col gap-3 mb-8">
              <View className="flex-row items-start gap-3">
                <Text className="text-[16px]">✅</Text>
                <Text className="font-sans font-medium text-[#495057] text-[14px] flex-1">Marketplace Prioritário (Match Inteligente)</Text>
              </View>
              <View className="flex-row items-start gap-3">
                <Text className="text-[16px]">✅</Text>
                <Text className="font-sans font-medium text-[#495057] text-[14px] flex-1">Agenda e Financeiro Completos</Text>
              </View>
              <View className="flex-row items-start gap-3">
                <Text className="text-[16px]">✅</Text>
                <Text className="font-sans font-medium text-[#495057] text-[14px] flex-1">Página Pública (Perfil Yelo Otimizado)</Text>
              </View>
              <View className="flex-row items-start gap-3">
                <Text className="text-[16px]">✨</Text>
                <Text className="font-sans font-bold text-[#16a34a] text-[14px] flex-1">Licença vitalícia sem reajuste de mensalidade</Text>
              </View>
            </View>

            <TouchableOpacity className="bg-[#1B4332] w-full py-4 rounded-[50px] items-center shadow-[0_6px_20px_rgba(27,67,50,0.25)] mb-3">
              <Text className="font-sans font-bold text-white text-[16px]">Assinar Agora</Text>
            </TouchableOpacity>

            <View className="flex-row items-center justify-center gap-1.5">
              <Feather name="lock" size={12} color="#888" />
              <Text className="font-sans font-medium text-[#888] text-[12px]">Ambiente 100% seguro</Text>
            </View>
          </View>

          {/* PLANO CLÍNICO (EM BREVE) */}
          <View className="bg-[#fcfcfc] border border-[#f0f0f0] rounded-[24px] py-6 px-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-6 relative opacity-75">
            <View className="absolute -top-4 self-center bg-[#e9ecef] border border-[#dee2e6] px-4 py-1.5 rounded-[50px]">
              <Text className="font-sans font-bold text-[#666] text-[12px] tracking-wide">EM BREVE</Text>
            </View>

            <Text className="font-title text-[#666] text-[24px] text-center mb-4 mt-2">Plano Clínico</Text>
            
            <View className="items-center mb-6">
              <View className="flex-row items-end justify-center">
                <Text className="font-title text-[#666] text-[40px] leading-[40px]">R$ 159</Text>
                <Text className="font-sans font-medium text-[#888] text-[15px] ml-1 mb-1">/mês</Text>
              </View>
            </View>

            <View className="flex-col gap-3 mb-8 grayscale opacity-80">
              <View className="flex-row items-start gap-3">
                <Text className="text-[16px]">✨</Text>
                <Text className="font-sans font-bold text-[#495057] text-[14px] flex-1">Tudo do Essencial, mais:</Text>
              </View>
              <View className="flex-row items-start gap-3">
                <Text className="text-[16px]">✅</Text>
                <Text className="font-sans font-medium text-[#495057] text-[14px] flex-1">Eventos e Workshops Exclusivos</Text>
              </View>
              <View className="flex-row items-start gap-3">
                <Text className="text-[16px]">✅</Text>
                <Text className="font-sans font-medium text-[#495057] text-[14px] flex-1">Acesso a Pacientes da Comunidade</Text>
              </View>
              <View className="flex-row items-start gap-3">
                <Text className="text-[16px]">✅</Text>
                <Text className="font-sans font-medium text-[#495057] text-[14px] flex-1">URL Personalizada na Yelo</Text>
              </View>
            </View>

            <View className="bg-[#e9ecef] w-full py-4 rounded-[50px] items-center">
              <Text className="font-sans font-bold text-[#999] text-[16px]">Disponível em Breve</Text>
            </View>
          </View>

          {/* PLANO REFERÊNCIA (EM BREVE) */}
          <View className="bg-[#fcfcfc] border border-[#f0f0f0] rounded-[24px] py-6 px-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-6 relative opacity-75">
            <View className="absolute -top-4 self-center bg-[#e9ecef] border border-[#dee2e6] px-4 py-1.5 rounded-[50px]">
              <Text className="font-sans font-bold text-[#666] text-[12px] tracking-wide">EM BREVE</Text>
            </View>

            <Text className="font-title text-[#666] text-[24px] text-center mb-4 mt-2">Plano Referência</Text>
            
            <View className="items-center mb-6">
              <View className="flex-row items-end justify-center">
                <Text className="font-title text-[#666] text-[40px] leading-[40px]">R$ 259</Text>
                <Text className="font-sans font-medium text-[#888] text-[15px] ml-1 mb-1">/mês</Text>
              </View>
            </View>

            <View className="flex-col gap-3 mb-8 grayscale opacity-80">
              <View className="flex-row items-start gap-3">
                <Text className="text-[16px]">🚀</Text>
                <Text className="font-sans font-bold text-[#495057] text-[14px] flex-1">Tudo do Clínico, mais:</Text>
              </View>
              <View className="flex-row items-start gap-3">
                <Text className="text-[16px]">✅</Text>
                <Text className="font-sans font-medium text-[#495057] text-[14px] flex-1">Supervisão Clínica Integrada</Text>
              </View>
              <View className="flex-row items-start gap-3">
                <Text className="text-[16px]">✅</Text>
                <Text className="font-sans font-medium text-[#495057] text-[14px] flex-1">Destaque Prioritário nas Buscas</Text>
              </View>
              <View className="flex-row items-start gap-3">
                <Text className="text-[16px]">✅</Text>
                <Text className="font-sans font-medium text-[#495057] text-[14px] flex-1">Selo de Autoridade Premium</Text>
              </View>
            </View>

            <View className="bg-[#e9ecef] w-full py-4 rounded-[50px] items-center">
              <Text className="font-sans font-bold text-[#999] text-[16px]">Disponível em Breve</Text>
            </View>
          </View>

        </View>
      </YeloScrollView>
    </View>
  );
}
