import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import api from '../../services/api';

export default function ModeracaoForumScreen() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/admin/forum/posts');
      // A API pode retornar res.data como array ou { success: true, data: [...] }
      let postsArray = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      if (!Array.isArray(postsArray)) postsArray = [];
      const pendingPosts = postsArray.filter((p: any) => p.status === 'pending');
      setPosts(pendingPosts);
    } catch (error) {
      console.log('Erro ao buscar posts:', error);
      Alert.alert('Erro', 'Não foi possível carregar os posts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleModerate = async (contentId: number, action: 'approve' | 'reject') => {
    try {
      await api.put('/api/admin/forum/moderate', {
        contentType: 'post',
        contentId,
        action
      });
      Alert.alert('Sucesso', `Post ${action === 'approve' ? 'aprovado' : 'removido'} com sucesso!`);
      fetchPosts();
    } catch (error) {
      Alert.alert('Erro', 'Ocorreu um erro ao moderar.');
    }
  };
  return (
    <View className="flex-1 bg-[#f9fafb]">
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
        {/* Header */}
        <View className="flex-row justify-between items-start mb-[25px]">
          <View className="flex-1 mr-[10px]">
            <Text className="font-title text-[#1e1b4b] text-[24px]">Moderação do Fórum</Text>
            <Text className="font-sans text-[#666] text-[14px]">Aprove, edite ou remova tópicos.</Text>
          </View>
          <TouchableOpacity onPress={fetchPosts} className="bg-[#1B4332] flex-row items-center px-[12px] py-[8px] rounded-[8px]">
            <Feather name="refresh-cw" size={14} color="white" />
            <Text className="font-title text-white text-[12px] ml-[6px]">Atualizar</Text>
          </TouchableOpacity>
        </View>

        {/* Lista de Posts */}
        <View className="gap-[15px]">
          {loading ? (
            <ActivityIndicator size="large" color="#1e1b4b" />
          ) : posts.length === 0 ? (
            <View className="items-center py-[40px]">
              <Text className="text-[40px] mb-[15px]">🧐</Text>
              <Text className="font-sans text-[#888] text-[16px] text-center">Nenhuma discussão pendente no fórum.</Text>
            </View>
          ) : (
            posts.map((post, index) => (
              <View key={post.id || index} className="bg-white rounded-[16px] p-[15px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-[#f0f0f0]">
                <View className="flex-row justify-between items-start mb-[10px]">
                  <Text className="font-title text-[#333] text-[16px] flex-1 mr-[10px]">{post.title || post.content}</Text>
                  <View className="bg-[#fef3c7] px-[8px] py-[4px] rounded-[6px]">
                    <Text className="font-title text-[#d97706] text-[10px]">Pendente</Text>
                  </View>
                </View>
                <View className="flex-row items-center mb-[15px]">
                  <Feather name="user" size={14} color="#64748b" />
                  <Text className="font-sans text-[#64748b] text-[12px] ml-[4px] mr-[15px]">{post.Psychologist?.nome || 'Anônimo'}</Text>
                  <Feather name="tag" size={14} color="#64748b" />
                  <Text className="font-sans text-[#64748b] text-[12px] ml-[4px]">{post.category || 'Geral'}</Text>
                </View>
                <View className="flex-row gap-[10px]">
                  <TouchableOpacity onPress={() => handleModerate(post.id, 'approve')} className="flex-1 bg-[#10b981] flex-row items-center justify-center py-[10px] rounded-[8px]">
                    <Feather name="check" size={14} color="white" />
                    <Text className="font-title text-white text-[13px] ml-[5px]">Aprovar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleModerate(post.id, 'reject')} className="bg-[#fee2e2] px-[15px] flex-row items-center justify-center rounded-[8px]">
                    <Feather name="trash-2" size={14} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        <View className="h-[120px]" />
      </ScrollView>
    </View>
  );
}
