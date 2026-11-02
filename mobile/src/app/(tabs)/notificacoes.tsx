import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import YeloScrollView from '../../components/YeloScrollView';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import NativeSelectMenu, { NativeSelectOption } from '../../components/NativeSelectMenu';
import {
  REMINDER_OPTIONS,
  getReminderMinutes,
  saveReminderMinutes,
  getNotificationPermissionStatus,
  requestNotificationPermission,
  syncSessionNotifications,
  sendTestNotification,
  cancelAllSessionReminders,
} from '../../services/sessionNotifications';
import api from '../../services/api';

const BOTTOM_NAV_CLEARANCE = Platform.OS === 'ios' ? 102 : 96;

export default function NotificacoesScreen() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // Minutos de antecedência: -1 significa desativado ("Não receber")
  const [minutesBefore, setMinutesBefore] = useState<number>(15);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [scheduledCount, setScheduledCount] = useState<number>(0);

  const isEnabled = minutesBefore >= 0;

  // Carrega configurações iniciais do armazenamento e do perfil do psicólogo
  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);

      const [storedMinutes, perm] = await Promise.all([
        getReminderMinutes(),
        getNotificationPermissionStatus(),
      ]);

      setPermissionStatus(perm);

      // Tenta sincronizar também com o backend se disponível
      let effectiveMinutes = storedMinutes;
      try {
        const res = await api.get('/api/psychologists/me');
        if (
          res.data &&
          res.data.appReminderMinutesBefore !== undefined &&
          res.data.appReminderMinutesBefore !== null
        ) {
          effectiveMinutes = res.data.appReminderMinutesBefore;
          await saveReminderMinutes(effectiveMinutes, false);
        }
      } catch {
        // Modo offline: continua com o valor do SecureStore
      }

      setMinutesBefore(effectiveMinutes);

      // Sincroniza a grade de lembretes reais
      if (effectiveMinutes >= 0 && perm === 'granted') {
        const syncRes = await syncSessionNotifications();
        setScheduledCount(syncRes.scheduledCount);
      } else {
        setScheduledCount(0);
      }
    } catch (e) {
      console.warn('Erro ao carregar configurações de notificação:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Alterna o toggle mestre (Receber / Não receber)
  const handleToggle = async (value: boolean) => {
    if (!value) {
      // Desativar: marca como -1
      setMinutesBefore(-1);
      setScheduledCount(0);
      setIsSaving(true);
      try {
        await saveReminderMinutes(-1, true);
        await cancelAllSessionReminders();
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // Ativar: verifica permissão primeiro
    let perm = permissionStatus;
    if (perm !== 'granted') {
      const granted = await requestNotificationPermission();
      perm = granted ? 'granted' : 'denied';
      setPermissionStatus(perm);

      if (!granted) {
        Alert.alert(
          'Permissão de Notificação',
          'Para receber alertas de consultas, habilite as notificações da Yelo nos Ajustes do seu celular.',
          [
            { text: 'Agora não', style: 'cancel' },
            {
              text: 'Abrir Ajustes',
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              },
            },
          ]
        );
        return;
      }
    }

    // Ativado com permissão: define padrão de 15 minutos
    const newMinutes = 15;
    setMinutesBefore(newMinutes);
    setIsSaving(true);
    try {
      await saveReminderMinutes(newMinutes, true);
      const res = await syncSessionNotifications();
      setScheduledCount(res.scheduledCount);
    } finally {
      setIsSaving(false);
    }
  };

  // Alteração via menu nativo (dropdown)
  const handleSelectAntecedencia = async (selectedValue: string) => {
    const val = parseInt(selectedValue, 10);
    if (isNaN(val)) return;

    if (val < 0) {
      await handleToggle(false);
      return;
    }

    // Se estiver ativando pela primeira vez a partir de um valor positivo
    let perm = permissionStatus;
    if (perm !== 'granted') {
      const granted = await requestNotificationPermission();
      perm = granted ? 'granted' : 'denied';
      setPermissionStatus(perm);

      if (!granted) {
        Alert.alert(
          'Permissão Necessária',
          'Permita as notificações nas configurações do seu celular para receber os alertas das consultas.',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Ajustes',
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              },
            },
          ]
        );
        return;
      }
    }

    setMinutesBefore(val);
    setIsSaving(true);
    try {
      await saveReminderMinutes(val, true);
      const res = await syncSessionNotifications();
      setScheduledCount(res.scheduledCount);
    } finally {
      setIsSaving(false);
    }
  };

  // Disparo de notificação de teste
  const handleTestNotification = async () => {
    if (permissionStatus !== 'granted') {
      const granted = await requestNotificationPermission();
      setPermissionStatus(granted ? 'granted' : 'denied');
      if (!granted) {
        Alert.alert(
          'Permissão Necessária',
          'Permita as notificações para testar o envio de alertas.'
        );
        return;
      }
    }

    try {
      setIsTesting(true);
      const ok = await sendTestNotification();
      if (ok) {
        Alert.alert(
          'Disparado! 🔔',
          'Enviamos uma notificação de teste. Ela aparecerá no topo da sua tela em instantes.'
        );
      } else {
        Alert.alert(
          'Aviso',
          'Não foi possível disparar a notificação de teste neste dispositivo.'
        );
      }
    } catch {
      Alert.alert('Erro', 'Ocorreu uma falha ao enviar o teste.');
    } finally {
      setIsTesting(false);
    }
  };

  // Opções para o NativeSelectMenu
  const selectOptions: NativeSelectOption[] = REMINDER_OPTIONS.map((opt) => ({
    label: opt.label,
    value: opt.value,
  }));

  const currentOptionLabel =
    REMINDER_OPTIONS.find((opt) => opt.minutes === minutesBefore)?.label ||
    (minutesBefore < 0 ? 'Não receber notificações' : `${minutesBefore} min antes`);

  return (
    <View className="flex-1 bg-[#f9fafb]">
      {/* HEADER SUPERIOR COM VOLTAR */}
      <View className="mx-6 mt-6 mb-4 flex-row items-center">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 bg-white border border-[#e0e0e0] rounded-full items-center justify-center mr-4 shadow-sm"
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color="#1B4332" />
        </TouchableOpacity>
        <Text className="font-title text-[22px] text-[#1B4332] flex-1">
          Notificações
        </Text>
        {isSaving && <ActivityIndicator size="small" color="#1B4332" />}
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center p-6">
          <ActivityIndicator size="large" color="#1B4332" />
          <Text className="font-sans text-[#666] mt-4 text-[14px]">
            Carregando preferências...
          </Text>
        </View>
      ) : (
        <YeloScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: BOTTOM_NAV_CLEARANCE + 30 }}
        >
          {/* HERO BANNER YELO */}
          <View
            className="mx-6 mb-6 bg-[#1B4332] p-[22px] rounded-[20px] shadow-[0_4px_20px_rgba(0,0,0,0.04)]"
            style={{ borderRadius: 20 }}
          >
            <View className="flex-row items-center mb-2">
              <View className="w-8 h-8 rounded-full bg-white/15 items-center justify-center mr-2.5">
                <Feather name="bell" size={17} color="#ffffff" />
              </View>
              <Text className="font-title text-[22px] text-white leading-tight">
                Lembretes de Sessão
              </Text>
            </View>
            <Text className="font-sans text-[14px] text-white/85 leading-relaxed">
              Mantenha-se pontual em todos os seus atendimentos recebendo avisos no celular antes de cada sessão com seus pacientes.
            </Text>
          </View>

          {/* CARD PRINCIPAL: TOGGLE ATIVAR/DESATIVAR */}
          <View
            className="mx-6 mb-5 bg-white border border-[#e5e7eb] rounded-[18px] p-5 shadow-sm"
            style={{ borderRadius: 18 }}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1 mr-4">
                <View
                  className="w-11 h-11 rounded-full items-center justify-center mr-3.5"
                  style={{ backgroundColor: isEnabled ? '#f0fdf4' : '#f3f4f6' }}
                >
                  <Feather
                    name={isEnabled ? 'bell' : 'bell-off'}
                    size={20}
                    color={isEnabled ? '#1B4332' : '#9ca3af'}
                  />
                </View>
                <View className="flex-1">
                  <Text className="font-title text-[17px] text-[#1B4332] mb-0.5">
                    Receber Lembretes
                  </Text>
                  <Text className="font-sans text-[13px] text-[#6b7280] leading-snug">
                    {isEnabled
                      ? 'Alertas ativos no seu dispositivo'
                      : 'Você optou por não receber notificações'}
                  </Text>
                </View>
              </View>

              <Switch
                value={isEnabled}
                onValueChange={handleToggle}
                trackColor={{ false: '#e5e7eb', true: '#1B4332' }}
                thumbColor="#ffffff"
                ios_backgroundColor="#e5e7eb"
              />
            </View>
          </View>

          {/* CARD DE ANTECEDÊNCIA (DROPDOWN NATIVO) */}
          <View
            className="mx-6 mb-5 bg-white border border-[#e5e7eb] rounded-[18px] p-5 shadow-sm"
            style={{ borderRadius: 18 }}
          >
            <View className="flex-row items-center mb-2">
              <View className="w-8 h-8 rounded-full bg-[#f0fdf4] items-center justify-center mr-2.5">
                <Feather name="clock" size={16} color="#1B4332" />
              </View>
              <Text className="font-title text-[17px] text-[#1B4332]">
                Antecedência do Alerta
              </Text>
            </View>

            <Text className="font-sans text-[13px] text-[#6b7280] mb-3.5 leading-snug">
              Com quanto tempo antes da sessão você deseja receber o aviso no aparelho:
            </Text>

            {/* SELETOR COM DROPDOWN NATIVO DO SISTEMA (SwiftUI Menu no iOS / Nativo no Android) */}
            <NativeSelectMenu
              options={selectOptions}
              selectedValue={String(minutesBefore)}
              onSelect={handleSelectAntecedencia}
              style={{ width: '100%' }}
            >
              <View
                className="w-full flex-row items-center justify-between px-4 py-3.5 border rounded-[14px]"
                style={{
                  backgroundColor: isEnabled ? '#ffffff' : '#f9fafb',
                  borderColor: isEnabled ? '#1B4332' : '#d1d5db',
                  borderRadius: 14,
                }}
              >
                <View className="flex-row items-center flex-1 mr-2">
                  <Feather
                    name={isEnabled ? 'check-circle' : 'slash'}
                    size={16}
                    color={isEnabled ? '#1B4332' : '#9ca3af'}
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    className="font-sans font-medium text-[15px] flex-1"
                    style={{ color: isEnabled ? '#1B4332' : '#6b7280' }}
                    numberOfLines={1}
                  >
                    {currentOptionLabel}
                  </Text>
                </View>
                <Feather name="chevron-down" size={18} color="#1B4332" />
              </View>
            </NativeSelectMenu>
          </View>

          {/* CARD DE STATUS DO SISTEMA E CONTADOR */}
          <View
            className="mx-6 mb-5 bg-white border border-[#e5e7eb] rounded-[18px] p-5 shadow-sm"
            style={{ borderRadius: 18 }}
          >
            <Text className="font-title text-[16px] text-[#1B4332] mb-3">
              Status do Dispositivo
            </Text>

            {/* Badge de permissão */}
            <View className="flex-row items-center justify-between mb-3 pb-3 border-b border-[#f3f4f6]">
              <View className="flex-row items-center flex-1 mr-2">
                <Feather
                  name={permissionStatus === 'granted' ? 'shield' : 'alert-circle'}
                  size={16}
                  color={permissionStatus === 'granted' ? '#166534' : '#d97706'}
                  style={{ marginRight: 8 }}
                />
                <Text className="font-sans text-[13px] text-[#4b5563]">
                  Permissão no sistema
                </Text>
              </View>
              <View
                className="px-2.5 py-1 rounded-full flex-row items-center"
                style={{
                  backgroundColor:
                    permissionStatus === 'granted' ? '#dcfce7' : '#fef3c7',
                }}
              >
                <Text
                  className="font-sans font-bold text-[11px] uppercase tracking-wider"
                  style={{
                    color:
                      permissionStatus === 'granted' ? '#166534' : '#b45309',
                  }}
                >
                  {permissionStatus === 'granted' ? 'Autorizada' : 'Pendente'}
                </Text>
              </View>
            </View>

            {/* Lembretes programados */}
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center flex-1 mr-2">
                <Feather
                  name="calendar"
                  size={16}
                  color="#1B4332"
                  style={{ marginRight: 8 }}
                />
                <Text className="font-sans text-[13px] text-[#4b5563]">
                  Lembretes programados (próx. semanas)
                </Text>
              </View>
              <View
                className="px-3 py-1 rounded-full items-center justify-center"
                style={{ backgroundColor: '#f0fdf4' }}
              >
                <Text className="font-sans font-bold text-[12px] text-[#1B4332]">
                  {scheduledCount} {scheduledCount === 1 ? 'sessão' : 'sessões'}
                </Text>
              </View>
            </View>

            {/* Link para Ajustes do Celular se pendente */}
            {permissionStatus !== 'granted' && (
              <TouchableOpacity
                onPress={() => {
                  if (Platform.OS === 'ios') {
                    Linking.openURL('app-settings:');
                  } else {
                    Linking.openSettings();
                  }
                }}
                className="w-full py-2.5 mb-3 rounded-full border border-[#d97706] bg-[#fffbeb] items-center justify-center flex-row"
                activeOpacity={0.7}
              >
                <Feather name="settings" size={14} color="#b45309" style={{ marginRight: 6 }} />
                <Text className="font-sans font-bold text-[12px] text-[#b45309]">
                  Habilitar Notificações nos Ajustes do Celular
                </Text>
              </TouchableOpacity>
            )}

            {/* Botão de Teste Rápido */}
            <TouchableOpacity
              onPress={handleTestNotification}
              disabled={isTesting}
              className="w-full py-3 rounded-full border border-[#1B4332] bg-[#f0fdf4] items-center justify-center flex-row"
              activeOpacity={0.7}
              style={{ borderRadius: 999 }}
            >
              {isTesting ? (
                <ActivityIndicator size="small" color="#1B4332" />
              ) : (
                <>
                  <Feather name="send" size={15} color="#1B4332" style={{ marginRight: 6 }} />
                  <Text className="font-sans font-bold text-[13px] text-[#1B4332]">
                    Testar Notificação Agora
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* DICA DE PRIVACIDADE E SIGILO */}
          <View
            className="mx-6 p-4 rounded-[16px] bg-[#f3f4f6] flex-row items-start"
            style={{ borderRadius: 16 }}
          >
            <Feather
              name="lock"
              size={16}
              color="#6b7280"
              style={{ marginRight: 8, marginTop: 2 }}
            />
            <Text className="font-sans text-[12px] text-[#6b7280] flex-1 leading-relaxed">
              Em respeito ao sigilo profissional, os lembretes exibem apenas o horário e nome do paciente, sem detalhes clínicos ou de prontuário na tela de bloqueio.
            </Text>
          </View>
        </YeloScrollView>
      )}
    </View>
  );
}
