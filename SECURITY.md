# Security Policy

## Reporting Security Vulnerabilities

If you discover a security vulnerability in WireGuard Multi-Client WebUI, please report it by:

1. Creating a GitHub issue with **[SECURITY]** in the title
2. Or emailing the maintainer directly (if email is provided in the repository)

**Do not** disclose the vulnerability publicly until it has been addressed.

## Security Best Practices

### Production Deployment

#### 1. Secure Secret Keys

**Critical:** Never use default secret keys in production!

```bash
# Generate secure random keys
SECRET_KEY=$(openssl rand -base64 32)
JWT_SECRET_KEY=$(openssl rand -base64 32)

# Add to .env file
echo "SECRET_KEY=${SECRET_KEY}" >> .env
echo "JWT_SECRET_KEY=${JWT_SECRET_KEY}" >> .env
```

#### 2. Change Default Admin Password

The default admin credentials are `admin:admin`. **Change this immediately after first login!**

1. Log in as admin
2. Navigate to your profile
3. Change password to a strong, unique password

Alternatively, set a custom admin password before first startup:
```bash
ADMIN_PASSWORD=$(openssl rand -base64 16)
echo "ADMIN_PASSWORD=${ADMIN_PASSWORD}" >> .env
```

#### 3. Use HTTPS

Always use HTTPS in production. Configure a reverse proxy (e.g., nginx, Caddy, or Traefik) with TLS certificates:

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### 4. Firewall Configuration

Restrict access to the web interface:

```bash
# Allow only specific IPs to access web interface
ufw allow from YOUR_IP_ADDRESS to any port 8080
ufw allow from YOUR_IP_ADDRESS to any port 443

# Allow WireGuard traffic
ufw allow 51820/udp
```

#### 5. Database Security

- Use file permissions to restrict database access:
  ```bash
  chmod 600 data/app.db
  chown 1000:1000 data/app.db  # Match container user
  ```

- Consider using PostgreSQL or MySQL for production instead of SQLite for better concurrent access and backup capabilities

#### 6. Container Security

Run containers with minimal privileges:

```yaml
services:
  backend:
    # Drop unnecessary capabilities
    cap_drop:
      - ALL
    cap_add:
      - NET_ADMIN
      - SYS_MODULE
    
    # Run as non-root user (add to Dockerfile)
    user: "1000:1000"
    
    # Read-only root filesystem (where possible)
    read_only: false  # Can't be fully read-only due to WireGuard
    
    security_opt:
      - no-new-privileges:true
```

#### 7. Regular Updates

- Keep Docker images updated
- Update WireGuard tools regularly
- Monitor for security advisories

```bash
# Update containers
docker-compose pull
docker-compose up -d
```

#### 8. Backup Strategy

Regular backups are essential:

```bash
#!/bin/bash
# backup.sh - Run daily via cron

BACKUP_DIR="/backup/wireguard-webui"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup database
cp data/app.db "${BACKUP_DIR}/app.db.${DATE}"

# Backup WireGuard configs
tar -czf "${BACKUP_DIR}/wireguard-configs.${DATE}.tar.gz" wireguard/

# Keep only last 30 days
find "${BACKUP_DIR}" -name "*.db.*" -mtime +30 -delete
find "${BACKUP_DIR}" -name "*.tar.gz" -mtime +30 -delete
```

#### 9. Monitoring and Alerting

Monitor the application for security events:

- Failed login attempts
- Unauthorized access attempts
- Unusual traffic patterns
- Certificate expiration

Use health check endpoints:
- `GET /api/health` - Basic health check
- `GET /api/ready` - Database connectivity check

#### 10. Network Segmentation

- Deploy the web interface on a separate network segment from WireGuard clients
- Use firewall rules to control access between segments
- Consider using a bastion host or VPN to access the web interface

## Security Features

### Implemented Security Controls

1. **Authentication & Authorization**
   - JWT token-based authentication
   - Role-based access control (RBAC)
   - Password hashing with bcrypt
   - Rate limiting on login endpoint (10 attempts per minute)
   - Token expiration (configurable, default 24 hours)

2. **Input Validation**
   - Validation of all user inputs
   - Sanitization of filenames and interface names
   - Prevention of command injection in subprocess calls
   - IP address validation for WireGuard configurations

3. **Security Headers**
   - `X-Frame-Options: DENY` - Prevents clickjacking
   - `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
   - `X-XSS-Protection: 1; mode=block` - XSS protection
   - `Content-Security-Policy` - Restricts resource loading
   - `Strict-Transport-Security` - Forces HTTPS (production)
   - `Referrer-Policy: strict-origin-when-cross-origin`

4. **Data Protection**
   - Secure file permissions (0600) for WireGuard configs
   - Private keys stored securely in database
   - Optional preshared key support for enhanced security

5. **Logging & Monitoring**
   - Structured logging for all security events
   - Audit trail for user actions
   - Failed authentication logging

## Known Security Considerations

### SQLite Limitations

The default SQLite database has limitations for production use:
- Not suitable for high-concurrency scenarios
- Limited backup options during operation
- No built-in replication

**Recommendation:** Use PostgreSQL or MySQL for production deployments.

### WireGuard Private Keys

Private keys are stored in the database. While they are necessary for WireGuard operation:
- Protect the database file with appropriate permissions
- Use encrypted volumes for sensitive data
- Implement regular backup encryption
- Consider key rotation policies

### Default Configuration

The application ships with development-friendly defaults. **These must be changed for production:**
- Default admin password: `admin`
- Default secret keys (if not set)
- Development logging level
- Permissive CORS settings

## Security Checklist for Production

Before deploying to production, verify:

- [ ] Changed default admin password
- [ ] Set secure `SECRET_KEY` and `JWT_SECRET_KEY`
- [ ] HTTPS enabled with valid certificate
- [ ] Firewall configured to restrict access
- [ ] Database file permissions set correctly (600)
- [ ] Container security options configured
- [ ] Backup strategy implemented and tested
- [ ] Monitoring and alerting configured
- [ ] Rate limiting tested and working
- [ ] All environment variables reviewed
- [ ] Docker images using latest stable versions
- [ ] System updates applied
- [ ] Access logs reviewed regularly

## Compliance Considerations

When using this application in regulated environments:

1. **Data Residency:** Ensure data is stored in compliant regions
2. **Encryption:** All sensitive data should be encrypted at rest and in transit
3. **Access Logs:** Maintain comprehensive audit logs
4. **User Management:** Implement proper user lifecycle management
5. **Incident Response:** Have a plan for security incidents

## Additional Resources

- [WireGuard Security](https://www.wireguard.com/formal-verification/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [Flask Security](https://flask.palletsprojects.com/en/latest/security/)

## Version History

- v1.0.0 - Initial security documentation
- Added comprehensive security hardening (current)
