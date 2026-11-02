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
import { Picker } from '@react-native-picker/picker';
import api from '../../../services/api';

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

// Máscara inteligente estilo Nubank para digitação direta de horário (HH:MM 24h)
const maskTimeInput = (raw: string) => {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
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

// Listas 24h completas para a Roleta Nativa do OS (00h–23h e minutos de 5 em 5)
const ALL_24_HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const BASE_MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

const DURATION_OPTIONS = [
  { label: '30 min', pickerLabel: '30 minutos', value: 30 },
  { label: '40 min', pickerLabel: '40 minutos', value: 40 },
  { label: '45 min', pickerLabel: '45 minutos', value: 45 },
  { label: '50 min', pickerLabel: '50 minutos', value: 50 },
  { label: '1h (60m)', pickerLabel: '1 hora (60 min)', value: 60 },
  { label: '1h 30m', pickerLabel: '1h 30min (90 min)', value: 90 }
];

const RECURRENCE_OPTIONS: { label: string; value: 'none' | 'weekly' | 'biweekly' }[] = [
  { label: 'Não repetir', value: 'none' },
  { label: 'Semanal', value: 'weekly' },
  { label: 'Quinzenal', value: 'biweekly' }
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
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  // Modais estilizados como Bottom Sheet Overlay
  const [modalNewPatient, setModalNewPatient] = useState(false);
  const [modalNewAppt, setModalNewAppt] = useState(false);

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
  const [apptPatientId, setApptPatientId] = useState<string>('1');
  const [apptTime, setApptTime] = useState<string>('14:00');
  const [apptDuration, setApptDuration] = useState<number>(50);
  const [apptRecurrence, setApptRecurrence] = useState<'none' | 'weekly' | 'biweekly'>('none');
  const [isSubmittingAppt, setIsSubmittingAppt] = useState(false);

  // Seletores Carrossel / Wheel Picker Nativo (iOS & Android) & Modo Digitar
  const [showPatientPicker, setShowPatientPicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [showRecurrencePicker, setShowRecurrencePicker] = useState(false);
  const [timeInputMode, setTimeInputMode] = useState<'wheel' | 'type'>('wheel');
  const [typedTimeDraft, setTypedTimeDraft] = useState('14:00');

  const apptFormScrollRef = useRef<any>(null);
  const patientPickerRef = useRef<any>(null);
  const durationPickerRef = useRef<any>(null);
  const recurrencePickerRef = useRef<any>(null);

  const closeAllApptPickers = () => {
    setShowPatientPicker(false);
    setShowTimePicker(false);
    setShowDurationPicker(false);
    setShowRecurrencePicker(false);
  };

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
  const openNewApptSheet = (initialTime: string, expandTimeSelector = false) => {
    const cleanTime = normalizeTimeStr(initialTime, '14:00');
    setEditingAppt(null);
    setApptTime(cleanTime);
    setTypedTimeDraft(cleanTime);
    setApptRecurrence('none');
    closeAllApptPickers();
    setShowTimePicker(expandTimeSelector);
    setTimeInputMode('wheel');
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

    setSelectedDate(new Date(startDt.getFullYear(), startDt.getMonth(), startDt.getDate()));
    setEditingAppt(evt);
    setApptType(evt.status === 'available' ? 'available' : 'session');
    if (evt.patientId) {
      setApptPatientId(String(evt.patientId));
    }
    setApptTime(startHHMM);
    setTypedTimeDraft(startHHMM);
    setApptDuration(validDuration);
    setApptRecurrence('none');
    closeAllApptPickers();
    setShowTimePicker(true);
    setTimeInputMode('wheel');

    setSelectedEventForAction(null);
    setConfirmDeleteMode(false);
    setModalNewAppt(true);
  };

  // Detecta ocorrências futuras da mesma série recorrente (mesmo paciente/tipo, dia da semana e hora:minuto)
  const futureRecurringIds = useMemo(() => {
    if (!selectedEventForAction || !selectedEventForAction.start) return [];
    const targetStart = new Date(selectedEventForAction.start);
    const targetDay = targetStart.getDay();
    const targetH = targetStart.getHours();
    const targetM = targetStart.getMinutes();
    const isAvail = selectedEventForAction.status === 'available';

    return appointments
      .filter((a: any) => {
        if (!a.start || String(a.id) === String(selectedEventForAction.id)) return false;
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

  // Atualizar Status Rápido de um Agendamento
  const handleQuickUpdateStatus = async (newStatus: string) => {
    if (!selectedEventForAction) return;
    try {
      setIsActionLoading(true);
      await api.put(`/api/appointments/${selectedEventForAction.id}`, {
        status: newStatus,
        start: selectedEventForAction.start,
        end: selectedEventForAction.end,
        value: selectedEventForAction.value || 0,
        title: selectedEventForAction.title
      });
      setSelectedEventForAction(null);
      await fetchData();
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível atualizar o status deste agendamento.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Excluir Agendamento (apenas este OU este + próximos futuros)
  const handleDeleteEvent = async (deleteFutureSeries = false) => {
    if (!selectedEventForAction) return;
    try {
      setIsActionLoading(true);
      if (deleteFutureSeries && futureRecurringIds.length > 0) {
        const idsToDelete = [selectedEventForAction.id, ...futureRecurringIds];
        await api.delete('/api/appointments/bulk', {
          data: { ids: idsToDelete }
        });
      } else {
        await api.delete(`/api/appointments/${selectedEventForAction.id}`);
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

  // Carregar dados reais da API
  const fetchData = useCallback(async (showSpinner = true) => {
    try {
      if (showSpinner) setIsLoading(true);
      const [resPatients, resAppts] = await Promise.all([
        api.get('/api/my-patients').then(r => ({ ok: true, data: r.data })).catch(() => ({ ok: false, data: [] })),
        api.get('/api/appointments').catch(() => ({ data: [] }))
      ]);

      const loadedPatients = resPatients.ok
        ? (Array.isArray(resPatients.data) ? resPatients.data : [])
        : FALLBACK_PATIENTS;

      setPatients(loadedPatients);
      if (loadedPatients.length > 0) {
        setApptPatientId(prev => {
          const exists = loadedPatients.some((p: any) => String(p.id) === String(prev));
          return exists ? prev : String(loadedPatients[0].id);
        });
      }
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

  // Próximos Atendimentos (mantém referência ao objeto original para permitir editar/excluir ao segurar)
  const upcomingList = useMemo(() => {
    const realUpcoming = appointments
      .filter((a: any) => (a.status === 'scheduled' || a.status === 'confirmed') && new Date(a.start) >= new Date())
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

  // Lista de Pacientes Filtrada
  const filteredPatients = useMemo(() => {
    return patients.filter((p: any) => {
      if (statusFilter !== 'todos' && (p.status || 'ativo') !== statusFilter) return false;
      if (search && !p.nome?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [patients, statusFilter, search]);

  // Paciente, duração e repetição selecionados para os pickers em carrossel
  const selectedPatientName = useMemo(() => {
    const p = patients.find(item => String(item.id) === String(apptPatientId));
    return p ? p.nome : (patients[0]?.nome || 'Selecione um paciente');
  }, [patients, apptPatientId]);

  const selectedDurationOption = useMemo(() => {
    return DURATION_OPTIONS.find(opt => opt.value === apptDuration) || DURATION_OPTIONS[3];
  }, [apptDuration]);

  const selectedRecurrenceLabel = useMemo(() => {
    const rec = RECURRENCE_OPTIONS.find(r => r.value === apptRecurrence);
    return rec ? rec.label : 'Não repetir';
  }, [apptRecurrence]);

  // Decomposição HH e MM para a Roleta Dupla 24h
  const [selectedHour, selectedMinute] = useMemo(() => {
    const parts = apptTime.split(':');
    const hh = (parts[0] || '14').padStart(2, '0');
    const mm = (parts[1] || '00').padStart(2, '0');
    return [hh, mm];
  }, [apptTime]);

  const minuteOptions = useMemo(() => {
    if (BASE_MINUTES.includes(selectedMinute)) return BASE_MINUTES;
    return [...BASE_MINUTES, selectedMinute].sort();
  }, [selectedMinute]);

  // Cálculo em tempo real do horário de término da sessão
  const calculatedEndTimeStr = useMemo(() => {
    const [hh, mm] = apptTime.split(':').map(Number);
    const d = new Date(2026, 0, 1, hh || 0, mm || 0, 0, 0);
    d.setMinutes(d.getMinutes() + (apptType === 'available' ? 60 : apptDuration));
    return formatHHMM(d);
  }, [apptTime, apptDuration, apptType]);

  // Agendamentos do dia selecionado ordenados cronologicamente
  const dayAppointments = useMemo(() => {
    return appointments
      .filter((a: any) => {
        if (!a.start || a.status === 'cancelled') return false;
        const d = new Date(a.start);
        return !isNaN(d.getTime()) && isSameLocalDay(d, selectedDate);
      })
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

  // Salvar Agendamento (Criação OU Edição)
  const handleSaveAppt = async () => {
    Keyboard.dismiss();

    const finalTime = timeInputMode === 'type'
      ? normalizeTimeStr(typedTimeDraft, apptTime)
      : apptTime;

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

    const patient = patients.find(p => String(p.id) === String(apptPatientId)) || patients[0];

    try {
      setIsSubmittingAppt(true);

      if (editingAppt) {
        // MODO EDIÇÃO: Atualiza o agendamento existente
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
          value: apptType === 'available' ? 0 : (patient?.sessionValue || editingAppt.value || 150)
        });

        setModalNewAppt(false);
        setEditingAppt(null);
        closeAllApptPickers();
        await fetchData();
        Alert.alert('Atualizado', `Agendamento atualizado para ${finalTime}!`);
        return;
      }

      // MODO CRIAÇÃO
      if (apptRecurrence === 'none') {
        if (apptType === 'available') {
          await api.post('/api/appointments', {
            title: 'Horário Disponível',
            start: startDt.toISOString(),
            end: endDt.toISOString(),
            patientId: null,
            status: 'available',
            value: 0
          });
        } else {
          await api.post('/api/appointments', {
            title: patient ? patient.nome : 'Consulta',
            start: startDt.toISOString(),
            end: endDt.toISOString(),
            patientId: patient ? patient.id : null,
            status: 'scheduled',
            value: patient?.sessionValue || 150
          });
        }
      } else {
        const occCount = apptRecurrence === 'weekly' ? 16 : 12;
        const stepDays = apptRecurrence === 'weekly' ? 7 : 14;
        const occurrences = [];

        for (let i = 0; i < occCount; i++) {
          const curStart = new Date(startDt);
          curStart.setDate(curStart.getDate() + i * stepDays);
          const curEnd = new Date(curStart.getTime() + durationMs);

          occurrences.push({
            title: apptType === 'available' ? 'Horário Disponível' : (patient ? patient.nome : 'Consulta'),
            start: curStart.toISOString(),
            end: curEnd.toISOString(),
            patientId: apptType === 'available' ? null : (patient ? patient.id : null),
            phone: apptType === 'session' && patient ? patient.telefone : null,
            status: apptType === 'available' ? 'available' : 'scheduled',
            value: apptType === 'session' && patient ? (patient.sessionValue || 0) : 0
          });
        }

        await api.post('/api/appointments/bulk', { appointments: occurrences });
      }

      setModalNewAppt(false);
      closeAllApptPickers();
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
            {/* TOOLBAR DA AGENDA: Navegação de Datas */}
            <View className="flex-row items-center justify-between p-4 border-b border-[#f0f0f0]">
              <View className="flex-row items-center">
                <TouchableOpacity
                  onPress={handlePrevDay}
                  className="w-[34px] h-[34px] bg-[#f8f9fa] border border-[#e9ecef] rounded-full items-center justify-center mr-1.5"
                >
                  <Text className="font-sans font-bold text-[#495057] text-[14px]">❮</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleNextDay}
                  className="w-[34px] h-[34px] bg-[#f8f9fa] border border-[#e9ecef] rounded-full items-center justify-center"
                >
                  <Text className="font-sans font-bold text-[#495057] text-[14px]">❯</Text>
                </TouchableOpacity>
              </View>

              <View className="flex-row items-center">
                <TouchableOpacity
                  onPress={handleToday}
                  className="bg-[#f8f9fa] border border-[#e9ecef] px-3.5 py-1.5 rounded-full mr-2.5"
                >
                  <Text className="font-sans font-semibold text-[#495057] text-[13px]">Hoje</Text>
                </TouchableOpacity>
                <Text className="font-title text-[#1B4332] text-[17px] capitalize">
                  {formattedDateTitle}
                </Text>
              </View>
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

              <TouchableOpacity
                onPress={() => setShowStatusMenu(!showStatusMenu)}
                className="bg-[#f9fafb] border border-[#eee] rounded-full px-3.5 py-2.5 flex-row items-center"
              >
                <Text className="font-sans font-semibold text-[#495057] text-[13px] mr-1 capitalize">
                  {statusFilter === 'ativo' ? 'Ativos' : statusFilter === 'inativo' ? 'Inativos' : 'Todos'}
                </Text>
                <Feather name="chevron-down" size={13} color="#666" />
              </TouchableOpacity>
            </View>

            {showStatusMenu && (
              <View className="bg-white border border-[#eee] rounded-[16px] shadow-lg mb-4 overflow-hidden">
                <TouchableOpacity
                  onPress={() => { setStatusFilter('ativo'); setShowStatusMenu(false); }}
                  className="p-3 border-b border-[#f5f5f5]"
                  style={statusFilter === 'ativo' ? { backgroundColor: '#f0fdf4' } : undefined}
                >
                  <Text
                    className="font-sans text-[14px]"
                    style={{ color: statusFilter === 'ativo' ? '#1B4332' : '#333333', fontWeight: statusFilter === 'ativo' ? '700' : '400' }}
                  >
                    Ativos
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setStatusFilter('inativo'); setShowStatusMenu(false); }}
                  className="p-3 border-b border-[#f5f5f5]"
                  style={statusFilter === 'inativo' ? { backgroundColor: '#f0fdf4' } : undefined}
                >
                  <Text
                    className="font-sans text-[14px]"
                    style={{ color: statusFilter === 'inativo' ? '#1B4332' : '#333333', fontWeight: statusFilter === 'inativo' ? '700' : '400' }}
                  >
                    Inativos
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setStatusFilter('todos'); setShowStatusMenu(false); }}
                  className="p-3"
                  style={statusFilter === 'todos' ? { backgroundColor: '#f0fdf4' } : undefined}
                >
                  <Text
                    className="font-sans text-[14px]"
                    style={{ color: statusFilter === 'todos' ? '#1B4332' : '#333333', fontWeight: statusFilter === 'todos' ? '700' : '400' }}
                  >
                    Todos
                  </Text>
                </TouchableOpacity>
              </View>
            )}

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
                  className="bg-[#fef2f2] border border-[#fecaca] rounded-full py-3.5 px-5 flex-row items-center justify-center"
                >
                  <Feather name="trash-2" size={16} color="#d32f2f" style={{ marginRight: 8 }} />
                  <Text className="font-sans font-bold text-[#d32f2f] text-[15px]">
                    Excluir Agendamento
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              /* Confirmação de Exclusão (Suporta evento único ou série recorrente!) */
              <View className="pt-1">
                <View className="bg-[#fef2f2] border border-[#fecaca] rounded-[18px] p-3.5 mb-4">
                  <Text className="font-sans font-bold text-[#991b1b] text-[14px] mb-1">
                    Confirmar exclusão?
                  </Text>
                  <Text className="font-sans text-[#7f1d1d] text-[13px]">
                    {futureRecurringIds.length > 0
                      ? `Encontramos mais ${futureRecurringIds.length} horário(s) futuro(s) desta série recorrente. Como deseja excluir?`
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
                      className="rounded-full py-3.5 px-5 items-center justify-center mb-2.5 border"
                      style={{
                        backgroundColor: futureRecurringIds.length > 0 ? '#ffffff' : '#d32f2f',
                        borderColor: '#d32f2f'
                      }}
                    >
                      <Text
                        className="font-sans font-bold text-[15px]"
                        style={{ color: futureRecurringIds.length > 0 ? '#d32f2f' : '#ffffff' }}
                      >
                        {futureRecurringIds.length > 0 ? 'Excluir apenas este dia' : 'Sim, excluir horário'}
                      </Text>
                    </TouchableOpacity>

                    {futureRecurringIds.length > 0 && (
                      <TouchableOpacity
                        onPress={() => handleDeleteEvent(true)}
                        className="bg-[#d32f2f] rounded-full py-3.5 px-5 items-center justify-center mb-2.5"
                      >
                        <Text className="font-sans font-bold text-white text-[15px]">
                          Excluir este e os próximos ({futureRecurringIds.length + 1})
                        </Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      onPress={() => setConfirmDeleteMode(false)}
                      className="bg-[#f1f3f5] rounded-full py-3 px-5 items-center justify-center"
                    >
                      <Text className="font-sans font-semibold text-[#495057] text-[14px]">
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
              closeAllApptPickers();
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
                <View className="w-[42px] h-[42px] rounded-full bg-[#f0fdf4] items-center justify-center mr-3">
                  <Text className="text-[19px]">{editingAppt ? '✏️' : '📅'}</Text>
                </View>
                <View className="flex-1">
                  <Text className="font-title text-[20px] text-[#1B4332]">
                    {editingAppt ? 'Editar Horário' : 'Agendar Horário'}
                  </Text>
                  <Text className="font-sans text-[13px] text-[#666]">{formattedDateTitle}</Text>
                </View>

                <TouchableOpacity
                  className="p-2"
                  onPress={() => {
                    Keyboard.dismiss();
                    closeAllApptPickers();
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
                    closeAllApptPickers();
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
                    closeAllApptPickers();
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

              {/* SELEÇÃO DE PACIENTE */}
              {apptType === 'session' && (
                <View className="mb-4">
                  <Text className="font-sans font-bold text-[12px] text-[#495057] uppercase mb-1.5">
                    Selecione o Paciente
                  </Text>

                  <TouchableOpacity
                    onPress={() => {
                      const next = !showPatientPicker;
                      Keyboard.dismiss();
                      closeAllApptPickers();
                      setShowPatientPicker(next);
                      if (next && Platform.OS === 'android') {
                        setTimeout(() => patientPickerRef.current?.focus?.(), 60);
                      }
                    }}
                    className="bg-[#f9fafb] border rounded-full px-5 py-3 flex-row justify-between items-center"
                    style={{ borderColor: showPatientPicker ? '#1B4332' : '#ced4da' }}
                  >
                    <Text className="font-sans font-semibold text-[#1B4332] text-[15px]" numberOfLines={1}>
                      {selectedPatientName}
                    </Text>
                    <Feather name={showPatientPicker ? 'chevron-up' : 'chevron-down'} size={18} color="#1B4332" />
                  </TouchableOpacity>

                  {showPatientPicker && (
                    <View className="bg-[#f8f9fa] border border-[#eee] rounded-[20px] mt-2 overflow-hidden">
                      <Picker
                        ref={patientPickerRef}
                        mode="dialog"
                        prompt="Selecione o Paciente"
                        selectedValue={apptPatientId}
                        onValueChange={(itemValue) => setApptPatientId(String(itemValue))}
                        itemStyle={{ height: 120, fontSize: 16, color: '#1B4332', fontWeight: '600' }}
                      >
                        {patients.map(p => (
                          <Picker.Item
                            key={p.id}
                            label={`${p.nome} - R$ ${p.sessionValue || 0}`}
                            value={String(p.id)}
                          />
                        ))}
                      </Picker>
                    </View>
                  )}
                </View>
              )}

              {/* SELEÇÃO DE HORÁRIO DE INÍCIO (CARROSSEL NATIVO 24H) */}
              <View className="mb-4">
                <View className="flex-row items-center justify-between mb-1.5">
                  <Text className="font-sans font-bold text-[12px] text-[#495057] uppercase">
                    Horário de Início (24h)
                  </Text>
                  <Text className="font-sans text-[12px] text-[#1B4332] font-semibold">
                    Término: {calculatedEndTimeStr}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    const next = !showTimePicker;
                    Keyboard.dismiss();
                    closeAllApptPickers();
                    setShowTimePicker(next);
                  }}
                  className="bg-[#f9fafb] border rounded-full px-5 py-3 flex-row justify-between items-center"
                  style={{ borderColor: showTimePicker ? '#1B4332' : '#ced4da' }}
                >
                  <View className="flex-row items-center">
                    <Feather name="clock" size={16} color="#1B4332" style={{ marginRight: 8 }} />
                    <Text className="font-sans font-bold text-[#1B4332] text-[16px]">
                      {apptTime}
                    </Text>
                    <View className="ml-2.5 px-2.5 py-0.5 rounded-full bg-[#e8f5e9]">
                      <Text className="font-sans font-semibold text-[11px] text-[#1B4332]">
                        {apptType === 'available' ? '1h livre' : selectedDurationOption.label}
                      </Text>
                    </View>
                  </View>
                  <Feather name={showTimePicker ? 'chevron-up' : 'chevron-down'} size={18} color="#1B4332" />
                </TouchableOpacity>

                {showTimePicker && (
                  <View className="bg-[#f8f9fa] border border-[#e5e7eb] rounded-[22px] mt-2.5 p-3 overflow-hidden">
                    <View className="flex-row items-center justify-between mb-2 px-1">
                      <Text className="font-sans font-semibold text-[12px] text-[#666]">
                        {timeInputMode === 'wheel'
                          ? 'Gire para qualquer hora e minuto'
                          : 'Digite qualquer horário (00:00 a 23:59)'}
                      </Text>

                      <TouchableOpacity
                        onPress={() => {
                          if (timeInputMode === 'wheel') {
                            setTypedTimeDraft(apptTime);
                            setTimeInputMode('type');
                          } else {
                            Keyboard.dismiss();
                            const normalized = normalizeTimeStr(typedTimeDraft, apptTime);
                            setApptTime(normalized);
                            setTypedTimeDraft(normalized);
                            setTimeInputMode('wheel');
                          }
                        }}
                        className="px-3 py-1 rounded-full bg-white border border-[#ced4da] flex-row items-center"
                      >
                        <Feather
                          name={timeInputMode === 'wheel' ? 'edit-3' : 'sliders'}
                          size={12}
                          color="#1B4332"
                          style={{ marginRight: 5 }}
                        />
                        <Text className="font-sans font-bold text-[11px] text-[#1B4332]">
                          {timeInputMode === 'wheel' ? 'Digitar' : 'Roleta'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {timeInputMode === 'wheel' ? (
                      <View className="flex-row items-center justify-center">
                        <View className="flex-1">
                          <Picker
                            selectedValue={selectedHour}
                            onValueChange={(hVal) => {
                              const next = `${String(hVal).padStart(2, '0')}:${selectedMinute}`;
                              setApptTime(next);
                              setTypedTimeDraft(next);
                            }}
                            itemStyle={{ height: 120, fontSize: 17, color: '#1B4332', fontWeight: '600' }}
                          >
                            {ALL_24_HOURS.map(h => (
                              <Picker.Item key={h} label={`${h} h`} value={h} />
                            ))}
                          </Picker>
                        </View>

                        <Text className="font-sans font-bold text-[20px] text-[#1B4332] mx-1">:</Text>

                        <View className="flex-1">
                          <Picker
                            selectedValue={selectedMinute}
                            onValueChange={(mVal) => {
                              const next = `${selectedHour}:${String(mVal).padStart(2, '0')}`;
                              setApptTime(next);
                              setTypedTimeDraft(next);
                            }}
                            itemStyle={{ height: 120, fontSize: 17, color: '#1B4332', fontWeight: '600' }}
                          >
                            {minuteOptions.map(m => (
                              <Picker.Item key={m} label={`${m} min`} value={m} />
                            ))}
                          </Picker>
                        </View>
                      </View>
                    ) : (
                      <View className="py-2 items-center">
                        <TextInput
                          value={typedTimeDraft}
                          onChangeText={(txt) => {
                            const masked = maskTimeInput(txt);
                            setTypedTimeDraft(masked);
                            if (masked.length === 5) {
                              setApptTime(normalizeTimeStr(masked, apptTime));
                            }
                          }}
                          onBlur={() => {
                            const normalized = normalizeTimeStr(typedTimeDraft, apptTime);
                            setApptTime(normalized);
                            setTypedTimeDraft(normalized);
                          }}
                          keyboardType="number-pad"
                          maxLength={5}
                          placeholder="Ex: 07:30"
                          placeholderTextColor="#9ca3af"
                          autoFocus
                          className="bg-white border border-[#1B4332] rounded-full px-6 py-2.5 font-sans font-bold text-[22px] text-[#1B4332] text-center min-w-[150px]"
                        />
                        <Text className="font-sans text-[11px] text-[#777] mt-1.5">
                          Ex: 06:30, 14:20, 20:10 ou 22:45
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* DURAÇÃO E REPETIÇÃO (SELETORES NATIVOS EM CARROSSEL PADRÃO iOS / ANDROID) */}
              {(apptType === 'session' || !editingAppt) && (
                <View className="mb-2">
                  <View className="flex-row justify-between">
                    {apptType === 'session' && (
                      <View className="flex-1" style={!editingAppt ? { marginRight: 6 } : undefined}>
                        <Text className="font-sans font-bold text-[12px] text-[#495057] uppercase mb-1.5">
                          Duração
                        </Text>
                        <TouchableOpacity
                          onPress={() => {
                            const next = !showDurationPicker;
                            Keyboard.dismiss();
                            closeAllApptPickers();
                            setShowDurationPicker(next);
                            if (next) {
                              setTimeout(() => {
                                apptFormScrollRef.current?.scrollToEnd({ animated: true });
                                if (Platform.OS === 'android') {
                                  durationPickerRef.current?.focus?.();
                                }
                              }, 80);
                            }
                          }}
                          className="bg-[#f9fafb] border rounded-full px-4 py-3 flex-row justify-between items-center"
                          style={{ borderColor: showDurationPicker ? '#1B4332' : '#ced4da' }}
                        >
                          <Text className="font-sans font-semibold text-[#1B4332] text-[15px]" numberOfLines={1}>
                            {selectedDurationOption.label}
                          </Text>
                          <Feather name={showDurationPicker ? 'chevron-up' : 'chevron-down'} size={18} color="#1B4332" />
                        </TouchableOpacity>
                      </View>
                    )}

                    {!editingAppt && (
                      <View className="flex-1" style={apptType === 'session' ? { marginLeft: 6 } : undefined}>
                        <Text className="font-sans font-bold text-[12px] text-[#495057] uppercase mb-1.5">
                          Repetição
                        </Text>
                        <TouchableOpacity
                          onPress={() => {
                            const next = !showRecurrencePicker;
                            Keyboard.dismiss();
                            closeAllApptPickers();
                            setShowRecurrencePicker(next);
                            if (next) {
                              setTimeout(() => {
                                apptFormScrollRef.current?.scrollToEnd({ animated: true });
                                if (Platform.OS === 'android') {
                                  recurrencePickerRef.current?.focus?.();
                                }
                              }, 80);
                            }
                          }}
                          className="bg-[#f9fafb] border rounded-full px-4 py-3 flex-row justify-between items-center"
                          style={{ borderColor: showRecurrencePicker ? '#1B4332' : '#ced4da' }}
                        >
                          <Text className="font-sans font-semibold text-[#1B4332] text-[15px]" numberOfLines={1}>
                            {selectedRecurrenceLabel}
                          </Text>
                          <Feather name={showRecurrencePicker ? 'chevron-up' : 'chevron-down'} size={18} color="#1B4332" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  {showDurationPicker && apptType === 'session' && (
                    <View className="bg-[#f8f9fa] border border-[#eee] rounded-[20px] mt-2.5 overflow-hidden">
                      <Picker
                        ref={durationPickerRef}
                        mode="dialog"
                        prompt="Selecione a Duração"
                        selectedValue={apptDuration}
                        onValueChange={(val) => setApptDuration(Number(val))}
                        itemStyle={{ height: 120, fontSize: 16, color: '#1B4332', fontWeight: '600' }}
                      >
                        {DURATION_OPTIONS.map((opt) => (
                          <Picker.Item key={opt.value} label={opt.pickerLabel} value={opt.value} />
                        ))}
                      </Picker>
                    </View>
                  )}

                  {showRecurrencePicker && !editingAppt && (
                    <View className="bg-[#f8f9fa] border border-[#eee] rounded-[20px] mt-2.5 overflow-hidden">
                      <Picker
                        ref={recurrencePickerRef}
                        mode="dialog"
                        prompt="Selecione a Repetição"
                        selectedValue={apptRecurrence}
                        onValueChange={(val) => setApptRecurrence(val as 'none' | 'weekly' | 'biweekly')}
                        itemStyle={{ height: 120, fontSize: 16, color: '#1B4332', fontWeight: '600' }}
                      >
                        {RECURRENCE_OPTIONS.map((rec) => (
                          <Picker.Item key={rec.value} label={rec.label} value={rec.value} />
                        ))}
                      </Picker>
                    </View>
                  )}
                </View>
              )}
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
                  <TouchableOpacity
                    onPress={() => {
                      Keyboard.dismiss();
                      setNewPatientStatus(newPatientStatus === 'ativo' ? 'inativo' : 'ativo');
                    }}
                    className="bg-[#f9fafb] border border-[#ccc] rounded-full px-5 py-3.5 flex-row justify-between items-center"
                  >
                    <Text className="font-sans text-[15px] text-[#1B4332] font-bold capitalize">
                      {newPatientStatus}
                    </Text>
                    <Feather name="refresh-cw" size={14} color="#1B4332" />
                  </TouchableOpacity>
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
    </View>
  );
}
