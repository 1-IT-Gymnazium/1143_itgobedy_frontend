// Authentication composable
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../utils/api.js';
import { onMounted, onUnmounted } from 'vue';

// Global state that persists across component instances
const isAuthenticated = ref(false);
const user = ref({
  name: '',
  email: '',
  picture: ''
});

// Initialize auth state from localStorage immediately
function initAuthState() {
  const authFlag = localStorage.getItem('is_authenticated');
  isAuthenticated.value = !!authFlag;

  if (authFlag) {
    user.value = {
      name: localStorage.getItem('user_name') || '',
      email: localStorage.getItem('user_email') || '',
      picture: localStorage.getItem('picture') || ''
    };
  }
}

// Initialize immediately when module loads
initAuthState();

export function useAuth() {
  const router = useRouter();

  // Set authentication data
  function setAuth(userData) {
    isAuthenticated.value = true;
    user.value = userData;

    localStorage.setItem('is_authenticated', 'true');
    localStorage.setItem('user_name', userData.name || '');
    localStorage.setItem('user_email', userData.email || '');
    localStorage.setItem('picture', userData.picture || '');
  }

  // Clear authentication data
  function clearAuth() {
    isAuthenticated.value = false;
    user.value = { name: '', email: '', picture: '' };

    localStorage.setItem('is_authenticated', 'false');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_email');
    localStorage.removeItem('picture');
    localStorage.removeItem('lunchNumber');
  }

  // Check if user is authenticated
  async function checkAuth() {
      return isAuthenticated.value;
  }

  // Logout function
  async function logout() {
    try {
      await api.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearAuth();
      router.push('/');
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

export default class clearAuth {
}