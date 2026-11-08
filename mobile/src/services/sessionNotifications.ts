import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import api from './api';
import { expandAppointmentsInLocalRange } from '../utils/recurrenceExpander';

const REMINDER_KEY = 'yelo_app_reminder_minutes_before';
const NOTIF_PREFS_KEY = 'yelo_notification_preferences';
const CHANNEL_ID = 'lembretes-sessoes';

export interface AppNotificationPreferences {
  new_blog_post: boolean;
  new_forum_post: boolean;
  post_comment: boolean;
  comment_reply: boolean;
  community_questions: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: AppNotificationPreferences = {
  new_blog_post: true,
  new_forum_post: true,
  post_comment: true,
  comment_reply: true,
  community_questions: true,
};

// Configura o comportamento quando uma notificação chega com o app aberto em primeiro plano
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export interface ReminderOption {
  label: string;
  value: string; // representação em string dos minutos: "-1" | "0" | "5" | ...
  minutes: number;
}

export const REMINDER_OPTIONS: ReminderOption[] = [
  { label: 'Não receber notificações', value: '-1', minutes: -1 },
  { label: 'Na hora da sessão (0 min)', value: '0', minutes: 0 },
  { label: '5 minutos antes', value: '5', minutes: 5 },
  { label: '10 minutos antes', value: '10', minutes: 10 },
  { label: '15 minutos antes (recomendado)', value: '15', minutes: 15 },
  { label: '30 minutos antes', value: '30', minutes: 30 },
  { label: '45 minutos antes', value: '45', minutes: 45 },
  { label: '1 hora antes', value: '60', minutes: 60 },
  { label: '2 horas antes', value: '120', minutes: 120 },
  { label: '1 dia antes (24h)', value: '1440', minutes: 1440 },
];

/**
 * Retorna os minutos de antecedência configurados (-1 se desativado / "não receber").
 * Padrão: 15 minutos.
 */
export async function getReminderMinutes(): Promise<number> {
  if (Platform.OS === 'web') return 15;
  try {
    const stored = await SecureStore.getItemAsync(REMINDER_KEY);
    if (stored !== null && stored !== undefined && stored !== '') {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed)) return parsed;
    }
  } catch {
    // Falha silenciosa de leitura de chave
  }
  return 15; // padrão amigável
}

/**
 * Salva a preferência de antecedência no armazenamento local seguro e sincroniza com o perfil do profissional.
 */
export async function saveReminderMinutes(minutes: number, syncBackend = true): Promise<void> {
  if (Platform.OS !== 'web') {
    try {
      await SecureStore.setItemAsync(REMINDER_KEY, String(minutes));
    } catch (e) {
      console.warn('Falha ao salvar preferência de notificação no SecureStore:', e);
    }
  }

  if (syncBackend) {
    try {
      await api.put('/api/psychologists/me', {
        appReminderMinutesBefore: minutes,
      });
    } catch {
      // Sincronização secundária offline, o SecureStore garante a persistência no dispositivo
    }
  }
}

/**
 * Retorna as preferências de notificações do app (fórum, blog, comentários, pagamentos, etc.)
 */
export async function getNotificationPreferences(): Promise<AppNotificationPreferences> {
  if (Platform.OS === 'web') return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  try {
    const raw = await SecureStore.getItemAsync(NOTIF_PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        new_blog_post: parsed?.new_blog_post !== false,
        new_forum_post: parsed?.new_forum_post !== false,
        post_comment: parsed?.post_comment !== false,
        comment_reply: parsed?.comment_reply !== false,
        community_questions: parsed?.community_questions !== false,
      };
    }
  } catch {
    // Falha silenciosa
  }
  return { ...DEFAULT_NOTIFICATION_PREFERENCES };
}

/**
 * Salva as preferências de notificações no SecureStore e sincroniza com o backend.
 */
export async function saveNotificationPreferences(
  prefs: AppNotificationPreferences,
  syncBackend = true
): Promise<void> {
  if (Platform.OS !== 'web') {
    try {
      await SecureStore.setItemAsync(NOTIF_PREFS_KEY, JSON.stringify(prefs));
    } catch (e) {
      console.warn('Falha ao salvar preferências de notificações no SecureStore:', e);
    }
  }

  if (syncBackend) {
    try {
      await api.put('/api/psychologists/me', {
        notificationPreferences: prefs,
      });
    } catch {
      // Fallback offline
    }
  }
}

/**
 * Verifica o status de permissão de notificações do sistema operacional.
 */
export async function getNotificationPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (Platform.OS === 'web') return 'denied';
  try {
    const settings = await Notifications.getPermissionsAsync();
    return settings.granted || settings.status === 'granted'
      ? 'granted'
      : settings.canAskAgain
      ? 'undetermined'
      : 'denied';
  } catch {
    return 'undetermined';
  }
}

/**
 * Solicita autorização nativa ao sistema operacional.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Cancela todos os lembretes de sessões agendados localmente.
 */
export async function cancelAllSessionReminders(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    console.warn('Erro ao cancelar notificações:', e);
  }
}

/**
 * Dispara uma notificação de teste para o usuário validar os alertas nativos.
 * Suporta disparo imediato (trigger: null) e disparo com delay para teste na tela de bloqueio.
 */
export async function sendTestNotification(delaySeconds: number = 0): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const perm = await getNotificationPermissionStatus();
  if (perm !== 'granted') {
    const granted = await requestNotificationPermission();
    if (!granted) return false;
  }

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Lembretes de Sessões',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1B4332',
      });
    }

    if (delaySeconds > 0) {
      // Disparo agendado para o usuário poder bloquear o celular ou minimizar o app
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔔 Teste de Notificação • Yelo',
          body: 'Seus lembretes de atendimento estão ativos e funcionando no seu aparelho!',
          data: { type: 'test' },
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: delaySeconds,
          repeats: false,
          channelId: CHANNEL_ID,
        },
      });
    } else {
      // Disparo imediato (trigger: null)
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔔 Teste de Notificação • Yelo',
          body: 'Seus lembretes de atendimento estão ativos e funcionando no seu aparelho!',
          data: { type: 'test' },
          sound: 'default',
        },
        trigger: null,
      });
    }
    return true;
  } catch (e) {
    console.error('Erro ao agendar notificação de teste:', e);
    return false;
  }
}

/**
 * Sincroniza a grade de lembretes locais para as próximas consultas agendadas.
 * - Lê a preferência atual (se -1 / desativada, limpa tudo e retorna)
 * - Expande sessões (incluindo regras de recorrência infinita) nas próximas 3 semanas
 * - Agenda até 50 lembretes no sistema com o tempo de antecedência escolhido
 */
export async function syncSessionNotifications(): Promise<{
  scheduledCount: number;
  enabled: boolean;
}> {
  if (Platform.OS === 'web') {
    return { scheduledCount: 0, enabled: false };
  }

  const minutesBefore = await getReminderMinutes();

  // Caso "Não receber": cancela qualquer agendamento existente
  if (minutesBefore < 0) {
    await cancelAllSessionReminders();
    return { scheduledCount: 0, enabled: false };
  }

  const permission = await getNotificationPermissionStatus();
  if (permission !== 'granted') {
    return { scheduledCount: 0, enabled: false };
  }

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Lembretes de Sessões',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1B4332',
      });
    }

    // Limpa a fila prévia para evitar duplicidades
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Busca as regras e agendamentos reais da conta
    const res = await api.get('/api/appointments?mode=rules');
    const rawList = Array.isArray(res.data) ? res.data : res.data?.appointments || [];

    const now = new Date();
    // Janela deslizante de 21 dias
    const windowEnd = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);
    const expanded = expandAppointmentsInLocalRange(rawList, now, windowEnd);

    // Filtra apenas atendimentos válidos (não cancelados, nem apenas disponibilidade livre)
    const upcoming = expanded
      .filter((app: any) => {
        const isScheduled = app.status === 'scheduled' || app.status === 'confirmed';
        return isScheduled && app.start;
      })
      .sort((a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime());

    let scheduledCount = 0;
    const maxNotifications = 50; // Abaixo do limite de 64 do iOS

    for (const app of upcoming) {
      if (scheduledCount >= maxNotifications) break;

      const startMs = new Date(app.start).getTime();
      if (isNaN(startMs)) continue;

      const triggerMs = startMs - minutesBefore * 60 * 1000;
      // Pula agendamentos cujo gatilho já passou ou ocorreria nos próximos 5 segundos
      if (triggerMs <= Date.now() + 5000) continue;

      const patientName =
        app.patientName ||
        app.patient?.nome ||
        (app.title && !app.title.includes('Horário Disponível') ? app.title : 'Paciente');

      const horaSessao = new Date(startMs).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const title =
        minutesBefore === 0
          ? '⏰ Hora da sessão • Yelo'
          : minutesBefore >= 60
          ? `🔔 Sessão em ${Math.round(minutesBefore / 60)}h • Yelo`
          : `🔔 Sessão em ${minutesBefore} min • Yelo`;

      const body = `Atendimento com ${patientName} às ${horaSessao}.`;

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: {
            type: 'session_reminder',
            appointmentId: app.id,
            patientId: app.patientId,
            time: horaSessao,
          },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(triggerMs),
          channelId: CHANNEL_ID,
        },
      });

      scheduledCount++;
    }

    return { scheduledCount, enabled: true };
  } catch (error) {
    console.warn('Erro ao sincronizar lembretes de sessões:', error);
    return { scheduledCount: 0, enabled: true };
  }
}

