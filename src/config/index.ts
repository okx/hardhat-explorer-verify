import { extendConfig } from "hardhat/config";

extendConfig(config => {
    // @ts-ignore
    config['oklint'] = async () => console.log('Hello, OKX!');
});
