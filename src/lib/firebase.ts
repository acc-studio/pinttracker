import { initializeApp } from 'firebase/app'
import { browserLocalPersistence, connectAuthEmulator, indexedDBLocalPersistence, initializeAuth } from 'firebase/auth'
import { connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

// Web config is public by design; access is enforced by firestore.rules.
const app = initializeApp({
  apiKey: 'AIzaSyCjAnHGsmtUMmtzRg54CBiibfzw6Ct7mmA',
  authDomain: 'pinttracker-3997.firebaseapp.com',
  projectId: 'pinttracker-3997',
  storageBucket: 'pinttracker-3997.firebasestorage.app',
  messagingSenderId: '803033864557',
  appId: '1:803033864557:web:de1e528fb8cbe82e72e264',
})

// initializeAuth (not getAuth) so the Android WebView doesn't wait on popup/redirect machinery.
export const auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] })

// Offline-first: writes land in the on-device cache instantly and sync when online.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true,
})

if (import.meta.env.VITE_EMULATORS === '1') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
