/* eslint-disable import/no-anonymous-default-export */
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';


const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'https://api.playlobbyboss.com',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add interceptor to add auth token to requests with proper Bearer format
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
      
      // Debug log in development
      if (process.env.NODE_ENV !== 'production') {
        console.log(`Authorization header set: Bearer ${token.substring(0, 15)}...`);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle token expiration and other errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      console.error('API Error:', error.response.status, error.response.data);
      if (error.response.status === 401) {
        // Optional: Redirect to login page on authentication failure
        // window.location.href = '/login';
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.error('Network Error:', error.request);
    } else {
      // Something happened in setting up the request
      console.error('Request Error:', error.message);
    }
    return Promise.reject(error);
  }
);

// Auth API calls
export const authAPI = {
  register: async (email, username, password, hotelName, hotelType) => {
    try {
      const response = await api.post('/api/auth/register', { 
        email, 
        username, 
        password, 
        hotelName, 
        hotelType 
      });
      
      if (response.data && response.data.token) {
        AsyncStorage.setItem('token', response.data.token);
        
        // Store user data
        if (response.data.user) {
          AsyncStorage.setItem('user', JSON.stringify(response.data.user));
        }
      }
      return response;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  },
  
  login: async (email, password) => {
    try {
      const response = await api.post('/api/auth/login', { email, password });
      
      // Store token immediately after login
      if (response.data && response.data.token) {
        AsyncStorage.setItem('token', response.data.token);
        
        // Store user data if available
        if (response.data.user) {
          AsyncStorage.setItem('user', JSON.stringify(response.data.user));
        }
      }
      
      return response;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },
  
  forgotPassword: (email) => {
    return api.post('/api/auth/forgot-password', { email });
  },
  
  logout: () => {
    AsyncStorage.removeItem('token');
    AsyncStorage.removeItem('user');
    // Don't remove gameState to allow continuing locally
  }
};

// User profile API calls
export const userAPI = {
  getProfile: () => {
    return api.get('/api/user/me');
  },
  
  updateProfile: (userData) => {
    return api.put('/api/user/profile', userData);
  },
  
  updateHotel: (hotelData) => {
    return api.put('/api/user/hotel', hotelData);
  }
};

// Game API calls
export const gameAPI = {
  // Leaderboard
  getLeaderboard: () => {
    return api.get('/api/games/leaderboard');
  },
  
  getLeaderboardByType: (hotelType) => {
    return api.get(`/api/games/leaderboard/${hotelType}`);
  },
  
  submitScore: (scoreData) => {
    return api.post('/api/games/score', scoreData);
  },
  
  // User scores
  getUserScores: () => {
    return api.get('/api/games/my-scores');
  },
  
  // Cloud saves
  saveGame: (saveName, gameState) => {
    return api.post('/api/games/save', { saveName, gameState });
  },
  
  getSavedGames: () => {
    return api.get('/api/games/saved-games');
  },
  
  loadSavedGame: (saveId) => {
    return api.get(`/api/games/saved-games/${saveId}`);
  },
  
  deleteSavedGame: (saveId) => {
    return api.delete(`/api/games/saved-games/${saveId}`);
  },
  
  // Game stats
  getGameStats: () => {
    return api.get('/api/games/stats');
  }
};

export default {
  auth: authAPI,
  user: userAPI,
  game: gameAPI
};