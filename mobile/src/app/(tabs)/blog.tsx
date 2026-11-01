import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Modal, 
  TextInput, 
  KeyboardAvoidingView, 
  Platform, 
  Alert,
  ActivityIndicator,
  RefreshControl 
} from 'react-native';
import YeloScrollView from '../../components/YeloScrollView';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';

export default function BlogScreen() {
  const router = useRouter();

  const [posts, setPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchMyPosts = async () => {
    try {
      const res = await api.get('/api/psychologists/me/posts');
      if (Array.isArray(res.data)) {
        setPosts(res.data);
      }
    } catch (e) {
      console.error("Erro ao carregar posts:", e);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMyPosts();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMyPosts();
  }, []);

  const handleCreatePost = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      Alert.alert("Aviso", "Por favor, preencha o título e o conteúdo do post.");
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post('/api/psychologists/me/posts', {
        titulo: newTitle.trim(),
        conteudo: newContent.trim()
      });

      Alert.alert("Publicado! 🚀", "Seu post foi publicado com sucesso e aumentará sua autoridade clínica.");
      setModalVisible(false);
      setNewTitle('');
      setNewContent('');
      fetchMyPosts();
    } catch (e: any) {
      Alert.alert("Erro", e.response?.data?.error || "Falha ao publicar post.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePost = (id: number) => {
    Alert.alert(
      "Excluir Post",
      "Tem certeza que deseja excluir esta publicação?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/api/psychologists/me/posts/${id}`);
              setPosts(prev => prev.filter(p => p.id !== id));
            } catch (e) {
              Alert.alert("Erro", "Não foi possível excluir o post.");
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
            <Text className="font-title text-[24px] text-white leading-tight flex-1">Meus Posts ✍️</Text>
          </View>
          <Text className="font-sans text-[14px] text-white/85 mt-1 leading-5">
            Compartilhe sua visão clínica! Bons posts constroem autoridade e atraem mais pacientes.
          </Text>
        </View>

        {/* WIDGET SUGESTÕES DE TEMAS */}
        <View className="mx-5 mb-6 bg-white p-5 rounded-[20px] shadow-sm border border-[#e5e7eb]">
          <View className="flex-row items-center mb-2">
            <View className="w-[38px] h-[38px] bg-[#fef3c7] rounded-[10px] items-center justify-center mr-2.5">
              <Text className="text-[18px]">💡</Text>
            </View>
            <Text className="font-title text-[#b45309] text-[18px]">Temas Mais Buscados</Text>
          </View>
          <Text className="font-sans text-[#92400e] text-[13px] mb-3 leading-relaxed">
            Inspire-se nos assuntos que os pacientes mais procuram na Yelo para o seu próximo post:
          </Text>
          
          <View className="gap-2">
            {[
              "Manejo prático de crises de ansiedade",
              "Como identificar e tratar a Síndrome de Burnout",
              "Relacionamentos e comunicação não-violenta"
            ].map((theme, i) => (
              <TouchableOpacity 
                key={i}
                onPress={() => {
                  setNewTitle(theme);
                  setModalVisible(true);
                }}
                className="bg-[#f9fafb] border border-[#e9ecef] px-3.5 py-2.5 rounded-[12px] flex-row items-center justify-between"
              >
                <Text className="text-[#333] font-sans font-medium text-[13px] flex-1">{theme}</Text>
                <Feather name="plus-circle" size={16} color="#1B4332" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* LISTA DE POSTS */}
        <View className="mx-5 mb-8">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="font-title text-[#1B4332] text-[20px]">Posts Publicados</Text>
            <TouchableOpacity 
              onPress={() => setModalVisible(true)}
              className="bg-[#1B4332] rounded-full flex-row items-center justify-center py-2 px-4 shadow-sm"
            >
              <Feather name="plus" size={14} color="white" />
              <Text className="font-sans text-white text-[13px] font-bold ml-1">Novo Post</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View className="py-12 items-center"><ActivityIndicator color="#1B4332" /></View>
          ) : posts.length === 0 ? (
            <View className="bg-white rounded-[18px] p-8 items-center border border-[#e9ecef]">
              <Feather name="file-text" size={36} color="#ccc" />
              <Text className="font-title text-[#333] text-[16px] mt-3 mb-1 text-center">Nenhum post publicado</Text>
              <Text className="font-sans text-[#777] text-[13px] text-center mb-4">
                Publique seu primeiro conteúdo para destacar sua escuta na plataforma.
              </Text>
              <TouchableOpacity 
                onPress={() => setModalVisible(true)}
                className="bg-[#1B4332] py-2 px-5 rounded-full"
              >
                <Text className="text-white font-bold font-sans text-[12px]">Escrever Primeiro Post</Text>
              </TouchableOpacity>
            </View>
          ) : (
            posts.map((post) => (
              <View key={post.id} className="bg-white border border-[#e9ecef] rounded-[18px] p-5 shadow-sm mb-3.5">
                <Text className="font-title text-[#1B4332] text-[17px] mb-1.5 leading-snug">{post.titulo || post.title}</Text>
                <Text className="font-sans text-[#555] text-[13px] leading-5 mb-3" numberOfLines={3}>
                  {post.conteudo || post.content}
                </Text>
                
                <View className="flex-row items-center justify-between border-t border-[#f0f0f0] pt-3">
                  <Text className="font-sans text-[#888] text-[12px]">📅 {formatDate(post.createdAt)}</Text>
                  
                  <TouchableOpacity 
                    onPress={() => handleDeletePost(post.id)}
                    className="flex-row items-center gap-1 py-1 px-2.5 rounded-full bg-[#fef2f2]"
                  >
                    <Feather name="trash-2" size={12} color="#d32f2f" />
                    <Text className="font-sans text-[#d32f2f] text-[11px] font-bold">Excluir</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

      </YeloScrollView>

      {/* MODAL: NOVO POST */}
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
            <Text className="font-title text-[#1B4332] text-[17px]">Criar Novo Post</Text>
            <View style={{ width: 32 }} />
          </View>

          <YeloScrollView className="flex-1 p-5">
            <Text className="font-sans font-bold text-[#444] text-[12px] uppercase mb-1">Título do Post</Text>
            <TextInput 
              placeholder="Ex: Como o acolhimento psicológico transforma a ansiedade"
              value={newTitle}
              onChangeText={setNewTitle}
              className="bg-[#f8f9fa] border border-[#e0e0e0] rounded-[12px] px-4 py-3 font-sans text-[15px] text-[#333] mb-4"
            />

            <Text className="font-sans font-bold text-[#444] text-[12px] uppercase mb-1">Conteúdo</Text>
            <TextInput 
              multiline
              numberOfLines={8}
              placeholder="Compartilhe seu artigo ou reflexão..."
              value={newContent}
              onChangeText={setNewContent}
              className="bg-[#f8f9fa] border border-[#e0e0e0] rounded-[14px] p-4 font-sans text-[14px] text-[#333] mb-5"
              style={{ minHeight: 160, textAlignVertical: 'top' }}
            />

            <TouchableOpacity 
              onPress={handleCreatePost}
              disabled={isSubmitting}
              className="bg-[#1B4332] py-3.5 rounded-full items-center justify-center shadow-sm"
            >
              {isSubmitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="font-sans font-bold text-white text-[15px]">Publicar Post</Text>
              )}
            </TouchableOpacity>
          </YeloScrollView>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}
