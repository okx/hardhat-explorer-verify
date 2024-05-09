import { EthereumProvider } from "hardhat/types";

import { getEtherscanEndpoints } from '../network/prober';
import { chainConfig } from '../config/ChainConfig';
import { ApiKey, CustomChain } from "../types/type";
import { getVerificationStatus, verifyContract } from '../etherscan/EtherscanService';
import { throwMissingApiKeyError } from '../resolveEtherscanApiKey';

/**
 * Etherscan verification provider for verifying smart contracts.
 * It should work with other verification providers as long as the interface
 * is compatible with Etherscan's.
 */
export class Etherscan {
    /**
     * Create a new instance of the Etherscan verification provider.
     * @param apiKey - The Etherscan API key.
     * @param apiUrl - The Etherscan API URL, e.g. https://api.etherscan.io/api.
     * @param browserUrl - The Etherscan browser URL, e.g. https://etherscan.io.
     */
    constructor(
        public apiKey: string,
        public apiUrl: string,
        public browserUrl: string
    ) { }

    public static async getCurrentChainConfig(
        networkName: string,
        ethereumProvider: EthereumProvider,
        customChains: CustomChain[]
    ) {
        return await getEtherscanEndpoints(ethereumProvider, networkName, chainConfig, customChains)
    }

    public static fromChainConfig(
        apiKey: ApiKey | undefined,
        chainConfig: CustomChain
    ) {
        const resolvedApiKey = resolveApiKey(apiKey, chainConfig.network);
        const apiUrl = chainConfig.urls.apiURL;
        const browserUrl = chainConfig.urls.browserURL.trim().replace(/\/$/, "");

        return new Etherscan(resolvedApiKey, apiUrl, browserUrl);
    }

    /**
     * Check if a smart contract is verified
     * @link https://docs.etherscan.io/api-endpoints/contracts#get-contract-source-code-for-verified-contract-source-codes
     * @param address - The address of the smart contract.
     * @returns True if the contract is verified, false otherwise.
     */
    public async isVerified(address: string) {
        return await getVerificationStatus(this.apiUrl, {
            apikey: this.apiKey,
            module: "contract",
            action: "getsourcecode",
            address,
        });
    }

    /**
     * Verify a smart contract
     * @link https://docs.etherscan.io/api-endpoints/contracts#verify-source-code
     * @param contractAddress - The address of the smart contract to verify.
     * @param sourceCode - The source code of the smart contract.
     * @param contractName - The name of the smart contract, e.g. "contracts/Sample.sol:MyContract"
     * @param compilerVersion - The version of the Solidity compiler used, e.g. `v0.8.19+commit.7dd6d404`
     * @param constructorArguments - The encoded constructor arguments of the smart contract.
     * @returns A promise that resolves to an `EtherscanResponse` object.
     * @throws {ContractVerificationRequestError} if there is an error on the request.
     * @throws {ContractVerificationInvalidStatusCodeError} if the API returns an invalid status code.
     * @throws {ContractVerificationMissingBytecodeError} if the bytecode is not found on the block explorer.
     * @throws {HardhatVerifyError} if the response status is not OK.
     */
    public async verify(
        contractAddress: string,
        sourceCode: string,
        contractName: string,
        compilerVersion: string,
        constructorArguments: string
    ) {
        return await verifyContract(this.apiUrl, {
            apikey: this.apiKey,
            module: "contract",
            action: "verifysourcecode",
            contractaddress: contractAddress,
            sourceCode,
            codeformat: "solidity-standard-json-input",
            contractname: contractName,
            compilerversion: compilerVersion,
            constructorArguements: constructorArguments,
        });
    }

    /**
     * Get the verification status of a smart contract from Etherscan.
     * This method performs polling of the verification status if it's pending.
     * @link https://docs.etherscan.io/api-endpoints/contracts#check-source-code-verification-submission-status
     * @param guid - The verification GUID to check.
     * @returns A promise that resolves to an `EtherscanResponse` object.
     * @throws {ContractStatusPollingError} if there is an error on the request.
     * @throws {ContractStatusPollingInvalidStatusCodeError} if the API returns an invalid status code.
     * @throws {ContractStatusPollingResponseNotOkError} if the response status is not OK.
     */
    public async getVerificationStatus(guid: string) {
        return await getVerificationStatus(this.apiUrl, {
            apikey: this.apiKey,
            module: "contract",
            action: "checkverifystatus",
            guid,
        });
    }

    /**
     * Get the Etherscan URL for viewing a contract's details.
     * @param address - The address of the smart contract.
     * @returns The URL to view the contract website.
     */
    public getContractUrl(address: string) {
        return `${this.browserUrl}/address/${address}#code`;
    }
}

export function resolveApiKey(apiKey: ApiKey | undefined, network: string) {
    if (apiKey === undefined || apiKey === "") {
        throwMissingApiKeyError(network);
    }

    if (typeof apiKey === "string") {
        return apiKey;
    }

    const key = apiKey[network];

    if (key === undefined || key === "") {
        throwMissingApiKeyError(network);
    }

    return key;
}
