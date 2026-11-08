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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
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

interface StaticPage {
  slug: string;
  title: string;
  description: string;
}

const STATIC_PAGES: StaticPage[] = [
  {
    slug: 'termos-de-uso',
    title: 'Termos de Uso',
    description: 'Diretrizes legais, termos de serviço e regras de conduta da plataforma Yelo.',
  },
  {
    slug: 'politica-de-privacidade',
    title: 'Política de Privacidade',
    description: 'Conformidade integral com a LGPD, segurança e tratamento de dados dos pacientes e psicólogos.',
  },
  {
    slug: 'sobre-nos',
    title: 'Sobre Nós',
    description: 'História, missão, visão e manifesto da Yelo pela democratização da saúde mental.',
  },
];

const DEFAULT_PAGE_CONTENTS: Record<string, string> = {
  'termos-de-uso': `TERMOS DE USO DA PLATAFORMA YELO

1. Introdução
Bem-vindo à Yelo. Ao utilizar nossos serviços, você concorda com os termos e diretrizes aqui dispostos.

2. Responsabilidades dos Profissionais
Os psicólogos credenciados devem possuir registro ativo no Conselho Regional de Psicologia (CRP) e seguir rigorosamente o Código de Ética Profissional do Psicólogo.

3. Responsabilidades dos Usuários
Os pacientes e usuários comprometem-se a fornecer informações verídicas e utilizar a plataforma de forma ética e respeitosa.

4. Cancelamentos e Reembolsos
As diretrizes de cancelamento de planos e agendamentos respeitam as políticas comerciais vigentes informadas na contratação.`,

  'politica-de-privacidade': `POLÍTICA DE PRIVACIDADE E PROTEÇÃO DE DADOS (LGPD)

1. Coleta e Tratamento de Dados
A Yelo coleta e trata dados pessoais exclusivamente para viabilizar o atendimento terapêutico e aprimorar a experiência na plataforma, em total conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).

2. Sigilo Profissional e Prontuários
As anotações e conteúdos clínicos são de responsabilidade exclusiva do profissional de saúde, sob sigilo garantido pelo Conselho Federal de Psicologia (CFP).

3. Direitos do Titular
Você pode solicitar a qualquer momento a confirmação, o acesso ou a exclusão de seus dados pessoais armazenados.`,

  'sobre-nos': `SOBRE A YELO

A Yelo nasceu com o propósito de democratizar o acesso à saúde mental e valorizar o trabalho dos psicólogos clínicos.

Nossa Missão:
Conectar pacientes aos profissionais mais adequados através de tecnologia humanizada e algoritmos éticos de recomendação.

Nossa Visão:
Ser o ecossistema de referência em psicologia e desenvolvimento pessoal, promovendo acolhimento e transformação em escala.`,
};

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

  // Editor de Páginas Estáticas (Modal com persistência real)
  const [editingPage, setEditingPage] = useState<StaticPage | null>(null);
  const [editorText, setEditorText] = useState('');
  const [savingPage, setSavingPage] = useState(false);

  // Pull to refresh
  const [refreshing, setRefreshing] = useState(false);

  // -------------------------------------------------------------
  // Buscar Perguntas Pendentes (Q&A)
  // -------------------------------------------------------------
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

  // -------------------------------------------------------------
  // Buscar Conteúdo para Central de Remoção (Blog, Fórum, Q&A)
  // -------------------------------------------------------------
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

  useEffect(() => {
    fetchPendingQna();
    fetchRemovalContent(activeTab);
  }, [fetchPendingQna, fetchRemovalContent, activeTab]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchPendingQna(), fetchRemovalContent(activeTab)]);
    setRefreshing(false);
  };

  // -------------------------------------------------------------
  // Moderação de Pergunta Q&A (Aprovar / Rejeitar)
  // -------------------------------------------------------------
  const handleModerateQna = (id: number, action: 'approved' | 'rejected') => {
    const actionLabel = action === 'approved' ? 'aprovar' : 'rejeitar';
    const actionTitle = action === 'approved' ? 'Aprovar Pergunta' : 'Rejeitar Pergunta';

    Alert.alert(
      actionTitle,
      `Tem certeza que deseja ${actionLabel} esta pergunta?`,
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

  // -------------------------------------------------------------
  // Exclusão de Conteúdo (Central de Remoção)
  // -------------------------------------------------------------
  const handleDeleteContentItem = (item: RemovalItem) => {
    const title = item.titulo || item.title || item.contentText || 'este item';
    Alert.alert(
      'Excluir Conteúdo',
      `Tem certeza que deseja excluir este item permanentemente?\n\n"${title.length > 50 ? title.substring(0, 50) + '...' : title}"`,
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

  // -------------------------------------------------------------
  // Gestão de Páginas Estáticas (Abrir Editor / Salvar)
  // -------------------------------------------------------------
  const handleOpenPageEditor = async (page: StaticPage) => {
    setEditingPage(page);
    try {
      const saved = await SecureStore.getItemAsync(`page-content-${page.slug}`);
      setEditorText(saved || DEFAULT_PAGE_CONTENTS[page.slug] || '');
    } catch {
      setEditorText(DEFAULT_PAGE_CONTENTS[page.slug] || '');
    }
  };

  const handleSavePageContent = async () => {
    if (!editingPage) return;
    setSavingPage(true);
    try {
      await SecureStore.setItemAsync(`page-content-${editingPage.slug}`, editorText);
      Alert.alert('Sucesso', `Conteúdo da página "${editingPage.slug}" salvo com sucesso!`);
      setEditingPage(null);
    } catch (e: any) {
      Alert.alert('Erro', 'Não foi possível salvar as alterações da página.');
    } finally {
      setSavingPage(false);
    }
  };

  // Filtro de busca na central de remoção
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
        {/* ========================================================= */}
        {/* HEADER: GESTÃO DE CONTEÚDO (Espelho Web: .moderation-header) */}
        {/* ========================================================= */}
        <View
          style={{
            backgroundColor: '#1B4332',
            borderRadius: 16,
            padding: 20,
            marginBottom: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 22, color: '#ffffff' }}>
              Gestão de Conteúdo
            </Text>

            <TouchableOpacity
              onPress={handleRefresh}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                backgroundColor: 'rgba(255,255,255,0.18)',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
              }}
              activeOpacity={0.8}
            >
              <Feather name="refresh-cw" size={12} color="#ffffff" />
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#ffffff' }}>
                Atualizar
              </Text>
            </TouchableOpacity>
          </View>

          <Text
            style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 13,
              color: 'rgba(255,255,255,0.85)',
              marginTop: 6,
              lineHeight: 18,
            }}
          >
            Modere avaliações, perguntas da comunidade e páginas estáticas.
          </Text>
        </View>

        {/* ========================================================= */}
        {/* CARD 1: MODERAÇÃO DE PERGUNTAS (Q&A) (Espelho Web)       */}
        {/* ========================================================= */}
        <View
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 16,
            padding: 20,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.03,
            shadowRadius: 6,
            elevation: 1,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottomWidth: 1,
              borderBottomColor: '#e9ecef',
              paddingBottom: 14,
              marginBottom: 16,
            }}
          >
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#1e293b' }}>
              Moderação de Perguntas (Q&A)
            </Text>
            <View
              style={{
                backgroundColor: pendingQna.length > 0 ? '#fee2e2' : '#f0fdf4',
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: pendingQna.length > 0 ? '#fca5a5' : '#bbf7d0',
              }}
            >
              <Text
                style={{
                  fontFamily: 'Inter_700Bold',
                  fontSize: 11,
                  color: pendingQna.length > 0 ? '#991b1b' : '#166534',
                }}
              >
                {pendingQna.length} {pendingQna.length === 1 ? 'pendente' : 'pendentes'}
              </Text>
            </View>
          </View>

          {loadingQna ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#1B4332" />
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: '#888888', marginTop: 8 }}>
                Carregando perguntas...
              </Text>
            </View>
          ) : pendingQna.length === 0 ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: '#888888' }}>
                Nenhuma pergunta pendente. 🎉
              </Text>
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              {pendingQna.map((q) => (
                <View
                  key={q.id}
                  style={{
                    backgroundColor: '#ffffff',
                    borderWidth: 1,
                    borderColor: '#e2e8f0',
                    borderRadius: 12,
                    padding: 16,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.02,
                    shadowRadius: 3,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: '#1B4332' }}>
                      {q.Patient?.nome || 'Pergunta Anônima'}
                    </Text>
                    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748b' }}>
                      {q.createdAt ? new Date(q.createdAt).toLocaleDateString('pt-BR') : ''}
                    </Text>
                  </View>

                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: '#1e293b', marginBottom: 6 }}>
                    {q.title}
                  </Text>
                  <Text
                    style={{
                      fontFamily: 'Inter_400Regular',
                      fontSize: 13,
                      color: '#444444',
                      lineHeight: 19,
                      backgroundColor: '#f9f9f9',
                      padding: 10,
                      borderRadius: 8,
                      marginBottom: 12,
                    }}
                  >
                    {q.content}
                  </Text>

                  {/* Ações (Aprovar / Rejeitar) */}
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      onPress={() => handleModerateQna(q.id, 'approved')}
                      style={{
                        flex: 1,
                        backgroundColor: '#10b981',
                        paddingVertical: 10,
                        borderRadius: 999,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 6,
                      }}
                      activeOpacity={0.8}
                    >
                      <Feather name="check" size={14} color="#ffffff" />
                      <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 13 }}>
                        Aprovar
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleModerateQna(q.id, 'rejected')}
                      style={{
                        flex: 1,
                        backgroundColor: '#ffffff',
                        borderWidth: 1,
                        borderColor: '#fca5a5',
                        paddingVertical: 10,
                        borderRadius: 999,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 6,
                      }}
                      activeOpacity={0.8}
                    >
                      <Feather name="x" size={14} color="#dc2626" />
                      <Text style={{ fontFamily: 'Inter_700Bold', color: '#dc2626', fontSize: 13 }}>
                        Rejeitar
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ========================================================= */}
        {/* CARD 2: CENTRAL DE REMOÇÃO DE CONTEÚDO (Espelho Web)     */}
        {/* ========================================================= */}
        <View
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 16,
            padding: 20,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.03,
            shadowRadius: 6,
            elevation: 1,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottomWidth: 1,
              borderBottomColor: '#e9ecef',
              paddingBottom: 14,
              marginBottom: 16,
            }}
          >
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#1e293b' }}>
              Central de Remoção de Conteúdo
            </Text>
            <TouchableOpacity
              onPress={() => fetchRemovalContent(activeTab)}
              style={{
                width: 32,
                height: 32,
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

          {/* Abas: Blogs, Fórum, Perguntas (Espelho Web: .content-tabs) */}
          <View
            style={{
              flexDirection: 'row',
              borderBottomWidth: 1,
              borderBottomColor: '#eee',
              marginBottom: 16,
            }}
          >
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
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderBottomWidth: 3,
                    borderBottomColor: isActive ? '#1B4332' : 'transparent',
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={{
                      fontFamily: isActive ? 'Inter_700Bold' : 'Inter_600SemiBold',
                      fontSize: 14,
                      color: isActive ? '#1B4332' : '#64748b',
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
              placeholder={`Filtrar ${activeTab === 'blog' ? 'artigos' : activeTab === 'forum' ? 'tópicos' : 'perguntas'}...`}
              placeholderTextColor="#94a3b8"
              style={{
                flex: 1,
                marginLeft: 8,
                fontFamily: 'Inter_400Regular',
                fontSize: 13,
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
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#1B4332" />
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: '#888888', marginTop: 8 }}>
                Carregando...
              </Text>
            </View>
          ) : filteredRemovalItems.length === 0 ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: '#888888' }}>
                Nenhum conteúdo encontrado.
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
                      backgroundColor: '#ffffff',
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: '#e2e8f0',
                      padding: 14,
                    }}
                  >
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text
                        style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: '#0f172a' }}
                        numberOfLines={2}
                      >
                        {title}
                      </Text>

                      <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#64748b', marginTop: 3 }}>
                        Por: {author} em {date}
                      </Text>

                      {item.reportCount !== undefined && (
                        <View style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View
                            style={{
                              backgroundColor: '#fee2e2',
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: 999,
                            }}
                          >
                            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#b91c1c' }}>
                              🚨 {item.reportCount} denúncias
                            </Text>
                          </View>
                          {item.contentType && (
                            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#64748b' }}>
                              Tipo: {item.contentType}
                            </Text>
                          )}
                        </View>
                      )}
                    </View>

                    <TouchableOpacity
                      onPress={() => handleDeleteContentItem(item)}
                      style={{
                        backgroundColor: '#fee2e2',
                        borderWidth: 1,
                        borderColor: '#fca5a5',
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 999,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      activeOpacity={0.7}
                    >
                      <Feather name="trash-2" size={12} color="#b91c1c" />
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#b91c1c' }}>
                        {activeTab === 'forum' ? 'Remover' : 'Excluir'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ========================================================= */}
        {/* CARD 3: GESTÃO DE PÁGINAS ESTÁTICAS (Espelho Web)        */}
        {/* ========================================================= */}
        <View
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 16,
            padding: 20,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.03,
            shadowRadius: 6,
            elevation: 1,
          }}
        >
          <Text
            style={{
              fontFamily: 'Fraunces_700Bold',
              fontSize: 18,
              color: '#1e293b',
              borderBottomWidth: 1,
              borderBottomColor: '#e9ecef',
              paddingBottom: 14,
              marginBottom: 16,
            }}
          >
            Gestão de Páginas Estáticas
          </Text>

          {/* Tabela de Páginas Estáticas (Exata paridade com a web) */}
          <View style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
            {/* Header da Tabela */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#f8fafc',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: '#e2e8f0',
              }}
            >
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#475569', textTransform: 'uppercase' }}>
                Página
              </Text>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#475569', textTransform: 'uppercase' }}>
                Ações
              </Text>
            </View>

            {/* Linhas da Tabela */}
            {STATIC_PAGES.map((page, idx) => (
              <View
                key={page.slug}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderBottomWidth: idx === STATIC_PAGES.length - 1 ? 0 : 1,
                  borderBottomColor: '#f1f5f9',
                  backgroundColor: '#ffffff',
                }}
              >
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#0f172a' }}>
                    {page.slug}
                  </Text>
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                    {page.title}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => handleOpenPageEditor(page)}
                  style={{
                    backgroundColor: '#f1f5f9',
                    borderWidth: 1,
                    borderColor: '#cbd5e1',
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderRadius: 999,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                  }}
                  activeOpacity={0.7}
                >
                  <Feather name="edit-2" size={12} color="#1B4332" />
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#1B4332' }}>
                    Editar
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        {/* ========================================================= */}
        {/* CARD 4: GESTÃO DA COMUNIDADE (Espelho Web)               */}
        {/* ========================================================= */}
        <View
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 16,
            padding: 20,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.03,
            shadowRadius: 6,
            elevation: 1,
          }}
        >
          <Text
            style={{
              fontFamily: 'Fraunces_700Bold',
              fontSize: 18,
              color: '#1e293b',
              borderBottomWidth: 1,
              borderBottomColor: '#e9ecef',
              paddingBottom: 14,
              marginBottom: 12,
            }}
          >
            Gestão da Comunidade
          </Text>

          <Text
            style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 13,
              color: '#475569',
              lineHeight: 19,
              marginBottom: 16,
            }}
          >
            Edite o banner de eventos e os links de recursos que aparecem no dashboard dos psicólogos.
          </Text>

          <TouchableOpacity
            onPress={() => router.push('/(admin)/comunidade-gestao')}
            style={{
              backgroundColor: '#1B4332',
              paddingVertical: 12,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
            }}
            activeOpacity={0.8}
          >
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: '#ffffff' }}>
              Gerenciar Comunidade
            </Text>
            <Feather name="arrow-right" size={14} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ========================================================= */}
      {/* MODAL DE EDIÇÃO DE PÁGINA (Espelho de admin_editar_pagina) */}
      {/* ========================================================= */}
      <Modal
        visible={!!editingPage}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditingPage(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
        >
          <View
            style={{
              backgroundColor: '#ffffff',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: '90%',
              padding: 20,
              paddingBottom: 36,
            }}
          >
            {/* Header do Editor */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#1e293b' }}>
                  Editando Página: {editingPage?.slug}
                </Text>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                  Use o editor abaixo para modificar o conteúdo da página.
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setEditingPage(null)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  backgroundColor: '#f1f5f9',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Feather name="x" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Barra de Ferramentas Simples de Edição */}
            <View
              style={{
                flexDirection: 'row',
                gap: 8,
                backgroundColor: '#f8fafc',
                padding: 8,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                marginBottom: 10,
              }}
            >
              <TouchableOpacity
                onPress={() => setEditorText((prev) => `${prev}\n\n**Texto em Negrito**`)}
                style={{ backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}
              >
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#1B4332' }}>B</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setEditorText((prev) => `${prev}\n\n*Texto em Itálico*`)}
                style={{ backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}
              >
                <Text style={{ fontFamily: 'Inter_700Bold', fontStyle: 'italic', fontSize: 12, color: '#1B4332' }}>I</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setEditorText((prev) => `${prev}\n\n## Novo Título`)}
                style={{ backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}
              >
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#1B4332' }}>H2</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setEditorText((prev) => `${prev}\n• Item de lista`)}
                style={{ backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}
              >
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#1B4332' }}>• Lista</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setEditorText(DEFAULT_PAGE_CONTENTS[editingPage?.slug || ''] || '')}
                style={{ backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, marginLeft: 'auto' }}
              >
                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#64748b' }}>Restaurar Padrão</Text>
              </TouchableOpacity>
            </View>

            {/* Caixa de Texto do Editor */}
            <TextInput
              value={editorText}
              onChangeText={setEditorText}
              multiline
              textAlignVertical="top"
              placeholder="Digite o conteúdo da página aqui..."
              style={{
                height: 280,
                backgroundColor: '#f8fafc',
                borderWidth: 1,
                borderColor: '#cbd5e1',
                borderRadius: 14,
                padding: 14,
                fontFamily: 'Inter_400Regular',
                fontSize: 13,
                color: '#1e293b',
                lineHeight: 20,
                marginBottom: 16,
              }}
            />

            {/* Ações do Editor */}
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                onPress={handleSavePageContent}
                disabled={savingPage}
                style={{
                  backgroundColor: '#1B4332',
                  paddingVertical: 13,
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                }}
                activeOpacity={0.8}
              >
                {savingPage ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Feather name="save" size={15} color="#ffffff" />
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: '#ffffff' }}>
                      Salvar Conteúdo
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setEditingPage(null)}
                style={{
                  backgroundColor: '#f1f5f9',
                  paddingVertical: 11,
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                activeOpacity={0.8}
              >
                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12.5, color: '#64748b' }}>
                  Voltar para Gestão de Conteúdo
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
