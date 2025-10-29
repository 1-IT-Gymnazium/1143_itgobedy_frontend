<script setup lang="ts">
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
  lunchNumber: null,
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
});

onUnmounted(() => {
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
    studentName: data.student_name || data.name || 'Error',
    lunchNumber: data.lunch_number,
    status: data.status || 'unknown',
    errorMessage: data.errorMessage || '',
    isUnassigned: !!data.uid,
    isError: !!data.error
  };

  scanHistory.value.unshift(historyItem);
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
  try {
    cardStatus.value = `Processing card ${cardUid.substring(0, 8)}...`;

    // Call backend /lunch endpoint to get student and lunch info
    const response = await fetch('http://localhost:5000/lunch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ card_uid: cardUid })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const lunchData = await response.json();

    // Successfully retrieved lunch data
    handleSuccessfulLunch(lunchData, cardUid);

  } catch (error) {
    console.error('Error fetching lunch data:', error);
    handleLunchError(error.message, cardUid);
  }
}

function handleSuccessfulLunch(lunchData, cardUid) {
  const { name, lunch_number } = lunchData;

  studentInfo.value = {
    visible: true,
    name: name || 'Unknown',
    lunchNumber: lunch_number || 'N/A',
    status: 'success'
  };

  cardStatus.value = `✅ Lunch retrieved for ${name}`;
  errorType.value = 'success';
  errorMessage.value = `Lunch #${lunch_number} served to ${name}`;

  // Add to history
  addToHistory({
    student_name: name,
    lunch_number: lunch_number,
    status: 'success',
    card_uid: cardUid
  });

  // Hide after delay
  hideTimeout = setTimeout(() => {
    resetDisplay();
  }, 5000);
}

function handleLunchError(errorMsg, cardUid) {
  // Check for specific error types
  if (errorMsg.includes('Student not found') || errorMsg.includes('404')) {
    // Unassigned card
    handleUnassignedCard({ uid: cardUid });
  } else if (errorMsg.includes('Lunch data not found')) {
    // Student found but no lunch
    studentInfo.value = {
      visible: true,
      name: 'Student',
      lunchNumber: null,
      status: 'warning'
    };
    cardStatus.value = '⚠️ No lunch assigned';
    errorType.value = 'warning';
    errorMessage.value = 'This student does not have lunch today';

    addToHistory({
      student_name: 'No Lunch',
      status: 'warning',
      errorMessage: 'No lunch data',
      card_uid: cardUid
    });
  } else {
    // General error
    studentInfo.value.visible = false;
    cardStatus.value = '❌ Error';
    errorType.value = 'error';
    errorMessage.value = errorMsg || 'Failed to retrieve lunch data';

    addToHistory({
      student_name: 'Error',
      status: 'error',
      errorMessage: errorMsg,
      card_uid: cardUid
    });
  }

  // Hide after delay
  hideTimeout = setTimeout(() => {
    resetDisplay();
  }, 5000);
}
  } else if (data.name || data.student_name) {
    // Successful lunch retrieval
    handleSuccessfulScan(data);
  } else {
    // Unknown response format
    handleUnknownResponse(data);
  }

  // Add to history
  addToHistory({
    ...data,
    status: errorType.value || 'unknown'
  });

  // Hide info after appropriate time based on status
  const hideDelay = errorType.value === 'error' ? 15000 : 10000; // Show errors longer
  hideTimeout = setTimeout(resetDisplay, hideDelay);
}

function handleCardError(data) {
  const errorMsg = data.error || data.message || 'Unknown error occurred';

  // Map specific backend errors to user-friendly messages
  if (errorMsg.includes('card_uid is required')) {
    cardStatus.value = 'Invalid Card';
    errorMessage.value = 'Card could not be read properly. Please try again.';
    errorType.value = 'error';
  } else if (errorMsg.includes('Student not found')) {
    cardStatus.value = 'Unregistered Card';
    errorMessage.value = 'This card is not registered in the system. Please contact the office.';
    errorType.value = 'warning';
  } else if (errorMsg.includes('Lunch data not found')) {
    cardStatus.value = 'No Lunch Assigned';
    errorMessage.value = 'No lunch has been assigned to this student today.';
    errorType.value = 'warning';
  } else {
    cardStatus.value = 'Error';
    errorMessage.value = errorMsg;
    errorType.value = 'error';
  }

  studentInfo.value = {
    visible: true,
    name: '',
    lunchNumber: null,
    status: errorType.value
  };
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
}

function handleSuccessfulScan(data) {
  cardStatus.value = 'Lunch Retrieved!';
  errorMessage.value = 'Lunch successfully given to student.';
  errorType.value = 'success';

  studentInfo.value = {
    visible: true,
    name: data.name || data.student_name,
    lunchNumber: data.lunch_number,
    status: 'success'
  };
}

function handleUnknownResponse(data) {
  cardStatus.value = 'Unknown Response';
  errorMessage.value = 'Received unexpected response from server.';
  errorType.value = 'error';

  studentInfo.value = {
    visible: true,
    name: 'Unknown',
    lunchNumber: null,
    status: 'error'
  };
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

function handlePinInput(index: number, event: Event) {
  const target = event.target as HTMLInputElement;
  const value = target.value;

  if (value.length <= 1) {
    pinCode.value[index] = value;

    // Move to next input if value entered
    if (value && index < 3) {
      const nextInput = document.querySelector(`input[data-pin-index="${index + 1}"]`) as HTMLInputElement;
      if (nextInput) nextInput.focus();
    }

    // Auto-validate if all digits entered
    if (index === 3 && value) {
      setTimeout(validatePin, 100);
    }
  }
}

function handlePinKeydown(index: number, event: KeyboardEvent) {
  if (event.key === 'Backspace' && !pinCode.value[index] && index > 0) {
    const prevInput = document.querySelector(`input[data-pin-index="${index - 1}"]`) as HTMLInputElement;
    if (prevInput) prevInput.focus();
  }

  if (event.key === 'Enter') {
    validatePin();
  }
}

function validatePin() {
  const enteredPin = pinCode.value.join('');

  if (enteredPin === import.meta.env.VITE_CARD_SCANNER_PIN) {
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
      const firstInput = document.querySelector('input[data-pin-index="0"]') as HTMLInputElement;
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
    <!-- Header -->
    <header class="scanner-header">
      <div class="header-container">
        <div class="header-content">
          <!-- Back button -->
          <button @click="goToAdmin" class="back-btn">
            <i class="bi bi-arrow-left"></i>
            <span class="back-text">Back to Admin</span>
          </button>

          <!-- Logo -->
          <div class="logo-container">
            <i class="bi bi-credit-card logo-icon"></i>
          </div>

          <!-- Current time -->
          <div class="time-display">
            {{ currentTime }}
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="scanner-main">
      <div class="scanner-container">
        <!-- Page Title -->

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
                    <h2 class="student-name">{{ studentInfo.name }}</h2>
                  </div>

                  <div class="student-details">
                    <div class="lunch-status">
                      <div class="lunch-info has-lunch">
                        <div class="lunch-icon">
                          <i class="bi bi-cup-hot-fill"></i>
                        </div>
                        <div class="lunch-text">
                          <span class="lunch-label">Lunch Retrieved</span>
                          <span class="lunch-number">Lunch #{{ studentInfo.lunchNumber }}</span>
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
                      <div class="lunch-info" :class="{ 'has-lunch': studentInfo.lunchNumber, 'no-lunch': !studentInfo.lunchNumber }">
                        <div class="lunch-icon">
                          <i class="bi bi-cup-hot-fill" v-if="studentInfo.lunchNumber"></i>
                          <i class="bi bi-x-circle-fill" v-else></i>
                        </div>
                        <div class="lunch-text">
                          <span class="lunch-label">Lunch Status</span>
                          <span class="lunch-number">{{ studentInfo.lunchNumber ? `Lunch #${studentInfo.lunchNumber}` : 'No lunch ordered today' }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- History Section -->
        <div class="history-card">
          <h3 class="history-title">Today's Scan History</h3>

          <div class="current-time-display">
            {{ currentTime }}
          </div>

          <div class="scan-history">
            <div v-if="scanHistory.length === 0" class="no-scans">
              <i class="bi bi-clock-history"></i>
              <p>No scans yet today</p>
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
                      {{ item.studentName }}
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

        <!-- Action Buttons -->
        <div class="action-buttons">
          <button @click="goToAdmin" class="action-btn primary">
            <i class="bi bi-arrow-left"></i>
            Back to Admin Dashboard
          </button>
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
  min-height: 100vh;
  background: transparent;
  display: flex;
  flex-direction: column;
}

/* Header */
.scanner-header {
  background: var(--brand-primary);
  padding: var(--space-xl) 0;
  box-shadow: var(--shadow-md);
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

.back-btn {
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

.back-btn:hover {
  background: var(--bg-secondary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.back-text {
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
}

.time-display {
  color: white;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  display: none;
}

/* Main Content */
.scanner-main {
  flex: 1;
  padding: var(--space-2xl) 0;
}

.scanner-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-2xl);
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
  margin-bottom: var(--space-xl);
  text-align: center;
}

.status-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
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

/* History Card */
.history-card {
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-2xl);
  padding: var(--space-2xl);
  box-shadow: var(--shadow-xl);
}

.history-title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin: 0 0 var(--space-lg) 0;
  text-align: center;
}

.current-time-display {
  text-align: center;
  padding: var(--space-sm);
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  color: var(--text-secondary);
  font-weight: var(--font-weight-medium);
  margin-bottom: var(--space-lg);
}

.scan-history {
  max-height: 320px;
  overflow-y: auto;
  background: var(--bg-secondary);
  border-radius: var(--radius-xl);
  padding: var(--space-lg);
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
  gap: var(--space-md);
}

.history-item {
  background: var(--bg-card);
  border-radius: var(--radius-xl);
  padding: var(--space-lg);
  box-shadow: var(--shadow-sm);
}

.history-item:hover {
  box-shadow: var(--shadow-md);
}

.history-item.unassigned {
  border-left: 4px solid var(--error-text);
}

.history-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.history-main {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.history-name {
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
}

.history-name.error {
  color: var(--error-text);
}

.history-lunch {
  font-size: var(--font-size-sm);
  color: var(--success-text);
}

.history-lunch.no-lunch {
  color: var(--text-secondary);
}

.history-time {
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
  font-weight: var(--font-weight-medium);
}

/* Action Buttons */
.action-buttons {
  display: flex;
  gap: var(--space-lg);
  justify-content: center;
  flex-wrap: wrap;
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
  font-size: var(--font-size-md);
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

  .scanner-container {
    padding: 0 var(--space-xl);
  }

  .action-buttons {
    flex-direction: row;
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

  .scanner-container {
    padding: 0 var(--space-md);
    gap: var(--space-lg);
  }

  .title-text {
    font-size: var(--font-size-3xl);
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
  .scanner-container {
    padding: 0 var(--space-sm);
  }

  .scanner-main {
    padding: var(--space-lg) 0;
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
