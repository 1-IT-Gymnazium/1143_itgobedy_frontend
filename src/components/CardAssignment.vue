<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { io } from 'socket.io-client';
import { useNotifications } from '../composables/useNotifications.js';
import { api, socketAPI } from '../utils/api.js';
import { withSocketRetry } from '../composables/useSocketRetry.js';

const router = useRouter();
const { showError, showSuccess, clearNotification, message, messageType } = useNotifications();

const students = ref([]);
const selectedStudent = ref(null);
const searchQuery = ref('');
const isLoading = ref(false);
const cardUid = ref('');
const cardStatus = ref('Waiting for card...');
const isCardScanned = ref(false);

// Socket connection for card reader
let cardReaderSocket = null;

// Computed property for filtered students (only those without lunch)
const filteredStudents = computed(() => {
  const noLunch = students.value.filter(s => !s.has_card);
  if (!searchQuery.value) return noLunch;
  const q = searchQuery.value.toLowerCase();
  return noLunch.filter(student =>
      student.full_name.toLowerCase().includes(q)
  );
});

// Real-time student updates handler
const handleStudentUpdates = (data) => {
  console.log('Real-time students update received:', data);
  students.value = data.students || [];
};

onMounted(async () => {
  // Set up real-time listeners for students
  socketAPI.onStudentUpdates(handleStudentUpdates);

  // Initialize card reader socket
  initializeCardReaderSocket();

  // Load students
  await loadStudents();
});

onUnmounted(() => {
  // Clean up real-time listeners
  socketAPI.offStudentUpdates(handleStudentUpdates);

  // Disconnect card reader socket
  if (cardReaderSocket) {
    cardReaderSocket.disconnect();
  }
});

function initializeCardReaderSocket() {
  cardReaderSocket = io('http://localhost:3001', {
    transports: ['websocket'],
    upgrade: false
  });

  cardReaderSocket.on('connect', () => {
    console.log('Connected to card reader server');
  });

  cardReaderSocket.on('card_scanned', (data) => {
    if (data.uid) {
      cardStatus.value = `Card Detected! UID: ${data.uid}`;
      cardUid.value = data.uid;
      isCardScanned.value = true;
      showSuccess('Card scanned successfully!');
    } else if (data.student_id) {
      cardStatus.value = 'Card Already Assigned!';
      cardUid.value = '';
      isCardScanned.value = false;
      showError('This card is already assigned to a student.');
    }
  });

  cardReaderSocket.on('disconnect', () => {
    console.log('Disconnected from card reader server');
    cardStatus.value = 'Disconnected from card reader...';
  });
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

async function assignCard() {
  if (!selectedStudent.value) {
    showError('Please select a student to assign the card to.');
    return;
  }

  if (!cardUid.value) {
    showError('Please scan a card first.');
    return;
  }

  try {
    isLoading.value = true;

    await api.assignCard({
      student_name: selectedStudent.value.full_name,
      card_uid: cardUid.value
    });

    showSuccess(`Successfully assigned card to ${selectedStudent.value.full_name}!`);

    // Reset state
    selectedStudent.value = null;
    cardUid.value = '';
    cardStatus.value = 'Waiting for card...';
    isCardScanned.value = false;

    // Reload students to get updated data
    await loadStudents();
  } catch (error) {
    console.error('Error assigning card:', error);
    showError(error.message || 'Failed to assign card.');
  } finally {
    isLoading.value = false;
  }
}

function goBack() {
  router.push('/admin');
}
</script>

<template>
  <main class="card-assignment-main">
    <div class="card-assignment-container">
      <div class="card-assignment-card fade-in">
        <div class="card-assignment-header">
          <button class="back-btn" @click="goBack">
            <svg class="back-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to Admin
          </button>

          <h1 class="card-assignment-title">Assign NFC Card</h1>
          <p class="card-assignment-subtitle">Select a student and scan their card</p>
        </div>

        <div class="card-assignment-content">
          <!-- Message display -->
          <div v-if="message" class="alert" :class="`alert-${messageType}`" @click="clearNotification">
            {{ message }}
            <span class="alert-close">×</span>
          </div>

          <!-- Card Status Section -->
          <div class="card-status-section">
            <div class="card-status-card" :class="{
              'status-success': isCardScanned,
              'status-warning': cardStatus.includes('Already Assigned'),
              'status-waiting': !isCardScanned && !cardStatus.includes('Already Assigned')
            }">
              <i class="status-icon" :class="{
                'bi bi-check-circle-fill': isCardScanned,
                'bi bi-exclamation-triangle-fill': cardStatus.includes('Already Assigned'),
                'bi bi-card-heading': !isCardScanned && !cardStatus.includes('Already Assigned')
              }"></i>
              <div class="status-info">
                <h3 class="status-title">{{ isCardScanned ? 'Card Ready' : 'Scan Card' }}</h3>
                <p class="status-text">{{ cardStatus }}</p>
              </div>
            </div>
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
              />
            </div>
          </div>

          <!-- Students list -->
          <div class="students-section">
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
              <h3 class="list-title">Select Student ({{ filteredStudents.length }})</h3>
              <div class="student-grid">
                <div
                  v-for="student in filteredStudents"
                  :key="student.id"
                  class="student-card"
                  :class="{ selected: selectedStudent && selectedStudent.id === student.id }"
                  @click="selectedStudent = student"
                >
                  <div class="student-avatar">
                    <img v-if="student.picture" :src="student.picture" alt="Profile" class="avatar-img" />
                    <span v-else>
                      {{ student.full_name.charAt(0).toUpperCase() }}
                    </span>
                  </div>
                  <div class="student-info">
                    <h4 class="student-name">{{ student.full_name }}</h4>
                    <p class="student-status">{{ student.card_id ? 'Card Assigned' : 'No Card' }}</p>
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
        </div>

        <!-- Assign button -->
        <div class="card-assignment-footer">
          <button
            @click="assignCard"
            :disabled="!selectedStudent || !isCardScanned || isLoading"
            class="btn btn-primary assign-btn"
          >
            <svg v-if="isLoading" class="btn-icon spinner" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/>
            </svg>
            <i v-else class="bi bi-card-heading btn-icon"></i>
            {{ isLoading ? 'Assigning...' : 'Assign Card' }}
          </button>
          <p class="assign-disclaimer">
            This will assign the scanned card to the selected student
          </p>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.card-assignment-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-lg);
  min-height: calc(100vh - 160px);
}

.card-assignment-container {
  width: 100%;
  max-width: 700px;
  position: relative;
}

.card-assignment-card {
  background: rgba(255,255,255,0.85);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-xl);
  overflow: hidden;
  transition: all var(--transition-normal);
}

[data-theme="dark"] .card-assignment-card {
  background: rgba(32,32,32,0.85);
}

.card-assignment-header {
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

.card-assignment-title {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin-bottom: var(--space-sm);
  letter-spacing: -0.02em;
}

.card-assignment-subtitle {
  font-size: var(--font-size-lg);
  color: var(--text-secondary);
  margin: 0;
}

.card-assignment-content {
  padding: var(--space-2xl);
}

/* Card Status Section */
.card-status-section {
  margin-bottom: var(--space-2xl);
}

.card-status-card {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  padding: var(--space-xl);
  background: var(--bg-secondary);
  border: 2px solid var(--border-primary);
  border-radius: var(--radius-lg);
  transition: all var(--transition-fast);
}

.card-status-card.status-success {
  border-color: var(--success-border);
  background: var(--success-bg);
}

.card-status-card.status-warning {
  border-color: var(--warning-border);
  background: var(--warning-bg);
}

.card-status-card.status-waiting {
  border-color: var(--border-secondary);
}

.status-icon {
  font-size: 2.5rem;
  flex-shrink: 0;
}

.status-success .status-icon {
  color: var(--success-text);
}

.status-warning .status-icon {
  color: var(--warning-text);
}

.status-waiting .status-icon {
  color: var(--text-tertiary);
}

.status-info {
  flex: 1;
}

.status-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--space-xs) 0;
}

.status-text {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin: 0;
}

/* Search Section */
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
  box-shadow: 0 0 0 3px rgba(66, 184, 131, 0.1);
}

/* Students Section */
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
  width: 48px;
  height: 48px;
  border: 4px solid var(--border-primary);
  border-top-color: var(--brand-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
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
  color: var(--text-inverse);
}

.student-card.selected .student-name,
.student-card.selected .student-status {
  color: var(--text-inverse);
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
  flex-shrink: 0;
}

.student-card.selected .student-avatar {
  background: rgba(255, 255, 255, 0.2);
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
  color: var(--text-inverse);
  flex-shrink: 0;
}

.selected-indicator svg {
  width: 100%;
  height: 100%;
  stroke-width: 3;
}

/* Alert */
.alert {
  margin-bottom: var(--space-lg);
  padding: var(--space-md) var(--space-lg);
  border-radius: var(--radius-lg);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all var(--transition-fast);
}

.alert:hover {
  opacity: 0.9;
}

.alert-success {
  background: var(--success-bg);
  color: var(--success-text);
  border: 1px solid var(--success-border);
}

.alert-error {
  background: var(--error-bg);
  color: var(--error-text);
  border: 1px solid var(--error-border);
}

.alert-close {
  font-size: 1.5rem;
  font-weight: bold;
  opacity: 0.5;
  margin-left: var(--space-md);
}

/* Footer */
.card-assignment-footer {
  padding: var(--space-xl) var(--space-2xl);
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-primary);
  text-align: center;
}

.assign-btn {
  width: 100%;
  max-width: 300px;
  margin-bottom: var(--space-md);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
}

.btn-icon {
  width: 20px;
  height: 20px;
}

.assign-disclaimer {
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
  margin: 0;
}

/* Responsive */
@media (max-width: 640px) {
  .card-assignment-main {
    padding: var(--space-md);
  }

  .card-assignment-header,
  .card-assignment-content,
  .card-assignment-footer {
    padding: var(--space-lg);
  }

  .card-assignment-title {
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

  .card-status-card {
    padding: var(--space-lg);
  }

  .status-icon {
    font-size: 2rem;
  }
}

/* Fade-in animation */
.fade-in {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>

