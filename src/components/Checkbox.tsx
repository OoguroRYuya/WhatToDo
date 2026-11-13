import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme/useTheme';
import { control } from '@/theme/tokens';

/** A plastic key: mint when checked, per Dose. 26px visual, 44px hit target. */
export function Checkbox({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  const { p } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={[styles.hit, { borderColor: focused ? p.focus : 'transparent' }]}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      hitSlop={4}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.box,
            {
              backgroundColor: checked ? p.accentSoft : p.surface,
              borderColor: checked ? p.accent : p.muted,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            },
          ]}
        >
          {checked && <Feather name="check" size={16} color={p.accentDeep} />}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { width: control.hit, height: control.hit, borderWidth: 2, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
