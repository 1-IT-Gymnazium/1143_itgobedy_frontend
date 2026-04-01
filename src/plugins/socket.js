import { socketAPI } from '../utils/api.js';

export default {
  install(app) {
    // Make socket API available globally
    app.config.globalProperties.$socket = socketAPI;

    // The actual connection is handled by App.vue based on authentication state
    // This ensures socket only connects when user is authenticated
  }
};

