from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.user import User
from app.models.group import Group
from app.utils.wireguard import generate_keypair
from app.utils.decorators import admin_required
from app import db
import ipaddress

groups_bp = Blueprint('groups', __name__)


@groups_bp.route('', methods=['GET'])
@jwt_required()
def get_groups():
    """Get all groups accessible to the user."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

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
        return jsonify({'error': 'Group not found'}), 404

    if not user.can_access_group(group):
        return jsonify({'error': 'Access denied'}), 403

    return jsonify(group.to_dict()), 200


@groups_bp.route('', methods=['POST'])
@jwt_required()
def create_group():
    """Create a new group."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    data = request.get_json()
    if not data:
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
        return jsonify({'error': f'Invalid IP range: {str(e)}'}), 400

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
            return jsonify({'error': f'Invalid IPv6 range: {str(e)}'}), 400

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
        allow_client_to_client=data.get('allow_client_to_client', True),
        owner_id=user_id
    )

    db.session.add(group)
    db.session.commit()

    return jsonify(group.to_dict()), 201


@groups_bp.route('/<int:group_id>', methods=['PUT'])
@jwt_required()
def update_group(group_id):
    """Update a group."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    group = Group.query.get(group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404

    if not user.can_access_group(group):
        return jsonify({'error': 'Access denied'}), 403

    # Only owner or admin can update
    if group.owner_id != user_id and not user.is_admin():
        return jsonify({'error': 'Only owner can update group'}), 403

    data = request.get_json()
    if not data:
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
    if 'allow_client_to_client' in data:
        group.allow_client_to_client = data['allow_client_to_client']

    # Handle IPv6 range update (only if not already set or admin)
    if 'ip_range_v6' in data:
        ip_range_v6 = data['ip_range_v6']
        if ip_range_v6:
            try:
                network_v6 = ipaddress.ip_network(ip_range_v6, strict=False)
                if network_v6.version != 6:
                    return jsonify({'error': 'IPv6 range must be an IPv6 address'}), 400
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

    db.session.commit()

    return jsonify(group.to_dict()), 200


@groups_bp.route('/<int:group_id>', methods=['DELETE'])
@jwt_required()
def delete_group(group_id):
    """Delete a group."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    group = Group.query.get(group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404

    # Only owner or admin can delete
    if group.owner_id != user_id and not user.is_admin():
        return jsonify({'error': 'Only owner can delete group'}), 403

    db.session.delete(group)
    db.session.commit()

    return jsonify({'message': 'Group deleted'}), 200


@groups_bp.route('/<int:group_id>/config', methods=['GET'])
@jwt_required()
def get_group_config(group_id):
    """Get WireGuard server configuration for a group."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    group = Group.query.get(group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404

    if not user.can_access_group(group):
        return jsonify({'error': 'Access denied'}), 403

    # Only owner or admin can get server config
    if group.owner_id != user_id and not user.is_admin():
        return jsonify({'error': 'Only owner can access server config'}), 403

    return jsonify({
        'config': group.generate_server_config(),
        'filename': f'wg-{group.name.lower().replace(" ", "-")}.conf'
    }), 200


@groups_bp.route('/<int:group_id>/members', methods=['GET'])
@jwt_required()
def get_group_members(group_id):
    """Get members of a group."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    group = Group.query.get(group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404

    if not user.can_access_group(group):
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
        return jsonify({'error': 'Group not found'}), 404

    # Only owner or admin can add members
    if group.owner_id != user_id and not user.is_admin():
        return jsonify({'error': 'Only owner can add members'}), 403

    data = request.get_json()
    if not data or 'user_id' not in data:
        return jsonify({'error': 'User ID required'}), 400

    member = User.query.get(data['user_id'])
    if not member:
        return jsonify({'error': 'User not found'}), 404

    if member in group.members:
        return jsonify({'error': 'User is already a member'}), 409

    group.members.append(member)
    db.session.commit()

    return jsonify({'message': 'Member added'}), 200


@groups_bp.route('/<int:group_id>/members/<int:member_id>', methods=['DELETE'])
@jwt_required()
def remove_group_member(group_id, member_id):
    """Remove a member from a group."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    group = Group.query.get(group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404

    # Only owner or admin can remove members
    if group.owner_id != user_id and not user.is_admin():
        return jsonify({'error': 'Only owner can remove members'}), 403

    member = User.query.get(member_id)
    if not member:
        return jsonify({'error': 'User not found'}), 404

    if member not in group.members:
        return jsonify({'error': 'User is not a member'}), 404

    group.members.remove(member)
    db.session.commit()

    return jsonify({'message': 'Member removed'}), 200
