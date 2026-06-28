import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Dimensions, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, withTiming, FadeInRight, FadeInUp } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const questions = [
  {
      q: "Quando você enfrenta um problema, qual é a sua reação natural?",
      options: [
          { t: "Gosto de focar em soluções práticas e agir.", type: "tcc" },
          { t: "Prefiro refletir sobre como cheguei a essa situação.", type: "psi" },
          { t: "Foco em como aquilo me faz sentir no momento.", type: "hum" }
      ]
  },
  {
      q: "O que você espera do seu psicólogo?",
      options: [
          { t: "Que seja um parceiro ativo, passando exercícios e tarefas.", type: "tcc" },
          { t: "Que escute bastante e me ajude a interpretar o que digo.", type: "psi" },
          { t: "Que seja extremamente acolhedor e me aceite como sou.", type: "hum" }
      ]
  },
  {
      q: "Em qual destes focos você prefere trabalhar?",
      options: [
          { t: "Mudar hábitos e comportamentos do meu dia a dia.", type: "tcc" },
          { t: "Entender traumas da infância e meu inconsciente.", type: "psi" },
          { t: "Desenvolver meu potencial e tomar minhas próprias decisões.", type: "hum" }
      ]
  },
  {
      q: "Sobre a sua relação com o tempo nas sessões, o que faz mais sentido?",
      options: [
          { t: "Quero focar em como melhorar meu hoje e o meu amanhã.", type: "tcc" },
          { t: "Preciso investigar meu passado e minha infância para entender o presente.", type: "psi" },
          { t: "Quero explorar meus sentimentos atuais e quem eu sou neste exato momento.", type: "hum" }
      ]
  },
  {
      q: "Como você prefere que a dinâmica das sessões funcione?",
      options: [
          { t: "Gosto de conversas estruturadas, objetivas e focadas em metas.", type: "tcc" },
          { t: "Prefiro um espaço livre, onde eu falo o que vem à mente e o terapeuta faz pontuações.", type: "psi" },
          { t: "Gosto de um diálogo fluido, focado na empatia e na minha autoaceitação.", type: "hum" }
      ]
  },
  {
      q: "Qual sua opinião sobre 'tarefas de casa' na terapia?",
      options: [
          { t: "Adoro! Quero ter exercícios práticos para fazer entre as sessões.", type: "tcc" },
          { t: "Não gosto. O trabalho mais importante deve ser de reflexão e análise interna.", type: "psi" },
          { t: "Prefiro que o foco seja apenas vivenciar e observar minhas emoções no meu ritmo.", type: "hum" }
      ]
  },
  {
      q: "Qual é o seu objetivo principal ao buscar ajuda agora?",
      options: [
          { t: "Aliviar sintomas específicos (ansiedade, fobias, etc) de forma mais rápida.", type: "tcc" },
          { t: "Descobrir a origem de padrões e ciclos que se repetem na minha vida.", type: "psi" },
          { t: "Encontrar um sentido maior para a minha vida e me desenvolver como pessoa.", type: "hum" }
      ]
  }
];

const resultsData = {
  "tcc": { title: "TCC (Cognitivo-Comportamental)", desc: "A TCC é ideal para você! Ela é muito prática, focada no presente e trabalha para identificar e alterar padrões de pensamento que causam sofrimento. Você sairá das sessões com tarefas reais para aplicar no dia a dia." },
  "psi": { title: "Psicanálise", desc: "A Psicanálise combina muito com o seu perfil. Ela foca no aprofundamento do seu inconsciente e nas raízes dos problemas (frequentemente ligadas ao passado e infância). O processo exige reflexão livre e proporciona um profundo autoconhecimento." },
  "hum": { title: "Abordagem Humanista", desc: "As abordagens Humanistas (como Centrada na Pessoa ou Gestalt) são perfeitas para você. O foco é total na empatia, no acolhimento e no seu desenvolvimento pessoal no momento presente, sem julgamentos." }
};

export default function TesteTerapia() {
  const router = useRouter();
  const [currentQ, setCurrentQ] = useState(0);
  const [scores, setScores] = useState({ tcc: 0, psi: 0, hum: 0 });
  const [finished, setFinished] = useState(false);
  const [resultKey, setResultKey] = useState<"tcc" | "psi" | "hum">("tcc");

  const progressStyle = useAnimatedStyle(() => {
    return {
      width: withTiming(`${(currentQ / questions.length) * 100}%`, { duration: 400 })
    };
  });

  const handleAnswer = (type: "tcc" | "psi" | "hum") => {
    const newScores = { ...scores, [type]: scores[type] + 1 };
    setScores(newScores);

    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      // Calculate winner
      let highestType: "tcc" | "psi" | "hum" = "tcc";
      if (newScores.psi > newScores.tcc && newScores.psi > newScores.hum) highestType = "psi";
      if (newScores.hum > newScores.tcc && newScores.hum > newScores.psi) highestType = "hum";
      
      setResultKey(highestType);
      setFinished(true);
      setCurrentQ(questions.length); // Fill progress bar fully
    }
  };

  const restartQuiz = () => {
    setScores({ tcc: 0, psi: 0, hum: 0 });
    setCurrentQ(0);
    setFinished(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#1B4332]">
      {/* Header */}
      <View className="flex-row justify-between items-center px-[20px] py-[20px] border-b border-white/10">
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-white/70 font-sans font-semibold text-[15px]">&larr; Voltar</Text>
        </TouchableOpacity>
      </View>
      
      {/* Progress Bar */}
      <View className="h-[6px] w-full bg-white/10">
        <Animated.View style={[{ height: '100%', backgroundColor: '#FFEE8C' }, progressStyle]} />
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, justifyContent: 'center' }}>
        {!finished ? (
          <Animated.View key={currentQ} entering={FadeInRight.duration(400)} className="w-full max-w-[600px] mx-auto">
            <Text className="font-title text-white text-[28px] text-center mb-[30px]">
              {questions[currentQ].q}
            </Text>

            {questions[currentQ].options.map((opt, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => handleAnswer(opt.type as any)}
                className="w-full bg-white/10 border border-white/20 p-[20px] rounded-[16px] mb-[15px]"
              >
                <Text className="font-sans text-white text-[16px] font-medium leading-[24px]">
                  {opt.t}
                </Text>
              </TouchableOpacity>
            ))}
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInUp.duration(600)} className="w-full max-w-[600px] mx-auto items-center">
            <View className="bg-white p-[30px] rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] w-full items-center">
              <View className="bg-[#e8f5e9] px-[15px] py-[6px] rounded-[20px] mb-[20px]">
                <Text className="text-[#16a34a] font-sans font-bold text-[14px]">Match Perfeito Encontrado</Text>
              </View>
              
              <Text className="font-title text-[#1B4332] text-[32px] text-center mb-[10px] leading-[36px]">
                {resultsData[resultKey].title}
              </Text>
              
              <Text className="font-sans text-[#555] text-[16px] text-center leading-[24px] mb-[30px]">
                {resultsData[resultKey].desc}
              </Text>
              
              <TouchableOpacity 
                onPress={() => router.push('/questionario')}
                className="bg-[#1B4332] w-full py-[18px] rounded-[50px] items-center mb-[20px] shadow-[0_5px_15px_rgba(27,67,50,0.3)]"
              >
                <Text className="font-sans font-bold text-white text-[18px]">Encontrar meu Psicólogo</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={restartQuiz}>
                <Text className="font-sans text-[#888] font-medium text-[15px] underline">Refazer teste</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
