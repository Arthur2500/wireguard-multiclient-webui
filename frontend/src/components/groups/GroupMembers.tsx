import React, { useState, useEffect } from 'react';
import groupService from '../../services/group.service';
import userService from '../../services/user.service';
import { User } from '../../types';
import { UserPlus, Trash2 } from 'lucide-react';
import './GroupMembers.css';

interface GroupMembersProps {
  groupId: number;
  isOwnerOrAdmin: boolean;
  isAdmin: boolean;
}

const GroupMembers: React.FC<GroupMembersProps> = ({ groupId, isOwnerOrAdmin, isAdmin }) => {
  const [members, setMembers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  useEffect(() => {
    loadMembers();
    if (isAdmin) {
      loadAllUsers();
    }
  }, [groupId, isAdmin]);

  const loadMembers = async () => {
    try {
      const data = await groupService.getMembers(groupId);
      setMembers(data);
    } catch (err) {
      setError('Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      const data = await userService.getAll();
      setAllUsers(data);
    } catch (err) {
      console.error('Failed to load users');
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId) return;

    try {
      await groupService.addMember(groupId, selectedUserId);
      await loadMembers();
      setShowAddModal(false);
      setSelectedUserId(null);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add member');
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!window.confirm('Are you sure you want to remove this member?')) return;

    try {
      await groupService.removeMember(groupId, userId);
      setMembers(members.filter(m => m.id !== userId));
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove member');
    }
  };

  const availableUsers = allUsers.filter(
    user => !members.some(member => member.id === user.id)
  );

  if (loading) return <div className="loading">Loading members...</div>;

  return (
    <div className="group-members">
      <div className="members-header">
        <h3>Group Members ({members.length})</h3>
        {isAdmin && (
          <button onClick={() => setShowAddModal(true)} className="btn-primary btn-sm">
            <UserPlus size={16} /> Add Member
          </button>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      {members.length === 0 ? (
        <div className="empty-state">
          <p>No members yet. {isAdmin ? 'Add members to give them access to this group.' : 'Only admins can add members to groups.'}</p>
        </div>
      ) : (
        <div className="members-list">
          {members.map(member => (
            <div key={member.id} className="member-card">
              <div className="member-info">
                <div className="member-name">{member.username}</div>
                <div className="member-email">{member.email}</div>
                {member.role === 'admin' && <span className="badge badge-admin">Admin</span>}
              </div>
              {isAdmin && (
                <button
                  onClick={() => handleRemoveMember(member.id)}
                  className="btn-icon btn-danger"
                  title="Remove member"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Add Member</h3>
            {availableUsers.length === 0 ? (
              <p>All users are already members of this group.</p>
            ) : (
              <>
                <div className="form-group">
                  <label>Select User</label>
                  <select
                    value={selectedUserId || ''}
                    onChange={(e) => setSelectedUserId(Number(e.target.value))}
                    className="form-control"
                  >
                    <option value="">Choose a user...</option>
                    {availableUsers.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.username} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="modal-actions">
                  <button onClick={() => setShowAddModal(false)} className="btn-secondary">
                    Cancel
                  </button>
                  <button
                    onClick={handleAddMember}
                    disabled={!selectedUserId}
                    className="btn-primary"
                  >
                    Add Member
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupMembers;
