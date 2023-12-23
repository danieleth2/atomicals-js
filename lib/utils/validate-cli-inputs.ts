import { ConfigurationInterface } from '../interfaces/configuration.interface';
export const validateCliInputs = (): ConfigurationInterface => {
  // Validate the BITCOIND_RPCURL 
  if (process.env.ELECTRUMX_PROXY_BASE_URL) {
    return {
      electrumxWebsocketUrl: process.env.ELECTRUMX_PROXY_BASE_URL
    }
  }

  throw new Error('invalid config');
}
