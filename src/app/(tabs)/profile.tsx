import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useAuth, useUid } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { getMeta, getSummary, type Summary } from '@/lib/db';
import { backup, restore, SyncTimeoutError } from '@/lib/sync';
import { hasPin } from '@/lib/pin';
import { localDate, stampTime } from '@/lib/time';
import { SyncStamp } from '@/components/SyncStamp';
import { Button } from '@/components/Button';
import { useTheme } from '@/theme/useTheme';
import { fonts, radius, space, text, tracking } from '@/theme/tokens';

type Busy = null | 'backup' | 'restore' | 'signout';

function syncErrorMessage(e: unknown) {
  if (e instanceof SyncTimeoutError) return e.message;
  const code = (e as { code?: string })?.code;
  if (code === 'unavailable') return 'No connection to the cloud. Your data is safe on this phone; try again when online.';
  if (code === 'permission-denied') return 'The cloud refused this account. Check the Firestore rules.';
  return 'The sync did not finish. Nothing was lost; try again.';
}

export default function ProfileScreen() {
  const db = useSQLiteContext();
  const uid = useUid();
  const { user, signOut } = useAuth();
  const toast = useToast();
  const { p } = useTheme();

  const [summary, setSummary] = useState<Summary | null>(null);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [lastRestore, setLastRestore] = useState<string | null>(null);
  const [pinSet, setPinSet] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);

  const refresh = useCallback(async () => {
    const [s, b, r, pin] = await Promise.all([
      getSummary(db, uid, localDate()),
      getMeta(db, `last_backup.${uid}`),
      getMeta(db, `last_restore.${uid}`),
      hasPin(uid),
    ]);
    setSummary(s);
    setLastBackup(b);
    setLastRestore(r);
    setPinSet(pin);
  }, [db, uid]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const runBackup = async () => {
    setBusy('backup');
    try {
      const r = await backup(db, uid);
      if (r.skippedNewerInCloud > 0) {
        toast(`${r.uploaded} backed up. ${r.skippedNewerInCloud} newer in the cloud; restore to get them.`, 'info');
      } else {
        toast(r.uploaded === 0 ? 'Already backed up.' : `${r.uploaded} ${r.uploaded === 1 ? 'item' : 'items'} backed up.`, 'success');
      }
    } catch (e) {
      console.warn('[sync] backup failed', e);
      toast(syncErrorMessage(e), 'error');
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const runRestore = () => {
    Alert.alert(
      'Restore from the cloud?',
      'Items newer in the cloud replace the ones on this phone. Anything newer here is kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            setBusy('restore');
            try {
              const r = await restore(db, uid);
              const changed = r.added + r.updated + r.removed;
              toast(changed === 0 ? 'This phone already matches the cloud.' : `Restored: ${r.added} added, ${r.updated} updated, ${r.removed} removed.`, 'success');
            } catch (e) {
              console.warn('[sync] restore failed', e);
              toast(syncErrorMessage(e), 'error');
            } finally {
              setBusy(null);
              refresh();
            }
          },
        },
      ],
    );
  };

  const doSignOut = async () => {
    setBusy('signout');
    try {
      await signOut();
    } catch {
      toast('Could not sign out. Try again.', 'error');
      setBusy(null);
    }
  };

  const confirmSignOut = () => {
    const pending = summary?.unsynced ?? 0;
    Alert.alert(
      'Sign out?',
      pending > 0
        ? `${pending} ${pending === 1 ? 'change has' : 'changes have'} not been backed up. They stay on this phone and come back when you sign in again.`
        : 'Your data stays on this phone and in the cloud.',
      [
        { text: 'Cancel', style: 'cancel' },
        ...(pending > 0 ? [{ text: 'Back up first', onPress: runBackup }] : []),
        { text: 'Sign out', style: 'destructive' as const, onPress: doSignOut },
      ],
    );
  };

  const joined = user?.metadata.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.paper }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={[styles.title, { color: p.ink }]} accessibilityRole="header">
          Account
        </Text>

        <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.rule }]}>
          <Row label="Email" value={user?.email ?? 'Unknown'} />
          {joined && <Row label="Member since" value={joined} />}
          <Row label="Secret-note PIN" value={pinSet ? 'Set on this phone' : 'Not set yet'} />
        </View>

        <Text style={[styles.section, { color: p.ink }]} accessibilityRole="header">
          Cloud backup
        </Text>
        <View style={[styles.tray, { backgroundColor: p.trayMint }]}>
          <SyncStamp unsynced={summary?.unsynced ?? 0} lastBackup={lastBackup} size="lg" />
          <Text style={[styles.body, { color: p.ink2 }]}>
            Everything is saved on this phone first and works offline. Back up to keep a copy in your account, and restore
            to bring it onto another phone.
          </Text>
          {lastRestore && (
            <Text style={[styles.mono, { color: p.ink2 }]}>Last restore {stampTime(lastRestore)}</Text>
          )}
          <View style={styles.actions}>
            <Button label="Back up now" icon="upload-cloud" onPress={runBackup} loading={busy === 'backup'} disabled={!!busy} />
            <Button label="Restore from cloud" icon="download-cloud" variant="secondary" onPress={runRestore} loading={busy === 'restore'} disabled={!!busy} />
          </View>
        </View>

        <Button label="Sign out" variant="quiet" icon="log-out" onPress={confirmSignOut} loading={busy === 'signout'} disabled={!!busy} style={{ alignSelf: 'flex-start', marginTop: space.md }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { p } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: p.rule }]} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.rowLabel, { color: p.muted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: p.ink }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.md, gap: space.md, paddingBottom: space['2xl'], maxWidth: 720, width: '100%', alignSelf: 'center' },
  title: { fontFamily: fonts.display, fontSize: text.display, letterSpacing: tracking(text.display), marginTop: space.md },
  section: { fontFamily: fonts.display, fontSize: text.lg, letterSpacing: tracking(text.lg), marginTop: space.sm },
  card: { borderRadius: radius.card, borderWidth: 1, paddingHorizontal: space.md },
  row: { paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, gap: 2 },
  rowLabel: { fontFamily: fonts.bodyMedium, fontSize: text.sm },
  rowValue: { fontFamily: fonts.body, fontSize: text.md },
  tray: { borderRadius: radius.card, padding: space.lg, gap: space.md },
  body: { fontFamily: fonts.body, fontSize: text.md, lineHeight: 24 },
  mono: { fontFamily: fonts.mono, fontSize: text.sm },
  actions: { gap: space.sm },
});
