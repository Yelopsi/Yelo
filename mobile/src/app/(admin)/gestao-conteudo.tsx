import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import api from '../../services/api';

export default function GestaoConteudoScreen() {
  const [activeTab, setActiveTab] = useState('blog');
  const [pendingQna, setPendingQna] = useState<any[]>([]);
  const [loadingQna, setLoadingQna] = useState(true);

  const fetchPendingQna = async () => {
    try {
      setLoadingQna(true);
      const res = await api.get('/api/admin/qna/pending');
      setPendingQna(res.data || []);
    } catch (error) {
      console.log('Erro ao buscar QnA:', error);
    } finally {
      setLoadingQna(false);
    }
  };

  useEffect(() => {
    fetchPendingQna();
  }, []);

  const handleModerateQna = async (id: number, action: 'approved' | 'rejected') => {
    try {
      await api.put(`/api/admin/qna/${id}/moderate`, { status: action });
      Alert.alert('Sucesso', `Pergunta ${action === 'approved' ? 'aprovada' : 'rejeitada'} com sucesso!`);
      fetchPendingQna();
    } catch (error) {
      Alert.alert('Erro', 'Ocorreu um erro ao moderar a pergunta.');
    }
  };

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
        {/* Header */}
        <View className="mb-[25px]">
          <Text className="font-title text-[#1e1b4b] text-[24px]">Gestão de Conteúdo</Text>
          <Text className="font-sans text-[#666] text-[14px]">Modere avaliações, perguntas e páginas estáticas.</Text>
        </View>

        {/* Q&A Pendentes */}
        <View className="bg-white rounded-[16px] p-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-[#f0f0f0] mb-[20px]">
          <View className="flex-row justify-between items-center mb-[15px] border-b border-[#e9ecef] pb-[10px]">
            <Text className="font-title text-[#333] text-[16px]">Moderação de Perguntas (Q&A)</Text>
            <TouchableOpacity onPress={fetchPendingQna} className="p-[5px]">
              <Feather name="refresh-cw" size={14} color="#64748b" />
            </TouchableOpacity>
          </View>
          
          {loadingQna ? (
            <ActivityIndicator size="small" color="#1e1b4b" />
          ) : pendingQna.length === 0 ? (
            <View className="items-center py-[10px]">
              <Text className="text-[24px] mb-[10px]">🎉</Text>
              <Text className="font-sans text-[#888] text-[14px]">Nenhuma pergunta pendente.</Text>
            </View>
          ) : (
            <View className="gap-[15px]">
              {pendingQna.map((q, idx) => (
                <View key={q.id || idx} className="border border-[#e2e8f0] rounded-[12px] p-[15px]">
                  <View className="flex-row justify-between mb-[8px]">
                    <Text className="font-sans text-[#64748b] text-[12px]">Pergunta Anônima</Text>
                    <Text className="font-sans text-[#64748b] text-[12px]">{q.createdAt ? new Date(q.createdAt).toLocaleDateString('pt-BR') : ''}</Text>
                  </View>
                  <Text className="font-title text-[#333] text-[14px] mb-[4px]">{q.title}</Text>
                  <Text className="font-sans text-[#666] text-[13px] mb-[15px]">{q.content}</Text>
                  <View className="flex-row gap-[10px]">
                    <TouchableOpacity onPress={() => handleModerateQna(q.id, 'approved')} className="flex-1 bg-[#10b981] flex-row justify-center py-[8px] rounded-[6px]">
                      <Text className="font-title text-white text-[12px]">Aprovar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleModerateQna(q.id, 'rejected')} className="flex-1 bg-[#fee2e2] flex-row justify-center py-[8px] rounded-[6px]">
                      <Text className="font-title text-[#ef4444] text-[12px]">Rejeitar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Central de Remoção */}
        <View className="bg-white rounded-[16px] p-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-[#f0f0f0] mb-[20px]">
          <Text className="font-title text-[#333] text-[16px] mb-[15px] border-b border-[#e9ecef] pb-[10px]">Central de Remoção de Conteúdo</Text>
          
          <View className="flex-row border-b border-[#eee] mb-[15px]">
            <TouchableOpacity onPress={() => setActiveTab('blog')} className={`flex-1 items-center pb-[10px] ${activeTab === 'blog' ? 'border-b-2 border-[#1B4332]' : ''}`}>
              <Text className={`font-title text-[14px] ${activeTab === 'blog' ? 'text-[#1B4332]' : 'text-[#666]'}`}>Blogs</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setActiveTab('forum')} className={`flex-1 items-center pb-[10px] ${activeTab === 'forum' ? 'border-b-2 border-[#1B4332]' : ''}`}>
              <Text className={`font-title text-[14px] ${activeTab === 'forum' ? 'text-[#1B4332]' : 'text-[#666]'}`}>Fórum</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setActiveTab('qna')} className={`flex-1 items-center pb-[10px] ${activeTab === 'qna' ? 'border-b-2 border-[#1B4332]' : ''}`}>
              <Text className={`font-title text-[14px] ${activeTab === 'qna' ? 'text-[#1B4332]' : 'text-[#666]'}`}>Perguntas</Text>
            </TouchableOpacity>
          </View>

          <View className="items-center py-[20px]">
            <Text className="font-sans text-[#888] text-[14px]">Nenhum item selecionado para remoção nesta aba.</Text>
          </View>
        </View>

        {/* Gestão de Páginas Estáticas */}
        <View className="bg-white rounded-[16px] p-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-[#f0f0f0] mb-[20px]">
          <Text className="font-title text-[#333] text-[16px] mb-[15px] border-b border-[#e9ecef] pb-[10px]">Gestão de Páginas Estáticas</Text>
          <View className="gap-[10px]">
            <View className="flex-row justify-between items-center py-[10px] border-b border-[#f0f0f0]">
              <Text className="font-sans text-[#333] text-[14px]">termos-de-uso</Text>
              <TouchableOpacity onPress={() => Alert.alert('Aviso', 'Abrindo editor HTML...')} className="bg-[#f8f9fa] px-[12px] py-[6px] rounded-[6px] border border-[#e2e8f0]">
                <Text className="font-title text-[#333] text-[12px]">Editar</Text>
              </TouchableOpacity>
            </View>
            <View className="flex-row justify-between items-center py-[10px] border-b border-[#f0f0f0]">
              <Text className="font-sans text-[#333] text-[14px]">politica-de-privacidade</Text>
              <TouchableOpacity onPress={() => Alert.alert('Aviso', 'Abrindo editor HTML...')} className="bg-[#f8f9fa] px-[12px] py-[6px] rounded-[6px] border border-[#e2e8f0]">
                <Text className="font-title text-[#333] text-[12px]">Editar</Text>
              </TouchableOpacity>
            </View>
            <View className="flex-row justify-between items-center py-[10px]">
              <Text className="font-sans text-[#333] text-[14px]">sobre-nos</Text>
              <TouchableOpacity onPress={() => Alert.alert('Aviso', 'Abrindo editor HTML...')} className="bg-[#f8f9fa] px-[12px] py-[6px] rounded-[6px] border border-[#e2e8f0]">
                <Text className="font-title text-[#333] text-[12px]">Editar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View className="h-[120px]" />
      </ScrollView>
    </View>
  );
}
