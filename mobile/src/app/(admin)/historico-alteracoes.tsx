import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl, 
  TextInput, 
  Alert
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';
import YeloToast from '../../components/YeloToast';

export default function AdminHistoricoAlteracoesScreen() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [changes, setChanges] = useState<any[]>([]);
  const [recentCommits, setRecentCommits] = useState<any[]>([]);
  
  const [activeTab, setActiveTab] = useState<'cataloged' | 'git'>('cataloged');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  const fetchChangelog = async () => {
    try {
      const res = await api.get('/api/admin/system-changelog');
      if (res.data) {
        setChanges(res.data.changes || []);
        setRecentCommits(res.data.recentCommits || []);
      }
    } catch (err) {
      console.error('Erro ao carregar changelog:', err);
      setToastMessage('Falha ao sincronizar changelog.');
      setToastType('error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchChangelog();
  }, []);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchChangelog();
  }, []);

  const handleSyncGit = async () => {
    try {
      setIsSyncing(true);
      const res = await api.post('/api/admin/system-changelog/sync');
      if (res.data?.success) {
        setToastMessage(`Git sincronizado! ${res.data.addedCount || 0} novas alterações.`);
        setToastType('success');
        fetchChangelog();
      } else {
        setToastMessage('Sincronização concluída sem novos commits.');
        setToastType('info');
      }
    } catch (err: any) {
      Alert.alert('Erro ao Sincronizar', err.response?.data?.error || 'Não foi possível sincronizar com o Git.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTogglePsiVisibility = async (item: any) => {
    try {
      const res = await api.post(`/api/admin/system-changelog/${item.id}/toggle-psi`);
      const newStatus = res.data?.visibleToPsychologists;
      setToastMessage(newStatus ? 'Agora visível para psicólogos em "Novidades"!' : 'Ocultado dos psicólogos.');
      setToastType('success');
      
      setChanges(prev => prev.map(c => c.id === item.id ? { ...c, visibleToPsychologists: newStatus } : c));
    } catch (err: any) {
      Alert.alert('Erro', 'Não foi possível alterar a visibilidade.');
    }
  };

  // Filtros
  const categories = ['all', ...Array.from(new Set(changes.map(c => c.category).filter(Boolean)))];

  const filteredChanges = changes.filter(item => {
    const matchesSearch = !searchQuery ||
      item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const filteredCommits = recentCommits.filter(c => {
    return !searchQuery || 
      c.message?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.author?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.hash?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#f8fafc] items-center justify-center p-6">
        <ActivityIndicator size="large" color="#1B4332" />
        <Text className="font-sans text-[#64748b] mt-3">Carregando histórico de alterações...</Text>
      </View>
    );
  }

  const visibleCount = changes.filter(c => c.visibleToPsychologists).length;

  return (
    <View className="flex-1 bg-[#f8fafc]">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 18, paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#1B4332" />}
      >
        {/* HEADER */}
        <View className="bg-[#1B4332] rounded-[24px] p-5 mb-5 shadow-sm relative overflow-hidden">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-1 mr-3">
              <View className="bg-[#FFEE8C]/20 border border-[#FFEE8C]/30 px-3 py-0.5 rounded-full self-start mb-2">
                <Text className="font-sans font-bold text-[#FFEE8C] text-[10.5px] uppercase">
                  🚀 Product & Tech Changelog
                </Text>
              </View>
              <Text className="font-title text-white text-[22px] leading-tight">
                Histórico do Sistema
              </Text>
              <Text className="font-sans text-white/80 text-[12px] mt-1 leading-snug">
                Registro contínuo e automático de modificações técnicas e regras de negócio.
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleSyncGit}
              disabled={isSyncing}
              className="bg-white/15 border border-white/30 px-3.5 py-2.5 rounded-full flex-row items-center gap-1.5 self-start"
              activeOpacity={0.8}
            >
              {isSyncing ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Feather name="refresh-cw" size={14} color="white" />
                  <Text className="font-sans font-bold text-white text-[11.5px]">Sync Git</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* KPIS */}
        <View className="flex-row gap-2.5 mb-4">
          <View className="flex-1 bg-white p-3.5 rounded-[18px] border border-[#e2e8f0] shadow-xs">
            <Text className="font-sans text-[11px] text-[#64748b] font-semibold uppercase">Total</Text>
            <Text className="font-title text-[#1B4332] text-[20px] mt-0.5">{changes.length}</Text>
          </View>

          <View className="flex-1 bg-white p-3.5 rounded-[18px] border border-[#bbf7d0] shadow-xs">
            <Text className="font-sans text-[11px] text-[#16a34a] font-semibold uppercase">Visível no App</Text>
            <Text className="font-title text-[#16a34a] text-[20px] mt-0.5">{visibleCount}</Text>
          </View>

          <View className="flex-1 bg-white p-3.5 rounded-[18px] border border-[#bfdbfe] shadow-xs">
            <Text className="font-sans text-[11px] text-[#2563eb] font-semibold uppercase">Commits Git</Text>
            <Text className="font-title text-[#2563eb] text-[20px] mt-0.5">{recentCommits.length}</Text>
          </View>
        </View>

        {/* ABAS */}
        <View className="flex-row bg-[#e2e8f0]/60 p-1 rounded-2xl mb-4">
          <TouchableOpacity
            onPress={() => setActiveTab('cataloged')}
            className={`flex-1 py-2.5 rounded-xl items-center justify-center ${
              activeTab === 'cataloged' ? 'bg-[#1B4332] shadow-sm' : 'bg-transparent'
            }`}
          >
            <Text className={`font-sans font-bold text-[12.5px] ${
              activeTab === 'cataloged' ? 'text-white' : 'text-[#475569]'
            }`}>
              📦 Catalogadas ({filteredChanges.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('git')}
            className={`flex-1 py-2.5 rounded-xl items-center justify-center ${
              activeTab === 'git' ? 'bg-[#1B4332] shadow-sm' : 'bg-transparent'
            }`}
          >
            <Text className={`font-sans font-bold text-[12.5px] ${
              activeTab === 'git' ? 'text-white' : 'text-[#475569]'
            }`}>
              🐙 Commits Git ({recentCommits.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* SEARCH BAR */}
        <View className="bg-white border border-[#e2e8f0] rounded-[16px] px-3.5 py-2.5 flex-row items-center gap-2 mb-3 shadow-xs">
          <Feather name="search" size={17} color="#94a3b8" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={activeTab === 'cataloged' ? "Buscar por título, resumo ou escopo..." : "Buscar nos commits do repositório..."}
            placeholderTextColor="#94a3b8"
            className="flex-1 font-sans text-[13.5px] text-[#1e293b]"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x-circle" size={16} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* CATEGORY PILLS (quando na aba cataloged) */}
        {activeTab === 'cataloged' && categories.length > 2 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
            <View className="flex-row gap-2">
              {categories.map((cat: any) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setCategoryFilter(cat)}
                  className={`px-3.5 py-1.5 rounded-full border ${
                    categoryFilter === cat
                      ? 'bg-[#1B4332] border-[#1B4332]'
                      : 'bg-white border-[#e2e8f0]'
                  }`}
                >
                  <Text
                    className={`font-sans text-[11.5px] font-bold ${
                      categoryFilter === cat ? 'text-white' : 'text-[#64748b]'
                    }`}
                  >
                    {cat === 'all' ? 'Todas Categorias' : cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        {/* CONTEÚDO DA ABA 1: ALTERAÇÕES CATALOGADAS */}
        {activeTab === 'cataloged' && (
          <View className="gap-3">
            {filteredChanges.length === 0 ? (
              <View className="bg-white rounded-[20px] p-8 items-center justify-center border border-[#e2e8f0]">
                <Feather name="file-text" size={36} color="#cbd5e1" />
                <Text className="font-title text-[#475569] text-[16px] mt-2">Nenhuma alteração encontrada</Text>
              </View>
            ) : (
              filteredChanges.map((item: any) => {
                const isPsiVisible = item.visibleToPsychologists;
                const dateDisplay = item.date ? new Date(item.date).toLocaleDateString('pt-BR') : 'Data não informada';

                return (
                  <View 
                    key={item.id} 
                    className="bg-white rounded-[20px] border border-[#e2e8f0] p-4 shadow-xs"
                  >
                    {/* Header do Card */}
                    <View className="flex-row items-center justify-between gap-2 mb-2">
                      <View className="flex-row items-center gap-2 flex-wrap flex-1">
                        <View className="bg-[#f1f5f9] px-2.5 py-0.5 rounded-full">
                          <Text className="font-sans font-bold text-[#475569] text-[10px]">
                            {dateDisplay}
                          </Text>
                        </View>
                        {item.category ? (
                          <View 
                            className="px-2.5 py-0.5 rounded-full"
                            style={{ backgroundColor: `${item.badgeColor || '#10b981'}15` }}
                          >
                            <Text 
                              className="font-sans font-bold text-[10px]"
                              style={{ color: item.badgeColor || '#10b981' }}
                            >
                              {item.category}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      {/* Botão de Visibilidade do Psicólogo */}
                      <TouchableOpacity
                        onPress={() => handleTogglePsiVisibility(item)}
                        className={`flex-row items-center gap-1 px-2.5 py-1 rounded-full border ${
                          isPsiVisible 
                            ? 'bg-[#ecfdf5] border-[#a7f3d0]' 
                            : 'bg-[#f8fafc] border-[#cbd5e1]'
                        }`}
                        activeOpacity={0.7}
                      >
                        <Feather 
                          name={isPsiVisible ? "eye" : "eye-off"} 
                          size={11} 
                          color={isPsiVisible ? "#059669" : "#94a3b8"} 
                        />
                        <Text className={`font-sans font-bold text-[10px] ${
                          isPsiVisible ? 'text-[#059669]' : 'text-[#94a3b8]'
                        }`}>
                          {isPsiVisible ? 'Visível no App' : 'Oculto'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Título & Resumo */}
                    <Text className="font-title text-[#1B4332] text-[16px] mb-1 leading-snug">
                      {item.title}
                    </Text>

                    {item.summary ? (
                      <Text className="font-sans text-[#475569] text-[13px] leading-relaxed mb-2.5">
                        {item.summary}
                      </Text>
                    ) : null}

                    {/* Impacto */}
                    {item.impact ? (
                      <View className="bg-[#f0fdf4] border border-[#bbf7d0] p-2.5 rounded-xl mb-2 flex-row items-start gap-2">
                        <Text className="text-[12px]">💡</Text>
                        <Text className="font-sans text-[#166534] text-[12px] leading-snug flex-1">
                          <Text className="font-bold">Impacto:</Text> {item.impact}
                        </Text>
                      </View>
                    ) : null}

                    {/* Arquivos afetados */}
                    {item.files && item.files.length > 0 ? (
                      <View className="flex-row items-center gap-1.5 mt-1">
                        <Feather name="file" size={11} color="#94a3b8" />
                        <Text className="font-sans text-[#94a3b8] text-[11px]">
                          {item.files.length} {item.files.length === 1 ? 'arquivo alterado' : 'arquivos alterados'}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* CONTEÚDO DA ABA 2: COMMITS DO GIT */}
        {activeTab === 'git' && (
          <View className="gap-2.5">
            {filteredCommits.length === 0 ? (
              <View className="bg-white rounded-[20px] p-8 items-center justify-center border border-[#e2e8f0]">
                <Feather name="git-commit" size={36} color="#cbd5e1" />
                <Text className="font-title text-[#475569] text-[16px] mt-2">Nenhum commit recente</Text>
              </View>
            ) : (
              filteredCommits.map((c: any, idx: number) => {
                const dateDisplay = c.date ? new Date(c.date).toLocaleDateString('pt-BR') : '';

                return (
                  <View 
                    key={c.hash || idx}
                    className="bg-white rounded-[16px] border border-[#e2e8f0] p-3.5 shadow-xs"
                  >
                    <View className="flex-row items-center justify-between mb-1.5">
                      <View className="bg-[#f1f5f9] px-2.5 py-0.5 rounded-md self-start border border-[#cbd5e1]">
                        <Text className="font-mono text-[#0f172a] font-bold text-[11px]">
                          {c.hash}
                        </Text>
                      </View>

                      <Text className="font-sans text-[11px] text-[#94a3b8]">
                        {dateDisplay} • {c.author}
                      </Text>
                    </View>

                    <Text className="font-sans font-semibold text-[#1e293b] text-[13px] leading-snug">
                      {c.message}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      <YeloToast 
        message={toastMessage} 
        onDismiss={() => setToastMessage(null)} 
        type={toastType} 
      />
    </View>
  );
}

