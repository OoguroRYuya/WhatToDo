import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme/useTheme';
import { control, fonts, radius, space, text } from '@/theme/tokens';

type Variant = 'primary' | 'secondary' | 'quiet';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: keyof typeof Feather.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Dose's moulded control: a 3px rim below that the button sinks into on press.
 * One primary per screen; secondaries are clear plastic; quiet is typographic.
 */
export function Button({ label, onPress, variant = 'primary', icon, loading, disabled, accessibilityHint, style }: Props) {
  const { p } = useTheme();
  const inactive = disabled || loading;
  // Keyboard / D-pad focus ring: React Native has no :focus-visible, so it is drawn by hand.
  const [focused, setFocused] = useState(false);

  const face =
    variant === 'primary'
      ? { backgroundColor: p.accent, borderColor: p.accentDeep, rim: p.accentDeep, fg: p.accentInk }
      : variant === 'secondary'
        ? { backgroundColor: p.surface, borderColor: p.rule, rim: p.rule, fg: p.ink }
        : { backgroundColor: 'transparent', borderColor: 'transparent', rim: 'transparent', fg: p.accent };

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      hitSlop={6}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.ring, { borderColor: focused ? p.focus : 'transparent' }, style]}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.base,
            {
              backgroundColor: face.backgroundColor,
              borderColor: face.borderColor,
              borderBottomColor: face.rim,
              borderBottomWidth: variant === 'quiet' ? 0 : pressed ? 1 : 3,
              transform: [{ translateY: pressed && variant !== 'quiet' ? 2 : 0 }],
              opacity: inactive && !loading ? 0.55 : pressed && variant === 'quiet' ? 0.6 : 1,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={face.fg} />
          ) : (
            <>
              {icon && <Feather name={icon} size={18} color={face.fg} />}
              <Text style={[styles.label, { color: face.fg }]}>{label}</Text>
            </>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ring: { borderWidth: 2, borderRadius: radius.input + 4, padding: 2, margin: -4 },
  base: {
    minHeight: control.height,
    paddingHorizontal: space.lg,
    borderRadius: radius.input,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
  label: { fontFamily: fonts.bodyMedium, fontSize: text.md },
});
