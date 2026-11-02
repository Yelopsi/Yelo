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
  getNotificationPreferences,
  saveNotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
  type AppNotificationPreferences,
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

  // Preferências adicionais de notificações (fórum, blog, comentários, pagamentos)
  const [preferences, setPreferences] = useState<AppNotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES
  );

  const isEnabled = minutesBefore >= 0;

  // Carrega configurações iniciais do armazenamento e do perfil do psicólogo
  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);

      const [storedMinutes, storedPrefs, perm] = await Promise.all([
        getReminderMinutes(),
        getNotificationPreferences(),
        getNotificationPermissionStatus(),
      ]);

      setPermissionStatus(perm);

      let effectiveMinutes = storedMinutes;
      let effectivePrefs = storedPrefs;

      // Tenta sincronizar também com o backend se disponível
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
        if (res.data && res.data.notificationPreferences) {
          effectivePrefs = {
            ...DEFAULT_NOTIFICATION_PREFERENCES,
            ...res.data.notificationPreferences,
          };
          await saveNotificationPreferences(effectivePrefs, false);
        }
      } catch {
        // Modo offline: continua com o valor do SecureStore
      }

      setMinutesBefore(effectiveMinutes);
      setPreferences(effectivePrefs);

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

  // Alterna o toggle mestre de lembretes de sessão (Receber / Não receber)
  const handleToggle = async (value: boolean) => {
    if (!value) {
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

  // Alteração via menu suspenso nativo (dropdown)
  const handleSelectAntecedencia = async (selectedValue: string) => {
    const val = parseInt(selectedValue, 10);
    if (isNaN(val)) return;

    if (val < 0) {
      await handleToggle(false);
      return;
    }

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

  // Alterna preferências de canais/eventos
  const handleTogglePreference = async (
    key: keyof AppNotificationPreferences,
    newValue: boolean
  ) => {
    const updated = {
      ...preferences,
      [key]: newValue,
    };
    setPreferences(updated);
    setIsSaving(true);
    try {
      await saveNotificationPreferences(updated, true);
    } finally {
      setIsSaving(false);
    }
  };

  const [testFeedback, setTestFeedback] = useState<string | null>(null);

  // Disparo de notificação de teste
  const handleTestNotification = async () => {
    setTestFeedback(null);
    let perm = permissionStatus;
    if (perm !== 'granted') {
      const granted = await requestNotificationPermission();
      perm = granted ? 'granted' : 'denied';
      setPermissionStatus(perm);
      if (!granted) {
        Alert.alert(
          'Permissão no iOS / Expo Go',
          'Para receber notificações no seu iPhone, abra os Ajustes do iOS e ative as notificações para o Expo Go (Alertas, Banners e Sons).',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Abrir Ajustes do iPhone',
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

    try {
      setIsTesting(true);
      // Dispara imediatamente e também agenda uma para 3 segundos depois
      await sendTestNotification(0);
      await sendTestNotification(3);

      setTestFeedback(
        '🔔 Notificação enviada! O banner deve descer no topo agora. Se preferir, bloqueie a tela em até 3s para ver na tela de bloqueio.'
      );
    } catch {
      Alert.alert('Erro', 'Ocorreu uma falha ao enviar o teste.');
    } finally {
      setIsTesting(false);
    }
  };

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
            className="mx-6 mb-5 bg-[#1B4332] p-[22px] rounded-[20px] shadow-[0_4px_20px_rgba(0,0,0,0.04)]"
            style={{ borderRadius: 20 }}
          >
            <View className="flex-row items-center mb-2">
              <View className="w-8 h-8 rounded-full bg-white/15 items-center justify-center mr-2.5">
                <Feather name="bell" size={17} color="#ffffff" />
              </View>
              <Text className="font-title text-[22px] text-white leading-tight">
                Ajustes de Alertas
              </Text>
            </View>
            <Text className="font-sans text-[14px] text-white/85 leading-relaxed">
              Personalize quando você deseja receber avisos de consultas, interações na comunidade, posts do blog e pagamentos.
            </Text>

            {/* ATALHO PARA VER O FEED DE AVISOS */}
            <TouchableOpacity
              onPress={() => router.navigate('/(tabs)/avisos')}
              className="mt-4 bg-white/15 border border-white/25 py-2.5 px-4 rounded-full flex-row items-center justify-center self-start"
              activeOpacity={0.8}
            >
              <Feather name="inbox" size={15} color="#ffffff" style={{ marginRight: 6 }} />
              <Text className="font-sans font-bold text-white text-[13px]">
                Ver Minhas Notificações Recebidas 🔔
              </Text>
            </TouchableOpacity>
          </View>

          {/* SEÇÃO 1: LEMBRETES DE CONSULTAS */}
          <View className="mx-6 mb-2">
            <Text className="font-title text-[18px] text-[#1B4332]">
              Consultas & Atendimentos
            </Text>
          </View>

          {/* CARD DO TOGGLE MESTRE DE SESSÃO */}
          <View
            className="mx-6 mb-4 bg-white border border-[#e5e7eb] rounded-[18px] p-5 shadow-sm"
            style={{ borderRadius: 18 }}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1 mr-4">
                <View
                  className="w-11 h-11 rounded-full items-center justify-center mr-3.5"
                  style={{ backgroundColor: isEnabled ? '#f0fdf4' : '#f3f4f6' }}
                >
                  <Feather
                    name={isEnabled ? 'calendar' : 'calendar'}
                    size={20}
                    color={isEnabled ? '#1B4332' : '#9ca3af'}
                  />
                </View>
                <View className="flex-1">
                  <Text className="font-title text-[17px] text-[#1B4332] mb-0.5">
                    Lembretes de Sessão
                  </Text>
                  <Text className="font-sans text-[13px] text-[#6b7280] leading-snug">
                    {isEnabled
                      ? 'Alertas ativos no seu dispositivo'
                      : 'Você optou por não receber lembretes'}
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

            {/* SELETOR DE ANTECEDÊNCIA */}
            <View className="mt-4 pt-4 border-t border-[#f3f4f6]">
              <Text className="font-sans font-bold text-[13px] text-[#374151] mb-2">
                Antecedência da Notificação
              </Text>

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
                      name={isEnabled ? 'clock' : 'slash'}
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
          </View>

          {/* SEÇÃO 2: COMUNIDADE & FÓRUM */}
          <View className="mx-6 mb-2 mt-2">
            <Text className="font-title text-[18px] text-[#1B4332]">
              Comunidade & Fórum
            </Text>
          </View>

          <View
            className="mx-6 mb-5 bg-white border border-[#e5e7eb] rounded-[18px] p-5 shadow-sm"
            style={{ borderRadius: 18 }}
          >
            {/* 1. Novo post no fórum */}
            <View className="flex-row items-center justify-between pb-4 border-b border-[#f3f4f6]">
              <View className="flex-row items-center flex-1 mr-3">
                <View className="w-10 h-10 rounded-full bg-[#f0fdf4] items-center justify-center mr-3">
                  <Feather name="message-square" size={18} color="#1B4332" />
                </View>
                <View className="flex-1">
                  <Text className="font-sans font-bold text-[15px] text-[#1B4332]">
                    Novo post no fórum
                  </Text>
                  <Text className="font-sans text-[12px] text-[#6b7280]">
                    Novos tópicos e debates clínicos na rede
                  </Text>
                </View>
              </View>
              <Switch
                value={preferences.new_forum_post}
                onValueChange={(val) => handleTogglePreference('new_forum_post', val)}
                trackColor={{ false: '#e5e7eb', true: '#1B4332' }}
                thumbColor="#ffffff"
                ios_backgroundColor="#e5e7eb"
              />
            </View>

            {/* 2. Comentário em um post seu */}
            <View className="flex-row items-center justify-between py-4 border-b border-[#f3f4f6]">
              <View className="flex-row items-center flex-1 mr-3">
                <View className="w-10 h-10 rounded-full bg-[#f0fdf4] items-center justify-center mr-3">
                  <Feather name="corner-down-right" size={18} color="#1B4332" />
                </View>
                <View className="flex-1">
                  <Text className="font-sans font-bold text-[15px] text-[#1B4332]">
                    Comentário em um post seu
                  </Text>
                  <Text className="font-sans text-[12px] text-[#6b7280]">
                    Quando interagirem em uma discussão que você criou
                  </Text>
                </View>
              </View>
              <Switch
                value={preferences.post_comment}
                onValueChange={(val) => handleTogglePreference('post_comment', val)}
                trackColor={{ false: '#e5e7eb', true: '#1B4332' }}
                thumbColor="#ffffff"
                ios_backgroundColor="#e5e7eb"
              />
            </View>

            {/* 3. Comentário a um comentário seu (resposta) */}
            <View className="flex-row items-center justify-between py-4 border-b border-[#f3f4f6]">
              <View className="flex-row items-center flex-1 mr-3">
                <View className="w-10 h-10 rounded-full bg-[#f0fdf4] items-center justify-center mr-3">
                  <Feather name="message-circle" size={18} color="#1B4332" />
                </View>
                <View className="flex-1">
                  <Text className="font-sans font-bold text-[15px] text-[#1B4332]">
                    Comentário a um comentário seu
                  </Text>
                  <Text className="font-sans text-[12px] text-[#6b7280]">
                    Respostas diretas a comentários que você publicou
                  </Text>
                </View>
              </View>
              <Switch
                value={preferences.comment_reply}
                onValueChange={(val) => handleTogglePreference('comment_reply', val)}
                trackColor={{ false: '#e5e7eb', true: '#1B4332' }}
                thumbColor="#ffffff"
                ios_backgroundColor="#e5e7eb"
              />
            </View>

            {/* 4. Perguntas da comunidade */}
            <View className="flex-row items-center justify-between pt-4">
              <View className="flex-row items-center flex-1 mr-3">
                <View className="w-10 h-10 rounded-full bg-[#f0fdf4] items-center justify-center mr-3">
                  <Feather name="help-circle" size={18} color="#1B4332" />
                </View>
                <View className="flex-1">
                  <Text className="font-sans font-bold text-[15px] text-[#1B4332]">
                    Perguntas da comunidade
                  </Text>
                  <Text className="font-sans text-[12px] text-[#6b7280]">
                    Novas dúvidas enviadas por pacientes e pela rede
                  </Text>
                </View>
              </View>
              <Switch
                value={preferences.community_questions}
                onValueChange={(val) => handleTogglePreference('community_questions', val)}
                trackColor={{ false: '#e5e7eb', true: '#1B4332' }}
                thumbColor="#ffffff"
                ios_backgroundColor="#e5e7eb"
              />
            </View>
          </View>

          {/* SEÇÃO 3: CONTEÚDO CLÍNICO & BLOG */}
          <View className="mx-6 mb-2 mt-2">
            <Text className="font-title text-[18px] text-[#1B4332]">
              Conteúdo Clínico
            </Text>
          </View>

          <View
            className="mx-6 mb-5 bg-white border border-[#e5e7eb] rounded-[18px] p-5 shadow-sm"
            style={{ borderRadius: 18 }}
          >
            {/* Novo post no blog */}
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1 mr-3">
                <View className="w-10 h-10 rounded-full bg-[#f0fdf4] items-center justify-center mr-3">
                  <Feather name="book-open" size={18} color="#1B4332" />
                </View>
                <View className="flex-1">
                  <Text className="font-sans font-bold text-[15px] text-[#1B4332]">
                    Novo post no blog
                  </Text>
                  <Text className="font-sans text-[12px] text-[#6b7280]">
                    Artigos científicos, atualizações teóricas e práticas
                  </Text>
                </View>
              </View>
              <Switch
                value={preferences.new_blog_post}
                onValueChange={(val) => handleTogglePreference('new_blog_post', val)}
                trackColor={{ false: '#e5e7eb', true: '#1B4332' }}
                thumbColor="#ffffff"
                ios_backgroundColor="#e5e7eb"
              />
            </View>
          </View>

          {/* STATUS DO DISPOSITIVO & TESTE NATIVO */}
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
                  Lembretes agendados no aparelho
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

            {/* Link para Ajustes do Celular */}
            <TouchableOpacity
              onPress={() => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              }}
              className="w-full py-2.5 mb-3 rounded-full border border-[#d1d5db] bg-[#f9fafb] items-center justify-center flex-row"
              activeOpacity={0.7}
            >
              <Feather name="settings" size={14} color="#4b5563" style={{ marginRight: 6 }} />
              <Text className="font-sans font-bold text-[12px] text-[#4b5563]">
                {Platform.OS === 'ios'
                  ? 'Ajustes do iPhone > Expo Go > Notificações'
                  : 'Abrir Configurações do Sistema'}
              </Text>
            </TouchableOpacity>

            {/* Feedback inline do teste */}
            {testFeedback && (
              <View className="mb-3.5 p-3.5 bg-[#f0fdf4] border border-[#bbf7d0] rounded-[14px]">
                <Text className="font-sans text-[12px] text-[#166534] leading-relaxed">
                  {testFeedback}
                </Text>
              </View>
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
        </YeloScrollView>
      )}
    </View>
  );
}
