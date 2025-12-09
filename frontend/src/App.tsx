import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { User } from './types';

// Auth
import Login from './components/auth/Login';

// Layout
import Layout from './components/dashboard/Layout';

// Dashboard
import Dashboard from './components/dashboard/Dashboard';

// Groups
import GroupList from './components/groups/GroupList';
import GroupDetail from './components/groups/GroupDetail';
import GroupForm from './components/groups/GroupForm';

// Clients
import ClientForm from './components/clients/ClientForm';
import ClientList from './components/clients/ClientList';
import ClientDetail from './components/clients/ClientDetail';

// Users
import UserList from './components/users/UserList';
import UserDetail from './components/users/UserDetail';

// Stats
import Stats from './components/stats/Stats';

import './App.css';

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  const handleLogin = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
  };

  const isAuthenticated = Boolean(token && user);

  return (
    <Router>
      <Routes>
        <Route 
          path="/login" 
          element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login onLogin={handleLogin} />
          } 
        />
        
        {isAuthenticated ? (
          <Route 
            path="/*" 
            element={
              <Layout user={user} onLogout={handleLogout}>
                <Routes>
                  <Route path="/dashboard" element={<Dashboard user={user} />} />
                  
                  {/* Groups */}
                  <Route path="/groups" element={<GroupList />} />
                  <Route path="/groups/new" element={<GroupForm />} />
                  <Route path="/groups/:id" element={<GroupDetail />} />
                  <Route path="/groups/:id/edit" element={<GroupForm />} />
                  
                  {/* Clients */}
                  <Route path="/clients" element={<ClientList />} />
                  <Route path="/clients/:id" element={<ClientDetail />} />
                  <Route path="/groups/:groupId/clients/new" element={<ClientForm />} />
                  <Route path="/clients/:id/edit" element={<ClientForm />} />
                  
                  {/* Admin routes */}
                  {user?.role === 'admin' && (
                    <>
                      <Route path="/users" element={<UserList />} />
                      <Route path="/users/:id" element={<UserDetail />} />
                      <Route path="/stats" element={<Stats />} />
                    </>
                  )}
                  
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Layout>
            }
          />
        ) : (
          <Route path="*" element={<Navigate to="/login" replace />} />
        )}
      </Routes>
    </Router>
  );
}

export default App;
