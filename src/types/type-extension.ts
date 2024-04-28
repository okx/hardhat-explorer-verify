import { EtherscanConfig, EtherscanUserConfig } from './type';

import 'hardhat/types/config';

declare module 'hardhat/types/config' {
    interface HardhatUserConfig {
        etherscan?: EtherscanUserConfig;
    }

    interface HardhatConfig {
        etherscan: EtherscanConfig;
    }
}
