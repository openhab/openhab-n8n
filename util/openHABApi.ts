import {
  type ICredentialDataDecryptedObject,
  IExecuteFunctions,
  type ITriggerFunctions,
  NodeOperationError
} from 'n8n-workflow'

export type AuthType = 'token' | 'cloud';

/**
 * Converts a string into a URL-friendly slug.
 * @param input The string to slugify
 * @returns A lowercased string with special characters replaced by underscores
 */
function slugify(input: string): string {
  return input
    .toLowerCase()
    // Replace any character that is not a-z, 0-9, or - with an underscore
    .replace(/[^a-z0-9-]/g, '_')
    // Replace multiple consecutive underscores with a single underscore
    .replace(/__+/g, '_')
    // Remove underscores from the start and end of the string
    .replace(/^_|_$/g, '');
}

/**
 * Generates an event source name based on the workflow and node names.
 */
export function getEventSource(this: ITriggerFunctions | IExecuteFunctions) {
  return `io.n8n:${slugify(this.getWorkflow().name ?? this.getWorkflow().id!)}:${slugify(this.getNode().name)}`;
}

/**
 * Builds the base URL, validates credentials, blocks allowUnauthorizedCerts for cloud, and returns API configuration.
 */
export async function setupOpenHABApi(this: ITriggerFunctions | IExecuteFunctions) {
  const credentials = (await this.getCredentials('openHABApi')) as ICredentialDataDecryptedObject;

  const rawAuthType = ((credentials.authType as string | undefined) ?? 'token').toLowerCase();
  if (rawAuthType === 'basic') {
    throw new NodeOperationError(
      this.getNode(),
      'Local Basic Auth is no longer supported. Use "API Token (local openHAB)" or "myopenHAB Account".',
    );
  }
  const authType: AuthType = rawAuthType === 'cloud' ? 'cloud' : 'token';
  const useCloud = authType === 'cloud';
  const configuredLocalBaseUrl = (
    (credentials.baseUrlLocal as string | undefined) ??
    (credentials.baseUrl as string | undefined) ??
    ''
  ).trim();

  // openHAB server base URL
  const baseUrl = (
    useCloud ? 'https://home.myopenhab.org' : configuredLocalBaseUrl || 'http://localhost:8080'
  ).replace(/\/+$/, '');
  if (!baseUrl) {
    throw new NodeOperationError(this.getNode(), 'Base URL is missing in credentials.');
  }

  // validate credentials
  if (authType === 'cloud') {
    const username = credentials.username as string;
    const password = credentials.password as string;
    if (!username || !password) {
      throw new NodeOperationError(
        this.getNode(),
        'Username and password are required for myopenHAB Account.',
      );
    }
  } else {
    const token = credentials.token as string;
    if (!token || !token.trim()) {
      throw new NodeOperationError(this.getNode(), 'API token is required.');
    }
  }

  // don't allow unauthorized certs for openHAB cloud
  const allowUnauthorizedCerts = Boolean(credentials.allowUnauthorizedCerts);
  if (useCloud && allowUnauthorizedCerts) {
    throw new NodeOperationError(
      this.getNode(),
      'Self-signed certificates are not allowed for myopenHAB authentication. Disable "Allow Self-Signed Certificates" in credentials.',
    );
  }

  const skipSslCertificateValidation = allowUnauthorizedCerts && !useCloud;

  const source = getEventSource.call(this);

  return { useCloud, baseUrl, skipSslCertificateValidation, source };
}
