import { NomicLabsHardhatPluginError } from 'hardhat/plugins';
import { EthereumProvider } from 'hardhat/types';

import { pluginName } from '../task/constants';
import { throwUnsupportedNetwork } from '../errors';
import { ChainConfig, CustomChain, EtherscanNetworkEntry } from '../types/type';

export async function getEtherscanEndpoints(
    provider: EthereumProvider,
    networkName: string,
    chainConfig: ChainConfig,
    customChains: CustomChain[],
): Promise<EtherscanNetworkEntry> {
    const chainIdsToNames = new Map(
        entries(chainConfig).map(([chainName, config]) => [config.chainId, chainName]),
    );

    const chainID = parseInt(await provider.send('eth_chainId'), 16);

    const safeCustomChains = Array.isArray(customChains) ? customChains : [];

    const networkInCustomChains = [...safeCustomChains]
        .reverse() // the last entry wins
        .find(customChain => customChain.chainId === chainID);

    // if there is a custom chain with the given chain id, that one is preferred
    // over the built-in ones
    if (networkInCustomChains !== undefined) {
        return networkInCustomChains;
    }

    const network = networkInCustomChains ?? chainIdsToNames.get(chainID);

    if (network === undefined) {
        throwUnsupportedNetwork(networkName, chainID);
    }

    const chainConfigEntry = chainConfig[network];

    return { network, urls: chainConfigEntry.urls, chainId: chainID, };
}

export async function retrieveContractBytecode(
    address: string,
    provider: EthereumProvider,
    networkName: string,
): Promise<string> {
    const bytecodeString = (await provider.send('eth_getCode', [address, 'latest'])) as string;
    const deployedBytecode = bytecodeString.startsWith('0x')
        ? bytecodeString.slice(2)
        : bytecodeString;
    if (deployedBytecode.length === 0) {
        throw new NomicLabsHardhatPluginError(
            pluginName,
            `The address ${address} has no bytecode. Is the contract deployed to this network?
The selected network is ${networkName}.`,
        );
    }
    return deployedBytecode;
}

function entries<O extends object>(o: O) {
    return Object.entries(o) as Array<[keyof O, O[keyof O]]>;
}
