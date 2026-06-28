import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Stack as ExpoStack, useRouter } from 'expo-router';

export default function CRMLayout() {
  const router = useRouter();

  return (
    <ExpoStack
      screenOptions={{
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
    </ExpoStack>
  );
}
