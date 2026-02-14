import type { ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';

export class openHABApi implements ICredentialType {
	name = 'openHABApi';
	displayName = 'openHAB / myopenHAB API';
	documentationUrl = 'https://www.openhab.org/docs/configuration/rest.html';
	test: ICredentialTestRequest = {
		request: {
			method: 'GET',
			url: '={{(($credentials.authType === "cloud" ? "https://home.myopenhab.org" : ($credentials.baseUrlLocal || "http://localhost:8080"))).replace(/\\/+$/, "") + "/rest/items?limit=1"}}',
			skipSslCertificateValidation:
				'={{$credentials.authType === "token" && Boolean($credentials.allowUnauthorizedCerts)}}',
			headers: {
				Accept: 'application/json',
				Authorization: '={{$credentials.authType === "token" ? "Bearer " + $credentials.token : undefined}}',
				'X-OPENHAB-TOKEN':
					'={{$credentials.authType === "cloud" ? ($credentials.cloudToken || undefined) : $credentials.token}}',
			},
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
