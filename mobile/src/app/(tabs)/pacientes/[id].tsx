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
  Animated,
  Easing,
  Linking
} from 'react-native';
import YeloScrollView from '../../../components/YeloScrollView';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Picker } from '@react-native-picker/picker';
import api from '../../../services/api';

// ============================================================
// CALIBRAÇÃO EXATA COM A BOTTOM NAV FLUTUANTE
// Bottom Tab Bar: bottom 24 (iOS) / 20 (Android) + height 64 = 88px / 84px
// Mini respiro de 14px = 102px (iOS) / 96px (Android)
// ============================================================
const BOTTOM_NAV_CLEARANCE = Platform.OS === 'ios' ? 102 : 96;

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

const formatCurrencyFromNumber = (num: number | string | undefined) => {
  const parsed = Number(num) || 0;
  return parsed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatHHMM = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const MONTHS_SHORT_PT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

export default function PacienteDetailScreen() {
  const params = useLocalSearchParams<{
    id: string;
    nome?: string;
    telefone?: string;
    email?: string;
    status?: string;
    sessionValue?: string;
    observacoes?: string;
  }>();

  const patientId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [patient, setPatient] = useState<any>(() => ({
    id: patientId,
    nome: params.nome || '',
    telefone: params.telefone || '',
    email: params.email && !params.email.includes('@temp.com') ? params.email : '',
    status: params.status || 'ativo',
    sessionValue: Number(params.sessionValue) || 0,
    observacoes: params.observacoes || ''
  }));

  const [appointments, setAppointments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // Modal Editar Paciente
  const [modalEdit, setModalEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editStatus, setEditStatus] = useState<'ativo' | 'inativo'>('ativo');
  const [editNotes, setEditNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const editScrollRef = useRef<any>(null);
  const monthPickerRef = useRef<any>(null);

  // Animação suave sincronizada com o teclado nativo do iOS
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

  const loadPatientAndSessions = useCallback(async () => {
    if (!patientId) return;
    try {
      setIsLoading(true);
      const [resPatient, resAppts] = await Promise.all([
        api.get(`/api/my-patients/${patientId}`).catch(() => null),
        api.get('/api/appointments').catch(() => ({ data: [] }))
      ]);

      let resolvedName = params.nome || '';
      if (resPatient?.data) {
        const p = resPatient.data;
        resolvedName = p.nome || resolvedName;
        setPatient({
          id: p.id,
          nome: p.nome || '',
          telefone: p.telefone || '',
          email: p.email && !p.email.includes('@temp.com') ? p.email : '',
          status: p.status || 'ativo',
          sessionValue: Number(p.sessionValue) || 0,
          observacoes: p.observacoes || ''
        });
      }

      const allAppts = Array.isArray(resAppts?.data) ? resAppts.data : [];
      const cleanName = resolvedName.trim().toLowerCase();

      const patientAppts = allAppts
        .filter((a: any) => {
          if (!a.start || a.status === 'cancelled' || a.status === 'available') return false;
          if (a.patientId && String(a.patientId) === String(patientId)) return true;
          if (!a.patientId && cleanName && (a.title || '').trim().toLowerCase() === cleanName) return true;
          return false;
        })
        .sort((a: any, b: any) => new Date(b.start).getTime() - new Date(a.start).getTime());

      setAppointments(patientAppts);
    } catch (err) {
      console.warn('Erro ao carregar perfil do paciente:', err);
    } finally {
      setIsLoading(false);
    }
  }, [patientId, params.nome]);

  useEffect(() => {
    loadPatientAndSessions();
  }, [loadPatientAndSessions]);

  // Meses disponíveis dinamicamente a partir das sessões reais do paciente
  const availableMonths = useMemo(() => {
    const map = new Map<string, string>();
    appointments.forEach((a: any) => {
      const d = new Date(a.start);
      if (!isNaN(d.getTime())) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = `${MONTHS_PT[d.getMonth()]} ${d.getFullYear()}`;
        if (!map.has(key)) map.set(key, label);
      }
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [appointments]);

  const filteredSessions = useMemo(() => {
    if (filterMonth === 'all') return appointments;
    return appointments.filter((a: any) => {
      const d = new Date(a.start);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return key === filterMonth;
    });
  }, [appointments, filterMonth]);

  const selectedMonthLabel = useMemo(() => {
    if (filterMonth === 'all') return 'Todas';
    return availableMonths.find((m) => m.value === filterMonth)?.label || 'Todas';
  }, [filterMonth, availableMonths]);

  const initials = useMemo(() => {
    const nameStr = patient?.nome || 'P';
    return nameStr
      .split(' ')
      .filter(Boolean)
      .map((n: string) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }, [patient?.nome]);

  const openEditSheet = () => {
    setEditName(patient.nome || '');
    setEditPhone(patient.telefone || '');
    setEditEmail(patient.email || '');
    const cents = Math.round((Number(patient.sessionValue) || 0) * 100);
    setEditValue(cents > 0 ? maskCurrency(String(cents)) : '');
    setEditStatus(patient.status === 'inativo' ? 'inativo' : 'ativo');
    setEditNotes(patient.observacoes || '');
    setConfirmDelete(false);
    setModalEdit(true);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim() || !editPhone.trim()) {
      Alert.alert('Campos Obrigatórios', 'Informe ao menos o nome e o WhatsApp do paciente.');
      return;
    }

    Keyboard.dismiss();

    const numericValue = parseFloat(editValue.replace(/\D/g, '')) / 100 || 0;

    try {
      setIsSaving(true);
      await api.put(`/api/my-patients/${patientId}`, {
        name: editName.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim(),
        status: editStatus,
        sessionValue: numericValue,
        observacoes: editNotes.trim()
      });

      setPatient((prev: any) => ({
        ...prev,
        nome: editName.trim(),
        telefone: editPhone.trim(),
        email: editEmail.trim(),
        status: editStatus,
        sessionValue: numericValue,
        observacoes: editNotes.trim()
      }));
      setModalEdit(false);
      Alert.alert('Atualizado', 'Dados do paciente atualizados com sucesso!');
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível atualizar os dados do paciente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePatient = async () => {
    Keyboard.dismiss();
    try {
      setIsDeleting(true);
      await api.delete(`/api/my-patients/${patientId}`);
      setModalEdit(false);
      router.back();
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível excluir o paciente.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenWhatsApp = () => {
    const digits = (patient.telefone || '').replace(/\D/g, '');
    if (!digits) {
      Alert.alert('WhatsApp', 'Este paciente não possui telefone cadastrado.');
      return;
    }
    const fullNumber = digits.startsWith('55') ? digits : `55${digits}`;
    Linking.openURL(`https://wa.me/${fullNumber}`).catch(() => {
      Alert.alert('WhatsApp', 'Não foi possível abrir o WhatsApp neste dispositivo.');
    });
  };

  const getSessionStatusBadge = (status?: string) => {
    if (status === 'confirmed') {
      return { label: 'CONFIRMADO', dot: '#1B4332', bg: '#e8f5e9', text: '#1B4332' };
    }
    if (status === 'done' || status === 'completed') {
      return { label: 'REALIZADA', dot: '#6b7280', bg: '#f3f4f6', text: '#4b5563' };
    }
    if (status === 'missed' || status === 'absent') {
      return { label: 'FALTA', dot: '#d32f2f', bg: '#fef2f2', text: '#d32f2f' };
    }
    return { label: 'AGENDADO', dot: '#3788d8', bg: '#ebf5ff', text: '#1d4ed8' };
  };

  const isAtivo = (patient.status || 'ativo') === 'ativo';

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <StatusBar style="dark" />

      {/* Sem SafeAreaView duplicado no topo (MobileHeader já aplica o inset superior) + respiro exato na base */}
      <YeloScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: BOTTOM_NAV_CLEARANCE }}
      >
        {/* HEADER VERDE PADRÃO YELO */}
        <View className="mx-4 mt-4 mb-4 bg-[#1B4332] p-[22px] rounded-[16px] shadow-sm flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full items-center justify-center mr-3.5"
            style={{ backgroundColor: 'rgba(255,255,255,0.16)' }}
          >
            <Feather name="arrow-left" size={20} color="#ffffff" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="font-title text-[24px] text-white leading-tight">
              Perfil do Paciente
            </Text>
            <Text className="font-sans text-[13px] text-white/80 mt-0.5">
              Cadastro, observações e histórico real.
            </Text>
          </View>
        </View>

        {/* CARD DE DADOS REAIS DO PACIENTE */}
        <View className="mx-4 mb-4 bg-white rounded-[20px] p-6 border border-[#eee] shadow-sm items-center">
          <View className="w-[72px] h-[72px] rounded-full bg-[#f0fdf4] border border-[#cce5d4] items-center justify-center mb-3.5">
            <Text className="font-title text-[26px] text-[#1B4332]">{initials}</Text>
          </View>

          <Text className="font-title text-[23px] text-[#1f2937] mb-1 text-center">
            {patient.nome || 'Paciente'}
          </Text>

          {!!patient.telefone && (
            <Text className="font-sans text-[15px] text-[#6b7280] mb-1">
              {patient.telefone}
            </Text>
          )}

          {!!patient.email && (
            <Text className="font-sans text-[13px] text-[#9ca3af] mb-3">
              {patient.email}
            </Text>
          )}

          <View className="flex-row items-center justify-center mt-2 mb-5">
            <View
              className="px-4 py-1.5 rounded-full mr-2 border"
              style={{
                backgroundColor: isAtivo ? '#e8f5e9' : '#f1f3f5',
                borderColor: isAtivo ? '#cce5d4' : '#e5e7eb'
              }}
            >
              <Text
                className="font-sans font-bold text-[12px]"
                style={{ color: isAtivo ? '#1B4332' : '#6c757d' }}
              >
                {isAtivo ? 'Ativo' : 'Inativo'}
              </Text>
            </View>

            <View className="bg-[#f9fafb] px-4 py-1.5 rounded-full border border-[#e5e7eb]">
              <Text className="font-sans font-bold text-[12px] text-[#1B4332]">
                R$ {formatCurrencyFromNumber(patient.sessionValue)} / sessão
              </Text>
            </View>
          </View>

          {/* BOTÕES DE AÇÃO EM PÍLULA */}
          <View className="flex-row w-full">
            <TouchableOpacity
              onPress={handleOpenWhatsApp}
              className="flex-1 bg-[#f0fdf4] border border-[#bbf7d0] rounded-full py-3 mr-2 flex-row items-center justify-center"
            >
              <Feather name="message-circle" size={16} color="#1B4332" style={{ marginRight: 7 }} />
              <Text className="font-sans font-bold text-[13px] text-[#1B4332]">WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={openEditSheet}
              className="flex-1 bg-[#1B4332] rounded-full py-3 ml-2 flex-row items-center justify-center shadow-sm"
            >
              <Feather name="edit-2" size={15} color="#ffffff" style={{ marginRight: 7 }} />
              <Text className="font-sans font-bold text-[13px] text-white">Editar Dados</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* OBSERVAÇÕES DO PACIENTE */}
        <View className="mx-4 mb-4 bg-white rounded-[20px] p-5 border border-[#eee] shadow-sm">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="font-title text-[18px] text-[#1B4332]">Observações</Text>
            <TouchableOpacity
              onPress={openEditSheet}
              className="px-3 py-1 rounded-full bg-[#f8f9fa] border border-[#e5e7eb]"
            >
              <Text className="font-sans font-semibold text-[11px] text-[#495057]">
                {patient.observacoes ? 'Editar nota' : '+ Adicionar'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text className="font-sans text-[14px] text-[#555] leading-relaxed">
            {patient.observacoes
              ? patient.observacoes
              : 'Nenhuma observação cadastrada ainda. Toque em "+ Adicionar" para registrar anotações sobre o paciente.'}
          </Text>
        </View>

        {/* HISTÓRICO REAL DE SESSÕES */}
        <View className="mx-4 bg-white rounded-[20px] p-5 border border-[#eee] shadow-sm">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="font-title text-[19px] text-[#1B4332]">Histórico de Sessões</Text>

            {availableMonths.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  const next = !showMonthPicker;
                  setShowMonthPicker(next);
                  if (next && Platform.OS === 'android') {
                    setTimeout(() => monthPickerRef.current?.focus?.(), 60);
                  }
                }}
                className="flex-row items-center bg-[#f9fafb] border border-[#ced4da] rounded-full px-3.5 py-1.5"
              >
                <Feather name="calendar" size={13} color="#1B4332" style={{ marginRight: 6 }} />
                <Text className="font-sans font-bold text-[12px] text-[#1B4332] mr-1.5">
                  {selectedMonthLabel}
                </Text>
                <Feather name={showMonthPicker ? 'chevron-up' : 'chevron-down'} size={14} color="#1B4332" />
              </TouchableOpacity>
            )}
          </View>

          {showMonthPicker && availableMonths.length > 0 && (
            <View className="bg-[#f8f9fa] border border-[#eee] rounded-[20px] mb-4 overflow-hidden">
              <Picker
                ref={monthPickerRef}
                mode="dialog"
                prompt="Filtrar por Mês"
                selectedValue={filterMonth}
                onValueChange={(val) => setFilterMonth(String(val))}
                itemStyle={{ height: 120, fontSize: 16, color: '#1B4332', fontWeight: '600' }}
              >
                <Picker.Item label="Todas as sessões" value="all" />
                {availableMonths.map((m) => (
                  <Picker.Item key={m.value} label={m.label} value={m.value} />
                ))}
              </Picker>
            </View>
          )}

          {isLoading ? (
            <View className="py-8 items-center justify-center">
              <ActivityIndicator size="small" color="#1B4332" />
            </View>
          ) : filteredSessions.length === 0 ? (
            <View className="py-6 items-center justify-center">
              <Text className="font-sans text-[14px] text-[#888] text-center">
                Nenhuma sessão registrada para este paciente ainda.
              </Text>
            </View>
          ) : (
            <View className="ml-1">
              {filteredSessions.map((session: any, index: number) => {
                const startDt = new Date(session.start);
                const endDt = session.end ? new Date(session.end) : null;
                const dateLabel = `${String(startDt.getDate()).padStart(2, '0')} ${MONTHS_SHORT_PT[startDt.getMonth()]} ${startDt.getFullYear()}`;
                const timeRange = endDt && !isNaN(endDt.getTime())
                  ? `${formatHHMM(startDt)} – ${formatHHMM(endDt)}`
                  : formatHHMM(startDt);
                const badge = getSessionStatusBadge(session.status);
                const isLast = index === filteredSessions.length - 1;

                return (
                  <View key={session.id} className="flex-row" style={{ marginBottom: isLast ? 0 : 16 }}>
                    {/* Linha vertical e bolinha colorida */}
                    <View className="items-center mr-3.5">
                      <View
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 6,
                          backgroundColor: badge.dot,
                          marginTop: 6,
                          zIndex: 10
                        }}
                      />
                      {!isLast && (
                        <View
                          style={{
                            width: 2,
                            flex: 1,
                            backgroundColor: '#e5e7eb',
                            marginTop: 2
                          }}
                        />
                      )}
                    </View>

                    {/* Card da Sessão Real */}
                    <View className="flex-1 bg-[#f9fafb] border border-[#eee] rounded-[16px] p-4">
                      <View className="flex-row justify-between items-center mb-1.5">
                        <Text className="font-sans font-bold text-[14px] text-[#1f2937]">
                          {dateLabel}
                        </Text>
                        <View
                          className="px-2.5 py-0.5 rounded-full"
                          style={{ backgroundColor: badge.bg }}
                        >
                          <Text
                            className="font-sans font-bold text-[10px]"
                            style={{ color: badge.text }}
                          >
                            {badge.label}
                          </Text>
                        </View>
                      </View>

                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center">
                          <Feather name="clock" size={13} color="#6b7280" style={{ marginRight: 5 }} />
                          <Text className="font-sans text-[13px] text-[#6b7280]">
                            {timeRange}
                          </Text>
                        </View>

                        <Text className="font-sans font-bold text-[13px] text-[#1B4332]">
                          R$ {formatCurrencyFromNumber(session.value ?? patient.sessionValue)}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </YeloScrollView>

      {/* ============================================================ */}
      {/* MODAL: EDITAR / EXCLUIR PACIENTE (PARIDADE COM WEB MOBILE)   */}
      {/* ============================================================ */}
      {modalEdit && (
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
              setModalEdit(false);
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

              <View className="flex-row items-center mb-4">
                <View className="w-[42px] h-[42px] rounded-full bg-[#f0fdf4] items-center justify-center mr-3">
                  <Text className="text-[18px]">👤</Text>
                </View>
                <View className="flex-1">
                  <Text className="font-title text-[20px] text-[#1B4332]">Editar Paciente</Text>
                  <Text className="font-sans text-[13px] text-[#666]">Atualize os dados e observações.</Text>
                </View>
                <TouchableOpacity
                  className="p-2"
                  onPress={() => {
                    Keyboard.dismiss();
                    setModalEdit(false);
                  }}
                >
                  <Feather name="x" size={22} color="#999" />
                </TouchableOpacity>
              </View>
            </Pressable>

            <ScrollView
              ref={editScrollRef}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              style={{ flexGrow: 0, flexShrink: 1 }}
            >
              <Text className="font-sans font-bold text-[12px] text-[#495057] uppercase mb-1.5">
                Nome Completo *
              </Text>
              <TextInput
                className="bg-[#f9fafb] border border-[#ccc] rounded-full px-5 py-3 mb-3 font-sans text-[15px] text-[#1B4332]"
                placeholder="Ex: João Silva"
                placeholderTextColor="#9ca3af"
                value={editName}
                onChangeText={setEditName}
              />

              <Text className="font-sans font-bold text-[12px] text-[#495057] uppercase mb-1.5">
                WhatsApp *
              </Text>
              <TextInput
                className="bg-[#f9fafb] border border-[#ccc] rounded-full px-5 py-3 mb-3 font-sans text-[15px] text-[#1B4332]"
                placeholder="(00) 00000-0000"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
                maxLength={15}
                value={editPhone}
                onChangeText={(t) => setEditPhone(maskPhone(t))}
              />

              <Text className="font-sans font-bold text-[12px] text-[#495057] uppercase mb-1.5">
                E-mail (Opcional)
              </Text>
              <TextInput
                className="bg-[#f9fafb] border border-[#ccc] rounded-full px-5 py-3 mb-3 font-sans text-[15px] text-[#1B4332]"
                placeholder="paciente@email.com"
                placeholderTextColor="#9ca3af"
                keyboardType="email-address"
                autoCapitalize="none"
                value={editEmail}
                onChangeText={setEditEmail}
              />

              <View className="flex-row justify-between mb-3">
                <View className="flex-1 mr-2">
                  <Text className="font-sans font-bold text-[12px] text-[#495057] uppercase mb-1.5">
                    Valor da Sessão
                  </Text>
                  <TextInput
                    className="bg-[#f9fafb] border border-[#ccc] rounded-full px-5 py-3 font-sans text-[15px] text-[#1B4332]"
                    placeholder="R$ 150,00"
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                    value={editValue}
                    onChangeText={(t) => setEditValue(maskCurrency(t))}
                  />
                </View>

                <View className="flex-1 ml-2">
                  <Text className="font-sans font-bold text-[12px] text-[#495057] uppercase mb-1.5">
                    Status
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      Keyboard.dismiss();
                      setEditStatus(editStatus === 'ativo' ? 'inativo' : 'ativo');
                    }}
                    className="bg-[#f9fafb] border border-[#ccc] rounded-full px-5 py-3 flex-row justify-between items-center"
                  >
                    <Text className="font-sans text-[15px] text-[#1B4332] font-bold capitalize">
                      {editStatus}
                    </Text>
                    <Feather name="refresh-cw" size={14} color="#1B4332" />
                  </TouchableOpacity>
                </View>
              </View>

              <Text className="font-sans font-bold text-[12px] text-[#495057] uppercase mb-1.5">
                Observações (Opcional)
              </Text>
              <TextInput
                className="bg-[#f9fafb] border border-[#ccc] rounded-[20px] px-5 py-3 mb-4 font-sans text-[14px] text-[#1B4332]"
                placeholder="Histórico, queixas principais ou anotações gerais..."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={3}
                style={{ minHeight: 80, textAlignVertical: 'top' }}
                value={editNotes}
                onChangeText={setEditNotes}
                onFocus={() => {
                  setTimeout(() => {
                    editScrollRef.current?.scrollToEnd({ animated: true });
                  }, 150);
                }}
              />

              <TouchableOpacity
                onPress={handleSaveEdit}
                disabled={isSaving || isDeleting}
                className="bg-[#1B4332] rounded-full py-4 mb-3 items-center justify-center shadow-sm"
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text className="font-sans font-bold text-white text-[16px]">
                    Salvar Alterações
                  </Text>
                )}
              </TouchableOpacity>

              {!confirmDelete ? (
                <TouchableOpacity
                  onPress={() => setConfirmDelete(true)}
                  disabled={isSaving || isDeleting}
                  className="rounded-full py-3.5 items-center justify-center flex-row"
                  style={{ backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' }}
                >
                  <Feather name="trash-2" size={15} color="#d32f2f" style={{ marginRight: 7 }} />
                  <Text className="font-sans font-bold text-[14px]" style={{ color: '#d32f2f' }}>
                    Excluir Paciente
                  </Text>
                </TouchableOpacity>
              ) : (
                <View
                  className="rounded-[20px] p-4 items-center"
                  style={{ backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' }}
                >
                  <Text className="font-sans font-bold text-[13px] mb-3 text-center" style={{ color: '#991b1b' }}>
                    Tem certeza que deseja excluir {patient.nome}?
                  </Text>
                  <View className="flex-row w-full">
                    <TouchableOpacity
                      onPress={() => setConfirmDelete(false)}
                      className="flex-1 bg-white rounded-full py-2.5 mr-2 items-center"
                      style={{ borderWidth: 1, borderColor: '#e5e7eb' }}
                    >
                      <Text className="font-sans font-bold text-[13px]" style={{ color: '#495057' }}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleDeletePatient}
                      disabled={isDeleting}
                      className="flex-1 rounded-full py-2.5 ml-2 items-center justify-center"
                      style={{ backgroundColor: '#d32f2f' }}
                    >
                      {isDeleting ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Text className="font-sans font-bold text-[13px]" style={{ color: '#ffffff' }}>Confirmar Exclusão</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      )}
    </View>
  );
}
