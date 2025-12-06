import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User } from '../../types';
import authService from '../../services/auth.service';
import { Shield, LayoutDashboard, FolderOpen, Users, BarChart3, LogOut, Sun, Moon } from 'lucide-react';
import './Layout.css';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleLogout = () => {
    authService.logout();
    onLogout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="sidebar-header">
          <h1><Shield size={24} /> WireGuard</h1>
          <span>Multi-Client WebUI</span>
        </div>
        
        <ul className="nav-menu">
          <li>
            <Link to="/dashboard" className={isActive('/dashboard') ? 'active' : ''}>
              <LayoutDashboard size={18} /> Dashboard
            </Link>
          </li>
          <li>
            <Link to="/groups" className={isActive('/groups') ? 'active' : ''}>
              <FolderOpen size={18} /> Groups
            </Link>
          </li>
          {user?.role === 'admin' && (
            <>
              <li>
                <Link to="/users" className={isActive('/users') ? 'active' : ''}>
                  <Users size={18} /> Users
                </Link>
              </li>
              <li>
                <Link to="/stats" className={isActive('/stats') ? 'active' : ''}>
                  <BarChart3 size={18} /> Statistics
                </Link>
              </li>
            </>
          )}
        </ul>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{user?.username.charAt(0).toUpperCase()}</div>
            <div className="user-details">
              <span className="user-name">{user?.username}</span>
              <span className="user-role">{user?.role}</span>
            </div>
          </div>
          <button onClick={toggleTheme} className="theme-toggle">
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
          </button>
          <button onClick={handleLogout} className="logout-btn">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </nav>
      
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

export default Layout;
