import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal, KeyboardAvoidingView, Platform, Image, Alert } from 'react-native';
import YeloScrollView from '../../components/YeloScrollView';

import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// Dados Mockados para MVP
const MOCK_QUESTIONS = [
  {
    id: 1,
    title: 'Dúvida sobre a primeira sessão',
    content: 'Tenho muita vergonha de falar sobre minha vida na primeira sessão de terapia. O psicólogo me faz perguntas ou eu tenho que falar tudo sozinho?',
    date: '21/06/2026',
    respondedByMe: false,
    answers: [
      { id: 101, psiName: 'Dra. Ana Silva', avatar: 'https://placehold.co/100x100/1B4332/FFF?text=AS', text: 'Não se preocupe! A primeira sessão é justamente para nos conhecermos. O psicólogo fará perguntas para te guiar.' }
    ]
  },
  {
    id: 2,
    title: 'Crise de pânico ou ansiedade?',
    content: 'Sinto meu coração acelerar muito e falta de ar quando vou apresentar trabalhos na faculdade. Isso é pânico ou só ansiedade normal?',
    date: '20/06/2026',
    respondedByMe: false,
    answers: []
  },
  {
    id: 3,
    title: 'Como funciona o sigilo?',
    content: 'Tudo que eu disser na sessão fica apenas entre mim e o psicólogo? Mesmo se eu confessar um crime?',
    date: '19/06/2026',
    respondedByMe: true,
    answers: [
      { id: 201, psiName: 'Você', avatar: 'https://placehold.co/100x100/1B4332/FFF?text=VC', text: 'Olá! O sigilo é a base da nossa profissão. Existem pouquíssimas exceções (como risco iminente à vida), mas de forma geral, sim, é absoluto.' }
    ]
  }
];

export default function ComunidadeScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState('all'); // all | pending | answered
  const [search, setSearch] = useState('');
  
  const [modalVisible, setModalVisible] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState<any>(null);
  const [answerText, setAnswerText] = useState('');

  // Filtragem
  const filteredQuestions = MOCK_QUESTIONS.filter(q => {
    const matchesSearch = q.title.toLowerCase().includes(search.toLowerCase()) || q.content.toLowerCase().includes(search.toLowerCase());
    if (activeFilter === 'pending') return matchesSearch && !q.respondedByMe;
    if (activeFilter === 'answered') return matchesSearch && q.respondedByMe;
    return matchesSearch;
  });

  const openAnswerModal = (question: any) => {
    setActiveQuestion(question);
    setAnswerText('');
    setModalVisible(true);
  };

  const handleIgnore = () => {
    Alert.alert('Ignorar Pergunta', 'Tem certeza que deseja ignorar esta dúvida? Ela sumirá da sua lista.');
  };

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <YeloScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        
        {/* HEADER */}
        <View className="mx-6 mt-6 mb-5 bg-[#1B4332] p-[22px] rounded-[16px] shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
          <View className="flex-row items-center mb-2">
            <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-white/20 rounded-full items-center justify-center mr-4">
              <Feather name="arrow-left" size={20} color="white" />
            </TouchableOpacity>
            <Text className="font-title text-[24px] text-white leading-tight flex-1">Comunidade</Text>
          </View>
          <Text className="font-sans text-[15px] text-white/85 mt-2 leading-relaxed">
            Tire dúvidas e compartilhe conhecimento com outros profissionais.
          </Text>
        </View>

        {/* ALERTA DE NOVA PERGUNTA */}
        <TouchableOpacity className="mx-6 mb-6 bg-[#e0f2fe] border border-[#bae6fd] p-[15px] rounded-[12px] items-center shadow-[0_4px_10px_rgba(2,132,199,0.05)]">
          <Text className="font-bold text-[#0284c7] text-[14px] text-center">
            👋 Olá! Há <Text className="font-black">1 pergunta(s)</Text> da comunidade aguardando resposta. Responda e ganhe XP!
          </Text>
        </TouchableOpacity>

        {/* FILTROS (Container Pílula Unificada) */}
        <View className="px-6 mb-4">
          <YeloScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
            <View className="flex-row bg-[#f8f9fa] border border-[#e9ecef] rounded-[50px] p-1.5 self-start">
              <TouchableOpacity 
                onPress={() => setActiveFilter('all')}
                className={`px-6 py-2.5 rounded-[50px] ${activeFilter === 'all' ? 'bg-[#1B4332] shadow-[0_4px_12px_rgba(27,67,50,0.2)]' : 'bg-transparent'}`}
              >
                <Text className={`font-sans font-bold text-[15px] ${activeFilter === 'all' ? 'text-white' : 'text-[#666]'}`}>Todas</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={() => setActiveFilter('pending')}
                className={`px-6 py-2.5 rounded-[50px] ${activeFilter === 'pending' ? 'bg-[#1B4332] shadow-[0_4px_12px_rgba(27,67,50,0.2)]' : 'bg-transparent'}`}
              >
                <Text className={`font-sans font-bold text-[15px] ${activeFilter === 'pending' ? 'text-white' : 'text-[#666]'}`}>Aguardando Resposta</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={() => setActiveFilter('answered')}
                className={`px-6 py-2.5 rounded-[50px] ${activeFilter === 'answered' ? 'bg-[#1B4332] shadow-[0_4px_12px_rgba(27,67,50,0.2)]' : 'bg-transparent'}`}
              >
                <Text className={`font-sans font-bold text-[15px] ${activeFilter === 'answered' ? 'text-white' : 'text-[#666]'}`}>Respondidas por mim</Text>
              </TouchableOpacity>
            </View>
          </YeloScrollView>

          {/* BUSCA */}
          <View className="flex-row items-center bg-white border border-[#e5e7eb] rounded-[50px] px-5 py-3 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
            <TextInput 
              placeholder="Buscar por palavras-chave ou temas..."
              value={search}
              onChangeText={setSearch}
              className="flex-1 font-sans text-[15px] text-[#333]"
              placeholderTextColor="#999"
            />
          </View>
        </View>

        {/* FEED DE PERGUNTAS */}
        <View className="px-6 mt-2">
          {filteredQuestions.length === 0 ? (
            <View className="items-center py-10">
              <Text className="text-[48px] mb-3">🎉</Text>
              <Text className="font-title text-[#1B4332] text-[24px] mb-2">Tudo limpo por aqui!</Text>
              <Text className="font-sans text-[#666] text-[15px] text-center">Nenhuma pergunta encontrada com os filtros atuais.</Text>
            </View>
          ) : (
            filteredQuestions.map((q) => (
              <View 
                key={q.id} 
                className={`bg-white border border-[#e5e7eb] rounded-[16px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5 relative ${q.respondedByMe ? 'opacity-70' : ''}`}
              >
                {/* Botão Ignorar */}
                {!q.respondedByMe && (
                  <TouchableOpacity onPress={handleIgnore} className="absolute top-4 right-4 p-2 opacity-40">
                    <Feather name="eye-off" size={20} color="#1B4332" />
                  </TouchableOpacity>
                )}

                {/* Cabeçalho do Card */}
                <View className="mb-4 pr-8">
                  <Text className="font-title text-[#1B4332] text-[18px] mb-1">{q.title}</Text>
                  <Text className="font-sans text-[#888] text-[13px]">Enviada em {q.date} • Paciente Anônimo</Text>
                </View>
                
                {/* Balão da Pergunta */}
                <View className="bg-[#f8f9fa] border border-[#e9ecef] rounded-[16px] rounded-tl-[4px] p-4 mb-4">
                  <Text className="font-sans text-[#444] text-[15px] leading-relaxed">{q.content}</Text>
                </View>

                {/* Lista de Respostas */}
                <View className={`mt-2 ${q.respondedByMe ? 'mb-0' : 'mb-5'}`}>
                  {q.answers.length > 0 ? (
                    q.answers.map((ans) => (
                      <View key={ans.id} className="bg-[#f0fdf4] border border-[#dcfce7] p-4 rounded-[12px] mb-3">
                        <View className="flex-row items-center mb-2">
                          <Image source={{ uri: ans.avatar }} className="w-8 h-8 rounded-full mr-3 border border-[#bbf7d0]" />
                          <Text className="font-bold text-[#1B4332] text-[14px]">{ans.psiName}</Text>
                        </View>
                        <Text className="font-sans text-[#166534] text-[14px] leading-relaxed">{ans.text}</Text>
                      </View>
                    ))
                  ) : (
                    <Text className="font-sans font-bold text-[#d97706] text-[14px]">⏳ Aguardando resposta...</Text>
                  )}
                </View>

                {/* Ações */}
                {!q.respondedByMe && (
                  <TouchableOpacity 
                    onPress={() => openAnswerModal(q)}
                    className="bg-[#1B4332] py-3.5 rounded-[50px] items-center flex-row justify-center shadow-[0_4px_15px_rgba(27,67,50,0.15)]"
                  >
                    <Text className="font-bold text-white text-[15px]">Responder</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>
      </YeloScrollView>

      {/* MODAL: RESPONDER PERGUNTA */}
      <Modal 
        visible={modalVisible} 
        animationType="slide" 
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
        onDismiss={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-white">
          
          <View className="p-6 pb-2 border-b border-transparent bg-white relative">
            <View className="w-12 h-1 bg-gray-300 rounded-full absolute top-2 left-1/2 -ml-6" />
            
            <TouchableOpacity onPress={() => setModalVisible(false)} className="absolute top-4 right-4 w-[36px] h-[36px] bg-[#f5f5f5] rounded-full items-center justify-center z-10">
              <Feather name="x" size={18} color="#666" />
            </TouchableOpacity>

            <Text className="font-title text-[#1B4332] text-[24px] mt-2 mb-4 pr-10">
              Respondendo: {activeQuestion?.title}
            </Text>
            
            <Text className="font-sans text-[#666] text-[14px] leading-relaxed mb-2">
              Sua resposta será pública e ajudará este usuário e outros na comunidade.
            </Text>
          </View>

          <YeloScrollView className="flex-1 px-6 pt-4">
            <View className="bg-[#f9fafb] border border-[#e9ecef] rounded-[24px] min-h-[220px] p-0 overflow-hidden mb-2">
              <TextInput 
                value={answerText}
                onChangeText={setAnswerText}
                placeholder="Escreva sua resposta aqui... Lembre-se do sigilo e do acolhimento."
                multiline
                textAlignVertical="top"
                className="flex-1 font-sans text-[16px] text-[#333] leading-relaxed p-5 bg-transparent"
              />
            </View>
            <Text className={`text-right text-[12px] ${answerText.length >= 50 ? 'text-[#1B4332] font-bold' : 'text-[#666]'}`}>
              {answerText.length}/50 caracteres
            </Text>
          </YeloScrollView>

          {/* Modal Footer */}
          <View className="p-5 pt-3 bg-white border-t border-[#eee] flex-row justify-end items-center gap-3">
            <TouchableOpacity 
              onPress={() => setModalVisible(false)} 
              className="bg-transparent border border-[#ccc] px-5 py-3 rounded-[50px]"
            >
              <Text className="font-sans font-bold text-[#666] text-[14px]">Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              disabled={answerText.length < 50}
              className={`px-5 py-3 rounded-[50px] shadow-[0_4px_15px_rgba(27,67,50,0.2)] ${answerText.length < 50 ? 'bg-[#a3b1ab] opacity-70' : 'bg-[#1B4332]'}`}
            >
              <Text className="font-sans font-bold text-white text-[14px]">Enviar Resposta</Text>
            </TouchableOpacity>
          </View>

        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}
