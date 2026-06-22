import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import YeloScrollView from '../../components/YeloScrollView';

import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// Mock Data
const MOCK_TRANSACTIONS = [
  { id: '1', desc: 'Sessão: Maria Silva', date: '21/06/2026', value: 150.00, type: 'in' },
  { id: '2', desc: 'Sessão: João Pedro', date: '20/06/2026', value: 200.00, type: 'in' },
  { id: '3', desc: 'Assinatura Zoom', date: '15/06/2026', value: 59.90, type: 'out' },
  { id: '4', desc: 'Sessão: Ana Costa', date: '14/06/2026', value: 150.00, type: 'in' },
  { id: '5', desc: 'Supervisão', date: '10/06/2026', value: 250.00, type: 'out' },
];

export default function FinanceiroScreen() {
  const router = useRouter();
  const [showTip, setShowTip] = useState(true);

  return (
    <View className="flex-1 bg-[#f9fafb]">
      <YeloScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        
        {/* HEADER VERDE (MAIN-HEADER) */}
        <View className="mx-6 mt-6 mb-6 bg-[#1B4332] p-[22px] rounded-[16px] shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
          <View className="flex-row items-center mb-2">
            <TouchableOpacity 
              onPress={() => router.back()} 
              className="w-10 h-10 bg-white/20 rounded-full items-center justify-center mr-4"
            >
              <Feather name="arrow-left" size={20} color="white" />
            </TouchableOpacity>
            <Text className="font-title text-[26px] text-white leading-tight">Gestão Financeira</Text>
          </View>
          <Text className="font-sans text-[15px] text-white/85">
            Acompanhe o fluxo de caixa, receitas e despesas.
          </Text>
        </View>

        {/* DICA UX */}
        {showTip && (
          <View className="mx-6 mb-6 bg-white border border-[#e5e7eb] rounded-[16px] p-5 flex-row shadow-sm">
            <TouchableOpacity 
              className="absolute top-2 right-2 p-2"
              onPress={() => setShowTip(false)}
            >
              <Feather name="x" size={18} color="#9ca3af" />
            </TouchableOpacity>
            
            <View className="w-[45px] h-[45px] bg-[#f0fdf4] rounded-full items-center justify-center mr-4">
              <Text className="text-[24px]">🤖</Text>
            </View>
            <View className="flex-1 pr-4">
              <Text className="font-sans font-bold text-[#1B4332] text-[15px] mb-1">
                Seu financeiro é integrado à Agenda!
              </Text>
              <Text className="font-sans text-[#6b7280] text-[13px] leading-relaxed">
                Ao finalizar uma sessão na Agenda e marcar como "Realizado", o valor é somado automaticamente na sua Receita.
              </Text>
            </View>
          </View>
        )}

        {/* AÇÕES E FILTRO */}
        <View className="px-6 mb-6">
          <View className="flex-row justify-between items-center flex-wrap">
            <View className="flex-row space-x-3 mb-4 w-full">
              {/* Botão Lançar Despesa */}
              <TouchableOpacity className="flex-1 bg-[#e63946] flex-row items-center justify-center py-[10px] rounded-full shadow-sm">
                <Text className="text-white text-[15px] font-bold mr-1.5 mt-[-2px]">+</Text>
                <Text className="text-white font-sans font-bold text-[14px]">Despesa</Text>
              </TouchableOpacity>

              {/* Botão Exportar */}
              <TouchableOpacity className="flex-1 bg-white border border-[#e5e7eb] flex-row items-center justify-center py-[10px] rounded-full shadow-sm">
                <Feather name="download" size={15} color="#495057" className="mr-1.5" />
                <Text className="text-[#495057] font-sans font-bold text-[14px]">Exportar</Text>
              </TouchableOpacity>
            </View>

            {/* Filtro de Período */}
            <View className="w-full flex-row justify-between items-center bg-white border border-[#e5e7eb] rounded-[12px] p-3 shadow-sm">
              <Text className="font-sans text-[#6b7280] text-[14px]">Período:</Text>
              <TouchableOpacity className="flex-row items-center bg-[#f9fafb] px-3 py-1.5 rounded-full border border-[#e0e0e0]">
                <Text className="font-sans font-bold text-[#1B4332] text-[13px] mr-2">Este Mês</Text>
                <Feather name="chevron-down" size={14} color="#1B4332" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* CARDS DE KPI (2x2 Grid) */}
        <View className="px-6 mb-8">
          <View className="flex-row justify-between mb-4">
            
            {/* Receita */}
            <View className="bg-white border border-[#e5e7eb] rounded-[16px] p-4 flex-1 mr-2 shadow-sm">
              <View className="flex-row items-center mb-2">
                <View className="bg-[#e8f5e9] p-1.5 rounded-lg mr-2">
                  <Text className="text-[14px]">📈</Text>
                </View>
                <Text className="font-sans font-bold text-[#333] text-[13px]">Receita Realizada</Text>
              </View>
              <Text className="font-title text-[#1B4332] text-[20px] mb-1">R$ 500,00</Text>
              <Text className="font-sans text-[11px] text-[#888]">Sessões pagas</Text>
            </View>

            {/* A Receber */}
            <View className="bg-white border border-[#e5e7eb] rounded-[16px] p-4 flex-1 ml-2 shadow-sm">
              <View className="flex-row items-center mb-2">
                <View className="bg-[#fff3e0] p-1.5 rounded-lg mr-2">
                  <Text className="text-[14px]">⏳</Text>
                </View>
                <Text className="font-sans font-bold text-[#333] text-[13px]">A Receber</Text>
              </View>
              <Text className="font-title text-[#d97706] text-[20px] mb-1">R$ 0,00</Text>
              <Text className="font-sans text-[11px] text-[#888]">Agendamentos futuros</Text>
            </View>
          </View>

          <View className="flex-row justify-between">
            {/* Despesas */}
            <View className="bg-white border border-[#e5e7eb] rounded-[16px] p-4 flex-1 mr-2 shadow-sm">
              <View className="flex-row items-center mb-2">
                <View className="bg-[#ffebee] p-1.5 rounded-lg mr-2">
                  <Text className="text-[14px]">💸</Text>
                </View>
                <Text className="font-sans font-bold text-[#333] text-[13px]">Despesas</Text>
              </View>
              <Text className="font-title text-[#e63946] text-[20px] mb-1">R$ 309,90</Text>
              <Text className="font-sans text-[11px] text-[#888]">Gastos operacionais</Text>
            </View>

            {/* Saldo Líquido */}
            <View className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-[16px] p-4 flex-1 ml-2 shadow-sm">
              <View className="flex-row items-center mb-2">
                <View className="bg-white p-1.5 rounded-lg mr-2 shadow-sm">
                  <Text className="text-[14px]">💎</Text>
                </View>
                <Text className="font-sans font-bold text-[#333] text-[13px]">Saldo Líquido</Text>
              </View>
              <Text className="font-title text-[#166534] text-[20px] mb-1">R$ 190,10</Text>
              <Text className="font-sans text-[11px] text-[#166534]">Lucro do período</Text>
            </View>
          </View>
        </View>

        {/* EXTRATO RECENTE */}
        <View className="px-6 pb-12">
          <Text className="font-title text-[20px] text-[#1B4332] mb-4">Extrato Recente</Text>
          
          <View className="bg-white border border-[#e5e7eb] rounded-[16px] overflow-hidden shadow-sm">
            {MOCK_TRANSACTIONS.map((tx, index) => (
              <View 
                key={tx.id} 
                className={`flex-row items-center p-4 ${index < MOCK_TRANSACTIONS.length - 1 ? 'border-b border-[#f1f3f5]' : ''}`}
              >
                <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${tx.type === 'in' ? 'bg-[#e8f5e9]' : 'bg-[#ffebee]'}`}>
                  <Feather 
                    name={tx.type === 'in' ? 'arrow-down-left' : 'arrow-up-right'} 
                    size={18} 
                    color={tx.type === 'in' ? '#1B4332' : '#e63946'} 
                  />
                </View>
                
                <View className="flex-1">
                  <Text className="font-sans font-bold text-[#333] text-[14px] mb-0.5">{tx.desc}</Text>
                  <Text className="font-sans text-[#888] text-[12px]">{tx.date}</Text>
                </View>

                <View className="items-end">
                  <Text className={`font-sans font-bold text-[15px] ${tx.type === 'in' ? 'text-[#1B4332]' : 'text-[#e63946]'}`}>
                    {tx.type === 'in' ? '+' : '-'} R$ {tx.value.toFixed(2).replace('.', ',')}
                  </Text>
                  <Text className="font-sans text-[#9ca3af] text-[11px] mt-0.5">
                    {tx.type === 'in' ? 'Entrada' : 'Saída'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

      </YeloScrollView>
    </View>
  );
}
