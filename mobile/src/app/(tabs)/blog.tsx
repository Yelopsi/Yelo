import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import YeloScrollView from '../../components/YeloScrollView';

import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// Dados Mockados
const MOCK_ARTICLES = [
  { id: 1, title: 'A Importância do Vínculo Terapêutico na Primeira Sessão', date: '10 de maio de 2026', views: 145 },
  { id: 2, title: 'Como Lidar com a Ansiedade Antes do Atendimento Online', date: '02 de maio de 2026', views: 89 },
];

export default function BlogScreen() {
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleImagePicker = () => {
    // Simulando o botão de arquivo fake
    Alert.alert('Simulação', 'Abrindo a galeria de imagens...');
    setSelectedImage('foto_capa_final.jpg');
  };

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <YeloScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        
        {/* HEADER */}
        <View className="mx-6 mt-6 mb-6 bg-[#1B4332] p-[22px] rounded-[16px] shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
          <View className="flex-row items-center mb-2">
            <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-white/20 rounded-full items-center justify-center mr-4">
              <Feather name="arrow-left" size={20} color="white" />
            </TouchableOpacity>
            <Text className="font-title text-[24px] text-white leading-tight flex-1">Meus Artigos ✍️</Text>
          </View>
          <Text className="font-sans text-[15px] text-white/85 mt-2 leading-relaxed">
            Compartilhe sua expertise! Bons artigos aumentam sua visibilidade e autoridade na Yelo.
          </Text>
        </View>

        {/* WIDGET SUGESTÕES */}
        <View className="mx-6 mb-8 bg-white p-5 rounded-[20px] shadow-[0_4px_15px_rgba(245,158,11,0.05)] border border-[#e5e7eb]">
          <View className="flex-row items-center mb-3">
            <View className="w-[40px] h-[40px] bg-[#fef3c7] rounded-[10px] items-center justify-center mr-3">
              <Text className="text-[20px]">💡</Text>
            </View>
            <Text className="font-title text-[#b45309] text-[20px]">Temas em Alta</Text>
          </View>
          <Text className="font-sans text-[#92400e] text-[14px] mb-4 leading-relaxed">
            Inspire-se nos assuntos mais buscados pelos pacientes na plataforma para criar seu próximo artigo.
          </Text>
          
          <View className="flex-col gap-2">
            <TouchableOpacity className="bg-[#f9fafb] border border-[#e9ecef] px-4 py-3 rounded-[12px] flex-row items-center">
              <Text className="mr-2">✍️</Text>
              <Text className="text-[#333] font-bold text-[14px]">Transtorno de Ansiedade Generalizada</Text>
            </TouchableOpacity>
            <TouchableOpacity className="bg-[#f9fafb] border border-[#e9ecef] px-4 py-3 rounded-[12px] flex-row items-center">
              <Text className="mr-2">✍️</Text>
              <Text className="text-[#333] font-bold text-[14px]">Síndrome de Burnout</Text>
            </TouchableOpacity>
            <TouchableOpacity className="bg-[#f9fafb] border border-[#e9ecef] px-4 py-3 rounded-[12px] flex-row items-center">
              <Text className="mr-2">✍️</Text>
              <Text className="text-[#333] font-bold text-[14px]">Terapia de Casal na Era Digital</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* LISTA DE ARTIGOS */}
        <View className="px-6 mb-8">
          <View className="mb-6">
            <View className="flex-row items-center mb-4">
              <View className="w-[35px] h-[35px] bg-[#e8f5e9] rounded-[10px] items-center justify-center mr-3">
                <Text className="text-[18px]">📚</Text>
              </View>
              <Text className="font-title text-[#1B4332] text-[22px]">Seus Publicados</Text>
            </View>
            <TouchableOpacity 
              onPress={() => setModalVisible(true)}
              className="bg-[#1B4332] rounded-[50px] flex-row items-center justify-center py-2 px-5 self-start shadow-[0_4px_15px_rgba(27,67,50,0.15)]"
            >
              <Text className="text-white text-[18px] mr-1 mb-0.5">+</Text>
              <Text className="font-sans text-white text-[14px] font-bold">Escrever Novo</Text>
            </TouchableOpacity>
          </View>

          {MOCK_ARTICLES.map((article) => (
            <View key={article.id} className="bg-white border border-[#e9ecef] rounded-[16px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-4">
              <Text className="font-title text-[#1B4332] text-[18px] mb-2">{article.title}</Text>
              
              <View className="flex-row items-center justify-start mt-1 mb-4 gap-4">
                <Text className="font-sans text-[#666] text-[13px]">📅 {article.date}</Text>
                <View className="flex-row items-center">
                  <Text className="text-[13px]">❤️ </Text>
                  <Text className="font-sans font-bold text-[#e63946] text-[13px]">{article.views}</Text>
                </View>
              </View>
              
              <View className="flex-row gap-2 border-t border-[#eee] pt-4">
                <TouchableOpacity className="flex-1 bg-[#f0fdf4] py-3 rounded-full items-center flex-row justify-center">
                  <Text className="mr-2">✏️</Text>
                  <Text className="font-sans text-[#1B4332] text-[14px] font-bold">Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity className="flex-1 bg-[#ffebee] py-3 rounded-full items-center flex-row justify-center">
                  <Text className="mr-2">🗑️</Text>
                  <Text className="font-sans text-[#d32f2f] text-[14px] font-bold">Excluir</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          
          <View className="items-center mt-5">
            <TouchableOpacity className="bg-transparent border border-[#ccc] px-6 py-2.5 rounded-[50px]">
              <Text className="font-sans font-bold text-[#666]">Mostrar mais</Text>
            </TouchableOpacity>
          </View>
        </View>
      </YeloScrollView>

      {/* MODAL: NOVO ARTIGO */}
      <Modal 
        visible={modalVisible} 
        animationType="slide" 
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
        onDismiss={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-white">
          
          <View className="flex-row justify-between items-center p-5 border-b border-transparent bg-white">
            <View className="w-12 h-1 bg-gray-300 rounded-full absolute top-2 left-1/2 -ml-6" />
            <TouchableOpacity onPress={() => setModalVisible(false)} className="w-[40px] h-[40px] items-center justify-center rounded-full bg-[#f1f3f5] ml-auto">
              <Feather name="x" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          <YeloScrollView className="flex-1 px-6">
            <View className="flex-row items-center mb-6">
              <View className="w-[50px] h-[50px] bg-[#f0fdf4] rounded-full items-center justify-center mr-4 shadow-[0_4px_10px_rgba(27,67,50,0.05)]">
                <Text className="text-[24px]">📝</Text>
              </View>
              <View>
                <Text className="font-title text-[#1B4332] text-[24px]">Novo Artigo</Text>
                <Text className="font-sans text-[#666] text-[14px] mt-0.5">Escreva sobre sua especialidade e conquiste pacientes.</Text>
              </View>
            </View>

            <View className="mb-4">
              <Text className="font-bold text-[#495057] text-[12px] uppercase mb-1.5 ml-2">Título do Artigo *</Text>
              <TextInput 
                value={newTitle}
                onChangeText={setNewTitle}
                maxLength={50}
                placeholder="Ex: A importância da terapia..."
                className="bg-[#f9fafb] border border-[#ccc] rounded-full px-5 py-3.5 font-sans text-[15px] text-[#333]"
              />
              <Text className="text-right text-[#666] text-[12px] mt-1 mr-2">{newTitle.length}/50 caracteres</Text>
            </View>

            <View className="mb-5">
              <Text className="font-bold text-[#495057] text-[12px] uppercase mb-1.5 ml-2">Capa do Artigo</Text>
              <TouchableOpacity 
                onPress={handleImagePicker}
                className="bg-[#f9fafb] border border-[#ccc] rounded-full px-5 py-3.5 flex-row justify-between items-center"
              >
                <Text className="font-sans text-[#666] text-[15px]" numberOfLines={1}>
                  📎 {selectedImage ? selectedImage : 'Nenhuma imagem selecionada...'}
                </Text>
                {selectedImage && (
                  <TouchableOpacity onPress={() => setSelectedImage(null)}>
                    <Feather name="x" size={18} color="#d32f2f" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            </View>

            <View className="mb-6">
              <Text className="font-bold text-[#495057] text-[12px] uppercase mb-1.5 ml-2">Conteúdo *</Text>
              <View className="bg-white border border-[#ccc] rounded-[24px] min-h-[250px] p-0 overflow-hidden">
                <TextInput 
                  value={newContent}
                  onChangeText={setNewContent}
                  placeholder="Comece a escrever seu artigo aqui..."
                  multiline
                  textAlignVertical="top"
                  className="flex-1 font-sans text-[16px] text-[#333] leading-relaxed p-4 bg-[#fff]"
                />
              </View>
            </View>
          </YeloScrollView>

          {/* Footer Actions (Simulando web modal-footer) */}
          <View className="border-t border-[#eee] bg-white p-5 flex-row justify-between items-center flex-wrap gap-y-4">
            <TouchableOpacity className="bg-[#dcfce7] border border-[#bbf7d0] rounded-[50px] px-4 py-2.5 flex-row items-center shadow-sm">
              <Text className="text-[14px] mr-1.5">✨</Text>
              <Text className="font-bold text-[#166534] text-[13px]">Otimizar Artigo (IA)</Text>
            </TouchableOpacity>

            <View className="flex-row items-center gap-2 flex-1 justify-end">
              <TouchableOpacity onPress={() => setModalVisible(false)} className="bg-transparent border border-[#ccc] px-4 py-2.5 rounded-[50px]">
                <Text className="font-sans font-bold text-[#666] text-[14px]">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-[#1B4332] px-5 py-2.5 rounded-[50px] shadow-[0_4px_15px_rgba(27,67,50,0.2)]">
                <Text className="font-sans font-bold text-white text-[14px]">Publicar Artigo</Text>
              </TouchableOpacity>
            </View>
          </View>

        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}
