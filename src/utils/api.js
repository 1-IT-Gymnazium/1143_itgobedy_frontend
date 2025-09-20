// API utility functions
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Generic API request function
export async function apiRequest(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  const defaultOptions = {
    credentials: 'include', // This ensures cookies (including JWT) are sent
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

    // Handle empty responses
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  } catch (error) {
    console.error('API Request failed:', error);
    throw error;
  }
}

// Specific API functions
export const api = {
  // Authentication
  verifyToken: (userData) => apiRequest('/api/verify-token', {
    method: 'POST',
    body: JSON.stringify(userData)
  }),

  getUserInfo: () => apiRequest('/api/user-info'),

  logout: () => apiRequest('/api/logout', { method: 'POST' }),

  // Students
  getStudents: () => apiRequest('/api/students'),

  assignCard: (studentData) => apiRequest('/api/assign-card', {
    method: 'POST',
    body: JSON.stringify(studentData)
  }),

  deleteStudent: (studentId) => apiRequest(`/api/students/${studentId}`, {
    method: 'DELETE'
  }),

  // Lunch operations
  giftLunch: (recipientData) => apiRequest('/api/give_lunch_direct', {
    method: 'POST',
    body: JSON.stringify(recipientData)
  })
};
