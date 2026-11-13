import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, type TextInputInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { authErrorMessage, isFirebaseConfigured } from '@/lib/firebase';
import { checkEmail, checkPassword } from '@/lib/validation';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/Button';
import { useTheme } from '@/theme/useTheme';
import { fonts, radius, space, text, tracking } from '@/theme/tokens';

type Mode = 'signIn' | 'register';

export default function SignInScreen() {
  const { p } = useTheme();
  const { signIn, register } = useAuth();
  const toast = useToast();

  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirm?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const confirmRef = useRef<TextInputInstance>(null);
  const isRegister = mode === 'register';

  const submit = async () => {
    const e = checkEmail(email);
    const pw = checkPassword(password, isRegister);
    const next: typeof errors = {};
    if (!e.ok) next.email = e.message;
    if (!pw.ok) next.password = pw.message;
    if (isRegister && pw.ok && password !== confirm) next.confirm = 'The passwords do not match.';
    setErrors(next);
    // A failed submit moves focus to the first invalid field.
    if (next.email) return emailRef.current?.focus();
    if (next.password) return passwordRef.current?.focus();
    if (next.confirm) return confirmRef.current?.focus();

    setBusy(true);
    try {
      if (isRegister) {
        await register(email, password);
        toast('Account created. Welcome.', 'success');
      } else {
        await signIn(email, password);
      }
      // The auth listener swaps the navigator; nothing to navigate here.
    } catch (err) {
      setErrors({ form: authErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const switchMode = () => {
    setMode(isRegister ? 'signIn' : 'register');
    setErrors({});
    setConfirm('');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.paper }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.column}>
            <Text style={[styles.wordmark, { color: p.accent }]} accessibilityRole="header">
              Daybook
            </Text>
            <Text style={[styles.head, { color: p.ink }]}>
              {isRegister ? 'Make your account' : 'Your day, kept'}
            </Text>
            <Text style={[styles.lead, { color: p.ink2 }]}>
              {isRegister
                ? 'Your lists live on this phone and back up to your account.'
                : 'To-dos and notes that work offline and back up when you ask.'}
            </Text>

            {!isFirebaseConfigured && (
              <View style={[styles.notice, { backgroundColor: p.trayStraw }]}>
                <Text style={[styles.noticeText, { color: p.ink }]}>
                  Firebase is not set up yet. Copy .env.example to .env, add your project’s keys and restart Expo.
                </Text>
              </View>
            )}

            <View style={styles.form}>
              <TextField
                ref={emailRef}
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                keyboardType="email-address"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                error={errors.email}
              />
              <TextField
                ref={passwordRef}
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                textContentType={isRegister ? 'newPassword' : 'password'}
                returnKeyType={isRegister ? 'next' : 'go'}
                onSubmitEditing={isRegister ? () => confirmRef.current?.focus() : submit}
                hint={isRegister ? 'At least 8 characters, with a letter and a number.' : undefined}
                error={errors.password}
              />
              {isRegister && (
                <TextField
                  ref={confirmRef}
                  label="Password again"
                  value={confirm}
                  onChangeText={setConfirm}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="go"
                  onSubmitEditing={submit}
                  error={errors.confirm}
                />
              )}

              {errors.form && (
                <Text style={[styles.formError, { color: p.ink, borderColor: p.ink }]} accessibilityLiveRegion="assertive">
                  {errors.form}
                </Text>
              )}

              <Button
                label={isRegister ? 'Create account' : 'Sign in'}
                onPress={submit}
                loading={busy}
                disabled={!isFirebaseConfigured}
              />
              <Button
                label={isRegister ? 'I have an account' : 'Create an account'}
                variant="quiet"
                onPress={switchMode}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: space.lg },
  column: { width: '100%', maxWidth: 440, alignSelf: 'center', gap: space.sm },
  wordmark: { fontFamily: fonts.display, fontSize: text.lg, letterSpacing: tracking(text.lg), marginBottom: space.lg },
  head: { fontFamily: fonts.display, fontSize: text.display, letterSpacing: tracking(text.display), lineHeight: text.display * 1.05 },
  lead: { fontFamily: fonts.body, fontSize: text.md, lineHeight: 24, marginBottom: space.md },
  form: { gap: space.xs },
  notice: { borderRadius: radius.card, padding: space.md },
  noticeText: { fontFamily: fonts.body, fontSize: text.sm, lineHeight: 20 },
  formError: { fontFamily: fonts.bodyMedium, fontSize: text.sm, borderLeftWidth: 3, paddingLeft: space.sm, paddingVertical: space['2xs'], marginBottom: space.xs },
});
