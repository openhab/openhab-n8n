import { openHAB } from './nodes/openHAB/openHAB.node';
import { openHABTrigger } from './nodes/openHABTrigger/openHABTrigger.node';
import { openHABApi } from './credentials/openHABApi.credentials';

export const nodes = [openHAB, openHABTrigger];
export const credentials = [openHABApi];
