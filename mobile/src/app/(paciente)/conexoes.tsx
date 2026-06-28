import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function ConexoesHubScreen() {
  const router = useRouter();

  return (
    <ScrollView className="flex-1 bg-[#f9fafb]" contentContainerStyle={{ padding: 20 }}>
      
      <View className="mb-[25px]">
        <Text className="font-title text-[#1B4332] text-[28px] mb-[4px]">Conexões</Text>
        <Text className="font-sans text-[#666] text-[15px]">Gerencie seus matches, favoritos e avaliações.</Text>
      </View>

      <View className="gap-[15px]">
        {/* Card Matches */}
        <TouchableOpacity 
          onPress={() => router.push('/resultados')}
          className="bg-white rounded-[20px] p-[20px] flex-row items-center border border-[#f0f0f0] shadow-[0_4px_15px_rgba(0,0,0,0.02)]"
        >
          <View className="w-[50px] h-[50px] bg-[#e8f5e9] rounded-[16px] items-center justify-center mr-[15px]">
            <Feather name="users" size={24} color="#1B4332" />
          </View>
          <View className="flex-1">
            <Text className="font-title text-[#333] text-[18px] mb-[2px]">Meus Matches</Text>
            <Text className="font-sans text-[#666] text-[13px] leading-[18px]">Veja os profissionais compatíveis com seu perfil</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#ccc" />
        </TouchableOpacity>

        {/* Card Favoritos */}
        <TouchableOpacity 
          onPress={() => Alert.alert('Aviso', 'Funcionalidade "Favoritos" em breve.')}
          className="bg-white rounded-[20px] p-[20px] flex-row items-center border border-[#f0f0f0] shadow-[0_4px_15px_rgba(0,0,0,0.02)]"
        >
          <View className="w-[50px] h-[50px] bg-[#fff3e0] rounded-[16px] items-center justify-center mr-[15px]">
            <Feather name="heart" size={24} color="#f59e0b" />
          </View>
          <View className="flex-1">
            <Text className="font-title text-[#333] text-[18px] mb-[2px]">Favoritos</Text>
            <Text className="font-sans text-[#666] text-[13px] leading-[18px]">Profissionais que você salvou para consultar depois</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#ccc" />
        </TouchableOpacity>

        {/* Card Avaliações */}
        <TouchableOpacity 
          onPress={() => Alert.alert('Aviso', 'Funcionalidade "Avaliações" em breve.')}
          className="bg-white rounded-[20px] p-[20px] flex-row items-center border border-[#f0f0f0] shadow-[0_4px_15px_rgba(0,0,0,0.02)]"
        >
          <View className="w-[50px] h-[50px] bg-[#fce7f3] rounded-[16px] items-center justify-center mr-[15px]">
            <Feather name="message-square" size={24} color="#be185d" />
          </View>
          <View className="flex-1">
            <Text className="font-title text-[#333] text-[18px] mb-[2px]">Minhas Avaliações</Text>
            <Text className="font-sans text-[#666] text-[13px] leading-[18px]">Histórico das suas avaliações de profissionais</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#ccc" />
        </TouchableOpacity>

        {/* Card Refazer Questionário */}
        <TouchableOpacity 
          onPress={() => router.push('/questionario')}
          className="bg-white rounded-[20px] p-[20px] flex-row items-center border border-[#f0f0f0] shadow-[0_4px_15px_rgba(0,0,0,0.02)]"
        >
          <View className="w-[50px] h-[50px] bg-[#e0f2fe] rounded-[16px] items-center justify-center mr-[15px]">
            <Feather name="refresh-cw" size={24} color="#0284c7" />
          </View>
          <View className="flex-1">
            <Text className="font-title text-[#333] text-[18px] mb-[2px]">Refazer Questionário</Text>
            <Text className="font-sans text-[#666] text-[13px] leading-[18px]">Atualize suas respostas para encontrar novos perfis</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#ccc" />
        </TouchableOpacity>

      </View>
    </ScrollView>
  );
}
