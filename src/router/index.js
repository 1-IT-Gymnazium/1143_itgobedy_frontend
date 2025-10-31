import { createRouter, createWebHistory } from 'vue-router'
import LoginPage from '../components/LoginPage.vue'
import Dashboard from '../components/Dashboard.vue'
import NotFound from '../components/NotFound.vue'
import PublicPool from '../components/PublicPool.vue';
import GiftLunch from '../components/GiftLunch.vue';
import AdminDashboard from '../components/AdminDashboard.vue';
import CardScanner from '../components/CardScanner.vue';
import CardAssignment from '../components/CardAssignment.vue';
import ServerError from "@/components/ServerError.vue";
import {socketAPI} from "@/utils/api.js";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'login',
      component: LoginPage
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: Dashboard,
      meta: { requiresAuth: true }
    },
    {
      path: '/gift-lunch',
      name: 'gift-lunch',
      component: GiftLunch,
      meta: { requiresAuth: true }
    },
    {
      path: '/public-pool',
      name: 'public-pool',
      component: PublicPool,
      meta: { requiresAuth: true }
    },
    {
      path: '/admin',
      name: 'admin-dashboard',
      component: AdminDashboard,
      meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
      path: '/admin/card-scanner',
      name: 'card-scanner',
      component: CardScanner,
      meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
      path: '/admin/card-assignment',
      name: 'card-assignment',
      component: CardAssignment,
      meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
      path: '/server-error',
      name: 'server-error',
      component: ServerError,
      meta: { requiresAuth: true }
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'NotFound',
      component: NotFound
    } // Catch-all
  ]
})

// Helper function to check if user is admin (now using environment variables)
function isUserAdmin() {
  const userEmail = localStorage.getItem('user_email');
  if (!userEmail) return false;

  // Get admin emails from environment variable
  const adminEmailsString = import.meta.env.VITE_ADMIN_EMAILS || '';
  const adminEmails = adminEmailsString.split(',').map(email => email.trim()).filter(email => email);

  return adminEmails.includes(userEmail);
}

// Track if we're in the middle of a logout
export let isLoggingOut = false;

// Navigation guard to check authentication and admin access
router.beforeEach((to, from, next) => {
  const token = document.cookie.includes('access_token_cookie');
    const publicPages = ['/', '/NotFound', '/server-error'];
    const authRequired = !publicPages.includes(to.path);

    // Prevent infinite redirect loop
    if (authRequired && !token) {
        if (to.path !== '/') {
            return next('/');
        }
    }

    // Check socket connection for public pages (except during logout)
    if (!authRequired && !isLoggingOut) {
        const socket = socketAPI.getSocket();
        if (socket && !socket.connected) {
            if (to.path === '/') {
                return next();
            } else if (to.path !== '/server-error' && to.path !== '/') {
                return next('/server-error');
            }
        }
    }

    // Reset logout flag after navigation
    if (isLoggingOut && to.path === '/') {
        isLoggingOut = false;
    }

    if (authRequired && !token) {
        return next('/');
    }

    if (!authRequired && token && to.path === '/') {
        return next('/dashboard');
    }

    next();
});

// Export function to set logout state
export function setLoggingOut(value) {
    isLoggingOut = value;
}

export default router
