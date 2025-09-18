const isDevelopment = process.env.NODE_ENV === 'development';

export const API_BASE_URL = process.env.REACT_APP_API_URL || 
  (isDevelopment ? 'http://localhost:3000' : 'https://gogreener.vercel.app');

export const WS_BASE_URL = process.env.REACT_APP_WS_URL || 
  (isDevelopment ? 'ws://localhost:3000' : 'wss://gogreener.vercel.app');