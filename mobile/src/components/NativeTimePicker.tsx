import React, { createElement } from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { NativeTimePickerProps } from './NativeTimePicker.shared';

export {
  dateToTimeString,
  timeStringToDate,
  type NativeTimePickerProps,
} from './NativeTimePicker.shared';

/**
 * Fallback Web: usa `<input type="time">` nativo do navegador sobreposto à pílula Yelo.
 * No iOS (`NativeTimePicker.ios.tsx`) usa `SwiftUI.DatePicker` (`.compact` popover nativo).
 * No Android (`NativeTimePicker.android.tsx`) usa `TimePickerDialog` Material 3 nativo.
 */
export default function NativeTimePicker({
  time,
  onChangeTime,
  durationBadgeLabel,
  style,
}: NativeTimePickerProps) {
  return (
    <View style={[{ position: 'relative', width: '100%' }, style]}>
      <View
        style={{
          backgroundColor: '#f9fafb',
          borderWidth: 1,
          borderColor: '#ced4da',
          borderRadius: 999,
          paddingHorizontal: 18,
          paddingVertical: 11,
          minHeight: 48,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Feather name="clock" size={16} color="#1B4332" style={{ marginRight: 8 }} />
          <Text
            className="font-sans"
            style={{ fontSize: 16, fontWeight: '700', color: '#1B4332' }}
          >
            {time}
          </Text>
          {durationBadgeLabel ? (
            <View
              style={{
                marginLeft: 10,
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderRadius: 999,
                backgroundColor: '#e8f5e9',
              }}
            >
              <Text
                className="font-sans"
                style={{ fontSize: 11, fontWeight: '600', color: '#1B4332' }}
              >
                {durationBadgeLabel}
              </Text>
            </View>
          ) : null}
        </View>
        <Feather name="chevron-down" size={18} color="#1B4332" />
      </View>

      {createElement('input', {
        type: 'time',
        value: time,
        onChange: (e: any) => {
          const val = e?.target?.value;
          if (val && /^\d{2}:\d{2}/.test(val)) {
            onChangeTime(val.slice(0, 5));
          }
        },
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
          zIndex: 10,
        },
      })}
    </View>
  );
}
