import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

export interface NativeSelectOption {
  label: string;
  value: string;
}

export interface NativeSelectMenuProps {
  options: NativeSelectOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  title?: string;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * Fallback Web: utiliza o elemento nativo <select> do navegador/sistema operacional
 * posicionado de forma transparente sobre o gatilho visual.
 */
export default function NativeSelectMenu({
  options,
  selectedValue,
  onSelect,
  style,
  children,
}: NativeSelectMenuProps) {
  return (
    <View style={[{ position: 'relative' }, style]}>
      {children}
      {React.createElement(
        'select',
        {
          value: selectedValue,
          onChange: (e: any) => onSelect(String(e?.target?.value ?? '')),
          style: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            height: '100%',
            opacity: 0,
            cursor: 'pointer',
          },
        },
        options.map((opt, idx) =>
          React.createElement(
            'option',
            {
              key: opt.value !== '' ? opt.value : `__empty_${idx}__`,
              value: opt.value,
            },
            opt.label
          )
        )
      )}
    </View>
  );
}

