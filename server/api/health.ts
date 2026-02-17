import { defineEventHandler } from 'h3';

// Simple health check endpoint
export default defineEventHandler(() => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'SoLaRi API is running'
  };
});
