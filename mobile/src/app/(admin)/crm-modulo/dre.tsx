import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  Share,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Svg, { Rect, Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import api from '../../../services/api';
import YeloToast from '../../../components/YeloToast';
import NativeSelectMenu from '../../../components/NativeSelectMenu';

type TabKey = 'mensal' | 'anual' | 'despesas' | 'fiscal';

const DRE_TAB_OPTIONS: { key: TabKey; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'mensal', label: 'DRE Mensal & Evolução', icon: 'bar-chart-2' },
  { key: 'anual', label: 'DRE Anual (Jan–Dez)', icon: 'calendar' },
  { key: 'despesas', label: 'Despesas & Lançamentos', icon: 'file-text' },
  { key: 'fiscal', label: 'Fiscal, Fechamento & Razão', icon: 'shield' },
];

const MONTH_OPTIONS = [
  { label: 'Janeiro', short: 'Jan', value: '1' },
  { label: 'Fevereiro', short: 'Fev', value: '2' },
  { label: 'Março', short: 'Mar', value: '3' },
  { label: 'Abril', short: 'Abr', value: '4' },
  { label: 'Maio', short: 'Mai', value: '5' },
  { label: 'Junho', short: 'Jun', value: '6' },
  { label: 'Julho', short: 'Jul', value: '7' },
  { label: 'Agosto', short: 'Ago', value: '8' },
  { label: 'Setembro', short: 'Set', value: '9' },
  { label: 'Outubro', short: 'Out', value: '10' },
  { label: 'Novembro', short: 'Nov', value: '11' },
  { label: 'Dezembro', short: 'Dez', value: '12' },
];

const TAX_REGIME_OPTIONS = [
  { label: 'Simples Nacional', value: 'SIMPLES_NACIONAL' },
  { label: 'MEI', value: 'MEI' },
  { label: 'Lucro Presumido', value: 'LUCRO_PRESUMIDO' },
  { label: 'Lucro Real', value: 'LUCRO_REAL' },
];

const PROVIDER_OPTIONS = [
  { label: 'Outro / Manual', value: 'OTHER' },
  { label: 'Render / Cloud', value: 'RENDER' },
  { label: 'Meta Ads (Facebook/IG)', value: 'META_ADS' },
  { label: 'Google Ads', value: 'GOOGLE_ADS' },
  { label: 'Contabilidade', value: 'ACCOUNTING' },
  { label: 'Ferramentas / SaaS', value: 'SOFTWARE' },
  { label: 'Pró-labore / Equipe', value: 'PAYROLL' },
  { label: 'Guia Imposto (DAS/DARF)', value: 'TAX_OFFICE' },
];

const KPI_TOOLTIPS = {
  grossRevenue: {
    title: 'Receita Bruta',
    text: 'Total cobrado das assinaturas pagas pelos psicólogos no mês selecionado, antes de descontar impostos, estornos ou taxas do Asaas.',
  },
  totalDeductions: {
    title: 'Deduções & Impostos',
    text: 'Valores abatidos logo na saída da receita: devoluções/estornos a clientes e impostos sobre faturamento (como DAS do Simples/MEI ou ISS).',
  },
  netRevenue: {
    title: 'Receita Líquida',
    text: 'Dinheiro que efetivamente entra na operação após pagar impostos sobre vendas e descontar estornos. É a base de 100% da DRE.',
  },
  costsPlusOpex: {
    title: 'Custos + Despesas (OPEX)',
    text: 'Soma de tudo que custou para operar o negócio no mês: tarifas do Asaas, servidores/APIs (CSP), tráfego pago (Ads), pessoal e despesas fixas.',
  },
  netIncome: {
    title: 'Lucro / Prejuízo Líquido',
    text: 'Resultado final que realmente sobra (ou falta) no mês depois de pagar absolutamente todos os impostos, custos e despesas da operação.',
  },
};

const COL_TOOLTIPS = {
  code: {
    title: 'Cód.',
    text: 'Código hierárquico da conta contábil (ex.: 1 = grupo principal, 1.1 = subconta).',
  },
  structure: {
    title: 'Estrutura Contábil (DRE)',
    text: 'Grupos e subcontas da DRE. Toque em qualquer título (1, 2, 4, 6 ou 8) para recolher ou expandir suas subcontas.',
  },
  selectedValue: {
    title: 'Mês Atual',
    text: 'Valor apurado no mês selecionado segundo o regime (Competência ou Caixa). Parênteses indicam deduções, custos ou despesas.',
  },
  avPct: {
    title: 'AV % (Análise Vertical)',
    text: 'Participação percentual de cada linha sobre a Receita Operacional Líquida (linha 3 = 100%) no mês selecionado.',
  },
  prevValue: {
    title: 'Mês Anterior',
    text: 'Valor da mesma conta no mês imediatamente anterior, usado como referência comparativa.',
  },
  ahPct: {
    title: 'AH % (Análise Horizontal)',
    text: 'Variação percentual em relação ao mês anterior ((Mês Atual − Mês Anterior) ÷ |Mês Anterior|). Em despesas, aumento fica em vermelho e queda em verde.',
  },
  annualTotal: {
    title: 'Total Acumulado no Ano',
    text: 'Soma acumulada de janeiro a dezembro dentro do ano-calendário selecionado.',
  },
  annualAvPct: {
    title: 'AV Ano %',
    text: 'Peso percentual de cada linha sobre a Receita Operacional Líquida acumulada no ano (linha 3 = 100%).',
  },
};

function fmtCurrency(val: number = 0): string {
  const num = Number(val || 0);
  try {
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  } catch {
    return `R$ ${num.toFixed(2).replace('.', ',')}`;
  }
}

function fmtCompactCurrency(val: number = 0): string {
  const n = Number(val || 0);
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1000) {
    return `${sign}R$${(abs / 1000).toFixed(1).replace('.', ',')}k`;
  }
  return `${sign}R$${Math.round(abs)}`;
}

function fmtSignedCurrency(val: number = 0, sign: string = ''): string {
  const absFormatted = fmtCurrency(Math.abs(Number(val || 0)));
  if (sign === '-' && Number(val || 0) > 0) return `(${absFormatted})`;
  return fmtCurrency(val);
}

function fmtPct(val: number | null | undefined, signed: boolean = false): string {
  if (val === null || val === undefined || !Number.isFinite(Number(val))) return '—';
  const n = Number(val);
  const prefix = signed && n > 0 ? '+' : '';
  return `${prefix}${n.toFixed(1).replace('.', ',')}%`;
}

function fmtMonthKeyShort(monthKey?: string): string {
  if (!monthKey || typeof monthKey !== 'string') return 'Mês Ant.';
  const parts = monthKey.split('-');
  if (parts.length !== 2) return monthKey;
  const idx = parseInt(parts[1], 10) - 1;
  const short = MONTH_OPTIONS[idx]?.short || parts[1];
  return `${short}/${parts[0]}`;
}

export default function AdminDreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const nowBrt = useMemo(() => {
    const str = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const [y, m] = str.split('-').map(Number);
    return { year: y, month: m, monthStr: `${y}-${String(m).padStart(2, '0')}` };
  }, []);

  const [year, setYear] = useState<number>(nowBrt.year);
  const [month, setMonth] = useState<number>(nowBrt.month);
  const [regime, setRegime] = useState<'accrual' | 'cash'>('accrual');
  const [activeTab, setActiveTab] = useState<TabKey>('mensal');

  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [syncingAds, setSyncingAds] = useState<boolean>(false);
  const [exportingKey, setExportingKey] = useState<string | null>(null);

  // Collapsible DRE groups
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Selected chart month index
  const [selectedChartIdx, setSelectedChartIdx] = useState<number | null>(null);

  // Expenses filter & pagination
  const [expGroupFilter, setExpGroupFilter] = useState<string>('ALL');
  const [expPage, setExpPage] = useState<number>(1);
  const [revScopeFilter, setRevScopeFilter] = useState<'month' | 'year'>('month');
  const [revSearch, setRevSearch] = useState<string>('');
  const [revPage, setRevPage] = useState<number>(1);

  // Recurring Rule Form state
  const [recName, setRecName] = useState<string>('');
  const [recAmount, setRecAmount] = useState<string>('');
  const [recGroup, setRecGroup] = useState<string>('OPEX_ADMIN');
  const [recProvider, setRecProvider] = useState<string>('RENDER');
  const [recStartMonth, setRecStartMonth] = useState<string>(nowBrt.monthStr);
  const [savingRecurring, setSavingRecurring] = useState<boolean>(false);

  // Expense Modal state
  const [expenseModalVisible, setExpenseModalVisible] = useState<boolean>(false);
  const [expEditId, setExpEditId] = useState<string | null>(null);
  const [expName, setExpName] = useState<string>('');
  const [expAmount, setExpAmount] = useState<string>('');
  const [expGroup, setExpGroup] = useState<string>('OPEX_ADMIN');
  const [expDate, setExpDate] = useState<string>(`${nowBrt.monthStr}-01`);
  const [expCategory, setExpCategory] = useState<string>('');
  const [expProvider, setExpProvider] = useState<string>('OTHER');
  const [expRepeatMonths, setExpRepeatMonths] = useState<string>('1');
  const [expDoc, setExpDoc] = useState<string>('');
  const [expNotes, setExpNotes] = useState<string>('');
  const [savingExpense, setSavingExpense] = useState<boolean>(false);

  // Fiscal Config Modal state
  const [fiscalModalVisible, setFiscalModalVisible] = useState<boolean>(false);
  const [cfgLegalName, setCfgLegalName] = useState<string>('');
  const [cfgCnpj, setCfgCnpj] = useState<string>('');
  const [cfgTaxRegime, setCfgTaxRegime] = useState<string>('SIMPLES_NACIONAL');
  const [cfgDefaultVarTax, setCfgDefaultVarTax] = useState<string>('');
  const [cfgDefaultFixedTax, setCfgDefaultFixedTax] = useState<string>('');
  const [cfgMonthVarTax, setCfgMonthVarTax] = useState<string>('');
  const [cfgMonthFixedTax, setCfgMonthFixedTax] = useState<string>('');
  const [cfgMonthProfitTax, setCfgMonthProfitTax] = useState<string>('');
  const [cfgMonthNotes, setCfgMonthNotes] = useState<string>('');
  const [savingFiscal, setSavingFiscal] = useState<boolean>(false);

  // Export & Tooltip Modals
  const [exportModalVisible, setExportModalVisible] = useState<boolean>(false);
  const [activeTooltip, setActiveTooltip] = useState<{ title: string; text: string } | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
  }, []);

  const loadDreData = useCallback(
    async (forceRefresh: boolean = false) => {
      try {
        const params: Record<string, string> = {
          year: String(year),
          month: String(month),
          regime,
        };
        if (forceRefresh) params.refresh = '1';
        const res = await api.get('/api/admin/dre', { params });
        if (res.data) {
          setReport(res.data);
          setSelectedChartIdx((prev) => (prev === null ? (res.data.meta?.selectedMonth || month) - 1 : prev));
        }
      } catch (err: any) {
        console.error('[DRE Mobile] Erro ao carregar DRE:', err);
        showToast(err?.response?.data?.error || 'Erro ao carregar DRE contábil.', 'error');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [year, month, regime, showToast]
  );

  useEffect(() => {
    setLoading(true);
    loadDreData(false);
  }, [loadDreData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDreData(true);
  };

  // Options for dropdowns
  const yearOptions = useMemo(() => {
    const yrs: number[] = report?.meta?.availableYears || [nowBrt.year - 1, nowBrt.year];
    return yrs.map((y) => ({ label: String(y), value: String(y) }));
  }, [report?.meta?.availableYears, nowBrt.year]);

  const dreGroupOptions = useMemo(() => {
    const opts = report?.dreGroupOptions || [
      { value: 'OPEX_ADMIN', label: '6.3 Despesas Administrativas, Cloud & Contabilidade (OPEX Fixo)' },
      { value: 'COGS', label: '4.2 Custos Diretos dos Serviços (CSP / APIs / IA)' },
      { value: 'OPEX_MARKETING', label: '6.1 Despesas Comerciais & Marketing (Tráfego Pago)' },
      { value: 'OPEX_PERSONNEL', label: '6.2 Despesas com Pessoal, Pró-labore & Terceiros' },
      { value: 'DEDUCTION_TAX', label: '2.2 Impostos sobre Faturamento (DAS / Simples / ISS)' },
      { value: 'FINANCIAL_EXPENSE', label: '8.2 Despesas Financeiras / Juros / Tarifas' },
      { value: 'FINANCIAL_INCOME', label: '8.1 Receitas Financeiras / Rendimentos' },
      { value: 'PROFIT_TAX', label: '10. Tributos sobre o Lucro (IRPJ / CSLL)' },
    ];
    return opts.map((g: any) => ({ label: g.shortLabel || g.label, value: g.value }));
  }, [report?.dreGroupOptions]);

  // Collapsible groups logic
  const dreRows: any[] = report?.dreRows || [];
  const childCountMap = useMemo(() => {
    const map = new Map<string, number>();
    dreRows.forEach((r) => {
      const code = String(r.code || '');
      if (code.includes('.')) {
        const parent = code.split('.')[0];
        map.set(parent, (map.get(parent) || 0) + 1);
      }
    });
    return map;
  }, [dreRows]);

  const allGroupCodes = useMemo(() => Array.from(childCountMap.keys()), [childCountMap]);
  const allCollapsed = allGroupCodes.length > 0 && allGroupCodes.every((c) => collapsedGroups.has(c));

  const toggleGroupCollapse = (code: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleCollapseAll = () => {
    if (allCollapsed) {
      setCollapsedGroups(new Set());
    } else {
      setCollapsedGroups(new Set(allGroupCodes));
    }
  };

  // KPI Trend helper (parity with Web formatKpiTrend)
  const renderKpiTrendPill = (
    metricKey: string,
    actualCurr: number,
    actualPrev: number,
    inverseGood: boolean
  ) => {
    const cmp = report?.kpiComparison;
    const isPaceMode = cmp && cmp.mode === 'PACE_PROJECTION';
    const currVal = isPaceMode && cmp.projected && Number.isFinite(Number(cmp.projected[metricKey]))
      ? Number(cmp.projected[metricKey])
      : Number(actualCurr || 0);
    const prevVal = isPaceMode && cmp.previous && Number.isFinite(Number(cmp.previous[metricKey]))
      ? Number(cmp.previous[metricKey])
      : Number(actualPrev || 0);

    const suffix = isPaceMode ? 'ritmo' : 'm/m';
    let label = `— ${suffix}`;
    let tone: 'pos' | 'neg' | 'neutral' = 'neutral';

    if (Math.abs(prevVal) >= 0.01) {
      const pct = ((currVal - prevVal) / Math.abs(prevVal)) * 100;
      if (Math.abs(pct) < 0.05) {
        label = `0,0% ${suffix}`;
      } else {
        const isUp = pct > 0;
        const isGood = inverseGood ? !isUp : isUp;
        tone = isGood ? 'pos' : 'neg';
        const arrow = isUp ? '▲' : '▼';
        const sign = isUp ? '+' : '';
        label = `${arrow} ${sign}${pct.toFixed(1).replace('.', ',')}% ${suffix}`;
      }
    } else if (Math.abs(currVal) >= 0.01) {
      const isUp = currVal > 0;
      const isGood = inverseGood ? !isUp : isUp;
      tone = isGood ? 'pos' : 'neg';
      label = isUp ? (isPaceMode ? '▲ novo ritmo' : '▲ novo') : (isPaceMode ? '▼ ritmo' : '▼ queda');
    }

    const styles = {
      pos: { bg: '#ecfdf5', border: '#a7f3d0', color: '#047857' },
      neg: { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c' },
      neutral: { bg: '#f8fafc', border: '#e2e8f0', color: '#475569' },
    }[tone];

    return (
      <View
        style={{
          backgroundColor: styles.bg,
          borderColor: styles.border,
          borderWidth: 1,
          borderRadius: 999,
          paddingHorizontal: 7,
          paddingVertical: 2,
        }}
      >
        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: styles.color }}>{label}</Text>
      </View>
    );
  };

  // Actions
  const handleSyncAds = async () => {
    try {
      setSyncingAds(true);
      const res = await api.post('/api/admin/dre/sync-ads', { year, month });
      showToast(res.data?.message || 'Gastos de Meta Ads e Google Ads sincronizados!');
      await loadDreData(true);
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Falha ao sincronizar Ads.', 'error');
    } finally {
      setSyncingAds(false);
    }
  };

  const handleToggleMonthLock = (monthKey: string, action: 'close' | 'reopen') => {
    const promptMsg =
      action === 'close'
        ? `Fechar contabilmente ${monthKey}? Lançamentos e edições ficarão travados até reabertura.`
        : `Reabrir o mês contábil ${monthKey} para novos lançamentos/ajustes?`;
    Alert.alert(action === 'close' ? 'Fechar Mês Contábil' : 'Reabrir Mês Contábil', promptMsg, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: action === 'close' ? 'Fechar Mês' : 'Reabrir',
        style: action === 'close' ? 'destructive' : 'default',
        onPress: async () => {
          try {
            const res = await api.post('/api/admin/dre/fiscal-config', { monthYear: monthKey, action });
            showToast(res.data?.message || 'Status do mês atualizado.');
            await loadDreData();
          } catch (err: any) {
            showToast(err?.response?.data?.error || 'Erro ao alterar fechamento mensal.', 'error');
          }
        },
      },
    ]);
  };

  // Fiscal Config Modal open + save
  const openFiscalModal = () => {
    if (!report) return;
    const { company, selectedMonthSummary } = report;
    const cfg = selectedMonthSummary?.taxConfig || {};

    setCfgLegalName(company?.legalName || '');
    setCfgCnpj(company?.cnpj || '');
    setCfgTaxRegime(company?.taxRegime || 'SIMPLES_NACIONAL');
    setCfgDefaultVarTax(
      company?.defaultTaxVariableRate !== null && company?.defaultTaxVariableRate !== undefined
        ? (Number(company.defaultTaxVariableRate) * 100).toFixed(2)
        : ''
    );
    setCfgDefaultFixedTax(
      company?.defaultTaxFixedMonthly !== null && company?.defaultTaxFixedMonthly !== undefined
        ? Number(company.defaultTaxFixedMonthly).toFixed(2)
        : ''
    );

    setCfgMonthVarTax(
      cfg.taxSource === 'MONTH_SNAPSHOT' && cfg.variableRate !== null
        ? (Number(cfg.variableRate) * 100).toFixed(2)
        : ''
    );
    setCfgMonthFixedTax(
      cfg.taxSource === 'MONTH_SNAPSHOT' && cfg.fixedMonthly !== null
        ? Number(cfg.fixedMonthly).toFixed(2)
        : ''
    );
    setCfgMonthProfitTax(cfg.profitTaxRate ? (Number(cfg.profitTaxRate) * 100).toFixed(2) : '');
    setCfgMonthNotes(cfg.notes || '');
    setFiscalModalVisible(true);
  };

  const submitFiscalConfig = async (action: 'save' | 'close') => {
    if (!report) return;
    const pctToDecimal = (val: string) => {
      const clean = val.trim().replace(',', '.');
      if (!clean) return '';
      const num = Number(clean);
      return Number.isFinite(num) ? num / 100 : '';
    };
    const numOrEmpty = (val: string) => {
      const clean = val.trim().replace(',', '.');
      if (!clean) return '';
      const num = Number(clean);
      return Number.isFinite(num) ? num : '';
    };

    try {
      setSavingFiscal(true);
      const res = await api.post('/api/admin/dre/fiscal-config', {
        companyLegalName: cfgLegalName.trim(),
        companyCnpj: cfgCnpj.trim(),
        taxRegime: cfgTaxRegime,
        defaultTaxVariableRate: pctToDecimal(cfgDefaultVarTax),
        defaultTaxFixedMonthly: numOrEmpty(cfgDefaultFixedTax),
        monthYear: report.meta.selectedMonthKey,
        monthTaxVariableRate: pctToDecimal(cfgMonthVarTax),
        monthTaxFixedMonthly: numOrEmpty(cfgMonthFixedTax),
        monthProfitTaxRate: pctToDecimal(cfgMonthProfitTax),
        monthNotes: cfgMonthNotes.trim(),
        action,
      });
      showToast(res.data?.message || 'Configurações fiscais atualizadas!');
      setFiscalModalVisible(false);
      await loadDreData();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Erro ao salvar configuração fiscal.', 'error');
    } finally {
      setSavingFiscal(false);
    }
  };

  // Recurring Rules
  const handleAddRecurringRule = async () => {
    const cleanName = recName.trim();
    const amountNum = Number(recAmount.trim().replace(',', '.'));
    const startMk = recStartMonth.trim();
    if (!cleanName || !Number.isFinite(amountNum) || amountNum <= 0 || !/^\d{4}-\d{2}$/.test(startMk)) {
      showToast('Preencha descrição, valor (> 0) e competência inicial (AAAA-MM).', 'error');
      return;
    }

    const currentRules = Array.isArray(report?.autoRecurringExpenses)
      ? [...report.autoRecurringExpenses]
      : [];
    currentRules.push({
      id: `rule-${Date.now()}`,
      name: cleanName,
      amount: amountNum,
      dreGroup: recGroup,
      category: recProvider === 'RENDER' ? 'Cloud / Infraestrutura' : cleanName,
      provider: recProvider,
      startMonth: startMk,
      active: true,
    });

    try {
      setSavingRecurring(true);
      const res = await api.post('/api/admin/dre/recurring-rules', {
        rules: currentRules,
        targetYear: year,
      });
      showToast(`Automação "${cleanName}" ativada (${res.data?.appliedCount || 0} lançamento(s))!`);
      setRecName('');
      setRecAmount('');
      await loadDreData();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Erro ao salvar automação.', 'error');
    } finally {
      setSavingRecurring(false);
    }
  };

  const handleDeleteRecurringRule = (ruleId: string, ruleName: string) => {
    Alert.alert(
      'Remover Automação',
      `Desativar "${ruleName}" para os próximos meses? (Lançamentos antigos permanecem salvos.)`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desativar',
          style: 'destructive',
          onPress: async () => {
            try {
              const currentRules = (report?.autoRecurringExpenses || []).filter((r: any) => r.id !== ruleId);
              await api.post('/api/admin/dre/recurring-rules', {
                rules: currentRules,
                targetYear: year,
              });
              showToast('Automação recorrente removida.');
              await loadDreData();
            } catch (err: any) {
              showToast(err?.response?.data?.error || 'Erro ao remover automação.', 'error');
            }
          },
        },
      ]
    );
  };

  // Manual Expenses Modal & Actions
  const openAddExpenseModal = () => {
    const mk = report?.meta?.selectedMonthKey || nowBrt.monthStr;
    setExpEditId(null);
    setExpName('');
    setExpAmount('');
    setExpGroup('OPEX_ADMIN');
    setExpDate(`${mk}-01`);
    setExpCategory('');
    setExpProvider('OTHER');
    setExpRepeatMonths('1');
    setExpDoc('');
    setExpNotes('');
    setExpenseModalVisible(true);
  };

  const openEditExpenseModal = (exp: any) => {
    if (!exp || exp.isVirtual) return;
    setExpEditId(String(exp.id));
    setExpName(exp.name || '');
    setExpAmount(Number(exp.amount || 0).toFixed(2));
    setExpGroup(exp.dreGroup || 'OPEX_ADMIN');
    setExpDate(exp.expenseDate || `${exp.monthYear}-01`);
    setExpCategory(exp.category || '');
    setExpProvider(exp.provider || 'OTHER');
    setExpRepeatMonths('1');
    setExpDoc(exp.documentNumber || '');
    setExpNotes(exp.notes || '');
    setExpenseModalVisible(true);
  };

  const submitExpenseModal = async () => {
    const cleanName = expName.trim();
    const amountNum = Number(expAmount.trim().replace(',', '.'));
    if (!cleanName || !Number.isFinite(amountNum) || amountNum < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(expDate.trim())) {
      showToast('Preencha descrição, valor válido e data (AAAA-MM-DD).', 'error');
      return;
    }

    const payload = {
      name: cleanName,
      amount: amountNum,
      dreGroup: expGroup,
      expenseDate: expDate.trim(),
      category: expCategory.trim(),
      provider: expProvider,
      documentNumber: expDoc.trim(),
      notes: expNotes.trim(),
      repeatMonths: Math.max(1, Math.min(12, parseInt(expRepeatMonths, 10) || 1)),
    };

    try {
      setSavingExpense(true);
      if (expEditId) {
        await api.put(`/api/admin/dre/expenses/${encodeURIComponent(expEditId)}`, payload);
        showToast('Despesa atualizada com sucesso!');
      } else {
        const res = await api.post('/api/admin/dre/expenses', payload);
        const createdCount = res.data?.created?.length || 1;
        showToast(
          createdCount > 1
            ? `${createdCount} despesas recorrentes lançadas na DRE!`
            : 'Despesa lançada na DRE!'
        );
      }
      setExpenseModalVisible(false);
      await loadDreData();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Erro ao salvar despesa.', 'error');
    } finally {
      setSavingExpense(false);
    }
  };

  const handleDeleteExpense = (exp: any) => {
    if (!exp || exp.isVirtual) return;
    Alert.alert('Excluir Lançamento', `Deseja remover "${exp.name}" (${fmtCurrency(exp.amount)}) da DRE?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/api/admin/dre/expenses/${encodeURIComponent(String(exp.id))}`);
            showToast('Despesa removida.');
            await loadDreData();
          } catch (err: any) {
            showToast(err?.response?.data?.error || 'Erro ao remover despesa.', 'error');
          }
        },
      },
    ]);
  };

  const handleCopyPreviousFixed = () => {
    const targetMk = report?.meta?.selectedMonthKey || nowBrt.monthStr;
    Alert.alert(
      'Copiar Despesas Fixas',
      `Repetir despesas manuais do mês anterior para ${targetMk}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Copiar',
          onPress: async () => {
            try {
              const res = await api.post('/api/admin/dre/expenses/copy-previous', {
                targetMonthYear: targetMk,
              });
              showToast(res.data?.message || 'Despesas copiadas com sucesso!');
              await loadDreData();
            } catch (err: any) {
              showToast(err?.response?.data?.error || 'Erro ao copiar despesas.', 'error');
            }
          },
        },
      ]
    );
  };

  // Export Actions via FileSystem + Sharing
  const handleExport = async (kind: 'excel' | 'annual_csv' | 'monthly_csv' | 'rev_csv' | 'exp_csv') => {
    const qs = `year=${year}&month=${month}&regime=${regime}`;
    const map: Record<string, { url: string; filename: string; mime: string }> = {
      excel: {
        url: `/api/admin/dre/export/excel?${qs}`,
        filename: `DRE_Contabil_Yelo_${year}.xls`,
        mime: 'application/vnd.ms-excel',
      },
      annual_csv: {
        url: `/api/admin/dre/export/csv?${qs}&type=annual`,
        filename: `DRE_Anual_${year}.csv`,
        mime: 'text/csv',
      },
      monthly_csv: {
        url: `/api/admin/dre/export/csv?${qs}&type=monthly`,
        filename: `DRE_Mensal_${year}_${month}.csv`,
        mime: 'text/csv',
      },
      rev_csv: {
        url: `/api/admin/dre/export/csv?${qs}&type=ledger_revenues`,
        filename: `Razao_Receitas_${year}.csv`,
        mime: 'text/csv',
      },
      exp_csv: {
        url: `/api/admin/dre/export/csv?${qs}&type=ledger_expenses`,
        filename: `Razao_Despesas_${year}.csv`,
        mime: 'text/csv',
      },
    };
    const cfg = map[kind];
    try {
      setExportingKey(kind);
      const res = await api.get(cfg.url, {
        responseType: 'text',
        transformResponse: [(d: any) => d],
      });
      const content = typeof res.data === 'string' ? res.data : JSON.stringify(res.data || '');

      if (Platform.OS === 'web') {
        showToast('Use o painel Web para download direto de arquivos no navegador.', 'info');
        setExportModalVisible(false);
        return;
      }

      const fileUri = `${FileSystem.cacheDirectory}${cfg.filename}`;
      await FileSystem.writeAsStringAsync(fileUri, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: cfg.mime,
          dialogTitle: cfg.filename,
        });
      } else {
        await Share.share({ title: cfg.filename, message: content.slice(0, 4000) });
      }
      setExportModalVisible(false);
      showToast(`Arquivo ${cfg.filename} gerado!`);
    } catch (err: any) {
      console.error('[DRE Export]', err);
      showToast(err?.response?.data?.error || 'Falha ao gerar arquivo contábil.', 'error');
    } finally {
      setExportingKey(null);
    }
  };

  // Filtered Expenses & Revenues
  const filteredExpenses = useMemo(() => {
    const list: any[] = report?.ledger?.expenses || [];
    const mk = report?.meta?.selectedMonthKey;
    return list.filter((e) => {
      if (e.monthYear !== mk) return false;
      if (expGroupFilter !== 'ALL' && e.dreGroup !== expGroupFilter) return false;
      return true;
    });
  }, [report?.ledger?.expenses, report?.meta?.selectedMonthKey, expGroupFilter]);

  const EXP_PAGE_SIZE = 15;
  const expTotalPages = Math.max(1, Math.ceil(filteredExpenses.length / EXP_PAGE_SIZE));
  const pagedExpenses = useMemo(() => {
    const safePage = Math.min(expPage, expTotalPages);
    const start = (safePage - 1) * EXP_PAGE_SIZE;
    return filteredExpenses.slice(start, start + EXP_PAGE_SIZE);
  }, [filteredExpenses, expPage, expTotalPages]);

  const filteredRevenues = useMemo(() => {
    const list: any[] = report?.ledger?.revenues || [];
    const mk = report?.meta?.selectedMonthKey;
    const q = revSearch.trim().toLowerCase();
    return list.filter((r) => {
      if (revScopeFilter === 'month' && r.monthKey !== mk) return false;
      if (q) {
        const hay = `${r.psiNome || ''} ${r.id || ''} ${r.plano || ''} ${r.billingType || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [report?.ledger?.revenues, report?.meta?.selectedMonthKey, revScopeFilter, revSearch]);

  const REV_PAGE_SIZE = 12;
  const revTotalPages = Math.max(1, Math.ceil(filteredRevenues.length / REV_PAGE_SIZE));
  const pagedRevenues = useMemo(() => {
    const safePage = Math.min(revPage, revTotalPages);
    const start = (safePage - 1) * REV_PAGE_SIZE;
    return filteredRevenues.slice(start, start + REV_PAGE_SIZE);
  }, [filteredRevenues, revPage, revTotalPages]);

  // Tax source label (parity with Web)
  const meta = report?.meta || {};
  const company = report?.company || {};
  const sel = report?.selectedMonthSummary || {};
  const prev = report?.prevMonthSummary || {};
  const ann = report?.annualSummary || {};
  const selTaxCfg = sel?.taxConfig || {};
  const isClosed = Boolean(selTaxCfg.isClosed);

  const taxSrcLabel =
    selTaxCfg.taxSource === 'MONTH_SNAPSHOT'
      ? 'Mês'
      : selTaxCfg.taxSource === 'GLOBAL_SETTING'
      ? 'Padrão'
      : 'Não config.';
  const taxVarTxt =
    selTaxCfg.variableRate !== null && selTaxCfg.variableRate !== undefined
      ? `${(Number(selTaxCfg.variableRate) * 100).toFixed(2).replace('.', ',')}%`
      : '0,00%';
  const taxFixedTxt = fmtCurrency(selTaxCfg.fixedMonthly || 0);

  // Chart calculations (12 months SVG)
  const monthlySeries: any[] = report?.monthlySeries || [];
  const chartGeom = useMemo(() => {
    if (!monthlySeries.length) return null;
    const vals: number[] = [0];
    monthlySeries.forEach((m) => {
      vals.push(Number(m.netRevenue || 0));
      vals.push(Number((m.totalCogs || 0) + (m.totalOpex || 0)));
      vals.push(Number(m.netIncome || 0));
    });
    const maxV = Math.max(100, ...vals);
    const minV = Math.min(0, ...vals);
    const span = Math.max(100, maxV - minV);
    const width = 580;
    const height = 210;
    const padL = 46;
    const padR = 14;
    const padT = 16;
    const padB = 30;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;
    const colW = plotW / 12;
    const toY = (v: number) => padT + ((maxV - v) / span) * plotH;
    const zeroY = toY(0);

    const linePts = monthlySeries.map((m, idx) => {
      const cx = padL + idx * colW + colW / 2;
      const cy = toY(Number(m.netIncome || 0));
      return { cx, cy, val: Number(m.netIncome || 0) };
    });
    const linePath = linePts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(' ');

    return { width, height, padL, padR, padT, padB, plotW, plotH, colW, maxV, minV, zeroY, toY, linePts, linePath };
  }, [monthlySeries]);

  const activeChartMonth =
    selectedChartIdx !== null && monthlySeries[selectedChartIdx]
      ? monthlySeries[selectedChartIdx]
      : monthlySeries[(meta.selectedMonth || month) - 1] || null;

  if (loading && !report) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center' }}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#1B4332" />
        <Text style={{ marginTop: 12, fontFamily: 'Inter_500Medium', color: '#64748b', fontSize: 13 }}>
          Carregando DRE contábil...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <StatusBar style="light" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1B4332" />}
      >
        {/* HEADER EXECUTIVO EMERALD */}
        <LinearGradient
          colors={['#1B4332', '#0f2b20']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: Math.max(insets.top + 12, 22),
            paddingHorizontal: 16,
            paddingBottom: 20,
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
            marginBottom: 14,
          }}
        >
          {/* Top Navigation Bar */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(admin)/crm'))}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.16)',
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 999,
                gap: 5,
              }}
            >
              <Feather name="arrow-left" size={15} color="#ffffff" />
              <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 12 }}>Voltar</Text>
            </TouchableOpacity>

            <View
              style={{
                backgroundColor: isClosed ? '#065f46' : 'rgba(245, 158, 11, 0.25)',
                borderColor: isClosed ? '#34d399' : 'rgba(251, 191, 36, 0.55)',
                borderWidth: 1,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
              }}
            >
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: isClosed ? '#d1fae5' : '#fef3c7' }}>
                {isClosed ? '🔒 Fechado Contabilmente' : '🔓 Em Aberto'}
              </Text>
            </View>
          </View>

          <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#ffffff', fontSize: 22, marginBottom: 4 }}>
            DRE Contábil & Fiscal
          </Text>
          <Text style={{ fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.82)', fontSize: 12, marginBottom: 14 }}>
            {(company.legalName || 'Yelo Saúde Mental Ltda')}
            {company.cnpj ? ` • CNPJ ${company.cnpj}` : ''}
          </Text>

          {/* Selectors Row: Year, Month, Regime (Pills) */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
            <View style={{ flex: 0.9 }}>
              <NativeSelectMenu
                title="Exercício"
                options={yearOptions}
                selectedValue={String(year)}
                onSelect={(val) => setYear(Number(val))}
                style={{ width: '100%' }}
              >
                <View
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(255,255,255,0.96)',
                    borderRadius: 999,
                    paddingVertical: 9,
                    paddingHorizontal: 13,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Text style={{ fontFamily: 'Inter_700Bold', color: '#0f172a', fontSize: 12 }} numberOfLines={1}>
                    {year}
                  </Text>
                  <Feather name="chevron-down" size={14} color="#475569" />
                </View>
              </NativeSelectMenu>
            </View>

            <View style={{ flex: 1.2 }}>
              <NativeSelectMenu
                title="Mês"
                options={MONTH_OPTIONS.map((m) => ({ label: m.label, value: m.value }))}
                selectedValue={String(month)}
                onSelect={(val) => {
                  const num = Number(val);
                  setMonth(num);
                  setSelectedChartIdx(num - 1);
                }}
                style={{ width: '100%' }}
              >
                <View
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(255,255,255,0.96)',
                    borderRadius: 999,
                    paddingVertical: 9,
                    paddingHorizontal: 13,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Text style={{ fontFamily: 'Inter_700Bold', color: '#0f172a', fontSize: 12, flex: 1 }} numberOfLines={1}>
                    {MONTH_OPTIONS[month - 1]?.label || month}
                  </Text>
                  <Feather name="chevron-down" size={14} color="#475569" />
                </View>
              </NativeSelectMenu>
            </View>

            <View style={{ flex: 1.35 }}>
              <NativeSelectMenu
                title="Regime"
                options={[
                  { label: 'Competência', value: 'accrual' },
                  { label: 'Caixa', value: 'cash' },
                ]}
                selectedValue={regime}
                onSelect={(val) => setRegime(val === 'cash' ? 'cash' : 'accrual')}
                style={{ width: '100%' }}
              >
                <View
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(255,255,255,0.96)',
                    borderRadius: 999,
                    paddingVertical: 9,
                    paddingHorizontal: 13,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Text style={{ fontFamily: 'Inter_700Bold', color: '#0f172a', fontSize: 12, flex: 1 }} numberOfLines={1}>
                    {regime === 'cash' ? 'Caixa' : 'Competência'}
                  </Text>
                  <Feather name="chevron-down" size={14} color="#475569" />
                </View>
              </NativeSelectMenu>
            </View>
          </View>

          {/* Hero Action Buttons (Pills) */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={openFiscalModal}
              style={{
                flex: 0.95,
                flexDirection: 'row',
                gap: 5,
                backgroundColor: 'rgba(255,255,255,0.14)',
                borderColor: 'rgba(255,255,255,0.28)',
                borderWidth: 1,
                borderRadius: 999,
                paddingVertical: 9,
                paddingHorizontal: 10,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Feather name="sliders" size={13} color="#ffffff" />
              <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 12 }} numberOfLines={1}>
                Fiscal
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              disabled={syncingAds}
              onPress={handleSyncAds}
              style={{
                flex: 1.25,
                flexDirection: 'row',
                gap: 5,
                backgroundColor: 'rgba(255,255,255,0.14)',
                borderColor: 'rgba(255,255,255,0.28)',
                borderWidth: 1,
                borderRadius: 999,
                paddingVertical: 9,
                paddingHorizontal: 10,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: syncingAds ? 0.6 : 1,
              }}
            >
              <Feather name="refresh-cw" size={13} color="#ffffff" />
              <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 12 }} numberOfLines={1}>
                {syncingAds ? 'Atualizando...' : 'Atualizar'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setExportModalVisible(true)}
              style={{
                flex: 1.1,
                flexDirection: 'row',
                gap: 5,
                backgroundColor: '#ffffff',
                borderRadius: 999,
                paddingVertical: 9,
                paddingHorizontal: 10,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Feather name="download" size={13} color="#1B4332" />
              <Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 12 }} numberOfLines={1}>
                Exportar
              </Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: 14 }}>
          {/* ALERTS */}
          {(report?.alerts || []).map((a: any, idx: number) => {
            const palette =
              a.type === 'warning'
                ? { bg: '#fffbeb', border: '#fde68a', text: '#92400e' }
                : a.type === 'danger'
                ? { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' }
                : { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' };
            return (
              <View
                key={`${a.code || idx}`}
                style={{
                  backgroundColor: palette.bg,
                  borderColor: palette.border,
                  borderWidth: 1,
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 10,
                }}
              >
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: palette.text, lineHeight: 17 }}>
                  <Text style={{ fontFamily: 'Inter_700Bold' }}>{a.title}: </Text>
                  {a.message}
                </Text>
                {a.code === 'MISSING_TAX_CONFIG' && (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={openFiscalModal}
                    style={{
                      marginTop: 8,
                      alignSelf: 'flex-start',
                      backgroundColor: '#ffffff',
                      borderColor: '#cbd5e1',
                      borderWidth: 1,
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                    }}
                  >
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#0f172a' }}>
                      Configurar agora
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}

          {/* 5 KPI CARDS (CMO Style) */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginBottom: 14 }}>
            {/* 1. Receita Bruta */}
            <View
              style={{
                width: '48.6%',
                backgroundColor: '#ffffff',
                borderRadius: 14,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                borderTopWidth: 4,
                borderTopColor: '#10b981',
                padding: 12,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 4 }}>
                <TouchableOpacity
                  onPress={() => setActiveTooltip(KPI_TOOLTIPS.grossRevenue)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 }}
                >
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }} numberOfLines={1}>
                    Receita Bruta
                  </Text>
                  <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: 'Inter_800ExtraBold', fontSize: 9, color: '#475569' }}>i</Text>
                  </View>
                </TouchableOpacity>
                <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 }}>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 9, color: '#475569' }}>
                    {sel.paidCount || 0} pgtos
                  </Text>
                </View>
              </View>
              <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#0f172a', marginBottom: 5 }}>
                {fmtCurrency(sel.grossRevenue)}
              </Text>
              <View style={{ marginBottom: 6, alignSelf: 'flex-start' }}>
                {renderKpiTrendPill('grossRevenue', sel.grossRevenue, prev.grossRevenue, false)}
              </View>
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 10, color: '#64748b' }}>
                Anual: <Text style={{ fontFamily: 'Inter_700Bold', color: '#334155' }}>{fmtCurrency(ann.grossRevenue)}</Text>
              </Text>
            </View>

            {/* 2. Deduções & Impostos */}
            <View
              style={{
                width: '48.6%',
                backgroundColor: '#ffffff',
                borderRadius: 14,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                borderTopWidth: 4,
                borderTopColor: '#f59e0b',
                padding: 12,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 4 }}>
                <TouchableOpacity
                  onPress={() => setActiveTooltip(KPI_TOOLTIPS.totalDeductions)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 }}
                >
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }} numberOfLines={1}>
                    Deduções
                  </Text>
                  <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: 'Inter_800ExtraBold', fontSize: 9, color: '#475569' }}>i</Text>
                  </View>
                </TouchableOpacity>
                <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 }}>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 9, color: '#475569' }}>
                    Alíq. {selTaxCfg.variableRate !== null && selTaxCfg.variableRate !== undefined ? `${(Number(selTaxCfg.variableRate) * 100).toFixed(1).replace('.', ',')}%` : '0%'}
                  </Text>
                </View>
              </View>
              <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#0f172a', marginBottom: 5 }}>
                {fmtCurrency(sel.totalDeductions)}
              </Text>
              <View style={{ marginBottom: 6, alignSelf: 'flex-start' }}>
                {renderKpiTrendPill('totalDeductions', sel.totalDeductions, prev.totalDeductions, true)}
              </View>
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 10, color: '#64748b' }} numberOfLines={1}>
                Est: <Text style={{ fontFamily: 'Inter_700Bold', color: '#334155' }}>{fmtCurrency(sel.refunds)}</Text> • Imp: <Text style={{ fontFamily: 'Inter_700Bold', color: '#334155' }}>{fmtCurrency(sel.taxesOnRevenue)}</Text>
              </Text>
            </View>

            {/* 3. Receita Líquida */}
            <View
              style={{
                width: '48.6%',
                backgroundColor: '#ffffff',
                borderRadius: 14,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                borderTopWidth: 4,
                borderTopColor: '#2563eb',
                padding: 12,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 4 }}>
                <TouchableOpacity
                  onPress={() => setActiveTooltip(KPI_TOOLTIPS.netRevenue)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 }}
                >
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }} numberOfLines={1}>
                    Receita Líquida
                  </Text>
                  <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: 'Inter_800ExtraBold', fontSize: 9, color: '#475569' }}>i</Text>
                  </View>
                </TouchableOpacity>
                <View style={{ backgroundColor: '#eff6ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 }}>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 9, color: '#1d4ed8' }}>Base DRE</Text>
                </View>
              </View>
              <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#0f172a', marginBottom: 5 }}>
                {fmtCurrency(sel.netRevenue)}
              </Text>
              <View style={{ marginBottom: 6, alignSelf: 'flex-start' }}>
                {renderKpiTrendPill('netRevenue', sel.netRevenue, prev.netRevenue, false)}
              </View>
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 10, color: '#64748b' }}>
                Anual: <Text style={{ fontFamily: 'Inter_700Bold', color: '#334155' }}>{fmtCurrency(ann.netRevenue)}</Text>
              </Text>
            </View>

            {/* 4. Custos + OPEX */}
            <View
              style={{
                width: '48.6%',
                backgroundColor: '#ffffff',
                borderRadius: 14,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                borderTopWidth: 4,
                borderTopColor: '#ef4444',
                padding: 12,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 4 }}>
                <TouchableOpacity
                  onPress={() => setActiveTooltip(KPI_TOOLTIPS.costsPlusOpex)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 }}
                >
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b', textTransform: 'uppercase' }} numberOfLines={1}>
                    Custos + OPEX
                  </Text>
                  <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: 'Inter_800ExtraBold', fontSize: 9, color: '#475569' }}>i</Text>
                  </View>
                </TouchableOpacity>
                <View style={{ backgroundColor: '#fef2f2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 }}>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 9, color: '#b91c1c' }}>Saídas</Text>
                </View>
              </View>
              <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#0f172a', marginBottom: 5 }}>
                {fmtCurrency((sel.totalCogs || 0) + (sel.totalOpex || 0))}
              </Text>
              <View style={{ marginBottom: 6, alignSelf: 'flex-start' }}>
                {renderKpiTrendPill(
                  'costsPlusOpex',
                  (sel.totalCogs || 0) + (sel.totalOpex || 0),
                  (prev.totalCogs || 0) + (prev.totalOpex || 0),
                  true
                )}
              </View>
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 10, color: '#64748b' }} numberOfLines={1}>
                CSP: <Text style={{ fontFamily: 'Inter_700Bold', color: '#334155' }}>{fmtCurrency(sel.totalCogs)}</Text> • OPEX: <Text style={{ fontFamily: 'Inter_700Bold', color: '#334155' }}>{fmtCurrency(sel.totalOpex)}</Text>
              </Text>
            </View>

            {/* 5. Lucro / Prejuízo Líquido (Highlight Full-Width) */}
            {(() => {
              const positive = Number(sel.netIncome || 0) >= 0;
              return (
                <View
                  style={{
                    width: '100%',
                    backgroundColor: positive ? '#ecfdf5' : '#fef2f2',
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: positive ? '#a7f3d0' : '#fecaca',
                    borderTopWidth: 4,
                    borderTopColor: positive ? '#059669' : '#dc2626',
                    padding: 14,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <TouchableOpacity
                      onPress={() => setActiveTooltip(KPI_TOOLTIPS.netIncome)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                    >
                      <Text
                        style={{
                          fontFamily: 'Inter_700Bold',
                          fontSize: 11,
                          color: positive ? '#065f46' : '#991b1b',
                          textTransform: 'uppercase',
                        }}
                      >
                        Lucro / Prejuízo Líquido
                      </Text>
                      <View style={{ width: 15, height: 15, borderRadius: 8, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontFamily: 'Inter_800ExtraBold', fontSize: 9, color: '#475569' }}>i</Text>
                      </View>
                    </TouchableOpacity>
                    <View
                      style={{
                        backgroundColor: '#ffffff',
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 999,
                      }}
                    >
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: positive ? '#047857' : '#b91c1c' }}>
                        Mg {fmtPct(sel.netMarginPct)}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
                    <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 22, color: positive ? '#1B4332' : '#dc2626' }}>
                      {fmtCurrency(sel.netIncome)}
                    </Text>
                    {renderKpiTrendPill('netIncome', sel.netIncome, prev.netIncome, false)}
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                    <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#475569' }}>
                      Anual: <Text style={{ fontFamily: 'Inter_700Bold', color: '#0f172a' }}>{fmtCurrency(ann.netIncome)}</Text>
                    </Text>
                    <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#475569' }}>
                      EBITDA: <Text style={{ fontFamily: 'Inter_700Bold', color: '#0f172a' }}>{fmtCurrency(sel.ebitda)}</Text> ({fmtPct(sel.ebitdaMarginPct)})
                    </Text>
                  </View>
                </View>
              );
            })()}
          </View>

          {/* SUB-TABS DROPDOWN */}
          <View style={{ marginBottom: 14 }}>
            <Text
              style={{
                fontFamily: 'Inter_700Bold',
                fontSize: 11,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 6,
              }}
            >
              Visão Contábil
            </Text>
            <NativeSelectMenu
              title="Selecionar Visão da DRE"
              options={DRE_TAB_OPTIONS.map((t) => ({ label: t.label, value: t.key }))}
              selectedValue={activeTab}
              onSelect={(val) => setActiveTab(val as TabKey)}
              style={{ width: '100%' }}
            >
              <View
                style={{
                  backgroundColor: '#1B4332',
                  borderRadius: 999,
                  paddingHorizontal: 16,
                  paddingVertical: 11,
                  width: '100%',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 }}>
                  <Feather
                    name={DRE_TAB_OPTIONS.find((t) => t.key === activeTab)?.icon || 'bar-chart-2'}
                    size={15}
                    color="#ffffff"
                  />
                  <Text
                    style={{
                      fontFamily: 'Inter_700Bold',
                      fontSize: 13,
                      color: '#ffffff',
                      flex: 1,
                    }}
                    numberOfLines={1}
                  >
                    {DRE_TAB_OPTIONS.find((t) => t.key === activeTab)?.label || 'DRE Mensal & Evolução'}
                  </Text>
                </View>
                <Feather name="chevron-down" size={16} color="#ffffff" />
              </View>
            </NativeSelectMenu>
          </View>

          {/* ==================== ABA 1: DRE MENSAL & GRÁFICO ==================== */}
          {activeTab === 'mensal' && (
            <>
              <View
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                  padding: 14,
                  marginBottom: 14,
                }}
              >
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#0f172a', marginBottom: 3 }}>
                  Demonstração do Resultado — {meta.selectedMonthLabel} / {meta.year}
                </Text>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: '#64748b', marginBottom: 10 }}>
                  {meta.regimeLabel} • AV% (sobre Receita Líquida) e AH% (vs. {fmtMonthKeyShort(meta.prevMonthKey)})
                </Text>

                {/* Status Fiscal + Ações Rápidas */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12, alignItems: 'center' }}>
                  <View style={{ backgroundColor: '#f1f5f9', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#475569' }}>
                      Regra Fiscal ({taxSrcLabel}): {taxVarTxt} + {taxFixedTxt}
                    </Text>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={toggleCollapseAll}
                    style={{
                      backgroundColor: '#ffffff',
                      borderColor: '#cbd5e1',
                      borderWidth: 1,
                      borderRadius: 9,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                    }}
                  >
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#334155' }}>
                      {allCollapsed ? '↕️ Expandir Grupos' : '↕️ Recolher Grupos'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => handleToggleMonthLock(meta.selectedMonthKey, isClosed ? 'reopen' : 'close')}
                    style={{
                      backgroundColor: '#ffffff',
                      borderColor: '#cbd5e1',
                      borderWidth: 1,
                      borderRadius: 9,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                    }}
                  >
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#334155' }}>
                      {isClosed ? '🔓 Reabrir Mês' : '🔒 Fechar Mês'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Horizontal Scrollable DRE Table */}
                <ScrollView horizontal showsHorizontalScrollIndicator>
                  <View style={{ minWidth: 680 }}>
                    {/* Table Header with tap tooltips */}
                    <View
                      style={{
                        flexDirection: 'row',
                        backgroundColor: '#f8fafc',
                        borderBottomWidth: 2,
                        borderBottomColor: '#e2e8f0',
                        paddingVertical: 9,
                        paddingHorizontal: 8,
                        alignItems: 'center',
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => setActiveTooltip(COL_TOOLTIPS.code)}
                        style={{ width: 46, flexDirection: 'row', alignItems: 'center', gap: 3 }}
                      >
                        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#475569' }}>CÓD.</Text>
                        <View style={{ width: 13, height: 13, borderRadius: 7, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontFamily: 'Inter_800ExtraBold', fontSize: 8, color: '#475569' }}>i</Text>
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setActiveTooltip(COL_TOOLTIPS.structure)}
                        style={{ width: 220, flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 8 }}
                      >
                        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#475569' }}>ESTRUTURA CONTÁBIL (DRE)</Text>
                        <View style={{ width: 13, height: 13, borderRadius: 7, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontFamily: 'Inter_800ExtraBold', fontSize: 8, color: '#475569' }}>i</Text>
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setActiveTooltip(COL_TOOLTIPS.selectedValue)}
                        style={{ width: 92, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 3 }}
                      >
                        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#475569' }}>
                          {(meta.selectedMonthLabel || '').slice(0, 3).toUpperCase()}/{meta.year}
                        </Text>
                        <View style={{ width: 13, height: 13, borderRadius: 7, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontFamily: 'Inter_800ExtraBold', fontSize: 8, color: '#475569' }}>i</Text>
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setActiveTooltip(COL_TOOLTIPS.avPct)}
                        style={{ width: 62, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 3 }}
                      >
                        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#475569' }}>AV %</Text>
                        <View style={{ width: 13, height: 13, borderRadius: 7, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontFamily: 'Inter_800ExtraBold', fontSize: 8, color: '#475569' }}>i</Text>
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setActiveTooltip(COL_TOOLTIPS.prevValue)}
                        style={{ width: 92, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 3 }}
                      >
                        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#475569' }}>
                          {fmtMonthKeyShort(meta.prevMonthKey).toUpperCase()}
                        </Text>
                        <View style={{ width: 13, height: 13, borderRadius: 7, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontFamily: 'Inter_800ExtraBold', fontSize: 8, color: '#475569' }}>i</Text>
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setActiveTooltip(COL_TOOLTIPS.ahPct)}
                        style={{ width: 68, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 3 }}
                      >
                        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#475569' }}>AH %</Text>
                        <View style={{ width: 13, height: 13, borderRadius: 7, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontFamily: 'Inter_800ExtraBold', fontSize: 8, color: '#475569' }}>i</Text>
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setActiveTooltip(COL_TOOLTIPS.annualTotal)}
                        style={{ width: 94, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 3 }}
                      >
                        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#475569' }}>
                          TOTAL {meta.year}
                        </Text>
                        <View style={{ width: 13, height: 13, borderRadius: 7, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontFamily: 'Inter_800ExtraBold', fontSize: 8, color: '#475569' }}>i</Text>
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setActiveTooltip(COL_TOOLTIPS.annualAvPct)}
                        style={{ width: 68, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 3 }}
                      >
                        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#475569' }}>AV ANO</Text>
                        <View style={{ width: 13, height: 13, borderRadius: 7, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontFamily: 'Inter_800ExtraBold', fontSize: 8, color: '#475569' }}>i</Text>
                        </View>
                      </TouchableOpacity>
                    </View>

                    {/* Table Rows */}
                    {dreRows.map((row) => {
                      const codeStr = String(row.code || '');
                      const isChild = codeStr.includes('.');
                      const parentCode = isChild ? codeStr.split('.')[0] : '';
                      if (isChild && collapsedGroups.has(parentCode)) return null;

                      const childCount = !isChild ? childCountMap.get(codeStr) || 0 : 0;
                      const isGroupHeader = childCount > 0;
                      const isGroupCollapsed = collapsedGroups.has(codeStr);

                      const isGrand = row.rowType === 'grand_total';
                      const isTotal = row.rowType === 'total';
                      const isSubtotal = row.rowType === 'subtotal';

                      const rowBg = isGrand
                        ? '#1B4332'
                        : isTotal
                        ? '#eef6f1'
                        : isSubtotal
                        ? '#f8fafc'
                        : '#ffffff';

                      const baseTextColor = isGrand ? '#ffffff' : isTotal ? '#14532d' : isSubtotal ? '#0f172a' : '#334155';
                      const valNeg = row.sign === '-' && row.selectedValue > 0;
                      const grandNeg = isGrand && row.selectedValue < 0;
                      const selColor = isGrand
                        ? grandNeg
                          ? '#fecaca'
                          : '#a7f3d0'
                        : valNeg
                        ? '#b91c1c'
                        : baseTextColor;

                      let ahColor = baseTextColor;
                      if (row.ahPct !== null && Math.abs(row.ahPct) > 0.05) {
                        const isUp = row.ahPct > 0;
                        const isGood = row.sign === '-' ? !isUp : isUp;
                        ahColor = isGrand
                          ? isGood
                            ? '#a7f3d0'
                            : '#fecaca'
                          : isGood
                          ? '#047857'
                          : '#b91c1c';
                      }

                      const RowWrap: any = isGroupHeader ? TouchableOpacity : View;
                      return (
                        <RowWrap
                          key={codeStr}
                          activeOpacity={0.75}
                          onPress={isGroupHeader ? () => toggleGroupCollapse(codeStr) : undefined}
                          style={{
                            flexDirection: 'row',
                            backgroundColor: rowBg,
                            borderBottomWidth: 1,
                            borderBottomColor: isTotal ? '#bbf7d0' : isGrand ? '#0f2b20' : '#f1f5f9',
                            paddingVertical: isGrand ? 11 : 9,
                            paddingHorizontal: 8,
                            alignItems: 'center',
                          }}
                        >
                          <Text
                            style={{
                              width: 46,
                              fontFamily: 'Inter_700Bold',
                              fontSize: 11,
                              color: baseTextColor,
                            }}
                          >
                            {row.code}
                          </Text>

                          <View
                            style={{
                              width: 220,
                              flexDirection: 'row',
                              alignItems: 'center',
                              paddingLeft: isChild ? 12 : 0,
                              paddingRight: 8,
                            }}
                          >
                            {isGroupHeader && (
                              <View
                                style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: 5,
                                  backgroundColor: isGroupCollapsed ? '#cbd5e1' : '#e2e8f0',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  marginRight: 6,
                                }}
                              >
                                <Text style={{ fontSize: 10, color: '#1e293b', fontWeight: '700' }}>
                                  {isGroupCollapsed ? '▸' : '▾'}
                                </Text>
                              </View>
                            )}
                            <Text
                              style={{
                                flex: 1,
                                fontFamily: isGrand || isTotal || isSubtotal ? 'Inter_700Bold' : 'Inter_500Medium',
                                fontSize: 11,
                                color: baseTextColor,
                              }}
                              numberOfLines={2}
                            >
                              {row.label}
                            </Text>
                            {isGroupHeader && isGroupCollapsed && (
                              <View
                                style={{
                                  backgroundColor: '#e2e8f0',
                                  borderRadius: 999,
                                  paddingHorizontal: 6,
                                  paddingVertical: 1,
                                  marginLeft: 4,
                                }}
                              >
                                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 9, color: '#475569' }}>
                                  {childCount}
                                </Text>
                              </View>
                            )}
                          </View>

                          <Text
                            style={{
                              width: 92,
                              textAlign: 'right',
                              fontFamily: isGrand || isTotal || isSubtotal ? 'Inter_700Bold' : 'Inter_500Medium',
                              fontSize: 11,
                              color: selColor,
                            }}
                          >
                            {fmtSignedCurrency(row.selectedValue, row.sign)}
                          </Text>

                          <Text
                            style={{
                              width: 62,
                              textAlign: 'right',
                              fontFamily: 'Inter_500Medium',
                              fontSize: 11,
                              color: baseTextColor,
                            }}
                          >
                            {fmtPct(row.selectedAvPct)}
                          </Text>

                          <Text
                            style={{
                              width: 92,
                              textAlign: 'right',
                              fontFamily: 'Inter_500Medium',
                              fontSize: 11,
                              color: baseTextColor,
                            }}
                          >
                            {fmtSignedCurrency(row.prevMonthValue, row.sign)}
                          </Text>

                          <Text
                            style={{
                              width: 68,
                              textAlign: 'right',
                              fontFamily: 'Inter_700Bold',
                              fontSize: 11,
                              color: ahColor,
                            }}
                          >
                            {row.ahPct === null ? '—' : fmtPct(row.ahPct, true)}
                          </Text>

                          <Text
                            style={{
                              width: 94,
                              textAlign: 'right',
                              fontFamily: 'Inter_700Bold',
                              fontSize: 11,
                              color: baseTextColor,
                            }}
                          >
                            {fmtSignedCurrency(row.annualTotal, row.sign)}
                          </Text>

                          <Text
                            style={{
                              width: 68,
                              textAlign: 'right',
                              fontFamily: 'Inter_500Medium',
                              fontSize: 11,
                              color: baseTextColor,
                            }}
                          >
                            {fmtPct(row.annualAvPct)}
                          </Text>
                        </RowWrap>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>

              {/* GRÁFICO EVOLUÇÃO MENSAL (Jan-Dez) */}
              <View
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                  padding: 14,
                  marginBottom: 14,
                }}
              >
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#0f172a', marginBottom: 2 }}>
                  Evolução Mensal do Resultado (Jan–Dez)
                </Text>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: '#64748b', marginBottom: 10 }}>
                  Toque em qualquer mês no gráfico para inspecionar Receita Líquida, Custos + OPEX e Lucro Líquido.
                </Text>

                {/* Legend */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#1B4332' }} />
                    <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#334155' }}>Receita Líquida</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#ef4444' }} />
                    <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#334155' }}>Custos + OPEX</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ width: 10, height: 3, borderRadius: 2, backgroundColor: '#2563eb' }} />
                    <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#334155' }}>Lucro Líquido</Text>
                  </View>
                </View>

                {chartGeom && (
                  <ScrollView horizontal showsHorizontalScrollIndicator>
                    <View>
                      <Svg width={chartGeom.width} height={chartGeom.height}>
                        {/* Zero axis & top line */}
                        <Line
                          x1={chartGeom.padL}
                          y1={chartGeom.zeroY}
                          x2={chartGeom.width - chartGeom.padR}
                          y2={chartGeom.zeroY}
                          stroke="#94a3b8"
                          strokeWidth={1}
                        />
                        <Line
                          x1={chartGeom.padL}
                          y1={chartGeom.padT}
                          x2={chartGeom.width - chartGeom.padR}
                          y2={chartGeom.padT}
                          stroke="#f1f5f9"
                          strokeWidth={1}
                        />
                        <SvgText x={4} y={chartGeom.padT + 9} fontSize={9} fill="#64748b">
                          {fmtCompactCurrency(chartGeom.maxV)}
                        </SvgText>
                        <SvgText x={4} y={chartGeom.zeroY + 3} fontSize={9} fill="#64748b">
                          R$0
                        </SvgText>
                        {chartGeom.minV < 0 && (
                          <SvgText x={4} y={chartGeom.height - chartGeom.padB} fontSize={9} fill="#64748b">
                            {fmtCompactCurrency(chartGeom.minV)}
                          </SvgText>
                        )}

                        {monthlySeries.map((m, idx) => {
                          const x0 = chartGeom.padL + idx * chartGeom.colW;
                          const isSel = selectedChartIdx === idx;
                          const netRev = Number(m.netRevenue || 0);
                          const costs = Number((m.totalCogs || 0) + (m.totalOpex || 0));
                          const revY = chartGeom.toY(Math.max(0, netRev));
                          const revH = Math.max(0, chartGeom.zeroY - revY);
                          const costY = chartGeom.toY(Math.max(0, costs));
                          const costH = Math.max(0, chartGeom.zeroY - costY);

                          return (
                            <React.Fragment key={m.monthKey || idx}>
                              {isSel && (
                                <Rect
                                  x={x0 + 2}
                                  y={chartGeom.padT}
                                  width={chartGeom.colW - 4}
                                  height={chartGeom.plotH}
                                  rx={6}
                                  fill="rgba(27, 67, 50, 0.08)"
                                />
                              )}
                              <Rect
                                x={x0 + 7}
                                y={revY}
                                width={13}
                                height={Math.max(2, revH)}
                                rx={3}
                                fill={isSel ? '#14532d' : 'rgba(27, 67, 50, 0.85)'}
                              />
                              <Rect
                                x={x0 + 22}
                                y={costY}
                                width={13}
                                height={Math.max(2, costH)}
                                rx={3}
                                fill={isSel ? '#dc2626' : 'rgba(239, 68, 68, 0.72)'}
                              />
                              <SvgText
                                x={x0 + chartGeom.colW / 2}
                                y={chartGeom.height - 10}
                                textAnchor="middle"
                                fontSize={10}
                                fontWeight={isSel ? '700' : '500'}
                                fill={isSel ? '#1B4332' : '#64748b'}
                              >
                                {m.monthLabel}
                              </SvgText>
                            </React.Fragment>
                          );
                        })}

                        <Path d={chartGeom.linePath} stroke="#2563eb" strokeWidth={2.5} fill="none" />
                        {chartGeom.linePts.map((pt, idx) => (
                          <Circle
                            key={idx}
                            cx={pt.cx}
                            cy={pt.cy}
                            r={selectedChartIdx === idx ? 5.5 : 3.5}
                            fill="#ffffff"
                            stroke="#2563eb"
                            strokeWidth={2.2}
                          />
                        ))}
                      </Svg>

                      {/* Touch Hit Targets aligned by column */}
                      <View
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: chartGeom.padL,
                          height: chartGeom.height,
                          flexDirection: 'row',
                        }}
                      >
                        {monthlySeries.map((m, idx) => (
                          <TouchableOpacity
                            key={m.monthKey || idx}
                            onPress={() => setSelectedChartIdx(idx)}
                            style={{ width: chartGeom.colW, height: chartGeom.height }}
                          />
                        ))}
                      </View>
                    </View>
                  </ScrollView>
                )}

                {/* Interactive Inspected Month Box */}
                {activeChartMonth && (
                  <View
                    style={{
                      marginTop: 10,
                      backgroundColor: '#0f172a',
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 13 }}>
                        {activeChartMonth.monthFullLabel || activeChartMonth.monthLabel} / {meta.year}
                      </Text>
                      <Text style={{ fontFamily: 'Inter_500Medium', color: '#cbd5e1', fontSize: 11 }}>
                        Mg Líq.: {fmtPct(activeChartMonth.netMarginPct)} • {activeChartMonth.paidCount || 0} pgto(s)
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <Text style={{ fontFamily: 'Inter_500Medium', color: '#86efac', fontSize: 11 }}>
                        Rec. Líq: <Text style={{ fontFamily: 'Inter_700Bold' }}>{fmtCurrency(activeChartMonth.netRevenue)}</Text>
                      </Text>
                      <Text style={{ fontFamily: 'Inter_500Medium', color: '#fca5a5', fontSize: 11 }}>
                        Custos+OPEX: <Text style={{ fontFamily: 'Inter_700Bold' }}>{fmtCurrency((activeChartMonth.totalCogs || 0) + (activeChartMonth.totalOpex || 0))}</Text>
                      </Text>
                      <Text style={{ fontFamily: 'Inter_500Medium', color: '#93c5fd', fontSize: 11 }}>
                        Lucro: <Text style={{ fontFamily: 'Inter_700Bold' }}>{fmtCurrency(activeChartMonth.netIncome)}</Text>
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </>
          )}

          {/* ==================== ABA 2: DRE ANUAL (12 MESES) ==================== */}
          {activeTab === 'anual' && (
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                padding: 14,
                marginBottom: 14,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#0f172a' }}>
                    Matriz Contábil Anual — {meta.year}
                  </Text>
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: '#64748b' }}>
                    {meta.regimeLabel} • Visão consolidada Jan–Dez
                  </Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={toggleCollapseAll}
                  style={{
                    backgroundColor: '#ffffff',
                    borderColor: '#cbd5e1',
                    borderWidth: 1,
                    borderRadius: 9,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                  }}
                >
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#334155' }}>
                    {allCollapsed ? '↕️ Expandir' : '↕️ Recolher'}
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator>
                <View style={{ minWidth: 1320 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      backgroundColor: '#f8fafc',
                      borderBottomWidth: 2,
                      borderBottomColor: '#e2e8f0',
                      paddingVertical: 9,
                      paddingHorizontal: 8,
                    }}
                  >
                    <Text style={{ width: 220, fontFamily: 'Inter_700Bold', fontSize: 10, color: '#475569' }}>
                      CONTA CONTÁBIL
                    </Text>
                    {MONTH_OPTIONS.map((m) => (
                      <Text key={m.value} style={{ width: 78, textAlign: 'right', fontFamily: 'Inter_700Bold', fontSize: 10, color: '#475569' }}>
                        {m.short.toUpperCase()}
                      </Text>
                    ))}
                    <Text style={{ width: 92, textAlign: 'right', fontFamily: 'Inter_700Bold', fontSize: 10, color: '#0f172a' }}>
                      TOTAL ANO
                    </Text>
                    <Text style={{ width: 64, textAlign: 'right', fontFamily: 'Inter_700Bold', fontSize: 10, color: '#475569' }}>
                      AV %
                    </Text>
                  </View>

                  {dreRows.map((row) => {
                    const codeStr = String(row.code || '');
                    const isChild = codeStr.includes('.');
                    const parentCode = isChild ? codeStr.split('.')[0] : '';
                    if (isChild && collapsedGroups.has(parentCode)) return null;

                    const childCount = !isChild ? childCountMap.get(codeStr) || 0 : 0;
                    const isGroupHeader = childCount > 0;
                    const isGroupCollapsed = collapsedGroups.has(codeStr);
                    const isGrand = row.rowType === 'grand_total';
                    const isTotal = row.rowType === 'total';
                    const isSubtotal = row.rowType === 'subtotal';

                    const rowBg = isGrand ? '#1B4332' : isTotal ? '#eef6f1' : isSubtotal ? '#f8fafc' : '#ffffff';
                    const textColor = isGrand ? '#ffffff' : isTotal ? '#14532d' : '#0f172a';
                    const RowWrap: any = isGroupHeader ? TouchableOpacity : View;

                    return (
                      <RowWrap
                        key={`ann-${codeStr}`}
                        activeOpacity={0.75}
                        onPress={isGroupHeader ? () => toggleGroupCollapse(codeStr) : undefined}
                        style={{
                          flexDirection: 'row',
                          backgroundColor: rowBg,
                          borderBottomWidth: 1,
                          borderBottomColor: '#f1f5f9',
                          paddingVertical: 8,
                          paddingHorizontal: 8,
                          alignItems: 'center',
                        }}
                      >
                        <Text
                          style={{
                            width: 220,
                            fontFamily: isGrand || isTotal || isSubtotal ? 'Inter_700Bold' : 'Inter_500Medium',
                            fontSize: 11,
                            color: textColor,
                            paddingLeft: isChild ? 10 : 0,
                          }}
                          numberOfLines={2}
                        >
                          {isGroupHeader ? `${isGroupCollapsed ? '▸' : '▾'} ` : ''}
                          {row.label}
                        </Text>
                        {(row.months || []).map((val: number, mIdx: number) => (
                          <Text
                            key={mIdx}
                            style={{
                              width: 78,
                              textAlign: 'right',
                              fontFamily: 'Inter_500Medium',
                              fontSize: 10,
                              color: row.sign === '-' && val > 0 ? (isGrand ? '#fecaca' : '#b91c1c') : textColor,
                            }}
                          >
                            {fmtSignedCurrency(val, row.sign)}
                          </Text>
                        ))}
                        <Text style={{ width: 92, textAlign: 'right', fontFamily: 'Inter_700Bold', fontSize: 11, color: textColor }}>
                          {fmtSignedCurrency(row.annualTotal, row.sign)}
                        </Text>
                        <Text style={{ width: 64, textAlign: 'right', fontFamily: 'Inter_500Medium', fontSize: 10, color: textColor }}>
                          {fmtPct(row.annualAvPct)}
                        </Text>
                      </RowWrap>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          )}

          {/* ==================== ABA 3: DESPESAS & RECORRENTES ==================== */}
          {activeTab === 'despesas' && (
            <>
              {/* CARD 1: Despesas Fixas Automáticas */}
              <View
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                  padding: 14,
                  marginBottom: 14,
                }}
              >
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#0f172a', marginBottom: 2 }}>
                  🔁 Despesas Fixas Automáticas
                </Text>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: '#64748b', marginBottom: 12 }}>
                  Custos recorrentes (ex.: Render Cloud) replicados automaticamente todo mês na DRE.
                </Text>

                {/* Form Add Rule */}
                <View style={{ gap: 8, marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput
                      placeholder="Ex.: Render Cloud (Server)"
                      placeholderTextColor="#94a3b8"
                      value={recName}
                      onChangeText={setRecName}
                      style={{
                        flex: 1.5,
                        borderWidth: 1,
                        borderColor: '#cbd5e1',
                        borderRadius: 10,
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        fontSize: 12,
                        color: '#0f172a',
                      }}
                    />
                    <TextInput
                      placeholder="Valor (R$)"
                      placeholderTextColor="#94a3b8"
                      keyboardType="decimal-pad"
                      value={recAmount}
                      onChangeText={setRecAmount}
                      style={{
                        flex: 0.9,
                        borderWidth: 1,
                        borderColor: '#cbd5e1',
                        borderRadius: 10,
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        fontSize: 12,
                        color: '#0f172a',
                      }}
                    />
                  </View>

                  <NativeSelectMenu
                    title="Grupo Contábil DRE"
                    options={dreGroupOptions}
                    selectedValue={recGroup}
                    onSelect={setRecGroup}
                  >
                    <View
                      style={{
                        borderWidth: 1,
                        borderColor: '#cbd5e1',
                        borderRadius: 10,
                        paddingHorizontal: 10,
                        paddingVertical: 9,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: '#0f172a', flex: 1 }} numberOfLines={1}>
                        {dreGroupOptions.find((o: any) => o.value === recGroup)?.label || recGroup}
                      </Text>
                      <Feather name="chevron-down" size={14} color="#64748b" />
                    </View>
                  </NativeSelectMenu>

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1.3 }}>
                      <NativeSelectMenu
                        title="Fornecedor / Tipo"
                        options={PROVIDER_OPTIONS}
                        selectedValue={recProvider}
                        onSelect={setRecProvider}
                      >
                        <View
                          style={{
                            borderWidth: 1,
                            borderColor: '#cbd5e1',
                            borderRadius: 10,
                            paddingHorizontal: 10,
                            paddingVertical: 9,
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: '#0f172a' }} numberOfLines={1}>
                            {PROVIDER_OPTIONS.find((p) => p.value === recProvider)?.label || recProvider}
                          </Text>
                          <Feather name="chevron-down" size={14} color="#64748b" />
                        </View>
                      </NativeSelectMenu>
                    </View>
                    <TextInput
                      placeholder="AAAA-MM"
                      placeholderTextColor="#94a3b8"
                      value={recStartMonth}
                      onChangeText={setRecStartMonth}
                      style={{
                        flex: 0.9,
                        borderWidth: 1,
                        borderColor: '#cbd5e1',
                        borderRadius: 10,
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        fontSize: 12,
                        color: '#0f172a',
                      }}
                    />
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    disabled={savingRecurring}
                    onPress={handleAddRecurringRule}
                    style={{
                      backgroundColor: '#1B4332',
                      borderRadius: 10,
                      paddingVertical: 10,
                      alignItems: 'center',
                      opacity: savingRecurring ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 12 }}>
                      {savingRecurring ? 'Salvando...' : 'Ativar Automação Mensal'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Active Recurring Rules List */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {(report?.autoRecurringExpenses || []).length === 0 ? (
                    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: '#64748b' }}>
                      Nenhuma automação fixa ativa ainda.
                    </Text>
                  ) : (
                    (report?.autoRecurringExpenses || []).map((rule: any) => (
                      <View
                        key={rule.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          backgroundColor: '#f0fdf4',
                          borderColor: '#bbf7d0',
                          borderWidth: 1,
                          borderRadius: 999,
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                        }}
                      >
                        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#14532d' }}>
                          {rule.name} • {fmtCurrency(rule.amount)}/mês
                        </Text>
                        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: '#475569' }}>
                          ({rule.startMonth})
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleDeleteRecurringRule(rule.id, rule.name)}
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 9,
                            backgroundColor: '#dcfce7',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#166534' }}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>
              </View>

              {/* CARD 2: Lançamentos do Mês */}
              <View
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                  padding: 14,
                  marginBottom: 14,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#0f172a' }}>
                      Lançamentos — {meta.selectedMonthLabel}/{meta.year}
                    </Text>
                    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: '#64748b' }}>
                      Meta/Google Ads sincronizados automaticamente + despesas manuais.
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={openAddExpenseModal}
                    style={{
                      flex: 1,
                      backgroundColor: '#1B4332',
                      borderRadius: 10,
                      paddingVertical: 9,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 12 }}>
                      + Lançar Despesa
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleCopyPreviousFixed}
                    style={{
                      flex: 1,
                      backgroundColor: '#ffffff',
                      borderColor: '#cbd5e1',
                      borderWidth: 1,
                      borderRadius: 10,
                      paddingVertical: 9,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontFamily: 'Inter_700Bold', color: '#334155', fontSize: 12 }}>
                      📋 Repetir Mês Ant.
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Group Filter */}
                <View style={{ marginBottom: 12 }}>
                  <NativeSelectMenu
                    title="Filtrar Grupo"
                    options={[{ label: 'Todos os grupos', value: 'ALL' }, ...dreGroupOptions]}
                    selectedValue={expGroupFilter}
                    onSelect={(v) => {
                      setExpGroupFilter(v);
                      setExpPage(1);
                    }}
                  >
                    <View
                      style={{
                        borderWidth: 1,
                        borderColor: '#cbd5e1',
                        borderRadius: 10,
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#334155' }}>
                        Grupo: {expGroupFilter === 'ALL' ? 'Todos' : dreGroupOptions.find((g: any) => g.value === expGroupFilter)?.label}
                      </Text>
                      <Feather name="chevron-down" size={14} color="#64748b" />
                    </View>
                  </NativeSelectMenu>
                </View>

                {pagedExpenses.length === 0 ? (
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748b', textAlign: 'center', paddingVertical: 16 }}>
                    Nenhuma despesa registrada neste mês/filtro.
                  </Text>
                ) : (
                  pagedExpenses.map((e: any) => (
                    <View
                      key={String(e.id)}
                      style={{
                        borderWidth: 1,
                        borderColor: '#f1f5f9',
                        backgroundColor: '#f8fafc',
                        borderRadius: 12,
                        padding: 10,
                        marginBottom: 8,
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: '#0f172a' }}>{e.name}</Text>
                          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: '#64748b', marginTop: 2 }}>
                            {e.expenseDate || e.monthYear} • {e.dreGroupLabel || e.dreGroup}
                          </Text>
                        </View>
                        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: '#b91c1c' }}>
                          {fmtCurrency(e.amount)}
                        </Text>
                      </View>

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                        <View
                          style={{
                            backgroundColor: e.isVirtual ? '#dbeafe' : '#e2e8f0',
                            borderRadius: 999,
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                          }}
                        >
                          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: e.isVirtual ? '#1e40af' : '#475569' }}>
                            {e.isVirtual ? `Auto (${e.providerLabel || e.sourceType})` : e.providerLabel || 'Manual'}
                          </Text>
                        </View>

                        {!e.isVirtual && (
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            <TouchableOpacity
                              onPress={() => openEditExpenseModal(e)}
                              style={{
                                backgroundColor: '#ffffff',
                                borderColor: '#cbd5e1',
                                borderWidth: 1,
                                borderRadius: 7,
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                              }}
                            >
                              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#334155' }}>✏️ Editar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleDeleteExpense(e)}
                              style={{
                                backgroundColor: '#fef2f2',
                                borderColor: '#fecaca',
                                borderWidth: 1,
                                borderRadius: 7,
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                              }}
                            >
                              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#b91c1c' }}>🗑️</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>
                  ))
                )}

                {expTotalPages > 1 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <TouchableOpacity
                      disabled={expPage <= 1}
                      onPress={() => setExpPage((p) => Math.max(1, p - 1))}
                      style={{ opacity: expPage <= 1 ? 0.4 : 1, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8 }}
                    >
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#334155' }}>Anterior</Text>
                    </TouchableOpacity>
                    <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#64748b' }}>
                      Pág. {expPage} de {expTotalPages}
                    </Text>
                    <TouchableOpacity
                      disabled={expPage >= expTotalPages}
                      onPress={() => setExpPage((p) => Math.min(expTotalPages, p + 1))}
                      style={{ opacity: expPage >= expTotalPages ? 0.4 : 1, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8 }}
                    >
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#334155' }}>Próxima</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </>
          )}

          {/* ==================== ABA 4: APURAÇÃO FISCAL & RAZÃO ==================== */}
          {activeTab === 'fiscal' && (
            <>
              {/* Apuração Mensal e Fechamento */}
              <View
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                  padding: 14,
                  marginBottom: 14,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#0f172a' }}>
                      Apuração Mensal de Impostos
                    </Text>
                    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: '#64748b' }}>
                      Competências fiscais e fechamento contábil de {meta.year}.
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={openFiscalModal}
                    style={{
                      backgroundColor: '#ffffff',
                      borderColor: '#cbd5e1',
                      borderWidth: 1,
                      borderRadius: 9,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                    }}
                  >
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#334155' }}>⚙️ Editar</Text>
                  </TouchableOpacity>
                </View>

                {(report?.taxAudit || []).map((row: any) => (
                  <View
                    key={row.monthKey}
                    style={{
                      borderWidth: 1,
                      borderColor: '#f1f5f9',
                      backgroundColor: '#f8fafc',
                      borderRadius: 12,
                      padding: 10,
                      marginBottom: 8,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: '#0f172a' }}>
                        {row.monthFullLabel} ({row.monthKey})
                      </Text>
                      <View
                        style={{
                          backgroundColor: row.isClosed ? '#dcfce7' : '#fef3c7',
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 999,
                        }}
                      >
                        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: row.isClosed ? '#166534' : '#92400e' }}>
                          {row.isClosed ? 'Fechado' : 'Aberto'}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 6 }}>
                      <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#475569' }}>
                        Bruta: <Text style={{ fontFamily: 'Inter_700Bold', color: '#0f172a' }}>{fmtCurrency(row.grossRevenue)}</Text>
                      </Text>
                      <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#475569' }}>
                        Impostos: <Text style={{ fontFamily: 'Inter_700Bold', color: '#0f172a' }}>{fmtCurrency(row.taxesOnRevenue)}</Text>
                      </Text>
                      <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#475569' }}>
                        Lucro: <Text style={{ fontFamily: 'Inter_700Bold', color: row.netIncome < 0 ? '#b91c1c' : '#047857' }}>{fmtCurrency(row.netIncome)}</Text>
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleToggleMonthLock(row.monthKey, row.isClosed ? 'reopen' : 'close')}
                      style={{
                        alignSelf: 'flex-start',
                        backgroundColor: '#ffffff',
                        borderColor: '#cbd5e1',
                        borderWidth: 1,
                        borderRadius: 8,
                        paddingHorizontal: 9,
                        paddingVertical: 4,
                      }}
                    >
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#334155' }}>
                        {row.isClosed ? '🔓 Reabrir' : '🔒 Fechar'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              {/* Razão de Receitas & Estornos */}
              <View
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                  padding: 14,
                  marginBottom: 14,
                }}
              >
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#0f172a', marginBottom: 2 }}>
                  Livro Razão de Receitas & Estornos
                </Text>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: '#64748b', marginBottom: 10 }}>
                  Nota Extra-DRE ({meta.selectedMonthKey}): {sel?.openReceivables?.pendingCount || 0} pendente(s) ({fmtCurrency(sel?.openReceivables?.pendingTotal || 0)}) • {sel?.openReceivables?.overdueCount || 0} vencido(s) ({fmtCurrency(sel?.openReceivables?.overdueTotal || 0)})
                </Text>

                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                  <View style={{ flex: 1 }}>
                    <NativeSelectMenu
                      title="Escopo"
                      options={[
                        { label: 'Mês Selecionado', value: 'month' },
                        { label: 'Todo o Ano', value: 'year' },
                      ]}
                      selectedValue={revScopeFilter}
                      onSelect={(v) => {
                        setRevScopeFilter(v === 'year' ? 'year' : 'month');
                        setRevPage(1);
                      }}
                    >
                      <View
                        style={{
                          borderWidth: 1,
                          borderColor: '#cbd5e1',
                          borderRadius: 10,
                          paddingHorizontal: 10,
                          paddingVertical: 8,
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#334155' }}>
                          {revScopeFilter === 'year' ? 'Todo o Ano' : 'Mês Atual'}
                        </Text>
                        <Feather name="chevron-down" size={14} color="#64748b" />
                      </View>
                    </NativeSelectMenu>
                  </View>

                  <TextInput
                    placeholder="Buscar psi, plano, ID..."
                    placeholderTextColor="#94a3b8"
                    value={revSearch}
                    onChangeText={(t) => {
                      setRevSearch(t);
                      setRevPage(1);
                    }}
                    style={{
                      flex: 1.5,
                      borderWidth: 1,
                      borderColor: '#cbd5e1',
                      borderRadius: 10,
                      paddingHorizontal: 10,
                      paddingVertical: 7,
                      fontSize: 12,
                      color: '#0f172a',
                    }}
                  />
                </View>

                {pagedRevenues.length === 0 ? (
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748b', textAlign: 'center', paddingVertical: 16 }}>
                    Nenhuma receita ou estorno neste filtro.
                  </Text>
                ) : (
                  pagedRevenues.map((r: any, idx: number) => (
                    <View
                      key={`${r.id}-${idx}`}
                      style={{
                        borderWidth: 1,
                        borderColor: '#f1f5f9',
                        backgroundColor: '#f8fafc',
                        borderRadius: 12,
                        padding: 10,
                        marginBottom: 8,
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <View
                          style={{
                            backgroundColor: r.type === 'ESTORNO' ? '#fee2e2' : (r.type === 'TAXA_MENSAGERIA' ? '#fef3c7' : '#dcfce7'),
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 999,
                          }}
                        >
                          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: r.type === 'ESTORNO' ? '#991b1b' : (r.type === 'TAXA_MENSAGERIA' ? '#92400e' : '#166534') }}>
                            {r.type === 'TAXA_MENSAGERIA' ? 'MENSAGERIA' : r.type}
                          </Text>
                        </View>
                        <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#64748b' }}>
                          {r.eventDate || r.paymentDate || '—'}
                        </Text>
                      </View>
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: '#0f172a' }}>
                        {r.psiNome || 'Assinatura'}
                      </Text>
                      <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: '#64748b', marginBottom: 6 }}>
                        {r.plano} • {r.billingType} • {r.id}
                      </Text>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                        <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#475569' }}>
                          Bruto: <Text style={{ fontFamily: 'Inter_700Bold', color: r.grossAmount < 0 ? '#b91c1c' : '#0f172a' }}>{fmtCurrency(r.grossAmount)}</Text>
                        </Text>
                        <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#475569' }}>
                          Taxa: <Text style={{ fontFamily: 'Inter_700Bold', color: '#0f172a' }}>{fmtCurrency(r.feeAmount)}{r.feeEstimated ? ' (est.)' : ''}</Text>
                        </Text>
                        <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#475569' }}>
                          Líq: <Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332' }}>{fmtCurrency(r.netAmount)}</Text>
                        </Text>
                      </View>
                    </View>
                  ))
                )}

                {revTotalPages > 1 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <TouchableOpacity
                      disabled={revPage <= 1}
                      onPress={() => setRevPage((p) => Math.max(1, p - 1))}
                      style={{ opacity: revPage <= 1 ? 0.4 : 1, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8 }}
                    >
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#334155' }}>Anterior</Text>
                    </TouchableOpacity>
                    <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#64748b' }}>
                      Pág. {revPage} de {revTotalPages} ({filteredRevenues.length})
                    </Text>
                    <TouchableOpacity
                      disabled={revPage >= revTotalPages}
                      onPress={() => setRevPage((p) => Math.min(revTotalPages, p + 1))}
                      style={{ opacity: revPage >= revTotalPages ? 0.4 : 1, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8 }}
                    >
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#334155' }}>Próxima</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* ==================== MODAL: LANÇAR / EDITAR DESPESA ==================== */}
      <Modal visible={expenseModalVisible} transparent animationType="slide" onRequestClose={() => setExpenseModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '88%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#0f172a' }}>
                {expEditId ? 'Editar Despesa DRE' : 'Lançar Despesa DRE'}
              </Text>
              <TouchableOpacity onPress={() => setExpenseModalVisible(false)} style={{ padding: 6 }}>
                <Feather name="x" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ gap: 10, paddingBottom: 20 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569' }}>Descrição *</Text>
                <TextInput
                  value={expName}
                  onChangeText={setExpName}
                  placeholder="Ex.: Contador mensal / Render Cloud"
                  style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13 }}
                />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569', marginBottom: 4 }}>Valor (R$) *</Text>
                    <TextInput
                      keyboardType="decimal-pad"
                      value={expAmount}
                      onChangeText={setExpAmount}
                      placeholder="0.00"
                      style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13 }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569', marginBottom: 4 }}>Data (AAAA-MM-DD) *</Text>
                    <TextInput
                      value={expDate}
                      onChangeText={setExpDate}
                      placeholder="2026-10-01"
                      style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13 }}
                    />
                  </View>
                </View>

                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569' }}>Grupo Contábil *</Text>
                <NativeSelectMenu title="Grupo DRE" options={dreGroupOptions} selectedValue={expGroup} onSelect={setExpGroup}>
                  <View style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: '#0f172a', flex: 1 }} numberOfLines={1}>
                      {dreGroupOptions.find((o: any) => o.value === expGroup)?.label || expGroup}
                    </Text>
                    <Feather name="chevron-down" size={14} color="#64748b" />
                  </View>
                </NativeSelectMenu>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1.4 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569', marginBottom: 4 }}>Fornecedor</Text>
                    <NativeSelectMenu title="Fornecedor" options={PROVIDER_OPTIONS} selectedValue={expProvider} onSelect={setExpProvider}>
                      <View style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: '#0f172a' }} numberOfLines={1}>
                          {PROVIDER_OPTIONS.find((p) => p.value === expProvider)?.label || expProvider}
                        </Text>
                        <Feather name="chevron-down" size={14} color="#64748b" />
                      </View>
                    </NativeSelectMenu>
                  </View>
                  {!expEditId && (
                    <View style={{ flex: 0.8 }}>
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569', marginBottom: 4 }}>Repetir (meses)</Text>
                      <TextInput
                        keyboardType="number-pad"
                        value={expRepeatMonths}
                        onChangeText={setExpRepeatMonths}
                        placeholder="1"
                        style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13 }}
                      />
                    </View>
                  )}
                </View>

                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569' }}>Subcategoria / Documento NF</Text>
                <TextInput
                  value={expCategory}
                  onChangeText={setExpCategory}
                  placeholder="Subcategoria opcional"
                  style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13 }}
                />
                <TextInput
                  value={expDoc}
                  onChangeText={setExpDoc}
                  placeholder="Nº NF / Boleto opcional"
                  style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13 }}
                />
                <TextInput
                  value={expNotes}
                  onChangeText={setExpNotes}
                  placeholder="Observações contábeis"
                  multiline
                  style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, minHeight: 56 }}
                />

                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={savingExpense}
                  onPress={submitExpenseModal}
                  style={{ backgroundColor: '#1B4332', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 6, opacity: savingExpense ? 0.6 : 1 }}
                >
                  <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 14 }}>
                    {savingExpense ? 'Salvando...' : expEditId ? 'Salvar Alterações' : 'Confirmar Lançamento'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ==================== MODAL: CONFIGURAÇÃO FISCAL ==================== */}
      <Modal visible={fiscalModalVisible} transparent animationType="slide" onRequestClose={() => setFiscalModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '88%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#0f172a' }}>
                Configuração Fiscal & Fechamento
              </Text>
              <TouchableOpacity onPress={() => setFiscalModalVisible(false)} style={{ padding: 6 }}>
                <Feather name="x" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ gap: 10, paddingBottom: 20 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569' }}>Razão Social</Text>
                <TextInput
                  value={cfgLegalName}
                  onChangeText={setCfgLegalName}
                  style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13 }}
                />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569', marginBottom: 4 }}>CNPJ</Text>
                    <TextInput
                      value={cfgCnpj}
                      onChangeText={setCfgCnpj}
                      placeholder="00.000.000/0001-00"
                      style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13 }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569', marginBottom: 4 }}>Enquadramento</Text>
                    <NativeSelectMenu title="Regime Tributário" options={TAX_REGIME_OPTIONS} selectedValue={cfgTaxRegime} onSelect={setCfgTaxRegime}>
                      <View style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: '#0f172a' }} numberOfLines={1}>
                          {TAX_REGIME_OPTIONS.find((t) => t.value === cfgTaxRegime)?.label || cfgTaxRegime}
                        </Text>
                        <Feather name="chevron-down" size={14} color="#64748b" />
                      </View>
                    </NativeSelectMenu>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569', marginBottom: 4 }}>Alíquota Padrão (%)</Text>
                    <TextInput
                      keyboardType="decimal-pad"
                      value={cfgDefaultVarTax}
                      onChangeText={setCfgDefaultVarTax}
                      placeholder="Ex.: 6.00"
                      style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13 }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569', marginBottom: 4 }}>DAS Fixo Padrão (R$)</Text>
                    <TextInput
                      keyboardType="decimal-pad"
                      value={cfgDefaultFixedTax}
                      onChangeText={setCfgDefaultFixedTax}
                      placeholder="Ex.: 86.05"
                      style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13 }}
                    />
                  </View>
                </View>

                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#1B4332', marginTop: 6 }}>
                  Exceção Específica — {meta.selectedMonthLabel}/{meta.year} (opcional)
                </Text>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569', marginBottom: 4 }}>Alíquota Mês (%)</Text>
                    <TextInput
                      keyboardType="decimal-pad"
                      value={cfgMonthVarTax}
                      onChangeText={setCfgMonthVarTax}
                      placeholder="Opcional"
                      style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13 }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569', marginBottom: 4 }}>Fixo Mês (R$)</Text>
                    <TextInput
                      keyboardType="decimal-pad"
                      value={cfgMonthFixedTax}
                      onChangeText={setCfgMonthFixedTax}
                      placeholder="Opcional"
                      style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13 }}
                    />
                  </View>
                </View>

                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569' }}>IRPJ/CSLL s/ Lucro (%) & Notas</Text>
                <TextInput
                  keyboardType="decimal-pad"
                  value={cfgMonthProfitTax}
                  onChangeText={setCfgMonthProfitTax}
                  placeholder="0.00"
                  style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13 }}
                />
                <TextInput
                  value={cfgMonthNotes}
                  onChangeText={setCfgMonthNotes}
                  placeholder="Notas da competência para o contador"
                  multiline
                  style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, minHeight: 54 }}
                />

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    disabled={savingFiscal}
                    onPress={() => submitFiscalConfig('save')}
                    style={{ flex: 1, backgroundColor: '#1B4332', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
                  >
                    <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 13 }}>Salvar</Text>
                  </TouchableOpacity>
                  {!isClosed && (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      disabled={savingFiscal}
                      onPress={() => submitFiscalConfig('close')}
                      style={{ flex: 1, backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
                    >
                      <Text style={{ fontFamily: 'Inter_700Bold', color: '#b91c1c', fontSize: 13 }}>🔒 Salvar e Fechar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ==================== MODAL: EXPORTAÇÃO CONTÁBIL ==================== */}
      <Modal visible={exportModalVisible} transparent animationType="fade" onRequestClose={() => setExportModalVisible(false)}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setExportModalVisible(false)}
          style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'center', paddingHorizontal: 20 }}
        >
          <View
            style={{ backgroundColor: '#ffffff', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#e2e8f0' }}
            onStartShouldSetResponder={() => true}
          >
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#0f172a', marginBottom: 4 }}>
              Exportar Pacote Contábil
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748b', marginBottom: 14 }}>
              Gere e compartilhe diretamente para contabilidade ou WhatsApp.
            </Text>

            {[
              { key: 'excel' as const, label: 'Pacote Contábil Completo', tag: '.XLS' },
              { key: 'annual_csv' as const, label: 'DRE Anual (12 Meses)', tag: '.CSV' },
              { key: 'monthly_csv' as const, label: 'DRE Mês Selecionado', tag: '.CSV' },
              { key: 'rev_csv' as const, label: 'Razão de Receitas', tag: '.CSV' },
              { key: 'exp_csv' as const, label: 'Razão de Despesas', tag: '.CSV' },
            ].map((item) => (
              <TouchableOpacity
                key={item.key}
                disabled={!!exportingKey}
                onPress={() => handleExport(item.key)}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: '#f8fafc',
                  borderColor: '#e2e8f0',
                  borderWidth: 1,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  marginBottom: 8,
                }}
              >
                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#0f172a' }}>
                  {exportingKey === item.key ? 'Gerando...' : item.label}
                </Text>
                <View style={{ backgroundColor: '#e2e8f0', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#475569' }}>{item.tag}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ==================== MODAL: TOOLTIP ==================== */}
      <Modal visible={!!activeTooltip} transparent animationType="fade" onRequestClose={() => setActiveTooltip(null)}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setActiveTooltip(null)}
          style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}
        >
          <View
            style={{ backgroundColor: '#ffffff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: '#e2e8f0' }}
            onStartShouldSetResponder={() => true}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="info" size={15} color="#1B4332" />
              </View>
              <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#1B4332', flex: 1 }}>
                {activeTooltip?.title}
              </Text>
            </View>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: '#475569', lineHeight: 19, marginBottom: 16 }}>
              {activeTooltip?.text}
            </Text>
            <TouchableOpacity
              onPress={() => setActiveTooltip(null)}
              style={{ backgroundColor: '#1B4332', borderRadius: 999, paddingVertical: 10, alignItems: 'center' }}
            >
              <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 13 }}>Entendi</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <YeloToast message={toastMessage} type={toastType} onDismiss={() => setToastMessage(null)} />
    </View>
  );
}
