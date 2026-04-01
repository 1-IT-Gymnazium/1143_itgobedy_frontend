// Notifications composable for messages and alerts
import { ref } from 'vue';

export function useNotifications() {
  const message = ref('');
  const messageType = ref(''); // 'success', 'error', 'info'
  const isVisible = ref(false);

  // Show a notification
  function showNotification(text, type = 'info', duration = 5000) {
    message.value = text;
    messageType.value = type;
    isVisible.value = true;

    if (duration > 0) {
      setTimeout(() => {
        clearNotification();
      }, duration);
    }
  }

  // Show success message
  function showSuccess(text, duration = 5000) {
    showNotification(text, 'success', duration);
  }

  // Show error message
  function showError(text, duration = 0) { // Errors stay until manually cleared
    showNotification(text, 'error', duration);
  }

  // Show info message
  function showInfo(text, duration = 5000) {
    showNotification(text, 'info', duration);
  }

  // Clear notification
  function clearNotification() {
    message.value = '';
    messageType.value = '';
    isVisible.value = false;
  }

  return {
    message,
    messageType,
    isVisible,
    showNotification,
    showSuccess,
    showError,
    showInfo,
    clearNotification
  };
}
