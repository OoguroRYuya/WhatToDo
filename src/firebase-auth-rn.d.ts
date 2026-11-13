// `firebase/auth` resolves to the React Native build at runtime (Metro picks the "react-native"
// condition of @firebase/auth), but the public `firebase` package's types are the browser ones.
// This adds the one RN-only export the app uses.
import type { Persistence, ReactNativeAsyncStorage } from '@firebase/auth';

declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: ReactNativeAsyncStorage): Persistence;
}
