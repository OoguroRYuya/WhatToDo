import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme/useTheme';
import { duration, fonts, radius, space, text, lift } from '@/theme/tokens';

type Tone = 'success' | 'error' | 'info';
type Toast = { id: number; message: string; tone: Tone };

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [anim] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const { p } = useTheme();

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  const show = useCallback(
    (message: string, tone: Tone = 'info') => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ id: Date.now(), message, tone });
      AccessibilityInfo.announceForAccessibility(message);
      anim.setValue(reduceMotion ? 1 : 0);
      if (!reduceMotion) {
        Animated.timing(anim, { toValue: 1, duration: duration.short, useNativeDriver: true }).start();
      }
      timer.current = setTimeout(() => {
        if (reduceMotion) return setToast(null);
        Animated.timing(anim, { toValue: 0, duration: duration.short, useNativeDriver: true }).start(() => setToast(null));
      }, tone === 'error' ? 5000 : 3000);
    },
    [anim, reduceMotion],
  );

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Errors are ink, not red: the Dose theme never alarms. The icon carries the meaning.
  const icon = toast?.tone === 'success' ? 'check' : toast?.tone === 'error' ? 'alert-circle' : 'info';
  const bg = toast?.tone === 'success' ? p.accentDeep : p.ink;
  const fg = toast?.tone === 'success' ? p.accentInk : p.paper;

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]}>
          <Animated.View
            accessibilityLiveRegion="polite"
            style={[
              styles.toast,
              lift(p),
              {
                backgroundColor: bg,
                marginBottom: insets.bottom + 72,
                opacity: anim,
                transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
              },
            ]}
          >
            <Feather name={icon} size={18} color={fg} />
            <Text style={[styles.text, { color: fg }]}>{toast.message}</Text>
          </Animated.View>
        </View>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  toast: {
    marginHorizontal: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.input,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    alignSelf: 'center',
    maxWidth: 520,
  },
  text: { fontFamily: fonts.bodyMedium, fontSize: text.sm, lineHeight: 20, flexShrink: 1 },
});
