// Authentication composable
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../utils/api.js';
import {setLoggingOut} from "@/router/index.js";

// Global state that persists across component instances
const isAuthenticated = ref(document.cookie.includes('access_token_cookie'));
const user = ref({
  name: '',
  email: '',
  picture: '',
  isAdmin: false
});

// Initialize auth state from localStorage immediately
function initAuthState() {
  if (isAuthenticated.value) {
    user.value = {
      name: localStorage.getItem('user_name') || '',
      email: localStorage.getItem('user_email') || '',
      picture: localStorage.getItem('picture') || '',
      isAdmin: false  // Will be computed from JWT, not from localStorage
    };
  }
}

// Initialize immediately when module loads
initAuthState();

// Utility function to decode JWT without external libraries
function decodeJWT(token) {
  try {
    // JWT format: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    // Decode the payload (second part)
    const payload = parts[1];
    // Add padding if needed
    const padded = payload + '='.repeat((4 - payload.length % 4) % 4);
    const decoded = JSON.parse(atob(padded));
    return decoded;
  } catch (error) {
    console.error('Failed to decode JWT:', error);
    return null;
  }
}

// Extract JWT from cookies
function getJWTFromCookie() {
  try {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'access_token_cookie') {
        return value;
      }
    }
  } catch (error) {
    console.error('Failed to extract JWT:', error);
  }
  return null;
}

// Check if user is admin based on JWT token
function getAdminStatusFromJWT() {
  try {
    const token = getJWTFromCookie();
    if (!token) {
      return false;
    }

    const decoded = decodeJWT(token);
    if (!decoded) {
      return false;
    }

    // Check various common admin claim patterns in JWT
    return decoded.isAdmin === true || 
           decoded.is_admin === true || 
           decoded.admin === true ||
           (decoded.role && decoded.role === 'admin');
  } catch (error) {
    console.error('Failed to get admin status from JWT:', error);
    return false;
  }
}

export function useAuth() {
  const router = useRouter();

    function setAuth(userData) {
        isAuthenticated.value = true;
        user.value = {
            name: userData.name || '',
            email: userData.email || '',
            picture: userData.picture || '',
            isAdmin: false  // Don't set from userData - it will be computed from JWT
        };

        localStorage.setItem('user_name', user.value.name);
        localStorage.setItem('user_email', user.value.email);
        localStorage.setItem('picture', user.value.picture);
        // Don't store isAdmin in localStorage anymore
    }
    
    function clearAuth() {
        isAuthenticated.value = false;
        user.value = { name: '', email: '', picture: '', isAdmin: false };

        localStorage.removeItem('user_name');
        localStorage.removeItem('user_email');
        localStorage.removeItem('picture');
        localStorage.removeItem('user_is_admin');
        localStorage.removeItem('lunchNumber');
    }


    // Check if user is authenticated
  async function checkAuth() {
      return isAuthenticated.value;
  }

  // Logout function
  async function logout() {
      setLoggingOut(true);

    try {
      await api.logout();
      clearAuth();
      await router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
      await router.push('/server-error');
      setLoggingOut(false);
    }
  }

  // Require authentication (redirect if not authenticated)
  function requireAuth() {
    if (!isAuthenticated.value) {
      router.push('/');
      return false;
    }
    return true;
  }

  // Validate admin access by decoding JWT token - no backend call needed
  function validateAdminAccess() {
    return getAdminStatusFromJWT();
  }

  // Computed property for isAdmin - always checks JWT token, never localStorage
  const isAdminComputed = computed(() => {
    if (!isAuthenticated.value) return false;
    return getAdminStatusFromJWT();
  });

  return {
    isAuthenticated,
    user,
    setAuth,
    clearAuth,
    checkAuth,
    logout,
    requireAuth,
    validateAdminAccess,
    isAdminComputed
  };
}