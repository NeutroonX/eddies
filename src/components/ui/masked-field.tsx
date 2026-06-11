import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { MonoLabel } from '@/components/ui/mono-label';
import { EddiesColors, EddiesFonts, EddiesSpacing } from '@/constants/theme';

interface MaskedFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'phone-pad';
  maxLength?: number;
}

export function MaskedField({ label, value, onChangeText, placeholder, keyboardType, maxLength }: MaskedFieldProps) {
  const [revealed, setRevealed] = useState(false);

  return (
    <View style={s.container}>
      <MonoLabel size={9} letterSpacing={1.2} color={EddiesColors.steel}>{label}</MonoLabel>
      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={EddiesColors.steel + '44'}
          keyboardType={keyboardType}
          maxLength={maxLength}
          secureTextEntry={!revealed}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable 
          onPress={() => setRevealed(!revealed)} 
          style={s.toggle}
          hitSlop={12}
        >
          <MonoLabel size={8} weight="bold" color={revealed ? EddiesColors.alert : EddiesColors.steel + 'AA'}>
            {revealed ? 'HIDE' : 'SHOW'}
          </MonoLabel>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    marginTop: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: EddiesColors.steel + '22',
    paddingRight: 4,
  },
  input: {
    flex: 1,
    fontFamily: EddiesFonts.mono,
    fontSize: 13,
    color: EddiesColors.bone,
    paddingVertical: 6,
  },
  toggle: {
    paddingLeft: 8,
  },
});
