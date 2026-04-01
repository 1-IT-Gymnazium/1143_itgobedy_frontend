import { socketAPI } from '../utils/api.js';

/**
 * Executes an async function with retry logic for socket connection
 * @param {Function} fn - The async function to execute
 * @param {number} maxRetries - Maximum number of retries (default: 5)
 * @param {number} retryDelay - Initial delay between retries in ms (default: 500)
 * @returns {Promise} - Result of the function
 */
export async function withSocketRetry(fn, maxRetries = 5, retryDelay = 500) {
  let retryCount = 0;

  const attemptExecution = async () => {
    try {
      // Check if socket is connected
      if (!socketAPI.isConnected() && retryCount < maxRetries) {
        retryCount++;
        // Wait and retry
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return attemptExecution();
      }

      // Execute the function
      return await fn();
    } catch (error) {
      if (retryCount < maxRetries) {
        retryCount++;
        // Retry after a longer delay for actual errors
        await new Promise(resolve => setTimeout(resolve, retryDelay * 2));
        return attemptExecution();
      } else {
        // Re-throw error after max retries
        throw error;
      }
    }
  };

  return attemptExecution();
}

/**
 * Hook to wait for socket connection before executing code
 * @param {number} maxWaitTime - Maximum time to wait in ms (default: 5000)
 * @returns {Promise<boolean>} - True if connected, false if timed out
 */
export async function waitForSocketConnection(maxWaitTime = 5000) {
  const startTime = Date.now();

  while (!socketAPI.isConnected()) {
    if (Date.now() - startTime > maxWaitTime) {
      return false; // Timeout
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return true; // Connected
}

