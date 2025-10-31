// Socket.IO utility for real-time communication
import { io } from 'socket.io-client';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Store JWT token in memory after login
let cachedJWTToken = null;

// Function to set the token (called after successful login)
export function setJWTToken(token) {
  cachedJWTToken = token;
}

// Function to get the cached token
export function getJWTToken() {
  return cachedJWTToken;
}

// Clear the token (called on logout)
export function clearJWTToken() {
  cachedJWTToken = null;
}

// Utility function to extract JWT token
function extractJWTFromCookies() {
  // First try cached token
  if (cachedJWTToken) {
    return cachedJWTToken;
  }

  // Try document.cookie
  if (document.cookie) {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'access_token_cookie' && value) {
        cachedJWTToken = value;
        return value;
      }
    }
  }

  // Try localStorage as fallback
  const localToken = localStorage.getItem('jwt_token') || localStorage.getItem('access_token');
  if (localToken) {
    cachedJWTToken = localToken;
    return localToken;
  }

  return null;
}

class SocketManager {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.pendingRequests = new Map();
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
  }

  connect(token = null) {
    if (this.socket?.connected || this.isConnecting) {
      return this.socket;
    }

    this.isConnecting = true;

    const authToken = token || extractJWTFromCookies();
    const auth = authToken ? { token: authToken } : undefined;

    this.socket = io(API_BASE_URL, {
      auth,
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
      timeout: 5000,
      transports: ['websocket'],
    });

    this.setupEventListeners();
    return this.socket;
  }



  setupEventListeners() {
    this.socket.on('connect', () => {
      console.log('Socket connected globally');
      this.connected = true;
      this.isConnecting = false;
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
      window.dispatchEvent(new CustomEvent('socket-disconnected', {detail: { message: 'Websocket disconnected' } }));
      this.connected = false;
      this.isConnecting = false;
      this.socket.io.reconnection(false);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      window.dispatchEvent(new CustomEvent('server-error', { detail: { message: 'Server connection error' } }));
      this.isConnecting = false;
      this.socket.io.reconnection(false);
    });

    this.socket.on('error', (error) => {
      console.error('Socket.IO error:', error);
    });

    // Handle specific response events
    this.socket.on('user_info_response', (data) => this.handleResponse('user_info', data));
    this.socket.on('user_info_error', (error) => this.handleError('user_info', error));

    this.socket.on('lunches_response', (data) => this.handleResponse('lunches', data));
    this.socket.on('lunches_error', (error) => this.handleError('lunches', error));

    this.socket.on('students_response', (data) => this.handleResponse('students', data));
    this.socket.on('students_error', (error) => this.handleError('students', error));

    this.socket.on('all_students_response', (data) => this.handleResponse('all_students', data));
    this.socket.on('all_students_error', (error) => this.handleError('all_students', error));

    this.socket.on('recent_lunches_response', (data) => this.handleResponse('recent_lunches', data));
    this.socket.on('recent_lunches_error', (error) => this.handleError('recent_lunches', error));
  }

  handleResponse(eventType, data) {
    const pendingRequest = this.pendingRequests.get(eventType);
    if (pendingRequest) {
      pendingRequest.resolve(data);
      this.pendingRequests.delete(eventType);
    }
  }

  handleError(eventType, error) {
    const pendingRequest = this.pendingRequests.get(eventType);
    if (pendingRequest) {
      pendingRequest.reject(new Error(error.error || 'Socket request failed'));
      this.pendingRequests.delete(eventType);
    }
  }

  emitWithPromise(eventName, data = {}, responseType = null) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      const freshToken = extractJWTFromCookies();
      const eventData = {
        ...data,
        token: freshToken
      };

      if (responseType) {
        this.pendingRequests.set(responseType, { resolve, reject });

        setTimeout(() => {
          if (this.pendingRequests.has(responseType)) {
            this.pendingRequests.delete(responseType);
            reject(new Error('Socket request timeout'));
          }
        }, 10000);
      }

      this.socket.emit(eventName, eventData);

      if (!responseType) {
        resolve();
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.pendingRequests.clear();
    }
  }

  // Subscribe to real-time updates
  onLunchUpdates(callback) {
    if (this.socket) {
      this.socket.on('lunches_response', callback);
    }
  }

  onStudentUpdates(callback) {
    if (this.socket) {
      this.socket.on('students_response', callback);
    }
  }

  onAllStudentUpdates(callback) {
    if (this.socket) {
      this.socket.on('all_students_response', callback);
    }
  }

  onUserInfoUpdates(callback) {
    if (this.socket) {
      this.socket.on('user_info_response', callback);
    }
  }

  onRecentLunchUpdates(callback) {
    if (this.socket) {
      this.socket.on('recent_lunches_response', callback);
    }
  }

  // Remove event listeners
  offLunchUpdates(callback) {
    if (this.socket) {
      this.socket.off('lunches_response', callback);
    }
  }

  offStudentUpdates(callback) {
    if (this.socket) {
      this.socket.off('students_response', callback);
    }
  }

  offAllStudentUpdates(callback) {
    if (this.socket) {
      this.socket.off('all_students_response', callback);
    }
  }

  offUserInfoUpdates(callback) {
    if (this.socket) {
      this.socket.off('user_info_response', callback);
    }
  }

  offRecentLunchUpdates(callback) {
    if (this.socket) {
      this.socket.off('recent_lunches_response', callback);
    }
  }
}

// Create singleton instance
const socketManager = new SocketManager();

// Socket-based API functions (replacing HTTP GET requests)
export const socketAPI = {
  // Initialize socket connection
  connect: (token = null) => {
    return socketManager.connect(token);
  },

  // Disconnect socket
  disconnect: () => {
    socketManager.disconnect();
  },

  // Get user info (replaces getUserInfo GET request)
  getUserInfo: async () => {
    return socketManager.emitWithPromise('get_user_info', {}, 'user_info');
  },

  // Get available lunches (replaces lunches GET request)
  getLunches: async () => {
    return socketManager.emitWithPromise('get_lunches', {}, 'lunches');
  },

  // Get students without lunch (replaces students GET request)
  getStudents: async () => {
    return socketManager.emitWithPromise('get_students', {}, 'students');
  },

  // Get all students (replaces getAll GET request)
  getAllStudents: async () => {
    return socketManager.emitWithPromise('get_all_students', {}, 'all_students');
  },

  // Get recent lunches (replaces recentLunches GET request)
  getRecentLunches: async () => {
    return socketManager.emitWithPromise('get_recent_lunches', {}, 'recent_lunches');
  },

  // Subscribe to real-time updates
  onLunchUpdates: (callback) => socketManager.onLunchUpdates(callback),
  onStudentUpdates: (callback) => socketManager.onStudentUpdates(callback),
  onAllStudentUpdates: (callback) => socketManager.onAllStudentUpdates(callback),
  onUserInfoUpdates: (callback) => socketManager.onUserInfoUpdates(callback),
  onRecentLunchUpdates: (callback) => socketManager.onRecentLunchUpdates(callback),

  // Unsubscribe from real-time updates
  offLunchUpdates: (callback) => socketManager.offLunchUpdates(callback),
  offStudentUpdates: (callback) => socketManager.offStudentUpdates(callback),
  offAllStudentUpdates: (callback) => socketManager.offAllStudentUpdates(callback),
  offUserInfoUpdates: (callback) => socketManager.offUserInfoUpdates(callback),
  offRecentLunchUpdates: (callback) => socketManager.offRecentLunchUpdates(callback),

  // Access to raw socket for custom events
  getSocket: () => socketManager.socket,

  // Check connection status
  isConnected: () => socketManager.connected
};

export default socketAPI;
