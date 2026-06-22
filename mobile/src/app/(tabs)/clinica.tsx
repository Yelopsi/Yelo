import { View, Text, TouchableOpacity, ScrollView, Platform } from 'react-native';
import YeloScrollView from '../../components/YeloScrollView';

import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';

export default function ClinicaScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <StatusBar style="dark" />
      <View className="flex-1">
        <YeloScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          
          {/* HEADER DA PÁGINA (main-header) */}
          <View className="mx-6 mt-6 mb-6 bg-[#1B4332] p-[22px] rounded-[16px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] justify-between">
            <View>
              <Text className="font-title text-[26px] text-white mb-2 leading-tight">
                Gestão da Clínica
              </Text>
              <Text className="font-sans text-[16px] text-white/85">
                Organize seus pacientes, agenda e finanças em um só lugar.
              </Text>
            </View>
          </View>

          {/* GRID DE CARDS (HUB) */}
          <View className="px-6 pb-32">
            
            {/* Card 1: Meus Pacientes */}
            <TouchableOpacity 
              onPress={() => router.push('/pacientes')}
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
              onPress={() => router.push('/financeiro')}
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
              onPress={() => router.push('/analytics')}
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
              onPress={() => router.push('/favoritos-analytics')}
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
              onPress={() => router.push('/calculadora')}
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
              onPress={() => router.push('/manual-conversao')}
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
