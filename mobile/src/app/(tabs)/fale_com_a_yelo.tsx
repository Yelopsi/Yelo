import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import YeloScrollView from '../../components/YeloScrollView';

import { Feather, FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function FaleComAYeloScreen() {
  const router = useRouter();
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  const openWhatsApp = () => {
    const numeroYelo = '5511988887723';
    const mensagem = encodeURIComponent('Olá! Sou psicólogo cadastrado na Yelo e preciso de ajuda com:');
    Linking.openURL(`whatsapp://send?phone=${numeroYelo}&text=${mensagem}`);
  };

  const faqs = [
    {
      q: "Como começar a receber pacientes?",
      a: "Para começar a receber pacientes, certifique-se de que seu perfil está 100% completo e verificado. Adicione horários disponíveis na sua agenda em \"Clínica\" > \"Minha Agenda\". Perfis completos e com horários aparecem com prioridade no match!"
    },
    {
      q: "Como funciona o teste grátis?",
      a: "Você tem 14 dias para usar todas as funcionalidades da plataforma sem custo e sem precisar cadastrar um cartão de crédito. Após esse período, para continuar recebendo pacientes, você precisará escolher um dos nossos planos."
    },
    {
      q: "Como cancelar minha assinatura?",
      a: "Você pode cancelar a renovação automática a qualquer momento na página \"Ajustes\" > \"Assinatura & Planos\". Seu acesso continuará ativo até o final do período que já foi pago."
    },
    {
      q: "Como preencher meu perfil corretamente?",
      a: "Vá em \"Ajustes\" > \"Meu Perfil\". Capriche na sua biografia, adicione uma foto profissional e preencha todos os campos de especialidades e atuação. Um perfil completo aumenta em até 3x suas chances de receber contatos."
    },
    {
      q: "Como reagendar sessões?",
      a: "Na sua agenda, clique no agendamento que deseja alterar. No modal que se abrirá, você terá a opção de \"Reagendar\". O sistema buscará seus próximos horários livres e você poderá selecionar um novo dia/hora para a sessão."
    }
  ];

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <YeloScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

          {/* HEADER INVISÍVEL PARA ESPAÇAMENTO E VOLTAR */}
          <View className="mx-6 mt-6 mb-4 flex-row items-center">
            <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-white border border-[#e0e0e0] rounded-full items-center justify-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] mr-4">
              <Feather name="arrow-left" size={20} color="#1B4332" />
            </TouchableOpacity>
            <Text className="font-title text-[22px] text-[#1B4332] flex-1">Suporte Yelo</Text>
          </View>

          {/* HEADER PRINCIPAL */}
          <View className="mx-6 bg-[#1B4332] p-6 rounded-[20px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-6">
            <Text className="font-title text-[24px] text-white mb-2 leading-tight">Fale direto com a Yelo</Text>
            <Text className="font-sans text-[15px] text-white/85 leading-relaxed">
              Dúvidas, problemas técnicos ou sugestões? Nossa equipe responde rapidamente pelo WhatsApp.
            </Text>
          </View>

          {/* WHATSAPP CARD */}
          <View className="mx-6 bg-[#16a34a] border border-[#15803d] p-6 rounded-[20px] mb-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
            <Text className="font-title text-[22px] text-white mb-2">Suporte rápido e direto</Text>
            <Text className="font-sans text-[15px] text-white/90 mb-6 leading-relaxed">
              Fale com nossa equipe sem precisar abrir chamados ou esperar e-mails.
            </Text>

            <View className="self-start bg-white/20 border border-white/20 px-4 py-2 rounded-[50px] flex-row items-center gap-2 mb-6">
              <Feather name="clock" size={14} color="white" />
              <Text className="font-sans text-[13px] text-white">Tempo de resposta: <Text className="font-bold">poucos minutos</Text></Text>
            </View>

            <TouchableOpacity onPress={openWhatsApp} className="bg-white w-full py-4 rounded-[50px] flex-row items-center justify-center gap-2 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
              <FontAwesome name="whatsapp" size={20} color="#16a34a" />
              <Text className="font-sans font-bold text-[#16a34a] text-[16px]">Falar pelo WhatsApp</Text>
            </TouchableOpacity>
          </View>

          {/* FAQ */}
          <View className="px-6 mb-8">
            <Text className="font-title text-[20px] text-[#1B4332] text-center mb-5 border-b border-[#eee] pb-4">Dúvidas Frequentes</Text>

            {faqs.map((faq, index) => (
              <View key={index} className="bg-white border border-[#f0f0f0] rounded-[12px] mb-3 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
                <TouchableOpacity onPress={() => toggleFaq(index)} className="p-5 flex-row justify-between items-center bg-[#fff]">
                  <Text className="font-sans font-bold text-[#333] text-[15px] flex-1 mr-4">{faq.q}</Text>
                  <Feather name={activeFaq === index ? "chevron-up" : "chevron-down"} size={20} color="#1B4332" />
                </TouchableOpacity>
                {activeFaq === index && (
                  <View className="px-5 pb-5">
                    <Text className="font-sans text-[#555] text-[14px] leading-relaxed">{faq.a}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* FORMULÁRIO ALTERNATIVO */}
          <View className="mx-6 bg-[#f8f9fa] border border-[#e9ecef] rounded-[16px] p-6 items-center mb-6">
            <Text className="font-sans font-medium text-[#555] text-[16px] text-center mb-6">Prefere enviar uma mensagem por aqui? Sem problemas.</Text>

            <View className="w-full mb-4">
              <Text className="font-sans font-bold text-[#333] text-[14px] mb-2">Assunto</Text>
              <View className="bg-white border border-[#ccc] rounded-[12px] px-4 py-3.5 flex-row justify-between items-center">
                <Text className="font-sans text-[#333] text-[15px]">Dúvida sobre a plataforma</Text>
                <Feather name="chevron-down" size={16} color="#666" />
              </View>
            </View>

            <View className="w-full mb-4">
              <Text className="font-sans font-bold text-[#333] text-[14px] mb-2">Sua Mensagem</Text>
              <TextInput
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                placeholder="Descreva sua questão..."
                className="bg-white border border-[#ccc] rounded-[12px] p-4 font-sans text-[15px] text-[#333] min-h-[120px]"
              />
            </View>

            <TouchableOpacity className="bg-[#1B4332] py-4 px-8 rounded-[50px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] mt-2">
              <Text className="font-sans font-bold text-white text-[15px]">Enviar Mensagem</Text>
            </TouchableOpacity>
          </View>

        </YeloScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
