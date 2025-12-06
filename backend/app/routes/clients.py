from flask import Blueprint, request, jsonify, Response
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.user import User
from app.models.group import Group
from app.models.client import Client
from app.utils.wireguard import generate_keypair, generate_preshared_key
from app import db

clients_bp = Blueprint('clients', __name__)


@clients_bp.route('/group/<int:group_id>', methods=['GET'])
@jwt_required()
def get_clients(group_id):
    """Get all clients in a group."""
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    
    group = db.session.get(Group, group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404
    
    if not user.can_access_group(group):
        return jsonify({'error': 'Access denied'}), 403
    
    clients = Client.query.filter_by(group_id=group_id).all()
    return jsonify([client.to_dict() for client in clients]), 200


@clients_bp.route('/<int:client_id>', methods=['GET'])
@jwt_required()
def get_client(client_id):
    """Get a specific client."""
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    
    client = db.session.get(Client, client_id)
    if not client:
        return jsonify({'error': 'Client not found'}), 404
    
    if not user.can_access_group(client.group):
        return jsonify({'error': 'Access denied'}), 403
    
    return jsonify(client.to_dict()), 200


@clients_bp.route('/group/<int:group_id>', methods=['POST'])
@jwt_required()
def create_client(group_id):
    """Create a new client in a group."""
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    
    group = db.session.get(Group, group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404
    
    if not user.can_access_group(group):
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    name = data.get('name')
    if not name:
        return jsonify({'error': 'Name required'}), 400
    
    # Get next available IPv4
    assigned_ip = group.get_next_available_ip()
    if not assigned_ip:
        return jsonify({'error': 'No available IP addresses in the group range'}), 400
    
    # Get next available IPv6 if the group has IPv6 configured
    assigned_ip_v6 = None
    if group.ip_range_v6:
        assigned_ip_v6 = group.get_next_available_ip_v6()
    
    # Generate WireGuard keys
    private_key, public_key = generate_keypair()
    
    # Generate preshared key if requested
    preshared_key = None
    if data.get('use_preshared_key', False):
        preshared_key = generate_preshared_key()
    
    client = Client(
        name=name,
        description=data.get('description', ''),
        private_key=private_key,
        public_key=public_key,
        preshared_key=preshared_key,
        assigned_ip=assigned_ip,
        assigned_ip_v6=assigned_ip_v6,
        allowed_ips=data.get('allowed_ips', '0.0.0.0/0, ::/0'),
        can_address_peers=data.get('can_address_peers', True),
        dns_override=data.get('dns_override'),
        is_active=True,
        group_id=group_id
    )
    
    db.session.add(client)
    db.session.commit()
    
    return jsonify(client.to_dict()), 201


@clients_bp.route('/<int:client_id>', methods=['PUT'])
@jwt_required()
def update_client(client_id):
    """Update a client."""
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    
    client = db.session.get(Client, client_id)
    if not client:
        return jsonify({'error': 'Client not found'}), 404
    
    if not user.can_access_group(client.group):
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    # Update allowed fields
    if 'name' in data:
        client.name = data['name']
    if 'description' in data:
        client.description = data['description']
    if 'allowed_ips' in data:
        client.allowed_ips = data['allowed_ips']
    if 'can_address_peers' in data:
        client.can_address_peers = data['can_address_peers']
    if 'dns_override' in data:
        client.dns_override = data['dns_override']
    if 'is_active' in data:
        client.is_active = data['is_active']
    
    db.session.commit()
    
    return jsonify(client.to_dict()), 200


@clients_bp.route('/<int:client_id>', methods=['DELETE'])
@jwt_required()
def delete_client(client_id):
    """Delete a client."""
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    
    client = db.session.get(Client, client_id)
    if not client:
        return jsonify({'error': 'Client not found'}), 404
    
    if not user.can_access_group(client.group):
        return jsonify({'error': 'Access denied'}), 403
    
    db.session.delete(client)
    db.session.commit()
    
    return jsonify({'message': 'Client deleted'}), 200


@clients_bp.route('/<int:client_id>/config', methods=['GET'])
@jwt_required()
def get_client_config(client_id):
    """Get WireGuard client configuration."""
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    
    client = db.session.get(Client, client_id)
    if not client:
        return jsonify({'error': 'Client not found'}), 404
    
    if not user.can_access_group(client.group):
        return jsonify({'error': 'Access denied'}), 403
    
    return jsonify({
        'config': client.generate_client_config(),
        'filename': f'{client.name.lower().replace(" ", "-")}.conf'
    }), 200


@clients_bp.route('/<int:client_id>/config/download', methods=['GET'])
@jwt_required()
def download_client_config(client_id):
    """Download WireGuard client configuration as file."""
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    
    client = db.session.get(Client, client_id)
    if not client:
        return jsonify({'error': 'Client not found'}), 404
    
    if not user.can_access_group(client.group):
        return jsonify({'error': 'Access denied'}), 403
    
    config = client.generate_client_config()
    filename = f'{client.name.lower().replace(" ", "-")}.conf'
    
    return Response(
        config,
        mimetype='application/octet-stream',
        headers={'Content-Disposition': f'attachment;filename={filename}'}
    )


@clients_bp.route('/<int:client_id>/regenerate-keys', methods=['POST'])
@jwt_required()
def regenerate_keys(client_id):
    """Regenerate WireGuard keys for a client."""
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    
    client = db.session.get(Client, client_id)
    if not client:
        return jsonify({'error': 'Client not found'}), 404
    
    if not user.can_access_group(client.group):
        return jsonify({'error': 'Access denied'}), 403
    
    # Generate new keys
    private_key, public_key = generate_keypair()
    client.private_key = private_key
    client.public_key = public_key
    
    data = request.get_json() or {}
    if data.get('regenerate_preshared_key', False) or client.preshared_key:
        client.preshared_key = generate_preshared_key()
    
    db.session.commit()
    
    return jsonify(client.to_dict()), 200
