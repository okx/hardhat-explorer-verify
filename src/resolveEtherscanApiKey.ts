import { NomicLabsHardhatPluginError } from 'hardhat/plugins';

import { pluginName } from './task/constants';
import { EtherscanConfig } from './types/type';

export const resolveEtherscanApiKey = (
    apiKey: EtherscanConfig['apiKey'],
    network: string,
): string => {
    if (apiKey === undefined || apiKey === '') {
        console.info('apiKey not correct.');
        throwMissingApiKeyError(network);
    }

    if (typeof apiKey === 'string') {
        return apiKey;
    }

    console.info('apiKey is object');
    const key = (apiKey as any)[network];

    if (key === undefined || key === '') {
        throwMissingApiKeyError(network);
    }

    return key;
};

export function throwMissingApiKeyError(network: string): never {
    throw new NomicLabsHardhatPluginError(
        pluginName,
        `You are trying to verify a contract in '${network}', but no API token was found for this network. Please provide one in your hardhat config. For example:

{
  ...
  etherscan: {
    apiKey: {
      ${network}: 'your API key'
    }
  }
}

See https://etherscan.io/apis`,
    );
}
