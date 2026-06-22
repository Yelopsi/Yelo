import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import YeloScrollView from '../../../components/YeloScrollView';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

const MOCK_SESSIONS = [
  { id: '101', date: '18 Jun 2026', time: '14:00', status: 'realizada', notes: 'Paciente relatou melhora na ansiedade frente aos novos desafios no trabalho.' },
  { id: '102', date: '11 Jun 2026', time: '14:00', status: 'realizada', notes: 'Trabalhamos técnicas de respiração e ancoragem.' },
  { id: '103', date: '04 Jun 2026', time: '14:00', status: 'falta', notes: 'Paciente não compareceu. Tentativa de contato sem sucesso.' },
  { id: '104', date: '28 Mai 2026', time: '14:00', status: 'realizada', notes: 'Primeira sessão. Coleta de histórico e anamnese inicial estruturada.' },
];

export default function PacienteDetailScreen() {
  const { id } = useLocalSearchParams();
  const [filterMonth, setFilterMonth] = useState('Junho 2026');

  // Normalmente buscaria os dados reais do paciente pelo ID
  const patient = { name: 'Ana Maria Silva', phone: '(11) 99999-9999', status: 'ativo', value: '150,00' };

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <StatusBar style="dark" />
      <SafeAreaView className="flex-1" edges={['top']}>
        
        {/* HEADER */}
        <View className="flex-row items-center px-6 mt-4 mb-6">
          <TouchableOpacity 
            onPress={() => router.back()} 
            className="w-10 h-10 bg-white border border-[#e5e7eb] rounded-full items-center justify-center shadow-sm mr-4"
          >
            <Feather name="arrow-left" size={20} color="#1f2937" />
          </TouchableOpacity>
          <View>
            <Text className="font-title text-[22px] text-[#1B4332] leading-tight">Perfil do Paciente</Text>
          </View>
        </View>

        <YeloScrollView showsVerticalScrollIndicator={false}>
          {/* CARD DO PERFIL */}
          <View className="px-6 mb-8">
            <View className="bg-white rounded-[20px] p-6 border border-[#e5e7eb] shadow-[0_4px_20px_rgba(0,0,0,0.03)] items-center">
              <View className="w-[80px] h-[80px] rounded-full bg-[#f0fdf4] items-center justify-center mb-4">
                <Text className="text-[32px]">👤</Text>
              </View>
              <Text className="font-title text-[24px] text-[#1f2937] mb-1 text-center">{patient.name}</Text>
              <Text className="font-sans text-[15px] text-[#6b7280] mb-4">{patient.phone}</Text>
              
              <View className="flex-row items-center justify-center w-full">
                <View className="bg-[#e8f5e9] px-4 py-1.5 rounded-full mr-2 border border-[#cce5d4]">
                  <Text className="font-sans font-bold text-[12px] text-[#1B4332]">Ativo</Text>
                </View>
                <View className="bg-[#f3f4f6] px-4 py-1.5 rounded-full ml-2 border border-[#e5e7eb]">
                  <Text className="font-sans font-bold text-[12px] text-[#495057]">R$ {patient.value}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* SESSÕES E HISTÓRICO */}
          <View className="px-6 mb-10">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="font-title text-[20px] text-[#1B4332]">Histórico de Sessões</Text>
              <TouchableOpacity className="flex-row items-center bg-white border border-[#e5e7eb] rounded-[12px] px-3 py-2 shadow-sm">
                <Feather name="calendar" size={14} color="#495057" style={{ marginRight: 6 }} />
                <Text className="font-sans font-bold text-[13px] text-[#495057] mr-1">{filterMonth}</Text>
                <Feather name="chevron-down" size={14} color="#495057" />
              </TouchableOpacity>
            </View>

            {/* TIMELINE DE SESSÕES */}
            <View className="ml-2">
              {MOCK_SESSIONS.map((session, index) => {
                const isRealizada = session.status === 'realizada';
                const isFalta = session.status === 'falta';
                
                return (
                  <View key={session.id} className="flex-row mb-6">
                    {/* Linha vertical e bolinha */}
                    <View className="items-center mr-4">
                      <View className={`w-4 h-4 rounded-full ${isRealizada ? 'bg-[#1B4332]' : isFalta ? 'bg-[#e63946]' : 'bg-[#9ca3af]'} z-10 mt-1`} />
                      {index !== MOCK_SESSIONS.length - 1 && (
                        <View className="w-[2px] flex-1 bg-[#e5e7eb] -mt-2" />
                      )}
                    </View>

                    {/* Conteúdo do Histórico */}
                    <View className="flex-1 bg-white border border-[#e5e7eb] rounded-[16px] p-4 shadow-sm -mt-2">
                      <View className="flex-row justify-between items-center mb-3">
                        <Text className="font-sans font-bold text-[14px] text-[#1f2937]">{session.date} • {session.time}</Text>
                        <View className={`px-2 py-1 rounded-[6px] ${isRealizada ? 'bg-[#e8f5e9]' : isFalta ? 'bg-[#ffe4e6]' : 'bg-[#f3f4f6]'}`}>
                          <Text className={`font-sans font-bold text-[10px] uppercase ${isRealizada ? 'text-[#1B4332]' : isFalta ? 'text-[#e63946]' : 'text-[#6b7280]'}`}>
                            {session.status}
                          </Text>
                        </View>
                      </View>
                      <Text className="font-sans text-[14px] text-[#6b7280] leading-relaxed">
                        {session.notes}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </YeloScrollView>
      </SafeAreaView>
    </View>
  );
}
