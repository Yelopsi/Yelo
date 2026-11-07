import '../global.css';

import { Stack } from 'expo-router';
import { AuthProvider } from '../contexts/AuthContext';
import { useFonts } from 'expo-font';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_900Black } from '@expo-google-fonts/inter';
import { Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import SwipeEdgeNavigator from '../components/SwipeEdgeNavigator';
import * as Notifications from 'expo-notifications';

// Garante o registro do handler de notificações nativo no ponto de entrada do app
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_900Black,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    'NewKansas-Regular': require('../../assets/fonts/newkansas-regular.ttf'),
    'NewKansas-Medium': require('../../assets/fonts/newkansas-medium.ttf'),
    'NewKansas-Bold': require('../../assets/fonts/newkansas-bold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#f9fafb' }} />;
  }

  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <SwipeEdgeNavigator>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'default',
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
            contentStyle: { backgroundColor: '#ffffff' },
          }}
        >
          <Stack.Screen name="index" />

        {/* --- FLUXOS MODAIS / BOTTOM SHEET (Estilo Airbnb / Notion / Apple) --- */}
        <Stack.Screen
          name="questionario"
          options={{
            animation: 'slide_from_bottom',
            gestureEnabled: false, // Previne perda acidental das respostas no meio do wizard
          }}
        />
        <Stack.Screen
          name="psi_questionario"
          options={{
            animation: 'slide_from_bottom',
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="login"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
            gestureEnabled: true,
            gestureDirection: 'vertical',
          }}
        />
        <Stack.Screen
          name="cadastro"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
            gestureEnabled: true,
            gestureDirection: 'vertical',
          }}
        />
        <Stack.Screen
          name="recuperar-senha"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
            gestureEnabled: true,
            gestureDirection: 'vertical',
          }}
        />

        {/* --- NAVEGAÇÃO DE HIERARQUIA / PUSH INTERATIVO COM PARALLAX (Estilo WhatsApp / Notion / iOS Nativo) --- */}
        <Stack.Screen
          name="faq"
          options={{
            animation: 'default',
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="profissionais"
          options={{
            animation: 'default',
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="sobre_psis"
          options={{
            animation: 'default',
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="blog"
          options={{
            animation: 'default',
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="[slug]"
          options={{
            animation: 'default',
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="resultados"
          options={{
            animation: 'default',
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="termos"
          options={{
            animation: 'default',
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="privacidade"
          options={{
            animation: 'default',
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="contato"
          options={{
            animation: 'default',
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="ajuda_mulher"
          options={{
            animation: 'default',
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="perguntas"
          options={{
            animation: 'default',
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="mapa_site"
          options={{
            animation: 'default',
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
          }}
        />
      </Stack>
      </SwipeEdgeNavigator>
    </AuthProvider>
  );
}
