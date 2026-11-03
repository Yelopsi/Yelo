import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import YeloScrollView from '../../components/YeloScrollView';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import api, { getBaseUrl } from '../../services/api';

const ARTICLES_LIMIT = 3;

const FALLBACK_SUGESTOES = [
  'Relacionamentos e Afeto',
  'Carreira e Trabalho',
  'Ansiedade e Estresse',
  'Autoestima e Autoconhecimento',
  'Depressão e Desânimo',
  'Luto e Traumas',
];

interface Post {
  id: number;
  titulo: string;
  conteudo: string;
  imagem_url?: string | null;
  curtidas?: number;
  createdAt?: string;
  created_at?: string;
  slug?: string;
}

export default function BlogScreen() {
  const router = useRouter();
  const formScrollRef = useRef<any>(null);
  const contentInputRef = useRef<any>(null);
  const selectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  // Estados da Listagem
  const [posts, setPosts] = useState<Post[]>([]);
  const [sugestoes, setSugestoes] = useState<string[]>(FALLBACK_SUGESTOES.slice(0, 3));
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Estados do Modal de Criação / Edição
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Estados de Formatação do Conteúdo & Seleção
  const [currentHeader, setCurrentHeader] = useState<'Normal' | 'Título 2' | 'Título 3'>('Normal');
  const [showHeaderOptions, setShowHeaderOptions] = useState(false);

  // Estado do Modal de Preview / Visualização
  const [previewPost, setPreviewPost] = useState<Post | null>(null);

  // Helper para limpar HTML e manter quebras de linha
  const stripHtml = (html?: string) => {
    if (!html) return '';
    return html
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();
  };

  // Helper para resolver URL da imagem
  const resolveImageUrl = (path?: string | null) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    const base = getBaseUrl();
    const clean = path.startsWith('/') ? path : `/${path}`;
    return `${base}${clean}`;
  };

  // Helper para data formatada por extenso em português
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Aplicação instantânea de formatação de texto (sem perder seleção)
  const applyFormat = (format: string) => {
    let { start, end } = selectionRef.current;
    if (start > end) {
      const tmp = start;
      start = end;
      end = tmp;
    }
    const hasSelection = start !== end;
    const selectedText = hasSelection ? content.substring(start, end) : '';
    const before = content.substring(0, start);
    const after = content.substring(end);

    let replacement = '';
    switch (format) {
      case 'bold':
        replacement = hasSelection ? `<b>${selectedText}</b>` : '<b>negrito</b>';
        break;
      case 'italic':
        replacement = hasSelection ? `<i>${selectedText}</i>` : '<i>itálico</i>';
        break;
      case 'underline':
        replacement = hasSelection ? `<u>${selectedText}</u>` : '<u>sublinhado</u>';
        break;
      case 'strike':
        replacement = hasSelection ? `<s>${selectedText}</s>` : '<s>tachado</s>';
        break;
      case 'h2':
        replacement = hasSelection ? `\n<h2>${selectedText}</h2>\n` : '\n<h2>Título</h2>\n';
        break;
      case 'h3':
        replacement = hasSelection ? `\n<h3>${selectedText}</h3>\n` : '\n<h3>Subtítulo</h3>\n';
        break;
      case 'bullet':
        if (hasSelection) {
          const lines = selectedText.split('\n').filter(l => l.trim().length > 0);
          replacement = `\n<ul>\n${lines.map(l => `  <li>${l}</li>`).join('\n')}\n</ul>\n`;
        } else {
          replacement = '\n<ul>\n  <li>Item</li>\n</ul>\n';
        }
        break;
      case 'number':
        if (hasSelection) {
          const lines = selectedText.split('\n').filter(l => l.trim().length > 0);
          replacement = `\n<ol>\n${lines.map(l => `  <li>${l}</li>`).join('\n')}\n</ol>\n`;
        } else {
          replacement = '\n<ol>\n  <li>Item 1</li>\n</ol>\n';
        }
        break;
      case 'link':
        replacement = hasSelection
          ? `<a href="https://">${selectedText}</a>`
          : '<a href="https://exemplo.com">link</a>';
        break;
      case 'clean':
        if (hasSelection) {
          replacement = selectedText.replace(/<[^>]+>/g, '');
        } else {
          setContent(content.replace(/<[^>]+>/g, ''));
          return;
        }
        break;
      default:
        return;
    }

    const updatedContent = `${before}${replacement}${after}`;
    setContent(updatedContent);
    const newPos = start + replacement.length;
    selectionRef.current = { start: newPos, end: newPos };
  };

  // Carregar sugestões de temas da plataforma
  const fetchSugestoes = async () => {
    try {
      const res = await api.get('/api/psychologists/me/stats?period=last90days');
      if (res.data?.topDemands && Array.isArray(res.data.topDemands) && res.data.topDemands.length > 0) {
        const top = res.data.topDemands
          .map((item: any) => item.name || item.topic || item)
          .filter(Boolean)
          .slice(0, 3);
        if (top.length > 0) {
          setSugestoes(top);
          return;
        }
      }
    } catch (e) {
      console.log('Usando sugestões padrão de temas:', e);
    }
    setSugestoes(FALLBACK_SUGESTOES.slice(0, 3));
  };

  // Carregar posts paginados
  const fetchPosts = async (page = 1, append = false) => {
    try {
      if (!append) setIsLoading(true);
      else setIsLoadingMore(true);

      const res = await api.get(`/api/psychologists/me/posts?page=${page}&limit=${ARTICLES_LIMIT}`);
      const data: Post[] = Array.isArray(res.data) ? res.data : [];

      setHasMore(data.length === ARTICLES_LIMIT);
      setCurrentPage(page);

      if (append) {
        setPosts(prev => [...prev, ...data]);
      } else {
        setPosts(data);
      }
    } catch (e) {
      console.error('Erro ao carregar posts:', e);
      if (!append) {
        Alert.alert('Erro', 'Não foi possível carregar seus posts. Puxe para atualizar.');
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPosts(1, false);
    fetchSugestoes();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPosts(1, false);
    fetchSugestoes();
  }, []);

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchPosts(currentPage + 1, true);
    }
  };

  // Abrir Modal para Novo Post
  const handleOpenNewPost = (suggestedTitle?: string) => {
    setEditingPostId(null);
    setTitle(suggestedTitle || '');
    setContent('');
    setImageUri(null);
    setImageName(null);
    setExistingImageUrl(null);
    setShowHeaderOptions(false);
    setCurrentHeader('Normal');
    selectionRef.current = { start: 0, end: 0 };
    setModalVisible(true);
  };

  // Abrir Modal para Edição
  const handleOpenEditPost = (post: Post) => {
    setEditingPostId(post.id);
    setTitle(post.titulo || '');
    setContent(post.conteudo || '');
    setImageUri(null);
    setImageName(null);
    setExistingImageUrl(post.imagem_url || null);
    setShowHeaderOptions(false);
    setCurrentHeader('Normal');
    selectionRef.current = { start: 0, end: 0 };
    setModalVisible(true);
  };

  // Selecionar imagem da galeria
  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        setImageName(asset.fileName || 'imagem_capa.jpg');
        setExistingImageUrl(null);
      }
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível acessar a galeria de fotos.');
    }
  };

  // Remover imagem selecionada
  const handleRemoveImage = () => {
    setImageUri(null);
    setImageName(null);
    setExistingImageUrl(null);
  };

  // Otimizar com IA (Revisar Ortografia e Gramática)
  const handleOptimizeAI = async () => {
    const plainText = stripHtml(content);
    if (plainText.length < 30) {
      Alert.alert(
        'Aviso',
        'Escreva pelo menos um rascunho de post (mínimo de 30 caracteres) para a IA poder revisar.'
      );
      return;
    }

    try {
      setIsOptimizing(true);
      const res = await api.post('/api/psychologists/me/optimize-article', {
        title: title.trim(),
        content: content.trim(),
      });

      if (res.data) {
        if (res.data.titulo) setTitle(res.data.titulo);
        if (res.data.conteudo) setContent(res.data.conteudo);
        Alert.alert('Sucesso ✨', 'Post revisado com sucesso pela Inteligência Artificial!');
      }
    } catch (e: any) {
      Alert.alert('Erro', e.response?.data?.error || 'Erro ao revisar post com IA.');
    } finally {
      setIsOptimizing(false);
    }
  };

  // Salvar Post (Criação ou Atualização)
  const handleSavePost = async () => {
    if (!title.trim()) {
      Alert.alert('Aviso', 'Por favor, informe o título do post.');
      return;
    }
    if (!content.trim()) {
      Alert.alert('Aviso', 'Por favor, escreva o conteúdo do post.');
      return;
    }

    try {
      setIsSubmitting(true);

      const formData = new FormData();
      formData.append('titulo', title.trim());
      formData.append('conteudo', content.trim());

      if (imageUri) {
        const filename = imageName || imageUri.split('/').pop() || 'capa.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const ext = match ? match[1].toLowerCase() : 'jpg';
        const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

        formData.append('imagem', {
          uri: imageUri,
          name: filename,
          type: type,
        } as any);
      } else if (existingImageUrl) {
        formData.append('imagem_url', existingImageUrl);
      } else {
        formData.append('imagem_url', '');
      }

      if (editingPostId) {
        await api.put(`/api/psychologists/me/posts/${editingPostId}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        Alert.alert('Atualizado! 🎉', 'Seu post foi atualizado com sucesso.');
      } else {
        await api.post('/api/psychologists/me/posts', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        Alert.alert('Publicado! 🚀', 'Seu post foi publicado com sucesso no Blog Yelo.');
      }

      setModalVisible(false);
      fetchPosts(1, false);
    } catch (e: any) {
      Alert.alert('Erro', e.response?.data?.error || 'Não foi possível salvar o post.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Excluir Post com Confirmação
  const handleDeletePost = (post: Post) => {
    Alert.alert(
      'Excluir Post',
      `Tem certeza que deseja apagar o post "${post.titulo}"?\nEssa ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await api.delete(`/api/psychologists/me/posts/${post.id}`);
              if (res.data?.pointsDeducted) {
                Alert.alert('Post Excluído', `Post excluído. Você perdeu ${res.data.pointsDeducted} XP.`);
              } else {
                Alert.alert('Sucesso', 'Post excluído com sucesso.');
              }
              fetchPosts(1, false);
            } catch (e: any) {
              Alert.alert('Erro', e.response?.data?.error || 'Erro ao excluir post.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <YeloScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1B4332']} />
        }
      >
        {/* HERO HEADER */}
        <View style={styles.heroCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
              activeOpacity={0.8}
            >
              <Feather name="arrow-left" size={20} color="#ffffff" />
            </TouchableOpacity>

            <View style={styles.heroBadge}>
              <Text style={{ fontSize: 13 }}>🌿</Text>
              <Text style={styles.heroBadgeText}>Produção de Conteúdo & Artigos</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>Meus Posts ✍️</Text>
          <Text style={styles.heroSubtitle}>
            Compartilhe suas ideias e reflexões clínicas! Posts autênticos geram identificação, autoridade e confiança para novos pacientes.
          </Text>
        </View>

        {/* WIDGET: TEMAS EM ALTA */}
        <View style={styles.widgetTemas}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <View style={styles.iconBoxAmber}>
              <Text style={{ fontSize: 18 }}>💡</Text>
            </View>
            <Text style={styles.widgetTemasTitle}>Temas em Alta</Text>
          </View>

          <Text style={styles.widgetTemasSubtitle}>
            Inspire-se nos assuntos mais buscados pelos pacientes na plataforma para criar seu próximo post.
          </Text>

          <View style={styles.sugestoesGrid}>
            {sugestoes.map((tema, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => handleOpenNewPost(tema)}
                style={styles.sugestaoPill}
                activeOpacity={0.75}
              >
                <Text style={styles.sugestaoPillText}>✍️ {tema}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* SEÇÃO: SEUS POSTS */}
        <View style={{ marginHorizontal: 20 }}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.iconBoxGreen}>
                <Text style={{ fontSize: 18 }}>📚</Text>
              </View>
              <Text style={styles.sectionTitle}>Seus Posts</Text>
            </View>

            <TouchableOpacity
              onPress={() => handleOpenNewPost()}
              style={styles.btnNovoPost}
              activeOpacity={0.85}
            >
              <Text style={styles.btnNovoPostPlus}>+</Text>
              <Text style={styles.btnNovoPostText}>Escrever Novo Post</Text>
            </TouchableOpacity>
          </View>

          {/* LISTA DE POSTS */}
          {isLoading && !refreshing ? (
            <View style={styles.loaderBox}>
              <ActivityIndicator size="large" color="#1B4332" />
              <Text style={styles.loaderText}>Carregando seus posts...</Text>
            </View>
          ) : posts.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={{ fontSize: 44, marginBottom: 12 }}>📝</Text>
              <Text style={styles.emptyTitle}>Você ainda não tem posts publicados.</Text>
              <Text style={styles.emptySubtitle}>
                Compartilhar ideias e reflexões ajuda visitantes a conhecerem como você pensa e trabalha.
              </Text>
              <TouchableOpacity
                onPress={() => handleOpenNewPost()}
                style={styles.btnEmptyCreate}
                activeOpacity={0.85}
              >
                <Text style={styles.btnEmptyCreateText}>+ Escrever Primeiro Post</Text>
              </TouchableOpacity>
            </View>
          ) : (
            posts.map(post => {
              const fullImageUrl = resolveImageUrl(post.imagem_url);
              const dataFormatada = formatDate(post.createdAt || post.created_at);
              const excerpt = stripHtml(post.conteudo);

              return (
                <TouchableOpacity
                  key={post.id}
                  onPress={() => setPreviewPost(post)}
                  activeOpacity={0.92}
                  style={styles.postCard}
                >
                  {/* Capa do Post (se houver) */}
                  {fullImageUrl ? (
                    <View style={styles.postImageWrapper}>
                      <Image
                        source={{ uri: fullImageUrl }}
                        style={styles.postImage}
                        resizeMode="cover"
                      />
                    </View>
                  ) : null}

                  {/* Título */}
                  <Text style={styles.postTitle}>{post.titulo}</Text>

                  {/* Resumo do Conteúdo */}
                  {excerpt ? (
                    <Text style={styles.postExcerpt} numberOfLines={3}>
                      {excerpt}
                    </Text>
                  ) : null}

                  {/* Metadados: Data e Curtidas */}
                  <View style={styles.postMetaRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.postDate}>📅 {dataFormatada}</Text>
                    </View>
                    <View style={styles.postLikes}>
                      <Feather name="heart" size={14} color="#e63946" />
                      <Text style={styles.postLikesText}>{post.curtidas || 0}</Text>
                    </View>
                  </View>

                  {/* Grupo de Ações: Editar e Excluir */}
                  <View style={styles.postActionsGroup}>
                    <TouchableOpacity
                      onPress={() => handleOpenEditPost(post)}
                      style={styles.btnAcaoEditar}
                      activeOpacity={0.8}
                    >
                      <Feather name="edit-2" size={13} color="#166534" />
                      <Text style={styles.btnAcaoEditarText}>Editar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleDeletePost(post)}
                      style={styles.btnAcaoExcluir}
                      activeOpacity={0.8}
                    >
                      <Feather name="trash-2" size={13} color="#b91c1c" />
                      <Text style={styles.btnAcaoExcluirText}>Excluir</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })
          )}

          {/* BOTÃO MOSTRAR MAIS */}
          {hasMore && !isLoading && (
            <View style={{ alignItems: 'center', marginTop: 12, marginBottom: 20 }}>
              <TouchableOpacity
                onPress={handleLoadMore}
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
            </View>
          )}
        </View>
      </YeloScrollView>

      {/* MODAL: NOVO / EDITAR POST (BOTTOM SHEET YELO) */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.bottomSheetCard}>
            {/* Header do Modal */}
            <View style={styles.modalHeader}>
              <View style={styles.sheetDragHandle} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <View style={styles.modalIconBox}>
                    <Text style={{ fontSize: 18 }}>📝</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalHeaderTitle}>
                      {editingPostId ? 'Editar Post' : 'Novo Post'}
                    </Text>
                    <Text style={styles.modalHeaderSubtitle} numberOfLines={1}>
                      Compartilhe com naturalidade sua visão clínica.
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  style={styles.modalCloseButton}
                  activeOpacity={0.7}
                >
                  <Feather name="x" size={18} color="#666666" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Scroll do Formulário com altura ajustada ao conteúdo */}
            <ScrollView
              ref={formScrollRef}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 }}
            >
              {/* Campo: Título do Post */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>TÍTULO DO POST *</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  maxLength={50}
                  placeholder="Ex: A importância da terapia..."
                  placeholderTextColor="#9ca3af"
                  style={styles.inputTextInput}
                />
                <Text
                  style={[
                    styles.charCounter,
                    title.length >= 50 ? { color: '#e63946', fontWeight: 'bold' } : {},
                  ]}
                >
                  {title.length}/50 caracteres
                </Text>
              </View>

              {/* Campo: Capa do Post */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>CAPA DO POST</Text>
                {imageUri || existingImageUrl ? (
                  <View style={styles.imageSelectedBox}>
                    <Image
                      source={{ uri: imageUri || resolveImageUrl(existingImageUrl) || '' }}
                      style={styles.imagePreviewThumb}
                      resizeMode="cover"
                    />
                    <View style={{ flex: 1, marginHorizontal: 10 }}>
                      <Text style={styles.imageSelectedName} numberOfLines={1}>
                        {imageName || (imageUri ? 'Nova imagem selecionada' : 'Capa atual do post')}
                      </Text>
                      <TouchableOpacity onPress={handlePickImage} activeOpacity={0.7}>
                        <Text style={styles.imageChangeText}>Alterar foto</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      onPress={handleRemoveImage}
                      style={styles.imageRemoveBtn}
                      activeOpacity={0.7}
                    >
                      <Feather name="trash-2" size={16} color="#d32f2f" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={handlePickImage}
                    style={styles.imageUploadPlaceholder}
                    activeOpacity={0.75}
                  >
                    <Feather name="paperclip" size={16} color="#6b7280" />
                    <Text style={styles.imageUploadText}>
                      Nenhuma imagem selecionada...
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Campo: Conteúdo com Toolbar de Formatação Robusta */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>CONTEÚDO *</Text>

                {/* Caixa Unificada do Editor */}
                <View style={styles.editorBoxContainer}>
                  {/* Barra de Ferramentas de Formatação (Sem ScrollView para garantir toque imediato) */}
                  <View style={styles.editorToolbar}>
                    {/* Seletor Normal / Título */}
                    <TouchableOpacity
                      onPress={() => setShowHeaderOptions(prev => !prev)}
                      style={styles.toolbarDropdown}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.toolbarDropdownText}>{currentHeader}</Text>
                      <Feather name="chevron-down" size={12} color="#4b5563" style={{ marginLeft: 2 }} />
                    </TouchableOpacity>

                    <View style={styles.toolbarDivider} />

                    {/* B (Negrito) */}
                    <TouchableOpacity
                      onPress={() => applyFormat('bold')}
                      style={styles.toolbarBtn}
                      activeOpacity={0.6}
                    >
                      <Text style={styles.toolbarBoldText}>B</Text>
                    </TouchableOpacity>

                    {/* I (Itálico) */}
                    <TouchableOpacity
                      onPress={() => applyFormat('italic')}
                      style={styles.toolbarBtn}
                      activeOpacity={0.6}
                    >
                      <Text style={styles.toolbarItalicText}>I</Text>
                    </TouchableOpacity>

                    {/* U (Sublinhado) */}
                    <TouchableOpacity
                      onPress={() => applyFormat('underline')}
                      style={styles.toolbarBtn}
                      activeOpacity={0.6}
                    >
                      <Text style={styles.toolbarUnderlineText}>U</Text>
                    </TouchableOpacity>

                    {/* S (Tachado) */}
                    <TouchableOpacity
                      onPress={() => applyFormat('strike')}
                      style={styles.toolbarBtn}
                      activeOpacity={0.6}
                    >
                      <Text style={styles.toolbarStrikeText}>S</Text>
                    </TouchableOpacity>

                    <View style={styles.toolbarDivider} />

                    {/* Lista Numerada 1. */}
                    <TouchableOpacity
                      onPress={() => applyFormat('number')}
                      style={styles.toolbarBtn}
                      activeOpacity={0.6}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ fontSize: 9, fontWeight: '700', color: '#374151', marginRight: 1 }}>1</Text>
                        <Feather name="list" size={13} color="#374151" />
                      </View>
                    </TouchableOpacity>

                    {/* Lista Marcadores • */}
                    <TouchableOpacity
                      onPress={() => applyFormat('bullet')}
                      style={styles.toolbarBtn}
                      activeOpacity={0.6}
                    >
                      <Feather name="list" size={14} color="#374151" />
                    </TouchableOpacity>

                    <View style={styles.toolbarDivider} />

                    {/* Link */}
                    <TouchableOpacity
                      onPress={() => applyFormat('link')}
                      style={styles.toolbarBtn}
                      activeOpacity={0.6}
                    >
                      <Feather name="link" size={13} color="#374151" />
                    </TouchableOpacity>

                    {/* Limpar Formatação Tx */}
                    <TouchableOpacity
                      onPress={() => applyFormat('clean')}
                      style={styles.toolbarBtn}
                      activeOpacity={0.6}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#374151' }}>T</Text>
                        <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#6b7280' }}>x</Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  {/* Dropdown Menu Flutuante para Seleção de Títulos */}
                  {showHeaderOptions && (
                    <View style={styles.headerDropdownMenu}>
                      <TouchableOpacity
                        onPress={() => {
                          setCurrentHeader('Normal');
                          setShowHeaderOptions(false);
                        }}
                        style={styles.headerDropdownItem}
                      >
                        <Text style={[styles.headerDropdownItemText, currentHeader === 'Normal' && styles.headerDropdownItemActive]}>
                          Normal
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          setCurrentHeader('Título 2');
                          setShowHeaderOptions(false);
                          applyFormat('h2');
                        }}
                        style={styles.headerDropdownItem}
                      >
                        <Text style={[styles.headerDropdownItemText, currentHeader === 'Título 2' && styles.headerDropdownItemActive, { fontSize: 14, fontWeight: 'bold' }]}>
                          Título 2 (H2)
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          setCurrentHeader('Título 3');
                          setShowHeaderOptions(false);
                          applyFormat('h3');
                        }}
                        style={styles.headerDropdownItem}
                      >
                        <Text style={[styles.headerDropdownItemText, currentHeader === 'Título 3' && styles.headerDropdownItemActive, { fontSize: 13, fontWeight: '600' }]}>
                          Título 3 (H3)
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Área de Digitação do Conteúdo */}
                  <TextInput
                    ref={contentInputRef}
                    multiline
                    placeholder="Comece a escrever seu post aqui..."
                    placeholderTextColor="#9ca3af"
                    value={content}
                    onChangeText={setContent}
                    onSelectionChange={(e) => {
                      const sel = e.nativeEvent.selection;
                      selectionRef.current = sel;
                    }}
                    textAlignVertical="top"
                    style={styles.editorTextInput}
                  />
                </View>
              </View>

              {/* Ações do Rodapé: TODOS OS BOTÕES NA MESMA LINHA SEM QUEBRA */}
              <View style={styles.modalFooterSingleRow}>
                {/* Botão IA na Esquerda */}
                <TouchableOpacity
                  onPress={handleOptimizeAI}
                  disabled={isOptimizing}
                  style={styles.btnIaOptimize}
                  activeOpacity={0.8}
                >
                  {isOptimizing ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <ActivityIndicator size="small" color="#166534" />
                      <Text style={styles.btnIaOptimizeText}>Revisando...</Text>
                    </View>
                  ) : (
                    <Text style={styles.btnIaOptimizeText}>✨ Revisar IA</Text>
                  )}
                </TouchableOpacity>

                {/* Botões Cancelar e Publicar na Direita */}
                <View style={styles.modalRightButtonsRow}>
                  <TouchableOpacity
                    onPress={() => setModalVisible(false)}
                    style={styles.btnCancelModal}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.btnCancelModalText}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleSavePost}
                    disabled={isSubmitting}
                    style={styles.btnSaveModal}
                    activeOpacity={0.85}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.btnSaveModalText}>
                        {editingPostId ? 'Salvar' : 'Publicar Post'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL: PREVIEW / VISUALIZAÇÃO DO POST COMPLETO */}
      <Modal
        visible={!!previewPost}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPreviewPost(null)}
      >
        <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
          {/* Header do Preview */}
          <View style={styles.previewHeader}>
            <View style={styles.sheetDragHandle} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15 }}>
              <Text style={styles.previewHeaderTitle}>Visualizar Post</Text>
              <TouchableOpacity
                onPress={() => setPreviewPost(null)}
                style={styles.modalCloseButton}
                activeOpacity={0.7}
              >
                <Feather name="x" size={18} color="#666666" />
              </TouchableOpacity>
            </View>
          </View>

          {previewPost && (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 22, paddingBottom: 50 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Capa */}
              {previewPost.imagem_url ? (
                <View style={styles.previewImageWrapper}>
                  <Image
                    source={{ uri: resolveImageUrl(previewPost.imagem_url) || '' }}
                    style={styles.previewImage}
                    resizeMode="cover"
                  />
                </View>
              ) : null}

              {/* Título */}
              <Text style={styles.previewTitle}>{previewPost.titulo}</Text>

              {/* Data & Curtidas */}
              <View style={styles.previewMetaRow}>
                <Text style={styles.previewDate}>
                  📅 {formatDate(previewPost.createdAt || previewPost.created_at)}
                </Text>
                <View style={styles.postLikes}>
                  <Feather name="heart" size={14} color="#e63946" />
                  <Text style={styles.postLikesText}>{previewPost.curtidas || 0} curtidas</Text>
                </View>
              </View>

              {/* Conteúdo Completo */}
              <Text style={styles.previewContent}>
                {stripHtml(previewPost.conteudo)}
              </Text>

              {/* Ações Rápidas */}
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 30, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 20 }}>
                <TouchableOpacity
                  onPress={() => {
                    const postToEdit = previewPost;
                    setPreviewPost(null);
                    handleOpenEditPost(postToEdit);
                  }}
                  style={styles.btnPreviewEditar}
                  activeOpacity={0.8}
                >
                  <Feather name="edit-2" size={15} color="#166534" />
                  <Text style={styles.btnPreviewEditarText}>Editar este Post</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setPreviewPost(null)}
                  style={styles.btnPreviewFechar}
                  activeOpacity={0.8}
                >
                  <Text style={styles.btnPreviewFecharText}>Fechar</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },

  // HERO HEADER
  heroCard: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 20,
    backgroundColor: '#1B4332',
    borderRadius: 20,
    padding: 22,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  backButton: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  heroBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFEE8C',
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 13.5,
    color: 'rgba(255, 255, 255, 0.88)',
    lineHeight: 20,
  },

  // WIDGET: TEMAS EM ALTA
  widgetTemas: {
    marginHorizontal: 20,
    marginBottom: 22,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fef3c7',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#f59e0b',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  iconBoxAmber: {
    width: 38,
    height: 38,
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  widgetTemasTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#b45309',
  },
  widgetTemasSubtitle: {
    fontSize: 13,
    color: '#92400e',
    lineHeight: 18,
    marginBottom: 14,
  },
  sugestoesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sugestaoPill: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#d97706',
    borderRadius: 50,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  sugestaoPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#b45309',
  },

  // SEÇÃO SEUS POSTS
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  iconBoxGreen: {
    width: 36,
    height: 36,
    backgroundColor: '#e8f5e9',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: 'bold',
    color: '#1B4332',
  },
  btnNovoPost: {
    backgroundColor: '#1B4332',
    borderRadius: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: '#1B4332',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  btnNovoPostPlus: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: -2,
  },
  btnNovoPostText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },

  // LOADER E EMPTY STATE
  loaderBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666666',
  },
  emptyBox: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e9ecef',
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1B4332',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
  },
  btnEmptyCreate: {
    backgroundColor: '#1B4332',
    borderRadius: 50,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  btnEmptyCreateText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },

  // POST CARD
  postCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  postImageWrapper: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
    marginBottom: 12,
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  postTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1B4332',
    marginBottom: 6,
    lineHeight: 22,
  },
  postExcerpt: {
    fontSize: 13,
    color: '#555555',
    lineHeight: 19,
    marginBottom: 12,
  },
  postMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  postDate: {
    fontSize: 12,
    color: '#777777',
  },
  postLikes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  postLikesText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#e63946',
  },
  postActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
  },
  btnAcaoEditar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 50,
  },
  btnAcaoEditarText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#166534',
  },
  btnAcaoExcluir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 50,
  },
  btnAcaoExcluirText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#b91c1c',
  },

  // BOTÃO MOSTRAR MAIS
  btnLoadMore: {
    borderWidth: 1.5,
    borderColor: '#1B4332',
    borderRadius: 50,
    paddingHorizontal: 26,
    paddingVertical: 9,
    backgroundColor: 'transparent',
  },
  btnLoadMoreText: {
    color: '#1B4332',
    fontSize: 13.5,
    fontWeight: 'bold',
  },

  // MODAL BOTTOM SHEET
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  bottomSheetCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  modalHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingTop: 10,
  },
  sheetDragHandle: {
    width: 44,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: '#e5e7eb',
    alignSelf: 'center',
    marginBottom: 10,
  },
  modalIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1B4332',
  },
  modalHeaderSubtitle: {
    fontSize: 11.5,
    color: '#666666',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formGroup: {
    marginBottom: 14,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#495057',
    marginBottom: 5,
    letterSpacing: 0.5,
  },
  inputTextInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1f2937',
  },
  charCounter: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'right',
    marginTop: 4,
  },
  imageUploadPlaceholder: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  imageUploadText: {
    fontSize: 13,
    color: '#6b7280',
    flex: 1,
  },
  imageSelectedBox: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  imagePreviewThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  imageSelectedName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  imageChangeText: {
    fontSize: 11.5,
    color: '#166534',
    fontWeight: '600',
    marginTop: 2,
  },
  imageRemoveBtn: {
    padding: 8,
  },

  // EDITOR COM TOOLBAR NATIVO
  editorBoxContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    overflow: 'hidden',
  },
  editorToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 8,
    paddingVertical: 6,
    minHeight: 40,
  },
  toolbarDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  toolbarDropdownText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  toolbarDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#d1d5db',
    marginHorizontal: 3,
  },
  toolbarBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
  },
  toolbarBoldText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#374151',
  },
  toolbarItalicText: {
    fontSize: 14,
    fontWeight: 'bold',
    fontStyle: 'italic',
    color: '#374151',
  },
  toolbarUnderlineText: {
    fontSize: 14,
    fontWeight: 'bold',
    textDecorationLine: 'underline',
    color: '#374151',
  },
  toolbarStrikeText: {
    fontSize: 14,
    fontWeight: 'bold',
    textDecorationLine: 'line-through',
    color: '#374151',
  },
  headerDropdownMenu: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 4,
  },
  headerDropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  headerDropdownItemText: {
    fontSize: 13,
    color: '#374151',
  },
  headerDropdownItemActive: {
    color: '#166534',
    fontWeight: 'bold',
  },
  editorTextInput: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1f2937',
    minHeight: 130,
    lineHeight: 21,
  },

  // RODAPÉ: LINHA ÚNICA SEM QUEBRA
  modalFooterSingleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 8,
  },
  btnIaOptimize: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 50,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  btnIaOptimizeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
  },
  modalRightButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnCancelModal: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 50,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#1B4332',
  },
  btnCancelModalText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#1B4332',
  },
  btnSaveModal: {
    backgroundColor: '#1B4332',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 50,
    shadowColor: '#1B4332',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  btnSaveModalText: {
    fontSize: 12.5,
    fontWeight: 'bold',
    color: '#ffffff',
  },

  // MODAL PREVIEW
  previewHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingTop: 10,
  },
  previewHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1B4332',
  },
  previewImageWrapper: {
    width: '100%',
    height: 190,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1B4332',
    marginBottom: 10,
    lineHeight: 28,
  },
  previewMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  previewDate: {
    fontSize: 13,
    color: '#666666',
  },
  previewContent: {
    fontSize: 15,
    color: '#333333',
    lineHeight: 24,
  },
  btnPreviewEditar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingVertical: 12,
    borderRadius: 50,
  },
  btnPreviewEditarText: {
    fontSize: 13.5,
    fontWeight: 'bold',
    color: '#166534',
  },
  btnPreviewFechar: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 50,
  },
  btnPreviewFecharText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#4b5563',
  },
});
