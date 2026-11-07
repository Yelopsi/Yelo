import React, { useEffect, useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import {
  Text,
  Platform,
  View,
  Dimensions,
  AppState,
  Modal,
  Pressable,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Path, Polyline, Line, Circle } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import MobileHeader from '../../components/MobileHeader';
import * as Notifications from 'expo-notifications';
import { syncSessionNotifications } from '../../services/sessionNotifications';

const ICON_SIZE = 20;

const HomeIcon = ({ color }: { color: any }) => (
  <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <Polyline points="9 22 9 12 15 12 15 22" />
    </Svg>
  </View>
);

const ClinicaIcon = ({ color }: { color: any }) => (
  <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <Path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <Path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
      <Path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
    </Svg>
  </View>
);

const EvolucaoIcon = ({ color }: { color: any }) => (
  <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 20V10" />
      <Path d="M18 20V4" />
      <Path d="M6 20v-4" />
    </Svg>
  </View>
);

const AjustesIcon = ({ color }: { color: any }) => (
  <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="3" />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  </View>
);

const SairIcon = ({ color }: { color: any }) => (
  <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <Polyline points="16 17 21 12 16 7" />
      <Line x1="21" y1="12" x2="9" y2="12" />
    </Svg>
  </View>
);

const TabLabelWithDot = ({ label, focused, color }: { label: string; focused: boolean; color?: string }) => (
  <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
    <Text
      style={{
        fontSize: 9.5,
        fontWeight: focused ? '700' : '500',
        color: color || (focused ? '#1B4332' : '#9ca3af'),
        textAlign: 'center',
      }}
    >
      {label}
    </Text>
    <View
      style={{
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: color ? (focused ? color : 'transparent') : (focused ? '#1B4332' : 'transparent'),
        marginTop: 2,
      }}
    />
  </View>
);

export default function TabLayout() {
  const { signOut } = useAuth();
  const router = useRouter();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    syncSessionNotifications();

    const subAppState = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        syncSessionNotifications();
      }
    });

    let subNotification: any = null;
    if (Platform.OS !== 'web') {
      subNotification = Notifications.addNotificationResponseReceivedListener(() => {
        try {
          router.navigate('/(tabs)/pacientes');
        } catch {
          // Fallback silencioso
        }
      });
    }

    return () => {
      subAppState.remove();
      if (subNotification && typeof subNotification.remove === 'function') {
        subNotification.remove();
      }
    };
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        backBehavior="history"
        screenOptions={{
          header: () => <MobileHeader />,
          headerShown: true,
          tabBarActiveTintColor: '#1B4332',
          tabBarInactiveTintColor: '#9ca3af',
          tabBarStyle: {
            position: 'absolute',
            bottom: Platform.OS === 'ios' ? 24 : 20,
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
            paddingTop: 0,
            paddingBottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
          },
          tabBarBackground: () => (
            <View style={{ flex: 1, borderRadius: 50, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' }}>
              <BlurView intensity={95} tint="light" style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.96)' }} />
            </View>
          ),
          tabBarActiveBackgroundColor: 'transparent',
          tabBarItemStyle: {
            marginVertical: 4,
            marginHorizontal: 0,
            padding: 0,
            alignItems: 'center',
            justifyContent: 'center',
          },
          tabBarLabelStyle: {
            fontSize: 9.5,
            fontWeight: '600',
            textAlign: 'center',
            marginTop: 2,
            marginBottom: 0,
            padding: 0,
            alignSelf: 'center',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Início',
            tabBarIcon: ({ focused }) => <HomeIcon color={focused ? '#1B4332' : '#9ca3af'} />,
            tabBarLabel: ({ focused }) => <TabLabelWithDot label="Início" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="clinica"
          options={{
            title: 'Clínica',
            tabBarIcon: ({ focused }) => <ClinicaIcon color={focused ? '#1B4332' : '#9ca3af'} />,
            tabBarLabel: ({ focused }) => <TabLabelWithDot label="Clínica" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="evolucao"
          options={{
            title: 'Evolução',
            tabBarIcon: ({ focused }) => <EvolucaoIcon color={focused ? '#1B4332' : '#9ca3af'} />,
            tabBarLabel: ({ focused }) => <TabLabelWithDot label="Evolução" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="ajustes"
          options={{
            title: 'Ajustes',
            tabBarIcon: ({ focused }) => <AjustesIcon color={focused ? '#1B4332' : '#9ca3af'} />,
            tabBarLabel: ({ focused }) => <TabLabelWithDot label="Ajustes" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="sair"
          options={{
            title: 'Sair',
            tabBarIcon: () => <SairIcon color="#ef4444" />,
            tabBarLabel: ({ focused }) => <TabLabelWithDot label="Sair" focused={focused} color="#ef4444" />,
          }}
          listeners={() => ({
            tabPress: (e) => {
              e.preventDefault();
              setShowLogoutModal(true);
            },
          })}
        />
        <Tabs.Screen
          name="pacientes"
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
        <Tabs.Screen
          name="financeiro"
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
        <Tabs.Screen
          name="analytics"
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
        <Tabs.Screen
          name="favoritos-analytics"
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
        <Tabs.Screen
          name="calculadora"
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
        <Tabs.Screen
          name="manual-conversao"
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
        <Tabs.Screen name="jornada" options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
        <Tabs.Screen name="blog" options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
        <Tabs.Screen name="forum" options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
        <Tabs.Screen name="comunidade" options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
        <Tabs.Screen name="comunidade_yelo" options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
        <Tabs.Screen name="historico_contatos" options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
        <Tabs.Screen name="meu_perfil" options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
        <Tabs.Screen name="assinatura" options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
        <Tabs.Screen name="notificacoes" options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
        <Tabs.Screen name="avisos" options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
        <Tabs.Screen name="fale_com_a_yelo" options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
        <Tabs.Screen name="novidades" options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
      </Tabs>

      {/* MODAL DE CONFIRMAÇÃO DE SAIR (ESTILO BOTTOM SHEET DE BAIXO PRA CIMA) */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showLogoutModal}
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowLogoutModal(false)}
          />
          <View
            style={{
              backgroundColor: '#ffffff',
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              paddingTop: 16,
              paddingHorizontal: 24,
              paddingBottom: Platform.OS === 'ios' ? 44 : 28,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.12,
              shadowRadius: 20,
              elevation: 25,
            }}
          >
            {/* Handle Pill Superior */}
            <View
              style={{
                width: 44,
                height: 4,
                backgroundColor: '#e5e7eb',
                borderRadius: 99,
                alignSelf: 'center',
                marginBottom: 20,
              }}
            />

            {/* Cabeçalho do Modal */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  backgroundColor: '#fee2e2',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 14,
                }}
              >
                <Feather name="log-out" size={22} color="#dc2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: 'NewKansas-Bold',
                    fontSize: 20,
                    color: '#1B4332',
                  }}
                >
                  Encerrar Sessão
                </Text>
                <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                  Tem certeza que deseja sair da sua conta?
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowLogoutModal(false)}
                style={{ padding: 6 }}
                activeOpacity={0.7}
              >
                <Feather name="x" size={22} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            {/* Card Informativo */}
            <View
              style={{
                backgroundColor: '#fef2f2',
                borderWidth: 1,
                borderColor: '#fecaca',
                borderRadius: 16,
                padding: 14,
                marginBottom: 22,
              }}
            >
              <Text style={{ fontSize: 13, color: '#991b1b', lineHeight: 19 }}>
                Para acessar seus pacientes e agenda novamente, você precisará informar seu e-mail e senha no próximo login.
              </Text>
            </View>

            {/* Botão Vermelho de Confirmação */}
            <TouchableOpacity
              onPress={async () => {
                setShowLogoutModal(false);
                await signOut();
                router.replace('/login');
              }}
              activeOpacity={0.85}
              style={{
                backgroundColor: '#dc2626',
                borderRadius: 99,
                paddingVertical: 15,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 10,
              }}
            >
              <Text
                style={{
                  color: '#ffffff',
                  fontWeight: '700',
                  fontSize: 15,
                  letterSpacing: 0.2,
                }}
              >
                Sim, Sair da Conta
              </Text>
            </TouchableOpacity>

            {/* Botão Voltar */}
            <TouchableOpacity
              onPress={() => setShowLogoutModal(false)}
              activeOpacity={0.7}
              style={{
                backgroundColor: '#f3f4f6',
                borderRadius: 99,
                paddingVertical: 14,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#4b5563', fontWeight: '600', fontSize: 15 }}>
                Voltar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
