"""User management routes (admin functionality)."""
import logging
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.user import User
from app.utils.decorators import admin_required
from app.utils.helpers import (
    get_current_user,
    validate_request_data,
    create_error_response,
    create_success_response,
    log_action
)
from app import db

logger = logging.getLogger(__name__)

users_bp = Blueprint('users', __name__)


@users_bp.route('', methods=['GET'])
@admin_required
def get_users():
    """Get all users (admin only)."""
    logger.debug("Fetching all users")
    users = User.query.all()
    return jsonify([user.to_dict() for user in users]), 200


@users_bp.route('/<int:user_id>', methods=['GET'])
@jwt_required()
def get_user(user_id):
    """Get a specific user."""
    current_user = get_current_user()
    
    if not current_user:
        return create_error_response('User not found', 404)

    # Users can only view themselves unless admin
    if not current_user.is_admin() and current_user.id != user_id:
        logger.warning("Access denied viewing user_id=%s by user_id=%s", user_id, current_user.id)
        return create_error_response('Access denied', 403)

    user = User.query.get(user_id)
    if not user:
        logger.info("User not found user_id=%s requested by user_id=%s", user_id, current_user.id)
        return create_error_response('User not found', 404)

    logger.debug("User info retrieved user_id=%s by user_id=%s", user_id, current_user.id)
    return jsonify(user.to_dict()), 200


@users_bp.route('', methods=['POST'])
@admin_required
def create_user():
    """Create a new user (admin only)."""
    data = request.get_json()

    # Validate request data
    is_valid, error_msg = validate_request_data(data, ['username', 'email', 'password'])
    if not is_valid:
        logger.debug("User creation with invalid data")
        return create_error_response(error_msg, 400)

    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    role = data.get('role', 'user')
    can_create_groups = data.get('can_create_groups', True)
    can_create_clients = data.get('can_create_clients', True)

    # Check for existing username
    if User.query.filter_by(username=username).first():
        logger.info("User creation failed: username=%s already exists", username)
        return create_error_response('Username already exists', 409)

    # Check for existing email
    if User.query.filter_by(email=email).first():
        logger.info("User creation failed: email=%s already exists", email)
        return create_error_response('Email already exists', 409)

    # Validate role
    if role not in ['admin', 'user']:
        logger.debug("User creation failed: invalid role=%s", role)
        return create_error_response('Invalid role', 400)

    # Validate password length
    if len(password) < 8:
        logger.debug("User creation failed: password too short")
        return create_error_response('Password must be at least 8 characters', 400)

    user = User(
        username=username,
        email=email,
        role=role,
        can_create_groups=can_create_groups,
        can_create_clients=can_create_clients
    )
    user.set_password(password)

    db.session.add(user)
    db.session.commit()

    log_action('created', 'user', user.id, get_jwt_identity(), username=username)
    return jsonify(user.to_dict()), 201


@users_bp.route('/<int:user_id>', methods=['PUT'])
@jwt_required()
def update_user(user_id):
    """Update a user."""
    current_user = get_current_user()
    
    if not current_user:
        return create_error_response('User not found', 404)

    # Users can only update themselves unless admin
    if not current_user.is_admin() and current_user.id != user_id:
        logger.warning("Access denied updating user_id=%s by user_id=%s", user_id, current_user.id)
        return create_error_response('Access denied', 403)

    user = User.query.get(user_id)
    if not user:
        logger.info("Update failed: user_id=%s not found", user_id)
        return create_error_response('User not found', 404)

    data = request.get_json()
    if not data:
        logger.debug("Update user called without payload for user_id=%s", user_id)
        return create_error_response('No data provided', 400)

    # Only admins can change roles
    if 'role' in data and not current_user.is_admin():
        logger.warning("Non-admin user_id=%s attempted to change role", current_user.id)
        return create_error_response('Only admins can change roles', 403)

    # Update fields
    if 'email' in data:
        existing = User.query.filter_by(email=data['email']).first()
        if existing and existing.id != user_id:
            logger.info("Email update failed: email=%s already exists", data['email'])
            return create_error_response('Email already exists', 409)
        user.email = data['email']

    if 'role' in data and current_user.is_admin():
        if data['role'] not in ['admin', 'user']:
            logger.debug("Invalid role provided: %s", data['role'])
            return create_error_response('Invalid role', 400)
        user.role = data['role']

    if 'is_active' in data and current_user.is_admin():
        user.is_active = data['is_active']

    # Only admins can change permissions
    if 'can_create_groups' in data and current_user.is_admin():
        user.can_create_groups = data['can_create_groups']

    if 'can_create_clients' in data and current_user.is_admin():
        user.can_create_clients = data['can_create_clients']

    if 'password' in data:
        if len(data['password']) < 8:
            logger.debug("Password update failed: too short for user_id=%s", user_id)
            return create_error_response('Password must be at least 8 characters', 400)
        user.set_password(data['password'])

    db.session.commit()
    log_action('updated', 'user', user_id, current_user.id)

    return jsonify(user.to_dict()), 200


@users_bp.route('/<int:user_id>', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    """Delete a user (admin only)."""
    current_user_id = int(get_jwt_identity())

    # Prevent admin from deleting themselves
    if current_user_id == user_id:
        logger.warning("Admin user_id=%s attempted to delete themselves", current_user_id)
        return create_error_response('Cannot delete yourself', 400)

    user = User.query.get(user_id)
    if not user:
        logger.info("Delete failed: user_id=%s not found", user_id)
        return create_error_response('User not found', 404)

    username = user.username
    db.session.delete(user)
    db.session.commit()

    log_action('deleted', 'user', user_id, current_user_id, username=username)
    return create_success_response(message='User deleted')
