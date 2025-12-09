import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import userService from '../../services/user.service';
import groupService from '../../services/group.service';
import { User, Group } from '../../types';
import { formatDate } from '../../utils/helpers';
import { Pencil, Lock, Unlock, Mail, User as UserIcon, FolderOpen } from 'lucide-react';
import './UserDetail.css';

const UserDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [ownedGroups, setOwnedGroups] = useState<Group[]>([]);
  const [memberGroups, setMemberGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      const userData = await userService.getById(Number(id));
      setUser(userData);

      // Fetch all groups to determine owned and member groups
      const allGroups = await groupService.getAll();
      
      // Filter owned groups (where user is the owner)
      const owned = allGroups.filter(group => group.owner_id === userData.id);
      setOwnedGroups(owned);

      // Filter member groups (where user is a member but not owner)
      // Note: We need to check membership through the group's members
      const memberGroupIds: number[] = [];
      for (const group of allGroups) {
        if (group.owner_id !== userData.id) {
          try {
            const members = await groupService.getMembers(group.id);
            if (members.some((member: any) => member.id === userData.id)) {
              memberGroupIds.push(group.id);
            }
          } catch (err) {
            // Ignore errors for groups we can't access
            console.debug(`Cannot check membership for group ${group.id}`);
          }
        }
      }
      const member = allGroups.filter(group => memberGroupIds.includes(group.id));
      setMemberGroups(member);
    } catch (err) {
      setError('Failed to load user data');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id, loadData]);

  const handleToggleActive = async () => {
    if (!user) return;
    
    const action = user.is_active ? 'disable' : 'enable';
    if (!window.confirm(`Are you sure you want to ${action} this user?`)) return;

    try {
      const updated = await userService.update(user.id, { is_active: !user.is_active });
      setUser(updated);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${action} user`);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (!user) return <div className="error">User not found</div>;

  return (
    <div className="user-detail">
      <div className="page-header">
        <div>
          <Link to="/users" className="back-link">← Back to Users</Link>
          <h1>{user.username}</h1>
          <p className="description">{user.email}</p>
        </div>
        <div className="header-actions">
          <button
            onClick={handleToggleActive}
            className={user.is_active ? 'btn-danger' : 'btn-success'}
            title={user.is_active ? 'Disable User' : 'Enable User'}
          >
            {user.is_active ? <><Lock size={16} /> Disable</> : <><Unlock size={16} /> Enable</>}
          </button>
          <Link to={`/users/${id}/edit`} className="btn-primary">
            <Pencil size={16} /> Edit User
          </Link>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="user-info-cards">
        <div className="info-card">
          <h3>Account Information</h3>
          <dl>
            <dt>Username</dt>
            <dd className="mono">{user.username}</dd>
            <dt>Email</dt>
            <dd>{user.email}</dd>
            <dt>Role</dt>
            <dd>
              <span className={`badge ${user.role === 'admin' ? 'badge-admin' : 'badge-user'}`}>
                {user.role}
              </span>
            </dd>
            <dt>Status</dt>
            <dd>
              <span className={`badge ${user.is_active ? 'badge-success' : 'badge-danger'}`}>
                {user.is_active ? 'Active' : 'Inactive'}
              </span>
            </dd>
          </dl>
        </div>

        <div className="info-card">
          <h3>Permissions</h3>
          <dl>
            <dt>Create Groups</dt>
            <dd>
              <span className={`badge ${user.can_create_groups ? 'badge-success' : 'badge-muted'}`}>
                {user.can_create_groups ? '✓ Allowed' : '✗ Not Allowed'}
              </span>
            </dd>
            <dt>Create Clients</dt>
            <dd>
              <span className={`badge ${user.can_create_clients ? 'badge-success' : 'badge-muted'}`}>
                {user.can_create_clients ? '✓ Allowed' : '✗ Not Allowed'}
              </span>
            </dd>
          </dl>
        </div>

        <div className="info-card">
          <h3>Timestamps</h3>
          <dl>
            <dt>Created</dt>
            <dd>{formatDate(user.created_at)}</dd>
            <dt>Last Updated</dt>
            <dd>{formatDate(user.updated_at)}</dd>
          </dl>
        </div>
      </div>

      <div className="info-section">
        <div className="section-header">
          <h2>User Overview</h2>
        </div>
        <div className="info-content">
          <div className="info-item">
            <UserIcon size={20} className="info-icon" />
            <div>
              <strong>Account Type:</strong>
              <p>
                This user has {user.role === 'admin' ? 'administrative' : 'standard'} privileges
                {user.role === 'admin' && ' and can access all system features'}
              </p>
            </div>
          </div>
          <div className="info-item">
            <Mail size={20} className="info-icon" />
            <div>
              <strong>Contact:</strong>
              <p>Email notifications will be sent to {user.email}</p>
            </div>
          </div>
          {!user.is_active && (
            <div className="info-item warning">
              <Lock size={20} className="info-icon" />
              <div>
                <strong>Account Disabled:</strong>
                <p>This user account is currently inactive and cannot access the system</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="groups-section">
        <div className="groups-header">
          <h3>Groups</h3>
        </div>
        
        <div className="groups-categories">
          <div className="group-category">
            <h4><FolderOpen size={16} /> Owner of ({ownedGroups.length})</h4>
            {ownedGroups.length === 0 ? (
              <div className="empty-state">
                <p>Not an owner of any groups</p>
              </div>
            ) : (
              <div className="groups-list">
                {ownedGroups.map(group => (
                  <Link 
                    key={group.id} 
                    to={`/groups/${group.id}`} 
                    className="group-card"
                  >
                    <div className="group-info">
                      <div className="group-main">
                        <span className="group-name">{group.name}</span>
                        {group.description && (
                          <span className="group-description">{group.description}</span>
                        )}
                      </div>
                      <div className="group-meta">
                        <span className="mono">{group.ip_range}</span>
                        <span>•</span>
                        <span>{group.client_count} client{group.client_count !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <span className={`badge ${group.is_running ? 'badge-success' : 'badge-warning'}`}>
                      {group.is_running ? 'Running' : 'Stopped'}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="group-category">
            <h4><FolderOpen size={16} /> Member of ({memberGroups.length})</h4>
            {memberGroups.length === 0 ? (
              <div className="empty-state">
                <p>Not a member of any groups</p>
              </div>
            ) : (
              <div className="groups-list">
                {memberGroups.map(group => (
                  <Link 
                    key={group.id} 
                    to={`/groups/${group.id}`} 
                    className="group-card"
                  >
                    <div className="group-info">
                      <div className="group-main">
                        <span className="group-name">{group.name}</span>
                        {group.description && (
                          <span className="group-description">{group.description}</span>
                        )}
                      </div>
                      <div className="group-meta">
                        <span className="mono">{group.ip_range}</span>
                        <span>•</span>
                        <span>{group.client_count} client{group.client_count !== 1 ? 's' : ''}</span>
                        <span>•</span>
                        <span>Owner: {group.owner_username || 'Unknown'}</span>
                      </div>
                    </div>
                    <span className={`badge ${group.is_running ? 'badge-success' : 'badge-warning'}`}>
                      {group.is_running ? 'Running' : 'Stopped'}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDetail;
