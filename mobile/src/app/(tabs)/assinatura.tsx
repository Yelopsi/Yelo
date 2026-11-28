import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import YeloScrollView from '../../components/YeloScrollView';
import YeloToast from '../../components/YeloToast';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';
import { isMobileNewPricingActive } from '../../utils/pricingLaunch';

export default function AssinaturaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [isLoading, setIsLoading] = useState(true);
  const [psiData, setPsiData] = useState<any>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  const [activeModal, setActiveModal] = useState<
    'NONE' | 'CANCEL_CONFIRM' | 'CANCEL_SUCCESS' | 'REACTIVATE_CONFIRM'
  >('NONE');
  const [cancelSuccessMsg, setCancelSuccessMsg] = useState<string>(
    'Sua renovação automática foi cancelada. Você continuará com acesso até o fim do período atual.'
  );

  const [pendingInvoice, setPendingInvoice] = useState<{
    pending: boolean;
    dueDate?: string;
    value?: number;
    billingType?: string;
    diffDays?: number;
  } | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  const fetchStatus = async () => {
    try {
      const res = await api.get('/api/psychologists/me');
      if (res.data) {
        setPsiData(res.data);

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
      console.error('Erro ao carregar dados do plano:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleReativarRenovacao = async () => {
    try {
      setIsSubmittingAction(true);
      const res = await api.post('/api/psychologists/me/reactivate-subscription');
      if (res.data) {
        setActiveModal('NONE');
        setToastMessage('Renovação automática reativada com sucesso.');
        setToastType('success');
        await fetchStatus();
      }
    } catch (err: any) {
      setActiveModal('NONE');
      if (err.response?.status === 400 || err.response?.status === 404) {
        setToastMessage('Sua assinatura anterior foi encerrada e não pode ser reativada por aqui.');
        setToastType('info');
      } else {
        setToastMessage(err.response?.data?.error || 'Não foi possível reativar. Tente novamente.');
        setToastType('error');
      }
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleConfirmCancelSubscription = async () => {
    try {
      setIsSubmittingAction(true);
      const res = await api.post('/api/psychologists/me/cancel-subscription');
      setCancelSuccessMsg(
        res.data?.message || 'Sua renovação automática foi cancelada. Lamentamos ver você partir.'
      );
      setActiveModal('CANCEL_SUCCESS');
      await fetchStatus();
    } catch (err: any) {
      setActiveModal('NONE');
      setToastMessage(err.response?.data?.error || 'Erro ao cancelar renovação. Tente novamente.');
      setToastType('error');
    } finally {
      setIsSubmittingAction(false);
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

  const isExempt =
    psiData?.is_exempt === true ||
    String(psiData?.is_exempt).toLowerCase() === 'true' ||
    psiData?.is_exempt === 1;
  const now = new Date();
  const isNewPricing = isMobileNewPricingActive(psiData);
  const isComunidade = String(psiData?.plano || '') === 'Comunidade';
  const isTokenizedTrial = String(psiData?.subscriptionId || '').startsWith('trial_tok_');
  const subCycleSuffix =
    psiData?.subscriptionCycle === 'SEMIANNUAL'
      ? 'Semestral'
      : psiData?.subscriptionCycle === 'QUARTERLY'
        ? 'Trimestral'
        : 'Mensal';
  const expiresAt = psiData?.planExpiresAt ? new Date(psiData.planExpiresAt) : null;
  const isExpired = expiresAt ? expiresAt < now : true;
  const daysRemaining = expiresAt
    ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  const isCancelAtPeriodEnd = !!(psiData?.cancel_at_period_end || psiData?.cancelAtPeriodEnd);
  const hasSubscription = !!(psiData?.subscriptionId || psiData?.stripeSubscriptionId);
  const isInTrial = isNewPricing
    ? !isExempt &&
      !isComunidade &&
      !!expiresAt &&
      expiresAt > now &&
      !psiData?.firstPaidAt &&
      (!hasSubscription || isTokenizedTrial)
    : !isExempt && !hasSubscription && !isExpired && daysRemaining > 0;
  const isActivePaidSubscriber =
    !isExempt && !isComunidade && psiData?.status === 'active' && hasSubscription && !isInTrial && !isExpired;
  const showLegacyBanner = isNewPricing && isActivePaidSubscriber && psiData?.isLegacySubscriber !== false;
  const isActive = (psiData?.status === 'active' || isExempt) && (!isExpired || isExempt);

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <YeloScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        {/* HEADER */}
        <View className="mx-4 mt-4 mb-4 bg-white py-5 px-4 rounded-[22px] items-center shadow-sm border border-[#f0f0f0]">
          <TouchableOpacity
            onPress={() => router.back()}
            className="absolute top-4 left-4 w-10 h-10 bg-[#f1f3f5] rounded-full items-center justify-center"
          >
            <Feather name="arrow-left" size={20} color="#1B4332" />
          </TouchableOpacity>
          <Text className="font-title text-[#1B4332] text-[24px] mb-1.5 mt-2 text-center">
            Seu Plano Yelo
          </Text>
          <Text className="font-sans text-[#666] text-[15px] text-center leading-5">
            Acompanhe o status da sua conta, visibilidade e recursos liberados.
          </Text>
        </View>

        {showLegacyBanner && (
          <View
            style={{
              marginHorizontal: 16,
              marginBottom: 16,
              backgroundColor: '#f0fdf4',
              borderWidth: 1,
              borderColor: '#bbf7d0',
              borderLeftWidth: 5,
              borderLeftColor: '#1B4332',
              borderRadius: 18,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: '#1B4332',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Feather name="shield" size={18} color="#FFEE8C" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 13.5 }}>
                  Sua assinatura atual permanece igual
                </Text>
                <View style={{ backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                  <Text style={{ fontFamily: 'Inter_800ExtraBold', color: '#166534', fontSize: 10 }}>
                    CONDIÇÃO MANTIDA
                  </Text>
                </View>
              </View>
              <Text style={{ fontFamily: 'Inter_400Regular', color: '#334155', fontSize: 12.5, lineHeight: 18 }}>
                As condições da sua assinatura permanecem inalteradas enquanto ela estiver ativa em sua conta.
              </Text>
            </View>
          </View>
        )}

        {/* RESUMO DO PLANO ATUAL */}
        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          {hasSubscription || isExempt || (isNewPricing && isComunidade) ? (
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
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10,
                  marginBottom: 8,
                }}
              >
                <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 21 }}>
                  {isComunidade ? 'Plano Comunidade' : 'Plano Essencial'}
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
                    <Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 12 }}>
                      Acesso Liberado (Isento)
                    </Text>
                  </View>
                ) : isComunidade ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: '#f1f5f9',
                      borderWidth: 1,
                      borderColor: '#cbd5e1',
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                      borderRadius: 999,
                    }}
                  >
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#64748b' }} />
                    <Text style={{ fontFamily: 'Inter_700Bold', color: '#475569', fontSize: 12 }}>
                      Gratuito
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
                      {isInTrial ? 'Período de Testes Ativo' : 'Ativo'}
                    </Text>
                  </View>
                )}
              </View>

              {!isComunidade && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <Feather name="calendar" size={14} color="#64748b" />
                  <Text style={{ fontFamily: 'Inter_500Medium', color: '#475569', fontSize: 13.5 }}>
                    {isExempt
                      ? 'Status: Isento (Acesso Contínuo)'
                      : !isActive
                        ? `Inativo desde: ${expiresAt?.toLocaleDateString('pt-BR') || '--/--/----'}`
                        : isInTrial
                          ? `Período de testes até: ${expiresAt?.toLocaleDateString('pt-BR') || '--/--/----'} (${daysRemaining} ${daysRemaining === 1 ? 'dia restante' : 'dias restantes'})`
                          : isCancelAtPeriodEnd
                            ? `Acesso até: ${expiresAt?.toLocaleDateString('pt-BR') || '--/--/----'} (${daysRemaining} ${daysRemaining === 1 ? 'dia restante' : 'dias restantes'})`
                            : `Válido até: ${expiresAt?.toLocaleDateString('pt-BR') || '--/--/----'} (${daysRemaining} ${daysRemaining === 1 ? 'dia restante' : 'dias restantes'})`}
                  </Text>
                </View>
              )}

              {!isComunidade && !isExempt && (
                <View style={{ borderTopWidth: 1, borderColor: '#f1f5f9', paddingTop: 12 }}>
                  <Text style={{ fontFamily: 'Inter_500Medium', color: '#64748b', fontSize: 12 }}>
                    Modalidade vinculada: <Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332' }}>{subCycleSuffix}</Text>
                  </Text>
                </View>
              )}

              {isComunidade && (
                <Text style={{ fontFamily: 'Inter_400Regular', color: '#475569', fontSize: 13, lineHeight: 19 }}>
                  Ferramentas internas de gestão clínica e Fórum liberadas gratuitamente. A exibição pública do perfil nas buscas é ativada com o Plano Essencial.
                </Text>
              )}

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
                  }}
                >
                  <Text style={{ fontFamily: 'Inter_700Bold', color: '#92400e', fontSize: 13.5, marginBottom: 4 }}>
                    Fatura em Aberto na Conta
                  </Text>
                  <Text style={{ fontFamily: 'Inter_500Medium', color: '#b45309', fontSize: 12, lineHeight: 17 }}>
                    {pendingInvoice.diffDays !== undefined && pendingInvoice.diffDays < 0
                      ? `Vencida em ${pendingInvoice.dueDate?.split('-').reverse().join('/')}`
                      : pendingInvoice.diffDays === 0
                        ? 'Vencimento hoje'
                        : `Vence em: ${pendingInvoice.dueDate?.split('-').reverse().join('/')}`}
                    . O pagamento e a regularização de faturas são realizados diretamente fora do aplicativo.
                  </Text>
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
                  Você ainda tem <Text className="font-bold">{daysRemaining} {daysRemaining === 1 ? 'dia' : 'dias'}</Text> restantes no seu período de experiência.
                </Text>
              </View>
            </View>
          ) : (
            <View className="bg-[#fef2f2] border border-[#fecaca] p-4 rounded-[20px] flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full bg-[#ef4444] items-center justify-center">
                <Feather name="alert-circle" size={20} color="white" />
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#991b1b] text-[16px]">Plano Essencial Inativo</Text>
                <Text className="font-sans text-[#b91c1c] text-[13px]">
                  Seu perfil público está pausado nas buscas até que uma assinatura ativa seja vinculada à sua conta.
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* VISÃO COMPARATIVA DOS PLANOS (INFORMATIVA) */}
        <View style={{ paddingHorizontal: 16 }}>
          {isNewPricing && (
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 22,
                borderWidth: isComunidade ? 1.5 : 1,
                borderColor: isComunidade ? '#1B4332' : '#e2e8f0',
                padding: 18,
                marginBottom: 16,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <View>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10.5, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                    Organização interna
                  </Text>
                  <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 20, color: '#0f172a' }}>
                    Plano Comunidade
                  </Text>
                </View>
                <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11.5, color: '#1B4332' }}>
                    {isComunidade ? 'Plano Atual' : 'Gratuito'}
                  </Text>
                </View>
              </View>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: '#475569', lineHeight: 19 }}>
                Agenda clínica, pacientes, controle financeiro, calculadora de honorários e participação no Fórum sem custo mensal. O perfil público não é exibido nas buscas.
              </Text>
            </View>
          )}

          <View
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 24,
              borderWidth: 2,
              borderColor: '#1B4332',
              padding: 22,
              shadowColor: '#1B4332',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.08,
              shadowRadius: 12,
              elevation: 3,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 22 }}>
                Plano Essencial
              </Text>
              {hasSubscription && !isComunidade && (
                <View style={{ backgroundColor: '#1B4332', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
                  <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 11 }}>
                    {isInTrial ? 'Em Experiência' : 'Seu Plano Atual'}
                  </Text>
                </View>
              )}
            </View>

            <Text style={{ fontFamily: 'Inter_400Regular', color: '#475569', fontSize: 13.5, lineHeight: 20, marginBottom: 18 }}>
              Recursos completos para exposição do consultório, atendimento e análise de mercado, sem comissão por sessão realizada.
            </Text>

            <View style={{ borderTopWidth: 1, borderColor: '#f1f5f9', paddingTop: 16, marginBottom: 18, gap: 13 }}>
              {[
                'Exibição no algoritmo de busca e Match Inteligente com pacientes',
                'Página pública personalizada com botão direto de contato',
                'Prontuário eletrônico seguro e evolução de pacientes',
                'Controle financeiro clínico completo e organização fiscal',
                'Métricas de demanda, favoritos e inteligência de mercado',
                'Acesso completo ao Fórum da Comunidade e publicação no Blog',
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

            {/* AVISO DE APP COMPLEMENTAR (APPLE 3.1.3 / GOOGLE PLAY) */}
            <View
              style={{
                backgroundColor: '#f8fafc',
                borderWidth: 1,
                borderColor: '#e2e8f0',
                borderRadius: 16,
                padding: 14,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Feather name="info" size={15} color="#1B4332" />
                <Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 13 }}>
                  Gerenciamento de Conta e Planos
                </Text>
              </View>
              <Text style={{ fontFamily: 'Inter_400Regular', color: '#475569', fontSize: 12.5, lineHeight: 18, marginBottom: 12 }}>
                Contratações, upgrades e pagamentos não são realizados diretamente dentro deste aplicativo. Contas já habilitadas na Yelo têm todos os benefícios sincronizados automaticamente aqui.
              </Text>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.navigate('/(tabs)/fale_com_a_yelo')}
                style={{
                  backgroundColor: '#ffffff',
                  borderWidth: 1,
                  borderColor: '#cbd5e1',
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Feather name="help-circle" size={15} color="#1B4332" />
                <Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 12.5 }}>
                  Falar com o Suporte Yelo
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ÁREA DE GESTÃO DE RENOVAÇÃO PARA ASSINANTES ATIVOS */}
          {hasSubscription && isActive && !isCancelAtPeriodEnd && !isExempt && !isComunidade && (
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
                {isNewPricing
                  ? `Se você cancelar a renovação, seu perfil retornará ao Plano Comunidade (Gratuito) após o fim do período vigente (${expiresAt?.toLocaleDateString('pt-BR')}).`
                  : `Se você cancelar a renovação, seu perfil deixará de aparecer nas buscas após o fim do período vigente (${expiresAt?.toLocaleDateString('pt-BR')}).`}
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

          {hasSubscription && isCancelAtPeriodEnd && !isExempt && !isComunidade && (
            <TouchableOpacity
              onPress={() => setActiveModal('REACTIVATE_CONFIRM')}
              activeOpacity={0.85}
              style={{
                marginTop: 18,
                backgroundColor: '#F59E0B',
                width: '100%',
                paddingVertical: 15,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 14.5 }}>
                Reativar renovação automática
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </YeloScrollView>

      {/* MODAL PARA CANCELAMENTO / REATIVAÇÃO DE RENOVAÇÃO EXISTENTE */}
      <Modal
        visible={activeModal !== 'NONE'}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          if (!isSubmittingAction) setActiveModal('NONE');
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <TouchableOpacity
            activeOpacity={1}
            style={{ flex: 1 }}
            onPress={() => {
              if (!isSubmittingAction) setActiveModal('NONE');
            }}
          />

          <View
            style={{
              backgroundColor: '#ffffff',
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              width: '100%',
              overflow: 'hidden',
            }}
          >
            <View style={{ width: 44, height: 5, backgroundColor: '#cbd5e1', borderRadius: 999, alignSelf: 'center', marginTop: 12, marginBottom: 8 }} />

            {activeModal === 'CANCEL_CONFIRM' && (
              <View style={{ paddingHorizontal: 24, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 24) + 16, alignItems: 'center' }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Feather name="alert-triangle" size={28} color="#dc2626" />
                </View>

                <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 22, textAlign: 'center', marginBottom: 8 }}>
                  Tem certeza?
                </Text>

                <Text style={{ fontFamily: 'Inter_400Regular', color: '#475569', fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 24 }}>
                  Você continuará com acesso aos benefícios até o fim do período atual ({expiresAt?.toLocaleDateString('pt-BR')}), mas sua renovação não será aplicada no próximo ciclo.
                </Text>

                <TouchableOpacity
                  onPress={() => setActiveModal('NONE')}
                  disabled={isSubmittingAction}
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
                  disabled={isSubmittingAction}
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
                  {isSubmittingAction ? (
                    <ActivityIndicator color="#e63946" size="small" />
                  ) : (
                    <Text style={{ fontFamily: 'Inter_700Bold', color: '#e63946', fontSize: 14.5 }}>
                      Sim, quero cancelar
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {activeModal === 'CANCEL_SUCCESS' && (
              <View style={{ paddingHorizontal: 24, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 24) + 16, alignItems: 'center' }}>
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

            {activeModal === 'REACTIVATE_CONFIRM' && (
              <View style={{ paddingHorizontal: 24, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 24) + 16, alignItems: 'center' }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#e8f5e9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Feather name="refresh-cw" size={26} color="#1B4332" />
                </View>

                <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 22, textAlign: 'center', marginBottom: 8 }}>
                  Reativar renovação?
                </Text>

                <Text style={{ fontFamily: 'Inter_400Regular', color: '#475569', fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 24 }}>
                  Ao confirmar, sua assinatura volta ao status de renovação automática na data prevista ({expiresAt?.toLocaleDateString('pt-BR')}).
                </Text>

                <TouchableOpacity
                  onPress={handleReativarRenovacao}
                  disabled={isSubmittingAction}
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
                  {isSubmittingAction ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 15 }}>
                      Sim, Reativar
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setActiveModal('NONE')}
                  disabled={isSubmittingAction}
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
          </View>
        </View>
      </Modal>

      <YeloToast
        message={toastMessage}
        onDismiss={() => setToastMessage(null)}
        type={toastType}
      />
    </View>
  );
}
