# n8n openHAB Community Node

<img align="right" width="220" src="./logo.svg" type="image/svg+xml"/>

[![GitHub Actions Build Status](https://github.com/openhab/openhab-n8n/actions/workflows/ci-build.yml/badge.svg?branch=main)](https://github.com/openhab/openhab-n8n/actions/workflows/ci-build.yml)
[![EPL-2.0](https://img.shields.io/badge/license-EPL%202-green.svg)](https://opensource.org/licenses/EPL-2.0)

Custom n8n node for interacting with the openHAB REST API, with optional myopenHAB cloud access.

## Features

- Send commands or update state for items (lights, sensors, virtual switches, etc.).
- Read item state, metadata, and list/filter items by tags.
- Inspect things and their status.
- List, trigger, enable/disable rules.
- Fetch system info for quick health checks.
- Works against local openHAB or remotely through `myopenhab.org`.

## Requirements

- openHAB with REST API enabled (default on openHAB 3+).
- For local: openHAB API token (Settings → API Security → Create Token).
- For remote via myopenHAB: myopenHAB account email + password. Optionally add an openHAB API token for admin-level endpoints.
- n8n 1.0+ with custom nodes enabled.

## Installation

1. Build the node:
   ```bash
   npm install
   npm run build
   ```
2. Copy `dist` into your n8n custom nodes directory (or set `N8N_CUSTOM_EXTENSIONS` to this project path).
3. Restart n8n so it discovers the new node.

## Usage

1. Add the **openHAB** node to a workflow.
2. Set credentials:
   - **Local**: Base URL (e.g., `http://localhost:8080`) + API token.
   - **Cloud (myopenHAB)**: Choose “myopenHAB Account” in credentials and enter your myopenHAB login. If needed, set optional **openHAB API Token (optional)** to send `X-OPENHAB-TOKEN`.
3. Choose a resource:
   - **Item**: list/get/state/command/update/metadata.
   - **Thing**: list/get/status.
   - **Rule**: list/run/enable/disable.
   - **System**: system info.
4. Optional: enable **Enable Debug Logging** on the node to log request/response metadata to n8n logs (secrets are redacted).
5. Execute the node; outputs are JSON objects ready for downstream n8n steps.

### Notes

- In myopenHAB cloud mode, you can add an optional openHAB API token for endpoints that require elevated permissions.
- Self-signed certificates are supported only for local openHAB HTTPS, not for myopenHAB cloud authentication.
- When sending commands, use values your item accepts (e.g., `ON`, `OFF`, `22`, `50%`, `UP`, `DOWN`).

## Development

- Lint: `npm run lint`
- Build: `npm run build`
- TypeScript config targets Node 18+.

## License

Eclipse Public License 2.0. See [LICENSE](LICENSE).
