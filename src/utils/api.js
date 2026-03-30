// API utility functions
import {socketAPI, getJWTToken} from './socket.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Generic API request function (for POST requests only now)
export async function apiRequest(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  const defaultOptions = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  };

  try {
    const response = await fetch(url, { ...defaultOptions, ...options });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorJson.msg || `HTTP ${response.status}`;
      } catch {
        errorMessage = errorText || `HTTP ${response.status}`;
      }
      throw new Error(errorMessage);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : {};
  } catch (error) {
    console.error('API Request failed:', error);
    throw error;
  }
}

// Combined API functions - Socket.IO for GET requests, HTTP for POST requests
export const api = {
  // Authentication (HTTP POST - with immediate socket connection)
  verifyToken: async (userData) => {
    const response = await apiRequest('/api/verify-token', {
      method: 'POST',
      body: JSON.stringify(userData)
    });

    // After successful login, immediately establish socket connection
    if (response && response.message === 'Authentication successful') {
      // If backend returns token in response, use it immediately
      if (response.token) {
        const { setJWTToken } = await import('./socket.js');
        setJWTToken(response.token);
        socketAPI.connect(response.token);
      } else {
        socketAPI.connect();
      }
    }

    return response;
  },

  logout: async () => {
    socketAPI.disconnect();

    const { clearJWTToken } = await import('./socket.js');
    clearJWTToken();

    return await apiRequest('/api/logout', {method: 'POST'});
  },

  // GET requests replaced with Socket.IO
  getUserInfo: () => socketAPI.getUserInfo(),
  getStudents: () => socketAPI.getStudents(),
  getAllStudents: () => socketAPI.getAllStudents(),
  getLunches: () => socketAPI.getLunches(),
  getRecentLunches: () => socketAPI.getRecentLunches(),

  // POST requests remain as HTTP (unchanged)
  assignCard: (studentData) => {
    const token = getJWTToken();
    return apiRequest('/api/assign_card', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(studentData)
    });
  },

  deleteStudent: (studentId) => apiRequest(`/api/students/${studentId}`, {
    method: 'DELETE'
  }),

  updateStudent: (studentId, data) => {
    const token = getJWTToken();
    return apiRequest(`/api/students/${studentId}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(data)
    });
  },

  giftLunch: (recipientData) => apiRequest('/api/give_lunch_direct', {
    method: 'POST',
    body: JSON.stringify(recipientData)
  }),

  requestLunch: (lunchData) => apiRequest('/api/request_lunch', {
    method: 'POST',
    body: JSON.stringify(lunchData)
  }),

  giveLunch: () => apiRequest('/api/give_lunch', {
    method: 'POST'
  })
};

// Export socket API for direct access to real-time features
export { socketAPI };
