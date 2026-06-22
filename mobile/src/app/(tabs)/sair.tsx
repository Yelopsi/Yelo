import { useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { View } from 'react-native';

export default function SairScreen() {
  const { signOut } = useAuth();
  
  useEffect(() => {
    signOut();
  }, []);
  
  return <View className="flex-1 bg-[#f0f2f5]" />;
}
