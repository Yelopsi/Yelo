import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Image, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import api from '../../../services/api';

export default function CaixaEntradaScreen() {
  const [activeChat, setActiveChat] = useState<any>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);

  useEffect(() => {
    const fetchChats = async () => {
      try {
        setLoading(true);
        const response = await api.get('/api/admin/forum/posts', { params: { limit: 10 } });
        const formatted = (response.data.data || []).map((post: any) => ({
          id: post.id,
          name: post.authorName,
          lastMessage: post.title,
          time: post.createdAt ? new Date(post.createdAt).toLocaleDateString('pt-BR') : 'Recente',
          unread: post.status === 'pending' ? 1 : 0
        }));
        setChats(formatted);
        setOfflineMode(false);
      } catch (error) {
        setOfflineMode(true);
        setChats([
          { id: 1, name: 'Dra. Camila Soares', lastMessage: 'Como faço para alterar meu plano?', time: '14:30', unread: 2 },
          { id: 2, name: 'Dr. Roberto Alves', lastMessage: 'Obrigado pelo suporte!', time: 'Ontem', unread: 0 },
        ]);
      } finally {
        setLoading(false);
      }
    };
    fetchChats();
  }, []);



  const handleSend = () => {
    if (!replyMessage.trim()) return;
    setReplyMessage('');
  };

  // TELA DE CONVERSA (CHAT)
  if (activeChat) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-[#e5ddd5]">
        {/* Header do Chat */}
        <View className="bg-[#f8f9fa] pt-[15px] pb-[10px] px-[15px] flex-row items-center border-b border-[#e9ecef] z-10 pt-safe">
          <TouchableOpacity onPress={() => setActiveChat(null)} className="mr-[10px] p-[5px]">
            <Feather name="arrow-left" size={24} color="#1B4332" />
          </TouchableOpacity>
          <View className="w-[40px] h-[40px] rounded-full bg-[#cbd5e1] items-center justify-center mr-[12px]">
            <Text className="font-title text-white">{activeChat.name.charAt(0)}</Text>
          </View>
          <View className="flex-1">
            <Text className="font-title text-[#111] text-[16px]">{activeChat.name}</Text>
            <Text className="font-sans text-[#1B4332] text-[12px]">online</Text>
          </View>
        </View>

        {/* Thread de Mensagens */}
        <ScrollView contentContainerStyle={{ padding: 15 }} className="flex-1">
          <View className="bg-[#fff] p-[10px] rounded-r-[8px] rounded-bl-[8px] max-w-[80%] self-start mb-[10px] border border-[#f0f0f0]">
            <Text className="font-sans text-[#333] text-[14px] leading-[20px]">{activeChat.lastMessage}</Text>
            <Text className="font-sans text-[#999] text-[10px] self-end mt-[5px]">{activeChat.time}</Text>
          </View>
          
          {/* Mensagem simulada do Admin se fosse respondida */}
          <View className="bg-[#1B4332] p-[10px] rounded-l-[8px] rounded-br-[8px] max-w-[80%] self-end mb-[10px]">
            <Text className="font-sans text-white text-[14px] leading-[20px]">Olá! Vou te ajudar com isso agora mesmo.</Text>
            <View className="flex-row items-center justify-end mt-[5px]">
              <Text className="font-sans text-[#cbd5e1] text-[10px] mr-[4px]">14:32</Text>
              <Feather name="check-circle" size={12} color="#cbd5e1" />
            </View>
          </View>
        </ScrollView>

        {/* Input Bar */}
        <View className="bg-[#f0f2f5] p-[10px] flex-row items-center pb-safe">
          <TouchableOpacity className="p-[10px]">
            <Feather name="paperclip" size={20} color="#64748b" />
          </TouchableOpacity>
          <TextInput 
            value={replyMessage}
            onChangeText={setReplyMessage}
            placeholder="Digite uma mensagem"
            className="flex-1 bg-white rounded-full px-[15px] py-[10px] font-sans text-[14px] border border-[#e2e8f0]"
            multiline
          />
          <TouchableOpacity onPress={handleSend} className="bg-[#1B4332] w-[40px] h-[40px] rounded-full items-center justify-center ml-[10px]">
            <Feather name="send" size={16} color="white" style={{marginLeft: -2}} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // TELA DE LISTA DE CONVERSAS
  return <View className="flex-1 bg-[#f9fafb]">
        {offlineMode && (
          <View className="bg-[#fef3c7] p-[12px] m-[15px] rounded-[12px] border border-[#fde68a] flex-row items-center">
            <Feather name="wifi-off" size={16} color="#d97706" style={{ marginRight: 10 }} />
            <Text className="font-sans text-[#b45309] text-[12px] flex-1">
              Modo Offline: Mostrando dúvidas de demonstração.
            </Text>
          </View>
        )}
        <View className="px-[20px] pt-[20px] pb-[10px] bg-white border-b border-[#f1f5f9]">
          <Text className="font-title text-[#1e1b4b] text-[24px]">Dúvidas (Fórum)</Text>
          <Text className="font-sans text-[#666] text-[14px] mt-[5px]">Gerencie as perguntas da comunidade.</Text>
        </View>
        {/* Barra de Busca */}
        <View className="flex-row items-center">
          <View className="flex-1 flex-row items-center bg-[#f1f5f9] rounded-full px-[15px] py-[10px]">
            <Feather name="search" size={18} color="#64748b" />
            <TextInput 
              placeholder="Buscar psicólogo..."
              className="flex-1 ml-[10px] font-sans text-[#333] text-[14px]"
            />
          </View>
          <TouchableOpacity className="ml-[10px] p-[10px] bg-[#f0fdf4] rounded-full border border-[#10b981]">
            <Feather name="edit" size={18} color="#10b981" />
          </TouchableOpacity>
        </View>
        <ScrollView className="flex-1">
          {loading ? <ActivityIndicator color="#1e1b4b" style={{ marginTop: 20 }} /> : chats.map((chat) => (
            <TouchableOpacity 
              key={chat.id}
              onPress={() => setActiveChat(chat)}
              className="flex-row items-center p-[15px] border-b border-[#f1f5f9] bg-white"
            >
              <View className="w-[50px] h-[50px] bg-[#f8f9fa] rounded-full mr-[15px] items-center justify-center border border-[#e9ecef]">
                <Feather name="user" size={24} color="#adb5bd" />
              </View>
              <View className="flex-1 justify-center">
                <View className="flex-row justify-between items-center mb-[4px]">
                  <Text className="font-title text-[#212529] text-[16px] font-bold">{chat.name}</Text>
                  <Text className="font-sans text-[#6c757d] text-[12px]">{chat.time}</Text>
                </View>
                <Text className="font-sans text-[#495057] text-[14px]" numberOfLines={1}>
                  {chat.lastMessage}
                </Text>
              </View>
              {chat.unread > 0 && (
                <View className="bg-[#25D366] w-[20px] h-[20px] rounded-full items-center justify-center ml-[10px]">
                  <Text className="text-white font-sans text-[10px] font-bold">{chat.unread}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
          <View className="h-[100px]" />
        </ScrollView>
    </View>
}
