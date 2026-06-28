import React from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { Tabs, Redirect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
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
      <Image 
        source={{ uri: "https://placehold.co/100x100?text=AD" }} 
        className="w-[36px] h-[36px] rounded-full border-2 border-[#8b5cf6]" 
      />
      <View className="bg-[#f3e8ff] border border-[#d8b4fe] px-[8px] py-[4px] rounded-[50px]">
        <Text className="text-[#8b5cf6] font-sans font-bold text-[12px]">🛡️ Admin</Text>
      </View>
    </View>
  );

  return (
    <>
      <StatusBar style="dark" />
      <Tabs
        screenOptions={{
          headerStyle: {
            backgroundColor: '#ffffff',
            height: 60 + insets.top,
          },
          headerShadowVisible: false,
          headerTitle: "",
          headerLeft: () => <HeaderLeft />,
        }}
        tabBar={({ state, descriptors, navigation }) => {
        return (
          <View className="absolute bottom-8 left-5 right-5 bg-white/95 rounded-[50px] shadow-[0_10px_30px_rgba(0,0,0,0.15)] flex-row justify-between items-center px-2 py-2" style={{ elevation: 5 }}>
            {state.routes
              .filter((route: any) => {
                const hiddenRoutes = ['(crm)', 'configuracoes', 'perfil-admin', 'logs-sistema', 'metricas-match', 'exportar', 'gestao-conteudo', 'moderacao-forum', 'comunidade-gestao'];
                return !hiddenRoutes.includes(route.name);
              })
              .map((route: any) => {
              const index = state.routes.indexOf(route);
              const { options } = descriptors[route.key];
              const label = options.title !== undefined ? options.title : route.name;
              const isFocused = state.index === index;

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              };

              let iconName = "home";
              if (route.name === "crm") iconName = "users";
              if (route.name === "conteudo") iconName = "layout";
              if (route.name === "dados") iconName = "bar-chart-2";
              if (route.name === "ajustes") iconName = "settings";

              // Admin uses purple as brand color
              const tintColor = isFocused ? "#8b5cf6" : "#999";
              const bgColor = isFocused ? "bg-[#f3e8ff]" : "";
              const textColor = isFocused ? "text-[#8b5cf6]" : "text-[#999]";
              const textWeight = isFocused ? "font-semibold" : "font-medium";

              return (
                <TouchableOpacity
                  key={route.key}
                  activeOpacity={0.7}
                  onPress={onPress}
                  className={`items-center justify-center flex-1 py-1.5 rounded-[20px] ${bgColor}`}
                >
                  <Feather name={iconName as any} size={20} color={tintColor} />
                  <Text className={`font-sans ${textWeight} ${textColor} text-[10px] mt-0.5`} numberOfLines={1}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity onPress={handleLogout} className="items-center justify-center flex-1 py-1.5 rounded-[20px] bg-transparent">
               <Feather name="log-out" size={20} color="#e63946" />
               <Text className="font-sans font-medium text-[#e63946] text-[10px] mt-0.5" numberOfLines={1}>
                 Sair
               </Text>
            </TouchableOpacity>
          </View>
        );
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Início' }} />
      <Tabs.Screen name="crm" options={{ title: 'CRM' }} />
      <Tabs.Screen name="conteudo" options={{ title: 'Conteúdo' }} />
      <Tabs.Screen name="dados" options={{ title: 'Dados' }} />
      <Tabs.Screen name="ajustes" options={{ title: 'Ajustes' }} />
      
      <Tabs.Screen name="(crm)" options={{ href: null, headerShown: false }} />
      
      {/* Telas Internas com Botão Voltar */}
      <Tabs.Screen name="configuracoes" options={{ href: null, headerShown: true, headerLeft: () => <BackButton /> }} />
      <Tabs.Screen name="perfil-admin" options={{ href: null, headerShown: true, headerLeft: () => <BackButton /> }} />
      <Tabs.Screen name="logs-sistema" options={{ href: null, headerShown: true, headerLeft: () => <BackButton /> }} />
      <Tabs.Screen name="metricas-match" options={{ href: null, headerShown: true, headerLeft: () => <BackButton /> }} />
      <Tabs.Screen name="exportar" options={{ href: null, headerShown: true, headerLeft: () => <BackButton /> }} />
      <Tabs.Screen name="gestao-conteudo" options={{ href: null, headerShown: true, headerLeft: () => <BackButton /> }} />
      <Tabs.Screen name="moderacao-forum" options={{ href: null, headerShown: true, headerLeft: () => <BackButton /> }} />
      <Tabs.Screen name="comunidade-gestao" options={{ href: null, headerShown: true, headerLeft: () => <BackButton /> }} />
    </Tabs>
    </>
  );
}
