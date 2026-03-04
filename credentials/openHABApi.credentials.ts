import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	IDataObject,
	INodeProperties,
} from 'n8n-workflow';

export class openHABApi implements ICredentialType {
	name = 'openHABApi';
	displayName = 'openHAB / myopenHAB API';
	documentationUrl = 'https://www.openhab.org/docs/configuration/restdocs.html#authentication';
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			auth: '={{$credentials.authType === "cloud" ? { "username": $credentials.username, "password": $credentials.password, "sendImmediately": true } : undefined}}' as unknown as {
				username: string;
				password: string;
				sendImmediately?: boolean;
			},
			headers:
				'={{$credentials.authType === "token" ? { "Authorization": "Bearer " + $credentials.token, "X-OPENHAB-TOKEN": $credentials.token } : ($credentials.cloudToken ? { "X-OPENHAB-TOKEN": $credentials.cloudToken } : {})}}' as unknown as IDataObject,
		},
	};
	test: ICredentialTestRequest = {
		request: {
			method: 'GET',
			url: '={{(($credentials.authType === "cloud" ? "https://home.myopenhab.org" : ($credentials.baseUrlLocal || "http://localhost:8080"))).replace(/\\/+$/, "") + "/rest/items?limit=1"}}',
			skipSslCertificateValidation:
				'={{$credentials.authType === "token" && Boolean($credentials.allowUnauthorizedCerts)}}',
			auth: '={{$credentials.authType === "cloud" ? { "username": $credentials.username, "password": $credentials.password, "sendImmediately": true } : undefined}}' as unknown as {
				username: string;
				password: string;
				sendImmediately?: boolean;
			},
			headers:
				'={{$credentials.authType === "token" ? { "Accept": "application/json", "Authorization": "Bearer " + $credentials.token, "X-OPENHAB-TOKEN": $credentials.token } : ($credentials.cloudToken ? { "Accept": "application/json", "X-OPENHAB-TOKEN": $credentials.cloudToken } : { "Accept": "application/json" })}}' as unknown as IDataObject,
		},
	};

	properties: INodeProperties[] = [
		{
			displayName: 'Authentication',
			name: 'authType',
			type: 'options',
			options: [
				{
					name: 'API Token (local openHAB)',
					value: 'token',
					description: 'Use an openHAB local API token.',
				},
				{
					name: 'myopenHAB Account',
					value: 'cloud',
					description:
						'Use your myopenHAB.org account credentials. Optionally add an openHAB API token below for endpoints requiring elevated permissions.',
				},
			],
			default: 'token',
		},
		{
			displayName: 'Username / Email',
			name: 'username',
			type: 'string',
			default: '',
			required: true,
			displayOptions: {
				show: {
					authType: ['cloud'],
				},
			},
			description: 'Your myopenHAB account email.',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			displayOptions: {
				show: {
					authType: ['cloud'],
				},
			},
		},
		{
			displayName: 'openHAB API Token (optional)',
			name: 'cloudToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			displayOptions: {
				show: {
					authType: ['cloud'],
				},
			},
			hint: 'Optional token sent as X-OPENHAB-TOKEN for admin-level REST operations (for example rule enable/disable).',
			description:
				'Optional token sent as X-OPENHAB-TOKEN in addition to myopenHAB account login. Useful for admin-level REST operations such as enabling/disabling rules.',
		},
		{
			displayName: 'API Token (local)',
			name: 'token',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			displayOptions: {
				show: {
					authType: ['token'],
				},
			},
			description: 'Create under openHAB: Settings → API Security → Create New API Token. Not used for myopenHAB.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrlLocal',
			type: 'string',
			default: 'http://localhost:8080',
			displayOptions: {
				show: {
					authType: ['token'],
				},
			},
			description: 'Local openHAB root URL without /rest.',
		},
		{
			displayName: 'Allow Self-Signed Certificates',
			name: 'allowUnauthorizedCerts',
			type: 'boolean',
			default: false,
			displayOptions: {
				show: {
					authType: ['token'],
				},
			},
			description: 'Local openHAB only. Set true only when using HTTPS with self-signed certificates.',
		},
	];
}
