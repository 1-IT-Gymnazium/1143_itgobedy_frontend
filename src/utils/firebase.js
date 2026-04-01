import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from 'firebase/auth';

// Vaše Firebase konfigurace (získáte z Firebase Console)
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

console.log('🔧 Initializing Firebase with config:', { ...firebaseConfig, apiKey: '***' });

// Inicializace Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Add custom parameters to ensure proper redirect flow
googleProvider.setCustomParameters({
    prompt: 'select_account'
});

console.log('✅ Firebase initialized successfully');

// Add auth state listener for debugging
onAuthStateChanged(auth, (user) => {
    console.log('🔔 Global auth state changed:', user ? `${user.email} (${user.uid})` : 'null');
});

export { auth, googleProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged };
