import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function AdminCRMHubScreen() {
  const router = useRouter();
  return (
    <ScrollView className="flex-1 bg-[#f9fafb]" contentContainerStyle={{ padding: 20 }}>
      {/* Cabeçalho do Hub */}
      <View className="bg-[#1e1b4b] rounded-[24px] p-[24px] mb-[25px] shadow-[0_4px_20px_rgba(30,27,75,0.15)] relative overflow-hidden">
        <View className="absolute top-[-20px] right-[-20px] w-[120px] h-[120px] bg-white/5 rounded-full" />
        <Text className="font-title text-white text-[28px] mb-[4px]">CRM Yelo</Text>
        <Text className="font-sans text-white/80 text-[14px]">Central de Vendas, Relacionamento, Dados e Retenção.</Text>
      </View>

      {/* 1. Gestão de Entidades */}
      <View className="mb-[25px]">
        <View className="flex-row items-center mb-[15px]">
          <Feather name="users" size={20} color="#1e1b4b" />
          <Text className="font-title text-[#1e1b4b] text-[18px] ml-[8px]">Gestão de Entidades</Text>
        </View>

        <View className="gap-[10px]">
          {/* Sucesso do Psicólogo */}
          <TouchableOpacity onPress={() => router.push('/(admin)/(crm)/psicologos')} className="bg-white rounded-[16px] p-[16px] flex-row items-center border border-[#f0f0f0]">
            <View className="w-[45px] h-[45px] bg-[#f3e8ff] rounded-[12px] items-center justify-center mr-[15px]">
              <Feather name="user-check" size={20} color="#8b5cf6" />
            </View>
            <View className="flex-1">
              <Text className="font-title text-[#333] text-[16px] mb-[2px]">Sucesso do Psicólogo</Text>
              <Text className="font-sans text-[#666] text-[12px] leading-[16px]">Onboarding, performance de perfil e distribuição.</Text>
            </View>
            <Feather name="chevron-right" size={20} color="#ccc" />
          </TouchableOpacity>

          {/* Pipeline de Leads */}
          <TouchableOpacity onPress={() => router.push('/(admin)/(crm)/leads')} className="bg-white rounded-[16px] p-[16px] flex-row items-center border border-[#f0f0f0]">
            <View className="w-[45px] h-[45px] bg-[#e0f2fe] rounded-[12px] items-center justify-center mr-[15px]">
              <Feather name="target" size={20} color="#0ea5e9" />
            </View>
            <View className="flex-1">
              <Text className="font-title text-[#333] text-[16px] mb-[2px]">Pipeline de Leads</Text>
              <Text className="font-sans text-[#666] text-[12px] leading-[16px]">Gestão de prospecção e contatos frios.</Text>
            </View>
            <Feather name="chevron-right" size={20} color="#ccc" />
          </TouchableOpacity>

          {/* Leads Inbound (Espera) */}
          <TouchableOpacity onPress={() => router.push('/(admin)/(crm)/espera')} className="bg-white rounded-[16px] p-[16px] flex-row items-center border border-[#f0f0f0]">
            <View className="w-[45px] h-[45px] bg-[#fef3c7] rounded-[12px] items-center justify-center mr-[15px]">
              <Feather name="clock" size={20} color="#d97706" />
            </View>
            <View className="flex-1">
              <Text className="font-title text-[#333] text-[16px] mb-[2px]">Leads Inbound (Espera)</Text>
              <Text className="font-sans text-[#666] text-[12px] leading-[16px]">Profissionais que iniciaram cadastro mas não finalizaram.</Text>
            </View>
            <Feather name="chevron-right" size={20} color="#ccc" />
          </TouchableOpacity>

          {/* Visão 360 Pacientes */}
          <TouchableOpacity onPress={() => router.push('/(admin)/(crm)/pacientes')} className="bg-white rounded-[16px] p-[16px] flex-row items-center border border-[#f0f0f0]">
            <View className="w-[45px] h-[45px] bg-[#dcfce7] rounded-[12px] items-center justify-center mr-[15px]">
              <Feather name="heart" size={20} color="#22c55e" />
            </View>
            <View className="flex-1">
              <Text className="font-title text-[#333] text-[16px] mb-[2px]">Visão 360° Pacientes</Text>
              <Text className="font-sans text-[#666] text-[12px] leading-[16px]">Timeline, engajamento e abandono.</Text>
            </View>
            <Feather name="chevron-right" size={20} color="#ccc" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Inteligência Financeira e Analytics */}
      <View className="mb-[25px]">
        <View className="flex-row items-center mb-[15px]">
          <Feather name="bar-chart-2" size={20} color="#1e1b4b" />
          <Text className="font-title text-[#1e1b4b] text-[18px] ml-[8px]">Inteligência Financeira</Text>
        </View>
        <View className="gap-[10px]">
          <TouchableOpacity onPress={() => router.push('/(admin)/(crm)/analytics-crescimento')} className="bg-white rounded-[16px] p-[16px] flex-row items-center border border-[#f0f0f0]">
            <View className="w-[45px] h-[45px] bg-[#fef3c7] rounded-[12px] items-center justify-center mr-[15px]">
              <Feather name="trending-up" size={20} color="#d97706" />
            </View>
            <View className="flex-1">
              <Text className="font-title text-[#333] text-[16px] mb-[2px]">Analytics de Crescimento</Text>
              <Text className="font-sans text-[#666] text-[12px] leading-[16px]">Conversão end-to-end e origens UTM.</Text>
            </View>
            <Feather name="chevron-right" size={20} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/(admin)/(crm)/receita')} className="bg-white rounded-[16px] p-[16px] flex-row items-center border border-[#f0f0f0]">
            <View className="w-[45px] h-[45px] bg-[#ccfbf1] rounded-[12px] items-center justify-center mr-[15px]">
              <Feather name="dollar-sign" size={20} color="#0d9488" />
            </View>
            <View className="flex-1">
              <Text className="font-title text-[#333] text-[16px] mb-[2px]">Receita e Assinaturas</Text>
              <Text className="font-sans text-[#666] text-[12px] leading-[16px]">MRR, Churn, LTV e faturas Asaas.</Text>
            </View>
            <Feather name="chevron-right" size={20} color="#ccc" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 3. Qualidade e Retenção */}
      <View className="mb-[25px]">
        <View className="flex-row items-center mb-[15px]">
          <Feather name="star" size={20} color="#1e1b4b" />
          <Text className="font-title text-[#1e1b4b] text-[18px] ml-[8px]">Qualidade e Retenção</Text>
        </View>
        <View className="gap-[10px]">
          <TouchableOpacity onPress={() => router.push('/(admin)/(crm)/avaliacoes')} className="bg-white rounded-[16px] p-[16px] flex-row items-center border border-[#f0f0f0]">
            <View className="w-[45px] h-[45px] bg-[#fef3c7] rounded-[12px] items-center justify-center mr-[15px]">
              <Feather name="thumbs-up" size={20} color="#d97706" />
            </View>
            <View className="flex-1">
              <Text className="font-title text-[#333] text-[16px] mb-[2px]">Avaliações (NPS)</Text>
              <Text className="font-sans text-[#666] text-[12px] leading-[16px]">Satisfação e depoimentos.</Text>
            </View>
            <Feather name="chevron-right" size={20} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/(admin)/(crm)/cancelamentos')} className="bg-white rounded-[16px] p-[16px] flex-row items-center border border-[#f0f0f0]">
            <View className="w-[45px] h-[45px] bg-[#fee2e2] rounded-[12px] items-center justify-center mr-[15px]">
              <Feather name="alert-circle" size={20} color="#ef4444" />
            </View>
            <View className="flex-1">
              <Text className="font-title text-[#333] text-[16px] mb-[2px]">Motivos de Cancelamento</Text>
              <Text className="font-sans text-[#666] text-[12px] leading-[16px]">Análise de atrito e exclusão de conta (Churn).</Text>
            </View>
            <Feather name="chevron-right" size={20} color="#ccc" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 4. Comunicação Omnichannel */}
      <View className="mb-[25px]">
        <View className="flex-row items-center mb-[15px]">
          <Feather name="message-circle" size={20} color="#1e1b4b" />
          <Text className="font-title text-[#1e1b4b] text-[18px] ml-[8px]">Comunicação Omnichannel</Text>
        </View>
        <View className="gap-[10px]">
          <TouchableOpacity onPress={() => router.push('/(admin)/(crm)/caixa-entrada')} className="bg-white rounded-[16px] p-[16px] flex-row items-center border border-[#f0f0f0]">
            <View className="w-[45px] h-[45px] bg-[#e0f2fe] rounded-[12px] items-center justify-center mr-[15px]">
              <Feather name="inbox" size={20} color="#0ea5e9" />
            </View>
            <View className="flex-1">
              <Text className="font-title text-[#333] text-[16px] mb-[2px]">Caixa de Entrada (Chat)</Text>
              <Text className="font-sans text-[#666] text-[12px] leading-[16px]">Atendimento em tempo real a psicólogos.</Text>
            </View>
            <Feather name="chevron-right" size={20} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/(admin)/(crm)/avisos')} className="bg-white rounded-[16px] p-[16px] flex-row items-center border border-[#f0f0f0]">
            <View className="w-[45px] h-[45px] bg-[#f3e8ff] rounded-[12px] items-center justify-center mr-[15px]">
              <Feather name="bell" size={20} color="#8b5cf6" />
            </View>
            <View className="flex-1">
              <Text className="font-title text-[#333] text-[16px] mb-[2px]">Avisos e Broadcast (Push)</Text>
              <Text className="font-sans text-[#666] text-[12px] leading-[16px]">Envie notificações e alertas globais.</Text>
            </View>
            <Feather name="chevron-right" size={20} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => Alert.alert('Aviso', 'Módulo em construção.')} className="bg-white rounded-[16px] p-[16px] flex-row items-center border border-[#f0f0f0]">
            <View className="w-[45px] h-[45px] bg-[#dcfce7] rounded-[12px] items-center justify-center mr-[15px]">
              <Feather name="message-square" size={20} color="#22c55e" />
            </View>
            <View className="flex-1">
              <Text className="font-title text-[#333] text-[16px] mb-[2px]">Follow-up WhatsApp</Text>
              <Text className="font-sans text-[#666] text-[12px] leading-[16px]">Retomada de contato com pacientes perdidos.</Text>
            </View>
            <Feather name="chevron-right" size={20} color="#ccc" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Padding para a bottom nav */}
      <View className="h-[120px]" />
    </ScrollView>
  );
}
