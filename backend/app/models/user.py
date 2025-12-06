from datetime import datetime, timezone
from app import db, bcrypt
from app.utils.datetime_utils import utc_now


class User(db.Model):
    """User model for account management."""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='user')  # admin, user
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=utc_now)
    updated_at = db.Column(db.DateTime, default=utc_now, onupdate=utc_now)
    
    # Relationships
    groups = db.relationship('Group', backref='owner', lazy='dynamic', foreign_keys='Group.owner_id')
    managed_groups = db.relationship('Group', secondary='user_groups', backref='members')
    
    def set_password(self, password):
        """Set password hash."""
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
    
    def check_password(self, password):
        """Check password against hash."""
        return bcrypt.check_password_hash(self.password_hash, password)
    
    def is_admin(self):
        """Check if user is admin."""
        return self.role == 'admin'
    
    def can_access_group(self, group):
        """Check if user can access a group."""
        if self.is_admin():
            return True
        if group.owner_id == self.id:
            return True
        return group in self.managed_groups
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'role': self.role,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


# Association table for user-group membership
user_groups = db.Table('user_groups',
    db.Column('user_id', db.Integer, db.ForeignKey('users.id'), primary_key=True),
    db.Column('group_id', db.Integer, db.ForeignKey('groups.id'), primary_key=True)
)
