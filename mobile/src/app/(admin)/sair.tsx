import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';

export default function AdminSairScreen() {
  const { signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    signOut().then(() => {
      router.replace('/login');
    });
  }, []);

  return <View className="flex-1 bg-[#f8f9fa]" />;
}

