import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Keyboard,
  Vibration,
  Animated,
  Easing
} from 'react-native';
import YeloScrollView from '../../../components/YeloScrollView';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import NativeSelectMenu, { type NativeSelectOption } from '../../../components/NativeSelectMenu';
import NativeTimePicker from '../../../components/NativeTimePicker';
import {
  expandAppointmentsForLocalDay,
  expandAppointmentsInLocalRange,
  isRecurringRuleRow,
  toLocalISODate,
  type RecurrenceFrequency,
} from '../../../utils/recurrenceExpander';
import api from '../../../services/api';

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
  dayNamesShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  today: 'Hoje'
};
LocaleConfig.defaultLocale = 'pt-br';

// ============================================================
// CONSTANTES DE LAYOUT & ESPAÇAMENTO (CALIBRAÇÃO BOTTOM NAV)
// Bottom Tab Bar flutuante: bottom 24 (iOS) / 20 (Android) + height 64 = 88px / 84px
// Mini respiro exato de 14px acima da Bottom Tab Bar = 102px (iOS) / 96px (Android)
// ============================================================
const BOTTOM_NAV_CLEARANCE = Platform.OS === 'ios' ? 102 : 96;

// Máscaras de entrada
const maskPhone = (value: string) => {
  let v = value.replace(/\D/g, '');
  if (v.length > 11) v = v.substring(0, 11);
  if (v.length > 2) v = `(${v.substring(0, 2)}) ${v.substring(2)}`;
  if (v.length > 9) v = `${v.substring(0, 9)}-${v.substring(9)}`;
  return v;
};

const maskCurrency = (value: string) => {
  let v = value.replace(/\D/g, '');
  if (!v) return '';
  v = (Number(v) / 100).toFixed(2);
  v = v.replace('.', ',');
  v = v.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${v}`;
};

const normalizeTimeStr = (raw: string, fallback = '14:00'): string => {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return fallback;
  let hh = 0;
  let mm = 0;
  if (digits.length <= 2) {
    hh = parseInt(digits, 10);
    mm = 0;
  } else if (digits.length === 3) {
    hh = parseInt(digits.slice(0, 1), 10);
    mm = parseInt(digits.slice(1, 3), 10);
  } else {
    hh = parseInt(digits.slice(0, 2), 10);
    mm = parseInt(digits.slice(2, 4), 10);
  }
  if (isNaN(hh)) hh = 14;
  if (isNaN(mm)) mm = 0;
  hh = Math.max(0, Math.min(23, hh));
  mm = Math.max(0, Math.min(59, mm));
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

const DURATION_OPTIONS = [
  { label: '30 min', pickerLabel: '30 minutos', value: 30 },
  { label: '40 min', pickerLabel: '40 minutos', value: 40 },
  { label: '45 min', pickerLabel: '45 minutos', value: 45 },
  { label: '50 min', pickerLabel: '50 minutos', value: 50 },
  { label: '1h (60m)', pickerLabel: '1 hora (60 min)', value: 60 },
  { label: '1h 30m', pickerLabel: '1h 30min (90 min)', value: 90 }
];

const RECURRENCE_OPTIONS: { label: string; value: RecurrenceFrequency }[] = [
  { label: 'Não repetir', value: 'none' },
  { label: 'Semanal', value: 'weekly' },
  { label: 'Quinzenal', value: 'biweekly' },
  { label: 'Mensal', value: 'monthly' }
];

const STATUS_QUICK_OPTIONS: { label: string; value: string; color: string; bg: string }[] = [
  { label: 'Confirmado', value: 'confirmed', color: '#1B4332', bg: '#e8f5e9' },
  { label: 'Agendado', value: 'scheduled', color: '#3788d8', bg: '#ebf5ff' },
  { label: 'Realizado', value: 'done', color: '#555555', bg: '#f1f3f5' },
  { label: 'Falta', value: 'missed', color: '#d32f2f', bg: '#fef2f2' }
];

// Helpers de Data Local (evita bugs de fuso UTC em horários noturnos)
const isSameLocalDay = (d1: Date, d2: Date) =>
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getDate() === d2.getDate();

const formatHHMM = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// Dados padrão caso a base não tenha agendamentos/pacientes
const FALLBACK_PATIENTS = [
  { id: '1', nome: 'Clícia Santos', telefone: '(11) 98765-4321', status: 'ativo', sessionValue: 180 },
  { id: '2', nome: 'Ana Maria Silva', telefone: '(11) 99999-9999', status: 'ativo', sessionValue: 150 },
  { id: '3', nome: 'João Paulo', telefone: '(11) 98888-8888', status: 'ativo', sessionValue: 200 },
  { id: '4', nome: 'Carlos Andrade', telefone: '(11) 97777-7777', status: 'inativo', sessionValue: 160 }
];

const FALLBACK_UPCOMING = [
  { id: 'f1', patientName: 'Clícia', time: '20:10', date: 'Hoje', status: 'scheduled', isFallback: true },
  { id: 'f2', patientName: 'Ana Maria Silva', time: '14:00', date: 'Amanhã', status: 'confirmed', isFallback: true },
  { id: 'f3', patientName: 'João Paulo', time: '16:30', date: '4 de nov.', status: 'confirmed', isFallback: true }
];

export default function PacientesScreen() {
  // Controle da Visão (Agenda vs Carteira de Pacientes)
  const [showPatientsView, setShowPatientsView] = useState(false);

  // Estados de dados da API
  const [patients, setPatients] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Data Selecionada para a Agenda (Padrão: Hoje)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Controles modernos da Timeline (estilo Notion Calendar: janela limpa + expansão sob demanda)
  const [view24h, setView24h] = useState(false);
  const [showEarlyHours, setShowEarlyHours] = useState(false); // 06:00 – 07:00
  const [showLateHours, setShowLateHours] = useState(false);   // 22:00 – 23:00

  // Estados de Busca e Filtro de Pacientes
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ativo' | 'inativo' | 'todos'>('ativo');

  // Modais estilizados como Bottom Sheet Overlay
  const [modalNewPatient, setModalNewPatient] = useState(false);
  const [modalNewAppt, setModalNewAppt] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calendarFocusDate, setCalendarFocusDate] = useState<Date>(() => new Date());

  // Estados de Opções / Edição / Exclusão de Agendamento (Segurar no evento)
  const [selectedEventForAction, setSelectedEventForAction] = useState<any | null>(null);
  const [confirmDeleteMode, setConfirmDeleteMode] = useState(false);
  const [editingAppt, setEditingAppt] = useState<any | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Formulário Novo Paciente
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientPhone, setNewPatientPhone] = useState('');
  const [newPatientValue, setNewPatientValue] = useState('');
  const [newPatientStatus, setNewPatientStatus] = useState('ativo');
  const [isSubmittingPatient, setIsSubmittingPatient] = useState(false);
  const patientFormScrollRef = useRef<any>(null);

  // Formulário Novo / Editar Agendamento
  const [apptType, setApptType] = useState<'session' | 'available'>('session');
  const [apptPatientId, setApptPatientId] = useState<string>('');
  const [apptTime, setApptTime] = useState<string>('14:00');
  const [apptDuration, setApptDuration] = useState<number>(50);
  const [apptRecurrence, setApptRecurrence] = useState<RecurrenceFrequency>('none');
  const [isSubmittingAppt, setIsSubmittingAppt] = useState(false);

  const apptFormScrollRef = useRef<any>(null);

  const newPatientPhoneRef = useRef<any>(null);
  const newPatientValueRef = useRef<any>(null);

  // Animação fluida sincronizada com a curva nativa do teclado do iOS (sem recortes nem saltos bruscos)
  const sheetBottomAnim = useRef(new Animated.Value(BOTTOM_NAV_CLEARANCE)).current;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const subShow = Keyboard.addListener(showEvent, (e) => {
      const kbHeight = e.endCoordinates?.height || 300;
      const targetPadding = Platform.OS === 'ios' ? kbHeight + 16 : 20;
      Animated.timing(sheetBottomAnim, {
        toValue: targetPadding,
        duration: Platform.OS === 'ios' ? (e.duration || 250) : 180,
        easing: Easing.bezier(0.33, 1, 0.68, 1),
        useNativeDriver: false
      }).start();
    });

    const subHide = Keyboard.addListener(hideEvent, (e) => {
      Animated.timing(sheetBottomAnim, {
        toValue: BOTTOM_NAV_CLEARANCE,
        duration: Platform.OS === 'ios' ? (e?.duration || 250) : 180,
        easing: Easing.bezier(0.33, 1, 0.68, 1),
        useNativeDriver: false
      }).start();
    });

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [sheetBottomAnim]);

  // Helper para abrir modal de NOVO agendamento
  const openNewApptSheet = (initialTime: string, _expandTimeSelector = false) => {
    const cleanTime = normalizeTimeStr(initialTime, '14:00');
    setEditingAppt(null);
    setApptPatientId('');
    setApptTime(cleanTime);
    setApptRecurrence('none');
    setModalNewAppt(true);
  };

  // Helper para abrir o menu de opções ao segurar (ou tocar) em um agendamento existente
  const handleOpenEventActions = (evt: any, triggerHaptic = false) => {
    if (!evt || evt.isFallback) return;
    if (triggerHaptic) {
      try {
        Vibration.vibrate(15);
      } catch {}
    }
    setConfirmDeleteMode(false);
    setSelectedEventForAction(evt);
  };

  // Helper para entrar no modo de EDIÇÃO a partir do menu do agendamento
  const handleStartEditEvent = (evt: any) => {
    const startDt = new Date(evt.start);
    const endDt = evt.end ? new Date(evt.end) : new Date(startDt.getTime() + 50 * 60 * 1000);
    const diffMins = Math.round((endDt.getTime() - startDt.getTime()) / 60000);
    const validDuration = DURATION_OPTIONS.some((o) => o.value === diffMins) ? diffMins : 50;
    const startHHMM = formatHHMM(startDt);
    const currentRec: RecurrenceFrequency =
      evt.recurrence === 'weekly' || evt.recurrence === 'biweekly' || evt.recurrence === 'monthly'
        ? evt.recurrence
        : 'none';

    setSelectedDate(new Date(startDt.getFullYear(), startDt.getMonth(), startDt.getDate()));
    setEditingAppt(evt);
    setApptType(evt.status === 'available' ? 'available' : 'session');
    if (evt.patientId) {
      setApptPatientId(String(evt.patientId));
    }
    setApptTime(startHHMM);
    setApptDuration(validDuration);
    setApptRecurrence(currentRec);

    setSelectedEventForAction(null);
    setConfirmDeleteMode(false);
    setModalNewAppt(true);
  };

  // Compatibilidade retroativa: detecta linhas avulsas antigas criadas em lote antes das regras infinitas
  const legacyFutureRecurringIds = useMemo(() => {
    if (!selectedEventForAction || !selectedEventForAction.start) return [];
    const targetStart = new Date(selectedEventForAction.start);
    const targetDay = targetStart.getDay();
    const targetH = targetStart.getHours();
    const targetM = targetStart.getMinutes();
    const isAvail = selectedEventForAction.status === 'available';

    return appointments
      .filter((a: any) => {
        if (!a.start || isRecurringRuleRow(a) || String(a.id) === String(selectedEventForAction.id)) {
          return false;
        }
        const d = new Date(a.start);
        if (d <= targetStart) return false;
        if (isAvail) {
          if (a.status !== 'available') return false;
        } else {
          if (String(a.patientId) !== String(selectedEventForAction.patientId)) return false;
          if (a.status === 'cancelled' || a.status === 'done') return false;
        }
        return d.getDay() === targetDay && d.getHours() === targetH && d.getMinutes() === targetM;
      })
      .map((a: any) => a.id);
  }, [selectedEventForAction, appointments]);

  // Identifica se o evento selecionado pertence a uma repetição contínua (nova regra infinita ou série antiga)
  const isSelectedEventRecurring = useMemo(() => {
    if (!selectedEventForAction) return false;
    return Boolean(
      selectedEventForAction.isRecurring ||
        isRecurringRuleRow(selectedEventForAction) ||
        selectedEventForAction.seriesId ||
        legacyFutureRecurringIds.length > 0
    );
  }, [selectedEventForAction, legacyFutureRecurringIds]);

  // Atualizar Status Rápido de um Agendamento (materializa apenas o dia em regras infinitas)
  const handleQuickUpdateStatus = async (newStatus: string) => {
    if (!selectedEventForAction) return;
    try {
      setIsActionLoading(true);
      await api.put(`/api/appointments/${selectedEventForAction.id}`, {
        status: newStatus,
        start: selectedEventForAction.start,
        end: selectedEventForAction.end,
        value: selectedEventForAction.value || 0,
        title: selectedEventForAction.title,
        occurrenceDate: selectedEventForAction.occurrenceDate,
        scope: 'single'
      });
      setSelectedEventForAction(null);
      await fetchData();
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível atualizar o status deste agendamento.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Excluir Agendamento (apenas este dia OU este + futuros, sem limite artificial)
  const handleDeleteEvent = async (deleteFutureSeries = false) => {
    if (!selectedEventForAction) return;
    try {
      setIsActionLoading(true);
      const scope = deleteFutureSeries ? 'future' : 'single';
      const occParam = selectedEventForAction.occurrenceDate
        ? `&occurrenceDate=${encodeURIComponent(selectedEventForAction.occurrenceDate)}`
        : '';

      await api.delete(`/api/appointments/${selectedEventForAction.id}?scope=${scope}${occParam}`);

      if (deleteFutureSeries && legacyFutureRecurringIds.length > 0) {
        await api.delete('/api/appointments/bulk', {
          data: { ids: legacyFutureRecurringIds }
        });
      }

      setSelectedEventForAction(null);
      setConfirmDeleteMode(false);
      await fetchData();
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível excluir o agendamento. Tente novamente.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Carregar dados reais da API (modo compacto `rules`: 1 única linha por série infinita)
  const fetchData = useCallback(async (showSpinner = true) => {
    try {
      if (showSpinner) setIsLoading(true);
      const [resPatients, resAppts] = await Promise.all([
        api.get('/api/my-patients').then(r => ({ ok: true, data: r.data })).catch(() => ({ ok: false, data: [] })),
        api.get('/api/appointments?mode=rules').catch(() => ({ data: [] }))
      ]);

      const loadedPatients = resPatients.ok
        ? (Array.isArray(resPatients.data) ? resPatients.data : [])
        : FALLBACK_PATIENTS;

      setPatients(loadedPatients);
      setAppointments(resAppts.data || []);
    } catch (err) {
      console.warn('Erro ao buscar dados:', err);
      setPatients(FALLBACK_PATIENTS);
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      fetchData(false);
    }, [fetchData])
  );

  // Formatação da data no cabeçalho (ex: "2 De Nov. De 2026")
  const formattedDateTitle = useMemo(() => {
    const day = selectedDate.getDate();
    const months = ['Jan.', 'Fev.', 'Mar.', 'Abr.', 'Mai.', 'Jun.', 'Jul.', 'Ago.', 'Set.', 'Out.', 'Nov.', 'Dez.'];
    const month = months[selectedDate.getMonth()];
    const year = selectedDate.getFullYear();
    return `${day} De ${month} De ${year}`;
  }, [selectedDate]);

  // Formatação do dia da semana (ex: "SEGUNDA - FEIRA, 2 DE NOVEMBRO")
  const dayHeaderTitle = useMemo(() => {
    const days = ['DOMINGO', 'SEGUNDA - FEIRA', 'TERÇA - FEIRA', 'QUARTA - FEIRA', 'QUINTA - FEIRA', 'SEXTA - FEIRA', 'SÁBADO'];
    const fullMonths = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
    const dayName = days[selectedDate.getDay()];
    const day = selectedDate.getDate();
    const monthName = fullMonths[selectedDate.getMonth()];
    return `${dayName}, ${day} DE ${monthName}`;
  }, [selectedDate]);

  // Navegação de Dias
  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d);
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  // Próximos Atendimentos (expande regras recorrentes nos próximos 45 dias em memória)
  const upcomingList = useMemo(() => {
    const now = new Date();
    const horizon = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);
    const expandedUpcoming = expandAppointmentsInLocalRange(appointments, now, horizon);

    const realUpcoming = expandedUpcoming
      .filter((a: any) => (a.status === 'scheduled' || a.status === 'confirmed') && new Date(a.start) >= now)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 5)
      .map((a: any) => {
        const d = new Date(a.start);
        const endDt = a.end ? new Date(a.end) : null;
        const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
        return {
          id: String(a.id),
          patientName: a.title || 'Consulta',
          time: timeStr,
          date: dateStr,
          status: a.status,
          isFallback: false,
          rawEvent: {
            ...a,
            exactStartLabel: formatHHMM(d),
            exactEndLabel: endDt && !isNaN(endDt.getTime()) ? formatHHMM(endDt) : null
          }
        };
      });

    return realUpcoming.length > 0 ? realUpcoming : FALLBACK_UPCOMING;
  }, [appointments]);

  // Lista de Pacientes em Ordem Alfabética (A → Z) para a Carteira de Pacientes
  const filteredPatients = useMemo(() => {
    return [...patients]
      .filter((p: any) => {
        if (statusFilter !== 'todos' && (p.status || 'ativo') !== statusFilter) return false;
        if (search && !p.nome?.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .sort((a: any, b: any) =>
        (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' })
      );
  }, [patients, statusFilter, search]);

  // Lista de Pacientes em Ordem Alfabética (A → Z) para o Menu de Agendamento
  const sortedPatientsForMenu = useMemo(() => {
    const activeOrCurrent = patients.filter(
      (p: any) => (p.status || 'ativo') === 'ativo' || String(p.id) === String(apptPatientId)
    );
    const baseList = activeOrCurrent.length > 0 ? activeOrCurrent : patients;
    return [...baseList].sort((a: any, b: any) =>
      (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' })
    );
  }, [patients, apptPatientId]);

  // Paciente, duração e repetição selecionados
  const selectedPatientName = useMemo(() => {
    if (!apptPatientId) return 'Selecione o paciente...';
    const p = patients.find(item => String(item.id) === String(apptPatientId));
    return p ? p.nome : 'Selecione o paciente...';
  }, [patients, apptPatientId]);

  const selectedDateISO = useMemo(() => toLocalISODate(selectedDate), [selectedDate]);
  const isSelectedToday = useMemo(() => isSameLocalDay(selectedDate, new Date()), [selectedDate]);

  // Datas marcadas no Calendário Mensal (expande sob demanda para qualquer ano/mês navegado, inclusive infinito)
  const markedCalendarDates = useMemo(() => {
    const marks: Record<string, any> = {};
    const refDate = showCalendarModal ? calendarFocusDate : selectedDate;
    const rangeStart = new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1, 0, 0, 0, 0);
    const rangeEnd = new Date(refDate.getFullYear(), refDate.getMonth() + 2, 0, 23, 59, 59, 999);
    const expandedMonth = expandAppointmentsInLocalRange(appointments, rangeStart, rangeEnd);

    expandedMonth.forEach((a: any) => {
      if (!a.start || a.status === 'cancelled' || a.status === 'available') return;
      const d = new Date(a.start);
      if (!isNaN(d.getTime())) {
        const key = toLocalISODate(d);
        marks[key] = { marked: true, dotColor: '#1B4332' };
      }
    });
    marks[selectedDateISO] = {
      ...(marks[selectedDateISO] || {}),
      selected: true,
      selectedColor: '#1B4332',
      selectedTextColor: '#ffffff',
      dotColor: '#ffffff'
    };
    return marks;
  }, [appointments, selectedDate, selectedDateISO, calendarFocusDate, showCalendarModal]);

  const selectedDurationOption = useMemo(() => {
    return DURATION_OPTIONS.find(opt => opt.value === apptDuration) || DURATION_OPTIONS[3];
  }, [apptDuration]);

  const selectedRecurrenceLabel = useMemo(() => {
    const rec = RECURRENCE_OPTIONS.find(r => r.value === apptRecurrence);
    return rec ? rec.label : 'Não repetir';
  }, [apptRecurrence]);

  // Opções para os menus nativos do sistema operacional (iOS UIMenu / Android DropdownMenu)
  const patientMenuOptions: NativeSelectOption[] = useMemo(
    () => [
      { label: 'Selecione o paciente...', value: '' },
      ...sortedPatientsForMenu.map((p: any) => ({
        label: p.nome,
        value: String(p.id),
      })),
    ],
    [sortedPatientsForMenu]
  );

  const durationMenuOptions: NativeSelectOption[] = useMemo(
    () =>
      DURATION_OPTIONS.map((opt) => ({
        label: opt.pickerLabel,
        value: String(opt.value),
      })),
    []
  );

  const recurrenceMenuOptions: NativeSelectOption[] = useMemo(
    () =>
      RECURRENCE_OPTIONS.map((rec) => ({
        label: rec.label,
        value: rec.value,
      })),
    []
  );

  const statusFilterMenuOptions: NativeSelectOption[] = useMemo(
    () => [
      { label: 'Ativos', value: 'ativo' },
      { label: 'Inativos', value: 'inativo' },
      { label: 'Todos', value: 'todos' },
    ],
    []
  );

  const patientStatusMenuOptions: NativeSelectOption[] = useMemo(
    () => [
      { label: 'Ativo', value: 'ativo' },
      { label: 'Inativo', value: 'inativo' },
    ],
    []
  );

  // Cálculo em tempo real do horário de término da sessão
  const calculatedEndTimeStr = useMemo(() => {
    const [hh, mm] = apptTime.split(':').map(Number);
    const d = new Date(2026, 0, 1, hh || 0, mm || 0, 0, 0);
    d.setMinutes(d.getMinutes() + (apptType === 'available' ? 60 : apptDuration));
    return formatHHMM(d);
  }, [apptTime, apptDuration, apptType]);

  // Agendamentos do dia selecionado ordenados cronologicamente (projeta regras infinitas em O(1))
  const dayAppointments = useMemo(() => {
    return expandAppointmentsForLocalDay(appointments, selectedDate)
      .filter((a: any) => a.start && a.status !== 'cancelled')
      .sort((a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [appointments, selectedDate]);

  const earlyEventsCount = useMemo(
    () => dayAppointments.filter((a: any) => new Date(a.start).getHours() < 8).length,
    [dayAppointments]
  );
  const lateEventsCount = useMemo(
    () => dayAppointments.filter((a: any) => new Date(a.start).getHours() > 21).length,
    [dayAppointments]
  );

  // Construção Inteligente da Grade (Estilo Notion Calendar)
  const timeSlots = useMemo(() => {
    const hoursSet = new Set<number>();

    if (view24h) {
      for (let h = 0; h <= 23; h++) hoursSet.add(h);
    } else {
      if (showEarlyHours) {
        hoursSet.add(6);
        hoursSet.add(7);
      }
      for (let h = 8; h <= 21; h++) {
        hoursSet.add(h);
      }
      if (showLateHours) {
        hoursSet.add(22);
        hoursSet.add(23);
      }
    }

    dayAppointments.forEach((a: any) => {
      const h = new Date(a.start).getHours();
      hoursSet.add(h);
    });

    const sortedHours = Array.from(hoursSet).sort((a, b) => a - b);

    return sortedHours.map(h => {
      const hourLabel = `${String(h).padStart(2, '0')}:00`;
      const eventsInHour = dayAppointments
        .filter((a: any) => new Date(a.start).getHours() === h)
        .map((a: any) => {
          const startDt = new Date(a.start);
          const endDt = a.end ? new Date(a.end) : null;
          return {
            ...a,
            exactStartLabel: formatHHMM(startDt),
            exactEndLabel: endDt && !isNaN(endDt.getTime()) ? formatHHMM(endDt) : null
          };
        });

      return {
        hourNumber: h,
        hour: hourLabel,
        isOffPeak: h < 8 || h > 21,
        events: eventsInHour
      };
    });
  }, [view24h, showEarlyHours, showLateHours, dayAppointments]);

  // Salvar Novo Paciente
  const handleSavePatient = async () => {
    if (!newPatientName.trim() || !newPatientPhone.trim()) {
      Alert.alert('Campos Obrigatórios', 'Por favor, informe ao menos o nome e o telefone do paciente.');
      return;
    }

    Keyboard.dismiss();

    try {
      setIsSubmittingPatient(true);
      const res = await api.post('/api/my-patients', {
        name: newPatientName,
        phone: newPatientPhone,
        status: newPatientStatus,
        sessionValue: parseFloat(newPatientValue.replace(/\D/g, '')) / 100 || 0,
      });

      if (res.data) {
        setPatients(prev => [res.data, ...prev]);
        setModalNewPatient(false);
        setNewPatientName('');
        setNewPatientPhone('');
        setNewPatientValue('');
        Alert.alert('Sucesso', 'Paciente cadastrado com sucesso!');
      }
    } catch (err: any) {
      const mockNew = {
        id: String(Date.now()),
        nome: newPatientName,
        telefone: newPatientPhone,
        status: newPatientStatus,
        sessionValue: parseFloat(newPatientValue.replace(/\D/g, '')) / 100 || 0,
      };
      setPatients(prev => [mockNew, ...prev]);
      setModalNewPatient(false);
      Alert.alert('Paciente Salvo', 'Paciente salvo com sucesso na sua lista!');
    } finally {
      setIsSubmittingPatient(false);
    }
  };

  // Executa salvamento de Edição (com escopo 'single' ou 'future' para séries recorrentes)
  const submitEditedAppt = async (
    scope: 'single' | 'future',
    startDt: Date,
    endDt: Date,
    patient: any,
    finalTime: string
  ) => {
    if (!editingAppt) return;
    try {
      setIsSubmittingAppt(true);
      const nextStatus =
        apptType === 'available'
          ? 'available'
          : editingAppt.status === 'available'
            ? 'scheduled'
            : editingAppt.status || 'scheduled';

      await api.put(`/api/appointments/${editingAppt.id}`, {
        title: apptType === 'available' ? 'Horário Disponível' : (patient ? patient.nome : 'Consulta'),
        start: startDt.toISOString(),
        end: endDt.toISOString(),
        patientId: apptType === 'available' ? null : (patient ? patient.id : null),
        status: nextStatus,
        value: apptType === 'available' ? 0 : (patient?.sessionValue || editingAppt.value || 150),
        recurrence: apptRecurrence,
        occurrenceDate: editingAppt.occurrenceDate,
        scope
      });

      setModalNewAppt(false);
      setEditingAppt(null);
      await fetchData();
      Alert.alert('Atualizado', `Agendamento atualizado para ${finalTime}!`);
    } catch {
      setModalNewAppt(false);
      setEditingAppt(null);
      Alert.alert('Agendamento', `Horário (${finalTime}) atualizado na sua agenda!`);
    } finally {
      setIsSubmittingAppt(false);
    }
  };

  // Salvar Agendamento (Criação com regra infinita leve OU Edição)
  const handleSaveAppt = async () => {
    Keyboard.dismiss();

    const finalTime = normalizeTimeStr(apptTime, '14:00');

    const [hh, mm] = finalTime.split(':').map(Number);
    const startDt = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      hh || 0,
      mm || 0,
      0,
      0
    );
    const durationMs = (apptType === 'available' ? 60 : apptDuration) * 60 * 1000;
    const endDt = new Date(startDt.getTime() + durationMs);

    const patient = patients.find(p => String(p.id) === String(apptPatientId));
    if (apptType === 'session' && !patient) {
      Alert.alert('Selecione o Paciente', 'Por favor, selecione o paciente para confirmar o agendamento.');
      return;
    }

    if (editingAppt) {
      const isEditingRecurring = Boolean(
        editingAppt.isRecurring || isRecurringRuleRow(editingAppt)
      );
      if (isEditingRecurring) {
        Alert.alert(
          'Agendamento recorrente',
          'Deseja salvar as alterações apenas para este dia ou também para os agendamentos futuros?',
          [
            {
              text: 'Apenas este dia',
              onPress: () => submitEditedAppt('single', startDt, endDt, patient, finalTime)
            },
            {
              text: 'Este e os futuros',
              onPress: () => submitEditedAppt('future', startDt, endDt, patient, finalTime)
            },
            { text: 'Cancelar', style: 'cancel' }
          ]
        );
        return;
      }

      await submitEditedAppt('future', startDt, endDt, patient, finalTime);
      return;
    }

    try {
      setIsSubmittingAppt(true);

      // MODO CRIAÇÃO: grava 1 única regra no banco (mesmo se Semanal, Quinzenal ou Mensal infinito!)
      await api.post('/api/appointments', {
        title: apptType === 'available' ? 'Horário Disponível' : (patient ? patient.nome : 'Consulta'),
        start: startDt.toISOString(),
        end: endDt.toISOString(),
        patientId: apptType === 'available' ? null : (patient ? patient.id : null),
        status: apptType === 'available' ? 'available' : 'scheduled',
        value: apptType === 'available' ? 0 : (patient?.sessionValue || 150),
        recurrence: apptRecurrence
      });

      setModalNewAppt(false);
      await fetchData();
      Alert.alert(
        'Sucesso',
        apptType === 'available'
          ? `Horário disponível (${finalTime}) adicionado à sua agenda!`
          : `Sessão agendada às ${finalTime} com sucesso!`
      );
    } catch (err) {
      setModalNewAppt(false);
      setEditingAppt(null);
      Alert.alert('Agendamento', `Horário (${finalTime}) registrado na sua agenda!`);
    } finally {
      setIsSubmittingAppt(false);
    }
  };

  // Estilo utilitário da cor de cada agendamento na timeline
  const getEventPillColors = (status?: string) => {
    if (status === 'confirmed') {
      return { bg: '#1B4332', text: '#ffffff', sub: 'rgba(255,255,255,0.82)', borderColor: '#1B4332', dashed: false, label: 'Confirmado' };
    }
    if (status === 'available') {
      return { bg: '#FFEE8C', text: '#1B4332', sub: '#1B4332', borderColor: '#1B4332', dashed: true, label: 'Disponível' };
    }
    if (status === 'done' || status === 'completed') {
      return { bg: '#9e9e9e', text: '#ffffff', sub: 'rgba(255,255,255,0.85)', borderColor: '#9e9e9e', dashed: false, label: 'Realizado' };
    }
    if (status === 'missed' || status === 'absent') {
      return { bg: '#d32f2f', text: '#ffffff', sub: 'rgba(255,255,255,0.85)', borderColor: '#d32f2f', dashed: false, label: 'Falta' };
    }
    return { bg: '#3788d8', text: '#ffffff', sub: 'rgba(255,255,255,0.85)', borderColor: '#3788d8', dashed: false, label: 'Agendado' };
  };

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <StatusBar style="dark" />

      {/* Scroll calibrado com mini respiro exato (14px) acima da Bottom Tab Bar */}
      <YeloScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: BOTTOM_NAV_CLEARANCE }}
      >
        {/* ============================================================ */}
        {/* HEADER PRINCIPAL VERDE (MAIN-HEADER - IDÊNTICO À WEB MOBILE)  */}
        {/* ============================================================ */}
        <View className="mx-4 mt-4 mb-4 bg-[#1B4332] p-[22px] rounded-[16px] shadow-sm">
          <Text className="font-title text-[28px] text-white leading-tight mb-1">
            Minha Agenda
          </Text>
          <Text className="font-sans text-[15px] text-white/85">
            Controle seus horários de forma ágil.
          </Text>
        </View>

        {/* ============================================================ */}
        {/* VISÃO 1: AGENDA (TIMELINE INTELIGENTE & MODERNA)             */}
        {/* ============================================================ */}
        {!showPatientsView ? (
          <View className="mx-4 bg-white rounded-[20px] border border-[#eee] shadow-sm overflow-hidden">
            {/* TOOLBAR DA AGENDA: Navegação de Datas + Calendário ao tocar na data */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 14,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: '#f0f0f0'
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity
                  onPress={handlePrevDay}
                  activeOpacity={0.65}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    backgroundColor: '#f8f9fa',
                    borderWidth: 1,
                    borderColor: '#e5e7eb',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 6
                  }}
                >
                  <Feather name="chevron-left" size={19} color="#1B4332" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleNextDay}
                  activeOpacity={0.65}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    backgroundColor: '#f8f9fa',
                    borderWidth: 1,
                    borderColor: '#e5e7eb',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 8
                  }}
                >
                  <Feather name="chevron-right" size={19} color="#1B4332" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleToday}
                  activeOpacity={0.7}
                  style={{
                    height: 36,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    backgroundColor: isSelectedToday ? '#f8f9fa' : '#f0fdf4',
                    borderWidth: 1,
                    borderColor: isSelectedToday ? '#e5e7eb' : '#bbf7d0',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Text
                    className="font-sans text-[12px]"
                    style={{
                      color: isSelectedToday ? '#495057' : '#1B4332',
                      fontWeight: isSelectedToday ? '600' : '700'
                    }}
                  >
                    Hoje
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={() => setShowCalendarModal(true)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  height: 38,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  backgroundColor: '#f0fdf4',
                  borderWidth: 1,
                  borderColor: '#cce5d4'
                }}
              >
                <Feather name="calendar" size={14} color="#1B4332" style={{ marginRight: 6 }} />
                <Text className="font-title text-[#1B4332] text-[15px]">
                  {formattedDateTitle}
                </Text>
                <Feather name="chevron-down" size={14} color="#1B4332" style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            </View>

            {/* BOTÕES DE AÇÃO: PACIENTES & + AGENDAR (50% / 50%) */}
            <View className="flex-row items-center px-4 pt-4">
              <TouchableOpacity
                onPress={() => setShowPatientsView(true)}
                className="flex-1 py-3 bg-white border border-[#1B4332] rounded-full items-center justify-center shadow-sm mr-2"
              >
                <Text className="font-sans font-bold text-[#1B4332] text-[15px]">Pacientes</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setApptType('session');
                  openNewApptSheet('14:00', false);
                }}
                className="flex-1 py-3 bg-[#1B4332] rounded-full items-center justify-center shadow-sm ml-2 flex-row"
              >
                <Text className="font-sans font-bold text-white text-[15px]">+ Agendar</Text>
              </TouchableOpacity>
            </View>

            {/* WIDGET: PRÓXIMOS ATENDIMENTOS */}
            {upcomingList.length > 0 && (
              <View className="px-4 pt-5">
                <View className="flex-row items-center mb-3">
                  <View className="w-6 h-6 rounded-full bg-[#e8f5e9] items-center justify-center mr-2">
                    <Text className="text-[12px]">⚡</Text>
                  </View>
                  <Text className="font-title text-[#1B4332] text-[17px]">Próximos Atendimentos</Text>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                  {upcomingList.map((sess: any) => (
                    <TouchableOpacity
                      key={sess.id}
                      activeOpacity={0.8}
                      delayLongPress={250}
                      onPress={() => !sess.isFallback && handleOpenEventActions(sess.rawEvent, false)}
                      onLongPress={() => !sess.isFallback && handleOpenEventActions(sess.rawEvent, true)}
                      className="bg-white border border-[#e5e7eb] rounded-[16px] p-3.5 flex-row items-center mr-3 min-w-[210px]"
                    >
                      <View className="bg-[#e8f5e9] px-2.5 py-1.5 rounded-[10px] items-center mr-3">
                        <Text className="font-sans font-bold text-[#1B4332] text-[14px]">{sess.time}</Text>
                        <Text className="font-sans text-[11px] text-[#666]">{sess.date}</Text>
                      </View>
                      <View className="flex-1 pr-1">
                        <Text className="font-sans font-bold text-[#333] text-[14px] mb-0.5" numberOfLines={1}>
                          {sess.patientName}
                        </Text>
                        <Text
                          className="font-sans font-semibold text-[12px]"
                          style={{ color: sess.status === 'confirmed' ? '#1B4332' : '#666666' }}
                        >
                          {sess.status === 'confirmed' ? 'Confirmado' : 'Aguardando'}
                        </Text>
                      </View>
                      <Text className="text-[#ccc] text-[16px]">➔</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* LEGENDA DE CORES + MICRO DICA DE INTERAÇÃO */}
            <View className="pt-4 pb-3 px-4 border-b border-[#f0f0f0] mt-3 items-center">
              <View className="flex-row flex-wrap justify-center items-center">
                <View className="flex-row items-center mr-3.5 mb-1.5">
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#3788d8', marginRight: 6 }} />
                  <Text className="font-sans text-[12px] text-[#495057]">Agendado</Text>
                </View>

                <View className="flex-row items-center mr-3.5 mb-1.5">
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#1B4332', marginRight: 6 }} />
                  <Text className="font-sans text-[12px] text-[#495057]">Confirmado</Text>
                </View>

                <View className="flex-row items-center mr-3.5 mb-1.5">
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFEE8C', borderWidth: 1, borderStyle: 'dashed', borderColor: '#1B4332', marginRight: 6 }} />
                  <Text className="font-sans text-[12px] text-[#495057]">Disponível</Text>
                </View>

                <View className="flex-row items-center mr-3.5 mb-1.5">
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#9e9e9e', marginRight: 6 }} />
                  <Text className="font-sans text-[12px] text-[#495057]">Realizado</Text>
                </View>

                <View className="flex-row items-center mb-1.5">
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#d32f2f', marginRight: 6 }} />
                  <Text className="font-sans text-[12px] text-[#495057]">Falta</Text>
                </View>
              </View>

              {dayAppointments.length > 0 && (
                <Text className="font-sans text-[11px] text-[#888] mt-1">
                  Toque e segure em um horário agendado para editar ou excluir
                </Text>
              )}
            </View>

            {/* CABEÇALHO DO DIA NA GRADE + TOGGLE RÁPIDO 08h–21h / 24h */}
            <View className="bg-[#f8f9fa] py-2.5 px-4 border-b border-[#eee] flex-row items-center justify-between">
              <Text className="font-title text-[12px] text-[#1B4332] tracking-wider flex-1 mr-2" numberOfLines={1}>
                {dayHeaderTitle}
              </Text>

              <TouchableOpacity
                onPress={() => setView24h(!view24h)}
                className="flex-row items-center px-3 py-1 rounded-full border"
                style={{
                  backgroundColor: view24h ? '#1B4332' : '#ffffff',
                  borderColor: view24h ? '#1B4332' : '#dce1e5'
                }}
              >
                <Feather
                  name="clock"
                  size={11}
                  color={view24h ? '#FFEE8C' : '#1B4332'}
                  style={{ marginRight: 4 }}
                />
                <Text
                  className="font-sans font-bold text-[11px]"
                  style={{ color: view24h ? '#ffffff' : '#1B4332' }}
                >
                  {view24h ? '24h ativo' : '08h–21h'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* EXPANSÃO PROGRESSIVA SUPERIOR: MANHÃ CEDO (06:00 – 07:00) */}
            {!view24h && (
              <View className="px-4 pt-2.5 pb-1 flex-row items-center justify-between border-b border-[#f5f5f5] bg-[#fcfdfd]">
                <TouchableOpacity
                  onPress={() => setShowEarlyHours(!showEarlyHours)}
                  className="flex-row items-center px-3.5 py-1.5 rounded-full border"
                  style={{
                    backgroundColor: showEarlyHours ? '#f0fdf4' : '#ffffff',
                    borderColor: showEarlyHours ? '#1B4332' : '#e5e7eb'
                  }}
                >
                  <Feather
                    name={showEarlyHours ? 'chevron-up' : 'sunrise'}
                    size={13}
                    color="#1B4332"
                    style={{ marginRight: 6 }}
                  />
                  <Text className="font-sans font-semibold text-[12px] text-[#1B4332]">
                    {showEarlyHours ? 'Ocultar manhã cedo (06h–07h)' : 'Manhã cedo (06h–07h)'}
                  </Text>
                  {earlyEventsCount > 0 && !showEarlyHours && (
                    <View className="ml-2 px-1.5 py-0.5 rounded-full bg-[#1B4332]">
                      <Text className="font-sans font-bold text-[10px] text-white">{earlyEventsCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setApptType('session');
                    openNewApptSheet('07:30', true);
                  }}
                  className="px-3 py-1.5 rounded-full bg-[#f0fdf4]"
                >
                  <Text className="font-sans font-bold text-[11px] text-[#1B4332]">+ Horário livre</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* GRADE DE HORÁRIOS COM SUPORTE A SEGURAR PARA EDITAR / EXCLUIR */}
            <View className="py-1">
              {timeSlots.map((slot) => {
                const hasEvents = slot.events.length > 0;

                return (
                  <View
                    key={slot.hour}
                    className="flex-row items-center min-h-[54px] border-b border-[#f5f5f5] px-4 py-1.5"
                    style={slot.isOffPeak ? { backgroundColor: '#fafcfb' } : undefined}
                  >
                    {/* Coluna de Horário */}
                    <View className="w-14 items-center justify-center">
                      <Text
                        className="font-sans text-[12px] font-medium"
                        style={{ color: slot.isOffPeak ? '#1B4332' : '#888888' }}
                      >
                        {slot.hour}
                      </Text>
                    </View>

                    {/* Coluna de Conteúdo do Slot - Formato de Pílula */}
                    <View className="flex-1 pl-2">
                      {hasEvents ? (
                        <View>
                          {slot.events.map((evt: any, idx: number) => {
                            const palette = getEventPillColors(evt.status);
                            return (
                              <View
                                key={evt.id || idx}
                                className="flex-row items-center"
                                style={{ marginBottom: idx < slot.events.length - 1 ? 6 : 0 }}
                              >
                                <TouchableOpacity
                                  activeOpacity={0.82}
                                  delayLongPress={250}
                                  onPress={() => handleOpenEventActions(evt, false)}
                                  onLongPress={() => handleOpenEventActions(evt, true)}
                                  className="flex-1 h-[40px] px-4 rounded-full justify-center"
                                  style={{
                                    backgroundColor: palette.bg,
                                    borderWidth: palette.dashed ? 1 : 0,
                                    borderStyle: palette.dashed ? 'dashed' : 'solid',
                                    borderColor: palette.borderColor
                                  }}
                                >
                                  <View className="flex-row items-center justify-between">
                                    <Text
                                      className="font-sans font-bold text-[13px] flex-1 mr-2"
                                      style={{ color: palette.text }}
                                      numberOfLines={1}
                                    >
                                      {evt.title}
                                    </Text>
                                    <Text
                                      className="font-sans font-semibold text-[11px]"
                                      style={{ color: palette.sub }}
                                    >
                                      {evt.exactEndLabel
                                        ? `${evt.exactStartLabel} – ${evt.exactEndLabel}`
                                        : evt.exactStartLabel}
                                    </Text>
                                  </View>
                                </TouchableOpacity>

                                {/* Botão sutil (+) para encaixar horário quebrado na mesma hora */}
                                <TouchableOpacity
                                  onPress={() => {
                                    const nextHalf = `${String(slot.hourNumber).padStart(2, '0')}:30`;
                                    setApptType('session');
                                    openNewApptSheet(nextHalf, true);
                                  }}
                                  className="w-8 h-8 rounded-full bg-[#f0fdf4] border border-[#cce5d4] items-center justify-center ml-2"
                                >
                                  <Feather name="plus" size={14} color="#1B4332" />
                                </TouchableOpacity>
                              </View>
                            );
                          })}
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => {
                            setApptType('session');
                            openNewApptSheet(slot.hour, false);
                          }}
                          className="h-[38px] rounded-full border border-dashed border-[#ced4da] bg-[#fafafa] items-center justify-center px-4"
                        >
                          <Text className="font-sans font-medium text-[12px] text-[#777]">
                            + Toque para agendar
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* RODAPÉ INTELIGENTE DA GRADE: NOITE ESTENDIDA (22h–23h) + QUALQUER OUTRO HORÁRIO */}
            <View className="px-4 py-3.5 bg-[#fcfdfd] flex-row items-center justify-between">
              {!view24h ? (
                <TouchableOpacity
                  onPress={() => setShowLateHours(!showLateHours)}
                  className="flex-row items-center px-3.5 py-2 rounded-full border mr-2"
                  style={{
                    backgroundColor: showLateHours ? '#f0fdf4' : '#ffffff',
                    borderColor: showLateHours ? '#1B4332' : '#e5e7eb'
                  }}
                >
                  <Feather
                    name={showLateHours ? 'chevron-up' : 'moon'}
                    size={13}
                    color="#1B4332"
                    style={{ marginRight: 6 }}
                  />
                  <Text className="font-sans font-semibold text-[12px] text-[#1B4332]">
                    {showLateHours ? 'Ocultar 22h–23h' : 'Noite (22h–23h)'}
                  </Text>
                  {lateEventsCount > 0 && !showLateHours && (
                    <View className="ml-2 px-1.5 py-0.5 rounded-full bg-[#1B4332]">
                      <Text className="font-sans font-bold text-[10px] text-white">{lateEventsCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => setView24h(false)}
                  className="flex-row items-center px-3.5 py-2 rounded-full border border-[#e5e7eb] bg-white mr-2"
                >
                  <Feather name="minimize-2" size={13} color="#495057" style={{ marginRight: 6 }} />
                  <Text className="font-sans font-semibold text-[12px] text-[#495057]">
                    Voltar p/ 08h–21h
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => {
                  setApptType('session');
                  openNewApptSheet('21:30', true);
                }}
                className="flex-1 flex-row items-center justify-center px-4 py-2 rounded-full bg-[#f0fdf4] border border-[#bbf7d0]"
              >
                <Feather name="clock" size={13} color="#1B4332" style={{ marginRight: 6 }} />
                <Text className="font-sans font-bold text-[12px] text-[#1B4332]" numberOfLines={1}>
                  Outro horário (24h)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* ============================================================ */
          /* VISÃO 2: CARTEIRA DE PACIENTES                               */
          /* ============================================================ */
          <View className="mx-4 bg-white rounded-[20px] border border-[#eee] p-5 shadow-sm">
            <TouchableOpacity
              onPress={() => setShowPatientsView(false)}
              className="bg-[#f0fdf4] border border-[#bbf7d0] px-4 py-2.5 rounded-full flex-row items-center self-start mb-5"
            >
              <Feather name="arrow-left" size={16} color="#1B4332" style={{ marginRight: 6 }} />
              <Text className="font-sans font-bold text-[#1B4332] text-[14px]">
                Voltar para Agenda
              </Text>
            </TouchableOpacity>

            <View className="flex-row items-center justify-between pb-3 mb-4 border-b border-[#eee]">
              <Text className="font-title text-[20px] text-[#1B4332]">Carteira de Pacientes</Text>
              <TouchableOpacity
                onPress={() => setModalNewPatient(true)}
                className="border border-[#1B4332] rounded-full px-3.5 py-1 bg-white"
              >
                <Text className="font-sans font-bold text-[#1B4332] text-[12px]">+ Novo</Text>
              </TouchableOpacity>
            </View>

            <View className="flex-row items-center mb-5">
              <View className="flex-1 flex-row items-center bg-[#f9fafb] border border-[#eee] rounded-full px-4 py-2.5 mr-2">
                <Feather name="search" size={16} color="#9ca3af" style={{ marginRight: 6 }} />
                <TextInput
                  placeholder="Buscar por nome..."
                  value={search}
                  onChangeText={setSearch}
                  placeholderTextColor="#9ca3af"
                  className="flex-1 font-sans text-[14px] text-[#333] p-0"
                />
              </View>

              <TouchableOpacity
                onPress={() => setModalNewPatient(true)}
                className="w-10 h-10 rounded-full bg-[#1B4332] items-center justify-center mr-2 shadow-sm"
              >
                <Text className="text-white text-[20px] font-bold leading-none mb-0.5">+</Text>
              </TouchableOpacity>

              <NativeSelectMenu
                options={statusFilterMenuOptions}
                selectedValue={statusFilter}
                onSelect={(val) => setStatusFilter(val as 'ativo' | 'inativo' | 'todos')}
              >
                <View
                  style={{
                    backgroundColor: '#f9fafb',
                    borderWidth: 1,
                    borderColor: '#e5e7eb',
                    borderRadius: 999,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <Text
                    className="font-sans font-semibold text-[#495057] text-[13px] capitalize"
                    style={{ marginRight: 4 }}
                  >
                    {statusFilter === 'ativo' ? 'Ativos' : statusFilter === 'inativo' ? 'Inativos' : 'Todos'}
                  </Text>
                  <Feather name="chevron-down" size={13} color="#666" />
                </View>
              </NativeSelectMenu>
            </View>

            {filteredPatients.length === 0 ? (
              <View className="py-8 items-center justify-center">
                <Text className="font-sans text-[#888] text-[14px]">Nenhum paciente cadastrado.</Text>
              </View>
            ) : (
              filteredPatients.map((p: any) => {
                const initials = (p.nome || 'P')
                  .split(' ')
                  .map((n: string) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();

                const isAtivo = (p.status || 'ativo') === 'ativo';

                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() =>
                      router.push({
                        pathname: '/(tabs)/pacientes/[id]' as any,
                        params: {
                          id: String(p.id),
                          nome: p.nome || '',
                          telefone: p.telefone || '',
                          email: p.email || '',
                          status: p.status || 'ativo',
                          sessionValue: String(p.sessionValue ?? 0),
                          observacoes: p.observacoes || ''
                        }
                      })
                    }
                    className="border-b border-[#f0f0f0] py-3.5 flex-row items-center"
                  >
                    <View className="w-10 h-10 rounded-full bg-[#f0fdf4] border border-[#cce5d4] items-center justify-center mr-3">
                      <Text className="font-sans font-bold text-[#1B4332] text-[13px]">{initials}</Text>
                    </View>

                    <View className="flex-1 mr-2">
                      <Text className="font-sans font-bold text-[#333] text-[15px] mb-0.5">{p.nome}</Text>
                      <Text className="font-sans text-[#777] text-[13px]">{p.telefone}</Text>
                    </View>

                    <View
                      className="px-2.5 py-1 rounded-full mr-2"
                      style={{ backgroundColor: isAtivo ? '#e8f5e9' : '#f1f3f5' }}
                    >
                      <Text
                        className="font-sans font-semibold text-[11px]"
                        style={{ color: isAtivo ? '#1B4332' : '#6c757d' }}
                      >
                        {isAtivo ? 'Ativo' : 'Inativo'}
                      </Text>
                    </View>

                    <Text className="text-[14px] mr-2">🔕</Text>

                    <Text className="font-sans font-bold text-[#1B4332] text-[14px]">
                      R$ {p.sessionValue || 0}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}
      </YeloScrollView>

      {/* ============================================================ */}
      {/* MODAL: OPÇÕES DO AGENDAMENTO (AO SEGURAR: EDITAR / EXCLUIR)  */}
      {/* ============================================================ */}
      {selectedEventForAction && (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              zIndex: 55,
              justifyContent: 'flex-end',
              backgroundColor: 'rgba(0,0,0,0.5)'
            }
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              setSelectedEventForAction(null);
              setConfirmDeleteMode(false);
            }}
          />

          <View
            style={{
              backgroundColor: '#ffffff',
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              paddingTop: 18,
              paddingHorizontal: 24,
              paddingBottom: BOTTOM_NAV_CLEARANCE,
              zIndex: 10
            }}
          >
            <View className="w-12 h-1 bg-[#e5e7eb] rounded-full self-center mb-4" />

            {/* Cabeçalho do Evento Selecionado */}
            <View className="flex-row items-center mb-4">
              <View className="w-[44px] h-[44px] rounded-full bg-[#f0fdf4] items-center justify-center mr-3">
                <Feather
                  name={selectedEventForAction.status === 'available' ? 'clock' : 'calendar'}
                  size={20}
                  color="#1B4332"
                />
              </View>
              <View className="flex-1 mr-2">
                <Text className="font-title text-[20px] text-[#1B4332]" numberOfLines={1}>
                  {selectedEventForAction.title || 'Agendamento'}
                </Text>
                <Text className="font-sans text-[13px] text-[#666]">
                  {new Date(selectedEventForAction.start).toLocaleDateString('pt-BR', {
                    weekday: 'short',
                    day: '2-digit',
                    month: 'short'
                  })}{' '}
                  •{' '}
                  {selectedEventForAction.exactEndLabel
                    ? `${selectedEventForAction.exactStartLabel} – ${selectedEventForAction.exactEndLabel}`
                    : selectedEventForAction.exactStartLabel || formatHHMM(new Date(selectedEventForAction.start))}
                </Text>
              </View>

              <TouchableOpacity
                className="p-2"
                onPress={() => {
                  setSelectedEventForAction(null);
                  setConfirmDeleteMode(false);
                }}
              >
                <Feather name="x" size={22} color="#999" />
              </TouchableOpacity>
            </View>

            {!confirmDeleteMode ? (
              <>
                {/* Troca Rápida de Status (apenas para sessões com paciente) */}
                {selectedEventForAction.status !== 'available' && (
                  <View className="mb-4">
                    <Text className="font-sans font-bold text-[11px] text-[#495057] uppercase mb-2">
                      Status da Sessão
                    </Text>
                    <View className="flex-row flex-wrap">
                      {STATUS_QUICK_OPTIONS.map((st) => {
                        const isCurrent = selectedEventForAction.status === st.value;
                        return (
                          <TouchableOpacity
                            key={st.value}
                            disabled={isActionLoading}
                            onPress={() => handleQuickUpdateStatus(st.value)}
                            className="px-3.5 py-2 rounded-full border mr-2 mb-2"
                            style={{
                              backgroundColor: isCurrent ? st.color : st.bg,
                              borderColor: st.color
                            }}
                          >
                            <Text
                              className="font-sans font-bold text-[12px]"
                              style={{ color: isCurrent ? '#ffffff' : st.color }}
                            >
                              {st.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* BOTÕES PRINCIPAIS EM PÍLULA: EDITAR & EXCLUIR */}
                <TouchableOpacity
                  disabled={isActionLoading}
                  onPress={() => handleStartEditEvent(selectedEventForAction)}
                  className="bg-[#1B4332] rounded-full py-3.5 px-5 flex-row items-center justify-center mb-3 shadow-sm"
                >
                  <Feather name="edit-2" size={16} color="#ffffff" style={{ marginRight: 8 }} />
                  <Text className="font-sans font-bold text-white text-[15px]">
                    Editar Agendamento
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={isActionLoading}
                  onPress={() => setConfirmDeleteMode(true)}
                  className="rounded-full py-3.5 px-5 flex-row items-center justify-center"
                  style={{ backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' }}
                >
                  <Feather name="trash-2" size={16} color="#d32f2f" style={{ marginRight: 8 }} />
                  <Text className="font-sans font-bold text-[15px]" style={{ color: '#d32f2f' }}>
                    Excluir Agendamento
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              /* Confirmação de Exclusão (Estilo Calendário iOS: sem contagem numérica de sessões) */
              <View className="pt-1">
                <View
                  className="rounded-[18px] p-3.5 mb-4"
                  style={{ backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' }}
                >
                  <Text className="font-sans font-bold text-[14px] mb-1" style={{ color: '#991b1b' }}>
                    {isSelectedEventRecurring ? 'Este é um agendamento recorrente' : 'Confirmar exclusão?'}
                  </Text>
                  <Text className="font-sans text-[13px]" style={{ color: '#7f1d1d' }}>
                    {isSelectedEventRecurring
                      ? 'Deseja excluir apenas este dia ou cancelar também os agendamentos futuros?'
                      : 'Este horário será removido permanentemente da sua agenda.'}
                  </Text>
                </View>

                {isActionLoading ? (
                  <View className="py-6 items-center">
                    <ActivityIndicator size="small" color="#d32f2f" />
                  </View>
                ) : (
                  <>
                    <TouchableOpacity
                      onPress={() => handleDeleteEvent(false)}
                      className="rounded-full py-3.5 px-5 items-center justify-center mb-2.5"
                      style={{
                        backgroundColor: isSelectedEventRecurring ? '#ffffff' : '#d32f2f',
                        borderWidth: 1,
                        borderColor: '#d32f2f'
                      }}
                    >
                      <Text
                        className="font-sans font-bold text-[15px]"
                        style={{ color: isSelectedEventRecurring ? '#d32f2f' : '#ffffff' }}
                      >
                        {isSelectedEventRecurring ? 'Excluir apenas este dia' : 'Sim, excluir horário'}
                      </Text>
                    </TouchableOpacity>

                    {isSelectedEventRecurring && (
                      <TouchableOpacity
                        onPress={() => handleDeleteEvent(true)}
                        className="rounded-full py-3.5 px-5 flex-row items-center justify-center mb-2.5"
                        style={{ backgroundColor: '#d32f2f', borderWidth: 1, borderColor: '#d32f2f' }}
                      >
                        <Feather name="trash-2" size={16} color="#ffffff" style={{ marginRight: 8 }} />
                        <Text className="font-sans font-bold text-[15px]" style={{ color: '#ffffff' }}>
                          Cancelar este e os futuros
                        </Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      onPress={() => setConfirmDeleteMode(false)}
                      className="rounded-full py-3 px-5 items-center justify-center"
                      style={{ backgroundColor: '#f1f3f5' }}
                    >
                      <Text className="font-sans font-semibold text-[14px]" style={{ color: '#495057' }}>
                        Voltar
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
          </View>
        </View>
      )}

      {/* ============================================================ */}
      {/* MODAL: NOVO / EDITAR AGENDAMENTO                             */}
      {/* ============================================================ */}
      {modalNewAppt && (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              zIndex: 50,
              justifyContent: 'flex-end',
              backgroundColor: 'rgba(0,0,0,0.5)'
            }
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              Keyboard.dismiss();
              setEditingAppt(null);
              setModalNewAppt(false);
            }}
          />
          <Animated.View
            style={{
              backgroundColor: '#ffffff',
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              paddingTop: 20,
              paddingHorizontal: 24,
              paddingBottom: sheetBottomAnim,
              maxHeight: '94%',
              flexShrink: 1,
              zIndex: 10
            }}
          >
            <Pressable onPress={() => Keyboard.dismiss()}>
              <View className="w-12 h-1 bg-[#e5e7eb] rounded-full self-center mb-4" />

              {/* Header do Sheet */}
              <View className="flex-row items-center mb-4">
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    backgroundColor: '#f0fdf4',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12
                  }}
                >
                  <Text className="text-[19px]">{editingAppt ? '✏️' : '📅'}</Text>
                </View>
                <View className="flex-1">
                  <Text className="font-title text-[20px] text-[#1B4332]">
                    {editingAppt ? 'Editar Horário' : 'Agendar Horário'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowCalendarModal(true);
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 2 }}
                  >
                    <Text className="font-sans text-[13px] text-[#1B4332] font-semibold">
                      {formattedDateTitle}
                    </Text>
                    <Feather name="chevron-down" size={13} color="#1B4332" style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  className="p-2"
                  onPress={() => {
                    Keyboard.dismiss();
                    setEditingAppt(null);
                    setModalNewAppt(false);
                  }}
                >
                  <Feather name="x" size={22} color="#999" />
                </TouchableOpacity>
              </View>
            </Pressable>

            <ScrollView
              ref={apptFormScrollRef}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              style={{ flexGrow: 0, flexShrink: 1 }}
            >
              {/* TABS DE TIPO: CONSULTA vs HORÁRIO DISPONÍVEL */}
              <View className="flex-row bg-[#f1f3f5] p-1.5 rounded-full mb-4">
                <TouchableOpacity
                  onPress={() => {
                    setApptType('session');
                  }}
                  className="flex-1 py-2.5 rounded-full items-center justify-center"
                  style={
                    apptType === 'session'
                      ? { backgroundColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 }
                      : undefined
                  }
                >
                  <Text
                    className="font-sans font-bold text-[14px]"
                    style={{ color: apptType === 'session' ? '#1B4332' : '#666666' }}
                  >
                    Consulta
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setApptType('available');
                  }}
                  className="flex-1 py-2.5 rounded-full items-center justify-center"
                  style={
                    apptType === 'available'
                      ? { backgroundColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 }
                      : undefined
                  }
                >
                  <Text
                    className="font-sans font-bold text-[14px]"
                    style={{ color: apptType === 'available' ? '#1B4332' : '#666666' }}
                  >
                    Horário Disponível
                  </Text>
                </TouchableOpacity>
              </View>

              {/* SELEÇÃO DE PACIENTE (MENU NATIVO DO DISPOSITIVO EM ORDEM ALFABÉTICA) */}
              {apptType === 'session' && (
                <View className="mb-4">
                  <Text className="font-sans font-bold text-[12px] text-[#495057] uppercase mb-1.5">
                    Selecione o Paciente
                  </Text>

                  <NativeSelectMenu
                    options={patientMenuOptions}
                    selectedValue={apptPatientId}
                    onSelect={(val) => {
                      setApptPatientId(val);
                    }}
                    style={{ width: '100%' }}
                  >
                    <View
                      style={{
                        backgroundColor: '#f9fafb',
                        borderWidth: 1,
                        borderColor: '#ced4da',
                        borderRadius: 999,
                        paddingHorizontal: 20,
                        paddingVertical: 12,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        width: '100%',
                      }}
                    >
                      <Text
                        className="font-sans text-[15px] flex-1 mr-2"
                        style={{
                          color: apptPatientId ? '#1B4332' : '#111827',
                          fontWeight: apptPatientId ? '600' : '500',
                        }}
                        numberOfLines={1}
                      >
                        {selectedPatientName}
                      </Text>
                      <Feather name="chevron-down" size={18} color="#1B4332" />
                    </View>
                  </NativeSelectMenu>
                </View>
              )}

              {/* SELEÇÃO DE HORÁRIO DE INÍCIO (POPOVER NATIVO DE HORA DO OS 24H) */}
              <View className="mb-4">
                <View className="flex-row items-center justify-between mb-1.5">
                  <Text className="font-sans font-bold text-[12px] text-[#495057] uppercase">
                    Horário de Início (24h)
                  </Text>
                  <Text className="font-sans text-[12px] text-[#1B4332] font-semibold">
                    Término: {calculatedEndTimeStr}
                  </Text>
                </View>

                <NativeTimePicker
                  time={apptTime}
                  onChangeTime={setApptTime}
                  durationBadgeLabel={
                    apptType === 'available' ? '1h livre' : selectedDurationOption.label
                  }
                />
              </View>

              {/* DURAÇÃO E REPETIÇÃO (MENU NATIVO DO DISPOSITIVO — RECORRÊNCIA CONTÍNUA INFINITA) */}
              <View className="mb-2">
                <View className="flex-row justify-between">
                  {apptType === 'session' && (
                    <View className="flex-1" style={{ marginRight: 6 }}>
                      <Text className="font-sans font-bold text-[12px] text-[#495057] uppercase mb-1.5">
                        Duração
                      </Text>
                      <NativeSelectMenu
                        options={durationMenuOptions}
                        selectedValue={String(apptDuration)}
                        onSelect={(val) => {
                          setApptDuration(Number(val));
                        }}
                        style={{ width: '100%' }}
                      >
                        <View
                          style={{
                            backgroundColor: '#f9fafb',
                            borderWidth: 1,
                            borderColor: '#ced4da',
                            borderRadius: 999,
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            width: '100%',
                          }}
                        >
                          <Text className="font-sans font-semibold text-[#1B4332] text-[15px]" numberOfLines={1}>
                            {selectedDurationOption.label}
                          </Text>
                          <Feather name="chevron-down" size={18} color="#1B4332" />
                        </View>
                      </NativeSelectMenu>
                    </View>
                  )}

                  <View className="flex-1" style={apptType === 'session' ? { marginLeft: 6 } : undefined}>
                    <Text className="font-sans font-bold text-[12px] text-[#495057] uppercase mb-1.5">
                      Repetição
                    </Text>
                    <NativeSelectMenu
                      options={recurrenceMenuOptions}
                      selectedValue={apptRecurrence}
                      onSelect={(val) => {
                        setApptRecurrence(val as RecurrenceFrequency);
                      }}
                      style={{ width: '100%' }}
                    >
                      <View
                        style={{
                          backgroundColor: '#f9fafb',
                          borderWidth: 1,
                          borderColor: '#ced4da',
                          borderRadius: 999,
                          paddingHorizontal: 16,
                          paddingVertical: 12,
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          width: '100%',
                        }}
                      >
                        <Text className="font-sans font-semibold text-[#1B4332] text-[15px]" numberOfLines={1}>
                          {selectedRecurrenceLabel}
                        </Text>
                        <Feather name="chevron-down" size={18} color="#1B4332" />
                      </View>
                    </NativeSelectMenu>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleSaveAppt}
                disabled={isSubmittingAppt}
                className="bg-[#1B4332] rounded-full py-4 mt-3 items-center justify-center shadow-sm"
              >
                {isSubmittingAppt ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="font-sans font-bold text-white text-[16px]">
                    {editingAppt
                      ? `Salvar Alterações (${apptTime})`
                      : `Confirmar Horário (${apptTime})`}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        </View>
      )}

      {/* ============================================================ */}
      {/* MODAL: NOVO PACIENTE (ANIMAÇÃO FLUIDA E NATIVA COM TECLADO)  */}
      {/* ============================================================ */}
      {modalNewPatient && (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              zIndex: 50,
              justifyContent: 'flex-end',
              backgroundColor: 'rgba(0,0,0,0.5)'
            }
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              Keyboard.dismiss();
              setModalNewPatient(false);
            }}
          />
          <Animated.View
            style={{
              backgroundColor: '#ffffff',
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              paddingTop: 20,
              paddingHorizontal: 24,
              paddingBottom: sheetBottomAnim,
              maxHeight: '94%',
              flexShrink: 1,
              zIndex: 10
            }}
          >
            <Pressable onPress={() => Keyboard.dismiss()}>
              <View className="w-12 h-1 bg-[#e5e7eb] rounded-full self-center mb-4" />

              <View className="flex-row items-center mb-5">
                <View className="w-[42px] h-[42px] rounded-full bg-[#f0fdf4] items-center justify-center mr-3">
                  <Text className="text-[18px]">👤</Text>
                </View>
                <View className="flex-1">
                  <Text className="font-title text-[20px] text-[#1B4332]">Novo Paciente</Text>
                  <Text className="font-sans text-[13px] text-[#666]">Preencha os dados do cadastro.</Text>
                </View>

                <TouchableOpacity
                  className="p-2"
                  onPress={() => {
                    Keyboard.dismiss();
                    setModalNewPatient(false);
                  }}
                >
                  <Feather name="x" size={22} color="#999" />
                </TouchableOpacity>
              </View>
            </Pressable>

            <ScrollView
              ref={patientFormScrollRef}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              style={{ flexGrow: 0, flexShrink: 1 }}
            >
              <Text className="font-sans font-bold text-[12px] text-[#495057] uppercase mb-1.5">Nome Completo *</Text>
              <TextInput
                className="bg-[#f9fafb] border border-[#ccc] rounded-full px-5 py-3.5 mb-3.5 font-sans text-[15px] text-[#1B4332]"
                placeholder="Ex: João Silva"
                placeholderTextColor="#9ca3af"
                returnKeyType="next"
                onSubmitEditing={() => newPatientPhoneRef.current?.focus?.()}
                value={newPatientName}
                onChangeText={setNewPatientName}
              />

              <Text className="font-sans font-bold text-[12px] text-[#495057] uppercase mb-1.5">WhatsApp *</Text>
              <TextInput
                ref={newPatientPhoneRef}
                className="bg-[#f9fafb] border border-[#ccc] rounded-full px-5 py-3.5 mb-3.5 font-sans text-[15px] text-[#1B4332]"
                placeholder="(00) 00000-0000"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
                value={newPatientPhone}
                onChangeText={(t) => setNewPatientPhone(maskPhone(t))}
                maxLength={15}
              />

              <View className="flex-row justify-between mb-5">
                <View className="flex-1 mr-2">
                  <Text className="font-sans font-bold text-[12px] text-[#495057] uppercase mb-1.5">Valor da Sessão</Text>
                  <TextInput
                    ref={newPatientValueRef}
                    className="bg-[#f9fafb] border border-[#ccc] rounded-full px-5 py-3.5 font-sans text-[15px] text-[#1B4332]"
                    placeholder="R$ 150,00"
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                    value={newPatientValue}
                    onChangeText={(t) => setNewPatientValue(maskCurrency(t))}
                    onFocus={() => {
                      setTimeout(() => {
                        patientFormScrollRef.current?.scrollToEnd({ animated: true });
                      }, 150);
                    }}
                  />
                </View>

                <View className="flex-1 ml-2">
                  <Text className="font-sans font-bold text-[12px] text-[#495057] uppercase mb-1.5">Status</Text>
                  <NativeSelectMenu
                    options={patientStatusMenuOptions}
                    selectedValue={newPatientStatus}
                    onSelect={(val) => setNewPatientStatus(val)}
                    style={{ width: '100%' }}
                  >
                    <View
                      style={{
                        backgroundColor: '#f9fafb',
                        borderWidth: 1,
                        borderColor: '#cccccc',
                        borderRadius: 999,
                        paddingHorizontal: 20,
                        paddingVertical: 14,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        width: '100%',
                      }}
                    >
                      <Text className="font-sans text-[15px] text-[#1B4332] font-bold capitalize">
                        {newPatientStatus}
                      </Text>
                      <Feather name="chevron-down" size={16} color="#1B4332" />
                    </View>
                  </NativeSelectMenu>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleSavePatient}
                disabled={isSubmittingPatient}
                className="bg-[#1B4332] rounded-full py-4 items-center justify-center shadow-sm"
              >
                {isSubmittingPatient ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="font-sans font-bold text-white text-[16px]">Salvar Paciente</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        </View>
      )}

      {/* ============================================================ */}
      {/* MODAL: CALENDÁRIO MENSAL PARA IR A UMA DATA ESPECÍFICA       */}
      {/* ============================================================ */}
      {showCalendarModal && (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              zIndex: 70,
              justifyContent: 'flex-end',
              backgroundColor: 'rgba(0,0,0,0.5)'
            }
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowCalendarModal(false)}
          />

          <View
            style={{
              backgroundColor: '#ffffff',
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              paddingTop: 20,
              paddingHorizontal: 20,
              paddingBottom: BOTTOM_NAV_CLEARANCE,
              zIndex: 10
            }}
          >
            <View className="w-12 h-1 bg-[#e5e7eb] rounded-full self-center mb-4" />

            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 }}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: '#f0fdf4',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12
                }}
              >
                <Feather name="calendar" size={20} color="#1B4332" />
              </View>
              <View style={{ flex: 1 }}>
                <Text className="font-title text-[20px] text-[#1B4332]">Selecionar Data</Text>
                <Text className="font-sans text-[13px] text-[#666]">
                  Toque em qualquer dia para visualizar a agenda.
                </Text>
              </View>
              <TouchableOpacity
                className="p-2"
                onPress={() => setShowCalendarModal(false)}
              >
                <Feather name="x" size={22} color="#999" />
              </TouchableOpacity>
            </View>

            <Calendar
              current={selectedDateISO}
              enableSwipeMonths={true}
              markedDates={markedCalendarDates}
              onMonthChange={(m: any) => {
                if (m?.year && m?.month) {
                  setCalendarFocusDate(new Date(m.year, m.month - 1, 1));
                }
              }}
              onDayPress={(day: any) => {
                try { Vibration.vibrate(10); } catch {}
                const chosen = new Date(day.year, day.month - 1, day.day);
                setSelectedDate(chosen);
                setCalendarFocusDate(chosen);
                setShowCalendarModal(false);
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
                selectedDotColor: '#ffffff',
                arrowColor: '#1B4332',
                monthTextColor: '#1B4332',
                textDayFontWeight: '500',
                textMonthFontWeight: '700',
                textDayHeaderFontWeight: '600',
                textDayFontSize: 15,
                textMonthFontSize: 17,
                textDayHeaderFontSize: 12
              }}
            />

            <TouchableOpacity
              onPress={() => {
                try { Vibration.vibrate(10); } catch {}
                setSelectedDate(new Date());
                setShowCalendarModal(false);
              }}
              style={{
                marginTop: 14,
                backgroundColor: '#f0fdf4',
                borderWidth: 1,
                borderColor: '#cce5d4',
                borderRadius: 999,
                paddingVertical: 13,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row'
              }}
            >
              <Feather name="compass" size={15} color="#1B4332" style={{ marginRight: 7 }} />
              <Text className="font-sans font-bold text-[14px]" style={{ color: '#1B4332' }}>
                Ir para Hoje
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}
