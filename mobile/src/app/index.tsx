import { useEffect, useState } from 'react';
import { useRouter, Link } from 'expo-router';
import { View, Text, ActivityIndicator, ScrollView, TouchableOpacity, Dimensions, Image } from 'react-native';
import YeloScrollView from '../components/YeloScrollView';
import { useAuth } from '../contexts/AuthContext';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Svg, { Path } from 'react-native-svg';
import Footer from '../components/Footer';
import PublicBottomNav from '../components/PublicBottomNav';
import PublicHeader from '../components/PublicHeader';

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
  const [isScrolled, setIsScrolled] = useState(false);

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
              onPress={() => router.push('/questionario')}
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
              <View className="mb-5">
                <Image source={require('../../assets/images/match.png')} style={{ width: 44, height: 44 }} resizeMode="contain" />
              </View>
              <Text className="font-title text-[20px] text-[#1B4332] mb-3">Match Inteligente</Text>
              <Text className="font-sans text-[14px] text-[#555] leading-relaxed">Não perca tempo procurando. Nossa tecnologia conecta você aos especialistas ideais para sua necessidade específica.</Text>
            </View>

            <View style={{ width: width * 0.75 }} className="bg-[#E6F4F1] border border-[rgba(0,0,0,0.03)] p-8 rounded-[60px] rounded-tr-[24px] rounded-bl-[24px] shadow-[0_4px_15px_rgba(0,0,0,0.02)]">
              <View className="mb-5">
                <Image source={require('../../assets/images/sigilo.png')} style={{ width: 44, height: 44 }} resizeMode="contain" />
              </View>
              <Text className="font-title text-[20px] text-[#1B4332] mb-3">100% Sigiloso e Seguro</Text>
              <Text className="font-sans text-[14px] text-[#555] leading-relaxed">Sua privacidade é nossa prioridade. Plataforma criptografada e profissionais éticos verificados pelo CRP.</Text>
            </View>

            <View style={{ width: width * 0.75 }} className="bg-[#FFF8E1] border border-[rgba(0,0,0,0.03)] p-8 rounded-[24px] rounded-tr-[60px] rounded-bl-[60px] shadow-[0_4px_15px_rgba(0,0,0,0.02)]">
              <View className="mb-5">
                <Image source={require('../../assets/images/troca.png')} style={{ width: 44, height: 44 }} resizeMode="contain" />
              </View>
              <Text className="font-title text-[20px] text-[#1B4332] mb-3">Troca Facilitada</Text>
              <Text className="font-sans text-[14px] text-[#555] leading-relaxed">Não se adaptou? Acontece. Troque de profissional a qualquer momento sem burocracia ou custo extra.</Text>
            </View>
          </YeloScrollView>
        </View>

        {/* SEÇÃO ORGÂNICA (COLLAGE) */}
        <View className="bg-[#fdfaf6] pt-[60px] pb-[80px] px-[20px]">
          {/* Texto e Tags */}
          <View className="items-center text-center z-10 mb-8">
            <View className="bg-[#E6F4F1] px-[18px] py-[8px] rounded-[50px] mb-[25px]">
              <Text className="font-sans font-bold text-[#1B4332] text-[12px] uppercase tracking-[1px]">Segurança e Qualidade</Text>
            </View>
            <Text className="font-title text-[32px] text-[#1B4332] text-center leading-tight mb-6">Profissionais verificados em quem você pode confiar.</Text>
            <Text className="font-sans text-[16px] text-[#555] text-center leading-[26px]">Nossa curadoria é rigorosa. Apenas psicólogos com CRP ativo e aprovados em nossa entrevista técnica entram na plataforma.</Text>
            
            <View className="flex-row flex-wrap justify-center gap-4 mt-8 w-full">
              <View className="flex-row items-center bg-white py-2 pr-6 pl-2 rounded-[50px] shadow-[0_8px_25px_rgba(27,67,50,0.06)] border border-[rgba(27,67,50,0.05)]">
                <View className="w-9 h-9 bg-[#E6F4F1] rounded-full items-center justify-center mr-3">
                  <Feather name="check" size={16} color="#1B4332" />
                </View>
                <Text className="font-sans font-bold text-[#1B4332] text-[14px]">CRP Ativo</Text>
              </View>
              <View className="flex-row items-center bg-white py-2 pr-6 pl-2 rounded-[50px] shadow-[0_8px_25px_rgba(27,67,50,0.06)] border border-[rgba(27,67,50,0.05)]">
                <View className="w-9 h-9 bg-[#E6F4F1] rounded-full items-center justify-center mr-3">
                  <Feather name="shield" size={16} color="#1B4332" />
                </View>
                <Text className="font-sans font-bold text-[#1B4332] text-[14px]">Verificados</Text>
              </View>
            </View>
            <TouchableOpacity 
              onPress={() => router.push('/questionario')}
              className="bg-[#FFEE8C] px-[35px] py-[15px] rounded-[50px] shadow-[0_4px_15px_rgba(0,0,0,0.15)] mt-8"
            >
              <Text className="font-black text-[#1B4332] text-[16px]">Encontrar meu psicólogo</Text>
            </TouchableOpacity>
          </View>

          {/* Collage Wrapper */}
          <View style={{ width: '100%', height: 350, marginTop: 20, position: 'relative' }}>
             <Image 
               source={{ uri: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=600' }} 
               style={{ position: 'absolute', width: '55%', height: '70%', top: '15%', left: '22.5%', borderTopLeftRadius: 100, borderTopRightRadius: 100, borderBottomRightRadius: 20, borderBottomLeftRadius: 20 }}
               resizeMode="cover"
             />
             <Image 
               source={{ uri: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=300' }} 
               style={{ position: 'absolute', width: '25%', aspectRatio: 1, top: '5%', left: '5%', borderRadius: 40 }}
               resizeMode="cover"
             />
             <Image 
               source={{ uri: 'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=300' }} 
               style={{ position: 'absolute', width: '22%', aspectRatio: 1, top: '10%', right: '5%', borderRadius: 50 }}
               resizeMode="cover"
             />
             <Image 
               source={{ uri: 'https://images.pexels.com/photos/1121796/pexels-photo-1121796.jpeg?auto=compress&cs=tinysrgb&w=300' }} 
               style={{ position: 'absolute', width: '18%', aspectRatio: 1, top: '45%', right: '0%', borderRadius: 30 }}
               resizeMode="cover"
             />
             <Image 
               source={{ uri: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=300' }} 
               style={{ position: 'absolute', width: '28%', height: '35%', bottom: '0%', right: '10%', borderRadius: 20 }}
               resizeMode="cover"
             />
             <Image 
               source={{ uri: 'https://images.pexels.com/photos/1516680/pexels-photo-1516680.jpeg?auto=compress&cs=tinysrgb&w=300' }} 
               style={{ position: 'absolute', width: '24%', aspectRatio: 1, bottom: '10%', left: '0%', borderRadius: 40 }}
               resizeMode="cover"
             />
          </View>
        </View>

        {/* COMO FUNCIONA */}
        <View className="px-6 pb-14 pt-10">
          <View className="items-center mb-10 text-center">
            <Text className="font-title text-[32px] text-[#1B4332] mb-3 text-center">Como a Yelo funciona</Text>
            <Text className="font-sans text-[15px] text-[#555] text-center leading-relaxed">Uma jornada simples, transparente e focada no seu bem-estar.</Text>
          </View>

          <View className="gap-12">
            {/* Passo 01 */}
            <View className="items-center text-center">
              <View className="bg-[#E6F4F1] px-[16px] py-[6px] rounded-[50px] mb-[15px] self-center">
                <Text className="font-sans font-bold text-[#1B4332] text-[12px] uppercase tracking-wider">Passo 01</Text>
              </View>
              <Text className="font-title text-[24px] text-[#1B4332] mb-3 text-center leading-tight">Encontre o profissional ideal para você</Text>
              <Text className="font-sans text-[15px] text-[#555] leading-relaxed text-center mb-6">Esqueça as listas infinitas. Responda ao nosso questionário inteligente sobre suas necessidades e preferências. Nossa tecnologia fará a curadoria e te apresentará os psicólogos mais compatíveis com o seu perfil.</Text>
              
              <View className="w-full relative items-center justify-center h-[280px] bg-[#F8F3ED] rounded-[40px] overflow-hidden p-4">
                <Image source={require('../../assets/images/passo_1.png')} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
              </View>
            </View>

            {/* Passo 02 */}
            <View className="items-center text-center">
              <View className="bg-[#E6F4F1] px-[16px] py-[6px] rounded-[50px] mb-[15px] self-center">
                <Text className="font-sans font-bold text-[#1B4332] text-[12px] uppercase tracking-wider">Passo 02</Text>
              </View>
              <Text className="font-title text-[24px] text-[#1B4332] mb-3 text-center leading-tight">Conheça e conecte-se com segurança</Text>
              <Text className="font-sans text-[15px] text-[#555] leading-relaxed text-center mb-6">Veja o perfil detalhado, assista ao vídeo de apresentação e leia avaliações reais. Quando sentir confiança, inicie uma conversa ou agende sua sessão diretamente pela plataforma, sem intermediários.</Text>
              
              <View className="w-full relative items-center justify-center h-[280px] bg-[#E6F4F1] rounded-[40px] overflow-hidden p-4">
                <Image source={require('../../assets/images/passo_2.png')} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
              </View>
            </View>

            {/* Passo 03 */}
            <View className="items-center text-center">
              <View className="bg-[#E6F4F1] px-[16px] py-[6px] rounded-[50px] mb-[15px] self-center">
                <Text className="font-sans font-bold text-[#1B4332] text-[12px] uppercase tracking-wider">Passo 03</Text>
              </View>
              <Text className="font-title text-[24px] text-[#1B4332] mb-3 text-center leading-tight">Comece sua jornada de transformação</Text>
              <Text className="font-sans text-[15px] text-[#555] leading-relaxed text-center mb-6">Realize suas sessões online no conforto da sua casa. Se não se adaptar, nosso sistema de Troca Facilitada permite que você encontre outro profissional rapidamente.</Text>
              
              <View className="w-full relative items-center justify-center h-[280px] bg-[#FFF8E1] rounded-[40px] overflow-hidden p-4">
                <Image source={require('../../assets/images/passo_3.png')} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
              </View>
            </View>
          </View>
          
          <View className="items-center mt-12 mb-6">
            <TouchableOpacity 
              onPress={() => router.push('/questionario')}
              className="bg-[#FFEE8C] px-[35px] py-[15px] rounded-[50px] shadow-[0_4px_15px_rgba(0,0,0,0.15)]"
            >
              <Text className="font-black text-[#1B4332] text-[16px]">Encontrar meu psicólogo</Text>
            </TouchableOpacity>
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
            onPress={() => router.push('/questionario')}
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
      <PublicBottomNav />

      </SafeAreaView>
    </View>
  );
}
