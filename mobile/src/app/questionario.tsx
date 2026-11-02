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
  Dimensions,
  PanResponder
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import YeloScrollView from '../components/YeloScrollView';
import { 
  patientQuestions, 
  getAbordagemConfig, 
  AbordagemOption 
} from '../config/questionario_config';

const { width } = Dimensions.get('window');

export default function QuestionarioScreen() {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [showError, setShowError] = useState(false);

  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    slideAnim.setValue(0);
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [currentStep]);

  const currentQuestion = patientQuestions[currentStep];
  const isFinal = currentQuestion.type === 'final';
  const isError = currentQuestion.type === 'error';
  const isAbordagem = currentQuestion.type === 'abordagem';

  // Configuração dinâmica para abordagem_ideal baseada no tema escolhido
  const abordagemConfig = isAbordagem 
    ? getAbordagemConfig(answers['temas']) 
    : null;

  // Perguntas interativas válidas para cálculo de progresso
  const totalInteractiveQuestions = patientQuestions.filter(
    q => !['final', 'error'].includes(q.type)
  ).length;

  const validStepIndex = patientQuestions
    .slice(0, currentStep + 1)
    .filter(q => !['final', 'error'].includes(q.type)).length;

  const progress = Math.min(100, Math.max(0, (validStepIndex / totalInteractiveQuestions) * 100));

  const handleSelectChoice = (choice: string) => {
    setShowError(false);
    if (currentQuestion.type === 'choice') {
      const updatedAnswers = { ...answers, [currentQuestion.id]: choice };
      setAnswers(updatedAnswers);
      
      // Avanço automático com micro-delay para feedback tátil/visual
      setTimeout(() => {
        handleNext(updatedAnswers);
      }, 250);
    } else if (currentQuestion.type === 'multiple-choice') {
      const currentSelected: string[] = answers[currentQuestion.id] || [];
      let newSelected: string[];

      if (choice === 'Indiferente') {
        newSelected = currentSelected.includes('Indiferente') ? [] : ['Indiferente'];
      } else {
        const withoutIndiferente = currentSelected.filter(c => c !== 'Indiferente');
        newSelected = withoutIndiferente.includes(choice)
          ? withoutIndiferente.filter(c => c !== choice)
          : [...withoutIndiferente, choice];
      }

      setAnswers(prev => ({ ...prev, [currentQuestion.id]: newSelected }));
    }
  };

  const handleSelectAbordagem = (val: string[]) => {
    setShowError(false);
    const updatedAnswers = { ...answers, abordagem_ideal: val };
    setAnswers(updatedAnswers);

    setTimeout(() => {
      handleNext(updatedAnswers);
    }, 250);
  };

  const formatCEP = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  };

  const handleTextChange = (text: string) => {
    setShowError(false);
    if (currentQuestion.id === 'cep') {
      const formatted = formatCEP(text);
      setAnswers(prev => ({ ...prev, cep: formatted }));
      // Se preencheu 8 dígitos, avança suavemente
      if (formatted.length === 9) {
        setTimeout(() => {
          handleNext({ ...answers, cep: formatted });
        }, 300);
      }
    } else {
      setAnswers(prev => ({ ...prev, [currentQuestion.id]: text }));
    }
  };

  const validateStep = (currentAnswers = answers) => {
    if (currentQuestion.required) {
      if (currentQuestion.type === 'choice') {
        const val = currentAnswers[currentQuestion.id];
        if (!val) return false;
      } else if (currentQuestion.type === 'multiple-choice') {
        const val = currentAnswers[currentQuestion.id];
        if (!val || (Array.isArray(val) && val.length === 0)) return false;
      } else if (currentQuestion.type === 'abordagem') {
        const val = currentAnswers['abordagem_ideal'];
        if (!val || (Array.isArray(val) && val.length === 0)) return false;
      } else if (currentQuestion.type === 'text') {
        const val = currentAnswers[currentQuestion.id];
        if (!val || val.trim() === '') return false;
        if (currentQuestion.id === 'cep' && val.replace(/\D/g, '').length < 8) return false;
      }
    }
    return true;
  };

  const handleNext = (currentAnswers = answers) => {
    if (!validateStep(currentAnswers)) {
      setShowError(true);
      return;
    }

    // Condicionais de Fluxo Yelo
    if (currentQuestion.id === 'idade' && currentAnswers['idade'] !== 'Menor de 18 anos') {
      const generoStepIndex = patientQuestions.findIndex(q => q.id === 'pref_genero_prof');
      setCurrentStep(generoStepIndex);
      return;
    }

    if (currentQuestion.id === 'responsavel_menor' && currentAnswers['responsavel_menor'] === 'Não, sou o próprio menor') {
      const errorStepIndex = patientQuestions.findIndex(q => q.type === 'error');
      setCurrentStep(errorStepIndex);
      return;
    }

    if (currentQuestion.id === 'modalidade_atendimento') {
      if (currentAnswers['modalidade_atendimento'] === 'Online') {
        // Pula o CEP e vai direto para a tela final
        const finalStepIndex = patientQuestions.findIndex(q => q.type === 'final');
        const finalAnswersClean = { ...currentAnswers, cep: null };
        finalize(finalAnswersClean, finalStepIndex);
        return;
      }
    }

    if (currentStep < patientQuestions.length - 1) {
      const nextStepIndex = currentStep + 1;
      if (patientQuestions[nextStepIndex].type === 'final') {
        finalize(currentAnswers, nextStepIndex);
      } else {
        setCurrentStep(nextStepIndex);
      }
    }
  };

  const handleBack = () => {
    if (currentStep === 0) {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
      return;
    }

    let passoAnterior = currentStep - 1;
    const cepStepIndex = patientQuestions.findIndex(q => q.id === 'cep');
    const responsavelStepIndex = patientQuestions.findIndex(q => q.id === 'responsavel_menor');
    const generoStepIndex = patientQuestions.findIndex(q => q.id === 'pref_genero_prof');
    const finalStepIndex = patientQuestions.findIndex(q => q.type === 'final');

    // Se está voltando do final e a modalidade era Online, volta para modalidade_atendimento
    if (currentStep === finalStepIndex && answers['modalidade_atendimento'] === 'Online') {
      const modIndex = patientQuestions.findIndex(q => q.id === 'modalidade_atendimento');
      setCurrentStep(modIndex);
      return;
    }

    // Se estou voltando da pergunta de Gênero e não é menor, volta para Idade
    if (currentStep === generoStepIndex && answers['idade'] !== 'Menor de 18 anos') {
      const idadeIndex = patientQuestions.findIndex(q => q.id === 'idade');
      setCurrentStep(idadeIndex);
      return;
    }

    setCurrentStep(passoAnterior);
  };

  const finalize = (finalAnswers = answers, targetStep?: number) => {
    const finalIndex = targetStep ?? patientQuestions.findIndex(q => q.type === 'final');
    setCurrentStep(finalIndex);

    // Pequeno delay para que o usuário sinta o processamento do motor de inteligência
    setTimeout(() => {
      router.replace({
        pathname: '/resultados',
        params: { answers: JSON.stringify(finalAnswers) }
      });
    }, 1200);
  };

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [25, 0]
  });

  const opacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1]
  });

  // Título e subtítulo atuais (dinâmicos para abordagem)
  const currentTitle = isAbordagem && abordagemConfig 
    ? abordagemConfig.question 
    : currentQuestion.question;

  const currentSubtitle = isAbordagem && abordagemConfig 
    ? abordagemConfig.subtitle 
    : currentQuestion.subtitle;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
        if (!isHorizontal) return false;
        const isLeft = gestureState.x0 <= 60 && gestureState.dx > 15;
        const isRight = gestureState.x0 >= width - 60 && gestureState.dx < -15;
        return isLeft || isRight;
      },
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
        if (!isHorizontal) return false;
        const isLeft = gestureState.x0 <= 60 && gestureState.dx > 15;
        const isRight = gestureState.x0 >= width - 60 && gestureState.dx < -15;
        return isLeft || isRight;
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.x0 <= 60 && (gestureState.dx > 40 || gestureState.vx > 0.25)) {
          handleBack();
        } else if (gestureState.x0 >= width - 60 && (gestureState.dx < -40 || gestureState.vx < -0.25)) {
          handleNext();
        }
      },
    })
  ).current;

  return (
    <View style={{ flex: 1, backgroundColor: '#1B4332' }} {...panResponder.panHandlers}>
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
            contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: 'center' }}
          >
            <Animated.View style={{ transform: [{ translateY }], opacity, width: '100%', maxWidth: 600, alignSelf: 'center' }}>
              
              {/* Header */}
              <View className="mb-6">
                <Text className="font-title text-[28px] text-white leading-9 mb-3">
                  {currentTitle}
                </Text>
                {currentSubtitle && (
                  <Text className="font-sans text-[16px] text-white/80 leading-6">
                    {currentSubtitle}
                  </Text>
                )}
              </View>

              {/* Error State: Menor desacompanhado */}
              {isError && (
                <View className="mt-4">
                  <TouchableOpacity 
                    className="bg-[#FFEE8C] rounded-[50px] py-[16px] px-[30px] items-center"
                    onPress={() => router.replace('/')}
                  >
                    <Text className="text-[#1B4332] font-bold text-[17px] font-sans">
                      {currentQuestion.buttonText || "Entendi e Sair"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Final State / Loading */}
              {isFinal && (
                <View className="items-center mt-8 py-6">
                  <ActivityIndicator size="large" color="#FFEE8C" />
                  <Text className="text-white font-sans text-[16px] font-semibold mt-5 text-center">
                    Cruzando compatibilidade com terapeutas verificados...
                  </Text>
                  <Text className="text-white/60 font-sans text-[13px] mt-2 text-center">
                    Preparando recomendações exclusivas para o seu perfil.
                  </Text>
                </View>
              )}

              {/* Choices (Simples ou Múltipla) */}
              {['choice', 'multiple-choice'].includes(currentQuestion.type) && currentQuestion.choices && (
                <View className="flex-col gap-2.5">
                  {currentQuestion.choices.map((choice) => {
                    const isSelected = currentQuestion.type === 'multiple-choice'
                      ? (answers[currentQuestion.id] || []).includes(choice)
                      : answers[currentQuestion.id] === choice;

                    return (
                      <TouchableOpacity
                        key={choice}
                        onPress={() => handleSelectChoice(choice)}
                        className={`py-[14px] px-[20px] rounded-[14px] border ${
                          isSelected 
                            ? 'bg-[#FFEE8C] border-[#FFEE8C]' 
                            : 'bg-white/10 border-white/20'
                        }`}
                        style={{ minHeight: 52, justifyContent: 'center' }}
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

              {/* Abordagem Ideal (Cards ricos dinâmicos) */}
              {isAbordagem && abordagemConfig && (
                <View className="flex-col gap-3">
                  {abordagemConfig.options.map((opt: AbordagemOption) => {
                    const currentVal = answers['abordagem_ideal'];
                    const isSelected = Array.isArray(currentVal) && currentVal[0] === opt.value[0];

                    return (
                      <TouchableOpacity
                        key={opt.title}
                        onPress={() => handleSelectAbordagem(opt.value)}
                        className={`p-[16px] rounded-[14px] border ${
                          isSelected 
                            ? 'bg-[#FFEE8C] border-[#FFEE8C]' 
                            : 'bg-white/10 border-white/20'
                        }`}
                      >
                        <Text className={`font-sans text-[16px] font-bold ${isSelected ? 'text-[#1B4332]' : 'text-white'}`}>
                          {opt.title}
                        </Text>
                        <Text className={`font-sans text-[14px] mt-1 ${isSelected ? 'text-[#1B4332]/80' : 'text-white/70'}`}>
                          {opt.description}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  {showError && <Text className="text-red-400 font-sans mt-2">Por favor, selecione como prefere conduzir a sessão.</Text>}
                </View>
              )}

              {/* Text Input (CEP) */}
              {currentQuestion.type === 'text' && (
                <View className="mt-4">
                  <TextInput
                    value={answers[currentQuestion.id] || ''}
                    onChangeText={handleTextChange}
                    placeholder={currentQuestion.placeholder}
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    keyboardType="number-pad"
                    maxLength={9}
                    className="w-full border-b-2 border-white/30 text-white font-sans text-[28px] py-[10px] tracking-wider"
                    style={{ minHeight: 60 }}
                    autoFocus={true}
                    onSubmitEditing={() => handleNext()}
                  />
                  {showError && <Text className="text-red-400 font-sans mt-2">Por favor, digite um CEP válido com 8 dígitos.</Text>}
                </View>
              )}

              {/* Navigation Buttons */}
              {!isFinal && !isError && (
                <View className="flex-row items-center justify-between mt-[36px]">
                  <TouchableOpacity 
                    onPress={handleBack} 
                    className="border border-white/20 rounded-[30px] py-[12px] px-[28px]"
                  >
                    <Text className="text-white/80 font-bold font-sans text-[15px]">Voltar</Text>
                  </TouchableOpacity>

                  {/* Mostra botão Avançar para multiple-choice e text */}
                  {(currentQuestion.type === 'multiple-choice' || currentQuestion.type === 'text') && (
                    <TouchableOpacity 
                      onPress={() => handleNext()} 
                      className="bg-[#FFEE8C] rounded-[30px] py-[12px] px-[28px]"
                    >
                      <Text className="text-[#1B4332] font-bold font-sans text-[15px]">
                        Avançar
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
