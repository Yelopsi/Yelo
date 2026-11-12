import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import YeloScrollView from '../../components/YeloScrollView';
import NativeSelectMenu, { type NativeSelectOption } from '../../components/NativeSelectMenu';
import api from '../../services/api';

interface UpdateItem {
  id: string;
  date?: string;
  title: string;
  summary: string;
  category?: string;
  impactBadge?: string;
  badgeColor?: string;
  ctaLink?: string | null;
  ctaText?: string | null;
  releaseBatch?: string;
}

interface Edition {
  id: string;
  mondayKey?: string;
  date?: string;
  formattedDate?: string;
  title?: string;
  subtitle?: string;
  summary?: string;
  totalAdjustments?: number;
  categories?: string[];
  items: UpdateItem[];
}

export default function NovidadesScreen() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allEditions, setAllEditions] = useState<Edition[]>([]);
  const [allUpdates, setAllUpdates] = useState<UpdateItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Normaliza strings para busca insensível a acentos
  const normalizeStr = (str: string) => {
    return (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  };

  const formatDateFriendly = (dateStr?: string) => {
    if (!dateStr) return 'Lançamento recente';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Cores dinâmicas de acordo com a categoria da melhoria
  const getThemeForCategory = (category?: string) => {
    const cat = normalizeStr(category || '');
    if (cat.includes('forum') || cat.includes('comunidade')) {
      return { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' };
    }
    if (cat.includes('consultorio') || cat.includes('gestao') || cat.includes('crm')) {
      return { bg: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe' };
    }
    if (cat.includes('perfil') || cat.includes('paciente')) {
      return { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
    }
    return { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' };
  };

  // Agrupamento de fallback caso o backend envie lista plana
  const groupUpdatesIntoMondayEditions = (updates: UpdateItem[]): Edition[] => {
    const editionsMap = new Map<string, { mondayKey: string; mondayDate: string; items: UpdateItem[] }>();

    (updates || []).forEach((item) => {
      let baseDateStr = item.date;
      let dateObj = new Date(baseDateStr || Date.now());
      if (isNaN(dateObj.getTime())) dateObj = new Date();

      const dayOfWeek = dateObj.getDay(); // 0: Dom, 1: Seg, ..., 6: Sab
      let diffToMonday = 0;
      if (dayOfWeek === 1) {
        diffToMonday = 0;
      } else if (dayOfWeek === 0) {
        diffToMonday = 1;
      } else {
        diffToMonday = 8 - dayOfWeek;
      }

      const mondayDate = new Date(dateObj);
      mondayDate.setDate(dateObj.getDate() + diffToMonday);
      mondayDate.setHours(12, 0, 0, 0);

      const mondayKey = mondayDate.toISOString().slice(0, 10);
      if (!editionsMap.has(mondayKey)) {
        editionsMap.set(mondayKey, {
          mondayKey,
          mondayDate: mondayDate.toISOString(),
          items: [],
        });
      }
      editionsMap.get(mondayKey)!.items.push(item);
    });

    return Array.from(editionsMap.values())
      .sort((a, b) => new Date(b.mondayDate).getTime() - new Date(a.mondayDate).getTime())
      .map((ed) => {
        const dateObj = new Date(ed.mondayDate);
        const formattedDate = dateObj.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        });
        return {
          id: `edition-${ed.mondayKey}`,
          mondayKey: ed.mondayKey,
          date: ed.mondayDate,
          formattedDate,
          title: 'Compilado de Ajustes da Semana 🚀',
          subtitle: `Lançamentos de Segunda-feira • ${formattedDate}`,
          totalAdjustments: ed.items.length,
          categories: Array.from(new Set(ed.items.map((i) => i.category || 'Geral'))),
          items: ed.items,
        };
      });
  };

  const fetchPlatformUpdates = async () => {
    try {
      const res = await api.get('/api/psychologists/platform-updates');
      const data = res.data;
      const updates: UpdateItem[] = data.updates || [];
      const editions: Edition[] =
        data.editions && data.editions.length > 0
          ? data.editions
          : groupUpdatesIntoMondayEditions(updates);

      setAllUpdates(updates);
      setAllEditions(editions);
    } catch (e) {
      console.warn('Erro ao carregar novidades da plataforma:', e);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPlatformUpdates();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPlatformUpdates();
  }, []);

  // Mapeamento de categorias e quantidades
  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    allUpdates.forEach((u) => {
      const cat = u.category || 'Geral';
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    return map;
  }, [allUpdates]);

  // Ícones contextuais para cada categoria
  const getCategoryIcon = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes('fórum') || cat.includes('comunidade')) return '💬';
    if (cat.includes('perfil') || cat.includes('pacientes')) return '⭐';
    if (cat.includes('consultório') || cat.includes('gestão')) return '💼';
    return '✨';
  };

  const categoryOptions: NativeSelectOption[] = useMemo(() => {
    const opts: NativeSelectOption[] = [
      { label: `Todas as Categorias (${allUpdates.length})`, value: 'all' },
    ];
    categoryCounts.forEach((count, cat) => {
      opts.push({ label: `${getCategoryIcon(cat)} ${cat} (${count})`, value: cat });
    });
    return opts;
  }, [allUpdates.length, categoryCounts]);

  const selectedCategoryLabel = useMemo(() => {
    return (
      categoryOptions.find((o) => o.value === activeCategory)?.label ||
      `Todas as Categorias (${allUpdates.length})`
    );
  }, [categoryOptions, activeCategory, allUpdates.length]);

  // Filtragem das edições e itens de acordo com categoria e busca
  const filteredEditions = useMemo(() => {
    return allEditions
      .map((edition) => {
        const matchingItems = (edition.items || []).filter((item) => {
          const matchCat = activeCategory === 'all' || item.category === activeCategory;
          const textToSearch = normalizeStr(
            `${item.title || ''} ${item.summary || ''} ${item.category || ''} ${item.impactBadge || ''}`
          );
          const matchQuery =
            !searchQuery.trim() || textToSearch.includes(normalizeStr(searchQuery.trim()));
          return matchCat && matchQuery;
        });

        return {
          ...edition,
          filteredItems: matchingItems,
        };
      })
      .filter((edition) => edition.filteredItems.length > 0);
  }, [allEditions, activeCategory, searchQuery]);

  const totalPages = filteredEditions.length;
  const safePage = totalPages > 0 ? Math.min(Math.max(1, currentPage), totalPages) : 1;
  const visibleEditions = useMemo(() => {
    if (filteredEditions.length === 0) return [];
    return [filteredEditions[safePage - 1]];
  }, [filteredEditions, safePage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, searchQuery]);

  // Navegação inteligente para os CTAs
  const handleNavigateCta = (ctaLink?: string | null) => {
    if (!ctaLink) return;
    const link = ctaLink.toLowerCase();
    if (link.includes('forum')) {
      router.navigate('/(tabs)/forum');
    } else if (link.includes('perfil') || link.includes('ajustes_hub')) {
      router.navigate('/(tabs)/meu_perfil');
    } else if (link.includes('paciente')) {
      router.navigate('/(tabs)/pacientes');
    } else if (link.includes('blog')) {
      router.navigate('/(tabs)/blog');
    } else if (link.includes('historico')) {
      router.navigate('/(tabs)/historico_contatos');
    } else if (link.includes('comunidade')) {
      router.navigate('/(tabs)/comunidade_yelo');
    } else if (link.includes('caixa_de_entrada') || link.includes('suporte')) {
      router.navigate('/(tabs)/fale_com_a_yelo');
    } else {
      router.navigate('/(tabs)/ajustes');
    }
  };

  return (
    <View style={styles.container}>
      <YeloScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1B4332']}
            tintColor="#1B4332"
          />
        }
      >
        {/* BOTÃO VOLTAR PARA AJUSTES */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Feather name="chevron-left" size={18} color="#1B4332" />
          <Text style={styles.backBtnText}>Voltar para Ajustes</Text>
        </TouchableOpacity>

        {/* HERO HEADER VERDE INSTITUCIONAL */}
        <LinearGradient
          colors={['#1B4332', '#2D6A4F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroContainer}
        >
          {/* Marca d'água translúcida de foguete */}
          <Text style={styles.heroWatermark}>🚀</Text>

          <View style={styles.heroBadgesRow}>
            <View style={styles.heroBadgePrimary}>
              <Text style={styles.heroBadgePrimaryText}>✨ Central de Melhorias</Text>
            </View>
            <View style={styles.heroBadgeMonday}>
              <Text style={styles.heroBadgeMondayText}>📅 Toda Segunda-feira</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>Melhorias da Plataforma 🚀</Text>
          <Text style={styles.heroSubtitle}>
            Toda segunda-feira reunimos em um único post o compilado de melhorias práticas, novos
            recursos e ajustes lançados para apoiar a sua rotina e o crescimento do seu consultório.
          </Text>
        </LinearGradient>

        {/* BARRA DE FILTROS E BUSCA */}
        <View style={styles.filterBarContainer}>
          {/* Dropdown Nativo no Padrão do Dispositivo */}
          <NativeSelectMenu
            options={categoryOptions}
            selectedValue={activeCategory}
            onSelect={(val) => {
              setActiveCategory(val || 'all');
              setCurrentPage(1);
            }}
            style={{ width: '100%' }}
          >
            <View style={styles.categoryDropdownBtn}>
              <Text style={styles.categoryDropdownText} numberOfLines={1}>
                {selectedCategoryLabel}
              </Text>
              <Feather name="chevron-down" size={16} color="#475569" />
            </View>
          </NativeSelectMenu>

          {/* Input de Busca */}
          <View style={styles.searchContainer}>
            <Feather name="search" size={16} color="#94A3B8" style={styles.searchIcon} />
            <TextInput
              value={searchQuery}
              onChangeText={(txt) => {
                setSearchQuery(txt);
                setCurrentPage(1);
              }}
              placeholder="Buscar melhoria..."
              placeholderTextColor="#94A3B8"
              style={styles.searchInput}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                style={styles.clearSearchBtn}
              >
                <Feather name="x" size={14} color="#64748B" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* LOADING */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1B4332" />
            <Text style={styles.loadingText}>Carregando as melhorias mais recentes...</Text>
          </View>
        )}

        {/* TIMELINE DE EDIÇÕES */}
        {!isLoading && filteredEditions.length > 0 && (
          <View style={styles.timelineContainer}>
            {/* Linha vertical contínua da timeline */}
            <View style={styles.timelineVerticalLine} />

            {visibleEditions.map((edition) => (
              <View key={edition.id} style={styles.editionCardWrapper}>
                {/* Bolinha cravada na linha da timeline */}
                <View style={styles.timelineDot} />

                {/* Card da Edição */}
                <View style={styles.editionCard}>
                  {/* Cabeçalho da Edição */}
                  <View style={styles.editionHeader}>
                    <View style={styles.editionBadgesRow}>
                      <View style={styles.editionMondayBadge}>
                        <Text style={styles.editionMondayBadgeText}>📅 Segunda-feira</Text>
                      </View>
                      <View style={styles.editionCountBadge}>
                        <Text style={styles.editionCountBadgeText}>
                          ✨ {edition.filteredItems.length} melhorias
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.editionDateText}>
                      {edition.formattedDate || formatDateFriendly(edition.date)}
                    </Text>
                  </View>

                  {/* Título e Introdução da Edição */}
                  <Text style={styles.editionTitle}>Compilado de Ajustes da Semana 🚀</Text>
                  <Text style={styles.editionIntro}>
                    Confira os aprimoramentos e novos recursos liberados nesta segunda-feira para
                    apoiar o seu consultório e sua rotina na Yelo:
                  </Text>

                  {/* Lista de Subcards de Ajustes */}
                  <View style={styles.subcardsList}>
                    {edition.filteredItems.map((item) => {
                      const theme = getThemeForCategory(item.category);
                      return (
                        <View key={item.id} style={styles.subcard}>
                          {/* Tags do Subcard */}
                          <View style={styles.subcardBadgesRow}>
                            <View
                              style={[
                                styles.subcardCatBadge,
                                {
                                  backgroundColor: theme.bg,
                                  borderColor: theme.border,
                                },
                              ]}
                            >
                              <Text
                                style={[styles.subcardCatBadgeText, { color: theme.color }]}
                              >
                                {item.category || 'Melhoria da Plataforma'}
                              </Text>
                            </View>

                            {item.impactBadge && (
                              <View style={styles.subcardImpactBadge}>
                                <Text style={styles.subcardImpactBadgeText}>
                                  {item.impactBadge}
                                </Text>
                              </View>
                            )}
                          </View>

                          {/* Título do Ajuste */}
                          <Text style={styles.subcardTitle}>{item.title}</Text>

                          {/* Resumo do Ajuste */}
                          <Text style={styles.subcardSummary}>{item.summary}</Text>

                          {/* Botão CTA Clicável (Se Houver) */}
                          {item.ctaLink && item.ctaText && (
                            <TouchableOpacity
                              activeOpacity={0.8}
                              onPress={() => handleNavigateCta(item.ctaLink)}
                              style={styles.ctaButton}
                            >
                              <Text style={styles.ctaButtonText}>{item.ctaText}</Text>
                              <Feather name="arrow-right" size={13} color="#166534" />
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* PAGINAÇÃO DAS EDIÇÕES */}
        {!isLoading && totalPages > 1 && (
          <View style={styles.paginationContainer}>
            <Text style={styles.paginationInfoText}>
              Edição {safePage} de {totalPages} •{' '}
              {safePage === 1 ? 'Mais recente' : 'Edição anterior'} (
              {visibleEditions[0]?.formattedDate || formatDateFriendly(visibleEditions[0]?.date)})
            </Text>
            <View style={styles.paginationControlsRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={safePage <= 1}
                onPress={() => setCurrentPage(safePage - 1)}
                style={[styles.paginationBtn, safePage <= 1 && styles.paginationBtnDisabled]}
              >
                <Text style={styles.paginationBtnText}>← Mais recente</Text>
              </TouchableOpacity>

              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => {
                const isActive = pageNum === safePage;
                return (
                  <TouchableOpacity
                    key={pageNum}
                    activeOpacity={0.8}
                    onPress={() => setCurrentPage(pageNum)}
                    style={[
                      styles.paginationPageNum,
                      isActive && styles.paginationPageNumActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.paginationPageNumText,
                        isActive && styles.paginationPageNumTextActive,
                      ]}
                    >
                      {pageNum}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                activeOpacity={0.8}
                disabled={safePage >= totalPages}
                onPress={() => setCurrentPage(safePage + 1)}
                style={[
                  styles.paginationBtn,
                  safePage >= totalPages && styles.paginationBtnDisabled,
                ]}
              >
                <Text style={styles.paginationBtnText}>Mais antiga →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ESTADO VAZIO */}
        {!isLoading && filteredEditions.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🌿</Text>
            <Text style={styles.emptyTitle}>
              Nenhuma melhoria encontrada nesta categoria
            </Text>
            <Text style={styles.emptySubtitle}>
              Selecione "Todas" para visualizar a lista completa de melhorias e novos recursos da
              Yelo.
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setActiveCategory('all');
                setSearchQuery('');
              }}
              style={styles.emptyResetBtn}
            >
              <Text style={styles.emptyResetBtnText}>Ver Todas as Melhorias</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* CARD DE SUGESTÕES E ENGAJAMENTO (COMMUNITY-LED) */}
        <View style={styles.communityCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Text style={{ fontSize: 20 }}>💡</Text>
            <Text style={styles.communityTitle}>
              Sentiu falta de algum recurso ou tem uma sugestão?
            </Text>
          </View>
          <Text style={styles.communityDesc}>
            Nossa equipe analisa os pedidos dos profissionais semanalmente. Compartilhe sua visão
            com outros colegas no Fórum ou envie uma mensagem direta ao nosso suporte.
          </Text>

          <View style={styles.communityButtonsRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.navigate('/(tabs)/forum')}
              style={styles.communityBtnPrimary}
            >
              <Text style={styles.communityBtnPrimaryText}>💬 Abrir Tópico no Fórum</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.navigate('/(tabs)/fale_com_a_yelo')}
              style={styles.communityBtnSecondary}
            >
              <Text style={styles.communityBtnSecondaryText}>🎧 Fale com a Yelo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </YeloScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 130, // Respiro confortável para a bottom nav bar
  },

  // Botão Voltar
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 50,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  backBtnText: {
    color: '#1B4332',
    fontSize: 13,
    fontWeight: '700',
  },

  // Hero Header
  heroContainer: {
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 22,
    marginBottom: 20,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#1B4332',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 6,
  },
  heroWatermark: {
    position: 'absolute',
    right: -10,
    top: -10,
    fontSize: 90,
    opacity: 0.08,
  },
  heroBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  heroBadgePrimary: {
    backgroundColor: 'rgba(255, 238, 140, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255, 238, 140, 0.35)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  heroBadgePrimaryText: {
    color: '#FFEE8C',
    fontSize: 11,
    fontWeight: '800',
  },
  heroBadgeMonday: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  heroBadgeMondayText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  heroTitle: {
    fontFamily: 'NewKansas-Bold',
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 13.5,
    color: 'rgba(255, 255, 255, 0.92)',
    lineHeight: 19,
  },

  // Barra de Filtros e Busca
  filterBarContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    gap: 12,
  },
  categoryDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  categoryDropdownText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: '#1E293B',
    marginRight: 8,
  },

  // Input de Busca
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1E293B',
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },

  // Loading
  loadingContainer: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13.5,
    fontWeight: '600',
    color: '#64748B',
  },

  // Timeline
  timelineContainer: {
    position: 'relative',
    paddingLeft: 22, // Recuo para a linha e bolinhas
  },
  timelineVerticalLine: {
    position: 'absolute',
    left: 7,
    top: 18,
    bottom: 24,
    width: 3,
    backgroundColor: '#1B4332',
    borderRadius: 3,
    opacity: 0.45,
  },
  editionCardWrapper: {
    position: 'relative',
    marginBottom: 20,
  },
  timelineDot: {
    position: 'absolute',
    left: -22,
    top: 22,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 3.5,
    borderColor: '#1B4332',
    zIndex: 5,
    shadowColor: '#1B4332',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },

  // Card da Edição
  editionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
  },
  editionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 14,
  },
  editionBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  editionMondayBadge: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 50,
  },
  editionMondayBadgeText: {
    color: '#166534',
    fontSize: 11,
    fontWeight: '700',
  },
  editionCountBadge: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 50,
  },
  editionCountBadgeText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
  },
  editionDateText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  editionTitle: {
    fontFamily: 'NewKansas-Bold',
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  editionIntro: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 16,
  },

  // Subcards de Ajustes
  subcardsList: {
    gap: 12,
  },
  subcard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
  },
  subcardBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  subcardCatBadge: {
    borderWidth: 1,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 50,
  },
  subcardCatBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  subcardImpactBadge: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 50,
  },
  subcardImpactBadgeText: {
    color: '#B45309',
    fontSize: 11,
    fontWeight: '700',
  },
  subcardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
    lineHeight: 19,
  },
  subcardSummary: {
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 18,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 50,
    marginTop: 10,
  },
  ctaButtonText: {
    color: '#166534',
    fontSize: 11.5,
    fontWeight: '700',
  },

  // Estado Vazio
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    borderRadius: 18,
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 10,
  },
  emptyTitle: {
    fontFamily: 'NewKansas-Bold',
    fontSize: 16,
    fontWeight: '800',
    color: '#1B4332',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 300,
    marginBottom: 18,
  },
  emptyResetBtn: {
    backgroundColor: '#1B4332',
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 50,
  },
  emptyResetBtnText: {
    color: '#FFEE8C',
    fontSize: 13,
    fontWeight: '700',
  },

  // Paginação
  paginationContainer: {
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  paginationInfoText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  paginationControlsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  paginationBtn: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationBtnDisabled: {
    opacity: 0.45,
  },
  paginationBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1B4332',
  },
  paginationPageNum: {
    height: 36,
    minWidth: 36,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationPageNumActive: {
    backgroundColor: '#1B4332',
    borderColor: '#1B4332',
  },
  paginationPageNumText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1B4332',
  },
  paginationPageNumTextActive: {
    color: '#FFEE8C',
  },

  // Card de Sugestões da Comunidade
  communityCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    borderRadius: 18,
    padding: 20,
    marginTop: 20,
    marginBottom: 20,
  },
  communityTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#166534',
    lineHeight: 19,
  },
  communityDesc: {
    fontSize: 12.5,
    color: '#15803d',
    lineHeight: 18,
    marginBottom: 16,
  },
  communityButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  communityBtnPrimary: {
    backgroundColor: '#1B4332',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1B4332',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  communityBtnPrimaryText: {
    color: '#FFEE8C',
    fontSize: 12.5,
    fontWeight: '700',
  },
  communityBtnSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  communityBtnSecondaryText: {
    color: '#166534',
    fontSize: 12.5,
    fontWeight: '700',
  },
});

