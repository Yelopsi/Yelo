import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';
import NativeSelectMenu from '../../components/NativeSelectMenu';

interface HealthData {
  registration?: { status: string; count: number | string };
  system?: { status: string; errors: number };
  payment?: { status: string; errors: number };
  email?: { status: string; errors: number };
  database?: { status: string };
  funnel?: { status: string; started: number; completed: number };
  security?: { status: string; failures: number };
  infrastructure?: { status: string; memory: number; uptime?: number };
  concurrentUsers?: number;
  avgSessionTime?: number;
}

interface LogItem {
  id?: string | number;
  level: string;
  message: string;
  details?: string;
  createdAt: string;
  meta?: {
    userEmail?: string;
    error?: string;
  };
  subsequentAttempt?: {
    type: 'success' | 'failure' | 'gave_up';
  };
}

export default function LogsSistemaScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);

  const [rawLogs, setRawLogs] = useState<LogItem[]>([]);
  const [health, setHealth] = useState<HealthData | null>(null);

  const tabs = [
    { id: 'all', label: '📋 Todos os Logs' },
    { id: 'error', label: '🚨 Todos os Erros' },
    { id: 'info', label: 'ℹ️ Apenas Informações' },
    { id: 'payment', label: '💳 Apenas Pagamentos' },
  ];

  // Processa e correlaciona logs para detectar o status da tentativa subsequente (igual à versão web)
  const processAndCorrelateLogs = useCallback((logsList: LogItem[]): LogItem[] => {
    const logsByUser: Record<string, LogItem[]> = {};

    logsList.forEach((log) => {
      const userId = log.meta?.userEmail;
      if (userId) {
        if (!logsByUser[userId]) logsByUser[userId] = [];
        logsByUser[userId].push(log);
      }
    });

    Object.keys(logsByUser).forEach((userId) => {
      logsByUser[userId].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    });

    return logsList.map((log) => {
      const newLog = { ...log };
      if (newLog.level !== 'error' && newLog.level !== 'fatal') return newLog;

      const userId = newLog.meta?.userEmail;
      if (!userId || !logsByUser[userId]) return newLog;

      const userActions = logsByUser[userId];
      const currentActionIndex = userActions.findIndex((action) => action.id === newLog.id);

      if (currentActionIndex > -1 && currentActionIndex < userActions.length - 1) {
        const nextAction = userActions[currentActionIndex + 1];
        const timeDiff =
          new Date(nextAction.createdAt).getTime() - new Date(newLog.createdAt).getTime();
        const minutesDiff = timeDiff / (1000 * 60);

        if (minutesDiff < 30) {
          const msgA = (newLog.message || '').toLowerCase();
          const msgB = (nextAction.message || '').toLowerCase();
          const isSameAction =
            (msgA.includes('login') && msgB.includes('login')) ||
            (msgA.includes('pagamento') && msgB.includes('pagamento')) ||
            (msgA.includes('asaas') && msgB.includes('asaas'));

          newLog.subsequentAttempt = isSameAction
            ? { type: nextAction.level === 'error' ? 'failure' : 'success' }
            : { type: 'gave_up' };
        } else {
          newLog.subsequentAttempt = { type: 'gave_up' };
        }
      } else {
        newLog.subsequentAttempt = { type: 'gave_up' };
      }
      return newLog;
    });
  }, []);

  const fetchLogs = async () => {
    setIsRefreshing(true);
    const startTime = Date.now();

    try {
      const res = await api.get(`/api/admin/logs?_t=${Date.now()}`);
      const endTime = Date.now();
      setLatency(endTime - startTime);

      if (Array.isArray(res.data)) {
        setRawLogs(res.data);
        const errorCount = res.data.filter(
          (l: any) => l.level === 'error' || l.level === 'fatal'
        ).length;
        setHealth({
          database: { status: 'online' },
          registration: { status: 'active', count: '?' },
          payment: { status: 'healthy', errors: 0 },
          email: { status: 'healthy', errors: 0 },
          system: { status: errorCount === 0 ? 'healthy' : 'warning', errors: errorCount },
          funnel: { status: 'healthy', started: 0, completed: 0 },
          security: { status: 'healthy', failures: 0 },
          infrastructure: { status: 'healthy', memory: 85 },
          concurrentUsers: 0,
          avgSessionTime: 0,
        });
      } else {
        setRawLogs(res.data?.logs || []);
        setHealth(res.data?.health || null);
      }
    } catch (e) {
      console.log('Erro ao carregar logs do sistema:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Logs ordenados e correlacionados
  const correlatedLogs = useMemo(() => {
    const sorted = [...rawLogs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return processAndCorrelateLogs(sorted);
  }, [rawLogs, processAndCorrelateLogs]);

  // Filtros aplicados sobre os logs
  const filteredLogs = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return correlatedLogs.filter((l) => {
      // Filtro de Categoria
      let matchesTab = true;
      if (activeTab === 'error') {
        matchesTab = l.level === 'error' || l.level === 'fatal';
      } else if (activeTab === 'info') {
        matchesTab = l.level === 'info';
      } else if (activeTab === 'payment') {
        const msg = (l.message || '').toLowerCase();
        matchesTab = l.level === 'payment' || msg.includes('pagamento') || msg.includes('asaas');
      }

      // Filtro de Busca
      let matchesSearch = true;
      if (searchTerm) {
        const msg = (l.message || '').toLowerCase();
        const userEmail = (l.meta?.userEmail || '').toLowerCase();
        const details = (l.details || '').toLowerCase();
        matchesSearch =
          msg.includes(searchTerm) || userEmail.includes(searchTerm) || details.includes(searchTerm);
      }

      return matchesTab && matchesSearch;
    });
  }, [correlatedLogs, activeTab, search]);

  // Lista dos 12 KPIs correspondentes à versão Web Mobile
  const healthCards = useMemo(() => {
    const cards = [
      // 1. Banco de Dados
      {
        title: 'Banco de Dados',
        icon: 'database' as const,
        value: health?.database?.status === 'online' ? 'Online & Ativo' : 'Erro Conexão',
        subtitle: 'Conectividade do PostgreSQL',
        tag: health?.database?.status === 'online' ? 'ONLINE' : 'OFFLINE',
        status: (health?.database?.status === 'online' ? 'green' : 'red') as 'green' | 'yellow' | 'red',
      },
      // 2. Cadastros 24h
      {
        title: 'Cadastros 24h',
        icon: 'user-plus' as const,
        value:
          health?.registration?.count === '?'
            ? 'N/A'
            : (Number(health?.registration?.count) || 0) > 0
            ? `${health?.registration?.count} Novos`
            : '0 Cadastros',
        subtitle: 'Novos pacientes e psicólogos',
        tag:
          health?.registration?.status === 'active'
            ? 'ATIVO'
            : Number(health?.registration?.count) === 0
            ? 'OCIOSO'
            : 'ALERTA',
        status: (health?.registration?.status === 'active'
          ? 'green'
          : Number(health?.registration?.count) === 0
          ? 'yellow'
          : 'red') as 'green' | 'yellow' | 'red',
      },
      // 3. Pagamentos
      {
        title: 'Pagamentos',
        icon: 'credit-card' as const,
        value:
          health?.payment?.status === 'healthy'
            ? 'Operando 100%'
            : `${health?.payment?.errors || 0} Erros`,
        subtitle: 'Gateways Asaas & Faturamento',
        tag: health?.payment?.status === 'healthy' ? 'ESTÁVEL' : 'FALHA',
        status: (health?.payment?.status === 'healthy' ? 'green' : 'red') as 'green' | 'yellow' | 'red',
      },
      // 4. Serviço de E-mails
      {
        title: 'Serviço de E-mails',
        icon: 'mail' as const,
        value:
          health?.email?.status === 'healthy'
            ? 'Operacional'
            : `${health?.email?.errors || 0} Falhas (24h)`,
        subtitle: 'Disparos SMTP e avisos',
        tag:
          health?.email?.status === 'healthy'
            ? 'NORMAL'
            : health?.email?.status === 'warning'
            ? 'ATENÇÃO'
            : 'CRÍTICO',
        status: (health?.email?.status === 'healthy'
          ? 'green'
          : health?.email?.status === 'warning'
          ? 'yellow'
          : 'red') as 'green' | 'yellow' | 'red',
      },
      // 5. Erros do Sistema (Bugs)
      {
        title: 'Erros do Sistema',
        icon: 'alert-triangle' as const,
        value:
          health?.system?.status === 'healthy'
            ? 'Estável (0)'
            : `${health?.system?.errors || 0} Exceções`,
        subtitle: 'Exceções de runtime recentes',
        tag: health?.system?.status === 'healthy' ? 'NORMAL' : 'ALERTA',
        status: (health?.system?.status === 'healthy' ? 'green' : 'red') as 'green' | 'yellow' | 'red',
      },
      // 6. Funil de Busca (PLG)
      {
        title: 'Funil de Busca',
        icon: 'filter' as const,
        value:
          health?.funnel?.status === 'critical'
            ? 'ALERTA (Trava)'
            : `${health?.funnel?.completed || 0} / ${health?.funnel?.started || 0} Feitos`,
        subtitle: 'Questionário até WhatsApp',
        tag: health?.funnel?.status === 'healthy' ? 'FLUIDO' : 'TRAVADO',
        status: (health?.funnel?.status === 'healthy' ? 'green' : 'red') as 'green' | 'yellow' | 'red',
      },
      // 7. Segurança de Logins
      {
        title: 'Segurança Logins',
        icon: 'shield' as const,
        value:
          (health?.security?.failures || 0) > 0
            ? `${health?.security?.failures} Falhas`
            : 'Nenhum Alerta',
        subtitle: 'Proteção contra força bruta',
        tag: health?.security?.status === 'healthy' ? 'SEGURO' : 'ATENÇÃO',
        status: (health?.security?.status === 'healthy' ? 'green' : 'yellow') as 'green' | 'yellow' | 'red',
      },
      // 8. Latência (API Ping)
      {
        title: 'Latência da API',
        icon: 'zap' as const,
        value: latency !== null ? `${latency}ms` : 'Medindo...',
        subtitle: 'Tempo de resposta do servidor',
        tag:
          latency !== null
            ? latency < 500
              ? 'RÁPIDO'
              : latency < 1500
              ? 'MODERADO'
              : 'LENTO'
            : 'PING',
        status: (latency !== null
          ? latency < 500
            ? 'green'
            : latency < 1500
            ? 'yellow'
            : 'red'
          : 'green') as 'green' | 'yellow' | 'red',
      },
      // 9. WebSocket / Realtime
      {
        title: 'WebSocket / Chat',
        icon: 'message-circle' as const,
        value: 'Conectado Ativo',
        subtitle: 'Comunicação em tempo real',
        tag: 'ONLINE',
        status: 'green' as const,
      },
      // 10. Concorrência
      {
        title: 'Usuários Online',
        icon: 'users' as const,
        value:
          health?.concurrentUsers !== undefined && health?.concurrentUsers !== null
            ? `${health.concurrentUsers} Ativos (5m)`
            : '0 Ativos',
        subtitle: 'Sessões simultâneas ativas',
        tag:
          (health?.concurrentUsers || 0) > 150
            ? 'SOBRECARGA'
            : (health?.concurrentUsers || 0) > 50
            ? 'ELEVADO'
            : 'NORMAL',
        status: ((health?.concurrentUsers || 0) > 150
          ? 'red'
          : (health?.concurrentUsers || 0) > 50
          ? 'yellow'
          : 'green') as 'green' | 'yellow' | 'red',
      },
      // 11. Sessão Média
      {
        title: 'Sessão Média',
        icon: 'clock' as const,
        value:
          health?.avgSessionTime !== undefined && health?.avgSessionTime !== null
            ? `${Math.round(health.avgSessionTime)} min`
            : '0 min',
        subtitle: 'Duração média da visita',
        tag: 'RETENÇÃO',
        status: 'green' as const,
      },
      // 12. Memória RAM (Node.js)
      {
        title: 'Memória RAM',
        icon: 'cpu' as const,
        value: health?.infrastructure ? `${health.infrastructure.memory} MB Uso` : 'N/A',
        subtitle: 'Alocação da infraestrutura',
        tag: (health?.infrastructure?.memory || 0) > 500 ? 'ELEVADO' : 'NORMAL',
        status: (health?.infrastructure
          ? health.infrastructure.status === 'warning'
            ? 'yellow'
            : 'green'
          : 'green') as 'green' | 'yellow' | 'red',
      },
    ];

    return cards;
  }, [health, latency]);

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={fetchLogs}
            colors={['#1B4332']}
            tintColor="#1B4332"
          />
        }
      >
        {/* Header com Identidade Yelo */}
        <View
          style={{
            backgroundColor: '#1B4332',
            borderRadius: 20,
            padding: 20,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: '#2D6A4F',
            shadowColor: '#1B4332',
            shadowOpacity: 0.15,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 12,
            }}
          >
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#ffffff', fontSize: 22 }}>
                Logs do Sistema 📋
              </Text>
              <Text
                style={{
                  fontFamily: 'Inter_400Regular',
                  color: 'rgba(255,255,255,0.85)',
                  fontSize: 13,
                  marginTop: 4,
                }}
              >
                Acompanhe os eventos, métricas de saúde operacional e status de tentativas.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(admin)/ajustes'))}
              style={{
                backgroundColor: 'rgba(255,255,255,0.15)',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}
              activeOpacity={0.8}
            >
              <Feather name="arrow-left" size={14} color="#ffffff" />
              <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#ffffff', fontSize: 11 }}>
                Voltar
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Busca e Atualizar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#ffffff',
              borderRadius: 999,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderWidth: 1,
              borderColor: '#e2e8f0',
              shadowColor: '#000',
              shadowOpacity: 0.02,
              shadowRadius: 4,
              elevation: 1,
            }}
          >
            <Feather name="search" size={16} color="#64748b" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar por e-mail, mensagem ou erro..."
              placeholderTextColor="#94a3b8"
              style={{
                flex: 1,
                marginLeft: 8,
                fontFamily: 'Inter_400Regular',
                fontSize: 13,
                color: '#1e293b',
              }}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Feather name="x" size={14} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            onPress={fetchLogs}
            style={{
              backgroundColor: '#1B4332',
              width: 44,
              height: 44,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            activeOpacity={0.8}
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color="#FFEE8C" />
            ) : (
              <Feather name="refresh-cw" size={16} color="#FFEE8C" />
            )}
          </TouchableOpacity>
        </View>

        {/* Título de Saúde Operacional com Totalizador de KPIs */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 16 }}>
            Saúde Operacional (Health Check)
          </Text>
          <View
            style={{
              backgroundColor: '#e8f5e9',
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 999,
            }}
          >
            <Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 10 }}>
              12 INDICADORES
            </Text>
          </View>
        </View>

        {/* GRID COMPLETO COM TODOS OS 12 KPIS (Igual à versão web) */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 22 }}>
          {healthCards.map((card) => {
            const dotColor =
              card.status === 'green' ? '#10b981' : card.status === 'yellow' ? '#f59e0b' : '#ef4444';
            const badgeBg =
              card.status === 'green' ? '#ecfdf5' : card.status === 'yellow' ? '#fffbeb' : '#fef2f2';
            const badgeColor =
              card.status === 'green' ? '#059669' : card.status === 'yellow' ? '#d97706' : '#dc2626';
            const borderColor =
              card.status === 'red' ? '#fecaca' : card.status === 'yellow' ? '#fef3c7' : '#e2e8f0';

            return (
              <View
                key={card.title}
                style={{
                  width: '48.5%',
                  backgroundColor: '#ffffff',
                  borderRadius: 18,
                  padding: 13,
                  borderWidth: 1,
                  borderColor,
                  shadowColor: '#000',
                  shadowOpacity: 0.02,
                  shadowRadius: 4,
                  shadowOffset: { width: 0, height: 1 },
                  elevation: 1,
                  justifyContent: 'space-between',
                  minHeight: 122,
                }}
              >
                <View>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 6,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        flex: 1,
                        marginRight: 4,
                      }}
                    >
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 7,
                          backgroundColor: '#f1f5f9',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Feather name={card.icon} size={13} color="#1B4332" />
                      </View>
                      <Text
                        style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 12 }}
                        numberOfLines={1}
                      >
                        {card.title}
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        backgroundColor: dotColor,
                      }}
                    />
                  </View>

                  <Text
                    style={{
                      fontFamily: 'Inter_700Bold',
                      color: '#1B4332',
                      fontSize: 13.5,
                      marginBottom: 2,
                    }}
                  >
                    {card.value}
                  </Text>
                  <Text
                    style={{
                      fontFamily: 'Inter_400Regular',
                      color: '#64748b',
                      fontSize: 10.5,
                      lineHeight: 14,
                      marginBottom: 6,
                    }}
                    numberOfLines={2}
                  >
                    {card.subtitle}
                  </Text>
                </View>

                <View
                  style={{
                    backgroundColor: badgeBg,
                    paddingHorizontal: 7,
                    paddingVertical: 2.5,
                    borderRadius: 999,
                    alignSelf: 'flex-start',
                  }}
                >
                  <Text style={{ fontFamily: 'Inter_700Bold', color: badgeColor, fontSize: 9 }}>
                    {card.tag}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Filtro Dropdown Categoria de Logs */}
        <View style={{ marginBottom: 16 }}>
          <NativeSelectMenu
            title="Filtrar Categoria de Logs"
            options={tabs.map((t) => ({ label: t.label, value: t.id }))}
            selectedValue={activeTab}
            onSelect={(val) => setActiveTab(val)}
            style={{ width: '100%' }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#ffffff',
                borderWidth: 1,
                borderColor: '#e2e8f0',
                borderRadius: 999,
                paddingHorizontal: 16,
                paddingVertical: 10,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.03,
                shadowRadius: 3,
                elevation: 1,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Feather name="filter" size={15} color="#1B4332" />
                <Text style={{ fontFamily: 'Inter_500Medium', color: '#64748b', fontSize: 12 }}>
                  Filtrar:
                </Text>
                <Text
                  style={{
                    fontFamily: 'Inter_700Bold',
                    color: '#1B4332',
                    fontSize: 13,
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  {tabs.find((t) => t.id === activeTab)?.label || 'Todos os Logs'}
                </Text>
              </View>
              <Feather name="chevron-down" size={16} color="#1B4332" />
            </View>
          </NativeSelectMenu>
        </View>

        {/* Lista de Logs Recentes */}
        <View style={{ gap: 10 }}>
          {filteredLogs.length === 0 ? (
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 20,
                padding: 30,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: '#e2e8f0',
              }}
            >
              <Text style={{ fontSize: 24, marginBottom: 6 }}>📋</Text>
              <Text
                style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 16 }}
              >
                Nenhum log encontrado
              </Text>
              <Text
                style={{
                  fontFamily: 'Inter_400Regular',
                  color: '#64748b',
                  fontSize: 12,
                  marginTop: 4,
                  textAlign: 'center',
                }}
              >
                Não foram localizados registros para os critérios selecionados.
              </Text>
            </View>
          ) : (
            filteredLogs.map((log: LogItem, idx: number) => {
              const isError = log.level === 'error' || log.level === 'fatal';
              const isWarning = log.level === 'warning';
              const isPayment =
                log.level === 'payment' ||
                (log.message || '').toLowerCase().includes('pagamento') ||
                (log.message || '').toLowerCase().includes('asaas');

              let color = '#2563eb';
              let badgeBg = '#eff6ff';
              let title = 'INFO';

              if (isError) {
                color = '#ef4444';
                badgeBg = '#fee2e2';
                title = 'ERROR';
              } else if (isPayment) {
                color = '#10b981';
                badgeBg = '#ecfdf5';
                title = 'PAGAMENTO';
              } else if (isWarning) {
                color = '#f59e0b';
                badgeBg = '#fffbeb';
                title = 'WARNING';
              }

              const userIdentifier = log.meta?.userEmail || 'Sistema';

              return (
                <View
                  key={log.id || idx}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 18,
                    padding: 15,
                    borderWidth: 1,
                    borderColor: '#e2e8f0',
                    borderLeftWidth: 4,
                    borderLeftColor: color,
                    shadowColor: '#000',
                    shadowOpacity: 0.02,
                    shadowRadius: 4,
                    elevation: 1,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View
                        style={{
                          backgroundColor: badgeBg,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 999,
                        }}
                      >
                        <Text style={{ fontFamily: 'Inter_700Bold', color, fontSize: 10 }}>
                          {title}
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontFamily: 'Inter_600SemiBold',
                          color: '#475569',
                          fontSize: 11,
                        }}
                      >
                        {userIdentifier}
                      </Text>
                    </View>

                    <Text
                      style={{
                        fontFamily: 'Inter_400Regular',
                        color: '#94a3b8',
                        fontSize: 11,
                      }}
                    >
                      {log.createdAt
                        ? new Date(log.createdAt).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </Text>
                  </View>

                  <Text
                    style={{
                      fontFamily: 'Inter_500Medium',
                      color: '#1e293b',
                      fontSize: 13,
                      lineHeight: 18,
                    }}
                  >
                    {log.message}
                  </Text>

                  {/* Tentativa Subsequente Correlacionada (caso exista) */}
                  {log.subsequentAttempt && (
                    <View
                      style={{
                        marginTop: 10,
                        padding: 8,
                        borderRadius: 10,
                        backgroundColor:
                          log.subsequentAttempt.type === 'success'
                            ? '#f0fdf4'
                            : log.subsequentAttempt.type === 'failure'
                            ? '#fff1f2'
                            : '#f8fafc',
                        borderWidth: 1,
                        borderColor:
                          log.subsequentAttempt.type === 'success'
                            ? '#bbf7d0'
                            : log.subsequentAttempt.type === 'failure'
                            ? '#fecaca'
                            : '#e2e8f0',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Feather
                        name={
                          log.subsequentAttempt.type === 'success'
                            ? 'check-circle'
                            : log.subsequentAttempt.type === 'failure'
                            ? 'x-circle'
                            : 'alert-circle'
                        }
                        size={13}
                        color={
                          log.subsequentAttempt.type === 'success'
                            ? '#166534'
                            : log.subsequentAttempt.type === 'failure'
                            ? '#991b1b'
                            : '#64748b'
                        }
                      />
                      <Text
                        style={{
                          fontFamily: 'Inter_600SemiBold',
                          fontSize: 11,
                          color:
                            log.subsequentAttempt.type === 'success'
                              ? '#166534'
                              : log.subsequentAttempt.type === 'failure'
                              ? '#991b1b'
                              : '#64748b',
                        }}
                      >
                        {log.subsequentAttempt.type === 'success'
                          ? 'SUCESSO na tentativa seguinte.'
                          : log.subsequentAttempt.type === 'failure'
                          ? 'FALHA na tentativa seguinte.'
                          : 'DESISTÊNCIA (nenhuma nova tentativa detectada).'}
                      </Text>
                    </View>
                  )}

                  {log.details ? (
                    <Text
                      style={{
                        fontFamily: 'Inter_400Regular',
                        color: '#64748b',
                        fontSize: 11,
                        marginTop: 8,
                        backgroundColor: '#f8fafc',
                        padding: 8,
                        borderRadius: 8,
                      }}
                    >
                      {log.details}
                    </Text>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}
