import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme/useTheme';
import { fonts, space, text } from '@/theme/tokens';
import type { NoteListItem, Todo } from '@/lib/db';
import { dueLabel, isOverdue, stampTime } from '@/lib/time';
import { Checkbox } from './Checkbox';

/** Rows are memoised: FlatList only re-renders the row whose data changed. */

export const TodoRow = memo(function TodoRow({
  item,
  onToggle,
  onOpen,
}: {
  item: Todo;
  onToggle: (item: Todo) => void;
  onOpen: (id: string) => void;
}) {
  const { p } = useTheme();
  const done = item.is_completed === 1;
  const due = dueLabel(item.due_date);
  const late = isOverdue(item.due_date, done);

  return (
    <View style={[styles.row, { borderBottomColor: p.rule }]}>
      <Checkbox checked={done} onToggle={() => onToggle(item)} label={`Mark "${item.title}" ${done ? 'not done' : 'done'}`} />
      <Pressable
        style={styles.body}
        onPress={() => onOpen(item.id)}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}${due ? `, due ${due}` : ''}${late ? ', overdue' : ''}${item.is_synced ? '' : ', not backed up'}`}
        accessibilityHint="Opens the to-do to edit"
      >
        <Text
          style={[styles.title, { color: done ? p.muted : p.ink, textDecorationLine: done ? 'line-through' : 'none' }]}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        {(due || !item.is_synced) && (
          <View style={styles.meta}>
            {due && (
              <Text style={[styles.mono, { color: late ? p.ink : p.muted, fontFamily: late ? fonts.monoMedium : fonts.mono }]}>
                {late ? `Overdue, ${due}` : due}
              </Text>
            )}
            {!item.is_synced && <Feather name="upload-cloud" size={14} color={p.muted} accessibilityElementsHidden />}
          </View>
        )}
      </Pressable>
    </View>
  );
});

export const NoteRow = memo(function NoteRow({ item, onOpen }: { item: NoteListItem; onOpen: (id: string) => void }) {
  const { p } = useTheme();
  const locked = item.is_encrypted === 1;

  return (
    <Pressable
      onPress={() => onOpen(item.id)}
      style={({ pressed }) => [styles.row, styles.noteRow, { borderBottomColor: p.rule, opacity: pressed ? 0.7 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}${locked ? ', locked' : ''}${item.is_synced ? '' : ', not backed up'}`}
      accessibilityHint={locked ? 'Asks for your PIN, then opens the note' : 'Opens the note'}
    >
      <View style={styles.noteHead}>
        {locked && <Feather name="lock" size={16} color={p.accent} />}
        <Text style={[styles.title, { color: p.ink, flex: 1 }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.mono, { color: p.muted }]}>{stampTime(item.updated_at)}</Text>
      </View>
      <Text style={[styles.preview, { color: p.muted }]} numberOfLines={2}>
        {locked ? 'Locked with your PIN' : item.preview || 'No text yet'}
      </Text>
      {!item.is_synced && (
        <View style={styles.meta}>
          <Feather name="upload-cloud" size={14} color={p.muted} />
          <Text style={[styles.small, { color: p.muted }]}>Not backed up</Text>
        </View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  body: { flex: 1, minHeight: 44, justifyContent: 'center', gap: space['3xs'], paddingRight: space.xs },
  title: { fontFamily: fonts.bodyMedium, fontSize: text.md, lineHeight: 22 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  mono: { fontFamily: fonts.mono, fontSize: text.sm, fontVariant: ['tabular-nums'] },
  noteRow: { flexDirection: 'column', alignItems: 'stretch', gap: space['2xs'], paddingVertical: space.md },
  noteHead: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  preview: { fontFamily: fonts.body, fontSize: text.sm, lineHeight: 20 },
  small: { fontFamily: fonts.body, fontSize: text.sm },
});
