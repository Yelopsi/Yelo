import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../../services/api';

export default function AvisosScreen() {
  const router = useRouter();
  const [target, setTarget] = useState('todos');
  const [title, setTitle] = useState('Instabilidade na Plataforma');
  const [content, setContent] = useState(
    'Olá, [nome]\n\nEstamos enfrentando uma instabilidade pontual na plataforma, que já está sendo tratada pela equipe técnica. A orientação, por ora, é aguardar a normalização.\n\nPara compensar o período de indisponibilidade:\n– Usuários ainda no período gratuito terão os 7 dias restituídos\n– Assinantes ativos receberão 50% de desconto na mensalidade\n\nSeguimos trabalhando para resolver isso o mais rápido possível.\n\nAgradecemos a compreensão.'
  );

  const [scheduleType, setScheduleType] = useState('imediato');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  const [scheduledMessages, setScheduledMessages] = useState([
    { id: 1, title: 'Lembrete de Fechamento de Faturas', date: '30/06/2026', time: '09:00', target: 'todos' },
    { id: 2, title: 'Convite - Mentoria VIP', date: '05/07/2026', time: '14:30', target: 'vip' },
  ]);

  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!target) {
      Alert.alert('Erro', 'Selecione um destinatário antes de enviar.');
      return;
    }
    if (scheduleType === 'agendado' && (!scheduleDate || !scheduleTime)) {
      Alert.alert('Erro', 'Preencha a data e hora do agendamento.');
      return;
    }

    try {
      setLoading(true);
      await api.post('/api/admin/push', {
        target,
        title,
        content,
        scheduleType,
        scheduleDate,
        scheduleTime,
      });

      if (scheduleType === 'agendado') {
        Alert.alert('Sucesso', `Aviso agendado com sucesso para ${scheduleDate} às ${scheduleTime}.`);
      } else {
        Alert.alert('Sucesso', 'Aviso enviado imediatamente para os destinatários selecionados.');
      }

      // Limpar formulário
      setTarget('todos');
      setTitle('');
      setContent('');
      setScheduleType('imediato');
      setScheduleDate('');
      setScheduleTime('');
    } catch (error) {
      Alert.alert('Erro', 'Houve um problema ao enviar o push. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        {/* Header com Identidade Yelo */}
        <View
          style={{
            backgroundColor: '#1B4332',
            borderRadius: 20,
            padding: 20,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: '#2D6A4F',
            shadowColor: '#1B4332',
            shadowOpacity: 0.15,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#ffffff', fontSize: 22 }}>
                Enviar Comunicado 📢
              </Text>
              <Text style={{ fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 }}>
                Envie notificações push e avisos importantes para os psicólogos da Yelo.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(admin)/crm'))}
              style={{
                backgroundColor: 'rgba(255,255,255,0.15)',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}
              activeOpacity={0.8}
            >
              <Feather name="arrow-left" size={14} color="#ffffff" />
              <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#ffffff', fontSize: 11 }}>CRM Hub</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Card Formulário */}
        <View
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 20,
            padding: 18,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            shadowColor: '#000',
            shadowOpacity: 0.02,
            shadowRadius: 4,
            elevation: 1,
            marginBottom: 20,
          }}
        >
          {/* Destinatário Segmento */}
          <View style={{ marginBottom: 18 }}>
            <Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 13, textTransform: 'uppercase', marginBottom: 10 }}>
              Destinatário (Segmento):
            </Text>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setTarget('todos')}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  borderWidth: 1,
                  backgroundColor: target === 'todos' ? '#e8f5e9' : '#f8fafc',
                  borderColor: target === 'todos' ? '#1B4332' : '#e2e8f0',
                }}
                activeOpacity={0.8}
              >
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: target === 'todos' ? '#1B4332' : '#cbd5e1',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 8,
                  }}
                >
                  {target === 'todos' && <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: '#1B4332' }} />}
                </View>
                <Text style={{ fontFamily: target === 'todos' ? 'Inter_700Bold' : 'Inter_500Medium', color: target === 'todos' ? '#1B4332' : '#475569', fontSize: 12 }}>
                  Todos os Psis
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setTarget('vip')}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  borderWidth: 1,
                  backgroundColor: target === 'vip' ? '#e8f5e9' : '#f8fafc',
                  borderColor: target === 'vip' ? '#1B4332' : '#e2e8f0',
                }}
                activeOpacity={0.8}
              >
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: target === 'vip' ? '#1B4332' : '#cbd5e1',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 8,
                  }}
                >
                  {target === 'vip' && <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: '#1B4332' }} />}
                </View>
                <Text style={{ fontFamily: target === 'vip' ? 'Inter_700Bold' : 'Inter_500Medium', color: target === 'vip' ? '#1B4332' : '#475569', fontSize: 12 }}>
                  Psis VIP
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Tipo de Envio Pílula */}
          <View style={{ marginBottom: 18 }}>
            <Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 13, textTransform: 'uppercase', marginBottom: 10 }}>
              Tipo de Envio:
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              <TouchableOpacity
                onPress={() => setScheduleType('imediato')}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 10,
                  borderRadius: 999,
                  borderWidth: 1,
                  backgroundColor: scheduleType === 'imediato' ? '#1B4332' : '#f8fafc',
                  borderColor: scheduleType === 'imediato' ? '#1B4332' : '#e2e8f0',
                  gap: 6,
                }}
                activeOpacity={0.8}
              >
                <Feather name="zap" size={15} color={scheduleType === 'imediato' ? '#FFEE8C' : '#64748b'} />
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12.5, color: scheduleType === 'imediato' ? '#ffffff' : '#64748b' }}>
                  Imediato
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setScheduleType('agendado')}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 10,
                  borderRadius: 999,
                  borderWidth: 1,
                  backgroundColor: scheduleType === 'agendado' ? '#1B4332' : '#f8fafc',
                  borderColor: scheduleType === 'agendado' ? '#1B4332' : '#e2e8f0',
                  gap: 6,
                }}
                activeOpacity={0.8}
              >
                <Feather name="calendar" size={15} color={scheduleType === 'agendado' ? '#FFEE8C' : '#64748b'} />
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12.5, color: scheduleType === 'agendado' ? '#ffffff' : '#64748b' }}>
                  Agendado
                </Text>
              </TouchableOpacity>
            </View>

            {scheduleType === 'agendado' && (
              <View style={{ flexDirection: 'row', gap: 10, backgroundColor: '#f8fafc', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#64748b', fontSize: 11, marginBottom: 4 }}>Data (DD/MM/AAAA)</Text>
                  <TextInput
                    value={scheduleDate}
                    onChangeText={setScheduleDate}
                    placeholder="Ex: 25/12/2026"
                    placeholderTextColor="#94a3b8"
                    style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, fontFamily: 'Inter_400Regular', fontSize: 13, backgroundColor: '#ffffff', color: '#1e293b' }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#64748b', fontSize: 11, marginBottom: 4 }}>Hora (HH:MM)</Text>
                  <TextInput
                    value={scheduleTime}
                    onChangeText={setScheduleTime}
                    placeholder="Ex: 14:30"
                    placeholderTextColor="#94a3b8"
                    style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, fontFamily: 'Inter_400Regular', fontSize: 13, backgroundColor: '#ffffff', color: '#1e293b' }}
                  />
                </View>
              </View>
            )}
          </View>

          {/* Título */}
          <View style={{ marginBottom: 18 }}>
            <Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 13, textTransform: 'uppercase', marginBottom: 8 }}>
              Título do Comunicado
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Digite o título"
              placeholderTextColor="#94a3b8"
              style={{
                borderWidth: 1,
                borderColor: '#e2e8f0',
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 10,
                fontFamily: 'Inter_500Medium',
                fontSize: 13.5,
                color: '#1e293b',
                backgroundColor: '#f8fafc',
              }}
            />
          </View>

          {/* Conteúdo */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 13, textTransform: 'uppercase', marginBottom: 8 }}>
              Conteúdo da Mensagem
            </Text>
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Digite a mensagem..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              style={{
                borderWidth: 1,
                borderColor: '#e2e8f0',
                borderRadius: 14,
                padding: 14,
                fontFamily: 'Inter_400Regular',
                fontSize: 13.5,
                color: '#1e293b',
                backgroundColor: '#f8fafc',
                minHeight: 140,
              }}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: '#f0fdf4', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#bbf7d0' }}>
              <Feather name="info" size={14} color="#16a34a" />
              <Text style={{ fontFamily: 'Inter_400Regular', color: '#16a34a', fontSize: 11.5, flex: 1 }}>
                A tag <Text style={{ fontFamily: 'Inter_700Bold' }}>[nome]</Text> será personalizada com o primeiro nome de cada psicólogo.
              </Text>
            </View>
          </View>

          {/* Botão Enviar Pílula Yelo */}
          <TouchableOpacity
            onPress={handleSend}
            disabled={loading}
            style={{
              backgroundColor: '#1B4332',
              borderRadius: 999,
              paddingVertical: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              shadowColor: '#1B4332',
              shadowOpacity: 0.15,
              shadowRadius: 8,
              elevation: 2,
            }}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Feather name="send" size={16} color="#FFEE8C" />
                <Text style={{ fontFamily: 'Inter_700Bold', color: '#ffffff', fontSize: 14 }}>
                  {scheduleType === 'agendado' ? 'Agendar Comunicado' : 'Enviar Comunicado Agora'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Mensagens Agendadas (Lembretes) */}
        <View
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 20,
            padding: 18,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            shadowColor: '#000',
            shadowOpacity: 0.02,
            shadowRadius: 4,
            elevation: 1,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Feather name="clock" size={16} color="#1B4332" />
              <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 16 }}>Mensagens Agendadas</Text>
            </View>
            <View style={{ backgroundColor: '#e8f5e9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', color: '#1B4332', fontSize: 11 }}>{scheduledMessages.length}</Text>
            </View>
          </View>

          {scheduledMessages.length === 0 ? (
            <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748b', fontSize: 13, textAlign: 'center', paddingVertical: 14 }}>
              Nenhuma mensagem agendada no momento.
            </Text>
          ) : (
            <View style={{ gap: 10 }}>
              {scheduledMessages.map((msg) => (
                <View
                  key={msg.id}
                  style={{
                    borderWidth: 1,
                    borderColor: '#e2e8f0',
                    padding: 14,
                    borderRadius: 16,
                    backgroundColor: '#f8fafc',
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1e293b', fontSize: 14, flex: 1 }}>{msg.title}</Text>
                    <TouchableOpacity
                      onPress={() => setScheduledMessages(scheduledMessages.filter((m) => m.id !== msg.id))}
                      style={{ backgroundColor: '#ffffff', padding: 6, borderRadius: 999, borderWidth: 1, borderColor: '#fecaca', marginLeft: 8 }}
                    >
                      <Feather name="trash-2" size={13} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: '#e2e8f0' }}>
                      <Feather name="calendar" size={11} color="#1B4332" />
                      <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#1B4332', fontSize: 11, marginLeft: 4 }}>
                        {msg.date} às {msg.time}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: '#e2e8f0' }}>
                      <Feather name="users" size={11} color="#10b981" />
                      <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#10b981', fontSize: 11, marginLeft: 4 }}>
                        {msg.target === 'vip' ? 'VIPs' : 'Todos'}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
