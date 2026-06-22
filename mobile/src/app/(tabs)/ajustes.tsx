import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import YeloScrollView from '../../components/YeloScrollView';

import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';

export default function AjustesScreen() {
  const { signOut } = useAuth();
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
                Ajustes da Conta
              </Text>
              <Text className="font-sans text-[16px] text-white/85">
                Gerencie as configurações do seu perfil, assinatura e obtenha suporte.
              </Text>
            </View>
          </View>

          {/* GRID DE CARDS (HUB) */}
          <View className="px-6 pb-32">
            
            {/* Card 1: Meu Perfil */}
            <TouchableOpacity onPress={() => router.push('/meu_perfil')} className="bg-white border border-[#e5e7eb] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5">
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#f0fdf4] items-center justify-center mr-5">
                <Text className="text-[24px]">⚙️</Text>
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[19px] mb-1">Meu Perfil</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Dados pessoais, biografia e credenciais.</Text>
              </View>
            </TouchableOpacity>

            {/* Card 2: Assinatura */}
            <TouchableOpacity onPress={() => router.push('/assinatura')} className="bg-white border border-[#e5e7eb] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5">
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#f0fdf4] items-center justify-center mr-5">
                <Text className="text-[24px]">⭐</Text>
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[19px] mb-1">Assinatura & Planos</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Gerenciar plano e métodos de pagamento.</Text>
              </View>
            </TouchableOpacity>

            {/* Card 3: Perfil Público */}
            <TouchableOpacity onPress={() => router.push('/perfil_publico')} className="bg-white border border-[#e5e7eb] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5">
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#f0fdf4] items-center justify-center mr-5">
                <Feather name="external-link" size={24} color="#1B4332" />
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[19px] mb-1">Meu Perfil Público</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Veja como os pacientes visualizam sua página na Yelo.</Text>
              </View>
            </TouchableOpacity>

            {/* Card 4: Fale com a Yelo */}
            <TouchableOpacity onPress={() => router.push('/fale_com_a_yelo')} className="bg-white border border-[#e5e7eb] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5">
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#f0fdf4] items-center justify-center mr-5">
                <Text className="text-[24px]">🎧</Text>
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[19px] mb-1">Fale com a Yelo</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Suporte direto com nossa equipe.</Text>
              </View>
            </TouchableOpacity>

            {/* Card 5: Encerrar Sessão */}
            <TouchableOpacity 
              onPress={signOut}
              className="bg-white border border-[#ffe4e6] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5"
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
