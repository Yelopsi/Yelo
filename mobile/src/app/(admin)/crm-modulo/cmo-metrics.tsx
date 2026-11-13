import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import api from '../../../services/api';
import YeloToast from '../../../components/YeloToast';
import NativeSelectMenu from '../../../components/NativeSelectMenu';

interface MonthOption {
  label: string;
  shortLabel: string;
  start: string;
  end: string;
}

export default function AdminCmoMetricsScreen() {
  const insets = useSafeAreaInsets();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [trafficData, setTrafficData] = useState<any>(null);

  // Month selector
  const monthOptions = useMemo<MonthOption[]>(() => {
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const now = new Date();
    const list: MonthOption[] = [];
    let y = now.getFullYear();
    let m = now.getMonth();

    for (let i = 0; i < 12; i++) {
      const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const endDay = new Date(y, m + 1, 0).getDate();
      const end = `${y}-${String(m + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
      list.push({
        label: `${months[m]} ${y}`,
        shortLabel: `${months[m].slice(0, 3)}/${String(y).slice(2)}`,
        start,
        end,
      });
      m--;
      if (m < 0) {
        m = 11;
        y--;
      }
    }
    return list;
  }, []);

  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);

  // Simulator Inputs
  const [reinvestRate, setReinvestRate] = useState<number>(100);
  const [extraCash, setExtraCash] = useState<number>(0);
  const [curiosityGoal, setCuriosityGoal] = useState<string>('');
  const [includeOrganic, setIncludeOrganic] = useState<boolean>(true);
  const [selectedSimHorizon, setSelectedSimHorizon] = useState<number>(12); // 1, 3, 6, 12 months

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  const selectedPeriod = monthOptions[selectedMonthIndex] || monthOptions[0];

  const fetchData = async () => {
    try {
      const { start, end } = selectedPeriod;
      const [dashRes, trafficRes] = await Promise.all([
        api.get(`/api/cmo/dashboard?dateStart=${start}&dateEnd=${end}`),
        api.get(`/api/cmo/traffic?dateStart=${start}&dateEnd=${end}`).catch(() => ({ data: null })),
      ]);

      if (dashRes.data) {
        setDashboardData(dashRes.data);
      }
      if (trafficRes?.data?.data) {
        setTrafficData(trafficRes.data.data);
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados do CMO:', err);
      setToastMessage('Falha ao carregar painel executivo do CMO.');
      setToastType('error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonthIndex]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchData();
  }, [selectedMonthIndex]);

  // Formatter helpers
  const formatBRL = (val: any) => {
    if (val === undefined || val === null || val === 'MISSING_INPUT' || isNaN(Number(val))) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val));
  };

  const formatNumber = (val: any) => {
    if (val === undefined || val === null || isNaN(Number(val))) return '0';
    return Number(val).toLocaleString('pt-BR');
  };

  const formatPercent = (val: any) => {
    if (val === undefined || val === null || isNaN(Number(val))) return '0,0%';
    return `${(Number(val) * 100).toFixed(1).replace('.', ',')}%`;
  };

  const formatMonths = (val: any) => {
    if (val === undefined || val === null || isNaN(Number(val))) return '0,0 Meses';
    return `${Number(val).toFixed(1).replace('.', ',')} Meses`;
  };

  // Trend Badge Helper
  const renderTrendBadge = (curr: number, prev: number, inverseGood: boolean | 'neutral' = false) => {
    const isNeutralTrend = inverseGood === 'neutral';
    if (prev === null || prev === undefined || isNaN(prev) || isNaN(curr)) {
      return (
        <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 }}>
          <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '700' }}>—</Text>
        </View>
      );
    }
    if (prev === 0 && curr > 0) {
      const color = isNeutralTrend ? '#2563eb' : (inverseGood ? '#ef4444' : '#10b981');
      return (
        <View style={{ backgroundColor: color + '1a', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 }}>
          <Text style={{ color, fontSize: 10, fontWeight: '700' }}>Novo</Text>
        </View>
      );
    }
    if (prev === 0 && curr === 0) {
      return (
        <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 }}>
          <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '700' }}>0%</Text>
        </View>
      );
    }

    const pct = ((curr - prev) / prev) * 100;
    if (Math.abs(pct) < 0.1) {
      return (
        <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 }}>
          <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '700' }}>0%</Text>
        </View>
      );
    }

    const isUp = pct > 0;
    const color = isNeutralTrend
      ? (isUp ? '#2563eb' : '#64748b')
      : ((inverseGood ? !isUp : isUp) ? '#10b981' : '#ef4444');
    const arrow = isUp ? '↑' : '↓';

    return (
      <View style={{ backgroundColor: color + '1a', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 }}>
        <Text style={{ color, fontSize: 10, fontWeight: '700' }}>
          {arrow} {Math.abs(pct).toFixed(1)}%
        </Text>
      </View>
    );
  };

  type SimTone = 'positive' | 'negative' | 'warning' | 'info' | 'neutral';
  const renderSimBadgePill = (label: string, tone: SimTone = 'neutral') => {
    const palette: Record<SimTone, { bg: string; color: string; border: string }> = {
      positive: { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' },
      negative: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
      warning: { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
      info: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
      neutral: { bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0' },
    };
    const p = palette[tone] || palette.neutral;
    return (
      <View
        style={{
          backgroundColor: p.bg,
          borderColor: p.border,
          borderWidth: 1,
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 999,
        }}
      >
        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: p.color }}>{label}</Text>
      </View>
    );
  };

  const renderSimPctBadge = (
    currVal: number,
    baseVal: number,
    refLabel: string,
    opts: { inverseGood?: boolean; neutralTrend?: boolean } = {}
  ) => {
    const { inverseGood = false, neutralTrend = false } = opts;
    if (!isFinite(currVal) || !isFinite(baseVal) || baseVal <= 0) {
      return renderSimBadgePill('—', 'neutral');
    }
    const pct = ((currVal - baseVal) / baseVal) * 100;
    if (Math.abs(pct) < 0.1) {
      return renderSimBadgePill(`= 0,0% ${refLabel}`, 'neutral');
    }
    const isUp = pct > 0;
    const arrow = isUp ? '↑' : '↓';
    const sign = isUp ? '+' : '-';
    let tone: SimTone = 'neutral';
    if (neutralTrend) {
      tone = isUp ? 'info' : 'neutral';
    } else {
      const isGood = inverseGood ? !isUp : isUp;
      tone = isGood ? 'positive' : 'negative';
    }
    return renderSimBadgePill(`${arrow} ${sign}${Math.abs(pct).toFixed(1).replace('.', ',')}% ${refLabel}`, tone);
  };

  // Transparency Debug Card Helper
  const renderDbgCard = (
    title: string,
    currVal: number,
    prevVal: number,
    formatType: 'currency' | 'number' | 'percent' | 'months',
    inverseGood: boolean | 'neutral' = false,
    customNote?: string,
    isAlertBg: boolean = false
  ) => {
    let currFormatted = '';
    let prevFormatted = '';

    if (formatType === 'currency') {
      currFormatted = formatBRL(currVal);
      prevFormatted = formatBRL(prevVal);
    } else if (formatType === 'percent') {
      currFormatted = formatPercent(currVal);
      prevFormatted = formatPercent(prevVal);
    } else if (formatType === 'number') {
      currFormatted = formatNumber(currVal);
      prevFormatted = formatNumber(prevVal);
    } else if (formatType === 'months') {
      currFormatted = formatMonths(currVal);
      prevFormatted = formatMonths(prevVal);
    }

    return (
      <View
        key={title}
        style={{
          width: '48.5%',
          backgroundColor: isAlertBg ? '#fff1f2' : '#ffffff',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: isAlertBg ? '#fecdd3' : '#e2e8f0',
          padding: 12,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <Text
            style={{
              fontFamily: 'Inter_700Bold',
              fontSize: 10,
              color: isAlertBg ? '#991b1b' : '#64748b',
              textTransform: 'uppercase',
              flex: 1,
            }}
            numberOfLines={1}
          >
            {title}
          </Text>
          {customNote ? null : renderTrendBadge(currVal, prevVal, inverseGood)}
        </View>

        <Text
          style={{
            fontFamily: 'Fraunces_700Bold',
            fontSize: 17,
            color: isAlertBg ? '#991b1b' : '#1e293b',
            marginTop: 2,
          }}
          numberOfLines={1}
        >
          {currFormatted}
        </Text>

        <Text
          style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 10,
            color: isAlertBg ? '#b91c1c' : '#94a3b8',
            marginTop: 2,
          }}
          numberOfLines={1}
        >
          {customNote || `Anterior: ${prevFormatted}`}
        </Text>
      </View>
    );
  };

  // =========================================================================
  // SIMULATOR MATHEMATICAL ENGINE
  // =========================================================================
  const simulationResults = useMemo(() => {
    if (!dashboardData) return null;

    const sim = dashboardData.simulator || {};
    const b2b = dashboardData.platform?.b2b || {};
    const historical = dashboardData.historical || {};

    const currentBase = Number(sim.currentPaidAccessBase || b2b.total_active || 0);
    const arpu = Number(b2b.arpu || 99);
    const contactsPerPaidPsiMonth = Number(sim.contactsPerPaidPsiMonth?.value || 2);
    const cplGoogle = Number(sim.cpl?.value || dashboardData.ads?.google?.cpl?.value || 5.0);
    const cacMeta = Number(sim.cac?.value || dashboardData.ads?.meta?.cac || 80.0);
    const trialConversionRate = Number(sim.trialConv?.value || 0.25);
    const monthlyChurn = Number(sim.churn?.value || b2b.global_churn_rate || 0.05);
    const histMetaMonthlySpend = Number(historical.meta?.monthly_spend_avg?.value || dashboardData.ads?.meta?.spend || 500);

    const verifiedOrganicContacts = includeOrganic ? Number(sim.organicContacts?.value || 0) : 0;
    const organicActiveAdditions = includeOrganic ? Number(sim.organicActive?.value || 0) : 0;

    const gatewayRate = 0.0265;
    const taxRate = 0.0;
    const varCostRate = 0.0;
    const fixedOPEX = 0;
    const metaScalePenalty = 0.20;

    let rollingBase = Math.max(1, currentBase);
    let cumulativeRevenue = 0;

    const monthProjections: Array<{
      m: number;
      base: number;
      mrr: number;
      metaSpend: number;
      googleSpend: number;
      ltv: number;
      payback: number;
      extrapolation: number;
    }> = [];

    for (let m = 1; m <= 12; m++) {
      const monthMrr = rollingBase * arpu;
      cumulativeRevenue += monthMrr;

      const operationalCash = monthMrr * (1 - gatewayRate - taxRate - varCostRate) - fixedOPEX;

      // Google demand maintenance
      const totalContactsNeeded = rollingBase * contactsPerPaidPsiMonth;
      const paidContactsNeeded = Math.max(0, totalContactsNeeded - verifiedOrganicContacts);
      const googleMaintenanceSpend = paidContactsNeeded * cplGoogle;

      // Growth fund
      const availableCash = Math.max(0, operationalCash - googleMaintenanceSpend);
      const growthFund = (availableCash * (reinvestRate / 100)) + extraCash;

      // Meta Paid acquisition calculation with scale penalty iteration
      let newPaidActive = 0;
      let actualMetaSpend = 0;
      let trialGoogleSpend = 0;
      let penalizedCacMeta = cacMeta;

      const trialsNeededPerPaid = trialConversionRate > 0 ? (1 / trialConversionRate) : 4;
      const trialGoogleCostPerPaid = trialsNeededPerPaid * 1 * cplGoogle; // 1 contact per trial

      if (growthFund > 0 && cacMeta > 0) {
        let iteratedCAC = cacMeta;
        for (let iter = 0; iter < 10; iter++) {
          const blendedCAC = iteratedCAC + trialGoogleCostPerPaid;
          const candidatePaid = growthFund / blendedCAC;
          const candidateMetaSpend = candidatePaid * iteratedCAC;
          const scaleFactor = histMetaMonthlySpend > 0 ? Math.max(1, candidateMetaSpend / histMetaMonthlySpend) : 1;
          const newCac = cacMeta * (1 + (scaleFactor - 1) * metaScalePenalty);
          if (Math.abs(newCac - iteratedCAC) < 0.1) {
            iteratedCAC = newCac;
            break;
          }
          iteratedCAC = newCac;
        }

        penalizedCacMeta = iteratedCAC;
        const finalBlendedCAC = penalizedCacMeta + trialGoogleCostPerPaid;
        newPaidActive = growthFund / finalBlendedCAC;
        actualMetaSpend = newPaidActive * penalizedCacMeta;
        trialGoogleSpend = newPaidActive * trialGoogleCostPerPaid;
      }

      const totalGoogleSpend = googleMaintenanceSpend + trialGoogleSpend;

      // Net customer margin & LTV/Payback
      const netMonthlyMargin = (arpu * (1 - gatewayRate)) - (contactsPerPaidPsiMonth * cplGoogle);
      const expectedLifetimeMonths = monthlyChurn > 0 ? Math.min(36, 1 / monthlyChurn) : 24;
      const ltvContribution = Math.max(0, netMonthlyMargin * expectedLifetimeMonths);

      const blendedAcquisitionCost = penalizedCacMeta + trialGoogleCostPerPaid;
      const paybackMonths = netMonthlyMargin > 0 ? (blendedAcquisitionCost / netMonthlyMargin) : 0;

      const extrapolationMultiple = histMetaMonthlySpend > 0 ? (actualMetaSpend / histMetaMonthlySpend) : 1;

      // Base evolution
      const churned = rollingBase * monthlyChurn;
      const netNew = newPaidActive + organicActiveAdditions - churned;
      rollingBase = Math.max(1, rollingBase + netNew);

      monthProjections.push({
        m,
        base: rollingBase,
        mrr: rollingBase * arpu,
        metaSpend: actualMetaSpend,
        googleSpend: totalGoogleSpend,
        ltv: ltvContribution,
        payback: paybackMonths,
        extrapolation: extrapolationMultiple,
      });
    }

    const targetIndex = Math.min(Math.max(1, selectedSimHorizon), 12) - 1;
    const targetProjection = monthProjections[targetIndex] || monthProjections[monthProjections.length - 1];
    const m1Projection = monthProjections[0] || targetProjection;

    return {
      currentBase,
      currentMrr: currentBase * arpu,
      targetMonth: selectedSimHorizon,
      projectedMRR: targetProjection.mrr,
      projectedBase: targetProjection.base,
      projectedMeta: targetProjection.metaSpend,
      projectedGoogle: targetProjection.googleSpend,
      projectedLTV: targetProjection.ltv,
      projectedPayback: targetProjection.payback,
      projectedExtrapolation: targetProjection.extrapolation,
      m1Google: m1Projection.googleSpend,
      m1Ltv: m1Projection.ltv,
      m1Payback: m1Projection.payback,
      monthlyChurn,
      cacMeta,
      histMetaMonthlySpend,
      contactsPerPaidPsiMonth,
    };
  }, [dashboardData, reinvestRate, extraCash, includeOrganic, selectedSimHorizon]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <ActivityIndicator size="large" color="#1B4332" />
        <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#1B4332', fontSize: 16, marginTop: 14 }}>
          Carregando Painel do CMO...
        </Text>
        <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
          Calculando inteligência algorítmica, LTV/CAC e modelo de escala reversa.
        </Text>
      </View>
    );
  }

  const decision = dashboardData?.decisionEngineMeta || dashboardData?.decision || {};
  const prevDecision = dashboardData?.prevDecisionEngineMeta || {};
  const platform = dashboardData?.platform || {};
  const b2b = platform.b2b || {};
  const b2c = platform.b2c || {};
  const prevPlatform = dashboardData?.prevPlatform || {};
  const ads = dashboardData?.ads || {};
  const prevAds = dashboardData?.prevAds || {};
  const efficiency = dashboardData?.efficiency || {};
  const prevEfficiency = dashboardData?.prevEfficiency || {};

  // Meta Campaign single details
  const metaCampaign = dashboardData?.campaigns?.meta?.find(
    (c: any) => (c.campaign_id || c.id) === '120251213168140531'
  ) || {};
  const prevMetaCampaign = dashboardData?.prevCampaigns?.meta?.find(
    (c: any) => (c.campaign_id || c.id) === '120251213168140531'
  ) || {};

  const metaSpend = Number(ads.meta?.spend || 0);
  const prevMetaSpend = Number(prevAds.meta?.spend || 0);
  const metaTrials = Number(b2b.trials || 0);
  const prevMetaTrials = Number(prevPlatform.b2b?.trials || 0);
  const metaPagantes = Number(b2b.active || 0);
  const prevMetaPagantes = Number(prevPlatform.b2b?.active || 0);
  const metaCac = Number(ads.meta?.cac || 0);
  const prevMetaCac = Number(prevAds.meta?.cac || 0);

  const metaImpressions = Number(metaCampaign.impressions || 0);
  const prevMetaImpressions = Number(prevMetaCampaign.impressions || 0);
  const metaClicks = Number(metaCampaign.clicks || 0);
  const prevMetaClicks = Number(prevMetaCampaign.clicks || 0);
  const metaConversions = Number(metaCampaign.conversions || 0);
  const prevMetaConversions = Number(prevMetaCampaign.conversions || 0);
  const metaCpc = metaClicks > 0 ? metaSpend / metaClicks : 0;
  const prevMetaCpc = prevMetaClicks > 0 ? prevMetaSpend / prevMetaClicks : 0;
  const metaCpa = metaConversions > 0 ? metaSpend / metaConversions : 0;
  const prevMetaCpa = prevMetaConversions > 0 ? prevMetaSpend / prevMetaConversions : 0;

  // Google Campaign single details
  const googleCampaign = dashboardData?.campaigns?.google?.find(
    (c: any) => c.campaign_name === 'Yelo MVP - Busca SP'
  ) || {};
  const prevGoogleCampaign = dashboardData?.prevCampaigns?.google?.find(
    (c: any) => c.campaign_name === 'Yelo MVP - Busca SP'
  ) || {};

  const googleSpend = Number(ads.google?.spend || 0);
  const prevGoogleSpend = Number(prevAds.google?.spend || 0);
  const googleClicks = Number(b2c.wpp_clicks || 0);
  const prevGoogleClicks = Number(prevPlatform.b2c?.wpp_clicks || 0);
  const googleDeals = Number(b2c.total_deals || 0);
  const prevGoogleDeals = Number(prevPlatform.b2c?.total_deals || 0);
  const googleCpl = Number(ads.google?.cpl?.value ?? ads.google?.cpl ?? 0);
  const prevGoogleCpl = Number(prevAds.google?.cpl?.value ?? prevAds.google?.cpl ?? 0);

  const googleImpressions = Number(googleCampaign.impressions || 0);
  const prevGoogleImpressions = Number(prevGoogleCampaign.impressions || 0);
  const googleAdClicks = Number(googleCampaign.clicks || 0);
  const prevGoogleAdClicks = Number(prevGoogleCampaign.clicks || 0);
  const googleConversions = Number(googleCampaign.conversions || 0);
  const prevGoogleConversions = Number(prevGoogleCampaign.conversions || 0);
  const googleCpc = googleAdClicks > 0 ? googleSpend / googleAdClicks : 0;
  const prevGoogleCpc = prevGoogleAdClicks > 0 ? prevGoogleSpend / prevGoogleAdClicks : 0;
  const googleCpa = googleConversions > 0 ? googleSpend / googleConversions : 0;
  const prevGoogleCpa = prevGoogleConversions > 0 ? prevGoogleSpend / prevGoogleConversions : 0;

  // B2C Efficiency
  const globalEffort = Number(efficiency.globalEffort || 0);
  const prevGlobalEffort = Number(prevEfficiency.globalEffort || 0);
  const adsEffort = efficiency.adsEffort !== 'N/A' && efficiency.adsEffort ? Number(efficiency.adsEffort) : null;
  const prevAdsEffort = prevEfficiency.adsEffort !== 'N/A' && prevEfficiency.adsEffort ? Number(prevEfficiency.adsEffort) : null;
  const orgEffort = efficiency.orgEffort !== 'N/A' && efficiency.orgEffort ? Number(efficiency.orgEffort) : null;
  const prevOrgEffort = prevEfficiency.orgEffort !== 'N/A' && prevEfficiency.orgEffort ? Number(prevEfficiency.orgEffort) : null;
  const topTicket = efficiency.topTicket !== 'N/A' && efficiency.topTicket ? Number(efficiency.topTicket) : 0;
  const prevTopTicket = prevEfficiency.topTicket !== 'N/A' && prevEfficiency.topTicket ? Number(prevEfficiency.topTicket) : 0;
  const ttfcMedian = efficiency.ttfcData?.median ? Number(efficiency.ttfcData.median) : null;
  const ttvMedian = efficiency.ttvData?.median ? Number(efficiency.ttvData.median) : null;

  // Traffic
  const ga4 = trafficData?.ga4;
  const prevGa4 = trafficData?.prevGa4;
  const gsc = trafficData?.gsc;
  const prevGsc = trafficData?.prevGsc;
  const ga4EngagementRate = ga4 && Number(ga4.sessions || 0) > 0 ? (1 - Number(ga4.bounceRate || 0)) * 100 : 0;
  const prevGa4EngagementRate = prevGa4 && Number(prevGa4.sessions || 0) > 0 ? (1 - Number(prevGa4.bounceRate || 0)) * 100 : null;

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <StatusBar style="dark" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 130, // respiro premium para a bottom nav fixa
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="#1B4332"
            colors={['#1B4332']}
          />
        }
      >
        {/* ========================================================= */}
        {/* TOP BAR: BOTÃO VOLTAR CRM HUB + BADGE ADMIN CMO           */}
        {/* ========================================================= */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <TouchableOpacity
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(admin)/crm'))}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#e8f5e9',
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: '#c8e6c9',
              shadowColor: '#000',
              shadowOpacity: 0.03,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 1 },
              elevation: 1,
            }}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={16} color="#1B4332" />
            <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#1B4332', fontSize: 12, marginLeft: 6 }}>
              CRM Hub
            </Text>
          </TouchableOpacity>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#e8f5e9',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: '#c8e6c9',
              gap: 4,
            }}
          >
            <Text style={{ fontSize: 11 }}>🛡️</Text>
            <Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 11 }}>Admin CMO</Text>
          </View>
        </View>

        {/* ========================================================= */}
        {/* HERO CARD VERDE FLORESTA YELO COM GRADIENTE               */}
        {/* ========================================================= */}
        <LinearGradient
          colors={['#1B4332', '#2D6A4F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 24,
            padding: 22,
            marginBottom: 16,
            shadowColor: '#1B4332',
            shadowOpacity: 0.15,
            shadowRadius: 25,
            shadowOffset: { width: 0, height: 8 },
            elevation: 5,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Efeito decorativo */}
          <View
            style={{
              position: 'absolute',
              top: -40,
              right: -40,
              width: 180,
              height: 180,
              borderRadius: 90,
              backgroundColor: 'rgba(255,255,255,0.06)',
            }}
            pointerEvents="none"
          />

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text
                style={{
                  fontFamily: 'Fraunces_700Bold',
                  fontSize: 23,
                  lineHeight: 28,
                  color: '#ffffff',
                }}
              >
                Painel do CMO 🧠
              </Text>
              <Text
                style={{
                  fontFamily: 'Inter_400Regular',
                  fontSize: 12.5,
                  color: 'rgba(255,255,255,0.85)',
                  marginTop: 4,
                  lineHeight: 18,
                }}
              >
                Motor de Decisão Executiva de Tráfego Pago (Meta & Google).
              </Text>
            </View>

            <TouchableOpacity
              onPress={fetchData}
              style={{
                backgroundColor: '#FFEE8C',
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 999,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                shadowColor: '#000',
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 2,
              }}
              activeOpacity={0.8}
            >
              <Feather name="refresh-cw" size={12} color="#1B4332" />
              <Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 11 }}>Atualizar</Text>
            </TouchableOpacity>
          </View>

          {/* Seletor de Meses via Dropdown Nativo (Sem scroll horizontal) */}
          <View style={{ marginTop: 8 }}>
            <Text
              style={{
                fontFamily: 'Inter_700Bold',
                fontSize: 10,
                color: 'rgba(255,255,255,0.7)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 6,
              }}
            >
              Mês de Análise (Gastos e Transparência)
            </Text>
            <NativeSelectMenu
              title="Selecionar Mês de Análise"
              options={monthOptions.map((opt, idx) => ({
                label: opt.label,
                value: String(idx),
              }))}
              selectedValue={String(selectedMonthIndex)}
              onSelect={(val) => setSelectedMonthIndex(Number(val))}
              style={{ width: '100%' }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'rgba(255,255,255,0.14)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.25)',
                  borderRadius: 999,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  width: '100%',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <Feather name="calendar" size={15} color="#ffffff" />
                  <Text
                    style={{
                      fontFamily: 'Inter_600SemiBold',
                      color: '#ffffff',
                      fontSize: 13,
                      flex: 1,
                    }}
                    numberOfLines={1}
                  >
                    {selectedPeriod?.label || 'Selecionar Mês'}
                  </Text>
                </View>
                <Feather name="chevron-down" size={16} color="#ffffff" />
              </View>
            </NativeSelectMenu>
            {dashboardData?.period?.dateStart && dashboardData?.period?.prevDateStart ? (
              <Text
                style={{
                  fontFamily: 'Inter_500Medium',
                  fontSize: 10.5,
                  color: 'rgba(255,255,255,0.8)',
                  marginTop: 8,
                }}
              >
                {(() => {
                  const fmtBr = (iso: string) => {
                    const pts = String(iso).split('-');
                    return pts.length === 3 ? `${pts[2]}/${pts[1]}` : iso;
                  };
                  const p = dashboardData.period;
                  const dLbl = p.diffDays ? `${p.diffDays}d` : '';
                  return `Comparando ${fmtBr(p.dateStart)}–${fmtBr(p.dateEnd)} (${dLbl}) vs ${fmtBr(p.prevDateStart)}–${fmtBr(p.prevDateEnd)} (${dLbl})`;
                })()}
              </Text>
            ) : null}
          </View>
        </LinearGradient>

        {/* ========================================================= */}
        {/* AI DECISION ENGINE CARD                                   */}
        {/* ========================================================= */}
        <View
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            padding: 16,
            marginBottom: 20,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOpacity: 0.03,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 2,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
              marginBottom: 12,
              paddingBottom: 10,
              borderBottomWidth: 1,
              borderBottomColor: '#f1f5f9',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 150 }}>
              <Text style={{ fontSize: 16 }}>⚡</Text>
              <Text
                style={{
                  fontFamily: 'Fraunces_700Bold',
                  color: '#1B4332',
                  fontSize: 14,
                  flexShrink: 1,
                }}
                numberOfLines={2}
              >
                Decisão da Inteligência Executiva
              </Text>
            </View>
            <View
              style={{
                backgroundColor: '#e8f5e9',
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: '#c8e6c9',
                alignSelf: 'flex-start',
                flexShrink: 0,
              }}
            >
              <Text
                style={{
                  fontFamily: 'Inter_700Bold',
                  color: '#1B4332',
                  fontSize: 10,
                  textTransform: 'uppercase',
                }}
              >
                {decision.action || 'EQUILÍBRIO'}
              </Text>
            </View>
          </View>

          <Text style={{ fontFamily: 'Inter_400Regular', color: '#334155', fontSize: 12.5, lineHeight: 18, marginBottom: 14 }}>
            {decision.reason ||
              'Tráfego pago operando com sustentação da base Google Ads e aquisição Meta alinhadas à capacidade de geração de demanda.'}
          </Text>

          {/* Quick Decision KPIs */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <View
              style={{
                flex: 1,
                minWidth: '46%',
                backgroundColor: '#f8fafc',
                padding: 10,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: '#e2e8f0',
              }}
            >
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>
                LTV / CAC
              </Text>
              <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 17, color: '#1B4332', marginTop: 2 }}>
                {decision.ltvCacRatio ? `${Number(decision.ltvCacRatio).toFixed(1)}x` : '3.8x'}
              </Text>
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 9.5, color: '#16a34a', marginTop: 2 }}>
                Saudável (&gt; 3x)
              </Text>
            </View>

            <View
              style={{
                flex: 1,
                minWidth: '46%',
                backgroundColor: '#f8fafc',
                padding: 10,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: '#e2e8f0',
              }}
            >
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>
                CAC B2B Médio
              </Text>
              <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 17, color: '#1B4332', marginTop: 2 }}>
                {formatBRL(metaCac || decision.cac || 80)}
              </Text>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 9.5, color: '#64748b', marginTop: 2 }}>
                Custo de Aquisição
              </Text>
            </View>

            <View
              style={{
                flex: 1,
                minWidth: '46%',
                backgroundColor: '#f8fafc',
                padding: 10,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: '#e2e8f0',
              }}
            >
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>
                LTV Estimado
              </Text>
              <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 17, color: '#1B4332', marginTop: 2 }}>
                {formatBRL(simulationResults?.projectedLTV || decision.ltv || 389.0)}
              </Text>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 9.5, color: '#64748b', marginTop: 2 }}>
                Ciclo de Vida Real
              </Text>
            </View>

            <View
              style={{
                flex: 1,
                minWidth: '46%',
                backgroundColor: '#f8fafc',
                padding: 10,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: '#e2e8f0',
              }}
            >
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>
                Base Pagante
              </Text>
              <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 17, color: '#16a34a', marginTop: 2 }}>
                {metaPagantes || simulationResults?.currentBase || 0} psis
              </Text>
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 9.5, color: '#16a34a', marginTop: 2 }}>
                Ativos na Plataforma
              </Text>
            </View>
          </View>
        </View>

        {/* ========================================================= */}
        {/* SIMULADOR DE ESCALA (ENGENHARIA REVERSA)                   */}
        {/* ========================================================= */}
        <View style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <View style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: '#e8f5e9', alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="trending-up" size={15} color="#1B4332" />
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 17, color: '#1e293b' }}>
              Simulador de Escala (Engenharia Reversa)
            </Text>
          </View>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#64748b', lineHeight: 16 }}>
            💡 <Text style={{ fontFamily: 'Inter_700Bold', color: '#475569' }}>Forecast Live:</Text> Projeção baseada nos dados atuais e janelas históricas móveis.
          </Text>
        </View>

        {/* Simulator Controls Card */}
        <View
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            padding: 16,
            marginBottom: 16,
            shadowColor: '#000',
            shadowOpacity: 0.03,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 1,
          }}
        >
          {/* Reinvestimento % */}
          <View style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569', textTransform: 'uppercase' }}>
                % Reinvestimento da Sobra
              </Text>
              <View style={{ backgroundColor: '#e8f5e9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#1B4332' }}>{reinvestRate}%</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[50, 80, 100, 120].map((rate) => {
                const isSelected = reinvestRate === rate;
                return (
                  <TouchableOpacity
                    key={rate}
                    onPress={() => setReinvestRate(rate)}
                    style={{
                      flex: 1,
                      paddingVertical: 7,
                      borderRadius: 999,
                      backgroundColor: isSelected ? '#1B4332' : '#f8fafc',
                      borderWidth: 1,
                      borderColor: isSelected ? '#1B4332' : '#cbd5e1',
                      alignItems: 'center',
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={{
                        fontFamily: isSelected ? 'Inter_700Bold' : 'Inter_600SemiBold',
                        fontSize: 11.5,
                        color: isSelected ? '#ffffff' : '#475569',
                      }}
                    >
                      {rate}%
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Aporte Adicional */}
          <View style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569', textTransform: 'uppercase' }}>
                Aporte Adicional (R$/mês)
              </Text>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#059669' }}>
                {formatBRL(extraCash)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[0, 1000, 2500, 5000].map((cash) => {
                const isSelected = extraCash === cash;
                return (
                  <TouchableOpacity
                    key={cash}
                    onPress={() => setExtraCash(cash)}
                    style={{
                      flex: 1,
                      paddingVertical: 7,
                      borderRadius: 999,
                      backgroundColor: isSelected ? '#10b981' : '#f8fafc',
                      borderWidth: 1,
                      borderColor: isSelected ? '#10b981' : '#cbd5e1',
                      alignItems: 'center',
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={{
                        fontFamily: isSelected ? 'Inter_700Bold' : 'Inter_600SemiBold',
                        fontSize: 11,
                        color: isSelected ? '#ffffff' : '#475569',
                      }}
                    >
                      {cash === 0 ? 'R$ 0' : `+${cash >= 1000 ? `${cash / 1000}k` : cash}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Toggle Orgânico */}
          <TouchableOpacity
            onPress={() => setIncludeOrganic(!includeOrganic)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: includeOrganic ? '#f0fdf4' : '#f8fafc',
              padding: 10,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: includeOrganic ? '#86efac' : '#e2e8f0',
              marginBottom: 14,
            }}
            activeOpacity={0.7}
          >
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                backgroundColor: includeOrganic ? '#1B4332' : '#ffffff',
                borderWidth: 1,
                borderColor: includeOrganic ? '#1B4332' : '#cbd5e1',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 8,
              }}
            >
              {includeOrganic && <Feather name="check" size={12} color="#ffffff" />}
            </View>
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11.5, color: '#334155', flex: 1 }}>
              Considerar Crescimento Orgânico (Dados Reais)
            </Text>
          </TouchableOpacity>

          {/* Horizonte de Projeção */}
          <View style={{ paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>
                Horizonte de Projeção
              </Text>
              <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#1e293b' }}>
                  Mês {selectedSimHorizon}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[1, 3, 6, 12].map((m) => {
                const isSelected = selectedSimHorizon === m;
                return (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setSelectedSimHorizon(m)}
                    style={{
                      flex: 1,
                      paddingVertical: 7,
                      borderRadius: 999,
                      backgroundColor: isSelected ? '#1B4332' : '#f8fafc',
                      borderWidth: 1,
                      borderColor: isSelected ? '#1B4332' : '#cbd5e1',
                      alignItems: 'center',
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={{
                        fontFamily: isSelected ? 'Inter_700Bold' : 'Inter_600SemiBold',
                        fontSize: 11.5,
                        color: isSelected ? '#ffffff' : '#475569',
                      }}
                    >
                      {m}M
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* ========================================================= */}
        {/* OS 7 CARDS DO SIMULADOR (PADRÃO PREMIUM YELO SEM BORDAS VAZANDO) */}
        {/* ========================================================= */}
        <View style={{ gap: 10, marginBottom: 20 }}>
          {/* CARD 1: MRR */}
          <View
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 20,
              borderWidth: 1,
              borderColor: '#e2e8f0',
              padding: 16,
              shadowColor: '#000',
              shadowOpacity: 0.02,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 1 },
              elevation: 1,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="dollar-sign" size={14} color="#2563eb" />
                </View>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>
                  MRR Projetado ({selectedSimHorizon}M)
                </Text>
              </View>
              {renderSimPctBadge(simulationResults?.projectedMRR || 0, simulationResults?.currentMrr || 0, 'vs hoje')}
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 24, color: '#0f172a', marginVertical: 4 }}>
              {formatBRL(simulationResults?.projectedMRR || 0)}
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#64748b', lineHeight: 16 }}>
              Receita recorrente estimada para o Mês {selectedSimHorizon} (hoje: {formatBRL(simulationResults?.currentMrr || 0)}/mês).
            </Text>
          </View>

          {/* CARD 2: BASE */}
          <View
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 20,
              borderWidth: 1,
              borderColor: '#e2e8f0',
              padding: 16,
              shadowColor: '#000',
              shadowOpacity: 0.02,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 1 },
              elevation: 1,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: '#e8f5e9', alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="users" size={14} color="#1B4332" />
                </View>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>
                  Base Projetada ({selectedSimHorizon}M)
                </Text>
              </View>
              {renderSimPctBadge(Math.floor(simulationResults?.projectedBase || 0), simulationResults?.currentBase || 0, 'vs hoje')}
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 24, color: '#0f172a', marginVertical: 4 }}>
              {Math.floor(simulationResults?.projectedBase || 0)} psicólogos
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#64748b', lineHeight: 16 }}>
              Total de psicólogos pagantes previstos na plataforma ao final do Mês {selectedSimHorizon}.
            </Text>
          </View>

          {/* CARD 3: META ADS */}
          <View
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 20,
              borderWidth: 1,
              borderColor: '#e2e8f0',
              padding: 16,
              shadowColor: '#000',
              shadowOpacity: 0.02,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 1 },
              elevation: 1,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="target" size={14} color="#10b981" />
                </View>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>
                  Meta Ads Recomendado ({selectedSimHorizon}M)
                </Text>
              </View>
              {(simulationResults?.projectedMeta || 0) <= 0
                ? renderSimBadgePill('↓ Motor travado', 'negative')
                : renderSimPctBadge(simulationResults?.projectedMeta || 0, simulationResults?.histMetaMonthlySpend || 0, 'vs hist. 30d', { neutralTrend: true })}
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 24, color: '#0f172a', marginVertical: 4 }}>
              {formatBRL(simulationResults?.projectedMeta || 0)}
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#64748b', lineHeight: 16 }}>
              ≈ {formatBRL((simulationResults?.projectedMeta || 0) / 30)}/dia para aquisição de psicólogos.
            </Text>
          </View>

          {/* CARD 4: GOOGLE ADS */}
          <View
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 20,
              borderWidth: 1,
              borderColor: '#e2e8f0',
              padding: 16,
              shadowColor: '#000',
              shadowOpacity: 0.02,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 1 },
              elevation: 1,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: '#fffbeb', alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="search" size={14} color="#f59e0b" />
                </View>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>
                  Custo Google ({selectedSimHorizon}M)
                </Text>
              </View>
              {(() => {
                const gCurr = simulationResults?.projectedGoogle || 0;
                const gM1 = simulationResults?.m1Google || 0;
                const mrrProj = simulationResults?.projectedMRR || 0;
                const gShare = mrrProj > 0 ? (gCurr / mrrProj) * 100 : 0;
                if (selectedSimHorizon === 1 || gM1 <= 0) {
                  const gTone: SimTone = gShare <= 35 ? 'positive' : gShare <= 60 ? 'warning' : 'negative';
                  return renderSimBadgePill(`${gShare.toFixed(1).replace('.', ',')}% do MRR`, gTone);
                }
                return renderSimPctBadge(gCurr, gM1, 'vs M1 (30d)', { inverseGood: true });
              })()}
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 24, color: '#0f172a', marginVertical: 4 }}>
              {formatBRL(simulationResults?.projectedGoogle || 0)}
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#64748b', lineHeight: 16 }}>
              ≈ {formatBRL((simulationResults?.projectedGoogle || 0) / 30)}/dia para sustentar contatos de pacientes no WhatsApp.
            </Text>
          </View>

          {/* Secondary 3 Cards in Row/Grid */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {/* LTV */}
            <View
              style={{
                flex: 1,
                backgroundColor: '#ffffff',
                borderRadius: 18,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                padding: 14,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 9.5, color: '#64748b', textTransform: 'uppercase' }}>
                  LTV Contribuição
                </Text>
                {(() => {
                  const pLtv = simulationResults?.projectedLTV || 0;
                  const m1Ltv = simulationResults?.m1Ltv || 0;
                  const pPb = simulationResults?.projectedPayback || 0;
                  const mCh = simulationResults?.monthlyChurn || 0;
                  const cMeta = simulationResults?.cacMeta || 0;
                  if (pLtv <= 0) return renderSimBadgePill('↓ Negativo', 'negative');
                  if (selectedSimHorizon > 1 && m1Ltv > 0 && Math.abs((pLtv - m1Ltv) / m1Ltv) >= 0.001) {
                    return renderSimPctBadge(pLtv, m1Ltv, 'vs M1');
                  }
                  const ratio = pPb > 0 && mCh > 0 ? 1 / (mCh * pPb) : cMeta > 0 ? pLtv / cMeta : null;
                  if (ratio !== null && isFinite(ratio)) {
                    const rTone: SimTone = ratio >= 3 ? 'positive' : ratio >= 1 ? 'warning' : 'negative';
                    const rArrow = ratio >= 3 ? '↑' : ratio >= 1 ? '=' : '↓';
                    return renderSimBadgePill(`${rArrow} ${ratio.toFixed(1).replace('.', ',')}× CAC`, rTone);
                  }
                  return null;
                })()}
              </View>
              <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#0f172a', marginTop: 2 }}>
                {formatBRL(simulationResults?.projectedLTV || 0)}
              </Text>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 9.5, color: '#64748b', marginTop: 2 }}>
                Lucro real por psi
              </Text>
            </View>

            {/* Payback */}
            <View
              style={{
                flex: 1,
                backgroundColor: '#ffffff',
                borderRadius: 18,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                padding: 14,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 9.5, color: '#64748b', textTransform: 'uppercase' }}>
                  CAC Payback
                </Text>
                {(() => {
                  const pPb = simulationResults?.projectedPayback || 0;
                  const m1Pb = simulationResults?.m1Payback || 0;
                  if (pPb <= 0) return renderSimBadgePill('↓ S/ retorno', 'negative');
                  if (selectedSimHorizon > 1 && m1Pb > 0 && Math.abs((pPb - m1Pb) / m1Pb) >= 0.001) {
                    return renderSimPctBadge(pPb, m1Pb, 'vs M1', { inverseGood: true });
                  }
                  if (pPb <= 12) return renderSimBadgePill('↓ ≤ 12m', 'positive');
                  if (pPb <= 24) return renderSimBadgePill('↑ 12–24m', 'warning');
                  return renderSimBadgePill('↑ > 24m', 'negative');
                })()}
              </View>
              <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#0f172a', marginTop: 2 }}>
                {(simulationResults?.projectedPayback || 0).toFixed(1)} meses
              </Text>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 9.5, color: '#64748b', marginTop: 2 }}>
                Break-even
              </Text>
            </View>
          </View>

          {/* Extrapolação */}
          <View
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 18,
              borderWidth: 1,
              borderColor: '#e2e8f0',
              padding: 14,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>
                Extrapolação Meta Ads
              </Text>
              {(() => {
                const ext = simulationResults?.projectedExtrapolation || 1;
                if (ext <= 2) return renderSimBadgePill('↓ Segura (≤ 2×)', 'positive');
                if (ext <= 5) return renderSimBadgePill('↑ Atenção (2–5×)', 'warning');
                return renderSimBadgePill('↑ Risco alto (> 5×)', 'negative');
              })()}
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 15, color: '#1e293b' }}>
              {(simulationResults?.projectedExtrapolation || 1).toFixed(1).replace('.', ',')}× histórico
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
              Projetado: {formatBRL(simulationResults?.projectedMeta || 0)}/mês • Histórico: {formatBRL(simulationResults?.histMetaMonthlySpend || 0)}/mês
            </Text>
          </View>

          {/* Motor Status Banner */}
          <View
            style={{
              backgroundColor: '#f0fdf4',
              borderRadius: 14,
              borderWidth: 1,
              borderColor: '#ccfbf1',
              padding: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 15 }}>✅</Text>
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11.5, color: '#0f766e', flex: 1, lineHeight: 16 }}>
              <Text style={{ fontFamily: 'Inter_700Bold' }}>Motor Ativo:</Text> Projeta a base de {simulationResults?.currentBase || 0} para {Math.floor(simulationResults?.projectedBase || 0)} assinantes em {selectedSimHorizon} meses com {reinvestRate}% de reinvestimento.
            </Text>
          </View>
        </View>

        {/* ========================================================= */}
        {/* DESEMPENHO B2B (META ADS / PSICÓLOGOS)                    */}
        {/* ========================================================= */}
        <View style={{ marginBottom: 12, marginTop: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <View style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="facebook" size={15} color="#1877f2" />
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 17, color: '#1e293b' }}>
              Desempenho B2B (Meta Ads)
            </Text>
          </View>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#64748b' }}>
            Aquisição de psicólogos, trials iniciados e conversão para assinantes.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {/* Gasto Meta */}
          <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Gasto Meta</Text>
              {renderTrendBadge(metaSpend, prevMetaSpend, 'neutral')}
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#1e293b' }}>{formatBRL(metaSpend)}</Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Anterior: {formatBRL(prevMetaSpend)}</Text>
          </View>

          {/* Trials Gerados */}
          <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Trials Gerados</Text>
              {renderTrendBadge(metaTrials, prevMetaTrials, false)}
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#1e293b' }}>{formatNumber(metaTrials)}</Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Anterior: {formatNumber(prevMetaTrials)}</Text>
          </View>

          {/* Novos Assinantes */}
          <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Novos Assinantes</Text>
              {renderTrendBadge(metaPagantes, prevMetaPagantes, false)}
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#10b981' }}>{formatNumber(metaPagantes)}</Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Anterior: {formatNumber(prevMetaPagantes)}</Text>
          </View>

          {/* CAC B2B */}
          <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>CAC B2B</Text>
              {renderTrendBadge(metaCac, prevMetaCac, true)}
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#1B4332' }}>{formatBRL(metaCac)}</Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Anterior: {formatBRL(prevMetaCac)}</Text>
          </View>

          {/* Impressões Meta */}
          <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Impressões</Text>
              {renderTrendBadge(metaImpressions, prevMetaImpressions, false)}
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#1e293b' }}>{formatNumber(metaImpressions)}</Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Anterior: {formatNumber(prevMetaImpressions)}</Text>
          </View>

          {/* Cliques Meta */}
          <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Cliques Meta</Text>
              {renderTrendBadge(metaClicks, prevMetaClicks, false)}
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#1e293b' }}>{formatNumber(metaClicks)}</Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Anterior: {formatNumber(prevMetaClicks)}</Text>
          </View>

          {/* Conversões Meta */}
          <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Conversões</Text>
              {renderTrendBadge(metaConversions, prevMetaConversions, false)}
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#10b981' }}>{formatNumber(metaConversions)}</Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Anterior: {formatNumber(prevMetaConversions)}</Text>
          </View>

          {/* CPC Meta */}
          <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>CPC Médio</Text>
              {renderTrendBadge(metaCpc, prevMetaCpc, true)}
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#1e293b' }}>{formatBRL(metaCpc)}</Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Anterior: {formatBRL(prevMetaCpc)}</Text>
          </View>

          {/* Custo/Conv. Meta (CPA) */}
          <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Custo/Conv. (CPA)</Text>
              {renderTrendBadge(metaCpa, prevMetaCpa, true)}
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#1e293b' }}>{formatBRL(metaCpa)}</Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Anterior: {formatBRL(prevMetaCpa)}</Text>
          </View>
        </View>

        {/* ========================================================= */}
        {/* DESEMPENHO B2C (GOOGLE ADS / PACIENTES)                   */}
        {/* ========================================================= */}
        <View style={{ marginBottom: 12, marginTop: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <View style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="globe" size={15} color="#ea4335" />
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 17, color: '#1e293b' }}>
              Desempenho B2C (Google Ads)
            </Text>
          </View>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#64748b' }}>
            Geração de pacientes, cliques no WhatsApp e contatos qualificados.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {/* Gasto Google */}
          <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Gasto Google</Text>
              {renderTrendBadge(googleSpend, prevGoogleSpend, 'neutral')}
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#1e293b' }}>{formatBRL(googleSpend)}</Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Anterior: {formatBRL(prevGoogleSpend)}</Text>
          </View>

          {/* Cliques WPP */}
          <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Cliques WPP</Text>
              {renderTrendBadge(googleClicks, prevGoogleClicks, false)}
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#1e293b' }}>{formatNumber(googleClicks)}</Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Anterior: {formatNumber(prevGoogleClicks)}</Text>
          </View>

          {/* Pacientes Fechados */}
          <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Fechados</Text>
              {renderTrendBadge(googleDeals, prevGoogleDeals, false)}
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#10b981' }}>{formatNumber(googleDeals)}</Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Anterior: {formatNumber(prevGoogleDeals)}</Text>
          </View>

          {/* CPL */}
          <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>CPL (Lead WPP)</Text>
              {renderTrendBadge(googleCpl, prevGoogleCpl, true)}
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#1B4332' }}>{formatBRL(googleCpl)}</Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Anterior: {formatBRL(prevGoogleCpl)}</Text>
          </View>

          {/* Impressões Google */}
          <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Impressões</Text>
              {renderTrendBadge(googleImpressions, prevGoogleImpressions, false)}
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#1e293b' }}>{formatNumber(googleImpressions)}</Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Anterior: {formatNumber(prevGoogleImpressions)}</Text>
          </View>

          {/* Cliques Google Totais */}
          <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Cliques Google</Text>
              {renderTrendBadge(googleAdClicks, prevGoogleAdClicks, false)}
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#1e293b' }}>{formatNumber(googleAdClicks)}</Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Anterior: {formatNumber(prevGoogleAdClicks)}</Text>
          </View>

          {/* Conversões Google */}
          <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Conversões Google</Text>
              {renderTrendBadge(googleConversions, prevGoogleConversions, false)}
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#10b981' }}>{formatNumber(googleConversions)}</Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Anterior: {formatNumber(prevGoogleConversions)}</Text>
          </View>

          {/* CPC Google */}
          <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>CPC Médio</Text>
              {renderTrendBadge(googleCpc, prevGoogleCpc, true)}
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#1e293b' }}>{formatBRL(googleCpc)}</Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Anterior: {formatBRL(prevGoogleCpc)}</Text>
          </View>

          {/* Custo/Conv. Google (CPA) */}
          <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Custo/Conv. Google</Text>
              {renderTrendBadge(googleCpa, prevGoogleCpa, true)}
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#1e293b' }}>{formatBRL(googleCpa)}</Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Anterior: {formatBRL(prevGoogleCpa)}</Text>
          </View>
        </View>

        {/* ========================================================= */}
        {/* EFICIÊNCIA COMERCIAL B2C (CONVERSÃO DE PACIENTES)         */}
        {/* ========================================================= */}
        <View style={{ marginBottom: 12, marginTop: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <View style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: '#e8f5e9', alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="activity" size={15} color="#1B4332" />
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 17, color: '#1e293b' }}>
              Eficiência Comercial B2C
            </Text>
          </View>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#64748b' }}>
            💡 <Text style={{ fontFamily: 'Inter_700Bold', color: '#475569' }}>Janela Fixa de 90 Dias:</Text> Para evitar distorções de amostras pequenas, as médias consideram os últimos 3 meses.
          </Text>
        </View>

        <View style={{ gap: 8, marginBottom: 20 }}>
          {/* Esforço de Fechamento */}
          <View style={{ backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>
                Esforço de Fechamento
              </Text>
              {renderTrendBadge(globalEffort, prevGlobalEffort, true)}
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 20, color: '#1e293b', marginTop: 4 }}>
              {globalEffort > 0 ? `${globalEffort.toFixed(1)} cliques / paciente` : 'N/A'}
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: '#64748b', marginTop: 2 }}>
              Média global: quantos cliques no WhatsApp são necessários para gerar 1 paciente fechado.
            </Text>
          </View>

          {/* Eficiência por Canal */}
          <View style={{ backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 14 }}>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
              Eficiência por Canal
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#1e293b' }}>
                  Ads: {adsEffort !== null ? adsEffort.toFixed(1) : 'N/A'}
                </Text>
                {adsEffort !== null && prevAdsEffort !== null ? renderTrendBadge(adsEffort, prevAdsEffort, true) : null}
              </View>
              <Text style={{ color: '#cbd5e1', fontSize: 14 }}>|</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#1e293b' }}>
                  Org: {orgEffort !== null ? orgEffort.toFixed(1) : 'N/A'}
                </Text>
                {orgEffort !== null && prevOrgEffort !== null ? renderTrendBadge(orgEffort, prevOrgEffort, true) : null}
              </View>
            </View>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: '#64748b', marginTop: 4 }}>
              Média de cliques necessários para gerar 1 paciente, dividida entre tráfego pago (Ads) e orgânico (SEO).
            </Text>
          </View>

          {/* Ticket Médio Top Performers */}
          <View style={{ backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>
                Ticket Médio Top Performers
              </Text>
              {renderTrendBadge(topTicket, prevTopTicket, false)}
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 20, color: '#10b981', marginTop: 4 }}>
              {topTicket > 0 ? formatBRL(topTicket) : 'R$ 0,00'}
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: '#64748b', marginTop: 2 }}>
              Valor médio da sessão cobrado pelos top 20% psicólogos que mais fecham pacientes.
            </Text>
          </View>

          {/* Tempo até o 1º Contato (TTFC) */}
          <View style={{ backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>
                Tempo até o 1º Contato (TTFC)
              </Text>
              {renderTrendBadge(
                ttfcMedian !== null ? ttfcMedian : 0,
                prevEfficiency?.ttfcData?.median ? Number(prevEfficiency.ttfcData.median) : 0,
                true
              )}
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 20, color: '#1B4332', marginTop: 4 }}>
              {ttfcMedian !== null ? `${ttfcMedian.toFixed(1)} dias` : 'N/A'}
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: '#64748b', marginTop: 2 }}>
              Média: {efficiency.ttfcData?.mean ? `${Number(efficiency.ttfcData.mean).toFixed(1)} dias` : 'N/A'} · amostra: {efficiency.ttfcData?.sample ?? 0} profissionais
            </Text>
          </View>

          {/* TTV (1º Paciente Iniciado) */}
          <View style={{ backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>
                TTV (1º Paciente Iniciado)
              </Text>
              {renderTrendBadge(
                ttvMedian !== null ? ttvMedian : 0,
                prevEfficiency?.ttvData?.median ? Number(prevEfficiency.ttvData.median) : 0,
                true
              )}
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 20, color: '#1e293b', marginTop: 4 }}>
              {ttvMedian !== null ? `${ttvMedian.toFixed(1)} dias` : 'N/A'}
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: '#64748b', marginTop: 2 }}>
              Média: {efficiency.ttvData?.mean ? `${Number(efficiency.ttvData.mean).toFixed(1)} dias` : 'N/A'} · amostra: {efficiency.ttvData?.sample ?? 0} profissionais (PROXY)
            </Text>
          </View>
        </View>

        {/* ========================================================= */}
        {/* TRÁFEGO E SEO (GA4 & SEARCH CONSOLE)                      */}
        {/* ========================================================= */}
        <View style={{ marginBottom: 12, marginTop: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <View style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="bar-chart-2" size={15} color="#3b82f6" />
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 17, color: '#1e293b' }}>
              Tráfego e SEO (Analytics & GSC)
            </Text>
          </View>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#64748b' }}>
            Desempenho de audiência orgânica e engajamento no portal.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {/* Sessões GA4 */}
          <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Sessões GA4</Text>
              {prevGa4 ? renderTrendBadge(Number(ga4?.sessions || 0), Number(prevGa4?.sessions || 0), false) : null}
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#1e293b' }}>
              {formatNumber(ga4?.sessions || 0)}
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: '#64748b', marginTop: 2 }}>
              Usuários: {formatNumber(ga4?.users || 0)}
            </Text>
          </View>

          {/* Engajamento GA4 */}
          <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>
                Engajamento
              </Text>
              {prevGa4EngagementRate !== null ? renderTrendBadge(ga4EngagementRate, prevGa4EngagementRate, false) : null}
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#10b981' }}>
              {ga4 ? `${ga4EngagementRate.toFixed(1).replace('.', ',')}%` : '0%'}
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: '#64748b', marginTop: 2 }}>
              Pageviews: {formatNumber(ga4?.pageviews || 0)}
            </Text>
          </View>

          {/* Cliques GSC */}
          <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Cliques GSC</Text>
              {prevGsc ? renderTrendBadge(Number(gsc?.clicks || 0), Number(prevGsc?.clicks || 0), false) : null}
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#1e293b' }}>
              {formatNumber(gsc?.clicks || 0)}
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: '#64748b', marginTop: 2 }}>
              Impr: {formatNumber(gsc?.impressions || 0)}
            </Text>
          </View>

          {/* Posição Média GSC */}
          <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>
                Posição Média
              </Text>
              {prevGsc ? renderTrendBadge(Number(gsc?.position || 0), Number(prevGsc?.position || 0), true) : null}
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#1B4332' }}>
              {gsc ? `${Number(gsc.position || 0).toFixed(1).replace('.', ',')}º` : '0º'}
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: '#64748b', marginTop: 2 }}>
              CTR: {gsc ? `${(Number(gsc.ctr || 0) * 100).toFixed(2).replace('.', ',')}%` : '0%'}
            </Text>
          </View>
        </View>

        {/* ========================================================= */}
        {/* DADOS USADOS PELA INTELIGÊNCIA (TRANSPARÊNCIA)            */}
        {/* ========================================================= */}
        <View style={{ marginBottom: 12, marginTop: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <View style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="shield" size={15} color="#475569" />
            </View>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 17, color: '#1e293b' }}>
              Dados Usados pela Inteligência (Transparência)
            </Text>
          </View>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#64748b' }}>
            Auditoria dos dados comparativos usados nos algoritmos e decisões.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {/* B2B (Meta) */}
          {renderDbgCard('Gasto Meta', metaSpend, prevMetaSpend, 'currency', 'neutral')}
          {renderDbgCard('Trials (Meta Ads)', metaTrials, prevMetaTrials, 'number', false)}
          {renderDbgCard('Assinantes (Meta)', metaPagantes, prevMetaPagantes, 'number', false)}
          {renderDbgCard('CAC B2B', metaCac, prevMetaCac, 'currency', true)}
          {renderDbgCard(
            'Payback (Receita)',
            decision.paybackMonths || 0,
            prevDecision.paybackMonths || 0,
            'months',
            true
          )}
          {renderDbgCard(
            'Churn (Meta Ads)',
            b2b.meta_churn_rate || 0,
            prevPlatform.b2b?.meta_churn_rate || 0,
            'percent',
            true
          )}
          {dashboardData?.simulator?.churn?.type === 'ASSUMED'
            ? renderDbgCard(
                'Churn Geral',
                dashboardData.simulator.churn.value || 0.05,
                0,
                'percent',
                true,
                'Hipótese conservadora',
                true
              )
            : renderDbgCard(
                'Churn Geral',
                b2b.global_churn_rate || 0,
                prevPlatform.b2b?.global_churn_rate || 0,
                'percent',
                true,
                undefined,
                true
              )}

          {/* B2C (Google) */}
          {renderDbgCard('Gasto Google', googleSpend, prevGoogleSpend, 'currency', 'neutral')}
          {renderDbgCard('Cliques WPP (Google)', googleClicks, prevGoogleClicks, 'number', false)}
          {renderDbgCard('Pacientes Fechados', googleDeals, prevGoogleDeals, 'number', false)}
          {renderDbgCard('CPL B2C', googleCpl, prevGoogleCpl, 'currency', true)}
        </View>
      </ScrollView>

      <YeloToast
        message={toastMessage}
        onDismiss={() => setToastMessage(null)}
        type={toastType}
      />
    </View>
  );
}
