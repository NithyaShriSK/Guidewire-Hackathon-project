import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

const AuthContext = createContext();

const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN_START':
      return {
        ...state,
        loading: true,
        error: null,
      };
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        loading: false,
        isAuthenticated: true,
        user: action.payload.user,
        token: action.payload.token,
        userType: action.payload.userType,
        error: null,
      };
    case 'LOGIN_FAILURE':
      return {
        ...state,
        loading: false,
        isAuthenticated: false,
        user: null,
        token: null,
        userType: null,
        error: action.payload,
      };
    case 'LOGOUT':
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        token: null,
        userType: null,
        loading: false,
        error: null,
      };
    case 'UPDATE_USER':
      return {
        ...state,
        user: { ...state.user, ...action.payload },
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
};

const initialState = {
  isAuthenticated: false,
  user: null,
  token: localStorage.getItem('token'),
  userType: localStorage.getItem('userType'),
  loading: false,
  error: null,
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userType = localStorage.getItem('userType');
    
    if (token && userType) {
      // Verify token validity
      authAPI.getCurrentProfile()
        .then(response => {
          const profileData = response.data?.data || {};
          const normalizedUser = profileData.user || profileData.worker || profileData.admin || profileData.data || profileData;
          const normalizedUserType = profileData.type || userType;

          dispatch({
            type: 'LOGIN_SUCCESS',
            payload: {
              user: normalizedUser,
              token,
              userType: normalizedUserType,
            },
          });
        })
        .catch(() => {
          // Token is invalid, clear it
          localStorage.removeItem('token');
          localStorage.removeItem('userType');
          dispatch({ type: 'LOGOUT' });
        });
    }
  }, []);

  const login = async (email, password, userType = 'worker') => {
    try {
      dispatch({ type: 'LOGIN_START' });
      
      const response = userType === 'admin' 
        ? await authAPI.loginAdmin(email, password)
        : await authAPI.loginWorker(email, password);
      
      const authData = response.data?.data || {};
      const user = authData.user || authData.worker || authData.admin;
      const token = authData.token;

      if (!user || !token) {
        throw new Error('Invalid login response');
      }
      
      localStorage.setItem('token', token);
      localStorage.setItem('userType', userType);
      
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: {
          user,
          token,
          userType,
        },
      });
      
      toast.success(`Welcome back, ${user.personalInfo?.firstName || 'User'}!`);
      return response;
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Login failed';
      dispatch({
        type: 'LOGIN_FAILURE',
        payload: errorMessage,
      });
      toast.error(errorMessage);
      throw error;
    }
  };

  const register = async (userData, userType = 'worker') => {
    try {
      dispatch({ type: 'LOGIN_START' });
      
      const response = userType === 'admin'
        ? await authAPI.registerAdmin(userData)
        : await authAPI.registerWorker(userData);
      
      const authData = response.data?.data || {};
      const user = authData.user || authData.worker || authData.admin;
      const token = authData.token;

      if (!user || !token) {
        throw new Error('Invalid registration response');
      }
      
      localStorage.setItem('token', token);
      localStorage.setItem('userType', userType);
      
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: {
          user,
          token,
          userType,
        },
      });
      
      toast.success(`Welcome to FixMyPay, ${user.personalInfo?.firstName || 'User'}!`);
      return response;
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Registration failed';
      dispatch({
        type: 'LOGIN_FAILURE',
        payload: errorMessage,
      });
      toast.error(errorMessage);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userType');
    dispatch({ type: 'LOGOUT' });
    toast.success('Logged out successfully');
  };

  const updateUser = (userData) => {
    dispatch({
      type: 'UPDATE_USER',
      payload: userData,
    });
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const value = {
    ...state,
    login,
    register,
    logout,
    updateUser,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
