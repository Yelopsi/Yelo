import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  TextInput, 
  Image, 
  Platform, 
  KeyboardAvoidingView, 
  ActivityIndicator, 
  Alert 
} from 'react-native';
import YeloScrollView from '../../components/YeloScrollView';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';

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

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isOptimizingBio, setIsOptimizingBio] = useState(false);
  const [isSyncingGoogle, setIsSyncingGoogle] = useState(false);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);

  // Estados dos blocos sanfona e edição
  const [activeBlock, setActiveBlock] = useState<string | null>('personal');
  const [editMode, setEditMode] = useState<{ [key: string]: boolean }>({});

  const [form, setForm] = useState({
    nome: '',
    crp: '',
    telefone: '',
    cpf: '',
    cep: '',
    cidade: '',
    uf: '',
    slug: '',
    bio: '',
    ano_inicio: '',
    valor_sessao: '',
    instagram: '',
    linkedin: '',
    tiktok: '',
    google_business_url: '',
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setIsLoading(true);
        const res = await api.get('/api/psychologists/me');
        const p = res.data;
        if (p) {
          setForm({
            nome: p.nome || '',
            crp: p.crp || '',
            telefone: p.telefone || '',
            cpf: p.cpf || '',
            cep: p.cep || '',
            cidade: p.cidade || '',
            uf: p.estado || '',
            slug: p.slug || '',
            bio: p.bio || '',
            ano_inicio: p.ano_inicio_experiencia ? String(p.ano_inicio_experiencia) : '',
            valor_sessao: p.valor_sessao_numero ? String(p.valor_sessao_numero) : '',
            instagram: p.instagram_url ? p.instagram_url.replace('@', '') : '',
            linkedin: p.linkedin_url || '',
            tiktok: p.tiktok_url ? p.tiktok_url.replace('@', '') : '',
            google_business_url: p.google_business_url || '',
          });
          setFotoUrl(p.fotoUrl || null);
        }
      } catch (e) {
        console.error("Erro ao carregar perfil:", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const toggleBlock = (block: string) => {
    setActiveBlock(activeBlock === block ? null : block);
  };

  const setEditing = (block: string, isEditing: boolean) => {
    setEditMode(prev => ({ ...prev, [block]: isEditing }));
    if (isEditing) setActiveBlock(block);
  };

  const handleTextChange = (field: string, text: string, maskFn?: (val: string) => string) => {
    const formattedText = maskFn ? maskFn(text) : text;
    setForm(prev => ({ ...prev, [field]: formattedText }));
  };

  const handleSave = async (blockKey: string) => {
    try {
      setIsSaving(true);
      const payload: any = {};

      if (blockKey === 'personal') {
        payload.nome = form.nome;
        payload.cpf = form.cpf;
        payload.telefone = form.telefone;
        payload.crp = form.crp;
        payload.slug = form.slug;
      } else if (blockKey === 'location') {
        payload.cep = form.cep;
        payload.cidade = form.cidade;
        payload.estado = form.uf;
      } else if (blockKey === 'bio') {
        payload.bio = form.bio;
      } else if (blockKey === 'professional') {
        if (form.ano_inicio) {
          payload.ano_inicio_experiencia = parseInt(form.ano_inicio, 10);
        }
        if (form.valor_sessao) {
          payload.valor_sessao_numero = parseFloat(form.valor_sessao.replace(',', '.'));
        }
      } else if (blockKey === 'social') {
        payload.instagram_url = form.instagram;
        payload.linkedin_url = form.linkedin;
        payload.tiktok_url = form.tiktok;
      }

      await api.put('/api/psychologists/me', payload);
      Alert.alert('Sucesso', 'Informações atualizadas com sucesso!');
      setEditing(blockKey, false);
    } catch (e: any) {
      Alert.alert('Erro', e.response?.data?.error || 'Erro ao salvar alterações.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOptimizeBio = async () => {
    if (!form.bio || form.bio.length < 20) {
      Alert.alert("Aviso", "Escreva pelo menos um rascunho na bio antes de solicitar a otimização com IA.");
      return;
    }
    try {
      setIsOptimizingBio(true);
      const res = await api.post('/api/psychologists/me/optimize-bio', { bio: form.bio });
      if (res.data?.optimizedBio) {
        setForm(prev => ({ ...prev, bio: res.data.optimizedBio }));
        Alert.alert("Bio Otimizada ✨", "Sua biografia foi refinada com foco em conexão e conversão. Lembre-se de salvar!");
      }
    } catch (e) {
      Alert.alert("Erro", "Não foi possível otimizar a bio no momento.");
    } finally {
      setIsOptimizingBio(false);
    }
  };

  const handleSyncGoogleReviews = async () => {
    if (!form.google_business_url.trim()) {
      Alert.alert("Aviso", "Por favor, insira o link do seu perfil no Google Maps ou Google Meu Negócio.");
      return;
    }
    try {
      setIsSyncingGoogle(true);
      const res = await api.post('/api/psychologists/me/sync-google-reviews', {
        google_business_url: form.google_business_url.trim()
      });
      if (res.data?.success) {
        Alert.alert("Sincronizado! ⭐", res.data.message || "Suas avaliações do Google Meu Negócio foram importadas para o seu perfil Yelo!");
      }
    } catch (e: any) {
      Alert.alert("Erro", e.response?.data?.error || "Não foi possível validar o link do Google Meu Negócio.");
    } finally {
      setIsSyncingGoogle(false);
    }
  };

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
          <View className={`flex-row items-center border rounded-[12px] overflow-hidden ${isEditable ? 'bg-white border-[#1B4332]' : 'bg-[#f1f3f5] border-[#e0e0e0]'}`}>
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
            className={`border rounded-[12px] px-4 py-3.5 font-sans text-[15px] ${isEditable ? 'bg-white border-[#1B4332] text-[#333]' : 'bg-[#f1f3f5] border-[#e0e0e0] text-[#888]'}`}
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
            <TouchableOpacity 
              onPress={() => setEditing(blockKey, false)} 
              disabled={isSaving}
              className="px-3 py-1.5 border border-[#ccc] rounded-[50px]"
            >
              <Text className="font-sans font-bold text-[#666] text-[12px]">Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => handleSave(blockKey)} 
              disabled={isSaving}
              className="px-4 py-1.5 bg-[#1B4332] rounded-[50px] flex-row items-center justify-center"
            >
              {isSaving ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text className="font-sans font-bold text-white text-[12px]">Salvar</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            onPress={() => setEditing(blockKey, true)} 
            className="px-4 py-1.5 bg-white border border-[#e0e0e0] rounded-[50px] shadow-sm"
          >
            <Text className="font-sans font-bold text-[#444] text-[12px]">Editar</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#f9fafb] items-center justify-center p-6">
        <ActivityIndicator size="large" color="#1B4332" />
        <Text className="font-sans text-[#666] mt-4">Carregando seus dados...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <YeloScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          
          <View className="mx-6 mt-6 mb-6 flex-row items-center">
            <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-white border border-[#e0e0e0] rounded-full items-center justify-center mr-4 shadow-sm">
              <Feather name="arrow-left" size={20} color="#1B4332" />
            </TouchableOpacity>
            <Text className="font-title text-[22px] text-[#1B4332] flex-1">Editar Perfil</Text>
          </View>

          {/* HERO MODERN */}
          <View className="mx-6 bg-white border border-[#f0f0f0] rounded-[24px] p-6 mb-6 flex-col shadow-sm">
            <View className="flex-row items-center mb-5">
              <View className="relative w-[80px] h-[80px] mr-5">
                <Image 
                  source={{ uri: fotoUrl || 'https://placehold.co/200x200/1B4332/FFF?text=PSI' }} 
                  className="w-full h-full rounded-full border-2 border-[#1B4332]" 
                />
              </View>
              <View className="flex-1">
                <Text className="font-title text-[#1B4332] text-[20px] mb-1">{form.nome || 'Psicólogo(a)'}</Text>
                <Text className="font-sans text-[#666] text-[13px] mb-2">CRP {form.crp || 'Não informado'}</Text>
                <View className="bg-[#e8f5e9] border border-[#c8e6c9] px-3 py-1 rounded-full self-start">
                  <Text className="font-sans font-bold text-[#166534] text-[11px] uppercase tracking-wide">Perfil Ativo</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity 
              onPress={() => router.push(`/${form.slug}` as any)}
              className="bg-[#FFEE8C] py-3 rounded-full items-center shadow-sm"
            >
              <Text className="font-sans font-bold text-[#1B4332] text-[13px] uppercase tracking-wide">
                Ver Como Paciente Vê Perfil 👁️
              </Text>
            </TouchableOpacity>
          </View>

          {/* SANFONAS DE CONFIGURAÇÃO */}
          <View className="mx-6 gap-4">
            
            {/* BLOCO 1: DADOS BÁSICOS */}
            <View className="bg-white border border-[#e5e7eb] rounded-[20px] overflow-hidden shadow-sm">
              {renderBlockHeader('personal', 'Dados Pessoais')}
              {activeBlock === 'personal' && (
                <View className="p-5">
                  {renderInput('personal', 'nome', 'Nome Completo', 'Seu nome')}
                  {renderInput('personal', 'crp', 'CRP', '00/00000', 'default', false, '', formatCRP)}
                  {renderInput('personal', 'telefone', 'WhatsApp / Telefone', '(00) 00000-0000', 'phone-pad', false, '', formatPhone)}
                  {renderInput('personal', 'cpf', 'CPF', '000.000.000-00', 'number-pad', false, '', formatCPF)}
                  {renderInput('personal', 'slug', 'Link Personalizado (Slug)', 'seu-nome', 'default', true, 'yelopsi.com.br/')}
                </View>
              )}
            </View>

            {/* BLOCO 2: LOCALIZAÇÃO */}
            <View className="bg-white border border-[#e5e7eb] rounded-[20px] overflow-hidden shadow-sm">
              {renderBlockHeader('location', 'Endereço e Atendimento')}
              {activeBlock === 'location' && (
                <View className="p-5">
                  {renderInput('location', 'cep', 'CEP', '00000-000', 'number-pad', false, '', formatCEP, 9)}
                  {renderInput('location', 'cidade', 'Cidade', 'Ex: São Paulo')}
                  {renderInput('location', 'uf', 'Estado (UF)', 'Ex: SP', 'default', false, '', undefined, 2)}
                </View>
              )}
            </View>

            {/* BLOCO 3: BIOGRAFIA COM IA */}
            <View className="bg-white border border-[#e5e7eb] rounded-[20px] overflow-hidden shadow-sm">
              {renderBlockHeader('bio', 'Biografia Clínica')}
              {activeBlock === 'bio' && (
                <View className="p-5">
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="font-sans font-bold text-[#495057] text-[13px] ml-1">Sobre Mim</Text>
                    {editMode['bio'] && (
                      <TouchableOpacity 
                        onPress={handleOptimizeBio}
                        disabled={isOptimizingBio}
                        className="bg-[#f0fdf4] border border-[#bbf7d0] px-3 py-1 rounded-full flex-row items-center gap-1"
                      >
                        {isOptimizingBio ? (
                          <ActivityIndicator size="small" color="#166534" />
                        ) : (
                          <Text className="font-sans font-bold text-[#166534] text-[11px]">Otimizar com IA ✨</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                  <TextInput 
                    multiline 
                    numberOfLines={6}
                    value={form.bio}
                    editable={editMode['bio']}
                    onChangeText={(t) => handleTextChange('bio', t)}
                    placeholder="Conte sobre sua trajetória, escuta e como apoia seus pacientes..."
                    className={`border rounded-[14px] p-4 font-sans text-[15px] leading-6 ${editMode['bio'] ? 'bg-white border-[#1B4332] text-[#333]' : 'bg-[#f1f3f5] border-[#e0e0e0] text-[#777]'}`}
                    style={{ minHeight: 140, textAlignVertical: 'top' }}
                  />
                </View>
              )}
            </View>

            {/* BLOCO 4: VALOR E EXPERIÊNCIA */}
            <View className="bg-white border border-[#e5e7eb] rounded-[20px] overflow-hidden shadow-sm">
              {renderBlockHeader('professional', 'Valores e Experiência')}
              {activeBlock === 'professional' && (
                <View className="p-5">
                  {renderInput('professional', 'valor_sessao', 'Valor por Sessão', '150', 'numeric', true, 'R$')}
                  {renderInput('professional', 'ano_inicio', 'Ano de Início da Atuação Clínica', 'Ex: 2018', 'numeric', false, '', undefined, 4)}
                </View>
              )}
            </View>

            {/* BLOCO 5: REDES SOCIAIS */}
            <View className="bg-white border border-[#e5e7eb] rounded-[20px] overflow-hidden shadow-sm">
              {renderBlockHeader('social', 'Redes Sociais')}
              {activeBlock === 'social' && (
                <View className="p-5">
                  {renderInput('social', 'instagram', 'Instagram', 'usuario', 'default', true, '@')}
                  {renderInput('social', 'linkedin', 'LinkedIn', 'usuario', 'default', true, 'in/')}
                  {renderInput('social', 'tiktok', 'TikTok', 'usuario', 'default', true, '@')}
                </View>
              )}
            </View>

            {/* BLOCO 6: GOOGLE MEU NEGÓCIO & REVIEWS (Sincronização Oficial) */}
            <View className="bg-white border border-[#e5e7eb] rounded-[20px] overflow-hidden shadow-sm">
              <TouchableOpacity onPress={() => toggleBlock('google')} className="flex-row justify-between items-center p-5 bg-[#f9fafb] border-b border-[#e5e7eb]">
                <View className="flex-row items-center flex-1">
                  <Text className="text-[18px] mr-2">📍</Text>
                  <Text className="font-title text-[#1B4332] text-[18px] mr-2">Google Meu Negócio</Text>
                  <Feather name={activeBlock === 'google' ? 'chevron-up' : 'chevron-down'} size={20} color="#666" />
                </View>
              </TouchableOpacity>
              
              {activeBlock === 'google' && (
                <View className="p-5">
                  <Text className="font-sans text-[#555] text-[13px] mb-4 leading-5">
                    Conecte o link do seu perfil no Google Maps/Google Meu Negócio para exibir suas avaliações 5 estrelas diretamente no seu perfil Yelo.
                  </Text>
                  
                  <Text className="font-sans font-bold text-[#495057] text-[13px] mb-1.5 ml-1">Link do Google Maps / GMB</Text>
                  <TextInput 
                    placeholder="https://maps.google.com/?cid=... ou link g.page"
                    value={form.google_business_url}
                    onChangeText={(t) => handleTextChange('google_business_url', t)}
                    className="border border-[#e0e0e0] rounded-[12px] px-4 py-3.5 font-sans text-[14px] bg-white text-[#333] mb-4"
                  />

                  <TouchableOpacity
                    onPress={handleSyncGoogleReviews}
                    disabled={isSyncingGoogle}
                    className="bg-[#1B4332] py-3 rounded-full items-center justify-center shadow-sm"
                  >
                    {isSyncingGoogle ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text className="font-sans font-bold text-white text-[13px]">
                        Sincronizar Avaliações do Google ⭐
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>

          </View>

        </YeloScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
