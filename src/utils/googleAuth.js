import { auth, googleProvider, signInWithPopup, signOut } from './firebase';
import { useAuth } from '../composables/useAuth.js';
import { api } from './api.js';

// Funkce pro přihlášení přes Google (používá popup)
export async function signInWithGoogle() {
    try {
        console.log('🔐 Opening Google sign-in popup...');

        // Sign in with popup - much simpler and more reliable
        const result = await signInWithPopup(auth, googleProvider);
        console.log('✅ Popup sign-in successful:', result.user.email);

        // Process the user
        const user = result.user;
        const token = await user.getIdToken();
        console.log('🔑 Got ID token from Firebase');

        // Odeslat token na backend pro ověření/vytvoření uživatele
        const userData = {
            token: token
        };

        console.log('📤 Sending to backend:', { ...userData, token: '***' });

        // Odeslat na backend
        const response = await api.verifyToken(userData);
        console.log('📥 Backend response:', response);

        // Nastavit autentizaci v aplikaci
        useAuth().setAuth({
            name: user.displayName,
            email: user.email,
            picture: user.photoURL
        });
        console.log('✅ Auth state set');

        return user;
    } catch (error) {
        console.error('❌ Error in Google sign-in:', error);
        if (error.code === 'auth/popup-closed-by-user') {
            throw new Error('Sign-in cancelled');
        } else if (error.code === 'auth/popup-blocked') {
            throw new Error('Popup was blocked by browser. Please allow popups and try again.');
        }
        throw error;
    }
}

// No need for handleGoogleRedirect anymore with popup
export async function handleGoogleRedirect() {
    // This is no longer needed with popup, but keeping for compatibility
    console.log('ℹ️ Using popup instead of redirect, no redirect handling needed');
    return null;
}

export async function signOutGoogle() {
    try {
        await signOut(auth);
        useAuth().clearAuth();
    } catch (error) {
        console.error('Error signing out:', error);
        throw error;
    }
}

