import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function AdminConteudoHubScreen() {
  const router = useRouter();
  return (
    <ScrollView className="flex-1 bg-[#f9fafb]" contentContainerStyle={{ padding: 20 }}>
      {/* Cabeçalho do Hub */}
      <View className="bg-[#1e1b4b] rounded-[24px] p-[24px] mb-[25px] shadow-[0_4px_20px_rgba(30,27,75,0.15)] relative overflow-hidden">
        <View className="absolute top-[-20px] right-[-20px] w-[120px] h-[120px] bg-white/5 rounded-full" />
        <Text className="font-title text-white text-[28px] mb-[4px]">Conteúdo e Comunidade</Text>
        <Text className="font-sans text-white/80 text-[14px]">Modere conteúdos, fórum e avaliações.</Text>
      </View>

      <View className="gap-[15px]">
        {/* Gestão de Conteúdo */}
        <TouchableOpacity onPress={() => router.push('/(admin)/gestao-conteudo')} className="bg-white rounded-[16px] p-[16px] flex-row items-center border border-[#f0f0f0]">
          <View className="w-[45px] h-[45px] bg-[#f3e8ff] rounded-[12px] items-center justify-center mr-[15px]">
            <Feather name="layout" size={20} color="#7e22ce" />
          </View>
          <View className="flex-1">
            <Text className="font-title text-[#333] text-[16px] mb-[2px]">Gestão de Conteúdo</Text>
            <Text className="font-sans text-[#666] text-[12px] leading-[16px]">Moderação de avaliações, Q&A e Blogs.</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#ccc" />
        </TouchableOpacity>

        {/* Moderação do Fórum */}
        <TouchableOpacity onPress={() => router.push('/(admin)/moderacao-forum')} className="bg-white rounded-[16px] p-[16px] flex-row items-center border border-[#f0f0f0]">
          <View className="w-[45px] h-[45px] bg-[#e8f5e9] rounded-[12px] items-center justify-center mr-[15px]">
            <Feather name="message-square" size={20} color="#1b4332" />
          </View>
          <View className="flex-1">
            <Text className="font-title text-[#333] text-[16px] mb-[2px]">Moderação do Fórum</Text>
            <Text className="font-sans text-[#666] text-[12px] leading-[16px]">Gerencie denúncias e posts da comunidade.</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#ccc" />
        </TouchableOpacity>

        {/* Gestão da Comunidade */}
        <TouchableOpacity onPress={() => router.push('/(admin)/comunidade-gestao')} className="bg-white rounded-[16px] p-[16px] flex-row items-center border border-[#f0f0f0]">
          <View className="w-[45px] h-[45px] bg-[#e0f2fe] rounded-[12px] items-center justify-center mr-[15px]">
            <Feather name="users" size={20} color="#0284c7" />
          </View>
          <View className="flex-1">
            <Text className="font-title text-[#333] text-[16px] mb-[2px]">Gestão da Comunidade</Text>
            <Text className="font-sans text-[#666] text-[12px] leading-[16px]">Edite banners e links de recursos úteis.</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#ccc" />
        </TouchableOpacity>
      </View>
      <View className="h-[120px]" />
    </ScrollView>
  );
}
