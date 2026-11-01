import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';

interface MouseScrollIndicatorProps {
  dark?: boolean;
}

export default function MouseScrollIndicator({ dark = true }: MouseScrollIndicatorProps) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 12],
  });

  const opacity = anim.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [1, 0.6, 0],
  });

  const borderColor = dark ? 'rgba(27, 67, 50, 0.4)' : 'rgba(255, 255, 255, 0.6)';
  const wheelColor = dark ? '#1B4332' : '#ffffff';

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 10, opacity: 0.6 }}>
      <View
        style={{
          width: 26,
          height: 42,
          borderRadius: 20,
          borderWidth: 2,
          borderColor,
          alignItems: 'center',
          paddingTop: 8,
          position: 'relative',
        }}
      >
        <Animated.View
          style={{
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: wheelColor,
            transform: [{ translateY }],
            opacity,
          }}
        />
      </View>
    </View>
  );
}
