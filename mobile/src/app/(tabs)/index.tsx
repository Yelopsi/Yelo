import { View, Text, TouchableOpacity, ScrollView, Platform, Linking } from 'react-native';
import YeloScrollView from '../../components/YeloScrollView';

import { useAuth } from '../../contexts/AuthContext';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

export default function HomeScreen() {
  const { user } = useAuth();

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <StatusBar style="dark" />
      <YeloScrollView 
        className="flex-1 px-5 pt-6"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* HERO CARD (Banner de Desempenho) */}
        <LinearGradient
          colors={['#1B4332', '#2A5A40']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ 
            borderRadius: 24, 
            padding: 22, 
            marginBottom: 24,
            shadowColor: '#1B4332', 
            shadowOpacity: 0.12, 
            shadowRadius: 35, 
            shadowOffset: {width: 0, height: 12}, 
            elevation: 5 
          }}
        >
          <View className="flex-row justify-between items-start mb-8 relative z-10">
            <View className="flex-1 pr-4">
              <Text className="font-title text-white text-[32px] mb-1">👋 Olá!</Text>
              <Text className="font-sans text-white/85 text-[16px]">Seu crescimento essa semana:</Text>
            </View>
            <TouchableOpacity className="bg-[#FFEE8C] px-4 py-3 rounded-full">
              <Text className="font-sans font-bold text-[#1B4332] text-[13px]">Melhorar perfil</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row justify-between mb-2 relative z-10">
            <View className="flex-1">
              <Text className="font-title text-[#FFEE8C] text-[44px] leading-tight mb-1">+0</Text>
              <Text className="font-sans text-white/90 text-[13px] uppercase tracking-wider font-medium">Contatos de pacientes</Text>
            </View>
            <View className="flex-1 items-end text-right">
              <Text className="font-title text-[#FFEE8C] text-[44px] leading-tight mb-1">0</Text>
              <Text className="font-sans text-white/90 text-[13px] uppercase tracking-wider text-right font-medium">Visualizações no perfil</Text>
            </View>
          </View>

          <View className="bg-white/15 self-start px-4 py-2 rounded-full mt-4 relative z-10">
            <Text className="font-sans text-[#d1fae5] text-[13px] font-bold">🔥 Seu perfil está melhor que 0%</Text>
          </View>
        </LinearGradient>

        {/* PRÓXIMAS SESSÕES */}
        <View className="mb-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="font-title text-[#1B4332] text-[22px]">Sessões de Hoje</Text>
            <TouchableOpacity>
              <Text className="font-sans font-bold text-[#1B4332] text-[14px]">Ver todas</Text>
            </TouchableOpacity>
          </View>

          {/* CARD SESSÃO 1 */}
          <TouchableOpacity 
            onPress={() => Linking.openURL('whatsapp://send?phone=5511999999999&text=Olá, Ana Maria!')}
            className="bg-white rounded-[24px] p-4 mb-3 border border-[#e5e7eb] flex-row items-center shadow-[0_4px_20px_rgba(0,0,0,0.03)]"
          >
            <View className="w-12 h-12 rounded-full bg-[#f3f4f6] mr-4 items-center justify-center overflow-hidden">
              <Text className="font-bold text-[#6b7280] text-[16px] font-sans">AM</Text>
            </View>
            <View className="flex-1">
              <Text className="text-[16px] font-bold text-[#1f2937] mb-1 font-sans">Ana Maria Silva</Text>
              <View className="flex-row items-center">
                <Feather name="clock" size={14} color="#6b7280" />
                <Text className="text-[13px] text-[#6b7280] ml-1.5 font-sans">14:00 - 14:50</Text>
              </View>
            </View>
            <View className="bg-[#1B4332] w-10 h-10 rounded-full items-center justify-center">
              <Feather name="video" size={18} color="white" />
            </View>
          </TouchableOpacity>
        </View>

        {/* CHECKLIST CARD (ESTÉTICA 1:1 COM A WEB) */}
        <View className="bg-white rounded-[24px] p-[22px] border border-[#e5e7eb] mb-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
          
          <View className="flex-row justify-between items-center mb-6">
            <Text className="font-title text-[#1B4332] text-[20px]">🔄 Fase 3: Manutenção</Text>
            <View className="bg-[#f0fdf4] px-[14px] py-[6px] rounded-[20px] border border-[#bbf7d0]">
              <Text className="font-sans text-[#1B4332] font-bold text-[12px]">2/2 em dia</Text>
            </View>
          </View>
          
          <View className="h-[8px] bg-[#f1f3f5] rounded-[4px] overflow-hidden mb-6">
            <View className="h-full bg-[#1B4332] w-full rounded-[4px]" />
          </View>

          <View className="space-y-3">
            {/* Item 1 - Concluído */}
            <TouchableOpacity className="flex-row items-center px-[14px] py-[12px] opacity-60 bg-transparent border border-transparent rounded-[16px]">
              <View className="w-[18px] h-[18px] rounded-full bg-[#1B4332] border-2 border-[#1B4332] items-center justify-center mr-3">
                <Text className="text-white font-bold text-[10px] mt-[-2px]">✓</Text>
              </View>
              <View className="flex-1">
                <Text className="font-sans font-bold text-[13px] text-[#888] mb-1 line-through">Você marcou presença na comunidade recentemente!</Text>
                <Text className="font-sans text-[11px] text-[#888]">Em dia!</Text>
              </View>
            </TouchableOpacity>

            {/* Item 2 - Concluído */}
            <TouchableOpacity className="flex-row items-center px-[14px] py-[12px] opacity-60 bg-transparent border border-transparent rounded-[16px] mt-[-10px]">
              <View className="w-[18px] h-[18px] rounded-full bg-[#1B4332] border-2 border-[#1B4332] items-center justify-center mr-3">
                <Text className="text-white font-bold text-[10px] mt-[-2px]">✓</Text>
              </View>
              <View className="flex-1">
                <Text className="font-sans font-bold text-[13px] text-[#888] mb-1 line-through">Seu último artigo está fresquinho!</Text>
                <Text className="font-sans text-[11px] text-[#888]">Em dia!</Text>
              </View>
            </TouchableOpacity>

            {/* Item 3 - Concluído */}
            <TouchableOpacity className="flex-row items-center px-[14px] py-[12px] opacity-60 bg-transparent border border-transparent rounded-[16px] mt-[-10px]">
              <View className="w-[18px] h-[18px] rounded-full bg-[#1B4332] border-2 border-[#1B4332] items-center justify-center mr-3">
                <Text className="text-white font-bold text-[10px] mt-[-2px]">✓</Text>
              </View>
              <View className="flex-1">
                <Text className="font-sans font-bold text-[13px] text-[#888] mb-1 line-through">Gestão financeira e agenda revisadas</Text>
                <Text className="font-sans text-[11px] text-[#888]">Organização</Text>
              </View>
            </TouchableOpacity>

            {/* Item 4 - Dica Ativa */}
            <TouchableOpacity className="flex-row px-[14px] py-[12px] bg-[#f8f9fa] border border-[#f1f3f5] rounded-[16px] items-center">
              <View className="w-[18px] h-[18px] mr-3 items-center justify-center">
                <Text className="text-[16px]">💡</Text>
              </View>
              <View className="flex-1">
                <Text className="font-sans font-bold text-[14px] text-[#333] mb-1 leading-tight">Ajustar sua página pública e foto para passar mais confiança e receber mais chamadas</Text>
                <View className="bg-[#d1fae5] self-start px-[8px] py-[2px] rounded-[6px] mt-1 flex-row items-center justify-center">
                  <Text className="font-sans font-bold text-[11px] text-[#059669]">Mais Contatos</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* PACIENTES CARD */}
        <View className="bg-white rounded-[24px] p-[22px] border border-[#e5e7eb] mb-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
          <View className="flex-row justify-between items-center mb-6">
            <Text className="font-title text-[#1B4332] text-[22px]">💬 Pacientes</Text>
          </View>
          
          <View className="bg-[#f8f9fa] rounded-[16px] p-5 mb-5 space-y-4">
            <View className="flex-row justify-between items-center border-b border-[#e9ecef] pb-4">
              <Text className="font-sans text-[13px] text-[#555] uppercase font-bold tracking-wider">Novos contatos</Text>
              <Text className="font-title text-[#1B4332] text-[28px]">0</Text>
            </View>
            <View className="flex-row justify-between items-center border-b border-[#e9ecef] py-4">
              <Text className="font-sans text-[13px] text-[#555] uppercase font-bold tracking-wider">Aparições no match</Text>
              <Text className="font-title text-[#1B4332] text-[28px]">0</Text>
            </View>
            <View className="flex-row justify-between items-center pt-4">
              <Text className="font-sans text-[13px] text-[#555] uppercase font-bold tracking-wider">Taxa de clique</Text>
              <Text className="font-title text-[#1B4332] text-[28px]">0%</Text>
            </View>
          </View>

          <TouchableOpacity className="bg-[#1B4332] py-4 rounded-[16px] items-center">
            <Text className="font-sans font-bold text-white text-[16px]">Gerenciar</Text>
          </TouchableOpacity>
        </View>

        {/* GESTÃO CARD */}
        <View className="bg-white rounded-[24px] p-5 border border-[#e5e7eb] mb-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
          <View className="flex-row items-center mb-4">
            <Feather name="layers" size={18} color="#555" />
            <Text className="font-sans font-bold text-[#555] text-[16px] ml-2">Gestão Resumida</Text>
          </View>

          <TouchableOpacity className="bg-white flex-row justify-between items-center p-4 rounded-[16px] border border-[#e9ecef] mb-3 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
            <View className="flex-row items-center">
              <Text className="text-[18px] mr-3">📅</Text>
              <Text className="font-sans font-bold text-[#333] text-[15px]">Agenda Hoje</Text>
            </View>
            <View className="bg-[#e8f5e9] px-3 py-1.5 rounded-[12px]">
              <Text className="font-sans font-bold text-[#1B4332] text-[13px]">0 atends.</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity className="bg-white flex-row justify-between items-center p-4 rounded-[16px] border border-[#e9ecef] shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
            <View className="flex-row items-center">
              <Text className="text-[18px] mr-3">💰</Text>
              <Text className="font-sans font-bold text-[#333] text-[15px]">Financeiro</Text>
            </View>
            <View className="bg-[#e8f5e9] px-3 py-1.5 rounded-[12px]">
              <Text className="font-sans font-bold text-[#1B4332] text-[13px]">R$ 0,00</Text>
            </View>
          </TouchableOpacity>
        </View>
      </YeloScrollView>
    </View>
  );
}
