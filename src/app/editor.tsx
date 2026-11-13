import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  type TextInputInstance,
} from 'react-native';
import { Stack, router, useLocalSearchParams, useNavigation, usePreventRemove } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Feather } from '@expo/vector-icons';
import { useUid } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  createNote,
  createTodo,
  deleteNote,
  deleteTodo,
  getNote,
  getTodo,
  updateNote,
  updateTodo,
} from '@/lib/db';
import { decryptNote, encryptNote, WrongPinError } from '@/lib/crypto';
import { adoptPin, hasPin, pinLockoutSeconds, recordPinFailure, recordPinSuccess, setPin, verifyPin } from '@/lib/pin';
import { addDays, localDate } from '@/lib/time';
import { checkContent, checkDueDate, checkTitle, LIMITS, sanitizeLine, sanitizeText } from '@/lib/validation';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/Button';
import { PinSheet } from '@/components/PinSheet';
import { ErrorState } from '@/components/States';
import { useTheme } from '@/theme/useTheme';
import { control, fonts, radius, space, text } from '@/theme/tokens';

type Kind = 'todo' | 'note';
type Phase = 'loading' | 'missing' | 'locked' | 'editing';
type PinIntent = null | { mode: 'unlock' | 'create'; purpose: 'open' | 'lock' };

export default function EditorScreen() {
  const db = useSQLiteContext();
  const uid = useUid();
  const toast = useToast();
  const navigation = useNavigation();
  const { p } = useTheme();

  const params = useLocalSearchParams<{ kind?: string; id?: string }>();
  const kind: Kind = params.kind === 'note' ? 'note' : 'todo';
  const id = params.id;
  const isNew = !id;

  const [phase, setPhase] = useState<Phase>(isNew ? 'editing' : 'loading');
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [content, setContent] = useState('');
  const [locked, setLocked] = useState(false); // the lock switch
  const [wasEncrypted, setWasEncrypted] = useState(false);
  const [cipher, setCipher] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ title?: string; due?: string; content?: string }>({});
  const [saving, setSaving] = useState(false);
  const [pinIntent, setPinIntent] = useState<PinIntent>(null);

  /** The PIN that opened or locked this note, held only while the editor is open. */
  const pinRef = useRef<string | null>(null);
  const [dirty, setDirty] = useState(false);
  /** Set after a save or delete: lifts the unsaved-changes guard, then goes back. */
  const [exiting, setExiting] = useState(false);
  const titleRef = useRef<TextInputInstance>(null);
  const dueRef = useRef<TextInputInstance>(null);
  const contentRef = useRef<TextInputInstance>(null);

  const touch = <T,>(set: (v: T) => void) => (v: T) => { setDirty(true); set(v); };

  // ---- Load ----
  useEffect(() => {
    if (isNew) return;
    (async () => {
      try {
        if (kind === 'todo') {
          const t = await getTodo(db, uid, id);
          if (!t) return setPhase('missing');
          setTitle(t.title);
          setDue(t.due_date ?? '');
          setPhase('editing');
        } else {
          const n = await getNote(db, uid, id);
          if (!n) return setPhase('missing');
          setTitle(n.title);
          if (n.is_encrypted) {
            setCipher(n.content);
            setLocked(true);
            setWasEncrypted(true);
            setPhase('locked');
            setPinIntent({ mode: 'unlock', purpose: 'open' });
          } else {
            setContent(n.content);
            setPhase('editing');
          }
        }
      } catch (e) {
        console.warn('[editor] load failed', e);
        setPhase('missing');
      }
    })();
  }, [db, uid, id, kind, isNew]);

  // ---- Unsaved changes guard ----
  usePreventRemove(dirty && !exiting, ({ data }) => {
    Alert.alert('Discard changes?', 'What you typed here has not been saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(data.action) }, // the action that was blocked, now let through
    ]);
  });

  useEffect(() => {
    if (exiting) router.back();
  }, [exiting]);

  const leave = () => setExiting(true);

  // ---- PIN flows ----
  const handlePin = useCallback(
    async (pin: string) => {
      if (!pinIntent) return;
      if (pinLockoutSeconds() > 0) throw new Error(`Too many tries. Wait ${pinLockoutSeconds()} seconds.`);

      if (pinIntent.mode === 'create') {
        await setPin(uid, pin);
        pinRef.current = pin;
        setDirty(true);
        setLocked(true);
        setPinIntent(null);
        toast('PIN set. This note will be encrypted when you save.', 'success');
        return;
      }

      const verdict = await verifyPin(uid, pin);

      if (pinIntent.purpose === 'open' && cipher) {
        // The note's own MAC is the authority, not the phone's verifier: a note restored from the
        // cloud may have been locked under an older PIN than the one this phone knows.
        try {
          const plain = await decryptNote(cipher, pin);
          if (verdict === 'unset') await adoptPin(uid, pin); // first unlock on a restored phone
          recordPinSuccess();
          pinRef.current = pin;
          setContent(plain);
          setPhase('editing');
          setPinIntent(null);
        } catch (e) {
          if (e instanceof WrongPinError) {
            recordPinFailure();
            throw new Error(
              verdict === true
                ? 'This note was locked with a different PIN, perhaps an older one or one from another phone.'
                : 'That PIN is not right.',
            );
          }
          throw e;
        }
      } else {
        // Locking a note: only the PIN this phone knows is accepted, so a typo cannot lock it away.
        if (verdict !== true) {
          recordPinFailure();
          throw new Error('That PIN is not right.');
        }
        recordPinSuccess();
        pinRef.current = pin;
        setDirty(true);
        setLocked(true);
        setPinIntent(null);
      }
    },
    [pinIntent, cipher, uid, toast],
  );

  const onToggleLock = async (next: boolean) => {
    if (next) {
      if (pinRef.current) { setDirty(true); return setLocked(true); }
      setPinIntent({ mode: (await hasPin(uid)) ? 'unlock' : 'create', purpose: 'lock' });
    } else {
      Alert.alert('Remove the lock?', 'The note will be saved as plain text on this phone and in the cloud.', [
        { text: 'Keep it locked', style: 'cancel' },
        { text: 'Remove lock', onPress: () => { setDirty(true); setLocked(false); } },
      ]);
    }
  };

  // ---- Save ----
  const save = async () => {
    const t = checkTitle(title);
    const d = kind === 'todo' ? checkDueDate(due) : { ok: true as const };
    const c = kind === 'note' ? checkContent(content) : { ok: true as const };
    const next = {
      title: t.ok ? undefined : t.message,
      due: d.ok ? undefined : d.message,
      content: c.ok ? undefined : c.message,
    };
    setErrors(next);
    if (next.title) return titleRef.current?.focus();
    if (next.due) return dueRef.current?.focus();
    if (next.content) return contentRef.current?.focus();

    setSaving(true);
    try {
      const cleanTitle = sanitizeLine(title);
      if (kind === 'todo') {
        const input = { title: cleanTitle, due_date: due.trim() || null };
        if (isNew) await createTodo(db, uid, input);
        else await updateTodo(db, uid, id, input);
      } else {
        const plain = sanitizeText(content);
        if (locked && !pinRef.current) throw new Error('Unlock the note before saving.');
        const body = locked ? await encryptNote(plain, pinRef.current!) : plain;
        const input = { title: cleanTitle, content: body, is_encrypted: locked };
        if (isNew) await createNote(db, uid, input);
        else await updateNote(db, uid, id, input);
      }
      toast(isNew ? 'Saved on this phone.' : 'Changes saved.', 'success');
      leave();
    } catch (e) {
      console.warn('[editor] save failed', e);
      toast((e as Error).message || 'Not saved. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(kind === 'todo' ? 'Delete this to-do?' : 'Delete this note?', 'It will also be removed from the cloud at the next backup.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            if (kind === 'todo') await deleteTodo(db, uid, id!);
            else await deleteNote(db, uid, id!);
            toast('Deleted.', 'info');
            leave();
          } catch {
            toast('Not deleted. Try again.', 'error');
          }
        },
      },
    ]);
  };

  const heading = `${isNew ? 'New' : 'Edit'} ${kind === 'todo' ? 'to-do' : 'note'}`;

  return (
    <>
      <Stack.Screen
        options={{
          title: heading,
          headerRight: isNew || (phase !== 'editing' && phase !== 'locked') ? undefined : () => (
            <Pressable onPress={confirmDelete} accessibilityRole="button" accessibilityLabel={`Delete this ${kind === 'todo' ? 'to-do' : 'note'}`} hitSlop={12} style={styles.headerBtn}>
              <Feather name="trash-2" size={20} color={p.ink2} />
            </Pressable>
          ),
        }}
      />

      {phase === 'loading' && (
        <View style={styles.center}><ActivityIndicator color={p.accent} /></View>
      )}

      {phase === 'missing' && (
        <View style={styles.pad}>
          <ErrorState title="Not found" body="This item was deleted or belongs to another account." onRetry={leave} />
        </View>
      )}

      {phase === 'locked' && (
        <View style={[styles.pad, { gap: space.md }]}>
          <View style={[styles.lockTray, { backgroundColor: p.trayMint }]}>
            <Feather name="lock" size={22} color={p.accentDeep} />
            <Text style={[styles.lockTitle, { color: p.ink }]}>{title}</Text>
            <Text style={[styles.body, { color: p.ink2 }]}>This note is encrypted. Enter your PIN to read or change it.</Text>
          </View>
          <Button label="Enter PIN" icon="unlock" onPress={() => setPinIntent({ mode: 'unlock', purpose: 'open' })} />
        </View>
      )}

      {phase === 'editing' && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={90}>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <TextField
              ref={titleRef}
              label="Title"
              value={title}
              onChangeText={touch(setTitle)}
              maxLength={LIMITS.title + 20}
              autoFocus={isNew}
              returnKeyType={kind === 'todo' ? 'next' : 'default'}
              onSubmitEditing={() => (kind === 'todo' ? dueRef.current?.focus() : contentRef.current?.focus())}
              error={errors.title}
            />

            {kind === 'todo' && (
              <View style={{ gap: space.xs }}>
                <TextField
                  ref={dueRef}
                  label="Due date"
                  value={due}
                  onChangeText={touch(setDue)}
                  placeholder="YYYY-MM-DD"
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                  mono
                  error={errors.due}
                  hint="Optional"
                />
                <View style={styles.chips}>
                  <Chip label="Today" selected={due === localDate()} onPress={() => touch(setDue)(localDate())} />
                  <Chip label="Tomorrow" selected={due === addDays(1)} onPress={() => touch(setDue)(addDays(1))} />
                  <Chip label="Next week" selected={due === addDays(7)} onPress={() => touch(setDue)(addDays(7))} />
                  {!!due && <Chip label="No date" selected={false} onPress={() => touch(setDue)('')} />}
                </View>
              </View>
            )}

            {kind === 'note' && (
              <>
                <TextField
                  ref={contentRef}
                  label="Note"
                  value={content}
                  onChangeText={touch(setContent)}
                  multiline
                  error={errors.content}
                />
                <View style={[styles.lockRow, { borderColor: p.rule, backgroundColor: locked ? p.paper2 : 'transparent' }]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.lockLabel, { color: p.ink }]}>Lock with PIN</Text>
                    <Text style={[styles.small, { color: p.muted }]}>
                      {locked
                        ? 'Encrypted with AES-256 before it is saved or backed up.'
                        : 'The text is stored as plain text.'}
                    </Text>
                  </View>
                  <Switch
                    value={locked}
                    onValueChange={onToggleLock}
                    trackColor={{ true: p.accent, false: p.rule }}
                    thumbColor={p.surface}
                    accessibilityLabel="Lock this note with your PIN"
                  />
                </View>
                {wasEncrypted && !locked && (
                  <Text style={[styles.small, { color: p.ink2 }]}>The lock comes off when you save.</Text>
                )}
              </>
            )}

            <Button label={locked && kind === 'note' ? 'Encrypt and save' : 'Save'} onPress={save} loading={saving} style={{ marginTop: space.sm }} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <PinSheet
        visible={!!pinIntent}
        mode={pinIntent?.mode ?? 'unlock'}
        onSubmit={handlePin}
        onCancel={() => setPinIntent(null)}
      />
    </>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { p } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? p.accentSoft : p.surface,
          borderColor: selected ? p.accent : p.rule,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? p.accentDeep : p.ink2 }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pad: { padding: space.md, maxWidth: 720, width: '100%', alignSelf: 'center' },
  form: { padding: space.md, gap: space.xs, paddingBottom: space['2xl'], maxWidth: 720, width: '100%', alignSelf: 'center' },
  headerBtn: { width: control.hit, height: control.hit, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: -space.xs, marginBottom: space.sm },
  chip: { minHeight: 36, paddingHorizontal: space.sm, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center' },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: text.sm },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderRadius: radius.card, padding: space.md },
  lockLabel: { fontFamily: fonts.bodyMedium, fontSize: text.md },
  lockTray: { borderRadius: radius.card, padding: space.lg, gap: space.sm },
  lockTitle: { fontFamily: fonts.bodyMedium, fontSize: text.lg },
  body: { fontFamily: fonts.body, fontSize: text.md, lineHeight: 24 },
  small: { fontFamily: fonts.body, fontSize: text.sm, lineHeight: 20 },
});
