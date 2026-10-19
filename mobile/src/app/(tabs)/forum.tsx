import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal, KeyboardAvoidingView, Platform, Image } from 'react-native';
import YeloScrollView from '../../components/YeloScrollView';

import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// Dados Mockados
const MOCK_POSTS = [
  { 
    id: 1, 
    author: 'Dra. Ana Silva', 
    category: 'Discussão de Casos', 
    time: 'há 2 horas', 
    title: 'Paciente reluta em aceitar diagnóstico de TDAH. Como conduzir?', 
    snippet: 'Estou atendendo um paciente de 35 anos que apresenta todos os critérios para TDAH adulto, mas fica extremamente defensivo ao ouvir a palavra. Alguém já passou por isso?', 
    votes: 24, 
    comments: 8,
    avatar: 'https://placehold.co/100x100/1B4332/FFF?text=AS',
    isAnonymous: false
  },
  { 
    id: 2, 
    author: 'Anônimo', 
    category: 'Burocracia e Legislação', 
    time: 'há 5 horas', 
    title: 'Novo modelo de Prontuário Eletrônico (CFP)', 
    snippet: 'Alguém já adaptou os prontuários para a nova resolução do CFP sobre armazenamento em nuvem? Queria indicações de softwares seguros e práticos.', 
    votes: 45, 
    comments: 15,
    avatar: 'https://placehold.co/100x100/1B4332/FFF?text=A',
    isAnonymous: true
  },
];

export default function ForumScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('recentes');
  const [modalVisible, setModalVisible] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <YeloScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
        
        {/* HEADER */}
        <View className="mx-6 mt-6 mb-6 bg-[#1B4332] p-[22px] rounded-[16px] shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
          <View className="flex-row items-center mb-2">
            <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-white/20 rounded-full items-center justify-center mr-4">
              <Feather name="arrow-left" size={20} color="white" />
            </TouchableOpacity>
            <Text className="font-title text-[24px] text-white leading-tight flex-1">Fórum da Comunidade 💬</Text>
          </View>
          <Text className="font-sans text-[15px] text-white/85 mt-2 leading-relaxed">
            Troque experiências, discuta casos e fortaleça sua rede de apoio com outros profissionais.
          </Text>
        </View>

        {/* REGRAS DA COMUNIDADE (OTIMIZADO MOBILE) */}
        <View className="mx-6 mb-7 bg-[#f0fdf4] border border-[#bbf7d0] p-4 rounded-[20px] shadow-[0_4px_15px_rgba(27,67,50,0.04)]">
          {/* Header do Card */}
          <View className="flex-row items-center justify-between pb-3 mb-3 border-b border-[#bbf7d0]/60">
            <View className="flex-row items-center gap-2.5">
              <View className="w-9 h-9 bg-white rounded-full items-center justify-center border border-[#dcfce7] shadow-sm">
                <Text className="text-[17px]">⚖️</Text>
              </View>
              <View>
                <Text className="font-sans font-bold text-[#1B4332] text-[15px] leading-tight">Regras da Comunidade</Text>
                <Text className="font-sans text-[#15803d] text-[11px] font-medium">Diretrizes de convivência ética</Text>
              </View>
            </View>
            <View className="bg-[#dcfce7] border border-[#bbf7d0] px-2.5 py-0.5 rounded-full">
              <Text className="text-[#15803d] text-[10px] font-bold uppercase tracking-wider">Diretrizes</Text>
            </View>
          </View>

          {/* Lista de Regras */}
          <View className="gap-2.5">
            <View className="flex-row items-start">
              <Text className="text-[#16a34a] font-black text-[14px] mr-2 leading-none mt-0.5">•</Text>
              <Text className="flex-1 font-sans text-[#334155] text-[12.5px] leading-relaxed">
                <Text className="font-bold text-[#1B4332]">Respeito acima de tudo:</Text> Debates são bem-vindos; ataques pessoais não serão tolerados.
              </Text>
            </View>

            <View className="flex-row items-start">
              <Text className="text-[#16a34a] font-black text-[14px] mr-2 leading-none mt-0.5">•</Text>
              <Text className="flex-1 font-sans text-[#334155] text-[12.5px] leading-relaxed">
                <Text className="font-bold text-[#1B4332]">Sigilo inegociável:</Text> Ao discutir casos clínicos, sempre anonimize completamente dados dos pacientes.
              </Text>
            </View>

            <View className="flex-row items-start">
              <Text className="text-[#16a34a] font-black text-[14px] mr-2 leading-none mt-0.5">•</Text>
              <Text className="flex-1 font-sans text-[#334155] text-[12.5px] leading-relaxed">
                <Text className="font-bold text-[#1B4332]">Conteúdo construtivo:</Text> Evite autopromoção e spam. O foco é a troca mútua de conhecimento e apoio mútuo.
              </Text>
            </View>

            {/* Regra de Proibição de Concorrentes em destaque */}
            <View className="bg-[#fffbeb] border border-[#fde68a] p-2.5 rounded-[12px] flex-row items-start">
              <Text className="text-[#d97706] font-black text-[14px] mr-2 leading-none mt-0.5">•</Text>
              <Text className="flex-1 font-sans text-[#78350f] text-[12px] leading-relaxed">
                <Text className="font-bold text-[#92400e]">Sem divulgação de concorrentes:</Text> É proibida a promoção, divulgação ou recomendação de plataformas e ferramentas concorrentes à Yelo.
              </Text>
            </View>

            <View className="flex-row items-start">
              <Text className="text-[#16a34a] font-black text-[14px] mr-2 leading-none mt-0.5">•</Text>
              <Text className="flex-1 font-sans text-[#334155] text-[12.5px] leading-relaxed">
                <Text className="font-bold text-[#1B4332]">Direitos Humanos:</Text> Discursos de ódio ou violações éticas resultarão em banimento.
              </Text>
            </View>
          </View>
        </View>

        {/* WIDGET CONTROLS (Busca e Abas) */}
        <View className="mx-6 mb-6 bg-white border border-[#e5e7eb] rounded-[24px] p-[20px] shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
          
          <View className="flex-row items-center bg-[#f9fafb] border border-[#e0e0e0] rounded-[50px] px-5 py-3.5 mb-5">
            <Feather name="search" size={18} color="#888" />
            <TextInput 
              placeholder="Buscar por título ou palavra-chave..."
              className="flex-1 font-sans text-[15px] text-[#333] ml-3"
              placeholderTextColor="#999"
            />
          </View>

          <YeloScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row border-b border-[#eee]">
            {[
              { id: 'populares', label: 'Populares' },
              { id: 'recentes', label: 'Recentes' },
              { id: 'meus_posts', label: 'Meus Posts' }
            ].map((tab) => (
              <TouchableOpacity 
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                className={`mr-4 pb-2 border-b-2 ${activeTab === tab.id ? 'border-[#1B4332]' : 'border-transparent'}`}
              >
                <Text className={`font-sans text-[15px] ${activeTab === tab.id ? 'font-bold text-[#1B4332]' : 'font-medium text-[#666]'}`}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </YeloScrollView>

          {/* CREATE POST PROMPT */}
          <TouchableOpacity 
            onPress={() => setModalVisible(true)}
            className="flex-row items-center bg-white border border-[#e9ecef] rounded-[12px] p-3.5 mt-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)]"
          >
            <Image source={{ uri: 'https://res.cloudinary.com/dzqmypviz/image/upload/v1779824708/yelo/profiles/profile-94.jpg' }} className="w-[35px] h-[35px] rounded-full mr-3" />
            <View className="flex-1 bg-[#f8f9fa] py-2.5 px-4 rounded-[25px]">
              <Text className="font-sans text-[#888] text-[14px]">Compartilhe um caso, dúvida ou insight...</Text>
            </View>
          </TouchableOpacity>

          {/* FEED DE POSTS */}
          <View className="mt-5">
            {MOCK_POSTS.map((post) => (
              <View key={post.id} className="bg-white border border-[#e5e7eb] rounded-[16px] p-5 mb-4 shadow-sm">
                
                {/* Header (Reddit-style flattened) */}
                <View className="flex-row items-center flex-wrap gap-x-2 mb-3">
                  <Image source={{ uri: post.avatar }} className="w-[24px] h-[24px] rounded-full" />
                  <Text className="font-sans font-bold text-[#1B4332] text-[12px]">{post.category}</Text>
                  <Text className="font-sans text-[#888] text-[12px]">•</Text>
                  <Text className={`font-sans text-[12px] ${post.isAnonymous ? 'text-[#666] italic' : 'text-[#333]'}`}>
                    por {post.author}
                  </Text>
                  <Text className="font-sans text-[#888] text-[12px]">•</Text>
                  <Text className="font-sans text-[#888] text-[12px]">{post.time}</Text>
                </View>

                {/* Body */}
                <Text className="font-title text-[#222] text-[18px] mb-2 leading-snug">{post.title}</Text>
                <Text className="font-sans text-[#444] text-[15px] leading-relaxed mb-4">{post.snippet}</Text>

                {/* Footer Actions */}
                <View className="flex-row items-center justify-between border-t border-[#f1f3f5] pt-3">
                  
                  <View className="flex-row items-center gap-3">
                    <TouchableOpacity className="flex-row items-center bg-[#f9fafb] border border-[#e5e7eb] px-3 py-1.5 rounded-[50px]">
                      <Feather name="arrow-up" size={16} color="#444" />
                      <Text className="font-sans font-bold text-[#444] ml-1.5">{post.votes}</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity className="flex-row items-center bg-[#f9fafb] border border-[#e5e7eb] px-3 py-1.5 rounded-[50px]">
                      <Feather name="message-square" size={16} color="#444" />
                      <Text className="font-sans font-bold text-[#444] ml-1.5">{post.comments}</Text>
                    </TouchableOpacity>
                  </View>

                  <View className="flex-row items-center gap-4">
                    <TouchableOpacity>
                      <Feather name="flag" size={16} color="#888" />
                    </TouchableOpacity>
                  </View>

                </View>
              </View>
            ))}

            <TouchableOpacity className="bg-transparent border border-[#ccc] py-3 rounded-[50px] mt-2 items-center">
              <Text className="font-sans font-bold text-[#666] text-[14px]">Mostrar mais</Text>
            </TouchableOpacity>

          </View>
        </View>

      </YeloScrollView>

      {/* MODAL: NOVO POST */}
      <Modal 
        visible={modalVisible} 
        animationType="slide" 
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
        onDismiss={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-white">
          
          <View className="relative p-6 pb-2 border-b border-transparent bg-white items-center">
            <View className="w-12 h-1 bg-gray-300 rounded-full absolute top-2 left-1/2 -ml-6" />
            
            <TouchableOpacity onPress={() => setModalVisible(false)} className="absolute top-4 right-4 w-[36px] h-[36px] bg-[#f5f5f5] rounded-full items-center justify-center z-10">
              <Feather name="x" size={18} color="#666" />
            </TouchableOpacity>

            <View className="w-[40px] h-[40px] bg-[#e0f2fe] rounded-full items-center justify-center mt-2 mb-2 shadow-[0_4px_10px_rgba(2,132,199,0.1)]">
              <Text className="text-[20px]">🗣️</Text>
            </View>
            <Text className="font-title text-[#1B4332] text-[22px] mb-2">Nova Discussão</Text>
          </View>

          <YeloScrollView className="flex-1 px-6 pt-4">
            
            <View className="mb-4">
              <Text className="font-bold text-[#495057] text-[11px] uppercase tracking-wider mb-1.5 ml-2">Título</Text>
              <TextInput 
                placeholder="Ex: Dúvida sobre atendimento online..."
                maxLength={150}
                className="bg-[#f9fafb] border border-[#e0e0e0] rounded-[10px] px-4 py-3.5 font-sans text-[15px] text-[#333]"
              />
            </View>

            <View className="mb-4">
              <Text className="font-bold text-[#495057] text-[11px] uppercase tracking-wider mb-1.5 ml-2">Categoria</Text>
              <TouchableOpacity className="bg-[#f9fafb] border border-[#e0e0e0] rounded-[10px] px-4 py-3.5 flex-row justify-between items-center">
                <Text className="font-sans text-[15px] text-[#333]">Selecione um tema...</Text>
                <Feather name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <View className="bg-[#fffbeb] border border-[#fde68a] p-[10px] rounded-[10px] flex-row items-start gap-2 mb-4">
              <Text className="text-[18px]">⚠️</Text>
              <Text className="font-sans text-[#92400e] text-[13px] flex-1 leading-relaxed">
                <Text className="font-bold text-[#92400e]">Atenção ao Sigilo Profissional:</Text> Nunca cite nomes, locais ou dados que possam identificar seus pacientes.
              </Text>
            </View>

            <View className="mb-4">
              <Text className="font-bold text-[#495057] text-[11px] uppercase tracking-wider mb-1.5 ml-2">Conteúdo</Text>
              <View className="bg-[#f9fafb] border border-[#e0e0e0] rounded-[10px] min-h-[150px] p-0 overflow-hidden">
                <TextInput 
                  placeholder="Descreva com mais detalhes..."
                  multiline
                  textAlignVertical="top"
                  className="flex-1 font-sans text-[15px] text-[#333] leading-relaxed p-4 bg-transparent"
                />
              </View>
            </View>

            <TouchableOpacity 
              onPress={() => setIsAnonymous(!isAnonymous)}
              className="flex-row items-center gap-2 mt-2 mb-6"
            >
              <View className={`w-5 h-5 rounded border ${isAnonymous ? 'bg-[#1B4332] border-[#1B4332]' : 'bg-white border-[#ccc]'} items-center justify-center`}>
                {isAnonymous && <Feather name="check" size={14} color="white" />}
              </View>
              <Text className="font-sans font-bold text-[#495057] text-[14px]">Publicar como Anônimo</Text>
            </TouchableOpacity>

          </YeloScrollView>

          {/* Modal Footer */}
          <View className="p-5 pt-3 bg-white border-t border-[#eee] flex-row justify-end items-center gap-3">
            <TouchableOpacity 
              onPress={() => setModalVisible(false)} 
              className="bg-transparent border border-[#ccc] px-5 py-2.5 rounded-[50px]"
            >
              <Text className="font-sans font-bold text-[#666] text-[14px]">Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              className="bg-[#1B4332] px-5 py-2.5 rounded-[50px] shadow-[0_4px_15px_rgba(27,67,50,0.2)]"
            >
              <Text className="font-sans font-bold text-white text-[14px]">Publicar</Text>
            </TouchableOpacity>
          </View>

        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}
