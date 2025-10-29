<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth.js';
import { useNotifications } from '../composables/useNotifications.js';
import { api, socketAPI } from '../utils/api.js';
import { withSocketRetry } from '../composables/useSocketRetry.js';

const router = useRouter();
const { requireAuth } = useAuth();
const { showError, showSuccess, clearNotification, message, messageType } = useNotifications();

const students = ref([]);
const selectedStudent = ref(null);
const searchQuery = ref('');
const isLoading = ref(false);
const userHasLunch = ref(false);

// Computed property for filtered students (only those without lunch)
const filteredStudents = computed(() => {
  const noLunch = students.value.filter(s => !s.has_lunch);
  if (!searchQuery.value) return noLunch;
  const q = searchQuery.value.toLowerCase();
  return noLunch.filter(student =>
    student.full_name.toLowerCase().includes(q)
  );
});

// Real-time update handlers
const handleUserInfoUpdate = (userData) => {
  const hasLunch = userData.lunch?.hasLunch || false;
  userHasLunch.value = hasLunch;

  if (!hasLunch) {
    showError("You don't have lunch to gift.");
  }
};

const handleStudentUpdates = (data) => {
  console.log('Real-time students update received:', data);
  students.value = data.students || [];
};

onMounted(async () => {
  // Check authentication
  if (!requireAuth()) return;

  // Set up real-time listeners
  socketAPI.onUserInfoUpdates(handleUserInfoUpdate);
  socketAPI.onStudentUpdates(handleStudentUpdates);

  // Check if user has lunch to gift and load students
  await Promise.all([
    checkUserLunchStatus(),
    loadStudents()
  ]);
});

onUnmounted(() => {
  // Clean up real-time listeners
  socketAPI.offUserInfoUpdates(handleUserInfoUpdate);
  socketAPI.offStudentUpdates(handleStudentUpdates);
});

async function checkUserLunchStatus() {
  try {
    const userData = await withSocketRetry(() => api.getUserInfo());
    userHasLunch.value = userData.lunch?.hasLunch || false;

    if (!userHasLunch.value) {
      showError("You don't have lunch to gift.");
    }
  } catch (error) {
    console.error('Error checking lunch status:', error);
    showError('Failed to check lunch status.');
  }
}

async function loadStudents() {
  try {
    isLoading.value = true;
    const data = await withSocketRetry(() => api.getStudents());
    students.value = data.students || [];
  } catch (error) {
    console.error('Error loading students:', error);
    showError('Failed to load students list.');
  } finally {
    isLoading.value = false;
  }
}

async function giftLunch() {
  if (!selectedStudent.value) {
    showError('Please select a student to gift your lunch to.');
    return;
  }

  if (!userHasLunch.value) {
    showError("You don't have lunch to gift.");
    return;
  }

  try {
    isLoading.value = true;

    await api.giftLunch({
      student_id: selectedStudent.value.id,
    });

    showSuccess(`Successfully gifted your lunch to ${selectedStudent.value.full_name}!`);
    userHasLunch.value = false;
    selectedStudent.value = null;

    // Update localStorage to reflect that user no longer has lunch
    localStorage.removeItem('lunchNumber');
  } catch (error) {
    console.error('Error gifting lunch:', error);
    showError(error.message || 'Failed to gift lunch.');
  } finally {
    isLoading.value = false;
  }
}

function goBack() {
  router.push('/dashboard');
}
</script>

<template>
  <main class="gift-lunch-main">
    <div class="gift-lunch-container">
      <div class="gift-lunch-card fade-in">
        <div class="gift-lunch-header">
          <button class="back-btn" @click="goBack">
            <svg class="back-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to Dashboard
          </button>

          <h1 class="gift-lunch-title">Gift Your Lunch</h1>
          <p class="gift-lunch-subtitle">Select a student to share your meal with</p>
        </div>

        <div class="gift-lunch-content">
          <!-- Message display -->
          <div v-if="message" class="alert" :class="`alert-${messageType}`" @click="clearNotification">
            {{ message }}
            <span class="alert-close">×</span>
          </div>

          <!-- Search bar -->
          <div class="search-section">
            <div class="search-wrapper">
              <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search for a student..."
                class="search-input"
                :disabled="!userHasLunch"
              />
            </div>
          </div>

          <!-- Students list -->
          <div v-if="userHasLunch" class="students-section">
            <div v-if="isLoading" class="loading-state">
              <div class="spinner"></div>
              <p>Loading students...</p>
            </div>

            <div v-else-if="filteredStudents.length === 0" class="no-results">
              <div class="no-results-icon">👥</div>
              <h3>No students found</h3>
              <p v-if="searchQuery">Try a different search term</p>
              <p v-else>No students available at the moment</p>
            </div>

            <div v-else class="student-list">
              <h3 class="list-title">Available Students ({{ filteredStudents.length }})</h3>
              <div class="student-grid">
                <div
                  v-for="student in filteredStudents"
                  :key="student.id"
                  class="student-card"
                  :class="{ selected: selectedStudent && selectedStudent.id === student.id }"
                  @click="selectedStudent = student"
                >
                  <!-- Replace the .student-avatar div in the student-card -->
                  <div class="student-avatar">
                    <img v-if="student.picture" :src="student.picture" alt="Profile" class="avatar-img" />
                    <span v-else>
                      {{ student.full_name.charAt(0).toUpperCase() }}
                    </span>
                  </div>
                  <div class="student-info">
                    <h4 class="student-name">{{ student.full_name }}</h4>
                    <p class="student-status">Available</p>
                  </div>
                  <div v-if="selectedStudent && selectedStudent.id === student.id" class="selected-indicator">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <polyline points="20,6 9,17 4,12"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- No lunch state -->
          <div v-else class="no-lunch-state">
            <div class="no-lunch-icon">
              <i class="bi bi-fork-knife lunch-icon"></i>
            </div>
            <h3>No Lunch to Gift</h3>
            <p>You don't have any lunch ordered for today that you can gift to others.</p>
            <button @click="goBack" class="btn btn-secondary">
              Return to Dashboard
            </button>
          </div>
        </div>

        <!-- Gift button -->
        <div v-if="userHasLunch" class="gift-lunch-footer">
          <button
            @click="giftLunch"
            :disabled="!selectedStudent || isLoading"
            class="btn btn-primary gift-btn"
          >
            <svg v-if="isLoading" class="btn-icon spinner" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/>
            </svg>
            <svg v-else class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6"/>
              <path d="M12 2v10m0 0l3-3m-3 3l-3-3"/>
            </svg>
            {{ isLoading ? 'Gifting...' : 'Gift Lunch' }}
          </button>
          <p class="gift-disclaimer">
            This will transfer your lunch to the selected student
          </p>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.gift-lunch-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-lg);
  min-height: calc(100vh - 160px);
}

.gift-lunch-container {
  width: 100%;
  max-width: 700px;
  position: relative;
}

.gift-lunch-card {
  background: rgba(255,255,255,0.85); /* semi-transparent for light theme */
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-xl);
  overflow: hidden;
  transition: all var(--transition-normal);
}
[data-theme="dark"] .gift-lunch-card {
  background: rgba(32,32,32,0.85); /* semi-transparent for dark theme */
}

.gift-lunch-header {
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

.gift-lunch-title {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin-bottom: var(--space-sm);
  letter-spacing: -0.02em;
}

.gift-lunch-subtitle {
  font-size: var(--font-size-lg);
  color: var(--text-secondary);
  margin: 0;
}

.gift-lunch-content {
  padding: var(--space-2xl);
}

.search-section {
  margin-bottom: var(--space-2xl);
}

.search-wrapper {
  position: relative;
}

.search-icon {
  position: absolute;
  left: var(--space-md);
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  color: var(--text-tertiary);
  stroke-width: 2;
}

.search-input {
  width: 100%;
  padding: var(--space-md) var(--space-md) var(--space-md) var(--space-3xl);
  font-size: var(--font-size-base);
  color: var(--text-primary);
  background: var(--bg-secondary);
  border: 2px solid var(--border-primary);
  border-radius: var(--radius-lg);
  transition: all var(--transition-fast);
  box-sizing: border-box;
}

.search-input:focus {
  outline: none;
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.search-input:disabled {
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
  cursor: not-allowed;
}

.students-section {
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

.no-results {
  text-align: center;
  padding: var(--space-3xl);
}

.no-results-icon {
  font-size: 4rem;
  margin-bottom: var(--space-lg);
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
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin-bottom: var(--space-lg);
}

.student-grid {
  display: grid;
  gap: var(--space-md);
  max-height: 400px;
  overflow-y: auto;
}

.student-card {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-lg);
  background: var(--bg-secondary);
  border: 2px solid var(--border-primary);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
  position: relative;
  overflow: hidden;
}

.student-card:hover {
  transform: translateY(-1px);
  border-color: var(--brand-primary);
  box-shadow: var(--shadow-md);
}

.student-card.selected {
  border-color: var(--brand-primary);
  background-color: #42b883;
}

.student-avatar {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-full);
  background: var(--brand-primary);
  color: var(--text-inverse);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-lg);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--radius-full);
  display: block;
}

.student-info {
  flex: 1;
}

.student-name {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--space-xs) 0;
}

.student-status {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin: 0;
}

.selected-indicator {
  width: 24px;
  height: 24px;
  color: var(--brand-primary);
}

.selected-indicator svg {
  width: 100%;
  height: 100%;
  stroke-width: 3;
}

.alert {
  margin-bottom: var(--space-lg);
  cursor: pointer;
}

.no-lunch-state {
  text-align: center;
  padding: var(--space-3xl);
}

.no-lunch-icon {
  font-size: 4rem;
  margin-bottom: var(--space-lg);
  filter: grayscale(1);
}

.no-lunch-state h3 {
  color: var(--text-primary);
  margin-bottom: var(--space-sm);
}

.no-lunch-state p {
  color: var(--text-secondary);
  margin-bottom: var(--space-xl);
}

.gift-lunch-footer {
  padding: var(--space-xl) var(--space-2xl);
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-primary);
  text-align: center;
}

.gift-btn {
  width: 100%;
  max-width: 300px;
  margin-bottom: var(--space-md);
}

.btn-icon {
  width: 20px;
  height: 20px;
  stroke-width: 2;
}

.gift-disclaimer {
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
  margin: 0;
}

/* Responsive */
@media (max-width: 640px) {
  .gift-lunch-main {
    padding: var(--space-md);
  }

  .gift-lunch-header,
  .gift-lunch-content,
  .gift-lunch-footer {
    padding: var(--space-lg);
  }

  .gift-lunch-title {
    font-size: var(--font-size-2xl);
  }

  .student-card {
    padding: var(--space-md);
  }

  .student-avatar {
    width: 40px;
    height: 40px;
    font-size: var(--font-size-base);
  }
}
</style>
