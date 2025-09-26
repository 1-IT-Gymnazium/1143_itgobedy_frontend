<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth.js';
import { useNotifications } from '../composables/useNotifications.js';
import { api, apiRequest, socketAPI } from '../utils/api.js';

const router = useRouter();
const { requireAuth } = useAuth();
const { showError, showSuccess, clearNotification, message, messageType } = useNotifications();

const pool = ref({ 1: 0, 2: 0, 3: 0 });
const userHasLunch = ref(false);
const isLoading = ref(false);
const searchQuery = ref('');

// Filtered lunches based on search
const filteredLunches = computed(() => {
  if (!searchQuery.value) return availableLunches.value;
  return availableLunches.value.filter(lunch =>
    lunch.student_name.toLowerCase().includes(searchQuery.value.toLowerCase())
  );
});

// Real-time update handlers
const handleUserInfoUpdate = (userData) => {
  userHasLunch.value = userData.lunch?.hasLunch || false;
};

const handleLunchUpdates = (data) => {
  console.log('Real-time lunch pool update received:', data);
  pool.value = {
    1: data["lunch 1"] || 0,
    2: data["lunch 2"] || 0,
    3: data["lunch 3"] || 0
  };
};

onMounted(async () => {
  // Check authentication
  if (!requireAuth()) return;

  // Set up real-time listeners
  socketAPI.onUserInfoUpdates(handleUserInfoUpdate);
  socketAPI.onLunchUpdates(handleLunchUpdates);

  // Fetch initial data
  await fetchUserLunch();
  await fetchPool();
});

onUnmounted(() => {
  // Clean up real-time listeners
  socketAPI.offUserInfoUpdates(handleUserInfoUpdate);
  socketAPI.offLunchUpdates(handleLunchUpdates);
});

async function fetchUserLunch() {
  try {
    const userData = await api.getUserInfo();
    userHasLunch.value = userData.lunch?.hasLunch || false;
  } catch (error) {
    userHasLunch.value = false;
  }
}

async function fetchPool() {
  try {
    isLoading.value = true;
    const data = await api.getLunches(); // Now uses socket connection
    pool.value = {
      1: data["lunch 1"] || 0,
      2: data["lunch 2"] || 0,
      3: data["lunch 3"] || 0
    };
    isLoading.value = false;
  } catch (error) {
    showError('Failed to load lunch pool.');
    isLoading.value = false;
  }
}

async function donateLunch() {
  try {
    isLoading.value = true;
    await apiRequest('/api/give_lunch', { method: 'POST' });
    showSuccess('Your lunch was donated to the pool!');
    userHasLunch.value = false;
    await fetchPool();
    isLoading.value = false;
  } catch (error) {
    showError('Failed to donate lunch.');
    isLoading.value = false;
  }
}

async function claimLunch(lunchNumber) {
  try {
    isLoading.value = true;
    await apiRequest('/api/request_lunch', {
      method: 'POST',
      body: JSON.stringify({ lunch_id: lunchNumber })
    });
    showSuccess(`You claimed lunch #${lunchNumber}!`);
    userHasLunch.value = true;
    await fetchPool();
    isLoading.value = false;
  } catch (error) {
    showError('Failed to claim lunch.');
    isLoading.value = false;
  }
}

function goBack() {
  router.push('/dashboard');
}
</script>

<template>
  <main class="public-pool-main">
    <div class="public-pool-container">
      <div class="public-pool-card fade-in">
        <div class="public-pool-header">
          <button class="back-btn" @click="goBack">
            <svg class="back-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to Dashboard
          </button>

          <h1 class="public-pool-title">Public Lunch Pool</h1>
          <p class="public-pool-subtitle">Available lunches donated by other students</p>
        </div>

        <div class="public-pool-content">
          <div v-if="message" class="alert" :class="`alert-${messageType}`" @click="clearNotification">
            {{ message }}
            <span class="alert-close">×</span>
          </div>

          <div class="lunches-section">
            <div v-if="isLoading" class="loading-state">
              <div class="spinner"></div>
              <p>Loading lunch pool...</p>
            </div>

            <div v-else>
              <h3 class="list-title">Lunch Pool</h3>
              <div class="pool-grid">
                <div v-for="num in [1,2,3]" :key="num" class="pool-card">
                  <div class="pool-number">Lunch #{{ num }}</div>
                  <div class="pool-qty">Available: <strong>{{ pool[num] }}</strong></div>
                  <div class="pool-actions">
                    <button v-if="!userHasLunch && pool[num] > 0" @click="claimLunch(num)" :disabled="isLoading" class="btn btn-primary claim-btn">
                      Claim
                    </button>
                    <span v-else-if="!userHasLunch && pool[num] === 0" class="no-claim">None available</span>
                  </div>
                </div>
              </div>
              <div v-if="userHasLunch" class="donate-section">
                <button @click="donateLunch" :disabled="isLoading" class="btn btn-secondary donate-btn">
                  Donate My Lunch to Pool
                </button>
                <p class="donate-hint">You can donate your lunch for today to the pool.</p>
              </div>
              <div v-else-if="pool[1] === 0 && pool[2] === 0 && pool[3] === 0" class="empty-state">
                <div class="empty-icon">
                  <i class="bi bi-arrow-left-right"></i>
                </div>
                <h3>Pool is Empty</h3>
                <p>No lunches have been donated to the public pool yet.</p>
                <p>Check back later or ask friends to donate their lunches!</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.public-pool-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-lg);
  min-height: calc(100vh - 160px);
}

.public-pool-container {
  width: 100%;
  max-width: 800px;
  position: relative;
  z-index: 1;
}

.public-pool-card {
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-xl);
  overflow: hidden;
  transition: all var(--transition-normal);
}

.public-pool-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-brand);
}

.public-pool-header {
  padding: var(--space-2xl);
  background: linear-gradient(135deg, var(--bg-card) 0%, var(--bg-secondary) 100%);
  border-bottom: 1px solid var(--border-primary);
  text-align: center;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  cursor: pointer;
  padding: var(--space-sm) 0;
  margin-bottom: var(--space-lg);
  transition: all var(--transition-fast);
  position: relative;
  overflow: hidden;
}

.back-btn:hover {
  color: var(--brand-primary);
}

.back-icon {
  width: 16px;
  height: 16px;
  stroke-width: 2;
}

.public-pool-title {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin-bottom: var(--space-sm);
  letter-spacing: -0.02em;
}

.public-pool-subtitle {
  font-size: var(--font-size-lg);
  color: var(--text-secondary);
  margin: 0;
}

.public-pool-content {
  padding: var(--space-2xl);
}

.lunches-section {
  margin-bottom: var(--space-xl);
}

.loading-state {
  text-align: center;
  padding: var(--space-3xl);
  color: var(--text-secondary);
}

.loading-state .spinner {
  margin: 0 auto var(--space-md);
}

.no-results h3 {
  color: var(--text-primary);
  margin-bottom: var(--space-sm);
}

.no-results p {
  color: var(--text-secondary);
  margin: 0;
}

.list-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin-bottom: var(--space-lg);
}

.pool-grid {
  display: grid;
  gap: var(--space-lg);
}

.pool-card {
  background: var(--bg-secondary);
  border: 2px solid var(--border-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  transition: all var(--transition-fast);
  position: relative;
  overflow: hidden;
}

.pool-card:hover {
  transform: translateY(-2px);
  border-color: var(--brand-primary);
  box-shadow: var(--shadow-md);
}

.pool-number {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin-bottom: var(--space-xs);
}

.pool-qty {
  font-size: var(--font-size-lg);
  color: var(--text-secondary);
  margin: 0;
}

.pool-actions {
  margin-top: var(--space-md);
}

.no-claim {
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
}

.donate-section {
  margin-top: var(--space-xl);
  text-align: center;
}

.donate-btn {
  padding: var(--space-sm) var(--space-lg);
}

.donate-hint {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin-top: var(--space-xs);
}

.empty-state {
  text-align: center;
  padding: var(--space-3xl);
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: var(--space-lg);
}

.empty-state h3 {
  color: var(--text-primary);
  margin-bottom: var(--space-sm);
}

.empty-state p {
  color: var(--text-secondary);
  margin: 0 0 var(--space-sm) 0;
}

/* Responsive */
@media (max-width: 768px) {
  .public-pool-main {
    padding: var(--space-md);
  }

  .public-pool-header,
  .public-pool-content {
    padding: var(--space-lg);
  }

  .public-pool-title {
    font-size: var(--font-size-2xl);
  }

  .claim-btn {
    width: 100%;
  }
}
</style>
