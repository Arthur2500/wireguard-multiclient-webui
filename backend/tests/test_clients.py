"""Tests for client routes."""


def test_create_client(client, auth_headers):
    """Test creating a client."""
    # Create a group first
    response = client.post('/api/groups', json={
        'name': 'Client Test Group',
        'ip_range': '10.10.0.0/24',
        'endpoint': 'vpn.example.com'
    }, headers=auth_headers)
    group_id = response.get_json()['id']
    
    # Create a client
    response = client.post(f'/api/clients/group/{group_id}', json={
        'name': 'Test Client',
        'description': 'A test client'
    }, headers=auth_headers)
    assert response.status_code == 201
    data = response.get_json()
    assert data['name'] == 'Test Client'
    assert data['assigned_ip'] == '10.10.0.2'  # 10.10.0.1 is server


def test_get_clients(client, auth_headers):
    """Test getting all clients in a group."""
    # Create a group
    response = client.post('/api/groups', json={
        'name': 'List Clients Group',
        'ip_range': '10.11.0.0/24'
    }, headers=auth_headers)
    group_id = response.get_json()['id']
    
    # Create some clients
    client.post(f'/api/clients/group/{group_id}', json={
        'name': 'Client 1'
    }, headers=auth_headers)
    client.post(f'/api/clients/group/{group_id}', json={
        'name': 'Client 2'
    }, headers=auth_headers)
    
    # Get clients
    response = client.get(f'/api/clients/group/{group_id}', headers=auth_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert len(data) == 2


def test_update_client(client, auth_headers):
    """Test updating a client."""
    # Create a group and client
    response = client.post('/api/groups', json={
        'name': 'Update Client Group',
        'ip_range': '10.12.0.0/24'
    }, headers=auth_headers)
    group_id = response.get_json()['id']
    
    response = client.post(f'/api/clients/group/{group_id}', json={
        'name': 'Update Me'
    }, headers=auth_headers)
    client_id = response.get_json()['id']
    
    # Update client
    response = client.put(f'/api/clients/{client_id}', json={
        'name': 'Updated Name',
        'description': 'Updated description'
    }, headers=auth_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert data['name'] == 'Updated Name'
    assert data['description'] == 'Updated description'


def test_delete_client(client, auth_headers):
    """Test deleting a client."""
    # Create a group and client
    response = client.post('/api/groups', json={
        'name': 'Delete Client Group',
        'ip_range': '10.13.0.0/24'
    }, headers=auth_headers)
    group_id = response.get_json()['id']
    
    response = client.post(f'/api/clients/group/{group_id}', json={
        'name': 'Delete Me'
    }, headers=auth_headers)
    client_id = response.get_json()['id']
    
    # Delete client
    response = client.delete(f'/api/clients/{client_id}', headers=auth_headers)
    assert response.status_code == 200


def test_get_client_config(client, auth_headers):
    """Test getting client config."""
    # Create a group and client
    response = client.post('/api/groups', json={
        'name': 'Config Client Group',
        'ip_range': '10.14.0.0/24',
        'endpoint': 'vpn.example.com'
    }, headers=auth_headers)
    group_id = response.get_json()['id']
    
    response = client.post(f'/api/clients/group/{group_id}', json={
        'name': 'Config Client'
    }, headers=auth_headers)
    client_id = response.get_json()['id']
    
    # Get config
    response = client.get(f'/api/clients/{client_id}/config', headers=auth_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert 'config' in data
    assert '[Interface]' in data['config']
    assert '[Peer]' in data['config']


def test_client_ip_allocation(client, auth_headers):
    """Test that IPs are allocated correctly."""
    # Create a group
    response = client.post('/api/groups', json={
        'name': 'IP Allocation Group',
        'ip_range': '10.15.0.0/28'  # Small range for testing
    }, headers=auth_headers)
    group_id = response.get_json()['id']
    
    # Create multiple clients
    ips = []
    for i in range(5):
        response = client.post(f'/api/clients/group/{group_id}', json={
            'name': f'Client {i}'
        }, headers=auth_headers)
        assert response.status_code == 201
        ips.append(response.get_json()['assigned_ip'])
    
    # All IPs should be unique
    assert len(ips) == len(set(ips))
    
    # Server IP should not be in client IPs
    assert '10.15.0.1' not in ips
