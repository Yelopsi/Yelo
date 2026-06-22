import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Image, Platform, KeyboardAvoidingView } from 'react-native';
import YeloScrollView from '../../components/YeloScrollView';

import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// Funções de Máscara
const formatCPF = (text: string) => {
  return text.replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1');
};

const formatPhone = (text: string) => {
  const digits = text.replace(/\D/g, '');
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2').slice(0, 14);
  }
  return digits.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').slice(0, 15);
};

const formatCEP = (text: string) => {
  return text.replace(/\D/g, '')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .replace(/(-\d{3})\d+?$/, '$1');
};

const formatCRP = (text: string) => {
  return text.replace(/[^0-9/]/g, '')
    .replace(/^(\d{2})(\d)/, '$1/$2')
    .slice(0, 9);
};

export default function MeuPerfilScreen() {
  const router = useRouter();

  // Estados dos blocos sanfona e edição
  const [activeBlock, setActiveBlock] = useState<string | null>('personal');
  const [editMode, setEditMode] = useState<{ [key: string]: boolean }>({});

  // Valores mockados
  const [form, setForm] = useState({
    nome: 'Dra. Ana Silva',
    crp: '12/34567',
    telefone: '(11) 99999-9999',
    cpf: '123.456.789-00',
    cep: '01000-000',
    cidade: 'São Paulo',
    uf: 'SP',
    slug: 'ana-silva',
    bio: 'Sou a Dra. Ana, apaixonada por psicologia e por ajudar as pessoas a encontrarem seu caminho.',
    ano_inicio: '2018',
    valor_sessao: '150',
    instagram: 'draanasilva',
    linkedin: 'anasilva',
    tiktok: 'draanapsi',
  });

  const toggleBlock = (block: string) => {
    setActiveBlock(activeBlock === block ? null : block);
  };

  const setEditing = (block: string, isEditing: boolean) => {
    setEditMode(prev => ({ ...prev, [block]: isEditing }));
    // Quando entra em edição, já garante que a sanfona está aberta
    if (isEditing) setActiveBlock(block);
  };

  const handleTextChange = (field: string, text: string, maskFn?: (val: string) => string) => {
    const formattedText = maskFn ? maskFn(text) : text;
    setForm(prev => ({ ...prev, [field]: formattedText }));
  };

  // Renderizador de Input com suporte a editMode
  const renderInput = (
    blockKey: string,
    field: string,
    label: string, 
    placeholder: string, 
    keyboardType: any = 'default', 
    isPrefix = false, 
    prefix = '',
    maskFn?: (val: string) => string,
    maxLength?: number
  ) => {
    const isEditable = editMode[blockKey];
    const value = form[field as keyof typeof form];

    return (
      <View className="mb-4">
        <Text className="font-sans font-bold text-[#495057] text-[13px] mb-2 ml-1">{label}</Text>
        {isPrefix ? (
          <View className={`flex-row items-center border rounded-[12px] overflow-hidden ${isEditable ? 'bg-white border-[#1B4332] shadow-[0_0_0_2px_rgba(27,67,50,0.1)]' : 'bg-[#f1f3f5] border-[#e0e0e0]'}`}>
            <View className={`px-4 py-3.5 border-r ${isEditable ? 'bg-[#f8f9fa] border-[#e0e0e0]' : 'bg-[#e9ecef] border-[#d1d5db]'}`}>
              <Text className="font-sans font-medium text-[#555]">{prefix}</Text>
            </View>
            <TextInput 
              placeholder={placeholder}
              keyboardType={keyboardType}
              editable={isEditable}
              maxLength={maxLength}
              value={value}
              onChangeText={(t) => handleTextChange(field, t, maskFn)}
              className={`flex-1 font-sans text-[15px] px-4 py-3.5 ${isEditable ? 'text-[#333]' : 'text-[#888]'}`}
            />
          </View>
        ) : (
          <TextInput 
            placeholder={placeholder}
            keyboardType={keyboardType}
            editable={isEditable}
            maxLength={maxLength}
            value={value}
            onChangeText={(t) => handleTextChange(field, t, maskFn)}
            className={`border rounded-[12px] px-4 py-3.5 font-sans text-[15px] ${isEditable ? 'bg-white border-[#1B4332] text-[#333] shadow-[0_0_0_2px_rgba(27,67,50,0.1)]' : 'bg-[#f1f3f5] border-[#e0e0e0] text-[#888]'}`}
          />
        )}
      </View>
    );
  };

  const renderBlockHeader = (blockKey: string, title: string) => {
    const isEditing = editMode[blockKey];

    return (
      <View className="flex-row justify-between items-center p-5 bg-[#f9fafb] border-b border-[#e5e7eb]">
        <TouchableOpacity onPress={() => toggleBlock(blockKey)} className="flex-row items-center flex-1">
          <Text className="font-title text-[#1B4332] text-[18px] mr-2">{title}</Text>
          <Feather name={activeBlock === blockKey ? 'chevron-up' : 'chevron-down'} size={20} color="#666" />
        </TouchableOpacity>
        
        {isEditing ? (
          <View className="flex-row gap-2">
            <TouchableOpacity onPress={() => setEditing(blockKey, false)} className="px-3 py-1.5 border border-[#ccc] rounded-[50px]">
              <Text className="font-sans font-bold text-[#666] text-[12px]">Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEditing(blockKey, false)} className="px-3 py-1.5 bg-[#1B4332] rounded-[50px]">
              <Text className="font-sans font-bold text-white text-[12px]">Salvar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setEditing(blockKey, true)} className="px-4 py-1.5 bg-white border border-[#e0e0e0] rounded-[50px] shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
            <Text className="font-sans font-bold text-[#444] text-[12px]">Editar</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <YeloScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          
          <View className="mx-6 mt-6 mb-6 flex-row items-center">
            <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-white border border-[#e0e0e0] rounded-full items-center justify-center mr-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
              <Feather name="arrow-left" size={20} color="#1B4332" />
            </TouchableOpacity>
            <Text className="font-title text-[22px] text-[#1B4332] flex-1">Editar Perfil</Text>
          </View>

          {/* HERO MODERN */}
          <View className="mx-6 bg-white border border-[#f0f0f0] rounded-[24px] p-6 mb-6 flex-col shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
            <View className="flex-row items-center mb-5">
              <View className="relative w-[80px] h-[80px] mr-5">
                <Image source={{ uri: 'https://res.cloudinary.com/dzqmypviz/image/upload/v1779824708/yelo/profiles/profile-94.jpg' }} className="w-full h-full rounded-full border-2 border-[#1B4332]" />
                <View className="absolute bottom-0 right-0 bg-[#1B4332] w-[26px] h-[26px] rounded-full items-center justify-center border-2 border-white">
                  <Feather name="camera" size={12} color="white" />
                </View>
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[22px] mb-1">Dra. Ana Silva</Text>
                <View className="bg-[#dcfce7] self-start px-3 py-1 rounded-[20px] border border-[#bbf7d0] mb-1">
                  <Text className="font-sans font-bold text-[#166534] text-[11px]">Perfil Ativo</Text>
                </View>
                <Text className="font-sans text-[#666] text-[13px]">🔗 yelopsi.com.br/ana-silva</Text>
              </View>
            </View>
            <View className="flex-row gap-3">
              <TouchableOpacity className="flex-1 bg-[#f1f3f5] py-3 rounded-[50px] items-center">
                <Text className="font-sans font-bold text-[#444] text-[14px]">Copiar Link</Text>
              </TouchableOpacity>
              <TouchableOpacity className="flex-1 bg-[#1B4332] py-3 rounded-[50px] items-center">
                <Text className="font-sans font-bold text-white text-[14px]">Ver Perfil Público</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* INSIGHTS */}
          <View className="px-6 mb-6">
            <View className="bg-white border border-[#f0f0f0] rounded-[24px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)] mb-5">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="font-title text-[#1B4332] text-[18px]">Qualidade do Perfil</Text>
                <View className="bg-[#1B4332] px-3 py-1.5 rounded-[20px]">
                  <Text className="font-sans font-bold text-white text-[12px]">85/100</Text>
                </View>
              </View>
              <View className="h-2 bg-[#f1f3f5] rounded-[4px] mb-4 overflow-hidden">
                <View className="h-full bg-[#1B4332] w-[85%]" />
              </View>
              <Text className="font-sans text-[#555] text-[13px]">✅ Adicione uma biografia completa para chegar a 100%.</Text>
            </View>

            <View className="bg-white border border-[#f0f0f0] rounded-[24px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
              <View className="flex-row justify-between items-center mb-5">
                <Text className="font-title text-[#1B4332] text-[18px]">Desempenho (30d)</Text>
                <Text className="font-sans font-bold text-[#1B4332] text-[13px]">Ver detalhes</Text>
              </View>
              <View className="flex-row justify-between">
                <View className="items-center">
                  <Text className="font-title text-[#1B4332] text-[28px] mb-1">124</Text>
                  <Text className="font-sans font-bold text-[#666] text-[10px] uppercase">Visualizações</Text>
                </View>
                <View className="items-center">
                  <Text className="font-title text-[#1B4332] text-[28px] mb-1">12</Text>
                  <Text className="font-sans font-bold text-[#666] text-[10px] uppercase">Cliques Whats</Text>
                </View>
                <View className="items-center">
                  <Text className="font-title text-[#1B4332] text-[28px] mb-1">5</Text>
                  <Text className="font-sans font-bold text-[#666] text-[10px] uppercase">Favoritos</Text>
                </View>
              </View>
            </View>
          </View>

          {/* FORMULÁRIOS COM EDIÇÃO E MÁSCARAS */}
          <View className="px-6">
            
            {/* Bloco 1: Dados Pessoais */}
            <View className={`bg-white border ${editMode['personal'] ? 'border-[#1B4332]' : 'border-[#e5e7eb]'} rounded-[16px] mb-4 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.03)]`}>
              {renderBlockHeader('personal', 'Dados Pessoais')}
              {activeBlock === 'personal' && (
                <View className="p-5">
                  {renderInput('personal', 'nome', 'Nome de Exibição *', 'Seu nome')}
                  {renderInput('personal', 'crp', 'Número do CRP *', '00/00000', 'numeric', false, '', formatCRP, 9)}
                  {renderInput('personal', 'telefone', 'WhatsApp Profissional *', '(00) 00000-0000', 'phone-pad', false, '', formatPhone, 15)}
                  {renderInput('personal', 'cpf', 'CPF *', '000.000.000-00', 'numeric', false, '', formatCPF, 14)}
                </View>
              )}
            </View>

            {/* Bloco 2: Localização */}
            <View className={`bg-white border ${editMode['location'] ? 'border-[#1B4332]' : 'border-[#e5e7eb]'} rounded-[16px] mb-4 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.03)]`}>
              {renderBlockHeader('location', 'Localização')}
              {activeBlock === 'location' && (
                <View className="p-5">
                  {renderInput('location', 'cep', 'CEP *', '00000-000', 'numeric', false, '', formatCEP, 9)}
                  <View className="flex-row gap-3">
                    <View className="flex-1">{renderInput('location', 'cidade', 'Cidade *', 'São Paulo')}</View>
                    <View className="w-[80px]">{renderInput('location', 'uf', 'UF *', 'SP')}</View>
                  </View>
                </View>
              )}
            </View>

            {/* Bloco 3: Detalhes Profissionais */}
            <View className={`bg-white border ${editMode['professional'] ? 'border-[#1B4332]' : 'border-[#e5e7eb]'} rounded-[16px] mb-4 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.03)]`}>
              {renderBlockHeader('professional', 'Detalhes Profissionais')}
              {activeBlock === 'professional' && (
                <View className="p-5">
                  {renderInput('professional', 'slug', '🔗 Link do Perfil', 'seu-nome', 'default', true, 'yelopsi.com.br/')}
                  
                  <View className="mb-4 mt-2">
                    <Text className="font-sans font-bold text-[#495057] text-[13px] mb-2 ml-1">Biografia / Sobre Mim *</Text>
                    <TextInput 
                      multiline
                      numberOfLines={5}
                      textAlignVertical="top"
                      placeholder="Escreva um texto acolhedor..."
                      editable={editMode['professional']}
                      value={form.bio}
                      onChangeText={(t) => handleTextChange('bio', t)}
                      className={`border rounded-[12px] p-4 font-sans text-[15px] min-h-[120px] ${editMode['professional'] ? 'bg-white border-[#1B4332] text-[#333] shadow-[0_0_0_2px_rgba(27,67,50,0.1)]' : 'bg-[#f1f3f5] border-[#e0e0e0] text-[#888]'}`}
                    />
                    <View className="flex-row justify-between items-center mt-2">
                      {editMode['professional'] ? (
                        <TouchableOpacity className="flex-row items-center bg-[#dcfce7] border border-[#bbf7d0] px-3 py-1.5 rounded-[50px]">
                          <Text className="font-sans font-bold text-[#166534] text-[12px]">✨ Otimizar com IA</Text>
                        </TouchableOpacity>
                      ) : <View />}
                      <Text className="font-sans text-[#999] text-[12px]">{form.bio.length} / 500</Text>
                    </View>
                  </View>

                  <View className="flex-row gap-3">
                    <View className="flex-1">{renderInput('professional', 'ano_inicio', 'Ano Início', '2018', 'numeric', false, '', undefined, 4)}</View>
                    <View className="flex-1">{renderInput('professional', 'valor_sessao', 'Valor Sessão', '150', 'numeric', true, 'R$')}</View>
                  </View>
                </View>
              )}
            </View>

            {/* Bloco 4: Redes Sociais */}
            <View className={`bg-white border ${editMode['social'] ? 'border-[#1B4332]' : 'border-[#e5e7eb]'} rounded-[16px] mb-4 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.03)]`}>
              {renderBlockHeader('social', 'Redes Sociais')}
              {activeBlock === 'social' && (
                <View className="p-5">
                  {renderInput('social', 'instagram', 'Instagram', 'usuario', 'default', true, '@')}
                  {renderInput('social', 'linkedin', 'LinkedIn', 'usuario', 'default', true, 'in/')}
                  {renderInput('social', 'tiktok', 'TikTok', 'usuario', 'default', true, '@')}
                </View>
              )}
            </View>

          </View>

          {/* DANGER ZONE */}
          <View className="px-6 mt-6">
            {/* Alterar Senha (Collapsible) */}
            <View className="bg-white border border-[#e5e7eb] rounded-[16px] mb-4 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
              <TouchableOpacity onPress={() => toggleBlock('password')} className="flex-row justify-between items-center p-5 bg-[#f9fafb]">
                <Text className="font-title text-[#1B4332] text-[18px]">Alterar Senha</Text>
                <Feather name={activeBlock === 'password' ? 'chevron-up' : 'chevron-down'} size={20} color="#666" />
              </TouchableOpacity>
              
              {activeBlock === 'password' && (
                <View className="p-5 border-t border-[#e5e7eb]">
                  <View className="mb-4">
                    <Text className="font-sans font-bold text-[#495057] text-[13px] mb-2 ml-1">Senha Atual</Text>
                    <TextInput secureTextEntry className="bg-white border border-[#e0e0e0] rounded-[12px] px-4 py-3.5 font-sans text-[15px] text-[#333]" />
                  </View>
                  
                  <View className="mb-4">
                    <Text className="font-sans font-bold text-[#495057] text-[13px] mb-2 ml-1">Nova Senha</Text>
                    <TextInput secureTextEntry className="bg-white border border-[#e0e0e0] rounded-[12px] px-4 py-3.5 font-sans text-[15px] text-[#333]" />
                  </View>

                  <TouchableOpacity className="bg-[#1B4332] py-3.5 rounded-[50px] items-center mt-2 shadow-[0_4px_15px_rgba(27,67,50,0.2)]">
                    <Text className="font-sans font-bold text-white text-[15px]">Atualizar Senha</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View className="bg-[#fff1f2] border border-[#ffe4e6] rounded-[16px] p-5">
              <Text className="font-title text-[#e63946] text-[18px] mb-2">Excluir Conta</Text>
              <Text className="font-sans text-[#666] text-[14px] mb-4 leading-relaxed">
                Esta ação é irreversível e removerá todos os seus dados da plataforma.
              </Text>
              <TouchableOpacity className="border border-[#e63946] py-3.5 rounded-[50px] items-center bg-white">
                <Text className="font-sans font-bold text-[#e63946] text-[15px]">Excluir Minha Conta</Text>
              </TouchableOpacity>
            </View>
          </View>

        </YeloScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
