import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Share,
  StyleSheet,
  ScrollView,
} from 'react-native';
import NativeSelectMenu from '../../components/NativeSelectMenu';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import api from '../../services/api';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';

// Configuração do calendário para Português do Brasil
if (!LocaleConfig.locales['pt-br']) {
  LocaleConfig.locales['pt-br'] = {
    monthNames: [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ],
    monthNamesShort: [
      'Jan.', 'Fev.', 'Mar.', 'Abr.', 'Mai.', 'Jun.',
      'Jul.', 'Ago.', 'Set.', 'Out.', 'Nov.', 'Dez.'
    ],
    dayNames: [
      'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
      'Quinta-feira', 'Sexta-feira', 'Sábado'
    ],
    dayNamesShort: ['Dom.', 'Seg.', 'Ter.', 'Qua.', 'Qui.', 'Sex.', 'Sáb.'],
    today: 'Hoje'
  };
}
LocaleConfig.defaultLocale = 'pt-br';

// Helpers de data com fuso local brasileiro (evita bug de UTC do toISOString)
const getLocalBrazilianDate = (d = new Date()) => {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const getLocalISODate = (d = new Date()) => {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${year}-${month}-${day}`;
};

const parseBrazilianToISO = (brDate: string) => {
  if (!brDate) return getLocalISODate();
  const parts = brDate.trim().split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return brDate;
};

const parseISOToBrazilian = (isoDate: string) => {
  if (!isoDate) return getLocalBrazilianDate();
  const parts = isoDate.trim().split('-');
  if (parts.length === 3) {
    const year = parts[0];
    const month = parts[1].padStart(2, '0');
    const day = parts[2].padStart(2, '0');
    return `${day}/${month}/${year}`;
  }
  return isoDate;
};

const PERIODO_OPTIONS = [
  { label: 'Este Mês', value: 'este_mes' },
  { label: 'Mês Anterior', value: 'mes_anterior' },
  { label: 'Últimos 3 Meses', value: 'ultimos_3_meses' },
  { label: 'Este Ano', value: 'este_ano' },
  { label: 'Todo o Período', value: 'todos' },
];

interface AppointmentItem {
  id: number | string;
  title?: string;
  start: string;
  end?: string;
  status: string;
  value?: number;
}

interface ExpenseItem {
  id: number | string;
  description: string;
  value: number;
  date: string;
  psychologistId?: number;
}

interface TransactionItem {
  id: string | number;
  source: 'appointment' | 'expense';
  desc: string;
  date: string;
  value: number;
  type: 'in' | 'out';
  status?: string;
}

export default function FinanceiroScreen() {
  const router = useRouter();

  // Estados principais
  const [showTip, setShowTip] = useState(true);
  const [periodo, setPeriodo] = useState('este_mes');
  const [isSyncing, setIsSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Dados brutos da API
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);

  // Modal: Nova Despesa
  const [modalExpenseVisible, setModalExpenseVisible] = useState(false);
  const [expDesc, setExpDesc] = useState('');
  const [expValue, setExpValue] = useState('');
  const [expDateBR, setExpDateBR] = useState(() => getLocalBrazilianDate());
  const [showExpenseCalendar, setShowExpenseCalendar] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [expenseError, setExpenseError] = useState('');

  const todayBR = useMemo(() => getLocalBrazilianDate(), []);
  const yesterdayBR = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return getLocalBrazilianDate(d);
  }, []);
  const isExpToday = expDateBR === todayBR;
  const isExpYesterday = expDateBR === yesterdayBR;

  // Modal: Exportar
  const [modalExportVisible, setModalExportVisible] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Modal: Confirmar Exclusão de Despesa
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<TransactionItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const selectedPeriodoLabel = useMemo(() => {
    return PERIODO_OPTIONS.find((p) => p.value === periodo)?.label || 'Este Mês';
  }, [periodo]);

  // Carrega dados da API Yelo silenciosamente em background
  const loadFinancialData = useCallback(async (selectedPeriod: string, isPullRefresh = false) => {
    if (isPullRefresh) {
      setRefreshing(true);
    } else {
      setIsSyncing(true);
    }

    try {
      const response = await api.get('/api/financials/dashboard', {
        params: { period: selectedPeriod },
      });

      if (response.data) {
        setAppointments(response.data.appointments || []);
        setExpenses(response.data.expenses || []);
      }
    } catch (err: any) {
      setAppointments((prev) => prev || []);
      setExpenses((prev) => prev || []);
    } finally {
      setIsSyncing(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFinancialData(periodo);
    }, [periodo, loadFinancialData])
  );

  const onRefresh = useCallback(() => {
    loadFinancialData(periodo, true);
  }, [periodo, loadFinancialData]);

  // Cálculos de KPI
  const income = useMemo(() => {
    return appointments
      .filter((a) => a.status === 'done')
      .reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
  }, [appointments]);

  const pending = useMemo(() => {
    return appointments
      .filter((a) => a.status === 'scheduled' || a.status === 'confirmed')
      .reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
  }, [appointments]);

  const totalExpenses = useMemo(() => {
    return expenses.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
  }, [expenses]);

  const netBalance = useMemo(() => {
    return income - totalExpenses;
  }, [income, totalExpenses]);

  // Lista unificada do Extrato Recente
  const transactions: TransactionItem[] = useMemo(() => {
    const list: TransactionItem[] = [
      ...appointments
        .filter((a) => a.status === 'done')
        .map((a) => ({
          id: `apt_${a.id}`,
          source: 'appointment' as const,
          desc: a.title ? `Sessão: ${a.title}` : 'Sessão Realizada',
          date: a.start,
          value: Number(a.value) || 0,
          type: 'in' as const,
          status: a.status,
        })),
      ...expenses.map((e) => ({
        id: e.id,
        source: 'expense' as const,
        desc: e.description || 'Despesa Operacional',
        date: e.date,
        value: Number(e.value) || 0,
        type: 'out' as const,
      })),
    ];

    return list.sort((a, b) => {
      const timeA = new Date(a.date).getTime() || 0;
      const timeB = new Date(b.date).getTime() || 0;
      return timeB - timeA;
    });
  }, [appointments, expenses]);

  // Formatadores
  const formatCurrency = (val: number = 0) => {
    try {
      return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    } catch {
      return `R$ ${val.toFixed(2).replace('.', ',')}`;
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
      }
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return getLocalBrazilianDate(d);
    } catch {
      return dateStr;
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate('/(tabs)/clinica');
    }
  };

  // --- CRIAÇÃO DE DESPESA ---
  const handleOpenAddExpense = () => {
    setExpDesc('');
    setExpValue('');
    setExpDateBR(getLocalBrazilianDate());
    setExpenseError('');
    setModalExpenseVisible(true);
  };

  const handleSaveExpense = async () => {
    const cleanDesc = expDesc.trim();
    if (!cleanDesc) {
      setExpenseError('Informe uma descrição para a despesa.');
      return;
    }

    const parsedVal = parseFloat(expValue.replace(/\./g, '').replace(',', '.'));
    if (isNaN(parsedVal) || parsedVal <= 0) {
      setExpenseError('Informe um valor válido maior que zero.');
      return;
    }

    if (!expDateBR) {
      setExpenseError('Informe a data da despesa.');
      return;
    }

    const isoDate = parseBrazilianToISO(expDateBR);

    setExpenseError('');
    setSavingExpense(true);

    try {
      await api.post('/api/financials/expenses', {
        description: cleanDesc,
        value: parsedVal,
        date: isoDate,
      });

      setModalExpenseVisible(false);
      await loadFinancialData(periodo, true);
      Alert.alert('Sucesso', 'Despesa registrada com sucesso!');
    } catch (err: any) {
      console.warn('Erro ao salvar despesa:', err?.response?.data || err.message);
      const msg = err?.response?.data?.error || 'Não foi possível salvar a despesa.';
      setExpenseError(msg);
    } finally {
      setSavingExpense(false);
    }
  };

  // --- EXCLUSÃO DE DESPESA ---
  const handlePromptDelete = (item: TransactionItem) => {
    if (item.source !== 'expense') return;
    setItemToDelete(item);
    setDeleteModalVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/api/financials/expenses/${itemToDelete.id}`);
      setDeleteModalVisible(false);
      setItemToDelete(null);
      await loadFinancialData(periodo, true);
      Alert.alert('Excluída', 'Despesa removida do extrato.');
    } catch (err: any) {
      console.warn('Erro ao excluir despesa:', err?.response?.data || err.message);
      Alert.alert('Erro', 'Não foi possível excluir esta despesa.');
    } finally {
      setDeleting(false);
    }
  };

  // --- EXPORTAÇÃO CSV ---
  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const now = new Date();
      const exportTitle = `Extrato_${selectedPeriodoLabel.replace(/\s+/g, '_')}_${now.toISOString().slice(0, 10)}`;

      // Monta CSV com UTF-8 BOM
      let csv = '\uFEFF';
      csv += `Extrato Financeiro Yelo - Período: ${selectedPeriodoLabel}\n`;
      csv += `Gerado em: ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}\n\n`;
      csv += 'Data;Descrição;Valor;Tipo\n';

      let totalIn = 0;
      let totalOut = 0;

      transactions.forEach((tx) => {
        const dStr = formatDate(tx.date);
        const descClean = (tx.desc || '').replace(/"/g, '""');
        const valFormatted = tx.value.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        const tipoLabel = tx.type === 'in' ? 'Entrada' : 'Saída';

        if (tx.type === 'in') totalIn += tx.value;
        else totalOut += tx.value;

        csv += `${dStr};"${descClean}";"${valFormatted}";${tipoLabel}\n`;
      });

      const saldoFinal = totalIn - totalOut;
      csv += '\n';
      csv += `;"TOTAL RECEITAS";"${totalIn.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}";\n`;
      csv += `;"TOTAL DESPESAS";"${totalOut.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}";\n`;
      csv += `;"SALDO LÍQUIDO";"${saldoFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}";\n`;

      const fileName = `${exportTitle}.csv`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Exportar Extrato Financeiro Yelo',
          UTI: 'public.comma-separated-values-text',
        });
        setModalExportVisible(false);
      } else {
        // Fallback nativo
        await Share.share({
          title: fileName,
          message: csv,
        });
        setModalExportVisible(false);
      }
    } catch (err: any) {
      console.warn('Erro ao exportar CSV:', err);
      // Fallback para Clipboard
      try {
        await Clipboard.setStringAsync(
          transactions.map((t) => `${formatDate(t.date)} | ${t.desc} | R$ ${t.value}`).join('\n')
        );
        Alert.alert(
          'Extrato Copiado',
          'Não foi possível abrir o compartilhador, mas os dados do extrato foram copiados para a sua área de transferência!'
        );
        setModalExportVisible(false);
      } catch {
        Alert.alert('Erro', 'Não foi possível gerar o arquivo de exportação.');
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1B4332"
            colors={['#1B4332']}
          />
        }
      >
        {/* HEADER VERDE */}
        <View className="mx-6 mt-6 mb-6 bg-[#1B4332] p-[22px] rounded-[16px] shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
          <View className="flex-row items-center mb-2">
            <TouchableOpacity
              onPress={handleBack}
              className="w-10 h-10 bg-white/20 rounded-full items-center justify-center mr-4"
            >
              <Feather name="arrow-left" size={20} color="white" />
            </TouchableOpacity>
            <Text className="font-title text-[26px] text-white leading-tight">
              Gestão Financeira
            </Text>
          </View>
          <Text className="font-sans text-[15px] text-white/85">
            Acompanhe o fluxo de caixa, receitas e despesas.
          </Text>
        </View>

        {/* DICA UX */}
        {showTip && (
          <View className="mx-6 mb-6 bg-white border border-[#e5e7eb] rounded-[16px] p-5 flex-row shadow-sm relative">
            <TouchableOpacity
              className="absolute top-2 right-2 p-2 z-10"
              onPress={() => setShowTip(false)}
            >
              <Feather name="x" size={18} color="#9ca3af" />
            </TouchableOpacity>

            <View className="w-[45px] h-[45px] bg-[#f0fdf4] rounded-full items-center justify-center mr-4">
              <Text className="text-[24px]">🤖</Text>
            </View>
            <View className="flex-1 pr-4">
              <Text className="font-sans font-bold text-[#1B4332] text-[15px] mb-1">
                Seu financeiro é integrado à Agenda!
              </Text>
              <Text className="font-sans text-[#6b7280] text-[13px] leading-relaxed">
                Ao finalizar uma sessão na Agenda e marcar como "Realizado", o valor é somado automaticamente na sua Receita.
              </Text>
            </View>
          </View>
        )}

        {/* AÇÕES E FILTRO */}
        <View className="px-6 mb-6">
          <View className="flex-row space-x-3 mb-4 w-full">
            {/* Botão Lançar Despesa */}
            <TouchableOpacity
              onPress={handleOpenAddExpense}
              className="flex-1 bg-[#e63946] flex-row items-center justify-center py-[12px] px-3 rounded-full shadow-sm mr-2"
              activeOpacity={0.85}
            >
              <Text className="text-white text-[18px] font-bold mr-1.5 leading-none">+</Text>
              <Text className="text-white font-sans font-bold text-[14px]">Despesa</Text>
            </TouchableOpacity>

            {/* Botão Exportar */}
            <TouchableOpacity
              onPress={() => setModalExportVisible(true)}
              className="flex-1 bg-white border border-[#e5e7eb] flex-row items-center justify-center py-[12px] px-3 rounded-full shadow-sm ml-2"
              activeOpacity={0.85}
            >
              <Feather name="download" size={16} color="#495057" style={{ marginRight: 6 }} />
              <Text className="text-[#495057] font-sans font-bold text-[14px]">Exportar</Text>
            </TouchableOpacity>
          </View>

          {/* Filtro de Período */}
          <View className="w-full flex-row justify-between items-center bg-white border border-[#e5e7eb] rounded-[14px] p-3 shadow-sm">
            <View className="flex-row items-center">
              <Feather name="calendar" size={16} color="#1B4332" style={{ marginRight: 6 }} />
              <Text className="font-sans font-semibold text-[#4b5563] text-[14px]">Período:</Text>
            </View>
            <NativeSelectMenu
              title="Filtrar por Período"
              options={PERIODO_OPTIONS}
              selectedValue={periodo}
              onSelect={(val) => {
                setPeriodo(val);
                loadFinancialData(val);
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#f0fdf4',
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: '#bbf7d0',
                }}
              >
                <Text
                  className="font-sans font-bold text-[#1B4332] text-[13px]"
                  style={{ marginRight: 6 }}
                >
                  {selectedPeriodoLabel}
                </Text>
                <Feather name="chevron-down" size={14} color="#1B4332" />
              </View>
            </NativeSelectMenu>
          </View>
        </View>

        {/* CARDS DE KPI (2x2 Grid) - Sempre visíveis com atualização em tempo real */}
        <View className="px-6 mb-8">
          <View className="flex-row justify-between mb-4">
            {/* Receita Realizada */}
            <View className="bg-white border border-[#e5e7eb] rounded-[16px] p-4 flex-1 mr-2 shadow-sm">
              <View className="flex-row items-center mb-2">
                <View className="bg-[#e8f5e9] p-1.5 rounded-lg mr-2">
                  <Text className="text-[14px]">📈</Text>
                </View>
                <Text className="font-sans font-bold text-[#333] text-[12px] flex-1" numberOfLines={1}>
                  Receita Realizada
                </Text>
              </View>
              <Text className="font-title text-[#1B4332] text-[19px] mb-1">
                {formatCurrency(income)}
              </Text>
              <Text className="font-sans text-[11px] text-[#888]">Sessões pagas/concluídas</Text>
            </View>

            {/* A Receber */}
            <View className="bg-white border border-[#e5e7eb] rounded-[16px] p-4 flex-1 ml-2 shadow-sm">
              <View className="flex-row items-center mb-2">
                <View className="bg-[#fff3e0] p-1.5 rounded-lg mr-2">
                  <Text className="text-[14px]">⏳</Text>
                </View>
                <Text className="font-sans font-bold text-[#333] text-[12px] flex-1" numberOfLines={1}>
                  A Receber
                </Text>
              </View>
              <Text className="font-title text-[#d97706] text-[19px] mb-1">
                {formatCurrency(pending)}
              </Text>
              <Text className="font-sans text-[11px] text-[#888]">Agendamentos futuros</Text>
            </View>
          </View>

          <View className="flex-row justify-between">
            {/* Despesas */}
            <View className="bg-white border border-[#e5e7eb] rounded-[16px] p-4 flex-1 mr-2 shadow-sm">
              <View className="flex-row items-center mb-2">
                <View className="bg-[#ffebee] p-1.5 rounded-lg mr-2">
                  <Text className="text-[14px]">💸</Text>
                </View>
                <Text className="font-sans font-bold text-[#333] text-[12px] flex-1" numberOfLines={1}>
                  Despesas
                </Text>
              </View>
              <Text className="font-title text-[#e63946] text-[19px] mb-1">
                {formatCurrency(totalExpenses)}
              </Text>
              <Text className="font-sans text-[11px] text-[#888]">Gastos operacionais</Text>
            </View>

            {/* Saldo Líquido */}
            <View
              className={`border rounded-[16px] p-4 flex-1 ml-2 shadow-sm ${
                netBalance >= 0
                  ? 'bg-[#f0fdf4] border-[#bbf7d0]'
                  : 'bg-[#fff1f2] border-[#fecdd3]'
              }`}
            >
              <View className="flex-row items-center mb-2">
                <View className="bg-white p-1.5 rounded-lg mr-2 shadow-sm">
                  <Text className="text-[14px]">{netBalance >= 0 ? '💎' : '⚠️'}</Text>
                </View>
                <Text className="font-sans font-bold text-[#333] text-[12px] flex-1" numberOfLines={1}>
                  Saldo Líquido
                </Text>
              </View>
              <Text
                className={`font-title text-[19px] mb-1 ${
                  netBalance >= 0 ? 'text-[#166534]' : 'text-[#e63946]'
                }`}
              >
                {formatCurrency(netBalance)}
              </Text>
              <Text
                className={`font-sans text-[11px] ${
                  netBalance >= 0 ? 'text-[#166534]' : 'text-[#e63946]'
                }`}
              >
                {netBalance >= 0 ? 'Lucro do período' : 'Déficit no período'}
              </Text>
            </View>
          </View>
        </View>

        {/* EXTRATO RECENTE */}
        <View className="px-6 pb-12">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="font-title text-[20px] text-[#1B4332]">Extrato Recente</Text>
            <View className="bg-[#f3f4f6] px-2.5 py-1 rounded-full flex-row items-center">
              {isSyncing && (
                <ActivityIndicator size="small" color="#1B4332" style={{ marginRight: 6 }} />
              )}
              <Text className="text-[#6b7280] text-[12px] font-sans font-semibold">
                {transactions.length} movimentaç{transactions.length === 1 ? 'ão' : 'ões'}
              </Text>
            </View>
          </View>

          {transactions.length === 0 ? (
            <View className="bg-white border border-[#e5e7eb] rounded-[16px] p-8 items-center justify-center text-center shadow-sm">
              <View className="w-14 h-14 rounded-full bg-[#f9fafb] items-center justify-center mb-3">
                <Feather name="file-text" size={26} color="#9ca3af" />
              </View>
              <Text className="font-title text-[#1B4332] text-[16px] mb-1 text-center">
                Nenhuma movimentação neste período
              </Text>
              <Text className="font-sans text-[#6b7280] text-[13px] text-center leading-relaxed max-w-[280px]">
                Sessões marcadas como "Realizado" na sua Agenda e novas despesas registradas aparecerão aqui automaticamente.
              </Text>
            </View>
          ) : (
            <View className="bg-white border border-[#e5e7eb] rounded-[16px] overflow-hidden shadow-sm">
              {transactions.map((tx, index) => (
                <View
                  key={tx.id}
                  className={`flex-row items-center p-4 ${
                    index < transactions.length - 1 ? 'border-b border-[#f1f3f5]' : ''
                  }`}
                >
                  <View
                    className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                      tx.type === 'in' ? 'bg-[#e8f5e9]' : 'bg-[#ffebee]'
                    }`}
                  >
                    <Feather
                      name={tx.type === 'in' ? 'arrow-down-left' : 'arrow-up-right'}
                      size={18}
                      color={tx.type === 'in' ? '#1B4332' : '#e63946'}
                    />
                  </View>

                  <View className="flex-1 mr-2">
                    <Text className="font-sans font-bold text-[#333] text-[14px] mb-0.5" numberOfLines={1}>
                      {tx.desc}
                    </Text>
                    <Text className="font-sans text-[#888] text-[12px]">
                      {formatDate(tx.date)}
                    </Text>
                  </View>

                  <View className="items-end mr-1">
                    <Text
                      className={`font-sans font-bold text-[15px] ${
                        tx.type === 'in' ? 'text-[#1B4332]' : 'text-[#e63946]'
                      }`}
                    >
                      {tx.type === 'in' ? '+' : '-'} {formatCurrency(tx.value)}
                    </Text>
                    <View
                      className={`px-2 py-0.5 rounded-full mt-0.5 ${
                        tx.type === 'in' ? 'bg-[#dcfce7]' : 'bg-[#fee2e2]'
                      }`}
                    >
                      <Text
                        className={`font-sans text-[10px] font-bold ${
                          tx.type === 'in' ? 'text-[#15803d]' : 'text-[#b91c1c]'
                        }`}
                      >
                        {tx.type === 'in' ? 'Entrada' : 'Saída'}
                      </Text>
                    </View>
                  </View>

                  {/* Botão de Excluir Despesa */}
                  {tx.source === 'expense' && (
                    <TouchableOpacity
                      onPress={() => handlePromptDelete(tx)}
                      className="w-8 h-8 rounded-full items-center justify-center bg-[#f9fafb] ml-1"
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Feather name="trash-2" size={14} color="#e63946" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ============================================================ */}
      {/* MODAL: LANÇAR DESPESA (BOTTOM SHEET YELO) */}
      {/* ============================================================ */}
      <Modal
        visible={modalExpenseVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalExpenseVisible(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View className="flex-1 justify-end bg-black/50">
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              className="w-full"
            >
              <View className="bg-white rounded-t-[32px] p-6 pb-10 border-t border-[#f0f0f0] shadow-2xl max-h-[90vh]">
                {/* Drag Handle */}
                <View className="w-12 h-1.5 bg-[#e5e7eb] rounded-full self-center mb-4" />

                {/* Header */}
                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-row items-center">
                    <View className="w-11 h-11 rounded-full bg-[#fee2e2] items-center justify-center mr-3">
                      <Text className="text-[20px]">💸</Text>
                    </View>
                    <View>
                      <Text className="font-title text-[20px] text-[#1B4332]">Nova Despesa</Text>
                      <Text className="font-sans text-[13px] text-[#6b7280]">
                        Custos operacionais do consultório
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => setModalExpenseVisible(false)}
                    className="w-9 h-9 rounded-full bg-[#f3f4f6] items-center justify-center"
                  >
                    <Feather name="x" size={18} color="#4b5563" />
                  </TouchableOpacity>
                </View>

                {/* Error */}
                {expenseError ? (
                  <View className="bg-red-50 border border-red-200 rounded-[12px] p-3 mb-4">
                    <Text className="text-[#b91c1c] text-[13px] font-sans">{expenseError}</Text>
                  </View>
                ) : null}

                {/* Campo: Descrição */}
                <View className="mb-4">
                  <Text className="text-[12px] font-bold text-[#4b5563] mb-1.5 tracking-wide uppercase font-sans">
                    Descrição
                  </Text>
                  <TextInput
                    className="w-full bg-[#f9fafb] border border-[#e5e7eb] rounded-[12px] px-4 py-3 text-[15px] text-[#111] font-sans"
                    placeholder="Ex: Aluguel do consultório, Supervisão, Zoom..."
                    placeholderTextColor="#9ca3af"
                    value={expDesc}
                    onChangeText={setExpDesc}
                  />
                </View>

                {/* Linha com Valor e Data */}
                <View className="flex-row space-x-3 mb-6">
                  {/* Campo: Valor */}
                  <View className="flex-1 mr-2">
                    <Text className="text-[12px] font-bold text-[#4b5563] mb-1.5 tracking-wide uppercase font-sans">
                      Valor (R$)
                    </Text>
                    <TextInput
                      className="w-full bg-[#f9fafb] border border-[#e5e7eb] rounded-[12px] px-4 py-3 text-[15px] text-[#111] font-sans"
                      placeholder="0,00"
                      placeholderTextColor="#9ca3af"
                      keyboardType="decimal-pad"
                      value={expValue}
                      onChangeText={setExpValue}
                    />
                  </View>

                  {/* Campo: Data no padrão brasileiro DD/MM/AAAA */}
                  <View className="flex-1 ml-2">
                    <Text className="text-[12px] font-bold text-[#4b5563] mb-1.5 tracking-wide uppercase font-sans">
                      Data (DD/MM/AAAA)
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        Keyboard.dismiss();
                        setShowExpenseCalendar(true);
                      }}
                      activeOpacity={0.75}
                      className="w-full bg-[#f9fafb] border border-[#e5e7eb] rounded-[12px] px-3.5 py-3 flex-row items-center justify-between"
                    >
                      <Text className="text-[15px] text-[#111] font-sans font-medium">
                        {expDateBR}
                      </Text>
                      <Feather name="calendar" size={18} color="#1B4332" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Atalhos Rápidos de Data com cálculo no fuso local e estado selecionado */}
                <View className="flex-row items-center mb-6">
                  <Text className="text-[12px] text-[#888] font-sans mr-2">Atalhos:</Text>
                  
                  <TouchableOpacity
                    onPress={() => setExpDateBR(todayBR)}
                    className={`px-3.5 py-1.5 rounded-full mr-2 border flex-row items-center ${
                      isExpToday
                        ? 'bg-[#1B4332] border-[#1B4332]'
                        : 'bg-[#f3f4f6] border-[#e5e7eb]'
                    }`}
                    activeOpacity={0.7}
                  >
                    {isExpToday && (
                      <Feather name="check" size={12} color="#ffffff" style={{ marginRight: 4 }} />
                    )}
                    <Text
                      className={`text-[12px] font-sans ${
                        isExpToday ? 'text-white font-bold' : 'text-[#4b5563] font-medium'
                      }`}
                    >
                      Hoje
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setExpDateBR(yesterdayBR)}
                    className={`px-3.5 py-1.5 rounded-full mr-2 border flex-row items-center ${
                      isExpYesterday
                        ? 'bg-[#1B4332] border-[#1B4332]'
                        : 'bg-[#f3f4f6] border-[#e5e7eb]'
                    }`}
                    activeOpacity={0.7}
                  >
                    {isExpYesterday && (
                      <Feather name="check" size={12} color="#ffffff" style={{ marginRight: 4 }} />
                    )}
                    <Text
                      className={`text-[12px] font-sans ${
                        isExpYesterday ? 'text-white font-bold' : 'text-[#4b5563] font-medium'
                      }`}
                    >
                      Ontem
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Botões de Ação */}
                <View className="flex-row items-center space-x-3">
                  <TouchableOpacity
                    onPress={() => setModalExpenseVisible(false)}
                    className="flex-1 bg-[#f3f4f6] py-3.5 rounded-full items-center justify-center mr-2"
                  >
                    <Text className="text-[#4b5563] font-bold text-[15px] font-sans">Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleSaveExpense}
                    disabled={savingExpense}
                    className="flex-[2] bg-[#e63946] py-3.5 rounded-full items-center justify-center flex-row ml-2"
                    style={{ shadowColor: '#e63946', shadowOpacity: 0.25, shadowRadius: 15, shadowOffset: { width: 0, height: 4 } }}
                  >
                    {savingExpense ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Feather name="check" size={18} color="#fff" style={{ marginRight: 6 }} />
                        <Text className="text-white font-bold text-[15px] font-sans">
                          Registrar Saída
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>

            {/* OVERLAY DO CALENDÁRIO DENTRO DO MESMO MODAL (EVITA CONFLITO NATIVO DO IOS) */}
            {showExpenseCalendar && (
              <View
                style={StyleSheet.absoluteFill}
                className="bg-black/60 justify-center items-center px-4 z-50"
              >
                <TouchableWithoutFeedback onPress={() => setShowExpenseCalendar(false)}>
                  <View style={StyleSheet.absoluteFill} />
                </TouchableWithoutFeedback>
                <View className="w-full max-w-[360px] bg-white rounded-[24px] p-5 shadow-2xl z-50">
                  {/* Header do Calendário */}
                  <View className="flex-row items-center justify-between pb-3 mb-2 border-b border-[#f1f3f5]">
                    <View className="flex-row items-center">
                      <View className="w-8 h-8 rounded-full bg-[#f0fdf4] items-center justify-center mr-2.5">
                        <Feather name="calendar" size={16} color="#1B4332" />
                      </View>
                      <Text className="font-title text-[18px] text-[#1B4332]">Selecionar Data</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setShowExpenseCalendar(false)}
                      className="w-8 h-8 rounded-full bg-[#f3f4f6] items-center justify-center"
                    >
                      <Feather name="x" size={16} color="#4b5563" />
                    </TouchableOpacity>
                  </View>

                  {/* Calendário Interativo */}
                  <Calendar
                    current={parseBrazilianToISO(expDateBR)}
                    enableSwipeMonths={true}
                    markedDates={{
                      [parseBrazilianToISO(expDateBR)]: {
                        selected: true,
                        selectedColor: '#1B4332',
                      },
                    }}
                    onDayPress={(day: any) => {
                      const br = parseISOToBrazilian(day.dateString);
                      setExpDateBR(br);
                      setShowExpenseCalendar(false);
                    }}
                    theme={{
                      backgroundColor: '#ffffff',
                      calendarBackground: '#ffffff',
                      textSectionTitleColor: '#6b7280',
                      selectedDayBackgroundColor: '#1B4332',
                      selectedDayTextColor: '#ffffff',
                      todayTextColor: '#1B4332',
                      dayTextColor: '#1f2937',
                      textDisabledColor: '#d1d5db',
                      dotColor: '#1B4332',
                      arrowColor: '#1B4332',
                      monthTextColor: '#1B4332',
                      textDayFontWeight: '500',
                      textMonthFontWeight: '700',
                      textDayHeaderFontWeight: '600',
                      textDayFontSize: 14,
                      textMonthFontSize: 16,
                      textDayHeaderFontSize: 11,
                    }}
                  />

                  {/* Botão rápido: Selecionar Hoje */}
                  <TouchableOpacity
                    onPress={() => {
                      setExpDateBR(todayBR);
                      setShowExpenseCalendar(false);
                    }}
                    className="mt-3 bg-[#f0fdf4] border border-[#bbf7d0] py-2.5 rounded-full items-center justify-center flex-row"
                  >
                    <Feather name="check" size={14} color="#166534" style={{ marginRight: 6 }} />
                    <Text className="text-[#166534] font-bold text-[13px] font-sans">
                      Selecionar Hoje ({todayBR})
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL: EXPORTAR EXTRATO */}
      {/* ============================================================ */}
      <Modal
        visible={modalExportVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalExportVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-[32px] p-6 pb-10 border-t border-[#f0f0f0] shadow-2xl">
            {/* Drag Handle */}
            <View className="w-12 h-1.5 bg-[#e5e7eb] rounded-full self-center mb-4" />

            {/* Header */}
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <View className="w-11 h-11 rounded-full bg-[#f0fdf4] items-center justify-center mr-3">
                  <Text className="text-[20px]">📊</Text>
                </View>
                <View>
                  <Text className="font-title text-[20px] text-[#1B4332]">Exportar Extrato</Text>
                  <Text className="font-sans text-[13px] text-[#6b7280]">
                    Relatório CSV compatível com Excel e Numbers
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setModalExportVisible(false)}
                className="w-9 h-9 rounded-full bg-[#f3f4f6] items-center justify-center"
              >
                <Feather name="x" size={18} color="#4b5563" />
              </TouchableOpacity>
            </View>

            {/* Card com Resumo do que será exportado */}
            <View className="bg-[#f9fafb] border border-[#e5e7eb] rounded-[16px] p-4 mb-6">
              <View className="flex-row justify-between mb-2">
                <Text className="font-sans text-[13px] text-[#6b7280]">Período selecionado:</Text>
                <Text className="font-sans font-bold text-[#1B4332] text-[13px]">
                  {selectedPeriodoLabel}
                </Text>
              </View>
              <View className="flex-row justify-between mb-2">
                <Text className="font-sans text-[13px] text-[#6b7280]">Total de movimentações:</Text>
                <Text className="font-sans font-bold text-[#333] text-[13px]">
                  {transactions.length} registros
                </Text>
              </View>
              <View className="flex-row justify-between mb-2">
                <Text className="font-sans text-[13px] text-[#6b7280]">Receitas realizadas:</Text>
                <Text className="font-sans font-bold text-[#15803d] text-[13px]">
                  + {formatCurrency(income)}
                </Text>
              </View>
              <View className="flex-row justify-between mb-2">
                <Text className="font-sans text-[13px] text-[#6b7280]">Despesas registradas:</Text>
                <Text className="font-sans font-bold text-[#e63946] text-[13px]">
                  - {formatCurrency(totalExpenses)}
                </Text>
              </View>
              <View className="h-[1px] bg-[#e5e7eb] my-2" />
              <View className="flex-row justify-between">
                <Text className="font-sans font-bold text-[#333] text-[14px]">Saldo do Extrato:</Text>
                <Text
                  className={`font-sans font-bold text-[14px] ${
                    netBalance >= 0 ? 'text-[#166534]' : 'text-[#e63946]'
                  }`}
                >
                  {formatCurrency(netBalance)}
                </Text>
              </View>
            </View>

            {/* Ações */}
            <View className="flex-row items-center space-x-3">
              <TouchableOpacity
                onPress={() => setModalExportVisible(false)}
                className="flex-1 bg-[#f3f4f6] py-3.5 rounded-full items-center justify-center mr-2"
              >
                <Text className="text-[#4b5563] font-bold text-[15px] font-sans">Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleExportCSV}
                disabled={exporting}
                className="flex-[2] bg-[#1B4332] py-3.5 rounded-full items-center justify-center flex-row ml-2"
                style={{ shadowColor: '#1B4332', shadowOpacity: 0.25, shadowRadius: 15, shadowOffset: { width: 0, height: 4 } }}
              >
                {exporting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Feather name="share-2" size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text className="text-white font-bold text-[15px] font-sans">
                      Baixar e Compartilhar
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL: CONFIRMAR EXCLUSÃO DE DESPESA */}
      {/* ============================================================ */}
      <Modal
        visible={deleteModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50 px-6">
          <View className="w-full max-w-[360px] bg-white rounded-[24px] p-6 shadow-2xl items-center text-center">
            <View className="w-14 h-14 rounded-full bg-[#fee2e2] items-center justify-center mb-3">
              <Feather name="trash-2" size={24} color="#e63946" />
            </View>

            <Text className="font-title text-[20px] text-[#1B4332] text-center mb-2">
              Excluir Despesa?
            </Text>
            <Text className="font-sans text-[14px] text-[#6b7280] text-center mb-6 leading-relaxed">
              Tem certeza que deseja remover "{itemToDelete?.desc}" no valor de{' '}
              {formatCurrency(itemToDelete?.value || 0)}? Seu saldo e indicadores serão recalculados.
            </Text>

            <View className="flex-row items-center w-full space-x-3">
              <TouchableOpacity
                onPress={() => {
                  setDeleteModalVisible(false);
                  setItemToDelete(null);
                }}
                className="flex-1 bg-[#f3f4f6] py-3 rounded-full items-center justify-center mr-2"
              >
                <Text className="text-[#4b5563] font-bold text-[14px] font-sans">Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirmDelete}
                disabled={deleting}
                className="flex-1 bg-[#e63946] py-3 rounded-full items-center justify-center flex-row ml-2"
              >
                {deleting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-white font-bold text-[14px] font-sans">Sim, Excluir</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
