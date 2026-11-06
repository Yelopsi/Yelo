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
            onPress={() => router.back()} 
            className="flex-row items-center bg-white/20 px-[14px] py-[8px] rounded-[50px] mr-[15px]"
          >
            <Feather name="arrow-left" size={18} color="white" />
            <Text className="text-white font-sans font-bold text-[14px] ml-[6px]">Voltar</Text>
          </TouchableOpacity>
        ),
      }}
    >
      <ExpoStack.Screen name="psicologos" options={{ title: "Psicólogos" }} />
      <ExpoStack.Screen name="leads" options={{ title: "Leads e CRM" }} />
      <ExpoStack.Screen name="espera" options={{ title: "Lista de Espera" }} />
      <ExpoStack.Screen name="pacientes" options={{ title: "Pacientes" }} />
      <ExpoStack.Screen name="copilot-wpp" options={{ title: "Copilot WhatsApp AI" }} />
      <ExpoStack.Screen name="distribuicao" options={{ title: "Distribuição e Ads" }} />
      <ExpoStack.Screen name="cmo-metrics" options={{ title: "Painel do CMO" }} />
      <ExpoStack.Screen name="analytics-funil" options={{ title: "Analytics de Funil" }} />
      <ExpoStack.Screen name="followup" options={{ title: "Follow-up WhatsApp" }} />
      <ExpoStack.Screen name="receita" options={{ title: "Receita e Assinaturas" }} />
      <ExpoStack.Screen name="avaliacoes" options={{ title: "Avaliações NPS" }} />
      <ExpoStack.Screen name="cancelamentos" options={{ title: "Cancelamentos (Churn)" }} />
      <ExpoStack.Screen name="caixa-entrada" options={{ title: "Caixa de Entrada" }} />
      <ExpoStack.Screen name="avisos" options={{ title: "Mural de Avisos" }} />
    </ExpoStack>
  );
}
