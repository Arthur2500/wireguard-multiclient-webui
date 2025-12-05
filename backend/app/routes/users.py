from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.user import User
from app.utils.decorators import admin_required
from app import db

users_bp = Blueprint('users', __name__)


@users_bp.route('', methods=['GET'])
@admin_required
def get_users():
    """Get all users (admin only)."""
    users = User.query.all()
    return jsonify([user.to_dict() for user in users]), 200


@users_bp.route('/<int:user_id>', methods=['GET'])
@jwt_required()
def get_user(user_id):
    """Get a specific user."""
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    # Users can only view themselves unless admin
    if not current_user.is_admin() and current_user_id != user_id:
        return jsonify({'error': 'Access denied'}), 403
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify(user.to_dict()), 200


@users_bp.route('', methods=['POST'])
@admin_required
def create_user():
    """Create a new user (admin only)."""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    role = data.get('role', 'user')
    
    if not username or not email or not password:
        return jsonify({'error': 'Username, email, and password required'}), 400
    
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already exists'}), 409
    
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already exists'}), 409
    
    if role not in ['admin', 'user']:
        return jsonify({'error': 'Invalid role'}), 400
    
    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400
    
    user = User(
        username=username,
        email=email,
        role=role
    )
    user.set_password(password)
    
    db.session.add(user)
    db.session.commit()
    
    return jsonify(user.to_dict()), 201


@users_bp.route('/<int:user_id>', methods=['PUT'])
@jwt_required()
def update_user(user_id):
    """Update a user."""
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    # Users can only update themselves unless admin
    if not current_user.is_admin() and current_user_id != user_id:
        return jsonify({'error': 'Access denied'}), 403
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    # Only admins can change roles
    if 'role' in data and not current_user.is_admin():
        return jsonify({'error': 'Only admins can change roles'}), 403
    
    # Update fields
    if 'email' in data:
        existing = User.query.filter_by(email=data['email']).first()
        if existing and existing.id != user_id:
            return jsonify({'error': 'Email already exists'}), 409
        user.email = data['email']
    
    if 'role' in data and current_user.is_admin():
        if data['role'] not in ['admin', 'user']:
            return jsonify({'error': 'Invalid role'}), 400
        user.role = data['role']
    
    if 'is_active' in data and current_user.is_admin():
        user.is_active = data['is_active']
    
    if 'password' in data:
        if len(data['password']) < 8:
            return jsonify({'error': 'Password must be at least 8 characters'}), 400
        user.set_password(data['password'])
    
    db.session.commit()
    
    return jsonify(user.to_dict()), 200


@users_bp.route('/<int:user_id>', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    """Delete a user (admin only)."""
    current_user_id = get_jwt_identity()
    
    # Prevent admin from deleting themselves
    if current_user_id == user_id:
        return jsonify({'error': 'Cannot delete yourself'}), 400
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    db.session.delete(user)
    db.session.commit()
    
    return jsonify({'message': 'User deleted'}), 200
