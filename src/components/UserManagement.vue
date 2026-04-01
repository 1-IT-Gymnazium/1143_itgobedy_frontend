<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { io } from 'socket.io-client';
import { api } from '@/utils/api';
import { useNotifications } from '@/composables/useNotifications';

const router = useRouter();
const { showError, showSuccess, clearNotification, message, messageType } = useNotifications();

const users = ref([]);
const isLoading = ref(true);
const searchQuery = ref('');

// Edit modal
const showEditModal = ref(false);
const editingUser = ref(null);
const editForm = ref({ name: '', card_id: '' });
const isSaving = ref(false);

// Card scanner (for edit modal)
let cardReaderSocket = null;
const scanStatus = ref('idle'); // 'idle' | 'waiting' | 'scanned' | 'error' | 'checking'

// Helper: extract card UID field from a student record
// Tries every known field name, then falls back to scanning for a hex-looking string
function getCardUid(student) {
  const knownFields = [
    'card_uid', 'card_id', 'uid', 'nfc_uid', 'nfc_id',
    'rfid', 'rfid_uid', 'card_number', 'card_code',
    'tag_uid', 'tag_id', 'nfc_tag', 'card'
  ];
  for (const f of knownFields) {
    if (student[f] && typeof student[f] === 'string' && student[f].trim()) {
      return student[f].trim();
    }
  }
  // Fallback: find any string field that looks like a hex UID (6–20 hex chars)
  for (const [, val] of Object.entries(student)) {
    if (val && typeof val === 'string') {
      const stripped = val.replace(/[:\-\s]/g, '');
      if (/^[A-Fa-f0-9]{6,20}$/.test(stripped)) return val;
    }
  }
  return null;
}

// Helper: extract display name from a student record
function getDisplayName(student) {
  return student.name ?? student.full_name ?? student.username ?? `User #${student.id}`;
}

// Delete modal
const showDeleteModal = ref(false);
const deletingUser = ref(null);
const isDeleting = ref(false);

const filteredUsers = computed(() => {
  if (!searchQuery.value.trim()) return users.value;
  const q = searchQuery.value.toLowerCase();
  return users.value.filter(u =>
    (u.name || '').toLowerCase().includes(q) ||
    (u.card_id || '').toLowerCase().includes(q)
  );
});

// UIDs already taken by OTHER users (shown inside the edit modal)
const takenUids = computed(() => {
  const editingId = String(editingUser.value?.id ?? '');
  return users.value
    .filter(u => u.card_id && String(u.id) !== editingId)
    .map(u => ({ uid: u.card_id, name: u.name || `#${u.id}` }));
});

onMounted(async () => {
  await loadUsers();
});

async function loadUsers() {
  isLoading.value = true;
  try {
    const res = await api.getAllStudents();
    const raw = res.users || res.students || [];

    // Debug: log the first user's raw keys so we can confirm the field name
    if (raw.length > 0) {
      console.log('[UserManagement] raw user fields:', Object.keys(raw[0]));
      console.log('[UserManagement] raw user sample:', JSON.stringify(raw[0]));
    }

    users.value = raw.map(u => ({
      ...u,
      name:    u.name ?? u.full_name ?? u.username ?? '',
      card_id: (getCardUid(u) ?? '').toString().toUpperCase()
    }));

    console.log('[UserManagement] normalised sample:', JSON.stringify(users.value[0]));
  } catch (e) {
    console.error('[UserManagement] loadUsers error:', e);
    showError('Failed to load users');
  } finally {
    isLoading.value = false;
  }
}

onUnmounted(() => {
  disconnectCardReader();
});

function connectCardReader() {
  if (cardReaderSocket?.connected) return;
  scanStatus.value = 'waiting';

  cardReaderSocket = io('http://localhost:3001', {
    transports: ['websocket'],
    upgrade: false
  });

  cardReaderSocket.on('connect', () => {
    scanStatus.value = 'waiting';
  });

  cardReaderSocket.on('card_scanned', async (data) => {
    if (!data.uid) {
      scanStatus.value = 'error';
      showError('No UID received from card reader.');
      return;
    }

    const scannedUid = data.uid.toUpperCase().replace(/[^A-F0-9]/g, '');
    const editingId  = String(editingUser.value?.id ?? '');

    scanStatus.value = 'checking';

    // ── Step 1: check the local (already-normalised) users list ──────────────
    const localOwner = users.value.find(u => {
      if (String(u.id) === editingId) return false; // skip self
      return (u.card_id || '').toUpperCase() === scannedUid;
    });

    if (localOwner) {
      scanStatus.value = 'error';
      showError(`This card is already assigned to "${localOwner.name || localOwner.id}". Please use a different card.`);
      return;
    }

    // ── Step 2: fresh DB fetch to catch any changes since page load ──────────
    try {
      const res = await api.getAllStudents();
      const allStudents = res.users || res.students || [];

      const dbOwner = allStudents.find(s => {
        if (String(s.id) === editingId) return false; // skip self
        const uid = getCardUid(s);
        if (!uid) return false;
        return uid.toUpperCase().replace(/[^A-F0-9]/g, '') === scannedUid;
      });

      if (dbOwner) {
        scanStatus.value = 'error';
        showError(`This card is already assigned to "${getDisplayName(dbOwner)}". Please use a different card.`);
        return;
      }

      // All clear
      editForm.value.card_id = data.uid;
      scanStatus.value = 'scanned';

    } catch (e) {
      // DB unreachable — do NOT accept the card, force manual entry
      console.error('Card duplicate check failed:', e);
      scanStatus.value = 'error';
      showError('Could not reach the database to verify this card. Enter the UID manually if you are sure it is not in use.');
    }
  });

  cardReaderSocket.on('connect_error', () => {
    scanStatus.value = 'error';
  });

  cardReaderSocket.on('disconnect', () => {
    if (scanStatus.value === 'waiting') scanStatus.value = 'error';
  });
}

function disconnectCardReader() {
  if (cardReaderSocket) {
    cardReaderSocket.disconnect();
    cardReaderSocket = null;
  }
  scanStatus.value = 'idle';
}

function openEdit(user) {
  editingUser.value = user;
  editForm.value = { name: user.name || '', card_id: user.card_id || '' };
  showEditModal.value = true;
  scanStatus.value = 'idle';
}

function closeEdit() {
  showEditModal.value = false;
  editingUser.value = null;
  disconnectCardReader();
}

async function saveEdit() {
  if (!editingUser.value) return;
  isSaving.value = true;
  try {
    await api.updateStudent(editingUser.value.id, editForm.value);
    const idx = users.value.findIndex(u => u.id === editingUser.value.id);
    if (idx !== -1) users.value[idx] = { ...users.value[idx], ...editForm.value };
    showSuccess(`User "${editForm.value.name}" updated successfully.`);
    closeEdit();
  } catch (e) {
    showError('Failed to update user: ' + e.message);
  } finally {
    isSaving.value = false;
  }
}

function openDelete(user) {
  deletingUser.value = user;
  showDeleteModal.value = true;
}

function closeDelete() {
  showDeleteModal.value = false;
  deletingUser.value = null;
}

async function confirmDelete() {
  if (!deletingUser.value) return;
  isDeleting.value = true;
  try {
    await api.deleteStudent(deletingUser.value.id);
    const name = deletingUser.value.name;
    users.value = users.value.filter(u => u.id !== deletingUser.value.id);
    showSuccess(`User "${name}" deleted successfully.`);
    closeDelete();
  } catch (e) {
    showError('Failed to delete user: ' + e.message);
  } finally {
    isDeleting.value = false;
  }
}
</script>

<template>
  <div class="user-management">
    <!-- Header -->
    <header class="um-header">
      <div class="um-header-inner">
        <button class="back-btn" @click="router.push('/admin')">
          <i class="bi bi-arrow-left"></i>
          <span>Back to Admin</span>
        </button>
        <h1 class="um-title">
          <i class="bi bi-people-fill"></i>
          User Management
        </h1>
        <button class="refresh-btn" @click="loadUsers" title="Refresh">
          <i class="bi bi-arrow-clockwise"></i>
        </button>
      </div>
    </header>

    <!-- Main -->
    <main class="um-main">
      <div class="um-container">

        <!-- Search + count bar -->
        <div class="um-toolbar">
          <div class="search-wrap">
            <i class="bi bi-search search-icon"></i>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search by name or card ID…"
              class="search-input"
            />
            <button v-if="searchQuery" class="search-clear" @click="searchQuery = ''">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
          <span class="user-count">
            {{ filteredUsers.length }} / {{ users.length }} users
          </span>
        </div>

        <div class="dev-banner dev-banner--page" role="status" aria-live="polite">
          <i class="bi bi-tools"></i>
          <span><strong>Under development:</strong> User management is still being refined.</span>
        </div>

        <!-- Alert Banner -->
        <div
          v-if="message"
          class="alert"
          :class="`alert-${messageType}`"
          @click="clearNotification"
        >
          <span>{{ message }}</span>
          <span class="alert-close">×</span>
        </div>

        <!-- Loading -->
        <div v-if="isLoading" class="loading-state">
          <div class="spinner"></div>
          <p>Loading users…</p>
        </div>

        <!-- Table -->
        <div v-else class="table-wrap">
          <table class="user-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Card ID</th>
                <th>Lunch</th>
                <th class="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="filteredUsers.length === 0">
                <td colspan="5" class="empty-row">No users found.</td>
              </tr>
              <tr v-for="(user, i) in filteredUsers" :key="user.id">
                <td class="index-cell">{{ i + 1 }}</td>
                <td class="name-cell">
                  <span class="avatar">{{ (user.name || '?')[0].toUpperCase() }}</span>
                  {{ user.name || '—' }}
                </td>
                <td class="card-cell">
                  <span v-if="user.card_id" class="card-badge">{{ user.card_id }}</span>
                  <span v-else class="no-card">No card</span>
                </td>
                <td class="lunch-cell">
                  <span :class="['lunch-badge', user.has_lunch ? 'yes' : 'no']">
                    <i :class="user.has_lunch ? 'bi bi-check-circle-fill' : 'bi bi-x-circle-fill'"></i>
                    {{ user.has_lunch ? 'Yes' : 'No' }}
                  </span>
                </td>
                <td class="actions-cell">
                  <button class="action-btn edit" @click="openEdit(user)" title="Edit">
                    <i class="bi bi-pencil-fill"></i>
                  </button>
                  <button class="action-btn delete" @click="openDelete(user)" title="Delete">
                    <i class="bi bi-trash3-fill"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>

    <!-- Edit Modal -->
    <Teleport to="body">
      <div v-if="showEditModal" class="modal-backdrop" @click.self="closeEdit">
        <div class="modal-box">
          <div class="modal-header">
            <h2><i class="bi bi-pencil-fill"></i> Edit User</h2>
            <button class="modal-close" @click="closeEdit"><i class="bi bi-x-lg"></i></button>
          </div>
          <div class="modal-body">
            <div class="dev-banner" role="status" aria-live="polite">
              <i class="bi bi-tools"></i>
              <span><strong>Under development:</strong> User editing is still being refined.</span>
            </div>
            <div class="field-group">
              <label>Full Name</label>
              <input v-model="editForm.name" type="text" placeholder="User name" class="field-input" />
            </div>
            <div class="field-group">
              <label>Card ID</label>
              <div class="card-id-wrap">
                <input
                  v-model="editForm.card_id"
                  type="text"
                  placeholder="NFC card UID"
                  class="field-input card-id-input"
                  :class="{ 'input-scanned': scanStatus === 'scanned' }"
                />
                <button
                  type="button"
                  class="scan-btn"
                  :class="{
                    'scan-waiting':  scanStatus === 'waiting' || scanStatus === 'checking',
                    'scan-scanned':  scanStatus === 'scanned',
                    'scan-error':    scanStatus === 'error'
                  }"
                  @click="scanStatus === 'waiting' ? disconnectCardReader() : connectCardReader()"
                  :disabled="scanStatus === 'checking'"
                  :title="scanStatus === 'waiting' ? 'Cancel scan' : 'Scan NFC card'"
                >
                  <i v-if="scanStatus === 'waiting'"  class="bi bi-broadcast scan-pulse"></i>
                  <i v-else-if="scanStatus === 'checking'" class="bi bi-hourglass-split scan-pulse"></i>
                  <i v-else-if="scanStatus === 'scanned'" class="bi bi-check-circle-fill"></i>
                  <i v-else-if="scanStatus === 'error'"   class="bi bi-exclamation-circle-fill"></i>
                  <i v-else                               class="bi bi-wifi"></i>
                </button>
              </div>
              <p v-if="scanStatus === 'waiting'" class="scan-hint">
                <i class="bi bi-broadcast"></i> Waiting for card — hold it near the reader…
              </p>
              <p v-else-if="scanStatus === 'checking'" class="scan-hint">
                <i class="bi bi-hourglass-split"></i> Checking card against database…
              </p>
              <p v-else-if="scanStatus === 'scanned'" class="scan-hint scanned">
                <i class="bi bi-check-circle-fill"></i> Card scanned successfully!
              </p>
              <p v-else-if="scanStatus === 'error'" class="scan-hint error">
                <i class="bi bi-exclamation-circle-fill"></i> Card reader not reachable. Enter UID manually.
              </p>
            </div>

            <!-- Taken UIDs reference list -->
            <div v-if="takenUids.length" class="taken-uids">
              <p class="taken-uids-label">
                <i class="bi bi-card-list"></i> UIDs already in use
              </p>
              <div class="taken-uids-list">
                <div
                  v-for="entry in takenUids"
                  :key="entry.uid"
                  class="taken-uid-row"
                  :class="{ 'taken-uid-conflict': editForm.card_id && editForm.card_id.toUpperCase() === entry.uid }"
                >
                  <span class="taken-uid-code">{{ entry.uid }}</span>
                  <span class="taken-uid-name">{{ entry.name }}</span>
                  <i v-if="editForm.card_id && editForm.card_id.toUpperCase() === entry.uid"
                     class="bi bi-exclamation-triangle-fill taken-uid-warn"></i>
                </div>
              </div>
            </div>

          </div>
          <div class="modal-footer">
            <button class="btn secondary" @click="closeEdit">Cancel</button>
            <button class="btn primary" @click="saveEdit" :disabled="isSaving">
              <span v-if="isSaving"><i class="bi bi-hourglass-split"></i> Saving…</span>
              <span v-else><i class="bi bi-check-lg"></i> Save Changes</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <div v-if="showDeleteModal" class="modal-backdrop" @click.self="closeDelete">
        <div class="modal-box modal-box--danger">
          <div class="modal-header">
            <h2><i class="bi bi-exclamation-triangle-fill"></i> Delete User</h2>
            <button class="modal-close" @click="closeDelete"><i class="bi bi-x-lg"></i></button>
          </div>
          <div class="modal-body">
            <p>Are you sure you want to permanently delete <strong>{{ deletingUser?.name }}</strong>? This action cannot be undone.</p>
          </div>
          <div class="modal-footer">
            <button class="btn secondary" @click="closeDelete">Cancel</button>
            <button class="btn danger" @click="confirmDelete" :disabled="isDeleting">
              <span v-if="isDeleting"><i class="bi bi-hourglass-split"></i> Deleting…</span>
              <span v-else><i class="bi bi-trash3-fill"></i> Delete</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.user-management {
  min-height: 100vh;
  background: transparent;
  display: flex;
  flex-direction: column;
}

/* Header */
.um-header {
  background: var(--brand-primary);
  padding: var(--space-xl) 0;
  box-shadow: var(--shadow-md);
}

.um-header-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--space-lg);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-lg);
}

.back-btn {
  background: var(--bg-card);
  color: var(--brand-primary);
  border: none;
  border-radius: var(--radius-lg);
  padding: var(--space-md) var(--space-lg);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  transition: all var(--transition-fast);
  box-shadow: var(--shadow-sm);
  white-space: nowrap;
}

.back-btn:hover {
  background: var(--bg-secondary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.um-title {
  color: white;
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  display: flex;
  align-items: center;
  gap: var(--space-md);
  margin: 0;
}

.refresh-btn {
  background: rgba(255,255,255,0.15);
  color: white;
  border: none;
  border-radius: var(--radius-lg);
  padding: var(--space-md) var(--space-lg);
  font-size: var(--font-size-xl);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.refresh-btn:hover {
  background: rgba(255,255,255,0.25);
  transform: rotate(30deg);
}

/* Main */
.um-main {
  flex: 1;
  padding: var(--space-2xl) 0;
}

.um-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--space-lg);
}

/* Toolbar */
.um-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  margin-bottom: var(--space-xl);
  flex-wrap: wrap;
}

.search-wrap {
  flex: 1;
  min-width: 240px;
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: var(--space-md);
  color: var(--text-secondary);
  font-size: var(--font-size-lg);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: var(--space-md) var(--space-md) var(--space-md) 2.4rem;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: var(--font-size-base);
  outline: none;
  transition: border-color var(--transition-fast);
}

.search-input:focus {
  border-color: var(--brand-primary);
}

.search-clear {
  position: absolute;
  right: var(--space-sm);
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: var(--space-xs);
  font-size: var(--font-size-sm);
}

.user-count {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  white-space: nowrap;
}

/* Loading */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-2xl);
  color: var(--text-secondary);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--border-primary);
  border-top-color: var(--brand-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: var(--space-lg);
}

@keyframes spin { to { transform: rotate(360deg); } }

/* Table */
.table-wrap {
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.user-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-base);
}

.user-table thead tr {
  background: var(--bg-secondary);
  border-bottom: 2px solid var(--border-primary);
}

.user-table th {
  padding: var(--space-md) var(--space-lg);
  text-align: left;
  font-weight: var(--font-weight-semibold);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.user-table tbody tr {
  border-bottom: 1px solid var(--border-primary);
  transition: background var(--transition-fast);
}

.user-table tbody tr:last-child {
  border-bottom: none;
}

.user-table tbody tr:hover {
  background: var(--bg-secondary);
}

.user-table td {
  padding: var(--space-md) var(--space-lg);
  color: var(--text-primary);
  vertical-align: middle;
}

.index-cell {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  width: 48px;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  font-weight: var(--font-weight-medium);
}

.avatar {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-full);
  background: var(--brand-primary);
  color: white;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-sm);
  flex-shrink: 0;
}

.card-badge {
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: 2px 8px;
  font-size: var(--font-size-sm);
  font-family: monospace;
  color: var(--text-primary);
}

.no-card {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-style: italic;
}

.lunch-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.lunch-badge.yes {
  background: var(--success-bg);
  color: var(--success-text);
}

.lunch-badge.no {
  background: var(--error-bg);
  color: var(--error-text);
}

.actions-col { width: 100px; }

.actions-cell {
  display: flex;
  gap: var(--space-sm);
}

.action-btn {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-base);
  transition: all var(--transition-fast);
}

.action-btn.edit {
  background: var(--info-bg);
  color: var(--info-text);
}

.action-btn.edit:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.action-btn.delete {
  background: var(--error-bg);
  color: var(--error-text);
}

.action-btn.delete:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.empty-row {
  text-align: center;
  color: var(--text-secondary);
  padding: var(--space-2xl) !important;
  font-style: italic;
}

/* Modals */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-lg);
}

.modal-box {
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-xl);
  width: 100%;
  max-width: 460px;
  overflow: hidden;
  animation: modal-in 0.18s ease;
}

@keyframes modal-in {
  from { opacity: 0; transform: scale(0.95) translateY(8px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}

.modal-box--danger .modal-header {
  background: var(--error-bg);
  color: var(--error-text);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-xl);
  border-bottom: 1px solid var(--border-primary);
  background: var(--bg-secondary);
}

.modal-header h2 {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.modal-close {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: var(--font-size-xl);
  padding: var(--space-xs);
  border-radius: var(--radius-md);
  transition: color var(--transition-fast);
}

.modal-close:hover { color: var(--text-primary); }

.modal-body {
  padding: var(--space-xl);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.dev-banner {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-lg);
  border: 1px solid var(--warning-border, #f59e0b);
  border-left: 4px solid #f59e0b;
  background: var(--warning-bg, #fff7e6);
  color: var(--warning-text, #7a4f01);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

.dev-banner--page {
  margin-bottom: var(--space-lg);
}

.dev-banner i {
  margin-top: 2px;
  color: #f59e0b;
}

[data-theme='dark'] .dev-banner {
  background: rgba(245, 158, 11, 0.15);
  color: #fcd34d;
  border-color: rgba(245, 158, 11, 0.6);
}

.modal-body p {
  margin: 0;
  color: var(--text-primary);
  line-height: 1.6;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.field-group label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.field-input {
  padding: var(--space-md) var(--space-lg);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: var(--font-size-base);
  outline: none;
  transition: border-color var(--transition-fast);
}

.field-input:focus {
  border-color: var(--brand-primary);
}

/* Card ID scan field */
.card-id-wrap {
  display: flex;
  gap: var(--space-sm);
}

.card-id-input {
  flex: 1;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.card-id-input.input-scanned {
  border-color: var(--success-text);
  box-shadow: 0 0 0 3px var(--success-bg);
}

.scan-btn {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.15rem;
  transition: all var(--transition-fast);
}

.scan-btn:hover { background: var(--bg-card); color: var(--brand-primary); border-color: var(--brand-primary); }

.scan-btn.scan-waiting {
  background: #eff6ff;
  border-color: #3b82f6;
  color: #3b82f6;
}
:root.dark .scan-btn.scan-waiting {
  background: #1e3a5f;
  border-color: #60a5fa;
  color: #60a5fa;
}

.scan-btn.scan-scanned {
  background: var(--success-bg);
  border-color: var(--success-text);
  color: var(--success-text);
}

.scan-btn.scan-error {
  background: var(--error-bg);
  border-color: var(--error-text);
  color: var(--error-text);
}

@keyframes pulse-broadcast {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.5; transform: scale(1.2); }
}

.scan-pulse {
  animation: pulse-broadcast 1.2s ease-in-out infinite;
}

.scan-hint {
  margin: var(--space-xs) 0 0;
  font-size: var(--font-size-sm);
  color: #3b82f6;
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.scan-hint.scanned { color: var(--success-text); }
.scan-hint.error   { color: var(--error-text); }

/* Taken UIDs list */
.taken-uids {
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.taken-uids-label {
  margin: 0;
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-secondary);
  font-size: var(--font-size-xs, 0.72rem);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  border-bottom: 1px solid var(--border-primary);
}

.taken-uids-list {
  max-height: 150px;
  overflow-y: auto;
}

.taken-uid-row {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-xs) var(--space-md);
  border-bottom: 1px solid var(--border-primary);
  transition: background var(--transition-fast);
}

.taken-uid-row:last-child { border-bottom: none; }

.taken-uid-row:hover { background: var(--bg-secondary); }

.taken-uid-row.taken-uid-conflict {
  background: var(--error-bg);
}

.taken-uid-code {
  font-family: monospace;
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  flex-shrink: 0;
  min-width: 110px;
}

.taken-uid-name {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.taken-uid-warn {
  color: var(--error-text);
  flex-shrink: 0;
  font-size: var(--font-size-base);
}



.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-md);
  padding: var(--space-lg) var(--space-xl);
  border-top: 1px solid var(--border-primary);
  background: var(--bg-secondary);
}

.btn {
  padding: var(--space-md) var(--space-xl);
  border: none;
  border-radius: var(--radius-lg);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--font-size-base);
  transition: all var(--transition-fast);
}

.btn:disabled { opacity: 0.6; cursor: not-allowed; }

.btn.secondary {
  background: var(--bg-card);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
}

.btn.secondary:hover:not(:disabled) { background: var(--bg-secondary); }

.btn.primary {
  background: var(--brand-primary);
  color: white;
}

.btn.primary:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }

.btn.danger {
  background: var(--error-text);
  color: white;
}

.btn.danger:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }

/* Alert banner */
.alert {
  margin-bottom: var(--space-lg);
  padding: var(--space-md) var(--space-lg);
  border-radius: var(--radius-lg);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  font-weight: var(--font-weight-medium);
  transition: opacity var(--transition-fast);
}

.alert:hover { opacity: 0.88; }

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

.alert-info {
  background: var(--info-bg);
  color: var(--info-text);
  border: 1px solid var(--border-primary);
}

.alert-close {
  font-size: 1.4rem;
  font-weight: bold;
  opacity: 0.5;
  flex-shrink: 0;
}

/* Responsive */
@media (max-width: 640px) {
  .um-title span { display: none; }
  .user-table th:nth-child(1),
  .user-table td:nth-child(1),
  .user-table th:nth-child(3),
  .user-table td:nth-child(3) { display: none; }
}
</style>

