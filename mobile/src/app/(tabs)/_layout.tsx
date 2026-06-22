import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Text } from 'react-native';
import { Platform, View, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Path, Polyline, Line, Circle } from 'react-native-svg';
import MobileHeader from '../../components/MobileHeader';

const ICON_SIZE = 20;

const HomeIcon = ({ color, focused }: { color: string, focused: boolean }) => (
  <View style={focused ? { transform: [{ translateY: -2 }] } : {}}>
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <Polyline points="9 22 9 12 15 12 15 22" />
    </Svg>
  </View>
);

const ClinicaIcon = ({ color, focused }: { color: string, focused: boolean }) => (
  <View style={focused ? { transform: [{ translateY: -2 }] } : {}}>
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <Path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <Path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
      <Path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
    </Svg>
  </View>
);

const EvolucaoIcon = ({ color, focused }: { color: string, focused: boolean }) => (
  <View style={focused ? { transform: [{ translateY: -2 }] } : {}}>
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 20V10" />
      <Path d="M18 20V4" />
      <Path d="M6 20v-4" />
    </Svg>
  </View>
);

const AjustesIcon = ({ color, focused }: { color: string, focused: boolean }) => (
  <View style={focused ? { transform: [{ translateY: -2 }] } : {}}>
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="3" />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  </View>
);

const SairIcon = ({ color, focused }: { color: string, focused: boolean }) => (
  <View style={focused ? { transform: [{ translateY: -2 }] } : {}}>
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <Polyline points="16 17 21 12 16 7" />
      <Line x1="21" y1="12" x2="9" y2="12" />
    </Svg>
  </View>
);

export default function TabLayout() {
  const { signOut } = useAuth();
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        header: () => <MobileHeader />,
        headerShown: true,
        tabBarActiveTintColor: '#1B4332',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          position: 'absolute',
          bottom: Platform.OS === 'ios' ? 24 : 20,

          /* =======================================
             AJUSTE MANUAL DO RESPIRO LATERAL
             ======================================= 
             O React Navigation ignora 'left' e 'right' manualmente.
             Para controlar o espaço (respiro) nas laterais, use o marginHorizontal.
             Se aumentar para 40, a barra encolhe e fica com 40px de distância de cada lado.
          */
          marginHorizontal: 20,

          backgroundColor: 'transparent',
          borderRadius: 50,
          elevation: 10,
          shadowColor: '#000',
          shadowOpacity: 0.15,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 10 },
          borderTopWidth: 0,
          height: 64,
          paddingBottom: 4,
          paddingTop: 4,
        },
        tabBarBackground: () => (
          <View style={{ flex: 1, borderRadius: 50, overflow: 'hidden' }}>
            <BlurView intensity={80} tint="light" style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.85)' }} />
          </View>
        ),
        tabBarActiveBackgroundColor: '#f0fdf4',
        tabBarItemStyle: {
          borderRadius: 20,
          margin: 4,
          paddingVertical: 4,
          overflow: 'hidden',
        },
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '600',
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, focused }) => <HomeIcon color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="clinica"
        options={{
          title: 'Clínica',
          tabBarIcon: ({ color, focused }) => <ClinicaIcon color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="evolucao"
        options={{
          title: 'Evolução',
          tabBarIcon: ({ color, focused }) => <EvolucaoIcon color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color, focused }) => <AjustesIcon color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="sair"
        options={{
          title: 'Sair',
          tabBarIcon: ({ focused }) => <SairIcon color="#ef4444" focused={focused} />,
          tabBarLabel: () => <Text style={{ fontSize: 9, fontWeight: '600', color: '#ef4444', marginTop: -2 }}>Sair</Text>,
        }}
        listeners={() => ({
          tabPress: (e) => {
            e.preventDefault(); // Impede a navegação para uma tela "sair"
            signOut();
            router.replace('/login');
          },
        })}
      />
      <Tabs.Screen
        name="pacientes"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="financeiro"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="favoritos-analytics"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="calculadora"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="manual-conversao"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen name="jornada" options={{ href: null }} />
      <Tabs.Screen name="blog" options={{ href: null }} />
      <Tabs.Screen name="forum" options={{ href: null }} />
      <Tabs.Screen name="comunidade" options={{ href: null }} />
      <Tabs.Screen name="comunidade_yelo" options={{ href: null }} />
      <Tabs.Screen name="meu_perfil" options={{ href: null }} />
      <Tabs.Screen name="assinatura" options={{ href: null }} />
      <Tabs.Screen name="fale_com_a_yelo" options={{ href: null }} />
    </Tabs>
  );
}
