import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { control, fonts, radius, space, text } from '@/theme/tokens';

type Option<T extends string> = { value: T; label: string; count?: number };

/** A standard tab strip (accessibilityRole tablist), the selection in green. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { p } = useTheme();
  return (
    <View accessibilityRole="tablist" style={[styles.track, { backgroundColor: p.paper3 }]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={o.count === undefined ? o.label : `${o.label}, ${o.count}`}
            onPress={() => onChange(o.value)}
            style={[styles.tab, selected && { backgroundColor: p.surface, borderColor: p.rule }]}
          >
            <Text style={[styles.label, { color: selected ? p.ink : p.muted }]}>{o.label}</Text>
            {o.count !== undefined && (
              <Text style={[styles.count, { color: selected ? p.accent : p.muted }]}>{o.count}</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: radius.input + 2, padding: 3 },
  tab: {
    flex: 1,
    minHeight: control.hit,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
  label: { fontFamily: fonts.bodyMedium, fontSize: text.md },
  count: { fontFamily: fonts.mono, fontSize: text.sm, fontVariant: ['tabular-nums'] },
});
