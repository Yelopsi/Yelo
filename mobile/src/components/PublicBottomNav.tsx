import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter, Link, usePathname } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

export default function PublicBottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View className="absolute bottom-8 left-5 right-5 bg-white/95 rounded-[50px] shadow-[0_10px_30px_rgba(0,0,0,0.15)] flex-row justify-between items-center px-4 py-2" style={{ elevation: 5 }}>
      
      {/* Início */}
      <TouchableOpacity onPress={() => router.push('/')} className={`items-center justify-center flex-1 py-1.5 rounded-[20px] ${pathname === '/' ? 'bg-[#f0fdf4]' : ''}`}>
        <Svg viewBox="0 0 24 24" fill={pathname === '/' ? "rgba(27,67,50,0.1)" : "none"} stroke={pathname === '/' ? "#1B4332" : "#999"} strokeWidth={1.5} width={24} height={24}>
          <Path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </Svg>
        <Text className={`font-sans font-${pathname === '/' ? 'semibold' : 'medium'} text-[${pathname === '/' ? '#1B4332' : '#999'}] text-[10px] mt-0.5`}>Início</Text>
      </TouchableOpacity>

      {/* Pergunte */}
      <Link href="/perguntas" asChild>
        <TouchableOpacity className={`items-center justify-center flex-1 py-1.5 rounded-[20px] ${pathname === '/perguntas' ? 'bg-[#f0fdf4]' : ''}`}>
          <Svg viewBox="0 0 24 24" fill={pathname === '/perguntas' ? "rgba(27,67,50,0.1)" : "none"} stroke={pathname === '/perguntas' ? "#1B4332" : "#999"} strokeWidth={1.5} width={24} height={24}>
            <Path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
          </Svg>
          <Text className={`font-sans font-${pathname === '/perguntas' ? 'semibold' : 'medium'} text-[${pathname === '/perguntas' ? '#1B4332' : '#999'}] text-[10px] mt-0.5`}>Pergunte</Text>
        </TouchableOpacity>
      </Link>

      {/* Começar */}
      <Link href="/psi_questionario" asChild>
        <TouchableOpacity className={`items-center justify-center flex-1 py-1.5 rounded-[20px] ${pathname === '/psi_questionario' ? 'bg-[#f0fdf4]' : ''}`}>
          <Svg viewBox="0 0 24 24" fill={pathname === '/psi_questionario' ? "rgba(27,67,50,0.1)" : "none"} stroke={pathname === '/psi_questionario' ? "#1B4332" : "#999"} strokeWidth={1.5} width={24} height={24}>
            <Path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            <Path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
          </Svg>
          <Text className={`font-sans font-${pathname === '/psi_questionario' ? 'semibold' : 'medium'} text-[${pathname === '/psi_questionario' ? '#1B4332' : '#999'}] text-[10px] mt-0.5`}>Começar</Text>
        </TouchableOpacity>
      </Link>

      {/* Nossos Psis */}
      <TouchableOpacity className={`items-center justify-center flex-1 py-1.5 rounded-[20px] ${pathname === '/psis' ? 'bg-[#f0fdf4]' : ''}`}>
        <Svg viewBox="0 0 24 24" fill={pathname === '/psis' ? "rgba(27,67,50,0.1)" : "none"} stroke={pathname === '/psis' ? "#1B4332" : "#999"} strokeWidth={1.5} width={24} height={24}>
          <Path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </Svg>
        <Text className={`font-sans font-${pathname === '/psis' ? 'semibold' : 'medium'} text-[${pathname === '/psis' ? '#1B4332' : '#999'}] text-[10px] mt-0.5`}>Nossos Psis</Text>
      </TouchableOpacity>

      {/* Entrar */}
      <TouchableOpacity onPress={() => router.push('/login')} className={`items-center justify-center flex-1 py-1.5 rounded-[20px] ${pathname === '/login' ? 'bg-[#f0fdf4]' : ''}`}>
        <Svg viewBox="0 0 24 24" fill={pathname === '/login' ? "rgba(27,67,50,0.1)" : "none"} stroke={pathname === '/login' ? "#1B4332" : "#999"} strokeWidth={1.5} width={24} height={24}>
          <Path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </Svg>
        <Text className={`font-sans font-${pathname === '/login' ? 'semibold' : 'medium'} text-[${pathname === '/login' ? '#1B4332' : '#999'}] text-[10px] mt-0.5`}>Entrar</Text>
      </TouchableOpacity>

    </View>
  );
}
