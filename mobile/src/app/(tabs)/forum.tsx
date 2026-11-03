import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  RefreshControl,
  Pressable,
  ScrollView,
  StyleSheet
} from 'react-native';
import YeloScrollView from '../../components/YeloScrollView';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api, { getBaseUrl } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

// Categorias oficiais da Comunidade Clínica Yelo (conforme versão Web Mobile)
const FORUM_CATEGORIES = [
  'Todas as Categorias',
  'Discussão de Casos (Intervisão)',
  'Burocracia e Legislação (CRP/CFP)',
  'Indicações e Encaminhamentos',
  'Ferramentas e Referências',
  'Marketing e Carreira',
  'Sala de Café (Off-topic)',
];

export default function ForumScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // Estados de Filtro e Busca
  const [activeTab, setActiveTab] = useState<'recentes' | 'populares' | 'meus_posts'>('recentes');
  const [selectedCategory, setSelectedCategory] = useState('Todas as Categorias');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showRules, setShowRules] = useState(true);

  // Estados da Listagem de Discussões
  const [posts, setPosts] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Modal Nova Discussão
  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('Discussão de Casos (Intervisão)');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);

  // Modal Detalhes da Discussão & Comentários
  const [activePost, setActivePost] = useState<any | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentAnonymous, setCommentAnonymous] = useState(false);

  // Helper para resolver URL da imagem
  const resolveImageUrl = (path?: string | null) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    const base = getBaseUrl();
    const clean = path.startsWith('/') ? path : `/${path}`;
    return `${base}${clean}`;
  };

  // Helper para tempo decorrido no padrão da web (ex: "há 7 meses", "há 2 horas")
  const formatTimeAgo = (dateStr?: string) => {
    if (!dateStr) return 'recentemente';
    try {
      const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
      if (seconds < 60) return 'poucos segundos';
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes} min`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
      const days = Math.floor(hours / 24);
      if (days < 30) return `${days} ${days === 1 ? 'dia' : 'dias'}`;
      const months = Math.floor(days / 30);
      if (months < 12) return `${months} ${months === 1 ? 'mês' : 'meses'}`;
      const years = Math.floor(days / 365);
      return `${years} ${years === 1 ? 'ano' : 'anos'}`;
    } catch {
      return 'recentemente';
    }
  };

  // Cores das Tags de Categoria conforme o CSS oficial da web
  const getCategoryStyle = (category?: string) => {
    const c = (category || '').toLowerCase();
    if (c.includes('intervisão') || c.includes('casos')) {
      return { bg: '#F3E8FF', text: '#7E22CE', border: '#E9D5FF' };
    }
    if (c.includes('burocracia') || c.includes('legislação') || c.includes('crp')) {
      return { bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' };
    }
    if (c.includes('indicações') || c.includes('encaminhamentos')) {
      return { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0' };
    }
    if (c.includes('ferramentas') || c.includes('referências')) {
      return { bg: '#E0F2FE', text: '#0369A1', border: '#BAE6FD' };
    }
    if (c.includes('marketing') || c.includes('carreira')) {
      return { bg: '#FFE4E6', text: '#BE123C', border: '#FECDD3' };
    }
    if (c.includes('café') || c.includes('off-topic')) {
      return { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' };
    }
    return { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' };
  };

  // Badges inline do autor (Autêntico, Semeador, Voz Ativa, Pioneiro)
  const renderAuthorBadges = (badges: any) => {
    let data = badges;
    if (typeof badges === 'string') {
      try { data = JSON.parse(badges); } catch { data = {}; }
    }
    if (!data || typeof data !== 'object') return null;

    const list: React.ReactNode[] = [];
    if (data.autentico || data.verified) {
      list.push(
        <View key="autentico" style={{ marginLeft: 3, marginRight: 2 }}>
          <Feather name="check-circle" size={11} color="#15803d" />
        </View>
      );
    }
    if (data.semeador) {
      list.push(
        <Text key="semeador" style={{ fontSize: 10, marginLeft: 2 }}>🌱</Text>
      );
    }
    if (data.voz_ativa) {
      list.push(
        <Text key="voz_ativa" style={{ fontSize: 10, marginLeft: 2 }}>💬</Text>
      );
    }
    if (data.pioneiro) {
      list.push(
        <Text key="pioneiro" style={{ fontSize: 10, marginLeft: 2 }}>🏅</Text>
      );
    }
    return list.length > 0 ? <View style={{ flexDirection: 'row', alignItems: 'center' }}>{list}</View> : null;
  };

  // Carregar Discussões da API
  const fetchPosts = async (resetPage = false) => {
    try {
      const currentPage = resetPage ? 1 : page;
      if (resetPage) setIsLoading(true);

      const params = new URLSearchParams();
      params.append('filter', activeTab);
      if (selectedCategory && selectedCategory !== 'Todas as Categorias') {
        params.append('category', selectedCategory);
      }
      if (search.trim()) {
        params.append('search', search.trim());
      }
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
      console.error("Erro ao buscar discussões do fórum:", e);
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

  // Voto / Apoio otimista na Discussão
  const handleVotePost = async (post: any) => {
    const prevVoted = !!post.supportedByMe;
    const prevVotes = post.votes || 0;

    setPosts(prev => prev.map(p => {
      if (p.id === post.id) {
        return {
          ...p,
          supportedByMe: !prevVoted,
          votes: prevVoted ? Math.max(0, prevVotes - 1) : prevVotes + 1,
        };
      }
      return p;
    }));

    if (activePost && activePost.id === post.id) {
      setActivePost((prev: any) => ({
        ...prev,
        supportedByMe: !prevVoted,
        votes: prevVoted ? Math.max(0, prevVotes - 1) : prevVotes + 1,
      }));
    }

    try {
      await api.post(`/api/forum/posts/${post.id}/vote`);
    } catch (e) {
      // Reverter se falhar
      setPosts(prev => prev.map(p => {
        if (p.id === post.id) {
          return { ...p, supportedByMe: prevVoted, votes: prevVotes };
        }
        return p;
      }));
    }
  };

  // Exclusão de Discussão
  const handleDeletePost = (post: any) => {
    Alert.alert(
      'Excluir Discussão',
      'Tem certeza de que deseja remover esta discussão da comunidade?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/forum/posts/${post.id}`);
              setPosts(prev => prev.filter(p => p.id !== post.id));
              Alert.alert('Sucesso', 'Discussão excluída.');
            } catch (err: any) {
              Alert.alert('Erro', err.response?.data?.error || 'Não foi possível excluir.');
            }
          }
        }
      ]
    );
  };

  // Denúncia de Discussão
  const handleReportPost = (post: any) => {
    Alert.alert(
      'Denunciar Discussão',
      'Deseja enviar esta discussão para análise da moderação da Yelo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Denunciar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post('/api/forum/report', {
                targetType: 'post',
                targetId: post.id,
                reason: 'Violação das diretrizes éticas da comunidade'
              });
              Alert.alert('Obrigado', 'Denúncia enviada com sucesso para a moderação.');
            } catch (err: any) {
              Alert.alert('Aviso', 'Denúncia já registrada ou erro ao enviar.');
            }
          }
        }
      ]
    );
  };

  // Criar Nova Discussão
  const handleCreatePost = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      Alert.alert("Aviso", "Por favor, preencha o título e o relato da discussão.");
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

  // Abrir Detalhes do Post & Carregar Respostas
  const openPostDetails = async (post: any) => {
    setActivePost(post);
    setNewComment('');
    setIsLoadingComments(true);

    try {
      const res = await api.get(`/api/forum/posts/${post.id}/comments?limit=25`);
      const fetched = Array.isArray(res.data) ? res.data : (res.data?.comments || []);
      setComments(fetched);
    } catch (e) {
      console.error("Erro ao carregar respostas:", e);
    } finally {
      setIsLoadingComments(false);
    }
  };

  // Enviar Resposta / Comentário
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
      // Atualiza o contador de comentários no feed
      setPosts(prev => prev.map(p => {
        if (p.id === activePost.id) {
          return { ...p, commentCount: (p.commentCount || 0) + 1 };
        }
        return p;
      }));
    } catch (e: any) {
      Alert.alert("Erro", e.response?.data?.error || "Falha ao enviar resposta.");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Votar em Comentário
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

  // Excluir Comentário
  const handleDeleteComment = (commentId: number) => {
    Alert.alert(
      'Excluir Resposta',
      'Deseja remover esta resposta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/forum/comments/${commentId}`);
              setComments(prev => prev.filter(c => c.id !== commentId));
            } catch (err: any) {
              Alert.alert('Erro', 'Não foi possível excluir a resposta.');
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* BARRA SUPERIOR SLIM DE NAVEGAÇÃO */}
      <View style={styles.topNavRow}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.btnVoltar}
          activeOpacity={0.75}
        >
          <Feather name="arrow-left" size={15} color="#1B4332" />
          <Text style={styles.btnVoltarText}>Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.topNavTitle}>Fórum da Comunidade</Text>
        <View style={{ width: 68 }} />
      </View>

      <YeloScrollView 
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: 130 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1B4332']} />
        }
      >
        {/* ======================================================== */}
        {/* 1. CARD DE REGRAS E BOAS PRÁTICAS DA COMUNIDADE */}
        {/* ======================================================== */}
        <View style={styles.guidelinesBox}>
          {/* Header das Regras */}
          <View style={styles.guidelinesHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 }}>
              <Text style={{ fontSize: 17 }}>🛡️</Text>
              <Text style={styles.guidelinesTitle} numberOfLines={1}>
                Regras e Boas Práticas da Comunidade
              </Text>
            </View>

            <View style={styles.guidelinesBadge}>
              <Text style={styles.guidelinesBadgeText}>ESPAÇO ÉTICO</Text>
            </View>

            <TouchableOpacity 
              onPress={() => setShowRules(prev => !prev)}
              style={styles.guidelinesToggleBtn}
              activeOpacity={0.7}
            >
              <Feather 
                name={showRules ? "minus-circle" : "plus-circle"} 
                size={18} 
                color="#166534" 
              />
            </TouchableOpacity>
          </View>

          {/* Lista das 5 Regras Oficiais */}
          {showRules && (
            <View style={styles.guidelinesList}>
              <View style={styles.guidelineItem}>
                <Text style={styles.guidelineDot}>•</Text>
                <Text style={styles.guidelineText}>
                  <Text style={styles.guidelineBold}>Respeito acima de tudo: </Text>
                  Debates são bem-vindos; ataques pessoais, ofensas e desrespeito não serão tolerados.
                </Text>
              </View>

              <View style={styles.guidelineItem}>
                <Text style={styles.guidelineDot}>•</Text>
                <Text style={styles.guidelineText}>
                  <Text style={styles.guidelineBold}>Sigilo profissional é inegociável: </Text>
                  Ao discutir casos clínicos, sempre anonimize completamente qualquer dado que possa identificar um paciente.
                </Text>
              </View>

              <View style={styles.guidelineItem}>
                <Text style={styles.guidelineDot}>•</Text>
                <Text style={styles.guidelineText}>
                  <Text style={styles.guidelineBold}>Conteúdo construtivo: </Text>
                  Evite autopromoção direta e spam. O foco é a troca mútua de conhecimento técnico e suporte profissional.
                </Text>
              </View>

              <View style={styles.guidelineItem}>
                <Text style={styles.guidelineDot}>•</Text>
                <Text style={styles.guidelineText}>
                  <Text style={styles.guidelineBold}>Sem divulgação de concorrentes: </Text>
                  É expressamente proibida a promoção, divulgação, compartilhamento de links ou recomendação de plataformas, softwares e ferramentas concorrentes à Yelo.
                </Text>
              </View>

              <View style={styles.guidelineItem}>
                <Text style={styles.guidelineDot}>•</Text>
                <Text style={styles.guidelineText}>
                  <Text style={styles.guidelineBold}>Direitos Humanos: </Text>
                  Discursos de ódio, discriminação de qualquer natureza ou violações éticas resultarão em remoção imediata e banimento.
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ======================================================== */}
        {/* 2. CÁPSULA RÁPIDA DE CRIAR DISCUSSÃO (COMPOSER BAR) */}
        {/* ======================================================== */}
        <TouchableOpacity 
          onPress={() => setModalVisible(true)}
          style={styles.composerCapsule}
          activeOpacity={0.85}
        >
          {user?.fotoUrl ? (
            <Image 
              source={{ uri: resolveImageUrl(user.fotoUrl) || '' }} 
              style={styles.composerAvatar} 
              resizeMode="cover"
            />
          ) : (
            <View style={styles.composerAvatarFallback}>
              <Text style={styles.composerAvatarFallbackText}>
                {user?.nome ? user.nome.charAt(0).toUpperCase() : 'P'}
              </Text>
            </View>
          )}
          <Text style={styles.composerPromptText} numberOfLines={1}>
            Compartilhe um caso, dúvida ...
          </Text>
        </TouchableOpacity>

        {/* ======================================================== */}
        {/* 3. CARD UNIFICADO DE FILTROS: BUSCA, CATEGORIAS E TABS */}
        {/* ======================================================== */}
        <View style={styles.filterDockCard}>
          {/* Campo de Busca com Lupa */}
          <View style={styles.searchPill}>
            <Feather name="search" size={16} color="#94a3b8" />
            <TextInput 
              placeholder="Buscar por tema, palavra ou sintoma"
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
              placeholderTextColor="#94a3b8"
              style={styles.searchInput}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => { setSearch(''); fetchPosts(true); }}>
                <Feather name="x" size={16} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Seletor Dropdown de Categorias */}
          <TouchableOpacity 
            onPress={() => setIsCategoryModalOpen(true)}
            style={styles.categoryDropdownBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.categoryDropdownText} numberOfLines={1}>
              {selectedCategory}
            </Text>
            <Feather name="chevron-down" size={16} color="#64748b" />
          </TouchableOpacity>

          {/* Segmented Control das 3 Abas: Recentes / Populares / Meus Posts */}
          <View style={styles.segmentedControl}>
            <TouchableOpacity
              onPress={() => setActiveTab('recentes')}
              style={[
                styles.segmentItem,
                activeTab === 'recentes' && styles.segmentItemActive
              ]}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.segmentItemText,
                activeTab === 'recentes' && styles.segmentItemTextActive
              ]}>
                ⚡ Recentes
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('populares')}
              style={[
                styles.segmentItem,
                activeTab === 'populares' && styles.segmentItemActive
              ]}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.segmentItemText,
                activeTab === 'populares' && styles.segmentItemTextActive
              ]}>
                🔥 Populares
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('meus_posts')}
              style={[
                styles.segmentItem,
                activeTab === 'meus_posts' && styles.segmentItemActive
              ]}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.segmentItemText,
                activeTab === 'meus_posts' && styles.segmentItemTextActive
              ]}>
                👤 Meus Posts
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ======================================================== */}
        {/* 4. FEED DE CARDS DE DISCUSSÕES */}
        {/* ======================================================== */}
        <View style={{ paddingHorizontal: 20 }}>
          {isLoading ? (
            <View style={styles.loaderBox}>
              <ActivityIndicator color="#1B4332" size="large" />
              <Text style={styles.loaderText}>Carregando discussões da comunidade...</Text>
            </View>
          ) : posts.length === 0 ? (
            <View style={styles.emptyBox}>
              <Feather name="message-circle" size={42} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>Nenhuma discussão encontrada</Text>
              <Text style={styles.emptySubtitle}>
                Seja o primeiro a iniciar uma conversa com os colegas sobre este tema!
              </Text>
              <TouchableOpacity 
                onPress={() => setModalVisible(true)}
                style={styles.btnEmptyCreate}
                activeOpacity={0.85}
              >
                <Text style={styles.btnEmptyCreateText}>Criar Nova Discussão</Text>
              </TouchableOpacity>
            </View>
          ) : (
            posts.map((post) => {
              const isVoted = !!post.supportedByMe;
              const authorName = post.isAnonymous ? 'Anônimo' : (post.authorName || 'Psicólogo(a)');
              const authorPhoto = post.isAnonymous ? null : (post.authorPhoto || post.psychologist?.fotoUrl);
              const catStyle = getCategoryStyle(post.category);
              const commentCount = post.commentCount ?? post.commentsCount ?? 0;

              return (
                <View 
                  key={post.id} 
                  style={[
                    styles.postCard,
                    post.isPinned && styles.postCardPinned
                  ]}
                >
                  {/* Badge Fixado */}
                  {post.isPinned && (
                    <View style={styles.pinnedBadge}>
                      <Text style={styles.pinnedBadgeText}>📌 Fixado</Text>
                    </View>
                  )}

                  {/* Header do Autor: Foto + Categoria + Nome e Badges */}
                  <View style={styles.postAuthorRow}>
                    {/* Foto Circular do Autor */}
                    {authorPhoto ? (
                      <Image 
                        source={{ uri: resolveImageUrl(authorPhoto) || '' }} 
                        style={styles.postAuthorAvatar} 
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.postAuthorAvatarFallback}>
                        <Text style={styles.postAuthorAvatarFallbackText}>
                          {authorName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}

                    {/* Metadados: Categoria, Nome e Horário */}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      {/* Pílula de Categoria */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <View style={[
                          styles.categoryPill,
                          { backgroundColor: catStyle.bg, borderColor: catStyle.border }
                        ]}>
                          <Text style={[styles.categoryPillText, { color: catStyle.text }]} numberOfLines={1}>
                            {post.category || 'Geral'}
                          </Text>
                        </View>
                      </View>

                      {/* Nome, Badges e Tempo Decorrido */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                        <Text style={styles.authorNameText} numberOfLines={1}>
                          por <Text style={{ fontWeight: 'bold' }}>{authorName}</Text>
                        </Text>
                        {renderAuthorBadges(post.authorBadges)}
                        <Text style={styles.postTimeText}>
                          {' '}• há {formatTimeAgo(post.createdAt)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Título & Conteúdo Snippet */}
                  <TouchableOpacity 
                    activeOpacity={0.8} 
                    onPress={() => openPostDetails(post)}
                  >
                    <Text style={styles.postTitleText}>
                      {post.title}
                    </Text>
                    <Text style={styles.postSnippetText} numberOfLines={2}>
                      {post.content}
                    </Text>
                  </TouchableOpacity>

                  {/* Barra de Ações do Rodapé (Apoiar, Respostas, Editar, Excluir, Denunciar) */}
                  <View style={styles.postActionsFooter}>
                    {/* Botões da Esquerda (Apoio e Comentários) */}
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {/* Botão Apoiar (Coração) */}
                      <TouchableOpacity 
                        onPress={() => handleVotePost(post)}
                        style={[
                          styles.actionPillBtn,
                          isVoted && styles.actionPillBtnVoted
                        ]}
                        activeOpacity={0.7}
                      >
                        <Feather 
                          name="heart" 
                          size={14} 
                          color={isVoted ? "#e11d48" : "#64748b"} 
                        />
                        <Text style={[
                          styles.actionPillCount,
                          isVoted && { color: '#e11d48' }
                        ]}>
                          {post.votes || 0}
                        </Text>
                      </TouchableOpacity>

                      {/* Botão Respostas */}
                      <TouchableOpacity 
                        onPress={() => openPostDetails(post)}
                        style={[styles.actionPillBtn, { marginLeft: 8 }]}
                        activeOpacity={0.7}
                      >
                        <Feather name="message-square" size={13} color="#64748b" />
                        <Text style={styles.actionPillText}>
                          {commentCount} {commentCount === 1 ? 'comentário' : 'comentários'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Ações da Direita (Editar / Excluir se for o autor, e Denunciar) */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {post.isMine && (
                        <TouchableOpacity 
                          onPress={() => handleDeletePost(post)}
                          style={styles.postSmallActionBtn}
                          activeOpacity={0.7}
                        >
                          <Feather name="trash-2" size={14} color="#dc2626" />
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity 
                        onPress={() => handleReportPost(post)}
                        style={styles.postSmallActionBtn}
                        activeOpacity={0.7}
                      >
                        <Feather name="flag" size={13} color="#94a3b8" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })
          )}

          {/* Botão Mostrar Mais */}
          {posts.length > 0 && hasMore && (
            <TouchableOpacity 
              onPress={() => fetchPosts(false)}
              disabled={isLoadingMore}
              style={styles.btnLoadMore}
              activeOpacity={0.8}
            >
              {isLoadingMore ? (
                <ActivityIndicator size="small" color="#1B4332" />
              ) : (
                <Text style={styles.btnLoadMoreText}>Mostrar mais</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </YeloScrollView>

      {/* ======================================================== */}
      {/* 5. BOTÃO FLUTUANTE DE CRIAR POST (FAB VERDE NO CANTO) */}
      {/* ======================================================== */}
      <TouchableOpacity 
        onPress={() => setModalVisible(true)}
        style={styles.fabButton}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={24} color="#ffffff" />
      </TouchableOpacity>

      {/* ======================================================== */}
      {/* MODAL BOTTOM SHEET: SELETOR DE CATEGORIAS */}
      {/* ======================================================== */}
      <Modal
        visible={isCategoryModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsCategoryModalOpen(false)}
      >
        <Pressable 
          style={styles.modalBackdrop}
          onPress={() => setIsCategoryModalOpen(false)}
        >
          <Pressable 
            style={styles.categoryBottomSheetCard}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetDragHandle} />
            <View style={styles.categoryModalHeader}>
              <Text style={styles.categoryModalTitle}>Filtrar por Categoria</Text>
              <TouchableOpacity 
                onPress={() => setIsCategoryModalOpen(false)}
                style={styles.modalCloseBtn}
              >
                <Feather name="x" size={16} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
              {FORUM_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat;
                const catStyle = getCategoryStyle(cat);
                return (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => {
                      setSelectedCategory(cat);
                      setIsCategoryModalOpen(false);
                    }}
                    style={[
                      styles.categoryOptionItem,
                      isSelected && styles.categoryOptionItemActive
                    ]}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                      {cat !== 'Todas as Categorias' && (
                        <View style={[
                          styles.categoryPillDot, 
                          { backgroundColor: catStyle.text }
                        ]} />
                      )}
                      <Text style={[
                        styles.categoryOptionText,
                        isSelected && styles.categoryOptionTextActive
                      ]}>
                        {cat}
                      </Text>
                    </View>
                    {isSelected && (
                      <Feather name="check" size={18} color="#1B4332" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL: NOVA DISCUSSÃO (BOTTOM SHEET YELO) */}
      {/* ======================================================== */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <Pressable 
            style={StyleSheet.absoluteFill} 
            onPress={() => setModalVisible(false)} 
          />
          <View style={styles.createModalCard}>
            <View style={styles.sheetDragHandle} />
            
            {/* Header Modal Criar */}
            <View style={styles.createModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={styles.createModalIconBox}>
                  <Text style={{ fontSize: 18 }}>💬</Text>
                </View>
                <View>
                  <Text style={styles.createModalTitle}>Nova Discussão</Text>
                  <Text style={styles.createModalSubtitle}>
                    Troque conhecimentos respeitando o sigilo ético.
                  </Text>
                </View>
              </View>

              <TouchableOpacity 
                onPress={() => setModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Feather name="x" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 420 }}
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 }}
            >
              {/* Campo: Título */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>TÍTULO DA DISCUSSÃO *</Text>
                <TextInput 
                  placeholder="Ex: Como conduzir impasse terapêutico em caso de ansiedade?"
                  placeholderTextColor="#94a3b8"
                  value={newTitle}
                  onChangeText={setNewTitle}
                  maxLength={150}
                  style={styles.formInput}
                />
              </View>

              {/* Campo: Categoria */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>CATEGORIA *</Text>
                <View style={styles.categoryChipsGrid}>
                  {FORUM_CATEGORIES.filter(c => c !== 'Todas as Categorias').map((cat) => {
                    const isSelected = newCategory === cat;
                    const catStyle = getCategoryStyle(cat);
                    return (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => setNewCategory(cat)}
                        style={[
                          styles.categoryChipBtn,
                          isSelected 
                            ? { backgroundColor: '#1B4332', borderColor: '#1B4332' } 
                            : { backgroundColor: catStyle.bg, borderColor: catStyle.border }
                        ]}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.categoryChipBtnText,
                          isSelected ? { color: '#ffffff', fontWeight: 'bold' } : { color: catStyle.text }
                        ]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Campo: Relato / Conteúdo */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>RELATO CLÍNICO / DÚVIDA *</Text>
                <TextInput 
                  multiline
                  numberOfLines={5}
                  placeholder="Descreva a demanda, contexto e o ponto em que você busca apoio técnico dos colegas..."
                  placeholderTextColor="#94a3b8"
                  value={newContent}
                  onChangeText={setNewContent}
                  style={styles.formTextArea}
                />
              </View>

              {/* Checkbox: Publicar Anonimamente */}
              <TouchableOpacity 
                onPress={() => setIsAnonymous(!isAnonymous)}
                style={styles.anonymousCheckboxRow}
                activeOpacity={0.8}
              >
                <View style={[
                  styles.checkboxSquare,
                  isAnonymous && styles.checkboxSquareChecked
                ]}>
                  {isAnonymous && <Feather name="check" size={13} color="#ffffff" />}
                </View>
                <Text style={styles.anonymousCheckboxLabel}>
                  Publicar anonimamente (seu nome e foto não serão exibidos aos colegas)
                </Text>
              </TouchableOpacity>

              {/* Botões do Rodapé do Formulário */}
              <View style={styles.modalFormFooter}>
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  style={styles.btnFormCancel}
                  activeOpacity={0.75}
                >
                  <Text style={styles.btnFormCancelText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleCreatePost}
                  disabled={isSubmittingPost}
                  style={styles.btnFormSubmit}
                  activeOpacity={0.85}
                >
                  {isSubmittingPost ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.btnFormSubmitText}>Publicar no Fórum</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL: DETALHES DA DISCUSSÃO & RESPOSTAS */}
      {/* ======================================================== */}
      <Modal
        visible={!!activePost}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActivePost(null)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, backgroundColor: '#f8fafc' }}
        >
          {/* Header da Tela de Detalhes */}
          <View style={styles.detailsHeader}>
            <View style={styles.sheetDragHandle} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14 }}>
              <Text style={styles.detailsHeaderTitle}>Discussão Clínica</Text>
              <TouchableOpacity 
                onPress={() => setActivePost(null)}
                style={styles.modalCloseBtn}
              >
                <Feather name="x" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 20, paddingBottom: 30 }}
          >
            {activePost && (
              <View style={styles.detailsMainCard}>
                {/* Header do Post */}
                <View style={styles.postAuthorRow}>
                  {activePost.authorPhoto && !activePost.isAnonymous ? (
                    <Image 
                      source={{ uri: resolveImageUrl(activePost.authorPhoto) || '' }} 
                      style={styles.postAuthorAvatar} 
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.postAuthorAvatarFallback}>
                      <Text style={styles.postAuthorAvatarFallbackText}>
                        {activePost.isAnonymous ? 'A' : (activePost.authorName?.charAt(0) || 'P')}
                      </Text>
                    </View>
                  )}

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      <View style={[
                        styles.categoryPill,
                        { 
                          backgroundColor: getCategoryStyle(activePost.category).bg,
                          borderColor: getCategoryStyle(activePost.category).border
                        }
                      ]}>
                        <Text style={[styles.categoryPillText, { color: getCategoryStyle(activePost.category).text }]}>
                          {activePost.category || 'Geral'}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.authorNameText}>
                      por <Text style={{ fontWeight: 'bold' }}>{activePost.isAnonymous ? 'Anônimo' : (activePost.authorName || 'Psicólogo(a)')}</Text>
                      {' '}• há {formatTimeAgo(activePost.createdAt)}
                    </Text>
                  </View>
                </View>

                {/* Título & Conteúdo Completo */}
                <Text style={styles.detailsTitle}>{activePost.title}</Text>
                <Text style={styles.detailsBody}>{activePost.content}</Text>

                {/* Ações */}
                <View style={styles.detailsActionsRow}>
                  <TouchableOpacity 
                    onPress={() => handleVotePost(activePost)}
                    style={[
                      styles.actionPillBtn,
                      activePost.supportedByMe && styles.actionPillBtnVoted
                    ]}
                    activeOpacity={0.7}
                  >
                    <Feather 
                      name="heart" 
                      size={15} 
                      color={activePost.supportedByMe ? "#e11d48" : "#64748b"} 
                    />
                    <Text style={[
                      styles.actionPillCount,
                      activePost.supportedByMe && { color: '#e11d48' }
                    ]}>
                      {activePost.votes || 0} apoios
                    </Text>
                  </TouchableOpacity>

                  <Text style={{ fontSize: 13, color: '#64748b', fontWeight: '500' }}>
                    {comments.length} {comments.length === 1 ? 'resposta' : 'respostas'}
                  </Text>
                </View>
              </View>
            )}

            {/* Seção Respostas */}
            <Text style={styles.commentsSectionTitle}>
              Respostas dos Colegas
            </Text>

            {isLoadingComments ? (
              <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                <ActivityIndicator color="#1B4332" />
              </View>
            ) : comments.length === 0 ? (
              <View style={styles.emptyCommentsCard}>
                <Text style={styles.emptyCommentsText}>
                  Nenhuma resposta ainda. Seja o primeiro a compartilhar sua reflexão clínica!
                </Text>
              </View>
            ) : (
              comments.map((comment) => (
                <View key={comment.id} style={styles.commentCard}>
                  <View style={styles.commentHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      {comment.authorPhoto && !comment.isAnonymous ? (
                        <Image 
                          source={{ uri: resolveImageUrl(comment.authorPhoto) || '' }} 
                          style={styles.commentAvatar}
                        />
                      ) : (
                        <View style={styles.commentAvatarFallback}>
                          <Text style={styles.commentAvatarFallbackText}>
                            {comment.isAnonymous ? 'A' : (comment.authorName?.charAt(0) || 'P')}
                          </Text>
                        </View>
                      )}
                      <View>
                        <Text style={styles.commentAuthorName}>
                          {comment.isAnonymous ? 'Anônimo' : (comment.authorName || 'Psicólogo(a)')}
                        </Text>
                        <Text style={styles.commentTimeAgo}>
                          há {formatTimeAgo(comment.createdAt)}
                        </Text>
                      </View>
                    </View>

                    {comment.isMine && (
                      <TouchableOpacity 
                        onPress={() => handleDeleteComment(comment.id)}
                        style={{ padding: 4 }}
                      >
                        <Feather name="trash-2" size={13} color="#dc2626" />
                      </TouchableOpacity>
                    )}
                  </View>

                  <Text style={styles.commentContentText}>
                    {comment.content}
                  </Text>

                  {/* Voto no Comentário */}
                  <TouchableOpacity 
                    onPress={() => handleVoteComment(comment.id)}
                    style={[
                      styles.commentLikeBtn,
                      comment.hasVoted && { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }
                    ]}
                    activeOpacity={0.7}
                  >
                    <Feather 
                      name="heart" 
                      size={12} 
                      color={comment.hasVoted ? "#e11d48" : "#64748b"} 
                    />
                    <Text style={[
                      styles.commentLikeCount,
                      comment.hasVoted && { color: '#e11d48' }
                    ]}>
                      {comment.likes || 0}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>

          {/* Rodapé Fixo de Envio de Resposta */}
          <View style={styles.commentComposerBar}>
            <View style={styles.commentInputRow}>
              <TextInput 
                placeholder="Escreva uma resposta construtiva..."
                placeholderTextColor="#94a3b8"
                value={newComment}
                onChangeText={setNewComment}
                style={styles.commentInput}
              />
              <TouchableOpacity 
                onPress={handleSendComment}
                disabled={isSubmittingComment || !newComment.trim()}
                style={[
                  styles.commentSendBtn,
                  !newComment.trim() && { opacity: 0.5 }
                ]}
                activeOpacity={0.8}
              >
                {isSubmittingComment ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Feather name="arrow-up" size={16} color="#ffffff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },

  // BARRA SUPERIOR SLIM
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
  },
  btnVoltar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 50,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  btnVoltarText: {
    fontSize: 12.5,
    fontWeight: 'bold',
    color: '#1B4332',
  },
  topNavTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1B4332',
  },

  // 1. CARD DE REGRAS
  guidelinesBox: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#166534',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  guidelinesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  guidelinesTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1B4332',
    flex: 1,
  },
  guidelinesBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 50,
    marginRight: 6,
  },
  guidelinesBadgeText: {
    fontSize: 9.5,
    fontWeight: 'bold',
    color: '#15803d',
    letterSpacing: 0.4,
  },
  guidelinesToggleBtn: {
    padding: 2,
  },
  guidelinesList: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(187, 247, 208, 0.6)',
    gap: 6,
  },
  guidelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  guidelineDot: {
    color: '#16a34a',
    fontSize: 13,
    fontWeight: 'bold',
    marginRight: 6,
    marginTop: -1,
  },
  guidelineText: {
    flex: 1,
    fontSize: 11.5,
    color: '#334155',
    lineHeight: 16.5,
  },
  guidelineBold: {
    fontWeight: 'bold',
    color: '#1B4332',
  },

  // 2. CÁPSULA RÁPIDA DE CRIAÇÃO (COMPOSER)
  composerCapsule: {
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 50,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  composerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  composerAvatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1B4332',
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerAvatarFallbackText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  composerPromptText: {
    flex: 1,
    fontSize: 13.5,
    color: '#64748b',
    marginLeft: 12,
  },

  // 3. CARD UNIFICADO DE FILTROS & TABS
  filterDockCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
  searchPill: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 50,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#1e293b',
    marginLeft: 8,
    padding: 0,
  },
  categoryDropdownBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  categoryDropdownText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1B4332',
    flex: 1,
  },
  segmentedControl: {
    backgroundColor: '#f1f5f9',
    borderRadius: 50,
    padding: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 50,
  },
  segmentItemActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  segmentItemText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748b',
  },
  segmentItemTextActive: {
    color: '#1B4332',
    fontWeight: 'bold',
  },

  // 4. CARDS DE DISCUSSÃO
  postCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
  postCardPinned: {
    borderLeftWidth: 4,
    borderLeftColor: '#16a34a',
  },
  pinnedBadge: {
    backgroundColor: '#fef9c3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  pinnedBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#854d0e',
  },
  postAuthorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  postAuthorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f1f5f9',
  },
  postAuthorAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1B4332',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postAuthorAvatarFallbackText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  categoryPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  categoryPillText: {
    fontSize: 11.5,
    fontWeight: 'bold',
  },
  categoryPillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  authorNameText: {
    fontSize: 12,
    color: '#475569',
  },
  postTimeText: {
    fontSize: 11.5,
    color: '#94a3b8',
  },
  postTitleText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 4,
    marginBottom: 6,
    lineHeight: 23,
  },
  postSnippetText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
    marginBottom: 12,
  },
  postActionsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  actionPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 50,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 5,
  },
  actionPillBtnVoted: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
  },
  actionPillCount: {
    fontSize: 12.5,
    fontWeight: 'bold',
    color: '#475569',
  },
  actionPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  postSmallActionBtn: {
    padding: 6,
  },

  // BOTÃO MOSTRAR MAIS
  btnLoadMore: {
    borderWidth: 1.5,
    borderColor: '#1B4332',
    borderRadius: 50,
    paddingHorizontal: 26,
    paddingVertical: 9,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 20,
    backgroundColor: 'transparent',
  },
  btnLoadMoreText: {
    color: '#1B4332',
    fontSize: 13.5,
    fontWeight: 'bold',
  },

  // FAB BOTÃO FLUTUANTE
  fabButton: {
    position: 'absolute',
    bottom: 95,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1B4332',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1B4332',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    zIndex: 99,
  },

  // MODAIS E BOTTOM SHEETS
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetDragHandle: {
    width: 44,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: '#e2e8f0',
    alignSelf: 'center',
    marginBottom: 10,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // MODAL CATEGORIAS
  categoryBottomSheetCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '75%',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  categoryModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  categoryModalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1B4332',
  },
  categoryOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  categoryOptionItemActive: {
    backgroundColor: '#f0fdf4',
  },
  categoryOptionText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
  },
  categoryOptionTextActive: {
    color: '#1B4332',
    fontWeight: 'bold',
  },

  // MODAL CRIAR
  createModalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    paddingTop: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  createModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  createModalIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createModalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1B4332',
  },
  createModalSubtitle: {
    fontSize: 11.5,
    color: '#64748b',
  },
  formGroup: {
    marginBottom: 14,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  formInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1e293b',
  },
  formTextArea: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1e293b',
    minHeight: 110,
    textAlignVertical: 'top',
  },
  categoryChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  categoryChipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  categoryChipBtnText: {
    fontSize: 11.5,
  },
  anonymousCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 18,
  },
  checkboxSquare: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSquareChecked: {
    backgroundColor: '#1B4332',
    borderColor: '#1B4332',
  },
  anonymousCheckboxLabel: {
    flex: 1,
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
  },
  modalFormFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  btnFormCancel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: '#1B4332',
    backgroundColor: '#ffffff',
  },
  btnFormCancelText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1B4332',
  },
  btnFormSubmit: {
    backgroundColor: '#1B4332',
    borderRadius: 50,
    paddingHorizontal: 20,
    paddingVertical: 10,
    shadowColor: '#1B4332',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  btnFormSubmitText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },

  // MODAL DETALHES
  detailsHeader: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingTop: 10,
  },
  detailsHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1B4332',
  },
  detailsMainCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
  detailsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 6,
    marginBottom: 10,
    lineHeight: 26,
  },
  detailsBody: {
    fontSize: 14.5,
    color: '#334155',
    lineHeight: 23,
    marginBottom: 16,
  },
  detailsActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  commentsSectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1B4332',
    marginBottom: 12,
  },
  emptyCommentsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  emptyCommentsText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  commentCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  commentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  commentAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1B4332',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarFallbackText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  commentAuthorName: {
    fontSize: 12.5,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  commentTimeAgo: {
    fontSize: 11,
    color: '#94a3b8',
  },
  commentContentText: {
    fontSize: 13.5,
    color: '#334155',
    lineHeight: 20,
    marginBottom: 10,
  },
  commentLikeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 50,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  commentLikeCount: {
    fontSize: 11.5,
    fontWeight: 'bold',
    color: '#64748b',
  },
  commentComposerBar: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 50,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  commentInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#1e293b',
    padding: 0,
  },
  commentSendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1B4332',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  // LOADER & EMPTY
  loaderBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    fontSize: 13.5,
    color: '#64748b',
    marginTop: 10,
  },
  emptyBox: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1B4332',
    marginTop: 10,
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  btnEmptyCreate: {
    backgroundColor: '#1B4332',
    borderRadius: 50,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  btnEmptyCreateText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
