import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { profissionaisConfig, QuestionData } from '../config/profissionais_config';

export default function PsiQuestionarioScreen() {
  const router = useRouter();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [errorMsg, setErrorMsg] = useState('');

  // Estados locais para a captura de lead
  const [leadNome, setLeadNome] = useState('');
  const [leadTelefone, setLeadTelefone] = useState('');
  const [leadEmail, setLeadEmail] = useState('');

  const question = profissionaisConfig[currentStep];

  // Identifica o total de passos válidos para a barra de progresso
  const totalSteps = profissionaisConfig.filter(q => !['info', 'loading', 'approved', 'waitlisted', 'error'].includes(q.type)).length;
  const currentProgressStep = profissionaisConfig.slice(0, currentStep + 1).filter(q => !['info', 'loading', 'approved', 'waitlisted', 'error'].includes(q.type)).length;
  const progressPercent = Math.max(0, (currentProgressStep / totalSteps) * 100);

  const getFirstName = () => {
    const nomeCompleto = answers.nome || leadNome || '';
    const firstName = nomeCompleto.trim().split(' ')[0];
    return firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase() : '';
  };

  const parseText = (text?: string) => {
    if (!text) return '';
    return text.replace(/\[NOME\]/g, getFirstName()).replace(/<br>/g, '\n');
  };

  const handleNext = () => {
    setErrorMsg('');
    if (question.type === 'lead-capture') {
      if (leadNome.split(' ').length < 2) {
        setErrorMsg('Por favor, informe seu nome e sobrenome.');
        return;
      }
      if (leadTelefone.replace(/\D/g, '').length < 10) {
        setErrorMsg('Por favor, informe um telefone válido com DDD.');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadEmail)) {
        setErrorMsg('Por favor, informe um e-mail válido.');
        return;
      }
      setAnswers(prev => ({ ...prev, nome: leadNome, telefone: leadTelefone, email: leadEmail }));
    } else if (question.type === 'text') {
      const val = answers[question.id];
      if (question.required && (!val || val.trim() === '')) {
        setErrorMsg('Este campo é obrigatório.');
        return;
      }
      if (question.id === 'cep' && val.replace(/\D/g, '').length < 8) {
        setErrorMsg('Informe um CEP válido.');
        return;
      }
    } else if (question.type === 'choice' || question.type === 'multiple-choice') {
      const val = answers[question.id];
      if (question.required) {
        if (!val || (Array.isArray(val) && val.length === 0)) {
          setErrorMsg('Por favor, selecione pelo menos uma opção.');
          return;
        }
      }
    }

    if (question.buttonText === 'Verificar Demanda') {
      checkDemand();
      return;
    }

    if (question.id === 'modalidade' && answers['modalidade'] === 'Apenas Online') {
      // Pula o CEP
      const cepIndex = profissionaisConfig.findIndex(q => q.id === 'cep');
      setCurrentStep(cepIndex + 1);
      return;
    }

    if (currentStep < profissionaisConfig.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    setErrorMsg('');
    if (currentStep > 0) {
      let prevStep = currentStep - 1;
      const cepIndex = profissionaisConfig.findIndex(q => q.id === 'cep');
      if (currentStep === cepIndex + 1 && answers['modalidade'] === 'Apenas Online') {
        prevStep = cepIndex - 1;
      }
      setCurrentStep(prevStep);
    } else {
      if (router.canGoBack()) router.back();
    }
  };

  const checkDemand = () => {
    const loadingIndex = profissionaisConfig.findIndex(q => q.id === 'loading');
    setCurrentStep(loadingIndex);

    // Simulação da API
    setTimeout(() => {
      // Aleatoriamente define como approved ou waitlisted para simulação (como pedido)
      const isApproved = Math.random() > 0.5;
      if (isApproved) {
        setCurrentStep(profissionaisConfig.findIndex(q => q.id === 'approved'));
      } else {
        setCurrentStep(profissionaisConfig.findIndex(q => q.id === 'waitlisted'));
      }
    }, 2500);
  };

  const toggleChoice = (choice: string, isMultiple: boolean) => {
    setErrorMsg('');
    if (isMultiple) {
      setAnswers(prev => {
        const currentSelection = Array.isArray(prev[question.id]) ? prev[question.id] : [];
        if (currentSelection.includes(choice)) {
          return { ...prev, [question.id]: currentSelection.filter((c: string) => c !== choice) };
        } else {
          return { ...prev, [question.id]: [...currentSelection, choice] };
        }
      });
    } else {
      setAnswers(prev => ({ ...prev, [question.id]: choice }));
      // Auto-avançar na escolha simples (opcional, como no web)
      setTimeout(() => {
        if (question.id === 'modalidade' && choice === 'Apenas Online') {
          const cepIndex = profissionaisConfig.findIndex(q => q.id === 'cep');
          setCurrentStep(cepIndex + 1);
        } else {
          setCurrentStep(currentStep + 1);
        }
      }, 300);
    }
  };

  const renderContent = () => {
    switch (question.type) {
      case 'lead-capture':
        return (
          <View className="w-full mt-4">
            <View className="mb-4">
              <Text className="text-[13px] font-bold text-[#4b5563] mb-1 uppercase font-sans">Nome Completo</Text>
              <TextInput
                className="w-full bg-[#f9fafb] border border-[#e5e7eb] rounded-[12px] px-4 py-3 text-[16px] text-[#111] font-sans"
                placeholder="Seu nome"
                placeholderTextColor="#9ca3af"
                value={leadNome}
                onChangeText={setLeadNome}
              />
            </View>
            <View className="mb-4">
              <Text className="text-[13px] font-bold text-[#4b5563] mb-1 uppercase font-sans">WhatsApp (com DDD)</Text>
              <TextInput
                className="w-full bg-[#f9fafb] border border-[#e5e7eb] rounded-[12px] px-4 py-3 text-[16px] text-[#111] font-sans"
                placeholder="(00) 00000-0000"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
                value={leadTelefone}
                onChangeText={setLeadTelefone}
              />
            </View>
            <View className="mb-4">
              <Text className="text-[13px] font-bold text-[#4b5563] mb-1 uppercase font-sans">Melhor E-mail</Text>
              <TextInput
                className="w-full bg-[#f9fafb] border border-[#e5e7eb] rounded-[12px] px-4 py-3 text-[16px] text-[#111] font-sans"
                placeholder="seu@email.com"
                placeholderTextColor="#9ca3af"
                keyboardType="email-address"
                autoCapitalize="none"
                value={leadEmail}
                onChangeText={setLeadEmail}
              />
            </View>
          </View>
        );
      case 'text':
        return (
          <View className="w-full mt-4">
            <TextInput
              className="w-full bg-[#f9fafb] border border-[#e5e7eb] rounded-[12px] px-4 py-4 text-[18px] text-[#111] font-sans text-center"
              placeholder={question.placeholder}
              placeholderTextColor="#9ca3af"
              keyboardType={question.inputMode === 'numeric' ? 'numeric' : 'default'}
              value={answers[question.id] || ''}
              onChangeText={(text) => setAnswers(prev => ({ ...prev, [question.id]: text }))}
              autoFocus
            />
          </View>
        );
      case 'choice':
      case 'multiple-choice':
        const isMultiple = question.type === 'multiple-choice';
        return (
          <View className="w-full mt-4 flex-row flex-wrap justify-center">
            {question.choices?.map(choice => {
              const selected = isMultiple 
                ? (Array.isArray(answers[question.id]) && answers[question.id].includes(choice))
                : answers[question.id] === choice;
              return (
                <TouchableOpacity
                  key={choice}
                  onPress={() => toggleChoice(choice, isMultiple)}
                  className={`border m-1.5 px-4 py-3 rounded-[50px] ${selected ? 'bg-[#FFEE8C] border-[#1B4332]' : 'bg-white border-[#e5e7eb]'}`}
                  activeOpacity={0.7}
                >
                  <Text className={`text-[15px] font-sans text-center ${selected ? 'text-[#1B4332] font-bold' : 'text-[#4b5563]'}`}>
                    {choice}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      case 'loading':
        return (
          <View className="items-center justify-center mt-10">
            <ActivityIndicator size="large" color="#1B4332" />
          </View>
        );
      case 'approved':
      case 'waitlisted':
        return (
          <View className="items-center justify-center mt-10">
            <View className="w-20 h-20 bg-[#f0fdf4] rounded-full items-center justify-center mb-6">
              <Feather name={question.type === 'approved' ? "check" : "clock"} size={32} color="#1B4332" />
            </View>
            <Text className="text-[16px] text-[#666] font-sans text-center px-4">
              {parseText(question.subtitle)}
            </Text>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      {/* HEADER / PROGRESS BAR */}
      {!['loading', 'approved', 'waitlisted', 'error'].includes(question.type) && (
        <View className="w-full px-5 py-4 flex-row items-center">
          <TouchableOpacity onPress={handleBack} className="w-10 h-10 items-center justify-center rounded-full bg-[#f3f4f6]">
            <Feather name="chevron-left" size={24} color="#333" />
          </TouchableOpacity>
          <View className="flex-1 ml-4 h-2 bg-[#e5e7eb] rounded-full overflow-hidden">
            <View style={{ width: `${progressPercent}%` }} className="h-full bg-[#1B4332]" />
          </View>
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
            
            <View className="w-full max-w-[500px] self-center mt-6">
              {/* Título e Subtítulo */}
              <Text className="text-[28px] text-[#1B4332] leading-tight mb-3 font-title text-center">
                {parseText(question.question)}
              </Text>
              {question.subtitle && question.type !== 'approved' && question.type !== 'waitlisted' && (
                <Text className="text-[16px] text-[#666] mb-6 font-sans text-center">
                  {parseText(question.subtitle)}
                </Text>
              )}

              {/* Erro de Validação */}
              {errorMsg ? (
                <Text className="text-red-500 text-[14px] font-sans mb-4 text-center bg-red-50 p-2 rounded-lg">{errorMsg}</Text>
              ) : null}

              {/* Renderização Dinâmica */}
              {renderContent()}

              {/* Navigation Buttons (Avançar, Verificar) */}
              {!['loading', 'choice'].includes(question.type) && (
                <View className="mt-10">
                  {question.type === 'approved' ? (
                    <TouchableOpacity onPress={() => router.push('/')} className="w-full bg-[#1B4332] py-4 rounded-full items-center justify-center">
                      <Text className="text-white font-bold text-[16px] font-sans">Finalizar Cadastro</Text>
                    </TouchableOpacity>
                  ) : question.type === 'waitlisted' ? (
                    <TouchableOpacity onPress={() => router.push('/')} className="w-full bg-[#1B4332] py-4 rounded-full items-center justify-center">
                      <Text className="text-white font-bold text-[16px] font-sans">Concluir</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={handleNext} className="w-full bg-[#1B4332] py-4 rounded-full items-center justify-center">
                      <Text className="text-white font-bold text-[16px] font-sans">{question.buttonText || 'Avançar'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
