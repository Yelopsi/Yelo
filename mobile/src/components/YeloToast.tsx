import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, Platform, View } from 'react-native';

export type ToastType = 'success' | 'error' | 'info';

interface YeloToastProps {
  message: string | null;
  onDismiss?: () => void;
  type?: ToastType;
  bottomOffset?: number;
  duration?: number;
}

/**
 * Notificação em formato de pílula (estilo WhatsApp / Web Mobile Yelo).
 * Surge deslizando de baixo para cima e se recolhe suavemente.
 */
export default function YeloToast({
  message,
  onDismiss,
  type = 'success',
  bottomOffset = Platform.OS === 'ios' ? 104 : 96,
  duration = 3200,
}: YeloToastProps) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (message) {
      anim.setValue(0);
      // Desliza de baixo para cima com amortecimento suave
      Animated.spring(anim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 8,
      }).start();

      const timer = setTimeout(() => {
        // Desliza de volta para baixo antes de sumir
        Animated.timing(anim, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }).start(() => {
          if (onDismiss) onDismiss();
        });
      }, duration);

      return () => clearTimeout(timer);
    } else {
      anim.setValue(0);
    }
  }, [message, duration, anim, onDismiss]);

  if (!message) return null;

  const iconText = type === 'error' ? '❌' : type === 'info' ? 'ℹ️' : '✅';

  return (
    <View pointerEvents="none" style={[styles.outerWrapper, { bottom: bottomOffset }]}>
      <Animated.View
        style={[
          styles.pillNotification,
          {
            opacity: anim.interpolate({
              inputRange: [0, 0.1, 1],
              outputRange: [0, 0.8, 1],
            }),
            transform: [
              {
                translateY: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [70, 0], // Vem de baixo para cima (estilo WhatsApp)
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.icon}>{iconText}</Text>
        <Text style={styles.text}>{message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999999,
  },
  pillNotification: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(27, 67, 50, 0.96)',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 50, // Pílula arredondada
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
    maxWidth: '92%',
  },
  icon: {
    fontSize: 14,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
});

