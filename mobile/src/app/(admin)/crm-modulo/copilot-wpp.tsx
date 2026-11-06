import React, { useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  TextInput, 
  Alert, 
  Linking,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import api from '../../../services/api';
import YeloToast from '../../../components/YeloToast';

export default function AdminCopilotWppScreen() {
  const [pastedChat, setPastedChat] = useState('');
  const [selectedTone, setSelectedTone] = useState<'amigavel' | 'direto' | 'vendedor' | 'empatico'>('amigavel');
  const [isLoading, setIsLoading] = useState(false);

  const [dossier, setDossier] = useState<any>(null);
  const [generatedReply, setGeneratedReply] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  const handleGenerateResponse = async () => {
    if (!pastedChat.trim()) {
      Alert.alert('Atenção', 'Cole o texto da conversa do WhatsApp no campo indicado.');
      return;
    }

    try {
      setIsLoading(true);
      setGeneratedReply(null);
      setDossier(null);

      // Primeiro identifica o psicólogo para montar o dossiê
      try {
        const idRes = await api.post('/api/admin/copilot/identify', { pastedChat });
        if (idRes.data?.dossier) {
          setDossier(idRes.data.dossier);
        }
      } catch (e) {
        // Prossegue mesmo se a identificação automática falhar
      }

      // Gera a resposta com IA
      const res = await api.post('/api/admin/copilot/respond', {
        pastedChat,
        tone: selectedTone
      });

      if (res.data?.reply || res.data?.response) {
        const replyText = res.data.reply || res.data.response;
        setGeneratedReply(replyText);
        setToastMessage('Resposta gerada com sucesso pela IA!');
        setToastType('success');
      } else {
        Alert.alert('Erro', 'A IA não retornou uma resposta válida.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Erro ao processar conversa com a IA.';
      Alert.alert('Erro no Copilot', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyReply = async () => {
    if (!generatedReply) return;
    await Clipboard.setStringAsync(generatedReply);
    setCopied(true);
    setToastMessage('Resposta copiada para a área de transferência!');
    setToastType('success');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleOpenWhatsApp = () => {
    if (!dossier?.profile?.telefone) {
      Alert.alert('Sem Telefone', 'O telefone deste psicólogo não foi identificado.');
      return;
    }
    const cleanPhone = dossier.profile.telefone.replace(/\D/g, '');
    const prefix = cleanPhone.startsWith('55') ? '' : '55';
    const textEncoded = encodeURIComponent(generatedReply || '');
    Linking.openURL(`https://wa.me/${prefix}${cleanPhone}?text=${textEncoded}`).catch(() => {
      Alert.alert('Erro', 'Não foi possível abrir o WhatsApp.');
    });
  };

  const handleClear = () => {
    setPastedChat('');
    setDossier(null);
    setGeneratedReply(null);
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-[#f8fafc]"
    >
      <ScrollView 
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 18, paddingBottom: 110 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* HEADER */}
        <View className="bg-[#1B4332] rounded-[24px] p-5 mb-5 shadow-sm relative overflow-hidden">
          <View className="flex-row items-center gap-2 mb-1.5">
            <View className="w-9 h-9 rounded-full bg-[#25d366] items-center justify-center">
              <Feather name="message-circle" size={20} color="white" />
            </View>
            <View>
              <Text className="font-title text-white text-[22px]">Copilot WhatsApp 💬</Text>
              <Text className="font-sans text-white/80 text-[12px]">Dossiê real & respostas geradas por IA</Text>
            </View>
          </View>
        </View>

        {/* INPUT DE CONVERSA */}
        <View className="bg-white rounded-[20px] border border-[#e2e8f0] p-4 mb-4 shadow-xs">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="font-title text-[#1e293b] text-[15px]">Cole a conversa do WhatsApp</Text>
            {pastedChat ? (
              <TouchableOpacity onPress={handleClear}>
                <Text className="font-sans text-[12px] text-[#e63946] font-semibold">Limpar</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <TextInput
            value={pastedChat}
            onChangeText={setPastedChat}
            placeholder="[14:20, 04/11] Psicólogo: Olá, como funciona a assinatura da Yelo? Não entendi sobre a taxa do iPhone..."
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={6}
            style={{ minHeight: 120, textAlignVertical: 'top' }}
            className="bg-[#f8fafc] border border-[#cbd5e1] rounded-2xl p-3.5 text-[#1e293b] font-sans text-[13px] mb-3"
          />

          {/* SELETOR DE TOM */}
          <Text className="font-sans text-[12px] font-semibold text-[#64748b] mb-1.5 uppercase">
            Tom de Resposta:
          </Text>
          <View className="flex-row gap-2 mb-3">
            {[
              { id: 'amigavel', label: 'Amigável 😊' },
              { id: 'direto', label: 'Direto ⚡' },
              { id: 'vendedor', label: 'Comercial 🎯' },
              { id: 'empatico', label: 'Empático 💚' },
            ].map(t => (
              <TouchableOpacity
                key={t.id}
                onPress={() => setSelectedTone(t.id as any)}
                className={`flex-1 py-2 rounded-xl items-center border ${
                  selectedTone === t.id
                    ? 'bg-[#1B4332] border-[#1B4332]'
                    : 'bg-[#f8fafc] border-[#cbd5e1]'
                }`}
              >
                <Text className={`font-sans text-[11px] font-bold ${
                  selectedTone === t.id ? 'text-white' : 'text-[#475569]'
                }`}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* BOTÃO GERAR */}
          <TouchableOpacity
            onPress={handleGenerateResponse}
            disabled={isLoading}
            className="bg-[#25d366] w-full py-3.5 rounded-[50px] items-center flex-row justify-center gap-2 shadow-sm"
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <Feather name="zap" size={16} color="white" />
                <Text className="font-sans font-bold text-white text-[14px]">
                  Analisar Dossiê & Gerar Resposta ✨
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* DOSSIÊ IDENTIFICADO */}
        {dossier && dossier.profile && (
          <View className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-[20px] p-4 mb-4 shadow-xs">
            <View className="flex-row items-center justify-between mb-2 pb-2 border-b border-[#bbf7d0]/50">
              <View className="flex-row items-center gap-1.5">
                <Text className="text-[14px]">🛡️</Text>
                <Text className="font-title text-[#166534] text-[15px]">Dossiê do Psicólogo Identificado</Text>
              </View>
              <View className="bg-[#166534] px-2 py-0.5 rounded-full">
                <Text className="font-sans font-bold text-white text-[10px] uppercase">
                  {dossier.profile.status || 'Ativo'}
                </Text>
              </View>
            </View>

            <Text className="font-title text-[#1e293b] text-[16px] mb-0.5">
              {dossier.profile.nome}
            </Text>
            <Text className="font-sans text-[#64748b] text-[12px] mb-2">
              CRP: {dossier.profile.crp || 'Não inf.'} • {dossier.profile.email} • {dossier.profile.telefone}
            </Text>

            <View className="flex-row gap-2">
              <View className="bg-white px-3 py-1.5 rounded-xl border border-[#bbf7d0] flex-1">
                <Text className="font-sans text-[10px] text-[#64748b] uppercase font-semibold">Plano</Text>
                <Text className="font-title text-[#166534] text-[13px]">{dossier.profile.plano || 'Sem Plano'}</Text>
              </View>
              <View className="bg-white px-3 py-1.5 rounded-xl border border-[#bbf7d0] flex-1">
                <Text className="font-sans text-[10px] text-[#64748b] uppercase font-semibold">Contatos Recebidos</Text>
                <Text className="font-title text-[#166534] text-[13px]">{dossier.profile.totalClicks || 0}</Text>
              </View>
            </View>
          </View>
        )}

        {/* RESPOSTA GERADA PELA IA */}
        {generatedReply && (
          <View className="bg-white rounded-[20px] border border-[#e2e8f0] p-4 mb-4 shadow-sm">
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-1.5">
                <Text className="text-[14px]">🤖</Text>
                <Text className="font-title text-[#1e293b] text-[15px]">Sugestão de Resposta</Text>
              </View>
              <View className="bg-[#ecfdf5] border border-[#a7f3d0] px-2.5 py-0.5 rounded-full">
                <Text className="font-sans font-bold text-[#059669] text-[10.5px]">Tom: {selectedTone}</Text>
              </View>
            </View>

            {/* Balão WhatsApp Style */}
            <View className="bg-[#dcf8c6] border border-[#c3e6cb] rounded-2xl p-4 mb-4">
              <Text className="font-sans text-[#111827] text-[13.5px] leading-relaxed">
                {generatedReply}
              </Text>
            </View>

            {/* Botões de Ação */}
            <View className="gap-2">
              <TouchableOpacity
                onPress={handleCopyReply}
                className={`w-full py-3.5 rounded-[50px] items-center flex-row justify-center gap-2 ${
                  copied ? 'bg-[#16a34a]' : 'bg-[#1B4332]'
                }`}
                activeOpacity={0.85}
              >
                <Feather name={copied ? "check" : "copy"} size={16} color="white" />
                <Text className="font-sans font-bold text-white text-[13.5px]">
                  {copied ? "Copiado com Sucesso! ✓" : "Copiar Resposta"}
                </Text>
              </TouchableOpacity>

              {dossier?.profile?.telefone ? (
                <TouchableOpacity
                  onPress={handleOpenWhatsApp}
                  className="bg-[#25d366] w-full py-3.5 rounded-[50px] items-center flex-row justify-center gap-2 shadow-xs"
                  activeOpacity={0.85}
                >
                  <Feather name="external-link" size={16} color="white" />
                  <Text className="font-sans font-bold text-white text-[13.5px]">
                    Enviar no WhatsApp de {dossier.profile.nome.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        )}
      </ScrollView>

      <YeloToast 
        message={toastMessage} 
        onDismiss={() => setToastMessage(null)} 
        type={toastType} 
      />
    </KeyboardAvoidingView>
  );
}

