// src/lib/AuthContext.jsx — FULL REPLACEMENT for local mode
// Removes @base44/sdk dependency. Auto-authenticates as local user.

import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState({ id: 'local', public_settings: {} });

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
      setIsLoadingAuth(false);
    } catch (error) {
      // AUTH-1: a 401 is the normal logged-out state, not an app failure.
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      if (error?.code === 'auth_required') {
        setAuthError({ type: 'auth_required', message: 'Login required.' });
      } else {
        console.error('[AUTH-1] Auth check failed:', error);
        setAuthError({ type: 'unknown', message: error.message });
      }
    }
  };

  const logout = async () => {
    await base44.auth.logout(); // AUTH-1: clears the session cookie, then redirects to /login
  };

  const navigateToLogin = () => {
    if (window.location.pathname !== '/login') window.location.href = '/login'; // AUTH-1
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState
    }}>
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
