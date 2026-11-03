import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Pressable,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import api from '../../services/api';

// Dados completos dos Cenários e Templates do Playbook de Conversão
interface TemplateCopy {
  tone: 'acolhedora' | 'objetiva' | 'informal';
  label: string;
  text: string;
}

interface Scenario {
  id: string;
  icon: string;
  title: string;
  shortLabel: string;
  shortDesc: string;
  advice: string;
  copies: TemplateCopy[];
}

const SCENARIOS_DATA: Scenario[] = [
  {
    id: 'quebra-gelo',
    icon: '👋',
    title: '👋 O Primeiro "Oi"',
    shortLabel: 'O Primeiro "Oi"',
    shortDesc: 'Primeiro contato do paciente vindo da Yelo',
    advice:
      'Quando o paciente manda a primeira mensagem (geralmente gerada automaticamente pelo link da Yelo). O segredo aqui é acolhimento rápido e abertura para ouvir.',
    copies: [
      {
        tone: 'acolhedora',
        label: 'Acolhedora',
        text: 'Olá, [Nome]! Que bom que a Yelo cruzou nossos perfis. Sei que dar esse primeiro passo de buscar terapia exige coragem, então seja muito bem-vindo(a). Me conte um pouco: o que te motivou a buscar esse espaço agora?',
      },
      {
        tone: 'objetiva',
        label: 'Objetiva',
        text: 'Olá, [Nome]! Tudo bem? Prazer em falar com você. Recebi seu contato pela Yelo. Para que eu possa entender como te ajudar da melhor forma, você gostaria de me contar brevemente o que está buscando na terapia?',
      },
      {
        tone: 'informal',
        label: 'Mais Informal',
        text: 'Oi, [Nome]! Tudo bem por aí? Vi que você veio pelo meu perfil na Yelo. Fica à vontade para me perguntar qualquer dúvida sobre as sessões. Quer me contar rapidinho o que te fez buscar terapia nesse momento?',
      },
    ],
  },
  {
    id: 'preco-direto',
    icon: '💰',
    title: '💰 Perguntou o Preço Direto',
    shortLabel: 'Perguntou o Preço',
    shortDesc: 'Quando o paciente quer saber o valor de imediato',
    advice:
      'Não esconda o preço, mas não mande apenas um número seco. Ancore o valor ao seu serviço e tente puxar a conversa para a dor do paciente.',
    copies: [
      {
        tone: 'acolhedora',
        label: 'Acolhedora',
        text: 'Olá, [Nome]! Como viu no meu perfil, a sessão tem o valor de R$ [Valor] e dura 50 minutos. Mas antes de fecharmos a questão financeira, para mim é muito importante entender se eu sou a pessoa certa para te ajudar. Você se importaria de me contar brevemente o que você busca nesse momento?',
      },
      {
        tone: 'objetiva',
        label: 'Objetiva',
        text: 'Olá! O valor da minha sessão atual é R$ [Valor] (50 minutos, frequência semanal). Posso te explicar melhor como funciona o meu método de trabalho, caso você queira me contar um pouco sobre o motivo da sua busca.',
      },
    ],
  },
  {
    id: 'pediu-desconto',
    icon: '📉',
    title: '📉 Pediu Desconto / "Tá Caro"',
    shortLabel: 'Pediu Desconto',
    shortDesc: 'Negociação financeira ou pedido de valor social',
    advice:
      'Mantenha a postura. Se você não trabalha com valor social, seja polido e encerre as portas abertas. Se você trabalha com pacotes, essa é a hora de oferecer.',
    copies: [
      {
        tone: 'objetiva',
        label: 'Não dou desconto',
        text: 'Entendo perfeitamente, [Nome]. No momento, este é o valor base do meu trabalho e infelizmente não consigo flexibilizar para não comprometer a qualidade do atendimento que ofereço. Desejo muita sorte na sua busca, e se no futuro fizer sentido, sigo à disposição!',
      },
      {
        tone: 'acolhedora',
        label: 'Oferecendo Pacote',
        text: 'Eu compreendo, [Nome]. O que eu costumo fazer para ajudar pacientes engajados é oferecer um pacote mensal. Fechando 4 sessões no mês, o valor de cada sessão cai para R$ [Valor Menor]. Fica mais acessível para você iniciar?',
      },
    ],
  },
  {
    id: 'vou-pensar',
    icon: '🤔',
    title: '🤔 Disse "Vou pensar"',
    shortLabel: 'Disse "Vou pensar"',
    shortDesc: 'Paciente indeciso ou avaliando opções',
    advice:
      'Não force a barra. Agradeça e deixe a porta aberta. A terapia é uma decisão que exige tempo para algumas pessoas.',
    copies: [
      {
        tone: 'acolhedora',
        label: 'Deixando a porta aberta',
        text: 'Claro, [Nome]! A escolha do psicólogo é algo muito pessoal e você precisa se sentir 100% confortável. Fique super à vontade para pensar o tempo que precisar. Se decidir iniciar, ou se surgir qualquer dúvida, é só me chamar por aqui. Um abraço!',
      },
    ],
  },
  {
    id: 'follow-up-24h',
    icon: '🛟',
    title: '🛟 Resgate (+24h de Vácuo)',
    shortLabel: 'Resgate (+24h)',
    shortDesc: 'Resgate amigável de contato sem resposta',
    advice:
      'O paciente visualizou sua resposta e não falou mais nada. Mande APENAS UMA mensagem de resgate no dia seguinte.',
    copies: [
      {
        tone: 'acolhedora',
        label: 'Acolhedora',
        text: 'Olá, [Nome]! Passando só para deixar um abraço e dizer que sigo à disposição se você ainda estiver avaliando o início da terapia. Caso tenha ficado alguma dúvida sobre os horários ou como funciona o processo online, é só perguntar. Uma ótima semana!',
      },
      {
        tone: 'objetiva',
        label: 'Objetiva',
        text: 'Oi, [Nome]! Tudo bem? Estou organizando minha agenda da semana e lembrei do nosso contato. Você conseguiu pensar sobre o início das sessões ou optou por deixar para um outro momento? Qualquer coisa, estou por aqui.',
      },
    ],
  },
];

// Helper: Botão de Copiar Texto Estilizado
const CopyButton = ({ text, label = 'Copiar Mensagem' }: { text: string; label?: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      Alert.alert('Erro', 'Não foi possível copiar o texto.');
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handleCopy}
      style={{
        backgroundColor: copied ? '#16a34a' : '#dcfce7',
        borderColor: copied ? '#16a34a' : '#86efac',
        borderWidth: 1,
        borderRadius: 50,
        paddingVertical: 10,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'flex-start',
      }}
    >
      <Feather name={copied ? 'check' : 'copy'} size={15} color={copied ? '#ffffff' : '#166534'} />
      <Text
        style={{
          color: copied ? '#ffffff' : '#166534',
          fontWeight: '700',
          fontSize: 13,
          marginLeft: 8,
        }}
      >
        {copied ? 'Copiado!' : label}
      </Text>
    </TouchableOpacity>
  );
};

export default function ManualConversaoScreen() {
  const router = useRouter();

  // Estados de navegação interna
  const [activeTab, setActiveTab] = useState<'mindset' | 'templates' | 'copilot'>('mindset');
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('quebra-gelo');
  const [isCascadeModalOpen, setIsCascadeModalOpen] = useState(false);

  // Estados do Copilot IA
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);

  const scrollViewRef = useRef<any>(null);

  const currentScenario =
    SCENARIOS_DATA.find((s) => s.id === selectedScenarioId) || SCENARIOS_DATA[0];

  // Chamada à API real do Copilot IA
  const handleGenerateAiResponse = async () => {
    const trimmed = aiPrompt.trim();
    if (!trimmed) {
      Alert.alert('Atenção', 'Por favor, descreva a situação da conversa com o paciente.');
      return;
    }

    setAiLoading(true);
    setAiResult(null);

    try {
      const response = await api.post('/api/psychologists/ai-message-assistant', {
        prompt: trimmed,
      });

      if (response.data?.suggestedMessage) {
        setAiResult(response.data.suggestedMessage);
      } else {
        throw new Error('Formato de resposta inesperado');
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        'Não foi possível gerar a resposta com o Copilot IA. Tente novamente.';
      Alert.alert('Erro', msg);
    } finally {
      setAiLoading(false);
    }
  };

  const handleBackPress = () => {
    console.log('[DEBUG_MANUAL_CONVERSAO] Voltando para o hub /clinica');
    router.navigate('/(tabs)/clinica');
  };

  const handleTabPress = (tab: 'mindset' | 'templates' | 'copilot') => {
    console.log('[DEBUG_MANUAL_CONVERSAO] Mudando para aba:', tab);
    setActiveTab(tab);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 95 : 0}
      style={{ flex: 1 }}
    >
      <View className="flex-1 bg-[#f9fafb]">
        <ScrollView
          ref={scrollViewRef}
          className="flex-1"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: activeTab === 'copilot' ? 380 : 120 }}
        >
        {/* TOP NAVIGATION: BOTÃO VOLTAR */}
        <View className="mx-5 mt-5 mb-3 flex-row items-center">
          <TouchableOpacity
            onPress={handleBackPress}
            activeOpacity={0.7}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 24 }}
            className="flex-row items-center py-2 pr-4 self-start"
          >
            <Feather name="arrow-left" size={20} color="#1B4332" />
            <Text className="font-sans font-bold text-[#1B4332] text-[15px] ml-1.5">
              Voltar
            </Text>
          </TouchableOpacity>
        </View>

        {/* MAIN HEADER */}
        <View className="mx-5 mb-5 bg-[#1B4332] p-[22px] rounded-[16px] shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
          <View className="flex-row items-center mb-1.5">
            <Text className="font-title text-[24px] text-white leading-tight flex-1">
              Playbook de Conversão 📖
            </Text>
          </View>
          <Text className="font-sans text-[14.5px] text-white/85 leading-relaxed">
            A sua "bíblia" de atendimento. O que dizer e como conduzir o paciente até a primeira sessão sem parecer um vendedor.
          </Text>
        </View>

        {/* PILL TABS */}
        <View
          className="mx-5 mb-6 flex-row bg-[#f1f5f9] p-1 rounded-full border border-[#e2e8f0]"
          style={{ flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 9999, padding: 4 }}
        >
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => handleTabPress('mindset')}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 9999,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: activeTab === 'mindset' ? '#1B4332' : 'transparent',
              shadowColor: activeTab === 'mindset' ? '#1B4332' : 'transparent',
              shadowOpacity: activeTab === 'mindset' ? 0.2 : 0,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 2 },
            }}
          >
            <Text style={{ fontSize: 14, marginRight: 5 }}>🧠</Text>
            <Text
              style={{
                fontFamily: 'sans-serif',
                fontWeight: '700',
                fontSize: 13,
                color: activeTab === 'mindset' ? '#ffffff' : '#64748b',
              }}
            >
              Orientações
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => handleTabPress('templates')}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 9999,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: activeTab === 'templates' ? '#1B4332' : 'transparent',
              shadowColor: activeTab === 'templates' ? '#1B4332' : 'transparent',
              shadowOpacity: activeTab === 'templates' ? 0.2 : 0,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 2 },
            }}
          >
            <Text style={{ fontSize: 14, marginRight: 5 }}>💬</Text>
            <Text
              style={{
                fontFamily: 'sans-serif',
                fontWeight: '700',
                fontSize: 13,
                color: activeTab === 'templates' ? '#ffffff' : '#64748b',
              }}
            >
              Templates
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => handleTabPress('copilot')}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 9999,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: activeTab === 'copilot' ? '#1B4332' : 'transparent',
              shadowColor: activeTab === 'copilot' ? '#1B4332' : 'transparent',
              shadowOpacity: activeTab === 'copilot' ? 0.2 : 0,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 2 },
            }}
          >
            <Text style={{ fontSize: 14, marginRight: 5 }}>✨</Text>
            <Text
              style={{
                fontFamily: 'sans-serif',
                fontWeight: '700',
                fontSize: 13,
                color: activeTab === 'copilot' ? '#ffffff' : '#64748b',
              }}
            >
              Copilot IA
            </Text>
          </TouchableOpacity>
        </View>

        {/* ======================================================== */}
        {/* ABA 1: ORIENTAÇÕES (MINDSET E SUPERVISÃO) */}
        {/* ======================================================== */}
        {activeTab === 'mindset' && (
          <View className="mx-5">
            {/* BANNER DE SUPERVISÃO CLÍNICA */}
            <LinearGradient
              colors={['#1B4332', '#2d6a4f']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 18,
                padding: 22,
                marginBottom: 20,
                shadowColor: '#1B4332',
                shadowOpacity: 0.15,
                shadowRadius: 15,
                shadowOffset: { width: 0, height: 6 },
              }}
            >
              <View className="flex-row items-center mb-3">
                <Text className="text-[32px] mr-3">🛋️</Text>
                <Text className="font-title text-[20px] text-white flex-1 leading-snug">
                  Supervisão Clínica do Contato Inicial
                </Text>
              </View>
              <Text className="font-sans text-[14px] text-white/90 leading-relaxed text-justify">
                O vínculo terapêutico não começa na primeira sessão; ele começa na primeira mensagem trocada. Enxergue o WhatsApp como a ante-sala do seu consultório.{'\n\n'}
                Aqui, discutimos a postura ética e acolhedora necessária para transformar interessados em pacientes engajados, sem comprometer o rigor da sua prática.
              </Text>
            </LinearGradient>

            {/* CARD 1: ÉTICA DA CONVERSÃO */}
            <View className="bg-white rounded-[18px] p-5 mb-5 border border-[#e5e7eb] border-l-4 border-l-[#3b82f6] shadow-sm">
              <Text className="font-title text-[#1B4332] text-[17px] mb-3 leading-snug">
                🛡️ A Ética da Conversão (Psicólogo ≠ Vendedor)
              </Text>
              <Text className="font-sans text-[#475569] text-[14px] leading-relaxed mb-3 text-justify">
                O maior bloqueio dos profissionais de saúde ao captar online é o medo de "soar como um vendedor". É fundamental ressignificar essa etapa.
              </Text>
              <Text className="font-sans text-[#475569] text-[14px] leading-relaxed mb-3 text-justify">
                <Text className="font-bold text-[#1B4332]">Você não está vendendo uma cura, está oferecendo um espaço seguro.</Text> Quando um paciente chega até você, ele traz angústias e vulnerabilidade. Sua clareza sobre preços, métodos e horários não é "técnica agressiva", é <Text className="font-bold text-[#1B4332]">contorno e acolhimento</Text>.
              </Text>
              <Text className="font-sans text-[#475569] text-[14px] leading-relaxed text-justify">
                Deixar o paciente no vácuo, não ser transparente com valores ou hesitar na resposta gera ansiedade. Ser objetivo, seguro e empático é, por si só, uma intervenção terapêutica inicial poderosa.
              </Text>
            </View>

            {/* CARD 2: SETTING TERAPÊUTICO VIRTUAL */}
            <View className="bg-white rounded-[18px] p-5 mb-5 border border-[#e5e7eb] border-l-4 border-l-[#22c55e] shadow-sm">
              <Text className="font-title text-[#1B4332] text-[17px] mb-1.5 leading-snug">
                ✅ O Setting Terapêutico Virtual
              </Text>
              <Text className="font-sans text-[#64748b] text-[13px] mb-4">
                Antes de responder ao primeiro paciente do dia, certifique-se de que sua "sala de espera digital" está pronta:
              </Text>

              <View className="space-y-3">
                <View className="flex-row items-start py-2 border-b border-[#f1f5f9]">
                  <View className="w-5 h-5 rounded-full bg-[#dcfce7] items-center justify-center mr-2.5 mt-0.5">
                    <Feather name="check" size={12} color="#16a34a" />
                  </View>
                  <Text className="font-sans text-[#475569] text-[13.5px] leading-relaxed flex-1">
                    <Text className="font-bold text-[#1e293b]">Foto e Perfil:</Text> Sua foto do WhatsApp transmite a mesma seriedade e empatia do seu perfil na Yelo?
                  </Text>
                </View>

                <View className="flex-row items-start py-2 border-b border-[#f1f5f9]">
                  <View className="w-5 h-5 rounded-full bg-[#dcfce7] items-center justify-center mr-2.5 mt-0.5">
                    <Feather name="check" size={12} color="#16a34a" />
                  </View>
                  <Text className="font-sans text-[#475569] text-[13.5px] leading-relaxed flex-1">
                    <Text className="font-bold text-[#1e293b]">Sem Robôs:</Text> Mensagens automáticas frias ("Digite 1 para agendar") estão desativadas?
                  </Text>
                </View>

                <View className="flex-row items-start py-2 border-b border-[#f1f5f9]">
                  <View className="w-5 h-5 rounded-full bg-[#dcfce7] items-center justify-center mr-2.5 mt-0.5">
                    <Feather name="check" size={12} color="#16a34a" />
                  </View>
                  <Text className="font-sans text-[#475569] text-[13.5px] leading-relaxed flex-1">
                    <Text className="font-bold text-[#1e293b]">Contorno Financeiro:</Text> O valor da sua sessão e as formas de pagamento estão internalizados para que você os comunique sem hesitação?
                  </Text>
                </View>

                <View className="flex-row items-start py-2">
                  <View className="w-5 h-5 rounded-full bg-[#dcfce7] items-center justify-center mr-2.5 mt-0.5">
                    <Feather name="check" size={12} color="#16a34a" />
                  </View>
                  <Text className="font-sans text-[#475569] text-[13.5px] leading-relaxed flex-1">
                    <Text className="font-bold text-[#1e293b]">Agenda Clara:</Text> Você sabe exatamente quais são seus próximos 3 horários livres para oferecer de imediato?
                  </Text>
                </View>
              </View>
            </View>

            {/* CARD 3: 6 FALHAS CRÍTICAS DE MANEJO */}
            <View className="bg-white rounded-[18px] p-5 mb-5 border border-[#e5e7eb] border-l-4 border-l-[#ef4444] shadow-sm">
              <Text className="font-title text-[#1B4332] text-[17px] mb-1.5 leading-snug">
                🛑 6 Falhas Críticas de Manejo (Matam o Vínculo)
              </Text>
              <Text className="font-sans text-[#64748b] text-[13px] mb-4">
                Comportamentos comuns que quebram a aliança terapêutica antes mesmo dela se formar:
              </Text>

              <View className="gap-3">
                <View className="bg-[#fef2f2] p-3.5 rounded-[12px] border border-[#fecaca]">
                  <Text className="font-sans font-bold text-[#991b1b] text-[14px] mb-1">
                    1. O Paredão de Texto
                  </Text>
                  <Text className="font-sans text-[#475569] text-[13px] leading-relaxed">
                    Despejar textos gigantes e regras de contrato na primeira resposta eleva a ansiedade do paciente. Seja breve no primeiro "Oi" e construa a conversa aos poucos.
                  </Text>
                </View>

                <View className="bg-[#fef2f2] p-3.5 rounded-[12px] border border-[#fecaca]">
                  <Text className="font-sans font-bold text-[#991b1b] text-[14px] mb-1">
                    2. Áudios Intrusivos
                  </Text>
                  <Text className="font-sans text-[#475569] text-[13px] leading-relaxed">
                    Muitos pacientes buscam ajuda escondidos no trabalho ou perto de familiares. Mandar áudios sem pedir licença prévia pode violar a privacidade imediata deles.
                  </Text>
                </View>

                <View className="bg-[#fef2f2] p-3.5 rounded-[12px] border border-[#fecaca]">
                  <Text className="font-sans font-bold text-[#991b1b] text-[14px] mb-1">
                    3. O Interrogatório Precoce
                  </Text>
                  <Text className="font-sans text-[#475569] text-[13px] leading-relaxed">
                    Fazer perguntas clínicas profundas pelo WhatsApp afasta o paciente. Lembre-se: o diagnóstico, o acolhimento profundo e a anamnese pertencem à sessão.
                  </Text>
                </View>

                <View className="bg-[#fef2f2] p-3.5 rounded-[12px] border border-[#fecaca]">
                  <Text className="font-sans font-bold text-[#991b1b] text-[14px] mb-1">
                    4. Fuga e Insegurança com Preço
                  </Text>
                  <Text className="font-sans text-[#475569] text-[13px] leading-relaxed">
                    Esconder o valor, enrolar para falar ou justificar excessivamente o porquê do seu preço transmite extrema insegurança sobre a própria capacidade profissional.
                  </Text>
                </View>

                <View className="bg-[#fef2f2] p-3.5 rounded-[12px] border border-[#fecaca]">
                  <Text className="font-sans font-bold text-[#991b1b] text-[14px] mb-1">
                    5. Frieza Burocrática
                  </Text>
                  <Text className="font-sans text-[#475569] text-[13px] leading-relaxed">
                    Responder de forma seca, robótica ou apenas mandando o valor do Pix ignora o sofrimento que levou a pessoa a buscar ajuda naquele dia.
                  </Text>
                </View>

                <View className="bg-[#fef2f2] p-3.5 rounded-[12px] border border-[#fecaca]">
                  <Text className="font-sans font-bold text-[#991b1b] text-[14px] mb-1">
                    6. Assédio Comercial (Falta de Espaço)
                  </Text>
                  <Text className="font-sans text-[#475569] text-[13px] leading-relaxed">
                    Insistir repetidas vezes após o silêncio. O espaço terapêutico exige respeito ao tempo do outro; faça no máximo um follow-up e dê espaço se ele recuar.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* ABA 2: TEMPLATES PRONTOS (SELETOR CASCATA E SCRIPTS) */}
        {/* ======================================================== */}
        {activeTab === 'templates' && (
          <View className="mx-5">
            {/* SELETOR EM CASCATA DE CENÁRIOS */}
            <View className="mb-4">
              <Text className="font-sans font-bold text-[#64748b] text-[12px] uppercase tracking-wider mb-2">
                Escolha a Situação
              </Text>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setIsCascadeModalOpen(true)}
                className="flex-row items-center justify-between bg-white px-4 py-3.5 rounded-full border border-[#cbd5e1] shadow-sm"
              >
                <View className="flex-row items-center flex-1 mr-2">
                  <View className="w-8 h-8 rounded-full bg-[#f1f5f9] items-center justify-center mr-3">
                    <Text className="text-[17px]">{currentScenario.icon}</Text>
                  </View>
                  <Text className="font-sans font-bold text-[#0f172a] text-[15px] flex-1" numberOfLines={1}>
                    {currentScenario.title}
                  </Text>
                </View>
                <Feather name="chevron-down" size={20} color="#1B4332" />
              </TouchableOpacity>
            </View>

            {/* ATALHOS RÁPIDOS EM PÍLULAS */}
            <View className="mb-5 flex-row flex-wrap gap-2">
              {SCENARIOS_DATA.map((sc) => {
                const isSelected = sc.id === selectedScenarioId;
                return (
                  <TouchableOpacity
                    key={sc.id}
                    onPress={() => setSelectedScenarioId(sc.id)}
                    className={`px-3 py-1.5 rounded-full border flex-row items-center ${
                      isSelected
                        ? 'bg-[#1B4332] border-[#1B4332]'
                        : 'bg-white border-[#e2e8f0]'
                    }`}
                  >
                    <Text className="text-[13px] mr-1.5">{sc.icon}</Text>
                    <Text
                      className={`font-sans font-bold text-[12px] ${
                        isSelected ? 'text-white' : 'text-[#475569]'
                      }`}
                    >
                      {sc.shortLabel}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* DISPLAY DO CENÁRIO ATIVO */}
            <View className="bg-white rounded-[20px] p-5 border border-[#e5e7eb] shadow-sm mb-5">
              <Text className="font-title text-[#1B4332] text-[20px] mb-3">
                {currentScenario.title}
              </Text>

              {/* DICA DE CONDUTA */}
              <View className="bg-[#fffbeb] border-l-4 border-[#f59e0b] p-4 rounded-r-[12px] mb-5">
                <Text className="font-sans text-[#92400e] text-[13.5px] leading-relaxed">
                  <Text className="font-bold">Dica: </Text>
                  {currentScenario.advice}
                </Text>
              </View>

              {/* CARDS DE CÓPIAS / MENSAGENS */}
              <View className="gap-4">
                {currentScenario.copies.map((copy, idx) => {
                  let badgeBg = '#fdf4ff';
                  let badgeText = '#a21caf';
                  let badgeBorder = '#f5d0fe';

                  if (copy.tone === 'objetiva' || copy.label === 'Não dou desconto') {
                    badgeBg = '#eff6ff';
                    badgeText = '#1d4ed8';
                    badgeBorder = '#bfdbfe';
                  } else if (copy.tone === 'informal' || copy.label === 'Oferecendo Pacote') {
                    badgeBg = '#fef2f2';
                    badgeText = '#b91c1c';
                    badgeBorder = '#fecaca';
                  }

                  return (
                    <View
                      key={idx}
                      className="border border-[#e2e8f0] rounded-[16px] overflow-hidden bg-white shadow-sm"
                    >
                      {/* Header do Card com Badge */}
                      <View className="bg-[#f8fafc] px-4 py-2.5 border-b border-[#e2e8f0] flex-row justify-between items-center">
                        <View
                          style={{
                            backgroundColor: badgeBg,
                            borderColor: badgeBorder,
                            borderWidth: 1,
                            paddingHorizontal: 12,
                            paddingVertical: 4,
                            borderRadius: 50,
                          }}
                        >
                          <Text
                            style={{
                              color: badgeText,
                              fontSize: 11,
                              fontWeight: '700',
                              textTransform: 'uppercase',
                              letterSpacing: 0.5,
                            }}
                          >
                            {copy.label}
                          </Text>
                        </View>
                      </View>

                      {/* Corpo com Texto Itálico e Botão Copiar */}
                      <View className="p-4">
                        <Text className="font-sans italic text-[#334155] text-[14.5px] leading-relaxed mb-4 text-justify">
                          "{copy.text}"
                        </Text>

                        <CopyButton text={copy.text} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* ABA 3: COPILOT IA (GERADOR DE RESPOSTAS PERSONALIZADAS) */}
        {/* ======================================================== */}
        {activeTab === 'copilot' && (
          <View className="mx-5">
            <View className="bg-white rounded-[20px] p-5 border border-[#e5e7eb] shadow-sm">
              <Text className="font-title text-[#1B4332] text-[20px] mb-3 flex-row items-center">
                ✨ Copilot de Conversão
              </Text>

              {/* AVISO ÉTICO DE TRAVA CLÍNICA */}
              <View className="bg-[#fef2f2] border-l-4 border-[#ef4444] p-3.5 rounded-r-[10px] mb-4 flex-row items-start">
                <Text className="text-[18px] mr-2.5 mt-0.5">⚠️</Text>
                <View className="flex-1">
                  <Text className="font-sans font-bold text-[#991b1b] text-[13px] mb-1">
                    Atenção: Apenas Suporte Comercial
                  </Text>
                  <Text className="font-sans text-[#7f1d1d] text-[12.5px] leading-relaxed text-justify">
                    Esta ferramenta foi desenvolvida <Text className="font-bold">exclusivamente</Text> para auxiliar no processo comercial e de conversão (vendas, quebra-gelo, negociação de valores). Não utilize esta IA para buscar orientações clínicas, supervisão técnica, diagnósticos ou condutas terapêuticas.
                  </Text>
                </View>
              </View>

              <Text className="font-sans text-[#64748b] text-[14px] leading-relaxed mb-4 text-justify">
                O paciente respondeu algo que você não esperava e não sabe bem como conduzir? Descreva rapidamente a situação abaixo e nossa Inteligência Artificial vai sugerir uma resposta ética e acolhedora para você continuar a conversa.
              </Text>

              {/* INPUT MULTILINE PROMPT */}
              <TextInput
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                value={aiPrompt}
                onChangeText={setAiPrompt}
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 250);
                }}
                placeholder="Ex: Um paciente chamado João entrou em contato, perguntou sobre TCC para ansiedade, mas achou a sessão de R$ 200 cara porque está desempregado. Como posso responder acolhendo a situação dele, mas mantendo meu valor?"
                placeholderTextColor="#94a3b8"
                className="bg-[#f8fafc] border border-[#e2e8f0] rounded-[16px] p-4 font-sans text-[#334155] text-[14.5px] leading-relaxed mb-4 min-h-[130px]"
              />

              {/* BOTÃO GERAR COM IA */}
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={aiLoading}
                onPress={handleGenerateAiResponse}
                style={{
                  backgroundColor: aiLoading ? '#a78bfa' : '#7c3aed',
                  paddingVertical: 14,
                  borderRadius: 50,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#7c3aed',
                  shadowOpacity: 0.25,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                }}
              >
                {aiLoading ? (
                  <>
                    <ActivityIndicator size="small" color="#ffffff" />
                    <Text className="font-sans font-bold text-white text-[15px] ml-2">
                      Pensando com IA...
                    </Text>
                  </>
                ) : (
                  <>
                    <Feather name="zap" size={17} color="#ffffff" />
                    <Text className="font-sans font-bold text-white text-[15px] ml-2">
                      Gerar Resposta Personalizada
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* RESULTADO GERADO PELA IA */}
              {aiResult && (
                <View className="mt-6 bg-[#f8fafc] border border-[#e2e8f0] rounded-[16px] p-4">
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="font-sans font-bold text-[#475569] text-[13px] uppercase tracking-wider">
                      Resposta Sugerida:
                    </Text>
                    <View className="bg-[#ede9fe] px-2.5 py-1 rounded-full">
                      <Text className="font-sans font-bold text-[#7c3aed] text-[11px]">
                        ✨ Gerado por Gemini
                      </Text>
                    </View>
                  </View>

                  <View className="bg-white p-4 rounded-[12px] border border-[#e2e8f0] mb-4">
                    <Text className="font-sans italic text-[#334155] text-[14.5px] leading-relaxed text-justify">
                      "{aiResult}"
                    </Text>
                  </View>

                  <CopyButton text={aiResult} label="Copiar Resposta" />
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ======================================================== */}
      {/* MODAL BOTTOM SHEET: SELETOR DE CENÁRIOS EM CASCATA */}
      {/* ======================================================== */}
      <Modal
        visible={isCascadeModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsCascadeModalOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={() => setIsCascadeModalOpen(false)}
        >
          <Pressable
            className="bg-white rounded-t-[28px] p-6 max-h-[80%]"
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <View className="flex-row justify-between items-center mb-5 pb-3 border-b border-[#f1f5f9]">
              <View>
                <Text className="font-title text-[20px] text-[#1B4332]">
                  Selecione a Situação
                </Text>
                <Text className="font-sans text-[13px] text-[#64748b]">
                  Roteiros prontos para cada etapa do contato
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsCascadeModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[#f1f5f9] items-center justify-center"
              >
                <Feather name="x" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Lista de Cenários */}
            <View className="gap-2.5 pb-6">
              {SCENARIOS_DATA.map((sc) => {
                const isSelected = sc.id === selectedScenarioId;
                return (
                  <TouchableOpacity
                    key={sc.id}
                    activeOpacity={0.7}
                    onPress={() => {
                      setSelectedScenarioId(sc.id);
                      setIsCascadeModalOpen(false);
                    }}
                    className={`p-3.5 rounded-[16px] flex-row items-center border transition-all ${
                      isSelected
                        ? 'bg-[#f0fdf4] border-[#86efac]'
                        : 'bg-white border-[#e2e8f0]'
                    }`}
                  >
                    <View
                      className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                        isSelected ? 'bg-[#dcfce7]' : 'bg-[#f8fafc]'
                      }`}
                    >
                      <Text className="text-[20px]">{sc.icon}</Text>
                    </View>

                    <View className="flex-1 mr-2">
                      <Text
                        className={`font-sans font-bold text-[14.5px] mb-0.5 ${
                          isSelected ? 'text-[#166534]' : 'text-[#1e293b]'
                        }`}
                      >
                        {sc.shortLabel}
                      </Text>
                      <Text
                        className="font-sans text-[12px] text-[#64748b]"
                        numberOfLines={1}
                      >
                        {sc.shortDesc}
                      </Text>
                    </View>

                    {isSelected && (
                      <Feather name="check" size={18} color="#16a34a" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}
