<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth.js';

const router = useRouter();
const { logout } = useAuth();

// Reactive data
const currentTime = ref('');
const stats = ref({
  lunchCount: 0,
  availableCount: 0,
  recentActivityCount: 0,
  totalStudents: 0,
  studentsWithLunch: 0,
  studentsWithoutLunch: 0
});
const recentAssignments = ref([]);
const isLoading = ref(true);
const betaBannerVisible = ref(true);

// Time update interval
let timeInterval = null;

onMounted(async () => {
  updateTime();
  timeInterval = setInterval(updateTime, 1000);
  await fetchDashboardData();
});

onUnmounted(() => {
  if (timeInterval) {
    clearInterval(timeInterval);
  }
});

function updateTime() {
  const now = new Date();
  const time = now.toLocaleTimeString('en-GB');
  const date = now.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  currentTime.value = `${date}, ${time}`;
}

async function fetchDashboardData() {
  try {
    // Simulate API call - replace with actual API endpoints
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mock data - replace with actual API calls
    stats.value = {
      lunchCount: 45,
      availableCount: 12,
      recentActivityCount: 23,
      totalStudents: 150,
      studentsWithLunch: 45,
      studentsWithoutLunch: 105
    };

    recentAssignments.value = [
      { studentName: 'John Doe', lunchId: '001' },
      { studentName: 'Jane Smith', lunchId: '002' },
      { studentName: 'Mike Johnson', lunchId: '003' }
    ];

    isLoading.value = false;
  } catch (error) {
    console.error('Failed to fetch dashboard data:', error);
    isLoading.value = false;
  }
}

function handleLogout() {
  logout();
  router.push('/login');
}

function goToCardScanner() {
  router.push('/admin/card-scanner');
}

function goToCardAssignment() {
  router.push('/admin/card-assignment');
}

function closeBetaBanner() {
  betaBannerVisible.value = false;
}
</script>

<template>
  <div class="admin-dashboard">

    <!-- Header -->
    <header class="dashboard-header">
      <div class="header-container">
        <div class="header-content">
          <!-- Logout button -->
          <button @click="handleLogout" class="logout-btn">
            <i class="bi bi-box-arrow-right"></i>
            <span class="logout-text">Logout</span>
          </button>

          <!-- Logo -->
          <div class="logo-container">
            <i class="bi bi-fork-knife logo-icon"></i>
          </div>

          <!-- Current time -->
          <div class="time-display">
            {{ currentTime }}
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="dashboard-main">
      <div class="dashboard-container">
        <!-- Loading state -->
        <div v-if="isLoading" class="loading-state">
          <div class="loading-spinner"></div>
          <p>Loading dashboard...</p>
        </div>

        <!-- Dashboard content -->
        <div v-else>
          <!-- Stats Cards -->
          <div class="stats-grid">
            <!-- Today's Lunch Orders -->
            <div class="stat-card lunch-orders">
              <div class="stat-header">
                <h3 class="stat-title">Today's Lunch Orders</h3>
                <div class="stat-icon red">
                  <i class="bi bi-utensils"></i>
                </div>
              </div>
              <div class="stat-value red">{{ stats.lunchCount }}</div>
              <div class="stat-description">Total lunches ordered for today</div>
            </div>

            <!-- Available Lunches -->
            <div class="stat-card available-lunches">
              <div class="stat-header">
                <h3 class="stat-title">Available Lunches</h3>
                <div class="stat-icon green">
                  <i class="bi bi-box-seam"></i>
                </div>
              </div>
              <div class="stat-value green">{{ stats.availableCount }}</div>
              <div class="stat-description">Lunches available in the pool</div>
            </div>

            <!-- Recent Activity -->
            <div class="stat-card recent-activity">
              <div class="stat-header">
                <h3 class="stat-title">Recent Activity</h3>
                <div class="stat-icon blue">
                  <i class="bi bi-people"></i>
                </div>
              </div>
              <div class="stat-value blue">{{ stats.recentActivityCount }}</div>
              <div class="stat-description">Student logins in the last 24 hours</div>
            </div>
          </div>

          <!-- Administrative Tools -->
          <div class="admin-tools-section">
            <h2 class="section-title">Administrative Tools</h2>
            <div class="tools-grid">
              <!-- Card Scanner -->
              <div class="tool-card scanner" @click="goToCardScanner">
                <div class="tool-icon red">
                  <i class="bi bi-credit-card"></i>
                </div>
                <h3 class="tool-title">Card Scanner</h3>
                <p class="tool-description">Scan student cards and view scan history</p>
              </div>

              <!-- Card Assignment -->
              <div class="tool-card assignment" @click="goToCardAssignment">
                <div class="tool-icon blue">
                  <i class="bi bi-person-badge"></i>
                </div>
                <h3 class="tool-title">Card Assignment</h3>
                <p class="tool-description">Assign NFC cards to students</p>
              </div>
            </div>
          </div>

          <!-- Analytics Section -->
          <div class="analytics-grid">
            <!-- Student Lunch Status -->
            <div class="analytics-card lunch-status">
              <h2 class="analytics-title">Student Lunch Status</h2>
              <div class="status-stats">
                <div class="status-item">
                  <div class="status-value red">{{ stats.totalStudents }}</div>
                  <div class="status-label">Total Students</div>
                </div>
                <div class="status-item">
                  <div class="status-value green">{{ stats.studentsWithLunch }}</div>
                  <div class="status-label">With Lunch</div>
                </div>
                <div class="status-item">
                  <div class="status-value yellow">{{ stats.studentsWithoutLunch }}</div>
                  <div class="status-label">Without Lunch</div>
                </div>
              </div>
            </div>

            <!-- Recent Lunch Assignments -->
            <div class="analytics-card recent-assignments">
              <h2 class="analytics-title">Recent Lunch Assignments</h2>
              <div class="assignments-list">
                <div v-if="recentAssignments.length > 0" class="assignments-content">
                  <div v-for="assignment in recentAssignments" :key="assignment.lunchId" class="assignment-item">
                    <span class="assignment-name">{{ assignment.studentName }}</span>
                    <span class="assignment-lunch">Lunch #{{ assignment.lunchId }}</span>
                  </div>
                </div>
                <div v-else class="no-assignments">
                  <p>No recent lunch assignments</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.admin-dashboard {
  min-height: 100vh;
  background: transparent;
  display: flex;
  flex-direction: column;
}

/* Header */
.dashboard-header {
  background: var(--brand-primary);
  padding: var(--space-xl) 0;
  box-shadow: var(--shadow-md);
  position: relative;
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
  position: relative;
}

.logout-btn {
  background: var(--bg-card);
  color: var(--brand-primary);
  padding: var(--space-md) var(--space-lg);
  border: none;
  border-radius: var(--radius-lg);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  transition: all var(--transition-fast);
  box-shadow: var(--shadow-sm);
}

.logout-btn:hover {
  background: var(--bg-secondary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.logout-text {
  display: none;
}

.logo-container {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.logo-icon {
  font-size: 4rem;
  color: white;
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.2));
  transition: transform var(--transition-fast);
}

.logo-icon:hover {
  transform: scale(1.05);
}

.time-display {
  color: white;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  display: none;
}

/* Main Content */
.dashboard-main {
  flex: 1;
  padding: var(--space-2xl) 0;
}

.dashboard-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--space-lg);
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  color: var(--text-secondary);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--border-primary);
  border-top: 4px solid var(--brand-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: var(--space-lg);
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--space-xl);
  margin-bottom: var(--space-2xl);
}

.stat-card {
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-2xl);
  padding: var(--space-xl);
  box-shadow: var(--shadow-lg);
  transition: all var(--transition-normal);
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-xl);
}

.stat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
}

.stat-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin: 0;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xl);
}

.stat-icon.red {
  background: var(--error-bg);
  color: var(--error-text);
}

.stat-icon.green {
  background: var(--success-bg);
  color: var(--success-text);
}

.stat-icon.blue {
  background: var(--info-bg);
  color: var(--info-text);
}

.stat-value {
  font-size: var(--font-size-4xl);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--space-sm);
}

.stat-value.red { color: var(--error-text); }
.stat-value.green { color: var(--success-text); }
.stat-value.blue { color: var(--info-text); }

.stat-description {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

/* Administrative Tools */
.admin-tools-section {
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-2xl);
  padding: var(--space-xl);
  margin-bottom: var(--space-2xl);
  box-shadow: var(--shadow-lg);
}

.section-title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin: 0 0 var(--space-xl) 0;
  padding-bottom: var(--space-md);
  border-bottom: 1px solid var(--border-primary);
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-xl);
}

.tool-card {
  background: var(--bg-secondary);
  border-radius: var(--radius-xl);
  padding: var(--space-xl);
  text-align: center;
  cursor: pointer;
  transition: all var(--transition-normal);
  position: relative;
  overflow: hidden;
}

.tool-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

.tool-card.scanner:hover {
  background: var(--error-bg);
}

.tool-card.assignment:hover {
  background: var(--info-bg);
}

.tool-icon {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto var(--space-lg);
  font-size: var(--font-size-2xl);
}

.tool-icon.red {
  background: var(--error-bg);
  color: var(--error-text);
}

.tool-icon.blue {
  background: var(--info-bg);
  color: var(--info-text);
}

.tool-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--space-sm) 0;
}

.tool-description {
  color: var(--text-secondary);
  margin: 0;
}

/* Analytics Grid */
.analytics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: var(--space-2xl);
}

.analytics-card {
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-2xl);
  padding: var(--space-xl);
  box-shadow: var(--shadow-lg);
}

.analytics-title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin: 0 0 var(--space-xl) 0;
  padding-bottom: var(--space-md);
  border-bottom: 1px solid var(--border-primary);
}

/* Student Status */
.status-stats {
  display: flex;
  justify-content: space-around;
  text-align: center;
}

.status-item {
  flex: 1;
}

.status-value {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--space-sm);
}

.status-value.red { color: var(--error-text); }
.status-value.green { color: var(--success-text); }
.status-value.yellow { color: var(--warning-text); }

.status-label {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

/* Recent Assignments */
.assignments-list {
  max-height: 240px;
  overflow-y: auto;
}

.assignments-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.assignment-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
}

.assignment-name {
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
}

.assignment-lunch {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.no-assignments {
  text-align: center;
  color: var(--text-secondary);
  padding: var(--space-xl);
}

/* Responsive Design */
@media (min-width: 640px) {
  .logout-text {
    display: inline;
  }
}

@media (min-width: 768px) {
  .time-display {
    display: block;
  }

  .dashboard-container {
    padding: 0 var(--space-xl);
  }
}

@media (max-width: 768px) {
  .dashboard-header {
    padding: var(--space-lg) 0;
  }

  .header-content {
    flex-direction: column;
    gap: var(--space-md);
  }

  .logo-container {
    position: static;
    transform: none;
  }

  .stats-grid {
    grid-template-columns: 1fr;
    gap: var(--space-lg);
  }

  .tools-grid {
    grid-template-columns: 1fr;
  }

  .analytics-grid {
    grid-template-columns: 1fr;
    gap: var(--space-lg);
  }

  .status-stats {
    flex-direction: column;
    gap: var(--space-lg);
  }
}

@media (max-width: 480px) {
  .dashboard-container {
    padding: 0 var(--space-md);
  }

  .dashboard-main {
    padding: var(--space-lg) 0;
  }

  .stat-card,
  .admin-tools-section,
  .analytics-card {
    padding: var(--space-lg);
  }
}
</style>