import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import YeloScrollView from '../../components/YeloScrollView';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';

const BOTTOM_NAV_CLEARANCE = Platform.OS === 'ios' ? 102 : 96;

interface Announcement {
  id: number;
  title: string;
  content: string;
  author?: string;
  createdAt: string;
  read?: boolean;
}

export default function AvisosScreen() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [avisos, setAvisos] = useState<Announcement[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'interactions'>('all');

  const fetchAnnouncements = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setIsRefreshing(true);
      else setIsLoading(true);

      const res = await api.get(`/api/psychologists/me/announcements?t=${Date.now()}`);
      if (Array.isArray(res.data)) {
        setAvisos(res.data);
      }
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
      // Atualização otimista
      setAvisos((prev) =>
        prev.map((a) => (a.id === avisoId ? { ...a, read: true } : a))
      );
      await api.post(`/api/psychologists/me/announcements/${avisoId}/read`);
    } catch (e) {
      console.warn('Erro ao marcar aviso como lido:', e);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unreadList = avisos.filter((a) => !a.read);
      if (unreadList.length === 0) return;

      // Otimista
      setAvisos((prev) => prev.map((a) => ({ ...a, read: true })));

      await Promise.allSettled(
        unreadList.map((a) =>
          api.post(`/api/psychologists/me/announcements/${a.id}/read`)
        )
      );
    } catch (e) {
      console.warn('Erro ao marcar todos como lidos:', e);
    }
  };

  // Extrai texto limpo do HTML
  const stripHtml = (html: string) => {
    if (!html) return '';
    return html
      .replace(/<[^>]*>?/gm, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Detecta ícone e tipo
  const getIconAndCategory = (aviso: Announcement) => {
    const text = `${aviso.title} ${aviso.content}`.toLowerCase();
    if (text.includes('blog') || text.includes('artigo')) {
      return {
        icon: 'book-open' as const,
        color: '#047857',
        bg: '#ecfdf5',
        label: 'Blog',
      };
    }
    if (text.includes('resposta') || text.includes('comentário') || text.includes('respondeu')) {
      return {
        icon: 'message-circle' as const,
        color: '#0284c7',
        bg: '#e0f2fe',
        label: 'Interação',
      };
    }
    if (text.includes('fórum') || text.includes('tópico') || text.includes('discussão')) {
      return {
        icon: 'message-square' as const,
        color: '#1B4332',
        bg: '#f0fdf4',
        label: 'Fórum',
      };
    }
    if (text.includes('pagamento') || text.includes('fatura') || text.includes('assinatura')) {
      return {
        icon: 'credit-card' as const,
        color: '#0f766e',
        bg: '#ccfbf1',
        label: 'Financeiro',
      };
    }
    if (text.includes('pergunta') || text.includes('dúvida')) {
      return {
        icon: 'help-circle' as const,
        color: '#8b5cf6',
        bg: '#f3e8ff',
        label: 'Pergunta',
      };
    }
    if (text.includes('importante') || text.includes('manutenção') || text.includes('instabilidade')) {
      return {
        icon: 'alert-triangle' as const,
        color: '#b45309',
        bg: '#fef3c7',
        label: 'Aviso',
      };
    }
    return {
      icon: 'bell' as const,
      color: '#1B4332',
      bg: '#f0fdf4',
      label: 'Yelo',
    };
  };

  // Formatação amigável de data
  const formatTime = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24 && date.getDate() === now.getDate()) {
      return `Hoje às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (diffHours < 48 && date.getDate() === now.getDate() - 1) {
      return `Ontem às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  // Filtra itens
  const unreadCount = avisos.filter((a) => !a.read).length;

  const filteredAvisos = avisos.filter((a) => {
    if (filter === 'unread') return !a.read;
    if (filter === 'interactions') {
      const text = `${a.title} ${a.content}`.toLowerCase();
      return (
        text.includes('resposta') ||
        text.includes('comentário') ||
        text.includes('pergunta') ||
        text.includes('fórum')
      );
    }
    return true;
  });

  return (
    <View className="flex-1 bg-[#f9fafb]">
      {/* HEADER SUPERIOR */}
      <View className="mx-6 mt-6 mb-3 flex-row items-center justify-between">
        <View className="flex-row items-center flex-1 mr-2">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 bg-white border border-[#e0e0e0] rounded-full items-center justify-center mr-3 shadow-sm"
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={20} color="#1B4332" />
          </TouchableOpacity>
          <View>
            <Text className="font-title text-[22px] text-[#1B4332]">
              Notificações
            </Text>
            {unreadCount > 0 && (
              <Text className="font-sans text-[12px] text-[#166534]">
                {unreadCount} não {unreadCount === 1 ? 'lida' : 'lidas'}
              </Text>
            )}
          </View>
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={handleMarkAllAsRead}
            className="py-1 px-3 bg-white border border-[#d1d5db] rounded-full shadow-sm"
            activeOpacity={0.7}
          >
            <Text className="font-sans font-bold text-[12px] text-[#1B4332]">
              Ler todas
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* FILTROS EM PÍLULAS */}
      <View className="mx-6 mb-4 flex-row items-center space-x-2">
        <TouchableOpacity
          onPress={() => setFilter('all')}
          className="px-4 py-2 rounded-full border mr-2"
          style={{
            backgroundColor: filter === 'all' ? '#1B4332' : '#ffffff',
            borderColor: filter === 'all' ? '#1B4332' : '#e5e7eb',
          }}
          activeOpacity={0.8}
        >
          <Text
            className="font-sans font-bold text-[13px]"
            style={{ color: filter === 'all' ? '#ffffff' : '#4b5563' }}
          >
            Todas ({avisos.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setFilter('unread')}
          className="px-4 py-2 rounded-full border mr-2 flex-row items-center"
          style={{
            backgroundColor: filter === 'unread' ? '#1B4332' : '#ffffff',
            borderColor: filter === 'unread' ? '#1B4332' : '#e5e7eb',
          }}
          activeOpacity={0.8}
        >
          <Text
            className="font-sans font-bold text-[13px]"
            style={{ color: filter === 'unread' ? '#ffffff' : '#4b5563' }}
          >
            Não lidas
          </Text>
          {unreadCount > 0 && (
            <View
              className="ml-1.5 px-1.5 py-0.2 rounded-full"
              style={{
                backgroundColor: filter === 'unread' ? '#f0fdf4' : '#1B4332',
              }}
            >
              <Text
                className="font-sans font-bold text-[11px]"
                style={{ color: filter === 'unread' ? '#1B4332' : '#ffffff' }}
              >
                {unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setFilter('interactions')}
          className="px-4 py-2 rounded-full border"
          style={{
            backgroundColor: filter === 'interactions' ? '#1B4332' : '#ffffff',
            borderColor: filter === 'interactions' ? '#1B4332' : '#e5e7eb',
          }}
          activeOpacity={0.8}
        >
          <Text
            className="font-sans font-bold text-[13px]"
            style={{ color: filter === 'interactions' ? '#ffffff' : '#4b5563' }}
          >
            Interações
          </Text>
        </TouchableOpacity>
      </View>

      {/* CONTEÚDO PRINCIPAL */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center p-6">
          <ActivityIndicator size="large" color="#1B4332" />
          <Text className="font-sans text-[#666] mt-4 text-[14px]">
            Buscando notificações...
          </Text>
        </View>
      ) : (
        <YeloScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: BOTTOM_NAV_CLEARANCE + 30 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchAnnouncements(true)}
              tintColor="#1B4332"
            />
          }
        >
          {filteredAvisos.length === 0 ? (
            <View className="mx-6 mt-10 p-8 bg-white border border-[#e5e7eb] rounded-[24px] items-center justify-center">
              <View className="w-16 h-16 rounded-full bg-[#f0fdf4] items-center justify-center mb-3">
                <Text className="text-[28px]">✨</Text>
              </View>
              <Text className="font-title text-[18px] text-[#1B4332] mb-1">
                Tudo em ordem por aqui!
              </Text>
              <Text className="font-sans text-[13px] text-[#6b7280] text-center leading-relaxed">
                {filter === 'unread'
                  ? 'Você já leu todas as suas notificações recentes.'
                  : 'Nenhuma notificação encontrada nesta categoria.'}
              </Text>
            </View>
          ) : (
            <View className="mx-6 space-y-3">
              {filteredAvisos.map((aviso) => {
                const info = getIconAndCategory(aviso);
                const isUnread = !aviso.read;
                const cleanContent = stripHtml(aviso.content);

                return (
                  <TouchableOpacity
                    key={aviso.id}
                    onPress={() => handleMarkAsRead(aviso.id)}
                    activeOpacity={0.85}
                    className="mb-3.5 bg-white border rounded-[18px] p-4 shadow-sm"
                    style={{
                      borderColor: isUnread ? '#1B4332' : '#e5e7eb',
                      backgroundColor: isUnread ? '#ffffff' : '#fafafa',
                      borderRadius: 18,
                    }}
                  >
                    {/* TOPO DO CARD */}
                    <View className="flex-row items-center justify-between mb-2">
                      <View className="flex-row items-center flex-1 mr-2">
                        <View
                          className="w-8 h-8 rounded-full items-center justify-center mr-2.5"
                          style={{ backgroundColor: info.bg }}
                        >
                          <Feather name={info.icon} size={15} color={info.color} />
                        </View>
                        <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: info.bg }}>
                          <Text
                            className="font-sans font-bold text-[10px] uppercase tracking-wider"
                            style={{ color: info.color }}
                          >
                            {info.label}
                          </Text>
                        </View>
                      </View>

                      <View className="flex-row items-center">
                        <Text className="font-sans text-[11px] text-[#9ca3af] mr-2">
                          {formatTime(aviso.createdAt)}
                        </Text>
                        {isUnread && (
                          <View className="w-2.5 h-2.5 rounded-full bg-[#1B4332]" />
                        )}
                      </View>
                    </View>

                    {/* TÍTULO E CORPO */}
                    <Text
                      className="font-title text-[16px] text-[#1B4332] mb-1 leading-snug"
                      style={{ fontWeight: isUnread ? '700' : '600' }}
                    >
                      {aviso.title}
                    </Text>

                    {cleanContent.length > 0 && (
                      <Text
                        className="font-sans text-[13px] text-[#4b5563] leading-relaxed mb-3"
                        numberOfLines={3}
                      >
                        {cleanContent}
                      </Text>
                    )}

                    {/* ATALHOS INTELIGENTES CONFORME O CONTEÚDO */}
                    <View className="flex-row items-center justify-between pt-2 border-t border-[#f3f4f6]">
                      {aviso.content?.includes('data-post-id') ||
                      aviso.title?.toLowerCase().includes('fórum') ||
                      aviso.title?.toLowerCase().includes('discussão') ? (
                        <TouchableOpacity
                          onPress={() => {
                            handleMarkAsRead(aviso.id);
                            router.navigate('/(tabs)/forum');
                          }}
                          className="py-1 px-3 bg-[#f0fdf4] rounded-full flex-row items-center"
                          activeOpacity={0.7}
                        >
                          <Feather name="message-square" size={12} color="#1B4332" style={{ marginRight: 4 }} />
                          <Text className="font-sans font-bold text-[11px] text-[#1B4332]">
                            Ver no Fórum
                          </Text>
                        </TouchableOpacity>
                      ) : aviso.content?.includes('data-blog-id') ||
                        aviso.title?.toLowerCase().includes('artigo') ||
                        aviso.title?.toLowerCase().includes('blog') ? (
                        <TouchableOpacity
                          onPress={() => {
                            handleMarkAsRead(aviso.id);
                            router.navigate('/(tabs)/blog');
                          }}
                          className="py-1 px-3 bg-[#ecfdf5] rounded-full flex-row items-center"
                          activeOpacity={0.7}
                        >
                          <Feather name="book-open" size={12} color="#047857" style={{ marginRight: 4 }} />
                          <Text className="font-sans font-bold text-[11px] text-[#047857]">
                            Ler Artigo
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <View />
                      )}

                      {!aviso.read && (
                        <TouchableOpacity
                          onPress={() => handleMarkAsRead(aviso.id)}
                          className="py-1 px-2.5 rounded-full"
                          activeOpacity={0.6}
                        >
                          <Text className="font-sans font-medium text-[11px] text-[#6b7280]">
                            Marcar como lido
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </YeloScrollView>
      )}
    </View>
  );
}

