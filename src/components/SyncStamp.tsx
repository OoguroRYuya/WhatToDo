import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { fonts, space, text } from '@/theme/tokens';
import { stampTime } from '@/lib/time';

/**
 * The signature: a pharmacy-label stamp for the sync state.
 * Synced is a double-ringed green stamp naming the time; anything waiting is the same stamp in
 * grey (Dose never uses red or amber for "not yet").
 */
export function SyncStamp({ unsynced, lastBackup, size = 'sm' }: { unsynced: number; lastBackup: string | null; size?: 'sm' | 'lg' }) {
  const { p } = useTheme();
  const synced = unsynced === 0 && !!lastBackup;
  const colour = synced ? p.accent : p.muted;
  const time = stampTime(lastBackup);

  const line1 = synced ? 'Backed up' : unsynced === 0 ? 'Not backed up yet' : `${unsynced} ${unsynced === 1 ? 'change' : 'changes'} on this phone only`;
  const line2 = synced ? `at ${time}` : time ? `last backup ${time}` : 'never backed up';

  const lg = size === 'lg';
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={synced ? `Synced with the cloud, backed up at ${time}` : `Not synced. ${line1}, ${line2}`}
      style={[styles.outer, { borderColor: colour, transform: [{ rotate: '-2deg' }] }, lg && styles.outerLg]}
    >
      <View style={[styles.inner, { borderColor: colour }, lg && styles.innerLg]}>
        <Text style={[styles.l1, { color: colour }, lg && styles.l1Lg]}>{line1}</Text>
        <Text style={[styles.l2, { color: colour }]}>{line2}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { borderWidth: 1.5, borderRadius: 8, padding: 2, alignSelf: 'flex-start' },
  outerLg: { padding: 3, borderWidth: 2 },
  inner: { borderWidth: 1, borderRadius: 6, paddingHorizontal: space.xs, paddingVertical: 3 },
  innerLg: { paddingHorizontal: space.sm, paddingVertical: space.xs },
  l1: { fontFamily: fonts.monoMedium, fontSize: text.xs, lineHeight: 16 },
  l1Lg: { fontSize: text.md, lineHeight: 22 },
  l2: { fontFamily: fonts.mono, fontSize: text.xs, lineHeight: 16 },
});
