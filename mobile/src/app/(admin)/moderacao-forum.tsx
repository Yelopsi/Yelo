import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  RefreshControl,
  Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';

interface ForumPost {
  id: number;
  title: string;
  content: string;
  authorName: string;
  authorPhoto: string | null;
  authorEmail: string | null;
  category: string;
  createdAt: string;
  status: string;
  isPinned: boolean;
  votes: number;
  commentCount: number;
}

interface ForumComment {
  id: number;
  content: string;
  createdAt: string;
  likes?: number;
  isPinned?: boolean;
  authorName: string;
  authorPhoto: string | null;
}

interface ForumPostDetail extends ForumPost {
  isAnonymous?: boolean;
  author?: {
    name: string;
    photo: string | null;
    email: string | null;
    crp: string | null;
  };
  comments?: ForumComment[];
}

interface ForumStats {
  total: number;
  active: number;
  hidden: number;
  pinned: number;
}

const CATEGORIES = [
  'all',
  'Indicações e Encaminhamentos',
  'Dúvidas Clínicas & Teóricas',
  'Carreira & Gestão',
  'Materiais e Recursos',
  'Geral',
];

export default function ModeracaoForumScreen() {
  const router = useRouter();

  // Estados principais
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filtros e busca
  const [statusFilter, setStatusFilter] = useState<'active' | 'hidden' | 'all'>('active');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  // Estatísticas / KPIs
  const [stats, setStats] = useState<ForumStats>({
    total: 0,
    active: 0,
    hidden: 0,
    pinned: 0,
  });

  // Modal de Detalhes / Preview
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [postDetail, setPostDetail] = useState<ForumPostDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Buscar lista de posts com filtros
  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      params.append('limit', '100');

      const res = await api.get(`/api/admin/forum/posts?${params.toString()}`);
      const result = res.data;

      const postsList = Array.isArray(result.data)
        ? result.data
        : Array.isArray(result)
        ? result
        : [];
      setPosts(postsList);

      if (result.stats) {
        setStats(result.stats);
      }
    } catch (error) {
      console.log('Erro ao buscar posts do fórum:', error);
      Alert.alert('Erro', 'Não foi possível carregar as publicações do fórum.');
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, searchQuery]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  };

  // Buscar detalhes completos do post para o Modal Preview
  const openPostDetail = async (id: number) => {
    setSelectedPostId(id);
    setPostDetail(null);
    setLoadingDetail(true);

    try {
      const res = await api.get(`/api/admin/forum/posts/${id}`);
      setPostDetail(res.data);
    } catch (error) {
      console.log('Erro ao carregar detalhes do post:', error);
      Alert.alert('Erro', 'Não foi possível carregar os detalhes desta discussão.');
      setSelectedPostId(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Ocultar ou Restaurar Post
  const handleModerateAction = (postId: number, currentStatus: string) => {
    const isHidden = currentStatus === 'hidden_by_admin' || currentStatus === 'hidden';
    const action = isHidden ? 'restore' : 'remove';
    const actionTitle = isHidden ? 'Restaurar Tópico no Fórum' : 'Ocultar Tópico do Fórum';
    const actionMessage = isHidden
      ? 'Deseja restaurar esta publicação? Ela voltará a ficar pública para toda a comunidade.'
      : 'Tem certeza que deseja ocultar esta publicação? Ela será removida do feed dos psicólogos e ficará visível apenas para admins.';

    Alert.alert(actionTitle, actionMessage, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: isHidden ? 'Restaurar' : 'Ocultar',
        style: isHidden ? 'default' : 'destructive',
        onPress: async () => {
          try {
            await api.put('/api/admin/forum/moderate', {
              contentType: 'post',
              contentId: postId,
              action,
            });

            Alert.alert(
              'Sucesso',
              isHidden ? 'Tópico restaurado no fórum com sucesso!' : 'Tópico ocultado com sucesso!'
            );

            if (selectedPostId === postId) {
              setSelectedPostId(null);
              setPostDetail(null);
            }

            fetchPosts();
          } catch (error: any) {
            const msg = error.response?.data?.error || 'Erro ao processar moderação.';
            Alert.alert('Erro', msg);
          }
        },
      },
    ]);
  };

  // Fixar / Desafixar Post
  const handleTogglePin = async (postId: number, currentPinned: boolean) => {
    try {
      await api.put(`/api/admin/forum/posts/${postId}/pin`, {
        isPinned: !currentPinned,
      });

      Alert.alert(
        'Sucesso',
        !currentPinned ? 'Tópico fixado no topo do fórum!' : 'Tópico desafixado com sucesso!'
      );

      if (selectedPostId === postId && postDetail) {
        setPostDetail({ ...postDetail, isPinned: !currentPinned });
      }

      fetchPosts();
    } catch (error: any) {
      const msg = error.response?.data?.error || 'Erro ao alterar status de fixação.';
      Alert.alert('Erro', msg);
    }
  };

  // Excluir Definitivamente Post
  const handleDeletePost = (postId: number, postTitle: string) => {
    Alert.alert(
      'Excluir Permanentemente ⚠️',
      `Esta ação é irreversível!\n\nTem certeza que deseja apagar o tópico "${postTitle.length > 40 ? postTitle.substring(0, 40) + '...' : postTitle}" e todas as suas respostas do banco de dados?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir Definitivamente',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/admin/forum/posts/${postId}`);
              Alert.alert('Sucesso', 'Publicação excluída com sucesso.');

              if (selectedPostId === postId) {
                setSelectedPostId(null);
                setPostDetail(null);
              }

              fetchPosts();
            } catch (error: any) {
              const msg = error.response?.data?.error || 'Erro ao excluir publicação.';
              Alert.alert('Erro', msg);
            }
          },
        },
      ]
    );
  };

  const getInitials = (name: string) => {
    if (!name) return 'AD';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 130,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#1B4332']}
            tintColor="#1B4332"
          />
        }
      >
        {/* Header Superior com Identidade Yelo */}
        <View
          style={{
            backgroundColor: '#1B4332',
            borderRadius: 20,
            padding: 20,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 10,
            elevation: 3,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <TouchableOpacity
              onPress={() => router.push('/(admin)/conteudo')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
              }}
              activeOpacity={0.8}
            >
              <Feather name="arrow-left" size={14} color="#ffffff" />
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#ffffff' }}>
                Hub de Conteúdo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleRefresh}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: '#ffffff',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
              }}
              activeOpacity={0.8}
            >
              <Feather name="refresh-cw" size={12} color="#1B4332" />
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#1B4332' }}>
                Atualizar
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 22, color: '#ffffff', marginTop: 8 }}>
            Moderação do Fórum 🛡️
          </Text>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: '#e2e8f0', marginTop: 4, lineHeight: 18 }}>
            Supervisione tópicos, aprove publicações, oculte conteúdos fora das diretrizes ou exclua definitivamente.
          </Text>
        </View>

        {/* Hero KPI Cards em Grid 2x2 */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
          {/* Card 1: Total */}
          <TouchableOpacity
            onPress={() => setStatusFilter('all')}
            style={{
              flex: 1,
              minWidth: '47%',
              backgroundColor: '#ffffff',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: statusFilter === 'all' ? '#1B4332' : '#e2e8f0',
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.02,
              shadowRadius: 4,
              elevation: 1,
            }}
            activeOpacity={0.8}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 999,
                backgroundColor: '#eff6ff',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Feather name="message-square" size={18} color="#2563eb" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10.5, color: '#64748b', textTransform: 'uppercase' }}>
                Total Tópicos
              </Text>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 18, color: '#0f172a' }}>
                {stats.total}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Card 2: Ativos */}
          <TouchableOpacity
            onPress={() => setStatusFilter('active')}
            style={{
              flex: 1,
              minWidth: '47%',
              backgroundColor: '#ffffff',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: statusFilter === 'active' ? '#1B4332' : '#e2e8f0',
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.02,
              shadowRadius: 4,
              elevation: 1,
            }}
            activeOpacity={0.8}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 999,
                backgroundColor: '#ecfdf5',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Feather name="check-circle" size={18} color="#10b981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10.5, color: '#166534', textTransform: 'uppercase' }}>
                Ativos
              </Text>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 18, color: '#0f172a' }}>
                {stats.active}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Card 3: Ocultos */}
          <TouchableOpacity
            onPress={() => setStatusFilter('hidden')}
            style={{
              flex: 1,
              minWidth: '47%',
              backgroundColor: '#ffffff',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: statusFilter === 'hidden' ? '#1B4332' : '#e2e8f0',
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.02,
              shadowRadius: 4,
              elevation: 1,
            }}
            activeOpacity={0.8}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 999,
                backgroundColor: '#fff1f2',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Feather name="eye-off" size={18} color="#e11d48" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10.5, color: '#b91c1c', textTransform: 'uppercase' }}>
                Ocultos
              </Text>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 18, color: '#0f172a' }}>
                {stats.hidden}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Card 4: Fixados */}
          <View
            style={{
              flex: 1,
              minWidth: '47%',
              backgroundColor: '#ffffff',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#e2e8f0',
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.02,
              shadowRadius: 4,
              elevation: 1,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 999,
                backgroundColor: '#fffbeb',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Feather name="bookmark" size={18} color="#d97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10.5, color: '#b45309', textTransform: 'uppercase' }}>
                Fixados
              </Text>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 18, color: '#0f172a' }}>
                {stats.pinned}
              </Text>
            </View>
          </View>
        </View>

        {/* Toolbar de Filtros e Status em Formato de Pílula */}
        <View
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            padding: 14,
            marginBottom: 16,
            gap: 12,
          }}
        >
          {/* Abas de Status em Pílula */}
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: '#f1f5f9',
              borderRadius: 999,
              padding: 4,
              gap: 4,
            }}
          >
            {[
              { id: 'active', label: 'Ativos', count: stats.active },
              { id: 'hidden', label: 'Ocultos', count: stats.hidden },
              { id: 'all', label: 'Todos', count: stats.total },
            ].map((tab) => {
              const isActive = statusFilter === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setStatusFilter(tab.id as any)}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: isActive ? '#ffffff' : 'transparent',
                    shadowColor: isActive ? '#000' : 'transparent',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: isActive ? 0.08 : 0,
                    shadowRadius: 3,
                    elevation: isActive ? 1 : 0,
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={{
                      fontFamily: isActive ? 'Inter_700Bold' : 'Inter_500Medium',
                      fontSize: 12,
                      color: isActive ? '#1B4332' : '#64748b',
                    }}
                  >
                    {tab.label}
                  </Text>
                  <View
                    style={{
                      backgroundColor: isActive ? '#dcfce7' : '#e2e8f0',
                      paddingHorizontal: 6,
                      paddingVertical: 1,
                      borderRadius: 999,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'Inter_700Bold',
                        fontSize: 10,
                        color: isActive ? '#166534' : '#475569',
                      }}
                    >
                      {tab.count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Campo de Busca em Pílula */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#f8fafc',
              borderWidth: 1,
              borderColor: '#e2e8f0',
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 8,
            }}
          >
            <Feather name="search" size={15} color="#94a3b8" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Buscar por título, autor ou trecho..."
              placeholderTextColor="#94a3b8"
              style={{
                flex: 1,
                marginLeft: 8,
                fontFamily: 'Inter_400Regular',
                fontSize: 12.5,
                color: '#1e293b',
                paddingVertical: 0,
              }}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Feather name="x-circle" size={15} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Seletor de Categoria em Pílula */}
          <TouchableOpacity
            onPress={() => setShowCategoryPicker(true)}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8fafc',
              borderWidth: 1,
              borderColor: '#e2e8f0',
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 9,
            }}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <Feather name="tag" size={13} color="#64748b" />
              <Text
                style={{
                  fontFamily: 'Inter_600SemiBold',
                  fontSize: 12,
                  color: categoryFilter === 'all' ? '#64748b' : '#1B4332',
                }}
                numberOfLines={1}
              >
                {categoryFilter === 'all' ? 'Todas as Categorias' : categoryFilter}
              </Text>
            </View>
            <Feather name="chevron-down" size={14} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* Lista de Discussões / Tópicos */}
        <View style={{ gap: 14 }}>
          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#1B4332" />
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748b', marginTop: 8 }}>
                Carregando publicações do fórum...
              </Text>
            </View>
          ) : posts.length === 0 ? (
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                padding: 30,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 36, marginBottom: 10 }}>📂</Text>
              <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 17, color: '#1e293b', textAlign: 'center' }}>
                Nenhuma discussão encontrada
              </Text>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12.5, color: '#64748b', textAlign: 'center', marginTop: 4, lineHeight: 18 }}>
                Não foram encontrados tópicos com os filtros e busca aplicados.
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setStatusFilter('active');
                  setCategoryFilter('all');
                  setSearchQuery('');
                }}
                style={{
                  marginTop: 14,
                  backgroundColor: '#f1f5f9',
                  borderWidth: 1,
                  borderColor: '#cbd5e1',
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 999,
                }}
                activeOpacity={0.8}
              >
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#475569' }}>
                  Limpar Filtros
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            posts.map((post) => {
              const isHidden = post.status === 'hidden_by_admin' || post.status === 'hidden';
              const cleanExcerpt = (post.content || '')
                .replace(/<[^>]*>?/gm, '')
                .trim();
              const dateStr = post.createdAt
                ? new Date(post.createdAt).toLocaleDateString('pt-BR')
                : '';

              return (
                <View
                  key={post.id}
                  style={{
                    backgroundColor: isHidden ? '#fffafa' : '#ffffff',
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: isHidden ? '#fecaca' : '#e2e8f0',
                    padding: 16,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.03,
                    shadowRadius: 6,
                    elevation: 1,
                  }}
                >
                  {/* Top Bar: Categorias, Fixado e Status */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {post.isPinned && (
                        <View
                          style={{
                            backgroundColor: '#fffbeb',
                            borderWidth: 1,
                            borderColor: '#fde68a',
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 999,
                          }}
                        >
                          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#b45309' }}>
                            📌 Fixado
                          </Text>
                        </View>
                      )}
                      <View
                        style={{
                          backgroundColor: '#e0f2fe',
                          borderWidth: 1,
                          borderColor: '#bae6fd',
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 999,
                        }}
                      >
                        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#0369a1' }}>
                          {post.category || 'Geral'}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={{
                        backgroundColor: isHidden ? '#fee2e2' : '#dcfce7',
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 999,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <View
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 999,
                          backgroundColor: isHidden ? '#dc2626' : '#16a34a',
                        }}
                      />
                      <Text
                        style={{
                          fontFamily: 'Inter_700Bold',
                          fontSize: 10,
                          color: isHidden ? '#b91c1c' : '#15803d',
                        }}
                      >
                        {isHidden ? 'Oculto' : 'Ativo'}
                      </Text>
                    </View>
                  </View>

                  {/* Título */}
                  <TouchableOpacity onPress={() => openPostDetail(post.id)} activeOpacity={0.7}>
                    <Text
                      style={{
                        fontFamily: 'Inter_700Bold',
                        fontSize: 15,
                        color: '#0f172a',
                        lineHeight: 20,
                        marginBottom: 6,
                      }}
                    >
                      {post.title || 'Discussão sem título'}
                    </Text>
                  </TouchableOpacity>

                  {/* Resumo do Conteúdo */}
                  {cleanExcerpt ? (
                    <Text
                      style={{
                        fontFamily: 'Inter_400Regular',
                        fontSize: 12.5,
                        color: '#475569',
                        lineHeight: 18,
                        marginBottom: 12,
                      }}
                      numberOfLines={3}
                    >
                      {cleanExcerpt}
                    </Text>
                  ) : null}

                  {/* Autor e Métricas de Engajamento */}
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: 10,
                      borderTopWidth: 1,
                      borderTopColor: '#f1f5f9',
                      borderBottomWidth: 1,
                      borderBottomColor: '#f1f5f9',
                      marginBottom: 12,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      {post.authorPhoto ? (
                        <Image
                          source={{ uri: post.authorPhoto }}
                          style={{ width: 28, height: 28, borderRadius: 999 }}
                        />
                      ) : (
                        <View
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 999,
                            backgroundColor: '#e2e8f0',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#1B4332' }}>
                            {getInitials(post.authorName)}
                          </Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#1e293b' }}
                          numberOfLines={1}
                        >
                          {post.authorName || 'Anônimo'}
                        </Text>
                        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: '#94a3b8' }}>
                          {dateStr}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#64748b' }}>
                        💬 {post.commentCount || 0}
                      </Text>
                      <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#64748b' }}>
                        👍 {post.votes || 0}
                      </Text>
                    </View>
                  </View>

                  {/* Botões de Ação em Pílula */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {/* Botão Ver */}
                    <TouchableOpacity
                      onPress={() => openPostDetail(post.id)}
                      style={{
                        flex: 1,
                        minWidth: 70,
                        backgroundColor: '#f0f9ff',
                        borderWidth: 1,
                        borderColor: '#bae6fd',
                        paddingVertical: 8,
                        borderRadius: 999,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 4,
                      }}
                      activeOpacity={0.8}
                    >
                      <Feather name="eye" size={12} color="#0284c7" />
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11.5, color: '#0369a1' }}>
                        Ver
                      </Text>
                    </TouchableOpacity>

                    {/* Botão Ocultar / Restaurar */}
                    <TouchableOpacity
                      onPress={() => handleModerateAction(post.id, post.status)}
                      style={{
                        flex: 1,
                        minWidth: 80,
                        backgroundColor: isHidden ? '#f0fdf4' : '#fffbeb',
                        borderWidth: 1,
                        borderColor: isHidden ? '#bbf7d0' : '#fde68a',
                        paddingVertical: 8,
                        borderRadius: 999,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 4,
                      }}
                      activeOpacity={0.8}
                    >
                      <Feather
                        name={isHidden ? 'rotate-ccw' : 'eye-off'}
                        size={12}
                        color={isHidden ? '#166534' : '#b45309'}
                      />
                      <Text
                        style={{
                          fontFamily: 'Inter_700Bold',
                          fontSize: 11.5,
                          color: isHidden ? '#166534' : '#b45309',
                        }}
                      >
                        {isHidden ? 'Restaurar' : 'Ocultar'}
                      </Text>
                    </TouchableOpacity>

                    {/* Botão Fixar */}
                    <TouchableOpacity
                      onPress={() => handleTogglePin(post.id, post.isPinned)}
                      style={{
                        flex: 1,
                        minWidth: 70,
                        backgroundColor: post.isPinned ? '#fef9c3' : '#ffffff',
                        borderWidth: 1,
                        borderColor: post.isPinned ? '#fde047' : '#e2e8f0',
                        paddingVertical: 8,
                        borderRadius: 999,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 4,
                      }}
                      activeOpacity={0.8}
                    >
                      <Feather
                        name="bookmark"
                        size={12}
                        color={post.isPinned ? '#854d0e' : '#64748b'}
                      />
                      <Text
                        style={{
                          fontFamily: 'Inter_700Bold',
                          fontSize: 11.5,
                          color: post.isPinned ? '#854d0e' : '#475569',
                        }}
                      >
                        {post.isPinned ? 'Fixado' : 'Fixar'}
                      </Text>
                    </TouchableOpacity>

                    {/* Botão Excluir */}
                    <TouchableOpacity
                      onPress={() => handleDeletePost(post.id, post.title)}
                      style={{
                        backgroundColor: '#ffffff',
                        borderWidth: 1,
                        borderColor: '#fee2e2',
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 999,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      activeOpacity={0.8}
                    >
                      <Feather name="trash-2" size={13} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Modal Seletor de Categoria */}
      <Modal
        visible={showCategoryPicker}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowCategoryPicker(false)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
          activeOpacity={1}
          onPress={() => setShowCategoryPicker(false)}
        >
          <View
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 20,
              padding: 20,
              width: '100%',
              maxWidth: 360,
              borderWidth: 1,
              borderColor: '#e2e8f0',
            }}
          >
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#1e293b', marginBottom: 12 }}>
              Filtrar por Categoria
            </Text>
            <View style={{ gap: 6 }}>
              {CATEGORIES.map((cat) => {
                const isSelected = categoryFilter === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => {
                      setCategoryFilter(cat);
                      setShowCategoryPicker(false);
                    }}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      backgroundColor: isSelected ? '#ecfdf5' : '#f8fafc',
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={{
                        fontFamily: isSelected ? 'Inter_700Bold' : 'Inter_500Medium',
                        fontSize: 13,
                        color: isSelected ? '#166534' : '#334155',
                      }}
                    >
                      {cat === 'all' ? 'Todas as Categorias' : cat}
                    </Text>
                    {isSelected && <Feather name="check" size={16} color="#166534" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal de Detalhes / Preview Completo do Post */}
      <Modal
        visible={!!selectedPostId}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setSelectedPostId(null);
          setPostDetail(null);
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: '#ffffff',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: '88%',
              minHeight: '50%',
              paddingBottom: 24,
            }}
          >
            {/* Header do Modal */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: 20,
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: '#f1f5f9',
              }}
            >
              <View style={{ flex: 1, marginRight: 12 }}>
                <View
                  style={{
                    backgroundColor: '#e0f2fe',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 999,
                    alignSelf: 'flex-start',
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#0369a1' }}>
                    {postDetail?.category || 'Fórum Yelo'}
                  </Text>
                </View>
                <Text
                  style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#0f172a' }}
                  numberOfLines={2}
                >
                  {postDetail?.title || 'Detalhes da Publicação'}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  setSelectedPostId(null);
                  setPostDetail(null);
                }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  backgroundColor: '#f1f5f9',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Feather name="x" size={16} color="#64748b" />
              </TouchableOpacity>
            </View>

            {loadingDetail ? (
              <View style={{ paddingVertical: 50, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#1B4332" />
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748b', marginTop: 10 }}>
                  Carregando conteúdo e respostas...
                </Text>
              </View>
            ) : postDetail ? (
              <ScrollView
                contentContainerStyle={{ padding: 20 }}
                showsVerticalScrollIndicator={false}
              >
                {/* Caixa do Autor */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    backgroundColor: '#f8fafc',
                    padding: 14,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: '#e2e8f0',
                    marginBottom: 16,
                  }}
                >
                  {postDetail.author?.photo ? (
                    <Image
                      source={{ uri: postDetail.author.photo }}
                      style={{ width: 42, height: 42, borderRadius: 999 }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 999,
                        backgroundColor: '#1B4332',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: '#ffffff' }}>
                        {getInitials(postDetail.author?.name || 'AD')}
                      </Text>
                    </View>
                  )}

                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: '#0f172a' }}>
                      {postDetail.author?.name || 'Anônimo'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      {postDetail.author?.crp ? (
                        <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#64748b' }}>
                          CRP: {postDetail.author.crp}
                        </Text>
                      ) : null}
                      <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: '#94a3b8' }}>
                        {postDetail.createdAt ? new Date(postDetail.createdAt).toLocaleDateString('pt-BR') : ''}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={{
                      backgroundColor:
                        postDetail.status === 'hidden_by_admin' || postDetail.status === 'hidden'
                          ? '#fee2e2'
                          : '#dcfce7',
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 999,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'Inter_700Bold',
                        fontSize: 10,
                        color:
                          postDetail.status === 'hidden_by_admin' || postDetail.status === 'hidden'
                            ? '#b91c1c'
                            : '#15803d',
                      }}
                    >
                      {postDetail.status === 'hidden_by_admin' || postDetail.status === 'hidden'
                        ? '● Oculto'
                        : '● Ativo'}
                    </Text>
                  </View>
                </View>

                {/* Conteúdo Completo */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
                    Mensagem
                  </Text>
                  <View
                    style={{
                      backgroundColor: '#f8fafc',
                      padding: 16,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: '#e2e8f0',
                    }}
                  >
                    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13.5, color: '#1e293b', lineHeight: 22 }}>
                      {postDetail.content || 'Sem texto no corpo da mensagem.'}
                    </Text>
                  </View>
                </View>

                {/* Métricas do Post */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
                  <View
                    style={{
                      backgroundColor: '#f1f5f9',
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 999,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Feather name="thumbs-up" size={13} color="#475569" />
                    <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11.5, color: '#475569' }}>
                      {postDetail.votes || 0} apoios
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: '#f1f5f9',
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 999,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Feather name="message-circle" size={13} color="#475569" />
                    <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11.5, color: '#475569' }}>
                      {(postDetail.comments || []).length} respostas
                    </Text>
                  </View>
                </View>

                {/* Seção de Respostas */}
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#64748b', textTransform: 'uppercase', marginBottom: 10 }}>
                    Respostas da Comunidade ({(postDetail.comments || []).length})
                  </Text>

                  {!postDetail.comments || postDetail.comments.length === 0 ? (
                    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12.5, color: '#94a3b8', fontStyle: 'italic', paddingVertical: 10 }}>
                      Nenhum comentário nesta discussão.
                    </Text>
                  ) : (
                    <View style={{ gap: 10 }}>
                      {postDetail.comments.map((comment, cIdx) => (
                        <View
                          key={comment.id || cIdx}
                          style={{
                            backgroundColor: '#f8fafc',
                            padding: 12,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: '#e2e8f0',
                          }}
                        >
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#1e293b' }}>
                              {comment.authorName}
                            </Text>
                            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: '#94a3b8' }}>
                              {comment.createdAt ? new Date(comment.createdAt).toLocaleDateString('pt-BR') : ''}
                            </Text>
                          </View>
                          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#334155', lineHeight: 18 }}>
                            {comment.content}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* Ações Rápidas no Rodapé do Modal */}
                <View style={{ gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
                  {/* Ocultar / Restaurar */}
                  <TouchableOpacity
                    onPress={() => handleModerateAction(postDetail.id, postDetail.status)}
                    style={{
                      backgroundColor:
                        postDetail.status === 'hidden_by_admin' || postDetail.status === 'hidden'
                          ? '#10b981'
                          : '#f59e0b',
                      paddingVertical: 11,
                      borderRadius: 999,
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                    activeOpacity={0.8}
                  >
                    <Feather
                      name={
                        postDetail.status === 'hidden_by_admin' || postDetail.status === 'hidden'
                          ? 'rotate-ccw'
                          : 'eye-off'
                      }
                      size={14}
                      color="#ffffff"
                    />
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12.5, color: '#ffffff' }}>
                      {postDetail.status === 'hidden_by_admin' || postDetail.status === 'hidden'
                        ? 'Restaurar no Fórum Público'
                        : 'Ocultar do Fórum Público'}
                    </Text>
                  </TouchableOpacity>

                  {/* Fixar no Topo */}
                  <TouchableOpacity
                    onPress={() => handleTogglePin(postDetail.id, postDetail.isPinned)}
                    style={{
                      backgroundColor: '#ffffff',
                      borderWidth: 1,
                      borderColor: '#cbd5e1',
                      paddingVertical: 11,
                      borderRadius: 999,
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                    activeOpacity={0.8}
                  >
                    <Feather name="bookmark" size={14} color="#1B4332" />
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12.5, color: '#1B4332' }}>
                      {postDetail.isPinned ? 'Desafixar do Topo' : 'Fixar no Topo'}
                    </Text>
                  </TouchableOpacity>

                  {/* Excluir Definitivamente */}
                  <TouchableOpacity
                    onPress={() => handleDeletePost(postDetail.id, postDetail.title)}
                    style={{
                      backgroundColor: '#fee2e2',
                      borderWidth: 1,
                      borderColor: '#fca5a5',
                      paddingVertical: 11,
                      borderRadius: 999,
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                    activeOpacity={0.8}
                  >
                    <Feather name="trash-2" size={14} color="#b91c1c" />
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12.5, color: '#b91c1c' }}>
                      Excluir Definitivamente
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}
