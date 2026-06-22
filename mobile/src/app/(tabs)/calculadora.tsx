import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, Switch, Modal, Pressable } from 'react-native';
import YeloScrollView from '../../components/YeloScrollView';

import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';

// Componente: Custom Select (Imita o select nativo visualmente)
const CustomSelect = ({ label, options, selectedValue, onValueChange }: any) => {
  const [modalVisible, setModalVisible] = useState(false);
  const selectedOption = options.find((o: any) => o.value === selectedValue) || options[0];

  return (
    <View className="mb-5">
      <Text className="font-sans font-bold text-[#333] text-[15px] mb-2">{label}</Text>
      <TouchableOpacity 
        onPress={() => setModalVisible(true)}
        className="flex-row items-center justify-between bg-[#f9fafb] border border-[#ced4da] rounded-[12px] px-4 py-3"
      >
        <Text className="font-sans font-bold text-[#1B4332] text-[16px]">{selectedOption?.label}</Text>
        <Feather name="chevron-down" size={20} color="#1B4332" />
      </TouchableOpacity>

      <Modal transparent={true} visible={modalVisible} animationType="fade">
        <Pressable className="flex-1 bg-black/50 justify-end" onPress={() => setModalVisible(false)}>
          <View className="bg-white rounded-t-[24px] pb-8 pt-4 px-6">
            <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-6" />
            <Text className="font-title text-[#1B4332] text-[20px] mb-4">{label}</Text>
            {options.map((opt: any, i: number) => (
              <TouchableOpacity 
                key={i} 
                className={`py-4 border-b border-gray-100 flex-row justify-between items-center ${selectedValue === opt.value ? 'bg-[#f0fdf4] -mx-6 px-6' : ''}`}
                onPress={() => { onValueChange(opt.value); setModalVisible(false); }}
              >
                <Text className={`font-sans text-[16px] ${selectedValue === opt.value ? 'font-bold text-[#1B4332]' : 'text-[#333]'}`}>{opt.label}</Text>
                {selectedValue === opt.value && <Feather name="check" size={20} color="#1B4332" />}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

// Componente: Input com Prefixo R$
const InputCurrency = ({ label, value, onChangeText, subtitle = "" }: any) => (
  <View className="mb-5">
    <Text className="font-sans font-bold text-[#333] text-[15px] mb-2">{label}</Text>
    <View className="flex-row items-stretch bg-white border border-[#e5e7eb] rounded-[12px] overflow-hidden shadow-sm">
      <View className="bg-[#f9fafb] px-4 justify-center border-r border-[#e5e7eb]">
        <Text className="font-sans font-bold text-[#555] text-[15px]">R$</Text>
      </View>
      <TextInput 
        className="flex-1 font-sans font-bold text-[#333] text-[16px] px-4 py-3"
        keyboardType="numeric"
        value={value}
        onChangeText={onChangeText}
      />
    </View>
    {subtitle ? <Text className="text-[#888] text-[13px] mt-1.5">{subtitle}</Text> : null}
  </View>
);

export default function CalculadoraScreen() {
  const router = useRouter();

  // Estados dos Inputs
  const [rendaLiquida, setRendaLiquida] = useState('5000');
  const [horasSemana, setHorasSemana] = useState(20);
  const [feriasSemanas, setFeriasSemanas] = useState(4);
  const [custoAluguel, setCustoAluguel] = useState('150');
  const [custoDesenv, setCustoDesenv] = useState('400');
  const [custoImp, setCustoImp] = useState('250');
  const [multXp, setMultXp] = useState(1.25);
  const [multFormacao, setMultFormacao] = useState(1);
  const [autoSync, setAutoSync] = useState(false);

  // Estados Calculados
  const [valorSessaoIdeal, setValorSessaoIdeal] = useState(0);
  const [sessoesMes, setSessoesMes] = useState(0);
  const [custoTotal, setCustoTotal] = useState(0);
  const [lucroLiquido, setLucroLiquido] = useState(0);
  const [faturamentoProjetado, setFaturamentoProjetado] = useState(0);
  const [mediaMercado, setMediaMercado] = useState(0);
  const [summaryText, setSummaryText] = useState("");

  // Estado do Bottom Sheet Result
  const [resultExpanded, setResultExpanded] = useState(false);

  // Lógica de Cálculo exata à Web
  useEffect(() => {
    const rl = parseFloat(rendaLiquida) || 0;
    const h = horasSemana || 0;
    const ca = parseFloat(custoAluguel) || 0;
    const cd = parseFloat(custoDesenv) || 0;
    const ci = parseFloat(custoImp) || 0;

    const semanasUteisAno = 52 - feriasSemanas;
    const semanasUteisMes = semanasUteisAno / 12;
    const taxaOcupacao = 0.75;
    
    const sessoesEfetivasPorMes = Math.floor(h * semanasUteisMes * taxaOcupacao);
    setSessoesMes(sessoesEfetivasPorMes);

    const custoMensal = ca + cd + ci;
    setCustoTotal(custoMensal);

    const faturamentoBase = rl + custoMensal;
    let valorSessaoBase = 0;
    if (sessoesEfetivasPorMes > 0) {
      valorSessaoBase = faturamentoBase / sessoesEfetivasPorMes;
    }
    
    const valorSessaoFinal = valorSessaoBase * multXp * multFormacao;
    setValorSessaoIdeal(valorSessaoFinal);

    const faturamentoProj = valorSessaoFinal * sessoesEfetivasPorMes;
    setFaturamentoProjetado(faturamentoProj);
    setLucroLiquido(faturamentoProj - custoMensal);

    const mediaMerc = 120 * multXp * multFormacao;
    setMediaMercado(mediaMerc);

    // Inteligência de Mercado (Summary Box)
    let summary = "";
    if (autoSync) {
      summary = "A integração real com a agenda estará disponível após configurar a API. Por enquanto, desative a chave para ver a análise de mercado padrão.";
    } else {
      if (valorSessaoFinal > mediaMerc * 1.3) summary = "O valor para atingir sua meta está acima da média do mercado. Isso é perfeitamente possível, mas exigirá um posicionamento de marca forte e foco em um nicho específico para atrair pacientes dispostos a investir esse valor.";
      else if (valorSessaoFinal < mediaMerc * 0.7) summary = "Sua meta exige um valor abaixo da média. Você pode atingir sua meta financeira facilmente ou até considerar cobrar um pouco mais para valorizar seu trabalho e ter ainda mais tempo livre!";
      else summary = "Excelente! O valor ideal está altamente alinhado com a média praticada. Isso significa que sua meta financeira é muito realista e sustentável no longo prazo.";
      
      if (h >= 35) summary += "\n\nAtenção: Você selecionou uma carga horária alta. Lembre-se de reservar energia para evolução clínica e descanso.";
    }
    setSummaryText(summary);

  }, [rendaLiquida, horasSemana, feriasSemanas, custoAluguel, custoDesenv, custoImp, multXp, multFormacao, autoSync]);

  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <YeloScrollView 
          className="flex-1" 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: resultExpanded ? 500 : 250 }}
        >
          {/* HEADER */}
          <View className="mx-6 mt-6 mb-6 bg-[#1B4332] p-[22px] rounded-[16px] shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
            <View className="flex-row items-center mb-2">
              <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-white/20 rounded-full items-center justify-center mr-4">
                <Feather name="arrow-left" size={20} color="white" />
              </TouchableOpacity>
              <Text className="font-title text-[24px] text-white leading-tight flex-1">Calculadora de Honorários 🧮</Text>
            </View>
            <Text className="font-sans text-[15px] text-white/85 mt-2">
              Descubra o valor ideal da sua sessão para viver bem da psicologia, sem achismos.
            </Text>
          </View>

          {/* ASSISTANT CARD */}
          <View className="mx-6 mb-6 flex-row bg-[#fff9e6] border border-[#fde68a] p-5 rounded-[16px]">
            <Text className="text-[24px] mr-3">💡</Text>
            <View className="flex-1">
              <Text className="font-sans font-bold text-[#1B4332] text-[16px] mb-1">Sua saúde financeira também importa.</Text>
              <Text className="font-sans text-[14px] text-[#555] leading-relaxed">Não se trata apenas de pagar contas, mas de ter qualidade de vida. Altere os valores abaixo e veja o cálculo atualizar em tempo real.</Text>
            </View>
          </View>

          {/* SYNC AGENDA CARD */}
          <View className="mx-6 mb-8 flex-row items-center justify-between bg-white border border-[#e9ecef] p-5 rounded-[16px] shadow-sm">
            <View className="flex-row items-center flex-1 pr-4">
              <View className="bg-[#f0fdf4] w-[45px] h-[45px] rounded-[12px] items-center justify-center mr-4">
                <Text className="text-[20px]">📅</Text>
              </View>
              <View className="flex-1">
                <Text className="font-sans font-bold text-[#1B4332] text-[15px] mb-1">Sincronizar com Agenda</Text>
                <Text className="font-sans text-[13px] text-[#666]">Puxa dados da agenda para calcular a meta.</Text>
              </View>
            </View>
            <Switch
              value={autoSync}
              onValueChange={setAutoSync}
              trackColor={{ false: "#ccc", true: "#1B4332" }}
              thumbColor={"#fff"}
            />
          </View>

          <View className="px-6 mb-8">
            <Text className="font-title text-[22px] text-[#1B4332] mb-1 flex-row items-center">🎯 Estilo de Vida e Metas</Text>
            <Text className="font-sans text-[14px] text-[#666] mb-6">Quanto você quer ganhar e quanto tempo quer trabalhar?</Text>

            <InputCurrency 
              label="Renda Líquida Desejada por Mês" 
              value={rendaLiquida} onChangeText={setRendaLiquida} 
              subtitle="O valor que você quer que sobre livre no seu bolso."
            />

            <View className="mb-6">
              <Text className="font-sans font-bold text-[#333] text-[15px] mb-2">Quantas horas por semana quer atender?</Text>
              <View className="flex-row items-center">
                <Slider
                  style={{flex: 1, height: 40}}
                  minimumValue={5}
                  maximumValue={40}
                  step={1}
                  value={horasSemana}
                  onValueChange={setHorasSemana}
                  minimumTrackTintColor="#1B4332"
                  maximumTrackTintColor="#e9ecef"
                  thumbTintColor="#1B4332"
                />
                <Text className="font-sans font-bold text-[#1B4332] text-[18px] w-[50px] text-right">{horasSemana} h</Text>
              </View>
              <Text className="font-sans text-[#888] text-[13px] mt-1">Lembre-se de reservar tempo para estudos e descanso.</Text>
            </View>

            <CustomSelect 
              label="Semanas de Férias/Recesso por Ano"
              selectedValue={feriasSemanas}
              onValueChange={setFeriasSemanas}
              options={[
                { label: 'Nenhuma (Não recomendado)', value: 0 },
                { label: '2 Semanas (15 dias)', value: 2 },
                { label: '4 Semanas (30 dias)', value: 4 },
                { label: '6 Semanas (45 dias)', value: 6 },
              ]}
            />
          </View>

          <View className="px-6 mb-8">
            <Text className="font-title text-[22px] text-[#1B4332] mb-1 flex-row items-center">💼 Custos Operacionais (Mensal)</Text>
            <Text className="font-sans text-[14px] text-[#666] mb-6">Gastos fixos para manter sua clínica rodando.</Text>

            <InputCurrency label="Aluguel / Plataformas" value={custoAluguel} onChangeText={setCustoAluguel} />
            <InputCurrency label="Supervisão / Terapia" value={custoDesenv} onChangeText={setCustoDesenv} />
            <InputCurrency label="CRP, Contador, Impostos" value={custoImp} onChangeText={setCustoImp} />
          </View>

          <View className="px-6 mb-8">
            <Text className="font-title text-[22px] text-[#1B4332] mb-1 flex-row items-center">⭐ Sua Autoridade</Text>
            <Text className="font-sans text-[14px] text-[#666] mb-6">Ajuste fino baseado na sua formação e métricas da Yelo.</Text>

            <CustomSelect 
              label="Tempo de Experiência Clínica"
              selectedValue={multXp}
              onValueChange={setMultXp}
              options={[
                { label: 'Até 2 anos (Iniciante)', value: 1 },
                { label: '2 a 5 anos (Intermediário)', value: 1.25 },
                { label: '5 a 10 anos (Avançado)', value: 1.5 },
                { label: 'Mais de 10 anos (Sênior)', value: 2 },
              ]}
            />

            <CustomSelect 
              label="Maior Grau de Formação"
              selectedValue={multFormacao}
              onValueChange={setMultFormacao}
              options={[
                { label: 'Graduação', value: 1 },
                { label: 'Especialização / Pós', value: 1.15 },
                { label: 'Mestrado', value: 1.3 },
                { label: 'Doutorado', value: 1.5 },
              ]}
            />
          </View>

        </YeloScrollView>
      </KeyboardAvoidingView>

      {/* RESULT CARD ABSOLUTO (STICKY) */}
      <View className="absolute bottom-[90px] left-4 right-4 z-50">
        <TouchableOpacity 
          activeOpacity={0.9} 
          onPress={() => setResultExpanded(!resultExpanded)}
          className="rounded-[24px] overflow-hidden shadow-[0_10px_30px_rgba(27,67,50,0.3)] bg-[#1B4332]"
        >
          <LinearGradient
            colors={['#1B4332', '#0d2e21']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ padding: 25 }}
          >
            {/* Header Mobile - Sempre Visível */}
            <View className="flex-row justify-between items-center w-full">
              <View>
                <Text className="font-title text-[18px] text-white mb-1">Valor Ideal por Sessão</Text>
                <Text className="font-sans text-[12px] text-white/70">Para atingir sua meta financeira</Text>
              </View>
              <View className="flex-row items-center">
                <Text className="font-title text-[32px] text-[#FFEE8C] mr-2 tracking-tight">{formatCurrency(valorSessaoIdeal)}</Text>
                <Feather name={resultExpanded ? "chevron-down" : "chevron-up"} size={24} color="white" />
              </View>
            </View>

            {/* Conteúdo Expandido */}
            {resultExpanded && (
              <View className="mt-5 pt-5 border-t border-white/20">
                <View className="bg-white/10 rounded-[16px] p-5 mb-5 border border-white/10">
                  <View className="flex-row justify-between mb-3"><Text className="font-sans text-white/90">Sessões p/ mês (75% ocup):</Text><Text className="font-sans font-bold text-white">{sessoesMes}</Text></View>
                  <View className="flex-row justify-between mb-3"><Text className="font-sans text-white/90">Faturamento Bruto:</Text><Text className="font-sans font-bold text-white">{formatCurrency(faturamentoProjetado)}</Text></View>
                  <View className="flex-row justify-between mb-4"><Text className="font-sans text-[#fca5a5]">Custo Total:</Text><Text className="font-sans font-bold text-[#fca5a5]">- {formatCurrency(custoTotal)}</Text></View>
                  <View className="h-[1px] bg-white/20 w-full mb-4" />
                  <View className="flex-row justify-between"><Text className="font-sans text-[#a7f3d0]">Lucro Líquido:</Text><Text className="font-sans font-bold text-[#a7f3d0]">{formatCurrency(lucroLiquido)}</Text></View>
                </View>

                <Text className="font-sans text-center text-white/80 text-[13px] mb-5 leading-relaxed">
                  📊 Com base na sua experiência e formação, a média praticada por psicólogos similares na Yelo é de <Text className="font-bold text-[#FFEE8C]">{formatCurrency(mediaMercado)}</Text>.
                </Text>

                <View className="bg-white/5 border-l-4 border-[#FFEE8C] rounded-[16px] p-5">
                  <Text className="font-title text-[#FFEE8C] text-[16px] mb-2">Análise da sua Meta</Text>
                  <Text className="font-sans text-white/90 text-[13.5px] leading-relaxed">
                    {summaryText}
                  </Text>
                </View>
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

    </View>
  );
}
