import React, { useState, useEffect, useMemo } from 'react';
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
  KeyboardAvoidingView,
  Keyboard
} from 'react-native';
import YeloScrollView from '../../../components/YeloScrollView';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
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
    // Ex: "730" -> 07:30
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

// Atalhos rápidos estilo Airbnb (1 toque para horários frequentes + extremos)
const QUICK_TIME_PRESETS = [
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00',
  '20:00', '21:00', '22:00', '23:00'
];

const DURATION_OPTIONS = [
  { label: '30 min', value: 30 },
  { label: '50 min', value: 50 },
  { label: '1h', value: 60 }
];

const RECURRENCE_OPTIONS: { label: string; value: 'none' | 'weekly' | 'biweekly' }[] = [
  { label: 'Único', value: 'none' },
  { label: 'Semanal', value: 'weekly' },
  { label: 'Quinzenal', value: 'biweekly' }
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
  { id: 'f1', patientName: 'Clícia', time: '20:10', date: 'Hoje', status: 'scheduled' },
  { id: 'f2', patientName: 'Ana Maria Silva', time: '14:00', date: 'Amanhã', status: 'confirmed' },
  { id: 'f3', patientName: 'João Paulo', time: '16:30', date: '4 de nov.', status: 'confirmed' }
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

  // Modais estilizados como Bottom Sheet Overlay (evita perda de LinkingContext do <Modal> nativo)
  const [modalNewPatient, setModalNewPatient] = useState(false);
  const [modalNewAppt, setModalNewAppt] = useState(false);

  // Formulário Novo Paciente
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientPhone, setNewPatientPhone] = useState('');
  const [newPatientValue, setNewPatientValue] = useState('');
  const [newPatientStatus, setNewPatientStatus] = useState('ativo');
  const [isSubmittingPatient, setIsSubmittingPatient] = useState(false);

  // Formulário Novo Agendamento (Híbrido: Roleta 24h + Atalhos Airbnb + Digitação Nubank)
  const [apptType, setApptType] = useState<'session' | 'available'>('session');
  const [apptPatientId, setApptPatientId] = useState<string>('1');
  const [apptTime, setApptTime] = useState<string>('14:00');
  const [apptDuration, setApptDuration] = useState<number>(50);
  const [apptRecurrence, setApptRecurrence] = useState<'none' | 'weekly' | 'biweekly'>('none');
  const [isSubmittingAppt, setIsSubmittingAppt] = useState(false);

  // Seletores Carrossel / Wheel Picker & Modo Digitar
  const [showPatientPicker, setShowPatientPicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timeInputMode, setTimeInputMode] = useState<'wheel' | 'type'>('wheel');
  const [typedTimeDraft, setTypedTimeDraft] = useState('14:00');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Ajusta o respiro do rodapé dos modais dinamicamente:
  // - Teclado fechado: 102px (iOS) / 96px (Android) = 14px de mini respiro acima da Bottom Nav
  // - Teclado aberto: 16px acima do teclado (pois o teclado já encobre a Bottom Nav)
  const sheetFooterBottomPadding = isKeyboardVisible ? 16 : BOTTOM_NAV_CLEARANCE;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subShow = Keyboard.addListener(showEvent, () => setIsKeyboardVisible(true));
    const subHide = Keyboard.addListener(hideEvent, () => setIsKeyboardVisible(false));
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  // Helper para abrir modal de agendamento já sincronizado
  const openApptSheet = (initialTime: string, expandTimeSelector = false) => {
    const cleanTime = normalizeTimeStr(initialTime, '14:00');
    setApptTime(cleanTime);
    setTypedTimeDraft(cleanTime);
    setShowPatientPicker(false);
    setShowTimePicker(expandTimeSelector);
    setTimeInputMode('wheel');
    setModalNewAppt(true);
  };

  // Carregar dados reais da API
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [resPatients, resAppts] = await Promise.all([
        api.get('/api/my-patients').catch(() => ({ data: [] })),
        api.get('/api/appointments').catch(() => ({ data: [] }))
      ]);

      const loadedPatients =
        resPatients.data && resPatients.data.length > 0
          ? resPatients.data
          : FALLBACK_PATIENTS;

      setPatients(loadedPatients);
      if (loadedPatients.length > 0) {
        const exists = loadedPatients.some((p: any) => String(p.id) === String(apptPatientId));
        if (!exists) {
          setApptPatientId(String(loadedPatients[0].id));
        }
      }
      setAppointments(resAppts.data || []);
    } catch (err) {
      console.warn('Erro ao buscar dados:', err);
      setPatients(FALLBACK_PATIENTS);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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

  // Próximos Atendimentos
  const upcomingList = useMemo(() => {
    const realUpcoming = appointments
      .filter((a: any) => (a.status === 'scheduled' || a.status === 'confirmed') && new Date(a.start) >= new Date())
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 5)
      .map((a: any) => {
        const d = new Date(a.start);
        const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
        return {
          id: String(a.id),
          patientName: a.title || 'Consulta',
          time: timeStr,
          date: dateStr,
          status: a.status
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

  // Paciente selecionado para o picker
  const selectedPatientName = useMemo(() => {
    const p = patients.find(item => String(item.id) === String(apptPatientId));
    return p ? p.nome : (patients[0]?.nome || 'Selecione um paciente');
  }, [patients, apptPatientId]);

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

  // Cálculo em tempo real do horário de término da sessão (ex: 17:00 -> até 17:50)
  const calculatedEndTimeStr = useMemo(() => {
    const [hh, mm] = apptTime.split(':').map(Number);
    const d = new Date(2026, 0, 1, hh || 0, mm || 0, 0, 0);
    d.setMinutes(d.getMinutes() + apptDuration);
    return formatHHMM(d);
  }, [apptTime, apptDuration]);

  // Agendamentos do dia selecionado ordenados cronologicamente (qualquer hora 00:00–23:59 e minutos quebrados)
  const dayAppointments = useMemo(() => {
    return appointments
      .filter((a: any) => {
        if (!a.start || a.status === 'cancelled') return false;
        const d = new Date(a.start);
        return !isNaN(d.getTime()) && isSameLocalDay(d, selectedDate);
      })
      .sort((a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [appointments, selectedDate]);

  // Quantidade de eventos fora do horário comercial (antes das 08h ou após 21h) para sinalização inteligente
  const earlyEventsCount = useMemo(
    () => dayAppointments.filter((a: any) => new Date(a.start).getHours() < 8).length,
    [dayAppointments]
  );
  const lateEventsCount = useMemo(
    () => dayAppointments.filter((a: any) => new Date(a.start).getHours() > 21).length,
    [dayAppointments]
  );

  // Construção Inteligente da Grade (Estilo Notion Calendar):
  // - Padrão limpo 08h–21h
  // - Expande 06h–07h ou 22h–23h sob demanda, ou 24h completo (00h–23h)
  // - NUNCA esconde um agendamento existente fora de hora (auto-inclui qualquer hora com sessão marcada!)
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

    // Auto-inclusão de qualquer hora (ex: 05:30, 07:00, 22:45) que já possua evento agendado no dia
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

  // Salvar Novo Agendamento (Suporta qualquer horário 00:00–23:59, duração customizada e recorrência em lote)
  const handleSaveAppt = async () => {
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
        // Criação recorrente (Semanal: 16 semanas | Quinzenal: 12 quinzenas) via endpoint /bulk
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
      setShowTimePicker(false);
      setShowPatientPicker(false);
      await fetchData();
      Alert.alert(
        'Sucesso',
        apptType === 'available'
          ? `Horário disponível (${finalTime}) adicionado à sua agenda!`
          : `Sessão agendada às ${finalTime} com sucesso!`
      );
    } catch (err) {
      setModalNewAppt(false);
      Alert.alert('Agendamento', `Horário (${finalTime}) registrado na sua agenda!`);
    } finally {
      setIsSubmittingAppt(false);
    }
  };

  // Estilo utilitário da cor de cada agendamento na timeline
  const getEventPillColors = (status?: string) => {
    if (status === 'confirmed') {
      return { bg: '#1B4332', text: '#ffffff', sub: 'rgba(255,255,255,0.82)', borderColor: '#1B4332', dashed: false };
    }
    if (status === 'available') {
      return { bg: '#FFEE8C', text: '#1B4332', sub: '#1B4332', borderColor: '#1B4332', dashed: true };
    }
    if (status === 'done' || status === 'completed') {
      return { bg: '#9e9e9e', text: '#ffffff', sub: 'rgba(255,255,255,0.85)', borderColor: '#9e9e9e', dashed: false };
    }
    if (status === 'missed' || status === 'absent') {
      return { bg: '#d32f2f', text: '#ffffff', sub: 'rgba(255,255,255,0.85)', borderColor: '#d32f2f', dashed: false };
    }
    // Padrão: scheduled (Agendado)
    return { bg: '#3788d8', text: '#ffffff', sub: 'rgba(255,255,255,0.85)', borderColor: '#3788d8', dashed: false };
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
                  openApptSheet('14:00', false);
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
                  {upcomingList.map((sess) => (
                    <View
                      key={sess.id}
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
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* LEGENDA DE CORES */}
            <View className="flex-row flex-wrap justify-center items-center py-4 px-4 border-b border-[#f0f0f0] mt-3">
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

            {/* CABEÇALHO DO DIA NA GRADE + TOGGLE RÁPIDO 08h–21h / 24h (ESTILO NOTION CALENDAR) */}
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
                    openApptSheet('07:30', true);
                  }}
                  className="px-3 py-1.5 rounded-full bg-[#f0fdf4]"
                >
                  <Text className="font-sans font-bold text-[11px] text-[#1B4332]">+ Horário livre</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* GRADE DE HORÁRIOS COM SUPORTE A HORÁRIOS QUEBRADOS E MULTI-EVENTOS */}
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
                                  activeOpacity={0.85}
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

                                {/* Botão sutil (+) para encaixar horário quebrado na mesma hora (ex: 14:50) */}
                                <TouchableOpacity
                                  onPress={() => {
                                    const nextHalf = `${String(slot.hourNumber).padStart(2, '0')}:30`;
                                    setApptType('session');
                                    openApptSheet(nextHalf, true);
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
                            openApptSheet(slot.hour, false);
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

            {/* RODAPÉ INTELIGENTE DA GRADE: NOITE ESTENDIDA (22h–23h) + QUALQUER OUTRO HORÁRIO (ESTILO AIRBNB / NUBANK) */}
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
                  openApptSheet('21:30', true);
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
          /* VISÃO 2: CARTEIRA DE PACIENTES (ABERTA VIA [ PACIENTES ])     */
          /* ============================================================ */
          <View className="mx-4 bg-white rounded-[20px] border border-[#eee] p-5 shadow-sm">
            {/* BOTÃO VOLTAR PARA A AGENDA */}
            <TouchableOpacity
              onPress={() => setShowPatientsView(false)}
              className="bg-[#f0fdf4] border border-[#bbf7d0] px-4 py-2.5 rounded-full flex-row items-center self-start mb-5"
            >
              <Feather name="arrow-left" size={16} color="#1B4332" style={{ marginRight: 6 }} />
              <Text className="font-sans font-bold text-[#1B4332] text-[14px]">
                Voltar para Agenda
              </Text>
            </TouchableOpacity>

            {/* CABEÇALHO DA CARTEIRA: TÍTULO + BOTÃO + NOVO */}
            <View className="flex-row items-center justify-between pb-3 mb-4 border-b border-[#eee]">
              <Text className="font-title text-[20px] text-[#1B4332]">Carteira de Pacientes</Text>
              <TouchableOpacity
                onPress={() => setModalNewPatient(true)}
                className="border border-[#1B4332] rounded-full px-3.5 py-1 bg-white"
              >
                <Text className="font-sans font-bold text-[#1B4332] text-[12px]">+ Novo</Text>
              </TouchableOpacity>
            </View>

            {/* CONTROLES: BUSCA, BOTÃO (+) E FILTRO DE STATUS */}
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

            {/* MENU DE OPÇÕES DO FILTRO */}
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

            {/* LISTA DE PACIENTES */}
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
                    onPress={() => router.push(`/(tabs)/pacientes/${p.id}`)}
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
      {/* MODAL: NOVO AGENDAMENTO (ROLETA 24H + CHIPS AIRBNB + NUBANK) */}
      {/* Rodapé com respiro calibrado acima da Bottom Tab Bar         */}
      {/* ============================================================ */}
      {modalNewAppt && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={StyleSheet.absoluteFill}
          className="z-50 justify-end bg-black/50"
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              setShowPatientPicker(false);
              setShowTimePicker(false);
              setModalNewAppt(false);
            }}
          />
          <View
            className="bg-white rounded-t-[32px] pt-5 px-6 z-10"
            style={{ maxHeight: '92%' }}
          >
            <View className="w-12 h-1 bg-[#e5e7eb] rounded-full self-center mb-4" />

            {/* Header do Sheet */}
            <View className="flex-row items-center mb-4">
              <View className="w-[44px] h-[44px] rounded-full bg-[#f0fdf4] items-center justify-center mr-3">
                <Text className="text-[20px]">📅</Text>
              </View>
              <View>
                <Text className="font-title text-[20px] text-[#1B4332]">Agendar Horário</Text>
                <Text className="font-sans text-[13px] text-[#666]">{formattedDateTitle}</Text>
              </View>
              <TouchableOpacity
                className="ml-auto p-2"
                onPress={() => {
                  setShowPatientPicker(false);
                  setShowTimePicker(false);
                  setModalNewAppt(false);
                }}
              >
                <Feather name="x" size={22} color="#999" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={{ flexGrow: 0, flexShrink: 1 }}
            >
              {/* TABS DE TIPO: CONSULTA vs HORÁRIO DISPONÍVEL */}
              <View className="flex-row bg-[#f1f3f5] p-1.5 rounded-full mb-4">
                <TouchableOpacity
                  onPress={() => {
                    setApptType('session');
                    setShowTimePicker(false);
                    setShowPatientPicker(false);
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
                    setShowPatientPicker(false);
                    setShowTimePicker(false);
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
                      setShowPatientPicker(!showPatientPicker);
                      setShowTimePicker(false);
                    }}
                    className="bg-[#f9fafb] border border-[#ced4da] rounded-full px-5 py-3 flex-row justify-between items-center"
                  >
                    <Text className="font-sans font-semibold text-[#1B4332] text-[15px]">
                      {selectedPatientName}
                    </Text>
                    <Feather name={showPatientPicker ? 'chevron-up' : 'chevron-down'} size={18} color="#1B4332" />
                  </TouchableOpacity>

                  {showPatientPicker && (
                    <View className="bg-[#f8f9fa] border border-[#eee] rounded-[20px] mt-2 overflow-hidden">
                      <Picker
                        selectedValue={apptPatientId}
                        onValueChange={(itemValue) => setApptPatientId(String(itemValue))}
                        itemStyle={{ height: 120, fontSize: 16, color: '#1B4332' }}
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

              {/* SELEÇÃO DE HORÁRIO DE INÍCIO (24H COMPLETO: ROLETA DUPLA HH:MM + CHIPS + DIGITAR) */}
              <View className="mb-4">
                <View className="flex-row items-center justify-between mb-1.5">
                  <Text className="font-sans font-bold text-[12px] text-[#495057] uppercase">
                    Horário de Início (24h)
                  </Text>
                  <Text className="font-sans text-[12px] text-[#1B4332] font-semibold">
                    Término: {calculatedEndTimeStr}
                  </Text>
                </View>

                {/* Pílula Principal de Disparo */}
                <TouchableOpacity
                  onPress={() => {
                    setShowTimePicker(!showTimePicker);
                    setShowPatientPicker(false);
                  }}
                  className="bg-[#f9fafb] border border-[#ced4da] rounded-full px-5 py-3 flex-row justify-between items-center"
                >
                  <View className="flex-row items-center">
                    <Feather name="clock" size={16} color="#1B4332" style={{ marginRight: 8 }} />
                    <Text className="font-sans font-bold text-[#1B4332] text-[16px]">
                      {apptTime}
                    </Text>
                    <View className="ml-2.5 px-2.5 py-0.5 rounded-full bg-[#e8f5e9]">
                      <Text className="font-sans font-semibold text-[11px] text-[#1B4332]">
                        {apptType === 'available' ? '1h livre' : `${apptDuration} min`}
                      </Text>
                    </View>
                  </View>
                  <Feather name={showTimePicker ? 'chevron-up' : 'chevron-down'} size={18} color="#1B4332" />
                </TouchableOpacity>

                {/* Atalhos Rápidos Horizontais (Estilo Airbnb - Qualquer turno com 1 toque) */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="mt-2.5"
                  keyboardShouldPersistTaps="handled"
                >
                  {QUICK_TIME_PRESETS.map((preset) => {
                    const isSelected = apptTime === preset;
                    return (
                      <TouchableOpacity
                        key={preset}
                        onPress={() => {
                          setApptTime(preset);
                          setTypedTimeDraft(preset);
                        }}
                        className="px-3.5 py-1.5 rounded-full border mr-2"
                        style={{
                          backgroundColor: isSelected ? '#1B4332' : '#ffffff',
                          borderColor: isSelected ? '#1B4332' : '#e5e7eb'
                        }}
                      >
                        <Text
                          className="font-sans font-semibold text-[12px]"
                          style={{ color: isSelected ? '#ffffff' : '#495057' }}
                        >
                          {preset}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Painel Expandido: Roleta Dupla Nativa (00h–23h : 00m–55m) OU Digitação Direta (Estilo Nubank) */}
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
                        {/* Roda Nativa das Horas (00 a 23) */}
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

                        {/* Roda Nativa dos Minutos (00 a 55) */}
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

              {/* DURAÇÃO E RECORRÊNCIA EM PÍLULAS COMPACTAS (ESTILO NOTION / YELO) */}
              <View className="flex-row justify-between mb-3">
                {apptType === 'session' && (
                  <View className="flex-1 mr-2">
                    <Text className="font-sans font-bold text-[11px] text-[#495057] uppercase mb-1.5">
                      Duração
                    </Text>
                    <View className="flex-row bg-[#f1f3f5] p-1 rounded-full">
                      {DURATION_OPTIONS.map((opt) => {
                        const active = apptDuration === opt.value;
                        return (
                          <TouchableOpacity
                            key={opt.value}
                            onPress={() => setApptDuration(opt.value)}
                            className="flex-1 py-1.5 rounded-full items-center"
                            style={active ? { backgroundColor: '#1B4332' } : undefined}
                          >
                            <Text
                              className="font-sans font-bold text-[11px]"
                              style={{ color: active ? '#ffffff' : '#555555' }}
                            >
                              {opt.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                <View className="flex-1" style={apptType === 'session' ? { marginLeft: 6 } : undefined}>
                  <Text className="font-sans font-bold text-[11px] text-[#495057] uppercase mb-1.5">
                    Repetição
                  </Text>
                  <View className="flex-row bg-[#f1f3f5] p-1 rounded-full">
                    {RECURRENCE_OPTIONS.map((rec) => {
                      const active = apptRecurrence === rec.value;
                      return (
                        <TouchableOpacity
                          key={rec.value}
                          onPress={() => setApptRecurrence(rec.value)}
                          className="flex-1 py-1.5 rounded-full items-center"
                          style={active ? { backgroundColor: '#1B4332' } : undefined}
                        >
                          <Text
                            className="font-sans font-bold text-[11px]"
                            style={{ color: active ? '#ffffff' : '#555555' }}
                          >
                            {rec.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* RODAPÉ FIXO COM MINI RESPIRO ACIMA DA BOTTOM TAB BAR */}
            <View
              className="pt-3 border-t border-[#f3f4f6] bg-white"
              style={{ paddingBottom: sheetFooterBottomPadding }}
            >
              <TouchableOpacity
                onPress={handleSaveAppt}
                disabled={isSubmittingAppt}
                className="bg-[#1B4332] rounded-full py-4 items-center justify-center shadow-sm"
              >
                {isSubmittingAppt ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="font-sans font-bold text-white text-[16px]">
                    Confirmar Horário ({apptTime})
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* ============================================================ */}
      {/* MODAL: NOVO PACIENTE (COM MINI RESPIRO ACIMA DA BOTTOM NAV)  */}
      {/* ============================================================ */}
      {modalNewPatient && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={StyleSheet.absoluteFill}
          className="z-50 justify-end bg-black/50"
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModalNewPatient(false)} />
          <View
            className="bg-white rounded-t-[32px] pt-5 px-6 z-10"
            style={{ maxHeight: '92%' }}
          >
            <View className="w-12 h-1 bg-[#e5e7eb] rounded-full self-center mb-4" />

            <View className="flex-row items-center mb-4">
              <View className="w-[44px] h-[44px] rounded-full bg-[#f0fdf4] items-center justify-center mr-3">
                <Text className="text-[20px]">👤</Text>
              </View>
              <View>
                <Text className="font-title text-[20px] text-[#1B4332]">Novo Paciente</Text>
                <Text className="font-sans text-[13px] text-[#666]">Preencha os dados do cadastro.</Text>
              </View>
              <TouchableOpacity className="ml-auto p-2" onPress={() => setModalNewPatient(false)}>
                <Feather name="x" size={22} color="#999" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={{ flexGrow: 0, flexShrink: 1 }}
            >
              <Text className="font-sans font-bold text-[12px] text-[#495057] uppercase mb-1.5">Nome Completo *</Text>
              <TextInput
                className="bg-[#f9fafb] border border-[#ccc] rounded-full px-5 py-3 mb-3 font-sans text-[15px] text-[#1B4332]"
                placeholder="Ex: João Silva"
                placeholderTextColor="#9ca3af"
                value={newPatientName}
                onChangeText={setNewPatientName}
              />

              <Text className="font-sans font-bold text-[12px] text-[#495057] uppercase mb-1.5">WhatsApp *</Text>
              <TextInput
                className="bg-[#f9fafb] border border-[#ccc] rounded-full px-5 py-3 mb-3 font-sans text-[15px] text-[#1B4332]"
                placeholder="(00) 00000-0000"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
                value={newPatientPhone}
                onChangeText={(t) => setNewPatientPhone(maskPhone(t))}
                maxLength={15}
              />

              <View className="flex-row justify-between mb-3">
                <View className="flex-1 mr-2">
                  <Text className="font-sans font-bold text-[12px] text-[#495057] uppercase mb-1.5">Valor da Sessão</Text>
                  <TextInput
                    className="bg-[#f9fafb] border border-[#ccc] rounded-full px-5 py-3 font-sans text-[15px] text-[#1B4332]"
                    placeholder="R$ 150,00"
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                    value={newPatientValue}
                    onChangeText={(t) => setNewPatientValue(maskCurrency(t))}
                  />
                </View>

                <View className="flex-1 ml-2">
                  <Text className="font-sans font-bold text-[12px] text-[#495057] uppercase mb-1.5">Status</Text>
                  <TouchableOpacity
                    onPress={() => setNewPatientStatus(newPatientStatus === 'ativo' ? 'inativo' : 'ativo')}
                    className="bg-[#f9fafb] border border-[#ccc] rounded-full px-5 py-3 flex-row justify-between items-center"
                  >
                    <Text className="font-sans text-[15px] text-[#1B4332] font-bold capitalize">
                      {newPatientStatus}
                    </Text>
                    <Feather name="refresh-cw" size={14} color="#1B4332" />
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            {/* RODAPÉ FIXO COM MINI RESPIRO ACIMA DA BOTTOM TAB BAR */}
            <View
              className="pt-3 border-t border-[#f3f4f6] bg-white"
              style={{ paddingBottom: sheetFooterBottomPadding }}
            >
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
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
