import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme/useTheme';
import { fonts, radius, space, text } from '@/theme/tokens';
import type { QuoteResult } from '@/lib/quotes';
import { SkeletonLine } from './States';

type Props = { state: { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: QuoteResult }; onRetry: () => void };

/** The day's quote on a straw-tinted plastic tray. Four states: loading, error, stale, full. */
export const QuoteCard = memo(function QuoteCard({ state, onRetry }: Props) {
  const { p } = useTheme();

  return (
    <View style={[styles.tray, { backgroundColor: p.trayStraw, borderTopColor: p.surface }]}>
      {state.status === 'loading' && (
        <View style={{ gap: space.xs }} accessibilityLabel="Loading today's quote">
          <SkeletonLine width="95%" />
          <SkeletonLine width="80%" />
          <SkeletonLine width="35%" height={12} />
        </View>
      )}

      {state.status === 'error' && (
        <View style={styles.row}>
          <Text style={[styles.meta, { color: p.ink2, flex: 1 }]}>
            Today’s quote did not load. Your lists work without it.
          </Text>
          <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel="Retry loading the quote" hitSlop={12}>
            <Feather name="refresh-cw" size={18} color={p.ink2} />
          </Pressable>
        </View>
      )}

      {state.status === 'ready' && (
        <View style={{ gap: space.xs }}>
          <Text style={[styles.quote, { color: p.ink }]} accessibilityRole="text">
            {state.data.quote.text}
          </Text>
          <Text style={[styles.meta, { color: p.ink2 }]}>
            {state.data.quote.author}, from {state.data.quote.source}
            {state.data.stale ? ' (saved earlier, offline)' : ''}
          </Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  tray: { borderRadius: radius.card, padding: space.md, borderTopWidth: 1.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  quote: { fontFamily: fonts.body, fontSize: text.md, lineHeight: 24 },
  meta: { fontFamily: fonts.body, fontSize: text.sm },
});
