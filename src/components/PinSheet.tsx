import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { fonts, radius, space, text, tracking } from '@/theme/tokens';
import { checkPin, LIMITS } from '@/lib/validation';
import { pinLockoutSeconds } from '@/lib/pin';
import { TextField } from './TextField';
import { Button } from './Button';

type Mode = 'unlock' | 'create';

type Props = {
  visible: boolean;
  mode: Mode;
  /** Resolve to close; throw an Error whose message is shown under the field. */
  onSubmit: (pin: string) => Promise<void>;
  onCancel: () => void;
};

export function PinSheet({ visible, mode, onSubmit, onCancel }: Props) {
  const { p } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <Pressable style={[styles.scrim, { backgroundColor: p.scrim }]} onPress={onCancel} accessibilityLabel="Close" accessibilityRole="button" />
      {visible && <PinForm mode={mode} onSubmit={onSubmit} onCancel={onCancel} />}
    </Modal>
  );
}

function PinForm({ mode, onSubmit, onCancel }: Omit<Props, 'visible'>) {
  const { p } = useTheme();
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(pinLockoutSeconds);

  // Count down a lockout after too many wrong PINs.
  useEffect(() => {
    const t = setInterval(() => setWait(pinLockoutSeconds()), 1000);
    return () => clearInterval(t);
  }, []);

  const submit = async () => {
    const c = checkPin(pin);
    if (!c.ok) return setError(c.message);
    if (mode === 'create' && pin !== confirm) return setError('The two PINs do not match.');
    setBusy(true);
    setError(null);
    try {
      await onSubmit(pin);
    } catch (e) {
      setError((e as Error).message);
      setPin('');
      setWait(pinLockoutSeconds());
    } finally {
      setBusy(false);
    }
  };

  return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap} pointerEvents="box-none">
        <View style={[styles.sheet, { backgroundColor: p.paper }]} accessibilityViewIsModal>
          <Text style={[styles.title, { color: p.ink }]} accessibilityRole="header">
            {mode === 'create' ? 'Choose a PIN for secret notes' : 'Enter your PIN'}
          </Text>
          <Text style={[styles.body, { color: p.ink2 }]}>
            {mode === 'create'
              ? 'Locked notes are encrypted with this PIN on the phone and in the cloud. Nobody can reset it, so keep it somewhere safe.'
              : 'This note is encrypted. Your PIN unlocks it on this phone only.'}
          </Text>
          <TextField
            label="PIN"
            value={pin}
            onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, LIMITS.pinMax))}
            keyboardType="number-pad"
            secureTextEntry
            autoFocus
            mono
            textContentType="password"
            autoComplete="off"
            error={wait > 0 ? `Too many tries. Wait ${wait} seconds.` : mode === 'unlock' ? error : null}
            hint={`${LIMITS.pinMin} to ${LIMITS.pinMax} digits`}
            onSubmitEditing={mode === 'unlock' ? submit : undefined}
          />
          {mode === 'create' && (
            <TextField
              label="Same PIN again"
              value={confirm}
              onChangeText={(v) => setConfirm(v.replace(/\D/g, '').slice(0, LIMITS.pinMax))}
              keyboardType="number-pad"
              secureTextEntry
              mono
              autoComplete="off"
              error={error}
              onSubmitEditing={submit}
            />
          )}
          <View style={styles.actions}>
            <Button label="Cancel" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
            <Button
              label={mode === 'create' ? 'Set PIN' : 'Unlock'}
              onPress={submit}
              loading={busy}
              disabled={wait > 0}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFill },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.card + 6,
    borderTopRightRadius: radius.card + 6,
    padding: space.lg,
    paddingBottom: space.xl,
    gap: space.md,
  },
  title: { fontFamily: fonts.display, fontSize: text.xl, letterSpacing: tracking(text.xl), lineHeight: text.xl * 1.1 },
  body: { fontFamily: fonts.body, fontSize: text.md, lineHeight: 24 },
  actions: { flexDirection: 'row', gap: space.sm },
});
