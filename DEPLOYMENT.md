# Production Deployment Guide

This guide covers production deployment of WireGuard Multi-Client WebUI.

## Prerequisites

- Linux server with kernel ≥5.6 (for WireGuard)
- Docker Engine 20.10+
- Docker Compose V2+
- Minimum 2GB RAM, 2 CPU cores
- 20GB+ disk space
- Public IP address
- Domain name (recommended for HTTPS)

## Quick Start

### 1. System Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y wireguard-tools git curl ufw

# Enable IP forwarding
echo "net.ipv4.ip_forward = 1" | sudo tee -a /etc/sysctl.conf
echo "net.ipv6.conf.all.forwarding = 1" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### 2. Configure Firewall

```bash
# Allow SSH, HTTP/HTTPS, and WireGuard
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 51820/udp
sudo ufw --force enable
```

### 3. Clone and Configure

```bash
cd /opt
sudo git clone https://github.com/Arthur2500/wireguard-multiclient-webui.git
cd wireguard-multiclient-webui

# Generate secure keys
cat > .env << EOL
SECRET_KEY=$(openssl rand -base64 32)
JWT_SECRET_KEY=$(openssl rand -base64 32)
ADMIN_PASSWORD=$(openssl rand -base64 16)
WG_DEFAULT_ENDPOINT=your-server-ip-or-domain.com
STATS_COLLECTION_INTERVAL=60
EOL

# Save admin credentials
echo "Admin: admin / Password: see .env ADMIN_PASSWORD" > admin-credentials.txt
```

### 4. Deploy with HTTPS (Recommended)

Install nginx and Let's Encrypt:

```bash
sudo apt install -y nginx certbot python3-certbot-nginx

# Create nginx config
sudo nano /etc/nginx/sites-available/wireguard-webui
```

Add configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and get certificate:

```bash
sudo ln -s /etc/nginx/sites-available/wireguard-webui /etc/nginx/sites-enabled/
sudo certbot --nginx -d your-domain.com
sudo systemctl reload nginx
```

### 5. Start Application

```bash
docker-compose up -d
docker-compose logs -f
```

## Scaling for 1000+ Users

### 1. Increase Workers

Edit `docker-compose.yml`:

```yaml
backend:
  command: ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "run:app"]
```

### 2. Optimize Stats Collection

In `.env`, increase interval:

```bash
STATS_COLLECTION_INTERVAL=300  # 5 minutes instead of 10 seconds
```

### 3. Use PostgreSQL

```yaml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: secure_password
      POSTGRES_DB: wireguard
    volumes:
      - postgres-data:/var/lib/postgresql/data
  
  backend:
    environment:
      DATABASE_URL: postgresql://postgres:secure_password@postgres/wireguard
```

## Backup & Restore

### Automated Backup Script

```bash
#!/bin/bash
BACKUP_DIR="/backup/wireguard"
DATE=$(date +%Y%m%d_%H%M%S)
APP_DIR="/opt/wireguard-multiclient-webui"

mkdir -p "${BACKUP_DIR}"
cp "${APP_DIR}/data/app.db" "${BACKUP_DIR}/app.db.${DATE}"
tar -czf "${BACKUP_DIR}/configs.${DATE}.tar.gz" -C "${APP_DIR}" wireguard/
find "${BACKUP_DIR}" -mtime +30 -delete
```

Schedule daily at 2 AM:

```bash
echo "0 2 * * * /usr/local/bin/backup-wireguard.sh" | sudo crontab -
```

### Restore

```bash
docker-compose down
cp /backup/wireguard/app.db.TIMESTAMP data/app.db
tar -xzf /backup/wireguard/configs.TIMESTAMP.tar.gz -C .
docker-compose up -d
```

## Monitoring

### Health Checks

```bash
# Check application health
curl http://localhost:8080/api/health
curl http://localhost:8080/api/ready

# Check WireGuard interfaces
sudo wg show
```

### Log Monitoring

```bash
# Application logs
docker-compose logs -f backend

# System logs
sudo journalctl -u docker -f
```

## Troubleshooting

### Container Issues

```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs backend

# Restart services
docker-compose restart
```

### WireGuard Issues

```bash
# Check interfaces
sudo wg show

# Verify IP forwarding
sysctl net.ipv4.ip_forward
sysctl net.ipv6.conf.all.forwarding

# Check module
lsmod | grep wireguard
```

### Database Issues

```bash
# Check file permissions
ls -la data/

# Check locks
lsof data/app.db

# If locked, restart
docker-compose restart backend
```

## Maintenance

### Update Application

```bash
cd /opt/wireguard-multiclient-webui
git pull
docker-compose pull
docker-compose up -d
```

### Update System

```bash
sudo apt update && sudo apt upgrade -y
sudo reboot  # If kernel updated
```

## Security Checklist

Before going live:

- [ ] Changed default admin password
- [ ] Set secure SECRET_KEY and JWT_SECRET_KEY
- [ ] HTTPS enabled
- [ ] Firewall configured
- [ ] Backup strategy implemented
- [ ] Monitoring configured
- [ ] Log rotation configured

## Support

- GitHub: https://github.com/Arthur2500/wireguard-multiclient-webui
- Issues: https://github.com/Arthur2500/wireguard-multiclient-webui/issues
- Security: See SECURITY.md
