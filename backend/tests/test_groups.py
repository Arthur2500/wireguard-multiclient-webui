"""Tests for group routes."""


def test_create_group(client, auth_headers):
    """Test creating a group."""
    response = client.post('/api/groups', json={
        'name': 'Test Group',
        'ip_range': '10.0.0.0/24',
        'description': 'A test WireGuard group'
    }, headers=auth_headers)
    assert response.status_code == 201
    data = response.get_json()
    assert data['name'] == 'Test Group'
    assert data['ip_range'] == '10.0.0.0/24'
    assert data['server_ip'] == '10.0.0.1'


def test_create_group_invalid_ip_range(client, auth_headers):
    """Test creating a group with invalid IP range."""
    response = client.post('/api/groups', json={
        'name': 'Invalid Group',
        'ip_range': 'invalid'
    }, headers=auth_headers)
    assert response.status_code == 400


def test_get_groups(client, auth_headers):
    """Test getting all groups."""
    # Create a group first
    client.post('/api/groups', json={
        'name': 'List Test',
        'ip_range': '10.1.0.0/24'
    }, headers=auth_headers)

    response = client.get('/api/groups', headers=auth_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_get_group(client, auth_headers):
    """Test getting a specific group."""
    # Create a group
    response = client.post('/api/groups', json={
        'name': 'Get Test',
        'ip_range': '10.2.0.0/24'
    }, headers=auth_headers)
    group_id = response.get_json()['id']

    # Get the group
    response = client.get(f'/api/groups/{group_id}', headers=auth_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert data['name'] == 'Get Test'


def test_update_group(client, auth_headers):
    """Test updating a group."""
    # Create a group
    response = client.post('/api/groups', json={
        'name': 'Update Test',
        'ip_range': '10.3.0.0/24'
    }, headers=auth_headers)
    group_id = response.get_json()['id']

    # Update the group
    response = client.put(f'/api/groups/{group_id}', json={
        'name': 'Updated Name',
        'dns': '8.8.8.8'
    }, headers=auth_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert data['name'] == 'Updated Name'
    assert data['dns'] == '8.8.8.8'


def test_delete_group(client, auth_headers):
    """Test deleting a group."""
    # Create a group
    response = client.post('/api/groups', json={
        'name': 'Delete Test',
        'ip_range': '10.4.0.0/24'
    }, headers=auth_headers)
    group_id = response.get_json()['id']

    # Delete the group
    response = client.delete(f'/api/groups/{group_id}', headers=auth_headers)
    assert response.status_code == 200

    # Verify deleted
    response = client.get(f'/api/groups/{group_id}', headers=auth_headers)
    assert response.status_code == 404


def test_get_group_config(client, auth_headers):
    """Test getting group server config."""
    # Create a group
    response = client.post('/api/groups', json={
        'name': 'Config Test',
        'ip_range': '10.5.0.0/24'
    }, headers=auth_headers)
    group_id = response.get_json()['id']

    # Get config
    response = client.get(f'/api/groups/{group_id}/config', headers=auth_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert 'config' in data
    assert '[Interface]' in data['config']


def test_wireguard_interface_naming_with_group_name(app):
    """Test that WireGuard interfaces are named using the group name.
    """
    from app.models.group import Group

    with app.app_context():
        # Test 1: Simple group name
        group = Group()
        group.id = 1
        group.name = 'Office VPN'
        interface = group.get_wireguard_interface_name()
        assert interface == 'wg-office-vpn', f"Expected 'wg-office-vpn', got '{interface}'"

        # Test 2: Group name with special characters
        group.name = 'Marketing / Sales'
        interface = group.get_wireguard_interface_name()
        assert interface == 'wg-marketing-sa', f"Expected sanitized name, got '{interface}'"
        assert interface.startswith('wg-'), "Interface name should start with 'wg-'"
        assert '/' not in interface, "Special characters should be sanitized"

        # Test 3: Long group name (should be truncated)
        group.name = 'Very Long Production Environment Name'
        interface = group.get_wireguard_interface_name()
        assert len(interface) <= 15, f"Interface name too long: {len(interface)} chars"
        assert interface.startswith('wg-'), "Interface name should start with 'wg-'"


def test_wireguard_configs_in_group_folders(app):
    """Test that WireGuard configs are stored in group-named folders.

    This test verifies the requirement: "wireguard configs in groupname ordner speichern"
    (store WireGuard configs in group name folder).
    """
    from app.models.group import Group
    from app.models.client import Client
    from config import Config
    import os

    with app.app_context():
        # Mock the config path
        Config.WG_CONFIG_PATH = '/etc/wireguard'

        # Test 1: Group config directory structure
        group = Group()
        group.id = 10
        group.name = 'Test Network'

        # Verify group-specific directory for client configs
        group_dir = group.get_group_config_dir()
        interface_name = group.get_wireguard_interface_name()

        assert group_dir == f'/etc/wireguard/{interface_name}', \
            f"Group config dir should be in group-named subdirectory, got '{group_dir}'"
        assert 'test-network' in group_dir, \
            f"Group directory should contain group name, got '{group_dir}'"

        # Test 2: Server config path
        server_config = group.get_server_config_path()
        assert server_config == f'/etc/wireguard/{interface_name}.conf', \
            f"Server config should use interface name, got '{server_config}'"
        assert interface_name in server_config, \
            f"Server config path should contain interface name, got '{server_config}'"

        # Test 3: Verify different groups get different directories
        group2 = Group()
        group2.id = 11
        group2.name = 'Production'
        group2_dir = group2.get_group_config_dir()

        assert group_dir != group2_dir, \
            "Different groups should have different config directories"
        assert 'test-network' in group_dir and 'production' in group2_dir, \
            "Each group directory should be named after its group"
