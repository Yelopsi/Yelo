import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert, 
  Linking,
  Platform,
  Modal,
  TextInput,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  useWindowDimensions,
  Pressable
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import YeloScrollView from '../../components/YeloScrollView';
import YeloToast from '../../components/YeloToast';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api, { getBaseUrl } from '../../services/api';

export default function AssinaturaScreen() {
  const router = useRouter();
  const { height: screenHeight } = useWindowDimensions();

  const [isLoading, setIsLoading] = useState(true);
  const [psiData, setPsiData] = useState<any>(null);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);

  // Modal Centralizado Unificado (1 Único Modal Nativo para evitar congelamento de toques no iOS)
  const [activeModal, setActiveModal] = useState<'NONE' | 'IOS_FEE_CHOICE' | 'CHECKOUT' | 'COMMUNITY'>('NONE');

  // Keyboard state for native iOS bottom-sheet handling
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setIsKeyboardVisible(true);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
        setIsKeyboardVisible(false);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Native Checkout State
  const [checkoutPrice, setCheckoutPrice] = useState('99,00');
  const [isIosCheckout, setIsIosCheckout] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CREDIT_CARD'>('PIX');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // PIX state
  const [pixData, setPixData] = useState<{ encodedImage?: string; payload?: string } | null>(null);
  const [pixCpfInput, setPixCpfInput] = useState('');
  const [pixCopied, setPixCopied] = useState(false);

  // Cartão state
  const [cardData, setCardData] = useState({
    number: '',
    holderName: '',
    expiry: '',
    ccv: '',
    holderCpf: '',
    holderPhone: '',
    postalCode: '',
    addressNumber: '',
    cupom: ''
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  const fetchStatus = async () => {
    try {
      const res = await api.get('/api/psychologists/me');
      if (res.data) {
        setPsiData(res.data);
        if (res.data.cpf && !pixCpfInput) setPixCpfInput(res.data.cpf);
        setCardData(prev => ({
          ...prev,
          holderName: prev.holderName || res.data.nome || '',
          holderCpf: prev.holderCpf || res.data.cpf || '',
          holderPhone: prev.holderPhone || res.data.telefone || '',
          postalCode: prev.postalCode || res.data.cep || '',
          addressNumber: prev.addressNumber || res.data.numero || ''
        }));
      }
    } catch (e) {
      console.error("Erro ao carregar dados de assinatura:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // Máscaras de Formatação
  const maskCpf = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const maskCardNumber = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const maskExpiry = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  };

  const maskPhone = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const maskCep = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  };

  const handleCheckoutWeb = async () => {
    try {
      setIsProcessingCheckout(true);
      const baseUrl = getBaseUrl();
      const targetUrl = `${baseUrl}/psi/psi_dashboard.html?page=psi_assinatura.html`;
      await Linking.openURL(targetUrl);
    } catch (e: any) {
      Alert.alert(
        "Assinatura Yelo",
        "Acesse www.yelopsi.com.br pelo navegador e entre no painel para gerenciar sua assinatura com segurança."
      );
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  // Se iOS: abre o modal de escolha (Web R$99 ou iOS R$129,90)
  // Se Android ou outro: abre direto o checkout nativo no app a R$99!
  const handleAssinarEssencial = () => {
    if (Platform.OS === 'ios') {
      setActiveModal('IOS_FEE_CHOICE');
    } else {
      setIsIosCheckout(false);
      setCheckoutPrice('99,00');
      setPixData(null);
      setPaymentMethod('PIX');
      setActiveModal('CHECKOUT');
    }
  };

  const handleAssinarComunidade = () => {
    setActiveModal('COMMUNITY');
  };

  // Ações de Checkout Nativo
  const handleGeneratePix = async () => {
    const rawCpf = (pixCpfInput || psiData?.cpf || '').replace(/\D/g, '');
    if (!rawCpf || rawCpf.length < 11) {
      Alert.alert("CPF Necessário", "Por favor, informe um CPF válido para emissão da cobrança PIX junto ao Banco Central.");
      return;
    }

    try {
      setIsSubmittingPayment(true);
      const res = await api.post('/api/payments/create-preference', {
        planType: isIosCheckout ? 'ESSENTIAL_IOS' : 'ESSENTIAL',
        billingType: 'PIX',
        isIos: isIosCheckout,
        cupom: cardData.cupom.trim(),
        creditCard: {
          holderName: psiData?.nome || 'Psicólogo Yelo',
          holderCpf: rawCpf,
          holderPhone: (psiData?.telefone || '').replace(/\D/g, '') || '11999999999'
        }
      });

      if (res.data?.pix) {
        setPixData(res.data.pix);
        setToastMessage("QR Code PIX gerado com sucesso!");
        setToastType('success');
      } else if (res.data?.couponSuccess) {
        setActiveModal('NONE');
        Alert.alert("🎉 Cupom VIP Aplicado!", "Seu plano foi ativado com sucesso!");
        fetchStatus();
      } else {
        Alert.alert("Assinatura", res.data?.message || "Assinatura solicitada com sucesso.");
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Erro ao gerar PIX. Verifique seus dados e tente novamente.";
      Alert.alert("Não foi possível gerar o PIX", msg);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleCopyPix = async () => {
    if (!pixData?.payload) return;
    await Clipboard.setStringAsync(pixData.payload);
    setPixCopied(true);
    setToastMessage("Código PIX copiado! Cole no app do seu banco.");
    setToastType('success');
    setTimeout(() => setPixCopied(false), 3000);
  };

  const handleCheckPixPaid = async () => {
    try {
      setIsSubmittingPayment(true);
      const res = await api.get('/api/psychologists/me');
      if (res.data?.status === 'active' && res.data?.plano) {
        setPsiData(res.data);
        setActiveModal('NONE');
        setPixData(null);
        Alert.alert("🎉 Pagamento Confirmado!", "Seu Plano Essencial já está ativo na Yelo. Seu perfil agora recebe novos pacientes pelo Match!");
      } else {
        Alert.alert(
          "Aguardando Compensação",
          "Ainda não identificamos a confirmação bancária. Geralmente leva de 30 segundos a 1 minuto após o pagamento no seu banco."
        );
      }
    } catch (e) {
      Alert.alert("Status", "Ainda aguardando a compensação.");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleSubmitCreditCard = async () => {
    const rawNumber = cardData.number.replace(/\D/g, '');
    const rawCpf = (cardData.holderCpf || psiData?.cpf || '').replace(/\D/g, '');
    const rawPhone = (cardData.holderPhone || psiData?.telefone || '').replace(/\D/g, '');
    const rawCep = (cardData.postalCode || psiData?.cep || '').replace(/\D/g, '');

    if (!rawNumber || rawNumber.length < 13) {
      Alert.alert("Cartão Inválido", "Por favor, digite o número completo do cartão de crédito.");
      return;
    }
    if (!cardData.holderName.trim()) {
      Alert.alert("Nome Inválido", "Digite o nome completo exatamente como impresso no cartão.");
      return;
    }
    if (!cardData.expiry || !cardData.expiry.includes('/') || cardData.expiry.length < 5) {
      Alert.alert("Validade Inválida", "Informe o mês e ano de validade (formato MM/AA).");
      return;
    }
    if (!cardData.ccv || cardData.ccv.length < 3) {
      Alert.alert("CVV Inválido", "Informe o código de segurança (CVV) do verso do cartão.");
      return;
    }
    if (!rawCpf || rawCpf.length < 11) {
      Alert.alert("CPF Inválido", "Informe o CPF do titular do cartão.");
      return;
    }

    try {
      setIsSubmittingPayment(true);
      const res = await api.post('/api/payments/create-preference', {
        planType: isIosCheckout ? 'ESSENTIAL_IOS' : 'ESSENTIAL',
        billingType: 'CREDIT_CARD',
        isIos: isIosCheckout,
        cupom: cardData.cupom.trim(),
        creditCard: {
          holderName: cardData.holderName.trim(),
          holderCpf: rawCpf,
          holderPhone: rawPhone || '11999999999',
          postalCode: rawCep || '01001000',
          addressNumber: cardData.addressNumber || psiData?.numero || 'S/N',
          number: rawNumber,
          expiry: cardData.expiry,
          ccv: cardData.ccv.trim()
        }
      });

      if (res.data?.success || res.data?.subscriptionId) {
        setActiveModal('NONE');
        setToastMessage("🎉 Assinatura ativada com sucesso!");
        setToastType('success');
        Alert.alert("🎉 Parabéns!", "Sua assinatura foi ativada com sucesso! O Plano Essencial já está ativo.");
        await fetchStatus();
      } else if (res.data?.couponSuccess) {
        setActiveModal('NONE');
        Alert.alert("🎉 Cupom Aplicado!", "Plano ativado com sucesso!");
        await fetchStatus();
      } else {
        Alert.alert("Assinatura", res.data?.message || "Operação realizada.");
        await fetchStatus();
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Não foi possível processar o pagamento com cartão. Verifique os dados e tente novamente.";
      Alert.alert("Falha no Pagamento", msg);
    } finally {
      setIsSubmittingPayment(false);
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
          
          {/* CARD 1: PLANO ESSENCIAL */}
          <View className="bg-white border-2 border-[#1B4332] rounded-[24px] py-6 px-5 shadow-sm mb-6 relative">
            <View className="absolute -top-3.5 self-center bg-[#FFEE8C] px-4 py-1 rounded-full shadow-sm">
              <Text className="font-sans font-bold text-[#1B4332] text-[11px] tracking-wide">🔥 MAIS POPULAR</Text>
            </View>

            <Text className="font-title text-[#1B4332] text-[22px] text-center mb-3 mt-1">Plano Essencial</Text>
            
            <View className="items-center mb-4">
              <View className="flex-row items-end justify-center mb-1">
                <Text className="font-title text-[#1B4332] text-[38px] leading-[38px]">R$ 99</Text>
                <Text className="font-sans font-medium text-[#888] text-[14px] ml-1 mb-1">/mês</Text>
              </View>
              <Text className="font-sans font-bold text-[#16a34a] text-[11px] text-center uppercase tracking-wide">
                Sem carência ou multas • Cancele quando quiser
              </Text>
            </View>

            {/* BENEFÍCIOS DO ESSENCIAL */}
            <View className="flex-col gap-2.5 mb-6">
              <View className="flex-row items-start gap-2.5">
                <Text className="text-[15px]">✅</Text>
                <Text className="font-sans font-medium text-[#1B4332] text-[14px] flex-1 font-semibold">
                  Receba contatos diretos de novos pacientes no WhatsApp
                </Text>
              </View>
              <View className="flex-row items-start gap-2.5">
                <Text className="text-[15px]">✅</Text>
                <Text className="font-sans font-medium text-[#495057] text-[14px] flex-1">
                  Perfil clínico ativo nas buscas e no motor de match inteligente
                </Text>
              </View>
              <View className="flex-row items-start gap-2.5">
                <Text className="text-[15px]">✅</Text>
                <Text className="font-sans font-medium text-[#495057] text-[14px] flex-1">
                  Acesso integral à agenda e gestão de sessões
                </Text>
              </View>
              <View className="flex-row items-start gap-2.5">
                <Text className="text-[15px]">✅</Text>
                <Text className="font-sans font-medium text-[#495057] text-[14px] flex-1">
                  Prontuário eletrônico seguro e evolução de pacientes
                </Text>
              </View>
              <View className="flex-row items-start gap-2.5">
                <Text className="text-[15px]">✅</Text>
                <Text className="font-sans font-medium text-[#495057] text-[14px] flex-1">
                  Controle financeiro clínico completo
                </Text>
              </View>
              <View className="flex-row items-start gap-2.5">
                <Text className="text-[15px]">✅</Text>
                <Text className="font-sans font-medium text-[#495057] text-[14px] flex-1">
                  Métricas de mercado, demanda e inteligência clínica
                </Text>
              </View>
              <View className="flex-row items-start gap-2.5">
                <Text className="text-[15px]">✅</Text>
                <Text className="font-sans font-medium text-[#495057] text-[14px] flex-1">
                  Acesso irrestrito a debates no Fórum da Comunidade
                </Text>
              </View>
              <View className="flex-row items-start gap-2.5">
                <Text className="text-[15px]">✅</Text>
                <Text className="font-sans font-medium text-[#495057] text-[14px] flex-1">
                  Leitura e publicação de artigos autorais no Blog Yelo
                </Text>
              </View>
            </View>

            {/* BOTÃO ASSINAR ESSENCIAL */}
            <TouchableOpacity 
              onPress={handleAssinarEssencial}
              disabled={isProcessingCheckout}
              className="bg-[#1B4332] w-full py-4 rounded-[50px] items-center shadow-sm mb-3"
              activeOpacity={0.85}
            >
              {isProcessingCheckout ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="font-sans font-bold text-white text-[15px]">
                  {isActive && psiData?.subscriptionId ? "Gerenciar Assinatura" : "Assinar Plano Essencial"}
                </Text>
              )}
            </TouchableOpacity>

            <View className="flex-row items-center justify-center gap-1.5 mt-1">
              <Feather name="lock" size={12} color="#888" />
              <Text className="font-sans font-medium text-[#888] text-[12px]">Pagamento seguro e criptografado</Text>
            </View>
          </View>

          {/* CARD 2: PLANO COMUNIDADE */}
          <View className="bg-white border border-[#e5e7eb] rounded-[24px] py-6 px-5 shadow-sm mb-6 relative">
            <View className="absolute -top-3.5 self-center bg-[#d1fae5] px-4 py-1 rounded-full shadow-sm border border-[#a7f3d0]">
              <Text className="font-sans font-bold text-[#065f46] text-[11px] tracking-wide">🌱 100% GRATUITO</Text>
            </View>

            <Text className="font-title text-[#1B4332] text-[22px] text-center mb-3 mt-1">Plano Comunidade</Text>
            
            <View className="items-center mb-4">
              <View className="flex-row items-end justify-center mb-1">
                <Text className="font-title text-[#1B4332] text-[36px] leading-[36px]">Grátis</Text>
              </View>
              <Text className="font-sans font-medium text-[#6b7280] text-[12px] text-center">
                Sem mensalidades • Acesso vitalício a todas as ferramentas clínicas
              </Text>
            </View>

            {/* BENEFÍCIOS DO COMUNIDADE */}
            <View className="flex-col gap-2.5 mb-6">
              {/* ÚNICA DIFERENÇA DESTACADA CLARAMENTE */}
              <View className="flex-row items-start gap-2.5 bg-[#fef2f2] p-2.5 rounded-[12px] border border-[#fee2e2]">
                <Text className="text-[15px]">❌</Text>
                <Text className="font-sans font-medium text-[#b91c1c] text-[13px] flex-1">
                  Não recebe contatos de novos pacientes pelo Match <Text className="text-[#991b1b] font-bold">(Única diferença)</Text>
                </Text>
              </View>

              <View className="flex-row items-start gap-2.5">
                <Text className="text-[15px]">✅</Text>
                <Text className="font-sans font-medium text-[#495057] text-[14px] flex-1">
                  Acesso integral à agenda e gestão de sessões
                </Text>
              </View>
              <View className="flex-row items-start gap-2.5">
                <Text className="text-[15px]">✅</Text>
                <Text className="font-sans font-medium text-[#495057] text-[14px] flex-1">
                  Prontuário eletrônico seguro e evolução de pacientes
                </Text>
              </View>
              <View className="flex-row items-start gap-2.5">
                <Text className="text-[15px]">✅</Text>
                <Text className="font-sans font-medium text-[#495057] text-[14px] flex-1">
                  Controle financeiro clínico completo
                </Text>
              </View>
              <View className="flex-row items-start gap-2.5">
                <Text className="text-[15px]">✅</Text>
                <Text className="font-sans font-medium text-[#495057] text-[14px] flex-1">
                  Métricas de mercado, demanda e inteligência clínica
                </Text>
              </View>
              <View className="flex-row items-start gap-2.5">
                <Text className="text-[15px]">✅</Text>
                <Text className="font-sans font-medium text-[#495057] text-[14px] flex-1">
                  Acesso irrestrito a debates no Fórum da Comunidade
                </Text>
              </View>
              <View className="flex-row items-start gap-2.5">
                <Text className="text-[15px]">✅</Text>
                <Text className="font-sans font-medium text-[#495057] text-[14px] flex-1">
                  Leitura e publicação de artigos autorais no Blog Yelo
                </Text>
              </View>
              <View className="flex-row items-start gap-2.5">
                <Text className="text-[15px]">✅</Text>
                <Text className="font-sans font-medium text-[#495057] text-[14px] flex-1">
                  Avisos, suporte e melhorias contínuas da plataforma
                </Text>
              </View>
            </View>

            {/* BOTÃO ASSINAR PLANO COMUNIDADE */}
            <TouchableOpacity 
              onPress={handleAssinarComunidade}
              className="bg-[#1B4332] w-full py-4 rounded-[50px] items-center shadow-sm mb-3"
              activeOpacity={0.85}
            >
              <Text className="font-sans font-bold text-white text-[15px]">
                Assinar Plano Comunidade
              </Text>
            </TouchableOpacity>

            <View className="flex-row items-center justify-center gap-1.5 mt-1">
              <Feather name="check-circle" size={12} color="#166534" />
              <Text className="font-sans font-medium text-[#166534] text-[12px]">Sem custo • Não requer cartão de crédito</Text>
            </View>
          </View>

        </View>

      </YeloScrollView>

      {/* ========================================================================= */}
      {/* MODAL BOTTOM SHEET CENTRALIZADO E UNIFICADO (1 ÚNICO MODAL NATIVO)        */}
      {/* Garante zero colisão de transição e zero congelamento de toques no iOS     */}
      {/* ========================================================================= */}
      <Modal
        visible={activeModal !== 'NONE'}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          Keyboard.dismiss();
          if (!isSubmittingPayment) setActiveModal('NONE');
        }}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
          className="flex-1 justify-end bg-black/60"
        >
          {/* Backdrop Touch - fecha modal ao clicar fora */}
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={() => {
              Keyboard.dismiss();
              if (!isSubmittingPayment) setActiveModal('NONE');
            }} 
            className="flex-1"
          />

          {/* ========================================================= */}
          {/* CASO 1: ESCOLHA DE TAXA IOS (TRANSPARÊNCIA) */}
          {/* ========================================================= */}
          {activeModal === 'IOS_FEE_CHOICE' && (
            <View className="bg-white rounded-t-[36px] px-6 pt-3 pb-9 w-full shadow-2xl border-t border-[#f0f0f0]">
              
              {/* Barra de Arraste (Bottom Sheet Handle) */}
              <View className="w-12 h-1.5 bg-[#d1d5db] rounded-full self-center mb-4" />

              {/* Cabeçalho com Estética Yelo */}
              <View className="items-center mb-5">
                <View className="self-center bg-[#f0fdf4] border border-[#bbf7d0] px-3.5 py-1.5 rounded-full mb-3 flex-row items-center gap-1.5">
                  <Text className="text-[12px]">🍎</Text>
                  <Text className="font-sans font-bold text-[#166534] text-[11px] tracking-wide uppercase">Transparência Yelo</Text>
                </View>
                <Text className="font-title text-[#1B4332] text-[22px] text-center mb-1">
                  Como você prefere assinar?
                </Text>
                <Text className="font-sans text-[#64748b] text-[13px] text-center leading-snug px-2">
                  A Apple cobra uma comissão de 30% em compras intermediadas via App Store. Escolha a opção mais conveniente para você:
                </Text>
              </View>

              {/* OPÇÃO 1: NAVEGADOR WEB (RECOMENDADA & SEM TAXAS) */}
              <TouchableOpacity 
                activeOpacity={0.9}
                onPress={() => {
                  setActiveModal('NONE');
                  handleCheckoutWeb();
                }}
                disabled={isProcessingCheckout}
                className="bg-[#f0fdf4] border-2 border-[#1B4332] rounded-[22px] p-4 mb-3.5 relative shadow-sm"
              >
                {/* Tag Flutuante Yelo */}
                <View className="absolute -top-3 left-4 bg-[#FFEE8C] border border-[#fef08a] px-3 py-0.5 rounded-full shadow-xs">
                  <Text className="font-sans font-bold text-[#1B4332] text-[10px] tracking-wide">
                    ⭐ RECOMENDADO • VALOR OFICIAL
                  </Text>
                </View>

                <View className="flex-row items-center justify-between mb-1.5 mt-0.5">
                  <View className="flex-row items-center gap-2">
                    <View className="w-8 h-8 rounded-full bg-[#1B4332] items-center justify-center">
                      <Feather name="globe" size={16} color="white" />
                    </View>
                    <Text className="font-title text-[#1B4332] text-[16px]">Pelo Navegador Web</Text>
                  </View>
                  <View className="items-end">
                    <Text className="font-title text-[#1B4332] text-[20px] leading-tight">
                      R$ 99<Text className="text-[12px] font-sans text-[#475569]">/mês</Text>
                    </Text>
                  </View>
                </View>

                <Text className="font-sans text-[#334155] text-[12.5px] leading-[18px] mb-3">
                  Assine diretamente no portal seguro da Yelo sem nenhuma taxa da Apple. Pagamento via PIX ou Cartão de Crédito.
                </Text>

                <View className="bg-[#1B4332] py-3 rounded-[50px] items-center flex-row justify-center gap-2 shadow-xs">
                  {isProcessingCheckout ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <>
                      <Text className="font-sans font-bold text-white text-[13.5px]">
                        Pagar no Navegador (R$ 99/mês)
                      </Text>
                      <Feather name="arrow-up-right" size={15} color="white" />
                    </>
                  )}
                </View>
              </TouchableOpacity>

              {/* OPÇÃO 2: ASSINAR PELO IOS (COM TAXA DA APP STORE) */}
              <TouchableOpacity 
                activeOpacity={0.85}
                onPress={() => {
                  setIsIosCheckout(true);
                  setCheckoutPrice('129,90');
                  setPixData(null);
                  setPaymentMethod('PIX');
                  setActiveModal('CHECKOUT');
                }}
                disabled={isProcessingCheckout}
                className="bg-white border border-[#e2e8f0] rounded-[22px] p-4 mb-4 shadow-xs"
              >
                <View className="flex-row items-center justify-between mb-1">
                  <View className="flex-row items-center gap-2">
                    <View className="w-8 h-8 rounded-full bg-[#f1f5f9] items-center justify-center">
                      <Feather name="smartphone" size={16} color="#475569" />
                    </View>
                    <Text className="font-title text-[#334155] text-[15px]">Direto pelo App (iOS)</Text>
                  </View>
                  <View className="items-end">
                    <Text className="font-title text-[#475569] text-[18px] leading-tight">
                      R$ 129,90<Text className="text-[12px] font-sans text-[#64748b]">/mês</Text>
                    </Text>
                  </View>
                </View>

                <Text className="font-sans text-[#64748b] text-[12px] leading-[17px] mb-2.5">
                  Inclui a taxa de 30% cobrada pela Apple App Store para processamento de assinaturas dentro do iOS.
                </Text>

                <View className="bg-[#f8fafc] border border-[#cbd5e1] py-2.5 rounded-[50px] items-center flex-row justify-center gap-1.5">
                  <Text className="font-sans font-semibold text-[#475569] text-[13px]">
                    Continuar pelo iOS (R$ 129,90/mês)
                  </Text>
                </View>
              </TouchableOpacity>

              {/* BOTÃO CANCELAR / FECHAR */}
              <TouchableOpacity 
                onPress={() => setActiveModal('NONE')}
                className="py-2.5 items-center"
                activeOpacity={0.7}
              >
                <Text className="font-sans font-semibold text-[#94a3b8] text-[13px]">
                  Voltar para os Planos
                </Text>
              </TouchableOpacity>

            </View>
          )}

          {/* ========================================================= */}
          {/* CASO 2: PLANO COMUNIDADE ATIVADO */}
          {/* ========================================================= */}
          {activeModal === 'COMMUNITY' && (
            <View className="bg-white rounded-t-[36px] px-6 pt-3 pb-9 w-full shadow-2xl border-t border-[#f0f0f0]">
              <View className="w-12 h-1.5 bg-[#d1d5db] rounded-full self-center mb-4" />

              <View className="items-center mb-4">
                <View className="self-center bg-[#ecfdf5] border border-[#a7f3d0] px-3.5 py-1.5 rounded-full mb-3 flex-row items-center gap-1.5">
                  <Text className="text-[12px]">🌱</Text>
                  <Text className="font-sans font-bold text-[#059669] text-[11px] tracking-wide uppercase">100% Gratuito & Vitalício</Text>
                </View>
                <Text className="font-title text-[#1B4332] text-[22px] text-center mb-1">
                  Plano Comunidade Yelo
                </Text>
                <Text className="font-sans text-[#64748b] text-[13px] text-center leading-snug px-2">
                  Você tem acesso irrestrito a todas as ferramentas clínicas da plataforma sem custo algum.
                </Text>
              </View>

              <View className="bg-[#f8fafc] border border-[#e2e8f0] p-4 rounded-[20px] mb-4">
                <View className="flex-row items-center gap-2 mb-2">
                  <Text className="text-[14px]">✅</Text>
                  <Text className="font-sans text-[#334155] text-[13px]">Agenda, prontuários eletrônicos e finanças liberados</Text>
                </View>
                <View className="flex-row items-center gap-2 mb-2">
                  <Text className="text-[14px]">✅</Text>
                  <Text className="font-sans text-[#334155] text-[13px]">Acesso aos debates no Fórum e publicações no Blog</Text>
                </View>
                
                <View className="h-[1px] bg-[#e2e8f0] my-2" />

                <View className="flex-row items-start gap-2">
                  <Text className="text-[14px]">ℹ️</Text>
                  <Text className="font-sans text-[#b91c1c] text-[12.5px] leading-[18px] flex-1 font-medium">
                    <Text className="font-bold">Única diferença:</Text> seu perfil não receberá novos pacientes pelo Match. Você pode migrar para o Essencial a qualquer momento.
                  </Text>
                </View>
              </View>

              <TouchableOpacity 
                onPress={() => {
                  setActiveModal('NONE');
                  router.navigate('/(tabs)/forum');
                }}
                className="bg-[#1B4332] w-full py-3.5 rounded-[50px] items-center shadow-sm mb-2.5"
                activeOpacity={0.85}
              >
                <Text className="font-sans font-bold text-white text-[14px]">
                  Acessar Fórum & Comunidade
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setActiveModal('NONE')}
                className="py-2 items-center"
                activeOpacity={0.7}
              >
                <Text className="font-sans font-semibold text-[#94a3b8] text-[13px]">
                  Permanecer nos Planos
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ========================================================= */}
          {/* CASO 3: CHECKOUT NATIVO NO APP (PIX OU CARTÃO) */}
          {/* ========================================================= */}
          {activeModal === 'CHECKOUT' && (
            <View 
              style={{ 
                backgroundColor: '#ffffff',
                borderTopLeftRadius: 36,
                borderTopRightRadius: 36,
                maxHeight: Math.min(screenHeight * 0.90, 720),
                width: '100%',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.15,
                shadowRadius: 16,
                elevation: 25,
              }}
            >
            {/* Barra de Arraste (Bottom Sheet Handle) */}
            <View className="w-12 h-1.5 bg-[#d1d5db] rounded-full self-center mt-3 mb-1.5" />

            {/* Cabeçalho do Checkout estilo Apple Pay (FIXO - NUNCA ROLA) */}
            <View className="px-5 py-3 border-b border-[#f1f5f9] flex-row items-center justify-between bg-white">
              {/* Botão de Fechar no Canto Superior Esquerdo (Estilo Apple Pay - Livre de Sobreposição) */}
              <Pressable
                onPressIn={() => {
                  Keyboard.dismiss();
                  if (!isSubmittingPayment) setActiveModal('NONE');
                }}
                onPress={() => {
                  Keyboard.dismiss();
                  if (!isSubmittingPayment) setActiveModal('NONE');
                }}
                hitSlop={15}
                className="w-9 h-9 rounded-full bg-[#f1f5f9] items-center justify-center active:bg-[#e2e8f0]"
              >
                <Feather name="x" size={19} color="#334155" />
              </Pressable>

              {/* Título Centralizado com Badge */}
              <View className="items-center flex-1 mx-2">
                <Text className="font-title text-[#1B4332] text-[18px]">Finalizar Assinatura</Text>
                <View className="flex-row items-center gap-1.5 mt-0.5">
                  <View className="bg-[#f0fdf4] border border-[#bbf7d0] px-2.5 py-0.5 rounded-full">
                    <Text className="font-sans font-bold text-[#166534] text-[11px]">
                      Plano Essencial • R$ {checkoutPrice}/mês
                    </Text>
                  </View>
                  {isIosCheckout && (
                    <View className="bg-[#f1f5f9] px-2 py-0.5 rounded-full">
                      <Text className="font-sans font-medium text-[#475569] text-[10px]">App iOS</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Botão de Fechar Secundário no Canto Direito (Texto) */}
              <Pressable
                onPressIn={() => {
                  Keyboard.dismiss();
                  if (!isSubmittingPayment) setActiveModal('NONE');
                }}
                onPress={() => {
                  Keyboard.dismiss();
                  if (!isSubmittingPayment) setActiveModal('NONE');
                }}
                hitSlop={15}
                className="py-1 px-2 rounded-full"
              >
                <Text className="font-sans font-semibold text-[#64748b] text-[13px]">Fechar</Text>
              </Pressable>
            </View>

            {/* Abas Seletoras em Formato de Pílula (FIXAS - NUNCA ROLAM, NUNCA TRAVAM) */}
            <View className="px-6 pt-3 pb-2 bg-white">
              <View className="flex-row bg-[#f1f5f9] p-1.5 rounded-full border border-[#e2e8f0]/80">
                <Pressable
                  onPressIn={() => {
                    setPaymentMethod('PIX');
                  }}
                  onPress={() => {
                    setPaymentMethod('PIX');
                  }}
                  hitSlop={8}
                  className={`flex-1 py-2.5 rounded-full flex-row items-center justify-center gap-2 ${
                    paymentMethod === 'PIX' ? 'bg-[#1B4332] shadow-sm' : 'bg-transparent'
                  }`}
                >
                  <View className={`w-6 h-6 rounded-full items-center justify-center ${paymentMethod === 'PIX' ? 'bg-white/20' : 'bg-slate-200'}`}>
                    <Feather name="zap" size={12} color={paymentMethod === 'PIX' ? '#FFEE8C' : '#64748b'} />
                  </View>
                  <Text className={`font-sans font-bold text-[13px] ${
                    paymentMethod === 'PIX' ? 'text-white' : 'text-[#64748b]'
                  }`}>
                    PIX Instantâneo
                  </Text>
                </Pressable>

                <Pressable
                  onPressIn={() => {
                    setPaymentMethod('CREDIT_CARD');
                  }}
                  onPress={() => {
                    setPaymentMethod('CREDIT_CARD');
                  }}
                  hitSlop={8}
                  className={`flex-1 py-2.5 rounded-full flex-row items-center justify-center gap-2 ${
                    paymentMethod === 'CREDIT_CARD' ? 'bg-[#1B4332] shadow-sm' : 'bg-transparent'
                  }`}
                >
                  <View className={`w-6 h-6 rounded-full items-center justify-center ${paymentMethod === 'CREDIT_CARD' ? 'bg-white/20' : 'bg-slate-200'}`}>
                    <Feather name="credit-card" size={12} color={paymentMethod === 'CREDIT_CARD' ? '#FFEE8C' : '#64748b'} />
                  </View>
                  <Text className={`font-sans font-bold text-[13px] ${
                    paymentMethod === 'CREDIT_CARD' ? 'text-white' : 'text-[#64748b]'
                  }`}>
                    Cartão de Crédito
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Barra rápida de fechar teclado (visível sempre que o teclado estiver aberto) */}
            {isKeyboardVisible && (
              <View className="px-6 py-1.5 bg-[#f8fafc] border-b border-[#f1f5f9] flex-row justify-between items-center">
                <Text className="font-sans text-[11px] text-[#64748b]">Preenchendo formulário</Text>
                <Pressable
                  onPressIn={() => Keyboard.dismiss()}
                  onPress={() => Keyboard.dismiss()}
                  hitSlop={10}
                  className="flex-row items-center gap-1.5 bg-[#e2e8f0] px-3.5 py-1.5 rounded-full active:bg-[#cbd5e1]"
                >
                  <Text className="font-sans font-bold text-[#334155] text-[11.5px]">Ocultar Teclado</Text>
                  <Feather name="chevron-down" size={13} color="#334155" />
                </Pressable>
              </View>
            )}

            {/* Conteúdo Rolável do Checkout */}
            <ScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ 
                paddingHorizontal: 24, 
                paddingTop: 12, 
                paddingBottom: isKeyboardVisible ? 220 : 60 
              }}
              keyboardShouldPersistTaps="always"
              keyboardDismissMode="on-drag"
            >

              {/* ABA 1: PIX */}
              {paymentMethod === 'PIX' && (
                <View>
                  {!pixData ? (
                    <View>
                      <View className="bg-[#f0fdf4] border border-[#bbf7d0] p-4 rounded-[24px] mb-4 flex-row items-start gap-3">
                        <View className="w-8 h-8 rounded-full bg-[#dcfce7] items-center justify-center mt-0.5">
                          <Feather name="zap" size={16} color="#166534" />
                        </View>
                        <View className="flex-1">
                          <Text className="font-sans font-bold text-[#166534] text-[13px] mb-0.5">
                            Ativação Imediata via PIX
                          </Text>
                          <Text className="font-sans text-[#15803d] text-[12px] leading-relaxed">
                            Ao gerar a cobrança, você receberá o QR Code e o código Pix Copia e Cola para pagar no app do seu banco.
                          </Text>
                        </View>
                      </View>

                      {/* CPF para emissão da fatura PIX */}
                      <View className="mb-3.5">
                        <Text className="font-sans text-[12px] font-bold text-[#475569] mb-1.5 ml-2">
                          CPF do Titular *
                        </Text>
                        <TextInput
                          value={pixCpfInput}
                          onChangeText={(t) => setPixCpfInput(maskCpf(t))}
                          placeholder="000.000.000-00"
                          placeholderTextColor="#94a3b8"
                          keyboardType="numeric"
                          maxLength={14}
                          returnKeyType="done"
                          onSubmitEditing={Keyboard.dismiss}
                          className="bg-[#f8fafc] border border-[#cbd5e1] rounded-full px-5 py-3.5 text-[#1e293b] font-sans text-[14px]"
                        />
                      </View>

                      {/* Cupom opcional */}
                      <View className="mb-5">
                        <Text className="font-sans text-[12px] font-bold text-[#475569] mb-1.5 ml-2">
                          Cupom de Desconto (opcional)
                        </Text>
                        <TextInput
                          value={cardData.cupom}
                          onChangeText={(t) => setCardData(prev => ({ ...prev, cupom: t.toUpperCase() }))}
                          placeholder="DIGITE SEU CUPOM"
                          placeholderTextColor="#94a3b8"
                          autoCapitalize="characters"
                          returnKeyType="done"
                          onSubmitEditing={Keyboard.dismiss}
                          className="bg-[#f8fafc] border border-[#cbd5e1] rounded-full px-5 py-3.5 text-[#1e293b] font-sans text-[14px]"
                        />
                      </View>

                      {/* Botão Gerar PIX */}
                      <TouchableOpacity
                        onPress={() => {
                          Keyboard.dismiss();
                          handleGeneratePix();
                        }}
                        disabled={isSubmittingPayment}
                        className="bg-[#1B4332] w-full py-4 rounded-full items-center shadow-md active:bg-[#143225] mt-1 mb-6"
                        activeOpacity={0.85}
                      >
                        {isSubmittingPayment ? (
                          <ActivityIndicator color="white" size="small" />
                        ) : (
                          <View className="flex-row items-center gap-2">
                            <Feather name="check-circle" size={17} color="#FFEE8C" />
                            <Text className="font-sans font-bold text-white text-[14.5px]">
                              Gerar Código PIX (R$ {checkoutPrice})
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>

                      {/* Botão Cancelar / Fechar */}
                      <Pressable
                        onPressIn={() => {
                          Keyboard.dismiss();
                          setActiveModal('NONE');
                        }}
                        onPress={() => {
                          Keyboard.dismiss();
                          setActiveModal('NONE');
                        }}
                        hitSlop={10}
                        className="w-full py-2.5 items-center justify-center -mt-2 mb-6"
                      >
                        <Text className="font-sans font-semibold text-[#94a3b8] text-[13px]">
                          Cancelar / Fechar
                        </Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View className="items-center">
                      <View className="bg-[#ecfdf5] border border-[#a7f3d0] px-4 py-1.5 rounded-full mb-3.5 flex-row items-center gap-1.5">
                        <Feather name="check-circle" size={13} color="#059669" />
                        <Text className="font-sans font-bold text-[#059669] text-[11px] tracking-wide uppercase">
                          PIX Gerado • Validade 15 Minutos
                        </Text>
                      </View>

                      {pixData.encodedImage ? (
                        <View className="p-3.5 bg-white border border-[#e2e8f0] rounded-[24px] shadow-sm mb-3.5 items-center justify-center">
                          <Image 
                            source={{ uri: `data:image/png;base64,${pixData.encodedImage}` }}
                            style={{ width: 175, height: 175 }}
                            resizeMode="contain"
                          />
                        </View>
                      ) : null}

                      {/* Código Copia e Cola */}
                      <View className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-[24px] p-4 mb-3.5">
                        <Text className="font-sans text-[11px] text-[#64748b] mb-1.5 font-bold uppercase tracking-wide">
                          Código Pix Copia e Cola:
                        </Text>
                        <Text numberOfLines={2} className="font-mono text-[11px] text-[#334155] mb-3">
                          {pixData.payload}
                        </Text>

                        <TouchableOpacity
                          onPress={handleCopyPix}
                          className={`w-full py-3.5 rounded-full flex-row items-center justify-center gap-2 ${
                            pixCopied ? 'bg-[#16a34a]' : 'bg-[#1B4332]'
                          }`}
                          activeOpacity={0.85}
                        >
                          <Feather name={pixCopied ? "check" : "copy"} size={16} color="white" />
                          <Text className="font-sans font-bold text-white text-[13px]">
                            {pixCopied ? "Código Copiado! ✓" : "Copiar Código PIX"}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Instruções */}
                      <View className="w-full bg-[#f1f5f9] p-4 rounded-[22px] mb-4">
                        <Text className="font-sans font-bold text-[#334155] text-[12px] mb-1.5">
                          Como pagar:
                        </Text>
                        <Text className="font-sans text-[#64748b] text-[11.5px] leading-relaxed">
                          1. Abra o app do seu banco preferido.{'\n'}
                          2. Escolha a opção Pix &gt; Copia e Cola.{'\n'}
                          3. Cole o código copiado e confirme o pagamento.{'\n'}
                          4. Clique no botão abaixo para verificar a liberação!
                        </Text>
                      </View>

                      {/* Botões de Ação */}
                      <TouchableOpacity
                        onPress={handleCheckPixPaid}
                        disabled={isSubmittingPayment}
                        className="bg-[#1B4332] w-full py-4 rounded-full items-center shadow-md mb-2.5 active:bg-[#143225]"
                        activeOpacity={0.85}
                      >
                        {isSubmittingPayment ? (
                          <ActivityIndicator color="white" size="small" />
                        ) : (
                          <View className="flex-row items-center gap-2">
                            <Feather name="check" size={17} color="#FFEE8C" />
                            <Text className="font-sans font-bold text-white text-[14.5px]">
                              Já realizei o pagamento ✓
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setPixData(null)}
                        className="py-2.5 px-5 rounded-full bg-[#f1f5f9] self-center items-center mt-1"
                        activeOpacity={0.7}
                      >
                        <Text className="font-sans font-semibold text-[#64748b] text-[12px]">
                          Gerar outro código PIX
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {/* ABA 2: CARTÃO DE CRÉDITO */}
              {paymentMethod === 'CREDIT_CARD' && (
                <View>
                  <View className="mb-3.5">
                    <Text className="font-sans text-[12px] font-bold text-[#475569] mb-1.5 ml-2">
                      Número do Cartão *
                    </Text>
                    <TextInput
                      value={cardData.number}
                      onChangeText={(t) => setCardData(prev => ({ ...prev, number: maskCardNumber(t) }))}
                      placeholder="0000 0000 0000 0000"
                      placeholderTextColor="#94a3b8"
                      keyboardType="numeric"
                      maxLength={19}
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                      className="bg-[#f8fafc] border border-[#cbd5e1] rounded-full px-5 py-3.5 text-[#1e293b] font-sans text-[14px]"
                    />
                  </View>

                  <View className="mb-3.5">
                    <Text className="font-sans text-[12px] font-bold text-[#475569] mb-1.5 ml-2">
                      Nome Impresso no Cartão *
                    </Text>
                    <TextInput
                      value={cardData.holderName}
                      onChangeText={(t) => setCardData(prev => ({ ...prev, holderName: t.toUpperCase() }))}
                      placeholder="NOME COMO NO CARTÃO"
                      placeholderTextColor="#94a3b8"
                      autoCapitalize="characters"
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                      className="bg-[#f8fafc] border border-[#cbd5e1] rounded-full px-5 py-3.5 text-[#1e293b] font-sans text-[14px]"
                    />
                  </View>

                  {/* Validade e CVV */}
                  <View className="flex-row gap-3 mb-3.5">
                    <View className="flex-1">
                      <Text className="font-sans text-[12px] font-bold text-[#475569] mb-1.5 ml-2">
                        Validade (MM/AA) *
                      </Text>
                      <TextInput
                        value={cardData.expiry}
                        onChangeText={(t) => setCardData(prev => ({ ...prev, expiry: maskExpiry(t) }))}
                        placeholder="MM/AA"
                        placeholderTextColor="#94a3b8"
                        keyboardType="numeric"
                        maxLength={5}
                        returnKeyType="done"
                        onSubmitEditing={Keyboard.dismiss}
                        className="bg-[#f8fafc] border border-[#cbd5e1] rounded-full px-5 py-3.5 text-[#1e293b] font-sans text-[14px]"
                      />
                    </View>

                    <View className="flex-1">
                      <Text className="font-sans text-[12px] font-bold text-[#475569] mb-1.5 ml-2">
                        CVV *
                      </Text>
                      <TextInput
                        value={cardData.ccv}
                        onChangeText={(t) => setCardData(prev => ({ ...prev, ccv: t.replace(/\D/g, '').slice(0, 4) }))}
                        placeholder="123"
                        placeholderTextColor="#94a3b8"
                        keyboardType="numeric"
                        maxLength={4}
                        returnKeyType="done"
                        onSubmitEditing={Keyboard.dismiss}
                        className="bg-[#f8fafc] border border-[#cbd5e1] rounded-full px-5 py-3.5 text-[#1e293b] font-sans text-[14px]"
                      />
                    </View>
                  </View>

                  {/* CPF e Telefone do Titular */}
                  <View className="flex-row gap-3 mb-3.5">
                    <View className="flex-1">
                      <Text className="font-sans text-[12px] font-bold text-[#475569] mb-1.5 ml-2">
                        CPF do Titular *
                      </Text>
                      <TextInput
                        value={cardData.holderCpf}
                        onChangeText={(t) => setCardData(prev => ({ ...prev, holderCpf: maskCpf(t) }))}
                        placeholder="000.000.000-00"
                        placeholderTextColor="#94a3b8"
                        keyboardType="numeric"
                        maxLength={14}
                        returnKeyType="done"
                        onSubmitEditing={Keyboard.dismiss}
                        className="bg-[#f8fafc] border border-[#cbd5e1] rounded-full px-5 py-3.5 text-[#1e293b] font-sans text-[14px]"
                      />
                    </View>

                    <View className="flex-1">
                      <Text className="font-sans text-[12px] font-bold text-[#475569] mb-1.5 ml-2">
                        Telefone
                      </Text>
                      <TextInput
                        value={cardData.holderPhone}
                        onChangeText={(t) => setCardData(prev => ({ ...prev, holderPhone: maskPhone(t) }))}
                        placeholder="(00) 00000-0000"
                        placeholderTextColor="#94a3b8"
                        keyboardType="numeric"
                        maxLength={15}
                        returnKeyType="done"
                        onSubmitEditing={Keyboard.dismiss}
                        className="bg-[#f8fafc] border border-[#cbd5e1] rounded-full px-5 py-3.5 text-[#1e293b] font-sans text-[14px]"
                      />
                    </View>
                  </View>

                  {/* CEP e Número */}
                  <View className="flex-row gap-3 mb-3.5">
                    <View className="flex-1">
                      <Text className="font-sans text-[12px] font-bold text-[#475569] mb-1.5 ml-2">
                        CEP
                      </Text>
                      <TextInput
                        value={cardData.postalCode}
                        onChangeText={(t) => setCardData(prev => ({ ...prev, postalCode: maskCep(t) }))}
                        placeholder="00000-000"
                        placeholderTextColor="#94a3b8"
                        keyboardType="numeric"
                        maxLength={9}
                        returnKeyType="done"
                        onSubmitEditing={Keyboard.dismiss}
                        className="bg-[#f8fafc] border border-[#cbd5e1] rounded-full px-5 py-3.5 text-[#1e293b] font-sans text-[14px]"
                      />
                    </View>

                    <View className="flex-1">
                      <Text className="font-sans text-[12px] font-bold text-[#475569] mb-1.5 ml-2">
                        Número
                      </Text>
                      <TextInput
                        value={cardData.addressNumber}
                        onChangeText={(t) => setCardData(prev => ({ ...prev, addressNumber: t }))}
                        placeholder="Ex: 123"
                        placeholderTextColor="#94a3b8"
                        returnKeyType="done"
                        onSubmitEditing={Keyboard.dismiss}
                        className="bg-[#f8fafc] border border-[#cbd5e1] rounded-full px-5 py-3.5 text-[#1e293b] font-sans text-[14px]"
                      />
                    </View>
                  </View>

                  {/* Cupom */}
                  <View className="mb-4">
                    <Text className="font-sans text-[12px] font-bold text-[#475569] mb-1.5 ml-2">
                      Cupom de Desconto (opcional)
                    </Text>
                    <TextInput
                      value={cardData.cupom}
                      onChangeText={(t) => setCardData(prev => ({ ...prev, cupom: t.toUpperCase() }))}
                      placeholder="DIGITE SEU CUPOM"
                      placeholderTextColor="#94a3b8"
                      autoCapitalize="characters"
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                      className="bg-[#f8fafc] border border-[#cbd5e1] rounded-full px-5 py-3.5 text-[#1e293b] font-sans text-[14px]"
                    />
                  </View>

                  <View className="bg-[#f0fdf4] border border-[#bbf7d0] px-4 py-2 rounded-full self-center flex-row items-center gap-1.5 mb-4">
                    <Feather name="shield" size={13} color="#166534" />
                    <Text className="font-sans text-[11.5px] text-[#166534] font-medium">
                      Dados criptografados direto com gateway seguro Asaas
                    </Text>
                  </View>

                  {/* Botão Ativar Assinatura */}
                  <TouchableOpacity
                    onPress={() => {
                      Keyboard.dismiss();
                      handleSubmitCreditCard();
                    }}
                    disabled={isSubmittingPayment}
                    className="bg-[#1B4332] w-full py-4 rounded-full items-center shadow-md active:bg-[#143225] mt-1 mb-6"
                    activeOpacity={0.85}
                  >
                    {isSubmittingPayment ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <View className="flex-row items-center gap-2">
                        <Feather name="lock" size={16} color="#FFEE8C" />
                        <Text className="font-sans font-bold text-white text-[14.5px]">
                          Ativar Assinatura (R$ {checkoutPrice}/mês)
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Botão Cancelar / Fechar */}
                  <Pressable
                    onPressIn={() => {
                      Keyboard.dismiss();
                      setActiveModal('NONE');
                    }}
                    onPress={() => {
                      Keyboard.dismiss();
                      setActiveModal('NONE');
                    }}
                    hitSlop={10}
                    className="w-full py-2.5 items-center justify-center -mt-2 mb-6"
                  >
                    <Text className="font-sans font-semibold text-[#94a3b8] text-[13px]">
                      Cancelar / Fechar
                    </Text>
                  </Pressable>
                </View>
              )}

            </ScrollView>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>

      {/* TOAST DE FEEDBACK VISUAL */}
      <YeloToast 
        message={toastMessage} 
        onDismiss={() => setToastMessage(null)} 
        type={toastType} 
      />

    </View>
  );
}
