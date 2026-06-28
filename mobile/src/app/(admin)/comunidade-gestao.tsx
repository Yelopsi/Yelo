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
        api.get('/api/admin/community-resources').catch(() => ({ data: {} }))
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
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-[#f9fafb]">
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
        {/* Header */}
        <View className="mb-[25px]">
          <Text className="font-title text-[#1e1b4b] text-[24px]">Gestão da Comunidade</Text>
          <Text className="font-sans text-[#666] text-[14px]">Configure o banner e os recursos úteis.</Text>
        </View>

        {/* Banner da Comunidade */}
        <View className="bg-white rounded-[16px] p-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-[#f0f0f0] mb-[20px]">
          <View className="border-b border-[#e9ecef] pb-[10px] mb-[15px] flex-row justify-between items-center">
            <View>
              <Text className="font-title text-[#1B4332] text-[18px]">Banner da Comunidade</Text>
              <Text className="font-sans text-[#666] text-[12px]">Destaque principal no topo do Fórum.</Text>
            </View>
          </View>

          <View pointerEvents={isBannerEditable ? "auto" : "none"} style={{ opacity: isBannerEditable ? 1 : 0.6 }}>
            <View className="mb-[15px]">
              <Text className="font-title text-[#333] text-[12px] mb-[5px]">Título do Evento</Text>
              <TextInput value={bannerForm.title} onChangeText={t => setBannerForm({...bannerForm, title: t})} className="border border-[#cbd5e1] rounded-[8px] p-[10px] font-sans text-[#333] text-[14px] bg-[#f8f9fa]" />
            </View>
            <View className="mb-[15px]">
              <Text className="font-title text-[#333] text-[12px] mb-[5px]">Subtítulo</Text>
              <TextInput value={bannerForm.subtitle} onChangeText={t => setBannerForm({...bannerForm, subtitle: t})} className="border border-[#cbd5e1] rounded-[8px] p-[10px] font-sans text-[#333] text-[14px] bg-[#f8f9fa]" />
            </View>
            <View className="flex-row gap-[10px] mb-[15px]">
              <View className="flex-1">
                <Text className="font-title text-[#333] text-[12px] mb-[5px]">Data e Hora</Text>
                <TextInput value={bannerForm.date_time} onChangeText={t => setBannerForm({...bannerForm, date_time: t})} className="border border-[#cbd5e1] rounded-[8px] p-[10px] font-sans text-[#333] text-[14px] bg-[#f8f9fa]" />
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#333] text-[12px] mb-[5px]">Formato</Text>
                <TextInput value={bannerForm.format} onChangeText={t => setBannerForm({...bannerForm, format: t})} className="border border-[#cbd5e1] rounded-[8px] p-[10px] font-sans text-[#333] text-[14px] bg-[#f8f9fa]" />
              </View>
            </View>
            <View className="flex-row gap-[10px] mb-[15px]">
              <View className="flex-1">
                <Text className="font-title text-[#333] text-[12px] mb-[5px]">Link de Ação</Text>
                <TextInput value={bannerForm.action_link} onChangeText={t => setBannerForm({...bannerForm, action_link: t})} className="border border-[#cbd5e1] rounded-[8px] p-[10px] font-sans text-[#333] text-[14px] bg-[#f8f9fa]" />
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#333] text-[12px] mb-[5px]">Texto do Botão</Text>
                <TextInput value={bannerForm.action_text} onChangeText={t => setBannerForm({...bannerForm, action_text: t})} className="border border-[#cbd5e1] rounded-[8px] p-[10px] font-sans text-[#333] text-[14px] bg-[#f8f9fa]" />
              </View>
            </View>
            
            <View className="flex-row items-center mt-[5px]">
              <Switch 
                value={bannerForm.is_active} 
                onValueChange={v => setBannerForm({...bannerForm, is_active: v})}
                trackColor={{ false: "#cbd5e1", true: "#10b981" }}
                disabled={!isBannerEditable}
              />
              <Text className="font-title text-[#333] text-[14px] ml-[10px]">Exibir Banner</Text>
            </View>
          </View>

          <TouchableOpacity onPress={toggleBannerEdit} className={`mt-[20px] py-[12px] rounded-[10px] items-center flex-row justify-center ${isBannerEditable ? 'bg-[#10b981]' : 'bg-[#1B4332]'}`}>
            <Feather name={isBannerEditable ? 'save' : 'edit-2'} size={16} color="white" />
            <Text className="text-white font-title text-[14px] ml-[8px]">{isBannerEditable ? 'Salvar Banner' : 'Editar Banner'}</Text>
          </TouchableOpacity>
        </View>

        {/* Links dos Recursos */}
        <View className="bg-white rounded-[16px] p-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-[#f0f0f0] mb-[20px]">
          <View className="border-b border-[#e9ecef] pb-[10px] mb-[15px]">
            <Text className="font-title text-[#1B4332] text-[18px]">Links dos Recursos</Text>
            <Text className="font-sans text-[#666] text-[12px]">Botões inferiores de acesso rápido.</Text>
          </View>

          <View pointerEvents={isLinksEditable ? "auto" : "none"} style={{ opacity: isLinksEditable ? 1 : 0.6 }}>
            <View className="mb-[15px]">
              <Text className="font-title text-[#333] text-[12px] mb-[5px]">Link Intervisão</Text>
              <TextInput value={linksForm.intervisao} onChangeText={t => setLinksForm({...linksForm, intervisao: t})} className="border border-[#cbd5e1] rounded-[8px] p-[10px] font-sans text-[#333] text-[14px] bg-[#f8f9fa]" />
            </View>
            <View className="mb-[15px]">
              <Text className="font-title text-[#333] text-[12px] mb-[5px]">Link Grupo WhatsApp</Text>
              <TextInput value={linksForm.grupo_wpp} onChangeText={t => setLinksForm({...linksForm, grupo_wpp: t})} className="border border-[#cbd5e1] rounded-[8px] p-[10px] font-sans text-[#333] text-[14px] bg-[#f8f9fa]" />
            </View>
            <View className="mb-[15px]">
              <Text className="font-title text-[#333] text-[12px] mb-[5px]">Link Suporte</Text>
              <TextInput value={linksForm.suporte} onChangeText={t => setLinksForm({...linksForm, suporte: t})} className="border border-[#cbd5e1] rounded-[8px] p-[10px] font-sans text-[#333] text-[14px] bg-[#f8f9fa]" />
            </View>
          </View>

          <TouchableOpacity onPress={toggleLinksEdit} className={`mt-[10px] py-[12px] rounded-[10px] items-center flex-row justify-center ${isLinksEditable ? 'bg-[#10b981]' : 'bg-[#1B4332]'}`}>
            <Feather name={isLinksEditable ? 'save' : 'edit-2'} size={16} color="white" />
            <Text className="text-white font-title text-[14px] ml-[8px]">{isLinksEditable ? 'Salvar Links' : 'Editar Links'}</Text>
          </TouchableOpacity>
        </View>

        <View className="h-[120px]" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
