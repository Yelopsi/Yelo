import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

export default function SosAnsiedade() {
  const router = useRouter();
  const [isBreathing, setIsBreathing] = useState(false);
  const [instruction, setInstruction] = useState('Acalme-se.');
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const cycleLength = 14000;

  const runCycle = () => {
    // 1. Inspire (4s) - scale to 2
    setInstruction('Inspire...');
    Animated.timing(scaleAnim, {
      toValue: 2,
      duration: 4000,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();

    // 2. Segure (4s)
    setTimeout(() => {
      setInstruction('Segure...');
      
      // 3. Expire (6s) - scale to 1
      setTimeout(() => {
        setInstruction('Expire...');
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 6000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }).start();
      }, 4000);
    }, 4000);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isBreathing) {
      runCycle();
      interval = setInterval(runCycle, cycleLength);
    } else {
      scaleAnim.setValue(1);
      setInstruction('Acalme-se.');
    }
    return () => clearInterval(interval);
  }, [isBreathing]);

  return (
    <SafeAreaView className="flex-1 bg-[#1B4332]">
      {/* Header SOS */}
      <View className="flex-row justify-between items-center px-[20px] py-[20px]">
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-white/70 font-sans font-semibold text-[15px]">&larr; Fechar</Text>
        </TouchableOpacity>
      </View>

      {/* Main Area */}
      <View className="flex-1 justify-center items-center relative">
        <View className="relative justify-center items-center w-[300px] h-[300px]">
          {/* Base Circle */}
          <View className="absolute w-[150px] h-[150px] rounded-full border-2 border-white/30 border-dashed" />
          
          {/* Animated Circle */}
          <Animated.View 
            style={{ transform: [{ scale: scaleAnim }] }}
            className="absolute w-[150px] h-[150px] rounded-full bg-[#FFEE8C] opacity-80"
          />
          
          {/* Instruction Text */}
          <Text className="absolute z-10 font-title text-[#1B4332] text-[28px] text-center font-bold">
            {instruction}
          </Text>
        </View>

        {/* Controls */}
        <View className="mt-[60px] z-10">
          {!isBreathing ? (
            <TouchableOpacity 
              onPress={() => setIsBreathing(true)}
              className="bg-white px-[40px] py-[15px] rounded-[50px] shadow-[0_10px_30px_rgba(0,0,0,0.2)]"
            >
              <Text className="font-sans text-[#1B4332] font-bold text-[18px]">Começar a respirar</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              onPress={() => setIsBreathing(false)}
              className="bg-white/20 px-[30px] py-[12px] rounded-[50px]"
            >
              <Text className="font-sans text-white font-semibold text-[16px]">Parar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Footer */}
      <View className="p-[30px] items-center bg-black/20">
        <Text className="text-white/80 font-sans text-[15px] text-center">
          Quando estiver melhor, cuide da causa raiz. 
          <Text onPress={() => router.replace('/')} className="text-[#FFEE8C] font-bold"> Fazer Match com Psicólogo</Text>
        </Text>
      </View>
    </SafeAreaView>
  );
}
