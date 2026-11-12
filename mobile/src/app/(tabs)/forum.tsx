import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  StyleSheet,
  Keyboard,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as SecureStore from 'expo-secure-store';
import YeloScrollView from '../../components/YeloScrollView';
import NativeSelectMenu from '../../components/NativeSelectMenu';
import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import api, { getBaseUrl } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  AuthorBadges,
  BubbleIcon,
  ChevronDownIcon,
  EditIcon,
  FlagIcon,
  ForumAvatar,
  HeartIcon,
  MentionText,
  PinIcon,
  ShareIcon,
  TrashIcon,
} from '../../components/forum/forumUi';
import {
  CommentNode,
  ForumComment,
  ThreadContext,
  ThreadContextValue,
} from '../../components/forum/ForumCommentThread';
import MainComposer, { MainComposerHandle } from '../../components/forum/ForumMainComposer';
import YeloToast from '../../components/YeloToast';

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

const COMMENTS_LIMIT = 6;

const countAllComments = (list?: ForumComment[]): number =>
  (list || []).reduce((acc, c) => acc + 1 + (c.totalRepliesCount ?? countAllComments(c.replies)), 0);

function findNode(list: ForumComment[], id: number): ForumComment | null {
  for (const c of list) {
    if (c.id === id) return c;
    if (c.replies && c.replies.length > 0) {
      const found = findNode(c.replies, id);
      if (found) return found;
    }
  }
  return null;
}

function updateNode(
  list: ForumComment[],
  id: number,
  updater: (c: ForumComment) => ForumComment
): ForumComment[] {
  return list.map((c) => {
    if (c.id === id) return updater(c);
    if (c.replies && c.replies.length > 0) {
      return { ...c, replies: updateNode(c.replies, id, updater) };
    }
    return c;
  });
}

function removeNode(
  list: ForumComment[],
  id: number
): { list: ForumComment[]; removed: number } {
  let removed = 0;
  const next: ForumComment[] = [];
  for (const c of list) {
    if (c.id === id) {
      removed += 1 + countAllComments(c.replies);
      continue;
    }
    if (c.replies && c.replies.length > 0) {
      const res = removeNode(c.replies, id);
      if (res.removed > 0) {
        removed += res.removed;
        next.push({
          ...c,
          replies: res.list,
          totalRepliesCount: Math.max(0, (c.totalRepliesCount ?? countAllComments(c.replies)) - res.removed),
        });
        continue;
      }
    }
    next.push(c);
  }
  return { list: next, removed };
}

function insertReply(
  list: ForumComment[],
  parentId: number,
  created: ForumComment
): ForumComment[] {
  return list.map((c) => {
    if (c.id === parentId) {
      const prevReplies = c.replies || [];
      return {
        ...c,
        replies: [...prevReplies, created],
        totalRepliesCount: (c.totalRepliesCount ?? prevReplies.length) + 1,
      };
    }
    if (c.replies && c.replies.length > 0) {
      return { ...c, replies: insertReply(c.replies, parentId, created) };
    }
    return c;
  });
}

export default function ForumScreen() {
  const router = useRouter();
  const { postId: paramPostId, commentId: paramCommentId, t: paramTrigger } = useLocalSearchParams<{
    postId?: string;
    commentId?: string;
    t?: string;
  }>();
  const { user } = useAuth();
  const isUserAdmin = Boolean((user as any)?.isAdmin || user?.email === 'pix@yelopsi.com.br');
  const isFounderPinUser = String(user?.email || '').trim().toLowerCase() === 'pix@yelopsi.com.br';
  const canPinPost = (post?: any) =>
    typeof post?.canPinPost === 'boolean' ? post.canPinPost : isFounderPinUser;

  // Estados de Filtro e Busca
  const [activeTab, setActiveTab] = useState<'recentes' | 'populares' | 'meus_posts'>('recentes');
  const [selectedCategory, setSelectedCategory] = useState('Todas as Categorias');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showRules, setShowRules] = useState(true);

  const RULES_COLLAPSED_KEY = 'Yelo_forum_rules_collapsed_v1';

  useEffect(() => {
    SecureStore.getItemAsync(RULES_COLLAPSED_KEY)
      .then((val) => {
        if (val === 'true') setShowRules(false);
        else if (val === 'false') setShowRules(true);
      })
      .catch(() => {});
  }, []);

  const handleToggleRules = () => {
    setShowRules((prev) => {
      const next = !prev;
      SecureStore.setItemAsync(RULES_COLLAPSED_KEY, next ? 'false' : 'true').catch(() => {});
      return next;
    });
  };

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

  // Detalhes da Discussão & Comentários (Visão Completa em Página)
  const [activePost, setActivePost] = useState<any | null>(null);
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isLoadingMoreComments, setIsLoadingMoreComments] = useState(false);
  const [isRefreshingPost, setIsRefreshingPost] = useState(false);
  const [commentPage, setCommentPage] = useState(1);
  const [commentsTotal, setCommentsTotal] = useState(0);
  const [hasMoreComments, setHasMoreComments] = useState(false);
  const [expandedMap, setExpandedMap] = useState<Record<number, boolean>>({});

  // Toast flutuante de feedback no estilo WhatsApp
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (message: string) => {
    setToastMessage(message);
  };
  const [activeReplyId, setActiveReplyId] = useState<number | null>(null);
  const [replyPrefill, setReplyPrefill] = useState<{ id: number; text: string; nonce: number } | null>(null);
  const [aiLoadingId, setAiLoadingId] = useState<number | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const keyboardHeightRef = useRef(0);
  const scrollOffsetRef = useRef(0);
  const scrollRef = useRef<any>(null);
  const formScrollRef = useRef<any>(null);
  const BOTTOM_SHEET_PADDING = Platform.OS === 'ios' ? 24 : 16;
  const sheetBottomAnim = useRef(new Animated.Value(BOTTOM_SHEET_PADDING)).current;
  const composerRef = useRef<MainComposerHandle>(null);
  const activeReplyRef = useRef<React.RefObject<any> | null>(null);
  const commentsRef = useRef<ForumComment[]>([]);
  useEffect(() => { commentsRef.current = comments; }, [comments]);

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

  // Fixar / Desfixar Discussão (Exclusivo pix@yelopsi.com.br)
  const handlePinPost = async (post: any) => {
    if (!post?.id) return;
    try {
      const targetState = !Boolean(post.isPinned);
      const res = await api.put(`/api/forum/posts/${post.id}/pin`, { isPinned: targetState });
      const nextPinned = typeof res.data?.isPinned === 'boolean' ? res.data.isPinned : targetState;

      setActivePost((prev: any) =>
        prev && prev.id === post.id ? { ...prev, isPinned: nextPinned } : prev
      );
      setPosts(prev =>
        prev.map(p => (p.id === post.id ? { ...p, isPinned: nextPinned } : p))
      );
      await fetchPosts(true);
      showToast(res.data?.message || (nextPinned ? 'Discussão fixada no topo! 📌' : 'Discussão desfixada.'));
    } catch (err: any) {
      Alert.alert(
        'Aviso',
        err.response?.data?.error || 'Apenas a moderação principal (pix@yelopsi.com.br) pode fixar ou desfixar discussões.'
      );
    }
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
              showToast('Denúncia enviada com sucesso para a moderação! 🛡️');
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

      showToast('Discussão publicada na comunidade! ✨');
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

  // Compartilhar link da discussão
  const handleSharePost = async (post: any) => {
    try {
      const url = `https://yelopsi.com.br/psi/forum?post=${post.id}`;
      await Clipboard.setStringAsync(url);
      showToast('Link da discussão copiado! 🔗');
    } catch {
      Alert.alert('Link', `https://yelopsi.com.br/psi/forum?post=${post.id}`);
    }
  };

  // =========================================================================
  // DISCUSSÃO ABERTA — réplica de psi_forum.js (post + árvore de comentários)
  // =========================================================================

  // Rola o campo ativo para a área visível acima do teclado / bottom nav
  const ensureVisible = useCallback((ref: React.RefObject<any>) => {
    const node = ref?.current;
    if (!node) return;
    node.measureInWindow((_x: number, y: number, _w: number, h: number) => {
      if (!h) return;
      const winH = Dimensions.get('window').height;
      const kb = keyboardHeightRef.current;
      const visibleBottom = winH - kb - (kb > 0 ? 24 : 120);
      const visibleTop = 90;
      const bottom = y + h;
      if (bottom > visibleBottom) {
        const diff = bottom - visibleBottom + 16;
        scrollRef.current?.scrollTo({
          y: scrollOffsetRef.current + diff,
          animated: true,
        });
      } else if (y < visibleTop) {
        scrollRef.current?.scrollTo({
          y: Math.max(0, scrollOffsetRef.current - (visibleTop - y) - 10),
          animated: true,
        });
      }
    });
  }, []);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: any) => {
      const h = e.endCoordinates?.height || 0;
      keyboardHeightRef.current = h;
      setKeyboardHeight(h);
      const targetPadding = Platform.OS === 'ios' ? (h || 300) : 16;
      Animated.timing(sheetBottomAnim, {
        toValue: targetPadding,
        duration: Platform.OS === 'ios' ? (e?.duration || 250) : 180,
        easing: Easing.bezier(0.33, 1, 0.68, 1),
        useNativeDriver: false,
      }).start();
      if (activeReplyRef.current) {
        setTimeout(() => {
          ensureVisible(activeReplyRef.current!);
        }, 60);
      }
    };

    const onHide = (e?: any) => {
      keyboardHeightRef.current = 0;
      setKeyboardHeight(0);
      Animated.timing(sheetBottomAnim, {
        toValue: BOTTOM_SHEET_PADDING,
        duration: Platform.OS === 'ios' ? (e?.duration || 250) : 180,
        easing: Easing.bezier(0.33, 1, 0.68, 1),
        useNativeDriver: false,
      }).start();
    };

    const s1 = Keyboard.addListener(showEvt, onShow);
    const s2 = Keyboard.addListener(hideEvt, onHide);

    return () => {
      s1.remove();
      s2.remove();
    };
  }, [ensureVisible]);

  const showEthicsAlert = (err: any): boolean => {
    if (err?.response?.status === 422) {
      const d = err.response.data || {};
      const reason = d.reason || d.error || 'Este conteúdo viola as diretrizes éticas da comunidade.';
      Alert.alert('Publicação não permitida', d.suggestion ? `${reason}\n\n${d.suggestion}` : reason);
      return true;
    }
    return false;
  };

  const bumpPostCommentCount = (postId: number, delta: number) => {
    setPosts(prev => prev.map(p => (p.id === postId ? { ...p, commentCount: Math.max(0, (p.commentCount || 0) + delta) } : p)));
    setActivePost((prev: any) => (prev && prev.id === postId ? { ...prev, commentCount: Math.max(0, (prev.commentCount || 0) + delta) } : prev));
  };

  // Busca uma página de comentários de nível superior (limit+1 para detectar "ver mais")
  const fetchTopComments = async (postId: number, pageNumber: number) => {
    const res = await api.get(
      `/api/forum/posts/${postId}/comments?page=${pageNumber}&limit=${COMMENTS_LIMIT + 1}&pageSize=${COMMENTS_LIMIT}`
    );
    let list: any[] = Array.isArray(res.data) ? res.data : (res.data?.comments || []);
    let more = false;
    if (list.length > COMMENTS_LIMIT) {
      more = true;
      list = list.slice(0, COMMENTS_LIMIT);
    }
    const total = parseInt(String(res.headers?.['x-total-count'] ?? '0'), 10) || 0;
    return { list, more, total };
  };

  // Abrir Detalhes do Post & Carregar Respostas
  const openPostDetails = async (post: any) => {
    setActivePost(post);
    setComments([]);
    setExpandedMap({});
    setActiveReplyId(null);
    setReplyPrefill(null);
    setCommentPage(1);
    setCommentsTotal(0);
    setHasMoreComments(false);
    setIsLoadingComments(true);
    scrollRef.current?.scrollTo({ y: 0, animated: false });

    // Dados completos do post (redirecionamento / encerramento)
    api.get(`/api/forum/posts/${post.id}`)
      .then(r => {
        if (r.data) setActivePost((prev: any) => (prev && prev.id === post.id ? { ...prev, ...r.data } : prev));
      })
      .catch(() => {});

    try {
      const { list, more, total } = await fetchTopComments(post.id, 1);
      setComments(list);
      setHasMoreComments(more);
      setCommentsTotal(total);
    } catch (e) {
      console.error("Erro ao carregar respostas:", e);
    } finally {
      setIsLoadingComments(false);
    }
  };

  const openPostById = async (postId: number) => {
    try {
      const res = await api.get(`/api/forum/posts/${postId}`);
      if (res.data) openPostDetails(res.data);
    } catch {
      Alert.alert('Aviso', 'Não foi possível abrir a discussão.');
    }
  };

  useEffect(() => {
    if (paramPostId) {
      const numericId = Number(paramPostId);
      if (!isNaN(numericId) && numericId > 0) {
        openPostById(numericId);
      }
    }
  }, [paramPostId, paramCommentId, paramTrigger]);

  const reloadComments = async () => {
    if (!activePost) return;
    try {
      const { list, more, total } = await fetchTopComments(activePost.id, 1);
      setComments(list);
      setCommentPage(1);
      setHasMoreComments(more);
      setCommentsTotal(total);
    } catch (e) {
      console.error("Erro ao recarregar comentários:", e);
    }
  };

  // Carregar Mais Comentários (Paginação)
  const handleLoadMoreComments = async () => {
    if (!activePost || isLoadingMoreComments) return;
    const nextPage = commentPage + 1;
    setIsLoadingMoreComments(true);
    try {
      const { list, more, total } = await fetchTopComments(activePost.id, nextPage);
      setComments(prev => {
        const seen = new Set(prev.map(c => c.id));
        return [...prev, ...list.filter(c => !seen.has(c.id))];
      });
      setCommentPage(nextPage);
      setHasMoreComments(more);
      if (total) setCommentsTotal(total);
    } catch (e) {
      console.error("Erro ao carregar mais comentários:", e);
    } finally {
      setIsLoadingMoreComments(false);
    }
  };

  const setExpanded = (id: number, value: boolean) => {
    setExpandedMap(prev => ({ ...prev, [id]: value }));
  };

  // "Responder": abre o campo de resposta exatamente sob o comentário clicado
  const handleToggleReply = (comment: ForumComment) => {
    if (activeReplyId === comment.id) {
      setActiveReplyId(null);
      setReplyPrefill(null);
      return;
    }
    const first = (comment.authorName || '').split(' ')[0];
    const mention = comment.isAnonymous || !first ? '' : `@${first} `;
    setReplyPrefill({ id: comment.id, text: mention, nonce: Date.now() });
    setActiveReplyId(comment.id);
  };

  const handleCancelReply = () => {
    setActiveReplyId(null);
    setReplyPrefill(null);
  };

  // Comentário principal (parentId: null)
  const handleSubmitMainComment = async (text: string, anonymous: boolean): Promise<boolean> => {
    if (!activePost) return false;
    try {
      const res = await api.post(`/api/forum/posts/${activePost.id}/comments`, {
        content: text,
        isAnonymous: anonymous,
        parentId: null,
      });
      const created: ForumComment = {
        ...res.data,
        isMine: true,
        likedByMe: false,
        replies: [],
        totalRepliesCount: 0,
        parentId: null,
        authorBadges: anonymous ? {} : (user as any)?.badges,
      };
      setComments(prev => [created, ...prev]);
      setCommentsTotal(t => t + 1);
      bumpPostCommentCount(activePost.id, 1);
      return true;
    } catch (e: any) {
      if (!showEthicsAlert(e)) {
        Alert.alert('Erro', e.response?.data?.error || e.response?.data?.reason || 'Erro ao enviar comentário.');
      }
      return false;
    }
  };

  // Resposta inline a um comentário / sub-resposta específico
  const handleSubmitReply = async (parentId: number, text: string): Promise<boolean> => {
    if (!activePost) return false;
    try {
      const res = await api.post(`/api/forum/posts/${activePost.id}/comments`, {
        content: text,
        isAnonymous: false,
        parentId,
      });
      const created: ForumComment = {
        ...res.data,
        isMine: true,
        likedByMe: false,
        replies: [],
        totalRepliesCount: 0,
        parentId,
        authorBadges: (user as any)?.badges,
      };
      setComments(prev => insertReply(prev, parentId, created));
      setExpanded(parentId, true);
      setActiveReplyId(null);
      setReplyPrefill(null);
      bumpPostCommentCount(activePost.id, 1);
      return true;
    } catch (e: any) {
      if (!showEthicsAlert(e)) {
        Alert.alert('Erro', e.response?.data?.error || e.response?.data?.reason || 'Erro ao enviar resposta.');
      }
      return false;
    }
  };

  // Gerar Comentário com IA (principal ou resposta inline)
  const handleGenerateAiComment = async (targetComment?: ForumComment) => {
    if (!activePost || aiLoadingId !== null) return;
    try {
      setAiLoadingId(targetComment ? targetComment.id : -1);
      const commentsContext = comments.slice(0, 3).map(c => `- ${c.content}`).join('\n');

      const payload: any = {
        postTitle: activePost.title,
        postContent: activePost.content,
        comments: commentsContext,
        authorName: activePost.authorName,
      };
      if (targetComment) {
        payload.targetComment = targetComment.content;
        payload.authorName = targetComment.authorName;
      }

      const res = await api.post('/api/forum/ai/generate-comment', payload);
      const generated = res.data?.generatedText;
      if (!generated) {
        Alert.alert('IA Yelo', 'Não foi possível gerar sugestão no momento.');
        return;
      }
      if (targetComment) {
        setReplyPrefill({ id: targetComment.id, text: generated, nonce: Date.now() });
        setActiveReplyId(targetComment.id);
      } else {
        composerRef.current?.setText(generated);
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        Alert.alert('IA Yelo', 'A geração de comentários fundamentados com IA está disponível para a moderação clínica.');
      } else {
        Alert.alert('Aviso', 'Não foi possível gerar resposta com IA no momento.');
      }
    } finally {
      setAiLoadingId(null);
    }
  };

  // Fixar / Desafixar comentário (Moderador) — recarrega a lista para reordenar
  const handlePinComment = async (comment: ForumComment) => {
    try {
      const res = await api.put(`/api/forum/comments/${comment.id}/pin`, { isPinned: !comment.isPinned });
      await reloadComments();
      showToast(res.data?.message || (comment.isPinned ? 'Comentário desafixado.' : 'Comentário fixado no topo! 📌'));
    } catch (err: any) {
      Alert.alert('Aviso', err.response?.data?.error || 'Apenas moderadores podem fixar comentários.');
    }
  };

  // Denúncia de Comentário
  const handleReportComment = (comment: ForumComment) => {
    Alert.alert(
      'Denunciar Comentário',
      'Deseja enviar este comentário para análise da moderação da Yelo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Denunciar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post('/api/forum/report', {
                targetType: 'comment',
                targetId: comment.id,
                reason: 'Violação das diretrizes éticas da comunidade',
              });
              showToast('Denúncia enviada com sucesso para a moderação! 🛡️');
            } catch (err: any) {
              Alert.alert('Aviso', 'Denúncia já registrada ou erro ao enviar.');
            }
          },
        },
      ]
    );
  };

  // Curtir Comentário (otimista, em qualquer nível da árvore)
  const handleVoteComment = async (commentId: number) => {
    const current = findNode(commentsRef.current, commentId);
    if (!current) return;
    const prevLiked = !!current.likedByMe;
    const prevLikes = current.likes || 0;

    setComments(prev =>
      updateNode(prev, commentId, c => ({
        ...c,
        likedByMe: !prevLiked,
        likes: prevLiked ? Math.max(0, prevLikes - 1) : prevLikes + 1,
      }))
    );

    try {
      await api.post(`/api/forum/comments/${commentId}/vote`);
    } catch (e) {
      setComments(prev => updateNode(prev, commentId, c => ({ ...c, likedByMe: prevLiked, likes: prevLikes })));
    }
  };

  // Editar comentário próprio
  const handleEditComment = async (commentId: number, text: string): Promise<boolean> => {
    try {
      const res = await api.put(`/api/forum/comments/${commentId}`, { content: text });
      const content = res.data?.content ?? text;
      setComments(prev => updateNode(prev, commentId, c => ({ ...c, content })));
      return true;
    } catch (e: any) {
      if (!showEthicsAlert(e)) Alert.alert('Erro', e.response?.data?.error || 'Erro ao atualizar.');
      return false;
    }
  };

  // Excluir Comentário (remove o nó e ajusta contadores dos ancestrais)
  const handleDeleteComment = (commentId: number) => {
    Alert.alert(
      'Excluir Comentário',
      'Deseja remover este comentário?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/forum/comments/${commentId}`);
              const wasTopLevel = commentsRef.current.some(c => c.id === commentId);
              const { list, removed } = removeNode(commentsRef.current, commentId);
              setComments(list);
              if (wasTopLevel) setCommentsTotal(t => Math.max(0, t - 1));
              if (activePost && removed > 0) bumpPostCommentCount(activePost.id, -removed);
              if (activeReplyId === commentId) handleCancelReply();
            } catch (err: any) {
              Alert.alert('Erro', 'Não foi possível excluir o comentário.');
            }
          },
        },
      ]
    );
  };

  const openEditPost = (post: any) => {
    (Alert as any).prompt
      ? (Alert as any).prompt(
          'Editar Discussão',
          'Altere o relato da discussão:',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Salvar',
              onPress: async (newTxt?: string) => {
                if (!newTxt?.trim()) return;
                try {
                  await api.put(`/api/forum/posts/${post.id}`, { content: newTxt.trim() });
                  setActivePost((prev: any) => (prev ? { ...prev, content: newTxt.trim() } : prev));
                  setPosts(prev => prev.map(p => (p.id === post.id ? { ...p, content: newTxt.trim() } : p)));
                  showToast('Discussão atualizada com sucesso! ✨');
                } catch {
                  Alert.alert('Erro', 'Não foi possível atualizar a discussão.');
                }
              },
            },
          ],
          'plain-text',
          post.content
        )
      : Alert.alert('Editar Post', 'Para editar a discussão completa, utilize a versão web da comunidade.');
  };

  const isDiscussionClosed = Boolean(activePost?.isClosed || activePost?.redirectPost?.id);
  const isMainAiAllowed = isUserAdmin && !isDiscussionClosed;
  const detailCat = activePost ? getCategoryStyle(activePost.category) : { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' };
  const remainingComments = activePost?.commentCount ? Math.max(0, activePost.commentCount - comments.length) : 0;

  const threadContext = useMemo<ThreadContextValue>(() => ({
    isAdmin: isUserAdmin,
    closed: isDiscussionClosed,
    userPhoto: user?.fotoUrl || (user as any)?.photo || null,
    expanded: expandedMap,
    activeReplyId,
    replyPrefill,
    aiLoadingId,
    setExpanded,
    onToggleReply: handleToggleReply,
    onCancelReply: handleCancelReply,
    onSubmitReply: handleSubmitReply,
    onLike: handleVoteComment,
    onDelete: handleDeleteComment,
    onReport: handleReportComment,
    onPin: handlePinComment,
    onEdit: handleEditComment,
    onAi: handleGenerateAiComment,
    ensureVisible,
    setActiveReplyRef: (r) => { activeReplyRef.current = r; },
  }), [
    isUserAdmin,
    isDiscussionClosed,
    user,
    expandedMap,
    activeReplyId,
    replyPrefill,
    aiLoadingId,
    ensureVisible,
  ]);

  return (
    <View style={styles.container}>
      {activePost ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 44 : 0}
        >
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            scrollEventThrottle={16}
            onScroll={(e) => { scrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
            stickyHeaderIndices={[0]}
            contentContainerStyle={{
              paddingHorizontal: 14,
              paddingBottom: keyboardHeight > 0 ? keyboardHeight + 80 : 170,
            }}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshingPost}
                onRefresh={async () => {
                  setIsRefreshingPost(true);
                  await openPostDetails(activePost);
                  setIsRefreshingPost(false);
                }}
                colors={['#1B4332']}
                tintColor="#1B4332"
              />
            }
          >
            {/* BARRA DE NAVEGAÇÃO (breadcrumb pill) — fixa no topo */}
            <View style={styles.detailNavWrap}>
              <View style={styles.detailNav}>
                <TouchableOpacity
                  onPress={() => { handleCancelReply(); setActivePost(null); }}
                  style={styles.navBackBtn}
                  activeOpacity={0.7}
                >
                  <View style={styles.navBackCircle}>
                    <Feather name="arrow-left" size={13} color="#334155" />
                  </View>
                  <Text style={styles.navBackText}>Fórum</Text>
                </TouchableOpacity>

                <Text style={styles.navSep}>›</Text>

                <View style={[styles.navCat, { backgroundColor: detailCat.bg, borderColor: detailCat.border }]}>
                  <View style={[styles.navCatDot, { backgroundColor: detailCat.text }]} />
                  <Text numberOfLines={1} style={[styles.navCatText, { color: detailCat.text }]}>
                    {activePost.category || 'Geral'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={{ gap: 14 }}>
              {/* Banner de redirecionamento oficial */}
              {activePost.redirectPost?.id ? (
                <View style={styles.redirectBanner}>
                  <Text style={{ fontSize: 22 }}>💡</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.redirectBannerTitle}>Aviso da Comunidade</Text>
                    <Text style={styles.redirectBannerText}>
                      Este assunto já possui um debate ativo em <Text style={{ fontStyle: 'italic' }}>"{activePost.redirectPost.title}"</Text>. Recomendamos concentrar as respostas por lá para centralizar o conhecimento!
                    </Text>
                    <TouchableOpacity
                      onPress={() => openPostById(activePost.redirectPost.id)}
                      style={styles.redirectBannerBtn}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.redirectBannerBtnText}>Abrir Discussão ➔</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {/* CARD 1: ARTIGO DA DISCUSSÃO ABERTA */}
              <View style={styles.pfCard}>
                <View style={styles.pfAuthorRow}>
                  <View style={styles.pfAvatarShadow}>
                    <ForumAvatar
                      uri={activePost.isAnonymous ? null : activePost.authorPhoto}
                      size={64}
                      border={2.5}
                      borderColor="#FFFFFF"
                    />
                  </View>

                  <View style={styles.pfMeta}>
                    <View style={styles.pfNameRow}>
                      <Text style={[styles.pfName, activePost.isAnonymous && { fontStyle: 'italic' }]}>
                        {activePost.isAnonymous ? 'Anônimo' : (activePost.authorName || 'Psicólogo(a)')}
                      </Text>
                      {!activePost.isAnonymous && <AuthorBadges badges={activePost.authorBadges} boxSize={20} />}
                      {activePost.isPinned && (
                        <View style={styles.pfPinnedPill}>
                          <PinIcon size={9} color="#92400E" />
                          <Text style={styles.pfPinnedText}>Fixado</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.pfIconsRow}>
                      <TouchableOpacity onPress={() => handleSharePost(activePost)} style={styles.iconCircle} activeOpacity={0.7}>
                        <ShareIcon size={13} color="#64748B" />
                      </TouchableOpacity>
                      {canPinPost(activePost) && (
                        <TouchableOpacity
                          onPress={() => handlePinPost(activePost)}
                          style={[styles.iconCircle, activePost.isPinned && styles.iconCirclePinned]}
                          activeOpacity={0.7}
                          accessibilityLabel={activePost.isPinned ? 'Desfixar discussão' : 'Fixar discussão no topo'}
                        >
                          <PinIcon size={13} color={activePost.isPinned ? '#92400E' : '#64748B'} />
                        </TouchableOpacity>
                      )}
                      {activePost.isMine && (
                        <TouchableOpacity onPress={() => openEditPost(activePost)} style={styles.iconCircle} activeOpacity={0.7}>
                          <EditIcon size={13} color="#64748B" />
                        </TouchableOpacity>
                      )}
                      {(activePost.isMine || isUserAdmin) && (
                        <TouchableOpacity onPress={() => handleDeletePost(activePost)} style={styles.iconCircle} activeOpacity={0.7}>
                          <TrashIcon size={13} color="#64748B" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Denunciar — canto superior direito */}
                  <TouchableOpacity onPress={() => handleReportPost(activePost)} style={styles.pfReportBtn} activeOpacity={0.7}>
                    <FlagIcon size={13} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.pfTitle}>{activePost.title}</Text>
                <MentionText text={activePost.content || ''} style={styles.pfBody} />

                <View style={styles.pfFooter}>
                  <TouchableOpacity
                    onPress={() => handleVotePost(activePost)}
                    activeOpacity={0.8}
                    style={[styles.supportBtn, activePost.supportedByMe && styles.supportBtnOn]}
                  >
                    <HeartIcon
                      size={13}
                      color={activePost.supportedByMe ? '#E11D48' : '#64748B'}
                      filled={!!activePost.supportedByMe}
                    />
                    <Text style={[styles.supportCount, activePost.supportedByMe && { color: '#BE123C' }]}>
                      {activePost.votes || 0}
                    </Text>
                    <Text style={[styles.supportLabel, activePost.supportedByMe && { color: '#BE123C' }]}>gostei</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* CARD 2: COMENTÁRIOS E TROCAS */}
              <View style={styles.pfCard}>
                <View style={styles.commentsHeader}>
                  <BubbleIcon size={22} color="#0F172A" />
                  <Text style={styles.commentsHeaderText}>Comentários e Trocas</Text>
                </View>

                {isDiscussionClosed ? (
                  <View style={styles.closedBox}>
                    <Text style={{ fontSize: 24, marginBottom: 6 }}>🔒</Text>
                    <Text style={styles.closedTitle}>
                      {activePost.redirectPost?.id ? 'Discussão Encerrada / Redirecionada' : 'Discussão Encerrada'}
                    </Text>
                    <Text style={styles.closedText}>
                      {activePost.redirectPost?.id
                        ? 'Este debate foi unificado com o tópico oficial para concentrar as respostas da comunidade. Novos comentários devem ser feitos na discussão principal.'
                        : 'Este debate foi encerrado para novas interações.'}
                    </Text>
                    {activePost.redirectPost?.id ? (
                      <TouchableOpacity
                        onPress={() => openPostById(activePost.redirectPost.id)}
                        style={styles.closedBtn}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.closedBtnText}>Ir para a Discussão Principal ➔</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : (
                  <MainComposer
                    ref={composerRef}
                    aiAllowed={isMainAiAllowed}
                    aiLoading={aiLoadingId === -1}
                    onGenerateAi={() => handleGenerateAiComment()}
                    onSubmit={handleSubmitMainComment}
                    ensureVisible={ensureVisible}
                  />
                )}

                {/* THREAD DE COMENTÁRIOS */}
                <ThreadContext.Provider value={threadContext}>
                  <View style={{ gap: 10 }}>
                    {isLoadingComments ? (
                      <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                        <ActivityIndicator color="#1B4332" />
                      </View>
                    ) : comments.length === 0 ? (
                      <Text style={styles.emptyThreadText}>Seja o primeiro a comentar nesta discussão!</Text>
                    ) : (
                      comments.map((comment) => <CommentNode key={comment.id} comment={comment} depth={0} />)
                    )}
                  </View>
                </ThreadContext.Provider>

                {/* Mostrar mais comentários */}
                {!isLoadingComments && hasMoreComments && (
                  <View style={{ alignItems: 'center', marginTop: 24 }}>
                    <TouchableOpacity
                      onPress={handleLoadMoreComments}
                      disabled={isLoadingMoreComments}
                      activeOpacity={0.85}
                      style={styles.loadMoreBtn}
                    >
                      {isLoadingMoreComments ? (
                        <Text style={styles.loadMoreText}>Carregando...</Text>
                      ) : (
                        <>
                          <Text style={styles.loadMoreText}>
                            {remainingComments > 0
                              ? `Mostrar mais ${remainingComments} ${remainingComments > 1 ? 'comentários' : 'comentário'}`
                              : 'Carregar mais comentários'}
                          </Text>
                          <ChevronDownIcon size={18} color="#1B4332" />
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <Text style={{ fontSize: 18 }}>🛡️</Text>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.guidelinesTitle}>
                  Regras e Boas Práticas da Comunidade
                </Text>
                <View style={styles.guidelinesBadge}>
                  <Text style={styles.guidelinesBadgeText}>ESPAÇO ÉTICO</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity 
              onPress={handleToggleRules}
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

          {/* Lista das 6 Regras Oficiais */}
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
                  <Text style={styles.guidelineBold}>Evite tópicos repetidos e interaja: </Text>
                  Ao criar um novo post, verifique se já não existe um anterior com o mesmo tema e, após publicar, interaja com os colegas que interagirem com ele.
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

          {/* Seletor Dropdown Nativo de Categorias */}
          <NativeSelectMenu
            options={FORUM_CATEGORIES.map((cat) => ({ label: cat, value: cat }))}
            selectedValue={selectedCategory}
            onSelect={(val) => setSelectedCategory(val)}
            style={{ width: '100%', marginBottom: 12 }}
          >
            <View style={[styles.categoryDropdownBtn, { marginBottom: 0 }]}>
              <Text style={styles.categoryDropdownText} numberOfLines={1}>
                {selectedCategory}
              </Text>
              <Feather name="chevron-down" size={16} color="#64748b" />
            </View>
          </NativeSelectMenu>

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
                  {/* Topo do Card: Foto 64px + Categoria ao lado (réplica fiel da Web Mobile) */}
                  <View style={styles.postCardTopRow}>
                    <TouchableOpacity 
                      activeOpacity={0.85} 
                      onPress={() => openPostDetails(post)}
                      style={styles.postAvatarShadow}
                    >
                      <ForumAvatar 
                        uri={authorPhoto} 
                        size={64} 
                        border={2} 
                        borderColor="#FFFFFF" 
                      />
                    </TouchableOpacity>

                    <View style={styles.postTopCategoryWrap}>
                      {post.isPinned && (
                        <View style={styles.pinnedPill}>
                          <PinIcon size={10} color="#92400E" />
                          <Text style={styles.pinnedPillText}>Fixado</Text>
                        </View>
                      )}
                      {(post.isClosed || post.redirectPostId) && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 10.5, fontFamily: 'Inter_700Bold', color: '#475569' }}>
                            {post.redirectPostId ? '↪ Redirecionado' : '🔒 Encerrado'}
                          </Text>
                        </View>
                      )}
                      <View style={[
                        styles.categoryPill,
                        { backgroundColor: catStyle.bg, borderColor: catStyle.border }
                      ]}>
                        <Text style={[styles.categoryPillText, { color: catStyle.text }]} numberOfLines={1}>
                          {post.category || 'Geral'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Linha do Autor: por Nome + Badges + Tempo Decorrido */}
                  <View style={styles.postAuthorMetaRow}>
                    <Text style={styles.authorPrefix}>por </Text>
                    <Text style={[styles.authorNameText, post.isAnonymous && { fontStyle: 'italic' }]}>
                      {authorName}
                    </Text>
                    {!post.isAnonymous && <AuthorBadges badges={post.authorBadges} marginLeft={4} />}
                    <Text style={styles.postTimeText}>
                      {' '}• há {formatTimeAgo(post.createdAt)}
                    </Text>
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

                  {/* Barra de Ações do Rodapé (Apoiar, Respostas, Excluir, Denunciar) */}
                  <View style={styles.postActionsFooter}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {/* Botão Apoiar (Coração) */}
                      <TouchableOpacity 
                        onPress={() => handleVotePost(post)}
                        style={[
                          styles.actionPillBtn,
                          isVoted && styles.actionPillBtnVoted
                        ]}
                        activeOpacity={0.7}
                      >
                        <HeartIcon 
                          size={15} 
                          color={isVoted ? "#E11D48" : "#64748B"} 
                          filled={isVoted}
                        />
                        <Text style={[
                          styles.actionPillCount,
                          isVoted && { color: '#BE123C' }
                        ]}>
                          {post.votes || 0}
                        </Text>
                      </TouchableOpacity>

                      {/* Botão Respostas */}
                      <TouchableOpacity 
                        onPress={() => openPostDetails(post)}
                        style={styles.actionPillBtn}
                        activeOpacity={0.7}
                      >
                        <BubbleIcon size={15} color="#64748B" />
                        <Text style={styles.actionPillText}>
                          {commentCount} {commentCount === 1 ? 'comentário' : 'comentários'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Ações da Direita */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {canPinPost(post) && (
                        <TouchableOpacity
                          onPress={() => handlePinPost(post)}
                          style={[styles.postSmallActionBtn, post.isPinned && styles.postSmallActionBtnPinned]}
                          activeOpacity={0.7}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityLabel={post.isPinned ? 'Desfixar discussão' : 'Fixar discussão no topo'}
                        >
                          <PinIcon size={14} color={post.isPinned ? '#92400E' : '#94A3B8'} />
                        </TouchableOpacity>
                      )}

                      {post.isMine && (
                        <TouchableOpacity 
                          onPress={() => handleDeletePost(post)}
                          style={styles.postSmallActionBtn}
                          activeOpacity={0.7}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <TrashIcon size={14} color="#DC2626" />
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity 
                        onPress={() => handleReportPost(post)}
                        style={styles.postSmallActionBtn}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <FlagIcon size={15} color="#94A3B8" />
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
        </>
      )}

      {/* ======================================================== */}
      {/* MODAL: NOVA DISCUSSÃO (BOTTOM SHEET YELO IGUAL AO BLOG) */}
      {/* ======================================================== */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          Keyboard.dismiss();
          setModalVisible(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              Keyboard.dismiss();
              setModalVisible(false);
            }}
          />
          <Animated.View
            style={[
              styles.createModalCard,
              { paddingBottom: sheetBottomAnim }
            ]}
          >
            {/* Header do Modal */}
            <Pressable onPress={() => Keyboard.dismiss()} style={styles.createModalHeaderWrap}>
              <View style={styles.sheetDragHandle} />
              <View style={styles.createModalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <View style={styles.createModalIconBox}>
                    <Text style={{ fontSize: 18 }}>💬</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.createModalTitle}>Nova Discussão</Text>
                    <Text style={styles.createModalSubtitle} numberOfLines={1}>
                      Troque conhecimentos respeitando o sigilo ético.
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    Keyboard.dismiss();
                    setModalVisible(false);
                  }}
                  style={styles.modalCloseBtn}
                  activeOpacity={0.7}
                >
                  <Feather name="x" size={18} color="#64748b" />
                </TouchableOpacity>
              </View>
            </Pressable>

            {/* Scroll do Formulário com altura responsiva */}
            <ScrollView
              ref={formScrollRef}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              showsVerticalScrollIndicator={false}
              style={{ flexGrow: 0, flexShrink: 1 }}
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 }}
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
                <Text
                  style={[
                    styles.charCounter,
                    newTitle.length >= 150 ? { color: '#e63946', fontWeight: 'bold' } : {},
                  ]}
                >
                  {newTitle.length}/150 caracteres
                </Text>
              </View>

              {/* Campo: Categoria (Dropdown Nativo do OS) */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>CATEGORIA *</Text>
                <NativeSelectMenu
                  options={FORUM_CATEGORIES.filter(c => c !== 'Todas as Categorias').map((cat) => ({
                    label: cat,
                    value: cat,
                  }))}
                  selectedValue={newCategory}
                  onSelect={(val) => setNewCategory(val)}
                  style={{ width: '100%' }}
                >
                  <View style={styles.modalCategorySelectBtn}>
                    <Text style={styles.modalCategorySelectText} numberOfLines={1}>
                      {newCategory}
                    </Text>
                    <Feather name="chevron-down" size={16} color="#64748b" />
                  </View>
                </NativeSelectMenu>
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
                  onFocus={() => {
                    setTimeout(() => {
                      formScrollRef.current?.scrollToEnd({ animated: true });
                    }, 100);
                  }}
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
            </ScrollView>

            {/* Ações do Rodapé: FIXAS NA BASE DO MODAL EM LINHA ÚNICA (IGUAL AO BLOG) */}
            <View style={styles.modalFormFooter}>
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  setModalVisible(false);
                }}
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
          </Animated.View>
        </View>
      </Modal>

      {/* Notificação Flutuante em Pílula (Estilo WhatsApp) */}
      <YeloToast message={toastMessage} onDismiss={() => setToastMessage(null)} />
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
    gap: 10,
  },
  guidelinesTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1B4332',
    lineHeight: 18,
  },
  guidelinesBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 50,
    alignSelf: 'flex-start',
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
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  postCardPinned: {
    borderLeftWidth: 4,
    borderLeftColor: '#2D6A4F',
    backgroundColor: '#FBFDFB',
  },
  postCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 10,
  },
  postAvatarShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  postTopCategoryWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  pinnedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  pinnedPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#92400E',
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 50,
    borderWidth: 1,
  },
  categoryPillText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  categoryPillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  postAuthorMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  authorPrefix: {
    fontSize: 12,
    color: '#94A3B8',
  },
  authorNameText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  postTimeText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  postTitleText: {
    fontFamily: 'NewKansas-Bold',
    fontSize: 18.5,
    lineHeight: 25,
    color: '#0F172A',
    marginTop: 4,
    marginBottom: 6,
  },
  postSnippetText: {
    fontSize: 13.5,
    lineHeight: 20,
    color: '#475569',
    marginBottom: 14,
  },
  postActionsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  actionPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 50,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  actionPillBtnVoted: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
  },
  actionPillCount: {
    fontSize: 12.5,
    fontWeight: '700',
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
  postSmallActionBtnPinned: {
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
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

  // MODAL CRIAR (ESTILO BOTTOM SHEET NATIVO YELO IGUAL AO BLOG)
  createModalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '94%',
    flexShrink: 1,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  createModalHeaderWrap: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingTop: 10,
  },
  createModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
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
  charCounter: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'right',
    marginTop: 4,
  },
  modalCategorySelectBtn: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalCategorySelectText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1B4332',
    flex: 1,
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
    minHeight: 120,
    textAlignVertical: 'top',
  },
  anonymousCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
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
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#ffffff',
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

  // ========================================================
  // ESTILOS MODERNOS DO POST ABERTO (réplica de psi_forum.html)
  // ========================================================
  detailNavWrap: {
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
    zIndex: 10,
  },
  detailNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 50,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  navBackCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBackText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  navSep: {
    fontSize: 14,
    color: '#94A3B8',
    marginHorizontal: 2,
  },
  navCat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 50,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: '55%',
  },
  navCatDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  navCatText: {
    fontSize: 12,
    fontWeight: '700',
  },
  redirectBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    borderRadius: 16,
    padding: 14,
    marginTop: 4,
  },
  redirectBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E40AF',
    marginBottom: 4,
  },
  redirectBannerText: {
    fontSize: 12.5,
    color: '#1E3A8A',
    lineHeight: 18,
    marginBottom: 8,
  },
  redirectBannerBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#1E40AF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  redirectBannerBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pfCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  pfAuthorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  pfAvatarShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  pfMeta: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  pfNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
  },
  pfName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  pfPinnedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  pfPinnedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
  },
  pfIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCirclePinned: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  pfReportBtn: {
    padding: 6,
  },
  pfTitle: {
    fontFamily: 'NewKansas-Bold',
    fontSize: 22,
    lineHeight: 28,
    color: '#0F172A',
    marginTop: 14,
    marginBottom: 10,
  },
  pfBody: {
    fontSize: 15,
    lineHeight: 24,
    color: '#334155',
    marginBottom: 16,
  },
  pfFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  supportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 50,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  supportBtnOn: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
  },
  supportCount: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#475569',
  },
  supportLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  commentsHeaderText: {
    fontFamily: 'NewKansas-Bold',
    fontSize: 19,
    color: '#0F172A',
  },
  closedBox: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  closedTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  closedText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 10,
  },
  closedBtn: {
    backgroundColor: '#1B4332',
    borderRadius: 50,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  closedBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyThreadText: {
    fontSize: 13.5,
    color: '#64748B',
    textAlign: 'center',
    paddingVertical: 20,
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 50,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  loadMoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1B4332',
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
