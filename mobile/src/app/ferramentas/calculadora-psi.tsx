import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Slider from '@react-native-community/slider';

export default function CalculadoraPsi() {
  const router = useRouter();

  const [renda, setRenda] = useState('5000');
  const [horas, setHoras] = useState(20);
  const [custos, setCustos] = useState('800');

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const { valorSessao, summaryHtml } = useMemo(() => {
    const numRenda = parseFloat(renda) || 0;
    const numCustos = parseFloat(custos) || 0;
    
    // 48 semanas uteis no ano / 12 meses
    const semanasUteisMes = 48 / 12;
    const sessoesPorMes = Math.floor(horas * semanasUteisMes * 0.75); // 75% ocupacao

    let valor = 0;
    if (sessoesPorMes > 0) {
      valor = (numRenda + numCustos) / sessoesPorMes;
    }

    const mediaMercado = 150;
    let summary = [];

    if (valor > mediaMercado * 1.3) {
      summary.push(<Text key="1">O valor para atingir sua meta está <Text className="font-bold">acima da média</Text> do mercado (que é de aprox. {formatCurrency(mediaMercado)} para seu perfil). Isso é perfeitamente possível, mas exigirá um posicionamento de marca forte e foco num nicho específico.</Text>);
    } else if (valor < mediaMercado * 0.7) {
      summary.push(<Text key="1">Sua meta exige um valor <Text className="font-bold">abaixo da média</Text> (que é de aprox. {formatCurrency(mediaMercado)}). Você atingirá sua meta financeira rapidamente, mas pode considerar cobrar um pouco mais para valorizar seu trabalho!</Text>);
    } else {
      summary.push(<Text key="1">Excelente! O valor ideal está <Text className="font-bold">altamente alinhado</Text> com a média praticada na Yelo (aprox. {formatCurrency(mediaMercado)}). Sua meta financeira é muito realista e sustentável.</Text>);
    }

    if (horas >= 35) {
      summary.push(<Text key="2" className="text-[#b91c1c] font-bold mt-[10px]">{"\n"}Atenção: Você selecionou uma carga horária clínica alta. Lembre-se de reservar energia para evolução e descanso.</Text>);
    }

    return { valorSessao: valor, summaryHtml: summary };
  }, [renda, horas, custos]);

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row justify-between items-center px-[20px] py-[15px] bg-[#1B4332]">
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-white/70 font-sans font-semibold text-[15px]">&larr; Voltar</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }}>
          <View className="bg-[#1B4332] px-[20px] pt-[20px] pb-[60px] items-center">
            <Text className="font-title text-white text-[30px] text-center mb-[10px]">Calculadora de Honorários</Text>
            <Text className="font-sans text-white/80 text-[16px] text-center max-w-[320px]">Saiba exatamente quanto cobrar para atingir sua meta financeira mensal.</Text>
          </View>

          <View className="px-[20px] mt-[-40px]">
            <View className="bg-white rounded-[24px] p-[25px] shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-[#f0f0f0] mb-[20px]">
              
              <View className="mb-[20px]">
                <Text className="font-sans font-semibold text-[#333] text-[14px] mb-[8px]">Qual sua Renda Líquida desejada por mês?</Text>
                <View className="flex-row items-center bg-[#f8f9fa] border border-[#ced4da] rounded-[12px] overflow-hidden">
                  <View className="bg-[#e9ecef] p-[15px] border-r border-[#ced4da]">
                    <Text className="font-sans font-semibold text-[#555]">R$</Text>
                  </View>
                  <TextInput
                    className="flex-1 p-[15px] font-sans text-[16px] text-[#333]"
                    keyboardType="numeric"
                    value={renda}
                    onChangeText={setRenda}
                  />
                </View>
              </View>

              <View className="mb-[20px] mt-[10px]">
                <Text className="font-sans font-semibold text-[#333] text-[14px] mb-[8px]">Quantas horas de atendimento clínico por semana?</Text>
                <View className="flex-row items-center justify-between">
                  <Slider
                    style={{ flex: 1, height: 40, marginRight: 15 }}
                    minimumValue={5}
                    maximumValue={40}
                    step={1}
                    value={horas}
                    onValueChange={setHoras}
                    minimumTrackTintColor="#1B4332"
                    maximumTrackTintColor="#e9ecef"
                    thumbTintColor="#FFEE8C"
                  />
                  <Text className="font-sans font-bold text-[#1B4332] text-[20px]">{horas}h</Text>
                </View>
              </View>

              <View className="mb-[20px] mt-[10px]">
                <Text className="font-sans font-semibold text-[#333] text-[14px] mb-[8px]">Quais seus custos mensais com o consultório?</Text>
                <View className="flex-row items-center bg-[#f8f9fa] border border-[#ced4da] rounded-[12px] overflow-hidden mb-[5px]">
                  <View className="bg-[#e9ecef] p-[15px] border-r border-[#ced4da]">
                    <Text className="font-sans font-semibold text-[#555]">R$</Text>
                  </View>
                  <TextInput
                    className="flex-1 p-[15px] font-sans text-[16px] text-[#333]"
                    keyboardType="numeric"
                    placeholder="Aluguel, supervisão..."
                    placeholderTextColor="#adb5bd"
                    value={custos}
                    onChangeText={setCustos}
                  />
                </View>
                <Text className="font-sans text-[12px] text-[#888]">Soma de aluguel, plataformas, impostos, etc.</Text>
              </View>

              {/* Box de Info Férias */}
              <View className="bg-[#f0fdf4] border border-[#bbf7d0] p-[20px] rounded-[16px] mt-[20px]">
                <Text className="font-title text-[#166534] text-[18px] mb-[5px]">E as férias?</Text>
                <Text className="font-sans text-[#15803d] text-[15px] leading-[22px]">
                  Nosso cálculo inteligente já desconta automaticamente <Text className="font-bold">4 semanas de férias</Text> no seu ano e considera uma taxa de ocupação da sua agenda de <Text className="font-bold">75%</Text>, trazendo o cenário para a realidade!
                </Text>
              </View>

              {/* Summary */}
              <View className="bg-white rounded-[16px] p-[20px] mt-[30px] border-l-[4px] border-l-[#FFEE8C] shadow-[0_4px_15px_rgba(0,0,0,0.03)]">
                <Text className="font-title text-[#1B4332] text-[18px] mb-[10px]">Análise da sua Meta</Text>
                <Text className="font-sans text-[#555] text-[15px] leading-[22px]">
                  {summaryHtml}
                </Text>
              </View>

            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Floating Bottom Bar (App-like Sticky Result) */}
      <View className="absolute bottom-[30px] left-[5%] w-[90%] bg-white border border-[#eee] rounded-[50px] p-[10px] pl-[25px] flex-row justify-between items-center shadow-[0_15px_35px_rgba(0,0,0,0.1)]">
        <View>
          <Text className="font-sans font-bold text-[#666] text-[10px] uppercase">O Valor da sua Sessão deve ser:</Text>
          <Text className="font-title text-[#1B4332] text-[24px] mt-[2px]">{formatCurrency(valorSessao)}</Text>
        </View>
        <TouchableOpacity 
          onPress={() => router.push('/registro')}
          className="bg-[#FFEE8C] py-[12px] px-[20px] rounded-[50px] shadow-[0_4px_15px_rgba(255,238,140,0.4)]"
        >
          <Text className="font-sans font-bold text-[#1B4332] text-[14px]">Captar pacientes</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}
