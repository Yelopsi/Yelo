import React from 'react';
import { TouchableOpacity, ActionSheetIOS, Keyboard, type StyleProp, type ViewStyle } from 'react-native';
import type { NativeSelectMenuProps } from './NativeSelectMenu';

export type { NativeSelectOption, NativeSelectMenuProps } from './NativeSelectMenu';

/**
 * iOS Nativo: utiliza o ActionSheetIOS oficial do UIKit da Apple.
 * Totalmente imune a recursões de layout no Yoga/SwiftUI, ágil,
 * acessível e seguindo a interface padrão do iOS.
 */
export default function NativeSelectMenu({
  options,
  selectedValue,
  onSelect,
  title,
  style,
  children,
}: NativeSelectMenuProps) {
  const handlePress = () => {
    Keyboard.dismiss();
    const optionLabels = options.map((opt) => opt.label);
    const cancelButtonIndex = optionLabels.length;

    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: title || undefined,
        options: [...optionLabels, 'Cancelar'],
        cancelButtonIndex,
      },
      (buttonIndex) => {
        if (
          buttonIndex !== cancelButtonIndex &&
          buttonIndex >= 0 &&
          buttonIndex < options.length
        ) {
          const selected = options[buttonIndex];
          if (selected && String(selected.value) !== String(selectedValue)) {
            onSelect(selected.value);
          }
        }
      }
    );
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={handlePress}
      style={style as StyleProp<ViewStyle>}
    >
      {children}
    </TouchableOpacity>
  );
}
