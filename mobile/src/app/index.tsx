import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, ActivityIndicator, TouchableOpacity, Dimensions, Image } from 'react-native';
import YeloScrollView from '../components/YeloScrollView';
import { useAuth } from '../contexts/AuthContext';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import Footer from '../components/Footer';
import PublicBottomNav from '../components/PublicBottomNav';
import PublicHeader from '../components/PublicHeader';
import MouseScrollIndicator from '../components/MouseScrollIndicator';
import api from '../services/api';

const { width } = Dimensions.get('window');

// FAQ Data 1:1 baseado no views/index.ejs
const faqs = [
  { 
    q: "Quem são os terapeutas da Yelo?", 
    a: "Apenas aceitamos Psicólogos com registro ativo no CRP (Conselho Regional de Psicologia). Todos passam por um processo de verificação de credenciais para garantir que você seja atendido por profissionais qualificados e éticos." 
  },
  { 
    q: "Como o \"match\" encontra o ideal para mim?", 
    a: "Diferente de uma lista comum, nosso algoritmo analisa suas respostas sobre o que você está sentindo e suas preferências (como abordagem ou gênero do terapeuta) para conectar você aos 3 profissionais mais compatíveis com o seu momento." 
  },
  { 
    q: "Qual o valor das sessões?", 
    a: "Na Yelo, você tem liberdade de escolha. Nossos profissionais definem seus próprios honorários, criando uma variedade de faixas de preço para que você encontre alguém excelente que também caiba no seu orçamento." 
  },
  { 
    q: "E se eu não me adaptar ao profissional? (Troca Facilitada)", 
    a: "Entendemos que a conexão com o terapeuta é fundamental. Se você iniciar as sessões e sentir que não se adaptou, você pode usar a nossa plataforma para trocar de profissional a qualquer momento, de forma autônoma e sem constrangimento. Nosso objetivo é que você encontre o espaço perfeito para você." 
  }
];

// Paleta harmônica de avatares para os depoimentos (WCAG AAA)
const avatarStyles = [
  { bg: '#E8F5E9', text: '#1B4332', border: '#C8E6C9' },
  { bg: '#E0F2FE', text: '#0369A1', border: '#BAE6FD' },
  { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
  { bg: '#F3E8FF', text: '#6B21A8', border: '#E9D5FF' },
];

export default function Index() {
  const { user, YeloToken, loading } = useAuth();
  const router = useRouter();
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  // Dados dinâmicos da Home carregados do banco de dados online
  const [homeData, setHomeData] = useState<{
    mediaAvaliacao: string;
    totalAvaliacoes: string;
    depoimentos: Array<{ nome: string; texto: string; nota: number; inicial: string }>;
  }>({
    mediaAvaliacao: '4.9',
    totalAvaliacoes: '150+',
    depoimentos: [
      { nome: "M. S.", texto: "Eu adiava a terapia por achar difícil encontrar alguém. O questionário da Yelo foi certeiro.", nota: 5, inicial: "M" },
      { nome: "C. E.", texto: "A facilidade de fazer online mudou tudo pra mim. Plataforma estável e segura.", nota: 5, inicial: "C" },
      { nome: "F. L.", texto: "O acolhimento que recebi foi fundamental. Recomendo a Yelo para todos.", nota: 5, inicial: "F" },
      { nome: "J. P.", texto: "Encontrei um espaço seguro para falar sobre minhas angústias.", nota: 5, inicial: "J" }
    ]
  });

  // Lista de frases dinâmicas para o Título (1:1 com web)
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

  useEffect(() => {
    // Busca dados reais do banco online
    api.get('/api/public/home-data')
      .then(res => {
        if (res.data) {
          setHomeData({
            mediaAvaliacao: res.data.mediaAvaliacao || '4.9',
            totalAvaliacoes: res.data.totalAvaliacoes || '150+',
            depoimentos: (res.data.depoimentos && res.data.depoimentos.length > 0) ? res.data.depoimentos : homeData.depoimentos
          });
        }
      })
      .catch(err => console.log('Erro ao buscar dados home-data:', err));
  }, []);

  const handleRefresh = async () => {
    try {
      const res = await api.get('/api/public/home-data');
      if (res.data) {
        setHomeData({
          mediaAvaliacao: res.data.mediaAvaliacao || '4.9',
          totalAvaliacoes: res.data.totalAvaliacoes || '150+',
          depoimentos: (res.data.depoimentos && res.data.depoimentos.length > 0) ? res.data.depoimentos : homeData.depoimentos
        });
      }
    } catch (e) {}

    let novaFrase = frases[Math.floor(Math.random() * frases.length)];
    while (novaFrase === fraseHero && frases.length > 1) {
      novaFrase = frases[Math.floor(Math.random() * frases.length)];
    }
    setFraseHero(novaFrase);
  };

  useEffect(() => {
    // Se logado, redireciona para a área correspondente
    if (!loading && YeloToken && user) {
      setTimeout(() => {
        if (user.type === 'admin') {
          router.replace('/(admin)');
        } else if (user.type === 'patient') {
          router.replace('/(paciente)');
        } else {
          router.replace('/(tabs)');
        }
      }, 100);
    }
  }, [YeloToken, user, loading]);

  if (loading || YeloToken) {
    return (
      <View className="flex-1 bg-[#f9fafb] items-center justify-center">
        <ActivityIndicator size="large" color="#1B4332" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#1B4332]">
      <SafeAreaView edges={['top']} className={`flex-1 ${isScrolled ? 'bg-[#ffffff]' : 'bg-[#1B4332]'}`}>
        <PublicHeader isScrolled={isScrolled} />
        
        <YeloScrollView 
          className="flex-1" 
          style={{ backgroundColor: '#1B4332' }} 
          showsVerticalScrollIndicator={false} 
          refreshColor="#ffffff" 
          onRefreshAction={handleRefresh}
          onScroll={(e) => setIsScrolled(e.nativeEvent.contentOffset.y > 20)}
          scrollEventThrottle={16}
        >
          <View className="bg-white">

            {/* ============================================================ */}
            {/* 1. HERO SECTION                                              */}
            {/* ============================================================ */}
            <View className="bg-[#1B4332] pt-8 items-center relative overflow-hidden">
              <View className="px-6 items-center w-full">
                {/* Glow decorativo de fundo */}
                <View className="absolute -top-10 -right-20 w-64 h-64 bg-white/5 rounded-full blur-xl" />

                <Text className="font-title text-[40px] text-white text-center leading-tight mb-4 font-extrabold">
                  Você merece {fraseHero}
                </Text>

                <Text className="font-sans font-medium text-[16px] text-white/90 text-center mb-5 px-4 leading-relaxed">
                  Encontrar a pessoa certa para te acompanhar nessa jornada é o primeiro passo.
                </Text>

                {/* Social Proof (M C F + Avaliações Reais do Banco) */}
                <View className="flex-row items-center justify-center gap-3 mb-6 mt-1 relative z-10">
                  <View className="flex-row -mr-1">
                    <View className="w-8 h-8 rounded-full bg-[#FFF8E1] border-2 border-[#1B4332] items-center justify-center -mr-3 z-30">
                      <Text className="font-sans font-bold text-[#1B4332] text-[13px]">M</Text>
                    </View>
                    <View className="w-8 h-8 rounded-full bg-[#E6F4F1] border-2 border-[#1B4332] items-center justify-center -mr-3 z-20">
                      <Text className="font-sans font-bold text-[#1B4332] text-[13px]">C</Text>
                    </View>
                    <View className="w-8 h-8 rounded-full bg-[#F8F3ED] border-2 border-[#1B4332] items-center justify-center z-10">
                      <Text className="font-sans font-bold text-[#1B4332] text-[13px]">F</Text>
                    </View>
                  </View>

                  <View className="items-start">
                    <Text className="text-[#FFC107] text-[14px] tracking-[2px] leading-none">★★★★★</Text>
                    <Text className="font-sans text-[rgba(255,255,255,0.9)] text-[13px] mt-1">
                      <Text className="font-bold">{homeData.mediaAvaliacao}/5</Text> ({homeData.totalAvaliacoes} avaliações)
                    </Text>
                  </View>
                </View>

                {/* CTA Principal Amarelo */}
                <TouchableOpacity 
                  activeOpacity={0.85}
                  onPress={() => router.push('/questionario')}
                  className="bg-[#FFEE8C] px-[35px] py-[15px] rounded-[50px] shadow-[0_4px_20px_rgba(0,0,0,0.2)] items-center mb-4 active:scale-95"
                >
                  <Text className="font-title font-bold text-[#1B4332] text-[18px]">
                    Encontrar meu psicólogo
                  </Text>
                </TouchableOpacity>

                {/* Subtexto com "leva menos de 1 minuto" em destaque */}
                <Text className="font-sans text-[13.5px] text-[#E6F4F1] text-center opacity-90 px-4 leading-[1.4] max-w-[500px]">
                  ✨ O match é por nossa conta, sem compromisso e <Text className="font-bold text-white">leva menos de 1 minuto</Text>.{'\n'}O pagamento das sessões é combinado direto com o/a psicólogo/a.
                </Text>
              </View>

              {/* Wave Divider para a seção branca */}
              <View className="w-full mt-10 -mb-1">
                <Svg viewBox="0 0 1440 320" width="100%" height={width * (320 / 1440)} preserveAspectRatio="none">
                  <Path fill="#ffffff" fillOpacity="1" d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,112C672,96,768,96,864,112C960,128,1056,160,1152,165.3C1248,171,1344,149,1392,138.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
                </Svg>
              </View>
            </View>

            {/* ============================================================ */}
            {/* 2. SEÇÃO VANTAGENS ("Por que escolher a yelo?")             */}
            {/* ============================================================ */}
            <View className="py-12 bg-white">
              <View className="px-6 mb-8 items-center">
                <Text className="font-title text-[30px] text-[#1B4332] text-center mb-3">
                  Por que escolher a <Text className="font-bold">yelo</Text>?
                </Text>
                <Text className="font-sans text-[15px] text-[#555] text-center leading-relaxed max-w-[600px]">
                  Cuidar da mente não precisa ser complicado. Criamos uma experiência fluida para você focar no que importa.
                </Text>
              </View>

              <YeloScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={{ paddingHorizontal: 20, gap: 16 }} 
                snapToInterval={width * 0.8 + 16} 
                decelerationRate="fast"
              >
                {/* Card 1: Match Inteligente */}
                <View 
                  style={{ width: width * 0.8 }} 
                  className="bg-[#F8F3ED] border border-[rgba(0,0,0,0.03)] p-8 rounded-[24px] rounded-tr-[60px] rounded-bl-[60px] shadow-[0_4px_15px_rgba(0,0,0,0.03)]"
                >
                  <View className="w-20 h-20 bg-white rounded-full items-center justify-center shadow-[0_5px_15px_rgba(0,0,0,0.05)] mb-6 self-start">
                    <Image source={require('../../assets/images/match.png')} style={{ width: 40, height: 40 }} resizeMode="contain" />
                  </View>
                  <Text className="font-title text-[22px] text-[#1B4332] mb-3">Match Inteligente</Text>
                  <Text className="font-sans text-[15px] text-[#555] leading-relaxed">
                    Não perca tempo procurando. Nossa tecnologia conecta você aos especialistas ideais para sua necessidade específica.
                  </Text>
                </View>

                {/* Card 2: 100% Sigiloso e Seguro */}
                <View 
                  style={{ width: width * 0.8 }} 
                  className="bg-[#E6F4F1] border border-[rgba(0,0,0,0.03)] p-8 rounded-[60px] rounded-tr-[24px] rounded-bl-[24px] shadow-[0_4px_15px_rgba(0,0,0,0.03)]"
                >
                  <View className="w-20 h-20 bg-white rounded-full items-center justify-center shadow-[0_5px_15px_rgba(0,0,0,0.05)] mb-6 self-start">
                    <Image source={require('../../assets/images/sigilo.png')} style={{ width: 40, height: 40 }} resizeMode="contain" />
                  </View>
                  <Text className="font-title text-[22px] text-[#1B4332] mb-3">100% Sigiloso e Seguro</Text>
                  <Text className="font-sans text-[15px] text-[#555] leading-relaxed">
                    Sua privacidade é nossa prioridade. Plataforma criptografada e profissionais éticos verificados pelo CRP.
                  </Text>
                </View>

                {/* Card 3: Troca Facilitada */}
                <View 
                  style={{ width: width * 0.8 }} 
                  className="bg-[#FFF8E1] border border-[rgba(0,0,0,0.03)] p-8 rounded-[24px] rounded-tr-[60px] rounded-bl-[60px] shadow-[0_4px_15px_rgba(0,0,0,0.03)]"
                >
                  <View className="w-20 h-20 bg-white rounded-full items-center justify-center shadow-[0_5px_15px_rgba(0,0,0,0.05)] mb-6 self-start">
                    <Image source={require('../../assets/images/troca.png')} style={{ width: 40, height: 40 }} resizeMode="contain" />
                  </View>
                  <Text className="font-title text-[22px] text-[#1B4332] mb-3">Troca Facilitada</Text>
                  <Text className="font-sans text-[15px] text-[#555] leading-relaxed">
                    Não se adaptou? Acontece. Troque de profissional a qualquer momento sem burocracia ou custo extra.
                  </Text>
                </View>
              </YeloScrollView>

              {/* Indicador de rolagem do mouse (1:1 com web) */}
              <View className="mt-6 mb-2">
                <MouseScrollIndicator dark />
              </View>
            </View>

            {/* ============================================================ */}
            {/* 3. SEÇÃO SEGURANÇA E QUALIDADE (PROFISSIONAIS VERIFICADOS)    */}
            {/* ============================================================ */}
            <View className="bg-[#fdfaf6] pt-[20px] pb-[60px] px-[20px] relative">
              {/* Wave Top suave vinda da seção branca anterior (1:1 com .wave-top-organica da web) */}
              <View className="w-full -mt-5 mb-6">
                <Svg viewBox="0 0 1200 120" width="100%" height={width * (50 / 1200)} preserveAspectRatio="none">
                  <Path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" fill="#ffffff" />
                </Svg>
              </View>

              <View className="items-center text-center z-10 mb-6">
                <View className="bg-[#E6F4F1] px-[18px] py-[8px] rounded-[50px] mb-[20px]">
                  <Text className="font-sans font-bold text-[#1B4332] text-[12px] uppercase tracking-[1px]">
                    Segurança e Qualidade
                  </Text>
                </View>

                <Text className="font-title text-[30px] text-[#1B4332] text-center leading-tight mb-4">
                  Profissionais verificados em quem você pode confiar.
                </Text>

                <Text className="font-sans text-[15px] text-[#555] text-center leading-[25px] max-w-[650px]">
                  Garantimos a sua segurança através de um processo de verificação rigoroso. Todos os profissionais da plataforma possuem registro ativo no Conselho Regional de Psicologia (CRP). Aqui, você encontra especialistas prontos para te ajudar com ansiedade, depressão, carreira, relacionamentos e muito mais.
                </Text>
                
                {/* Badges de Confiança */}
                <View className="flex-row flex-wrap justify-center gap-3 mt-6 w-full">
                  <View className="flex-row items-center bg-white py-2 pr-5 pl-2 rounded-[50px] shadow-[0_4px_15px_rgba(0,0,0,0.04)] border border-[rgba(0,0,0,0.03)]">
                    <View className="w-8 h-8 bg-[#E6F4F1] rounded-full items-center justify-center mr-2.5">
                      <Feather name="check-square" size={15} color="#1B4332" />
                    </View>
                    <Text className="font-sans font-bold text-[#1B4332] text-[13.5px]">CRP Ativo</Text>
                  </View>

                  <View className="flex-row items-center bg-white py-2 pr-5 pl-2 rounded-[50px] shadow-[0_4px_15px_rgba(0,0,0,0.04)] border border-[rgba(0,0,0,0.03)]">
                    <View className="w-8 h-8 bg-[#FFF8E1] rounded-full items-center justify-center mr-2.5">
                      <Feather name="shield" size={15} color="#B38600" />
                    </View>
                    <Text className="font-sans font-bold text-[#1B4332] text-[13.5px]">Profissionais Verificados</Text>
                  </View>
                </View>

                {/* Imagem Oficial dos Psicólogos Verificados Yelo (Proporção Natural 1:1) */}
                <View className="w-full items-center justify-center my-8">
                  <Image 
                    source={require('../../assets/images/psicologos_yelo.png')} 
                    style={{ width: width - 40, height: (width - 40) * (1799 / 1908), maxWidth: 520 }}
                    resizeMode="contain"
                  />
                </View>

                {/* CTA da Seção com subtexto */}
                <TouchableOpacity 
                  activeOpacity={0.85}
                  onPress={() => router.push('/questionario')}
                  className="bg-[#FFEE8C] px-[35px] py-[15px] rounded-[50px] shadow-[0_4px_15px_rgba(0,0,0,0.15)] active:scale-95"
                >
                  <Text className="font-title font-bold text-[#1B4332] text-[16px]">
                    Encontrar meu psicólogo
                  </Text>
                </TouchableOpacity>
                <Text className="font-sans italic text-[13px] text-[#666] mt-2">
                  leva menos de 1 minuto
                </Text>
              </View>

              {/* Wave Divider para Como Funciona */}
              <View className="w-full -mb-1 mt-6">
                <Svg viewBox="0 0 1440 320" width="100%" height={width * (200 / 1440)} preserveAspectRatio="none">
                  <Path fill="#ffffff" fillOpacity="1" d="M0,64L48,80C96,96,192,128,288,128C384,128,480,96,576,90.7C672,85,768,107,864,122.7C960,139,1056,149,1152,133.3C1248,117,1344,75,1392,53.3L1440,32L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
                </Svg>
              </View>
            </View>

            {/* ============================================================ */}
            {/* 4. SEÇÃO COMO FUNCIONA (PASSOS 1, 2 E 3)                    */}
            {/* ============================================================ */}
            <View className="px-6 pb-14 pt-8 bg-white">
              <View className="items-center mb-8 text-center">
                <Text className="font-title text-[32px] text-[#1B4332] mb-3 text-center">Como a Yelo funciona</Text>
                <Text className="font-sans text-[15px] text-[#555] text-center leading-relaxed">
                  Uma jornada simples, transparente e focada no seu bem-estar.
                </Text>
                <View className="mt-4">
                  <MouseScrollIndicator dark />
                </View>
              </View>

              <View className="gap-8">
                {/* Passo 01 */}
                <View className="items-center text-center">
                  <View className="bg-[#E6F4F1] px-[16px] py-[6px] rounded-[50px] mb-[15px] self-center">
                    <Text className="font-sans font-bold text-[#1B4332] text-[12px] uppercase tracking-wider">Passo 01</Text>
                  </View>
                  <Text className="font-title text-[24px] text-[#1B4332] mb-3 text-center leading-tight">
                    Encontre o profissional ideal para você
                  </Text>
                  <Text className="font-sans text-[15px] text-[#555] leading-relaxed text-center mb-4">
                    Esqueça as listas infinitas. Responda ao nosso questionário inteligente sobre suas necessidades e preferências — <Text className="font-bold">leva menos de 1 minuto!</Text> Nossa tecnologia fará a curadoria e te apresentará os psicólogos mais compatíveis com o seu perfil. Se não gostar dos resultados, você pode refazer o questionário quantas vezes quiser.
                  </Text>
                  
                  {/* Ilustração Passo 1 Oficial (sem caixas cortadas, 1:1 com web) */}
                  <View className="w-full items-center justify-center my-2">
                    <Image 
                      source={require('../../assets/images/passo_1.png')} 
                      style={{ width: width - 48, height: (width - 48) * (1027 / 1532), maxWidth: 500 }} 
                      resizeMode="contain" 
                    />
                  </View>
                </View>

                {/* Indicador de scroll entre Passo 1 e Passo 2 */}
                <MouseScrollIndicator dark />

                {/* Passo 02 */}
                <View className="items-center text-center">
                  <View className="bg-[#E6F4F1] px-[16px] py-[6px] rounded-[50px] mb-[15px] self-center">
                    <Text className="font-sans font-bold text-[#1B4332] text-[12px] uppercase tracking-wider">Passo 02</Text>
                  </View>
                  <Text className="font-title text-[24px] text-[#1B4332] mb-3 text-center leading-tight">
                    Conheça e conecte-se com segurança
                  </Text>
                  <Text className="font-sans text-[15px] text-[#555] leading-relaxed text-center mb-4">
                    Veja o perfil detalhado, conheça a abordagem e a trajetória do profissional e leia avaliações reais. Quando sentir confiança, inicie uma conversa ou agende sua sessão diretamente pelo WhatsApp, sem intermediários.
                  </Text>
                  
                  {/* Ilustração Passo 2 Oficial (sem caixas cortadas, 1:1 com web) */}
                  <View className="w-full items-center justify-center my-2">
                    <Image 
                      source={require('../../assets/images/passo_2.png')} 
                      style={{ width: width - 48, height: (width - 48) * (1696 / 2524), maxWidth: 500 }} 
                      resizeMode="contain" 
                    />
                  </View>
                </View>

                {/* Indicador de scroll entre Passo 2 e Passo 3 */}
                <MouseScrollIndicator dark />

                {/* Passo 03 */}
                <View className="items-center text-center">
                  <View className="bg-[#E6F4F1] px-[16px] py-[6px] rounded-[50px] mb-[15px] self-center">
                    <Text className="font-sans font-bold text-[#1B4332] text-[12px] uppercase tracking-wider">Passo 03</Text>
                  </View>
                  <Text className="font-title text-[24px] text-[#1B4332] mb-3 text-center leading-tight">
                    Comece sua jornada de transformação
                  </Text>
                  <Text className="font-sans text-[15px] text-[#555] leading-relaxed text-center mb-4">
                    Realize suas sessões online no conforto da sua casa ou presencialmente. Se não se adaptar, nosso sistema de <Text className="font-bold">Troca Facilitada</Text> permite que você encontre outro profissional rapidamente.
                  </Text>
                  
                  {/* Ilustração Passo 3 Oficial (sem caixas cortadas, 1:1 com web) */}
                  <View className="w-full items-center justify-center my-2">
                    <Image 
                      source={require('../../assets/images/passo_3.png')} 
                      style={{ width: width - 48, height: (width - 48) * (1049 / 1500), maxWidth: 500 }} 
                      resizeMode="contain" 
                    />
                  </View>
                </View>
              </View>
              
              <View className="items-center mt-12 mb-4">
                <TouchableOpacity 
                  activeOpacity={0.85}
                  onPress={() => router.push('/questionario')}
                  className="bg-[#FFEE8C] px-[35px] py-[15px] rounded-[50px] shadow-[0_4px_15px_rgba(0,0,0,0.15)] active:scale-95"
                >
                  <Text className="font-title font-bold text-[#1B4332] text-[16px]">
                    Encontrar meu psicólogo
                  </Text>
                </TouchableOpacity>
                <Text className="font-sans italic text-[13px] text-[#666] mt-2">
                  leva menos de 1 minuto
                </Text>
              </View>

              {/* Wave Divider para Depoimentos */}
              <View className="w-full -mb-1 mt-8">
                <Svg viewBox="0 0 1200 120" width="100%" height={width * (80 / 1200)} preserveAspectRatio="none">
                  <Path d="M985.66,92.83C906.67,72,823.78,31,743.84,14.19c-82.26-17.34-168.06-16.33-250.45.39-57.84,11.73-114,31.07-172,41.86A600.21,600.21,0,0,1,0,27.35V120H1200V95.8C1132.19,118.92,1055.71,111.31,985.66,92.83Z" fill="#F8F3ED" />
                </Svg>
              </View>
            </View>

            {/* ============================================================ */}
            {/* 5. SEÇÃO DEPOIMENTOS (HISTÓRIAS DE QUEM JÁ COMEÇOU)          */}
            {/* ============================================================ */}
            <View className="bg-[#F8F3ED] py-14">
              <View className="px-6 mb-8 text-center items-center">
                <Text className="font-title text-[32px] text-[#1B4332] text-center mb-5">
                  Histórias de quem já começou
                </Text>

                {/* Rating Badge em Alto Contraste (1:1 com Web) */}
                <View className="bg-white border-[1.5px] border-[#EAE3D9] px-6 py-3 rounded-[50px] flex-row items-center shadow-[0_8px_24px_rgba(27,67,50,0.07)] gap-3">
                  <View className="flex-row -mr-1">
                    <View className="w-7 h-7 rounded-full bg-[#FFF8E1] border border-[#fdfaf6] items-center justify-center -mr-2.5 z-30">
                      <Text className="font-sans font-bold text-[#1B4332] text-[11px]">M</Text>
                    </View>
                    <View className="w-7 h-7 rounded-full bg-[#E6F4F1] border border-[#fdfaf6] items-center justify-center -mr-2.5 z-20">
                      <Text className="font-sans font-bold text-[#1B4332] text-[11px]">C</Text>
                    </View>
                    <View className="w-7 h-7 rounded-full bg-[#F8F3ED] border border-[#fdfaf6] items-center justify-center z-10">
                      <Text className="font-sans font-bold text-[#1B4332] text-[11px]">F</Text>
                    </View>
                  </View>

                  <Text className="font-sans font-extrabold text-[16px] text-[#1B4332]">
                    {homeData.mediaAvaliacao}/5
                  </Text>
                  <Text className="text-[#FFC107] text-[14px] tracking-[2px]">★★★★★</Text>
                  <Text className="font-sans font-semibold text-[12px] text-[#374151]">
                    Baseado em {homeData.totalAvaliacoes} avaliações
                  </Text>
                </View>
              </View>

              {/* Grid / Carrossel de Depoimentos Reais */}
              <YeloScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={{ paddingHorizontal: 20, gap: 16 }} 
                snapToInterval={width * 0.82 + 16} 
                decelerationRate="fast"
              >
                {homeData.depoimentos.map((depo, idx) => {
                  const styleColor = avatarStyles[idx % avatarStyles.length];
                  const isEven = idx % 2 === 0;

                  return (
                    <View 
                      key={idx} 
                      style={{ width: width * 0.82 }} 
                      className={`bg-white border-[1.5px] border-[#EAE3D9] p-6 shadow-[0_12px_32px_rgba(27,67,50,0.08)] relative overflow-hidden ${
                        isEven 
                          ? 'rounded-[28px] rounded-tr-[16px] rounded-br-[28px] rounded-bl-[16px]' 
                          : 'rounded-[16px] rounded-tr-[28px] rounded-br-[16px] rounded-bl-[28px]'
                      }`}
                    >
                      {/* Aspas decorativas d'água no topo */}
                      <Text 
                        style={{ fontFamily: 'serif' }} 
                        className="absolute top-1 right-5 text-[64px] text-[#1B4332] opacity-10 select-none pointer-events-none"
                      >
                        “
                      </Text>

                      {/* Estrelas */}
                      <Text className="text-[#FFC107] text-[14px] tracking-[2px] mb-3">★★★★★</Text>

                      {/* Texto com alto contraste e conforto visual */}
                      <Text className="font-sans font-medium text-[15px] text-[#162E24] leading-[24px] mb-6 flex-1">
                        "{depo.texto}"
                      </Text>

                      {/* Autor */}
                      <View className="flex-row items-center border-t-[1.5px] border-[#F0ECE4] pt-4">
                        <View 
                          style={{ backgroundColor: styleColor.bg, borderColor: styleColor.border }} 
                          className="w-11 h-11 rounded-full border-2 items-center justify-center mr-3 shadow-sm"
                        >
                          <Text style={{ color: styleColor.text }} className="font-extrabold text-[15px]">
                            {depo.inicial}
                          </Text>
                        </View>
                        <View>
                          <Text className="font-sans font-bold text-[#1B4332] text-[14px]">{depo.nome}</Text>
                          <Text className="font-sans text-[11px] text-[#666]">Paciente Verificada</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </YeloScrollView>

              {/* Indicador de rolagem do mouse (1:1 com web) */}
              <View className="mt-6 mb-2">
                <MouseScrollIndicator dark />
              </View>

              {/* Wave Divider para FAQ (Invertida 180deg como na web) */}
              <View className="w-full -mb-1 mt-6" style={{ transform: [{ rotate: '180deg' }] }}>
                <Svg viewBox="0 0 1200 120" width="100%" height={width * (80 / 1200)} preserveAspectRatio="none">
                  <Path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" fill="#ffffff" />
                </Svg>
              </View>
            </View>

            {/* ============================================================ */}
            {/* 6. SEÇÃO PERGUNTAS FREQUENTES (FAQ)                         */}
            {/* ============================================================ */}
            <View className="px-6 py-12 bg-white">
              <Text className="font-title text-[32px] text-[#1B4332] mb-8 text-center">
                Perguntas Frequentes
              </Text>

              <View className="gap-4">
                {faqs.map((faq, index) => (
                  <View 
                    key={index} 
                    className={`bg-white border border-[#f0f0f0] shadow-[0_4px_15px_rgba(0,0,0,0.03)] overflow-hidden ${
                      index % 2 === 0 
                        ? 'rounded-[24px] rounded-tr-[40px] rounded-bl-[40px]' 
                        : 'rounded-[40px] rounded-tr-[24px] rounded-bl-[24px]'
                    }`}
                  >
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setActiveFaq(activeFaq === index ? null : index)}
                      className="px-6 py-5 flex-row justify-between items-center"
                    >
                      <Text className="font-title text-[17px] text-[#1B4332] flex-1 mr-4">{faq.q}</Text>
                      <Feather name={activeFaq === index ? "minus" : "plus"} size={20} color="#1B4332" />
                    </TouchableOpacity>
                    {activeFaq === index && (
                      <View className="px-6 pb-6 pt-1 border-t border-[#fafafa]">
                        <Text className="font-sans text-[14.5px] text-[#555] leading-relaxed">{faq.a}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>

              <View className="items-center mt-8">
                <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/faq')}>
                  <Text className="font-sans font-bold text-[#1B4332] text-[15px] underline">
                    Ver todas as perguntas frequentes
                  </Text>
                </TouchableOpacity>
              </View>

              {/* CTA abaixo do FAQ */}
              <View className="items-center mt-8 mb-4">
                <TouchableOpacity 
                  activeOpacity={0.85}
                  onPress={() => router.push('/questionario')}
                  className="bg-[#FFEE8C] px-[35px] py-[15px] rounded-[50px] shadow-[0_4px_15px_rgba(0,0,0,0.15)] active:scale-95"
                >
                  <Text className="font-title font-bold text-[#1B4332] text-[16px]">
                    Encontrar meu psicólogo
                  </Text>
                </TouchableOpacity>
                <Text className="font-sans italic text-[13px] text-[#666] mt-2">
                  leva menos de 1 minuto
                </Text>
              </View>
            </View>

            {/* ============================================================ */}
            {/* 7. AVISO DE CRISE (SAÚDE MENTAL & LGPD)                      */}
            {/* ============================================================ */}
            <View className="px-6 pb-12 pt-2 bg-white">
              <View className="bg-[#FFF8E1] border border-[#FFE082] rounded-[24px] p-5 items-center">
                <Text className="font-sans text-[13.5px] text-[#795548] text-center leading-[20px]">
                  Se você está em crise ou qualquer outra pessoa pode estar em perigo, <Text className="font-bold text-[#5D4037]">não use este aplicativo</Text>. Ligue <Text className="font-bold text-[#1B4332]">188 (CVV)</Text> para apoio emocional gratuito 24h ou procure o pronto-socorro mais próximo.
                </Text>
              </View>
            </View>

          </View>

          {/* ============================================================ */}
          {/* 8. RODAPÉ INSTITUCIONAL GLOBAL                              */}
          {/* ============================================================ */}
          <Footer />
          
        </YeloScrollView>

        {/* ============================================================ */}
        {/* 9. BARRA DE NAVEGAÇÃO INFERIOR FLUTUANTE                     */}
        {/* ============================================================ */}
        <PublicBottomNav />

      </SafeAreaView>
    </View>
  );
}
