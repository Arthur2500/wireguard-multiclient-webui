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
