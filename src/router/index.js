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

// Navigation guard to check authentication and admin access
router.beforeEach((to, from, next) => {
  const isAuthenticated = localStorage.getItem('is_authenticated');

  if (to.meta.requiresAuth && !isAuthenticated) {
    // Redirect to login if trying to access protected route without authentication
    next({ name: 'login' })
  } else if (to.meta.requiresAdmin && !isUserAdmin()) {
    // Redirect to dashboard if trying to access admin route without admin privileges
    next({ name: 'dashboard' })
  } else {
    // Allow navigation
    next()
  }
})

export default router
