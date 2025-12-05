"""Tests for authentication routes."""


def test_login_success(client):
    """Test successful login."""
    response = client.post('/api/auth/login', json={
        'username': 'admin',
        'password': 'admin'
    })
    assert response.status_code == 200
    data = response.get_json()
    assert 'access_token' in data
    assert 'user' in data
    assert data['user']['username'] == 'admin'


def test_login_invalid_credentials(client):
    """Test login with invalid credentials."""
    response = client.post('/api/auth/login', json={
        'username': 'admin',
        'password': 'wrong'
    })
    assert response.status_code == 401


def test_login_missing_fields(client):
    """Test login with missing fields."""
    response = client.post('/api/auth/login', json={
        'username': 'admin'
    })
    assert response.status_code == 400


def test_get_current_user(client, auth_headers):
    """Test getting current user."""
    response = client.get('/api/auth/me', headers=auth_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert data['username'] == 'admin'


def test_get_current_user_unauthorized(client):
    """Test getting current user without auth."""
    response = client.get('/api/auth/me')
    assert response.status_code == 401


def test_change_password(client, auth_headers):
    """Test changing password."""
    response = client.post('/api/auth/change-password', json={
        'current_password': 'admin',
        'new_password': 'newpassword123'
    }, headers=auth_headers)
    assert response.status_code == 200
    
    # Verify can login with new password
    response = client.post('/api/auth/login', json={
        'username': 'admin',
        'password': 'newpassword123'
    })
    assert response.status_code == 200


def test_change_password_wrong_current(client, auth_headers):
    """Test changing password with wrong current password."""
    response = client.post('/api/auth/change-password', json={
        'current_password': 'wrong',
        'new_password': 'newpassword123'
    }, headers=auth_headers)
    assert response.status_code == 401
