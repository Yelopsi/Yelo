import api from '../services/api';

export const NEW_PRICING_DEFAULT_ISO = '2027-01-01T00:00:00-03:00';

export type BillingCycleKey = 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL';

export interface CycleMeta {
  key: BillingCycleKey;
  label: string;
  monthlyPrice: number;
  oldPrice: string | null;
  total: number;
  installments: number;
  badgeText: string | null;
  priceFormatted: string;
  billingNote: string;
}

export const MOBILE_CYCLE_CONFIG: Record<BillingCycleKey, CycleMeta> = {
  MONTHLY: {
    key: 'MONTHLY',
    label: 'Mensal',
    monthlyPrice: 159,
    oldPrice: null,
    total: 159,
    installments: 1,
    badgeText: 'Sem fidelidade',
    priceFormatted: '159,00',
    billingNote: 'Cobrança mensal de R$ 159 · Cancele quando quiser',
  },
  QUARTERLY: {
    key: 'QUARTERLY',
    label: 'Trimestral',
    monthlyPrice: 129,
    oldPrice: 'R$ 159',
    total: 387,
    installments: 3,
    badgeText: '-19%',
    priceFormatted: '129,00',
    billingNote: '3x de R$ 129 no cartão (total R$ 387) · Economia de R$ 90',
  },
  SEMIANNUAL: {
    key: 'SEMIANNUAL',
    label: 'Semestral',
    monthlyPrice: 99,
    oldPrice: 'R$ 159',
    total: 594,
    installments: 6,
    badgeText: '-38%',
    priceFormatted: '99,00',
    billingNote: '6x de R$ 99 no cartão (total R$ 594) · Economia de R$ 360',
  },
};

export function isMobileNewPricingActive(
  psiData?: { isNewPricingActive?: boolean; serverNow?: string } | null
): boolean {
  if (psiData && typeof psiData.isNewPricingActive === 'boolean') {
    return psiData.isNewPricingActive;
  }
  const serverMs = psiData?.serverNow ? Date.parse(String(psiData.serverNow)) : Date.now();
  const refMs = Number.isNaN(serverMs) ? Date.now() : serverMs;
  return refMs >= Date.parse(NEW_PRICING_DEFAULT_ISO);
}

export function isMobileTrialEligible(
  psiData?: {
    is_exempt?: boolean | string | number;
    plano?: string | null;
    subscriptionId?: string | null;
    stripeSubscriptionId?: string | null;
    firstPaidAt?: string | null;
    subscribedAt?: string | null;
    canceledAt?: string | null;
  } | null
): boolean {
  if (!psiData) return false;
  const isExempt =
    psiData.is_exempt === true ||
    String(psiData.is_exempt).toLowerCase() === 'true' ||
    psiData.is_exempt === 1;
  if (isExempt) return false;
  const hasSub = Boolean(psiData.stripeSubscriptionId || psiData.subscriptionId);
  return (
    String(psiData.plano || '').trim() === 'Comunidade' &&
    !hasSub &&
    !psiData.firstPaidAt &&
    !psiData.subscribedAt &&
    !psiData.canceledAt
  );
}

export async function fetchPublicNewPricingStatus(): Promise<boolean> {
  try {
    const res = await api.get('/api/public/pricing-status');
    if (typeof res?.data?.isNewPricingActive === 'boolean') {
      return res.data.isNewPricingActive;
    }
  } catch (_e) {
    // Fallback to client launch timestamp when offline
  }
  return Date.now() >= Date.parse(NEW_PRICING_DEFAULT_ISO);
}
