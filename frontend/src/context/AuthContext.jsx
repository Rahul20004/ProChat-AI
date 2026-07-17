import React, { createContext, useState, useEffect, useContext } from 'react';
import API from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check if user info is in localStorage
    const storedUser = localStorage.getItem('userInfo');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.error('Error parsing stored user:', err);
        localStorage.removeItem('userInfo');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await API.post('/auth/login', { email, password });
      setUser(data.data);
      localStorage.setItem('userInfo', JSON.stringify(data.data));
      setLoading(false);
      return { success: true };
    } catch (err) {
      setLoading(false);
      const msg = err.response?.data?.message || 'Failed to login. Please check credentials.';
      setError(msg);
      return { success: false, message: msg };
    }
  };

  const register = async (username, email, password) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await API.post('/auth/register', { username, email, password });
      setUser(data.data);
      localStorage.setItem('userInfo', JSON.stringify(data.data));
      setLoading(false);
      return { success: true };
    } catch (err) {
      setLoading(false);
      const msg = err.response?.data?.message || 'Registration failed. Try again.';
      setError(msg);
      return { success: false, message: msg };
    }
  };

  const logout = async () => {
    try {
      await API.post('/auth/logout');
    } catch (err) {
      console.error('Error logging out from backend:', err);
    } finally {
      setUser(null);
      localStorage.removeItem('userInfo');
    }
  };

  const updateProfile = async (profileData) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await API.put('/auth/profile', profileData);
      setUser(data.data);
      localStorage.setItem('userInfo', JSON.stringify(data.data));
      setLoading(false);
      return { success: true };
    } catch (err) {
      setLoading(false);
      const msg = err.response?.data?.message || 'Failed to update profile.';
      setError(msg);
      return { success: false, message: msg };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        register,
        logout,
        updateProfile,
        setError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
