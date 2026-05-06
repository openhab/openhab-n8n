# n8n openHAB Community Node

<img align="right" width="220" src="./nodes/openHAB/openhab.svg" type="image/svg+xml"/>

[![GitHub Actions Build Status](https://github.com/openhab/openhab-n8n/actions/workflows/ci-build.yml/badge.svg?branch=main)](https://github.com/openhab/openhab-n8n/actions/workflows/ci-build.yml)
[![MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Custom n8n node for interacting with the openHAB REST API, with optional myopenHAB cloud access.

## Features

- Send commands or update state for items (lights, sensors, virtual switches, etc.).
- Read item state, metadata, and list/filter items by tags.
- Inspect things and their status.
- List, trigger, enable/disable rules.
- Fetch system info for quick health checks.
- Trigger workflows from openHAB events.
- Works against local openHAB or remotely through `myopenhab.org`.

## Requirements

- openHAB with REST API enabled (default on openHAB 3+).
- For local: openHAB API token (Settings → API Security → Create Token).
- For remote via myopenHAB: myopenHAB account email + password. Optionally add an openHAB API token for admin-level endpoints.
- n8n 1.0+ with custom nodes enabled.

## Installation

1. Install from npm in n8n:
   - **n8n UI**: Settings -> Community Nodes -> Install and enter `@openhab/n8n-nodes-openhab`
   - **CLI (in your n8n deployment)**: `npm install @openhab/n8n-nodes-openhab`
2. Restart n8n so it discovers the new node.

### Local development install

1. Build the node:
   ```bash
   npm install
   npm run build
   ```
2. Point n8n custom extensions to this project path with `N8N_CUSTOM_EXTENSIONS` (or copy `dist` into your custom nodes directory).
3. Restart n8n.

## Usage

### openHAB node

1. Add the **openHAB** node to a workflow.
2. Set credentials:
   - **Local**: Base URL (e.g., `http://localhost:8080`) + API token.
   - **Cloud (myopenHAB)**: Choose “myopenHAB Account” in credentials and enter your myopenHAB login. If needed, set optional **openHAB API Token (optional)** to send `X-OPENHAB-TOKEN`.
3. Choose a resource:
   - **Item**: list/get/state/command/update/metadata.
   - **Thing**: list/get/status.
   - **Rule**: list/run/enable/disable.
   - **System**: system info.
4. Execute the node; outputs are JSON objects ready for downstream n8n steps.

#### Usage examples

1. Read a light state:
   - Resource: `Item`
   - Operation: `Get State`
   - Item Name: `LivingRoomLight`
2. Turn a switch on:
   - Resource: `Item`
   - Operation: `Send Command`
   - Item Name: `KitchenSwitch`
   - Command: `ON`
3. Run a rule:
   - Resource: `Rule`
   - Operation: `Run`
   - Rule UID: `evening_scene`

### openHAB Trigger node

1. Add the **openHAB Trigger** node to a workflow to listen for openHAB events and start workflows when they arrive.
2. Set credentials:
   - **Local**: Base URL (e.g., `http://localhost:8080`) + API token.
   - **Cloud (myopenHAB)**: Choose “myopenHAB Account” in credentials and enter your myopenHAB login and set **openHAB API Token (optional)** to send `X-OPENHAB-TOKEN`.
3. Filter events by:
   - **Topic**: Comma-separated topic filters (supports `*` wildcard or RegEx and exclusions with `!`), e.g. `openhab/items/*/command,!openhab/items/MyItem/*` to listen for command to all Items except `MyItem`.
   - **Type**: Comma-separated event types to include, e.g. `ItemCommandEvent,ItemStateChangedEvent,ItemStateUpdatedEvent`.
   - **Source**: Comma-separated event sources to exclude, e.g. `org.openhab.ui=>org.openhab.core.io.rest,`. The node’s own source is always excluded to prevent loops.

The trigger emits incoming events with the following properties:

- `type`: event type
- `topic`: event topic
- `payload`: parsed JSON payload (if possible)
- `source`: event source (if present)
- `rawPayload`: raw payload string
- `receivedAt`: ISO timestamp

Example event:

```json
{
   "type": "ItemCommandEvent", 
   "topic": "openhab/items/Kitchen_Light/command",
   "payload": {
      "type": "OnOff", 
      "value": "ON"
   },
   "source": "org.openhab.ui=>org.openhab.core.io.rest",
   "rawPayload": "{\"type\":\"OnOff\",\"value\":\"ON\"}",
   "receivedAt": "2026-04-20T19:12:18.056Z"
}
```

### Notes

- Authentication is applied through the credential type (used by `httpRequestWithAuthentication`), so each request automatically uses the selected auth mode.
- In myopenHAB cloud mode, you can add an optional openHAB API token for endpoints that require elevated permissions.
- Self-signed certificates are supported only for local openHAB HTTPS, not for myopenHAB cloud authentication.
- When sending commands, use values your item accepts (e.g., `ON`, `OFF`, `22`, `50%`, `UP`, `DOWN`).

## Development

- Lint: `npm run lint`
- Test: `npm run test`
- Build: `npm run build`
- TypeScript config targets Node 18+.

## License

MIT. See [LICENSE](LICENSE).
