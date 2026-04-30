# Protocol Reverse Engineering

Beyond HTTP/HTTPS, modern applications use WebSocket, gRPC, custom TCP, and UDP protocols. Understanding these unlocks data sources invisible to standard web scraping.

## Protocol Identification

```bash
# Quick protocol fingerprint
nmap -sV -p 443 target.com

# TLS inspection
openssl s_client -connect target.com:443 -servername target.com

# ALPN negotiation (HTTP/2, HTTP/3)
openssl s_client -alpn h2 -connect target.com:443

# Certificate inspection
openssl x509 -in cert.pem -text -noout
```

## WebSocket

### Identification

Look for:
- `Upgrade: websocket` headers
- `Sec-WebSocket-Key` / `Sec-WebSocket-Accept`
- `ws://` or `wss://` URLs

### Inspection

```bash
# wscat for manual testing
npm install -g wscat
wscat -c wss://target.com/socket

# websocat for advanced use (curl for WebSockets)
websocat wss://target.com/socket

# mitmproxy supports WebSocket interception
mitmproxy --mode reverse:wss://target.com:443@localhost:8080
```

### Replay Pattern

```python
import websocket
import json

ws = websocket.create_connection("wss://target.com/socket")
ws.send(json.dumps({"type": "subscribe", "channel": "updates"}))

while True:
    msg = ws.recv()
    data = json.loads(msg)
    print(data)
```

### Authentication Patterns

| Method | How to replicate |
|---|---|
| Cookie-based | Send same cookies from web session |
| Token in query | `wss://target.com/socket?token=...` |
| First message auth | Send auth frame immediately after connect |
| JWT in Sec-WebSocket-Protocol | Extract from browser DevTools |

## gRPC and gRPC-Web

### Identification

- Content-Type: `application/grpc`, `application/grpc-web`
- HTTP/2 POST to paths like `/package.Service/Method`
- Binary protobuf payloads

### Tooling

```bash
# grpcurl for testing
grpcurl -plaintext target.com:50051 list
grpcurl -plaintext target.com:50051 package.Service/Method

# BloomRPC (GUI)
# Postman (modern versions support gRPC)
```

### Proto Discovery

When `.proto` files are unavailable:

```bash
# 1. Capture traffic with mitmproxy/Burp
# 2. Export raw protobuf bytes
# 3. Use blackboxprotobuf
pip install blackboxprotobuf

# Or protoc with --decode_raw
echo -n '<binary_payload>' | protoc --decode_raw
```

### Reverse Engineering Protobuf

```python
from blackboxprotobuf import decode_message

with open("payload.bin", "rb") as f:
    data = f.read()

message, typedef = decode_message(data)
print(message)
# Iteratively refine the type definition
```

Key protobuf patterns:
- Varint fields: `0x08`, `0x10`, `0x18` (field 1, 2, 3 with wire type 0)
- Length-delimited: `0x0a` (field 1, wire type 2) followed by length byte
- Fixed32/64: `0x0d`, `0x09`, `0x11`, `0x19`

## Server-Sent Events (SSE)

```bash
# Direct curl
curl -N -H "Accept: text/event-stream" \
  -H "Authorization: Bearer ..." \
  https://target.com/events

# Or use standard HTTP client with stream=True
```

SSE is simpler than WebSocket: standard HTTP, server pushes text/events.

## Custom TCP/UDP Protocols

### Reconnaissance

```bash
# Port scan
nmap -p- target.com

# Service fingerprint
nmap -sV -sC target.com

# Banner grab
nc target.com 1337

# Traffic capture
sudo tcpdump -i any -w capture.pcap host target.com
```

### Analysis with Wireshark

1. Capture traffic during known operation
2. Filter: `tcp.port == 1337`
3. Follow TCP stream: `Analyze → Follow → TCP Stream`
4. Look for patterns:
   - Fixed-length headers
   - Magic bytes / signatures
   - Length-prefix framing
   - Delimiter-based framing (newline, null byte)

### Common Framing Patterns

| Pattern | Structure | Example |
|---|---|---|
| Length-prefix | `[4 bytes length][payload]` | Protobuf, many game protocols |
| Delimiter | `payload\r\n` | Redis, HTTP/1 |
| Fixed header | `[16 byte header][variable body]` | Binary protocols |
| TLV | `[type][length][value]` | ASN.1, some financial protocols |

### Replay with Custom Client

```python
import socket
import struct

sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.connect(("target.com", 1337))

# Length-prefix protocol
payload = b'{"action":"query"}'
header = struct.pack(">I", len(payload))  # big-endian 4-byte length
sock.sendall(header + payload)

response = sock.recv(4096)
print(response)
```

## HTTP/3 and QUIC

Modern stacks increasingly use QUIC:

```bash
# Check HTTP/3 support
curl -I --http3 https://target.com

# Force HTTP/2
curl --http2 https://target.com

# QUIC-specific inspection
# Use qlog or Chrome net-export for analysis
```

Tooling:
- `aioquic` (Python) for custom QUIC clients
- `ngtcp2` (C) for low-level QUIC
- Chrome's `chrome://net-export/` for browser-side inspection

## MQTT (IoT/Messaging)

```bash
# mosquitto clients
mosquitto_sub -h broker.target.com -t "topic/#"
mosquitto_pub -h broker.target.com -t "topic/test" -m "payload"

# Python
pip install paho-mqtt
```

Common in IoT, some real-time dashboards.

## GraphQL (over HTTP)

Not a transport protocol, but a query language that requires specific interaction patterns:

```bash
# Introspection query (often disabled in production)
curl -X POST https://target.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __schema { types { name } } }"}'

# Standard query
curl -X POST https://target.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { user(id: 1) { name email } }"}'
```

GraphQL-specific RE:
- Look for persisted queries (hash-based)
- Batching (array of operations)
- Fragments and variable definitions
- Error messages leak schema info

## Message Queues

| System | Protocol | Access pattern |
|---|---|---|
| RabbitMQ | AMQP | `pika` (Python), `amqplib` (Node) |
| Kafka | Binary TCP | `kafka-python`, `confluent-kafka` |
| Redis | RESP | `redis-py` |
| NATS | Text/binary | `nats-py`, `nats.js` |
| ZeroMQ | Custom framing | `pyzmq` |

These are rarely directly scrapable but may be relevant for internal infrastructure RE.

## Protocol Analysis Workflow

```text
1. Identify transport (TCP/UDP/QUIC/WebSocket)
2. Capture traffic during known operations
3. Look for framing patterns (length, delimiter, fixed)
4. Map message types to operations
5. Find authentication mechanism
6. Write minimal client to reproduce
7. Iterate until full protocol coverage
```

## Tools Summary

| Task | Tool |
|---|---|
| Packet capture | Wireshark, tcpdump, tshark |
| Traffic replay | `tcpreplay`, custom scripts |
| Binary protocol decode | `ImHex`, `010 Editor`, `Kaitai Struct` |
| Structured binary templates | `Kaitai Web IDE` |
| Protocol fuzzing | `Boofuzz`, `AFL`, `Peach` |
| TLS inspection | `openssl s_client`, `sslyze` |
| HTTP/2 frame analysis | Wireshark, `nghttp`, `curl --trace` |

Protocol RE is the bridge between web scraping and systems programming. Master it and no data source is out of reach.
