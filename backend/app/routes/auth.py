"""Authentication routes for user login and password management."""
import logging
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from app.models.user import User
from app.utils.helpers import (
    get_current_user,
    validate_request_data,
    create_error_response,
    create_success_response
)
from app import db

logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__)
limiter = Limiter(key_func=get_remote_address)


@auth_bp.route('/login', methods=['POST'])
@limiter.limit("10 per minute")  # Rate limit login attempts
def login():
    """User login endpoint."""
    data = request.get_json()
    
    # Validate request data
    is_valid, error_msg = validate_request_data(data, ['username', 'password'])
    if not is_valid:
        logger.debug("Login attempt with invalid data")
        return create_error_response(error_msg, 400)

    username = data.get('username')
    password = data.get('password')

    # Try to find user by username or email
    user = User.query.filter_by(username=username).first()
    if not user:
        user = User.query.filter_by(email=username).first()

    if not user or not user.check_password(password):
        logger.warning("Failed login attempt for username/email=%s", username)
        return create_error_response('Invalid username/email or password', 401)

    if not user.is_active:
        logger.warning("Login attempt for disabled account user_id=%s", user.id)
        return create_error_response('Account is disabled', 403)

    access_token = create_access_token(identity=str(user.id))
    logger.info("User logged in user_id=%s username=%s", user.id, user.username)

    return jsonify({
        'access_token': access_token,
        'user': user.to_dict()
    }), 200


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user_info():
    """Get current user info."""
    user = get_current_user()
    
    if not user:
        logger.warning("Current user not found during /me request")
        return create_error_response('User not found', 404)
    
    logger.debug("User info retrieved user_id=%s", user.id)
    return jsonify(user.to_dict()), 200


@auth_bp.route('/change-password', methods=['POST'])
@jwt_required()
def change_password():
    """Change user password."""
    user = get_current_user()
    
    if not user:
        logger.warning("User not found during password change")
        return create_error_response('User not found', 404)

    data = request.get_json()
    
    # Validate request data
    is_valid, error_msg = validate_request_data(data, ['current_password', 'new_password'])
    if not is_valid:
        logger.debug("Password change with invalid data for user_id=%s", user.id)
        return create_error_response(error_msg, 400)

    current_password = data.get('current_password')
    new_password = data.get('new_password')

    if not user.check_password(current_password):
        logger.warning("Incorrect current password for user_id=%s", user.id)
        return create_error_response('Current password is incorrect', 401)

    if len(new_password) < 8:
        logger.debug("Password too short for user_id=%s", user.id)
        return create_error_response('Password must be at least 8 characters', 400)

    user.set_password(new_password)
    db.session.commit()
    
    logger.info("Password changed successfully for user_id=%s", user.id)
    return create_success_response(message='Password changed successfully')
