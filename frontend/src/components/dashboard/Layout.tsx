import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User } from '../../types';
import authService from '../../services/auth.service';
import './Layout.css';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();

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
          <h1>🔐 WireGuard</h1>
          <span>Multi-Client WebUI</span>
        </div>
        
        <ul className="nav-menu">
          <li>
            <Link to="/dashboard" className={isActive('/dashboard') ? 'active' : ''}>
              📊 Dashboard
            </Link>
          </li>
          <li>
            <Link to="/groups" className={isActive('/groups') ? 'active' : ''}>
              📁 Groups
            </Link>
          </li>
          {user?.role === 'admin' && (
            <>
              <li>
                <Link to="/users" className={isActive('/users') ? 'active' : ''}>
                  👥 Users
                </Link>
              </li>
              <li>
                <Link to="/stats" className={isActive('/stats') ? 'active' : ''}>
                  📈 Statistics
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
          <button onClick={handleLogout} className="logout-btn">
            Logout
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
