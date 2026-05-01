# Docker Network Topology

Data collected: 2026-04-23

## Networks

| Network | Subnet | Gateway | Scope |
|---------|--------|---------|-------|
| ai-gateway_default | 10.0.10.0/24 | 10.0.10.1 | local |
| -net | 10.0.8.0/24 | 10.0.8.1 | local |
| autoheal_default | 10.0.7.0/24 | 10.0.7.1 | local |
| bridge (default) | 10.0.1.0/24 | 10.0.1.1 | local |
| coolify | 10.0.0.0/24 | 10.0.0.1 | local |
| gitea_default | 10.0.6.0/24 | 10.0.6.1 | local |
| host | - | - | host |
| litellm_default | 10.0.4.0/24 | 10.0.4.1 | local |
| monitoring_monitoring | 10.0.16.0/24 | 10.0.16.1 | local |
| none | - | - | null |
| openwebui_net | 10.0.5.0/24 | 10.0.5.1 | local |
| platform_default | 10.0.9.0/24 | 10.0.9.1 | local |
| qgtzrmi6771lt8l7x8rqx72f | 10.0.19.0/24 | 10.0.19.1 | local |
| tn29zf1fync4nbiro818daq7 | 10.0.11.0/24 | 10.0.11.1 | local |
| zappro-lite_default | 10.0.2.0/24 | 10.0.2.1 | local |

## Containers

| Container | IPs | Networks | Can Reach Host LAN |
|-----------|-----|----------|-------------------|
| zappro-litellm | 10.0.10.3, 10.0.19.6, 10.0.2.4 | ai-gateway_default, qgtzrmi6771lt8l7x8rqx72f, zappro-lite_default | Yes (NAT) |
| qdrant | 10.0.9.2 | platform_default | Yes (NAT) |
| mcp-memory | host namespace | host | Yes (full host network) |
| mcp-ollama (mcp-ollama-mcp-ollama-1) | 10.0.19.50 | qgtzrmi6771lt8l7x8rqx72f | Yes (NAT) |
| mcp-qdrant | 10.0.19.51 | qgtzrmi6771lt8l7x8rqx72f | Yes (NAT) |
| qwen2-vl7b | 10.0.2.5 | zappro-lite_default | Yes (NAT) |
| coolify-redis | 10.0.0.2 | coolify | Yes (NAT) |
| zappro-redis | 10.0.8.2, 10.0.2.3 | -net, zappro-lite_default | Yes (NAT) |

## Notes

- **NAT access**: Containers on bridge networks can reach external networks via Docker's NAT/masquerade. They cannot be directly accessed from the host LAN unless explicit port mappings exist.
- **host network**: `mcp-memory` uses the host network namespace directly, sharing the host's IP and network stack.
- **Multi-network containers**: `zappro-litellm` and `zappro-redis` span multiple networks for cross-service communication.

## Key Service Endpoints

| Service | Network | Internal Endpoint |
|---------|---------|-----------------|
| zappro-litellm | ai-gateway_default | 10.0.10.3:4000 |
| qdrant | platform_default | 10.0.9.2:6333 |
| coolify-redis | coolify | 10.0.0.2:6379 |
| zappro-redis | -net | 10.0.8.2:6379 |
| mcp-ollama | qgtzrmi6771lt8l7x8rqx72f | 10.0.19.50:11434 |
