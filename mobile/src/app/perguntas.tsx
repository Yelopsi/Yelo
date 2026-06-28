import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, Modal, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import YeloScrollView from '../components/YeloScrollView';
import PublicBottomNav from '../components/PublicBottomNav';
import PublicHeader from '../components/PublicHeader';
import api from '../services/api';
import { ActivityIndicator, Alert } from 'react-native';

export default function PerguntasScreen() {
  const router = useRouter();
  const [question, setQuestion] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [questionsList, setQuestionsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const fetchQuestions = async () => {
    try {
      const res = await api.get('/api/qna/public');
      setQuestionsList(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.log('Erro ao buscar perguntas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const handleSubmit = async () => {
    if (question.length >= 50) {
      setSending(true);
      try {
        await api.post('/api/qna/ask', { conteudo: question });
        setModalVisible(true);
        setQuestion('');
        fetchQuestions(); // recarrega a lista
      } catch (error) {
        Alert.alert("Erro", "Não foi possível enviar a pergunta. Tente novamente mais tarde.");
      } finally {
        setSending(false);
      }
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#1B4332' }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: isScrolled ? '#ffffff' : '#1B4332' }} edges={['top']}>
        <PublicHeader isScrolled={isScrolled} />
        <YeloScrollView 
          refreshColor="#1B4332" 
          style={{ flex: 1, backgroundColor: '#fff' }} 
          contentContainerStyle={styles.scrollContent}
          onScroll={(e) => setIsScrolled(e.nativeEvent.contentOffset.y > 20)}
          scrollEventThrottle={16}
        >
        {/* Doodles de Fundo */}
        <View style={{ position: 'absolute', top: 150, left: -50, opacity: 0.4, zIndex: 0, transform: [{ rotate: '45deg' }] }}>
          <Svg viewBox="0 0 200 200" width={300} height={300}>
            <Path fill="#e0e0e0" d="M45.7,-76.3C58.9,-69.3,69.1,-55.6,76.3,-41.2C83.5,-26.8,87.7,-11.7,85.6,2.6C83.5,16.9,75.1,30.4,65.6,42.2C56.1,54,45.5,64.1,33.3,70.3C21.1,76.5,7.3,78.8,-5.3,76.9C-17.9,75,-34.7,68.9,-48.6,59.6C-62.5,50.3,-73.5,37.8,-79.6,23.3C-85.7,8.8,-86.9,-7.7,-80.7,-21.8C-74.5,-35.9,-60.9,-47.6,-46.8,-54.3C-32.7,-61,-18.1,-62.7,-2.9,-62.2C12.3,-61.7,24.6,-59,32.5,-83.3L45.7,-76.3Z" transform="translate(100, 100)" />
          </Svg>
        </View>
        <View style={{ position: 'absolute', top: '40%', right: -50, opacity: 0.4, zIndex: 0, transform: [{ rotate: '-45deg' }] }}>
          <Svg viewBox="0 0 200 200" width={250} height={250}>
            <Path fill="#e0e0e0" d="M38.1,-63.8C49.3,-54.6,58.3,-43.3,65.5,-30.8C72.7,-18.3,78.1,-4.6,76.3,8.3C74.5,21.2,65.5,33.3,55.3,43.4C45.1,53.5,33.7,61.6,21.1,66.1C8.5,70.6,-5.3,71.5,-18.4,67.8C-31.5,64.1,-43.9,55.8,-53.4,45.2C-62.9,34.6,-69.5,21.7,-70.8,8.2C-72.1,-5.3,-68.1,-19.4,-59.6,-31.1C-51.1,-42.8,-38.1,-52.1,-25.3,-60.1C-12.5,-68.1,0.1,-74.8,12.7,-74.8C25.3,-74.8,38.1,-68.1,38.1,-63.8Z" transform="translate(100, 100)" />
          </Svg>
        </View>
        <View style={{ position: 'absolute', bottom: '5%', left: -40, opacity: 0.3, zIndex: 0, transform: [{ rotate: '-15deg' }] }}>
          <Svg viewBox="0 0 200 200" width={220} height={220}>
            <Path fill="#e0e0e0" d="M44.7,-76.4C58.9,-69.2,71.8,-59.1,81.6,-46.6C91.4,-34.1,98.1,-19.2,96.8,-4.8C95.5,9.6,86.3,23.5,76.4,36.4C66.5,49.5,56,61.6,43.5,69.9C31,78.2,16.5,82.7,1.5,80.1C-13.5,77.5,-29,67.8,-42.6,58.4C-56.2,49,-67.9,39.9,-75.8,28.1C-83.7,16.3,-87.8,1.8,-85.4,-11.8C-83,-25.4,-74.1,-38.1,-63.4,-48.6C-52.7,-59.1,-40.2,-67.4,-27.2,-75.4C-14.2,-83.4,-0.7,-91.1,12.5,-90.1C25.7,-89.1,51.4,-79.4,44.7,-76.4Z" transform="translate(100, 100)" />
          </Svg>
        </View>

        <View className="px-[20px] pt-[60px] relative z-10 w-full max-w-[800px] self-center">
          {/* Header Texts */}
          <Text className="font-title text-[#333] text-[32px] text-center mb-[20px]">
            Perguntas e Respostas
          </Text>
          <Text className="font-sans text-[#555] text-[18px] text-center mb-[50px] leading-relaxed">
            Tire suas dúvidas sobre saúde mental com os profissionais da nossa plataforma.{'\n'}
            Este é um espaço seguro e anônimo.
          </Text>

          {/* Benefícios Grid */}
          <View className="mb-[60px] gap-y-[24px]">
            <View className="bg-white p-[25px] rounded-[20px] border border-[#e9ecef] shadow-[0_4px_15px_rgba(0,0,0,0.03)] border-t-[4px] border-t-[#1B4332]">
              <Text className="font-title text-[#1B4332] text-[20px] mb-[10px] text-center">100% Gratuito</Text>
              <Text className="font-sans text-[#555] text-[15px] leading-relaxed text-center">
                Serviço gratuito para democratizar o acesso à informação de qualidade.
              </Text>
            </View>
            <View className="bg-white p-[25px] rounded-[20px] border border-[#e9ecef] shadow-[0_4px_15px_rgba(0,0,0,0.03)] border-t-[4px] border-t-[#FFEE8C]">
              <Text className="font-title text-[#1B4332] text-[20px] mb-[10px] text-center">Respondido por Psis</Text>
              <Text className="font-sans text-[#555] text-[15px] leading-relaxed text-center">
                Respostas voluntárias de psicólogos verificados (CRP ativo).
              </Text>
            </View>
            <View className="bg-white p-[25px] rounded-[20px] border border-[#e9ecef] shadow-[0_4px_15px_rgba(0,0,0,0.03)] border-t-[4px] border-t-[#4ade80]">
              <Text className="font-title text-[#1B4332] text-[20px] mb-[10px] text-center">Seguro e Anônimo</Text>
              <Text className="font-sans text-[#555] text-[15px] leading-relaxed text-center">
                Sua identidade é protegida. Nunca compartilhe dados pessoais.
              </Text>
            </View>
          </View>

          {/* Busca */}
          <View className="mb-[60px] relative w-full">
            <View className="absolute left-[22px] top-[16px] z-10">
              <Svg width={22} height={22} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#888">
                <Path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </Svg>
            </View>
            <TextInput
              className="w-full bg-[#f0f2f5] rounded-[50px] pt-[16px] pb-[16px] pr-[25px] pl-[55px] text-[16px] font-sans text-[#333] border border-transparent focus:bg-white focus:border-[#1B4332]"
              placeholderTextColor="#888"
              placeholder="Busque por perguntas ou respostas..."
            />
          </View>

          {/* Ask Box */}
          <View className="bg-white border border-[#e9ecef] rounded-[24px] p-[25px] mb-[60px] shadow-[0_10px_40px_rgba(0,0,0,0.04)] w-full">
            <Text className="font-title text-[#1B4332] text-[25px] text-center mb-[25px]">
              Pergunte aqui!
            </Text>
            <TextInput
              multiline
              textAlignVertical="top"
              className="w-full h-[120px] p-[18px] bg-[#f8f9fa] border border-[#dee2e6] rounded-[16px] font-sans text-[16px] text-[#333] focus:bg-white focus:border-[#1B4332]"
              placeholder="Escreva aqui sua dúvida... (Mínimo 50 caracteres)"
              placeholderTextColor="#888"
              value={question}
              onChangeText={setQuestion}
            />
            <View className="flex-row justify-between mt-[10px]">
              <Text className="font-sans text-[14px] font-bold text-[#E63946]">
                {question.length > 0 && question.length < 50 ? `Faltam ${50 - question.length} caracteres` : ''}
              </Text>
              <Text className={`font-sans text-[14px] ${question.length >= 50 ? 'text-[#1B4332] font-bold' : 'text-[#666]'}`}>
                {question.length}/50 caracteres
              </Text>
            </View>
            
            <View className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-[16px] p-[20px] mt-[25px] gap-y-[8px]">
              <Text className="font-sans text-[#166534] text-[14px] leading-relaxed">
                <Text className="font-bold">100% Anônimo:</Text> Sua pergunta será publicada sem identificar você.
              </Text>
              <Text className="font-sans text-[#166534] text-[14px] leading-relaxed">
                <Text className="font-bold">Seja objetivo:</Text> Perguntas claras e breves recebem melhores respostas.
              </Text>
              <Text className="font-sans text-[#166534] text-[14px] leading-relaxed">
                <Text className="font-bold">Para a comunidade:</Text> A dúvida é enviada para todos os especialistas, não para um específico.
              </Text>
              <Text className="font-sans text-[#166534] text-[14px] leading-relaxed">
                <Text className="font-bold">Caráter Informativo:</Text> Não substitui consulta clínica.
              </Text>
              <Text className="font-sans text-[#166534] text-[14px] leading-relaxed">
                <Text className="font-bold">Restrições:</Text> Não são permitidas perguntas sobre casos muito específicos, segundas opiniões ou dosagens de medicamentos.
              </Text>
            </View>

            <View className="mt-[20px] items-center">
              <TouchableOpacity 
                className={`w-full max-w-[300px] py-[15px] rounded-[50px] items-center flex-row justify-center ${question.length >= 50 ? 'bg-[#1B4332]' : 'bg-[#e0e0e0]'}`}
                disabled={question.length < 50 || sending}
                onPress={handleSubmit}
              >
                {sending ? <ActivityIndicator color="#fff" /> : <Text className="font-sans font-bold text-white text-[16px]">Enviar Pergunta</Text>}
              </TouchableOpacity>
            </View>
          </View>

          {/* Últimas perguntas */}
          <Text className="font-title text-[#333] text-[25px] text-center mt-[20px] mb-[40px]">
            Últimas perguntas respondidas
          </Text>
          
          <View className="w-full mb-[40px]">
            {loading ? (
              <ActivityIndicator size="large" color="#1B4332" style={{ marginTop: 20 }} />
            ) : questionsList.length === 0 ? (
              <Text className="font-sans text-center text-[#666]">Nenhuma pergunta respondida ainda.</Text>
            ) : (
              questionsList.map((item, index) => (
                <View key={item.id || index} className="mb-[30px]">
                  {/* Pergunta */}
                  <View className="bg-white border border-[#e0e0e0] rounded-[16px] p-[20px] shadow-[0_4px_15px_rgba(0,0,0,0.04)] w-full mb-[15px]">
                    <Text className="font-title text-[#1B4332] text-[20px] mb-[12px] leading-relaxed">
                      {item.title || item.conteudo?.substring(0, 50) + (item.conteudo?.length > 50 ? '...' : '')}
                    </Text>
                    <Text className="font-sans text-[#444] text-[16px] leading-relaxed">
                      {item.content || item.conteudo}
                    </Text>
                    <Text className="font-sans text-[#888] text-[13px] font-medium mt-[10px] text-right">
                      Paciente Anônimo • {new Date(item.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  
                  {/* Respostas */}
                  {item.answers && item.answers.length > 0 && (
                    <View className="ml-[20px] pl-[15px] border-l-[3px] border-l-[#e8f5e9] gap-y-[15px]">
                      <Text className="font-sans text-[#888] text-[12px] font-bold uppercase tracking-wide">
                        Respostas de Especialistas
                      </Text>
                      {item.answers.map((answer: any, ansIdx: number) => (
                        <View key={answer.id || ansIdx} className="bg-[#fcfcfc] border border-[#e9ecef] rounded-[16px] p-[20px] shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                          <View className="flex-row items-center gap-[12px] pb-[10px] mb-[10px] border-b border-b-[rgba(27,67,50,0.1)]">
                            <Image 
                              source={{ uri: answer.psychologist?.fotoUrl || 'https://placehold.co/150x150?text=PSI' }} 
                              className="w-[36px] h-[36px] rounded-full border-2 border-white" 
                            />
                            <View className="flex-1">
                              <Text className="font-sans font-bold text-[#1B4332] text-[15px]">
                                {answer.psychologist?.nome || 'Psicólogo Especialista'}
                              </Text>
                              <Text className="font-sans text-[#666] text-[12px]">
                                CRP {answer.psychologist?.crp || '00/00000'}
                              </Text>
                            </View>
                            <TouchableOpacity onPress={() => router.push(`/${answer.psychologist?.slug}` as any)} className="bg-[#1B4332] py-[8px] px-[16px] rounded-[50px] hidden sm:flex">
                              <Text className="font-sans font-bold text-white text-[13px]">Ver perfil</Text>
                            </TouchableOpacity>
                          </View>
                          <Text className="font-sans text-[#222] text-[16px] leading-relaxed">
                            {answer.content || answer.conteudo}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))
            )}
          </View>

        </View>
      </YeloScrollView>

      {/* Modal de Conversão PLG */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View className="flex-1 bg-[rgba(0,0,0,0.6)] justify-center items-center px-[20px]">
          <View className="bg-[#FDFAF6] p-[30px] rounded-[20px] w-full max-w-[450px] items-center shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
            <View className="w-[60px] h-[60px] bg-[#FFEE8C] rounded-full justify-center items-center mb-[20px] shadow-[0_4px_10px_rgba(27,67,50,0.1)]">
              <Text className="text-[28px]">✨</Text>
            </View>
            <Text className="font-title text-[#1B4332] text-[25px] mb-[15px] text-center">Pergunta enviada!</Text>
            <Text className="font-sans text-[#555] text-[16px] leading-relaxed text-center mb-[25px]">
              Sua dúvida já foi encaminhada para nossa comunidade de psicólogos verificados.{'\n\n'}
              Enquanto aguarda a resposta, que tal vermos qual profissional é o <Text className="font-bold">match ideal</Text> para o seu momento?
            </Text>
            <TouchableOpacity 
              className="bg-[#1B4332] w-full py-[14px] rounded-[50px] items-center shadow-[0_4px_15px_rgba(27,67,50,0.2)] mb-[15px]"
              onPress={() => {
                setModalVisible(false);
                // router.push('/questionario');
              }}
            >
              <Text className="font-sans font-bold text-white text-[17px]">Encontrar meu Psicólogo Agora</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text className="font-sans text-[#888] text-[14px] underline">Voltar para as perguntas</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <PublicBottomNav />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 60,
    position: 'relative',
  }
});
