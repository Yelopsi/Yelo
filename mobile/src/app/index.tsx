import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, ActivityIndicator, ScrollView, TouchableOpacity, Dimensions, Image } from 'react-native';
import YeloScrollView from '../components/YeloScrollView';
import { useAuth } from '../contexts/AuthContext';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Svg, { Path } from 'react-native-svg';
import Footer from '../components/Footer';

const { width } = Dimensions.get('window');

// FAQ Data baseado no index.ejs
const faqs = [
  { q: "Quem são os terapeutas da Yelo?", a: "Apenas aceitamos Psicólogos com registro ativo no CRP. Todos passam por um processo de verificação de credenciais para garantir que você seja atendido por profissionais qualificados e éticos." },
  { q: "Como o 'match' encontra o ideal para mim?", a: "Diferente de uma lista comum, nosso algoritmo analisa suas respostas sobre o que você está sentindo e suas preferências para conectar você aos 3 profissionais mais compatíveis." },
  { q: "Qual o valor das sessões?", a: "Na Yelo, você tem liberdade de escolha. Nossos profissionais definem seus próprios honorários, criando uma variedade de faixas de preço." },
  { q: "E se eu não me adaptar ao profissional?", a: "Entendemos que a conexão com o terapeuta é fundamental. Se você não sentir que deu 'liga', você pode trocar de profissional a qualquer momento pela plataforma." }
];

export default function Index() {
  const { YeloToken, loading } = useAuth();
  const router = useRouter();
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // Lista de frases dinâmicas para o Título (baseado na web)
  const frases = [
    "ficar bem.",
    "ser feliz.",
    "ter paz.",
    "viver leve.",
    "ser ouvido(a).",
    "se reencontrar.",
    "acolhimento.",
    "cuidar de si.",
    "ser sua prioridade.",
    "investir em você.",
    "uma vida plena."
  ];
  const [fraseHero, setFraseHero] = useState(() => frases[Math.floor(Math.random() * frases.length)]);

  const handleRefresh = async () => {
    // Simula a requisição e sorteia uma nova frase garantindo que não seja a mesma
    await new Promise(resolve => setTimeout(resolve, 800));
    let novaFrase = frases[Math.floor(Math.random() * frases.length)];
    while(novaFrase === fraseHero && frases.length > 1) {
        novaFrase = frases[Math.floor(Math.random() * frases.length)];
    }
    setFraseHero(novaFrase);
  };

  useEffect(() => {
    // Se o app já checou e há Token (logado), vamos direto pro Dashboard
    if (!loading && YeloToken) {
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 100);
    }
  }, [YeloToken, loading]);

  if (loading || YeloToken) {
    return (
      <View className="flex-1 bg-[#f9fafb] items-center justify-center">
        <ActivityIndicator size="large" color="#1B4332" />
      </View>
    );
  }

  // Se não logado, exibe a Landing Page 1:1 com a Web
  return (
    <View className="flex-1 bg-[#1B4332]">
      <StatusBar style="light" />
      <SafeAreaView edges={['top']} className="flex-1">
        <YeloScrollView className="flex-1" style={{ backgroundColor: '#1B4332' }} showsVerticalScrollIndicator={false} refreshColor="#ffffff" onRefreshAction={handleRefresh}>
          <View className="bg-white">
            {/* HEADER */}
            <View className="bg-[#1B4332] pt-2">
          <View className="px-5 py-4 flex-row justify-between items-center">
            {/* Logo Yelo Branca */}
            <Image
              source={require('../../assets/images/logo-branca.png')}
              style={{ width: 80, height: 32 }}
              resizeMode="contain"
            />

            {/* Links da Direita */}
            <View className="flex-row items-center">
              <TouchableOpacity onPress={() => { }} className="mr-3">
                <Text className="font-sans font-medium text-white text-[13px]">Sobre</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/faq')} className="mr-3">
                <Text className="font-sans font-medium text-white text-[13px]">FAQ</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { }}>
                <Text className="font-sans font-medium text-white text-[13px]">Blog</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* HERO SECTION */}
        <View className="bg-[#1B4332] pt-8 items-center relative overflow-hidden">
          <View className="px-6 items-center w-full">
            {/* Círculo decorativo de fundo pra imitar a "onda" visual */}
            <View className="absolute -top-10 -right-20 w-64 h-64 bg-white/5 rounded-full blur-xl" />

            <Text className="font-title text-[42px] text-white text-center leading-tight mb-4 font-extrabold">
              Você merece {fraseHero}
            </Text>
            <Text className="font-sans font-bold text-[16px] text-white/90 text-center mb-5 px-4">
              Encontrar a pessoa certa para te acompanhar nessa jornada é o primeiro passo.
            </Text>

            {/* Social Proof (M C F + Avaliações) - SEM PÍLULA */}
            <View className="flex-row items-center justify-center gap-3 mb-8 mt-2 relative z-10">
              <View className="flex-row -mr-1">
                <View className="w-8 h-8 rounded-full bg-[#FFF8E1] border-2 border-[#1B4332] items-center justify-center -mr-3 z-30"><Text className="font-sans font-bold text-[#1B4332] text-[13px]">M</Text></View>
                <View className="w-8 h-8 rounded-full bg-[#E6F4F1] border-2 border-[#1B4332] items-center justify-center -mr-3 z-20"><Text className="font-sans font-bold text-[#1B4332] text-[13px]">C</Text></View>
                <View className="w-8 h-8 rounded-full bg-[#F8F3ED] border-2 border-[#1B4332] items-center justify-center z-10"><Text className="font-sans font-bold text-[#1B4332] text-[13px]">F</Text></View>
              </View>
              <View className="items-start">
                <Text className="text-[#FFC107] text-[14px] tracking-[1px] leading-none">★★★★★</Text>
                <Text className="font-sans font-bold text-[rgba(255,255,255,0.9)] text-[13px] mt-1">4.9/5 (1767 avaliações)</Text>
              </View>
            </View>

            <TouchableOpacity 
              onPress={() => router.push('/cadastro')}
              className="bg-[#FFEE8C] px-[35px] py-[15px] rounded-[50px] shadow-[0_4px_20px_rgba(0,0,0,0.15)] items-center mb-3"
            >
              <Text className="font-black text-[#1B4332] text-[18px]">Encontrar meu psicólogo</Text>
            </TouchableOpacity>

            <Text className="font-sans font-bold text-[14px] text-[#E6F4F1] text-center opacity-90 px-4 relative z-10">
              ✨ O match é por nossa conta e sem compromisso. O pagamento das sessões é combinado direto com o/a psicólogo/a.
            </Text>
          </View>

          {/* Wave Divider */}
          <View className="w-full mt-10 -mb-1">
            <Svg viewBox="0 0 1440 320" width="100%" height={width * (320 / 1440)} preserveAspectRatio="none">
              <Path fill="#ffffff" fillOpacity="1" d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,112C672,96,768,96,864,112C960,128,1056,160,1152,165.3C1248,171,1344,149,1392,138.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
            </Svg>
          </View>
        </View>

        {/* VANTAGENS (ORGÂNICA) */}
        <View className="py-12">
          <View className="px-6 mb-8 items-center">
            <Text className="font-title text-[32px] text-[#1B4332] text-center mb-3">Por que escolher a yelo?</Text>
            <Text className="font-sans text-[15px] text-[#555] text-center leading-relaxed">Cuidar da mente não precisa ser complicado. Criamos uma experiência fluida para você focar no que importa.</Text>
          </View>

          <YeloScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, gap: 16 }} snapToInterval={width * 0.75 + 16} decelerationRate="fast">
            <View style={{ width: width * 0.75 }} className="bg-[#F8F3ED] border border-[rgba(0,0,0,0.03)] p-8 rounded-[24px] rounded-tr-[60px] rounded-bl-[60px] shadow-[0_4px_15px_rgba(0,0,0,0.02)]">
              <View className="w-14 h-14 bg-white rounded-full items-center justify-center mb-5 shadow-[0_4px_10px_rgba(0,0,0,0.05)]">
                <Feather name="users" size={24} color="#1B4332" />
              </View>
              <Text className="font-title text-[20px] text-[#1B4332] mb-3">Match Inteligente</Text>
              <Text className="font-sans text-[14px] text-[#555] leading-relaxed">Não perca tempo procurando. Nossa tecnologia conecta você aos especialistas ideais para sua necessidade específica.</Text>
            </View>

            <View style={{ width: width * 0.75 }} className="bg-[#E6F4F1] border border-[rgba(0,0,0,0.03)] p-8 rounded-[60px] rounded-tr-[24px] rounded-bl-[24px] shadow-[0_4px_15px_rgba(0,0,0,0.02)]">
              <View className="w-14 h-14 bg-white rounded-full items-center justify-center mb-5 shadow-[0_4px_10px_rgba(0,0,0,0.05)]">
                <Feather name="lock" size={24} color="#1B4332" />
              </View>
              <Text className="font-title text-[20px] text-[#1B4332] mb-3">100% Sigiloso e Seguro</Text>
              <Text className="font-sans text-[14px] text-[#555] leading-relaxed">Sua privacidade é nossa prioridade. Plataforma criptografada e profissionais éticos verificados pelo CRP.</Text>
            </View>

            <View style={{ width: width * 0.75 }} className="bg-[#FFF8E1] border border-[rgba(0,0,0,0.03)] p-8 rounded-[24px] rounded-tr-[60px] rounded-bl-[60px] shadow-[0_4px_15px_rgba(0,0,0,0.02)]">
              <View className="w-14 h-14 bg-white rounded-full items-center justify-center mb-5 shadow-[0_4px_10px_rgba(0,0,0,0.05)]">
                <Feather name="refresh-cw" size={24} color="#1B4332" />
              </View>
              <Text className="font-title text-[20px] text-[#1B4332] mb-3">Troca Facilitada</Text>
              <Text className="font-sans text-[14px] text-[#555] leading-relaxed">Não se adaptou? Acontece. Troque de profissional a qualquer momento sem burocracia ou custo extra.</Text>
            </View>
          </YeloScrollView>
        </View>

        {/* QUALIDADE */}
        <View className="bg-[#f9fafb] px-6 py-12 rounded-[40px] mx-4 mb-12 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-[#f0f0f0]">
          <View className="bg-[#E6F4F1] self-start px-4 py-1.5 rounded-[50px] mb-5">
            <Text className="font-sans font-bold text-[#1B4332] text-[11px] uppercase tracking-wider">Segurança e Qualidade</Text>
          </View>
          <Text className="font-title text-[30px] text-[#1B4332] mb-4 leading-tight">Profissionais verificados em quem você pode confiar.</Text>
          <Text className="font-sans text-[15px] text-[#555] leading-relaxed mb-8">Nossa curadoria é rigorosa. Apenas psicólogos com CRP ativo e aprovados em nossa entrevista técnica entram na plataforma.</Text>

          <View className="gap-3">
            <View className="bg-white flex-row items-center p-3 rounded-[50px] shadow-[0_4px_15px_rgba(0,0,0,0.03)] border border-[#f5f5f5]">
              <View className="w-10 h-10 bg-[#E6F4F1] rounded-full items-center justify-center mr-3">
                <Feather name="check" size={18} color="#1B4332" />
              </View>
              <Text className="font-sans font-bold text-[#1B4332] text-[14px]">CRP Ativo e Regularizado</Text>
            </View>
            <View className="bg-white flex-row items-center p-3 rounded-[50px] shadow-[0_4px_15px_rgba(0,0,0,0.03)] border border-[#f5f5f5]">
              <View className="w-10 h-10 bg-[#E6F4F1] rounded-full items-center justify-center mr-3">
                <Feather name="shield" size={18} color="#1B4332" />
              </View>
              <Text className="font-sans font-bold text-[#1B4332] text-[14px]">Entrevista de Verificação</Text>
            </View>
          </View>
        </View>

        {/* COMO FUNCIONA */}
        <View className="px-6 pb-14">
          <Text className="font-title text-[32px] text-[#1B4332] mb-3">Como a Yelo funciona</Text>
          <Text className="font-sans text-[15px] text-[#555] mb-10 leading-relaxed">Uma jornada simples, transparente e focada no seu bem-estar.</Text>

          <View className="gap-8">
            <View className="flex-row items-start">
              <View className="w-12 h-12 rounded-full bg-[#1B4332] items-center justify-center mr-4 mt-1">
                <Text className="font-title text-white text-[20px]">1</Text>
              </View>
              <View className="flex-1">
                <Text className="font-sans font-bold text-[#16a34a] text-[11px] uppercase tracking-widest mb-1">Passo 01</Text>
                <Text className="font-title text-[20px] text-[#1B4332] mb-2 leading-tight">Encontre o profissional ideal para você</Text>
                <Text className="font-sans text-[14px] text-[#555] leading-relaxed">Esqueça as listas infinitas. Responda ao nosso questionário inteligente. Nossa tecnologia fará a curadoria dos psicólogos mais compatíveis.</Text>
              </View>
            </View>

            <View className="flex-row items-start">
              <View className="w-12 h-12 rounded-full bg-[#1B4332] items-center justify-center mr-4 mt-1">
                <Text className="font-title text-white text-[20px]">2</Text>
              </View>
              <View className="flex-1">
                <Text className="font-sans font-bold text-[#16a34a] text-[11px] uppercase tracking-widest mb-1">Passo 02</Text>
                <Text className="font-title text-[20px] text-[#1B4332] mb-2 leading-tight">Conheça e conecte-se com segurança</Text>
                <Text className="font-sans text-[14px] text-[#555] leading-relaxed">Veja o perfil detalhado, avaliações reais e vídeo de apresentação. Inicie uma conversa ou agende sua sessão diretamente.</Text>
              </View>
            </View>

            <View className="flex-row items-start">
              <View className="w-12 h-12 rounded-full bg-[#1B4332] items-center justify-center mr-4 mt-1">
                <Text className="font-title text-white text-[20px]">3</Text>
              </View>
              <View className="flex-1">
                <Text className="font-sans font-bold text-[#16a34a] text-[11px] uppercase tracking-widest mb-1">Passo 03</Text>
                <Text className="font-title text-[20px] text-[#1B4332] mb-2 leading-tight">Comece sua jornada de transformação</Text>
                <Text className="font-sans text-[14px] text-[#555] leading-relaxed">Realize suas sessões online no conforto da sua casa. E se não se adaptar, a Troca Facilitada resolve seu problema.</Text>
              </View>
            </View>
          </View>
        </View>

        {/* DEPOIMENTOS */}
        <View className="bg-[#fdfaf6] py-14">
          <View className="px-6 mb-8 text-center items-center">
            <Text className="font-title text-[32px] text-[#1B4332] text-center mb-5">Histórias de quem já começou</Text>
            <View className="bg-white border border-[#f0f0f0] px-6 py-2.5 rounded-[50px] flex-row items-center shadow-[0_4px_15px_rgba(0,0,0,0.03)]">
              <Text className="font-title text-[18px] text-[#1B4332] mr-2">4.9/5</Text>
              <Text className="text-[#FFC107] text-[14px] tracking-widest mr-2">★★★★★</Text>
              <Text className="font-sans text-[12px] text-[#666]">Baseado em avaliações</Text>
            </View>
          </View>

          <YeloScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, gap: 16 }} snapToInterval={width * 0.8 + 16} decelerationRate="fast">
            <View style={{ width: width * 0.8 }} className="bg-[#F8F3ED] border border-[rgba(0,0,0,0.02)] p-6 rounded-[24px] rounded-tr-[60px] rounded-bl-[60px] shadow-[0_4px_15px_rgba(0,0,0,0.03)]">
              <Text className="font-sans italic text-[15px] text-[#444] leading-relaxed mb-6 flex-1">"Achei a plataforma super intuitiva. O match foi perfeito e minha psicóloga me ajudou a me entender desde a primeira sessão."</Text>
              <View className="flex-row items-center border-t border-[rgba(0,0,0,0.05)] pt-4">
                <View className="w-10 h-10 bg-white rounded-full items-center justify-center mr-3 shadow-sm"><Text className="font-bold text-[#1B4332]">M</Text></View>
                <View>
                  <Text className="font-sans font-bold text-[#1B4332] text-[14px]">Mariana S.</Text>
                  <Text className="font-sans text-[11px] text-[#666]">Paciente Verificada</Text>
                </View>
              </View>
            </View>

            <View style={{ width: width * 0.8 }} className="bg-[#E6F4F1] border border-[rgba(0,0,0,0.02)] p-6 rounded-[60px] rounded-tr-[24px] rounded-bl-[24px] shadow-[0_4px_15px_rgba(0,0,0,0.03)]">
              <Text className="font-sans italic text-[15px] text-[#444] leading-relaxed mb-6 flex-1">"Eu tinha receio de terapia online, mas a segurança da Yelo e a qualidade do profissional me surpreenderam positivamente."</Text>
              <View className="flex-row items-center border-t border-[rgba(0,0,0,0.05)] pt-4">
                <View className="w-10 h-10 bg-white rounded-full items-center justify-center mr-3 shadow-sm"><Text className="font-bold text-[#1B4332]">C</Text></View>
                <View>
                  <Text className="font-sans font-bold text-[#1B4332] text-[14px]">Carlos R.</Text>
                  <Text className="font-sans text-[11px] text-[#666]">Paciente Verificado</Text>
                </View>
              </View>
            </View>

            <View style={{ width: width * 0.8 }} className="bg-[#FFF8E1] border border-[rgba(0,0,0,0.02)] p-6 rounded-[24px] rounded-tr-[60px] rounded-bl-[60px] shadow-[0_4px_15px_rgba(0,0,0,0.03)]">
              <Text className="font-sans italic text-[15px] text-[#444] leading-relaxed mb-6 flex-1">"A liberdade para escolher o horário e trocar se precisar me deu muita paz. A experiência como paciente é impecável."</Text>
              <View className="flex-row items-center border-t border-[rgba(0,0,0,0.05)] pt-4">
                <View className="w-10 h-10 bg-white rounded-full items-center justify-center mr-3 shadow-sm"><Text className="font-bold text-[#1B4332]">F</Text></View>
                <View>
                  <Text className="font-sans font-bold text-[#1B4332] text-[14px]">Fernanda M.</Text>
                  <Text className="font-sans text-[11px] text-[#666]">Paciente Verificada</Text>
                </View>
              </View>
            </View>
          </YeloScrollView>
        </View>

        {/* FAQ */}
        <View className="px-6 py-14 bg-white">
          <Text className="font-title text-[32px] text-[#1B4332] mb-8 text-center">Perguntas Frequentes</Text>

          <View className="gap-4">
            {faqs.map((faq, index) => (
              <View key={index} className={`bg-white border border-[#f0f0f0] shadow-[0_4px_15px_rgba(0,0,0,0.03)] overflow-hidden ${index % 2 === 0 ? 'rounded-[24px] rounded-tr-[40px] rounded-bl-[40px]' : 'rounded-[40px] rounded-tr-[24px] rounded-bl-[24px]'}`}>
                <TouchableOpacity
                  onPress={() => setActiveFaq(activeFaq === index ? null : index)}
                  className="px-6 py-5 flex-row justify-between items-center"
                >
                  <Text className="font-title text-[18px] text-[#1B4332] flex-1 mr-4">{faq.q}</Text>
                  <Feather name={activeFaq === index ? "minus" : "plus"} size={20} color="#1B4332" />
                </TouchableOpacity>
                {activeFaq === index && (
                  <View className="px-6 pb-6 pt-1">
                    <Text className="font-sans text-[14px] text-[#555] leading-relaxed">{faq.a}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* BOTTOM CTA */}
        <View className="px-6 pb-20 items-center bg-white">
          <TouchableOpacity
            onPress={() => router.push('/cadastro')}
            className="w-full bg-[#1B4332] py-4 rounded-[50px] shadow-[0_6px_20px_rgba(27,67,50,0.25)] items-center mb-6"
          >
            <Text className="font-black text-white text-[16px]">Encontrar meu psicólogo</Text>
          </TouchableOpacity>
        </View>

        </View>

        {/* RODAPÉ GLOBAL */}
        <Footer />
        
      </YeloScrollView>

      {/* FLOATING BOTTOM NAV */}
      <View className="absolute bottom-8 left-5 right-5 bg-white/95 rounded-[50px] shadow-[0_10px_30px_rgba(0,0,0,0.15)] flex-row justify-between items-center px-4 py-2" style={{ elevation: 5 }}>

        {/* Início (Ativo) */}
        <TouchableOpacity className="items-center justify-center flex-1 py-1.5 rounded-[20px] bg-[#f0fdf4]">
          <Svg viewBox="0 0 24 24" fill="rgba(27,67,50,0.1)" stroke="#1B4332" strokeWidth={1.5} width={24} height={24}>
            <Path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </Svg>
          <Text className="font-sans font-semibold text-[#1B4332] text-[10px] mt-0.5">Início</Text>
        </TouchableOpacity>

        {/* Pergunte */}
        <TouchableOpacity className="items-center justify-center flex-1 py-1.5 rounded-[20px]">
          <Svg viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth={1.5} width={24} height={24}>
            <Path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
          </Svg>
          <Text className="font-sans font-medium text-[#999] text-[10px] mt-0.5">Pergunte</Text>
        </TouchableOpacity>

        {/* Começar */}
        <TouchableOpacity onPress={() => router.push('/cadastro')} className="items-center justify-center flex-1 py-1.5 rounded-[20px]">
          <Svg viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth={1.5} width={24} height={24}>
            <Path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            <Path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
          </Svg>
          <Text className="font-sans font-medium text-[#999] text-[10px] mt-0.5">Começar</Text>
        </TouchableOpacity>

        {/* Nossos Psis */}
        <TouchableOpacity className="items-center justify-center flex-1 py-1.5 rounded-[20px]">
          <Svg viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth={1.5} width={24} height={24}>
            <Path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </Svg>
          <Text className="font-sans font-medium text-[#999] text-[10px] mt-0.5">Nossos Psis</Text>
        </TouchableOpacity>

        {/* Entrar */}
        <TouchableOpacity onPress={() => router.push('/login')} className="items-center justify-center flex-1 py-1.5 rounded-[20px]">
          <Svg viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth={1.5} width={24} height={24}>
            <Path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </Svg>
          <Text className="font-sans font-medium text-[#999] text-[10px] mt-0.5">Entrar</Text>
        </TouchableOpacity>

      </View>

      </SafeAreaView>
    </View>
  );
}
