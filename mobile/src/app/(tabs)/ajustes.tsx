import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import YeloScrollView from '../../components/YeloScrollView';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';

export default function AjustesScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert(
      "Encerrar Sessão",
      "Tem certeza que deseja sair da sua conta?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Sair", 
          style: "destructive", 
          onPress: async () => {
            await signOut();
            router.replace('/');
          }
        }
      ]
    );
  };

  const handleOpenPublicProfile = () => {
    if (user?.slug) {
      router.push(`/${user.slug}` as any);
    } else {
      router.navigate('/meu_perfil');
    }
  };

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <StatusBar style="dark" />
      <View className="flex-1">
        <YeloScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          
          {/* HEADER DA PÁGINA */}
          <View className="mx-6 mt-6 mb-6 bg-[#1B4332] p-[22px] rounded-[16px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] justify-between">
            <View>
              <Text className="font-title text-[26px] text-white mb-2 leading-tight">
                Ajustes da Conta
              </Text>
              <Text className="font-sans text-[16px] text-white/85">
                Gerencie as configurações do seu perfil, assinatura e canais de contato.
              </Text>
            </View>
          </View>

          {/* GRID DE CARDS (HUB) */}
          <View className="px-6 pb-32">
            
            {/* Card 1: Meu Perfil */}
            <TouchableOpacity 
              onPress={() => router.navigate('/meu_perfil')} 
              className="bg-white border border-[#e5e7eb] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5"
            >
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#f0fdf4] items-center justify-center mr-5">
                <Text className="text-[24px]">⚙️</Text>
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[19px] mb-1">Meu Perfil</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Dados pessoais, biografia e credenciais.</Text>
              </View>
            </TouchableOpacity>

            {/* Card 2: Assinatura */}
            <TouchableOpacity 
              onPress={() => router.navigate('/assinatura')} 
              className="bg-white border border-[#e5e7eb] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5"
            >
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#f0fdf4] items-center justify-center mr-5">
                <Text className="text-[24px]">⭐</Text>
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[19px] mb-1">Assinatura & Planos</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Gerenciar plano ativo e renovação.</Text>
              </View>
            </TouchableOpacity>

            {/* Card 3: Perfil Público */}
            <TouchableOpacity 
              onPress={handleOpenPublicProfile} 
              className="bg-white border border-[#e5e7eb] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5"
            >
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#f0fdf4] items-center justify-center mr-5">
                <Feather name="external-link" size={24} color="#1B4332" />
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[19px] mb-1">Meu Perfil Público</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Veja como os pacientes visualizam sua página.</Text>
              </View>
            </TouchableOpacity>

            {/* Card 4: Métricas de Mercado */}
            <TouchableOpacity 
              onPress={() => router.navigate('/analytics')} 
              className="bg-white border border-[#e5e7eb] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5"
            >
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#f0fdf4] items-center justify-center mr-5">
                <Text className="text-[24px]">📊</Text>
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[19px] mb-1">Inteligência de Mercado</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Demandas mais buscadas e autoridade relativa.</Text>
              </View>
            </TouchableOpacity>

            {/* Card 5: Encerrar Sessão */}
            <TouchableOpacity 
              onPress={handleLogout}
              className="bg-white border border-[#ffe4e6] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5 mt-2"
            >
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#fff1f2] items-center justify-center mr-5">
                <Text className="text-[24px]">🚪</Text>
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#e63946] text-[19px] mb-1">Encerrar Sessão</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Sair da sua conta com segurança.</Text>
              </View>
            </TouchableOpacity>

          </View>
        </YeloScrollView>
      </View>
    </View>
  );
}
