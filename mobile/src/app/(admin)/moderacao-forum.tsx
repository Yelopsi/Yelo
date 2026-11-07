import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import api from '../../services/api';

export default function ModeracaoForumScreen() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/admin/forum/posts');
      let postsArray = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      if (!Array.isArray(postsArray)) postsArray = [];
      const pendingPosts = postsArray.filter((p: any) => p.status === 'pending');
      setPosts(pendingPosts);
    } catch (error) {
      console.log('Erro ao buscar posts:', error);
      Alert.alert('Erro', 'Não foi possível carregar os posts do fórum.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleModerate = async (contentId: number, action: 'approve' | 'reject') => {
    try {
      await api.put('/api/admin/forum/moderate', {
        contentType: 'post',
        contentId,
        action,
      });
      Alert.alert('Sucesso', `Post ${action === 'approve' ? 'aprovado' : 'removido'} com sucesso!`);
      fetchPosts();
    } catch (error) {
      Alert.alert('Erro', 'Ocorreu um erro ao moderar.');
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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 22, color: '#1e293b' }}>
              Moderação do Fórum 🛡️
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: '#64748b', marginTop: 2 }}>
              Aprove tópicos da comunidade ou gerencie denúncias.
            </Text>
          </View>
          <TouchableOpacity
            onPress={fetchPosts}
            style={{
              backgroundColor: '#1B4332',
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999, // Botão em pílula
              gap: 6,
            }}
            activeOpacity={0.8}
          >
            <Feather name="refresh-cw" size={13} color="#ffffff" />
            <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 12 }}>
              Atualizar
            </Text>
          </TouchableOpacity>
        </View>

        {/* Lista de Posts */}
        <View style={{ gap: 14 }}>
          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#1B4332" />
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748b', marginTop: 8 }}>
                Verificando tópicos do fórum...
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
              <Text style={{ fontSize: 36, marginBottom: 10 }}>🎉</Text>
              <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 17, color: '#1e293b', textAlign: 'center' }}>
                Fórum Limpo e Seguro
              </Text>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12.5, color: '#64748b', textAlign: 'center', marginTop: 4, lineHeight: 18 }}>
                Nenhuma publicação ou denúncia pendente de moderação no momento.
              </Text>
            </View>
          ) : (
            posts.map((post, index) => (
              <View
                key={post.id || index}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                  padding: 16,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.03,
                  shadowRadius: 6,
                  elevation: 1,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 15, color: '#1e293b', flex: 1, marginRight: 8 }}>
                    {post.title || post.content}
                  </Text>
                  <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#b45309' }}>
                      Pendente
                    </Text>
                  </View>
                </View>

                {post.title && post.content ? (
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12.5, color: '#475569', lineHeight: 18, marginBottom: 12 }}>
                    {post.content}
                  </Text>
                ) : null}

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Feather name="user" size={12} color="#64748b" />
                    <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#64748b' }}>
                      {post.Psychologist?.nome || 'Anônimo'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Feather name="tag" size={12} color="#64748b" />
                    <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#64748b' }}>
                      {post.category || 'Geral'}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => handleModerate(post.id, 'approve')}
                    style={{
                      flex: 1,
                      backgroundColor: '#10b981',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: 9,
                      borderRadius: 999, // Botão em pílula
                      gap: 6,
                    }}
                    activeOpacity={0.8}
                  >
                    <Feather name="check" size={14} color="#ffffff" />
                    <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 12 }}>
                      Aprovar
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleModerate(post.id, 'reject')}
                    style={{
                      backgroundColor: '#fee2e2',
                      borderWidth: 1,
                      borderColor: '#fca5a5',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 16,
                      paddingVertical: 9,
                      borderRadius: 999, // Botão em pílula
                      gap: 6,
                    }}
                    activeOpacity={0.8}
                  >
                    <Feather name="trash-2" size={14} color="#ef4444" />
                    <Text style={{ fontFamily: 'Inter_700Bold', color: '#b91c1c', fontSize: 12 }}>
                      Rejeitar
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
