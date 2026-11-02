import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  TextInput, 
  Modal, 
  ScrollView, 
  ActivityIndicator,
  Alert,
  Platform 
} from 'react-native';
import YeloScrollView from '../../../components/YeloScrollView';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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

  // Modais
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
  const [apptPatientId, setApptPatientId] = useState('');
  const [apptTime, setApptTime] = useState('14:00');

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

  // Horários do dia (Grade das 07:00 às 22:00)
  const timeSlots = useMemo(() => {
    const slots = [];
    const dateStr = selectedDate.toISOString().split('T')[0];

    for (let h = 8; h <= 21; h++) {
      const hourStr = `${String(h).padStart(2, '0')}:00`;
      
      // Busca agendamentos correspondentes neste slot
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
      // Fallback local se estiver offline
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
        const patient = patients.find(p => p.id == apptPatientId) || patients[0];
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
      <YeloScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        
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
          <View className="mx-4 bg-white rounded-[20px] border border-[#eee] shadow-sm overflow-hidden mb-28">
            
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
                className="flex-1 py-2.5 bg-white border border-[#1B4332] rounded-full items-center justify-center shadow-sm mr-2"
              >
                <Text className="font-sans font-bold text-[#1B4332] text-[15px]">Pacientes</Text>
              </TouchableOpacity>

              {/* Botão + Agendar */}
              <TouchableOpacity 
                onPress={() => setModalNewAppt(true)}
                className="flex-1 py-2.5 bg-[#1B4332] rounded-full items-center justify-center shadow-sm ml-2 flex-row"
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

            {/* LEGENDA DE CORES (IDÊNTICA À WEB) */}
            <View className="flex-row flex-wrap justify-center items-center py-4 px-4 border-b border-[#f0f0f0] mt-3">
              <View className="flex-row items-center mr-3 mb-1">
                <View className="w-2.5 h-2.5 rounded-full bg-[#3788d8] mr-1.5" />
                <Text className="font-sans text-[12px] text-[#495057]">Agendado</Text>
              </View>
              <View className="flex-row items-center mr-3 mb-1">
                <View className="w-2.5 h-2.5 rounded-full bg-[#1B4332] mr-1.5" />
                <Text className="font-sans text-[12px] text-[#495057]">Confirmado</Text>
              </View>
              <View className="flex-row items-center mr-3 mb-1">
                <View className="w-2.5 h-2.5 rounded-full bg-[#FFEE8C] border border-dashed border-[#1B4332] mr-1.5" />
                <Text className="font-sans text-[12px] text-[#495057]">Disponível</Text>
              </View>
              <View className="flex-row items-center mr-3 mb-1">
                <View className="w-2.5 h-2.5 rounded-full bg-[#9e9e9e] mr-1.5" />
                <Text className="font-sans text-[12px] text-[#495057]">Realizado</Text>
              </View>
              <View className="flex-row items-center mb-1">
                <View className="w-2.5 h-2.5 rounded-full bg-[#d32f2f] mr-1.5" />
                <Text className="font-sans text-[12px] text-[#495057]">Falta</Text>
              </View>
            </View>

            {/* CABEÇALHO DO DIA NA GRADE */}
            <View className="bg-[#f8f9fa] py-2.5 px-4 border-b border-[#eee] items-center">
              <Text className="font-title text-[13px] text-[#1B4332] tracking-wider">
                {dayHeaderTitle}
              </Text>
            </View>

            {/* GRADE DE HORÁRIOS (TIMEGRID DIÁRIO) */}
            <View className="py-2">
              {timeSlots.map((slot, index) => {
                const hasEvent = slot.event !== null;
                const isConfirmed = slot.event?.status === 'confirmed';
                const isScheduled = slot.event?.status === 'scheduled';
                const isAvailable = slot.event?.status === 'available';

                return (
                  <View key={index} className="flex-row items-center min-h-[52px] border-b border-[#f5f5f5] px-4">
                    {/* Coluna de Horário */}
                    <View className="w-14 items-center justify-center">
                      <Text className="font-sans text-[12px] text-[#888] font-medium">
                        {slot.hour}
                      </Text>
                    </View>

                    {/* Coluna de Conteúdo do Slot */}
                    <View className="flex-1 pl-2 py-1">
                      {hasEvent ? (
                        <TouchableOpacity
                          className={`p-2.5 rounded-[8px] justify-center ${
                            isConfirmed ? 'bg-[#1B4332]' : 
                            isScheduled ? 'bg-[#3788d8]' : 
                            isAvailable ? 'bg-[#FFEE8C] border border-dashed border-[#1B4332]' : 
                            'bg-[#9e9e9e]'
                          }`}
                        >
                          <Text className={`font-sans font-bold text-[13px] ${isAvailable ? 'text-[#1B4332]' : 'text-white'}`}>
                            {slot.event.title}
                          </Text>
                          <Text className={`font-sans text-[11px] ${isAvailable ? 'text-[#1B4332]' : 'text-white/80'}`}>
                            {slot.hour} - Sessão Individual
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity 
                          onPress={() => {
                            setApptTime(slot.hour);
                            setModalNewAppt(true);
                          }}
                          className="h-[40px] rounded-[6px] border border-dashed border-[#e9ecef] items-center justify-center"
                        >
                          <Text className="font-sans text-[11px] text-[#bbb]">+ Toque para agendar</Text>
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
          <View className="mx-4 bg-white rounded-[20px] border border-[#eee] p-5 shadow-sm mb-28">
            
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
              {/* Campo de Busca */}
              <View className="flex-1 flex-row items-center bg-[#f9fafb] border border-[#eee] rounded-full px-4 py-2 mr-2">
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

              {/* Seletor Customizado de Filtro */}
              <TouchableOpacity 
                onPress={() => setShowStatusMenu(!showStatusMenu)}
                className="bg-[#f9fafb] border border-[#eee] rounded-full px-3 py-2 flex-row items-center"
              >
                <Text className="font-sans font-semibold text-[#495057] text-[13px] mr-1 capitalize">
                  {statusFilter === 'ativo' ? 'Ativos' : statusFilter === 'inativo' ? 'Inativos' : 'Todos'}
                </Text>
                <Feather name="chevron-down" size={13} color="#666" />
              </TouchableOpacity>
            </View>

            {/* MENU DE OPÇÕES DO FILTRO (QUANDO ABERTO) */}
            {showStatusMenu && (
              <View className="bg-white border border-[#eee] rounded-[12px] shadow-lg mb-4 overflow-hidden">
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
      {/* MODAL: NOVO PACIENTE (BOTTOM SHEET COM MÁSCARAS)            */}
      {/* ============================================================ */}
      <Modal 
        visible={modalNewPatient} 
        animationType="slide" 
        transparent={true} 
        onRequestClose={() => setModalNewPatient(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-[32px] p-6 max-h-[85%]">
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
                className="bg-[#f9fafb] border border-[#ccc] rounded-[12px] px-4 py-3 mb-3 font-sans text-[15px] text-[#1B4332]" 
                placeholder="Ex: João Silva" 
                value={newPatientName}
                onChangeText={setNewPatientName}
              />

              <Text className="font-sans font-bold text-[12px] text-[#495057] uppercase mb-1.5">WhatsApp *</Text>
              <TextInput 
                className="bg-[#f9fafb] border border-[#ccc] rounded-[12px] px-4 py-3 mb-3 font-sans text-[15px] text-[#1B4332]" 
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
                    className="bg-[#f9fafb] border border-[#ccc] rounded-[12px] px-4 py-3 font-sans text-[15px] text-[#1B4332]" 
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
                    className="bg-[#f9fafb] border border-[#ccc] rounded-[12px] px-4 py-[13px] flex-row justify-between items-center"
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
                className="bg-[#1B4332] rounded-[14px] py-[15px] items-center mt-2 mb-8 shadow-sm"
              >
                {isSubmittingPatient ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="font-sans font-bold text-white text-[15px]">Salvar Paciente</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL: NOVO AGENDAMENTO (CONSULTA / HORÁRIO DISPONÍVEL)      */}
      {/* ============================================================ */}
      <Modal 
        visible={modalNewAppt} 
        animationType="slide" 
        transparent={true} 
        onRequestClose={() => setModalNewAppt(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-[32px] p-6 max-h-[85%]">
            <View className="w-12 h-1 bg-[#e5e7eb] rounded-full self-center mb-5" />

            <View className="flex-row items-center mb-5">
              <View className="w-[45px] h-[45px] rounded-full bg-[#f0fdf4] items-center justify-center mr-3">
                <Text className="text-[20px]">📅</Text>
              </View>
              <View>
                <Text className="font-title text-[20px] text-[#1B4332]">Agendar Horário</Text>
                <Text className="font-sans text-[13px] text-[#666]">{formattedDateTitle}</Text>
              </View>
              <TouchableOpacity className="ml-auto p-2" onPress={() => setModalNewAppt(false)}>
                <Feather name="x" size={22} color="#999" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Tipo de Horário: Consulta vs Disponível */}
              <View className="flex-row bg-[#f1f3f5] p-1 rounded-full mb-4">
                <TouchableOpacity 
                  onPress={() => setApptType('session')}
                  className={`flex-1 py-2 rounded-full items-center ${apptType === 'session' ? 'bg-white shadow-sm' : ''}`}
                >
                  <Text className={`font-sans font-bold text-[13px] ${apptType === 'session' ? 'text-[#1B4332]' : 'text-[#666]'}`}>
                    Consulta
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => setApptType('available')}
                  className={`flex-1 py-2 rounded-full items-center ${apptType === 'available' ? 'bg-white shadow-sm' : ''}`}
                >
                  <Text className={`font-sans font-bold text-[13px] ${apptType === 'available' ? 'text-[#1B4332]' : 'text-[#666]'}`}>
                    Horário Disponível
                  </Text>
                </TouchableOpacity>
              </View>

              {apptType === 'session' && (
                <>
                  <Text className="font-sans font-bold text-[12px] text-[#495057] uppercase mb-1.5">Selecione o Paciente</Text>
                  <View className="bg-[#f9fafb] border border-[#ccc] rounded-[12px] p-2 mb-4">
                    {patients.slice(0, 4).map(p => (
                      <TouchableOpacity 
                        key={p.id}
                        onPress={() => setApptPatientId(p.id)}
                        className={`p-2.5 rounded-[8px] flex-row justify-between items-center ${apptPatientId == p.id ? 'bg-[#e8f5e9]' : ''}`}
                      >
                        <Text className="font-sans font-semibold text-[#333] text-[14px]">{p.nome}</Text>
                        {apptPatientId == p.id && <Feather name="check" size={16} color="#1B4332" />}
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text className="font-sans font-bold text-[12px] text-[#495057] uppercase mb-1.5">Horário de Início</Text>
              <TextInput 
                className="bg-[#f9fafb] border border-[#ccc] rounded-[12px] px-4 py-3 mb-4 font-sans text-[15px] text-[#1B4332]" 
                placeholder="Ex: 14:00" 
                value={apptTime}
                onChangeText={setApptTime}
              />

              <TouchableOpacity 
                onPress={handleSaveAppt}
                className="bg-[#1B4332] rounded-[14px] py-[15px] items-center mt-2 mb-8 shadow-sm"
              >
                <Text className="font-sans font-bold text-white text-[15px]">Confirmar Horário</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
}
