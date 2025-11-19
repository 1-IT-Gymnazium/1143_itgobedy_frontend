<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useNotifications } from '../composables/useNotifications.js';
import { signInWithGoogle } from '../utils/googleAuth.js';

const router = useRouter();
const { showError, clearNotification, message, messageType } = useNotifications();

const isLoading = ref(false);

onMounted(async () => {
  console.log('🚀 LoginPage mounted');

  // Check if user is already authenticated
  if (document.cookie.includes('access_token_cookie')) {
    console.log('✅ Already authenticated, redirecting to dashboard');
    await router.push('/dashboard');
  }
});

async function handleGoogleLogin() {
  try {
    clearNotification();
    isLoading.value = true;
    console.log('🔐 Starting Google sign-in...');

    // This will open a popup and wait for the result
    await signInWithGoogle();

    // If we get here, login was successful
    console.log('✅ Login successful, redirecting to dashboard');
    await router.push('/dashboard');
  } catch (error) {
    console.error('❌ Login failed:', error);
    showError(`Login failed: ${error.message}`);
  } finally {
    isLoading.value = false;
  }
}

function signInWithCustomUrl() {
  window.open('https://objednavky.ceskajidelna.cz/login', '_blank');
}

</script>

<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-card fade-in">
        <div class="login-header">
          <h1 class="login-title">
            <i class="bi bi-fork-knife"></i>
          </h1>
          <p class="login-subtitle">Your intelligent lunch management solution</p>
          <div class="login-description">
            <p>Sign in to manage your lunch orders, gift meals to friends, and explore the public lunch pool.</p>
          </div>
        </div>

        <div class="login-content">

          <button class="custom-google-btn" @click="handleGoogleLogin" :disabled="isLoading">
            <svg v-if="!isLoading" class="google-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span v-if="isLoading">Signing in...</span>
            <span v-else>Continue with Google</span>
          </button>

          <button class="custom-google-btn" @click="signInWithCustomUrl">
            Order Lunch
          </button>

          <div v-if="message" class="alert" :class="`alert-${messageType}`" @click="clearNotification">
            {{ message }}
            <span class="alert-close">×</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-lg);
  background: transparent; /* Use global animated background */
  position: relative;
}

.login-container {
  width: 100%;
  max-width: 480px;
  position: relative;
  z-index: 1;
}

.login-card {
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-xl);
  overflow: hidden;
  transition: all var(--transition-normal);
}

.login-card:hover {
  box-shadow: var(--shadow-brand);
}

.login-header {
  padding: var(--space-2xl);
  text-align: center;
  background: linear-gradient(135deg, var(--bg-card) 0%, var(--bg-secondary) 100%);
  border-bottom: 1px solid var(--border-primary);
}

.login-title {
  margin-bottom: var(--space-lg);
  display: flex;
  justify-content: center;
  align-items: center;
}

.bi-fork-knife{
  font-size: 10rem;
  color: var(--brand-secondary);
  filter: drop-shadow(0 2px 8px rgba(239, 68, 68, 0.3));
}

.login-subtitle {
  font-size: var(--font-size-lg);
  color: var(--text-secondary);
  margin: 0;
  font-weight: var(--font-weight-normal);
}

.login-content {
  padding: var(--space-2xl);
  text-align: center;
}

.login-description {
  display: flex;
  margin-top: var(--space-2xl);
}

.login-description p {
  font-size: var(--font-size-base);
  color: var(--text-secondary);
  line-height: var(--line-height-relaxed);
  margin: 0;
}

.custom-google-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  width: 100%;
  padding: var(--space-lg) var(--space-xl);
  background: var(--bg-card);
  border: 2px solid var(--border-primary);
  border-radius: var(--radius-lg);
  font-family: var(--font-family-sans);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  cursor: pointer;
  transition: all var(--transition-fast);
  margin-bottom: var(--space-lg);
  position: relative;
  overflow: hidden;
}

.custom-google-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(66, 133, 244, 0.1), transparent);
  transition: left var(--transition-slow);
  z-index: 1;
  pointer-events: none;
}

.custom-google-btn:hover::before {
  left: 100%;
}

.custom-google-btn:hover {
  border-color: #4285F4;
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.custom-google-btn:active {
  transform: translateY(0);
}

.google-icon {
  width: 20px;
  height: 20px;
  z-index: 2;
  position: relative;
}

.alert {
  padding: var(--space-md) var(--space-lg);
  border-radius: var(--radius-lg);
  border: 1px solid;
  font-weight: var(--font-weight-medium);
  position: relative;
  cursor: pointer;
  margin-top: var(--space-lg);
  transition: all var(--transition-fast);
}

.alert:hover {
  transform: translateX(4px);
}

.alert-close {
  position: absolute;
  right: var(--space-md);
  top: 50%;
  transform: translateY(-50%);
  font-size: var(--font-size-lg);
  opacity: 0.7;
  transition: opacity var(--transition-fast);
}

.alert:hover .alert-close {
  opacity: 1;
}

/* Mobile and Tablet Responsive */
@media (max-width: 768px) {
  .login-page {
    padding: var(--space-md);
    align-items: flex-start;
    padding-top: var(--space-2xl);
  }

  .login-header {
    padding: var(--space-xl) var(--space-lg);
  }

  .login-content {
    padding: var(--space-xl) var(--space-lg);
  }

  .login-title {
    font-size: var(--font-size-2xl);
  }

  .login-subtitle {
    font-size: var(--font-size-base);
  }

  .custom-google-btn {
    padding: var(--space-md) var(--space-lg);
    font-size: var(--font-size-sm);
  }

  .google-icon {
    width: 18px;
    height: 18px;
  }
}

@media (max-width: 480px) {
  .login-container {
    max-width: 100%;
  }

  .login-card {
    border-radius: var(--radius-xl);
  }

  .login-header {
    padding: var(--space-lg);
  }

  .login-content {
    padding: var(--space-lg);
  }

  .login-title {
    font-size: var(--font-size-xl);
  }

  .login-subtitle {
    font-size: var(--font-size-sm);
  }
}
</style>
