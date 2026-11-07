import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator, Alert, Platform } from 'react-native';
import { Tabs, Redirect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { resolvePhotoUrl } from '../../utils/imageUrl';
import { StatusBar } from 'expo-status-bar';
import ProfileSwitcherModal from '../../components/ProfileSwitcherModal';

export default function AdminLayout() {
  const insets = useSafeAreaInsets();
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [switcherVisible, setSwitcherVisible] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      "Sair do Sistema",
      "Tem certeza que deseja encerrar sua sessão?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Sair", style: "destructive", onPress: async () => { await signOut(); router.replace("/login"); } }
      ]
    );
  };

  const BackButton = () => (
    <TouchableOpacity onPress={() => router.back()} className="flex-row items-center ml-[20px] bg-[#e8f5e9] px-[12px] py-[6px] rounded-full">
      <Feather name="arrow-left" size={16} color="#1B4332" />
      <Text className="font-sans font-bold text-[#1B4332] text-[12px] ml-[4px]">Voltar</Text>
    </TouchableOpacity>
  );

  const AdminTabIcon = ({ name, focused }: { name: keyof typeof Feather.glyphMap; focused: boolean }) => (
    <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
      <Feather
        name={name}
        size={20}
        color={focused ? '#1B4332' : '#9ca3af'}
      />
    </View>
  );

  const AdminTabLabel = ({ label, focused }: { label: string; focused: boolean }) => (
    <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
      <Text
        style={{
          fontSize: 9.5,
          fontWeight: focused ? '700' : '500',
          color: focused ? '#1B4332' : '#9ca3af',
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
      <View
        style={{
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: focused ? '#1B4332' : 'transparent',
          marginTop: 2,
        }}
      />
    </View>
  );

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-[#f9fafb]">
        <ActivityIndicator size="large" color="#1B4332" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  const HeaderLeft = () => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => setSwitcherVisible(true)}
      style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 20, gap: 8 }}
    >
      {user?.fotoUrl ? (
        <Image 
          source={{ uri: resolvePhotoUrl(user.fotoUrl) }} 
          style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#1B4332' }} 
        />
      ) : (
        <View 
          style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#1B4332', backgroundColor: '#1B4332', alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 13 }}>AD</Text>
        </View>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#e8f5e9', borderWidth: 1, borderColor: '#c8e6c9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 50, gap: 4 }}>
        <Text style={{ color: '#1B4332', fontFamily: 'Inter_700Bold', fontSize: 12 }}>🛡️ Admin</Text>
        <Feather name="chevron-down" size={13} color="#1B4332" />
      </View>
    </TouchableOpacity>
  );

  const HeaderRight = () => (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => setSwitcherVisible(true)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0fdf4',
        borderColor: '#bbf7d0',
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        marginRight: 16,
        gap: 5,
      }}
    >
      <Feather name="repeat" size={12} color="#1B4332" />
      <Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 11 }}>Ver como Psi</Text>
    </TouchableOpacity>
  );

  return (
    <>
      <StatusBar style="dark" />
      <Tabs
        backBehavior="history"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#ffffff',
            height: 60 + insets.top,
          },
          headerShadowVisible: false,
          headerTitle: "",
          headerLeft: () => <HeaderLeft />,
          headerRight: () => <HeaderRight />,
          tabBarActiveTintColor: '#1B4332',
          tabBarInactiveTintColor: '#9ca3af',
          tabBarStyle: {
            position: 'absolute',
            bottom: Platform.OS === 'ios' ? 24 : 20,
            marginHorizontal: 16,
            backgroundColor: 'transparent',
            borderRadius: 50,
            elevation: 10,
            shadowColor: '#000',
            shadowOpacity: 0.15,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 10 },
            borderTopWidth: 0,
            height: 64,
            paddingTop: 0,
            paddingBottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
          },
          tabBarBackground: () => (
            <View style={{ flex: 1, borderRadius: 50, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' }}>
              <BlurView intensity={95} tint="light" style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.96)' }} />
            </View>
          ),
          tabBarActiveBackgroundColor: 'transparent',
          tabBarItemStyle: {
            marginVertical: 4,
            marginHorizontal: 0,
            padding: 0,
            alignItems: 'center',
            justifyContent: 'center',
          },
          tabBarLabelStyle: {
            fontSize: 9.5,
            fontWeight: '600',
            textAlign: 'center',
            marginTop: 2,
            marginBottom: 0,
            padding: 0,
            alignSelf: 'center',
          },
        }}
      >
        <Tabs.Screen 
          name="index" 
          options={{ 
            title: 'Início',
            tabBarIcon: ({ focused }) => <AdminTabIcon name="home" focused={focused} />,
            tabBarLabel: ({ focused }) => <AdminTabLabel label="Início" focused={focused} />,
          }} 
        />
        <Tabs.Screen 
          name="crm" 
          options={{ 
            title: 'CRM',
            tabBarIcon: ({ focused }) => <AdminTabIcon name="users" focused={focused} />,
            tabBarLabel: ({ focused }) => <AdminTabLabel label="CRM" focused={focused} />,
          }} 
        />
        <Tabs.Screen 
          name="conteudo" 
          options={{ 
            title: 'Conteúdo',
            tabBarIcon: ({ focused }) => <AdminTabIcon name="layout" focused={focused} />,
            tabBarLabel: ({ focused }) => <AdminTabLabel label="Conteúdo" focused={focused} />,
          }} 
        />
        <Tabs.Screen 
          name="dados" 
          options={{ 
            title: 'Dados',
            tabBarIcon: ({ focused }) => <AdminTabIcon name="bar-chart-2" focused={focused} />,
            tabBarLabel: ({ focused }) => <AdminTabLabel label="Dados" focused={focused} />,
          }} 
        />
        <Tabs.Screen 
          name="ajustes" 
          options={{ 
            title: 'Ajustes',
            tabBarIcon: ({ focused }) => <AdminTabIcon name="settings" focused={focused} />,
            tabBarLabel: ({ focused }) => <AdminTabLabel label="Ajustes" focused={focused} />,
          }} 
        />
        <Tabs.Screen
          name="sair"
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
        
        <Tabs.Screen 
          name="crm-modulo" 
          options={{ 
            tabBarButton: () => null, 
            tabBarItemStyle: { display: 'none' },
            headerShown: false,
          }} 
        />
        
        {/* Telas Internas com Botão Voltar */}
        <Tabs.Screen name="configuracoes" options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' }, headerShown: true, headerLeft: () => <BackButton /> }} />
        <Tabs.Screen name="perfil-admin" options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' }, headerShown: true, headerLeft: () => <BackButton /> }} />
        <Tabs.Screen name="logs-sistema" options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' }, headerShown: true, headerLeft: () => <BackButton /> }} />
        <Tabs.Screen name="metricas-match" options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' }, headerShown: true, headerLeft: () => <BackButton /> }} />
        <Tabs.Screen name="exportar" options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' }, headerShown: true, headerLeft: () => <BackButton /> }} />
        <Tabs.Screen name="gestao-conteudo" options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' }, headerShown: true, headerLeft: () => <BackButton /> }} />
        <Tabs.Screen name="moderacao-forum" options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' }, headerShown: true, headerLeft: () => <BackButton /> }} />
        <Tabs.Screen name="comunidade-gestao" options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' }, headerShown: true, headerLeft: () => <BackButton /> }} />
        <Tabs.Screen name="backlog-ajustes" options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' }, headerShown: true, headerLeft: () => <BackButton /> }} />
        <Tabs.Screen name="historico-alteracoes" options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' }, headerShown: true, headerLeft: () => <BackButton /> }} />
      </Tabs>
      <ProfileSwitcherModal
        visible={switcherVisible}
        onClose={() => setSwitcherVisible(false)}
        currentRole="admin"
      />
    </>
  );
}
