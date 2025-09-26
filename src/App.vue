<script setup>
import { RouterView } from 'vue-router'
import { ref, onMounted, onUnmounted, watch } from 'vue'
import AppFooter from './components/AppFooter.vue'
import AppHeader from "./components/AppHeader.vue";
import { socketAPI } from './utils/socket.js'
import { useAuth } from './composables/useAuth.js'

// Theme management
const isDarkMode = ref(false)
const { isAuthenticated } = useAuth()

// Watch for authentication changes to connect/disconnect socket
watch(isAuthenticated, (newValue) => {
  if (newValue) {
    // User authenticated - connect socket
    socketAPI.connect()
  } else {
    // User logged out - disconnect socket
    socketAPI.disconnect()
  }
}, { immediate: true }) // Changed back to true to handle page reload

// Initialize theme
onMounted(() => {
  const savedTheme = localStorage.getItem('theme')
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches

  isDarkMode.value = savedTheme ? savedTheme === 'dark' : prefersDark
  updateTheme()
})

// Cleanup socket connection on unmount
onUnmounted(() => {
  socketAPI.disconnect()
})

// Update theme
function updateTheme() {
  document.documentElement.setAttribute('data-theme', isDarkMode.value ? 'dark' : 'light')
  localStorage.setItem('theme', isDarkMode.value ? 'dark' : 'light')
}

// Toggle theme
function toggleTheme() {
  isDarkMode.value = !isDarkMode.value
  updateTheme()
}
</script>

<template>
  <head>
    <title>Obědy ITG</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Obědy ITG" />
    <link rel="icon" type="image/png" href="../assets/images/logo-no-background.png" />
    <link rel="manifest" href="../manifest.json" />
    <meta name="theme-color" content="#ef4444" />
  </head>
  <div class="app-container theme-transition">
    <AppHeader :isDarkMode="isDarkMode" @toggle-theme="toggleTheme" />
    <main class="main-content">
      <RouterView />
    </main>
    <AppFooter />
  </div>
</template>

<style>
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  width: 100vw;
  max-width: 100%;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  overflow-x: visible;
  /* Remove background so global body::before shows */
  background: transparent;
  transition: all var(--transition-normal);
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* Remove background decoration from .app-container::before, now handled globally */
</style>
