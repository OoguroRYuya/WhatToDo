import { forwardRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { control, fonts, radius, space, text } from '@/theme/tokens';

type Props = TextInputProps & {
  label: string;
  error?: string | null;
  hint?: string;
  mono?: boolean;
};

/** A labelled input. The border width never changes; focus is a colour change plus an outer ring. */
export const TextField = forwardRef<TextInputInstance, Props>(function TextField(
  { label, error, hint, mono, multiline, style, onFocus, onBlur, ...rest },
  ref,
) {
  const { p } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: p.ink2 }]} nativeID={`${label}-label`}>
        {label}
      </Text>
      <View
        style={[
          styles.ring,
          { borderColor: focused ? p.focus : 'transparent' },
        ]}
      >
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityLabelledBy={`${label}-label`}
          placeholderTextColor={p.muted}
          selectionColor={p.accent}
          cursorColor={p.accent}
          multiline={multiline}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          style={[
            styles.input,
            {
              color: p.ink,
              backgroundColor: p.surface,
              borderColor: error ? p.ink : focused ? p.focus : p.muted,
              fontFamily: mono ? fonts.mono : fonts.body,
            },
            multiline && styles.multiline,
            style,
          ]}
          {...rest}
        />
      </View>
      {/* Reserved line, so an error appearing never shifts the form. */}
      <Text
        style={[styles.helper, { color: error ? p.ink : p.muted }]}
        accessibilityLiveRegion={error ? 'polite' : 'none'}
      >
        {error ?? hint ?? ' '}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: space['2xs'] },
  label: { fontFamily: fonts.bodyMedium, fontSize: text.sm },
  ring: { borderWidth: 2, borderRadius: radius.input + 3, margin: -3 },
  input: {
    minHeight: control.height,
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontSize: text.md,
  },
  multiline: { minHeight: 200, textAlignVertical: 'top', lineHeight: 24 },
  helper: { fontFamily: fonts.body, fontSize: text.sm, minHeight: 20 },
});
