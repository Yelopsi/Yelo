import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import YeloScrollView from '../../components/YeloScrollView';

import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';

// Helper de componente para Caixa de Script Copiável
const ScriptBox = ({ title, content }: { title: string; content: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-[16px] p-5 mb-5">
      <Text className="font-title text-[#1B4332] text-[16px] mb-3">{title}</Text>
      <Text className="font-sans text-[#166534] italic text-[15px] leading-relaxed mb-4">
        "{content}"
      </Text>
      
      <TouchableOpacity 
        onPress={handleCopy}
        className={`self-start px-5 py-2.5 rounded-full border flex-row items-center transition-all ${
          copied ? 'bg-[#16a34a] border-[#16a34a]' : 'bg-white border-[#22c55e]'
        }`}
      >
        <Feather name={copied ? "check" : "copy"} size={16} color={copied ? "white" : "#166534"} />
        <Text className={`font-sans font-bold ml-2 ${copied ? 'text-white' : 'text-[#166534]'}`}>
          {copied ? 'Copiado!' : 'Copiar Roteiro'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default function ManualConversaoScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <YeloScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        
        {/* HEADER */}
        <View className="mx-6 mt-6 mb-6">
          <TouchableOpacity 
            onPress={() => router.back()} 
            className="flex-row items-center mb-4"
          >
            <Feather name="arrow-left" size={20} color="#666" />
            <Text className="font-sans text-[#666] ml-2">Voltar para Clínica</Text>
          </TouchableOpacity>

          <Text className="font-title text-[28px] text-[#1B4332] leading-tight mb-2">Manual de Conversão</Text>
          <Text className="font-sans text-[15px] text-[#666] leading-relaxed">
            Transforme um clique no WhatsApp em um vínculo terapêutico real.
          </Text>
        </View>

        {/* REGRAS DE OURO */}
        <View className="mx-6 mb-8 bg-white p-6 rounded-[20px] shadow-sm border border-[#e5e7eb]">
          <Text className="font-title text-[20px] text-[#1B4332] mb-5 flex-row items-center">⭐ Regras de Ouro</Text>

          <View className="border-l-4 border-[#f59e0b] pl-4 mb-5">
            <Text className="font-title text-[16px] text-[#333] mb-1">⏳ A Regra das 2 Horas</Text>
            <Text className="font-sans text-[14px] text-[#666] leading-relaxed">
              A urgência na internet é alta. Tente responder nas primeiras horas. Demorar 24h aumenta drasticamente a chance de perda do paciente.
            </Text>
          </View>

          <View className="border-l-4 border-[#3b82f6] pl-4 mb-5">
            <Text className="font-title text-[16px] text-[#333] mb-1">🎙️ O Poder do Áudio Curto</Text>
            <Text className="font-sans text-[14px] text-[#666] leading-relaxed">
              Mensagens de texto podem soar frias. Um áudio gentil (15 a 30s) transmite empatia clínica instantaneamente.
            </Text>
          </View>

          <View className="border-l-4 border-[#ef4444] pl-4">
            <Text className="font-title text-[16px] text-[#333] mb-1">🛑 O Limite Ético</Text>
            <Text className="font-sans text-[14px] text-[#666] leading-relaxed">
              Se o paciente visualizou e não respondeu, dê espaço. Envie apenas uma mensagem no dia seguinte.
            </Text>
          </View>
        </View>

        {/* ROTEIROS */}
        <View className="mx-6 mb-8 bg-white p-6 rounded-[20px] shadow-sm border border-[#e5e7eb]">
          <Text className="font-title text-[20px] text-[#1B4332] mb-2 flex-row items-center">📝 Roteiros de Sucesso</Text>
          <Text className="font-sans text-[14px] text-[#666] mb-6 leading-relaxed">
            Copie os textos abaixo e cole no WhatsApp. Sinta-se livre para adaptar ao seu tom de voz.
          </Text>

          <ScriptBox 
            title="🧊 O Quebra-Gelo (Primeira Mensagem)" 
            content="Olá, [Nome do Paciente]! Que bom que a Yelo cruzou os nossos perfis. Sei que dar esse primeiro passo exige coragem, então seja muito bem-vindo(a). Me conte um pouco: o que te motivou a buscar esse espaço agora?" 
          />

          <ScriptBox 
            title="💰 A Ancoragem de Preço" 
            content="Como viu no meu perfil, a sessão tem o valor de R$ [X] e dura 50 minutos. Mas antes de fecharmos a questão financeira, é muito importante entender se eu sou a pessoa certa para te ajudar. Gostaria de me contar brevemente o que você busca nesse momento?" 
          />

          <ScriptBox 
            title="🛟 O Resgate (Visualizou e sumiu)" 
            content="Olá, [Nome]! Passando só para deixar um abraço e dizer que sigo à disposição se você ainda estiver avaliando o início da terapia. Caso tenha ficado alguma dúvida sobre os horários, é só me chamar. Uma ótima semana!" 
          />
        </View>

      </YeloScrollView>
    </View>
  );
}
