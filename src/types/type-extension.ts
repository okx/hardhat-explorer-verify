import { EtherscanConfig, EtherscanUserConfig, SourcifyConfig } from './type';

import 'hardhat/types/config';

declare module 'hardhat/types/config' {
    interface HardhatUserConfig {
        okxweb3explorer?: Partial<EtherscanUserConfig>;
        etherscan?: Partial<EtherscanUserConfig>;
        sourcify?: Partial<SourcifyConfig>;
    }

    interface HardhatConfig {
        okxweb3explorer?: EtherscanConfig;
        etherscan: EtherscanConfig;
        sourcify: SourcifyConfig;
    }
}
