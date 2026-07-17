import React, { createContext, useState, useEffect, useContext } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    if (user && user.token) {
      // Initialize socket client with token authentication handshake
      const socketUrl = 'http://localhost:4002';
      const socketInstance = io(socketUrl, {
        auth: {
          token: user.token,
        },
      });

      setSocket(socketInstance);

      // Listen for socket online users updates
      socketInstance.on('online_users', (users) => {
        setOnlineUsers(users);
      });

      // Log successful socket connection
      socketInstance.on('connect', () => {
        console.log('Connected to socket server');
      });

      // Cleanup function on unmount or user logout
      return () => {
        socketInstance.disconnect();
      };
    } else {
      // Disconnect socket if user logs out
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
    }
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
