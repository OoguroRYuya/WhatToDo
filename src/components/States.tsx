import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, View, type DimensionValue } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { fonts, radius, space, text } from '@/theme/tokens';
import { Button } from './Button';

/** A skeleton line, pulsing gently unless the system asks for reduced motion. */
export function SkeletonLine({ width = '100%', height = 14 }: { width?: DimensionValue; height?: number }) {
  const { p } = useTheme();
  const [pulse] = useState(() => new Animated.Value(0.55));
  const [still, setStill] = useState(true);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((r) => setStill(r));
  }, []);

  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [still, pulse]);

  return <Animated.View style={{ width, height, borderRadius: 6, backgroundColor: p.paper3, opacity: pulse }} />;
}

/** Rows in the shape of what is coming. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View accessibilityLabel="Loading" accessibilityRole="progressbar" style={{ gap: space.lg, paddingVertical: space.md }}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
          <SkeletonLine width={26} height={26} />
          <View style={{ flex: 1, gap: space.xs }}>
            <SkeletonLine width={i % 2 ? '70%' : '85%'} />
            <SkeletonLine width="30%" height={10} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function EmptyState({ title, body, action, onAction }: { title: string; body: string; action?: string; onAction?: () => void }) {
  const { p } = useTheme();
  return (
    <View style={[styles.box, { borderColor: p.rule }]}>
      <Text style={[styles.title, { color: p.ink }]}>{title}</Text>
      <Text style={[styles.body, { color: p.muted }]}>{body}</Text>
      {action && onAction && <Button label={action} onPress={onAction} variant="secondary" icon="plus" style={{ alignSelf: 'flex-start' }} />}
    </View>
  );
}

export function ErrorState({ title, body, onRetry }: { title: string; body: string; onRetry?: () => void }) {
  const { p } = useTheme();
  return (
    <View style={[styles.box, { borderColor: p.rule }]} accessibilityLiveRegion="polite">
      <Text style={[styles.title, { color: p.ink }]}>{title}</Text>
      <Text style={[styles.body, { color: p.muted }]}>{body}</Text>
      {onRetry && <Button label="Try again" onPress={onRetry} variant="secondary" icon="refresh-cw" style={{ alignSelf: 'flex-start' }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.card, padding: space.lg, gap: space.sm, marginTop: space.md },
  title: { fontFamily: fonts.bodyMedium, fontSize: text.lg },
  body: { fontFamily: fonts.body, fontSize: text.md, lineHeight: 24 },
});
