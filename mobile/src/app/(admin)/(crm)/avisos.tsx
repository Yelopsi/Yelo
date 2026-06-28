import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import api from '../../../services/api';

export default function AvisosScreen() {
  const [target, setTarget] = useState('');
  const [title, setTitle] = useState('Instabilidade na Plataforma');
  const [content, setContent] = useState('Olá, [nome]\n\nEstamos enfrentando uma instabilidade pontual na plataforma, que já está sendo tratada pela equipe técnica. A orientação, por ora, é aguardar a normalização.\n\nPara compensar o período de indisponibilidade:\n– Usuários ainda no período gratuito terão os 14 dias restituídos\n– Assinantes ativos receberão 50% de desconto na mensalidade\n\nSeguimos trabalhando para resolver isso o mais rápido possível.\n\nAgradecemos a compreensão.');

  const [scheduleType, setScheduleType] = useState('imediato');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  const [scheduledMessages, setScheduledMessages] = useState([
    { id: 1, title: 'Lembrete de Fechamento de Faturas', date: '30/06/2026', time: '09:00', target: 'todos' },
    { id: 2, title: 'Convite - Mentoria VIP', date: '05/07/2026', time: '14:30', target: 'vip' }
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
        target, title, content, scheduleType, scheduleDate, scheduleTime
      });

      if (scheduleType === 'agendado') {
        Alert.alert('Sucesso', 'Aviso agendado com sucesso para ' + scheduleDate + ' às ' + scheduleTime + '.');
      } else {
        Alert.alert('Sucesso', 'Aviso enviado imediatamente para os destinatários selecionados.');
      }
      
      // Limpar formulário
      setTarget('');
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
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-[#f9fafb]"
    >
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {/* Header */}
        <View className="mb-[20px]">
          <Text className="font-title text-[#1e1b4b] text-[24px]">Enviar Comunicado</Text>
          <Text className="font-sans text-[#666] text-[14px]">Envie notificações Push para todos os psicólogos da plataforma.</Text>
        </View>

        <View className="bg-white rounded-[16px] p-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-[#f0f0f0]">
          
          <View className="mb-[20px]">
            <Text className="font-title text-[#333] text-[14px] mb-[8px]">Destinatário (Segmento):</Text>
            
            <View className="gap-[10px]">
              <TouchableOpacity onPress={() => setTarget('todos')} className={`flex-row items-center p-[12px] border rounded-[8px] ${target === 'todos' ? 'bg-[#f0fdf4] border-[#10b981]' : 'border-[#e2e8f0]'}`}>
                <View className={`w-[20px] h-[20px] rounded-full border flex items-center justify-center mr-[10px] ${target === 'todos' ? 'border-[#10b981]' : 'border-[#cbd5e1]'}`}>
                  {target === 'todos' && <View className="w-[10px] h-[10px] rounded-full bg-[#10b981]" />}
                </View>
                <Text className="font-sans text-[#333] text-[14px]">Todos os Psicólogos</Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={() => setTarget('vip')} className={`flex-row items-center p-[12px] border rounded-[8px] ${target === 'vip' ? 'bg-[#f0fdf4] border-[#10b981]' : 'border-[#e2e8f0]'}`}>
                <View className={`w-[20px] h-[20px] rounded-full border flex items-center justify-center mr-[10px] ${target === 'vip' ? 'border-[#10b981]' : 'border-[#cbd5e1]'}`}>
                  {target === 'vip' && <View className="w-[10px] h-[10px] rounded-full bg-[#10b981]" />}
                </View>
                <Text className="font-sans text-[#333] text-[14px]">Assinantes Referência (VIP)</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Tipo de Envio */}
          <View className="mb-[20px]">
            <Text className="font-title text-[#333] text-[14px] mb-[8px]">Tipo de Envio:</Text>
            <View className="flex-row gap-[10px] mb-[10px]">
              <TouchableOpacity onPress={() => setScheduleType('imediato')} className={`flex-1 flex-row items-center p-[12px] border rounded-[8px] justify-center ${scheduleType === 'imediato' ? 'bg-[#eff6ff] border-[#3b82f6]' : 'border-[#e2e8f0]'}`}>
                <Feather name="zap" size={16} color={scheduleType === 'imediato' ? '#1d4ed8' : '#94a3b8'} style={{marginRight: 8}} />
                <Text className={`font-sans text-[14px] ${scheduleType === 'imediato' ? 'text-[#1d4ed8] font-bold' : 'text-[#64748b]'}`}>Imediato</Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={() => setScheduleType('agendado')} className={`flex-1 flex-row items-center p-[12px] border rounded-[8px] justify-center ${scheduleType === 'agendado' ? 'bg-[#eff6ff] border-[#3b82f6]' : 'border-[#e2e8f0]'}`}>
                <Feather name="calendar" size={16} color={scheduleType === 'agendado' ? '#1d4ed8' : '#94a3b8'} style={{marginRight: 8}} />
                <Text className={`font-sans text-[14px] ${scheduleType === 'agendado' ? 'text-[#1d4ed8] font-bold' : 'text-[#64748b]'}`}>Agendado</Text>
              </TouchableOpacity>
            </View>

            {scheduleType === 'agendado' && (
              <View className="flex-row gap-[10px] bg-[#f8f9fa] p-[12px] rounded-[8px] border border-[#e2e8f0]">
                <View className="flex-1">
                  <Text className="font-title text-[#333] text-[12px] mb-[5px]">Data (DD/MM/AAAA)</Text>
                  <TextInput 
                    value={scheduleDate}
                    onChangeText={setScheduleDate}
                    placeholder="Ex: 25/12/2026"
                    className="border border-[#cbd5e1] rounded-[6px] p-[10px] font-sans text-[#333] text-[14px] bg-white"
                  />
                </View>
                <View className="flex-1">
                  <Text className="font-title text-[#333] text-[12px] mb-[5px]">Hora (HH:MM)</Text>
                  <TextInput 
                    value={scheduleTime}
                    onChangeText={setScheduleTime}
                    placeholder="Ex: 14:30"
                    className="border border-[#cbd5e1] rounded-[6px] p-[10px] font-sans text-[#333] text-[14px] bg-white"
                  />
                </View>
              </View>
            )}
          </View>

          <View className="mb-[20px]">
            <Text className="font-title text-[#333] text-[14px] mb-[8px]">Título do Comunicado</Text>
            <TextInput 
              value={title}
              onChangeText={setTitle}
              placeholder="Digite o título"
              className="border border-[#e2e8f0] rounded-[8px] p-[12px] font-sans text-[#333] text-[14px] bg-[#f8f9fa]"
            />
          </View>

          <View className="mb-[20px]">
            <Text className="font-title text-[#333] text-[14px] mb-[8px]">Conteúdo da Mensagem</Text>
            <TextInput 
              value={content}
              onChangeText={setContent}
              placeholder="Digite a mensagem"
              multiline
              numberOfLines={8}
              textAlignVertical="top"
              className="border border-[#e2e8f0] rounded-[8px] p-[12px] font-sans text-[#333] text-[14px] bg-[#f8f9fa] h-[180px]"
            />
            <View className="flex-row items-start mt-[10px] bg-[#eff6ff] p-[10px] rounded-[8px]">
              <Feather name="info" size={16} color="#3b82f6" style={{marginTop: 2}} />
              <Text className="font-sans text-[#1e40af] text-[12px] ml-[8px] flex-1 leading-[18px]">
                A tag <Text className="font-bold">[nome]</Text> será substituída automaticamente pelo nome de cada psicólogo ao enviar.
              </Text>
            </View>
          </View>

          <TouchableOpacity 
            onPress={handleSend}
            disabled={loading}
            className={`w-full ${loading ? 'bg-gray-400' : 'bg-[#1e1b4b]'} rounded-[12px] p-[15px] flex-row items-center justify-center`}
          >
            <Feather name="send" size={18} color="white" />
            <Text className="text-white font-title text-[16px] ml-[10px]">{loading ? 'Enviando...' : 'Programar/Enviar Aviso'}</Text>
          </TouchableOpacity>
          
        </View>

        {/* Mensagens Agendadas (Lembretes) */}
        <View className="bg-white rounded-[16px] p-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-[#f0f0f0] mt-[20px]">
          <View className="mb-[15px] border-b border-[#e9ecef] pb-[10px] flex-row justify-between items-center">
            <View className="flex-row items-center">
              <Feather name="clock" size={18} color="#333" style={{marginRight: 8}} />
              <Text className="font-title text-[#333] text-[16px]">Mensagens Agendadas</Text>
            </View>
            <View className="bg-[#eff6ff] px-[8px] py-[2px] rounded-[10px]">
              <Text className="font-title text-[#3b82f6] text-[12px]">{scheduledMessages.length}</Text>
            </View>
          </View>
          
          {scheduledMessages.length === 0 ? (
            <Text className="font-sans text-[#666] text-[14px] text-center py-[20px]">Nenhuma mensagem agendada no momento.</Text>
          ) : (
            <View className="gap-[10px]">
              {scheduledMessages.map(msg => (
                <View key={msg.id} className="border border-[#e2e8f0] p-[15px] rounded-[10px] bg-[#f8f9fa]">
                   <View className="flex-row justify-between items-start mb-[8px]">
                     <Text className="font-title text-[#333] text-[14px] flex-1">{msg.title}</Text>
                     <TouchableOpacity onPress={() => setScheduledMessages(scheduledMessages.filter(m => m.id !== msg.id))} className="ml-[10px] bg-white p-[6px] rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
                       <Feather name="trash-2" size={14} color="#ef4444" />
                     </TouchableOpacity>
                   </View>
                   <View className="flex-row items-center mt-[5px]">
                     <View className="flex-row items-center bg-white px-[8px] py-[4px] rounded-[6px] border border-[#e2e8f0] mr-[10px]">
                       <Feather name="calendar" size={12} color="#1d4ed8" />
                       <Text className="font-sans text-[#1d4ed8] font-bold text-[11px] ml-[4px]">{msg.date} às {msg.time}</Text>
                     </View>
                     <View className="flex-row items-center bg-white px-[8px] py-[4px] rounded-[6px] border border-[#e2e8f0]">
                       <Feather name="users" size={12} color="#10b981" />
                       <Text className="font-sans text-[#10b981] font-bold text-[11px] ml-[4px]">{msg.target === 'vip' ? 'VIPs' : 'Todos'}</Text>
                     </View>
                   </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View className="h-[120px]" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
