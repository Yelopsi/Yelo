import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, FlatList, Modal, ScrollView } from 'react-native';
import YeloScrollView from '../../../components/YeloScrollView';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Calendar, LocaleConfig } from 'react-native-calendars';

// Configurar Calendário para PT-BR
LocaleConfig.locales['pt-br'] = {
  monthNames: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
  monthNamesShort: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
  dayNames: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
  dayNamesShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  today: 'Hoje'
};
LocaleConfig.defaultLocale = 'pt-br';

// Mocks simulando o banco de dados local da Yelo
const MOCK_PATIENTS = [
  { id: '1', name: 'Ana Maria Silva', phone: '(11) 99999-9999', status: 'ativo', value: '150,00', nextSession: '14:00 - 14:50', date: 'Hoje' },
  { id: '2', name: 'João Paulo', phone: '(11) 98888-8888', status: 'ativo', value: '200,00', nextSession: '16:30 - 17:20', date: 'Hoje' },
  { id: '3', name: 'Carlos Andrade', phone: '(11) 97777-7777', status: 'inativo', value: '180,00', nextSession: null, date: null }
];

// Funções de Máscara
const maskPhone = (value: string) => {
  let v = value.replace(/\D/g, ''); 
  if (v.length > 11) v = v.substring(0, 11); 
  
  if (v.length > 2) {
    v = `(${v.substring(0,2)}) ${v.substring(2)}`;
  }
  if (v.length > 9) {
    v = `${v.substring(0,9)}-${v.substring(9)}`;
  }
  return v;
};

const maskCurrency = (value: string) => {
  let v = value.replace(/\D/g, '');
  if (!v) return '';
  v = (Number(v) / 100).toFixed(2);
  v = v.replace('.', ',');
  v = v.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${v}`;
};

export default function PacientesScreen() {
  
  // States - Visão Principal
  const [viewMode, setViewMode] = useState<'lista' | 'agenda'>('lista');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ativo');
  
  // States - Modal Adicionar Paciente
  const [modalVisible, setModalVisible] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [valueInput, setValueInput] = useState('');

  const filteredPatients = MOCK_PATIENTS.filter(p => {
    if (filter !== 'todos' && p.status !== filter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      onPress={() => router.push(`/pacientes/${item.id}`)}
      className="bg-white rounded-[16px] p-5 mb-4 border border-[#e5e7eb] shadow-[0_4px_20px_rgba(0,0,0,0.03)]"
    >
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-1">
          <Text className="font-title text-[#1f2937] text-[18px] mb-1">{item.name}</Text>
          <Text className="font-sans text-[#6b7280] text-[14px]">{item.phone}</Text>
        </View>
        <View className={`px-[10px] py-[4px] rounded-full ${item.status === 'ativo' ? 'bg-[#e8f5e9]' : 'bg-[#f1f3f5]'}`}>
          <Text className={`font-sans font-bold text-[12px] ${item.status === 'ativo' ? 'text-[#1B4332]' : 'text-[#6c757d]'}`}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </View>

      <View className="h-[1px] bg-[#f3f4f6] my-3" />

      <View className="flex-row justify-between items-center">
        {item.nextSession ? (
          <View className="flex-row items-center">
            <View className="bg-[#1B4332] w-8 h-8 rounded-full items-center justify-center mr-2">
              <Feather name="calendar" size={14} color="white" />
            </View>
            <View>
              <Text className="font-sans font-bold text-[#333] text-[13px]">{item.date}</Text>
              <Text className="font-sans text-[#666] text-[12px]">{item.nextSession}</Text>
            </View>
          </View>
        ) : (
          <Text className="font-sans text-[#999] text-[13px]">Sem agendamentos</Text>
        )}
        <Text className="font-sans font-bold text-[#1B4332] text-[15px]">R$ {item.value}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <StatusBar style="dark" />
      <View className="flex-1">
        
        {/* HEADER VERDE (MAIN-HEADER) - Card da Página */}
        <View className="mx-6 mt-6 mb-6 bg-[#1B4332] p-[22px] rounded-[16px] shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
          <View className="flex-row items-center mb-2">
            <TouchableOpacity 
              onPress={() => router.back()} 
              className="w-10 h-10 bg-white/20 rounded-full items-center justify-center mr-4"
            >
              <Feather name="arrow-left" size={20} color="white" />
            </TouchableOpacity>
            <Text className="font-title text-[26px] text-white leading-tight">Minha Agenda</Text>
          </View>
          <Text className="font-sans text-[15px] text-white/85">
            Controle seus horários de forma ágil.
          </Text>
        </View>
        {/* TOGGLE: LISTA | AGENDA EM FORMATO PÍLULA */}
        <View className="px-6 mt-6 mb-6">
          <View className="flex-row bg-[#e5e7eb] p-1 rounded-full">
            <TouchableOpacity 
              onPress={() => setViewMode('lista')}
              className={`flex-1 py-2 items-center justify-center rounded-full ${viewMode === 'lista' ? 'bg-white shadow-sm' : ''}`}
            >
              <Text className={`font-sans font-bold ${viewMode === 'lista' ? 'text-[#1B4332]' : 'text-[#6b7280]'}`}>Pacientes</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setViewMode('agenda')}
              className={`flex-1 py-2 items-center justify-center rounded-full ${viewMode === 'agenda' ? 'bg-white shadow-sm' : ''}`}
            >
              <Text className={`font-sans font-bold ${viewMode === 'agenda' ? 'text-[#1B4332]' : 'text-[#6b7280]'}`}>Agenda</Text>
            </TouchableOpacity>
          </View>
        </View>

        {viewMode === 'lista' ? (
          <>
            {/* BUSCA E FILTROS */}
            <View className="px-6 mb-4 flex-row items-center justify-between">
              <View className="flex-1 flex-row items-center bg-white border border-[#e5e7eb] rounded-[20px] px-4 py-[14px] shadow-sm mr-3">
                <Feather name="search" size={18} color="#9ca3af" style={{ marginRight: 8 }} />
                <TextInput
                  placeholder="Buscar por nome..."
                  value={search}
                  onChangeText={setSearch}
                  className="flex-1 font-sans text-[15px] text-[#1f2937] p-0"
                  placeholderTextColor="#9ca3af"
                />
              </View>
              
              <TouchableOpacity 
                className="bg-white border border-[#e5e7eb] rounded-[20px] px-5 py-[14px] shadow-sm flex-row items-center"
                onPress={() => setFilter(filter === 'ativo' ? 'inativo' : filter === 'inativo' ? 'todos' : 'ativo')}
              >
                <Text className="font-sans font-bold text-[#495057] text-[14px] mr-2">
                  {filter === 'ativo' ? 'Ativos' : filter === 'inativo' ? 'Inativos' : 'Todos'}
                </Text>
                <Feather name="chevron-down" size={16} color="#495057" />
              </TouchableOpacity>
            </View>

            {/* LISTA DE PACIENTES */}
            <FlatList
              data={filteredPatients}
              keyExtractor={item => item.id}
              renderItem={renderItem}
              contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100, paddingTop: 10 }}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View className="items-center justify-center py-10">
                  <Text className="font-sans text-[#6b7280]">Nenhum paciente encontrado.</Text>
                </View>
              }
            />

            {/* FAB (Floating Action Button) */}
            <TouchableOpacity 
              className="absolute bottom-10 right-6 w-14 h-14 bg-[#1B4332] rounded-full items-center justify-center shadow-[0_4px_20px_rgba(27,67,50,0.3)]"
              onPress={() => setModalVisible(true)}
            >
              <Feather name="plus" size={24} color="white" />
            </TouchableOpacity>
          </>
        ) : (
          /* VISÃO DE AGENDA (CALENDÁRIO) */
          <YeloScrollView className="flex-1 px-6 pt-2" showsVerticalScrollIndicator={false}>
            <View className="bg-white rounded-[16px] overflow-hidden border border-[#e5e7eb] shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-6">
              <Calendar
                theme={{
                  backgroundColor: '#ffffff',
                  calendarBackground: '#ffffff',
                  textSectionTitleColor: '#1B4332',
                  selectedDayBackgroundColor: '#1B4332',
                  selectedDayTextColor: '#ffffff',
                  todayTextColor: '#1B4332',
                  dayTextColor: '#495057',
                  textDisabledColor: '#d9e1e8',
                  dotColor: '#1B4332',
                  selectedDotColor: '#ffffff',
                  arrowColor: '#1B4332',
                  monthTextColor: '#1B4332',
                  indicatorColor: '#1B4332',
                  textDayFontFamily: 'System',
                  textMonthFontFamily: 'System',
                  textDayHeaderFontFamily: 'System',
                  textDayFontWeight: '600',
                  textMonthFontWeight: 'bold',
                  textDayHeaderFontWeight: 'bold',
                  textDayFontSize: 15,
                  textMonthFontSize: 18,
                  textDayHeaderFontSize: 13
                }}
                markedDates={{
                  '2026-06-21': {marked: true, dotColor: '#3788d8'},
                  '2026-06-22': {marked: true, dotColor: '#1B4332'},
                  '2026-06-25': {marked: true, dotColor: '#1B4332', activeOpacity: 0},
                  '2026-06-26': {disabled: true, disableTouchEvent: true}
                }}
              />
            </View>

            {/* Legenda do Calendário */}
            <View className="flex-row flex-wrap justify-center space-x-4 mb-10">
              <View className="flex-row items-center mb-2 mr-3">
                <View className="w-3 h-3 rounded-full bg-[#3788d8] mr-2" />
                <Text className="font-sans text-[13px] text-[#495057]">Agendado</Text>
              </View>
              <View className="flex-row items-center mb-2 mr-3">
                <View className="w-3 h-3 rounded-full bg-[#1B4332] mr-2" />
                <Text className="font-sans text-[13px] text-[#495057]">Confirmado</Text>
              </View>
            </View>
          </YeloScrollView>
        )}

        {/* MODAL / BOTTOM SHEET DE NOVO PACIENTE */}
        <Modal 
          visible={modalVisible} 
          animationType="slide" 
          transparent={true} 
          onRequestClose={() => setModalVisible(false)}
        >
          <View className="flex-1 justify-end bg-black/40">
            <View className="bg-white rounded-t-[32px] p-6 h-[85%]">
              
              <View className="w-12 h-1.5 bg-[#e5e7eb] rounded-full self-center mb-6" />
              
              <View className="flex-row items-center mb-6">
                <View className="w-[50px] h-[50px] rounded-full bg-[#f0fdf4] items-center justify-center mr-4 shadow-[0_4px_10px_rgba(27,67,50,0.05)]">
                  <Text className="text-[20px]">👤</Text>
                </View>
                <View>
                  <Text className="font-title text-[22px] text-[#1B4332]">Novo Paciente</Text>
                  <Text className="font-sans text-[14px] text-[#666]">Preencha os dados de cadastro.</Text>
                </View>
                <TouchableOpacity className="ml-auto p-2" onPress={() => setModalVisible(false)}>
                  <Feather name="x" size={24} color="#999" />
                </TouchableOpacity>
              </View>
              
              {/* FORMULÁRIO COM MÁSCARAS */}
              <YeloScrollView showsVerticalScrollIndicator={false}>
                
                <Text className="font-sans font-bold text-[12px] text-[#495057] uppercase mb-2">Nome Completo *</Text>
                <TextInput 
                  className="bg-[#f9fafb] border border-[#ccc] rounded-[12px] px-4 py-4 mb-4 font-sans text-[16px] text-[#1B4332]" 
                  placeholder="Ex: João Silva" 
                />
                
                <Text className="font-sans font-bold text-[12px] text-[#495057] uppercase mb-2">WhatsApp *</Text>
                <TextInput 
                  className="bg-[#f9fafb] border border-[#ccc] rounded-[12px] px-4 py-4 mb-4 font-sans text-[16px] text-[#1B4332]" 
                  placeholder="(00) 00000-0000" 
                  keyboardType="numeric"
                  value={phoneInput}
                  onChangeText={(t) => setPhoneInput(maskPhone(t))}
                  maxLength={15}
                />
                
                <View className="flex-row justify-between mb-4 space-x-3">
                  <View className="flex-1 mr-2">
                    <Text className="font-sans font-bold text-[12px] text-[#495057] uppercase mb-2">Valor (R$)</Text>
                    <TextInput 
                      className="bg-[#f9fafb] border border-[#ccc] rounded-[12px] px-4 py-4 font-sans text-[16px] text-[#1B4332]" 
                      placeholder="R$ 0,00" 
                      keyboardType="numeric"
                      value={valueInput}
                      onChangeText={(t) => setValueInput(maskCurrency(t))}
                    />
                  </View>
                  <View className="flex-1 ml-1">
                    <Text className="font-sans font-bold text-[12px] text-[#495057] uppercase mb-2">Status</Text>
                    <View className="bg-[#f9fafb] border border-[#ccc] rounded-[12px] px-4 py-[16px] flex-row justify-between items-center">
                      <Text className="font-sans text-[16px] text-[#1B4332] font-bold">Ativo</Text>
                      <Feather name="chevron-down" size={16} color="#1B4332" />
                    </View>
                  </View>
                </View>

                <Text className="font-sans font-bold text-[12px] text-[#495057] uppercase mb-2">Observações (Opcional)</Text>
                <TextInput 
                  className="bg-[#f9fafb] border border-[#ccc] rounded-[12px] px-4 py-4 mb-4 font-sans text-[16px] text-[#1B4332]" 
                  placeholder="Histórico, queixas..." 
                  multiline 
                  numberOfLines={3} 
                  style={{ minHeight: 80, textAlignVertical: 'top' }}
                />

                <TouchableOpacity className="bg-[#1B4332] rounded-[16px] py-[16px] items-center mt-2 mb-10 shadow-[0_6px_15px_rgba(27,67,50,0.2)]">
                  <Text className="font-sans font-bold text-white text-[16px]">Salvar Paciente</Text>
                </TouchableOpacity>

              </YeloScrollView>

            </View>
          </View>
        </Modal>

      </View>
    </View>
  );
}
