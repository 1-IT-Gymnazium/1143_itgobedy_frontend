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

    // Admin route check (frontend UX gate)
    if (to.meta.requiresAdmin) {
        const isAdmin = localStorage.getItem('user_is_admin') === 'true';
        if (!isAdmin) {
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
