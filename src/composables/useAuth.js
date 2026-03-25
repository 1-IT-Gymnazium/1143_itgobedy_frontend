// Authentication composable
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../utils/api.js';
import { onMounted, onUnmounted } from 'vue';
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
      isAdmin: localStorage.getItem('user_is_admin') === 'true'
    };
  }
}

// Initialize immediately when module loads
initAuthState();

export function useAuth() {
  const router = useRouter();

    function setAuth(userData) {
        isAuthenticated.value = true;
        user.value = {
            name: userData.name || '',
            email: userData.email || '',
            picture: userData.picture || '',
            isAdmin: Boolean(userData.isAdmin)
        };

        localStorage.setItem('user_name', user.value.name);
        localStorage.setItem('user_email', user.value.email);
        localStorage.setItem('picture', user.value.picture);
        localStorage.setItem('user_is_admin', String(user.value.isAdmin));
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

  return {
    isAuthenticated,
    user,
    setAuth,
    clearAuth,
    checkAuth,
    logout,
    requireAuth
  };
}