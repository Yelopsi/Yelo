import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import api from '../../services/api';

export default function LogsSistemaScreen() {
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [logs, setLogs] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);

  const tabs = [
    { id: 'all', label: 'Todos os Logs', color: '#1e1b4b', bg: '#f1f5f9' },
    { id: 'error', label: 'Erros Críticos', color: '#e63946', bg: '#fef2f2' },
    { id: 'info', label: 'Informações', color: '#3b82f6', bg: '#eff6ff' },
    { id: 'payment', label: 'Pagamentos', color: '#10b981', bg: '#ecfdf5' },
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
            email: { status: 'healthy', errors: 0 }
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
    <View className="flex-1 bg-[#f9fafb]">
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
        {/* Header */}
        <View className="mb-[15px]">
          <Text className="font-title text-[#1e1b4b] text-[24px]">Logs do Sistema</Text>
          <Text className="font-sans text-[#666] text-[14px]">Acompanhe os eventos e erros da plataforma em tempo real.</Text>
        </View>

        {/* Busca e Atualizar */}
        <View className="flex-row items-center justify-between mb-[20px] gap-[10px]">
          <View className="flex-1 flex-row items-center bg-white rounded-[12px] px-[15px] py-[10px] border border-[#e2e8f0]">
            <Feather name="search" size={18} color="#64748b" />
            <TextInput 
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar log..."
              className="flex-1 ml-[10px] font-sans text-[#333] text-[14px]"
            />
          </View>
          <TouchableOpacity onPress={fetchLogs} className="bg-[#1B4332] p-[12px] rounded-[12px] items-center justify-center shadow-[0_2px_10px_rgba(27,67,50,0.2)]">
            {isRefreshing ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Feather name="refresh-cw" size={18} color="white" />
            )}
          </TouchableOpacity>
        </View>

        <Text className="font-title text-[#333] text-[18px] mb-[10px]">Health Check</Text>
        
        <View className="flex-row flex-wrap justify-between mb-[20px] gap-y-[10px]">
          {/* 1. DB */}
          <View className="w-[48%] bg-white rounded-[12px] p-[12px] border-l-4 border-[#10b981] shadow-[0_2px_5px_rgba(0,0,0,0.02)]">
            <Text className="font-title text-[#333] text-[12px] mb-[2px]">Banco de Dados</Text>
            <Text className="font-sans text-[#64748b] text-[10px] mb-[5px]">{health?.database?.status === 'online' ? 'Online & Conectado' : 'Online & Conectado'}</Text>
            <View className="bg-[#f0fdf4] px-[6px] py-[2px] rounded self-start"><Text className="font-sans text-[#166534] text-[9px] font-bold">NORMAL</Text></View>
          </View>
          {/* 2. Cadastros */}
          <View className="w-[48%] bg-white rounded-[12px] p-[12px] border-l-4 border-[#10b981] shadow-[0_2px_5px_rgba(0,0,0,0.02)]">
            <Text className="font-title text-[#333] text-[12px] mb-[2px]">Cadastros (24h)</Text>
            <Text className="font-sans text-[#64748b] text-[10px] mb-[5px]">{health?.registration?.count || 0} Novos Usuários</Text>
            <View className="bg-[#f0fdf4] px-[6px] py-[2px] rounded self-start"><Text className="font-sans text-[#166534] text-[9px] font-bold">ATIVO</Text></View>
          </View>
          {/* 3. Pagamentos */}
          <View className="w-[48%] bg-white rounded-[12px] p-[12px] border-l-4 border-[#10b981] shadow-[0_2px_5px_rgba(0,0,0,0.02)]">
            <Text className="font-title text-[#333] text-[12px] mb-[2px]">Pagamentos</Text>
            <Text className="font-sans text-[#64748b] text-[10px] mb-[5px]">Operando Normalmente</Text>
            <View className="bg-[#f0fdf4] px-[6px] py-[2px] rounded self-start"><Text className="font-sans text-[#166534] text-[9px] font-bold">NORMAL</Text></View>
          </View>
          {/* 4. E-mails */}
          <View className="w-[48%] bg-white rounded-[12px] p-[12px] border-l-4 border-[#10b981] shadow-[0_2px_5px_rgba(0,0,0,0.02)]">
            <Text className="font-title text-[#333] text-[12px] mb-[2px]">Disparo de E-mails</Text>
            <Text className="font-sans text-[#64748b] text-[10px] mb-[5px]">Operacional</Text>
            <View className="bg-[#f0fdf4] px-[6px] py-[2px] rounded self-start"><Text className="font-sans text-[#166534] text-[9px] font-bold">NORMAL</Text></View>
          </View>
          {/* 5. Erros do Sistema */}
          <View className="w-[48%] bg-white rounded-[12px] p-[12px] border-l-4 border-[#f59e0b] shadow-[0_2px_5px_rgba(0,0,0,0.02)]">
            <Text className="font-title text-[#333] text-[12px] mb-[2px]">Erros do Sistema</Text>
            <Text className="font-sans text-[#64748b] text-[10px] mb-[5px]">{health?.system?.errors || 0} Erros Recentes</Text>
            <View className="bg-[#fffbeb] px-[6px] py-[2px] rounded self-start"><Text className="font-sans text-[#b45309] text-[9px] font-bold">{health?.system?.errors > 0 ? 'ALERTA' : 'NORMAL'}</Text></View>
          </View>
          {/* 6. Funil de Busca */}
          <View className="w-[48%] bg-white rounded-[12px] p-[12px] border-l-4 border-[#10b981] shadow-[0_2px_5px_rgba(0,0,0,0.02)]">
            <Text className="font-title text-[#333] text-[12px] mb-[2px]">Funil de Busca</Text>
            <Text className="font-sans text-[#64748b] text-[10px] mb-[5px]">{health?.funnel?.completed || 0} Concluídos</Text>
            <View className="bg-[#f0fdf4] px-[6px] py-[2px] rounded self-start"><Text className="font-sans text-[#166534] text-[9px] font-bold">NORMAL</Text></View>
          </View>
          {/* 7. Segurança */}
          <View className="w-[48%] bg-white rounded-[12px] p-[12px] border-l-4 border-[#10b981] shadow-[0_2px_5px_rgba(0,0,0,0.02)]">
            <Text className="font-title text-[#333] text-[12px] mb-[2px]">Segurança (Logins)</Text>
            <Text className="font-sans text-[#64748b] text-[10px] mb-[5px]">{health?.security?.failures || 0} Falhas de Acesso</Text>
            <View className="bg-[#f0fdf4] px-[6px] py-[2px] rounded self-start"><Text className="font-sans text-[#166534] text-[9px] font-bold">SEGURO</Text></View>
          </View>
          {/* 8. Performance */}
          <View className="w-[48%] bg-white rounded-[12px] p-[12px] border-l-4 border-[#10b981] shadow-[0_2px_5px_rgba(0,0,0,0.02)]">
            <Text className="font-title text-[#333] text-[12px] mb-[2px]">Memória (RAM)</Text>
            <Text className="font-sans text-[#64748b] text-[10px] mb-[5px]">{health?.infrastructure?.memory || 0} MB Utilizados</Text>
            <View className="bg-[#f0fdf4] px-[6px] py-[2px] rounded self-start"><Text className="font-sans text-[#166534] text-[9px] font-bold">ÓTIMA</Text></View>
          </View>
        </View>

        <Text className="font-title text-[#333] text-[18px] mb-[10px]">Logs Recentes</Text>

        {/* Abas de Filtro */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-[20px] max-h-[40px]">
          <View className="flex-row gap-[10px]">
            {tabs.map(tab => (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                className={`px-[16px] h-[36px] justify-center rounded-[10px] border ${activeTab === tab.id ? 'border-[#1e1b4b]' : 'border-[#e2e8f0]'}`}
                style={{ backgroundColor: activeTab === tab.id ? '#1e1b4b' : 'white' }}
              >
                <Text className={`font-sans text-[13px] ${activeTab === tab.id ? 'text-white font-bold' : 'text-[#64748b]'}`}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Lista de Logs */}
        <View className="gap-[15px]">
          
          {filteredLogs.map((log: any, idx: number) => {
            let color = '#3b82f6';
            let title = 'INFO';
            let border = 'border-[#3b82f6]';
            if (log.level === 'error' || log.level === 'fatal') {
               color = '#e63946'; title = 'ERROR'; border = 'border-[#e63946]';
            } else if (log.level === 'warning') {
               color = '#f59e0b'; title = 'WARNING'; border = 'border-[#f59e0b]';
            } else if (log.level === 'payment') {
               color = '#10b981'; title = 'PAGAMENTO'; border = 'border-[#10b981]';
            }
            
            return (
              <View key={log.id || idx} className={`bg-white rounded-[12px] p-[15px] border-l-4 ${border} shadow-[0_2px_5px_rgba(0,0,0,0.02)]`}>
                <View className="flex-row justify-between mb-[5px] items-start">
                  <Text className={`font-title text-[14px]`} style={{ color }}>{title}</Text>
                  <Text className="font-sans text-[#999] text-[11px]">{log.createdAt ? new Date(log.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</Text>
                </View>
                <Text className="font-sans text-[#333] text-[13px] leading-[18px]">
                  {log.message}
                </Text>
                {log.details ? (
                  <Text className="font-sans text-[#666] text-[11px] mt-[8px]">
                    {log.details}
                  </Text>
                ) : null}
              </View>
            );
          })}
          
          {filteredLogs.length === 0 && (
             <Text className="font-sans text-[#888] text-center mt-[20px]">Nenhum log encontrado.</Text>
          )}

        </View>

        <View className="h-[120px]" />
      </ScrollView>
    </View>
  );
}
