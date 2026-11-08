import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StyleSheet,
  ScrollView,
} from 'react-native';
import YeloScrollView from '../../components/YeloScrollView';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const BOTTOM_NAV_CLEARANCE = Platform.OS === 'ios' ? 102 : 96;

interface Announcement {
  id: number;
  title: string;
  content: string;
  author?: string;
  createdAt: string;
  read?: boolean;
  psychologistId?: number | null;
}

interface ParsedAvisoTarget {
  type: 'forum' | 'blog' | 'novidades' | 'none';
  forumPostId?: number;
  commentId?: number;
  blogPostId?: number;
  blogSlug?: string;
  blogTitle?: string;
  linkLabel?: string;
  isButton?: boolean;
}

export default function AvisosScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [avisos, setAvisos] = useState<Announcement[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'personal'>('all');
  const [visibleCount, setVisibleCount] = useState(10);
  const [expandedIds, setExpandedIds] = useState<Record<number, boolean>>({});
  const [markingAll, setMarkingAll] = useState(false);

  // Mapas de posts para substituir o texto genérico pelo início real do post publicado
  const [forumPostsById, setForumPostsById] = useState<Record<number, any>>({});
  const [forumPostsByTitle, setForumPostsByTitle] = useState<Record<string, any>>({});
  const [blogPostsById, setBlogPostsById] = useState<Record<number, any>>({});
  const [blogPostsBySlug, setBlogPostsBySlug] = useState<Record<string, any>>({});
  const [blogPostsByTitle, setBlogPostsByTitle] = useState<Record<string, any>>({});

  const cleanHtmlToText = (html?: string) => {
    if (!html) return '';
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]*>?/gm, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&quot;/gi, '"')
      .replace(/&amp;/gi, '&')
      .replace(/&#39;/gi, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  const makeExcerpt = (raw?: string, maxLen = 180) => {
    const clean = cleanHtmlToText(raw).replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    return clean.length > maxLen ? `${clean.substring(0, maxLen).trim()}...` : clean;
  };

  const fetchAnnouncements = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setIsRefreshing(true);
      else setIsLoading(true);

      const [avisosRes, forumRes, blogRes] = await Promise.all([
        api.get(`/api/psychologists/me/announcements?t=${Date.now()}`).catch(() => ({ data: [] })),
        api.get('/api/forum/posts?limit=100&page=1').catch(() => ({ data: [] })),
        api.get('/api/public/posts').catch(() => ({ data: [] })),
      ]);

      const rawAvisos: Announcement[] = Array.isArray(avisosRes.data) ? avisosRes.data : [];
      const rawForum: any[] = Array.isArray(forumRes.data)
        ? forumRes.data
        : Array.isArray(forumRes.data?.posts)
          ? forumRes.data.posts
          : [];
      const rawBlog: any[] = Array.isArray(blogRes.data) ? blogRes.data : [];

      const fById: Record<number, any> = {};
      const fByTitle: Record<string, any> = {};
      rawForum.forEach((p) => {
        if (p?.id) fById[Number(p.id)] = p;
        const t = String(p?.title || p?.titulo || '').trim().toLowerCase();
        if (t) fByTitle[t] = p;
      });

      // Busca complementar caso algum aviso referencie um postId do fórum que não veio na página 1
      const missingForumIds = new Set<number>();
      rawAvisos.forEach((a) => {
        const m =
          (a.content || '').match(/data-post-id="(\d+)"/) ||
          (a.content || '').match(/postId=(\d+)/);
        if (m && m[1]) {
          const pid = Number(m[1]);
          if (pid && !fById[pid]) missingForumIds.add(pid);
        }
      });

      if (missingForumIds.size > 0) {
        const extraPosts = await Promise.all(
          Array.from(missingForumIds)
            .slice(0, 15)
            .map((pid) =>
              api
                .get(`/api/forum/posts/${pid}`)
                .then((r) => r.data)
                .catch(() => null)
            )
        );
        extraPosts.forEach((p) => {
          if (p?.id) {
            fById[Number(p.id)] = p;
            const t = String(p.title || p.titulo || '').trim().toLowerCase();
            if (t) fByTitle[t] = p;
          }
        });
      }

      const bById: Record<number, any> = {};
      const bBySlug: Record<string, any> = {};
      const bByTitle: Record<string, any> = {};
      rawBlog.forEach((bp) => {
        if (bp?.id) bById[Number(bp.id)] = bp;
        if (bp?.slug) bBySlug[String(bp.slug).trim().toLowerCase()] = bp;
        const bt = String(bp?.titulo || bp?.title || '').trim().toLowerCase();
        if (bt) bByTitle[bt] = bp;
      });

      setForumPostsById(fById);
      setForumPostsByTitle(fByTitle);
      setBlogPostsById(bById);
      setBlogPostsBySlug(bBySlug);
      setBlogPostsByTitle(bByTitle);
      setAvisos(rawAvisos);
    } catch (e) {
      console.warn('Erro ao carregar avisos:', e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleMarkAsRead = async (avisoId: number) => {
    try {
      setAvisos((prev) =>
        prev.map((a) => (a.id === avisoId ? { ...a, read: true } : a))
      );
      await api.post(`/api/psychologists/me/announcements/${avisoId}/read`);
    } catch (e) {
      console.warn('Erro ao marcar aviso como lido:', e);
    }
  };

  const handleMarkAllAsRead = async () => {
    const unreadList = avisos.filter((a) => !a.read);
    if (unreadList.length === 0 || markingAll) return;

    try {
      setMarkingAll(true);
      setAvisos((prev) => prev.map((a) => ({ ...a, read: true })));

      await Promise.allSettled(
        unreadList.map((a) =>
          api.post(`/api/psychologists/me/announcements/${a.id}/read`)
        )
      );
    } catch (e) {
      console.warn('Erro ao marcar todos como lidos:', e);
    } finally {
      setMarkingAll(false);
    }
  };

  // Identifica o ícone circular exatamente como em psi_avisos.html
  const getIconConfig = (aviso: Announcement) => {
    const lowerTitle = (aviso.title || '').toLowerCase();
    const isUnread = !aviso.read;

    if (
      lowerTitle.includes('instabilidade') ||
      lowerTitle.includes('manutenção') ||
      lowerTitle.includes('importante')
    ) {
      return {
        emoji: '⚠️',
        bg: '#fffbeb',
      };
    }
    if (
      lowerTitle.includes('novidade') ||
      lowerTitle.includes('lançamento') ||
      lowerTitle.includes('compilado') ||
      lowerTitle.includes('ajustes') ||
      lowerTitle.includes('melhorias')
    ) {
      return {
        emoji: '🚀',
        bg: '#ecfdf5',
      };
    }
    if (lowerTitle.includes('resposta') || lowerTitle.includes('comentário')) {
      return {
        emoji: '💬',
        bg: '#e0f2fe',
      };
    }
    return {
      emoji: '🔔',
      bg: isUnread ? '#16a34a' : '#e8f5e9',
    };
  };

  // Extrai destino de redirecionamento e link do aviso (idêntico à lógica de psi_avisos.html)
  const parseAvisoTarget = (aviso: Announcement): ParsedAvisoTarget => {
    const content = aviso.content || '';
    const lowerTitle = (aviso.title || '').toLowerCase();

    // 1. Edição semanal / Novidades
    if (
      content.includes('psi_novidades.html') ||
      lowerTitle.includes('compilado') ||
      lowerTitle.includes('novidade')
    ) {
      return {
        type: 'novidades',
        linkLabel: 'Ver Compilado da Semana ➔',
        isButton: true,
      };
    }

    // 2. Post ou Comentário do Fórum
    const postMatch =
      content.match(/data-post-id="(\d+)"/) || content.match(/postId=(\d+)/);
    const commentMatch =
      content.match(/data-comment-id="(\d+)"/) || content.match(/commentId=(\d+)/);

    if (postMatch && postMatch[1]) {
      const labelMatch = content.match(
        /<a[^>]*class="[^"]*aviso-link-direto[^"]*"[^>]*>([\s\S]*?)<\/a>/i
      );
      const rawLabel = labelMatch ? cleanHtmlToText(labelMatch[1]) : '';
      return {
        type: 'forum',
        forumPostId: Number(postMatch[1]),
        commentId: commentMatch && commentMatch[1] ? Number(commentMatch[1]) : undefined,
        linkLabel: rawLabel || 'Clique aqui para acessar o tópico',
      };
    }

    // Fallback de Fórum por título (ex: "Novo Tópico no Fórum: <Título>")
    if (
      lowerTitle.includes('fórum') ||
      lowerTitle.includes('tópico') ||
      lowerTitle.includes('comentário') ||
      lowerTitle.includes('resposta')
    ) {
      const extractedTitle = (aviso.title || '')
        .replace(/^Novo Tópico no Fórum:\s*/i, '')
        .trim()
        .toLowerCase();
      const matchedPost = extractedTitle ? forumPostsByTitle[extractedTitle] : null;
      return {
        type: 'forum',
        forumPostId: matchedPost?.id ? Number(matchedPost.id) : undefined,
        linkLabel: 'Clique aqui para acessar o tópico',
      };
    }

    // 3. Artigo no Blog
    const blogIdMatch = content.match(/data-blog-id="(\d+)"/);
    const blogHrefMatch = content.match(/href="\/blog\/post\/([^"#?]+)"/i);

    if (blogIdMatch || blogHrefMatch || lowerTitle.includes('novo artigo no blog') || lowerTitle.includes('artigo')) {
      const bId = blogIdMatch && blogIdMatch[1] ? Number(blogIdMatch[1]) : undefined;
      const bSlug = blogHrefMatch && blogHrefMatch[1] ? blogHrefMatch[1] : undefined;
      const extractedBlogTitle = (aviso.title || '')
        .replace(/^Novo Artigo no Blog:\s*/i, '')
        .trim();
      const matchedBlog =
        (bId && blogPostsById[bId]) ||
        (bSlug && blogPostsBySlug[bSlug.toLowerCase()]) ||
        (extractedBlogTitle && blogPostsByTitle[extractedBlogTitle.toLowerCase()]) ||
        null;

      return {
        type: 'blog',
        blogPostId: matchedBlog?.id || bId,
        blogSlug: matchedBlog?.slug || bSlug,
        blogTitle: extractedBlogTitle || matchedBlog?.titulo,
        linkLabel: 'Clique aqui para ler o artigo',
      };
    }

    return { type: 'none' };
  };

  // Monta o texto do aviso substituindo "Ei! Acabamos de publicar..." pelo início do texto postado
  const getDisplayBodyText = (aviso: Announcement, target: ParsedAvisoTarget): string => {
    const userName = user?.nome ? user.nome.split(' ')[0] : 'Psi';
    let rawContent = (aviso.content || '').replace(/\[nome\]/g, userName);

    // Remove o elemento <a> ou <button> de link direto do corpo textual (pois é renderizado como componente clicável abaixo)
    rawContent = rawContent
      .replace(/<button[^>]*class="[^"]*aviso-link-direto[^"]*"[^>]*>[\s\S]*?<\/button>/gi, '')
      .replace(/<a[^>]*class="[^"]*aviso-link-direto[^"]*"[^>]*>[\s\S]*?<\/a>\.?/gi, '');

    let bodyText = cleanHtmlToText(rawContent);

    if (/acabamos de publicar/i.test(bodyText)) {
      let postExcerpt = '';

      if (target.type === 'forum') {
        const forumPost =
          (target.forumPostId && forumPostsById[target.forumPostId]) ||
          forumPostsByTitle[
            (aviso.title || '')
              .replace(/^Novo Tópico no Fórum:\s*/i, '')
              .trim()
              .toLowerCase()
          ];
        if (forumPost) {
          postExcerpt = makeExcerpt(forumPost.content || forumPost.conteudo);
        }
      } else if (target.type === 'blog') {
        const blogPost =
          (target.blogPostId && blogPostsById[target.blogPostId]) ||
          (target.blogSlug && blogPostsBySlug[target.blogSlug.toLowerCase()]) ||
          (target.blogTitle && blogPostsByTitle[target.blogTitle.toLowerCase()]);
        if (blogPost) {
          postExcerpt = makeExcerpt(blogPost.conteudo || blogPost.resumo || blogPost.content);
        }
      }

      if (postExcerpt) {
        bodyText = `"${postExcerpt}"`;
      } else {
        const fallbackTitle = (aviso.title || '')
          .replace(/^Novo Tópico no Fórum:\s*/i, '')
          .replace(/^Novo Artigo no Blog:\s*/i, '')
          .trim();
        bodyText = fallbackTitle ? `"${fallbackTitle}"` : '';
      }
    }

    return bodyText;
  };

  const navigateToTarget = (aviso: Announcement, target: ParsedAvisoTarget) => {
    if (!aviso.read) {
      handleMarkAsRead(aviso.id);
    }

    if (target.type === 'novidades') {
      router.navigate('/(tabs)/novidades');
      return true;
    }

    if (target.type === 'forum') {
      if (target.forumPostId) {
        router.navigate({
          pathname: '/(tabs)/forum',
          params: {
            postId: String(target.forumPostId),
            ...(target.commentId ? { commentId: String(target.commentId) } : {}),
            t: String(Date.now()),
          },
        } as any);
      } else {
        router.navigate('/(tabs)/forum');
      }
      return true;
    }

    if (target.type === 'blog') {
      router.push({
        pathname: '/blog',
        params: {
          ...(target.blogPostId ? { postId: String(target.blogPostId) } : {}),
          ...(target.blogSlug ? { slug: target.blogSlug } : {}),
          ...(target.blogTitle ? { title: target.blogTitle } : {}),
          t: String(Date.now()),
        },
      } as any);
      return true;
    }

    return false;
  };

  const handleCardPress = (aviso: Announcement, target: ParsedAvisoTarget) => {
    if (!aviso.read) {
      handleMarkAsRead(aviso.id);
    }

    const isExpanded = !!expandedIds[aviso.id];

    // Se já estiver expandido e possuir destino (post do fórum, artigo do blog ou novidades), redireciona ao post (igual ao psi_avisos.html)
    if (isExpanded && target.type !== 'none') {
      navigateToTarget(aviso, target);
      return;
    }

    setExpandedIds((prev) => ({
      ...prev,
      [aviso.id]: !prev[aviso.id],
    }));
  };

  const formatDateFull = (isoString: string) => {
    if (!isoString) return '';
    try {
      return new Date(isoString).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const filteredAvisos = avisos.filter((a) => {
    if (filter === 'unread') return !a.read;
    if (filter === 'personal') return !!a.psychologistId;
    return true;
  });

  const visibleAvisos = filteredAvisos.slice(0, visibleCount);
  const hasMore = filteredAvisos.length > visibleCount;

  return (
    <View style={styles.screen}>
      <YeloScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 14,
          paddingBottom: BOTTOM_NAV_CLEARANCE + 30,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchAnnouncements(true)}
            tintColor="#1B4332"
          />
        }
      >
        {/* BOTÃO VOLTAR */}
        <View style={styles.topBackRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={14} color="#1B4332" />
            <Text style={styles.backBtnText}>Voltar</Text>
          </TouchableOpacity>
        </View>

        {/* BANNER PRINCIPAL (.main-header de psi_avisos.html) */}
        <View style={styles.mainHeader}>
          <Text style={styles.mainHeaderTitle}>Avisos & Comunicados 🔔</Text>
          <Text style={styles.mainHeaderSubtitle}>
            Fique por dentro das atualizações, avisos importantes e novidades da plataforma.
          </Text>
        </View>

        {/* FILTROS (.avisos-filters de psi_avisos.html) */}
        <View style={styles.filtersContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersScroll}
          >
            <TouchableOpacity
              onPress={() => {
                setFilter('all');
                setVisibleCount(10);
              }}
              style={[
                styles.filterBtn,
                filter === 'all' && styles.filterBtnActive,
              ]}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.filterBtnText,
                  filter === 'all' && styles.filterBtnTextActive,
                ]}
              >
                Todos
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setFilter('unread');
                setVisibleCount(10);
              }}
              style={[
                styles.filterBtn,
                filter === 'unread' && styles.filterBtnActive,
              ]}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.filterBtnText,
                  filter === 'unread' && styles.filterBtnTextActive,
                ]}
              >
                Não lidos
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setFilter('personal');
                setVisibleCount(10);
              }}
              style={[
                styles.filterBtn,
                filter === 'personal' && styles.filterBtnActive,
              ]}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.filterBtnText,
                  filter === 'personal' && styles.filterBtnTextActive,
                ]}
              >
                Pessoais
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* AÇÃO DE TOPO (#btn-marcar-todos-lidos) */}
        <View style={styles.actionsTop}>
          <TouchableOpacity
            onPress={handleMarkAllAsRead}
            disabled={markingAll}
            activeOpacity={0.7}
          >
            <Text style={styles.markAllBtnText}>
              {markingAll ? 'Marcando...' : 'Marcar todos como lidos'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* LISTA DE AVISOS (#avisos-feed-container) */}
        {isLoading ? (
          <View style={styles.loaderBox}>
            <ActivityIndicator size="large" color="#1B4332" />
          </View>
        ) : visibleAvisos.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>✨</Text>
            <Text style={styles.emptyStateText}>
              Nenhum aviso por aqui. Tudo em ordem!
            </Text>
          </View>
        ) : (
          <View style={styles.feedList}>
            {visibleAvisos.map((aviso) => {
              const isUnread = !aviso.read;
              const isExpanded = !!expandedIds[aviso.id];
              const iconCfg = getIconConfig(aviso);
              const target = parseAvisoTarget(aviso);
              const bodyText = getDisplayBodyText(aviso, target);
              const dateStr = formatDateFull(aviso.createdAt);

              return (
                <TouchableOpacity
                  key={aviso.id}
                  activeOpacity={0.88}
                  onPress={() => handleCardPress(aviso, target)}
                  style={[
                    styles.feedItem,
                    isUnread && styles.feedItemUnread,
                  ]}
                >
                  {/* SETA INDICADORA (▼ / ▲) */}
                  <Text
                    style={[
                      styles.chevronArrow,
                      isExpanded && styles.chevronArrowExpanded,
                    ]}
                  >
                    {isExpanded ? '▲' : '▼'}
                  </Text>

                  {/* CABEÇALHO DO CARD (.aviso-feed-header) */}
                  <View style={styles.feedHeader}>
                    <View
                      style={[
                        styles.iconWrapper,
                        { backgroundColor: iconCfg.bg },
                      ]}
                    >
                      <Text style={styles.iconEmoji}>{iconCfg.emoji}</Text>
                    </View>

                    <View style={styles.titleGroup}>
                      <View style={styles.titleRow}>
                        <Text
                          style={[
                            styles.avisoTitle,
                            isUnread && styles.avisoTitleUnread,
                          ]}
                          numberOfLines={isExpanded ? undefined : 1}
                        >
                          {aviso.title}
                        </Text>

                        {aviso.psychologistId ? (
                          <View style={styles.personalBadge}>
                            <Text style={styles.personalBadgeText}>Pessoal</Text>
                          </View>
                        ) : null}
                      </View>

                      <View style={styles.metaWrap}>
                        <Text style={styles.avisoMeta}>
                          Enviado por {aviso.author || 'Equipe Yelo'} em {dateStr}
                        </Text>
                        {isUnread && (
                          <View style={styles.clickHintBadge}>
                            <Text style={styles.clickHintText}>
                              🔔 Clique para ler
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* CONTEÚDO EXPANDIDO (.aviso-full-content) */}
                  {isExpanded && (
                    <View style={styles.fullContent}>
                      {bodyText.length > 0 && (
                        <Text style={styles.fullContentText}>{bodyText}</Text>
                      )}

                      {target.type !== 'none' && target.linkLabel && (
                        <TouchableOpacity
                          activeOpacity={0.75}
                          onPress={() => navigateToTarget(aviso, target)}
                          style={
                            target.isButton
                              ? styles.directButton
                              : styles.directLinkTouch
                          }
                        >
                          <Text
                            style={
                              target.isButton
                                ? styles.directButtonText
                                : styles.directLinkText
                            }
                          >
                            {target.linkLabel}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}

            {hasMore && (
              <TouchableOpacity
                onPress={() => setVisibleCount((prev) => prev + 10)}
                style={styles.loadMoreBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.loadMoreBtnText}>Ver mais antigos</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </YeloScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topBackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    gap: 5,
  },
  backBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: '#1B4332',
  },
  mainHeader: {
    backgroundColor: '#1B4332',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  mainHeaderTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 24,
    color: '#FFFFFF',
    marginBottom: 6,
  },
  mainHeaderSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14.5,
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 21,
  },
  filtersContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 12,
    marginBottom: 12,
  },
  filtersScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterBtn: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 50,
  },
  filterBtnActive: {
    backgroundColor: '#1B4332',
    borderColor: '#1B4332',
  },
  filterBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13.5,
    color: '#495057',
  },
  filterBtnTextActive: {
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  actionsTop: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 15,
  },
  markAllBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#1B4332',
    textDecorationLine: 'underline',
  },
  loaderBox: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  emptyStateText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  feedList: {
    gap: 12,
  },
  feedItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    padding: 15,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  feedItemUnread: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
    borderLeftWidth: 5,
    borderLeftColor: '#16A34A',
  },
  chevronArrow: {
    position: 'absolute',
    right: 14,
    top: 18,
    fontSize: 11,
    color: '#64748B',
    zIndex: 2,
  },
  chevronArrowExpanded: {
    color: '#1B4332',
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingRight: 26,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 17,
  },
  titleGroup: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  avisoTitle: {
    flex: 1,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15.5,
    color: '#1E293B',
    lineHeight: 21,
  },
  avisoTitleUnread: {
    fontFamily: 'Inter_700Bold',
    color: '#1B4332',
  },
  personalBadge: {
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  personalBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: '#0284C7',
  },
  metaWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  avisoMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  clickHintBadge: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  clickHintText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11.5,
    color: '#16A34A',
  },
  fullContent: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  fullContentText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: '#334155',
    lineHeight: 23,
  },
  directLinkTouch: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  directLinkText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14.5,
    color: '#1B4332',
    textDecorationLine: 'underline',
  },
  directButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#1B4332',
    paddingVertical: 9,
    paddingHorizontal: 20,
    borderRadius: 50,
    shadowColor: '#1B4332',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  directButtonText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13.5,
    color: '#FFEE8C',
  },
  loadMoreBtn: {
    marginTop: 12,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 25,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#1B4332',
    backgroundColor: 'transparent',
  },
  loadMoreBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: '#1B4332',
  },
});
