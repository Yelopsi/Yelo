import React from 'react';
import { View, Text, Image, TouchableOpacity, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MobileHeader() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View 
      className="flex-row items-center bg-white border-b border-[#e0e0e0]"
      style={{ 
        paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 44 : 20) + 10,
        paddingBottom: 10,
        paddingHorizontal: 15
      }}
    >
      {/* AVATAR */}
      <TouchableOpacity onPress={() => router.push('/ajustes')} className="relative mr-2">
        <Image 
          source={{ uri: 'https://res.cloudinary.com/dzqmypviz/image/upload/v1779824708/yelo/profiles/profile-94.jpg' }} 
          className="w-[36px] h-[36px] rounded-full border-2 border-[#1B4332]"
        />
      </TouchableOpacity>

      {/* STATUS & BADGES */}
      <View className="flex-row items-center flex-wrap flex-1 space-x-2 ml-1">
        
        {/* Badge de Nível Ativo */}
        <View className="bg-[#e8f5e9] px-[8px] py-[4px] rounded-[20px] justify-center items-center">
          <Text className="font-sans text-[12px] text-[#1B4332]">
            🔥 Nível: <Text className="font-bold">Ativo</Text>
          </Text>
        </View>

        {/* Container de Conquistas */}
        <View className="flex-row items-center space-x-1">
          {/* Autêntico */}
          <View className="w-[19px] h-[19px] rounded-full bg-[#1B4332] items-center justify-center">
            <Feather name="check" size={12} color="white" />
          </View>
          {/* Semeador */}
          <Text className="text-[19px]">🌱</Text>
          {/* Voz Ativa */}
          <Text className="text-[19px]">💬</Text>
          {/* Pioneiro */}
          <Text className="text-[19px]">🏅</Text>
        </View>
      </View>

      {/* NOTIFICAÇÕES */}
      <TouchableOpacity 
        className="ml-auto p-1 rounded-full items-center justify-center"
        onPress={() => console.log('Ir para Avisos')}
      >
        <Feather name="bell" size={22} color="#1B4332" />
      </TouchableOpacity>
    </View>
  );
}
