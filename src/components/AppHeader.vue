<template>
  <header class="app-header">
    <div class="header-container">
      <div class="header-content">
        <img src="https://static.wixstatic.com/media/b66571_d6f3daf98b47425482c8b9ac7c3c0c9b~mv2.png" alt="ITG" class="header-logo"/>

        <!-- Navigation Menu (only show when authenticated and not on card scanner) -->
        <nav v-if="isAuthenticated && route.name !== 'card-scanner'" class="header-nav">
          <button
            @click="goToDashboard"
            class="nav-btn"
            :class="{ active: route.name === 'dashboard' }"
          >
            <i class="bi bi-house"></i>
            <span class="nav-text">Dashboard</span>
          </button>
          <!-- Admin button only for admin users -->
          <button
            v-if="isAdmin"
            @click="goToAdmin"
            class="nav-btn admin-btn"
            :class="{ active: route.name === 'admin-dashboard' }"
          >
            <i class="bi bi-gear"></i>
            <span class="nav-text">Admin</span>
          </button>
        </nav>

        <div class="header-right">
          <button
            v-if="route.name === 'card-scanner'"
            @click="requestBackToAdmin"
            class="back-scanner-btn"
          >
            <i class="bi bi-arrow-left"></i>
            <span>Back to Admin</span>
          </button>

          <button
            @click="$emit('toggle-theme')"
            class="theme-toggle"
            :aria-label="isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'"
          >
            <i v-if="!isDarkMode" class="bi bi-moon"></i>
            <i v-else class="bi bi-sun"></i>
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  background: var(--bg-card);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border-primary);
  box-shadow: var(--shadow-sm);
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  transition: all var(--transition-normal);
}

.header-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--space-lg);
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) 0; /* Reduced from var(--space-lg) */
  min-height: 80px;
}

.header-logo {
  height: 64px;
  width: auto;
  max-width: 30vw;
  transition: transform var(--transition-fast);
  filter: drop-shadow(0 2px 8px rgba(239, 68, 68, 0.1));
}

.header-logo:hover {
  transform: scale(1.05);
}

.header-nav {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-weight: var(--font-weight-medium);
  position: relative;
  overflow: hidden;
  min-width: 117px;
}

.nav-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}

.nav-btn.active {
  background: var(--brand-primary);
  color: white;
  border-color: var(--brand-primary);
}

.nav-btn.admin-btn:hover {
  background: var(--error-bg);
  color: var(--error-text);
  border-color: var(--error-text);
}

.nav-btn.admin-btn.active {
  background: var(--error-text);
  color: white;
  border-color: var(--error-text);
}

.nav-text {
  display: none;
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.back-scanner-btn {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  color: var(--text-secondary);
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.back-scanner-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}

.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px; /* Reduced from 44px */
  height: 44px; /* Reduced from 44px */
  border: none;
  border-radius: var(--radius-full);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  position: relative;
  overflow: hidden;
  margin-left: 23.25px;
  margin-right: 23.25px;
}

.theme-toggle:hover {
  background: var(--bg-tertiary);
  color: var(--brand-primary);
  transform: scale(1.1);
}

.theme-toggle:focus {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
}

.theme-toggle i {
  font-size: 16px; /* Fixed size for icons */
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (min-width: 640px) {
  .nav-text {
    display: inline;
  }
}

@media (max-width: 768px) {
  .header-container {
    padding: 0 var(--space-md);
  }

  .header-content {
    padding: var(--space-xs) 0; /* Even smaller on mobile */
    min-height: 64px; /* Smaller on mobile */
  }

  .header-logo {
    height: 32px; /* Smaller logo on mobile */
    max-width: 60vw;
  }

  .theme-toggle {
    width: 32px;
    height: 32px;
  }

  .theme-toggle i {
    font-size: 14px;
  }

  .header-nav {
    gap: var(--space-sm);
  }

  .nav-btn {
    padding: var(--space-xs) var(--space-sm);
  }
}

@media (max-width: 480px) {
  .header-logo {
    height: 28px;
    max-width: 75vw;
  }
}
</style>

<script setup>
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '../composables/useAuth.js'

defineProps({
  isDarkMode: Boolean
})

defineEmits(['toggle-theme'])

const router = useRouter()
const route = useRoute()
const { isAuthenticated, isAdminComputed } = useAuth()
const isAdmin = isAdminComputed

function requestBackToAdmin() {
  window.dispatchEvent(new CustomEvent('back-to-admin'));
}

function goToAdmin() {
  router.push('/admin')
}

function goToDashboard() {
  router.push('/dashboard')
}
</script>
