import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';

export default function PacienteLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const HeaderLeft = () => (
    <View className="flex-row items-center ml-[20px] gap-2.5">
      {user?.fotoUrl ? (
        <Image 
          source={{ uri: user.fotoUrl }} 
          className="w-[36px] h-[36px] rounded-full border-2 border-[#1B4332]" 
        />
      ) : (
        <View className="w-[36px] h-[36px] rounded-full bg-[#1B4332] items-center justify-center">
          <Text className="font-bold text-[#FFEE8C] text-[15px]">
            {user?.nome ? user.nome.charAt(0).toUpperCase() : 'P'}
          </Text>
        </View>
      )}
      <View className="bg-[#e8f5e9] border border-[#c8e6c9] px-[10px] py-[3px] rounded-[50px]">
        <Text className="text-[#1B4332] font-sans font-bold text-[12px]">👤 Paciente</Text>
      </View>
    </View>
  );

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: '#ffffff',
          height: 60 + insets.top,
        },
        headerShadowVisible: false,
        headerTitle: "",
        headerLeft: () => <HeaderLeft />,
        headerRight: () => null,
      }}
      tabBar={(props: any) => {
        const { state, descriptors, navigation } = props;
        return (
          <View 
            className="absolute bottom-8 left-5 right-5 bg-white/95 rounded-[50px] shadow-[0_10px_30px_rgba(0,0,0,0.12)] flex-row justify-between items-center px-2 py-2 border border-[#f0f0f0]" 
            style={{ elevation: 5 }}
          >
            {state.routes.map((route: any, index: number) => {
              const { options } = descriptors[route.key];
              const label = options.title !== undefined ? options.title : route.name;
              const isFocused = state.index === index;

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              };

              let iconName = "home";
              if (route.name === "conexoes") iconName = "users";
              if (route.name === "ajustes") iconName = "settings";

              return (
                <TouchableOpacity
                  key={route.key}
                  activeOpacity={0.7}
                  onPress={onPress}
                  className={`items-center justify-center flex-1 py-1.5 rounded-[20px] ${isFocused ? 'bg-[#f0fdf4]' : ''}`}
                >
                  <Feather name={iconName as any} size={20} color={isFocused ? "#1B4332" : "#999"} />
                  <Text className={`font-sans font-${isFocused ? 'bold' : 'medium'} text-[10px] mt-0.5 ${isFocused ? 'text-[#1B4332]' : 'text-[#888]'}`}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="conexoes"
        options={{
          title: 'Conexões',
          tabBarIcon: ({ color }) => <Feather name="users" size={22} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color }) => <Feather name="settings" size={22} color={color as string} />,
        }}
      />
    </Tabs>
  );
}
