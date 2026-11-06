import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function AdminAjustesHubScreen() {
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert(
      "Sair do Painel Admin",
      "Tem certeza que deseja encerrar a sessão?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Sair", style: "destructive", onPress: () => router.replace('/') }
      ]
    );
  };

  return (
    <ScrollView className="flex-1 bg-[#f9fafb]" contentContainerStyle={{ padding: 20 }}>
      {/* Cabeçalho do Hub */}
      <View className="bg-[#1e1b4b] rounded-[24px] p-[24px] mb-[25px] shadow-[0_4px_20px_rgba(30,27,75,0.15)] relative overflow-hidden">
        <View className="absolute top-[-20px] right-[-20px] w-[120px] h-[120px] bg-white/5 rounded-full" />
        <Text className="font-title text-white text-[28px] mb-[4px]">Ajustes e Sistema</Text>
        <Text className="font-sans text-white/80 text-[14px]">Controle operacional e monitoramento.</Text>
      </View>

      <View className="gap-[15px]">
        {/* Central de Ajustes (Notion Flow) */}
        <TouchableOpacity 
          onPress={() => router.push('/(admin)/backlog-ajustes')} 
          className="bg-white rounded-[16px] p-[16px] flex-row items-center border border-[#c7d2fe]"
        >
          <View className="w-[45px] h-[45px] bg-[#ede9fe] rounded-[12px] items-center justify-center mr-[15px]">
            <Feather name="check-square" size={20} color="#6d28d9" />
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-1.5 mb-[2px]">
              <Text className="font-title text-[#4338ca] text-[16px]">Central de Ajustes</Text>
              <View className="bg-[#6366f1] px-2 py-0.5 rounded-full">
                <Text className="font-sans font-bold text-white text-[9px]">Notion Flow</Text>
              </View>
            </View>
            <Text className="font-sans text-[#666] text-[12px] leading-[16px]">
              Fila de ajustes por tela, prioridades e status.
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color="#ccc" />
        </TouchableOpacity>

        {/* Configurações Globais */}
        <TouchableOpacity onPress={() => router.push('/(admin)/configuracoes')} className="bg-white rounded-[16px] p-[16px] flex-row items-center border border-[#f0f0f0]">
          <View className="w-[45px] h-[45px] bg-[#f3f4f6] rounded-[12px] items-center justify-center mr-[15px]">
            <Feather name="settings" size={20} color="#4b5563" />
          </View>
          <View className="flex-1">
            <Text className="font-title text-[#333] text-[16px] mb-[2px]">Configurações Globais</Text>
            <Text className="font-sans text-[#666] text-[12px] leading-[16px]">Preços, Manutenção e Contatos Yelo.</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#ccc" />
        </TouchableOpacity>

        {/* Meu Perfil Admin */}
        <TouchableOpacity onPress={() => router.push('/(admin)/perfil-admin')} className="bg-white rounded-[16px] p-[16px] flex-row items-center border border-[#f0f0f0]">
          <View className="w-[45px] h-[45px] bg-[#e8f5e9] rounded-[12px] items-center justify-center mr-[15px]">
            <Feather name="user" size={20} color="#1b4332" />
          </View>
          <View className="flex-1">
            <Text className="font-title text-[#333] text-[16px] mb-[2px]">Meu Perfil Admin</Text>
            <Text className="font-sans text-[#666] text-[12px] leading-[16px]">Ajuste seu nome, foto e senha de acesso.</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#ccc" />
        </TouchableOpacity>

        {/* Monitoramento e Logs */}
        <TouchableOpacity onPress={() => router.push('/(admin)/logs-sistema')} className="bg-white rounded-[16px] p-[16px] flex-row items-center border border-[#f0f0f0]">
          <View className="w-[45px] h-[45px] bg-[#fee2e2] rounded-[12px] items-center justify-center mr-[15px]">
            <Feather name="activity" size={20} color="#e63946" />
          </View>
          <View className="flex-1">
            <Text className="font-title text-[#333] text-[16px] mb-[2px]">Monitoramento e Logs</Text>
            <Text className="font-sans text-[#666] text-[12px] leading-[16px]">Erros, saúde do servidor e acessos.</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#ccc" />
        </TouchableOpacity>

        {/* Histórico de Alterações */}
        <TouchableOpacity 
          onPress={() => router.push('/(admin)/historico-alteracoes')} 
          className="bg-white rounded-[16px] p-[16px] flex-row items-center border border-[#fde68a]"
        >
          <View className="w-[45px] h-[45px] bg-[#fef9c3] rounded-[12px] items-center justify-center mr-[15px]">
            <Feather name="clock" size={20} color="#854d0e" />
          </View>
          <View className="flex-1">
            <Text className="font-title text-[#854d0e] text-[16px] mb-[2px]">Histórico de Alterações</Text>
            <Text className="font-sans text-[#666] text-[12px] leading-[16px]">Mudanças de produto, regras e comparativo com hoje.</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#ccc" />
        </TouchableOpacity>

        {/* Card Sair */}
        <TouchableOpacity onPress={handleLogout} className="bg-white rounded-[16px] p-[16px] flex-row items-center border border-[#fca5a5] mt-[10px]">
          <View className="w-[45px] h-[45px] bg-[#fef2f2] rounded-[12px] items-center justify-center mr-[15px]">
            <Feather name="log-out" size={20} color="#e63946" />
          </View>
          <View className="flex-1">
            <Text className="font-title text-[#e63946] text-[16px] mb-[2px]">Sair</Text>
            <Text className="font-sans text-[#666] text-[12px] leading-[16px]">Encerrar sua sessão de forma segura.</Text>
          </View>
        </TouchableOpacity>
      </View>
      <View className="h-[120px]" />
    </ScrollView>
  );
}
