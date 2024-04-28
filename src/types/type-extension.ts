import { EtherscanConfig, EtherscanUserConfig, SourcifyConfig } from './type';

import 'hardhat/types/config';

declare module 'hardhat/types/config' {
    interface HardhatUserConfig {
        etherscan?: Partial<EtherscanUserConfig>;
        sourcify?: Partial<SourcifyConfig>;
    }

    interface HardhatConfig {
        etherscan: EtherscanConfig;
        sourcify: SourcifyConfig;
    }
}
