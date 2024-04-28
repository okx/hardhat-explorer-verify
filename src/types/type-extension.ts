import { EtherscanConfig, EtherscanUserConfig, SourcifyConfig } from './type';

import 'hardhat/types/config';

declare module 'hardhat/types/config' {
    interface HardhatUserConfig {
        oklint?: Partial<EtherscanUserConfig>;
        etherscan?: Partial<EtherscanUserConfig>;
        sourcify?: Partial<SourcifyConfig>;
    }

    interface HardhatConfig {
        oklint?: EtherscanConfig;
        etherscan: EtherscanConfig;
        sourcify: SourcifyConfig;
    }
}
