import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert, 
  Linking 
} from 'react-native';
import YeloScrollView from '../../components/YeloScrollView';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';

export default function AssinaturaScreen() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [psiData, setPsiData] = useState<any>(null);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await api.get('/api/psychologists/me');
        if (res.data) setPsiData(res.data);
      } catch (e) {
        console.error("Erro ao carregar dados de assinatura:", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();
  }, []);

  const handleCheckout = async () => {
    try {
      setIsProcessingCheckout(true);
      // Tenta criar link de pagamento via API
      const res = await api.post('/api/payments/create-preference', { plano: 'essencial_mensal' });
      if (res.data?.init_point || res.data?.invoiceUrl || res.data?.url) {
        const checkoutUrl = res.data.init_point || res.data.invoiceUrl || res.data.url;
        await Linking.openURL(checkoutUrl);
      } else {
        // Redireciona para o portal seguro da web
        await Linking.openURL('https://www.yelopsi.com.br/login');
      }
    } catch (e: any) {
      // Fallback seguro abrindo página de assinatura web
      Linking.openURL('https://www.yelopsi.com.br/assinatura').catch(() => {
        Alert.alert("Assinatura", "Para gerenciar sua assinatura de forma segura, acesse www.yelopsi.com.br pelo navegador.");
      });
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#f9fafb] items-center justify-center p-6">
        <ActivityIndicator size="large" color="#1B4332" />
        <Text className="font-sans text-[#666] mt-4">Consultando status do plano...</Text>
      </View>
    );
  }

  const isExempt = psiData?.is_exempt === true || String(psiData?.is_exempt).toLowerCase() === 'true' || psiData?.is_exempt === 1;
  const now = new Date();
  const expiresAt = psiData?.planExpiresAt ? new Date(psiData.planExpiresAt) : null;
  const isExpired = expiresAt ? expiresAt < now : true;
  const daysRemaining = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;
  const isActive = (psiData?.status === 'active' || isExempt) && (!isExpired || isExempt);

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <YeloScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        
        {/* HEADER */}
        <View className="mx-4 mt-4 mb-5 bg-white py-5 px-4 rounded-[22px] items-center shadow-sm border border-[#f0f0f0]">
          <TouchableOpacity 
            onPress={() => router.back()} 
            className="absolute top-4 left-4 w-10 h-10 bg-[#f1f3f5] rounded-full items-center justify-center"
          >
            <Feather name="arrow-left" size={20} color="#1B4332" />
          </TouchableOpacity>
          <Text className="font-title text-[#1B4332] text-[24px] mb-1.5 mt-2 text-center">Sua Assinatura 💎</Text>
          <Text className="font-sans text-[#666] text-[15px] text-center leading-5">
            Gerencie seu plano, visibilidade e benefícios na Yelo.
          </Text>
        </View>

        {/* STATUS BANNER */}
        {isExempt ? (
          <View className="mx-4 bg-[#f0fdf4] border border-[#bbf7d0] p-5 rounded-[20px] mb-5 shadow-sm items-center">
            <Text className="text-[36px] mb-1">👑</Text>
            <Text className="font-title text-[#166534] text-[18px] mb-1 text-center">Licença VIP Vitalícia</Text>
            <Text className="font-sans text-[#15803d] text-[14px] leading-5 text-center">
              Você possui isenção vitalícia e acesso ilimitado a todas as ferramentas e pacientes da Yelo.
            </Text>
          </View>
        ) : !isExpired && daysRemaining > 0 ? (
          <View className="mx-4 bg-[#f0fdf4] border border-[#bbf7d0] p-5 rounded-[20px] mb-5 shadow-sm items-center">
            <Text className="text-[36px] mb-1">🎁</Text>
            <Text className="font-title text-[#166534] text-[18px] mb-1 text-center">
              {psiData?.subscriptionId ? "Assinatura Ativa" : "Período de Teste Grátis"}
            </Text>
            <Text className="font-sans text-[#15803d] text-[14px] leading-5 text-center">
              Você tem <Text className="font-bold">{daysRemaining} dias restantes</Text> até a renovação ({expiresAt?.toLocaleDateString('pt-BR')}).
            </Text>
          </View>
        ) : (
          <View className="mx-4 bg-[#fef2f2] border border-[#fecaca] p-5 rounded-[20px] mb-5 shadow-sm items-center">
            <Text className="text-[36px] mb-1">⚠️</Text>
            <Text className="font-title text-[#b91c1c] text-[18px] mb-1 text-center">Plano Expirado</Text>
            <Text className="font-sans text-[#dc2626] text-[14px] leading-5 text-center">
              Seu período ativo encerrou. Reative sua assinatura para continuar recebendo contatos de novos pacientes.
            </Text>
          </View>
        )}

        {/* PLANS GRID */}
        <View className="px-4 mb-6">
          
          {/* PLANO ESSENCIAL / FUNDADOR */}
          <View className="bg-white border-2 border-[#1B4332] rounded-[24px] py-6 px-5 shadow-sm mb-6 relative">
            <View className="absolute -top-3.5 self-center bg-[#FFEE8C] px-4 py-1 rounded-full shadow-sm">
              <Text className="font-sans font-bold text-[#1B4332] text-[11px] tracking-wide">🔥 LICENÇA FUNDADOR</Text>
            </View>

            <Text className="font-title text-[#1B4332] text-[22px] text-center mb-3 mt-1">Plano Essencial Yelo</Text>
            
            <View className="items-center mb-5">
              <View className="flex-row items-end justify-center mb-1">
                <Text className="font-sans font-bold text-[#adb5bd] text-[16px] line-through mr-2 mb-1">R$ 199</Text>
                <Text className="font-title text-[#1B4332] text-[38px] leading-[38px]">R$ 99</Text>
                <Text className="font-sans font-medium text-[#888] text-[14px] ml-1 mb-1">/mês</Text>
              </View>
              <Text className="font-sans font-bold text-[#16a34a] text-[11px] text-center uppercase tracking-wide">
                Sem carência ou multas • Cancele quando quiser
              </Text>
            </View>

            <View className="flex-col gap-2.5 mb-7">
              <View className="flex-row items-start gap-2.5">
                <Text className="text-[15px]">✅</Text>
                <Text className="font-sans font-medium text-[#495057] text-[14px] flex-1">Receba contatos diretos no WhatsApp sem intermediários</Text>
              </View>
              <View className="flex-row items-start gap-2.5">
                <Text className="text-[15px]">✅</Text>
                <Text className="font-sans font-medium text-[#495057] text-[14px] flex-1">Perfil clínico otimizado no motor de matches inteligentes</Text>
              </View>
              <View className="flex-row items-start gap-2.5">
                <Text className="text-[15px]">✅</Text>
                <Text className="font-sans font-medium text-[#495057] text-[14px] flex-1">Métricas de mercado, demanda e inteligência clínica</Text>
              </View>
              <View className="flex-row items-start gap-2.5">
                <Text className="text-[15px]">✨</Text>
                <Text className="font-sans font-bold text-[#16a34a] text-[14px] flex-1">Retorno garantido: 1 sessão paga o mês inteiro</Text>
              </View>
            </View>

            <TouchableOpacity 
              onPress={handleCheckout}
              disabled={isProcessingCheckout}
              className="bg-[#1B4332] w-full py-3.5 rounded-[50px] items-center shadow-sm mb-3"
            >
              {isProcessingCheckout ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="font-sans font-bold text-white text-[15px]">
                  {isActive ? "Gerenciar Assinatura" : "Reativar Plano Agora"}
                </Text>
              )}
            </TouchableOpacity>

            <View className="flex-row items-center justify-center gap-1.5">
              <Feather name="lock" size={12} color="#888" />
              <Text className="font-sans font-medium text-[#888] text-[12px]">Pagamento 100% seguro via Asaas</Text>
            </View>
          </View>

        </View>

      </YeloScrollView>
    </View>
  );
}
