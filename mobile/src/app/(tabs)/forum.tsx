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
  ActivityIndicator, 
  Alert,
  RefreshControl 
} from 'react-native';
import YeloScrollView from '../../components/YeloScrollView';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const CATEGORIES = [
  'Todas',
  'Discussão de Casos',
  'Prática Clínica',
  'Carreira & Negócios',
  'CFP & Legislação',
  'Outros'
];

export default function ForumScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'recentes' | 'populares' | 'meus_posts'>('recentes');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [search, setSearch] = useState('');
  const [posts, setPosts] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Modal Novo Post
  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('Discussão de Casos');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);

  // Modal Detalhes do Post & Comentários
  const [activePost, setActivePost] = useState<any | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentAnonymous, setCommentAnonymous] = useState(false);

  const fetchPosts = async (resetPage = false) => {
    try {
      const currentPage = resetPage ? 1 : page;
      if (resetPage) setIsLoading(true);

      const params = new URLSearchParams();
      params.append('filter', activeTab);
      if (selectedCategory !== 'Todas') params.append('category', selectedCategory);
      if (search.trim()) params.append('search', search.trim());
      params.append('page', String(currentPage));
      params.append('limit', '6');

      const res = await api.get(`/api/forum/posts?${params.toString()}`);
      const fetched = Array.isArray(res.data) ? res.data : (res.data?.posts || []);

      if (resetPage) {
        setPosts(fetched);
        setPage(2);
      } else {
        setPosts(prev => [...prev, ...fetched]);
        setPage(prev => prev + 1);
      }

      setHasMore(fetched.length >= 6);
    } catch (e) {
      console.error("Erro ao buscar posts do fórum:", e);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPosts(true);
  }, [activeTab, selectedCategory]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPosts(true);
  }, [activeTab, selectedCategory, search]);

  const handleSearchSubmit = () => {
    fetchPosts(true);
  };

  const handleVotePost = async (post: any) => {
    const prevVoted = !!post.hasVoted;
    const prevVotes = post.votes || 0;

    // Atualização otimista com as cores ajustadas da web (commit e3a0e109)
    setPosts(prev => prev.map(p => {
      if (p.id === post.id) {
        return {
          ...p,
          hasVoted: !prevVoted,
          votes: prevVoted ? Math.max(0, prevVotes - 1) : prevVotes + 1,
        };
      }
      return p;
    }));

    if (activePost && activePost.id === post.id) {
      setActivePost((prev: any) => ({
        ...prev,
        hasVoted: !prevVoted,
        votes: prevVoted ? Math.max(0, prevVotes - 1) : prevVotes + 1,
      }));
    }

    try {
      await api.post(`/api/forum/posts/${post.id}/vote`);
    } catch (e) {
      // Reverte em caso de falha
      setPosts(prev => prev.map(p => {
        if (p.id === post.id) {
          return { ...p, hasVoted: prevVoted, votes: prevVotes };
        }
        return p;
      }));
    }
  };

  const handleCreatePost = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      Alert.alert("Aviso", "Por favor, preencha o título e o conteúdo da discussão.");
      return;
    }

    try {
      setIsSubmittingPost(true);
      const res = await api.post('/api/forum/posts', {
        title: newTitle.trim(),
        content: newContent.trim(),
        category: newCategory,
        isAnonymous
      });

      Alert.alert("Sucesso", "Discussão publicada na comunidade!");
      setModalVisible(false);
      setNewTitle('');
      setNewContent('');
      setIsAnonymous(false);

      if (res.data) {
        setPosts(prev => [res.data, ...prev]);
      } else {
        fetchPosts(true);
      }
    } catch (e: any) {
      Alert.alert("Erro", e.response?.data?.error || "Falha ao publicar discussão.");
    } finally {
      setIsSubmittingPost(false);
    }
  };

  const openPostDetails = async (post: any) => {
    setActivePost(post);
    setNewComment('');
    setIsLoadingComments(true);

    try {
      const res = await api.get(`/api/forum/posts/${post.id}/comments?limit=25`);
      const fetched = Array.isArray(res.data) ? res.data : (res.data?.comments || []);
      setComments(fetched);
    } catch (e) {
      console.error("Erro ao carregar comentários:", e);
    } finally {
      setIsLoadingComments(false);
    }
  };

  const handleSendComment = async () => {
    if (!newComment.trim() || !activePost) return;

    try {
      setIsSubmittingComment(true);
      const res = await api.post(`/api/forum/posts/${activePost.id}/comments`, {
        content: newComment.trim(),
        isAnonymous: commentAnonymous
      });

      const created = res.data;
      if (created) {
        setComments(prev => [...prev, created]);
      } else {
        const reload = await api.get(`/api/forum/posts/${activePost.id}/comments?limit=25`);
        setComments(Array.isArray(reload.data) ? reload.data : []);
      }

      setNewComment('');
      // Incrementa contagem de comentários no card principal
      setPosts(prev => prev.map(p => {
        if (p.id === activePost.id) {
          return { ...p, commentsCount: (p.commentsCount || 0) + 1 };
        }
        return p;
      }));
    } catch (e: any) {
      Alert.alert("Erro", e.response?.data?.error || "Falha ao enviar resposta.");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleVoteComment = async (commentId: number) => {
    try {
      setComments(prev => prev.map(c => {
        if (c.id === commentId) {
          const hasVoted = !c.hasVoted;
          return {
            ...c,
            hasVoted,
            likes: hasVoted ? (c.likes || 0) + 1 : Math.max(0, (c.likes || 1) - 1),
          };
        }
        return c;
      }));
      await api.post(`/api/forum/comments/${commentId}/vote`);
    } catch (e) {
      console.error("Erro ao votar no comentário:", e);
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    if (!dateStr) return 'recentemente';
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) return 'há poucos minutos';
    if (diffHours === 1) return 'há 1 hora';
    if (diffHours < 24) return `há ${diffHours} horas`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'ontem';
    return `há ${diffDays} dias`;
  };

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <YeloScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: 90 }}
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
            <Text className="font-title text-[24px] text-white leading-tight flex-1">Fórum Clínico 💬</Text>
          </View>
          <Text className="font-sans text-[14px] text-white/85 mt-1 leading-5">
            Discussão de casos, ética e crescimento profissional com terapeutas verificados.
          </Text>
        </View>

        {/* REGRAS DA COMUNIDADE (Atualizadas conforme commits e3a0e109 e 76635b9c) */}
        <View className="mx-5 mb-5 bg-[#f0fdf4] border border-[#bbf7d0] p-4 rounded-[18px]">
          <View className="flex-row items-center justify-between pb-2.5 mb-2.5 border-b border-[#bbf7d0]/60">
            <View className="flex-row items-center gap-2">
              <Text className="text-[18px]">⚖️</Text>
              <Text className="font-sans font-bold text-[#1B4332] text-[14px]">Diretrizes Éticas</Text>
            </View>
            <View className="bg-[#dcfce7] px-2 py-0.5 rounded-full">
              <Text className="text-[#15803d] text-[10px] font-bold uppercase tracking-wider">Regras</Text>
            </View>
          </View>

          <View className="gap-2">
            <View className="flex-row items-start">
              <Text className="text-[#16a34a] font-black text-[13px] mr-1.5 mt-0.5">•</Text>
              <Text className="flex-1 font-sans text-[#334155] text-[12px] leading-4">
                <Text className="font-bold text-[#1B4332]">Sigilo Absoluto:</Text> Nunca mencione nomes, locais ou dados identificáveis de pacientes.
              </Text>
            </View>
            <View className="flex-row items-start">
              <Text className="text-[#16a34a] font-black text-[13px] mr-1.5 mt-0.5">•</Text>
              <Text className="flex-1 font-sans text-[#334155] text-[12px] leading-4">
                <Text className="font-bold text-[#1B4332]">Ambiente Construtivo:</Text> Troca mútua de conhecimento sem divulgação de plataformas concorrentes.
              </Text>
            </View>
          </View>
        </View>

        {/* CONTROLES: BUSCA, ABAS E CATEGORIAS */}
        <View className="mx-5 mb-5 bg-white border border-[#e5e7eb] rounded-[20px] p-4 shadow-sm">
          
          {/* Campo de Busca */}
          <View className="flex-row items-center bg-[#f9fafb] border border-[#e0e0e0] rounded-full px-4 py-2.5 mb-4">
            <Feather name="search" size={16} color="#888" />
            <TextInput 
              placeholder="Buscar por tema ou palavra-chave..."
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
              className="flex-1 font-sans text-[14px] text-[#333] ml-2.5"
              placeholderTextColor="#999"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => { setSearch(''); fetchPosts(true); }}>
                <Feather name="x" size={16} color="#888" />
              </TouchableOpacity>
            )}
          </View>

          {/* Abas de Ordenação */}
          <View className="flex-row border-b border-[#eee] mb-3">
            {[
              { id: 'recentes', label: 'Recentes' },
              { id: 'populares', label: 'Populares' },
              { id: 'meus_posts', label: 'Meus Posts' }
            ].map((tab: any) => (
              <TouchableOpacity 
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                className={`mr-4 pb-2 border-b-2 ${activeTab === tab.id ? 'border-[#1B4332]' : 'border-transparent'}`}
              >
                <Text className={`font-sans text-[14px] ${activeTab === tab.id ? 'font-bold text-[#1B4332]' : 'font-medium text-[#777]'}`}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Pílulas de Categoria */}
          <YeloScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                className={`mr-2 px-3 py-1.5 rounded-full border ${
                  selectedCategory === cat 
                    ? 'bg-[#1B4332] border-[#1B4332]' 
                    : 'bg-[#f8f9fa] border-[#e0e0e0]'
                }`}
              >
                <Text className={`font-sans text-[12px] font-bold ${
                  selectedCategory === cat ? 'text-[#FFEE8C]' : 'text-[#555]'
                }`}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </YeloScrollView>

          {/* Botão Criar Discussão */}
          <TouchableOpacity 
            onPress={() => setModalVisible(true)}
            className="flex-row items-center bg-[#f8f9fa] border border-[#e0e0e0] rounded-full p-2.5 mt-4"
          >
            <View className="w-8 h-8 rounded-full bg-[#1B4332] items-center justify-center mr-2.5">
              <Text className="text-white font-bold text-[12px]">
                {user?.nome ? user.nome.charAt(0).toUpperCase() : '+'}
              </Text>
            </View>
            <Text className="font-sans text-[#777] text-[13px] flex-1">
              Compartilhe um caso ou reflexão clínica...
            </Text>
            <Feather name="edit-3" size={16} color="#1B4332" />
          </TouchableOpacity>
        </View>

        {/* FEED DE POSTS REAIS */}
        <View className="mx-5">
          {isLoading ? (
            <View className="py-12 items-center">
              <ActivityIndicator color="#1B4332" />
            </View>
          ) : posts.length === 0 ? (
            <View className="bg-white rounded-[20px] p-8 items-center border border-[#e5e7eb]">
              <Feather name="message-circle" size={40} color="#ccc" />
              <Text className="font-title text-[#333] text-[18px] mt-3 mb-1 text-center">Nenhum tópico encontrado</Text>
              <Text className="font-sans text-[#777] text-[13px] text-center mb-4">
                Seja o primeiro a iniciar uma discussão sobre este tema.
              </Text>
              <TouchableOpacity 
                onPress={() => setModalVisible(true)}
                className="bg-[#1B4332] py-2.5 px-6 rounded-full"
              >
                <Text className="text-white font-bold font-sans text-[13px]">Criar Nova Discussão</Text>
              </TouchableOpacity>
            </View>
          ) : (
            posts.map((post) => {
              const isVoted = !!post.hasVoted;
              const authorName = post.isAnonymous 
                ? 'Colega Anônimo' 
                : (post.psychologist?.nome || post.author || 'Psicólogo(a)');
              const avatarUrl = post.isAnonymous 
                ? null 
                : (post.psychologist?.fotoUrl || post.avatar);

              return (
                <View 
                  key={post.id} 
                  className="bg-white border border-[#e5e7eb] rounded-[18px] p-4 mb-3.5 shadow-sm"
                >
                  {/* Header do Post */}
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center flex-1 mr-2">
                      {avatarUrl ? (
                        <Image source={{ uri: avatarUrl }} className="w-6 h-6 rounded-full mr-2" />
                      ) : (
                        <View className="w-6 h-6 rounded-full bg-[#e8f5e9] items-center justify-center mr-2">
                          <Text className="text-[#1B4332] text-[10px] font-bold">
                            {authorName.charAt(0)}
                          </Text>
                        </View>
                      )}
                      <Text className="font-sans font-bold text-[#1B4332] text-[12px]" numberOfLines={1}>
                        {post.category || 'Geral'}
                      </Text>
                      <Text className="font-sans text-[#888] text-[11px] mx-1.5">•</Text>
                      <Text className={`font-sans text-[11px] flex-shrink ${post.isAnonymous ? 'italic text-[#777]' : 'text-[#444]'}`} numberOfLines={1}>
                        {authorName}
                      </Text>
                    </View>
                    <Text className="font-sans text-[#999] text-[11px]">
                      {formatTimeAgo(post.createdAt || post.time)}
                    </Text>
                  </View>

                  {/* Título & Conteúdo */}
                  <TouchableOpacity activeOpacity={0.8} onPress={() => openPostDetails(post)}>
                    <Text className="font-title text-[#222] text-[17px] mb-1.5 leading-snug">
                      {post.title}
                    </Text>
                    <Text className="font-sans text-[#555] text-[14px] leading-5 mb-3" numberOfLines={3}>
                      {post.content || post.snippet}
                    </Text>
                  </TouchableOpacity>

                  {/* Ações (Votos e Comentários com feedback neutro vs vermelho commit e3a0e109) */}
                  <View className="flex-row items-center justify-between border-t border-[#f0f0f0] pt-2.5">
                    <View className="flex-row items-center gap-2.5">
                      
                      {/* Botão Curtir / Votar */}
                      <TouchableOpacity 
                        onPress={() => handleVotePost(post)}
                        className={`flex-row items-center px-3 py-1.5 rounded-full border ${
                          isVoted 
                            ? 'bg-[#fef2f2] border-[#fca5a5]' 
                            : 'bg-[#f9fafb] border-[#e5e7eb]'
                        }`}
                      >
                        <Feather 
                          name="heart" 
                          size={14} 
                          color={isVoted ? "#E63946" : "#666"} 
                        />
                        <Text className={`font-sans text-[12px] font-bold ml-1.5 ${
                          isVoted ? 'text-[#E63946]' : 'text-[#444]'
                        }`}>
                          {post.votes || 0}
                        </Text>
                      </TouchableOpacity>

                      {/* Botão Ver Comentários */}
                      <TouchableOpacity 
                        onPress={() => openPostDetails(post)}
                        className="flex-row items-center bg-[#f9fafb] border border-[#e5e7eb] px-3 py-1.5 rounded-full"
                      >
                        <Feather name="message-square" size={14} color="#555" />
                        <Text className="font-sans font-bold text-[#555] text-[12px] ml-1.5">
                          {post.commentsCount ?? post.comments ?? 0}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity onPress={() => openPostDetails(post)}>
                      <Text className="font-sans font-bold text-[#1B4332] text-[12px]">
                        Ver discussão →
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}

          {/* Botão Carregar Mais */}
          {posts.length > 0 && hasMore && (
            <TouchableOpacity 
              onPress={() => fetchPosts(false)}
              disabled={isLoadingMore}
              className="bg-transparent border border-[#ccc] py-2.5 rounded-full my-4 items-center justify-center flex-row"
            >
              {isLoadingMore ? (
                <ActivityIndicator size="small" color="#1B4332" />
              ) : (
                <Text className="font-sans font-bold text-[#666] text-[13px]">Carregar mais tópicos</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

      </YeloScrollView>

      {/* MODAL: CRIAR NOVA DISCUSSÃO */}
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
            <Text className="font-title text-[#1B4332] text-[18px]">Nova Discussão</Text>
            <View style={{ width: 32 }} />
          </View>

          <YeloScrollView className="flex-1 p-5">
            <Text className="font-sans font-bold text-[#444] text-[12px] uppercase mb-1">Título</Text>
            <TextInput 
              placeholder="Ex: Como lidar com resistência ao diagnóstico de TDAH?"
              value={newTitle}
              onChangeText={setNewTitle}
              maxLength={150}
              className="bg-[#f8f9fa] border border-[#e0e0e0] rounded-[12px] px-4 py-3 font-sans text-[15px] text-[#333] mb-4"
            />

            <Text className="font-sans font-bold text-[#444] text-[12px] uppercase mb-1">Categoria</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {CATEGORIES.filter(c => c !== 'Todas').map(cat => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setNewCategory(cat)}
                  className={`px-3 py-1.5 rounded-full border ${
                    newCategory === cat ? 'bg-[#1B4332] border-[#1B4332]' : 'bg-[#f8f9fa] border-[#e0e0e0]'
                  }`}
                >
                  <Text className={`font-sans text-[12px] ${newCategory === cat ? 'text-[#FFEE8C] font-bold' : 'text-[#555]'}`}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="font-sans font-bold text-[#444] text-[12px] uppercase mb-1">Conteúdo da Discussão</Text>
            <TextInput 
              multiline
              numberOfLines={6}
              placeholder="Compartilhe seu relato clínico ou dúvida respeitando o sigilo..."
              value={newContent}
              onChangeText={setNewContent}
              className="bg-[#f8f9fa] border border-[#e0e0e0] rounded-[14px] p-4 font-sans text-[14px] text-[#333] mb-4"
              style={{ minHeight: 120, textAlignVertical: 'top' }}
            />

            {/* Checkbox Anônimo */}
            <TouchableOpacity 
              onPress={() => setIsAnonymous(!isAnonymous)}
              className="flex-row items-center gap-2 mb-6"
            >
              <View className={`w-5 h-5 rounded-[6px] border items-center justify-center ${
                isAnonymous ? 'bg-[#1B4332] border-[#1B4332]' : 'border-[#ccc]'
              }`}>
                {isAnonymous && <Feather name="check" size={12} color="white" />}
              </View>
              <Text className="font-sans text-[#444] text-[13px]">
                Publicar anonimamente (seu nome e CRP não serão exibidos)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleCreatePost}
              disabled={isSubmittingPost}
              className="bg-[#1B4332] py-3.5 rounded-full items-center justify-center shadow-sm"
            >
              {isSubmittingPost ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="font-sans font-bold text-white text-[15px]">Publicar no Fórum</Text>
              )}
            </TouchableOpacity>
          </YeloScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL: DETALHES DO POST E COMENTÁRIOS */}
      <Modal
        visible={!!activePost}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActivePost(null)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-[#f9fafb]">
          {/* Header */}
          <View className="p-4 bg-white border-b border-[#f0f0f0] flex-row items-center justify-between">
            <TouchableOpacity onPress={() => setActivePost(null)} className="w-8 h-8 rounded-full bg-[#f0f0f0] items-center justify-center">
              <Feather name="x" size={16} color="#666" />
            </TouchableOpacity>
            <Text className="font-title text-[#1B4332] text-[17px]">Discussão Clínica</Text>
            <View style={{ width: 32 }} />
          </View>

          <YeloScrollView className="flex-1 p-4">
            {activePost && (
              <View className="bg-white rounded-[20px] p-5 mb-4 border border-[#e5e7eb] shadow-sm">
                <View className="flex-row items-center mb-2">
                  <View className="bg-[#e8f5e9] px-2.5 py-1 rounded-full mr-2">
                    <Text className="font-sans font-bold text-[#166534] text-[11px]">{activePost.category || 'Geral'}</Text>
                  </View>
                  <Text className="font-sans text-[#888] text-[11px]">{formatTimeAgo(activePost.createdAt)}</Text>
                </View>

                <Text className="font-title text-[#222] text-[20px] mb-2 leading-tight">{activePost.title}</Text>
                <Text className="font-sans text-[#444] text-[15px] leading-6 mb-4">{activePost.content}</Text>

                <View className="flex-row items-center justify-between border-t border-[#f0f0f0] pt-3">
                  <TouchableOpacity 
                    onPress={() => handleVotePost(activePost)}
                    className={`flex-row items-center px-3.5 py-1.5 rounded-full border ${
                      activePost.hasVoted ? 'bg-[#fef2f2] border-[#fca5a5]' : 'bg-[#f9fafb] border-[#e5e7eb]'
                    }`}
                  >
                    <Feather name="heart" size={14} color={activePost.hasVoted ? "#E63946" : "#666"} />
                    <Text className={`font-sans font-bold text-[13px] ml-1.5 ${
                      activePost.hasVoted ? 'text-[#E63946]' : 'text-[#444]'
                    }`}>
                      {activePost.votes || 0} apoios
                    </Text>
                  </TouchableOpacity>

                  <Text className="font-sans text-[#888] text-[12px]">
                    {comments.length} {comments.length === 1 ? 'comentário' : 'comentários'}
                  </Text>
                </View>
              </View>
            )}

            {/* Lista de Comentários */}
            <Text className="font-title text-[#1B4332] text-[18px] mb-3 ml-1">Respostas dos Colegas</Text>

            {isLoadingComments ? (
              <View className="py-8 items-center"><ActivityIndicator color="#1B4332" /></View>
            ) : comments.length === 0 ? (
              <View className="bg-white rounded-[16px] p-6 items-center border border-[#e5e7eb] mb-4">
                <Text className="font-sans text-[#888] text-[13px] text-center">
                  Nenhuma resposta ainda. Seja o primeiro a contribuir com sua experiência clínica!
                </Text>
              </View>
            ) : (
              comments.map((comment) => (
                <View key={comment.id} className="bg-white rounded-[16px] p-4 mb-3 border border-[#f0f0f0] shadow-sm">
                  <View className="flex-row items-center justify-between mb-1.5">
                    <Text className="font-sans font-bold text-[#333] text-[13px]">
                      {comment.isAnonymous ? 'Colega Anônimo' : (comment.psychologist?.nome || 'Psicólogo(a)')}
                    </Text>
                    <Text className="font-sans text-[#999] text-[11px]">{formatTimeAgo(comment.createdAt)}</Text>
                  </View>
                  <Text className="font-sans text-[#444] text-[14px] leading-5 mb-2.5">
                    {comment.content}
                  </Text>

                  <TouchableOpacity 
                    onPress={() => handleVoteComment(comment.id)}
                    className="self-start flex-row items-center gap-1.5 py-1 px-2.5 rounded-full bg-[#f8f9fa] border border-[#eee]"
                  >
                    <Feather name="heart" size={12} color={comment.hasVoted ? "#E63946" : "#888"} />
                    <Text className="font-sans text-[11px] font-bold text-[#666]">
                      {comment.likes || 0}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </YeloScrollView>

          {/* Barra Fixa para Envio de Comentário */}
          <View className="bg-white border-t border-[#f0f0f0] p-3">
            <View className="flex-row items-center bg-[#f8f9fa] border border-[#e0e0e0] rounded-full px-4 py-2">
              <TextInput 
                placeholder="Escreva uma resposta construtiva..."
                value={newComment}
                onChangeText={setNewComment}
                className="flex-1 font-sans text-[14px] text-[#333]"
              />
              <TouchableOpacity 
                onPress={handleSendComment}
                disabled={isSubmittingComment || !newComment.trim()}
                className="w-8 h-8 rounded-full bg-[#1B4332] items-center justify-center ml-2"
              >
                {isSubmittingComment ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Feather name="arrow-up" size={16} color="white" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}
