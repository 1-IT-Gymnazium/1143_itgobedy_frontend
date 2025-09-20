<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { io } from 'socket.io-client';
import { api } from '../utils/api.js';

const router = useRouter();

// Reactive data
const studentName = ref('');
const cardUid = ref('');
const cardStatus = ref('Waiting for card...');
const studentSearch = ref('');
const students = ref([]);
const error = ref('');
const success = ref('');
const betaBannerVisible = ref(true);

// Socket connection
let socket = null;

onMounted(() => {
  initializeSocket();
  fetchStudents();
});

onUnmounted(() => {
  if (socket) {
    socket.disconnect();
  }
});

function initializeSocket() {
  socket = io('http://localhost:3001', {
    transports: ['websocket'],
    upgrade: false
  });

  socket.on('connect', () => {
    console.log('Connected to server');
  });

  socket.on('card_scanned', (data) => {
    if (data.uid) {
      cardStatus.value = `Card Detected! UID: ${data.uid}`;
      cardUid.value = data.uid;
    } else if (data.student_id) {
      cardStatus.value = 'Card Already Assigned! This card is already assigned to a student.';
      cardUid.value = '';
    }
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from server');
  });
}

async function fetchStudents() {
  try {
    students.value = await api.getStudents();
  } catch (err) {
    console.error('Error fetching students:', err);
  }
}

async function assignCard() {
  if (!studentName.value || !cardUid.value) {
    error.value = 'Please enter a student name and scan a card';
    return;
  }

  try {
    const result = await api.assignCard({
      student_name: studentName.value,
      card_uid: cardUid.value
    });

    success.value = result.message || 'Card assigned successfully!';
    error.value = '';
    studentName.value = '';
    cardUid.value = '';
    cardStatus.value = 'Waiting for card...';
    await fetchStudents();
  } catch (err) {
    error.value = err.message || 'Failed to assign card';
    success.value = '';
    console.error('Error assigning card:', err);
  }
}

async function deleteStudent(studentId: string, studentName: string) {
  if (!confirm(`Are you sure you want to delete ${studentName}?`)) {
    return;
  }

  try {
    await api.deleteStudent(studentId);
    success.value = 'Student deleted successfully!';
    error.value = '';
    await fetchStudents();
  } catch (err) {
    error.value = err.message || 'Failed to delete student';
    success.value = '';
    console.error('Error deleting student:', err);
  }
}

const filteredStudents = computed(() => {
  if (!studentSearch.value) {
    // Filter out any students with missing required properties
    return students.value.filter(student =>
      student &&
      student.name &&
      student.card_uid &&
      student.id
    );
  }

  return students.value.filter(student =>
    student &&
    student.name &&
    student.card_uid &&
    student.id &&
    student.name.toLowerCase().includes(studentSearch.value.toLowerCase())
  );
});

const isAssignButtonDisabled = computed(() => {
  return !studentName.value || !cardUid.value;
});

function navigateToAdmin() {
  router.push('/admin');
}

function hideBetaBanner() {
  betaBannerVisible.value = false;
}
</script>

<template>
  <div class="card-assignment">

    <!-- Header -->
    <header class="assignment-header">
      <div class="header-container">
        <h1 class="page-title">Assign NFC Card to Student</h1>
        <button @click="navigateToAdmin" class="btn btn-secondary">
          <i class="bi bi-arrow-left"></i>
          Back to Admin
        </button>
      </div>
    </header>

    <!-- Main Content -->
    <main class="assignment-main">
      <div class="assignment-container">
        <!-- Error message -->
        <div v-if="error" class="alert alert-error">
          <i class="bi bi-exclamation-triangle"></i>
          {{ error }}
        </div>

        <!-- Success message -->
        <div v-if="success" class="alert alert-success">
          <i class="bi bi-check-circle"></i>
          {{ success }}
        </div>

        <!-- Assignment Form Card -->
        <div class="card assignment-card">
          <!-- Instructions -->
          <div class="instructions-section">
            <h2 class="section-title">Instructions</h2>
            <ol class="instructions-list">
              <li>Enter the student's name</li>
              <li>Place the NFC card on the reader</li>
              <li>Click "Assign Card" to save the assignment</li>
            </ol>
          </div>

          <!-- Card Status -->
          <div class="status-section">
            <div class="status-card" :class="{
              'status-success': cardUid,
              'status-warning': cardStatus.includes('Already Assigned'),
              'status-waiting': !cardUid && !cardStatus.includes('Already Assigned')
            }">
              <i class="status-icon" :class="{
                'bi bi-check-circle': cardUid,
                'bi bi-exclamation-triangle': cardStatus.includes('Already Assigned'),
                'bi bi-clock': !cardUid && !cardStatus.includes('Already Assigned')
              }"></i>
              <p class="status-text">{{ cardStatus }}</p>
            </div>
          </div>

          <!-- Assignment Form -->
          <form @submit.prevent="assignCard" class="assignment-form">
            <div class="form-group">
              <label for="student_name" class="form-label">Student Name</label>
              <input
                type="text"
                id="student_name"
                v-model="studentName"
                required
                class="form-input"
                placeholder="Enter student's full name"
              >
            </div>

            <button
              type="submit"
              :disabled="isAssignButtonDisabled"
              class="btn btn-primary submit-btn"
            >
              <i class="bi bi-person-plus"></i>
              Assign Card
            </button>
          </form>
        </div>

        <!-- Students List Card -->
        <div class="card students-card">
          <div class="card-header">
            <h2 class="section-title">Recent Assignments</h2>
            <div class="search-container">
              <input
                type="text"
                v-model="studentSearch"
                placeholder="Search by name..."
                class="form-input search-input"
              >
              <i class="bi bi-search search-icon"></i>
            </div>
          </div>

          <div class="students-table-container">
            <table class="students-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Card ID</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="student in filteredStudents"
                  :key="student.id"
                  class="student-row"
                >
                  <td class="student-name">{{ student.name }}</td>
                  <td class="student-card">{{ student.card_uid?.substring(0, 8) }}...</td>
                  <td class="student-actions">
                    <button
                      @click="deleteStudent(student.id, student.name)"
                      class="btn btn-danger btn-sm"
                      title="Delete student"
                    >
                      <i class="bi bi-trash"></i>
                    </button>
                  </td>
                </tr>
                <tr v-if="filteredStudents.length === 0">
                  <td colspan="3" class="no-students">
                    {{ studentSearch ? 'No students found matching your search.' : 'No students assigned yet.' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.card-assignment {
  min-height: 100vh;
  background: transparent;
}

/* Header */
.assignment-header {
  background: var(--brand-primary);
  border-bottom: 1px solid var(--border-primary);
  box-shadow: var(--shadow-sm);
  backdrop-filter: blur(10px);
  margin-bottom: var(--space-xl);
  color: white;
}

.header-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-lg) var(--space-md);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.page-title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: white;
  margin: 0;
}

/* Main Content */
.assignment-main {
  flex: 1;
  padding: 0 var(--space-md) var(--space-xl);
}

.assignment-container {
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

/* Alert Styles */
.alert {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-md);
  border-radius: var(--radius-lg);
  font-weight: var(--font-weight-medium);
  border: 1px solid;
}

.alert-error {
  background: var(--error-bg);
  border-color: var(--error-border);
  color: var(--error-text);
}

.alert-success {
  background: var(--success-bg);
  border-color: var(--success-border);
  color: var(--success-text);
}

/* Card Styles */
.card {
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(10px);
  overflow: hidden;
}

.assignment-card {
  padding: var(--space-2xl);
}

.students-card {
  padding: 0;
}

.card-header {
  padding: var(--space-xl) var(--space-xl) var(--space-lg);
  border-bottom: 1px solid var(--border-primary);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-lg);
}

/* Instructions */
.instructions-section {
  margin-bottom: var(--space-xl);
}

.section-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin-bottom: var(--space-md);
}

.instructions-list {
  list-style: decimal;
  margin-left: var(--space-lg);
  color: var(--text-secondary);
  line-height: var(--line-height-relaxed);
}

.instructions-list li {
  margin-bottom: var(--space-xs);
}

/* Status Section */
.status-section {
  margin-bottom: var(--space-xl);
}

.status-card {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-lg);
  border-radius: var(--radius-lg);
  border: 2px solid;
  transition: all var(--transition-normal);
}

.status-waiting {
  background: var(--bg-tertiary);
  border-color: var(--border-secondary);
  color: var(--text-secondary);
}

.status-success {
  background: var(--success-bg);
  border-color: var(--success-border);
  color: var(--success-text);
}

.status-warning {
  background: var(--warning-bg);
  border-color: var(--warning-border);
  color: var(--warning-text);
}

.status-icon {
  font-size: var(--font-size-lg);
}

.status-text {
  font-weight: var(--font-weight-medium);
  margin: 0;
}

/* Form Styles */
.assignment-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.form-label {
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
}

.form-input {
  padding: var(--space-md);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  font-size: var(--font-size-base);
  background: var(--bg-secondary);
  color: var(--text-primary);
  transition: all var(--transition-fast);
}

.form-input:focus {
  outline: none;
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px rgba(229, 20, 246, 0.1);
}

.submit-btn {
  align-self: stretch;
  padding: var(--space-lg);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

/* Search */
.search-container {
  position: relative;
  flex: 1;
  max-width: 300px;
}

.search-input {
  padding-right: var(--space-3xl);
}

.search-icon {
  position: absolute;
  right: var(--space-md);
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary);
  pointer-events: none;
}

/* Table Styles */
.students-table-container {
  max-height: 400px;
  overflow-y: auto;
}

.students-table {
  width: 100%;
  border-collapse: collapse;
}

.students-table th {
  background: var(--bg-tertiary);
  padding: var(--space-md) var(--space-xl);
  text-align: left;
  font-weight: var(--font-weight-semibold);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  border-bottom: 1px solid var(--border-primary);
  position: sticky;
  top: 0;
  z-index: 1;
}

.student-row {
  transition: background-color var(--transition-fast);
}

.student-row:hover {
  background: var(--bg-secondary);
}

.students-table td {
  padding: var(--space-md) var(--space-xl);
  border-bottom: 1px solid var(--border-primary);
}

.student-name {
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
}

.student-card {
  font-family: monospace;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.student-actions {
  text-align: center;
}

.no-students {
  text-align: center;
  color: var(--text-tertiary);
  font-style: italic;
  padding: var(--space-xl);
}

/* Button variants */
.btn-sm {
  padding: var(--space-sm);
  font-size: var(--font-size-sm);
}

.btn-danger {
  background: var(--error-bg);
  color: var(--error-text);
  border: 1px solid var(--error-border);
}

.btn-danger:hover {
  background: var(--error-text);
  color: var(--text-inverse);
}

/* Responsive Design */
@media (max-width: 768px) {
  .card-assignment {
    padding-top: var(--space-lg);
  }

  .header-container {
    flex-direction: column;
    gap: var(--space-md);
    text-align: center;
  }

  .page-title {
    font-size: var(--font-size-xl);
  }

  .assignment-card {
    padding: var(--space-xl);
  }

  .card-header {
    flex-direction: column;
    align-items: stretch;
  }

  .search-container {
    max-width: none;
  }

  .students-table th,
  .students-table td {
    padding: var(--space-sm) var(--space-md);
  }

  .student-card {
    display: none;
  }
}
</style>
