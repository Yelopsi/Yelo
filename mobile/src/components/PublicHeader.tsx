import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

interface PublicHeaderProps {
  isScrolled?: boolean;
  alwaysLight?: boolean;
}

export default function PublicHeader({ isScrolled = false, alwaysLight = false }: PublicHeaderProps) {
  const router = useRouter();
  
  const isLight = alwaysLight || isScrolled;
  const bgColor = isLight ? 'bg-white' : 'bg-[#1B4332]';
  const textColor = isLight ? 'text-[#333]' : 'text-white';
  const logoSource = isLight 
    ? require('../../assets/images/logo-escura.png')
    : require('../../assets/images/logo-branca.png');

  return (
    <>
      <StatusBar style={isLight ? "dark" : "light"} backgroundColor="transparent" translucent={true} />
      <View style={{ overflow: 'hidden', paddingBottom: 30, marginBottom: -30, zIndex: 50 }}>
        <View 
          className={`${bgColor} pb-2 pt-2`} 
          style={isScrolled ? {
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            elevation: 5
          } : {}}
        >
          <View className="px-5 py-4 flex-row justify-between items-center">
          {/* Logo Yelo */}
          <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/')}>
            <Image
              source={logoSource}
              style={{ width: 80, height: 32 }}
              resizeMode="contain"
            />
          </TouchableOpacity>

          {/* Links da Direita */}
          <View className="flex-row items-center">
            <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/sobre_psis')} className="mr-4">
              <Text className={`font-sans font-medium ${textColor} text-[13px]`}>Sobre</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/faq')} className="mr-4">
              <Text className={`font-sans font-medium ${textColor} text-[13px]`}>FAQ</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/blog')}>
              <Text className={`font-sans font-medium ${textColor} text-[13px]`}>Blog</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      </View>
    </>
  );
}
