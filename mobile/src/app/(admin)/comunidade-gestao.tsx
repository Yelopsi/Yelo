import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';

interface CommunityEventForm {
  titulo: string;
  subtitulo: string;
  data_hora: string;
  tipo: string;
  link_acao: string;
  texto_botao: string;
  ativo: boolean;
}

interface CommunityResourcesForm {
  link_intervisao: string;
  link_biblioteca: string;
  link_cursos: string;
}

export default function ComunidadeGestaoScreen() {
  const router = useRouter();

  // Estados de edição
  const [isBannerEditable, setIsBannerEditable] = useState(false);
  const [isLinksEditable, setIsLinksEditable] = useState(false);

  // Estados dos formulários
  const [bannerForm, setBannerForm] = useState<CommunityEventForm>({
    titulo: '',
    subtitulo: '',
    data_hora: '',
    tipo: 'Online',
    link_acao: '',
    texto_botao: '',
    ativo: true,
  });

  const [linksForm, setLinksForm] = useState<CommunityResourcesForm>({
    link_intervisao: '',
    link_biblioteca: '',
    link_cursos: '',
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingBanner, setSavingBanner] = useState(false);
  const [savingLinks, setSavingLinks] = useState(false);

  // Backup para cancelamento
  const [backupBanner, setBackupBanner] = useState<CommunityEventForm | null>(null);
  const [backupLinks, setBackupLinks] = useState<CommunityResourcesForm | null>(null);

  // Buscar dados
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [resBanner, resLinks] = await Promise.all([
        api.get('/api/admin/community-event').catch(() => ({ data: null })),
        api.get('/api/admin/community-resources').catch(() => ({ data: null })),
      ]);

      if (resBanner.data) {
        const b = resBanner.data;
        const mappedBanner: CommunityEventForm = {
          titulo: b.titulo || b.title || '',
          subtitulo: b.subtitulo || b.subtitle || '',
          data_hora: b.data_hora || b.date_time || '',
          tipo: b.tipo || b.format || 'Online',
          link_acao: b.link_acao || b.action_link || '',
          texto_botao: b.texto_botao || b.action_text || 'Acessar',
          ativo: b.ativo !== undefined ? !!b.ativo : (b.is_active !== undefined ? !!b.is_active : true),
        };
        setBannerForm(mappedBanner);
        setBackupBanner(mappedBanner);
      }

      if (resLinks.data) {
        const l = resLinks.data;
        const mappedLinks: CommunityResourcesForm = {
          link_intervisao: l.link_intervisao || l.intervisao || '',
          link_biblioteca: l.link_biblioteca || l.biblioteca || '',
          link_cursos: l.link_cursos || l.cursos || '',
        };
        setLinksForm(mappedLinks);
        setBackupLinks(mappedLinks);
      }
    } catch (e) {
      console.log('Erro ao carregar dados da comunidade:', e);
      Alert.alert('Erro', 'Não foi possível carregar os dados de gestão da comunidade.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  // Salvar / Alternar Banner
  const handleToggleBanner = async () => {
    if (!isBannerEditable) {
      setBackupBanner({ ...bannerForm });
      setIsBannerEditable(true);
      return;
    }

    try {
      setSavingBanner(true);
      await api.put('/api/admin/community-event', bannerForm);
      Alert.alert('Sucesso', 'Banner da comunidade atualizado com sucesso!');
      setBackupBanner({ ...bannerForm });
      setIsBannerEditable(false);
    } catch (e: any) {
      const msg = e.response?.data?.error || 'Não foi possível salvar as configurações do banner.';
      Alert.alert('Erro', msg);
    } finally {
      setSavingBanner(false);
    }
  };

  const handleCancelBanner = () => {
    if (backupBanner) setBannerForm({ ...backupBanner });
    setIsBannerEditable(false);
  };

  // Salvar / Alternar Links
  const handleToggleLinks = async () => {
    if (!isLinksEditable) {
      setBackupLinks({ ...linksForm });
      setIsLinksEditable(true);
      return;
    }

    try {
      setSavingLinks(true);
      await api.put('/api/admin/community-resources', linksForm);
      Alert.alert('Sucesso', 'Links de recursos atualizados com sucesso!');
      setBackupLinks({ ...linksForm });
      setIsLinksEditable(false);
    } catch (e: any) {
      const msg = e.response?.data?.error || 'Não foi possível salvar os links dos recursos.';
      Alert.alert('Erro', msg);
    } finally {
      setSavingLinks(false);
    }
  };

  const handleCancelLinks = () => {
    if (backupLinks) setLinksForm({ ...backupLinks });
    setIsLinksEditable(false);
  };

  // Testar Link Externo
  const handleTestLink = (url: string, label: string) => {
    if (!url || !url.trim() || url === '#') {
      Alert.alert('Link Vazio', `O link de "${label}" ainda não foi configurado.`);
      return;
    }
    const cleanUrl = url.startsWith('http') ? url : `https://${url}`;
    Linking.openURL(cleanUrl).catch(() => {
      Alert.alert('Erro ao Abrir Link', `Não foi possível abrir o link: ${cleanUrl}`);
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: '#f8fafc' }}
    >
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 130,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#1B4332']}
            tintColor="#1B4332"
          />
        }
      >
        {/* Header Superior com Identidade Yelo */}
        <View
          style={{
            backgroundColor: '#1B4332',
            borderRadius: 20,
            padding: 20,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 10,
            elevation: 3,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <TouchableOpacity
              onPress={() => router.push('/(admin)/conteudo')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
              }}
              activeOpacity={0.8}
            >
              <Feather name="arrow-left" size={14} color="#ffffff" />
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#ffffff' }}>
                Hub de Conteúdo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleRefresh}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: '#ffffff',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
              }}
              activeOpacity={0.8}
            >
              <Feather name="refresh-cw" size={12} color="#1B4332" />
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#1B4332' }}>
                Atualizar
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 22, color: '#ffffff', marginTop: 8 }}>
            Gestão da Comunidade 👥
          </Text>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: '#e2e8f0', marginTop: 4, lineHeight: 18 }}>
            Configure o banner de destaque e os links dos recursos úteis exibidos no dashboard dos psicólogos.
          </Text>
        </View>

        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="small" color="#1B4332" />
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748b', marginTop: 8 }}>
              Carregando dados da comunidade...
            </Text>
          </View>
        ) : (
          <>
            {/* Live Preview do Banner (Como os psicólogos enxergam) */}
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                padding: 16,
                marginBottom: 20,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 6,
                elevation: 2,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Feather name="eye" size={15} color="#0284C7" />
                  <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 15, color: '#1e293b' }}>
                    Pré-visualização do Banner
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: bannerForm.ativo ? '#dcfce7' : '#fee2e2',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 999,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'Inter_700Bold',
                      fontSize: 10,
                      color: bannerForm.ativo ? '#166534' : '#b91c1c',
                    }}
                  >
                    {bannerForm.ativo ? '● Ativo no Feed' : '● Ocultado'}
                  </Text>
                </View>
              </View>

              {/* Card Simulado do Banner */}
              <View
                style={{
                  backgroundColor: '#064e3b',
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: '#047857',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <View
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 999,
                    }}
                  >
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#ffffff' }}>
                      {bannerForm.tipo || 'Online'}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#a7f3d0' }}>
                    {bannerForm.data_hora || 'Data e Hora'}
                  </Text>
                </View>

                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#ffffff', marginBottom: 4 }}>
                  {bannerForm.titulo || 'Título do Evento'}
                </Text>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#d1fae5', lineHeight: 17, marginBottom: 14 }}>
                  {bannerForm.subtitulo || 'Subtítulo explicativo com detalhes para a comunidade.'}
                </Text>

                <View
                  style={{
                    backgroundColor: '#ffffff',
                    paddingVertical: 8,
                    paddingHorizontal: 16,
                    borderRadius: 999,
                    alignSelf: 'flex-start',
                  }}
                >
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11.5, color: '#064e3b' }}>
                    {bannerForm.texto_botao || 'Confirmar Presença'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Card 1: Banner da Comunidade */}
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                padding: 18,
                marginBottom: 20,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 6,
                elevation: 2,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: '#f1f5f9',
                  paddingBottom: 12,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 999,
                      backgroundColor: '#ecfdf5',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Feather name="calendar" size={16} color="#10b981" />
                  </View>
                  <View>
                    <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#1e293b' }}>
                      Banner da Comunidade
                    </Text>
                    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#64748b' }}>
                      Configure o destaque principal
                    </Text>
                  </View>
                </View>

                {isBannerEditable && (
                  <View
                    style={{
                      backgroundColor: '#fef3c7',
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 999,
                    }}
                  >
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#b45309' }}>
                      Modo Edição
                    </Text>
                  </View>
                )}
              </View>

              <View pointerEvents={isBannerEditable ? 'auto' : 'none'} style={{ opacity: isBannerEditable ? 1 : 0.85 }}>
                {/* Título do Evento */}
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569', marginBottom: 5, textTransform: 'uppercase' }}>
                    Título do Evento
                  </Text>
                  <TextInput
                    value={bannerForm.titulo}
                    onChangeText={(t) => setBannerForm({ ...bannerForm, titulo: t })}
                    placeholder="Ex: Marketing Ético"
                    placeholderTextColor="#94a3b8"
                    editable={isBannerEditable}
                    style={{
                      borderWidth: 1,
                      borderColor: isBannerEditable ? '#1B4332' : '#cbd5e1',
                      borderRadius: 14,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      fontFamily: 'Inter_500Medium',
                      fontSize: 13,
                      color: '#1e293b',
                      backgroundColor: isBannerEditable ? '#ffffff' : '#f8fafc',
                    }}
                  />
                </View>

                {/* Subtítulo */}
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569', marginBottom: 5, textTransform: 'uppercase' }}>
                    Subtítulo
                  </Text>
                  <TextInput
                    value={bannerForm.subtitulo}
                    onChangeText={(t) => setBannerForm({ ...bannerForm, subtitulo: t })}
                    placeholder="Ex: Como atrair pacientes e gerar autoridade..."
                    placeholderTextColor="#94a3b8"
                    editable={isBannerEditable}
                    style={{
                      borderWidth: 1,
                      borderColor: isBannerEditable ? '#1B4332' : '#cbd5e1',
                      borderRadius: 14,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      fontFamily: 'Inter_500Medium',
                      fontSize: 13,
                      color: '#1e293b',
                      backgroundColor: isBannerEditable ? '#ffffff' : '#f8fafc',
                    }}
                  />
                </View>

                {/* Data e Formato */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569', marginBottom: 5, textTransform: 'uppercase' }}>
                      Data e Hora
                    </Text>
                    <TextInput
                      value={bannerForm.data_hora}
                      onChangeText={(t) => setBannerForm({ ...bannerForm, data_hora: t })}
                      placeholder="Ex: 15/12 às 19h"
                      placeholderTextColor="#94a3b8"
                      editable={isBannerEditable}
                      style={{
                        borderWidth: 1,
                        borderColor: isBannerEditable ? '#1B4332' : '#cbd5e1',
                        borderRadius: 14,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        fontFamily: 'Inter_500Medium',
                        fontSize: 13,
                        color: '#1e293b',
                        backgroundColor: isBannerEditable ? '#ffffff' : '#f8fafc',
                      }}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569', marginBottom: 5, textTransform: 'uppercase' }}>
                      Formato
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 6, height: 42 }}>
                      {['Online', 'Presencial'].map((fmt) => {
                        const isSelected = bannerForm.tipo === fmt;
                        return (
                          <TouchableOpacity
                            key={fmt}
                            disabled={!isBannerEditable}
                            onPress={() => setBannerForm({ ...bannerForm, tipo: fmt })}
                            style={{
                              flex: 1,
                              borderRadius: 999,
                              backgroundColor: isSelected ? '#1B4332' : '#f1f5f9',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderWidth: isSelected ? 0 : 1,
                              borderColor: '#e2e8f0',
                            }}
                            activeOpacity={0.8}
                          >
                            <Text
                              style={{
                                fontFamily: isSelected ? 'Inter_700Bold' : 'Inter_500Medium',
                                fontSize: 11,
                                color: isSelected ? '#ffffff' : '#64748b',
                              }}
                            >
                              {fmt}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>

                {/* Link de Ação e Texto do Botão */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569', marginBottom: 5, textTransform: 'uppercase' }}>
                      Link de Ação
                    </Text>
                    <TextInput
                      value={bannerForm.link_acao}
                      onChangeText={(t) => setBannerForm({ ...bannerForm, link_acao: t })}
                      placeholder="https://..."
                      placeholderTextColor="#94a3b8"
                      editable={isBannerEditable}
                      autoCapitalize="none"
                      style={{
                        borderWidth: 1,
                        borderColor: isBannerEditable ? '#1B4332' : '#cbd5e1',
                        borderRadius: 14,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        fontFamily: 'Inter_500Medium',
                        fontSize: 13,
                        color: '#1e293b',
                        backgroundColor: isBannerEditable ? '#ffffff' : '#f8fafc',
                      }}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569', marginBottom: 5, textTransform: 'uppercase' }}>
                      Texto do Botão
                    </Text>
                    <TextInput
                      value={bannerForm.texto_botao}
                      onChangeText={(t) => setBannerForm({ ...bannerForm, texto_botao: t })}
                      placeholder="Ex: Confirmar Presença"
                      placeholderTextColor="#94a3b8"
                      editable={isBannerEditable}
                      style={{
                        borderWidth: 1,
                        borderColor: isBannerEditable ? '#1B4332' : '#cbd5e1',
                        borderRadius: 14,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        fontFamily: 'Inter_500Medium',
                        fontSize: 13,
                        color: '#1e293b',
                        backgroundColor: isBannerEditable ? '#ffffff' : '#f8fafc',
                      }}
                    />
                  </View>
                </View>

                {/* Checkbox de Exibir Banner */}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: '#f8fafc',
                    padding: 12,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: '#e2e8f0',
                  }}
                >
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: '#1e293b' }}>
                      Exibir Banner
                    </Text>
                    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: '#64748b' }}>
                      Tornar o card visível para todos os psicólogos cadastrados
                    </Text>
                  </View>
                  <Switch
                    value={bannerForm.ativo}
                    onValueChange={(v) => setBannerForm({ ...bannerForm, ativo: v })}
                    trackColor={{ false: '#cbd5e1', true: '#10b981' }}
                    thumbColor={Platform.OS === 'ios' ? undefined : '#ffffff'}
                    disabled={!isBannerEditable}
                  />
                </View>
              </View>

              {/* Botões de Ação em Pílula */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
                {isBannerEditable && (
                  <TouchableOpacity
                    onPress={handleCancelBanner}
                    style={{
                      flex: 1,
                      backgroundColor: '#f1f5f9',
                      paddingVertical: 11,
                      borderRadius: 999,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#64748b', fontSize: 12.5 }}>
                      Cancelar
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={handleToggleBanner}
                  disabled={savingBanner}
                  style={{
                    flex: isBannerEditable ? 1.5 : 1,
                    backgroundColor: isBannerEditable ? '#10b981' : '#1B4332',
                    paddingVertical: 11,
                    borderRadius: 999,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                  activeOpacity={0.8}
                >
                  {savingBanner ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Feather name={isBannerEditable ? 'check' : 'edit-2'} size={14} color="#ffffff" />
                      <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 12.5 }}>
                        {isBannerEditable ? 'Salvar Banner' : 'Editar Banner'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Card 2: Links dos Recursos */}
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                padding: 18,
                marginBottom: 20,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 6,
                elevation: 2,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: '#f1f5f9',
                  paddingBottom: 12,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 999,
                      backgroundColor: '#e0f2fe',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Feather name="link" size={16} color="#0284C7" />
                  </View>
                  <View>
                    <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#1e293b' }}>
                      Links dos Recursos
                    </Text>
                    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#64748b' }}>
                      Botões inferiores (Intervisão, Biblioteca, Cursos)
                    </Text>
                  </View>
                </View>

                {isLinksEditable && (
                  <View
                    style={{
                      backgroundColor: '#fef3c7',
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 999,
                    }}
                  >
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#b45309' }}>
                      Modo Edição
                    </Text>
                  </View>
                )}
              </View>

              <View pointerEvents={isLinksEditable ? 'auto' : 'none'} style={{ opacity: isLinksEditable ? 1 : 0.85 }}>
                {/* Link Intervisão */}
                <View style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569', textTransform: 'uppercase' }}>
                      Link Intervisão
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleTestLink(linksForm.link_intervisao, 'Intervisão')}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    >
                      <Feather name="external-link" size={11} color="#0284C7" />
                      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#0284C7' }}>
                        Testar
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    value={linksForm.link_intervisao}
                    onChangeText={(t) => setLinksForm({ ...linksForm, link_intervisao: t })}
                    placeholder="https://..."
                    placeholderTextColor="#94a3b8"
                    editable={isLinksEditable}
                    autoCapitalize="none"
                    style={{
                      borderWidth: 1,
                      borderColor: isLinksEditable ? '#0284C7' : '#cbd5e1',
                      borderRadius: 14,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      fontFamily: 'Inter_500Medium',
                      fontSize: 13,
                      color: '#1e293b',
                      backgroundColor: isLinksEditable ? '#ffffff' : '#f8fafc',
                    }}
                  />
                </View>

                {/* Link Biblioteca */}
                <View style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569', textTransform: 'uppercase' }}>
                      Link Biblioteca
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleTestLink(linksForm.link_biblioteca, 'Biblioteca')}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    >
                      <Feather name="external-link" size={11} color="#0284C7" />
                      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#0284C7' }}>
                        Testar
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    value={linksForm.link_biblioteca}
                    onChangeText={(t) => setLinksForm({ ...linksForm, link_biblioteca: t })}
                    placeholder="https://..."
                    placeholderTextColor="#94a3b8"
                    editable={isLinksEditable}
                    autoCapitalize="none"
                    style={{
                      borderWidth: 1,
                      borderColor: isLinksEditable ? '#0284C7' : '#cbd5e1',
                      borderRadius: 14,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      fontFamily: 'Inter_500Medium',
                      fontSize: 13,
                      color: '#1e293b',
                      backgroundColor: isLinksEditable ? '#ffffff' : '#f8fafc',
                    }}
                  />
                </View>

                {/* Link Cursos */}
                <View style={{ marginBottom: 14 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569', textTransform: 'uppercase' }}>
                      Link Cursos
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleTestLink(linksForm.link_cursos, 'Cursos')}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    >
                      <Feather name="external-link" size={11} color="#0284C7" />
                      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#0284C7' }}>
                        Testar
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    value={linksForm.link_cursos}
                    onChangeText={(t) => setLinksForm({ ...linksForm, link_cursos: t })}
                    placeholder="https://..."
                    placeholderTextColor="#94a3b8"
                    editable={isLinksEditable}
                    autoCapitalize="none"
                    style={{
                      borderWidth: 1,
                      borderColor: isLinksEditable ? '#0284C7' : '#cbd5e1',
                      borderRadius: 14,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      fontFamily: 'Inter_500Medium',
                      fontSize: 13,
                      color: '#1e293b',
                      backgroundColor: isLinksEditable ? '#ffffff' : '#f8fafc',
                    }}
                  />
                </View>
              </View>

              {/* Botões de Ação em Pílula */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                {isLinksEditable && (
                  <TouchableOpacity
                    onPress={handleCancelLinks}
                    style={{
                      flex: 1,
                      backgroundColor: '#f1f5f9',
                      paddingVertical: 11,
                      borderRadius: 999,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#64748b', fontSize: 12.5 }}>
                      Cancelar
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={handleToggleLinks}
                  disabled={savingLinks}
                  style={{
                    flex: isLinksEditable ? 1.5 : 1,
                    backgroundColor: isLinksEditable ? '#10b981' : '#1B4332',
                    paddingVertical: 11,
                    borderRadius: 999,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                  activeOpacity={0.8}
                >
                  {savingLinks ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Feather name={isLinksEditable ? 'check' : 'edit-2'} size={14} color="#ffffff" />
                      <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 12.5 }}>
                        {isLinksEditable ? 'Salvar Links' : 'Editar Links'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Atalhos Rápidos para Moderação do Fórum & Gestão de Conteúdo */}
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                padding: 16,
                marginBottom: 20,
                flexDirection: 'row',
                gap: 10,
              }}
            >
              <TouchableOpacity
                onPress={() => router.push('/(admin)/moderacao-forum')}
                style={{
                  flex: 1,
                  backgroundColor: '#f8fafc',
                  borderWidth: 1,
                  borderColor: '#cbd5e1',
                  paddingVertical: 10,
                  borderRadius: 999,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 6,
                }}
                activeOpacity={0.8}
              >
                <Feather name="shield" size={13} color="#1B4332" />
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#1B4332' }}>
                  Moderação Fórum
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push('/(admin)/gestao-conteudo')}
                style={{
                  flex: 1,
                  backgroundColor: '#f8fafc',
                  borderWidth: 1,
                  borderColor: '#cbd5e1',
                  paddingVertical: 10,
                  borderRadius: 999,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 6,
                }}
                activeOpacity={0.8}
              >
                <Feather name="file-text" size={13} color="#1B4332" />
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#1B4332' }}>
                  Gestão Conteúdo
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
