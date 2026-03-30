import { createRouter, createWebHistory } from 'vue-router'
import LoginPage from '../components/LoginPage.vue'
import Dashboard from '../components/Dashboard.vue'
import NotFound from '../components/NotFound.vue'
import PublicPool from '../components/PublicPool.vue';
import GiftLunch from '../components/GiftLunch.vue';
import AdminDashboard from '../components/AdminDashboard.vue';
import CardScanner from '../components/CardScanner.vue';
import CardAssignment from '../components/CardAssignment.vue';
import UserManagement from '../components/UserManagement.vue';
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
      path: '/admin/user-management',
      name: 'user-management',
      component: UserManagement,
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

// Track if we're in the middle of a logout
export let isLoggingOut = false;

// Utility function to decode JWT without external libraries
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = parts[1];
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

// Validate admin access by checking JWT token
function validateAdminAccess() {
  try {
    const token = getJWTFromCookie();
    if (!token) {
      console.warn('No JWT token found');
      return false;
    }

    const decoded = decodeJWT(token);
    if (!decoded) {
      console.warn('Failed to decode JWT token');
      return false;
    }

    // Check various common admin claim patterns in JWT
    const isAdmin = decoded.isAdmin === true || 
                    decoded.is_admin === true || 
                    decoded.admin === true ||
                    (decoded.role && decoded.role === 'admin');

    if (!isAdmin) {
      console.warn('User is not admin according to JWT token');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Admin validation failed:', error);
    return false;
  }
}

// Navigation guard to check authentication and admin access
router.beforeEach((to, from, next) => {
    const token = document.cookie.includes('access_token_cookie');
    const publicPages = ['/', '/server-error'];
    const authRequired = !publicPages.includes(to.path);


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

    // Auth check
    if (authRequired && !token) {
        return next('/');
    }

    // Admin route check - validate JWT token locally (no backend call)
    if (to.meta.requiresAdmin) {
        const isAdmin = validateAdminAccess();
        if (!isAdmin) {
            console.warn('User attempted to access admin route without proper admin status in JWT');
            return next('/dashboard');
        }
    }

    // Redirect authenticated users away from login page
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
