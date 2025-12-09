import logging
from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.user import User
from app.models.group import Group
from app.utils.wireguard import generate_keypair
from app.utils.decorators import admin_required
from app import db
import ipaddress
import zipfile
import io
import os

logger = logging.getLogger(__name__)

groups_bp = Blueprint('groups', __name__)


@groups_bp.route('', methods=['GET'])
@jwt_required()
def get_groups():
    """Get all groups accessible to the user."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    logger.debug("Fetching groups for user_id=%s", user_id)

    if user.is_admin():
        groups = Group.query.all()
    else:
        # Get groups owned by user or that user is a member of
        owned = Group.query.filter_by(owner_id=user_id).all()
        member_of = user.managed_groups
        groups = list(set(owned + member_of))

    return jsonify([group.to_dict() for group in groups]), 200


@groups_bp.route('/<int:group_id>', methods=['GET'])
@jwt_required()
def get_group(group_id):
    """Get a specific group."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    group = Group.query.get(group_id)
    if not group:
        logger.info("Group not found for id=%s requested by user_id=%s", group_id, user_id)
        return jsonify({'error': 'Group not found'}), 404

    if not user.can_access_group(group):
        logger.warning("Access denied to group_id=%s for user_id=%s", group_id, user_id)
        return jsonify({'error': 'Access denied'}), 403

    return jsonify(group.to_dict()), 200


@groups_bp.route('', methods=['POST'])
@jwt_required()
def create_group():
    """Create a new group."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    # Check if user has permission to create groups
    if not user.is_admin() and not user.can_create_groups:
        logger.warning("User_id=%s attempted to create group without permission", user_id)
        return jsonify({'error': 'You do not have permission to create groups'}), 403

    data = request.get_json()
    if not data:
        logger.debug("Create group called without payload by user_id=%s", user_id)
        return jsonify({'error': 'No data provided'}), 400

    name = data.get('name')
    ip_range = data.get('ip_range')

    if not name or not ip_range:
        return jsonify({'error': 'Name and IP range required'}), 400

    # Validate IPv4 range
    try:
        network = ipaddress.ip_network(ip_range, strict=False)
        # Get first usable IP for server
        server_ip = str(next(network.hosts()))
    except ValueError as e:
        logger.info("Invalid IPv4 range provided by user_id=%s: %s", user_id, ip_range)
        return jsonify({'error': f'Invalid IP range: {str(e)}'}), 400

    # Check if IPv4 range already exists
    existing_group = Group.query.filter_by(ip_range=str(network)).first()
    if existing_group:
        logger.info("Duplicate IPv4 range %s attempted by user_id=%s", str(network), user_id)
        return jsonify({'error': f'IP range {str(network)} is already in use'}), 400

    # Validate optional IPv6 range
    ip_range_v6 = data.get('ip_range_v6')
    server_ip_v6 = None
    if ip_range_v6:
        try:
            network_v6 = ipaddress.ip_network(ip_range_v6, strict=False)
            if network_v6.version != 6:
                return jsonify({'error': 'IPv6 range must be an IPv6 address'}), 400
            # Get first usable IPv6 for server
            server_ip_v6 = str(next(network_v6.hosts()))
        except ValueError as e:
            logger.info("Invalid IPv6 range provided by user_id=%s: %s", user_id, ip_range_v6)
            return jsonify({'error': f'Invalid IPv6 range: {str(e)}'}), 400

        # Check if IPv6 range already exists
        existing_group_v6 = Group.query.filter_by(ip_range_v6=str(network_v6)).first()
        if existing_group_v6:
            logger.info("Duplicate IPv6 range %s attempted by user_id=%s", str(network_v6), user_id)
            return jsonify({'error': f'IPv6 range {str(network_v6)} is already in use'}), 400

    # Generate WireGuard keys
    private_key, public_key = generate_keypair()

    group = Group(
        name=name,
        description=data.get('description', ''),
        server_private_key=private_key,
        server_public_key=public_key,
        ip_range=ip_range,
        server_ip=server_ip,
        ip_range_v6=ip_range_v6,
        server_ip_v6=server_ip_v6,
        listen_port=data.get('listen_port', 51820),
        dns=data.get('dns', '1.1.1.1, 8.8.8.8'),
        endpoint=data.get('endpoint', ''),
        persistent_keepalive=data.get('persistent_keepalive', 25),
        mtu=data.get('mtu', 1420),
        owner_id=user_id
    )

    db.session.add(group)
    db.session.commit()

    # Save WireGuard server configuration file
    group.save_server_config()

    logger.info(
        "Group created id=%s name=%s by user_id=%s ip_range=%s", group.id, group.name, user_id, group.ip_range
    )

    return jsonify(group.to_dict()), 201


@groups_bp.route('/<int:group_id>', methods=['PUT'])
@jwt_required()
def update_group(group_id):
    """Update a group."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    group = Group.query.get(group_id)
    if not group:
        logger.info("Update failed: group_id=%s not found for user_id=%s", group_id, user_id)
        return jsonify({'error': 'Group not found'}), 404

    if not user.can_access_group(group):
        logger.warning("Access denied on update for group_id=%s by user_id=%s", group_id, user_id)
        return jsonify({'error': 'Access denied'}), 403

    # Only owner or admin can update
    if group.owner_id != user_id and not user.is_admin():
        logger.warning("User_id=%s attempted to update group_id=%s without ownership", user_id, group_id)
        return jsonify({'error': 'Only owner can update group'}), 403

    data = request.get_json()
    if not data:
        logger.debug("Update group called without payload by user_id=%s for group_id=%s", user_id, group_id)
        return jsonify({'error': 'No data provided'}), 400

    # Update allowed fields
    if 'name' in data:
        group.name = data['name']
    if 'description' in data:
        group.description = data['description']
    if 'dns' in data:
        group.dns = data['dns']
    if 'endpoint' in data:
        group.endpoint = data['endpoint']
    if 'persistent_keepalive' in data:
        group.persistent_keepalive = data['persistent_keepalive']
    if 'mtu' in data:
        group.mtu = data['mtu']

    # Handle IPv6 range update (only if not already set or admin)
    if 'ip_range_v6' in data:
        ip_range_v6 = data['ip_range_v6']
        if ip_range_v6:
            try:
                network_v6 = ipaddress.ip_network(ip_range_v6, strict=False)
                if network_v6.version != 6:
                    return jsonify({'error': 'IPv6 range must be an IPv6 address'}), 400

                # Check if IPv6 range is already used by another group
                if str(network_v6) != group.ip_range_v6:
                    existing_group_v6 = Group.query.filter(
                        Group.ip_range_v6 == str(network_v6),
                        Group.id != group_id
                    ).first()
                    if existing_group_v6:
                        logger.info(
                            "IPv6 range %s already used; update blocked for group_id=%s user_id=%s",
                            str(network_v6), group_id, user_id
                        )
                        return jsonify({'error': f'IPv6 range {str(network_v6)} is already in use'}), 400

                # Get first usable IPv6 for server if not already set
                if not group.server_ip_v6:
                    group.server_ip_v6 = str(next(network_v6.hosts()))
                group.ip_range_v6 = ip_range_v6
            except ValueError as e:
                return jsonify({'error': f'Invalid IPv6 range: {str(e)}'}), 400
        else:
            # Allow clearing IPv6 settings
            group.ip_range_v6 = None
            group.server_ip_v6 = None

    # Only admin can change listen_port
    if 'listen_port' in data and user.is_admin():
        group.listen_port = data['listen_port']

    # Handle is_active field
    if 'is_active' in data:
        group.is_active = data['is_active']

    db.session.commit()

    # Update WireGuard server configuration file
    group.save_server_config()

    logger.info("Group updated id=%s by user_id=%s", group_id, user_id)

    return jsonify(group.to_dict()), 200


@groups_bp.route('/<int:group_id>', methods=['DELETE'])
@jwt_required()
def delete_group(group_id):
    """Delete a group."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    group = Group.query.get(group_id)
    if not group:
        logger.info("Delete failed: group_id=%s not found for user_id=%s", group_id, user_id)
        return jsonify({'error': 'Group not found'}), 404

    # Only owner or admin can delete
    if group.owner_id != user_id and not user.is_admin():
        logger.warning("User_id=%s attempted to delete group_id=%s without ownership", user_id, group_id)
        return jsonify({'error': 'Only owner can delete group'}), 403

    # Delete WireGuard server configuration file
    group.delete_server_config()

    db.session.delete(group)
    db.session.commit()

    logger.info("Group deleted id=%s by user_id=%s", group_id, user_id)

    return jsonify({'message': 'Group deleted'}), 200


@groups_bp.route('/<int:group_id>/config', methods=['GET'])
@jwt_required()
def get_group_config(group_id):
    """Get WireGuard server configuration for a group."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    group = Group.query.get(group_id)
    if not group:
        logger.info("Group config requested for missing group_id=%s by user_id=%s", group_id, user_id)
        return jsonify({'error': 'Group not found'}), 404

    if not user.can_access_group(group):
        logger.warning("Access denied to group config group_id=%s by user_id=%s", group_id, user_id)
        return jsonify({'error': 'Access denied'}), 403

    # Only owner or admin can get server config
    if group.owner_id != user_id and not user.is_admin():
        logger.warning("Config access denied for group_id=%s by user_id=%s (not owner/admin)", group_id, user_id)
        return jsonify({'error': 'Only owner can access server config'}), 403

    logger.info("Group config retrieved for group_id=%s by user_id=%s", group_id, user_id)
    return jsonify({
        'config': group.generate_server_config(),
        'filename': f'wg-{group.name.lower().replace(" ", "-")}.conf'
    }), 200


@groups_bp.route('/<int:group_id>/config/download-zip', methods=['GET'])
@jwt_required()
def download_group_config_zip(group_id):
    """Download all WireGuard configurations (server + all clients) as ZIP."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    group = Group.query.get(group_id)
    if not group:
        logger.info("Group config ZIP requested for missing group_id=%s by user_id=%s", group_id, user_id)
        return jsonify({'error': 'Group not found'}), 404

    if not user.can_access_group(group):
        logger.warning("Access denied to group config ZIP group_id=%s by user_id=%s", group_id, user_id)
        return jsonify({'error': 'Access denied'}), 403

    # Only owner or admin can get configs
    if group.owner_id != user_id and not user.is_admin():
        logger.warning("Config ZIP access denied for group_id=%s by user_id=%s (not owner/admin)", group_id, user_id)
        return jsonify({'error': 'Only owner can access server config'}), 403

    try:
        # Create ZIP file in memory
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            # Add server config
            server_config = group.generate_server_config()
            zip_file.writestr('server.conf', server_config)

            # Add all active client configs
            for client in group.clients.filter_by(is_active=True):
                client_config = client.generate_client_config()
                client_filename = f"{client.name.lower().replace(' ', '-').replace('/', '-')}.conf"
                zip_file.writestr(client_filename, client_config)

        zip_buffer.seek(0)

        logger.info("Group config ZIP generated for group_id=%s by user_id=%s", group_id, user_id)

        zip_filename = f"{group.name.lower().replace(' ', '-')}-configs.zip"
        return send_file(
            zip_buffer,
            mimetype='application/zip',
            as_attachment=True,
            download_name=zip_filename
        )

    except Exception as e:
        logger.error("Failed to generate config ZIP for group_id=%s: %s", group_id, e, exc_info=True)
        return jsonify({'error': 'Failed to generate ZIP file'}), 500


@groups_bp.route('/<int:group_id>/wireguard/toggle', methods=['POST'])
@jwt_required()
def toggle_group_wireguard(group_id):
    """Toggle WireGuard interface enabled/disabled state for a group."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    group = Group.query.get(group_id)
    if not group:
        logger.info("Toggle WireGuard requested for missing group_id=%s by user_id=%s", group_id, user_id)
        return jsonify({'error': 'Group not found'}), 404

    if not user.can_access_group(group):
        logger.warning("Access denied to toggle WireGuard for group_id=%s by user_id=%s", group_id, user_id)
        return jsonify({'error': 'Access denied'}), 403

    # Only owner or admin can toggle WireGuard
    if group.owner_id != user_id and not user.is_admin():
        logger.warning("WireGuard toggle denied for group_id=%s by user_id=%s (not owner/admin)", group_id, user_id)
        return jsonify({'error': 'Only owner can toggle WireGuard'}), 403

    if group.is_running:
        # Stop it
        success = group.stop_wireguard()
        action = 'stopped'
    else:
        # Start it
        success = group.start_wireguard()
        action = 'started'

    if success:
        logger.info("WireGuard %s for group_id=%s by user_id=%s", action, group_id, user_id)
        return jsonify({
            'message': f'WireGuard interface {action}',
            'is_running': group.is_running
        }), 200
    else:
        logger.error("Failed to toggle WireGuard for group_id=%s", group_id)
        return jsonify({'error': f'Failed to {action} WireGuard interface'}), 500


@groups_bp.route('/<int:group_id>/wireguard/stats', methods=['POST'])
@jwt_required()
def update_group_stats(group_id):
    """Update WireGuard statistics for a group."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    group = Group.query.get(group_id)
    if not group:
        logger.info("Update stats requested for missing group_id=%s by user_id=%s", group_id, user_id)
        return jsonify({'error': 'Group not found'}), 404

    if not user.can_access_group(group):
        logger.warning("Access denied to update stats for group_id=%s by user_id=%s", group_id, user_id)
        return jsonify({'error': 'Access denied'}), 403

    success = group.update_client_stats()
    if success:
        logger.info("Stats updated for group_id=%s by user_id=%s", group_id, user_id)
        return jsonify({'message': 'Statistics updated successfully'}), 200
    else:
        logger.warning("Failed to update stats for group_id=%s (may not be running)", group_id)
        return jsonify({'error': 'Failed to update statistics. WireGuard may not be running.'}), 400


@groups_bp.route('/<int:group_id>/members', methods=['GET'])
@jwt_required()
def get_group_members(group_id):
    """Get members of a group."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    group = Group.query.get(group_id)
    if not group:
        logger.info("Members requested for missing group_id=%s by user_id=%s", group_id, user_id)
        return jsonify({'error': 'Group not found'}), 404

    if not user.can_access_group(group):
        logger.warning("Access denied to group members group_id=%s by user_id=%s", group_id, user_id)
        return jsonify({'error': 'Access denied'}), 403

    return jsonify([member.to_dict() for member in group.members]), 200


@groups_bp.route('/<int:group_id>/members', methods=['POST'])
@jwt_required()
def add_group_member(group_id):
    """Add a member to a group."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    group = Group.query.get(group_id)
    if not group:
        logger.info("Add member failed: group_id=%s not found for user_id=%s", group_id, user_id)
        return jsonify({'error': 'Group not found'}), 404

    # Only owner or admin can add members
    if group.owner_id != user_id and not user.is_admin():
        logger.warning("User_id=%s attempted to add member to group_id=%s without ownership", user_id, group_id)
        return jsonify({'error': 'Only owner can add members'}), 403

    data = request.get_json()
    if not data or 'user_id' not in data:
        logger.debug("Add member called without user_id by user_id=%s for group_id=%s", user_id, group_id)
        return jsonify({'error': 'User ID required'}), 400

    member = User.query.get(data['user_id'])
    if not member:
        logger.info("Add member failed: member_id=%s not found for group_id=%s", data['user_id'], group_id)
        return jsonify({'error': 'User not found'}), 404

    if member in group.members:
        logger.info("User_id=%s already member of group_id=%s", member.id, group_id)
        return jsonify({'error': 'User is already a member'}), 409

    group.members.append(member)
    db.session.commit()

    logger.info(
        "Member user_id=%s added to group_id=%s by user_id=%s",
        member.id,
        group_id,
        user_id
    )

    return jsonify({'message': 'Member added'}), 200


@groups_bp.route('/<int:group_id>/members/<int:member_id>', methods=['DELETE'])
@jwt_required()
def remove_group_member(group_id, member_id):
    """Remove a member from a group."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    group = Group.query.get(group_id)
    if not group:
        logger.info("Remove member failed: group_id=%s not found for user_id=%s", group_id, user_id)
        return jsonify({'error': 'Group not found'}), 404

    # Only owner or admin can remove members
    if group.owner_id != user_id and not user.is_admin():
        logger.warning("User_id=%s attempted to remove member from group_id=%s without ownership", user_id, group_id)
        return jsonify({'error': 'Only owner can remove members'}), 403

    member = User.query.get(member_id)
    if not member:
        logger.info("Remove member failed: member_id=%s not found for group_id=%s", member_id, group_id)
        return jsonify({'error': 'User not found'}), 404

    if member not in group.members:
        logger.info("Remove member failed: member_id=%s not in group_id=%s", member_id, group_id)
        return jsonify({'error': 'User is not a member'}), 404

    group.members.remove(member)
    db.session.commit()

    logger.info(
        "Member user_id=%s removed from group_id=%s by user_id=%s",
        member_id,
        group_id,
        user_id
    )

    return jsonify({'message': 'Member removed'}), 200
