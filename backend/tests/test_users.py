"""Tests for user routes."""


def test_get_users_admin(client, auth_headers):
    """Test getting all users as admin."""
    response = client.get('/api/users', headers=auth_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert isinstance(data, list)
    assert len(data) >= 1  # At least admin user


def test_get_users_non_admin(client, user_headers):
    """Test that non-admin cannot get all users."""
    response = client.get('/api/users', headers=user_headers)
    assert response.status_code == 403


def test_create_user(client, auth_headers):
    """Test creating a user."""
    response = client.post('/api/users', json={
        'username': 'newuser',
        'email': 'new@example.com',
        'password': 'password123',
        'role': 'user'
    }, headers=auth_headers)
    assert response.status_code == 201
    data = response.get_json()
    assert data['username'] == 'newuser'
    assert data['role'] == 'user'


def test_create_user_duplicate_username(client, auth_headers):
    """Test creating user with duplicate username."""
    # Create first user
    client.post('/api/users', json={
        'username': 'duplicate',
        'email': 'dup1@example.com',
        'password': 'password123'
    }, headers=auth_headers)
    
    # Try to create duplicate
    response = client.post('/api/users', json={
        'username': 'duplicate',
        'email': 'dup2@example.com',
        'password': 'password123'
    }, headers=auth_headers)
    assert response.status_code == 409


def test_update_user(client, auth_headers):
    """Test updating a user."""
    # Create user
    response = client.post('/api/users', json={
        'username': 'updateme',
        'email': 'update@example.com',
        'password': 'password123'
    }, headers=auth_headers)
    user_id = response.get_json()['id']
    
    # Update user
    response = client.put(f'/api/users/{user_id}', json={
        'email': 'updated@example.com',
        'role': 'admin'
    }, headers=auth_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert data['email'] == 'updated@example.com'
    assert data['role'] == 'admin'


def test_delete_user(client, auth_headers):
    """Test deleting a user."""
    # Create user
    response = client.post('/api/users', json={
        'username': 'deleteme',
        'email': 'delete@example.com',
        'password': 'password123'
    }, headers=auth_headers)
    user_id = response.get_json()['id']
    
    # Delete user
    response = client.delete(f'/api/users/{user_id}', headers=auth_headers)
    assert response.status_code == 200
    
    # Verify deleted
    response = client.get(f'/api/users/{user_id}', headers=auth_headers)
    assert response.status_code == 404
