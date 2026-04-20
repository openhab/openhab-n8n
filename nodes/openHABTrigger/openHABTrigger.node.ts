import {
	NodeOperationError,
	type IDataObject,
	type ICredentialDataDecryptedObject,
	type INodeExecutionData,
	type INodeProperties,
	type INodeType,
	type INodeTypeDescription,
	type ITriggerFunctions,
	type ITriggerResponse,
} from 'n8n-workflow'
import { WebSocketClient } from '../../util/ws';
import { setupOpenHABApi } from '../../util/openHABApi'

/**
 * A message that is sent over the openHAB WebSocket.
 * Interface for the structure of the message payload sent over the WebSocket.
 */
interface EventWebSocketMessage extends IDataObject {
	type: string
	topic: string
	payload: string
	source: string
}

type Primitive = string | number | boolean;
type PrimitiveArray = Primitive[];
type EventPayload = Primitive | PrimitiveArray | IDataObject | IDataObject[] | null;

function parseFilterList(value: string): string[] {
	return value
		.split(',')
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
}

const HEARTBEAT_INTERVAL_MS = 5000;

async function buildWebSocketConfig(
	this: ITriggerFunctions,
): Promise<{
	url: string;
	protocols: string[];
	allowInsecure: boolean;
	headers: Record<string, string>;
	clientId: string;
}> {
	const credentials = (await this.getCredentials(
		'openHABApi',
	)) as ICredentialDataDecryptedObject;

	const { useCloud, baseUrl, skipSslCertificateValidation, source } = await setupOpenHABApi.call(this);

	let accessToken = '';
	const extraHeaders: Record<string, string> = {};

	if (useCloud) {
		// additional validation as Event WebSocket API requires token
		const cloudToken = ((credentials.cloudToken as string | undefined) ?? '').trim();
		if (!cloudToken) {
			throw new NodeOperationError(this.getNode(), 'API token is required.');
		}

		const username = credentials.username as string;
		const password = credentials.password as string;

		extraHeaders['Authorization'] =
			`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
		extraHeaders['X-OPENHAB-TOKEN'] = cloudToken;
		accessToken = cloudToken;
	} else {
		const token = (credentials.token as string).trim();
		accessToken = token;
		extraHeaders['Authorization'] = `Bearer ${token}`;
		extraHeaders['X-OPENHAB-TOKEN'] = token;
	}

	let parsedUrl: URL;
	try {
		parsedUrl = new URL(baseUrl);
	} catch (error) {
		throw new NodeOperationError(
			this.getNode(),
			`Invalid Base URL "${baseUrl}": ${(error as Error).message}`,
		);
	}

	parsedUrl.protocol = parsedUrl.protocol === 'https:' ? 'wss:' : 'ws:';
	parsedUrl.pathname = '/ws/events';
	parsedUrl.search = '';

	const encodedAccessToken = accessToken ? Buffer.from(accessToken).toString('base64').replace(/=*$/, '') : null
	const subProtocols = encodedAccessToken ? [`org.openhab.ws.accessToken.base64.${encodedAccessToken}`, 'org.openhab.ws.protocol.default'] : [];

	return {
		url: parsedUrl.toString(),
		protocols: subProtocols,
		allowInsecure: skipSslCertificateValidation,
		headers: extraHeaders,
		clientId: source,
	};
}

export class openHABTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'openHAB Trigger',
		name: 'openHabTrigger',
		icon: 'file:openhab.svg',
		group: ['trigger'],
		version: 1,
		description: 'Listen to the openHAB Event Bus.',
		documentationUrl: 'https://www.openhab.org/docs/developer/utils/events.html',
		defaults: {
			name: 'openHAB Trigger',
		},
		inputs: [],
		outputs: ['main'],
		credentials: [
			{
				name: 'openHABApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Topic Filters',
				name: 'topicFilters',
				type: 'string',
				default: '',
				placeholder: 'openhab/items/*/command,!openhab/items/MyItem/*',
				description:
					'Comma-separated topic filters. Supports wildcards, regular expressions, and exclusions prefixed with !',
			},
			{
				displayName: 'Type Filters',
				name: 'typeFilters',
				type: 'string',
				default: '',
				placeholder: 'ItemCommandEvent,ItemStateChangedEvent,ItemStateUpdatedEvent',
				description:
					'Comma-separated event types to subscribe to. Leave empty to receive all event types.',
			},
			{
				displayName: 'Source Filters',
				name: 'sourceFilters',
				type: 'string',
				default: '',
				placeholder: '',
				description:
					'Comma-separated event sources to exclude. The node’s own source is always excluded to prevent loops.',
			},
		] as INodeProperties[],
	};

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		const topicFilters = parseFilterList(this.getNodeParameter('topicFilters') as string);
		const typeFilters = parseFilterList(this.getNodeParameter('typeFilters') as string);
		const sourceFilters = parseFilterList(this.getNodeParameter('sourceFilters') as string);

		const { url, protocols, allowInsecure, headers, clientId } =
			await buildWebSocketConfig.call(this);

		let isClosing = false;
		let isConnected = false;
		let heartbeatTimer: NodeJS.Timeout | null = null;

		const ws = new WebSocketClient(url, {
			protocols,
			allowInsecure,
			headers,
		});

		const sendWebSocketEvent = (topic: string, payload: string) => {
			if (!isConnected) {
				return;
			}
			ws.send(
				JSON.stringify({
					type: 'WebSocketEvent',
					topic,
					payload,
					id: clientId,
				}),
			);
		};

		ws.on('open', () => {
			isConnected = true;

			// Exclude our own source to prevent loops
			sourceFilters.push(clientId);
			sendWebSocketEvent('openhab/websocket/filter/source', JSON.stringify(sourceFilters));

			if (topicFilters.length > 0) {
				sendWebSocketEvent('openhab/websocket/filter/topic', JSON.stringify(topicFilters));
			}
			if (typeFilters.length > 0) {
				sendWebSocketEvent('openhab/websocket/filter/type', JSON.stringify(typeFilters));
			}

			heartbeatTimer = setInterval(() => {
				if (!isConnected) {
					return;
				}
				sendWebSocketEvent('openhab/websocket/heartbeat', 'PING');
			}, HEARTBEAT_INTERVAL_MS);
		});

		ws.on('message', (data: string | Buffer) => {
			const message = Buffer.isBuffer(data) ? data.toString('utf8') : data;

			let event: EventWebSocketMessage;
			try {
				event = JSON.parse(message) as EventWebSocketMessage;
			} catch {
				return;
			}

			if (event.type === 'WebSocketEvent') {
				// PONG response from the server
				// confirmation of filter setting
				return;
			}

			const rawPayload = event.payload;
			let parsedPayload = rawPayload as EventPayload;
			if (typeof rawPayload === 'string') {
				try {
					parsedPayload = JSON.parse(rawPayload) as EventPayload;
				} catch {
					// Keep string payload
				}
			}

			const item: INodeExecutionData = {
				json: {
					...event,
					payload: parsedPayload,
					rawPayload: rawPayload,
					receivedAt: new Date().toISOString(),
				},
			};
			this.emit([[item]]);
		});

		ws.on('close', () => {
			isConnected = false;
			if (heartbeatTimer) {
				clearInterval(heartbeatTimer);
				heartbeatTimer = null;
			}
			if (!isClosing) {
				this.emitError(
					new Error('openHAB event WebSocket closed unexpectedly.'),
				);
			}
		});

		ws.on('error', (err: Error) => {
			if (!isClosing) {
				this.emitError(new Error((err.message || 'Unknown WebSocket error')));
			}
		});

		ws.connect();

		return {
			closeFunction: async () => {
				isClosing = true;
				if (heartbeatTimer) {
					clearInterval(heartbeatTimer);
					heartbeatTimer = null;
				}
				ws.close();
			},
		};
	}
}
