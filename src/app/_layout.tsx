import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { SchibstedGrotesk_700Bold } from '@expo-google-fonts/schibsted-grotesk';
import { InstrumentSans_400Regular, InstrumentSans_500Medium } from '@expo-google-fonts/instrument-sans';
import { DMMono_400Regular, DMMono_500Medium } from '@expo-google-fonts/dm-mono';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { DB_NAME, migrate } from '@/lib/db';
import { useTheme } from '@/theme/useTheme';
import { fonts } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SchibstedGrotesk_700Bold,
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    DMMono_400Regular,
    DMMono_500Medium,
  });

  // If fonts fail, carry on with system faces rather than a blank screen.
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName={DB_NAME} onInit={migrate}>
        <AuthProvider>
          <ToastProvider>
            <RootNavigator />
          </ToastProvider>
        </AuthProvider>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}

/**
 * Route protection (requirement 3.6): screens behind `guard={!!user}` do not exist for a
 * signed-out user, so they cannot be reached by back navigation or a deep link either.
 */
function RootNavigator() {
  const { user, initializing } = useAuth();
  const { p, dark } = useTheme();

  useEffect(() => {
    if (!initializing) SplashScreen.hideAsync();
  }, [initializing]);

  if (initializing) return null;

  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: p.paper },
          headerTintColor: p.ink,
          headerTitleStyle: { fontFamily: fonts.bodyMedium },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: p.paper },
        }}
      >
        <Stack.Protected guard={!user}>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!!user}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="editor" options={{ presentation: 'modal', title: '' }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}
