import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
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
  StyleSheet
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import YeloScrollView from '../../components/YeloScrollView';
import YeloToast from '../../components/YeloToast';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api, { getBaseUrl } from '../../services/api';

// =========================================================================
// MOCK DE TESTE VISUAL DE CENÁRIOS
// 'CENARIO_1': Profissional que nunca ativou e ainda está no período de testes (5 dias restantes)
// 'CENARIO_2': Nunca ativou e seu período de testes acabou (expirado)
// 'CENARIO_3': Profissional com assinatura ativa e pagamento recorrente autorizado
// 'CENARIO_4': Profissional que cancelou a renovação automática (acesso até a data final)
// 'REAL': Dados reais da API
// =========================================================================
const MOCK_SCENARIO: 'CENARIO_1' | 'CENARIO_2' | 'CENARIO_3' | 'CENARIO_4' | 'REAL' = 'REAL';

const MOCK_PIX_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAANwAAADcCAYAAAAbWs+BAAAAAklEQVR4AewaftIAAAmPSURBVO3BUZJbwZEEwYw23P/KsfwuA9eKD2BzJKU7/pKquuKkqq45qaprTqrqmpOquuakqq555TeA/BRqtoBsqJmATGomIBtq3gGyoWYDyKRmA8g7ajaAfJOaTwD5KdRMJ1V1zUlVXXNSVdecVNU1r/wBNX8bkE+o+SYgk5oJyATkE0C+Ccik5tvUfBOQSc2Wmr8NyMZJVV1zUlXXnFTVNSdVdc0rHwLylJpPAJnUPKVmA8iGmi0gG2omIBOQSc0E5B01TwGZ1ExAJjU3AHlKzVMnVXXNSVVdc1JV15xU1TWv/JcBsqFmArKhZgLyk6iZgHybmto7qaprTqrqmpOquuakqq555X+Amg01E5ANNd+m5ikgG2q+DcikZgPIf7OTqrrmpKquOamqa06q6ppXPqTmpwMyqZmATGo2gExqvg3IpOYpIO+o2QAyqZmAbKi5Qc2/cFJV15xU1TUnVXXNSVVd88ofAPLTqZmAfBOQSc0E5B01fxuQSc0ngExqJiCTmgnIBpBJzRaQn+Kkqq45qaprTqrqmpOquuaV31DznwjIU2q+Sc23qXkKyA1qJiCTmgnIpGZLzU92UlXXnFTVNSdVdc1JVV1zUlXX4C95A8ikZgLyt6n5NiAbaiYg36bmKSCTmk8A+SY1E5Cn1LwD5G9T89RJVV1zUlXXnFTVNSdVdQ3+kjeAPKVmArKh5icBsqFmAnKDmg0gk5otIJOafwHIO2o2gExqNoBsqJlOquqak6q65qSqrjmpqmte+Q01E5ANIBtqJiCTmneATGomIJOaDTUTkA017wB5Ss0EZFIzqbkByKRmAjKpmYBMat4BMqn5KU6q6pqTqrrmpKquOamqa/CXLAHZUDMB2VDzbUB+EjXfBGRSswFkS803AdlQMwF5R81PdlJV15xU1TUnVXXNSVVd88qH1GyomYBMQCY17wCZ1PxtaiYgk5pvAzKpmYBMarbUTEAmNROQDTUbQCY1/wqQDTXTSVVdc1JV15xU1TUnVXXNKx8CsqFmUnODmm8CMqnZAjKp2VCzoWYCMqnZUvO3AZnUTEDeUTMB2VAzAdlQs3FSVdecVNU1J1V1zUlVXfPKbwDZUPNNQCY1W0CeUvOvAPkmNRtA3lGzAWRSMwHZUDMB2QIyqfkmNROQSc10UlXXnFTVNSdVdc1JVV3zyh9QMwGZ1ExANtRsqZmATGqeAjKp+TY1G0C+Sc0NaiYgk5pPqHkKyFNqNk6q6pqTqrrmpKquOamqa175A0AmNRtqJiATkEnNtwH5V9RMQDbUbACZ1PwkaiYgNwCZ1PxtJ1V1zUlVXXNSVdecVNU1J1V1zSt/QM03qfk2NRtqngKyoeYdIJOap4BMaj4BZEPNBOSb1ExAtoBMap4CsqFmOqmqa06q6pqTqrrmpKqueeVDQCY1E5Cn1GwBeUrNU2omIJ8AMqn5JiBbar5JzQRkAjKpeQfIBpBJzVNqNk6q6pqTqrrmpKquOamqa/CXLAH5JjUbQN5RswFkUrMBZFLzCSBPqXkKyKTm24BMajaAfELN3wZkUrNxUlXXnFTVNSdVdc1JVV3zyofUfBOQLSCTmg0gG2qeAvKOmg0gTwGZ1ExA3lGzAWRSMwF5Ss1PB2RSM51U1TUnVXXNSVVdc1JV1+AveQPIpGYDyKRmAjKpmYC8o+abgGyomYDcoGYCMqn5V4BMaiYgk5oJyL+iZgIyqdk4qaprTqrqmpOquuakqq555RIgk5oJyCeATGo21ExANtT8K2o2gHxCzQRkUvMUkEnNBOQdNRtANoBsAJnUTCdVdc1JVV1zUlXXnFTVNa98CMikZgKyoeYGIJOap4BMat4B8pSaCci3qZmATGqeUjMB+enUTEA2TqrqmpOquuakqq45qaprXvmQmg01G0A+oWYC8pSaCcgGkHfUbAD529RsqdkAsqFmA8gWkEnNhpoNIJOajZOquuakqq45qaprTqrqmpOquuaVDwF5Ss2kZgLyCTUbQDbUbADZAjKp2VDzFJBPqNlQ868AmdR8E5BJzXRSVdecVNU1J1V1zUlVXfPKb6h5Ss0EZALy06mZgHybmgnIpOab1HwCyAaQDTWfADKpmYD8CydVdc1JVV1zUlXXnFTVNa/8BpB/Qc0WkKeATGomIBtqvk3NBpBJzQRkS82Gmg0g3wTk29RsAHnqpKquOamqa06q6pqTqrrmlUvUTEAmIFtqvgnINwH5hJoJyKRmArKh5h0gG2o21HyTmneAbKjZAPJNJ1V1zUlVXXNSVdecVNU1r/wBNROQCciGmk8A2VCzoWYDyARkS80GkA0gk5oNIO+o2QAyqZmAfJOad9RMQDbUbKh56qSqrjmpqmtOquqak6q65pUPqZmAbAD5hJoNIJOaDSAbaraAPKVmAjIBmdR8Asjfpubb1ExAngIyqdk4qaprTqrqmpOquuakqq555UNAJjU3AJnUbADZULMBZFKzpeYpNROQTwCZ1ExAvgnIhpp3gExqJjUTkEnNBpBJzXRSVdecVNU1J1V1zUlVXYO/5A0gk5oNIN+kZgvIpOYpIE+p+QSQSc0EZFIzAfmEmg0gG2o2gNygZgKyoWbjpKquOamqa06q6pqTqroGf8l/KCCTmgnIpGYC8pSaCcg7ap4CsqFmA8g7aiYgk5qngDyl5hNANtRMQDbUTCdVdc1JVV1zUlXXnFTVNSdVdc0rvwHkp1DzjpoNNRtqNoBsqNkCMqnZUHODmgnIpGZDzQTkE0AmNRtqNtQ8dVJV15xU1TUnVXXNSVVd88ofUPO3AdkCMqmZgExqJiAbaiYgk5otNf+CmneATGo2gPwrav42IJOajZOquuakqq45qaprTqrqmlc+BOQpNd8GZFIzAZnUbACZ1HwCyKTmKSCTmk8AeUrNBGRSMwGZgHwbkEnNBpBJzXRSVdecVNU1J1V1zUlVXfNK/b+ATGo2gGyp+UnUTED+NiCTmgnIO2o2gExqnlKzcVJV15xU1TUnVXXNSVVd88p/GTUbaiYgG0AmNZOad4A8pWZDzQaQLTUTkEnNBGRDzQRkC8ik5qc4qaprTqrqmpOquuakqq555UNq/hU1G0AmNRtqJiATkEnNO2omIJOaCcikZgKyoWYLyAaQSc0GkEnNFpAJyDepeeqkqq45qaprTqrqmpOquuaVPwDkJwEyqdkAMql5Ss0WkEnNBGRSMwHZUPMJNROQDSDfBORfATKp2TipqmtOquqak6q65qSqrsFfUlVXnFTVNSdVdc1JVV1zUlXX/B+2ib2pguunBQAAAABJRU5ErkJggg==';
const MOCK_PIX_PAYLOAD = '00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-426614174000520400005303986540599.005802BR5913YELO SAUDE6009SAO PAULO62070503***6304ABCD';

export default function AssinaturaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const modalScrollRef = useRef<any>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [psiData, setPsiData] = useState<any>(null);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);

  // Modal Centralizado Unificado (1 Único Modal Nativo para evitar congelamento de toques no iOS)
  const [activeModal, setActiveModal] = useState<
    'NONE' | 'IOS_FEE_CHOICE' | 'CHECKOUT' | 'CANCEL_CONFIRM' | 'CANCEL_SUCCESS' | 'REACTIVATE_CONFIRM'
  >('NONE');
  const [cancelSuccessMsg, setCancelSuccessMsg] = useState<string>(
    'Sua renovação automática foi cancelada. Você continuará com acesso até o fim do período atual pago.'
  );

  // Modo Atualização de Forma de Pagamento (#btn-alterar-pagamento da versão Web)
  const [isUpdatePaymentMethodMode, setIsUpdatePaymentMethodMode] = useState(false);

  // Alerta de Fatura PIX / Cartão em Aberto (#alert-pix-pending da versão Web)
  const [pendingInvoice, setPendingInvoice] = useState<{
    pending: boolean;
    dueDate?: string;
    value?: number;
    billingType?: string;
    pix?: { encodedImage?: string; payload?: string };
    diffDays?: number;
  } | null>(null);

  // Keyboard state for native iOS bottom-sheet handling
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Logger silencioso (painel de debug visual removido conforme solicitado)
  const addDebugLog = (_msg: string) => { };

  const getPixImageUri = (encodedImage?: string) => {
    if (!encodedImage) return null;
    const trimmed = encodedImage.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    if (trimmed.startsWith('data:image')) {
      return trimmed;
    }
    return `data:image/png;base64,${trimmed}`;
  };

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
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
  const [modalError, setModalError] = useState<string | null>(null);

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
      if (MOCK_SCENARIO !== 'REAL') {
        const fiveDaysFromNow = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
        const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
        const twentyDaysFromNow = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();

        let mockData: any = {};

        if (MOCK_SCENARIO === 'CENARIO_1') {
          // Cenário 1: Nunca ativou e ainda está no período de testes (5 dias restantes)
          mockData = {
            id: 101,
            nome: 'Dra. Camila Nogueira',
            email: 'camila.psi@exemplo.com.br',
            is_exempt: false,
            status: 'active',
            subscriptionId: null,
            plano: 'ESSENTIAL',
            planExpiresAt: fiveDaysFromNow,
            cancel_at_period_end: false,
            cpf: '123.456.789-00',
            telefone: '(11) 98765-4321',
          };
        } else if (MOCK_SCENARIO === 'CENARIO_2') {
          // Cenário 2: Nunca ativou e seu período de testes acabou
          mockData = {
            id: 101,
            nome: 'Dra. Camila Nogueira',
            email: 'camila.psi@exemplo.com.br',
            is_exempt: false,
            status: 'inactive',
            subscriptionId: null,
            plano: 'ESSENTIAL',
            planExpiresAt: twoDaysAgo,
            cancel_at_period_end: false,
            cpf: '123.456.789-00',
            telefone: '(11) 98765-4321',
          };
        } else if (MOCK_SCENARIO === 'CENARIO_3') {
          // Cenário 3: Assinatura ativa e pagamento recorrente autorizado
          mockData = {
            id: 101,
            nome: 'Dra. Camila Nogueira',
            email: 'camila.psi@exemplo.com.br',
            is_exempt: false,
            status: 'active',
            subscriptionId: 'sub_asaas_live_8492019',
            plano: 'ESSENTIAL',
            planExpiresAt: twentyDaysFromNow,
            cancel_at_period_end: false,
            cpf: '123.456.789-00',
            telefone: '(11) 98765-4321',
          };
        } else if (MOCK_SCENARIO === 'CENARIO_4') {
          // Cenário 4: Cancelou a renovação automática
          mockData = {
            id: 101,
            nome: 'Dra. Camila Nogueira',
            email: 'camila.psi@exemplo.com.br',
            is_exempt: false,
            status: 'active',
            subscriptionId: 'sub_asaas_live_8492019',
            plano: 'ESSENTIAL',
            planExpiresAt: fiveDaysFromNow,
            cancel_at_period_end: true,
            cancelAtPeriodEnd: true,
            cpf: '123.456.789-00',
            telefone: '(11) 98765-4321',
          };
        }

        setPsiData(mockData);
        if (mockData.cpf) setPixCpfInput(maskCpfCnpj(mockData.cpf));
        setCardData(prev => ({
          ...prev,
          holderName: mockData.nome || prev.holderName || '',
          holderCpf: mockData.cpf ? maskCpfCnpj(mockData.cpf) : (prev.holderCpf || ''),
          holderPhone: mockData.telefone || prev.holderPhone || '',
          postalCode: '01310-100',
          addressNumber: '1000'
        }));
        setIsLoading(false);
        return;
      }

      const res = await api.get('/api/psychologists/me');
      if (res.data) {
        setPsiData(res.data);
        if ((res.data.cpf || res.data.cnpj) && !pixCpfInput) setPixCpfInput(maskCpfCnpj(res.data.cpf || res.data.cnpj));
        setCardData(prev => ({
          ...prev,
          holderName: prev.holderName || res.data.nome || '',
          holderCpf: prev.holderCpf || maskCpfCnpj(res.data.cpf || res.data.cnpj || ''),
          holderPhone: prev.holderPhone || res.data.telefone || '',
          postalCode: prev.postalCode || res.data.cep || '',
          addressNumber: prev.addressNumber || res.data.numero || ''
        }));

        // Busca fatura pendente (#alert-pix-pending igual à versão Web)
        if (res.data.subscriptionId || res.data.stripeSubscriptionId) {
          try {
            const pendRes = await api.get('/api/payments/pending-pix');
            if (pendRes.data?.pending && pendRes.data?.dueDate) {
              const due = new Date(pendRes.data.dueDate);
              due.setHours(0, 0, 0, 0);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              if (diffDays <= 5) {
                setPendingInvoice({ ...pendRes.data, diffDays });
              } else {
                setPendingInvoice(null);
              }
            } else {
              setPendingInvoice(null);
            }
          } catch (_err) {
            setPendingInvoice(null);
          }
        }
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

  // Máscaras de Formatação (CPF até 11 dígitos, transição dinâmica automática para CNPJ até 14 dígitos)
  const maskCpfCnpj = (v: string) => {
    const digits = (v || '').replace(/\D/g, '').slice(0, 14);
    if (digits.length <= 11) {
      if (digits.length <= 3) return digits;
      if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
      if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    }
    // CNPJ: 00.000.000/0000-00
    if (digits.length <= 12) {
      return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
    }
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
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
      setToastMessage("Acesse www.yelopsi.com.br pelo navegador para gerenciar seu plano.");
      setToastType('info');
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  // Se iOS: abre o modal de escolha (Web R$99 ou iOS R$129,90)
  // Se Android ou outro: abre direto o checkout nativo no app a R$99!
  const handleAssinarEssencial = () => {
    addDebugLog('Abrindo fluxo de assinatura...');
    setIsUpdatePaymentMethodMode(false);
    setModalError(null);
    if (!pixCpfInput && (psiData?.cpf || psiData?.cnpj)) {
      setPixCpfInput(maskCpfCnpj(psiData.cpf || psiData.cnpj));
    }
    if (Platform.OS === 'ios') {
      addDebugLog('Plataforma iOS detectada: Abrindo escolha de taxa');
      setActiveModal('IOS_FEE_CHOICE');
    } else {
      addDebugLog('Plataforma Android: Indo direto para checkout R$99');
      setIsIosCheckout(false);
      setCheckoutPrice('99,00');
      setPixData(null);
      setPaymentMethod('PIX');
      setActiveModal('CHECKOUT');
    }
  };

  // Alterar Forma de Pagamento (#btn-alterar-pagamento igual à versão Web)
  const handleAlterarFormaPagamento = () => {
    setIsUpdatePaymentMethodMode(true);
    setModalError(null);
    setPixData(null);
    setPaymentMethod('CREDIT_CARD');
    setIsIosCheckout(false);
    setCheckoutPrice('99,00');
    if (!pixCpfInput && (psiData?.cpf || psiData?.cnpj)) {
      setPixCpfInput(maskCpfCnpj(psiData.cpf || psiData.cnpj));
    }
    setActiveModal('CHECKOUT');
  };

  // Pagar Fatura Pendente via PIX (#btn-pay-pending-pix igual à versão Web)
  const handlePayPendingInvoice = async () => {
    if (!pendingInvoice) return;
    setModalError(null);

    if (pendingInvoice.billingType === 'PIX' && pendingInvoice.pix) {
      setIsUpdatePaymentMethodMode(false);
      setPaymentMethod('PIX');
      setPixData(pendingInvoice.pix);
      setActiveModal('CHECKOUT');
      return;
    }

    try {
      setIsProcessingCheckout(true);
      const res = await api.post('/api/payments/convert-overdue-to-pix');
      if (res.data?.success && res.data?.pix) {
        setIsUpdatePaymentMethodMode(false);
        setPaymentMethod('PIX');
        setPixData(res.data.pix);
        setActiveModal('CHECKOUT');
        setToastMessage("Fatura convertida para PIX com sucesso!");
        setToastType('success');
      } else {
        setToastMessage(res.data?.error || "Erro ao gerar PIX da fatura.");
        setToastType('error');
        handleAlterarFormaPagamento();
      }
    } catch (_err) {
      setToastMessage("Erro ao converter fatura para PIX.");
      setToastType('error');
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  // Reativar renovação automática (Cenário 4 -> Cenário 3, após confirmação no #modal-reativacao)
  const handleReativarRenovacao = async () => {
    try {
      setIsSubmittingPayment(true);
      if (MOCK_SCENARIO !== 'REAL') {
        await new Promise(r => setTimeout(r, 500));
        setPsiData((prev: any) => ({
          ...prev,
          cancel_at_period_end: false,
          cancelAtPeriodEnd: false,
          status: 'active',
        }));
        setActiveModal('NONE');
        setToastMessage("Assinatura reativada com sucesso! 🚀");
        setToastType('success');
        return;
      }

      const res = await api.post('/api/psychologists/me/reactivate-subscription');
      if (res.data) {
        setActiveModal('NONE');
        setToastMessage("Assinatura reativada com sucesso! 🚀");
        setToastType('success');
        await fetchStatus();
      }
    } catch (err: any) {
      setActiveModal('NONE');
      // Se a assinatura anterior já expirou no Asaas, abre o checkout para assinar novamente
      if (err.response?.status === 400 || err.response?.status === 404) {
        setToastMessage("Assinatura anterior expirou. Realize uma nova assinatura.");
        setToastType('info');
        handleAssinarEssencial();
      } else {
        setToastMessage(err.response?.data?.error || "Não foi possível reativar. Tente novamente.");
        setToastType('error');
      }
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Cancelar renovação automática (Cenário 3 -> Cenário 4, abrindo #modal-sucesso-cancelamento igual à Web)
  const handleConfirmCancelSubscription = async () => {
    try {
      setIsSubmittingPayment(true);
      if (MOCK_SCENARIO !== 'REAL') {
        await new Promise(r => setTimeout(r, 500));
        setPsiData((prev: any) => ({
          ...prev,
          cancel_at_period_end: true,
          cancelAtPeriodEnd: true,
        }));
        setCancelSuccessMsg(
          "Sua assinatura foi cancelada. Você continuará com acesso aos benefícios até o fim do período atual pago."
        );
        setActiveModal('CANCEL_SUCCESS');
        return;
      }

      const res = await api.post('/api/psychologists/me/cancel-subscription');
      setCancelSuccessMsg(res.data?.message || "Sua assinatura foi cancelada. Lamentamos ver você partir.");
      setActiveModal('CANCEL_SUCCESS');
      await fetchStatus();
    } catch (err: any) {
      setActiveModal('NONE');
      setToastMessage(err.response?.data?.error || "Erro ao cancelar renovação. Tente novamente.");
      setToastType('error');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Ações de Checkout Nativo
  const handleGeneratePix = async () => {
    addDebugLog('1. Início de handleGeneratePix');
    setModalError(null);
    const rawDoc = (pixCpfInput || psiData?.cpf || psiData?.cnpj || '').replace(/\D/g, '');
    addDebugLog(`2. Documento informado: ${rawDoc || 'VAZIO'} (${rawDoc.length} dígitos)`);

    if (!rawDoc || (rawDoc.length !== 11 && rawDoc.length !== 14)) {
      addDebugLog(`❌ Validação falhou: Documento com ${rawDoc.length} dígitos`);
      setModalError("Por favor, informe um CPF válido (11 dígitos) ou CNPJ (14 dígitos).");
      return;
    }

    // Dismiss keyboard de forma suave antes de alterar visual para evitar conflito de firstResponder no iOS
    Keyboard.dismiss();

    try {
      addDebugLog('3. Ativando isSubmittingPayment=true...');
      setIsSubmittingPayment(true);

      // MODO SIMULADO / MOCK
      if (MOCK_SCENARIO !== 'REAL') {
        addDebugLog(`4. Executando em modo simulado (${MOCK_SCENARIO})...`);
        if (isUpdatePaymentMethodMode) {
          await new Promise(r => setTimeout(r, 500));
          setActiveModal('NONE');
          setToastMessage("PIX ativado! As próximas faturas serão geradas por PIX.");
          setToastType('success');
          return;
        }
        setPixData({
          encodedImage: MOCK_PIX_BASE64,
          payload: MOCK_PIX_PAYLOAD
        });
        addDebugLog('✅ PIX simulado gerado com sucesso!');
        return;
      }

      // MODO REAL ASAAS
      const endpoint = isUpdatePaymentMethodMode
        ? '/api/payments/update-method'
        : '/api/payments/create-preference';
      addDebugLog(`4. Enviando POST para ${endpoint} (PIX)...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      const payload = isUpdatePaymentMethodMode
        ? {
          billingType: 'PIX',
          creditCard: {
            holderName: psiData?.nome || 'Psicólogo Yelo',
            holderCpf: rawDoc,
            holderPhone: (psiData?.telefone || '').replace(/\D/g, '') || '11987654321'
          }
        }
        : {
          planType: isIosCheckout ? 'ESSENTIAL_IOS' : 'ESSENTIAL',
          billingType: 'PIX',
          isIos: isIosCheckout,
          cupom: cardData.cupom.trim(),
          creditCard: {
            holderName: psiData?.nome || 'Psicólogo Yelo',
            holderCpf: rawDoc,
            holderPhone: (psiData?.telefone || '').replace(/\D/g, '') || '11987654321'
          }
        };

      const res = await api.post(endpoint, payload, { signal: controller.signal });
      clearTimeout(timeoutId);

      addDebugLog(`5. Resposta do backend: HTTP ${res.status}`);

      if (res.data?.pix) {
        setPixData(res.data.pix);
        addDebugLog('✅ PIX Asaas recebido!');
        setToastMessage("QR Code PIX gerado com sucesso!");
        setToastType('success');
      } else if (isUpdatePaymentMethodMode) {
        setActiveModal('NONE');
        setToastMessage("PIX ativado! As próximas faturas serão por PIX.");
        setToastType('success');
        fetchStatus();
      } else if (res.data?.couponSuccess) {
        setActiveModal('NONE');
        addDebugLog('✅ Cupom VIP aplicado!');
        setToastMessage("🎉 Cupom VIP Aplicado! Seu plano foi ativado.");
        setToastType('success');
        fetchStatus();
      } else {
        addDebugLog('ℹ️ Retorno: ' + (res.data?.message || 'solicitado'));
        setToastMessage(res.data?.message || "Assinatura solicitada com sucesso.");
        setToastType('info');
      }
    } catch (err: any) {
      const msg = err.name === 'AbortError'
        ? "Tempo limite esgotado ao aguardar o gateway. Tente novamente."
        : (err.response?.data?.error || err.message || "Erro ao gerar PIX. Verifique seus dados e tente novamente.");
      addDebugLog(`❌ CATCH ERROR: ${msg}`);
      setModalError(msg);
    } finally {
      addDebugLog('6. Finalizando: isSubmittingPayment=false');
      setIsSubmittingPayment(false);
    }
  };

  const handleCopyPix = async () => {
    if (!pixData?.payload) return;
    addDebugLog('Copiando código PIX para a área de transferência...');
    await Clipboard.setStringAsync(pixData.payload);
    setPixCopied(true);
    setToastMessage("Código PIX copiado! Cole no app do seu banco.");
    setToastType('success');
    setTimeout(() => setPixCopied(false), 3000);
  };

  const handleCheckPixPaid = async () => {
    addDebugLog('Consultando gateway Asaas para verificar compensação real do PIX...');
    setModalError(null);
    try {
      setIsSubmittingPayment(true);

      // MODO SIMULADO / MOCK (Bloqueio Fail-Closed igual à produção: não aprova sem compensação real do webhook/Asaas)
      if (MOCK_SCENARIO !== 'REAL') {
        await new Promise(r => setTimeout(r, 800));
        addDebugLog('🔒 Bloqueado (Fail-Closed): Fatura PIX ainda consta como PENDING no gateway.');
        setModalError("Ainda não identificamos a compensação bancária deste PIX no gateway. O plano só é liberado após a confirmação oficial do banco (geralmente leva de 30s a 1min após o pagamento).");
        return;
      }

      // MODO REAL (ZERO TRUST / FAIL-CLOSED)
      // 1. Consulta diretamente no Asaas via backend se ainda existe fatura PENDING ou OVERDUE para esta assinatura
      const pendingRes = await api.get('/api/payments/pending-pix');
      if (pendingRes.data?.pending !== false) {
        addDebugLog('🔒 Aguardando compensação: Fatura PIX ainda consta como PENDING no Asaas.');
        setModalError("Ainda não identificamos a confirmação bancária. O plano só é liberado após o banco compensar o PIX (geralmente leva de 30s a 1min).");
        return;
      }

      // 2. Somente se não houver fatura pendente no Asaas, confirma o status atualizado do psicólogo
      const res = await api.get('/api/psychologists/me');
      if (res.data?.status === 'active' && res.data?.subscriptionId) {
        setPsiData(res.data);
        setActiveModal('NONE');
        setPixData(null);
        addDebugLog('✅ Compensação bancária confirmada pelo Asaas!');
        setToastMessage("🎉 Pagamento Confirmado! Seu Plano Essencial já está ativo.");
        setToastType('success');
      } else {
        addDebugLog('Aguardando processamento do webhook bancário...');
        setModalError("Pagamento em processamento pelo gateway. Aguarde alguns segundos e verifique novamente.");
      }
    } catch (e: any) {
      addDebugLog('Erro ao consultar compensação do PIX no servidor');
      setModalError("Ainda não identificamos a compensação bancária deste PIX. Verifique após concluir o pagamento no seu banco.");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleSubmitCreditCard = async () => {
    addDebugLog('Iniciando processamento com Cartão de Crédito...');
    setModalError(null);
    const rawNumber = cardData.number.replace(/\D/g, '');
    const rawDoc = (cardData.holderCpf || psiData?.cpf || psiData?.cnpj || '').replace(/\D/g, '');
    const rawPhone = (cardData.holderPhone || psiData?.telefone || '').replace(/\D/g, '');
    const rawCep = (cardData.postalCode || psiData?.cep || '').replace(/\D/g, '');

    if (!rawNumber || rawNumber.length < 13) {
      addDebugLog('❌ Validação: Número do cartão inválido');
      setModalError("Por favor, digite o número completo do cartão de crédito.");
      return;
    }
    if (!cardData.holderName.trim()) {
      addDebugLog('❌ Validação: Nome do titular vazio');
      setModalError("Digite o nome completo exatamente como impresso no cartão.");
      return;
    }
    if (!cardData.expiry || !cardData.expiry.includes('/') || cardData.expiry.length < 5) {
      addDebugLog('❌ Validação: Validade inválida');
      setModalError("Informe o mês e ano de validade (formato MM/AA).");
      return;
    }
    if (!cardData.ccv || cardData.ccv.length < 3) {
      addDebugLog('❌ Validação: CVV inválido');
      setModalError("Informe o código de segurança (CVV) do verso do cartão.");
      return;
    }
    if (!rawDoc || (rawDoc.length !== 11 && rawDoc.length !== 14)) {
      addDebugLog(`❌ Validação: Documento inválido (${rawDoc.length} dígitos)`);
      setModalError("Informe um CPF válido (11 dígitos) ou CNPJ (14 dígitos).");
      return;
    }

    Keyboard.dismiss();

    try {
      setIsSubmittingPayment(true);

      // MODO SIMULADO / MOCK
      if (MOCK_SCENARIO !== 'REAL') {
        addDebugLog('Modo mock: Simulando autorização de cartão (600ms)...');
        await new Promise(r => setTimeout(r, 600));
        if (isUpdatePaymentMethodMode) {
          setActiveModal('NONE');
          setToastMessage("Forma de pagamento atualizada com sucesso!");
          setToastType('success');
          return;
        }
        const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        setPsiData((prev: any) => ({
          ...prev,
          status: 'active',
          plano: 'ESSENTIAL',
          subscriptionId: 'sub_mock_card_987654',
          planExpiresAt: thirtyDaysFromNow,
          cancel_at_period_end: false,
        }));
        setActiveModal('NONE');
        addDebugLog('✅ Cartão autorizado com sucesso no modo mock!');
        setToastMessage("🎉 Assinatura ativada com sucesso no Cartão de Crédito!");
        setToastType('success');
        return;
      }

      // MODO REAL
      const endpoint = isUpdatePaymentMethodMode
        ? '/api/payments/update-method'
        : '/api/payments/create-preference';
      addDebugLog(`Disparando requisição real de cartão (${endpoint})...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      const creditCardObj = {
        holderName: cardData.holderName.trim(),
        holderCpf: rawDoc,
        holderPhone: rawPhone || '11987654321',
        postalCode: rawCep || '01310100',
        addressNumber: cardData.addressNumber || psiData?.numero || 'S/N',
        number: rawNumber,
        expiry: cardData.expiry,
        ccv: cardData.ccv.trim()
      };

      const payload = isUpdatePaymentMethodMode
        ? { billingType: 'CREDIT_CARD', creditCard: creditCardObj }
        : {
          planType: isIosCheckout ? 'ESSENTIAL_IOS' : 'ESSENTIAL',
          billingType: 'CREDIT_CARD',
          isIos: isIosCheckout,
          cupom: cardData.cupom.trim(),
          creditCard: creditCardObj
        };

      const res = await api.post(endpoint, payload, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (isUpdatePaymentMethodMode) {
        setActiveModal('NONE');
        setToastMessage("Forma de pagamento atualizada com sucesso!");
        setToastType('success');
        await fetchStatus();
      } else if (res.data?.success || res.data?.subscriptionId) {
        setActiveModal('NONE');
        addDebugLog('✅ Cartão aprovado pelo Asaas!');
        setToastMessage("🎉 Assinatura ativada com sucesso!");
        setToastType('success');
        await fetchStatus();
      } else if (res.data?.couponSuccess) {
        setActiveModal('NONE');
        addDebugLog('✅ Cupom aplicado!');
        setToastMessage("🎉 Cupom Aplicado! Plano ativado com sucesso.");
        setToastType('success');
        await fetchStatus();
      } else {
        addDebugLog('ℹ️ Retorno cartão: ' + (res.data?.message || 'concluído'));
        setToastMessage(res.data?.message || "Operação realizada com sucesso.");
        setToastType('info');
        await fetchStatus();
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Não foi possível processar o cartão. Verifique os dados e tente novamente.";
      addDebugLog(`❌ CATCH ERROR Cartão: ${msg}`);
      setModalError(msg);
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
  const isCancelAtPeriodEnd = !!(psiData?.cancel_at_period_end || psiData?.cancelAtPeriodEnd);
  const hasSubscription = !!(psiData?.subscriptionId || psiData?.stripeSubscriptionId);
  const isActive = (psiData?.status === 'active' || isExempt) && (!isExpired || isExempt);

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <YeloScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>

        {/* HEADER */}
        <View className="mx-4 mt-4 mb-4 bg-white py-5 px-4 rounded-[22px] items-center shadow-sm border border-[#f0f0f0]">
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

        {/* INDICADOR DE CENÁRIO MOCKADO (quando ativo) */}
        {MOCK_SCENARIO !== 'REAL' && (
          <View className="mx-4 mb-4 bg-[#fef3c7] border border-[#fde68a] px-3.5 py-2.5 rounded-[16px] flex-row items-center justify-between shadow-sm">
            <View className="flex-row items-center gap-2 flex-1 mr-2">
              <Text className="text-[15px]">🧪</Text>
              <Text className="font-sans font-bold text-[#92400e] text-[12px] flex-1">
                {MOCK_SCENARIO === 'CENARIO_1' && "Cenário 1: Período de Testes em Andamento (5 dias restantes)"}
                {MOCK_SCENARIO === 'CENARIO_2' && "Cenário 2: Período de Testes Expirado (Nunca ativou)"}
                {MOCK_SCENARIO === 'CENARIO_3' && "Cenário 3: Assinatura Ativa & Recorrente"}
                {MOCK_SCENARIO === 'CENARIO_4' && "Cenário 4: Renovação Automática Cancelada"}
              </Text>
            </View>
            <View className="bg-[#f59e0b] px-2 py-0.5 rounded-full">
              <Text className="font-sans font-bold text-white text-[10px]">MOCK</Text>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* RESUMO DO PLANO ATUAL (#card-resumo-assinatura da versão Web) OU BANNER   */}
        {/* ========================================================================= */}
        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          {hasSubscription || isExempt ? (
            <View
              style={{
                backgroundColor: '#ffffff',
                borderWidth: 2,
                borderColor: '#1B4332',
                borderRadius: 24,
                padding: 20,
                shadowColor: '#1B4332',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.08,
                shadowRadius: 16,
                elevation: 3,
              }}
            >
              {/* Linha 1: Nome do Plano + Badge de Status (.status-badge) */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
                <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 21 }}>
                  Plano Essencial
                </Text>

                {isExempt ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: '#e6fffa',
                      borderWidth: 1,
                      borderColor: '#1B4332',
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                      borderRadius: 999,
                    }}
                  >
                    <Text style={{ fontSize: 12 }}>💎</Text>
                    <Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 12 }}>
                      VIP Ativo
                    </Text>
                  </View>
                ) : isCancelAtPeriodEnd ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: '#fffbeb',
                      borderWidth: 1,
                      borderColor: '#fcd34d',
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                      borderRadius: 999,
                    }}
                  >
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#f59e0b' }} />
                    <Text style={{ fontFamily: 'Inter_700Bold', color: '#b45309', fontSize: 12 }}>
                      Cancelamento Agendado
                    </Text>
                  </View>
                ) : !isActive ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: '#fef2f2',
                      borderWidth: 1,
                      borderColor: '#fecaca',
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                      borderRadius: 999,
                    }}
                  >
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' }} />
                    <Text style={{ fontFamily: 'Inter_700Bold', color: '#991b1b', fontSize: 12 }}>
                      Inativo / Pendente
                    </Text>
                  </View>
                ) : (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: '#dcfce7',
                      borderWidth: 1,
                      borderColor: '#bbf7d0',
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                      borderRadius: 999,
                    }}
                  >
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#16a34a' }} />
                    <Text style={{ fontFamily: 'Inter_700Bold', color: '#166534', fontSize: 12 }}>
                      Ativo
                    </Text>
                  </View>
                )}
              </View>

              {/* Linha 2: Data de Renovação / Vencimento (#banner-renovacao) */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                <Feather name="calendar" size={14} color="#64748b" />
                <Text style={{ fontFamily: 'Inter_500Medium', color: '#475569', fontSize: 13.5 }}>
                  {isExempt
                    ? 'Status: Isento (Acesso Vitalício)'
                    : !isActive
                      ? `Inativo desde: ${expiresAt?.toLocaleDateString('pt-BR') || '--/--/----'}`
                      : isCancelAtPeriodEnd
                        ? `Acesso até: ${expiresAt?.toLocaleDateString('pt-BR') || '--/--/----'} (${daysRemaining} ${daysRemaining === 1 ? 'dia restante' : 'dias restantes'})`
                        : `Renova em: ${expiresAt?.toLocaleDateString('pt-BR') || '--/--/----'} (${daysRemaining} ${daysRemaining === 1 ? 'dia restante' : 'dias restantes'})`}
                </Text>
              </View>

              {/* Linha 3: Preço Mensal (#banner-preco) + Botão Alterar Forma de Pagamento (#btn-alterar-pagamento) */}
              <View
                style={{
                  borderTopWidth: 1,
                  borderColor: '#f1f5f9',
                  paddingTop: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <View>
                  <Text style={{ fontFamily: 'Inter_500Medium', color: '#64748b', fontSize: 11.5, marginBottom: 2 }}>
                    Valor da mensalidade
                  </Text>
                  <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 22 }}>
                    {isExempt ? 'R$ 0,00 (Isento)' : 'R$ 99,00'}
                    {!isExempt && (
                      <Text style={{ fontFamily: 'Inter_500Medium', color: '#64748b', fontSize: 13 }}> / mês</Text>
                    )}
                  </Text>
                </View>

                {!isExempt && hasSubscription && (
                  <TouchableOpacity
                    onPress={handleAlterarFormaPagamento}
                    disabled={isProcessingCheckout}
                    activeOpacity={0.8}
                    style={{
                      backgroundColor: '#f8fafc',
                      borderWidth: 1,
                      borderColor: '#cbd5e1',
                      paddingHorizontal: 14,
                      paddingVertical: 9,
                      borderRadius: 999,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#334155', fontSize: 12.5 }}>
                      Alterar Forma de Pagamento ⚙️
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Alerta de Fatura PIX / Cartão em Aberto (#alert-pix-pending da versão Web) */}
              {pendingInvoice?.pending && (
                <View
                  style={{
                    marginTop: 14,
                    backgroundColor: '#fffaf5',
                    borderWidth: 1,
                    borderColor: '#fde047',
                    borderLeftWidth: 4,
                    borderLeftColor: '#f59e0b',
                    borderRadius: 14,
                    padding: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', color: '#92400e', fontSize: 13.5, marginBottom: 2 }}>
                      Fatura em Aberto
                    </Text>
                    <Text style={{ fontFamily: 'Inter_500Medium', color: '#b45309', fontSize: 12 }}>
                      {pendingInvoice.diffDays !== undefined && pendingInvoice.diffDays < 0
                        ? `Vencida em ${pendingInvoice.dueDate?.split('-').reverse().join('/')}`
                        : pendingInvoice.diffDays === 0
                          ? 'Vence HOJE!'
                          : `Vence em: ${pendingInvoice.dueDate?.split('-').reverse().join('/')}`}
                      {pendingInvoice.value
                        ? ` • R$ ${Number(pendingInvoice.value).toFixed(2).replace('.', ',')}`
                        : ''}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={handlePayPendingInvoice}
                    disabled={isProcessingCheckout}
                    activeOpacity={0.85}
                    style={{
                      backgroundColor: '#f59e0b',
                      paddingHorizontal: 14,
                      paddingVertical: 9,
                      borderRadius: 999,
                    }}
                  >
                    <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 12 }}>
                      {pendingInvoice.billingType === 'PIX' && pendingInvoice.pix
                        ? 'Ver QR Code PIX'
                        : 'Pagar com PIX'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : !isExpired && daysRemaining > 0 ? (
            <View className="bg-[#f0fdf4] border border-[#bbf7d0] p-4 rounded-[20px] flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full bg-[#16a34a] items-center justify-center">
                <Feather name="gift" size={20} color="white" />
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#166534] text-[16px]">Período de Testes Ativo</Text>
                <Text className="font-sans text-[#15803d] text-[13px]">
                  Você ainda tem <Text className="font-bold">{daysRemaining} {daysRemaining === 1 ? 'dia' : 'dias'}</Text> gratuitos para experimentar a Yelo.
                </Text>
              </View>
            </View>
          ) : (
            <View className="bg-[#fef2f2] border border-[#fecaca] p-4 rounded-[20px] flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full bg-[#ef4444] items-center justify-center">
                <Feather name="alert-triangle" size={20} color="white" />
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#991b1b] text-[16px]">Período de Testes Expirado</Text>
                <Text className="font-sans text-[#b91c1c] text-[13px]">
                  Seu período de teste terminou. Assine o Plano Essencial para voltar a receber pacientes e ativar seu prontuário.
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* CONTAINER DO PLANO ÚNICO DISPONÍVEL NO APP: PLANO ESSENCIAL */}
        <View style={{ paddingHorizontal: 16 }}>

          <View
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 26,
              borderWidth: 2,
              borderColor: '#1B4332',
              padding: 22,
              position: 'relative',
              shadowColor: '#1B4332',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.08,
              shadowRadius: 12,
              elevation: 3,
            }}
          >
            {/* BADGE DESTAQUE OFICIAL */}
            <View
              style={{
                position: 'absolute',
                top: -12,
                right: 18,
                backgroundColor: '#FFEE8C',
                borderWidth: 1,
                borderColor: '#fef08a',
                paddingHorizontal: 12,
                paddingVertical: 3.5,
                borderRadius: 999,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.08,
                shadowRadius: 2,
                elevation: 2,
              }}
            >
              <Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 10.5, letterSpacing: 0.6 }}>
                ⭐ PLANO OFICIAL YELO
              </Text>
            </View>

            {/* SELO DO PLANO ATUAL (.selo-plano-atual da versão Web) */}
            {hasSubscription && (
              <View
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: '#1B4332',
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 6,
                  marginBottom: 8,
                }}
              >
                <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 11 }}>
                  Seu Plano Atual
                </Text>
              </View>
            )}

            {/* CABEÇALHO DO CARD (TÍTULO E PREÇO) */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginTop: 4 }}>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 23 }}>
                Plano Essencial
              </Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 25 }}>
                  R$ 99<Text style={{ fontFamily: 'Inter_500Medium', color: '#64748b', fontSize: 13.5 }}>/mês</Text>
                </Text>
              </View>
            </View>

            {/* DESCRIÇÃO DO PLANO - ALTA LEGIBILIDADE MOBILE */}
            <Text style={{ fontFamily: 'Inter_400Regular', color: '#475569', fontSize: 13.5, lineHeight: 20, marginBottom: 18 }}>
              Acesso irrestrito a todas as ferramentas clínicas e gestão inteligente de pacientes.
            </Text>

            {/* LISTA DE BENEFÍCIOS REFINADA */}
            <View style={{ borderTopWidth: 1, borderColor: '#f1f5f9', paddingTop: 16, marginBottom: 22, gap: 13 }}>
              {[
                'Visibilidade prioritária no algoritmo de busca e Match Clínico',
                'Prontuário eletrônico seguro e evolução de pacientes',
                'Controle financeiro clínico completo',
                'Métricas de mercado, demanda e inteligência clínica',
                'Acesso irrestrito a debates no Fórum da Comunidade',
                'Leitura e publicação de artigos autorais no Blog Yelo',
              ].map((benefit, idx) => (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 11 }}>
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: '#dcfce7',
                      borderWidth: 1,
                      borderColor: '#bbf7d0',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: 1,
                    }}
                  >
                    <Feather name="check" size={13} color="#15803d" />
                  </View>
                  <Text style={{ fontFamily: 'Inter_500Medium', color: '#334155', fontSize: 13.5, lineHeight: 20, flex: 1 }}>
                    {benefit}
                  </Text>
                </View>
              ))}
            </View>

            {/* BOTÃO DO CARD (IGUAL À VERSÃO WEB: 'Seu Plano Atual' desabilitado no Cenário 3, 'Reativar Assinatura ↺' no Cenário 4) */}
            {hasSubscription && isActive && !isCancelAtPeriodEnd ? (
              <View
                style={{
                  backgroundColor: '#e2e8f0',
                  width: '100%',
                  paddingVertical: 15,
                  borderRadius: 999,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <Feather name="check-circle" size={16} color="#64748b" />
                <Text style={{ fontFamily: 'Inter_700Bold', color: '#64748b', fontSize: 15 }}>
                  Seu Plano Atual
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={isCancelAtPeriodEnd ? () => setActiveModal('REACTIVATE_CONFIRM') : handleAssinarEssencial}
                disabled={isProcessingCheckout}
                style={{
                  backgroundColor: isCancelAtPeriodEnd ? '#F59E0B' : '#1B4332',
                  width: '100%',
                  paddingVertical: 16,
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: isCancelAtPeriodEnd ? '#F59E0B' : '#1B4332',
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.25,
                  shadowRadius: 8,
                  elevation: 4,
                  marginBottom: 12,
                }}
                activeOpacity={0.85}
              >
                {isProcessingCheckout ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 15.5 }}>
                    {isCancelAtPeriodEnd
                      ? "Reativar Assinatura ↺"
                      : !isExpired && daysRemaining > 0
                        ? "Assinar Plano Essencial"
                        : "Reativar Plano Essencial"}
                  </Text>
                )}
              </TouchableOpacity>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 2 }}>
              <Feather name="lock" size={13} color="#64748b" />
              <Text style={{ fontFamily: 'Inter_500Medium', color: '#64748b', fontSize: 12 }}>
                Pagamento seguro e criptografado
              </Text>
            </View>
          </View>

          {/* ÁREA DE CANCELAMENTO DE RENOVAÇÃO AUTOMÁTICA (#area-cancelamento da versão Web) */}
          {hasSubscription && isActive && !isCancelAtPeriodEnd && !isExempt && (
            <View
              style={{
                marginTop: 18,
                backgroundColor: '#fffaf5',
                borderWidth: 1,
                borderColor: '#fecaca',
                borderRadius: 20,
                padding: 18,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontFamily: 'Inter_500Medium', color: '#991b1b', fontSize: 12.5, textAlign: 'center', lineHeight: 18, marginBottom: 10 }}>
                Se você cancelar, seu perfil deixará de aparecer nas buscas após o fim do período atual pago ({expiresAt?.toLocaleDateString('pt-BR')}).
              </Text>
              <TouchableOpacity
                onPress={() => setActiveModal('CANCEL_CONFIRM')}
                activeOpacity={0.75}
                style={{ paddingVertical: 4, paddingHorizontal: 8 }}
              >
                <Text style={{ fontFamily: 'Inter_700Bold', color: '#dc2626', fontSize: 13.5, textDecorationLine: 'underline' }}>
                  Cancelar renovação automática
                </Text>
              </TouchableOpacity>
            </View>
          )}

        </View>

      </YeloScrollView>

      {/* ========================================================================= */}
      {/* MODAL BOTTOM SHEET CENTRALIZADO E UNIFICADO (1 ÚNICO MODAL NATIVO)        */}
      {/* ========================================================================= */}
      <Modal
        visible={activeModal !== 'NONE'}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          Keyboard.dismiss();
          if (!isSubmittingPayment) {
            setModalError(null);
            setActiveModal('NONE');
          }
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>

          {/* Backdrop Touch: fecha modal ao clicar fora (sem sobrepor o sheet) */}
          <TouchableOpacity
            activeOpacity={1}
            style={{ flex: 1 }}
            onPress={() => {
              Keyboard.dismiss();
              if (!isSubmittingPayment) {
                setModalError(null);
                setActiveModal('NONE');
              }
            }}
          />

          {/* CARD BOTTOM SHEET COM ALTURA AMPLA E RESPONSIVA (SEM CONFLITO DE LAYOUT DO KEYBOARDAVOIDINGVIEW) */}
          <View
            style={{
              backgroundColor: '#ffffff',
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              height: activeModal === 'CHECKOUT' ? Math.min(screenHeight * 0.94, 820) : undefined,
              maxHeight: '96%',
              width: '100%',
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.15,
              shadowRadius: 16,
              elevation: 25,
              zIndex: 99,
            }}
          >
            {/* Barra de Arraste (Bottom Sheet Handle) */}
            <View style={{ width: 44, height: 5, backgroundColor: '#cbd5e1', borderRadius: 999, alignSelf: 'center', marginTop: 12, marginBottom: 8 }} />

            {/* ========================================================= */}
            {/* CASO 0A: CONFIRMAÇÃO DE CANCELAMENTO (#modal-cancelamento) */}
            {/* ========================================================= */}
            {activeModal === 'CANCEL_CONFIRM' && (
              <View key="modal-cancel-confirm" style={{ paddingHorizontal: 24, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 24) + 16, alignItems: 'center' }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Feather name="alert-triangle" size={28} color="#dc2626" />
                </View>

                <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 22, textAlign: 'center', marginBottom: 8 }}>
                  Tem certeza?
                </Text>

                <Text style={{ fontFamily: 'Inter_400Regular', color: '#475569', fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 24 }}>
                  Você continuará com acesso aos benefícios até o fim do período pago ({expiresAt?.toLocaleDateString('pt-BR')}), mas sua assinatura não será renovada no próximo mês.
                </Text>

                <TouchableOpacity
                  onPress={() => setActiveModal('NONE')}
                  disabled={isSubmittingPayment}
                  activeOpacity={0.85}
                  style={{
                    backgroundColor: '#f1f5f9',
                    width: '100%',
                    paddingVertical: 15,
                    borderRadius: 999,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 12,
                  }}
                >
                  <Text style={{ fontFamily: 'Inter_700Bold', color: '#334155', fontSize: 15 }}>
                    Não, manter meu plano
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleConfirmCancelSubscription}
                  disabled={isSubmittingPayment}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: '#ffffff',
                    borderWidth: 2,
                    borderColor: '#ffebee',
                    width: '100%',
                    paddingVertical: 14,
                    borderRadius: 999,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isSubmittingPayment ? (
                    <ActivityIndicator color="#e63946" size="small" />
                  ) : (
                    <Text style={{ fontFamily: 'Inter_700Bold', color: '#e63946', fontSize: 14.5 }}>
                      Sim, quero cancelar
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* ========================================================= */}
            {/* CASO 0B: SUCESSO DO CANCELAMENTO (#modal-sucesso-cancelamento) */}
            {/* ========================================================= */}
            {activeModal === 'CANCEL_SUCCESS' && (
              <View key="modal-cancel-success" style={{ paddingHorizontal: 24, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 24) + 16, alignItems: 'center' }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Feather name="check-circle" size={28} color="#16a34a" />
                </View>

                <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 22, textAlign: 'center', marginBottom: 8 }}>
                  Tudo Certo!
                </Text>

                <Text style={{ fontFamily: 'Inter_400Regular', color: '#475569', fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 24 }}>
                  {cancelSuccessMsg}
                </Text>

                <TouchableOpacity
                  onPress={() => setActiveModal('NONE')}
                  activeOpacity={0.85}
                  style={{
                    backgroundColor: '#1B4332',
                    width: '100%',
                    paddingVertical: 15,
                    borderRadius: 999,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 15 }}>
                    Entendido
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ========================================================= */}
            {/* CASO 0C: CONFIRMAÇÃO DE REATIVAÇÃO (#modal-reativacao)     */}
            {/* ========================================================= */}
            {activeModal === 'REACTIVATE_CONFIRM' && (
              <View key="modal-reactivate-confirm" style={{ paddingHorizontal: 24, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 24) + 16, alignItems: 'center' }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#e8f5e9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Text style={{ fontSize: 26 }}>🚀</Text>
                </View>

                <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 22, textAlign: 'center', marginBottom: 8 }}>
                  Vamos continuar juntos?
                </Text>

                <Text style={{ fontFamily: 'Inter_400Regular', color: '#475569', fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 24 }}>
                  Ao reativar, você mantém seus benefícios e sua assinatura renovará normalmente na data prevista ({expiresAt?.toLocaleDateString('pt-BR')}).{' '}
                  <Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332' }}>
                    Nenhuma cobrança extra será feita hoje.
                  </Text>
                </Text>

                <TouchableOpacity
                  onPress={handleReativarRenovacao}
                  disabled={isSubmittingPayment}
                  activeOpacity={0.85}
                  style={{
                    backgroundColor: '#1B4332',
                    width: '100%',
                    paddingVertical: 15,
                    borderRadius: 999,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 12,
                  }}
                >
                  {isSubmittingPayment ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 15 }}>
                      Sim, Reativar
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setActiveModal('NONE')}
                  disabled={isSubmittingPayment}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: '#f1f5f9',
                    width: '100%',
                    paddingVertical: 14,
                    borderRadius: 999,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontFamily: 'Inter_700Bold', color: '#475569', fontSize: 14.5 }}>
                    Pensar melhor
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ========================================================= */}
            {/* CASO 1: ESCOLHA DE TAXA IOS (TRANSPARÊNCIA) */}
            {/* ========================================================= */}
            {activeModal === 'IOS_FEE_CHOICE' && (
              <View key="modal-ios-fee-choice" style={{ paddingHorizontal: 22, paddingTop: 4, paddingBottom: Math.max(insets.bottom, 24) + 16 }}>
                {/* Cabeçalho com Estética Yelo */}
                <View style={{ alignItems: 'center', marginBottom: 20, marginTop: 8 }}>
                  <View style={{ alignSelf: 'center', backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 12 }}>🍎</Text>
                    <Text style={{ fontFamily: 'Inter_700Bold', color: '#166534', fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' }}>Transparência Yelo</Text>
                  </View>
                  <Text style={{ fontFamily: 'NewKansas-Bold', color: '#1B4332', fontSize: 22, textAlign: 'center', marginBottom: 4 }}>
                    Como você prefere assinar?
                  </Text>
                  <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 13, textAlign: 'center', lineHeight: 18, paddingHorizontal: 8 }}>
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
                  style={{ backgroundColor: '#f0fdf4', borderWidth: 2, borderColor: '#1B4332', borderRadius: 22, padding: 16, marginBottom: 14, position: 'relative' }}
                >
                  {/* Tag Flutuante Yelo */}
                  <View style={{ position: 'absolute', top: -12, left: 16, backgroundColor: '#FFEE8C', borderWidth: 1, borderColor: '#fef08a', paddingHorizontal: 12, paddingVertical: 2, borderRadius: 999 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 10, letterSpacing: 0.4 }}>
                      ⭐ RECOMENDADO • VALOR OFICIAL
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, marginTop: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#1B4332', alignItems: 'center', justifyContent: 'center' }}>
                        <Feather name="globe" size={16} color="white" />
                      </View>
                      <Text style={{ fontFamily: 'NewKansas-Bold', color: '#1B4332', fontSize: 16 }}>Pelo Navegador Web</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontFamily: 'NewKansas-Bold', color: '#1B4332', fontSize: 20 }}>
                        R$ 99<Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: '#475569' }}>/mês</Text>
                      </Text>
                    </View>
                  </View>

                  <Text style={{ fontFamily: 'Inter_400Regular', color: '#334155', fontSize: 12.5, lineHeight: 18, marginBottom: 12 }}>
                    Assine diretamente no portal seguro da Yelo sem nenhuma taxa da Apple. Pagamento via PIX ou Cartão de Crédito.
                  </Text>

                  <View style={{ backgroundColor: '#1B4332', paddingVertical: 12, borderRadius: 50, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                    {isProcessingCheckout ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <>
                        <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 13.5 }}>
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
                    addDebugLog('Selecionado: Checkout pelo iOS (R$ 129,90)');
                    setIsIosCheckout(true);
                    setCheckoutPrice('129,90');
                    setPixData(null);
                    setPaymentMethod('PIX');
                    if (!pixCpfInput && (psiData?.cpf || psiData?.cnpj)) {
                      setPixCpfInput(maskCpfCnpj(psiData.cpf || psiData.cnpj));
                    }
                    setModalError(null);
                    setActiveModal('CHECKOUT');
                  }}
                  disabled={isProcessingCheckout}
                  style={{ backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 22, padding: 16, marginBottom: 16 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}>
                        <Feather name="smartphone" size={16} color="#475569" />
                      </View>
                      <Text style={{ fontFamily: 'NewKansas-Bold', color: '#334155', fontSize: 15 }}>Direto pelo App (iOS)</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontFamily: 'NewKansas-Bold', color: '#475569', fontSize: 18 }}>
                        R$ 129,90<Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: '#64748b' }}>/mês</Text>
                      </Text>
                    </View>
                  </View>

                  <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 12, lineHeight: 17, marginBottom: 10 }}>
                    Inclui a taxa de 30% cobrada pela Apple App Store para processamento de assinaturas dentro do iOS.
                  </Text>

                  <View style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', paddingVertical: 10, borderRadius: 50, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                    <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#475569', fontSize: 13 }}>
                      Continuar pelo iOS (R$ 129,90/mês)
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* BOTÃO CANCELAR / FECHAR */}
                <TouchableOpacity
                  onPress={() => setActiveModal('NONE')}
                  style={{ paddingVertical: 10, alignItems: 'center' }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#94a3b8', fontSize: 13 }}>
                    Voltar para os Planos
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ========================================================= */}
            {/* CASO 2: CHECKOUT NATIVO NO APP (PIX OU CARTÃO) */}
            {/* ========================================================= */}
            {activeModal === 'CHECKOUT' && (
              <View key="modal-checkout" style={{ flex: 1 }}>

                {/* CABEÇALHO FIXO DO CHECKOUT */}
                <View style={{ paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#f1f5f9', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ffffff' }}>
                  <TouchableOpacity
                    onPress={() => {
                      Keyboard.dismiss();
                      if (!isSubmittingPayment) {
                        setModalError(null);
                        setActiveModal('NONE');
                      }
                    }}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}
                    activeOpacity={0.7}
                  >
                    <Feather name="x" size={18} color="#334155" />
                  </TouchableOpacity>

                  <View style={{ alignItems: 'center', flex: 1, marginHorizontal: 8 }}>
                    <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 18 }}>
                      {isUpdatePaymentMethodMode ? 'Alterar Forma de Pagamento' : 'Finalizar Assinatura'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <View style={{ backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 999 }}>
                        <Text style={{ fontFamily: 'Inter_700Bold', color: '#166534', fontSize: 11 }}>
                          Plano Essencial • R$ {checkoutPrice}/mês
                        </Text>
                      </View>
                      {isIosCheckout && (
                        <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                          <Text style={{ fontFamily: 'Inter_500Medium', color: '#475569', fontSize: 10 }}>App iOS</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => {
                      Keyboard.dismiss();
                      if (!isSubmittingPayment) {
                        setModalError(null);
                        setActiveModal('NONE');
                      }
                    }}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    style={{ paddingVertical: 4, paddingHorizontal: 8 }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#64748b', fontSize: 13 }}>Fechar</Text>
                  </TouchableOpacity>
                </View>

                {/* ABAS SELETORAS FIXAS (PIX vs CARTÃO DE CRÉDITO) COM REGISTRO INSTANTÂNEO DE TOQUE */}
                <View style={{ paddingHorizontal: 22, paddingTop: 10, paddingBottom: 8, backgroundColor: '#ffffff' }}>
                  <View style={{ flexDirection: 'row', backgroundColor: '#f1f5f9', padding: 4, borderRadius: 999, borderWidth: 1, borderColor: '#e2e8f0' }}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPressIn={() => {
                        addDebugLog('👉 Toque na aba: PIX Instantâneo');
                        setPaymentMethod('PIX');
                        setModalError(null);
                      }}
                      onPress={() => {
                        addDebugLog('✓ Confirmada aba: PIX Instantâneo');
                        setPaymentMethod('PIX');
                        setModalError(null);
                      }}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 999,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        backgroundColor: paymentMethod === 'PIX' ? '#1B4332' : 'transparent',
                        shadowColor: paymentMethod === 'PIX' ? '#000' : 'transparent',
                        shadowOpacity: paymentMethod === 'PIX' ? 0.1 : 0,
                        shadowRadius: 4,
                        elevation: paymentMethod === 'PIX' ? 2 : 0,
                      }}
                    >
                      <View pointerEvents="none" style={{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: paymentMethod === 'PIX' ? 'rgba(255,255,255,0.2)' : '#cbd5e1' }}>
                        <Feather name="zap" size={12} color={paymentMethod === 'PIX' ? '#FFEE8C' : '#64748b'} />
                      </View>
                      <Text pointerEvents="none" style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: paymentMethod === 'PIX' ? '#ffffff' : '#64748b' }}>
                        PIX Instantâneo
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPressIn={() => {
                        addDebugLog('👉 Toque na aba: Cartão de Crédito');
                        setPaymentMethod('CREDIT_CARD');
                        setModalError(null);
                      }}
                      onPress={() => {
                        addDebugLog('✓ Confirmada aba: Cartão de Crédito');
                        setPaymentMethod('CREDIT_CARD');
                        setModalError(null);
                      }}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 999,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        backgroundColor: paymentMethod === 'CREDIT_CARD' ? '#1B4332' : 'transparent',
                        shadowColor: paymentMethod === 'CREDIT_CARD' ? '#000' : 'transparent',
                        shadowOpacity: paymentMethod === 'CREDIT_CARD' ? 0.1 : 0,
                        shadowRadius: 4,
                        elevation: paymentMethod === 'CREDIT_CARD' ? 2 : 0,
                      }}
                    >
                      <View pointerEvents="none" style={{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: paymentMethod === 'CREDIT_CARD' ? 'rgba(255,255,255,0.2)' : '#cbd5e1' }}>
                        <Feather name="credit-card" size={12} color={paymentMethod === 'CREDIT_CARD' ? '#FFEE8C' : '#64748b'} />
                      </View>
                      <Text pointerEvents="none" style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: paymentMethod === 'CREDIT_CARD' ? '#ffffff' : '#64748b' }}>
                        Cartão de Crédito
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* BANNER DE ERRO DENTRO DO MODAL (EVITA ALERT NATIVO QUE CRASHA O IOS) */}
                {modalError && (
                  <View style={{ marginHorizontal: 22, marginBottom: 8, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Feather name="alert-circle" size={16} color="#dc2626" />
                    <Text style={{ fontFamily: 'Inter_500Medium', color: '#b91c1c', fontSize: 12.5, flex: 1 }}>{modalError}</Text>
                  </View>
                )}

                {/* BARRA RÁPIDA DE FECHAR TECLADO */}
                {isKeyboardVisible && (
                  <View style={{ paddingHorizontal: 22, paddingVertical: 6, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderColor: '#f1f5f9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: '#64748b' }}>Preenchendo formulário</Text>
                    <TouchableOpacity
                      onPress={() => Keyboard.dismiss()}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontFamily: 'Inter_700Bold', color: '#334155', fontSize: 11.5 }}>Ocultar Teclado</Text>
                      <Feather name="chevron-down" size={13} color="#334155" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* CONTEÚDO ROLÁVEL DO CHECKOUT COM ROLAGEM LIVRE SEM FECHAR TECLADO */}
                <ScrollView
                  ref={modalScrollRef}
                  style={{ flex: 1 }}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="always"
                  keyboardDismissMode="none"
                  contentContainerStyle={{
                    paddingHorizontal: 22,
                    paddingTop: 12,
                    paddingBottom: isKeyboardVisible ? 320 : (Math.max(insets.bottom, 20) + 24)
                  }}
                >

                  {/* ABA 1: PIX */}
                  {paymentMethod === 'PIX' && (
                    <View key="checkout-tab-pix">
                      {!pixData ? (
                        <View key="pix-step-form">
                          <View style={{ backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', padding: 16, borderRadius: 22, marginBottom: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                              <Feather name="zap" size={16} color="#166534" />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontFamily: 'Inter_700Bold', color: '#166534', fontSize: 13, marginBottom: 2 }}>
                                Ativação Imediata via PIX
                              </Text>
                              <Text style={{ fontFamily: 'Inter_400Regular', color: '#15803d', fontSize: 12, lineHeight: 19 }}>
                                Ao gerar a cobrança, você receberá o QR Code e o código Pix Copia e Cola para pagar no app do seu banco.
                              </Text>
                            </View>
                          </View>

                          {/* CPF ou CNPJ para emissão da fatura PIX */}
                          <View style={{ marginBottom: 14 }}>
                            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#475569', marginBottom: 6, marginLeft: 8 }}>
                              CPF ou CNPJ do Titular *
                            </Text>
                            <TextInput
                              value={pixCpfInput}
                              onChangeText={(t) => {
                                setModalError(null);
                                setPixCpfInput(maskCpfCnpj(t));
                              }}
                              placeholder="000.000.000-00 ou 00.000.000/0000-00"
                              placeholderTextColor="#94a3b8"
                              keyboardType="numeric"
                              maxLength={18}
                              returnKeyType="done"
                              onSubmitEditing={Keyboard.dismiss}
                              style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 14, color: '#1e293b', fontFamily: 'Inter_400Regular', fontSize: 14 }}
                            />
                          </View>

                          {/* Cupom opcional (oculto no modo Alterar Forma de Pagamento igual à Web) */}
                          {!isUpdatePaymentMethodMode && (
                            <View style={{ marginBottom: 20 }}>
                              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#475569', marginBottom: 6, marginLeft: 8 }}>
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
                                style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 14, color: '#1e293b', fontFamily: 'Inter_400Regular', fontSize: 14 }}
                              />
                            </View>
                          )}

                          {/* Botão Gerar PIX com Acionamento Confiável */}
                          <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => {
                              addDebugLog('👉 Toque no botão Gerar PIX');
                              handleGeneratePix();
                            }}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            disabled={isSubmittingPayment}
                            style={{ backgroundColor: '#1B4332', width: '100%', paddingVertical: 16, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 4, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 3 }}
                          >
                            <View pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              {isSubmittingPayment ? (
                                <ActivityIndicator color="white" size="small" />
                              ) : (
                                <>
                                  <Feather name="check-circle" size={17} color="#FFEE8C" />
                                  <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 14.5 }}>
                                    {isUpdatePaymentMethodMode
                                      ? 'Mudar Faturas para PIX'
                                      : `Gerar Código PIX (R$ ${checkoutPrice})`}
                                  </Text>
                                </>
                              )}
                            </View>
                          </TouchableOpacity>

                          {/* Botão Cancelar / Fechar */}
                          <TouchableOpacity
                            onPress={() => {
                              Keyboard.dismiss();
                              setModalError(null);
                              setActiveModal('NONE');
                            }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            style={{ width: '100%', paddingVertical: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}
                            activeOpacity={0.7}
                          >
                            <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#94a3b8', fontSize: 13 }}>
                              Cancelar / Fechar
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View key="pix-step-qrcode" style={{ alignItems: 'center' }}>
                          <View style={{ backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Feather name="check-circle" size={13} color="#059669" />
                            <Text style={{ fontFamily: 'Inter_700Bold', color: '#059669', fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                              PIX Gerado • Validade 15 Minutos
                            </Text>
                          </View>

                          {pixData.encodedImage ? (
                            <View style={{ width: 195, height: 195, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 24, marginBottom: 14, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 }}>
                              <Image
                                source={{ uri: getPixImageUri(pixData.encodedImage) || undefined }}
                                style={{ width: 175, height: 175 }}
                                resizeMode="contain"
                                onError={(err) => {
                                  addDebugLog('Erro na imagem QR: ' + (err?.nativeEvent?.error || 'desconhecido'));
                                }}
                              />
                            </View>
                          ) : null}

                          {/* Código Copia e Cola */}
                          <View style={{ width: '100%', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 22, padding: 16, marginBottom: 14 }}>
                            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                              Código Pix Copia e Cola:
                            </Text>
                            <Text numberOfLines={2} style={{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 11, color: '#334155', marginBottom: 12 }}>
                              {pixData.payload}
                            </Text>

                            <TouchableOpacity
                              onPress={handleCopyPix}
                              style={{
                                width: '100%',
                                paddingVertical: 14,
                                borderRadius: 999,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                backgroundColor: pixCopied ? '#16a34a' : '#1B4332'
                              }}
                              activeOpacity={0.85}
                            >
                              <Feather name={pixCopied ? "check" : "copy"} size={16} color="white" />
                              <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 13 }}>
                                {pixCopied ? "Código Copiado! ✓" : "Copiar Código PIX"}
                              </Text>
                            </TouchableOpacity>
                          </View>

                          {/* Instruções */}
                          <View style={{ width: '100%', backgroundColor: '#f1f5f9', padding: 16, borderRadius: 20, marginBottom: 16 }}>
                            <Text style={{ fontFamily: 'Inter_700Bold', color: '#334155', fontSize: 12, marginBottom: 6 }}>
                              Como pagar:
                            </Text>
                            <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 11.5, lineHeight: 18 }}>
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
                            style={{ backgroundColor: '#1B4332', width: '100%', paddingVertical: 16, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 3 }}
                            activeOpacity={0.85}
                          >
                            {isSubmittingPayment ? (
                              <ActivityIndicator color="white" size="small" />
                            ) : (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Feather name="check" size={17} color="#FFEE8C" />
                                <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 14.5 }}>
                                  Já realizei o pagamento ✓
                                </Text>
                              </View>
                            )}
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => setPixData(null)}
                            style={{ paddingVertical: 10, paddingHorizontal: 20, borderRadius: 999, backgroundColor: '#f1f5f9', alignSelf: 'center', alignItems: 'center', marginTop: 4 }}
                            activeOpacity={0.7}
                          >
                            <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#64748b', fontSize: 12 }}>
                              Gerar outro código PIX
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}

                  {/* ABA 2: CARTÃO DE CRÉDITO */}
                  {paymentMethod === 'CREDIT_CARD' && (
                    <View key="checkout-tab-card">
                      <View style={{ marginBottom: 14 }}>
                        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#475569', marginBottom: 6, marginLeft: 8 }}>
                          Número do Cartão *
                        </Text>
                        <TextInput
                          value={cardData.number}
                          onChangeText={(t) => {
                            setModalError(null);
                            setCardData(prev => ({ ...prev, number: maskCardNumber(t) }));
                          }}
                          placeholder="0000 0000 0000 0000"
                          placeholderTextColor="#94a3b8"
                          keyboardType="numeric"
                          maxLength={19}
                          returnKeyType="done"
                          onSubmitEditing={Keyboard.dismiss}
                          style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 14, color: '#1e293b', fontFamily: 'Inter_400Regular', fontSize: 14 }}
                        />
                      </View>

                      <View style={{ marginBottom: 14 }}>
                        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#475569', marginBottom: 6, marginLeft: 8 }}>
                          Nome Impresso no Cartão *
                        </Text>
                        <TextInput
                          value={cardData.holderName}
                          onChangeText={(t) => {
                            setModalError(null);
                            setCardData(prev => ({ ...prev, holderName: t.toUpperCase() }));
                          }}
                          placeholder="NOME COMO NO CARTÃO"
                          placeholderTextColor="#94a3b8"
                          autoCapitalize="characters"
                          returnKeyType="done"
                          onSubmitEditing={Keyboard.dismiss}
                          style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 14, color: '#1e293b', fontFamily: 'Inter_400Regular', fontSize: 14 }}
                        />
                      </View>

                      {/* Validade e CVV */}
                      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#475569', marginBottom: 6, marginLeft: 8 }}>
                            Validade (MM/AA) *
                          </Text>
                          <TextInput
                            value={cardData.expiry}
                            onChangeText={(t) => {
                              setModalError(null);
                              setCardData(prev => ({ ...prev, expiry: maskExpiry(t) }));
                            }}
                            placeholder="MM/AA"
                            placeholderTextColor="#94a3b8"
                            keyboardType="numeric"
                            maxLength={5}
                            returnKeyType="done"
                            onSubmitEditing={Keyboard.dismiss}
                            style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 14, color: '#1e293b', fontFamily: 'Inter_400Regular', fontSize: 14 }}
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#475569', marginBottom: 6, marginLeft: 8 }}>
                            CVV *
                          </Text>
                          <TextInput
                            value={cardData.ccv}
                            onChangeText={(t) => {
                              setModalError(null);
                              setCardData(prev => ({ ...prev, ccv: t.replace(/\D/g, '').slice(0, 4) }));
                            }}
                            placeholder="123"
                            placeholderTextColor="#94a3b8"
                            keyboardType="numeric"
                            maxLength={4}
                            returnKeyType="done"
                            onSubmitEditing={Keyboard.dismiss}
                            style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 14, color: '#1e293b', fontFamily: 'Inter_400Regular', fontSize: 14 }}
                          />
                        </View>
                      </View>

                      {/* CPF ou CNPJ e Telefone do Titular */}
                      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#475569', marginBottom: 6, marginLeft: 8 }}>
                            CPF ou CNPJ do Titular *
                          </Text>
                          <TextInput
                            value={cardData.holderCpf}
                            onChangeText={(t) => {
                              setModalError(null);
                              setCardData(prev => ({ ...prev, holderCpf: maskCpfCnpj(t) }));
                            }}
                            placeholder="000.000.000-00 ou CNPJ"
                            placeholderTextColor="#94a3b8"
                            keyboardType="numeric"
                            maxLength={18}
                            returnKeyType="done"
                            onSubmitEditing={Keyboard.dismiss}
                            style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 14, color: '#1e293b', fontFamily: 'Inter_400Regular', fontSize: 14 }}
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#475569', marginBottom: 6, marginLeft: 8 }}>
                            Telefone
                          </Text>
                          <TextInput
                            value={cardData.holderPhone}
                            onChangeText={(t) => {
                              setModalError(null);
                              setCardData(prev => ({ ...prev, holderPhone: maskPhone(t) }));
                            }}
                            placeholder="(00) 00000-0000"
                            placeholderTextColor="#94a3b8"
                            keyboardType="numeric"
                            maxLength={15}
                            returnKeyType="done"
                            onSubmitEditing={Keyboard.dismiss}
                            style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 14, color: '#1e293b', fontFamily: 'Inter_400Regular', fontSize: 14 }}
                          />
                        </View>
                      </View>

                      {/* CEP e Número */}
                      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#475569', marginBottom: 6, marginLeft: 8 }}>
                            CEP
                          </Text>
                          <TextInput
                            value={cardData.postalCode}
                            onChangeText={(t) => {
                              setModalError(null);
                              setCardData(prev => ({ ...prev, postalCode: maskCep(t) }));
                            }}
                            placeholder="00000-000"
                            placeholderTextColor="#94a3b8"
                            keyboardType="numeric"
                            maxLength={9}
                            returnKeyType="done"
                            onSubmitEditing={Keyboard.dismiss}
                            style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 14, color: '#1e293b', fontFamily: 'Inter_400Regular', fontSize: 14 }}
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#475569', marginBottom: 6, marginLeft: 8 }}>
                            Número
                          </Text>
                          <TextInput
                            value={cardData.addressNumber}
                            onChangeText={(t) => {
                              setModalError(null);
                              setCardData(prev => ({ ...prev, addressNumber: t }));
                            }}
                            placeholder="Ex: 123"
                            placeholderTextColor="#94a3b8"
                            returnKeyType="done"
                            onSubmitEditing={Keyboard.dismiss}
                            style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 14, color: '#1e293b', fontFamily: 'Inter_400Regular', fontSize: 14 }}
                          />
                        </View>
                      </View>

                      {/* Cupom (oculto no modo Alterar Forma de Pagamento igual à Web) */}
                      {!isUpdatePaymentMethodMode && (
                        <View style={{ marginBottom: 16 }}>
                          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#475569', marginBottom: 6, marginLeft: 8 }}>
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
                            style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 14, color: '#1e293b', fontFamily: 'Inter_400Regular', fontSize: 14 }}
                          />
                        </View>
                      )}

                      <View style={{ backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                        <Feather name="shield" size={13} color="#166534" />
                        <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11.5, color: '#166534' }}>
                          Dados criptografados direto com gateway seguro Asaas
                        </Text>
                      </View>

                      {/* Botão Ativar Assinatura / Salvar Cartão */}
                      <TouchableOpacity
                        onPress={() => {
                          Keyboard.dismiss();
                          handleSubmitCreditCard();
                        }}
                        disabled={isSubmittingPayment}
                        style={{ backgroundColor: '#1B4332', width: '100%', paddingVertical: 16, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 4, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 3 }}
                        activeOpacity={0.85}
                      >
                        {isSubmittingPayment ? (
                          <ActivityIndicator color="white" size="small" />
                        ) : (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Feather name="lock" size={16} color="#FFEE8C" />
                            <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 14.5 }}>
                              {isUpdatePaymentMethodMode
                                ? 'Salvar Novo Cartão'
                                : `Ativar Assinatura (R$ ${checkoutPrice}/mês)`}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>

                      {/* Botão Cancelar / Fechar */}
                      <TouchableOpacity
                        onPress={() => {
                          Keyboard.dismiss();
                          setModalError(null);
                          setActiveModal('NONE');
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={{ width: '100%', paddingVertical: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#94a3b8', fontSize: 13 }}>
                          Cancelar / Fechar
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                </ScrollView>
              </View>
            )}
          </View>
        </View>
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
