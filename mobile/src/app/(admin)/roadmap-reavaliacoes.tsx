import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';

function formatCountdown(isoStr: string) {
  const target = new Date(isoStr);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diff = Math.round((startTarget.getTime() - startToday.getTime()) / (1000 * 60 * 60 * 24));

  if (diff === 0) return 'É hoje!';
  if (diff === 1) return 'Amanhã';
  if (diff > 1) return `Faltam ${diff} dias`;
  const ago = Math.abs(diff);
  return `Passou há ${ago} ${ago === 1 ? 'dia' : 'dias'}`;
}

export default function AdminRoadmapReavaliacoesScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [marcosText, setMarcosText] = useState('Acompanhe os marcos em Saúde & Crescimento.');

  const fetchMarcos = async () => {
    try {
      const res = await api.get('/api/admin/analytics/growth/health');
      const m = res?.data?.dashboard?.marcos;
      if (m) {
        setMarcosText(
          `Operacional: ${m.m20.atual}/20 (${m.m20.percentual}%) · Saída MEI: ${m.m70.atual}/70 (${m.m70.percentual}%) · Pró-labore: ${m.m120.atual}/120 (${m.m120.percentual}%)`
        );
      }
    } catch (_) {
      // Fallback silencioso
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMarcos();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMarcos();
  }, []);

  const seoCountdown = formatCountdown('2026-11-30T00:00:00-03:00');
  const trafficCountdown = formatCountdown('2026-12-08T00:00:00-03:00');

  return (
    <ScrollView
      className="flex-1 bg-[#f8fafc]"
      contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1B4332" />}
      showsVerticalScrollIndicator={false}
    >
      {/* Cabeçalho simples */}
      <View className="mb-4">
        <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#1B4332', fontSize: 22, marginBottom: 4 }}>
          Implementações &amp; Reavaliações
        </Text>
        <Text className="font-sans text-[#64748b] text-[13px] leading-5">
          Painel rápido de consulta: avaliações agendadas, virada de janeiro e melhorias futuras.
        </Text>
      </View>

      {/* 1. AVALIAÇÕES AGENDADAS */}
      <View className="bg-white border border-[#e2e8f0] rounded-[20px] p-4 mb-4">
        <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#0f172a', fontSize: 16, marginBottom: 2 }}>
          1. Avaliações Agendadas
        </Text>
        <Text className="font-sans text-[#64748b] text-[12px] mb-3">
          Datas previstas na operação e marcos pós-lançamento.
        </Text>

        {/* 30/11 SEO */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push('/(admin)/crm-modulo/cmo-metrics')}
          className="py-3 border-t border-[#f1f5f9]"
        >
          <View className="flex-row items-center justify-between mb-1.5">
            <View className="bg-[#dcfce7] px-2.5 py-1 rounded-full">
              <Text className="font-sans font-bold text-[#166534] text-[11px]">30/11 · {seoCountdown}</Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Text className="font-sans font-bold text-[#1B4332] text-[11.5px]">Ver no CMO</Text>
              <Feather name="arrow-right" size={12} color="#1B4332" />
            </View>
          </View>
          <Text className="font-sans font-bold text-[#0f172a] text-[14px] mb-0.5">
            Revisão SEO &amp; GSC
          </Text>
          <Text className="font-sans text-[#475569] text-[12.5px] leading-[18px]">
            Conferir indexação de Perguntas/Blog no Search Console e otimizar títulos com menor CTR.
          </Text>
        </TouchableOpacity>

        {/* 08/12 Tráfego & Motor V6.1 */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push('/(admin)/crm-modulo/cmo-metrics')}
          className="py-3 border-t border-[#f1f5f9]"
        >
          <View className="flex-row items-center justify-between mb-1.5">
            <View className="bg-[#dbeafe] px-2.5 py-1 rounded-full">
              <Text className="font-sans font-bold text-[#1e40af] text-[11px]">08/12 · {trafficCountdown}</Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Text className="font-sans font-bold text-[#1B4332] text-[11.5px]">Ver no CMO</Text>
              <Feather name="arrow-right" size={12} color="#1B4332" />
            </View>
          </View>
          <Text className="font-sans font-bold text-[#0f172a] text-[14px] mb-0.5">
            Tráfego Pago &amp; Motor V6.1
          </Text>
          <Text className="font-sans text-[#475569] text-[12.5px] leading-[18px]">
            Avaliar teto CPC R$ 5,00 (Google Ads R$ 90/dia), botão WhatsApp em /resultados, Meta Ads e Motor V6.1.
          </Text>
        </TouchableOpacity>

        {/* Jan D+8 */}
        <View className="py-3 border-t border-[#f1f5f9]">
          <View className="self-start bg-[#fef3c7] px-2.5 py-1 rounded-full mb-1.5">
            <Text className="font-sans font-bold text-[#92400e] text-[11px]">Jan (D+8)</Text>
          </View>
          <Text className="font-sans font-bold text-[#0f172a] text-[14px] mb-0.5">
            Auditoria do 1º lote de cobrança pós-trial (7d)
          </Text>
          <Text className="font-sans text-[#475569] text-[12.5px] leading-[18px]">
            Conferir se os primeiros trials Trimestrais/Semestrais cobraram corretamente no 8º dia via tokenização Asaas.
          </Text>
        </View>

        {/* Fev D+30 */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push('/(admin)/crm-modulo/analytics-crescimento')}
          className="py-3 border-t border-[#f1f5f9]"
        >
          <View className="flex-row items-center justify-between mb-1.5">
            <View className="bg-[#fef3c7] px-2.5 py-1 rounded-full">
              <Text className="font-sans font-bold text-[#92400e] text-[11px]">Fev (D+30)</Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Text className="font-sans font-bold text-[#1B4332] text-[11.5px]">Ver Saúde</Text>
              <Feather name="arrow-right" size={12} color="#1B4332" />
            </View>
          </View>
          <Text className="font-sans font-bold text-[#0f172a] text-[14px] mb-0.5">
            Reavaliação da Estratégia (Comunidade + 7d c/ Cartão)
          </Text>
          <Text className="font-sans text-[#475569] text-[12.5px] leading-[18px]">
            Comparar conversão Trial → Pagante e decidir se mantém cartão nos 7 dias ou testa opt-in sem cartão por CPF.
          </Text>
        </TouchableOpacity>

        {/* Marcos */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push('/(admin)/crm-modulo/analytics-crescimento')}
          className="pt-3 border-t border-[#f1f5f9]"
        >
          <View className="flex-row items-center justify-between mb-1.5">
            <View className="bg-[#f1f5f9] px-2.5 py-1 rounded-full">
              <Text className="font-sans font-bold text-[#334155] text-[11px]">Marcos</Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Text className="font-sans font-bold text-[#1B4332] text-[11.5px]">Ver Marcos</Text>
              <Feather name="arrow-right" size={12} color="#1B4332" />
            </View>
          </View>
          <Text className="font-sans font-bold text-[#0f172a] text-[14px] mb-0.5">
            Metas de Base Pagante (20 / 70 / 120)
          </Text>
          <Text className="font-sans text-[#475569] text-[12.5px] leading-[18px]">
            {marcosText}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 2. QUANDO LANÇAR EM JANEIRO */}
      <View className="bg-white border border-[#e2e8f0] rounded-[20px] p-4 mb-4">
        <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#0f172a', fontSize: 16, marginBottom: 2 }}>
          2. Quando lançar em Janeiro
        </Text>
        <Text className="font-sans text-[#64748b] text-[12px] mb-3">
          Virada da branch feature/freemium-plan → main.
        </Text>

        {[
          {
            n: '1',
            title: 'Confirmar tokenização no Asaas Produção',
            desc: 'Validar /v3/creditCard/tokenizeCreditCard habilitado na conta live.',
          },
          {
            n: '2',
            title: 'Definir NEW_PRICING_LAUNCH_DATE no Render',
            desc: 'Preserva preço antigo e exibe aviso somente para assinantes anteriores à data.',
          },
          {
            n: '3',
            title: 'Subir feature/freemium-plan → main',
            desc: 'Testar Mensal (D+7), Trimestral (3x R$ 129), Semestral (6x R$ 99), legado e bloqueio do Comunidade no Match.',
          },
        ].map((step, idx) => (
          <View
            key={step.n}
            className={`flex-row items-start gap-3 py-2.5 ${idx > 0 ? 'border-t border-[#f1f5f9]' : ''}`}
          >
            <View className="w-6 h-6 rounded-full bg-[#1B4332] items-center justify-center mt-0.5">
              <Text className="font-sans font-bold text-white text-[11px]">{step.n}</Text>
            </View>
            <View className="flex-1">
              <Text className="font-sans font-bold text-[#0f172a] text-[13.5px] mb-0.5">{step.title}</Text>
              <Text className="font-sans text-[#475569] text-[12.5px] leading-[18px]">{step.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* 3. IMPLEMENTAÇÕES FUTURAS */}
      <View className="bg-white border border-[#e2e8f0] rounded-[20px] p-4">
        <Text style={{ fontFamily: 'Fraunces_700Bold', color: '#0f172a', fontSize: 16, marginBottom: 2 }}>
          3. Implementações Futuras
        </Text>
        <Text className="font-sans text-[#64748b] text-[12px] mb-3">
          Melhorias mapeadas para solicitar depois.
        </Text>

        {[
          {
            tag: 'Conversão',
            title: 'Reduzir no_contact no WhatsApp',
            desc: 'Disparo síncrono de wa.me em psi_perfil_publico.js + mensagem inicial direta.',
          },
          {
            tag: 'Google Ads',
            title: 'Grupos de cauda longa por abordagem',
            desc: 'Desconcentrar verba das 3 head terms caras e negativar termos sem conversão.',
          },
          {
            tag: 'Produto',
            title: 'Lançamento do Plano Referência',
            desc: 'Supervisão/intervisão, workshops e encaminhamento após consolidar o Essencial.',
          },
          {
            tag: 'CRM',
            title: 'Reativação da base histórica sem assinatura',
            desc: 'Convidar cadastros antigos com CPF para o Comunidade grátis e teste 7d do Essencial.',
          },
        ].map((item, idx) => (
          <View
            key={item.title}
            className={`py-2.5 ${idx > 0 ? 'border-t border-[#f1f5f9]' : ''}`}
          >
            <View className="self-start bg-[#f1f5f9] px-2.5 py-0.5 rounded-full mb-1">
              <Text className="font-sans font-bold text-[#334155] text-[10.5px]">{item.tag}</Text>
            </View>
            <Text className="font-sans font-bold text-[#0f172a] text-[13.5px] mb-0.5">{item.title}</Text>
            <Text className="font-sans text-[#475569] text-[12.5px] leading-[18px]">{item.desc}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
