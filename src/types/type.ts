import { CompilationJob, CompilerInput, CompilerOutput } from 'hardhat/types';
import { Bytecode } from 'solc/bytecode';

export type ChainConfig = Record<string, EtherscanChainConfig>;

export interface CustomChain {
    network: string;
    chainId: number;
    urls: EtherscanURLs;
}

export interface EtherscanUserConfig {
    apiKey?: string | Record<string, string>;
    customChains?: CustomChain[];
}

export interface EtherscanConfig {
    apiKey?: string | Record<string, string>;
    customChains: CustomChain[];
}

export interface EtherscanURLs {
    apiURL: string;
    browserURL: string;
}

export interface EtherscanChainConfig {
    chainId: number;
    urls: EtherscanURLs;
}

export interface EtherscanNetworkEntry {
    network: string;
    urls: EtherscanURLs;
}

export interface ABIArgumentLengthError extends Error {
    code: 'INVALID_ARGUMENT';
    count: {
        types: number;
        values: number;
    };
    value: {
        types: Array<{
            name: string;
            type: string;
        }>;
        values: any[];
    };
    reason: string;
}

export interface ABIArgumentTypeError extends Error {
    code: 'INVALID_ARGUMENT';
    argument: string;
    value: any;
    reason: string;
}

export interface ABIArgumentOverflowError extends Error {
    code: 'NUMERIC_FAULT';
    fault: 'overflow';
    value: any;
    reason: string;
    operation: string;
}

export type VerifyResult = {
    SourceCode: string;
};

export interface VerifyResponse {
    status: string;
    message: string;
    result: Array<VerifyResult>;
}

export interface VerificationArgs {
    address?: string;
    // constructor args given as positional params
    constructorArgsParams: string[];
    // Filename of constructor arguments module
    constructorArgs?: string;
    // Fully qualified name of the contract
    contract?: string;
    // Filename of libraries module
    libraries?: string;

    // --list-networks flag
    listNetworks: boolean;
    // --no-compile flag
    noCompile: boolean;
}

export interface VerificationSubtaskArgs {
    address: string;
    constructorArguments: any[];
    // Fully qualified name of the contract
    contract?: string;
    libraries: Libraries;
    noCompile: boolean;
}

export interface Build {
    compilationJob: CompilationJob;
    input: CompilerInput;
    output: CompilerOutput;
    solcBuild: any;
}

export interface MinimumBuildArgs {
    sourceName: string;
}

export interface GetContractInformationArgs {
    contractFQN: string;
    deployedBytecode: Bytecode;
    matchingCompilerVersions: string[];
    libraries: Libraries;
}

export interface VerifyMinimumBuildArgs {
    minimumBuild: Build;
    contractInformation: ContractInformation;
    etherscanAPIEndpoints: EtherscanURLs;
    address: string;
    etherscanAPIKey: string;
    solcFullVersion: string;
    deployArgumentsEncoded: string;
}

export interface LibraryInformation {
    undetectableLibraries: LibraryNames;
}

export type ExtendedContractInformation = ContractInformation & LibraryInformation;

export interface BytecodeExtractedData {
    immutableValues: ImmutableValues;
    libraryLinks: ResolvedLinks;
    normalizedBytecode: string;
}

export interface ResolvedLinks {
    [sourceName: string]: {
        [libraryName: string]: string;
    };
}

export interface ImmutableValues {
    [key: string]: string;
}

export type SourceName = string;
export type ContractName = string;

// TODO: Rework this type?
// This is actually extended by the TASK_VERIFY_GET_CONTRACT_INFORMATION subtask
// to add the libraries that are not detectable to the context.
export interface ContractInformation extends BytecodeExtractedData {
    compilerInput: CompilerInput;
    compilerOutput: CompilerOutput;
    solcVersion: string;
    sourceName: SourceName;
    contractName: ContractName;
    contract: CompilerOutput['contracts'][SourceName][ContractName];
}

export interface BytecodeSlice {
    start: number;
    length: number;
}

export type NestedSliceReferences = BytecodeSlice[][];

export interface Libraries {
    // This may be a fully qualified name
    [libraryName: string]: string;
}

export type LibraryNames = Array<{
    sourceName: string;
    libName: string;
}>;

export interface LibrariesStdInput {
    [sourceName: string]: {
        [libraryName: string]: any;
    };
}
