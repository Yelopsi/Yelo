import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import YeloScrollView from '../../components/YeloScrollView';

import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function ComunidadeYeloScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <YeloScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        
        {/* HEADER */}
        <View className="mx-6 mt-6 mb-8 bg-[#1B4332] p-[22px] rounded-[16px] shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
          <View className="flex-row items-center mb-2">
            <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-white/20 rounded-full items-center justify-center mr-4">
              <Feather name="arrow-left" size={20} color="white" />
            </TouchableOpacity>
            <Text className="font-title text-[24px] text-white leading-tight flex-1">Comunidade Yelo</Text>
          </View>
          <Text className="font-sans text-[15px] text-white/85 mt-2 leading-relaxed">
            Acesse workshops, grupos de intervisão e bibliotecas exclusivas.
          </Text>
        </View>

        {/* MENSAGEM DE EM CONSTRUÇÃO */}
        <View className="mx-6 bg-white border border-[#e5e7eb] rounded-[24px] p-8 items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
          
          <View className="w-[80px] h-[80px] bg-[#f0fdf4] rounded-[24px] items-center justify-center mb-6">
            <Text className="text-[40px]">🚧</Text>
          </View>

          <Text className="font-title text-[#1B4332] text-[24px] text-center mb-3 leading-tight">
            Nossa Comunidade está quase pronta!
          </Text>

          <Text className="font-sans text-[#666] text-[15px] text-center leading-relaxed mb-8">
            Estamos preparando um espaço incrível para o seu desenvolvimento profissional. Em breve, você terá acesso a:
          </Text>

          {/* LISTA DE FEATURES */}
          <View className="w-full mb-8">
            <View className="flex-row items-center mb-4 bg-[#f8f9fa] p-4 rounded-[12px] border border-[#eee]">
              <Text className="text-[22px] mr-4">🎓</Text>
              <Text className="font-sans font-bold text-[#333] text-[15px] flex-1">Workshops Exclusivos</Text>
            </View>
            <View className="flex-row items-center mb-4 bg-[#f8f9fa] p-4 rounded-[12px] border border-[#eee]">
              <Text className="text-[22px] mr-4">🤝</Text>
              <Text className="font-sans font-bold text-[#333] text-[15px] flex-1">Grupos de Intervisão</Text>
            </View>
            <View className="flex-row items-center bg-[#f8f9fa] p-4 rounded-[12px] border border-[#eee]">
              <Text className="text-[22px] mr-4">📚</Text>
              <Text className="font-sans font-bold text-[#333] text-[15px] flex-1">Supervisão Clínica</Text>
            </View>
          </View>

          <TouchableOpacity 
            onPress={() => router.back()}
            className="bg-[#1B4332] w-full py-4 rounded-[50px] items-center shadow-[0_4px_15px_rgba(27,67,50,0.2)]"
          >
            <Text className="font-sans font-bold text-white text-[15px]">Voltar para o Hub</Text>
          </TouchableOpacity>

        </View>

      </YeloScrollView>
    </View>
  );
}
