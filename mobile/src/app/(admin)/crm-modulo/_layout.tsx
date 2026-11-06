import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Stack as ExpoStack, useRouter } from 'expo-router';

export default function CRMLayout() {
  const router = useRouter();

  return (
    <ExpoStack
      screenOptions={{
        animation: 'default',
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        headerStyle: {
          backgroundColor: '#1B4332',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontFamily: 'Nunito-Bold',
        },
        headerLeft: () => (
          <TouchableOpacity 
            activeOpacity={0.7}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(admin)/crm');
              }
            }} 
            className="flex-row items-center bg-white/20 px-[14px] py-[8px] rounded-[50px] mr-[15px]"
          >
            <Feather name="arrow-left" size={18} color="white" />
            <Text className="text-white font-sans font-bold text-[14px] ml-[6px]">Voltar</Text>
          </TouchableOpacity>
        ),
      }}
    >
      <ExpoStack.Screen name="psicologos" options={{ headerShown: false, title: "Sucesso do Psicólogo" }} />
      <ExpoStack.Screen name="leads" options={{ headerShown: false, title: "Pipeline de Leads" }} />
      <ExpoStack.Screen name="espera" options={{ headerShown: false, title: "Leads Inbound (Espera)" }} />
      <ExpoStack.Screen name="pacientes" options={{ title: "Visão 360° Pacientes" }} />
      <ExpoStack.Screen name="analytics-crescimento" options={{ headerShown: false, title: "Growth 📈" }} />
      <ExpoStack.Screen name="cmo-metrics" options={{ headerShown: false, title: "Painel do CMO 🧠" }} />
      <ExpoStack.Screen name="analytics-funil" options={{ headerShown: false, title: "Analytics de Funil" }} />
      <ExpoStack.Screen name="receita" options={{ title: "Receita e Assinaturas" }} />
      <ExpoStack.Screen name="distribuicao" options={{ title: "Distribuição & Ads" }} />
      <ExpoStack.Screen name="copilot-wpp" options={{ title: "Copilot WhatsApp 💬" }} />
      <ExpoStack.Screen name="avaliacoes" options={{ title: "Avaliações (NPS)" }} />
      <ExpoStack.Screen name="cancelamentos" options={{ title: "Motivos de Cancelamento" }} />
      <ExpoStack.Screen name="caixa-entrada" options={{ title: "Caixa de Entrada (Chat)" }} />
      <ExpoStack.Screen name="avisos" options={{ title: "Mural de Avisos" }} />
      <ExpoStack.Screen name="followup" options={{ title: "Follow-up WhatsApp" }} />
    </ExpoStack>
  );
}
