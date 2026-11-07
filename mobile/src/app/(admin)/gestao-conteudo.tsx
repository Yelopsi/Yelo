import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import api from '../../services/api';

export default function GestaoConteudoScreen() {
  const [activeTab, setActiveTab] = useState<'blog' | 'forum' | 'qna'>('blog');
  const [pendingQna, setPendingQna] = useState<any[]>([]);
  const [loadingQna, setLoadingQna] = useState(true);

  const fetchPendingQna = async () => {
    try {
      setLoadingQna(true);
      const res = await api.get('/api/admin/qna/pending');
      setPendingQna(res.data || []);
    } catch (error) {
      console.log('Erro ao buscar QnA:', error);
    } finally {
      setLoadingQna(false);
    }
  };

  useEffect(() => {
    fetchPendingQna();
  }, []);

  const handleModerateQna = async (id: number, action: 'approved' | 'rejected') => {
    try {
      await api.put(`/api/admin/qna/${id}/moderate`, { status: action });
      Alert.alert('Sucesso', `Pergunta ${action === 'approved' ? 'aprovada' : 'rejeitada'} com sucesso!`);
      fetchPendingQna();
    } catch (error) {
      Alert.alert('Erro', 'Ocorreu um erro ao moderar a pergunta.');
    }
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
      >
        {/* Header */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 22, color: '#1e293b' }}>
            Gestão de Conteúdo 📄
          </Text>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: '#64748b', marginTop: 2 }}>
            Modere perguntas públicas, artigos de blog e páginas institucionais.
          </Text>
        </View>

        {/* Q&A Pendentes */}
        <View
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            padding: 16,
            marginBottom: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.03,
            shadowRadius: 6,
            elevation: 1,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Feather name="help-circle" size={16} color="#7E22CE" />
              <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#1e293b' }}>
                Perguntas Pendentes (Q&A)
              </Text>
            </View>
            <TouchableOpacity
              onPress={fetchPendingQna}
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

          {loadingQna ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#1B4332" />
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748b', marginTop: 8 }}>
                Carregando perguntas...
              </Text>
            </View>
          ) : pendingQna.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <Text style={{ fontSize: 26, marginBottom: 6 }}>🎉</Text>
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#1e293b' }}>
                Tudo em dia!
              </Text>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748b', marginTop: 2 }}>
                Nenhuma pergunta aguardando moderação no momento.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {pendingQna.map((q, idx) => (
                <View
                  key={q.id || idx}
                  style={{
                    backgroundColor: '#f8fafc',
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: '#e2e8f0',
                    padding: 14,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <View style={{ backgroundColor: '#f3e8ff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#7e22ce' }}>
                        Pergunta Anônima
                      </Text>
                    </View>
                    <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 10.5, color: '#94a3b8' }}>
                      {q.createdAt ? new Date(q.createdAt).toLocaleDateString('pt-BR') : ''}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: '#1e293b', marginBottom: 4 }}>
                    {q.title}
                  </Text>
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12.5, color: '#475569', lineHeight: 18, marginBottom: 12 }}>
                    {q.content}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => handleModerateQna(q.id, 'approved')}
                      style={{
                        flex: 1,
                        backgroundColor: '#10b981',
                        flexDirection: 'row',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 6,
                        paddingVertical: 9,
                        borderRadius: 999, // Botão em pílula
                      }}
                      activeOpacity={0.8}
                    >
                      <Feather name="check" size={13} color="#ffffff" />
                      <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 12 }}>
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
                        paddingVertical: 9,
                        borderRadius: 999, // Botão em pílula
                      }}
                      activeOpacity={0.8}
                    >
                      <Feather name="x" size={13} color="#b91c1c" />
                      <Text style={{ fontFamily: 'Inter_700Bold', color: '#b91c1c', fontSize: 12 }}>
                        Rejeitar
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Central de Remoção de Conteúdo */}
        <View
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            padding: 16,
            marginBottom: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 10 }}>
            <Feather name="trash-2" size={16} color="#ef4444" />
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#1e293b' }}>
              Central de Remoção de Conteúdo
            </Text>
          </View>

          {/* Abas em Pílula */}
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
            {[
              { id: 'blog', label: 'Blogs' },
              { id: 'forum', label: 'Fórum' },
              { id: 'qna', label: 'Perguntas' },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id as any)}
                  style={{
                    flex: 1,
                    paddingVertical: 7,
                    borderRadius: 999,
                    backgroundColor: isActive ? '#1B4332' : '#f1f5f9',
                    alignItems: 'center',
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={{
                      fontFamily: isActive ? 'Inter_700Bold' : 'Inter_500Medium',
                      fontSize: 12,
                      color: isActive ? '#ffffff' : '#64748b',
                    }}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ alignItems: 'center', paddingVertical: 18 }}>
            <Feather name="check-circle" size={20} color="#94a3b8" />
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 6 }}>
              Nenhum item marcado para remoção nesta aba.
            </Text>
          </View>
        </View>

        {/* Gestão de Páginas Estáticas */}
        <View
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            padding: 16,
            marginBottom: 20,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 10 }}>
            <Feather name="file" size={16} color="#0284C7" />
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#1e293b' }}>
              Páginas Institucionais & Legais
            </Text>
          </View>

          <View style={{ gap: 8 }}>
            {[
              { slug: 'termos-de-uso', label: 'Termos de Uso', icon: 'shield' },
              { slug: 'politica-de-privacidade', label: 'Política de Privacidade', icon: 'lock' },
              { slug: 'sobre-nos', label: 'Sobre Nós', icon: 'info' },
            ].map((p) => (
              <View
                key={p.slug}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: '#f8fafc',
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name={p.icon as any} size={14} color="#64748b" />
                  <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12.5, color: '#1e293b' }}>
                    {p.label}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => Alert.alert('Editor de Páginas', `O editor de "${p.label}" está disponível no painel web para formatação HTML completa.`)}
                  style={{
                    backgroundColor: '#ffffff',
                    borderWidth: 1,
                    borderColor: '#cbd5e1',
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    borderRadius: 999, // Botão em pílula
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#1B4332' }}>
                    Visualizar
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
