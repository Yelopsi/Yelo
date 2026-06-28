import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import YeloScrollView from '../components/YeloScrollView';
import Footer from '../components/Footer';
import PublicBottomNav from '../components/PublicBottomNav';
import PublicHeader from '../components/PublicHeader';

const { width } = Dimensions.get('window');
const gap = 8;
const itemWidth = (width - 40 - (gap * 2)) / 3; // 40 is horizontal padding (20 + 20)

export default function SobrePsisScreen() {
  const [isScrolled, setIsScrolled] = useState(false);
  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top']}>
        <PublicHeader isScrolled={isScrolled} alwaysLight={true} />
        <YeloScrollView 
          refreshColor="#1B4332" 
          contentContainerStyle={{ flexGrow: 1, backgroundColor: '#ffffff' }}
          onScroll={(e) => setIsScrolled(e.nativeEvent.contentOffset.y > 20)}
          scrollEventThrottle={16}
        >
        
        {/* ================= 1. HERO SECTION ================= */}
        <View className="bg-[#ffffff] pt-[80px] px-[20px] pb-[120px] items-center relative -mt-[2px]">
          <Text className="text-[#1B4332] font-title text-[40px] text-center leading-[46px] mb-[20px] max-w-[700px] z-10">
            Quem vai caminhar com você {"\n"}nessa jornada?
          </Text>
          <Text className="text-[#555] font-sans text-[19px] text-center max-w-[700px] leading-[30px] z-10">
            A tecnologia conecta, mas é o ser humano que acolhe.{'\n'}Nossa comunidade é formada por psicólogos reais, diversos e comprometidos em ouvir sua história <Text className="font-bold text-[#333]">sem julgamentos</Text>.
          </Text>
        </View>

        {/* WAVE 1: Hero to Quality (Off-white to White) */}
        <View className="w-full -mt-[1px] bg-white">
          <Svg viewBox="0 0 1440 320" width="100%" height={width * (120 / 1440)} preserveAspectRatio="none" style={{ backgroundColor: '#fdfaf6' }}>
            <Path fill="#ffffff" fillOpacity="1" d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,112C672,96,768,96,864,112C960,128,1056,160,1152,165.3C1248,171,1344,149,1392,138.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
          </Svg>
        </View>

        {/* ================= 2. QUALITY SECTION ================= */}
        <View className="bg-white py-[50px]">
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            snapToInterval={295}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: 20, gap: 15 }}
          >
            {/* Card 1 */}
            <View className="bg-white rounded-[24px] w-[280px] py-[40px] px-[30px] border border-[#f0f0f0] shadow-[0_4px_20px_rgba(0,0,0,0.03)] justify-between">
              <View>
                <View className="flex-row items-center mb-[15px] gap-[15px]">
                  <View className="w-[55px] h-[55px] bg-[#f0fdf4] rounded-[16px] items-center justify-center">
                    <Text className="text-[32px] text-[#16a34a]">🛡️</Text>
                  </View>
                  <Text className="font-title text-[#1B4332] text-[21px] flex-1 leading-[25px] m-0">Segurança{'\n'}Verificada</Text>
                </View>
                <Text className="font-sans text-[#555] text-[16px] leading-[26px] m-0">"Sua tranquilidade vem primeiro. Todos os nossos profissionais têm registro ativo no Conselho Federal de Psicologia (CRP), validado rigorosamente por nossa equipe."</Text>
              </View>
            </View>

            {/* Card 2 */}
            <View className="bg-white rounded-[24px] w-[280px] py-[40px] px-[30px] border border-[#f0f0f0] shadow-[0_4px_20px_rgba(0,0,0,0.03)] justify-between">
              <View>
                <View className="flex-row items-center mb-[15px] gap-[15px]">
                  <View className="w-[55px] h-[55px] bg-[#fffbeb] rounded-[16px] items-center justify-center">
                    <Text className="text-[32px] text-[#b45309]">🌍</Text>
                  </View>
                  <Text className="font-title text-[#1B4332] text-[21px] flex-1 leading-[25px] m-0">Sua Identidade{'\n'}Importa</Text>
                </View>
                <Text className="font-sans text-[#555] text-[16px] leading-[26px] m-0">"Acreditamos na cura através da identificação. Valorizamos a pluralidade de raças, gêneros e vivências para que você encontre alguém que realmente entenda o seu mundo."</Text>
              </View>
            </View>

            {/* Card 3 */}
            <View className="bg-white rounded-[24px] w-[280px] py-[40px] px-[30px] border border-[#f0f0f0] shadow-[0_4px_20px_rgba(0,0,0,0.03)] justify-between">
              <View>
                <View className="flex-row items-center mb-[15px] gap-[15px]">
                  <View className="w-[55px] h-[55px] bg-[#f3e8ff] rounded-[16px] items-center justify-center">
                    <Text className="text-[32px] text-[#7e22ce]">🤝</Text>
                  </View>
                  <Text className="font-title text-[#1B4332] text-[21px] flex-1 leading-[25px] m-0">Espaço{'\n'}Seguro</Text>
                </View>
                <Text className="font-sans text-[#555] text-[16px] leading-[26px] m-0">"Aqui, sua fala é sagrada. Seguimos um código de ética rígido que garante sigilo absoluto, respeito e um ambiente livre de preconceitos."</Text>
              </View>
            </View>
          </ScrollView>
        </View>

        {/* WAVE 2: Quality to Collage (White to Creme) */}
        <View className="w-full -mt-[1px] bg-[#F8F3ED]">
          <Svg viewBox="0 0 1440 320" width="100%" height={width * (120 / 1440)} preserveAspectRatio="none" style={{ backgroundColor: '#ffffff' }}>
            <Path fill="#F8F3ED" fillOpacity="1" d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,112C672,96,768,96,864,112C960,128,1056,160,1152,165.3C1248,171,1344,149,1392,138.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
          </Svg>
        </View>

        {/* ================= 3. COLLAGE SECTION ================= */}
        <View className="bg-[#F8F3ED] pt-[60px] px-[20px] pb-[80px] items-center">
          <View className="w-full max-w-[1200px] flex-col lg:flex-row items-center gap-[60px]">
            
            {/* Texto */}
            <View className="flex-1 w-full items-center lg:items-start">
              <Text className="font-title text-[#1B4332] text-[40px] leading-[44px] mb-[25px] text-center lg:text-left">
                Quem vai caminhar com você?
              </Text>
              <Text className="font-sans text-[#555] text-[18px] leading-[30px] mb-[30px] text-center lg:text-left">
                "A tecnologia conecta, mas é o ser humano que acolhe. Acreditamos que a cura nasce da identificação, por isso nossa comunidade vai muito além do currículo: reunimos pessoas apaixonadas por ouvir gente."
              </Text>
              <Text className="font-sans text-[#555] text-[18px] leading-[30px] mb-[30px] text-center lg:text-left">
                "Aqui você encontra profissionais com vivências plurais e escuta ativa, prontos para entender seu mundo — seja para lidar com ansiedade, carreira ou relacionamentos — sem nenhum tipo de julgamento."
              </Text>
              <TouchableOpacity 
                onPress={() => router.push('/questionario')}
                className="bg-[#1B4332] rounded-[50px] py-[16px] px-[40px] items-center"
              >
                <Text className="font-sans font-extrabold text-[16px] text-white">Conhecer quem cuida</Text>
              </TouchableOpacity>
            </View>

            {/* Grid 3x5 de Fotos (15 items) para mobile */}
            <View className="w-full mt-[40px] flex-row flex-wrap justify-between" style={{ gap: gap }}>
              {Array.from({ length: 15 }).map((_, index) => (
                <View 
                  key={index} 
                  className="rounded-[8px] overflow-hidden bg-[#e0e0e0] shadow-[0_4px_10px_rgba(0,0,0,0.05)]"
                  style={{ width: itemWidth, height: itemWidth }}
                >
                  <Image 
                    source={{uri: `https://images.pexels.com/photos/${3184291 + index}/pexels-photo-${3184291 + index}.jpeg?auto=compress&cs=tinysrgb&w=200`}} 
                    className="w-full h-full" 
                    resizeMode="cover" 
                  />
                </View>
              ))}
            </View>

          </View>
        </View>

        {/* WAVE 3: Collage to Final CTA (Creme to White) */}
        <View className="w-full -mt-[1px] bg-white">
          <Svg viewBox="0 0 1440 320" width="100%" height={width * (120 / 1440)} preserveAspectRatio="none" style={{ backgroundColor: '#F8F3ED' }}>
            <Path fill="#ffffff" fillOpacity="1" d="M0,64L48,80C96,96,192,128,288,128C384,128,480,96,576,90.7C672,85,768,107,864,122.7C960,139,1056,149,1152,133.3C1248,117,1344,75,1392,53.3L1440,32L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
          </Svg>
        </View>

        {/* ================= 4. CTA FINAL ================= */}
        <View className="bg-white px-[20px] py-[80px] items-center">
          <View className="w-full max-w-[600px] items-center">
            <Text className="font-title text-[#1B4332] text-[35px] text-center mb-[20px]">
              Encontre o acolhimento que você merece
            </Text>
            <Text className="font-sans text-[#666] text-[18px] text-center mb-[30px] leading-[28px]">
              Nossa inteligência artificial conectará você aos profissionais mais compatíveis com o seu momento.
            </Text>
            
            <TouchableOpacity 
              onPress={() => router.push('/questionario')}
              className="bg-[#1B4332] rounded-[50px] py-[15px] px-[40px] items-center shadow-[0_4px_15px_rgba(27,67,50,0.2)]"
            >
              <Text className="font-sans font-bold text-[18px] text-white">Começar meu Match</Text>
            </TouchableOpacity>

            <View className="mt-[60px] pt-[30px] border-t border-dashed border-[#eee] w-full items-center">
              <Text className="text-[#888] font-sans text-[15px] mb-[15px] text-center">
                É um(a) colega Psi e quer fazer a diferença com a gente?
              </Text>
              <TouchableOpacity onPress={() => router.push('/psi_questionario')}>
                <View className="border-b-[2px] border-[#FFEE8C] pb-[2px]">
                  <Text className="text-[#1B4332] font-bold font-sans text-[16px]">Cadastrar como Profissional</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <Footer />
      </YeloScrollView>
      <PublicBottomNav />
      </SafeAreaView>
    </View>
  );
}
