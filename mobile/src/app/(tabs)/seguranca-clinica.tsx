import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';

const CopyPillButton = ({ text }: { text: string }) => {
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
        backgroundColor: copied ? '#16a34a' : '#0f172a',
        borderRadius: 999,
        paddingVertical: 8,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <Feather name={copied ? 'check' : 'copy'} size={13} color="#ffffff" />
      <Text
        style={{
          color: '#ffffff',
          fontWeight: '600',
          fontSize: 12.5,
          marginLeft: 6,
        }}
      >
        {copied ? 'Copiado' : 'Copiar'}
      </Text>
    </TouchableOpacity>
  );
};

const CLAUSULA_CONTRATO = `CLÁUSULA DE POSTURA, SEGURANÇA E RESPEITO MÚTUO: Para a realização das sessões (presenciais ou online), o(a) paciente compromete-se a comparecer em ambiente adequado, com privacidade, iluminação suficiente, vestimenta compatível e câmera de vídeo aberta (na modalidade online). Qualquer conduta desrespeitosa, invasiva, exposição corporal indevida ou manifestação de cunho sexual direcionada à profissional acarretará a interrupção imediata da sessão e a rescisão unilateral do contrato, sem direito a reembolso dos valores pagos, ficando a profissional autorizada (Arts. 9º e 10º do Código de Ética do CFP) a utilizar os dados cadastrais para comunicação às autoridades policiais.`;

const SCRIPT_TRIAGEM = `Perfeito! Para deixarmos o seu horário da primeira sessão reservado na agenda e preenchermos o seu cadastro clínico obrigatório (incluindo a emissão do recibo oficial pelo Receita Saúde), preciso apenas que você me envie por aqui:

1. Seu nome completo e data de nascimento;
2. Seu CPF;
3. O comprovante do PIX referente à primeira sessão (Chave PIX: [SUA CHAVE] — Valor: R$ [VALOR]).

Assim que confirmado, já te envio o link da nossa sala virtual!`;

const SCRIPT_CAMERA = `Olá, [Nome]. Para realizarmos a nossa primeira sessão online com ética e segurança técnica, é indispensável que a sua câmera permaneça aberta mostrando o seu rosto em ambiente iluminado, sentado(a) e com vestimenta adequada. Caso não seja possível ajustar neste momento, precisaremos encerrar a chamada de hoje.`;

const SCRIPT_ENCERRAMENTO = `Este número é um canal estritamente profissional de Psicologia. Diante da conduta inadequada e sem consentimento, encerro imediatamente este contato. Informo que o número, data, horário e mensagens foram salvos para registro de Boletim de Ocorrência policial, nos termos do Código Penal e do Art. 10º do Código de Ética do CFP.`;

export default function SegurancaClinicaScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'agir' | 'prevencao' | 'sigilo' | 'clausulas'>('agir');
  const [showTransparency, setShowTransparency] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<string>('regra-ouro');

  const openExternalUrl = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Atenção', 'Não foi possível abrir o link no seu dispositivo.');
    }
  };

  const toggleAccordion = (id: string) => {
    setOpenAccordion((prev) => (prev === id ? '' : id));
  };

  return (
    <View className="flex-1 bg-[#f8fafc]">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 130 }}
      >
        {/* 1. HERO MINIMALISTA (ESTILO NUBANK CENTRAL DE PROTEÇÃO) */}
        <View
          className="mx-5 mt-5 mb-5 bg-[#1B4332] rounded-[26px] p-6"
          style={{
            shadowColor: '#1B4332',
            shadowOpacity: 0.22,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
          }}
        >
          <View
            style={{
              alignSelf: 'flex-start',
              backgroundColor: 'rgba(255,255,255,0.12)',
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 5,
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 14,
            }}
          >
            <Feather name="shield" size={13} color="#FFEE8C" />
            <Text style={{ color: '#FFEE8C', fontSize: 11.5, fontWeight: '700', marginLeft: 6 }}>
              Central de Proteção à Psicóloga
            </Text>
          </View>

          <Text className="font-title text-[25px] text-white leading-tight mb-2">
            Segurança na Clínica
          </Text>
          <Text className="font-sans text-[14px] text-white/85 leading-relaxed">
            Protocolo prático de prevenção, respaldo ético do CFP e canais imediatos de denúncia contra assédio no atendimento online e presencial.
          </Text>

          {/* Drawer Expansível de Transparência WhatsApp */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setShowTransparency(!showTransparency)}
            style={{
              marginTop: 18,
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderColor: 'rgba(255,255,255,0.16)',
              borderWidth: 1,
              borderRadius: 16,
              paddingVertical: 12,
              paddingHorizontal: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
              <Feather name="info" size={15} color="#FFEE8C" />
              <Text
                style={{
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: '600',
                  marginLeft: 8,
                  flex: 1,
                }}
              >
                Como funciona a privacidade do WhatsApp?
              </Text>
            </View>
            <Feather
              name={showTransparency ? 'chevron-up' : 'chevron-down'}
              size={16}
              color="rgba(255,255,255,0.8)"
            />
          </TouchableOpacity>

          {showTransparency && (
            <View
              style={{
                marginTop: 8,
                backgroundColor: 'rgba(0,0,0,0.2)',
                borderRadius: 14,
                padding: 14,
              }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.88)', fontSize: 13, lineHeight: 20 }}>
                Quando alguém clica no botão do seu perfil, a conversa acontece direto entre os dois celulares (criptografia ponta a ponta). A Yelo não recebe o número da pessoa nem vê as mensagens, por isso não conseguimos bloquear o contato no seu aparelho. Estamos evoluindo nossas camadas de proteção continuamente e preparamos este guia prático para você agir agora.
              </Text>
            </View>
          )}
        </View>

        {/* 2. DOCK DE AÇÃO RÁPIDA (2x2 COMPACTO ESTILO NUBANK) */}
        <Text
          style={{
            fontSize: 11.5,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 0.7,
            color: '#64748b',
            marginHorizontal: 24,
            marginBottom: 8,
          }}
        >
          Canais de Ação Rápida
        </Text>

        <View className="mx-5 mb-6" style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() =>
                openExternalUrl(
                  'https://www.gov.br/pt-br/servicos/registrar-ocorrencia-policial-online'
                )
              }
              style={{
                flex: 1,
                backgroundColor: '#ffffff',
                borderRadius: 20,
                padding: 15,
                borderWidth: 1,
                borderColor: 'rgba(15,23,42,0.07)',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 11,
                    backgroundColor: '#fef2f2',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Feather name="file-plus" size={17} color="#dc2626" />
                </View>
                <Feather name="arrow-up-right" size={15} color="#94a3b8" />
              </View>
              <Text style={{ fontWeight: '700', fontSize: 13.5, color: '#0f172a' }}>
                Fazer B.O. Online
              </Text>
              <Text style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                Delegacia Virtual gov.br
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => openExternalUrl('tel:180')}
              style={{
                flex: 1,
                backgroundColor: '#ffffff',
                borderRadius: 20,
                padding: 15,
                borderWidth: 1,
                borderColor: 'rgba(15,23,42,0.07)',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 11,
                    backgroundColor: '#fef2f2',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Feather name="phone-call" size={17} color="#dc2626" />
                </View>
                <Feather name="arrow-up-right" size={15} color="#94a3b8" />
              </View>
              <Text style={{ fontWeight: '700', fontSize: 13.5, color: '#0f172a' }}>
                Ligue 180
              </Text>
              <Text style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                Central da Mulher 24h
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => openExternalUrl('https://denuncie.org.br')}
              style={{
                flex: 1,
                backgroundColor: '#ffffff',
                borderRadius: 20,
                padding: 15,
                borderWidth: 1,
                borderColor: 'rgba(15,23,42,0.07)',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 11,
                    backgroundColor: '#f1f5f9',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Feather name="globe" size={17} color="#0f172a" />
                </View>
                <Feather name="arrow-up-right" size={15} color="#94a3b8" />
              </View>
              <Text style={{ fontWeight: '700', fontSize: 13.5, color: '#0f172a' }}>
                SaferNet Brasil
              </Text>
              <Text style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                Denúncia anônima web
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.navigate('/(tabs)/fale_com_a_yelo')}
              style={{
                flex: 1,
                backgroundColor: '#ffffff',
                borderRadius: 20,
                padding: 15,
                borderWidth: 1,
                borderColor: 'rgba(15,23,42,0.07)',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 11,
                    backgroundColor: '#f0fdf4',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Feather name="message-square" size={17} color="#1B4332" />
                </View>
                <Feather name="chevron-right" size={16} color="#94a3b8" />
              </View>
              <Text style={{ fontWeight: '700', fontSize: 13.5, color: '#0f172a' }}>
                Avisar a Yelo
              </Text>
              <Text style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                Reportar horário/padrão
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 3. SEGMENTED CONTROL (AIRBNB / iOS STYLE) */}
        <View
          className="mx-5 mb-5"
          style={{
            backgroundColor: '#eef2f6',
            padding: 4,
            borderRadius: 999,
            flexDirection: 'row',
          }}
        >
          {[
            { id: 'agir', label: 'Como agir' },
            { id: 'prevencao', label: 'Prevenção' },
            { id: 'sigilo', label: 'Sigilo e Lei' },
            { id: 'clausulas', label: 'Scripts' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                activeOpacity={0.8}
                onPress={() => setActiveTab(tab.id as any)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isActive ? '#ffffff' : 'transparent',
                  shadowColor: '#0f172a',
                  shadowOpacity: isActive ? 0.08 : 0,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 2 },
                }}
              >
                <Text
                  style={{
                    fontSize: 12.5,
                    fontWeight: isActive ? '700' : '600',
                    color: isActive ? '#0f172a' : '#64748b',
                  }}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ======================================================== */}
        {/* PAINEL 1: COMO AGIR */}
        {/* ======================================================== */}
        {activeTab === 'agir' && (
          <View className="mx-5">
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 24,
                padding: 20,
                borderWidth: 1,
                borderColor: 'rgba(15,23,42,0.07)',
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: 0.7,
                  color: '#1B4332',
                  marginBottom: 4,
                }}
              >
                Protocolo imediato
              </Text>
              <Text className="font-title text-[20px] text-[#0f172a] mb-1">
                O que fazer se acontecer com você
              </Text>
              <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                Siga esta ordem para preservar provas válidas e interromper o contato.
              </Text>

              {[
                {
                  num: '1',
                  title: 'Não apague a conversa e tire prints com o número visível',
                  desc: 'Capture prints mostrando o número com DDD no topo (sem nome salvo na agenda), data e horário. Se puder, use "Exportar conversa" no WhatsApp.',
                },
                {
                  num: '2',
                  title: 'Denuncie e bloqueie dentro do WhatsApp',
                  desc: 'Não tente argumentar. Toque em "Denunciar e Bloquear" nos dados do contato — o WhatsApp analisa as últimas 5 mensagens para banir o número.',
                },
                {
                  num: '3',
                  title: 'Registre um Boletim de Ocorrência online',
                  desc: 'Importunação sexual e perseguição por mensagem ou vídeo são crimes. O B.O. pode ser feito pela internet na Delegacia Virtual (gov.br) com respaldo do CFP.',
                },
                {
                  num: '4',
                  title: 'Acione canais de proteção digital e apoio à mulher',
                  desc: 'Reforce a denúncia na SaferNet (denuncie.org.br), consulte o Canal de Ajuda (canaldeajuda.org.br) ou ligue 180 (gratuito 24h).',
                },
              ].map((step, idx, arr) => (
                <View
                  key={step.num}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    paddingVertical: 14,
                    borderBottomWidth: idx === arr.length - 1 ? 0 : 1,
                    borderBottomColor: '#f1f5f9',
                  }}
                >
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: '#f0fdf4',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                      marginTop: 2,
                    }}
                  >
                    <Text style={{ color: '#1B4332', fontWeight: '800', fontSize: 12.5 }}>
                      {step.num}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontWeight: '700',
                        fontSize: 14,
                        color: '#0f172a',
                        marginBottom: 3,
                      }}
                    >
                      {step.title}
                    </Text>
                    <Text style={{ fontSize: 13, color: '#475569', lineHeight: 19.5 }}>
                      {step.desc}
                    </Text>
                  </View>
                </View>
              ))}

              {/* Box discreto para avisar a Yelo */}
              <View
                style={{
                  marginTop: 14,
                  backgroundColor: '#f8fafc',
                  borderRadius: 18,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                }}
              >
                <Text style={{ fontWeight: '700', fontSize: 13.8, color: '#0f172a', marginBottom: 4 }}>
                  Conte para a equipe Yelo o que aconteceu
                </Text>
                <Text style={{ fontSize: 12.5, color: '#64748b', lineHeight: 18.5, marginBottom: 12 }}>
                  Não precisa enviar a conversa inteira. Informar a data e o horário aproximado do clique pelo suporte ou para contato@yelopsi.com.br nos ajuda a mapear padrões.
                </Text>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => router.navigate('/(tabs)/fale_com_a_yelo')}
                  style={{
                    backgroundColor: '#1B4332',
                    borderRadius: 999,
                    paddingVertical: 11,
                    paddingHorizontal: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 13, marginRight: 6 }}>
                    Falar com o suporte Yelo
                  </Text>
                  <Feather name="chevron-right" size={15} color="#ffffff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* PAINEL 2: PREVENÇÃO (ACCORDIONS ESTILO NUBANK) */}
        {/* ======================================================== */}
        {activeTab === 'prevencao' && (
          <View className="mx-5">
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 24,
                padding: 20,
                borderWidth: 1,
                borderColor: 'rgba(15,23,42,0.07)',
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: 0.7,
                  color: '#1B4332',
                  marginBottom: 4,
                }}
              >
                Blindagem pré-sessão
              </Text>
              <Text className="font-title text-[20px] text-[#0f172a] mb-1">
                Filtros de triagem e sinais de alerta
              </Text>
              <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
                Toque em cada tópico para expandir as recomendações práticas.
              </Text>

              {[
                {
                  id: 'regra-ouro',
                  icon: 'check-circle',
                  tint: '#f0fdf4',
                  color: '#1B4332',
                  title: 'Regra de Ouro: CPF no Receita Saúde + PIX',
                  subtitle: 'Elimina 95% das tentativas de assédio antes da sessão',
                  bullets: [
                    'Validação prévia do CPF: Peça Nome Completo, Data de Nascimento e CPF no agendamento para emissão obrigatória de recibo no Receita Saúde. Ao digitar o CPF no sistema da Receita antes da sessão, você confirma se o documento existe e se nome e idade batem.',
                    'Pagamento antecipado via PIX: O comprovante bancário exibe o nome real, banco e dígitos do CPF do titular da conta, quebrando o anonimato de chips pré-pagos.',
                  ],
                },
                {
                  id: 'redflags-wpp',
                  icon: 'alert-triangle',
                  tint: '#fef2f2',
                  color: '#dc2626',
                  title: 'Sinais de alerta no 1º contato (WhatsApp)',
                  subtitle: 'Comportamentos típicos de perfis mal-intencionados',
                  bullets: [
                    'Urgência para vídeo imediato: Insistência para fazer chamada de vídeo "agora mesmo" sem agendar ou fornecer dados.',
                    'Recusa em informar CPF ou nome completo: Evasivas ou irritação quando você solicita dados básicos para prontuário e recibo.',
                    'Perguntas invasivas ou elogios físicos: Comentários sobre sua foto, estado civil, se mora sozinha ou endereço.',
                    'Linguagem sexual gráfica no texto inicial: Descrições explícitas já no WhatsApp sob pretexto de adiantar a demanda.',
                  ],
                },
                {
                  id: 'redflags-video',
                  icon: 'video',
                  tint: '#f1f5f9',
                  color: '#0f172a',
                  title: 'Cuidados na 1ª sessão por vídeo e presencial',
                  subtitle: 'Regras de câmera, ambiente e posicionamento',
                  bullets: [
                    'Câmera fechada ou apontada para o teto: Na 1ª sessão online, exija que o paciente abra a câmera e mostre o rosto em local iluminado antes de prosseguir.',
                    'Postura ou vestimenta inadequadas: Paciente deitado na cama no escuro ou sem camisa. Ao menor sinal de ato obsceno, feche a chamada em 1 segundo.',
                    'No consultório presencial: Evite agendar o 1º atendimento de desconhecidos quando o prédio estiver vazio e posicione sua poltrona mais próxima da porta.',
                  ],
                },
              ].map((acc, idx, arr) => {
                const isOpen = openAccordion === acc.id;
                return (
                  <View
                    key={acc.id}
                    style={{
                      borderBottomWidth: idx === arr.length - 1 ? 0 : 1,
                      borderBottomColor: '#f1f5f9',
                      paddingVertical: 14,
                    }}
                  >
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={() => toggleAccordion(acc.id)}
                      style={{ flexDirection: 'row', alignItems: 'center' }}
                    >
                      <View
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 12,
                          backgroundColor: acc.tint,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 12,
                        }}
                      >
                        <Feather name={acc.icon as any} size={17} color={acc.color} />
                      </View>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ fontWeight: '700', fontSize: 14, color: '#0f172a' }}>
                          {acc.title}
                        </Text>
                        <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                          {acc.subtitle}
                        </Text>
                      </View>
                      <Feather
                        name={isOpen ? 'chevron-up' : 'chevron-down'}
                        size={17}
                        color="#64748b"
                      />
                    </TouchableOpacity>

                    {isOpen && (
                      <View style={{ marginTop: 12, paddingLeft: 6 }}>
                        {acc.bullets.map((b, bIdx) => (
                          <View
                            key={bIdx}
                            style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}
                          >
                            <View
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: 3,
                                backgroundColor: acc.color,
                                marginTop: 7,
                                marginRight: 10,
                              }}
                            />
                            <Text style={{ flex: 1, fontSize: 13, color: '#475569', lineHeight: 19.5 }}>
                              {b}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* PAINEL 3: SIGILO E LEI */}
        {/* ======================================================== */}
        {activeTab === 'sigilo' && (
          <View className="mx-5">
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 24,
                padding: 20,
                borderWidth: 1,
                borderColor: 'rgba(15,23,42,0.07)',
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: 0.7,
                  color: '#1B4332',
                  marginBottom: 4,
                }}
              >
                Respaldo ético e jurídico
              </Text>
              <Text className="font-title text-[20px] text-[#0f172a] mb-1">
                Posso fazer B.O. sem violar o sigilo do CFP?
              </Text>
              <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 14, lineHeight: 19 }}>
                Sim. O sigilo protege pacientes em tratamento legítimo, jamais quem utiliza seu contato profissional para cometer um crime.
              </Text>

              {[
                {
                  title: 'Inexistência de vínculo terapêutico',
                  badge: 'CFP / CRPs',
                  badgeBg: '#f0fdf4',
                  badgeColor: '#1B4332',
                  desc: 'Quem aborda a profissional para praticar importunação sexual não está buscando serviço psicológico, mas praticando um ato ilícito.',
                },
                {
                  title: 'Art. 10º do Código de Ética (Res. CFP 010/2005)',
                  badge: 'Quebra legítima',
                  badgeBg: '#f0fdf4',
                  badgeColor: '#1B4332',
                  desc: 'Autoriza a quebra de sigilo em situações de menor prejuízo e legítima defesa de direitos fundamentais, informando à polícia os dados estritamente necessários (número, data, hora e prints).',
                },
                {
                  title: 'Art. 215-A do Código Penal • Importunação Sexual',
                  badge: 'Reclusão 1 a 5 anos',
                  badgeBg: '#fef2f2',
                  badgeColor: '#dc2626',
                  desc: 'Praticar sem anuência ato libidinoso para satisfazer a própria lascívia (exibição íntima/masturbação em chamada de vídeo ou envio de mídia sexual não solicitada).',
                },
                {
                  title: 'Art. 147-A do Código Penal • Perseguição (Stalking)',
                  badge: '6 meses a 2 anos',
                  badgeBg: '#fef2f2',
                  badgeColor: '#dc2626',
                  desc: 'Perseguir reiteradamente por qualquer meio (WhatsApp ou redes sociais), invadindo ou perturbando a esfera de liberdade e privacidade da profissional.',
                },
              ].map((item, idx, arr) => (
                <View
                  key={idx}
                  style={{
                    paddingVertical: 14,
                    borderBottomWidth: idx === arr.length - 1 ? 0 : 1,
                    borderBottomColor: '#f1f5f9',
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 4,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Text style={{ fontWeight: '700', fontSize: 13.8, color: '#0f172a', flex: 1, marginRight: 8 }}>
                      {item.title}
                    </Text>
                    <View
                      style={{
                        backgroundColor: item.badgeBg,
                        paddingHorizontal: 9,
                        paddingVertical: 3,
                        borderRadius: 999,
                      }}
                    >
                      <Text style={{ color: item.badgeColor, fontSize: 10.5, fontWeight: '700' }}>
                        {item.badge}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 13, color: '#475569', lineHeight: 19.5 }}>
                    {item.desc}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* PAINEL 4: SCRIPTS PRONTOS */}
        {/* ======================================================== */}
        {activeTab === 'clausulas' && (
          <View className="mx-5">
            {[
              {
                title: '1. Cláusula para Contrato Terapêutico',
                sub: 'Encerramento imediato sem reembolso em caso de assédio',
                text: CLAUSULA_CONTRATO,
              },
              {
                title: '2. Script de Triagem (CPF + Reserva)',
                sub: 'Solicita CPF para o Receita Saúde e PIX antecipado',
                text: SCRIPT_TRIAGEM,
              },
              {
                title: '3. Enquadramento de Câmera na 1ª Sessão',
                sub: 'Exige câmera aberta e ambiente iluminado na videochamada',
                text: SCRIPT_CAMERA,
              },
              {
                title: '4. Encerramento Formal (Antes do Bloqueio)',
                sub: 'Demarca a falta de consentimento para prova no B.O.',
                text: SCRIPT_ENCERRAMENTO,
              },
            ].map((tpl, idx) => (
              <View
                key={idx}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: 22,
                  padding: 18,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: 'rgba(15,23,42,0.07)',
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                  }}
                >
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={{ fontWeight: '700', fontSize: 14.5, color: '#0f172a' }}>
                      {tpl.title}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      {tpl.sub}
                    </Text>
                  </View>
                  <CopyPillButton text={tpl.text} />
                </View>

                <View
                  style={{
                    backgroundColor: '#f8fafc',
                    borderRadius: 14,
                    padding: 14,
                  }}
                >
                  <Text style={{ fontSize: 12.8, color: '#334155', lineHeight: 19.5 }}>
                    {tpl.text}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* RODAPÉ EDITORIAL MINIMALISTA DE CRÉDITOS */}
        <View
          className="mx-5 mt-5"
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 20,
            padding: 18,
            borderWidth: 1,
            borderColor: 'rgba(15,23,42,0.06)',
          }}
        >
          <Text style={{ fontSize: 12, color: '#64748b', lineHeight: 18, marginBottom: 12 }}>
            <Text style={{ fontWeight: '700', color: '#0f172a' }}>Fontes: </Text>
            Diretrizes baseadas nas normativas do CFP (Código de Ética e Res. 08/2020), CRP-PR, CRP-RS, Código Penal e na cartilha educativa "PSIS (+) SEGURAS", elaborada pelo projeto PSI (+) REAL (@psimaisreal) das psicólogas Amanda Cei (CRP 16/3526) e Nicolly Amorim (CRP 15/6193).
          </Text>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => openExternalUrl('https://www.instagram.com/psimaisreal/')}
            style={{
              alignSelf: 'flex-start',
              backgroundColor: '#f0fdf4',
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
            }}
          >
            <Text style={{ color: '#1B4332', fontWeight: '700', fontSize: 12 }}>
              Conhecer @psimaisreal ↗
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
