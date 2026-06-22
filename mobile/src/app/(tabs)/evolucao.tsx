import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import YeloScrollView from '../../components/YeloScrollView';

import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';

export default function EvolucaoScreen() {
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
                Evolução & Comunidade
              </Text>
              <Text className="font-sans text-[16px] text-white/85">
                Acompanhe sua jornada, conecte-se com colegas e compartilhe conhecimento.
              </Text>
            </View>
          </View>

          {/* GRID DE CARDS (HUB) */}
          <View className="px-6 pb-32">
            
            {/* Card 1: Minha Jornada */}
            <TouchableOpacity onPress={() => router.push('/jornada')} className="bg-white border border-[#e5e7eb] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5">
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#f0fdf4] items-center justify-center mr-5">
                <Text className="text-[24px]">🚀</Text>
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[19px] mb-1">Minha Jornada</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Nível de autoridade, XP e conquistas.</Text>
              </View>
            </TouchableOpacity>

            {/* Card 2: Meus Artigos */}
            <TouchableOpacity onPress={() => router.push('/blog')} className="bg-white border border-[#e5e7eb] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5">
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#f0fdf4] items-center justify-center mr-5">
                <Text className="text-[24px]">✍️</Text>
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[19px] mb-1">Meus Artigos</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Escreva e publique no blog da plataforma.</Text>
              </View>
            </TouchableOpacity>

            {/* Card 3: Fórum de Discussão */}
            <TouchableOpacity onPress={() => router.push('/forum')} className="bg-white border border-[#e5e7eb] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5">
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#f0fdf4] items-center justify-center mr-5">
                <Text className="text-[24px]">💬</Text>
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[19px] mb-1">Fórum de Discussão</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Intervisão e troca de experiências.</Text>
              </View>
            </TouchableOpacity>

            {/* Card 4: Perguntas da Comunidade */}
            <TouchableOpacity onPress={() => router.push('/comunidade')} className="bg-white border border-[#e5e7eb] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5">
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#f0fdf4] items-center justify-center mr-5">
                <Text className="text-[24px]">❓</Text>
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[19px] mb-1">Perguntas da Comunidade</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Responda dúvidas de pacientes.</Text>
              </View>
            </TouchableOpacity>

            {/* Card 5: Comunidade Yelo */}
            <TouchableOpacity onPress={() => router.push('/comunidade_yelo')} className="bg-white border border-[#e5e7eb] rounded-[16px] p-[25px] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5">
              <View className="w-[55px] h-[55px] rounded-[16px] bg-[#f0fdf4] items-center justify-center mr-5">
                <Text className="text-[24px]">🎓</Text>
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[19px] mb-1">Comunidade Yelo</Text>
                <Text className="font-sans text-[14px] text-[#888] leading-snug">Acesse workshops e biblioteca de arquivos.</Text>
              </View>
            </TouchableOpacity>

          </View>
        </YeloScrollView>
      </View>
    </View>
  );
}
