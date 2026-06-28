import React from 'react';
import { View, Text, TouchableOpacity, Image, Linking, Dimensions, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import YeloScrollView from '../components/YeloScrollView';
import PublicHeader from '../components/PublicHeader';
import Footer from '../components/Footer';
import PublicBottomNav from '../components/PublicBottomNav';

const { width } = Dimensions.get('window');

export default function AjudaMulher() {
  const router = useRouter();

  const handleQuickExit = () => {
    // Abre o google no navegador padrão (o que tira a pessoa do app rapidamente)
    Linking.openURL('https://www.google.com');
  };

  const openWhatsapp = () => {
    Linking.openURL('https://api.whatsapp.com/send/?phone=556196100180&text=Ol%C3%A1&type=phone_number&app_absent=0');
  };

  const openJusticeiras = () => {
    Linking.openURL('https://docs.google.com/forms/d/e/1FAIpQLSft--ccomNpgfVaU0O9Xjpmg_vLmhHsKZ8SG5YiphdMRshpgg/viewform?pli=1');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
        <PublicHeader alwaysLight />

        <YeloScrollView>
          {/* Hero Section */}
          <View className="bg-[#1B4332] px-[20px] py-[40px] pb-[60px] items-center relative overflow-hidden">
            {/* Doodles simulados de fundo */}
            <Feather name="wind" size={150} color="rgba(255,255,255,0.05)" style={{ position: 'absolute', top: -20, left: -40, transform: [{ rotate: '45deg' }] }} />
            <Feather name="sun" size={120} color="rgba(255,255,255,0.05)" style={{ position: 'absolute', bottom: -20, right: -40 }} />
            
            <View className="border-2 border-white/30 px-[20px] py-[8px] rounded-[50px] mb-[20px]">
              <Text className="font-sans font-bold text-white text-[14px]">Você não está sozinha</Text>
            </View>
            
            <Text className="font-title text-white text-[32px] text-center mb-[15px] leading-[38px]">
              Espaço de Apoio e Orientação
            </Text>
            
            <Text className="font-sans text-white/80 text-[16px] text-center max-w-[320px] leading-[24px]">
              Identificar a violência é o primeiro passo para romper o ciclo. Aqui você encontra informação segura e canais de ajuda especializados.
            </Text>
          </View>

          <View className="bg-white rounded-t-[30px] mt-[-30px] pt-[40px] px-[20px] pb-[40px]">
            {/* Termômetro da Violência */}
            <View className="items-center mb-[40px]">
              <Text className="font-title text-[#1B4332] text-[28px] text-center mb-[10px]">Termômetro da Violência</Text>
              <Text className="font-sans text-[#555] text-[15px] text-center mb-[30px] leading-[22px]">
                A violência nem sempre deixa marcas visíveis. Ela pode começar de forma sutil e escalar com o tempo. Identifique os sinais:
              </Text>
              
              <Image 
                source={require('../../assets/images/violentômetro.png')}
                style={{ width: width - 40, height: (width - 40) * 1.5 }}
                resizeMode="contain"
              />
            </View>

            {/* Canais de Ajuda */}
            <View className="mb-[20px]">
              <Text className="font-title text-[#1B4332] text-[28px] text-center mb-[10px]">Canais de Acolhimento</Text>
              <Text className="font-sans text-[#555] text-[15px] text-center mb-[30px] leading-[22px]">
                Você tem direitos e existe uma rede pronta para te apoiar. O contato é sigiloso.
              </Text>

              {/* Card 180 */}
              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={openWhatsapp}
                className="bg-white border border-[#e5e7eb] rounded-[24px] p-[25px] shadow-[0_10px_30px_rgba(0,0,0,0.06)] mb-[20px] items-center relative overflow-hidden"
              >
                <View className="absolute top-0 left-0 right-0 h-[8px] bg-[#25D366]" />
                
                <View className="w-[60px] h-[60px] bg-[#25D366]/10 rounded-full items-center justify-center mb-[15px]">
                  <Feather name="message-circle" size={30} color="#25D366" />
                </View>
                
                <Text className="font-title text-[#1B4332] text-[22px] mb-[10px]">Central 180</Text>
                <Text className="font-sans text-[#555] text-[14px] text-center mb-[20px] leading-[20px]">
                  Atendimento oficial do governo para denúncias e orientações sobre violência contra a mulher.
                </Text>
                
                <View className="bg-[#25D366] w-full py-[14px] rounded-[50px] items-center">
                  <Text className="font-sans font-bold text-white text-[15px]">Chamar no WhatsApp</Text>
                </View>
              </TouchableOpacity>

              {/* Card Justiceiras */}
              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={openJusticeiras}
                className="bg-white border border-[#e5e7eb] rounded-[24px] p-[25px] shadow-[0_10px_30px_rgba(0,0,0,0.06)] mb-[20px] items-center relative overflow-hidden"
              >
                <View className="absolute top-0 left-0 right-0 h-[8px] bg-[#7c3aed]" />
                
                <View className="w-[60px] h-[60px] bg-[#7c3aed]/10 rounded-full items-center justify-center mb-[15px]">
                  <Text style={{ fontSize: 28 }}>⚖️</Text>
                </View>
                
                <Text className="font-title text-[#1B4332] text-[22px] mb-[10px]">Projeto Justiceiras</Text>
                <Text className="font-sans text-[#555] text-[14px] text-center mb-[20px] leading-[20px]">
                  Rede multidisciplinar de acolhimento, apoio jurídico, psicológico e socioassistencial.
                </Text>
                
                <View className="bg-[#7c3aed] w-full py-[14px] rounded-[50px] items-center">
                  <Text className="font-sans font-bold text-white text-[15px]">Solicitar Apoio</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          <Footer />
        </YeloScrollView>
        <PublicBottomNav />
      </SafeAreaView>

      {/* Floating Quick Exit Button */}
      <TouchableOpacity 
        onPress={handleQuickExit}
        activeOpacity={0.7}
        className="absolute bottom-[100px] right-[20px] bg-red-600 px-[20px] py-[12px] rounded-[50px] flex-row items-center shadow-[0_4px_15px_rgba(220,38,38,0.5)] z-50"
      >
        <Feather name="x" size={18} color="white" style={{ marginRight: 8 }} />
        <Text className="font-sans font-bold text-white text-[14px]">Saída Rápida</Text>
      </TouchableOpacity>
    </View>
  );
}
