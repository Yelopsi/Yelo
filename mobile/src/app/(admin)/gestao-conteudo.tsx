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
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';

interface QnaItem {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  status?: string;
  Patient?: { nome: string };
}

interface RemovalItem {
  id: number | string;
  contentId?: number | string;
  contentType?: 'post' | 'comment';
  titulo?: string;
  title?: string;
  contentText?: string;
  content?: string;
  createdAt?: string;
  firstReportDate?: string;
  reportCount?: number;
  status?: string;
  autor?: { nome: string };
  authorName?: string;
  Psychologist?: { nome: string };
  Patient?: { nome: string };
}

interface StaticPageItem {
  slug: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  description: string;
  lastUpdated: string;
}

const STATIC_PAGES: StaticPageItem[] = [
  {
    slug: 'termos-de-uso',
    label: 'Termos de Uso',
    icon: 'shield',
    description: 'Diretrizes legais, termos de serviço e regras de conduta da plataforma Yelo.',
    lastUpdated: '12/10/2026',
  },
  {
    slug: 'politica-de-privacidade',
    label: 'Política de Privacidade',
    icon: 'lock',
    description: 'Conformidade integral com a LGPD, segurança e tratamento de dados dos pacientes e psicólogos.',
    lastUpdated: '15/10/2026',
  },
  {
    slug: 'sobre-nos',
    label: 'Sobre Nós',
    icon: 'info',
    description: 'História, missão, visão e manifesto da Yelo pela democratização da saúde mental.',
    lastUpdated: '01/09/2026',
  },
  {
    slug: 'como-funciona',
    label: 'Como Funciona',
    icon: 'help-circle',
    description: 'Guia visual explicativo para novos pacientes e psicólogos credenciados.',
    lastUpdated: '05/10/2026',
  },
];

export default function GestaoConteudoScreen() {
  const router = useRouter();

  // Moderação de Perguntas
  const [pendingQna, setPendingQna] = useState<QnaItem[]>([]);
  const [loadingQna, setLoadingQna] = useState(true);

  // Central de Remoção de Conteúdo
  const [activeTab, setActiveTab] = useState<'blog' | 'forum' | 'qna'>('blog');
  const [removalItems, setRemovalItems] = useState<RemovalItem[]>([]);
  const [loadingRemoval, setLoadingRemoval] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // Modal de Páginas Estáticas
  const [selectedPage, setSelectedPage] = useState<StaticPageItem | null>(null);

  // Estado geral de refresh
  const [refreshing, setRefreshing] = useState(false);

  // Buscar perguntas pendentes
  const fetchPendingQna = useCallback(async () => {
    try {
      setLoadingQna(true);
      const res = await api.get('/api/admin/qna/pending');
      const data = Array.isArray(res.data) ? res.data : [];
      setPendingQna(data);
    } catch (error) {
      console.log('Erro ao buscar Q&A pendentes:', error);
      setPendingQna([]);
    } finally {
      setLoadingQna(false);
    }
  }, []);

  // Buscar itens para a central de remoção
  const fetchRemovalContent = useCallback(async (type: 'blog' | 'forum' | 'qna') => {
    try {
      setLoadingRemoval(true);
      let endpoint = '';
      if (type === 'blog') endpoint = '/api/admin/content/blog';
      else if (type === 'forum') endpoint = '/api/admin/forum/reports';
      else if (type === 'qna') endpoint = '/api/admin/content/qna';

      const res = await api.get(endpoint);
      const data = Array.isArray(res.data) ? res.data : [];
      setRemovalItems(data);
    } catch (error) {
      console.log(`Erro ao carregar conteúdo para remoção (${type}):`, error);
      setRemovalItems([]);
    } finally {
      setLoadingRemoval(false);
    }
  }, []);

  // Carregar inicial
  useEffect(() => {
    fetchPendingQna();
    fetchRemovalContent(activeTab);
  }, [fetchPendingQna, fetchRemovalContent, activeTab]);

  // Pull to refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchPendingQna(), fetchRemovalContent(activeTab)]);
    setRefreshing(false);
  };

  // Moderação de Perguntas
  const handleModerateQna = (id: number, action: 'approved' | 'rejected') => {
    const actionLabel = action === 'approved' ? 'aprovar' : 'rejeitar';
    const actionTitle = action === 'approved' ? 'Aprovar Pergunta' : 'Rejeitar Pergunta';

    Alert.alert(
      actionTitle,
      `Tem certeza que deseja ${actionLabel} esta pergunta pública?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: action === 'approved' ? 'Aprovar' : 'Rejeitar',
          style: action === 'rejected' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await api.put(`/api/admin/qna/${id}/moderate`, {
                action: action === 'approved' ? 'approve' : 'reject',
              });
              Alert.alert('Sucesso', `Pergunta ${action === 'approved' ? 'aprovada' : 'rejeitada'} com sucesso!`);
              fetchPendingQna();
            } catch (error: any) {
              const msg = error.response?.data?.message || error.response?.data?.error || 'Erro ao moderar pergunta.';
              Alert.alert('Erro', msg);
            }
          },
        },
      ]
    );
  };

  // Exclusão na Central de Remoção
  const handleDeleteContentItem = (item: RemovalItem) => {
    const title = item.titulo || item.title || item.contentText || 'este item';
    Alert.alert(
      'Excluir Conteúdo',
      `Tem certeza que deseja excluir permanentemente "${title.length > 50 ? title.substring(0, 50) + '...' : title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              if (activeTab === 'blog') {
                await api.delete(`/api/admin/content/blog/${item.id}`);
              } else if (activeTab === 'forum') {
                const contentType = item.contentType || 'post';
                const contentId = item.contentId || item.id;
                await api.put('/api/admin/forum/moderate', {
                  contentType,
                  contentId,
                  action: 'remove',
                });
              } else if (activeTab === 'qna') {
                await api.delete(`/api/admin/content/qna/${item.id}`);
              }

              Alert.alert('Sucesso', 'Conteúdo excluído com sucesso!');
              fetchRemovalContent(activeTab);
            } catch (error: any) {
              const msg = error.response?.data?.error || error.response?.data?.message || 'Erro ao excluir conteúdo.';
              Alert.alert('Erro', msg);
            }
          },
        },
      ]
    );
  };

  // Filtragem de remoção por busca
  const filteredRemovalItems = removalItems.filter((item) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    const title = (item.titulo || item.title || item.contentText || '').toLowerCase();
    const author = (
      item.autor?.nome ||
      item.authorName ||
      item.Psychologist?.nome ||
      item.Patient?.nome ||
      ''
    ).toLowerCase();
    return title.includes(q) || author.includes(q);
  });

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
            Gestão de Conteúdo 📄
          </Text>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: '#e2e8f0', marginTop: 4, lineHeight: 18 }}>
            Modere avaliações, perguntas da comunidade e páginas estáticas do site.
          </Text>
        </View>

        {/* Card 1: Moderação de Perguntas (Q&A) */}
        <View
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            padding: 18,
            marginBottom: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 6,
            elevation: 2,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 14,
              borderBottomWidth: 1,
              borderBottomColor: '#f1f5f9',
              paddingBottom: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  backgroundColor: '#f3e8ff',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Feather name="help-circle" size={17} color="#7E22CE" />
              </View>
              <View>
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#1e293b' }}>
                  Moderação de Perguntas (Q&A)
                </Text>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#64748b' }}>
                  Dúvidas enviadas por pacientes para os psicólogos
                </Text>
              </View>
            </View>

            <View
              style={{
                backgroundColor: pendingQna.length > 0 ? '#ef4444' : '#10b981',
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 999,
              }}
            >
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#ffffff' }}>
                {pendingQna.length}
              </Text>
            </View>
          </View>

          {loadingQna ? (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#1B4332" />
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748b', marginTop: 8 }}>
                Carregando perguntas pendentes...
              </Text>
            </View>
          ) : pendingQna.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <View
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 999,
                  backgroundColor: '#ecfdf5',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 10,
                }}
              >
                <Feather name="check-circle" size={26} color="#10b981" />
              </View>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: '#1e293b' }}>
                Tudo em dia! 🎉
              </Text>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748b', marginTop: 2, textAlign: 'center' }}>
                Nenhuma pergunta aguardando moderação no momento.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              {pendingQna.map((q) => (
                <View
                  key={q.id}
                  style={{
                    backgroundColor: '#f8fafc',
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: '#e2e8f0',
                    padding: 16,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <View
                      style={{
                        backgroundColor: '#f3e8ff',
                        paddingHorizontal: 10,
                        paddingVertical: 3,
                        borderRadius: 999,
                      }}
                    >
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10.5, color: '#7e22ce' }}>
                        Pergunta Anônima
                      </Text>
                    </View>
                    <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#94a3b8' }}>
                      {q.createdAt ? new Date(q.createdAt).toLocaleDateString('pt-BR') : ''}
                    </Text>
                  </View>

                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: '#1e293b', marginBottom: 6 }}>
                    {q.title || 'Dúvida sem título'}
                  </Text>
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12.5, color: '#475569', lineHeight: 18, marginBottom: 14 }}>
                    {q.content}
                  </Text>

                  {/* Ações em Pílula */}
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      onPress={() => handleModerateQna(q.id, 'approved')}
                      style={{
                        flex: 1,
                        backgroundColor: '#10b981',
                        flexDirection: 'row',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 6,
                        paddingVertical: 10,
                        borderRadius: 999,
                      }}
                      activeOpacity={0.8}
                    >
                      <Feather name="check" size={14} color="#ffffff" />
                      <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 12.5 }}>
                        Aprovar
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleModerateQna(q.id, 'rejected')}
                      style={{
                        flex: 1,
                        backgroundColor: '#fee2e2',
                        borderWidth: 1,
                        borderColor: '#fca5a5',
                        flexDirection: 'row',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 6,
                        paddingVertical: 10,
                        borderRadius: 999,
                      }}
                      activeOpacity={0.8}
                    >
                      <Feather name="x" size={14} color="#b91c1c" />
                      <Text style={{ fontFamily: 'Inter_700Bold', color: '#b91c1c', fontSize: 12.5 }}>
                        Rejeitar
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Card 2: Central de Remoção de Conteúdo */}
        <View
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            padding: 18,
            marginBottom: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 6,
            elevation: 2,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 14,
              borderBottomWidth: 1,
              borderBottomColor: '#f1f5f9',
              paddingBottom: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  backgroundColor: '#fee2e2',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Feather name="trash-2" size={16} color="#ef4444" />
              </View>
              <View>
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#1e293b' }}>
                  Central de Remoção de Conteúdo
                </Text>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#64748b' }}>
                  Exclua publicações, tópicos do fórum ou dúvidas
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => fetchRemovalContent(activeTab)}
              style={{
                width: 30,
                height: 30,
                borderRadius: 999,
                backgroundColor: '#f8fafc',
                borderWidth: 1,
                borderColor: '#e2e8f0',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              activeOpacity={0.7}
            >
              <Feather name="refresh-cw" size={13} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Abas em Pílula */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            {[
              { id: 'blog', label: 'Blogs' },
              { id: 'forum', label: 'Fórum' },
              { id: 'qna', label: 'Perguntas' },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => {
                    setActiveTab(tab.id as any);
                    setSearchFilter('');
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 9,
                    borderRadius: 999,
                    backgroundColor: isActive ? '#1B4332' : '#f1f5f9',
                    alignItems: 'center',
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={{
                      fontFamily: isActive ? 'Inter_700Bold' : 'Inter_500Medium',
                      fontSize: 12.5,
                      color: isActive ? '#ffffff' : '#64748b',
                    }}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Barra de Pesquisa */}
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
              marginBottom: 14,
            }}
          >
            <Feather name="search" size={15} color="#94a3b8" />
            <TextInput
              value={searchFilter}
              onChangeText={setSearchFilter}
              placeholder={`Filtrar ${activeTab === 'blog' ? 'artigos' : activeTab === 'forum' ? 'denúncias' : 'perguntas'}...`}
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
            {searchFilter.length > 0 && (
              <TouchableOpacity onPress={() => setSearchFilter('')}>
                <Feather name="x-circle" size={15} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Lista de Remoção */}
          {loadingRemoval ? (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#1B4332" />
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748b', marginTop: 8 }}>
                Carregando conteúdos...
              </Text>
            </View>
          ) : filteredRemovalItems.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 22 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 999,
                  backgroundColor: '#f1f5f9',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 8,
                }}
              >
                <Feather name="inbox" size={20} color="#94a3b8" />
              </View>
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#475569' }}>
                Nenhum conteúdo encontrado
              </Text>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#94a3b8', marginTop: 2, textAlign: 'center' }}>
                {searchFilter ? 'Nenhum item corresponde à busca informada.' : 'Não há registros disponíveis nesta categoria.'}
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {filteredRemovalItems.map((item, idx) => {
                const title = item.titulo || item.title || item.contentText || 'Sem título';
                const author = item.autor?.nome || item.authorName || item.Psychologist?.nome || item.Patient?.nome || 'Anônimo';
                const date = item.createdAt || item.firstReportDate
                  ? new Date((item.createdAt || item.firstReportDate) as string).toLocaleDateString('pt-BR')
                  : 'Data não informada';

                return (
                  <View
                    key={item.id || item.contentId || idx}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backgroundColor: '#f8fafc',
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: '#e2e8f0',
                      padding: 12,
                    }}
                  >
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text
                        style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#1e293b' }}
                        numberOfLines={2}
                      >
                        {title}
                      </Text>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: '#64748b' }}>
                          Por: <Text style={{ fontFamily: 'Inter_600SemiBold' }}>{author}</Text>
                        </Text>
                        <Text style={{ color: '#cbd5e1' }}>•</Text>
                        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: '#94a3b8' }}>
                          {date}
                        </Text>
                      </View>

                      {item.reportCount !== undefined && (
                        <View style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <View
                            style={{
                              backgroundColor: '#fee2e2',
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: 999,
                            }}
                          >
                            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#b91c1c' }}>
                              🚨 {item.reportCount} {item.reportCount === 1 ? 'denúncia' : 'denúncias'}
                            </Text>
                          </View>
                          {item.contentType && (
                            <View
                              style={{
                                backgroundColor: '#f1f5f9',
                                paddingHorizontal: 6,
                                paddingVertical: 2,
                                borderRadius: 999,
                              }}
                            >
                              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 10, color: '#64748b' }}>
                                Tipo: {item.contentType}
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>

                    <TouchableOpacity
                      onPress={() => handleDeleteContentItem(item)}
                      style={{
                        backgroundColor: '#ffffff',
                        borderWidth: 1,
                        borderColor: '#fca5a5',
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 999,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      activeOpacity={0.7}
                    >
                      <Feather name="trash-2" size={12} color="#b91c1c" />
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#b91c1c' }}>
                        {activeTab === 'forum' ? 'Remover' : 'Excluir'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Card 3: Gestão de Páginas Estáticas */}
        <View
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            padding: 18,
            marginBottom: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 6,
            elevation: 2,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginBottom: 14,
              borderBottomWidth: 1,
              borderBottomColor: '#f1f5f9',
              paddingBottom: 12,
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                backgroundColor: '#e0f2fe',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Feather name="file-text" size={16} color="#0284C7" />
            </View>
            <View>
              <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#1e293b' }}>
                Gestão de Páginas Estáticas
              </Text>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#64748b' }}>
                Documentos institucionais e termos legais do Yelo
              </Text>
            </View>
          </View>

          <View style={{ gap: 8 }}>
            {STATIC_PAGES.map((page) => (
              <View
                key={page.slug}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: '#f8fafc',
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 10 }}>
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 999,
                      backgroundColor: '#ffffff',
                      borderWidth: 1,
                      borderColor: '#e2e8f0',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Feather name={page.icon} size={13} color="#0284C7" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#1e293b' }}>
                      {page.label}
                    </Text>
                    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10.5, color: '#64748b' }}>
                      Slug: /{page.slug}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => setSelectedPage(page)}
                  style={{
                    backgroundColor: '#ffffff',
                    borderWidth: 1,
                    borderColor: '#cbd5e1',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 999,
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#1B4332' }}>
                    Editar / Ver
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        {/* Card 4: Gestão da Comunidade & Fórum */}
        <View
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            padding: 18,
            marginBottom: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 6,
            elevation: 2,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginBottom: 10,
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                backgroundColor: '#ecfdf5',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Feather name="users" size={16} color="#10b981" />
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#1e293b' }}>
              Gestão da Comunidade 👥
            </Text>
          </View>

          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12.5, color: '#64748b', lineHeight: 18, marginBottom: 14 }}>
            Edite o banner de eventos, os comunicados oficiais e os links de recursos que aparecem no painel dos psicólogos.
          </Text>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={() => router.push('/(admin)/comunidade-gestao')}
              style={{
                flex: 1,
                backgroundColor: '#1B4332',
                paddingVertical: 10,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 6,
              }}
              activeOpacity={0.8}
            >
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#ffffff' }}>
                Gerenciar Comunidade
              </Text>
              <Feather name="arrow-right" size={13} color="#ffffff" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/(admin)/moderacao-forum')}
              style={{
                flex: 1,
                backgroundColor: '#ffffff',
                borderWidth: 1,
                borderColor: '#cbd5e1',
                paddingVertical: 10,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 6,
              }}
              activeOpacity={0.8}
            >
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#1B4332' }}>
                Moderação do Fórum
              </Text>
              <Feather name="message-square" size={13} color="#1B4332" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Modal de Detalhes da Página Estática */}
      <Modal
        visible={!!selectedPage}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSelectedPage(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 20,
              padding: 22,
              width: '100%',
              maxWidth: 420,
              borderWidth: 1,
              borderColor: '#e2e8f0',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.15,
              shadowRadius: 20,
              elevation: 5,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 999,
                    backgroundColor: '#e0f2fe',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Feather name={selectedPage?.icon || 'file'} size={16} color="#0284C7" />
                </View>
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 17, color: '#1e293b' }}>
                  {selectedPage?.label}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setSelectedPage(null)}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 999,
                  backgroundColor: '#f1f5f9',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Feather name="x" size={16} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={{ backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, marginBottom: 14 }}>
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>
                Rota Pública do Site
              </Text>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: '#0284C7', marginTop: 2 }}>
                https://yelopsi.com.br/{selectedPage?.slug}
              </Text>
            </View>

            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: '#475569', lineHeight: 20, marginBottom: 14 }}>
              {selectedPage?.description}
            </Text>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#94a3b8' }}>
                Última revisão
              </Text>
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#1e293b' }}>
                {selectedPage?.lastUpdated}
              </Text>
            </View>

            <View style={{ gap: 8 }}>
              <TouchableOpacity
                onPress={() => {
                  Alert.alert(
                    'Editor Web Avançado',
                    'O editor com formatação em tempo real, HTML rico e preview responsivo está configurado no painel administrativo web em:\n\nadmin_editar_pagina.html?page=' +
                      selectedPage?.slug
                  );
                }}
                style={{
                  backgroundColor: '#1B4332',
                  paddingVertical: 12,
                  borderRadius: 999,
                  alignItems: 'center',
                }}
                activeOpacity={0.8}
              >
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: '#ffffff' }}>
                  Abrir Informações de Edição
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setSelectedPage(null)}
                style={{
                  backgroundColor: '#f1f5f9',
                  paddingVertical: 10,
                  borderRadius: 999,
                  alignItems: 'center',
                }}
                activeOpacity={0.8}
              >
                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#64748b' }}>
                  Fechar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
