import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import YeloScrollView from '../../components/YeloScrollView';

import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// Helper de Componente: Card de XP
const XpRuleCard = ({ icon, title, xp, desc }: any) => (
  <View className="bg-white border border-[#e5e7eb] rounded-[16px] p-4 flex-row items-center shadow-[0_2px_8px_rgba(0,0,0,0.02)] mb-3">
    <Text className="text-[24px] mr-3">{icon}</Text>
    <View className="flex-1">
      <Text className="font-sans font-bold text-[#333] text-[15px]">{title}</Text>
      <View className="flex-row items-center mt-1">
        <Text className="font-sans font-bold text-[#16a34a] text-[14px] mr-2">+{xp} XP</Text>
        {desc && <Text className="font-sans text-[#888] text-[12px]">{desc}</Text>}
      </View>
    </View>
  </View>
);

// Helper de Componente: Badge de Conquista
const AchievementBadge = ({ icon, colorBg, colorText, title, max, current, isLocked }: any) => {
  const progressPercent = Math.min(100, Math.max(0, (current / max) * 100));
  
  return (
    <View className={`bg-white border ${isLocked ? 'border-[#e5e7eb] opacity-70' : `border-[${colorText}]`} rounded-[20px] p-5 mb-4 shadow-sm relative overflow-hidden`}>
      <View className="flex-row items-center mb-4">
        <View className={`w-[45px] h-[45px] bg-[${colorBg}] rounded-[12px] items-center justify-center mr-4`}>
          <Text className="text-[24px]">{icon}</Text>
        </View>
        <View className="flex-1">
          <Text className="font-title text-[#1B4332] text-[18px] mb-1">{title}</Text>
          <View className={`self-start px-2.5 py-1 rounded-full ${isLocked ? 'bg-[#f1f3f5]' : `bg-[${colorBg}]`}`}>
            <Text className={`font-sans font-bold text-[11px] ${isLocked ? 'text-[#666]' : `text-[${colorText}]`}`}>
              {isLocked ? 'Bloqueado' : 'Em Progresso'}
            </Text>
          </View>
        </View>
      </View>

      {/* Progress Bar */}
      <View className="h-[8px] bg-[#f1f3f5] rounded-full overflow-hidden mb-2">
        <View 
          className={`h-full rounded-full ${isLocked ? 'bg-[#cbd5e1]' : `bg-[${colorText}]`}`} 
          style={{ width: `${progressPercent}%` }} 
        />
      </View>
      <Text className="font-sans font-bold text-[#555] text-[13px]">{current}/{max}</Text>
    </View>
  );
};

export default function JornadaScreen() {
  const router = useRouter();

  // Dados Mockados para MVP
  const currentXP = 120;
  const targetXP = 500;
  const progressPercent = (currentXP / targetXP) * 100;

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <YeloScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        
        {/* HEADER */}
        <View className="mx-6 mt-6 mb-6 bg-[#1B4332] p-[22px] rounded-[16px] shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
          <View className="flex-row items-center mb-2">
            <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-white/20 rounded-full items-center justify-center mr-4">
              <Feather name="arrow-left" size={20} color="white" />
            </TouchableOpacity>
            <Text className="font-title text-[24px] text-white leading-tight flex-1">Sua Jornada 🚀</Text>
          </View>
          <Text className="font-sans text-[15px] text-white/85 mt-2 leading-relaxed">
            Acompanhe seu crescimento, desbloqueie conquistas e destaque-se na plataforma!
          </Text>
        </View>

        {/* PAINEL DE GAMIFICAÇÃO */}
        <View className="px-6 mb-8">
          <View className="flex-row items-center justify-between mb-6">
            <View className="flex-row items-center">
              <View className="w-[45px] h-[45px] bg-[#e8f5e9] rounded-[12px] items-center justify-center mr-3">
                <Text className="text-[20px]">📈</Text>
              </View>
              <Text className="font-title text-[#1B4332] text-[20px]">Sua Evolução</Text>
            </View>
            <View className="bg-[#1B4332] px-4 py-2 rounded-full">
              <Text className="font-sans font-bold text-white text-[13px]">Iniciante</Text>
            </View>
          </View>

          {/* Barra de XP */}
          <View className="mb-6">
            <View className="h-[18px] bg-[#e5e7eb] rounded-full overflow-hidden mb-3">
              <View 
                className="h-full bg-[#16a34a] rounded-full" 
                style={{ width: `${progressPercent}%` }} 
              />
            </View>
            <View className="flex-row justify-between items-center">
              <Text className="font-sans font-bold text-[#666] text-[13px]">Nível 1</Text>
              <Text className="font-sans font-bold text-[#1B4332] text-[14px]">{currentXP} // {targetXP} XP</Text>
              <Text className="font-sans font-bold text-[#666] text-[13px]">Nível 2</Text>
            </View>
          </View>

          {/* Próximo Objetivo */}
          <View className="bg-[#f0fdf4] border border-[#bbf7d0] p-5 rounded-[16px] flex-row items-center shadow-sm">
            <Text className="text-[32px] mr-4">🎯</Text>
            <View className="flex-1">
              <Text className="font-sans font-bold text-[#1B4332] text-[15px] mb-1">Seu próximo marco:</Text>
              <Text className="font-sans text-[#166534] text-[14px]">Alcançar o Nível 2 (500 XP) para habilitar o selo Prata.</Text>
            </View>
          </View>
        </View>

        {/* COMO GANHAR XP */}
        <View className="px-6 mb-8">
          <View className="flex-row items-center mb-5">
            <View className="w-[35px] h-[35px] bg-[#fff3e0] rounded-[10px] items-center justify-center mr-3">
              <Text className="text-[18px]">⭐</Text>
            </View>
            <Text className="font-title text-[#1B4332] text-[18px]">Como ganhar XP?</Text>
          </View>

          <XpRuleCard icon="📝" title="Completar Perfil" xp="500" desc="(Único)" />
          <XpRuleCard icon="✍️" title="Artigo no Blog" xp="50" desc="(1x/dia)" />
          <XpRuleCard icon="💡" title="Iniciar Discussão" xp="25" desc="(2x/dia)" />
          <XpRuleCard icon="🗣️" title="Comentar no Fórum" xp="20" desc="(5x/dia)" />
          <XpRuleCard icon="❓" title="Responder Pergunta" xp="15" desc="(5x/dia)" />
        </View>

        {/* CONQUISTAS */}
        <View className="px-6 mb-8">
          <View className="flex-row items-center mb-5">
            <View className="w-[35px] h-[35px] bg-[#f3e8ff] rounded-[10px] items-center justify-center mr-3">
              <Text className="text-[18px]">🏆</Text>
            </View>
            <Text className="font-title text-[#1B4332] text-[18px]">Conquistas</Text>
          </View>

          <AchievementBadge 
            icon="🌱" title="Semeador" 
            colorBg="#f0fdf4" colorText="#16a34a" 
            current={0} max={1} isLocked={true} 
          />
          <AchievementBadge 
            icon="💬" title="Voz Ativa" 
            colorBg="#e0f2fe" colorText="#0284c7" 
            current={2} max={10} isLocked={false} 
          />
          <AchievementBadge 
            icon="💡" title="Conselheiro" 
            colorBg="#fef3c7" colorText="#d97706" 
            current={0} max={10} isLocked={true} 
          />
          <AchievementBadge 
            icon="🛡️" title="Autêntico" 
            colorBg="#fce7f3" colorText="#db2777" 
            current={1} max={1} isLocked={false} 
          />
          
        </View>

      </YeloScrollView>
    </View>
  );
}
