<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { io } from 'socket.io-client';

const router = useRouter();

// Reactive data
const currentTime = ref('');
const cardStatus = ref('Waiting for card...');
const errorMessage = ref('');
const errorType = ref(''); // 'error', 'warning', 'success'
const studentInfo = ref({
  visible: false,
  name: '',
  Lunch: null,
  status: '' // 'success', 'error', 'warning'
});
const scanHistory = ref([]);
const showPinModal = ref(false);
const pinCode = ref(['', '', '', '']);
const pinError = ref(false);
const currentDestination = ref('');
const connectionStatus = ref('Disconnected');

// Socket and time intervals
let socket = null;
let timeInterval = null;
let hideTimeout = null;
let lastDay = new Date().toDateString();

onMounted(() => {
  updateTime();
  timeInterval = setInterval(updateTime, 1000);
  initializeSocket();
  window.addEventListener('back-to-admin', goToAdmin);
});

onUnmounted(() => {
  window.removeEventListener('back-to-admin', goToAdmin);
  if (timeInterval) {
    clearInterval(timeInterval);
  }
  if (hideTimeout) {
    clearTimeout(hideTimeout);
  }
  if (socket) {
    socket.disconnect();
  }
});

function initializeSocket() {
  // Connect to your backend server (adjust URL as needed)
  socket = io('http://localhost:3001', {
    transports: ['websocket'],
    timeout: 5000,
    forceNew: true
  });

  socket.on('connect', () => {
    console.log('Connected to card reader server');
    connectionStatus.value = 'Connected';
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from card reader server');
    connectionStatus.value = 'Disconnected';
  });

  socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    connectionStatus.value = 'Connection Error';
  });

  // Listen for card scan events
  socket.on('card_scanned', (data) => {
    console.log('Card scanned:', data);
    handleCardScanned(data);
  });

  // Listen for card removed events
  socket.on('card_removed', () => {
    console.log('Card removed');
    // Optional: Reset display when card is removed
    // resetDisplay();
  });

  // Listen for reader status updates
  socket.on('reader_status', (status) => {
    console.log('Reader status:', status);
    if (status.connected === false) {
      cardStatus.value = 'Card reader not connected';
    }
  });
}

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

function resetDisplay() {
  cardStatus.value = 'Waiting for card...';
  studentInfo.value.visible = false;
  errorMessage.value = '';
  errorType.value = '';
}

function addToHistory(data) {
  // Check if it's a new day
  const currentDay = new Date().toDateString();
  if (currentDay !== lastDay) {
    scanHistory.value = [];
    lastDay = currentDay;
  }

  const time = new Date().toLocaleTimeString('en-GB');
  const historyItem = {
    id: Date.now(),
    time,
    name: data.student_name || 'Error',
    surname: data.student_surname || '',
    lunchNumber: data.lunch_number || '',
    status: data.status || 'unknown',
    errorMessage: data.errorMessage || '',
    isUnassigned: !!data.uid,
    isError: !!data.error
  };

  scanHistory.value.unshift(historyItem);
}

function loadMockScans(count = 60) {
  const names = ['Adam', 'Eva', 'Jan', 'Lucie', 'Petr', 'Anna', 'Martin', 'Tereza'];
  const statuses = ['success', 'warning', 'error'];

  scanHistory.value = Array.from({ length: count }, (_, index) => {
    const status = statuses[index % statuses.length];
    const isUnassigned = status === 'warning' && index % 5 === 0;
    const hasLunch = status === 'success';
    const scannedAt = new Date(Date.now() - index * 45 * 1000);

    return {
      id: Date.now() + index,
      time: scannedAt.toLocaleTimeString('en-GB'),
      name: isUnassigned ? 'Unassigned Card' : names[index % names.length],
      surname: isUnassigned ? '' : `Mock${index + 1}`,
      lunchNumber: hasLunch ? ((index % 4) + 1) : '',
      status,
      errorMessage: status === 'error' ? 'Mock backend error' : status === 'warning' ? 'No lunch today' : '',
      isUnassigned,
      isError: status === 'error'
    };
  });
}

function handleCardScanned(data) {
  // Clear any existing timeout
  if (hideTimeout) {
    clearTimeout(hideTimeout);
  }

  console.log('Handling card scan data:', data);

  // Card reader now ONLY sends UID, frontend handles the rest
  if (data.uid) {
    handleCardUID(data.uid);
  } else {
    console.error('No UID received from card reader');
    cardStatus.value = 'Error: No card UID';
  }
}

// New function to handle UID and call backend API
async function handleCardUID(cardUid) {
  let data = {};

  try {
    cardStatus.value = `Processing card ${cardUid.substring(0, 8)}...`;

    // Call backend /lunch endpoint to get student and lunch info
    let response = await fetch('http://localhost:5000/api/lunch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ card_uid: cardUid })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      // Pass student data if available in error response
      data = errorData;

      // Backend returns error in errorData.error field
      const errorMessage = errorData.error || `HTTP ${response.status}`;
      throw new Error(errorMessage);
    }

    const lunchData = await response.json();
    data = lunchData;

    // Successfully retrieved lunch data
    handleSuccessfulLunch(lunchData, cardUid);

  } catch (error) {
    console.error('Error fetching lunch data:', error);
    // Pass both error message and data (which may contain name/surname)
    handleLunchError(error.message, cardUid, data);
  }
}

function handleSuccessfulLunch(lunchData, cardUid) {
  const { name, surname, Lunch } = lunchData;

  studentInfo.value = {
    visible: true,
    name: name || 'Unknown',
    surname: surname || '',
    Lunch: Lunch || 'N/A',
    status: 'success'
  };

  cardStatus.value = `✅ Lunch retrieved for ${name} ${surname}`;
  errorType.value = 'success';
  errorMessage.value = `Lunch #${Lunch} served to ${name} ${surname}`;

  // Add to history
  addToHistory({
    student_name: name,
    student_surname: surname,
    lunch_number: Lunch,
    status: 'success',
    card_uid: cardUid
  });

  // Hide after delay
  hideTimeout = setTimeout(() => {
    resetDisplay();
  }, 5000);
}

function handleLunchError(errorMsg, cardUid, data) {
  console.log('handleLunchError - data received:', data);
  console.log('handleLunchError - errorMsg:', errorMsg);

  const { name, surname } = data || {};

  // Ensure errorMsg is a string
  const errorString = String(errorMsg || '');

  // Check for specific error types
  if (errorString.includes('Student not found') || (errorString.includes('404') && !name)) {
    // Unassigned card - no student found at all
    handleUnassignedCard({ uid: cardUid });
  } else if (name && surname) {
    // Student found but no lunch - this is a WARNING, not an error
    // The backend sends name and surname even when there's no lunch
    studentInfo.value = {
      visible: true,
      name: name,
      surname: surname,
      Lunch: null,
      status: 'warning'
    };
    cardStatus.value = '⚠️ No lunch assigned';
    errorType.value = 'warning';
    errorMessage.value = `${name} ${surname} does not have lunch today`;

    addToHistory({
      student_name: name,
      student_surname: surname,
      status: 'warning',
      errorMessage: 'No lunch today',
      card_uid: cardUid
    });
  } else {
    // General error - something went wrong
    studentInfo.value.visible = false;
    cardStatus.value = '❌ Error';
    errorType.value = 'error';
    errorMessage.value = errorString || 'Failed to retrieve lunch data';

    addToHistory({
      student_name: 'Error',
      status: 'error',
      errorMessage: errorString,
      card_uid: cardUid
    });
  }

  // Hide after delay
  hideTimeout = setTimeout(() => {
    resetDisplay();
  }, 5000);
}

function handleUnassignedCard(data) {
  cardStatus.value = 'Unassigned Card';
  errorMessage.value = 'This card needs to be assigned to a student.';
  errorType.value = 'warning';

  studentInfo.value = {
    visible: true,
    name: 'Unknown Card',
    lunchNumber: null,
    status: 'warning'
  };

  addToHistory({
    student_name: 'Unassigned Card',
    status: 'warning',
    errorMessage: 'Card not assigned',
    isUnassigned: true,
    card_uid: data.uid
  });

  // Hide after delay
  hideTimeout = setTimeout(() => {
    resetDisplay();
  }, 5000);
}

function showPincodeModal(destination) {
  currentDestination.value = destination;
  showPinModal.value = true;
  pinError.value = false;
  resetPinInputs();
}

function closePincodeModal() {
  showPinModal.value = false;
  resetPinInputs();
}

function resetPinInputs() {
  pinCode.value = ['', '', '', ''];
  pinError.value = false;
}

function handlePinInput(index, event) {
  const target = event.target;
  const value = target.value;

  if (value.length <= 1) {
    pinCode.value[index] = value;

    // Move to next input if value entered
    if (value && index < 3) {
      const nextInput = document.querySelector(`input[data-pin-index="${index + 1}"]`);
      if (nextInput) nextInput.focus();
    }

    // Auto-validate if all digits entered
    if (index === 3 && value) {
      setTimeout(validatePin, 100);
    }
  }
}

function handlePinKeydown(index, event) {
  if (event.key === 'Backspace' && !pinCode.value[index] && index > 0) {
    const prevInput = document.querySelector(`input[data-pin-index="${index - 1}"]`);
    if (prevInput) prevInput.focus();
  }

  if (event.key === 'Enter') {
    validatePin();
  }
}

function validatePin() {
  const enteredPin = pinCode.value.join('');
  const validPin = import.meta.env.VITE_CARD_SCANNER_PIN || '1234'; // Default PIN if not set

  if (enteredPin === validPin) {
    closePincodeModal();
    if (currentDestination.value === 'admin') {
      router.push('/admin');
    } else if (currentDestination.value === 'assign-card') {
      router.push('/admin/card-assignment');
    }
  } else {
    pinError.value = true;
    resetPinInputs();
    setTimeout(() => {
      const firstInput = document.querySelector('input[data-pin-index="0"]');
      if (firstInput) firstInput.focus();
    }, 100);
  }
}

function goToAdmin() {
  showPincodeModal('admin');
}

function goToCardAssignment() {
  showPincodeModal('assign-card');
}
</script>

<template>
  <div class="card-scanner">

    <!-- Main Content -->
    <main class="scanner-main">
      <div class="scanner-container">

        <!-- History Sidebar -->
        <aside class="history-sidebar">
          <div class="history-card">
            <h3 class="history-title">Today's Scans</h3>

            <div class="current-time-display">
              {{ currentTime }}
            </div>

            <div class="scan-history">
              <div v-if="scanHistory.length === 0" class="no-scans">
                <i class="bi bi-clock-history"></i>
                <p>No scans yet</p>
              </div>

              <div v-else class="history-list">
                <div
                  v-for="item in scanHistory"
                  :key="item.id"
                  class="history-item"
                  :class="{ 'unassigned': item.isUnassigned }"
                >
                  <div class="history-content">
                    <div class="history-main">
                      <span class="history-name" :class="{ 'error': item.isUnassigned }">
                        {{ item.name }} {{item.surname}}
                      </span>
                      <span v-if="!item.isUnassigned && item.lunchNumber" class="history-lunch">
                        Lunch #{{ item.lunchNumber }}
                      </span>
                      <span v-else-if="!item.isUnassigned" class="history-lunch no-lunch">
                        No lunch
                      </span>
                    </div>
                    <span class="history-time">{{ item.time }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <!-- Scanner Section -->
        <div class="scanner-card">

          <!-- Card Status -->
          <div class="card-status">
            <div class="status-content">
              <!-- Waiting for card -->
              <div v-if="cardStatus === 'Waiting for card...'" class="status-waiting">
                <i class="bi bi-credit-card-2-front status-icon"></i>
                <p class="status-text">{{ cardStatus }}</p>
              </div>

              <!-- Error States -->
              <div v-else-if="errorType === 'error'" class="status-error">
                <i class="bi bi-x-circle-fill status-icon"></i>
                <p class="status-text">{{ cardStatus }}</p>
                <p class="status-subtext error-message">{{ errorMessage }}</p>
              </div>

              <!-- Warning States (unregistered card, no lunch assigned) -->
              <div v-else-if="errorType === 'warning'" class="status-warning">
                <i class="bi bi-exclamation-triangle-fill status-icon"></i>
                <p class="status-text">{{ cardStatus }}</p>
                <p class="status-subtext warning-message">{{ errorMessage }}</p>
              </div>

              <!-- Success State -->
              <div v-else-if="errorType === 'success' && studentInfo.visible" class="status-success">
                <div class="success-indicator">
                  <i class="bi bi-check-circle-fill success-icon"></i>
                  <p class="success-text">{{ cardStatus }}</p>
                  <p class="success-subtext">{{ errorMessage }}</p>
                </div>

                <!-- Student Information Display -->
                <div class="student-card success">
                  <div class="student-header">
                    <h2 class="student-name">{{ studentInfo.name}} {{studentInfo.surname}}</h2>
                  </div>

                  <div class="student-details">
                    <div class="lunch-status">
                      <div class="lunch-info has-lunch">
                        <div class="lunch-icon">
                          <i class="bi bi-cup-hot-fill"></i>
                        </div>
                        <div class="lunch-text">
                          <span class="lunch-label">Lunch Retrieved</span>
                          <span class="lunch-number">Lunch #{{ studentInfo.Lunch }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Unassigned Card (legacy fallback) -->
              <div v-else-if="cardStatus === 'Unassigned Card'" class="status-unassigned">
                <i class="bi bi-question-circle-fill status-icon"></i>
                <p class="status-text">{{ cardStatus }}</p>
                <p class="status-subtext">{{ errorMessage || 'This card is not assigned to any student.' }}</p>
              </div>

              <!-- Legacy student info display (fallback) -->
              <div v-else-if="studentInfo.visible" class="student-info-display">
                <div class="student-card">
                  <div class="student-header">
                    <h2 class="student-name">{{ studentInfo.name }}</h2>
                  </div>

                  <div class="student-details">
                    <div class="lunch-status">
                      <div class="lunch-info" :class="{ 'has-lunch': studentInfo.Lunch, 'no-lunch': !studentInfo.Lunch }">
                        <div class="lunch-icon">
                          <i class="bi bi-cup-hot-fill" v-if="studentInfo.Lunch"></i>
                          <i class="bi bi-x-circle-fill" v-else></i>
                        </div>
                        <div class="lunch-text">
                          <span class="lunch-label">Lunch Status</span>
                          <span class="lunch-number">{{ studentInfo.Lunch ? `Lunch #${studentInfo.Lunch}` : 'No lunch ordered today' }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- PIN Code Modal -->
    <div v-if="showPinModal" class="modal-overlay" @click="closePincodeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3 class="modal-title">Admin Authentication</h3>
          <p class="modal-subtitle">Please enter your PIN code to continue</p>
        </div>

        <div class="pin-input-section">
          <div class="pin-inputs">
            <input
              v-for="(_, index) in pinCode"
              :key="index"
              v-model="pinCode[index]"
              :data-pin-index="index"
              type="password"
              maxlength="1"
              class="pin-digit"
              @input="handlePinInput(index, $event)"
              @keydown="handlePinKeydown(index, $event)"
            />
          </div>

          <div v-if="pinError" class="pin-error">
            Incorrect PIN code. Please try again.
          </div>
        </div>

        <div class="modal-actions">
          <button @click="closePincodeModal" class="modal-btn cancel">
            Cancel
          </button>
          <button @click="validatePin" class="modal-btn confirm">
            Confirm
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card-scanner {
  min-height: 50vh;
  background: transparent;
  display: flex;
  flex-direction: column;
}


/* Main Content */
.scanner-main {
  flex: 1;
  min-height: 0;
  padding: var(--space-2xl) var(--space-lg);
  overflow: hidden;
}

.scanner-container {
  max-width: 1400px;
  margin: 0 auto;
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: var(--space-2xl);
  align-items: stretch;
}

/* Page Title */
.page-title {
  text-align: center;
}

.title-text {
  font-size: var(--font-size-4xl);
  font-weight: var(--font-weight-bold);
  color: var(--brand-primary);
  margin: 0 0 var(--space-sm) 0;
}

.title-subtitle {
  font-size: var(--font-size-lg);
  color: var(--text-secondary);
  margin: 0;
}

/* Scanner Card */
.scanner-card {
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-2xl);
  padding: var(--space-2xl);
  box-shadow: var(--shadow-xl);
  display: flex;
  flex-direction: column;
  height: calc(100vh - 280px);
  max-height: calc(100vh - 280px);
  overflow: hidden;
}

.instructions-section {
  background: var(--error-bg);
  border-radius: var(--radius-xl);
  padding: var(--space-xl);
  margin-bottom: var(--space-xl);
}

.instructions-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--error-text);
  margin: 0 0 var(--space-md) 0;
}

.instructions-text {
  color: var(--error-text);
  margin: 0;
  opacity: 0.9;
}

/* Card Status */
.card-status {
  background: var(--bg-secondary);
  border-radius: var(--radius-xl);
  padding: var(--space-2xl);
  text-align: center;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  width: 100%;
}

.status-icon {
  font-size: 3rem;
  margin-bottom: var(--space-md);
}

.status-waiting .status-icon {
  color: var(--text-tertiary);
}

.status-unassigned .status-icon {
  color: var(--error-text);
}

.status-detected .status-icon {
  color: var(--success-text);
}

.status-text {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  margin: 0;
}

.status-waiting .status-text {
  color: var(--text-secondary);
}

.status-unassigned .status-text {
  color: var(--error-text);
}

.status-detected .status-text {
  color: var(--success-text);
}

.status-subtext {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin: 0;
}

/* Error and Warning States */
.status-error .status-icon {
  color: var(--error-text);
}

.status-error .status-text {
  color: var(--error-text);
}

.error-message {
  color: var(--error-text);
  background: var(--error-bg);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  border: 1px solid var(--error-border);
  margin-top: var(--space-sm);
}

.status-warning .status-icon {
  color: var(--warning-text);
}

.status-warning .status-text {
  color: var(--warning-text);
}

.warning-message {
  color: var(--warning-text);
  background: var(--warning-bg);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  border: 1px solid var(--warning-border);
  margin-top: var(--space-sm);
}

.status-success .status-icon {
  color: var(--success-text);
}

.status-success .status-text {
  color: var(--success-text);
}

.success-subtext {
  color: var(--success-text);
  font-size: var(--font-size-sm);
  margin: var(--space-xs) 0 0 0;
  opacity: 0.8;
}

.student-card.success {
  border-color: var(--success-border);
  background: linear-gradient(135deg, var(--success-bg) 0%, var(--bg-card) 100%);
}

/* Student Display (integrated into card status) */
.student-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-lg);
  margin-top: var(--space-md);
}

.student-display-name {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin: 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  line-height: 1.2;
}

.lunch-display {
  display: flex;
  justify-content: center;
}

.lunch-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-md) var(--space-lg);
  border-radius: var(--radius-lg);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-lg);
}

.lunch-badge.success {
  background: var(--success-bg);
  color: var(--success-text);
  border: 1px solid var(--success-border);
}

.lunch-badge.secondary {
  color: var(--text-secondary);
  margin: 0;
}

/* Student Information */
.student-info {
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-xl);
  padding: var(--space-xl);
  box-shadow: var(--shadow-sm);
}

.student-info-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--space-lg) 0;
}

.student-details {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-label {
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
}

.detail-value {
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.detail-value.text-success {
  color: var(--success-text);
}

.detail-value.text-secondary {
  color: var(--text-secondary);
}

/* Student Information Display - Prominent */
.student-info-display {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

.success-indicator {
  text-align: center;
  margin-bottom: var(--space-lg);
}

.success-icon {
  font-size: 4rem;
  color: var(--success-text);
  margin-bottom: var(--space-md);
  filter: drop-shadow(0 2px 4px rgba(34, 197, 94, 0.3));
}

.success-text {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--success-text);
  margin: 0;
}

.student-card {
  background: linear-gradient(135deg, var(--bg-card) 0%, var(--bg-secondary) 100%);
  border: 2px solid var(--success-border);
  border-radius: var(--radius-2xl);
  padding: var(--space-2xl);
  box-shadow: var(--shadow-xl);
  text-align: center;
}

.student-header {
  margin-bottom: var(--space-xl);
}

.student-name {
  font-size: 3rem;
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin: 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  line-height: 1.2;
}

.student-details {
  display: flex;
  justify-content: center;
}

.lunch-status {
  width: 100%;
  max-width: 400px;
}

.lunch-info {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  padding: var(--space-xl) var(--space-2xl);
  border-radius: var(--radius-xl);
  transition: all var(--transition-fast);
}

.lunch-info.has-lunch {
  background: var(--success-bg);
  border: 2px solid var(--success-border);
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.2);
}

.lunch-info.no-lunch {
  background: var(--bg-tertiary);
  border: 2px solid var(--border-secondary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.lunch-icon {
  flex-shrink: 0;
}

.lunch-icon i {
  font-size: 2.5rem;
}

.lunch-info.has-lunch .lunch-icon i {
  color: var(--success-text);
  filter: drop-shadow(0 2px 4px rgba(34, 197, 94, 0.3));
}

.lunch-info.no-lunch .lunch-icon i {
  color: var(--text-secondary);
  filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.2));
}

.lunch-text {
  flex: 1;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.lunch-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.lunch-info.has-lunch .lunch-label {
  color: var(--success-text);
  opacity: 0.8;
}

.lunch-info.no-lunch .lunch-label {
  color: var(--text-secondary);
  opacity: 0.8;
}

.lunch-number {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
}

.lunch-info.has-lunch .lunch-number {
  color: var(--success-text);
}

.lunch-info.no-lunch .lunch-number {
  color: var(--text-secondary);
}

/* Demo Section */
.demo-section {
  margin-top: var(--space-xl);
  text-align: center;
  padding-top: var(--space-xl);
  border-top: 1px solid var(--border-primary);
}

.demo-btn {
  background: var(--bg-card);
  color: var(--brand-primary);
  border: 1px solid var(--info-border);
  padding: var(--space-md) var(--space-xl);
  border-radius: var(--radius-lg);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  transition: all var(--transition-fast);
  box-shadow: var(--shadow-sm);
}

.demo-btn:hover {
  background: var(--bg-secondary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

/* History Sidebar */
.history-sidebar {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* History Card */
.history-card {
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-2xl);
  padding: var(--space-xl);
  box-shadow: var(--shadow-xl);
  flex: 1;
  height: calc(100vh - 280px);
  max-height: calc(100vh - 280px);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.history-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin: 0 0 var(--space-md) 0;
  text-align: center;
}

.current-time-display {
  text-align: center;
  padding: var(--space-sm);
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  color: var(--text-secondary);
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-md);
}

.scan-history {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  background: var(--bg-secondary);
  border-radius: var(--radius-xl);
  padding: var(--space-md);
}

.no-scans {
  text-align: center;
  color: var(--text-tertiary);
  padding: var(--space-xl);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
}

.no-scans i {
  font-size: 2rem;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.history-item {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: var(--space-md);
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-fast);
}

.history-item:hover {
  box-shadow: var(--shadow-md);
  transform: translateX(4px);
}

.history-item.unassigned {
  border-left: 3px solid var(--error-text);
}

.history-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.history-main {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.history-name {
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
}

.history-name.error {
  color: var(--error-text);
}

.history-lunch {
  font-size: var(--font-size-xs);
  color: var(--success-text);
  font-weight: var(--font-weight-medium);
}

.history-lunch.no-lunch {
  color: var(--text-secondary);
}

.history-time {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  font-weight: var(--font-weight-medium);
}

/* Action Buttons */
.action-buttons {
  grid-column: 1 / -1;
  display: flex;
  gap: var(--space-lg);
  justify-content: center;
  flex-wrap: wrap;
  margin-top: var(--space-xl);
}

.action-btn {
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
  min-width: 160px;
  justify-content: center;
}

.action-btn:hover {
  background: var(--bg-secondary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.action-btn.secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
}

.action-btn.secondary:hover {
  background: var(--bg-tertiary);
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: var(--space-lg);
}

.modal-content {
  background: var(--bg-card);
  border-radius: var(--radius-2xl);
  padding: var(--space-2xl);
  box-shadow: var(--shadow-xl);
  width: 100%;
  max-width: 400px;
}

.modal-header {
  text-align: center;
  margin-bottom: var(--space-xl);
}

.modal-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--space-sm) 0;
}

.modal-subtitle {
  color: var(--text-secondary);
  margin: 0;
}

.pin-input-section {
  margin-bottom: var(--space-xl);
}

.pin-inputs {
  display: flex;
  justify-content: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
}

.pin-digit {
  width: 48px;
  height: 56px;
  text-align: center;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  border: 2px solid var(--border-primary);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  color: var(--text-primary);
}

.pin-digit:focus {
  border-color: var(--brand-primary);
  outline: none;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.pin-error {
  color: var(--error-text);
  text-align: center;
  font-size: var(--font-size-sm);
  background: var(--error-bg);
  padding: var(--space-sm);
  border-radius: var(--radius-md);
}

.modal-actions {
  display: flex;
  gap: var(--space-md);
  justify-content: center;
}

.modal-btn {
  padding: var(--space-md) var(--space-xl);
  border: none;
  border-radius: var(--radius-lg);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  min-width: 100px;
  justify-content: center;
}

/* Connection Status */
.connection-status {
  background: var(--bg-card);
  border-radius: var(--radius-xl);
  padding: var(--space-lg);
  margin-bottom: var(--space-xl);
  text-align: center;
}

.status-label {
  font-size: var(--font-size-base);
  color: var(--text-secondary);
  margin: 0 0 var(--space-sm) 0;
}

.status-value {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  margin: 0;
}

.status-value.connected {
  color: var(--success-text);
}

.status-value.disconnected {
  color: var(--error-text);
}

.status-value.error {
  color: var(--error-text);
}

/* Responsive Design */
@media (min-width: 640px) {
  .back-text {
    display: inline;
  }
}

@media (min-width: 768px) {
  .time-display {
    display: block;
  }

  .action-buttons {
    flex-direction: row;
  }
}

@media (max-width: 1024px) {
  .scanner-container {
    grid-template-columns: 1fr;
    gap: var(--space-lg);
  }

  .history-sidebar {
    height: auto;
    position: static;
    order: 1;
  }

  .history-card {
    max-height: 400px;
  }

  .scanner-card {
    order: 2;
  }

  .action-buttons {
    grid-column: 1;
    order: 3;
  }
}

@media (max-width: 768px) {
  .scanner-header {
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

  .scanner-main {
    padding: var(--space-lg) var(--space-md);
  }

  .scanner-card,
  .history-card {
    padding: var(--space-lg);
  }

  .action-buttons {
    flex-direction: column;
  }

  .detail-item {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-xs);
  }
}

@media (max-width: 480px) {
  .scanner-main {
    padding: var(--space-lg) var(--space-sm);
  }

  .scanner-card,
  .history-card {
    padding: var(--space-md);
  }

  .pin-digit {
    width: 40px;
    height: 48px;
    font-size: var(--font-size-lg);
  }
}
</style>