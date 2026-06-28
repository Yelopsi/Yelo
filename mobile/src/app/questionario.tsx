import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  TextInput, 
  KeyboardAvoidingView, 
  Platform, 
  Animated,
  ActivityIndicator,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import YeloScrollView from '../components/YeloScrollView';
import { patientQuestions, QuestionData } from '../config/questionario_config';

export default function QuestionarioScreen() {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [showError, setShowError] = useState(false);
  const [simulatedResult, setSimulatedResult] = useState<'loading' | 'success' | null>(null);

  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    slideAnim.setValue(0);
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [currentStep]);

  const currentQuestion = patientQuestions[currentStep];
  const isFinal = currentQuestion.type === 'final';
  const isError = currentQuestion.type === 'error';
  const progress = Math.max(0, (currentStep / (patientQuestions.length - 2)) * 100); // Exclude final/error from progress calculation

  const handleSelectChoice = (choice: string) => {
    setShowError(false);
    if (currentQuestion.type === 'choice') {
      setAnswers(prev => ({ ...prev, [currentQuestion.id]: choice }));
      
      // Auto-advance with slight delay for single choice
      setTimeout(() => {
        handleNext({ ...answers, [currentQuestion.id]: choice });
      }, 350);
    } else if (currentQuestion.type === 'multiple-choice') {
      const currentSelected = answers[currentQuestion.id] || [];
      const newSelected = currentSelected.includes(choice)
        ? currentSelected.filter((c: string) => c !== choice)
        : [...currentSelected, choice];
      setAnswers(prev => ({ ...prev, [currentQuestion.id]: newSelected }));
    }
  };

  const handleTextChange = (text: string) => {
    setShowError(false);
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: text }));
  };

  const validateStep = (currentAnswers = answers) => {
    if (currentQuestion.required) {
      if (['choice', 'multiple-choice'].includes(currentQuestion.type)) {
        const val = currentAnswers[currentQuestion.id];
        if (!val || (Array.isArray(val) && val.length === 0)) return false;
      } else if (currentQuestion.type === 'text') {
        const val = currentAnswers[currentQuestion.id];
        if (!val || val.trim() === '') return false;
      }
    }
    return true;
  };

  const handleNext = (currentAnswers = answers) => {
    if (!validateStep(currentAnswers)) {
      setShowError(true);
      return;
    }

    // Condicionais de Fluxo
    if (currentQuestion.id === 'idade' && currentAnswers['idade'] !== 'Menor de 18 anos') {
      // Pula a tela do responsável se for adulto
      const generoStepIndex = patientQuestions.findIndex(q => q.id === 'pref_genero_prof');
      setCurrentStep(generoStepIndex);
      return;
    }

    if (currentQuestion.id === 'responsavel_menor' && currentAnswers['responsavel_menor'] === 'Não, sou o próprio menor') {
      // Menor desacompanhado vai para a tela de erro
      const errorStepIndex = patientQuestions.findIndex(q => q.type === 'error');
      setCurrentStep(errorStepIndex);
      return;
    }

    if (currentQuestion.id === 'modalidade_atendimento') {
      if (currentAnswers['modalidade_atendimento'] === 'Online') {
        // Pula o CEP se for apenas Online
        const cepStepIndex = patientQuestions.findIndex(q => q.id === 'cep');
        setCurrentStep(cepStepIndex + 1);
        return;
      }
    }

    // Fluxo normal (Avançar)
    if (currentStep < patientQuestions.length - 1) {
      if (patientQuestions[currentStep + 1].type === 'final') {
        finalize(currentAnswers);
      } else {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handleBack = () => {
    if (currentStep === 0) {
      router.back();
      return;
    }

    let passoAnterior = currentStep - 1;
    const cepStepIndex = patientQuestions.findIndex(q => q.id === 'cep');
    const responsavelStepIndex = patientQuestions.findIndex(q => q.id === 'responsavel_menor');
    const generoStepIndex = patientQuestions.findIndex(q => q.id === 'pref_genero_prof');

    // Se estou na tela DEPOIS do CEP e modalidade for Online, pulo o CEP ao voltar
    if (currentStep === cepStepIndex + 1) {
      if (answers['modalidade_atendimento'] === 'Online') {
        passoAnterior = cepStepIndex - 1;
      }
    }

    // Se estou na tela de Gênero e o usuário é adulto, pulo a tela do Responsável ao voltar
    if (currentStep === generoStepIndex) {
      if (answers['idade'] !== 'Menor de 18 anos') {
        passoAnterior = responsavelStepIndex - 1;
      }
    }

    setCurrentStep(passoAnterior);
  };

  const finalize = async (finalAnswers = answers) => {
    const finalStepIndex = patientQuestions.findIndex(q => q.type === 'final');
    setCurrentStep(finalStepIndex);
    
    // Passa os dados para a tela de resultados processar o match real
    router.push({
      pathname: '/resultados',
      params: { answers: JSON.stringify(finalAnswers) }
    });
  };

  const replaceName = (text: string) => {
    const nome = answers['nome']?.trim()?.split(' ')[0] || '';
    const formattedName = nome ? nome.charAt(0).toUpperCase() + nome.slice(1).toLowerCase() : '';
    if (formattedName) {
      return text.replace(/\[NOME\]/g, formattedName);
    }
    return text.replace(/,\s*\[NOME\]/g, '').replace(/\[NOME\]/g, '');
  };

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [40, 0]
  });

  const opacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1]
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#1B4332' }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#1B4332' }} edges={['top']}>
        <KeyboardAvoidingView 
          style={{ flex: 1 }} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        {/* Progress Bar */}
        {!isFinal && !isError && (
          <View className="w-full h-[4px] bg-white/10 absolute top-0 z-10">
            <View 
              style={{ width: `${progress}%` }} 
              className="h-full bg-[#FFEE8C]" 
            />
          </View>
        )}

        <YeloScrollView 
          refreshColor="#1B4332" 
          contentContainerStyle={{ flexGrow: 1, padding: 20, justifyContent: 'center' }}
        >
          
          <Animated.View style={{ transform: [{ translateY }], opacity, width: '100%', maxWidth: 600, alignSelf: 'center' }}>
            
            {/* Header */}
            <View className="mb-8">
              <Text className="font-title text-[32px] text-white leading-10 mb-4">
                {replaceName(currentQuestion.question)}
              </Text>
              {currentQuestion.subtitle && (
                <Text className="font-sans text-[18px] text-white/80 leading-7">
                  {replaceName(currentQuestion.subtitle)}
                </Text>
              )}
            </View>

            {/* Error State */}
            {isError && (
              <TouchableOpacity 
                className="bg-[#FFEE8C] rounded-[50px] py-[15px] px-[30px] items-center mt-[20px]"
                onPress={() => router.push('/')}
              >
                <Text className="text-[#1B4332] font-bold text-[18px] font-sans">
                  {currentQuestion.buttonText || "Sair"}
                </Text>
              </TouchableOpacity>
            )}

            {/* Final State / Loading */}
            {isFinal && (
              <View className="items-center mt-10">
                <View className="items-center">
                  <ActivityIndicator size="large" color="#FFEE8C" />
                  <Text className="text-white/60 font-sans mt-4">Processando informações...</Text>
                </View>
              </View>
            )}

            {/* Choices */}
            {['choice', 'multiple-choice'].includes(currentQuestion.type) && currentQuestion.choices && (
              <View className="flex-col gap-3">
                {currentQuestion.choices.map((choice) => {
                  const isSelected = currentQuestion.type === 'multiple-choice'
                    ? (answers[currentQuestion.id] || []).includes(choice)
                    : answers[currentQuestion.id] === choice;

                  return (
                    <TouchableOpacity
                      key={choice}
                      onPress={() => handleSelectChoice(choice)}
                      className={`py-[12px] px-[20px] rounded-[12px] border ${
                        isSelected 
                          ? 'bg-[#FFEE8C] border-[#FFEE8C]' 
                          : 'bg-white/10 border-white/20'
                      }`}
                      style={{ minHeight: 48, justifyContent: 'center' }}
                    >
                      <Text className={`font-sans text-[16px] ${isSelected ? 'text-[#1B4332] font-bold' : 'text-white font-medium'}`}>
                        {choice}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                {showError && <Text className="text-red-400 font-sans mt-2">Por favor, selecione uma opção.</Text>}
              </View>
            )}

            {/* Text Input */}
            {currentQuestion.type === 'text' && (
              <View className="mt-4">
                <TextInput
                  value={answers[currentQuestion.id] || ''}
                  onChangeText={handleTextChange}
                  placeholder={currentQuestion.placeholder}
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  keyboardType={currentQuestion.inputMode === 'numeric' ? 'number-pad' : 'default'}
                  className="w-full border-b-2 border-white/30 text-white font-sans text-[28px] py-[10px]"
                  style={{ minHeight: 60 }}
                  autoFocus={true}
                  onSubmitEditing={() => handleNext()}
                />
                {showError && <Text className="text-red-400 font-sans mt-2">Este campo é obrigatório.</Text>}
              </View>
            )}

            {/* Navigation Buttons */}
            {!isFinal && !isError && (
              <View className="flex-row items-center mt-[40px]">
                <TouchableOpacity onPress={handleBack} className="border border-white/20 rounded-[30px] py-[12px] px-[30px] mr-4">
                  <Text className="text-white/80 font-bold font-sans text-[16px]">Voltar</Text>
                </TouchableOpacity>

                {currentQuestion.type !== 'choice' && (
                  <TouchableOpacity 
                    onPress={() => handleNext()} 
                    className="bg-[#FFEE8C] rounded-[30px] py-[12px] px-[30px]"
                  >
                    <Text className="text-[#1B4332] font-bold font-sans text-[16px]">
                      {currentStep === patientQuestions.length - 2 ? "Finalizar" : "Avançar"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

          </Animated.View>
        </YeloScrollView>
      </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
