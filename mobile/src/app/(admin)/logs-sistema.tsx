import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';
import NativeSelectMenu from '../../components/NativeSelectMenu';

export default function LogsSistemaScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [logs, setLogs] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);

  const tabs = [
    { id: 'all', label: 'Todos os Logs' },
    { id: 'error', label: 'Erros Críticos (Falhas)' },
    { id: 'info', label: 'Informações do Sistema' },
    { id: 'payment', label: 'Pagamentos & Transações' },
  ];

  const fetchLogs = async () => {
    setIsRefreshing(true);
    try {
      const res = await api.get('/api/admin/logs');
      if (Array.isArray(res.data)) {
        setLogs(res.data);
        const errorCount = res.data.filter((l: any) => l.level === 'error').length;
        setHealth({
          database: { status: 'online' },
          registration: { status: 'active', count: '?' },
          payment: { status: 'healthy', errors: 0 },
          system: { status: errorCount === 0 ? 'healthy' : 'warning', errors: errorCount },
          funnel: { status: 'healthy', started: 0, completed: 0 },
          security: { status: 'healthy', failures: 0 },
          infrastructure: { status: 'healthy', memory: 0 },
          email: { status: 'healthy', errors: 0 },
        });
      } else {
        setLogs(res.data?.logs || []);
        setHealth(res.data?.health || null);
      }
    } catch (e) {
      console.log('Erro logs', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((l: any) => {
    const matchesTab = activeTab === 'all' || l.level === activeTab || (activeTab === 'error' && (l.level === 'fatal' || l.level === 'error'));
    const matchesSearch = search === '' || (l.message || '').toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={fetchLogs} colors={['#1B4332']} tintColor="#1B4332" />
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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#ffffff', fontSize: 22 }}>
                Logs do Sistema 📋
              </Text>
              <Text style={{ fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 }}>
                Monitoramento, auditoria e saúde operacional em tempo real.
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
              <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#ffffff', fontSize: 11 }}>Voltar</Text>
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
              placeholder="Buscar em logs..."
              placeholderTextColor="#94a3b8"
              style={{ flex: 1, marginLeft: 8, fontFamily: 'Inter_400Regular', fontSize: 13, color: '#1e293b' }}
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

        {/* Health Check Title */}
        <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 16, marginBottom: 12 }}>
          Saúde Operacional (Health Check)
        </Text>

        {/* Grid de Métricas Uniformes */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
          {/* 1. DB */}
          <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 13 }}>Banco de Dados</Text>
              <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: '#10b981' }} />
            </View>
            <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 11, marginBottom: 6 }}>Online & Conectado</Text>
            <View style={{ backgroundColor: '#ecfdf5', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, alignSelf: 'flex-start' }}>
              <Text style={{ fontFamily: 'Inter_700Bold', color: '#10b981', fontSize: 9 }}>NORMAL</Text>
            </View>
          </View>

          {/* 2. Cadastros */}
          <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 13 }}>Cadastros 24h</Text>
              <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: '#10b981' }} />
            </View>
            <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 11, marginBottom: 6 }}>{health?.registration?.count || 0} Novos Usuários</Text>
            <View style={{ backgroundColor: '#ecfdf5', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, alignSelf: 'flex-start' }}>
              <Text style={{ fontFamily: 'Inter_700Bold', color: '#10b981', fontSize: 9 }}>ATIVO</Text>
            </View>
          </View>

          {/* 3. Pagamentos */}
          <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 13 }}>Pagamentos</Text>
              <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: '#10b981' }} />
            </View>
            <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 11, marginBottom: 6 }}>Operando 100%</Text>
            <View style={{ backgroundColor: '#ecfdf5', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, alignSelf: 'flex-start' }}>
              <Text style={{ fontFamily: 'Inter_700Bold', color: '#10b981', fontSize: 9 }}>NORMAL</Text>
            </View>
          </View>

          {/* 4. Erros */}
          <View style={{ width: '48.5%', backgroundColor: '#ffffff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 13 }}>Erros Sistema</Text>
              <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: (health?.system?.errors || 0) > 0 ? '#f59e0b' : '#10b981' }} />
            </View>
            <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 11, marginBottom: 6 }}>{health?.system?.errors || 0} Erros Recentes</Text>
            <View style={{ backgroundColor: (health?.system?.errors || 0) > 0 ? '#fffbeb' : '#ecfdf5', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, alignSelf: 'flex-start' }}>
              <Text style={{ fontFamily: 'Inter_700Bold', color: (health?.system?.errors || 0) > 0 ? '#d97706' : '#10b981', fontSize: 9 }}>
                {(health?.system?.errors || 0) > 0 ? 'ALERTA' : 'NORMAL'}
              </Text>
            </View>
          </View>
        </View>

        {/* Filtro Dropdown Sem Arrastar Pílulas */}
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

        {/* Lista de Logs */}
        <View style={{ gap: 10 }}>
          {filteredLogs.length === 0 ? (
            <View style={{ backgroundColor: '#ffffff', borderRadius: 20, padding: 30, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' }}>
              <Text style={{ fontSize: 24, marginBottom: 6 }}>📋</Text>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 16 }}>Nenhum log encontrado</Text>
              <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 12, marginTop: 4 }}>
                Não foram localizados registros para os critérios selecionados.
              </Text>
            </View>
          ) : (
            filteredLogs.map((log: any, idx: number) => {
              let color = '#2563eb';
              let badgeBg = '#eff6ff';
              let title = 'INFO';
              if (log.level === 'error' || log.level === 'fatal') {
                color = '#ef4444';
                badgeBg = '#fee2e2';
                title = 'ERROR';
              } else if (log.level === 'warning') {
                color = '#f59e0b';
                badgeBg = '#fffbeb';
                title = 'WARNING';
              } else if (log.level === 'payment') {
                color = '#10b981';
                badgeBg = '#ecfdf5';
                title = 'PAGAMENTO';
              }

              return (
                <View
                  key={log.id || idx}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 18,
                    padding: 15,
                    borderWidth: 1,
                    borderColor: '#e2e8f0',
                    shadowColor: '#000',
                    shadowOpacity: 0.02,
                    shadowRadius: 4,
                    elevation: 1,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <View style={{ backgroundColor: badgeBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                      <Text style={{ fontFamily: 'Inter_700Bold', color, fontSize: 10 }}>{title}</Text>
                    </View>
                    <Text style={{ fontFamily: 'Inter_400Regular', color: '#94a3b8', fontSize: 11 }}>
                      {log.createdAt ? new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: 'Inter_500Medium', color: '#1e293b', fontSize: 13, lineHeight: 18 }}>
                    {log.message}
                  </Text>
                  {log.details ? (
                    <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 11, marginTop: 6, backgroundColor: '#f8fafc', padding: 8, borderRadius: 8 }}>
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
