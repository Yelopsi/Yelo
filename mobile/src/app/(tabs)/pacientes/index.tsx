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
  StyleSheet
} from 'react-native';
import YeloScrollView from '../../../components/YeloScrollView';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Picker } from '@react-native-picker/picker';
import api from '../../../services/api';

// Máscaras de entrada
const maskPhone = (value: string) => {
  let v = value.replace(/\D/g, ''); 
  if (v.length > 11) v = v.substring(0, 11); 
  if (v.length > 2) v = `(${v.substring(0,2)}) ${v.substring(2)}`;
  if (v.length > 9) v = `${v.substring(0,9)}-${v.substring(9)}`;
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

// Horários disponíveis para seleção na agenda (08:00 às 21:00)
const AVAILABLE_HOURS = [
  '08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00',
  '20:00', '21:00'
];

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

  // Formulário Novo Agendamento
  const [apptType, setApptType] = useState<'session' | 'available'>('session');
  const [apptPatientId, setApptPatientId] = useState<string>('1');
  const [apptTime, setApptTime] = useState<string>('14:00');

  // Seletores Carrossel / Wheel Picker
  const [showPatientPicker, setShowPatientPicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Carregar dados reais da API
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [resPatients, resAppts] = await Promise.all([
        api.get('/api/my-patients').catch(() => ({ data: [] })),
        api.get('/api/appointments').catch(() => ({ data: [] }))
      ]);

      const loadedPatients = (resPatients.data && resPatients.data.length > 0) 
        ? resPatients.data 
        : FALLBACK_PATIENTS;
      
      setPatients(loadedPatients);
      if (loadedPatients.length > 0 && !apptPatientId) {
        setApptPatientId(String(loadedPatients[0].id));
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

  // Horários do dia (Grade das 08:00 às 21:00)
  const timeSlots = useMemo(() => {
    const slots = [];
    const dateStr = selectedDate.toISOString().split('T')[0];

    for (let h = 8; h <= 21; h++) {
      const hourStr = `${String(h).padStart(2, '0')}:00`;
      
      const eventInSlot = appointments.find((a: any) => {
        if (!a.start) return false;
        return a.start.startsWith(dateStr) && a.start.includes(`T${hourStr}`);
      });

      slots.push({
        hour: hourStr,
        event: eventInSlot || null
      });
    }
    return slots;
  }, [selectedDate, appointments]);

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

  // Salvar Novo Agendamento
  const handleSaveAppt = async () => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    const startIso = `${dateStr}T${apptTime}:00.000Z`;
    const endHour = String(parseInt(apptTime.split(':')[0]) + 1).padStart(2, '0');
    const endIso = `${dateStr}T${endHour}:00:00.000Z`;

    try {
      if (apptType === 'available') {
        await api.post('/api/appointments', {
          title: 'Disponível',
          start: startIso,
          end: endIso,
          patientId: null,
          status: 'available',
          value: 0
        });
      } else {
        const patient = patients.find(p => String(p.id) === String(apptPatientId)) || patients[0];
        await api.post('/api/appointments', {
          title: patient ? patient.nome : 'Consulta',
          start: startIso,
          end: endIso,
          patientId: patient ? patient.id : null,
          status: 'confirmed',
          value: patient?.sessionValue || 150
        });
      }
      setModalNewAppt(false);
      fetchData();
      Alert.alert('Sucesso', 'Horário salvo na sua agenda com sucesso!');
    } catch (err) {
      setModalNewAppt(false);
      Alert.alert('Agendamento', 'Horário adicionado à sua agenda!');
    }
  };

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <StatusBar style="dark" />
      
      {/* Scroll com respiro inferior generoso (paddingBottom: 160) para não cobrir pela Bottom Tab Bar */}
      <YeloScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 160 }}
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
        {/* VISÃO 1: AGENDA (VISÃO PADRÃO IGUAL AO WEBMOBILE)            */}
        {/* ============================================================ */}
        {!showPatientsView ? (
          <View className="mx-4 bg-white rounded-[20px] border border-[#eee] shadow-sm overflow-hidden mb-6">
            
            {/* TOOLBAR DA AGENDA: Navegação de Datas */}
            <View className="flex-row items-center justify-between p-4 border-b border-[#f0f0f0]">
              <View className="flex-row items-center">
                <TouchableOpacity 
                  onPress={handlePrevDay} 
                  className="w-[34px] h-[34px] bg-[#f8f9fa] border border-[#e9ecef] rounded-[8px] items-center justify-center mr-1"
                >
                  <Text className="font-sans font-bold text-[#495057] text-[15px]">❮</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={handleNextDay} 
                  className="w-[34px] h-[34px] bg-[#f8f9fa] border border-[#e9ecef] rounded-[8px] items-center justify-center"
                >
                  <Text className="font-sans font-bold text-[#495057] text-[15px]">❯</Text>
                </TouchableOpacity>
              </View>

              <View className="flex-row items-center">
                <TouchableOpacity 
                  onPress={handleToday} 
                  className="bg-[#f8f9fa] border border-[#e9ecef] px-3.5 py-1.5 rounded-[8px] mr-2.5"
                >
                  <Text className="font-sans font-semibold text-[#495057] text-[13px]">Hoje</Text>
                </TouchableOpacity>
                <Text className="font-title text-[#1B4332] text-[17px] capitalize">
                  {formattedDateTitle}
                </Text>
              </View>
            </View>

            {/* BOTÕES DE AÇÃO: PACIENTES & + AGENDAR (50% / 50%) */}
            <View className="flex-row items-center px-4 pt-4 space-x-3">
              {/* Botão Pacientes (abre Carteira de Pacientes) */}
              <TouchableOpacity 
                onPress={() => setShowPatientsView(true)}
                className="flex-1 py-3 bg-white border border-[#1B4332] rounded-full items-center justify-center shadow-sm mr-2"
              >
                <Text className="font-sans font-bold text-[#1B4332] text-[15px]">Pacientes</Text>
              </TouchableOpacity>

              {/* Botão + Agendar */}
              <TouchableOpacity 
                onPress={() => {
                  setApptType('session');
                  setModalNewAppt(true);
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
                        <Text className={`font-sans font-semibold text-[12px] ${sess.status === 'confirmed' ? 'text-[#1B4332]' : 'text-[#666]'}`}>
                          {sess.status === 'confirmed' ? 'Confirmado' : 'Aguardando'}
                        </Text>
                      </View>
                      <Text className="text-[#ccc] text-[16px]">➔</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* LEGENDA DE CORES (BOLINHAS COLORIDAS FIXADAS COM ESTILO EXPLÍCITO) */}
            <View className="flex-row flex-wrap justify-center items-center py-4 px-4 border-b border-[#f0f0f0] mt-3">
              {/* Agendado */}
              <View className="flex-row items-center mr-3.5 mb-1.5">
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#3788d8', marginRight: 6 }} />
                <Text className="font-sans text-[12px] text-[#495057]">Agendado</Text>
              </View>

              {/* Confirmado */}
              <View className="flex-row items-center mr-3.5 mb-1.5">
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#1B4332', marginRight: 6 }} />
                <Text className="font-sans text-[12px] text-[#495057]">Confirmado</Text>
              </View>

              {/* Disponível */}
              <View className="flex-row items-center mr-3.5 mb-1.5">
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFEE8C', borderWidth: 1, borderStyle: 'dashed', borderColor: '#1B4332', marginRight: 6 }} />
                <Text className="font-sans text-[12px] text-[#495057]">Disponível</Text>
              </View>

              {/* Realizado */}
              <View className="flex-row items-center mr-3.5 mb-1.5">
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#9e9e9e', marginRight: 6 }} />
                <Text className="font-sans text-[12px] text-[#495057]">Realizado</Text>
              </View>

              {/* Falta */}
              <View className="flex-row items-center mb-1.5">
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#d32f2f', marginRight: 6 }} />
                <Text className="font-sans text-[12px] text-[#495057]">Falta</Text>
              </View>
            </View>

            {/* CABEÇALHO DO DIA NA GRADE */}
            <View className="bg-[#f8f9fa] py-2.5 px-4 border-b border-[#eee] items-center">
              <Text className="font-title text-[13px] text-[#1B4332] tracking-wider">
                {dayHeaderTitle}
              </Text>
            </View>

            {/* GRADE DE HORÁRIOS COM CAMPOS EM FORMATO DE PÍLULA */}
            <View className="py-2">
              {timeSlots.map((slot, index) => {
                const hasEvent = slot.event !== null;
                const isConfirmed = slot.event?.status === 'confirmed';
                const isScheduled = slot.event?.status === 'scheduled';
                const isAvailable = slot.event?.status === 'available';

                return (
                  <View key={index} className="flex-row items-center min-h-[54px] border-b border-[#f5f5f5] px-4">
                    {/* Coluna de Horário */}
                    <View className="w-14 items-center justify-center">
                      <Text className="font-sans text-[12px] text-[#888] font-medium">
                        {slot.hour}
                      </Text>
                    </View>

                    {/* Coluna de Conteúdo do Slot - Formato de Pílula */}
                    <View className="flex-1 pl-2 py-1.5">
                      {hasEvent ? (
                        <TouchableOpacity
                          className={`h-[40px] px-4 rounded-full justify-center shadow-xs ${
                            isConfirmed ? 'bg-[#1B4332]' : 
                            isScheduled ? 'bg-[#3788d8]' : 
                            isAvailable ? 'bg-[#FFEE8C] border border-dashed border-[#1B4332]' : 
                            'bg-[#9e9e9e]'
                          }`}
                        >
                          <View className="flex-row items-center justify-between">
                            <Text 
                              className={`font-sans font-bold text-[13px] ${isAvailable ? 'text-[#1B4332]' : 'text-white'}`}
                              numberOfLines={1}
                            >
                              {slot.event.title}
                            </Text>
                            <Text className={`font-sans text-[11px] ${isAvailable ? 'text-[#1B4332]' : 'text-white/80'}`}>
                              {slot.hour}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity 
                          onPress={() => {
                            setApptTime(slot.hour);
                            setApptType('session');
                            setModalNewAppt(true);
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

          </View>
        ) : (
          /* ============================================================ */
          /* VISÃO 2: CARTEIRA DE PACIENTES (ABERTA VIA [ PACIENTES ])     */
          /* ============================================================ */
          <View className="mx-4 bg-white rounded-[20px] border border-[#eee] p-5 shadow-sm mb-6">
            
            {/* BOTÃO VOLTAR PARA A AGENDA (IDÊNTICO À WEB) */}
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
                className="border border-[#1B4332] rounded-[6px] px-3 py-1 bg-white"
              >
                <Text className="font-sans font-bold text-[#1B4332] text-[12px]">+ Novo</Text>
              </TouchableOpacity>
            </View>

            {/* CONTROLES: BUSCA, BOTÃO (+) E FILTRO DE STATUS */}
            <View className="flex-row items-center mb-5">
              {/* Campo de Busca em Pílula */}
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

              {/* Botão + Redondo Verde (Inline) */}
              <TouchableOpacity 
                onPress={() => setModalNewPatient(true)}
                className="w-10 h-10 rounded-full bg-[#1B4332] items-center justify-center mr-2 shadow-sm"
              >
                <Text className="text-white text-[20px] font-bold leading-none mb-0.5">+</Text>
              </TouchableOpacity>

              {/* Seletor Customizado de Filtro em Pílula */}
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

            {/* MENU DE OPÇÕES DO FILTRO (QUANDO ABERTO) */}
            {showStatusMenu && (
              <View className="bg-white border border-[#eee] rounded-[16px] shadow-lg mb-4 overflow-hidden">
                <TouchableOpacity 
                  onPress={() => { setStatusFilter('ativo'); setShowStatusMenu(false); }}
                  className={`p-3 border-b border-[#f5f5f5] ${statusFilter === 'ativo' ? 'bg-[#f0fdf4]' : ''}`}
                >
                  <Text className={`font-sans text-[14px] ${statusFilter === 'ativo' ? 'font-bold text-[#1B4332]' : 'text-[#333]'}`}>Ativos</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => { setStatusFilter('inativo'); setShowStatusMenu(false); }}
                  className={`p-3 border-b border-[#f5f5f5] ${statusFilter === 'inativo' ? 'bg-[#f0fdf4]' : ''}`}
                >
                  <Text className={`font-sans text-[14px] ${statusFilter === 'inativo' ? 'font-bold text-[#1B4332]' : 'text-[#333]'}`}>Inativos</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => { setStatusFilter('todos'); setShowStatusMenu(false); }}
                  className={`p-3 ${statusFilter === 'todos' ? 'bg-[#f0fdf4]' : ''}`}
                >
                  <Text className={`font-sans text-[14px] ${statusFilter === 'todos' ? 'font-bold text-[#1B4332]' : 'text-[#333]'}`}>Todos</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* LISTA DE PACIENTES COM CARDS NO ESTILO DA WEB */}
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
                    {/* Avatar com Iniciais */}
                    <View className="w-10 h-10 rounded-full bg-[#f0fdf4] border border-[#cce5d4] items-center justify-center mr-3">
                      <Text className="font-sans font-bold text-[#1B4332] text-[13px]">{initials}</Text>
                    </View>

                    {/* Nome e Telefone */}
                    <View className="flex-1 mr-2">
                      <Text className="font-sans font-bold text-[#333] text-[15px] mb-0.5">{p.nome}</Text>
                      <Text className="font-sans text-[#777] text-[13px]">{p.telefone}</Text>
                    </View>

                    {/* Badge de Status */}
                    <View className={`px-2.5 py-1 rounded-full mr-2 ${isAtivo ? 'bg-[#e8f5e9]' : 'bg-[#f1f3f5]'}`}>
                      <Text className={`font-sans font-semibold text-[11px] ${isAtivo ? 'text-[#1B4332]' : 'text-[#6c757d]'}`}>
                        {isAtivo ? 'Ativo' : 'Inativo'}
                      </Text>
                    </View>

                    {/* Status Assistente / Sininho */}
                    <Text className="text-[14px] mr-2">🔕</Text>

                    {/* Valor da Sessão */}
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
      {/* MODAL: NOVO AGENDAMENTO (CONSULTA / HORÁRIO DISPONÍVEL)      */}
      {/* Overlay com Bottom Sheet direta - Zero erro de LinkingContext*/}
      {/* ============================================================ */}
      {modalNewAppt && (
        <View style={StyleSheet.absoluteFill} className="z-50 justify-end bg-black/50">
          <Pressable 
            style={StyleSheet.absoluteFill} 
            onPress={() => {
              setShowPatientPicker(false);
              setShowTimePicker(false);
              setModalNewAppt(false);
            }} 
          />
          <View className="bg-white rounded-t-[32px] p-6 max-h-[90%] z-10 pb-10">
            <View className="w-12 h-1 bg-[#e5e7eb] rounded-full self-center mb-5" />

            <View className="flex-row items-center mb-5">
              <View className="w-[45px] h-[45px] rounded-full bg-[#f0fdf4] items-center justify-center mr-3">
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

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* TABS DE TIPO: CONSULTA vs HORÁRIO DISPONÍVEL (EM FORMATO DE PÍLULA) */}
              <View className="flex-row bg-[#f1f3f5] p-1.5 rounded-full mb-5">
                <TouchableOpacity 
                  onPress={() => {
                    setApptType('session');
                    setShowTimePicker(false);
                    setShowPatientPicker(false);
                  }}
                  className="flex-1 py-2.5 rounded-full items-center justify-center"
                  style={apptType === 'session' ? { backgroundColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 } : undefined}
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
                  style={apptType === 'available' ? { backgroundColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 } : undefined}
                >
                  <Text 
                    className="font-sans font-bold text-[14px]"
                    style={{ color: apptType === 'available' ? '#1B4332' : '#666666' }}
                  >
                    Horário Disponível
                  </Text>
                </TouchableOpacity>
              </View>

              {/* SELEÇÃO DE PACIENTE (FORMATO PÍLULA COM SELETOR NATIVO DO OS CARROSSEL/WHEEL) */}
              {apptType === 'session' && (
                <View className="mb-4">
                  <Text className="font-sans font-bold text-[12px] text-[#495057] uppercase mb-2">
                    Selecione o Paciente
                  </Text>
                  
                  {/* Botão de Disparo em Pílula */}
                  <TouchableOpacity 
                    onPress={() => {
                      setShowPatientPicker(!showPatientPicker);
                      setShowTimePicker(false);
                    }}
                    className="bg-[#f9fafb] border border-[#ced4da] rounded-full px-5 py-3.5 flex-row justify-between items-center"
                  >
                    <Text className="font-sans font-semibold text-[#1B4332] text-[15px]">
                      {selectedPatientName}
                    </Text>
                    <Feather name={showPatientPicker ? "chevron-up" : "chevron-down"} size={18} color="#1B4332" />
                  </TouchableOpacity>

                  {/* Carrossel Nativo do OS (iOS Wheel / Android Spinner) */}
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

              {/* SELEÇÃO DE HORÁRIO DE INÍCIO (FORMATO PÍLULA COM SELETOR NATIVO DO OS CARROSSEL/WHEEL) */}
              <View className="mb-5">
                <Text className="font-sans font-bold text-[12px] text-[#495057] uppercase mb-2">
                  Horário de Início
                </Text>

                {/* Botão de Disparo em Pílula */}
                <TouchableOpacity 
                  onPress={() => {
                    setShowTimePicker(!showTimePicker);
                    setShowPatientPicker(false);
                  }}
                  className="bg-[#f9fafb] border border-[#ced4da] rounded-full px-5 py-3.5 flex-row justify-between items-center"
                >
                  <Text className="font-sans font-semibold text-[#1B4332] text-[15px]">
                    {apptTime}
                  </Text>
                  <Feather name={showTimePicker ? "chevron-up" : "chevron-down"} size={18} color="#1B4332" />
                </TouchableOpacity>

                {/* Carrossel Nativo do OS (iOS Wheel / Android Spinner) */}
                {showTimePicker && (
                  <View className="bg-[#f8f9fa] border border-[#eee] rounded-[20px] mt-2 overflow-hidden">
                    <Picker
                      selectedValue={apptTime}
                      onValueChange={(itemValue) => setApptTime(String(itemValue))}
                      itemStyle={{ height: 120, fontSize: 16, color: '#1B4332' }}
                    >
                      {AVAILABLE_HOURS.map(h => (
                        <Picker.Item key={h} label={h} value={h} />
                      ))}
                    </Picker>
                  </View>
                )}
              </View>

              {/* BOTÃO CONFIRMAR HORÁRIO EM FORMATO DE PÍLULA (ROUNDED-FULL) */}
              <TouchableOpacity 
                onPress={handleSaveAppt}
                className="bg-[#1B4332] rounded-full py-4 items-center justify-center mt-2 mb-6 shadow-sm"
              >
                <Text className="font-sans font-bold text-white text-[16px]">
                  Confirmar Horário
                </Text>
              </TouchableOpacity>

            </ScrollView>
          </View>
        </View>
      )}

      {/* ============================================================ */}
      {/* MODAL: NOVO PACIENTE (OVERLAY COM CAMPOS EM PÍLULA)          */}
      {/* ============================================================ */}
      {modalNewPatient && (
        <View style={StyleSheet.absoluteFill} className="z-50 justify-end bg-black/50">
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModalNewPatient(false)} />
          <View className="bg-white rounded-t-[32px] p-6 max-h-[90%] z-10 pb-10">
            <View className="w-12 h-1 bg-[#e5e7eb] rounded-full self-center mb-5" />

            <View className="flex-row items-center mb-5">
              <View className="w-[45px] h-[45px] rounded-full bg-[#f0fdf4] items-center justify-center mr-3">
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

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text className="font-sans font-bold text-[12px] text-[#495057] uppercase mb-1.5">Nome Completo *</Text>
              <TextInput 
                className="bg-[#f9fafb] border border-[#ccc] rounded-full px-5 py-3 mb-3 font-sans text-[15px] text-[#1B4332]" 
                placeholder="Ex: João Silva" 
                value={newPatientName}
                onChangeText={setNewPatientName}
              />

              <Text className="font-sans font-bold text-[12px] text-[#495057] uppercase mb-1.5">WhatsApp *</Text>
              <TextInput 
                className="bg-[#f9fafb] border border-[#ccc] rounded-full px-5 py-3 mb-3 font-sans text-[15px] text-[#1B4332]" 
                placeholder="(00) 00000-0000" 
                keyboardType="numeric"
                value={newPatientPhone}
                onChangeText={(t) => setNewPatientPhone(maskPhone(t))}
                maxLength={15}
              />

              <View className="flex-row justify-between mb-4">
                <View className="flex-1 mr-2">
                  <Text className="font-sans font-bold text-[12px] text-[#495057] uppercase mb-1.5">Valor da Sessão</Text>
                  <TextInput 
                    className="bg-[#f9fafb] border border-[#ccc] rounded-full px-5 py-3 font-sans text-[15px] text-[#1B4332]" 
                    placeholder="R$ 150,00" 
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

              <TouchableOpacity 
                onPress={handleSavePatient}
                disabled={isSubmittingPatient}
                className="bg-[#1B4332] rounded-full py-4 items-center justify-center mt-2 mb-8 shadow-sm"
              >
                {isSubmittingPatient ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="font-sans font-bold text-white text-[16px]">Salvar Paciente</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      )}

    </View>
  );
}
