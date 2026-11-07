import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Switch, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import api from '../../services/api';

export default function ComunidadeGestaoScreen() {
  const [isBannerEditable, setIsBannerEditable] = useState(false);
  const [isLinksEditable, setIsLinksEditable] = useState(false);
  
  const [bannerForm, setBannerForm] = useState({ title: '', subtitle: '', date_time: '', format: '', action_link: '', action_text: '', is_active: false });
  const [linksForm, setLinksForm] = useState({ intervisao: '', grupo_wpp: '', suporte: '' });

  const fetchData = async () => {
    try {
      const [resBanner, resLinks] = await Promise.all([
        api.get('/api/admin/community-event').catch(() => ({ data: {} })),
        api.get('/api/admin/community-resources').catch(() => ({ data: {} })),
      ]);
      setBannerForm(resBanner.data || { title: '', subtitle: '', date_time: '', format: '', action_link: '', action_text: '', is_active: false });
      setLinksForm(resLinks.data || { intervisao: '', grupo_wpp: '', suporte: '' });
    } catch (e) {
      console.log('Erro ao buscar comunidade', e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleBannerEdit = async () => {
    if (isBannerEditable) {
      try {
        await api.put('/api/admin/community-event', bannerForm);
        Alert.alert('Sucesso', 'Banner atualizado com sucesso!');
      } catch (e) {
        Alert.alert('Erro', 'Não foi possível salvar o banner.');
      }
    }
    setIsBannerEditable(!isBannerEditable);
  };

  const toggleLinksEdit = async () => {
    if (isLinksEditable) {
      try {
        await api.put('/api/admin/community-resources', linksForm);
        Alert.alert('Sucesso', 'Links atualizados com sucesso!');
      } catch (e) {
        Alert.alert('Erro', 'Não foi possível salvar os links.');
      }
    }
    setIsLinksEditable(!isLinksEditable);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 130,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 22, color: '#1e293b' }}>
            Gestão da Comunidade 💬
          </Text>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: '#64748b', marginTop: 2 }}>
            Configure o banner de eventos e os links dos recursos úteis.
          </Text>
        </View>

        {/* Banner da Comunidade */}
        <View
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            padding: 16,
            marginBottom: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.03,
            shadowRadius: 6,
            elevation: 1,
          }}
        >
          <View style={{ borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 10, marginBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#1B4332' }}>
                Banner da Comunidade
              </Text>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748b', marginTop: 1 }}>
                Destaque principal no topo do Fórum dos Psicólogos.
              </Text>
            </View>
          </View>

          <View pointerEvents={isBannerEditable ? "auto" : "none"} style={{ opacity: isBannerEditable ? 1 : 0.7 }}>
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569', marginBottom: 4, textTransform: 'uppercase' }}>
                Título do Evento
              </Text>
              <TextInput
                value={bannerForm.title}
                onChangeText={t => setBannerForm({ ...bannerForm, title: t })}
                style={{
                  borderWidth: 1,
                  borderColor: '#cbd5e1',
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  fontFamily: 'Inter_400Regular',
                  fontSize: 13.5,
                  color: '#1e293b',
                  backgroundColor: '#f8fafc',
                }}
              />
            </View>

            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569', marginBottom: 4, textTransform: 'uppercase' }}>
                Subtítulo
              </Text>
              <TextInput
                value={bannerForm.subtitle}
                onChangeText={t => setBannerForm({ ...bannerForm, subtitle: t })}
                style={{
                  borderWidth: 1,
                  borderColor: '#cbd5e1',
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  fontFamily: 'Inter_400Regular',
                  fontSize: 13.5,
                  color: '#1e293b',
                  backgroundColor: '#f8fafc',
                }}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569', marginBottom: 4, textTransform: 'uppercase' }}>
                  Data e Hora
                </Text>
                <TextInput
                  value={bannerForm.date_time}
                  onChangeText={t => setBannerForm({ ...bannerForm, date_time: t })}
                  style={{
                    borderWidth: 1,
                    borderColor: '#cbd5e1',
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                    fontFamily: 'Inter_400Regular',
                    fontSize: 13.5,
                    color: '#1e293b',
                    backgroundColor: '#f8fafc',
                  }}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569', marginBottom: 4, textTransform: 'uppercase' }}>
                  Formato
                </Text>
                <TextInput
                  value={bannerForm.format}
                  onChangeText={t => setBannerForm({ ...bannerForm, format: t })}
                  style={{
                    borderWidth: 1,
                    borderColor: '#cbd5e1',
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                    fontFamily: 'Inter_400Regular',
                    fontSize: 13.5,
                    color: '#1e293b',
                    backgroundColor: '#f8fafc',
                  }}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569', marginBottom: 4, textTransform: 'uppercase' }}>
                  Link de Ação
                </Text>
                <TextInput
                  value={bannerForm.action_link}
                  onChangeText={t => setBannerForm({ ...bannerForm, action_link: t })}
                  style={{
                    borderWidth: 1,
                    borderColor: '#cbd5e1',
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                    fontFamily: 'Inter_400Regular',
                    fontSize: 13.5,
                    color: '#1e293b',
                    backgroundColor: '#f8fafc',
                  }}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569', marginBottom: 4, textTransform: 'uppercase' }}>
                  Texto do Botão
                </Text>
                <TextInput
                  value={bannerForm.action_text}
                  onChangeText={t => setBannerForm({ ...bannerForm, action_text: t })}
                  style={{
                    borderWidth: 1,
                    borderColor: '#cbd5e1',
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                    fontFamily: 'Inter_400Regular',
                    fontSize: 13.5,
                    color: '#1e293b',
                    backgroundColor: '#f8fafc',
                  }}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Switch
                value={bannerForm.is_active}
                onValueChange={v => setBannerForm({ ...bannerForm, is_active: v })}
                trackColor={{ false: "#cbd5e1", true: "#10b981" }}
                disabled={!isBannerEditable}
              />
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#1e293b', marginLeft: 10 }}>
                Exibir Banner no Fórum
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={toggleBannerEdit}
            style={{
              marginTop: 18,
              paddingVertical: 11,
              borderRadius: 999, // Botão em formato de pílula
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              backgroundColor: isBannerEditable ? '#10b981' : '#1B4332',
              gap: 8,
            }}
            activeOpacity={0.8}
          >
            <Feather name={isBannerEditable ? 'save' : 'edit-2'} size={15} color="#ffffff" />
            <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 13 }}>
              {isBannerEditable ? 'Salvar Banner' : 'Editar Banner'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Links dos Recursos */}
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
            shadowOpacity: 0.03,
            shadowRadius: 6,
            elevation: 1,
          }}
        >
          <View style={{ borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 10, marginBottom: 14 }}>
            <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#0284C7' }}>
              Links dos Recursos Úteis
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748b', marginTop: 1 }}>
              Atalhos de acesso rápido para os profissionais na barra lateral.
            </Text>
          </View>

          <View pointerEvents={isLinksEditable ? "auto" : "none"} style={{ opacity: isLinksEditable ? 1 : 0.7 }}>
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569', marginBottom: 4, textTransform: 'uppercase' }}>
                Link da Intervisão Clínica
              </Text>
              <TextInput
                value={linksForm.intervisao}
                onChangeText={t => setLinksForm({ ...linksForm, intervisao: t })}
                style={{
                  borderWidth: 1,
                  borderColor: '#cbd5e1',
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  fontFamily: 'Inter_400Regular',
                  fontSize: 13.5,
                  color: '#1e293b',
                  backgroundColor: '#f8fafc',
                }}
              />
            </View>

            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569', marginBottom: 4, textTransform: 'uppercase' }}>
                Link Grupo VIP WhatsApp
              </Text>
              <TextInput
                value={linksForm.grupo_wpp}
                onChangeText={t => setLinksForm({ ...linksForm, grupo_wpp: t })}
                style={{
                  borderWidth: 1,
                  borderColor: '#cbd5e1',
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  fontFamily: 'Inter_400Regular',
                  fontSize: 13.5,
                  color: '#1e293b',
                  backgroundColor: '#f8fafc',
                }}
              />
            </View>

            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569', marginBottom: 4, textTransform: 'uppercase' }}>
                Link Suporte ao Psicólogo
              </Text>
              <TextInput
                value={linksForm.suporte}
                onChangeText={t => setLinksForm({ ...linksForm, suporte: t })}
                style={{
                  borderWidth: 1,
                  borderColor: '#cbd5e1',
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  fontFamily: 'Inter_400Regular',
                  fontSize: 13.5,
                  color: '#1e293b',
                  backgroundColor: '#f8fafc',
                }}
              />
            </View>
          </View>

          <TouchableOpacity
            onPress={toggleLinksEdit}
            style={{
              marginTop: 18,
              paddingVertical: 11,
              borderRadius: 999, // Botão em formato de pílula
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              backgroundColor: isLinksEditable ? '#10b981' : '#0284C7',
              gap: 8,
            }}
            activeOpacity={0.8}
          >
            <Feather name={isLinksEditable ? 'save' : 'edit-2'} size={15} color="#ffffff" />
            <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 13 }}>
              {isLinksEditable ? 'Salvar Links' : 'Editar Links'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
