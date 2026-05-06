import {
	NodeApiError,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type IHttpRequestOptions,
	type INodeExecutionData,
	type INodeProperties,
	type INodeType,
	type INodeTypeDescription,
	type JsonObject,
	type ICredentialDataDecryptedObject,
} from 'n8n-workflow'
import { getEventSource, setupOpenHABApi } from '../../util/openHABApi'

interface ApiRequestOptions {
	plainText?: boolean;
	fullResponse?: boolean;
	extraHeaders?: IDataObject;
}

async function openhabApiRequest(
	this: IExecuteFunctions,
	method: string,
	path: string,
	body: IDataObject | string = {},
	qs: IDataObject = {},
	options: ApiRequestOptions = {},
) {
	const credentials = (await this.getCredentials('openHABApi')) as ICredentialDataDecryptedObject;

	const { useCloud, baseUrl, skipSslCertificateValidation } = await setupOpenHABApi.call(this);

	const normalizedMethod = method.toUpperCase();
	const isReadOperation = ['GET', 'HEAD'].includes(normalizedMethod);
	const headers: IDataObject = {
		Accept: options.plainText ? 'text/plain' : 'application/json',
		...(options.extraHeaders ?? {}),
	};

	if (!isReadOperation) {
		if (options.plainText) {
			headers['Content-Type'] = 'text/plain';
		} else {
			headers['Content-Type'] = 'application/json';
		}
	}

	const requestOptions: IHttpRequestOptions = {
		method: normalizedMethod as IHttpRequestOptions['method'],
		url: `${baseUrl}/rest${path}`,
		qs,
		headers,
		json: !options.plainText,
		skipSslCertificateValidation,
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
	};

	if (!isReadOperation) {
		requestOptions.body = body;
	}

	if (useCloud) {
		requestOptions.auth = {
			username: credentials.username as string,
			password: credentials.password as string,
			sendImmediately: true,
		};
	}

	let response: IDataObject;
	try {
		response = (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'openHABApi',
			requestOptions,
		)) as IDataObject;
	} catch (error) {
		throw error;
	}

	const fullResponse = response as IDataObject;
	const statusCode = fullResponse.statusCode as number | undefined;
	const statusMessage = (fullResponse.statusMessage as string | undefined) ?? '';

	if (typeof statusCode !== 'number') {
		throw new NodeOperationError(
			this.getNode(),
			'openHAB request failed: missing HTTP status code in response.',
		);
	}

	if (statusCode < 200 || statusCode >= 300) {
		const body = fullResponse.body;
		const bodyMessage =
			body === undefined || body === null
				? ''
				: typeof body === 'string'
				? body.trim()
				: JSON.stringify(body);

		const cloudAuthHint =
			useCloud && statusCode === 401
				? ' - For admin-level endpoints, set "openHAB API Token (optional)" in cloud credentials.'
				: '';
		throw new NodeApiError(
			this.getNode(),
			{
				statusCode,
				statusMessage,
				body,
			} as JsonObject,
			{
				message:
					`openHAB request failed with status ${statusCode} ${statusMessage}`.trim() +
					cloudAuthHint,
				description: bodyMessage || undefined,
			},
		);
	}

	if (options.fullResponse) {
		return fullResponse;
	}

	return fullResponse.body as IDataObject | IDataObject[] | string;
}

export class openHAB implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'openHAB',
		name: 'openHab',
		icon: 'file:openhab.svg',
		group: ['transform'],
		version: 1,
		description:
			'Interact with openHAB through its REST API, including remote access via myopenHAB.org. Inline docs explain typical flows (send commands, query states, trigger rules, etc.).',
		defaults: {
			name: 'openHAB',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'openHABApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				options: [
					{
						name: 'Item',
						value: 'item',
						description:
							'Work with items: list, read state, send command, or update state. Great for toggling lights, reading sensors, or writing virtual switches.',
					},
					{
						name: 'Thing',
						value: 'thing',
						description: 'Inspect things and their status.',
					},
					{
						name: 'Rule',
						value: 'rule',
						description: 'List or trigger automation rules.',
					},
					{
						name: 'System',
						value: 'system',
						description: 'Check system info for quick health checks.',
					},
				],
				default: 'item',
			},

			/* Item operations */
			{
				displayName: 'Operation',
				name: 'itemOperation',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['item'],
					},
				},
				options: [
					{
						name: 'List Items',
						value: 'list',
						description: 'GET /rest/items — returns all items (optionally filtered by tag).',
						action: 'List items',
					},
					{
						name: 'Get Item',
						value: 'get',
						description: 'GET /rest/items/{itemName}',
						action: 'Get item',
					},
					{
						name: 'Get State',
						value: 'state',
						description: 'GET /rest/items/{itemName}/state',
						action: 'Get item state',
					},
					{
						name: 'Send Command',
						value: 'command',
						description:
							'POST /rest/items/{itemName} with a command payload (e.g., ON, OFF, 22, UP, DOWN).',
						action: 'Send command',
					},
					{
						name: 'Update State',
						value: 'updateState',
						description:
							'PUT /rest/items/{itemName}/state — updates state without commanding (useful for virtual items).',
						action: 'Update state',
					},
					{
						name: 'Get Metadata',
						value: 'metadata',
						description:
							'GET /rest/items/{itemName}?metadata=.* — retrieves metadata via the item endpoint.',
						action: 'Get metadata',
					},
				],
				default: 'list',
			},
			{
				displayName: 'Item Name',
				name: 'itemName',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['item'],
						itemOperation: ['get', 'state', 'command', 'updateState', 'metadata'],
					},
				},
				default: '',
				description: 'Exact item name as defined in openHAB.',
			},
			{
				displayName: 'Command / State',
				name: 'command',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['item'],
						itemOperation: ['command', 'updateState'],
					},
				},
				default: '',
				description:
					'Examples: ON, OFF, TOGGLE, 22, 50%, UP, DOWN, PLAY, PAUSE. Use device-supported values.',
			},
			{
				displayName: 'Tag Filter',
				name: 'tagFilter',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['item'],
						itemOperation: ['list'],
					},
				},
				default: '',
				description: 'Comma-separated list of tags to filter items (e.g., Lighting,Kitchen).',
			},

			/* Thing operations */
			{
				displayName: 'Operation',
				name: 'thingOperation',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['thing'],
					},
				},
				options: [
					{
						name: 'List Things',
						value: 'list',
						description: 'GET /rest/things',
						action: 'List things',
					},
					{
						name: 'Get Thing',
						value: 'get',
						description: 'GET /rest/things/{thingUID}',
						action: 'Get thing',
					},
					{
						name: 'Get Status',
						value: 'status',
						description: 'GET /rest/things/{thingUID}/status',
						action: 'Get thing status',
					},
				],
				default: 'list',
			},
			{
				displayName: 'Thing UID',
				name: 'thingUid',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['thing'],
						thingOperation: ['get', 'status'],
					},
				},
				default: '',
				description: 'Full thing UID, e.g., hue:0100:bridge:bulb1.',
			},

			/* Rule operations */
			{
				displayName: 'Operation',
				name: 'ruleOperation',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['rule'],
					},
				},
				options: [
					{
						name: 'List Rules',
						value: 'list',
						description: 'GET /rest/rules',
						action: 'List rules',
					},
					{
						name: 'Run Rule Now',
						value: 'run',
						description: 'POST /rest/rules/{ruleUID}/runnow',
						action: 'Run rule',
					},
						{
							name: 'Enable / Disable Rule',
							value: 'toggle',
							description: 'POST /rest/rules/{ruleUID}/enable with true/false',
							action: 'Toggle rule',
						},
					],
				default: 'list',
			},
			{
				displayName: 'Rule UID',
				name: 'ruleUid',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['rule'],
						ruleOperation: ['run', 'toggle'],
					},
				},
				default: '',
				description: 'Rule UID as shown in openHAB (e.g., lighting_evening).',
			},
			{
				displayName: 'Enable',
				name: 'ruleEnable',
				type: 'boolean',
				displayOptions: {
					show: {
						resource: ['rule'],
						ruleOperation: ['toggle'],
					},
				},
				default: true,
				description: 'True to enable, false to disable the rule.',
			},

			/* System operations */
			{
				displayName: 'Operation',
				name: 'systemOperation',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['system'],
					},
				},
				options: [
					{
						name: 'Get System Info',
						value: 'info',
						description: 'GET /rest/systeminfo',
						action: 'Get system info',
					},
				],
				default: 'info',
			},
		] as INodeProperties[],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const source = getEventSource.call(this);

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation =
					resource === 'item'
						? (this.getNodeParameter('itemOperation', i) as string)
						: resource === 'thing'
						? (this.getNodeParameter('thingOperation', i) as string)
						: resource === 'rule'
						? (this.getNodeParameter('ruleOperation', i) as string)
						: (this.getNodeParameter('systemOperation', i) as string);

				let responseData: IDataObject | IDataObject[] | string | undefined;

				if (resource === 'item') {
					if (operation === 'list') {
						const tagFilter = this.getNodeParameter('tagFilter', i, '') as string;
						const qs: IDataObject = {};
						if (tagFilter) {
							qs.tags = tagFilter;
						}
						responseData = await openhabApiRequest.call(this, 'GET',
							'/items',
							{},
							qs,
						);
					} else {
						const itemName = this.getNodeParameter('itemName', i) as string;

						if (operation === 'get') {
							responseData = await openhabApiRequest.call(this, 'GET',
								`/items/${encodeURIComponent(itemName)}`,
								{},
								{},
							);
						} else if (operation === 'state') {
							const state = await openhabApiRequest.call(this, 'GET',
								`/items/${encodeURIComponent(itemName)}/state`,
								{},
								{},
								{ plainText: true },
							);
							responseData = { item: itemName, state };
						} else if (operation === 'command') {
							const command = this.getNodeParameter('command', i) as string;
							const res = (await openhabApiRequest.call(this, 'POST',
								`/items/${encodeURIComponent(itemName)}`,
								command,
								{},
								{ plainText: true, fullResponse: true, extraHeaders: { 'X-OpenHAB-Source': source } },
							)) as IDataObject;
							responseData = {
								item: itemName,
								command,
								statusCode: res.statusCode,
							};
						} else if (operation === 'updateState') {
							const command = this.getNodeParameter('command', i) as string;
							const res = (await openhabApiRequest.call(this, 'PUT',
								`/items/${encodeURIComponent(itemName)}/state`,
								command,
								{},
								{ plainText: true, fullResponse: true },
							)) as IDataObject;
							responseData = {
								item: itemName,
								state: command,
								statusCode: res.statusCode,
							};
						} else if (operation === 'metadata') {
							const itemData = (await openhabApiRequest.call(this, 'GET',
								`/items/${encodeURIComponent(itemName)}`,
								{},
								{ metadata: '.*' },
							)) as IDataObject;
							responseData = {
								item: itemName,
								metadata: (itemData.metadata as IDataObject) ?? {},
							};
						}
					}
				} else if (resource === 'thing') {
					if (operation === 'list') {
						responseData = await openhabApiRequest.call(this, 'GET',
							'/things',
							{},
							{},
						);
					} else {
						const thingUid = this.getNodeParameter('thingUid', i) as string;
						if (operation === 'get') {
							responseData = await openhabApiRequest.call(this, 'GET',
								`/things/${encodeURIComponent(thingUid)}`,
								{},
								{},
							);
						} else if (operation === 'status') {
							responseData = await openhabApiRequest.call(this, 'GET',
								`/things/${encodeURIComponent(thingUid)}/status`,
								{},
								{},
							);
						}
					}
				} else if (resource === 'rule') {
					if (operation === 'list') {
						responseData = await openhabApiRequest.call(this, 'GET',
							'/rules',
							{},
							{},
						);
					} else {
						const ruleUid = this.getNodeParameter('ruleUid', i) as string;
						if (operation === 'run') {
							const res = (await openhabApiRequest.call(this, 'POST',
								`/rules/${encodeURIComponent(ruleUid)}/runnow`,
								{},
								{},
								{ fullResponse: true },
							)) as IDataObject;
							responseData = {
								rule: ruleUid,
								statusCode: res.statusCode,
							};
						} else if (operation === 'toggle') {
							const enable = this.getNodeParameter('ruleEnable', i) as boolean;
							const res = (await openhabApiRequest.call(this, 'POST',
								`/rules/${encodeURIComponent(ruleUid)}/enable`,
								enable.toString(),
								{},
								{ plainText: true, fullResponse: true },
							)) as IDataObject;
							responseData = {
								rule: ruleUid,
								enabled: enable,
								statusCode: res.statusCode,
							};
						}
					}
				} else if (resource === 'system') {
					responseData = await openhabApiRequest.call(this, 'GET',
						'/systeminfo',
						{},
						{},
					);
				}

				if (Array.isArray(responseData)) {
					responseData.forEach((entry) => {
						returnData.push({
							json: entry as IDataObject,
							pairedItem: { item: i },
						});
					});
				} else {
					returnData.push({
						json: responseData as IDataObject,
						pairedItem: { item: i },
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
