import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Image, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { FontAwesome5, Feather } from '@expo/vector-icons';

export default function Footer() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);

  return (
    <View className="bg-white">
      {/* ONDA DE DIVISÃO (Transição para o Footer) - Copiada da Index */}
      <View className="w-full -mb-1">
        <Svg viewBox="0 0 1440 320" width="100%" height={width * (320 / 1440)} preserveAspectRatio="none">
          <Path 
            fill="#1B4332" 
            fillOpacity="1" 
            d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,112C672,96,768,96,864,112C960,128,1056,160,1152,165.3C1248,171,1344,149,1392,138.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" 
          />
        </Svg>
      </View>

      <View className="bg-[#1B4332] px-6 pt-10 pb-[120px]">
        <View className="max-w-[1200px] mx-auto w-full">
          
          {/* BLOCO 1: NEWSLETTER */}
          <View className="mb-10 items-center">
            <Text className="font-title text-white text-[20px] mb-2 text-center">Fique por dentro</Text>
            <Text className="font-sans text-white/70 text-[15px] mb-5 text-center leading-relaxed">
              Receba dicas de saúde mental e novidades da plataforma direto no seu e-mail.
            </Text>
            
            <View className="w-full max-w-[400px]">
              <View className="flex-col gap-3 w-full">
                <TextInput
                  className="w-full bg-white/10 border border-white/20 rounded-[50px] px-5 py-3 text-white font-sans text-[16px]"
                  placeholder="seu.email@exemplo.com"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <TouchableOpacity 
                  activeOpacity={0.8}
                  className="bg-[#FFEE8C] rounded-[50px] py-3 px-8 self-center"
                >
                  <Text className="font-black text-[#1B4332] text-[15px]">Inscrever</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                activeOpacity={0.7} 
                onPress={() => setConsent(!consent)}
                className="flex-row items-center justify-center mt-4 gap-2"
              >
                <View className={`w-5 h-5 rounded border ${consent ? 'bg-[#FFEE8C] border-[#FFEE8C]' : 'border-white/40'} items-center justify-center`}>
                  {consent && <Feather name="check" size={14} color="#1B4332" />}
                </View>
                <Text className="font-sans text-white/60 text-[13px]">
                  Aceito receber comunicações da Yelo.
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* BLOCO 2: PLATAFORMA */}
          <View className="mb-10 items-center">
            <Text className="font-title text-white text-[20px] mb-4">Plataforma</Text>
            <View className="flex-row flex-wrap justify-center gap-x-6 gap-y-4">
              <TouchableOpacity onPress={() => router.push('/')}><Text className="font-sans text-[#adb5bd] text-[15px]">Início</Text></TouchableOpacity>
              <TouchableOpacity><Text className="font-sans text-[#adb5bd] text-[15px]">Sobre</Text></TouchableOpacity>
              <TouchableOpacity><Text className="font-sans text-[#adb5bd] text-[15px]">Pergunte</Text></TouchableOpacity>
              <TouchableOpacity><Text className="font-sans text-[#adb5bd] text-[15px]">Para Profissionais</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/faq')}><Text className="font-sans text-[#adb5bd] text-[15px]">FAQ</Text></TouchableOpacity>
              <TouchableOpacity><Text className="font-sans text-[#adb5bd] text-[15px]">Blog</Text></TouchableOpacity>
              <TouchableOpacity><Text className="font-sans text-[#adb5bd] text-[15px]">Contato</Text></TouchableOpacity>
              <TouchableOpacity><Text className="font-sans text-[#adb5bd] text-[15px]">Código de Ética</Text></TouchableOpacity>
            </View>
          </View>

          {/* BLOCO 3: RECURSOS GRATUITOS */}
          <View className="mb-10 items-center">
            <Text className="font-title text-white text-[20px] mb-4">Recursos Gratuitos</Text>
            <View className="flex-row flex-wrap justify-center gap-x-6 gap-y-4 mb-4">
              <TouchableOpacity><Text className="font-sans text-[#adb5bd] text-[15px]">SOS Ansiedade</Text></TouchableOpacity>
              <TouchableOpacity><Text className="font-sans text-[#adb5bd] text-[15px]">Terapia Ideal</Text></TouchableOpacity>
              <TouchableOpacity><Text className="font-sans text-[#adb5bd] text-[15px]">Roda da Vida</Text></TouchableOpacity>
              <TouchableOpacity><Text className="font-sans text-[#adb5bd] text-[15px]">Calc. Honorários</Text></TouchableOpacity>
              <TouchableOpacity><Text className="font-sans text-[#adb5bd] text-[15px]">Gerador de Bio</Text></TouchableOpacity>
            </View>
            
            {/* Botão Apoio à Mulher */}
            <TouchableOpacity 
              activeOpacity={0.8}
              className="flex-row items-center bg-[#8b5cf6] border border-[#7c3aed] px-5 py-2.5 rounded-[50px] shadow-[0_4px_15px_rgba(139,92,246,0.3)] mt-2"
            >
              <Feather name="info" size={16} color="white" className="mr-2" />
              <Text className="font-black text-white text-[15px] ml-2">Apoio à Mulher</Text>
            </TouchableOpacity>
          </View>

          {/* BLOCO 4: CONECTE-SE */}
          <View className="mb-10 items-center">
            <Text className="font-title text-white text-[20px] mb-4">Conecte-se</Text>
            <View className="flex-row justify-center gap-4 mb-8">
              <TouchableOpacity className="w-11 h-11 rounded-full bg-white/5 border border-white/20 items-center justify-center">
                <FontAwesome5 name="instagram" size={20} color="white" />
              </TouchableOpacity>
              <TouchableOpacity className="w-11 h-11 rounded-full bg-white/5 border border-white/20 items-center justify-center">
                <FontAwesome5 name="tiktok" size={18} color="white" />
              </TouchableOpacity>
              <TouchableOpacity className="w-11 h-11 rounded-full bg-white/5 border border-white/20 items-center justify-center">
                <FontAwesome5 name="linkedin-in" size={18} color="white" />
              </TouchableOpacity>
              <TouchableOpacity className="w-11 h-11 rounded-full bg-white/5 border border-white/20 items-center justify-center">
                <FontAwesome5 name="spotify" size={20} color="white" />
              </TouchableOpacity>
            </View>

            {/* BAIXE O APP */}
            <Text className="font-title text-white text-[18px] mb-4">Baixe o App</Text>
            <View className="flex-row gap-4 justify-center">
              
              <View className="relative opacity-60">
                <View className="bg-black border border-white/30 rounded-lg px-3 py-2 flex-row items-center gap-2">
                  <FontAwesome5 name="google-play" size={18} color="white" />
                  <View>
                    <Text className="text-[9px] text-white/80 uppercase font-sans">Disponível no</Text>
                    <Text className="text-[14px] text-white font-sans font-semibold">Google Play</Text>
                  </View>
                </View>
                <View className="absolute -top-2 -right-2 bg-[#FFEE8C] px-1.5 py-0.5 rounded shadow">
                  <Text className="text-[#1B4332] text-[8px] font-black tracking-wider">EM BREVE</Text>
                </View>
              </View>

              <View className="relative opacity-60">
                <View className="bg-black border border-white/30 rounded-lg px-3 py-2 flex-row items-center gap-2">
                  <FontAwesome5 name="apple" size={22} color="white" />
                  <View>
                    <Text className="text-[9px] text-white/80 uppercase font-sans">Baixar na</Text>
                    <Text className="text-[14px] text-white font-sans font-semibold">App Store</Text>
                  </View>
                </View>
                <View className="absolute -top-2 -right-2 bg-[#FFEE8C] px-1.5 py-0.5 rounded shadow">
                  <Text className="text-[#1B4332] text-[8px] font-black tracking-wider">EM BREVE</Text>
                </View>
              </View>

            </View>
          </View>

          {/* DIVISOR */}
          <View className="h-px bg-white/10 w-full mb-6" />

          {/* BASE LEGAL & COPYRIGHT */}
          <View className="items-center">
            <Text className="font-sans text-white/60 text-[14px] text-center mb-1">
              <Text className="font-bold text-white">yelo</Text> 💛 Saúde Mental
            </Text>
            <Text className="font-sans text-white/60 text-[14px] text-center mb-5">
              Responsável Técnico:{"\n"}<Text className="font-semibold text-white">Anderson Costa | CRP 06/190861</Text>
            </Text>

            <View className="flex-row justify-center gap-4 mb-5 flex-wrap">
              <TouchableOpacity><Text className="font-sans text-[#adb5bd] text-[13px]">Termos de Uso</Text></TouchableOpacity>
              <TouchableOpacity><Text className="font-sans text-[#adb5bd] text-[13px]">Privacidade</Text></TouchableOpacity>
              <TouchableOpacity><Text className="font-sans text-[#adb5bd] text-[13px]">Mapa do Site</Text></TouchableOpacity>
            </View>

            <Text className="font-sans text-white/60 text-[13px] text-center">
              © 2026 yelo Saúde Mental. Todos os direitos reservados.
            </Text>
            <Text className="font-sans text-white/40 text-[11px] text-center mt-1">
              CNPJ: 64.518.011/0001-40
            </Text>
          </View>

        </View>
      </View>
    </View>
  );
}
