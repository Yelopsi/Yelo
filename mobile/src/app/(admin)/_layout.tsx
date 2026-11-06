import React from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator, Alert, Platform } from 'react-native';
import { Tabs, Redirect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { resolvePhotoUrl } from '../../utils/imageUrl';
import { StatusBar } from 'expo-status-bar';

export default function AdminLayout() {
  const insets = useSafeAreaInsets();
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

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
    <TouchableOpacity onPress={() => router.back()} className="flex-row items-center ml-[20px] bg-[#f1f5f9] px-[12px] py-[6px] rounded-[50px]">
      <Feather name="arrow-left" size={16} color="#1e1b4b" />
      <Text className="font-sans font-bold text-[#1e1b4b] text-[12px] ml-[4px]">Voltar</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-[#f9fafb]">
        <ActivityIndicator size="large" color="#8b5cf6" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  const HeaderLeft = () => (
    <View className="flex-row items-center ml-[20px] gap-2">
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
      <View className="bg-[#e8f5e9] border border-[#c8e6c9] px-[10px] py-[4px] rounded-[50px]">
        <Text className="text-[#1B4332] font-sans font-bold text-[12px]">🛡️ Admin</Text>
      </View>
    </View>
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
          tabBarActiveBackgroundColor: '#f0fdf4',
          tabBarItemStyle: {
            borderRadius: 24,
            marginVertical: 4,
            marginHorizontal: 2,
            padding: 0,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          },
          tabBarLabelStyle: {
            fontSize: 9,
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
            tabBarIcon: ({ color }: { color: any }) => <Feather name="home" size={20} color={color} />,
          }} 
        />
        <Tabs.Screen 
          name="crm" 
          options={{ 
            title: 'CRM',
            tabBarActiveTintColor: '#8b5cf6',
            tabBarActiveBackgroundColor: '#f3e8ff',
            tabBarIcon: ({ focused }: { focused: boolean }) => <Feather name="users" size={20} color={focused ? '#8b5cf6' : '#8b5cf6'} />,
            tabBarLabel: ({ focused }: { focused: boolean }) => (
              <Text style={{ fontSize: 9, fontWeight: focused ? '700' : '600', color: '#8b5cf6', textAlign: 'center', marginTop: 2 }}>
                CRM
              </Text>
            ),
          }} 
        />
        <Tabs.Screen 
          name="conteudo" 
          options={{ 
            title: 'Conteúdo',
            tabBarIcon: ({ color }: { color: any }) => <Feather name="layout" size={20} color={color} />,
          }} 
        />
        <Tabs.Screen 
          name="dados" 
          options={{ 
            title: 'Dados',
            tabBarIcon: ({ color }: { color: any }) => <Feather name="bar-chart-2" size={20} color={color} />,
          }} 
        />
        <Tabs.Screen 
          name="ajustes" 
          options={{ 
            title: 'Ajustes',
            tabBarIcon: ({ color }: { color: any }) => <Feather name="settings" size={20} color={color} />,
          }} 
        />
        <Tabs.Screen
          name="sair"
          options={{
            title: 'Sair',
            tabBarIcon: () => <Feather name="log-out" size={20} color="#e63946" />,
            tabBarLabel: () => (
              <Text style={{ fontSize: 9, fontWeight: '600', color: '#e63946', textAlign: 'center', marginTop: 2 }}>
                Sair
              </Text>
            ),
          }}
          listeners={() => ({
            tabPress: (e) => {
              e.preventDefault();
              handleLogout();
            },
          })}
        />
        
        <Tabs.Screen 
          name="crm-modulo" 
          options={{ 
            tabBarButton: () => null, 
            tabBarItemStyle: { display: 'none' },
            tabBarStyle: { display: 'none' },
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
    </>
  );
}
