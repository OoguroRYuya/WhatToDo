import { useCallback, useEffect, useState } from 'react';
import { FlatList, Platform, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useUid } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  getMeta,
  getSummary,
  listNotes,
  listTodos,
  setTodoCompleted,
  type NoteListItem,
  type Summary,
  type Todo,
} from '@/lib/db';
import { getDailyQuote, type QuoteResult } from '@/lib/quotes';
import { localDate } from '@/lib/time';
import { QuoteCard } from '@/components/QuoteCard';
import { Segmented } from '@/components/Segmented';
import { SyncStamp } from '@/components/SyncStamp';
import { NoteRow, TodoRow } from '@/components/Rows';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/States';
import { Button } from '@/components/Button';
import { useTheme } from '@/theme/useTheme';
import { fonts, space, text, tracking } from '@/theme/tokens';

type Tab = 'todos' | 'notes';
type Load = 'loading' | 'error' | 'ready';
type QuoteState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: QuoteResult };

const EMPTY: Summary = { open: 0, dueToday: 0, done: 0, notes: 0, unsynced: 0 };

export default function HomeScreen() {
  const db = useSQLiteContext();
  const uid = useUid();
  const toast = useToast();
  const { p } = useTheme();

  // The selected tab lives in the route params, so it survives navigation and deep links.
  const params = useLocalSearchParams<{ tab?: string }>();
  const tab: Tab = params.tab === 'notes' ? 'notes' : 'todos';
  const setTab = (t: Tab) => router.setParams({ tab: t });

  const [todos, setTodos] = useState<Todo[]>([]);
  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [summary, setSummary] = useState<Summary>(EMPTY);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [load, setLoad] = useState<Load>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [quote, setQuote] = useState<QuoteState>({ status: 'loading' });

  const reload = useCallback(async () => {
    try {
      const [t, n, s, b] = await Promise.all([
        listTodos(db, uid),
        listNotes(db, uid),
        getSummary(db, uid, localDate()),
        getMeta(db, `last_backup.${uid}`),
      ]);
      setTodos(t);
      setNotes(n);
      setSummary(s);
      setLastBackup(b);
      setLoad('ready');
    } catch (e) {
      console.warn('[home] load failed', e);
      setLoad('error');
    }
  }, [db, uid]);

  const loadQuote = useCallback(
    () =>
      getDailyQuote(db).then(
        (data) => setQuote({ status: 'ready', data }),
        () => setQuote({ status: 'error' }),
      ),
    [db],
  );

  // Lists reload every time the screen regains focus (e.g. back from the editor).
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  // The quote loads once; getDailyQuote serves it from cache for the rest of the day.
  useEffect(() => {
    let live = true;
    getDailyQuote(db).then(
      (data) => live && setQuote({ status: 'ready', data }),
      () => live && setQuote({ status: 'error' }),
    );
    return () => { live = false; };
  }, [db]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([reload(), quote.status === 'error' ? (setQuote({ status: 'loading' }), loadQuote()) : Promise.resolve()]);
    setRefreshing(false);
  };

  const onToggle = useCallback(
    async (item: Todo) => {
      const done = item.is_completed === 0;
      // Optimistic: flip the row at once, then write; put it back if the write fails.
      setTodos((list) => list.map((t) => (t.id === item.id ? { ...t, is_completed: done ? 1 : 0, is_synced: 0 } : t)));
      try {
        await setTodoCompleted(db, uid, item.id, done);
        const [t, s] = await Promise.all([listTodos(db, uid), getSummary(db, uid, localDate())]);
        setTodos(t);
        setSummary(s);
      } catch {
        setTodos((list) => list.map((t) => (t.id === item.id ? item : t)));
        toast('That change was not saved. Try again.', 'error');
      }
    },
    [db, uid, toast],
  );

  const openTodo = useCallback((id: string) => router.push({ pathname: '/editor', params: { kind: 'todo', id } }), []);
  const openNote = useCallback((id: string) => router.push({ pathname: '/editor', params: { kind: 'note', id } }), []);
  const create = () => router.push({ pathname: '/editor', params: { kind: tab === 'todos' ? 'todo' : 'note' } });

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  const header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.date, { color: p.muted }]}>{today}</Text>
          <Text style={[styles.title, { color: p.ink }]} accessibilityRole="header">
            Today
          </Text>
        </View>
        <SyncStamp unsynced={summary.unsynced} lastBackup={lastBackup} />
      </View>

      <QuoteCard state={quote} onRetry={() => { setQuote({ status: 'loading' }); loadQuote(); }} />

      <View style={styles.figures} accessibilityRole="summary">
        <Figure value={summary.open} label="open" />
        <Figure value={summary.dueToday} label="due by today" />
        <Figure value={summary.done} label="done" />
      </View>

      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'todos', label: 'To-do', count: todos.length },
          { value: 'notes', label: 'Notes', count: notes.length },
        ]}
      />
    </View>
  );

  const empty =
    load === 'loading' ? (
      <ListSkeleton />
    ) : load === 'error' ? (
      <ErrorState title="Your lists did not load" body="The local database did not answer. Pull down to try again." onRetry={reload} />
    ) : tab === 'todos' ? (
      <EmptyState title="Nothing to do yet" body="Add the first thing you want to get done today." action="New to-do" onAction={create} />
    ) : (
      <EmptyState title="No notes yet" body="Write something down. Lock it with a PIN if it is private." action="New note" onAction={create} />
    );

  const listProps = {
    ListHeaderComponent: header,
    ListEmptyComponent: empty,
    contentContainerStyle: styles.list,
    refreshControl: <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={p.accent} colors={[p.accent]} />,
    // Lazy rendering (requirement 3.6): render a screenful first and keep a small window mounted.
    initialNumToRender: 10,
    maxToRenderPerBatch: 10,
    windowSize: 5,
    removeClippedSubviews: Platform.OS === 'android',
    keyboardShouldPersistTaps: 'handled' as const,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.paper }} edges={['top']}>
      {tab === 'todos' ? (
        <FlatList
          data={load === 'ready' ? todos : []}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => <TodoRow item={item} onToggle={onToggle} onOpen={openTodo} />}
          {...listProps}
        />
      ) : (
        <FlatList
          data={load === 'ready' ? notes : []}
          keyExtractor={(n) => n.id}
          renderItem={({ item }) => <NoteRow item={item} onOpen={openNote} />}
          {...listProps}
        />
      )}
      <View style={styles.fabWrap} pointerEvents="box-none">
        <Button label={tab === 'todos' ? 'New to-do' : 'New note'} icon="plus" onPress={create} />
      </View>
    </SafeAreaView>
  );
}

function Figure({ value, label }: { value: number; label: string }) {
  const { p } = useTheme();
  return (
    <View style={styles.figure} accessible accessibilityLabel={`${value} ${label}`}>
      <Text style={[styles.figureValue, { color: p.ink }]}>{value}</Text>
      <Text style={[styles.figureLabel, { color: p.muted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.md, paddingBottom: 120, maxWidth: 720, width: '100%', alignSelf: 'center' },
  header: { gap: space.md, paddingTop: space.md, paddingBottom: space.xs },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  date: { fontFamily: fonts.body, fontSize: text.sm },
  title: { fontFamily: fonts.display, fontSize: text.display, letterSpacing: tracking(text.display), lineHeight: text.display * 1.1 },
  figures: { flexDirection: 'row', gap: space.lg, paddingVertical: space.xs },
  figure: { gap: 2 },
  figureValue: { fontFamily: fonts.display, fontSize: text.xl, fontVariant: ['tabular-nums'], letterSpacing: tracking(text.xl) },
  figureLabel: { fontFamily: fonts.body, fontSize: text.sm },
  fabWrap: { position: 'absolute', right: space.md, bottom: space.md },
});
