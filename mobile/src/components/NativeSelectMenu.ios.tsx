import React from 'react';
import { Keyboard } from 'react-native';
import { Host, Menu, RNHostView, Button } from '@expo/ui/swift-ui';
import { menuOrder } from '@expo/ui/swift-ui/modifiers';
import type { NativeSelectMenuProps } from './NativeSelectMenu';

export type { NativeSelectOption, NativeSelectMenuProps } from './NativeSelectMenu';

/**
 * iOS Nativo: renderiza o componente real `SwiftUI.Menu` (`UIMenu`) do sistema operacional.
 * Utiliza botões com ícone 'checkmark' do SF Symbols para indicar seleção ativa,
 * garantindo disparos de clique apenas por ação direta do usuário (sem loops de Toggle).
 */
export default function NativeSelectMenu({
  options,
  selectedValue,
  onSelect,
  style,
  children,
}: NativeSelectMenuProps) {
  const trigger = (
    <RNHostView matchContents boundedByHost>
      <>{children}</>
    </RNHostView>
  );

  return (
    <Host style={style} ignoreSafeArea="all">
      <Menu label={trigger} modifiers={[menuOrder('fixed')]}>
        {options.map((opt, idx) => {
          const isSelected = String(opt.value) === String(selectedValue);
          return (
            <Button
              key={opt.value !== '' ? opt.value : `__empty_${idx}__`}
              label={opt.label}
              systemImage={isSelected ? 'checkmark' : undefined}
              onPress={() => {
                Keyboard.dismiss();
                if (String(opt.value) !== String(selectedValue)) {
                  onSelect(opt.value);
                }
              }}
            />
          );
        })}
      </Menu>
    </Host>
  );
}
