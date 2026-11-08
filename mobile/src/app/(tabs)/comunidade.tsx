import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  TextInput, 
  Modal, 
  KeyboardAvoidingView, 
  Platform, 
  Image, 
  Alert,
  ActivityIndicator,
  RefreshControl 
} from 'react-native';
import YeloScrollView from '../../components/YeloScrollView';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';

export default function ComunidadeScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'answered'>('all');
  const [search, setSearch] = useState('');
  
  const [questions, setQuestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState<any>(null);
  const [answerText, setAnswerText] = useState('');
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);

  const fetchQuestions = async () => {
    try {
      const res = await api.get('/api/qna?limit=25');
      if (Array.isArray(res.data)) {
        setQuestions(res.data);
      }
    } catch (e) {
      console.error("Erro ao buscar perguntas da comunidade:", e);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchQuestions();
  }, []);

  const filteredQuestions = questions.filter(q => {
    const textToMatch = `${q.titulo || ''} ${q.conteudo || ''}`.toLowerCase();
    const matchesSearch = textToMatch.includes(search.toLowerCase());
    if (activeFilter === 'pending') return matchesSearch && !q.respondedByMe;
    if (activeFilter === 'answered') return matchesSearch && q.respondedByMe;
    return matchesSearch;
  });

  const openAnswerModal = (question: any) => {
    setActiveQuestion(question);
    setAnswerText('');
    setModalVisible(true);
  };

  const handleSendAnswer = async () => {
    if (!answerText.trim() || !activeQuestion) return;

    if (answerText.trim().length < 20) {
      Alert.alert("Aviso", "Escreva uma resposta de pelo menos 20 caracteres para acolher a dúvida do paciente.");
      return;
    }

    try {
      setIsSubmittingAnswer(true);
      await api.post(`/api/qna/${activeQuestion.id}/answer`, {
        conteudo: answerText.trim()
      });

      Alert.alert("Sucesso", "Sua resposta foi enviada e aumentará sua autoridade na plataforma!");
      setModalVisible(false);
      fetchQuestions();
    } catch (e: any) {
      Alert.alert("Erro", e.response?.data?.error || "Falha ao enviar resposta.");
    } finally {
      setIsSubmittingAnswer(false);
    }
  };

  const handleIgnore = (questionId: number) => {
    Alert.alert(
      'Ignorar Pergunta',
      'Tem certeza que deseja ocultar esta dúvida? Ela sumirá da sua lista.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Ocultar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`/api/qna/${questionId}/ignore`);
              setQuestions(prev => prev.filter(q => q.id !== questionId));
            } catch (e) {
              console.error("Erro ao ignorar pergunta:", e);
            }
          }
        }
      ]
    );
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR');
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <YeloScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1B4332']} />
        }
      >
        {/* HEADER */}
        <View className="mx-5 mt-5 mb-5 bg-[#1B4332] p-[20px] rounded-[20px] shadow-sm">
          <View className="flex-row items-center mb-2">
            <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-white/20 rounded-full items-center justify-center mr-3">
              <Feather name="arrow-left" size={20} color="white" />
            </TouchableOpacity>
            <Text className="font-title text-[24px] text-white leading-tight flex-1">Comunidade Q&A</Text>
          </View>
          <Text className="font-sans text-[14px] text-white/85 mt-1 leading-5">
            Responda dúvidas de pacientes reais e ganhe autoridade e destaque nos resultados de match.
          </Text>
        </View>

        {/* CONTROLES: BUSCA E FILTROS */}
        <View className="mx-5 mb-5 bg-white border border-[#e5e7eb] rounded-[20px] p-4 shadow-sm">
          {/* Busca */}
          <View className="flex-row items-center bg-[#f9fafb] border border-[#e0e0e0] rounded-full px-4 py-2.5 mb-3.5">
            <Feather name="search" size={16} color="#888" />
            <TextInput 
              placeholder="Buscar por tema ou dúvida..."
              value={search}
              onChangeText={setSearch}
              className="flex-1 font-sans text-[14px] text-[#333] ml-2.5"
              placeholderTextColor="#999"
            />
          </View>

          {/* Filtros em Abas */}
          <View className="flex-row bg-[#f1f3f5] p-1 rounded-full">
            {[
              { id: 'all', label: 'Todas' },
              { id: 'pending', label: 'Sem Resposta' },
              { id: 'answered', label: 'Respondidas' }
            ].map((tab: any) => (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveFilter(tab.id)}
                className={`flex-1 py-2 rounded-full items-center ${activeFilter === tab.id ? 'bg-white shadow-sm' : ''}`}
              >
                <Text className={`font-sans text-[12px] font-bold ${
                  activeFilter === tab.id ? 'text-[#1B4332]' : 'text-[#666]'
                }`}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* LISTA DE PERGUNTAS REAIS */}
        <View className="mx-5">
          {isLoading ? (
            <View className="py-12 items-center">
              <ActivityIndicator color="#1B4332" />
            </View>
          ) : filteredQuestions.length === 0 ? (
            <View className="bg-white rounded-[20px] p-8 items-center border border-[#e5e7eb]">
              <Feather name="help-circle" size={40} color="#ccc" />
              <Text className="font-title text-[#333] text-[18px] mt-3 mb-1 text-center">Nenhuma dúvida encontrada</Text>
              <Text className="font-sans text-[#777] text-[13px] text-center">
                Novas perguntas enviadas por visitantes da plataforma aparecerão aqui.
              </Text>
            </View>
          ) : (
            filteredQuestions.map((q) => (
              <View key={q.id} className="bg-white border border-[#e5e7eb] rounded-[18px] p-4 mb-3.5 shadow-sm">
                <View className="flex-row items-center justify-between mb-2">
                  <View className="bg-[#e8f5e9] px-2.5 py-0.5 rounded-full">
                    <Text className="font-sans font-bold text-[#166534] text-[11px]">
                      {q.Patient?.nome || 'Pergunta Pública'}
                    </Text>
                  </View>
                  <Text className="font-sans text-[#999] text-[11px]">{formatDate(q.createdAt)}</Text>
                </View>

                {q.titulo ? (
                  <Text className="font-title text-[#222] text-[16px] mb-1 leading-snug">{q.titulo}</Text>
                ) : null}
                <Text className="font-sans text-[#444] text-[14px] leading-5 mb-3">{q.conteudo}</Text>

                {/* Respostas já existentes */}
                {q.answers && q.answers.length > 0 && (
                  <View className="bg-[#f8f9fa] rounded-[12px] p-3 mb-3 border border-[#f0f0f0]">
                    <Text className="font-sans font-bold text-[#1B4332] text-[11px] uppercase tracking-wider mb-1.5">
                      {q.answers.length} {q.answers.length === 1 ? 'resposta registrada' : 'respostas registradas'}
                    </Text>
                    {q.answers.slice(0, 1).map((ans: any, idx: number) => (
                      <Text key={idx} className="font-sans text-[#555] text-[12px] italic leading-4" numberOfLines={2}>
                        "{ans.content}" — <Text className="font-bold">{ans.psychologist?.nome || 'Colega'}</Text>
                      </Text>
                    ))}
                  </View>
                )}

                {/* Ações */}
                <View className="flex-row items-center justify-between border-t border-[#f0f0f0] pt-2.5">
                  <TouchableOpacity 
                    onPress={() => handleIgnore(q.id)}
                    className="flex-row items-center gap-1 px-2 py-1"
                  >
                    <Feather name="eye-off" size={13} color="#888" />
                    <Text className="font-sans text-[#888] text-[12px]">Ignorar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => openAnswerModal(q)}
                    className="bg-[#1B4332] px-4 py-2 rounded-full"
                  >
                    <Text className="font-sans font-bold text-white text-[12px]">
                      {q.respondedByMe ? 'Editar Resposta' : 'Responder'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

      </YeloScrollView>

      {/* MODAL DE RESPOSTA */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-white">
          <View className="p-4 border-b border-[#f0f0f0] flex-row items-center justify-between">
            <TouchableOpacity onPress={() => setModalVisible(false)} className="w-8 h-8 rounded-full bg-[#f0f0f0] items-center justify-center">
              <Feather name="x" size={16} color="#666" />
            </TouchableOpacity>
            <Text className="font-title text-[#1B4332] text-[17px]">Responder Dúvida</Text>
            <View style={{ width: 32 }} />
          </View>

          <YeloScrollView className="flex-1 p-5">
            {activeQuestion && (
              <View className="bg-[#f8f9fa] rounded-[14px] p-4 mb-4 border border-[#eee]">
                <Text className="font-title text-[#333] text-[16px] mb-1">{activeQuestion.titulo || 'Dúvida do Paciente'}</Text>
                <Text className="font-sans text-[#555] text-[13px] leading-5">{activeQuestion.conteudo}</Text>
              </View>
            )}

            <Text className="font-sans font-bold text-[#444] text-[12px] uppercase mb-1">Sua Orientação Clínica</Text>
            <TextInput 
              multiline
              numberOfLines={6}
              placeholder="Escreva uma resposta empática, informativa e acolhedora..."
              value={answerText}
              onChangeText={setAnswerText}
              className="bg-[#f8f9fa] border border-[#e0e0e0] rounded-[14px] p-4 font-sans text-[14px] text-[#333] mb-4"
              style={{ minHeight: 140, textAlignVertical: 'top' }}
            />

            <TouchableOpacity
              onPress={handleSendAnswer}
              disabled={isSubmittingAnswer}
              className="bg-[#1B4332] py-3.5 rounded-full items-center justify-center shadow-sm"
            >
              {isSubmittingAnswer ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="font-sans font-bold text-white text-[15px]">Enviar Resposta</Text>
              )}
            </TouchableOpacity>
          </YeloScrollView>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}
