import React, { useState, useEffect, useCallback } from 'react';
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
  Platform,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import api from '../../../services/api';
import YeloToast from '../../../components/YeloToast';

type CopilotTab = 'chat' | 'dossie' | 'historico';
type VoiceTone = 'natural' | 'comercial' | 'tecnico';

export default function AdminCopilotWppScreen() {
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<CopilotTab>('chat');
  const [pastedChat, setPastedChat] = useState('');
  const [selectedTone, setSelectedTone] = useState<VoiceTone>('natural');

  // Estado da detecção e psicólogo
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedPsiId, setDetectedPsiId] = useState<number | null>(null);
  const [detectionMessage, setDetectionMessage] = useState<string>('Cole a conversa para identificar o psicólogo');
  const [dossier, setDossier] = useState<any>(null);

  // Busca manual
  const [isManualSearchOpen, setIsManualSearchOpen] = useState(false);
  const [manualQuery, setManualQuery] = useState('');
  const [isSearchingManual, setIsSearchingManual] = useState(false);
  const [manualResults, setManualResults] = useState<any[]>([]);

  // Geração de resposta
  const [isLoading, setIsLoading] = useState(false);
  const [generatedReply, setGeneratedReply] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Histórico
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  // Carregar histórico
  const loadHistory = useCallback(async () => {
    setIsHistoryLoading(true);
    try {
      const res = await api.get('/api/admin/copilot/history');
      if (res.data?.conversations) {
        setHistoryItems(res.data.conversations);
      }
    } catch (err) {
      console.error('Erro ao carregar histórico do Copilot:', err);
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Identificação automática quando o texto é colado
  const handleAutoIdentify = async (text: string) => {
    if (!text || text.trim().length < 10) return;

    setIsDetecting(true);
    setDetectionMessage('Buscando profissional no banco do Render...');

    try {
      const res = await api.post('/api/admin/copilot/identify', { pastedChat: text });
      const data = res.data;

      if (data?.dossier?.profile) {
        setDetectedPsiId(data.dossier.profile.id);
        setDossier(data.dossier);
        setDetectionMessage(`Identificado: ${data.dossier.profile.nome}`);
        setToastMessage(`Psicólogo ${data.dossier.profile.nome} identificado!`);
        setToastType('success');
      } else if (data?.cleanName) {
        setDetectionMessage(`Detectado nome "${data.cleanName}", mas não consta na base.`);
      } else {
        setDetectionMessage('Nenhum nome de psicólogo detectado no cabeçalho.');
      }
    } catch (err) {
      console.error('Erro na auto-identificação:', err);
      setDetectionMessage('Erro na identificação automática.');
    } finally {
      setIsDetecting(false);
    }
  };

  // Botão Colar Tudo da Área de Transferência
  const handlePasteAll = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text || !text.trim()) {
        Alert.alert('Área de Transferência Vazia', 'Copie a conversa no WhatsApp antes de colar.');
        return;
      }
      setPastedChat(text);
      handleAutoIdentify(text);
      setToastMessage('Conversa colada com sucesso!');
      setToastType('success');
    } catch (err: any) {
      Alert.alert('Erro ao colar', 'Não foi possível acessar a área de transferência.');
    }
  };

  // Botão Colar Mais (Append)
  const handlePasteMore = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text || !text.trim()) {
        Alert.alert('Aviso', 'Não há texto novo na área de transferência.');
        return;
      }
      const updated = pastedChat ? `${pastedChat}\n\n${text}` : text;
      setPastedChat(updated);
      handleAutoIdentify(updated);
      setToastMessage('Mensagens adicionais anexadas!');
      setToastType('success');
    } catch (err) {
      Alert.alert('Erro ao colar', 'Não foi possível anexar o texto.');
    }
  };

  // Busca Manual de Psicólogo
  const handleSearchManualPsi = async () => {
    if (!manualQuery.trim()) return;
    setIsSearchingManual(true);
    try {
      const res = await api.get(`/api/admin/copilot/search-psychologists?q=${encodeURIComponent(manualQuery)}`);
      setManualResults(res.data?.psychologists || []);
    } catch (err) {
      console.error('Erro na busca manual:', err);
      setToastMessage('Erro ao buscar psicólogo.');
      setToastType('error');
    } finally {
      setIsSearchingManual(false);
    }
  };

  const handleSelectPsiManual = async (psi: any) => {
    setDetectedPsiId(psi.id);
    setIsManualSearchOpen(false);
    setManualQuery('');
    setManualResults([]);

    try {
      const res = await api.post('/api/admin/copilot/identify', { psychologistId: psi.id });
      if (res.data?.dossier) {
        setDossier(res.data.dossier);
        setDetectionMessage(`Identificado manualmente: ${psi.nome}`);
        setToastMessage(`Psicólogo ${psi.nome} selecionado!`);
        setToastType('success');
      }
    } catch (e) {
      setDetectionMessage(`Selecionado: ${psi.nome}`);
    }
  };

  // Gerar Resposta com IA
  const handleGenerateResponse = async () => {
    if (!pastedChat.trim()) {
      Alert.alert('Atenção', 'Cole a conversa do WhatsApp no campo indicado antes de gerar a resposta.');
      return;
    }

    setIsLoading(true);
    setGeneratedReply(null);

    try {
      const res = await api.post('/api/admin/copilot/respond', {
        pastedChat,
        manualPsiId: detectedPsiId,
        tone: selectedTone,
      });

      const replyText = res.data?.aiResponse || res.data?.reply || res.data?.response;
      if (replyText) {
        setGeneratedReply(replyText);
        setToastMessage('Resposta gerada com sucesso pela IA!');
        setToastType('success');

        if (res.data?.detectedPsychologist && !dossier) {
          setDossier(res.data.detectedPsychologist);
          setDetectedPsiId(res.data.detectedPsychologist.profile?.id);
        }

        loadHistory();
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

  // Copiar Resposta
  const handleCopyReply = async () => {
    if (!generatedReply) return;
    await Clipboard.setStringAsync(generatedReply);
    setCopied(true);
    setToastMessage('Resposta copiada para a área de transferência!');
    setToastType('success');
    setTimeout(() => setCopied(false), 3000);
  };

  // Abrir WhatsApp diretamente
  const handleOpenWhatsApp = () => {
    const phone = dossier?.profile?.telefone;
    if (!phone) {
      Alert.alert('Sem Telefone', 'O telefone deste psicólogo não foi identificado.');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const prefix = cleanPhone.startsWith('55') ? '' : '55';
    const textEncoded = encodeURIComponent(generatedReply || '');
    Linking.openURL(`https://wa.me/${prefix}${cleanPhone}?text=${textEncoded}`).catch(() => {
      Alert.alert('Erro', 'Não foi possível abrir o WhatsApp.');
    });
  };

  // Limpar tudo
  const handleClearAll = () => {
    setPastedChat('');
    setDossier(null);
    setDetectedPsiId(null);
    setGeneratedReply(null);
    setDetectionMessage('Cole a conversa para identificar o psicólogo');
    setToastMessage('Campos limpos.');
    setToastType('info');
  };

  // Formatador de valor de sessão
  const formatValorSessao = (valorSessao: any, valorMensal: any, tipoCobranca: any) => {
    if (tipoCobranca === 'mensal' && valorMensal) {
      return `R$ ${Number(valorMensal).toFixed(2).replace('.', ',')} / mês`;
    }
    if (valorSessao && Number(valorSessao) > 0) {
      return `R$ ${Number(valorSessao).toFixed(2).replace('.', ',')}`;
    }
    return 'A combinar';
  };

  // Stats do texto
  const chatLines = pastedChat ? pastedChat.split('\n').length : 0;
  const chatChars = pastedChat.length;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: '#f8fafc' }}
    >
      <StatusBar style="dark" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 130, // respiro premium para a barra de navegação inferior flutuante
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ========================================================= */}
        {/* TOP BAR: BOTÃO VOLTAR CRM HUB + BADGE COPILOT AI          */}
        {/* ========================================================= */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <TouchableOpacity
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(admin)/crm'))}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#ffffff',
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: '#e2e8f0',
              shadowColor: '#000',
              shadowOpacity: 0.03,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 1 },
              elevation: 1,
            }}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={16} color="#1B4332" />
            <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#1B4332', fontSize: 12, marginLeft: 6 }}>
              CRM Hub
            </Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#ecfdf5',
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: '#a7f3d0',
                gap: 4,
              }}
            >
              <Text style={{ fontSize: 10 }}>🟢</Text>
              <Text style={{ fontFamily: 'Inter_700Bold', color: '#166534', fontSize: 11 }}>Detector Ativo</Text>
            </View>

            {pastedChat || generatedReply ? (
              <TouchableOpacity
                onPress={handleClearAll}
                style={{
                  backgroundColor: '#ffffff',
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: '#cbd5e1',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                }}
                activeOpacity={0.7}
              >
                <Feather name="trash-2" size={12} color="#64748b" />
                <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#64748b', fontSize: 11 }}>Limpar</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* ========================================================= */}
        {/* HERO CARD VERDE FLORESTA DA YELO COM BORDAS ARREDONDADAS   */}
        {/* ========================================================= */}
        <LinearGradient
          colors={['#1B4332', '#0f2b20']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 24,
            padding: 22,
            marginBottom: 16,
            shadowColor: '#1B4332',
            shadowOpacity: 0.18,
            shadowRadius: 25,
            shadowOffset: { width: 0, height: 8 },
            elevation: 5,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Efeito decorativo */}
          <View
            style={{
              position: 'absolute',
              top: -40,
              right: -40,
              width: 180,
              height: 180,
              borderRadius: 90,
              backgroundColor: 'rgba(255,255,255,0.05)',
            }}
            pointerEvents="none"
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', color: '#FFEE8C', fontSize: 10, textTransform: 'uppercase' }}>
                Inteligência AI
              </Text>
            </View>
          </View>

          <Text
            style={{
              fontFamily: 'Fraunces_700Bold',
              fontSize: 23,
              lineHeight: 28,
              color: '#ffffff',
            }}
          >
            Copilot WhatsApp 💬
          </Text>
          <Text
            style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 12.5,
              color: 'rgba(255,255,255,0.85)',
              marginTop: 4,
              lineHeight: 18,
            }}
          >
            Dossiê 360º em tempo real e respostas estratégicas personalizadas.
          </Text>
        </LinearGradient>

        {/* ========================================================= */}
        {/* NAVEGAÇÃO POR ABAS (PÍLULAS)                               */}
        {/* ========================================================= */}
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
          {[
            { id: 'chat', label: '💬 Chat & IA', badge: null },
            { id: 'dossie', label: '👤 Dossiê', badge: dossier ? '●' : null },
            { id: 'historico', label: '🕒 Histórico', badge: historyItems.length > 0 ? String(historyItems.length) : null },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id as CopilotTab)}
                style={{
                  flex: 1,
                  paddingVertical: 9,
                  borderRadius: 999,
                  backgroundColor: isActive ? '#1B4332' : '#ffffff',
                  borderWidth: 1,
                  borderColor: isActive ? '#1B4332' : '#e2e8f0',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  shadowColor: '#000',
                  shadowOpacity: isActive ? 0.08 : 0.02,
                  shadowRadius: 3,
                  shadowOffset: { width: 0, height: 1 },
                  elevation: 1,
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={{
                    fontFamily: isActive ? 'Inter_700Bold' : 'Inter_600SemiBold',
                    fontSize: 12,
                    color: isActive ? '#ffffff' : '#475569',
                  }}
                >
                  {tab.label}
                </Text>
                {tab.badge ? (
                  <View
                    style={{
                      backgroundColor: isActive ? '#FFEE8C' : '#e2e8f0',
                      paddingHorizontal: tab.badge === '●' ? 4 : 5,
                      paddingVertical: 1,
                      borderRadius: 999,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'Inter_700Bold',
                        fontSize: tab.badge === '●' ? 8 : 9.5,
                        color: isActive ? '#1B4332' : '#475569',
                      }}
                    >
                      {tab.badge}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ========================================================= */}
        {/* ABA 1: CHAT & IA                                          */}
        {/* ========================================================= */}
        {activeTab === 'chat' && (
          <View>
            {/* CARD DE ENTRADA DO CHAT */}
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                padding: 16,
                marginBottom: 16,
                shadowColor: '#000',
                shadowOpacity: 0.03,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 },
                elevation: 1,
              }}
            >
              {/* Toolbar superior com Colar Tudo e Colar Mais */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 14.5, color: '#1e293b' }}>
                  📋 Conversa do WhatsApp
                </Text>

                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity
                    onPress={handlePasteAll}
                    style={{
                      backgroundColor: '#10b981',
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 999,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      shadowColor: '#10b981',
                      shadowOpacity: 0.25,
                      shadowRadius: 4,
                      shadowOffset: { width: 0, height: 1 },
                      elevation: 2,
                    }}
                    activeOpacity={0.8}
                  >
                    <Feather name="clipboard" size={12} color="#ffffff" />
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#ffffff' }}>Colar Tudo</Text>
                  </TouchableOpacity>

                  {pastedChat ? (
                    <TouchableOpacity
                      onPress={handlePasteMore}
                      style={{
                        backgroundColor: '#eff6ff',
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: '#bfdbfe',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 2,
                      }}
                      activeOpacity={0.8}
                    >
                      <Feather name="plus" size={12} color="#1d4ed8" />
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#1d4ed8' }}>Mais</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              {/* Text Stats */}
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 6 }}>
                <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 10.5, color: '#94a3b8' }}>
                  {chatChars > 0 ? `${chatChars} caracteres • ${chatLines} linhas` : 'Cole o texto do chat'}
                </Text>
              </View>

              {/* Textarea */}
              <TextInput
                value={pastedChat}
                onChangeText={(text) => {
                  setPastedChat(text);
                  if (text.length > 25 && !dossier) {
                    handleAutoIdentify(text);
                  }
                }}
                placeholder={`Cole aqui a conversa copiada do WhatsApp...\n\nExemplo:\n[08/10, 12:31] ~Psicólogo Fred Monte: Boa tarde, estou tendo curtidas em alguns artigos meus\n[08/10, 12:31] ~Psicólogo Fred Monte: uns mais, outros menos`}
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                style={{
                  minHeight: 130,
                  maxHeight: 240,
                  backgroundColor: '#f8fafc',
                  borderWidth: 1.5,
                  borderColor: '#cbd5e1',
                  borderRadius: 14,
                  padding: 12,
                  fontFamily: 'Inter_400Regular',
                  fontSize: 13,
                  color: '#1e293b',
                  lineHeight: 19,
                }}
              />

              {/* Banner de Identificação em Tempo Real */}
              <View
                style={{
                  backgroundColor: dossier ? '#f0fdf4' : '#f8fafc',
                  borderWidth: 1,
                  borderColor: dossier ? '#bbf7d0' : '#e2e8f0',
                  borderRadius: 12,
                  padding: 10,
                  marginTop: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, paddingRight: 6 }}>
                  {isDetecting ? (
                    <ActivityIndicator size="small" color="#1B4332" />
                  ) : (
                    <Text style={{ fontSize: 15 }}>{dossier ? '🟢' : '🔍'}</Text>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11.5, color: '#1e293b' }} numberOfLines={1}>
                      {detectionMessage}
                    </Text>
                    {dossier?.profile ? (
                      <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 10, color: '#166534', marginTop: 1 }}>
                        Plano {dossier.profile.plano || 'Essencial'} • {dossier.profile.whatsapp_clicks || 0} cliques WPP
                      </Text>
                    ) : (
                      <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: '#64748b', marginTop: 1 }}>
                        Detecta o cabeçalho e busca no Render em tempo real
                      </Text>
                    )}
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => setIsManualSearchOpen(!isManualSearchOpen)}
                  style={{
                    backgroundColor: '#ffffff',
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: '#cbd5e1',
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 10.5, color: '#475569' }}>
                    {isManualSearchOpen ? 'Fechar' : 'Alterar'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Caixa de Busca Manual (se aberta) */}
              {isManualSearchOpen && (
                <View
                  style={{
                    marginTop: 10,
                    padding: 10,
                    backgroundColor: '#ffffff',
                    borderWidth: 1,
                    borderColor: '#cbd5e1',
                    borderRadius: 12,
                    borderStyle: 'dashed',
                  }}
                >
                  <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                    <TextInput
                      value={manualQuery}
                      onChangeText={setManualQuery}
                      placeholder="Buscar por nome, e-mail ou telefone..."
                      placeholderTextColor="#94a3b8"
                      style={{
                        flex: 1,
                        backgroundColor: '#f8fafc',
                        borderWidth: 1,
                        borderColor: '#cbd5e1',
                        borderRadius: 8,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        fontSize: 12,
                        fontFamily: 'Inter_400Regular',
                        color: '#1e293b',
                      }}
                    />
                    <TouchableOpacity
                      onPress={handleSearchManualPsi}
                      disabled={isSearchingManual}
                      style={{
                        backgroundColor: '#1B4332',
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 8,
                        justifyContent: 'center',
                      }}
                    >
                      {isSearchingManual ? (
                        <ActivityIndicator size="small" color="#FFEE8C" />
                      ) : (
                        <Text style={{ fontFamily: 'Inter_700Bold', color: '#FFEE8C', fontSize: 11 }}>Buscar</Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Resultados da busca */}
                  {manualResults.length > 0 ? (
                    <View style={{ gap: 6 }}>
                      {manualResults.map((psi) => (
                        <TouchableOpacity
                          key={psi.id}
                          onPress={() => handleSelectPsiManual(psi)}
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: 8,
                            backgroundColor: '#f8fafc',
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: '#e2e8f0',
                          }}
                        >
                          <View style={{ flex: 1, paddingRight: 6 }}>
                            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#1e293b' }}>
                              {psi.nome}
                            </Text>
                            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10.5, color: '#64748b' }}>
                              {psi.email} • {psi.plano || 'Essencial'}
                            </Text>
                          </View>
                          <View style={{ backgroundColor: '#1B4332', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#FFEE8C' }}>Selecionar</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : manualQuery && !isSearchingManual ? (
                    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: '#ef4444', textAlign: 'center', paddingVertical: 4 }}>
                      Nenhum psicólogo encontrado.
                    </Text>
                  ) : null}
                </View>
              )}

              {/* Mini Profile Banner (Card de Acesso Rápido ao Dossiê) */}
              {dossier?.profile && (
                <View
                  style={{
                    marginTop: 10,
                    backgroundColor: '#f0fdf4',
                    borderWidth: 1,
                    borderColor: '#bbf7d0',
                    borderRadius: 14,
                    padding: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 8 }}>
                    {dossier.profile.fotoUrl ? (
                      <Image
                        source={{ uri: dossier.profile.fotoUrl }}
                        style={{ width: 38, height: 38, borderRadius: 999, borderWidth: 1.5, borderColor: '#10b981' }}
                      />
                    ) : (
                      <View style={{ width: 38, height: 38, borderRadius: 999, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: '#ffffff' }}>
                          {dossier.profile.nome?.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12.5, color: '#0f172a' }} numberOfLines={1}>
                        {dossier.profile.nome}
                      </Text>
                      <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 10.5, color: '#166534', marginTop: 1 }}>
                        {dossier.profile.subscriptionId ? 'Pagante' : 'Trial'} • Sessão: {formatValorSessao(dossier.profile.valor_sessao_numero, dossier.profile.valor_mensal_numero, dossier.profile.tipo_cobranca)}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => setActiveTab('dossie')}
                    style={{
                      backgroundColor: '#1B4332',
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10.5, color: '#FFEE8C' }}>
                      Ver Dossiê →
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Seletor de Tom */}
              <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>
                  Tom de Voz:
                </Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {[
                    { id: 'natural', label: '🌿 Natural' },
                    { id: 'comercial', label: '💼 Comercial' },
                    { id: 'tecnico', label: '⚙️ Técnico' },
                  ].map((t) => {
                    const isSelected = selectedTone === t.id;
                    return (
                      <TouchableOpacity
                        key={t.id}
                        onPress={() => setSelectedTone(t.id as VoiceTone)}
                        style={{
                          flex: 1,
                          paddingVertical: 7,
                          borderRadius: 999,
                          backgroundColor: isSelected ? '#1B4332' : '#f8fafc',
                          borderWidth: 1,
                          borderColor: isSelected ? '#1B4332' : '#cbd5e1',
                          alignItems: 'center',
                        }}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={{
                            fontFamily: isSelected ? 'Inter_700Bold' : 'Inter_600SemiBold',
                            fontSize: 11,
                            color: isSelected ? '#FFEE8C' : '#475569',
                          }}
                        >
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Botão Gerar Resposta */}
              <TouchableOpacity
                onPress={handleGenerateResponse}
                disabled={isLoading}
                style={{
                  backgroundColor: '#1B4332',
                  marginTop: 14,
                  paddingVertical: 12,
                  borderRadius: 999,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  shadowColor: '#1B4332',
                  shadowOpacity: 0.25,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 2,
                }}
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <>
                    <ActivityIndicator size="small" color="#FFEE8C" />
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: '#FFEE8C' }}>
                      Consultando Dossiê e IA...
                    </Text>
                  </>
                ) : (
                  <>
                    <Feather name="zap" size={15} color="#FFEE8C" />
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: '#FFEE8C' }}>
                      Gerar Resposta com IA ✨
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* CARD DE RESPOSTA GERADA PELA IA */}
            {generatedReply && (
              <View
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: 20,
                  borderWidth: 1.5,
                  borderColor: '#25d366',
                  padding: 16,
                  marginBottom: 20,
                  shadowColor: '#25d366',
                  shadowOpacity: 0.12,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 3,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ backgroundColor: '#25d366', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 9.5, color: '#ffffff', textTransform: 'uppercase' }}>
                        Pronta para Envio
                      </Text>
                    </View>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12.5, color: '#1e293b' }}>
                      Sugestão Personalizada:
                    </Text>
                  </View>
                </View>

                {/* Balão WhatsApp Style */}
                <View
                  style={{
                    backgroundColor: '#f0fdf4',
                    borderWidth: 1,
                    borderColor: '#bbf7d0',
                    borderRadius: 14,
                    padding: 14,
                    marginBottom: 12,
                  }}
                >
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: '#0f172a', lineHeight: 19 }}>
                    {generatedReply}
                  </Text>
                </View>

                {/* Botões de Ação */}
                <View style={{ gap: 8 }}>
                  <TouchableOpacity
                    onPress={handleCopyReply}
                    style={{
                      backgroundColor: copied ? '#16a34a' : '#25d366',
                      paddingVertical: 11,
                      borderRadius: 999,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                    activeOpacity={0.85}
                  >
                    <Feather name={copied ? 'check' : 'copy'} size={15} color="#ffffff" />
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12.5, color: '#ffffff' }}>
                      {copied ? 'Copiado com Sucesso! ✓' : 'Copiar Resposta'}
                    </Text>
                  </TouchableOpacity>

                  {dossier?.profile?.telefone ? (
                    <TouchableOpacity
                      onPress={handleOpenWhatsApp}
                      style={{
                        backgroundColor: '#1B4332',
                        paddingVertical: 11,
                        borderRadius: 999,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                      activeOpacity={0.85}
                    >
                      <Feather name="external-link" size={15} color="#ffffff" />
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12.5, color: '#ffffff' }}>
                        Enviar no WhatsApp de {dossier.profile.nome?.split(' ')[0]}
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  <TouchableOpacity
                    onPress={handleGenerateResponse}
                    style={{ alignItems: 'center', paddingVertical: 4 }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11.5, color: '#166534', textDecorationLine: 'underline' }}>
                      Gerar outra opção
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ========================================================= */}
        {/* ABA 2: DOSSIÊ 360º DO PSICÓLOGO                           */}
        {/* ========================================================= */}
        {activeTab === 'dossie' && (
          <View>
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                padding: 16,
                marginBottom: 20,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#1e293b' }}>
                  👤 Dossiê 360º do Psicólogo
                </Text>
                {dossier?.profile && (
                  <View style={{
                    backgroundColor: dossier.profile.status === 'active' ? '#dcfce7' : '#fee2e2',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 999,
                  }}>
                    <Text style={{
                      fontFamily: 'Inter_700Bold',
                      fontSize: 10,
                      color: dossier.profile.status === 'active' ? '#166534' : '#991b1b',
                      textTransform: 'uppercase',
                    }}>
                      {dossier.profile.status === 'active' ? (dossier.profile.subscriptionId ? 'Pagante Ativo' : 'Em Trial') : 'Inativo'}
                    </Text>
                  </View>
                )}
              </View>

              {dossier?.profile ? (
                <View>
                  {/* Cabeçalho do Perfil */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', marginBottom: 14 }}>
                    {dossier.profile.fotoUrl ? (
                      <Image
                        source={{ uri: dossier.profile.fotoUrl }}
                        style={{ width: 54, height: 54, borderRadius: 999, borderWidth: 2, borderColor: '#10b981' }}
                      />
                    ) : (
                      <View style={{ width: 54, height: 54, borderRadius: 999, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 20, color: '#ffffff' }}>
                          {dossier.profile.nome?.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#0f172a' }}>
                        {dossier.profile.nome}
                      </Text>
                      <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: '#64748b', marginTop: 1 }}>
                        CRP: {dossier.profile.crp || 'Ativo'} • {dossier.profile.cidade || 'Online'}{dossier.profile.estado ? ` - ${dossier.profile.estado}` : ''}
                      </Text>
                      {dossier.profile.slug ? (
                        <TouchableOpacity
                          onPress={() => Linking.openURL(`https://www.yelopsi.com.br/${dossier.profile.slug}`)}
                          style={{ marginTop: 2 }}
                        >
                          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#2563eb' }}>
                            Ver Perfil Público ↗
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>

                  {/* 4 Cards de Métricas (2x2) */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                    <View style={{ width: '48.5%', backgroundColor: '#f8fafc', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#e2e8f0' }}>
                      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#64748b' }}>Aparições no Match</Text>
                      <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#1B4332', marginTop: 2 }}>
                        {dossier.profile.profile_appearances || 0}
                      </Text>
                    </View>

                    <View style={{ width: '48.5%', backgroundColor: '#f8fafc', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#e2e8f0' }}>
                      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#64748b' }}>Cliques no WhatsApp</Text>
                      <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#16a34a', marginTop: 2 }}>
                        {dossier.profile.whatsapp_clicks || dossier.stats?.total_clicks || 0}
                      </Text>
                    </View>

                    <View style={{ width: '48.5%', backgroundColor: '#f8fafc', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#e2e8f0' }}>
                      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#64748b' }}>Fechamentos Reais</Text>
                      <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 18, color: '#3b82f6', marginTop: 2 }}>
                        {dossier.stats?.deals_closed || 0}
                      </Text>
                    </View>

                    <View style={{ width: '48.5%', backgroundColor: '#f8fafc', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#e2e8f0' }}>
                      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#64748b' }}>Valor da Sessão</Text>
                      <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#0f172a', marginTop: 2 }}>
                        {formatValorSessao(dossier.profile.valor_sessao_numero, dossier.profile.valor_mensal_numero, dossier.profile.tipo_cobranca)}
                      </Text>
                    </View>
                  </View>

                  {/* Detalhes Clínicos */}
                  <View style={{ gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11.5, color: '#0f172a' }}>Plano & Validade:</Text>
                      <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11.5, color: '#64748b' }}>
                        {dossier.profile.plano || 'Essencial'} ({dossier.profile.planExpiresAt ? new Date(dossier.profile.planExpiresAt).toLocaleDateString('pt-BR') : 'Sem data'})
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11.5, color: '#0f172a' }}>Abordagem:</Text>
                      <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11.5, color: '#64748b', flex: 1, textAlign: 'right', marginLeft: 10 }} numberOfLines={1}>
                        {Array.isArray(dossier.profile.abordagens_tecnicas) ? dossier.profile.abordagens_tecnicas.join(', ') : (dossier.profile.abordagens_tecnicas || 'Clínica Geral')}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11.5, color: '#0f172a' }}>Artigos no Blog:</Text>
                      <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11.5, color: '#64748b' }}>
                        {dossier.posts?.total > 0 ? `${dossier.posts.total} publicados` : 'Nenhum artigo'}
                      </Text>
                    </View>

                    {/* Bio */}
                    {dossier.profile.bio ? (
                      <View
                        style={{
                          backgroundColor: '#f8fafc',
                          borderLeftWidth: 3,
                          borderLeftColor: '#1B4332',
                          borderRadius: 8,
                          padding: 10,
                          marginTop: 4,
                        }}
                      >
                        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: '#475569', lineHeight: 16 }}>
                          "{dossier.profile.bio.replace(/<[^>]*>?/gm, '').substring(0, 200)}..."
                        </Text>
                      </View>
                    ) : null}

                    {/* Botão para gerar resposta com este psicólogo */}
                    <TouchableOpacity
                      onPress={() => setActiveTab('chat')}
                      style={{
                        backgroundColor: '#1B4332',
                        marginTop: 10,
                        paddingVertical: 10,
                        borderRadius: 999,
                        alignItems: 'center',
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#FFEE8C' }}>
                        Criar Resposta no Chat →
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: 36 }}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>📇</Text>
                  <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 15, color: '#1e293b' }}>
                    Nenhum profissional carregado
                  </Text>
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#64748b', textAlign: 'center', marginTop: 4, maxWidth: 280, lineHeight: 16 }}>
                    Cole uma conversa do WhatsApp na aba "Chat & IA" ou busque manualmente para visualizar o dossiê completo aqui.
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ========================================================= */}
        {/* ABA 3: HISTÓRICO DE ATENDIMENTOS                          */}
        {/* ========================================================= */}
        {activeTab === 'historico' && (
          <View>
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                padding: 16,
                marginBottom: 20,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 16, color: '#1e293b' }}>
                  🕒 Histórico de Atendimentos
                </Text>
                <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748b' }}>
                    {historyItems.length} registros
                  </Text>
                </View>
              </View>

              {isHistoryLoading ? (
                <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#1B4332" />
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: '#64748b', marginTop: 6 }}>
                    Carregando atendimentos...
                  </Text>
                </View>
              ) : historyItems.length > 0 ? (
                <View style={{ gap: 10 }}>
                  {historyItems.map((c, idx) => {
                    const dateStr = new Date(c.createdAt).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <TouchableOpacity
                        key={c.id || idx}
                        onPress={() => {
                          if (c.aiResponse) {
                            setGeneratedReply(c.aiResponse);
                            setActiveTab('chat');
                            setToastMessage('Resposta carregada no chat!');
                            setToastType('info');
                          }
                        }}
                        style={{
                          backgroundColor: '#f8fafc',
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: '#e2e8f0',
                          padding: 12,
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12.5, color: '#0f172a' }}>
                            {c.psi_nome || c.detectedName || 'Atendimento'}
                          </Text>
                          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 10, color: '#94a3b8' }}>
                            {dateStr}
                          </Text>
                        </View>
                        <Text
                          style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: '#64748b', lineHeight: 16 }}
                          numberOfLines={2}
                        >
                          {c.aiResponse || 'Sem resposta salva.'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: 28 }}>
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#94a3b8' }}>
                    Nenhum atendimento salvo no histórico ainda.
                  </Text>
                </View>
              )}
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
