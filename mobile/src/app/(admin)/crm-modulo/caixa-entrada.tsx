import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../../services/api';

export default function CaixaEntradaScreen() {
  const router = useRouter();
  const [activeChat, setActiveChat] = useState<any>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchChats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/admin/forum/posts', { params: { limit: 20 } });
      const formatted = (response.data.data || []).map((post: any) => ({
        id: post.id,
        name: post.authorName || 'Psicólogo da Comunidade',
        lastMessage: post.title,
        time: post.createdAt ? new Date(post.createdAt).toLocaleDateString('pt-BR') : 'Recente',
        unread: post.status === 'pending' ? 1 : 0,
      }));
      setChats(formatted);
      setOfflineMode(false);
    } catch (error) {
      setOfflineMode(true);
      setChats([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchChats();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchChats();
  };

  const handleSend = () => {
    if (!replyMessage.trim()) return;
    setReplyMessage('');
  };

  const filteredChats = chats.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.lastMessage.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // TELA DE CONVERSA (CHAT)
  if (activeChat) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: '#f0fdf4' }}>
        {/* Header do Chat */}
        <View
          style={{
            backgroundColor: '#ffffff',
            paddingTop: 16,
            paddingBottom: 12,
            paddingHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: '#e2e8f0',
          }}
        >
          <TouchableOpacity onPress={() => setActiveChat(null)} style={{ marginRight: 10, padding: 4 }}>
            <Feather name="arrow-left" size={22} color="#1B4332" />
          </TouchableOpacity>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              backgroundColor: '#e8f5e9',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 10,
              borderWidth: 1,
              borderColor: '#c8e6c9',
            }}
          >
            <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 16 }}>
              {activeChat.name.charAt(0)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 15 }} numberOfLines={1}>
              {activeChat.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
              <View style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: '#10b981' }} />
              <Text style={{ fontFamily: 'Inter_500Medium', color: '#10b981', fontSize: 11 }}>Atendimento Aberto</Text>
            </View>
          </View>
        </View>

        {/* Thread de Mensagens */}
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} style={{ flex: 1 }}>
          <View
            style={{
              backgroundColor: '#ffffff',
              padding: 14,
              borderRadius: 18,
              borderBottomLeftRadius: 4,
              maxWidth: '85%',
              alignSelf: 'flex-start',
              marginBottom: 12,
              borderWidth: 1,
              borderColor: '#e2e8f0',
              shadowColor: '#000',
              shadowOpacity: 0.02,
              shadowRadius: 4,
              elevation: 1,
            }}
          >
            <Text style={{ fontFamily: 'Inter_400Regular', color: '#1e293b', fontSize: 13.5, lineHeight: 19 }}>
              {activeChat.lastMessage}
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', color: '#94a3b8', fontSize: 10, alignSelf: 'flex-end', marginTop: 6 }}>
              {activeChat.time}
            </Text>
          </View>

          {/* Mensagem simulada do Admin */}
          <View
            style={{
              backgroundColor: '#1B4332',
              padding: 14,
              borderRadius: 18,
              borderBottomRightRadius: 4,
              maxWidth: '85%',
              alignSelf: 'flex-end',
              marginBottom: 12,
              shadowColor: '#1B4332',
              shadowOpacity: 0.15,
              shadowRadius: 6,
              elevation: 2,
            }}
          >
            <Text style={{ fontFamily: 'Inter_400Regular', color: '#ffffff', fontSize: 13.5, lineHeight: 19 }}>
              Olá! Obrigado por entrar em contato. Estamos analisando sua mensagem na moderação.
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 6, gap: 4 }}>
              <Text style={{ fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>14:32</Text>
              <Feather name="check" size={12} color="#FFEE8C" />
            </View>
          </View>
        </ScrollView>

        {/* Input Bar Pílula */}
        <View
          style={{
            backgroundColor: '#ffffff',
            paddingHorizontal: 12,
            paddingVertical: 10,
            flexDirection: 'row',
            alignItems: 'center',
            borderTopWidth: 1,
            borderTopColor: '#e2e8f0',
            gap: 8,
          }}
        >
          <TextInput
            value={replyMessage}
            onChangeText={setReplyMessage}
            placeholder="Digite uma resposta..."
            placeholderTextColor="#94a3b8"
            style={{
              flex: 1,
              backgroundColor: '#f8fafc',
              borderRadius: 999,
              paddingHorizontal: 16,
              paddingVertical: 10,
              fontFamily: 'Inter_400Regular',
              fontSize: 13.5,
              borderWidth: 1,
              borderColor: '#e2e8f0',
              color: '#1e293b',
            }}
          />
          <TouchableOpacity
            onPress={handleSend}
            style={{
              backgroundColor: '#1B4332',
              width: 42,
              height: 42,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            activeOpacity={0.8}
          >
            <Feather name="send" size={16} color="#ffffff" style={{ marginLeft: -1 }} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // TELA DE LISTA DE CONVERSAS
  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#1B4332']} tintColor="#1B4332" />
        }
      >
        {offlineMode && (
          <View
            style={{
              backgroundColor: '#fef3c7',
              padding: 12,
              borderRadius: 14,
              marginBottom: 14,
              borderWidth: 1,
              borderColor: '#fde68a',
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <Feather name="wifi-off" size={16} color="#d97706" style={{ marginRight: 8 }} />
            <Text style={{ fontFamily: 'Inter_500Medium', color: '#b45309', fontSize: 12, flex: 1 }}>
              Modo Offline ativado (conectando aos servidores Yelo...).
            </Text>
          </View>
        )}

        {/* Header com Identidade Yelo */}
        <View
          style={{
            backgroundColor: '#1B4332',
            borderRadius: 20,
            padding: 20,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: '#2D6A4F',
            shadowColor: '#1B4332',
            shadowOpacity: 0.15,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#ffffff', fontSize: 22 }}>
                Caixa de Entrada 📬
              </Text>
              <Text style={{ fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 }}>
                Atendimento, dúvidas e mensagens diretas da comunidade.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(admin)/crm'))}
              style={{
                backgroundColor: 'rgba(255,255,255,0.15)',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}
              activeOpacity={0.8}
            >
              <Feather name="arrow-left" size={14} color="#ffffff" />
              <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#ffffff', fontSize: 11 }}>CRM Hub</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Barra de Busca Pílula */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#ffffff',
            borderRadius: 999,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            marginBottom: 16,
            shadowColor: '#000',
            shadowOpacity: 0.02,
            shadowRadius: 4,
            elevation: 1,
          }}
        >
          <Feather name="search" size={16} color="#64748b" />
          <TextInput
            placeholder="Buscar por nome ou mensagem..."
            placeholderTextColor="#94a3b8"
            value={searchTerm}
            onChangeText={setSearchTerm}
            style={{ flex: 1, marginLeft: 8, fontFamily: 'Inter_400Regular', fontSize: 13, color: '#1e293b' }}
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm('')}>
              <Feather name="x" size={14} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Lista de Chats */}
        <View style={{ gap: 10 }}>
          {loading ? (
            <ActivityIndicator color="#1B4332" style={{ marginVertical: 30 }} />
          ) : filteredChats.length === 0 ? (
            <View style={{ backgroundColor: '#ffffff', borderRadius: 20, padding: 30, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' }}>
              <Text style={{ fontSize: 24, marginBottom: 6 }}>📬</Text>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 16 }}>Nenhuma mensagem</Text>
              <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 12, marginTop: 4 }}>
                A caixa de entrada está em dia!
              </Text>
            </View>
          ) : (
            filteredChats.map((chat) => (
              <TouchableOpacity
                key={chat.id}
                onPress={() => setActiveChat(chat)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 16,
                  borderRadius: 20,
                  backgroundColor: '#ffffff',
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                  shadowColor: '#000',
                  shadowOpacity: 0.02,
                  shadowRadius: 4,
                  elevation: 1,
                }}
                activeOpacity={0.8}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    backgroundColor: '#e8f5e9',
                    borderRadius: 999,
                    marginRight: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: '#c8e6c9',
                  }}
                >
                  <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 16 }}>
                    {chat.name.charAt(0)}
                  </Text>
                </View>
                <View style={{ flex: 1, justifyContent: 'center' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 14.5 }}>
                      {chat.name}
                    </Text>
                    <Text style={{ fontFamily: 'Inter_400Regular', color: '#94a3b8', fontSize: 11 }}>{chat.time}</Text>
                  </View>
                  <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 12.5 }} numberOfLines={1}>
                    {chat.lastMessage}
                  </Text>
                </View>
                {chat.unread > 0 && (
                  <View
                    style={{
                      backgroundColor: '#10b981',
                      width: 20,
                      height: 20,
                      borderRadius: 999,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: 8,
                    }}
                  >
                    <Text style={{ color: '#ffffff', fontFamily: 'Inter_700Bold', fontSize: 10 }}>{chat.unread}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
