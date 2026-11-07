import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { resolvePhotoUrl } from '../utils/imageUrl';
import api from '../services/api';
import ProfileSwitcherModal from './ProfileSwitcherModal';

export default function MobileHeader() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshUser, canAccessAdmin } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [switcherVisible, setSwitcherVisible] = useState(false);
  const fotoUri = resolvePhotoUrl(user?.fotoUrl);

  useEffect(() => {
    if (!user?.fotoUrl) {
      refreshUser();
    }
  }, [user?.fotoUrl, refreshUser]);

  useEffect(() => {
    let isMounted = true;
    const fetchUnread = async () => {
      try {
        const res = await api.get(`/api/psychologists/me/announcements?t=${Date.now()}`);
        if (isMounted && Array.isArray(res.data)) {
          const unread = res.data.filter((a: any) => !a.read).length;
          setUnreadCount(unread);
        }
      } catch {
        // Silencioso
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 60000); // Atualiza periodicamente

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <>
    <View 
      className="flex-row items-center bg-white border-b border-[#e0e0e0]"
      style={{ 
        paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 44 : 20) + 10,
        paddingBottom: 10,
        paddingHorizontal: 15
      }}
    >
      {/* AVATAR */}
      <TouchableOpacity onPress={() => router.navigate('/(tabs)/meu_perfil')} className="relative mr-2" activeOpacity={0.7}>
        <Image 
          key={fotoUri}
          source={{ uri: fotoUri }} 
          className="w-[36px] h-[36px] rounded-full border-2 border-[#1B4332] bg-[#e8f5e9]"
        />
      </TouchableOpacity>

      {/* STATUS & BADGES */}
      <View className="flex-row items-center flex-wrap flex-1 space-x-2 ml-1">
        
        {/* Badge de Nível Ativo */}
        <View className="bg-[#e8f5e9] px-[8px] py-[4px] rounded-[20px] justify-center items-center">
          <Text className="font-sans text-[12px] text-[#1B4332]">
            🔥 Nível: <Text className="font-bold">Ativo</Text>
          </Text>
        </View>

        {/* Container de Conquistas */}
        <View className="flex-row items-center space-x-1">
          {/* Autêntico */}
          <View className="w-[19px] h-[19px] rounded-full bg-[#1B4332] items-center justify-center">
            <Feather name="check" size={12} color="white" />
          </View>
          {/* Semeador */}
          <Text className="text-[19px]">🌱</Text>
          {/* Voz Ativa */}
          <Text className="text-[19px]">💬</Text>
          {/* Pioneiro */}
          <Text className="text-[19px]">🏅</Text>
        </View>
      </View>

      {/* ALTERNADOR DE PERFIL ADMIN (se tiver permissão) */}
      {canAccessAdmin && (
        <TouchableOpacity 
          activeOpacity={0.8}
          onPress={() => setSwitcherVisible(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#1B4332',
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 999,
            marginRight: 6,
            gap: 4,
          }}
        >
          <Feather name="shield" size={12} color="#FFEE8C" />
          <Text style={{ fontFamily: 'Inter_700Bold', color: '#FFEE8C', fontSize: 11 }}>Admin</Text>
        </TouchableOpacity>
      )}

      {/* NOTIFICAÇÕES (Últimos Avisos) */}
      <TouchableOpacity 
        className="p-1.5 rounded-full items-center justify-center relative"
        onPress={() => router.navigate('/(tabs)/avisos')}
        activeOpacity={0.7}
      >
        <Feather name="bell" size={22} color="#1B4332" />
        {unreadCount > 0 && (
          <View 
            className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-[#e63946] border border-white"
            style={{ minWidth: 10, minHeight: 10 }}
          />
        )}
      </TouchableOpacity>
    </View>
    <ProfileSwitcherModal
      visible={switcherVisible}
      onClose={() => setSwitcherVisible(false)}
      currentRole="psychologist"
    />
    </>
  );
}
