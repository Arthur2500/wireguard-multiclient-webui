"""Helper functions for common patterns across the application."""
import logging
from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt_identity
from app.models.user import User
from app.models.group import Group
from app.models.client import Client

logger = logging.getLogger(__name__)


def get_current_user():
    """Get the current authenticated user.
    
    Returns:
        User: The current user object or None if not found
    """
    try:
        user_id = int(get_jwt_identity())
        return User.query.get(user_id)
    except (ValueError, TypeError) as e:
        logger.error("Failed to get current user: %s", e)
        return None


def validate_request_data(data, required_fields):
    """Validate that request data contains required fields.
    
    Args:
        data: The request data dictionary
        required_fields: List of required field names
        
    Returns:
        tuple: (is_valid, error_message) where is_valid is bool
    """
    if not data:
        return False, "No data provided"
    
    missing_fields = [field for field in required_fields if field not in data or not data[field]]
    if missing_fields:
        return False, f"Missing required fields: {', '.join(missing_fields)}"
    
    return True, None


def create_error_response(message, status_code=400):
    """Create a standardized error response.
    
    Args:
        message: Error message
        status_code: HTTP status code
        
    Returns:
        tuple: (response, status_code)
    """
    return jsonify({'error': message}), status_code


def create_success_response(data=None, message=None, status_code=200):
    """Create a standardized success response.
    
    Args:
        data: Response data (dict or list)
        message: Optional success message
        status_code: HTTP status code
        
    Returns:
        tuple: (response, status_code)
    """
    if message:
        response = {'message': message}
        if data:
            response['data'] = data
        return jsonify(response), status_code
    
    return jsonify(data) if data is not None else jsonify({}), status_code


def log_request(endpoint, user_id=None, **kwargs):
    """Log an incoming request with context.
    
    Args:
        endpoint: Name of the endpoint
        user_id: User ID making the request
        **kwargs: Additional context to log
    """
    context = " ".join([f"{k}={v}" for k, v in kwargs.items()])
    logger.info("Request %s user_id=%s %s", endpoint, user_id, context)


def log_action(action, entity_type, entity_id, user_id, **kwargs):
    """Log a user action with structured context.
    
    Args:
        action: Action performed (created, updated, deleted, etc.)
        entity_type: Type of entity (group, client, user, etc.)
        entity_id: ID of the entity
        user_id: User ID performing the action
        **kwargs: Additional context to log
    """
    context = " ".join([f"{k}={v}" for k, v in kwargs.items()])
    logger.info("%s %s id=%s by user_id=%s %s", action.capitalize(), entity_type, entity_id, user_id, context)


def check_group_access(user, group):
    """Check if user has access to a group.
    
    Args:
        user: User object
        group: Group object
        
    Returns:
        tuple: (has_access, error_response) where error_response is None if has_access is True
    """
    if not group:
        logger.warning("Group not found for user_id=%s", user.id if user else None)
        return False, create_error_response("Group not found", 404)
    
    if not user.can_access_group(group):
        logger.warning("Access denied to group_id=%s for user_id=%s", group.id, user.id)
        return False, create_error_response("Access denied", 403)
    
    return True, None


def check_client_access(user, client):
    """Check if user has access to a client.
    
    Args:
        user: User object
        client: Client object
        
    Returns:
        tuple: (has_access, error_response) where error_response is None if has_access is True
    """
    if not client:
        logger.warning("Client not found for user_id=%s", user.id if user else None)
        return False, create_error_response("Client not found", 404)
    
    if not user.can_access_group(client.group):
        logger.warning("Access denied to client_id=%s for user_id=%s", client.id, user.id)
        return False, create_error_response("Access denied", 403)
    
    return True, None


def check_group_ownership(user, group):
    """Check if user is owner of a group or is admin.
    
    Args:
        user: User object
        group: Group object
        
    Returns:
        tuple: (is_owner, error_response) where error_response is None if is_owner is True
    """
    if group.owner_id != user.id and not user.is_admin():
        logger.warning("Ownership check failed for group_id=%s by user_id=%s", group.id, user.id)
        return False, create_error_response("Only owner can perform this action", 403)
    
    return True, None
