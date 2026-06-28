import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function AjustesHubScreen() {
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert(
      "Sair",
      "Tem certeza que deseja sair?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Sair", style: "destructive", onPress: () => router.replace('/') }
      ]
    );
  };

  return (
    <ScrollView className="flex-1 bg-[#f9fafb]" contentContainerStyle={{ padding: 20 }}>
      
      <View className="mb-[25px]">
        <Text className="font-title text-[#1B4332] text-[28px] mb-[4px]">Ajustes</Text>
        <Text className="font-sans text-[#666] text-[15px]">Gerencie sua conta e suas preferências.</Text>
      </View>

      <View className="gap-[15px]">
        {/* Card Minha Conta */}
        <TouchableOpacity 
          onPress={() => Alert.alert('Aviso', 'Funcionalidade "Minha Conta" em breve.')}
          className="bg-white rounded-[20px] p-[20px] flex-row items-center border border-[#f0f0f0] shadow-[0_4px_15px_rgba(0,0,0,0.02)]"
        >
          <View className="w-[50px] h-[50px] bg-[#f3f4f6] rounded-[16px] items-center justify-center mr-[15px]">
            <Feather name="user" size={24} color="#4b5563" />
          </View>
          <View className="flex-1">
            <Text className="font-title text-[#333] text-[18px] mb-[2px]">Minha Conta</Text>
            <Text className="font-sans text-[#666] text-[13px] leading-[18px]">Dados pessoais, segurança e exclusão de conta</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#ccc" />
        </TouchableOpacity>

        {/* Card Suporte */}
        <TouchableOpacity 
          onPress={() => Alert.alert('Suporte', 'Abrindo canais de atendimento...')}
          className="bg-white rounded-[20px] p-[20px] flex-row items-center border border-[#f0f0f0] shadow-[0_4px_15px_rgba(0,0,0,0.02)]"
        >
          <View className="w-[50px] h-[50px] bg-[#e8f5e9] rounded-[16px] items-center justify-center mr-[15px]">
            <Feather name="help-circle" size={24} color="#16a34a" />
          </View>
          <View className="flex-1">
            <Text className="font-title text-[#333] text-[18px] mb-[2px]">Fale com a Yelo</Text>
            <Text className="font-sans text-[#666] text-[13px] leading-[18px]">Dúvidas, problemas técnicos ou suporte</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#ccc" />
        </TouchableOpacity>

        {/* Card Sair */}
        <TouchableOpacity 
          onPress={handleLogout}
          className="bg-white rounded-[20px] p-[20px] flex-row items-center border border-[#fca5a5] shadow-[0_4px_15px_rgba(0,0,0,0.02)] mt-[10px]"
        >
          <View className="w-[50px] h-[50px] bg-[#fef2f2] rounded-[16px] items-center justify-center mr-[15px]">
            <Feather name="log-out" size={24} color="#e63946" />
          </View>
          <View className="flex-1">
            <Text className="font-title text-[#e63946] text-[18px] mb-[2px]">Sair</Text>
            <Text className="font-sans text-[#666] text-[13px] leading-[18px]">Encerrar sua sessão de forma segura</Text>
          </View>
        </TouchableOpacity>

      </View>
    </ScrollView>
  );
}
