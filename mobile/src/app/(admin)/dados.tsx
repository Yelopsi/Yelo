import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function AdminDadosHubScreen() {
  const router = useRouter();
  return (
    <ScrollView className="flex-1 bg-[#f9fafb]" contentContainerStyle={{ padding: 20 }}>
      {/* Cabeçalho do Hub */}
      <View className="bg-[#1e1b4b] rounded-[24px] p-[24px] mb-[25px] shadow-[0_4px_20px_rgba(30,27,75,0.15)] relative overflow-hidden">
        <View className="absolute top-[-20px] right-[-20px] w-[120px] h-[120px] bg-white/5 rounded-full" />
        <Text className="font-title text-white text-[28px] mb-[4px]">Dados e Finanças</Text>
        <Text className="font-sans text-white/80 text-[14px]">Análise de métricas, pagamentos e exportações.</Text>
      </View>

      <View className="gap-[15px]">
        {/* Relatórios e Gráficos */}
        <TouchableOpacity onPress={() => router.push('/(admin)/(crm)/analytics-crescimento')} className="bg-white rounded-[16px] p-[16px] flex-row items-center border border-[#f0f0f0]">
          <View className="w-[45px] h-[45px] bg-[#e0f2fe] rounded-[12px] items-center justify-center mr-[15px]">
            <Feather name="bar-chart-2" size={20} color="#0284c7" />
          </View>
          <View className="flex-1">
            <Text className="font-title text-[#333] text-[16px] mb-[2px]">Relatórios e Gráficos</Text>
            <Text className="font-sans text-[#666] text-[12px] leading-[16px]">Evolução, acessos e tendências de mercado.</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#ccc" />
        </TouchableOpacity>

        {/* Métricas de Match */}
        <TouchableOpacity onPress={() => router.push('/(admin)/metricas-match')} className="bg-white rounded-[16px] p-[16px] flex-row items-center border border-[#f0f0f0]">
          <View className="w-[45px] h-[45px] bg-[#fff3e0] rounded-[12px] items-center justify-center mr-[15px]">
            <Feather name="pie-chart" size={20} color="#f59e0b" />
          </View>
          <View className="flex-1">
            <Text className="font-title text-[#333] text-[16px] mb-[2px]">Métricas de Match</Text>
            <Text className="font-sans text-[#666] text-[12px] leading-[16px]">O que os pacientes buscam (Questionários).</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#ccc" />
        </TouchableOpacity>

        {/* Downloads */}
        <TouchableOpacity onPress={() => router.push('/(admin)/exportar')} className="bg-white rounded-[16px] p-[16px] flex-row items-center border border-[#f0f0f0]">
          <View className="w-[45px] h-[45px] bg-[#f3f4f6] rounded-[12px] items-center justify-center mr-[15px]">
            <Feather name="download" size={20} color="#4b5563" />
          </View>
          <View className="flex-1">
            <Text className="font-title text-[#333] text-[16px] mb-[2px]">Downloads (Exportar)</Text>
            <Text className="font-sans text-[#666] text-[12px] leading-[16px]">Baixe listas e dados em XLS/CSV.</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#ccc" />
        </TouchableOpacity>
      </View>
      <View className="h-[120px]" />
    </ScrollView>
  );
}
