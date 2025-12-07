# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Changed
- **Simplified Architecture**: Removed all peer-to-peer communication features to make this a simple wg-quick wrapper
- **Auto-Start Groups**: Groups now default to `is_running=True` and are automatically started on creation
- **Systemd Integration**: WireGuard interfaces now automatically restart across reboots via systemd service integration
- **Server Config Location**: Server configurations are now properly saved in the group-specific directory

### Removed
- Removed `can_address_peers` field from Client model
- Removed `allow_client_to_client` field from Group model
- Removed complex peer-to-peer iptables rules from server configuration generation
- Removed peer-communication options from frontend UI (GroupForm and ClientForm)
- Removed peer-communication toggles from group and client display components

### Technical Details
- Groups are created with `is_running=True` by default for immediate availability
- When a group is started, systemd service `wg-quick@wg{id}` is automatically enabled
- When a group is stopped, the corresponding systemd service is disabled
- Server configuration files are stored in `/etc/wireguard/{group-name}/server.conf`
- Client configuration files are stored in `/etc/wireguard/{group-name}/{client-name}.conf`

### Migration Notes
- **No database migration needed**: The database is always rebuilt from scratch
- Old columns (`can_address_peers`, `allow_client_to_client`) are ignored if present
- Existing deployments should delete their database and let it be recreated

### Breaking Changes
- API no longer accepts `allow_client_to_client` parameter in group creation/update
- API no longer accepts `can_address_peers` parameter in client creation/update
- Frontend interfaces updated to remove peer-communication controls
