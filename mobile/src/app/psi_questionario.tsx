import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback, Animated } from 'react-native';
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
            <View className="mb-6">
              <Text className="text-[13px] font-bold text-white/60 mb-1 uppercase font-sans">Nome Completo</Text>
              <TextInput
                className="w-full border-b-2 border-white/30 text-white font-sans text-[22px] py-[10px]"
                placeholder="Seu nome"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={leadNome}
                onChangeText={setLeadNome}
              />
            </View>
            <View className="mb-6">
              <Text className="text-[13px] font-bold text-white/60 mb-1 uppercase font-sans">WhatsApp (com DDD)</Text>
              <TextInput
                className="w-full border-b-2 border-white/30 text-white font-sans text-[22px] py-[10px]"
                placeholder="(00) 00000-0000"
                placeholderTextColor="rgba(255,255,255,0.3)"
                keyboardType="numeric"
                value={leadTelefone}
                onChangeText={setLeadTelefone}
              />
            </View>
            <View className="mb-6">
              <Text className="text-[13px] font-bold text-white/60 mb-1 uppercase font-sans">Melhor E-mail</Text>
              <TextInput
                className="w-full border-b-2 border-white/30 text-white font-sans text-[22px] py-[10px]"
                placeholder="seu@email.com"
                placeholderTextColor="rgba(255,255,255,0.3)"
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
              className="w-full border-b-2 border-white/30 text-white font-sans text-[28px] py-[10px]"
              placeholder={question.placeholder}
              placeholderTextColor="rgba(255,255,255,0.3)"
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
          <View className="w-full flex-col gap-3 mt-4">
            {question.choices?.map(choice => {
              const selected = isMultiple 
                ? (Array.isArray(answers[question.id]) && answers[question.id].includes(choice))
                : answers[question.id] === choice;
              return (
                <TouchableOpacity
                  key={choice}
                  onPress={() => toggleChoice(choice, isMultiple)}
                  className={`py-[12px] px-[20px] rounded-[12px] border ${
                    selected ? 'bg-[#FFEE8C] border-[#FFEE8C]' : 'bg-white/10 border-white/20'
                  }`}
                  style={{ minHeight: 48, justifyContent: 'center' }}
                  activeOpacity={0.7}
                >
                  <Text className={`font-sans text-[16px] ${selected ? 'text-[#1B4332] font-bold' : 'text-white font-medium'}`}>
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
            <ActivityIndicator size="large" color="#FFEE8C" />
            <Text className="text-white/60 font-sans mt-4">Analisando suas respostas...</Text>
          </View>
        );
      case 'approved':
      case 'waitlisted':
        return (
          <View className="items-center justify-center mt-10">
            <View className="w-20 h-20 bg-white/10 rounded-full items-center justify-center mb-6 border border-white/20">
              <Feather name={question.type === 'approved' ? "check" : "clock"} size={32} color="#FFEE8C" />
            </View>
            <Text className="text-[18px] text-white/80 font-sans text-center px-4 leading-7">
              {parseText(question.subtitle)}
            </Text>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#1B4332' }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#1B4332' }} edges={['top']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        
        {/* PROGRESS BAR */}
        {!['loading', 'approved', 'waitlisted', 'error'].includes(question.type) && (
          <View className="w-full h-[4px] bg-white/10 absolute top-0 z-10">
            <View style={{ width: `${progressPercent}%` }} className="h-full bg-[#FFEE8C]" />
          </View>
        )}

        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView 
            contentContainerStyle={{ flexGrow: 1, padding: 20, justifyContent: 'center' }} 
            keyboardShouldPersistTaps="handled"
          >
            
            <View className="w-full max-w-[600px] self-center">
              
              {/* Título e Subtítulo */}
              <View className="mb-8">
                <Text className="font-title text-[32px] text-white leading-10 mb-4">
                  {parseText(question.question)}
                </Text>
                {question.subtitle && question.type !== 'approved' && question.type !== 'waitlisted' && (
                  <Text className="font-sans text-[18px] text-white/80 leading-7">
                    {parseText(question.subtitle)}
                  </Text>
                )}
              </View>

              {/* Erro de Validação */}
              {errorMsg ? (
                <Text className="text-red-400 font-sans mb-4">{errorMsg}</Text>
              ) : null}

              {/* Renderização Dinâmica */}
              {renderContent()}

              {/* Navigation Buttons (Avançar, Verificar, Voltar) */}
              {!['loading', 'approved', 'waitlisted'].includes(question.type) && (
                <View className="flex-row items-center mt-[40px]">
                  <TouchableOpacity onPress={handleBack} className="border border-white/20 rounded-[30px] py-[12px] px-[30px] mr-4">
                    <Text className="text-white/80 font-bold font-sans text-[16px]">Voltar</Text>
                  </TouchableOpacity>

                  {question.type !== 'choice' && (
                    <TouchableOpacity onPress={handleNext} className="bg-[#FFEE8C] rounded-[30px] py-[12px] px-[30px]">
                      <Text className="text-[#1B4332] font-bold font-sans text-[16px]">
                        {question.buttonText || 'Avançar'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Ações Finais (Approved / Waitlisted) */}
              {['approved', 'waitlisted'].includes(question.type) && (
                <View className="mt-[40px]">
                  <TouchableOpacity onPress={() => router.push('/')} className="w-full bg-[#FFEE8C] py-[12px] px-[30px] rounded-[30px] items-center justify-center">
                    <Text className="text-[#1B4332] font-bold text-[16px] font-sans">
                      {question.type === 'approved' ? 'Finalizar Cadastro' : 'Concluir'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
