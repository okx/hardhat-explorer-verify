import semver from 'semver';
import {
    TASK_COMPILE,
    TASK_COMPILE_SOLIDITY_COMPILE_JOB,
    TASK_COMPILE_SOLIDITY_GET_COMPILATION_JOB_FOR_FILE,
    TASK_COMPILE_SOLIDITY_GET_DEPENDENCY_GRAPH,
} from 'hardhat/builtin-tasks/task-names';
import chalk from 'chalk';
import { NomicLabsHardhatPluginError } from 'hardhat/plugins';
import {
    CompilerInput,
    ActionType,
    DependencyGraph,
    CompilationJob,
    Artifacts,
    Network,
} from 'hardhat/types';

import { resolveEtherscanApiKey } from '../resolveEtherscanApiKey';
import { retrieveContractBytecode } from '../network/prober';
import { verifyAllowedChains } from '../config/config';
import { encodeArguments } from '../abi/ABIEncoder';
import { toVerifyRequest, toCheckStatusRequest } from '../etherscan/EtherscanVerifyContractRequest';
import {
    verifyContract,
    getVerificationStatus,
    isAlreadyVerified,
    delay,
} from '../etherscan/EtherscanService';
import { lookupMatchingBytecode, Bytecode } from '../solc/bytecode';
import {
    METADATA_ABSENT_VERSION_RANGE,
    METADATA_PRESENT_SOLC_NOT_FOUND_VERSION_RANGE,
} from '../solc/metadata';
import { getLongVersion } from '../solc/version';
import { printSupportedNetworks, buildContractUrl } from '../util';
import {
    EtherscanURLs,
    ContractInformation,
    MinimumBuildArgs,
    Build,
    VerificationArgs,
    Libraries,
    VerificationSubtaskArgs,
    EtherscanNetworkEntry,
    ExtendedContractInformation,
} from '../types/type';

import {
    pluginName,
    TASK_VERIFY_VERIFY,
    TASK_VERIFY_GET_CONSTRUCTOR_ARGUMENTS,
    TASK_VERIFY_GET_LIBRARIES,
    TASK_VERIFY_GET_COMPILER_VERSIONS,
    TASK_VERIFY_GET_ETHERSCAN_ENDPOINT,
    TASK_VERIFY_GET_CONTRACT_INFORMATION,
    TASK_VERIFY_GET_MINIMUM_BUILD,
    TASK_VERIFY_VERIFY_MINIMUM_BUILD,
    TASK_VERIFY_PROXY,
} from './constants';

export function assertHardhatPluginInvariant(
    invariant: boolean,
    message: string,
): asserts invariant {
    if (!invariant) {
        throw new NomicLabsHardhatPluginError(pluginName, message, undefined, true);
    }
}

export function isVersionRange(version: string): boolean {
    return (
        version === METADATA_ABSENT_VERSION_RANGE ||
        version === METADATA_PRESENT_SOLC_NOT_FOUND_VERSION_RANGE
    );
}

export async function attemptVerification(
    etherscanAPIEndpoints: EtherscanURLs,
    contractInformation: ContractInformation,
    contractAddress: string,
    etherscanAPIKey: string,
    compilerInput: CompilerInput,
    solcFullVersion: string,
    deployArgumentsEncoded: string,
) {
    // Ensure the linking information is present in the compiler input;
    compilerInput.settings.libraries = contractInformation.libraryLinks;
    const request = toVerifyRequest({
        apiKey: etherscanAPIKey,
        contractAddress,
        sourceCode: JSON.stringify(compilerInput),
        sourceName: contractInformation.sourceName,
        contractName: contractInformation.contractName,
        compilerVersion: solcFullVersion,
        constructorArguments: deployArgumentsEncoded,
    });

    const response = await verifyContract(etherscanAPIEndpoints.apiURL, request);

    console.log(
        `Successfully submitted source code for contract
  ${contractInformation.sourceName}:${contractInformation.contractName} at ${contractAddress}
  for verification on the block explorer. Waiting for verification result...
  `,
    );

    const pollRequest = toCheckStatusRequest({
        apiKey: etherscanAPIKey,
        guid: response.message,
    });

    // Compilation is bound to take some time so there's no sense in requesting status immediately.
    await delay(700);
    const verificationStatus = await getVerificationStatus(
        etherscanAPIEndpoints.apiURL,
        pollRequest,
    );

    if (verificationStatus.isVerificationFailure() || verificationStatus.isVerificationSuccess()) {
        return verificationStatus;
    }

    // Reaching this point shouldn't be possible unless the API is behaving in a new way.
    throw new NomicLabsHardhatPluginError(
        pluginName,
        `The API responded with an unexpected message.
  Contract verification may have succeeded and should be checked manually.
  Message: ${verificationStatus.message}`,
        undefined,
        true,
    );
}

export const getMinimumBuild: ActionType<MinimumBuildArgs> = async function (
    { sourceName },
    { run },
): Promise<Build> {
    const dependencyGraph: DependencyGraph = await run(TASK_COMPILE_SOLIDITY_GET_DEPENDENCY_GRAPH, {
        sourceNames: [sourceName],
    });

    const resolvedFiles = dependencyGraph.getResolvedFiles().filter(resolvedFile => {
        return resolvedFile.sourceName === sourceName;
    });
    assertHardhatPluginInvariant(
        resolvedFiles.length === 1,
        `The plugin found an unexpected number of files for this contract.`,
    );

    const compilationJob: CompilationJob = await run(
        TASK_COMPILE_SOLIDITY_GET_COMPILATION_JOB_FOR_FILE,
        {
            dependencyGraph,
            file: resolvedFiles[0],
        },
    );

    const build: Build = await run(TASK_COMPILE_SOLIDITY_COMPILE_JOB, {
        compilationJob,
        compilationJobs: [compilationJob],
        compilationJobIndex: 0,
        emitsArtifacts: false,
        quiet: true,
    });

    return build;
};

export async function inferContract(
    artifacts: Artifacts,
    network: Network,
    matchingCompilerVersions: string[],
    deployedBytecode: Bytecode,
) {
    const contractMatches = await lookupMatchingBytecode(
        artifacts,
        matchingCompilerVersions,
        deployedBytecode,
    );
    if (contractMatches.length === 0) {
        const message = `The address provided as argument contains a contract, but its bytecode doesn't match any of your local contracts.
  
  Possible causes are:
    - Contract code changed after the deployment was executed. This includes code for seemingly unrelated contracts.
    - A solidity file was added, moved, deleted or renamed after the deployment was executed. This includes files for seemingly unrelated contracts.
    - Solidity compiler settings were modified after the deployment was executed (like the optimizer, target EVM, etc.).
    - The given address is wrong.
    - The selected network (${network.name}) is wrong.`;
        throw new NomicLabsHardhatPluginError(pluginName, message);
    }
    if (contractMatches.length > 1) {
        const nameList = contractMatches
            .map(contract => {
                return `${contract.sourceName}:${contract.contractName}`;
            })
            .map(fqName => `  * ${fqName}`)
            .join('\n');
        const message = `More than one contract was found to match the deployed bytecode.
  Please use the contract parameter with one of the following contracts:
  ${nameList}
  
  For example:
  
    hardhat verify --contract contracts/Example.sol:ExampleContract <other args>
  
  If you are running the verify subtask from within Hardhat instead:
  
    await run("${TASK_VERIFY_VERIFY}", {
      <other args>,
      contract: "contracts/Example.sol:ExampleContract"
    };`;
        throw new NomicLabsHardhatPluginError(pluginName, message, undefined, true);
    }
    return contractMatches[0];
}

export const verify: ActionType<VerificationArgs> = async (
    args,
    env,
) => {
    const {
        address,
        constructorArgsParams,
        constructorArgs: constructorArgsModule,
        contract,
        libraries: librariesModule,
        listNetworks,
        noCompile,
        proxy
    } = args;
    const { config, run } = env;

    if (proxy) {
        await run(TASK_VERIFY_PROXY, args);
        return;
    }

    if (listNetworks) {
        await printSupportedNetworks(config.etherscan.customChains);
        return;
    }

    if (address === undefined) {
        throw new NomicLabsHardhatPluginError(
            pluginName,
            "You didn’t provide any address. Please re-run the 'verify' task with the address of the contract you want to verify.",
        );
    }

    let serviceUsed = 'Etherscan';

    if (config.okxweb3explorer && config.okxweb3explorer.apiKey) {
        config.etherscan = {
            ...config.etherscan,
            ...config.okxweb3explorer,
        };
        serviceUsed = 'Okxweb3explorer';
    }

    console.log(
        chalk.green(`Using ${serviceUsed === 'Etherscan' ? chalk.bold.bgRed(serviceUsed) : chalk.bold.bgBlue(serviceUsed)} for contract verification.`),
    );

    // TODO: change to our plugin doc.
    console.log(
        chalk.bold(
            chalk.green(
                'Plugin documentation can be found at: https://hardhat.org/plugins/nomiclabs-hardhat-etherscan',
            ),
        ),
    );

    verifyAllowedChains(config.etherscan);

    const constructorArguments: any[] = await run(TASK_VERIFY_GET_CONSTRUCTOR_ARGUMENTS, {
        constructorArgsModule,
        constructorArgsParams,
    });

    const libraries: Libraries = await run(TASK_VERIFY_GET_LIBRARIES, {
        librariesModule,
    });

    return run(TASK_VERIFY_VERIFY, {
        address,
        constructorArguments,
        contract,
        libraries,
        noCompile,
    });
};

export const verifySubtask: ActionType<VerificationSubtaskArgs> = async (
    { address, constructorArguments, contract: contractFQN, libraries, noCompile },
    { config, network, run },
) => {
    const { etherscan, okxweb3explorer } = config;
    let serviceUsed = 'Etherscan';
    if (okxweb3explorer && okxweb3explorer.apiKey) {
        config.etherscan = {
            ...config.etherscan,
            ...okxweb3explorer,
        };

        serviceUsed = 'Okxweb3explorer';
    }

    console.log(
        chalk.green(`Using ${serviceUsed === 'Etherscan' ? chalk.bold.bgRed(serviceUsed) : chalk.bold.bgBlue(serviceUsed)} for contract verification.`),
    );

    const { isAddress } = await import('@ethersproject/address');
    if (!isAddress(address)) {
        throw new NomicLabsHardhatPluginError(pluginName, `${address} is an invalid address.`);
    }

    // This can only happen if the subtask is invoked from within Hardhat by a user script or another task.
    if (!Array.isArray(constructorArguments)) {
        throw new NomicLabsHardhatPluginError(
            pluginName,
            `The constructorArguments parameter should be an array.
  If your constructor has no arguments pass an empty array. E.g:
  
    await run("${TASK_VERIFY_VERIFY}", {
      <other args>,
      constructorArguments: []
    };`,
        );
    }

    const compilerVersions: string[] = await run(TASK_VERIFY_GET_COMPILER_VERSIONS);

    const { network: verificationNetwork, urls: etherscanAPIEndpoints }: EtherscanNetworkEntry =
        await run(TASK_VERIFY_GET_ETHERSCAN_ENDPOINT);

    const etherscanAPIKey = resolveEtherscanApiKey(etherscan.apiKey, verificationNetwork);

    const alreadyVerified = await isAlreadyVerified(
        etherscanAPIEndpoints.apiURL,
        etherscanAPIKey,
        address,
    );

    if (alreadyVerified) {
        console.log(
            chalk.green(`The contract ${address} has already been verified`),
        )
        return;
    }

    const deployedBytecodeHex = await retrieveContractBytecode(
        address,
        network.provider,
        network.name,
    );

    const deployedBytecode = new Bytecode(deployedBytecodeHex);
    const inferredSolcVersion = deployedBytecode.getInferredSolcVersion();

    const matchingCompilerVersions = compilerVersions.filter(version => {
        return semver.satisfies(version, inferredSolcVersion);
    });
    if (
        matchingCompilerVersions.length === 0 &&
        // don't error if the bytecode appears to be OVM bytecode, because we can't infer a specific OVM solc version from the bytecode
        !deployedBytecode.isOvmInferred()
    ) {
        let configuredCompilersFragment;
        if (compilerVersions.length > 1) {
            configuredCompilersFragment = `your configured compiler versions are: ${compilerVersions.join(
                ', ',
            )}`;
        } else {
            configuredCompilersFragment = `your configured compiler version is: ${compilerVersions[0]}`;
        }
        const message = `The contract you want to verify was compiled with solidity ${inferredSolcVersion}, but ${configuredCompilersFragment}.
  
  Possible causes are:
    - You are not in the same commit that was used to deploy the contract.
    - Wrong compiler version selected in hardhat config.
    - The given address is wrong.
    - The selected network (${network.name}) is wrong.`;
        throw new NomicLabsHardhatPluginError(pluginName, message);
    }

    // Make sure that contract artifacts are up-to-date.
    if (!noCompile) {
        await run(TASK_COMPILE);
    }

    const contractInformation: ExtendedContractInformation = await run(
        TASK_VERIFY_GET_CONTRACT_INFORMATION,
        {
            contractFQN,
            deployedBytecode,
            matchingCompilerVersions,
            libraries,
        },
    );

    // Override solc version based on hardhat config if verifying for the OVM. This is used instead of fetching the
    // full version name from a solc bin JSON file (as is done for EVM solc in src/solc/version.ts) because it's
    // simpler and avoids a network request we don't need. This is ok because the solc version specified in the OVM
    // config always equals the full solc version
    if (deployedBytecode.isOvmInferred()) {
        // We cast to this custom type here instead of using `extendConfig` to avoid always mutating the HardhatConfig
        // type. We don't want that type to always contain the `ovm` field, because users only using hardhat-etherscan
        // without the Optimism plugin should not have that field in their type definitions
        const configCopy = { ...config } as unknown as {
            ovm?: { solcVersion?: string };
        };
        const ovmSolcVersion = configCopy.ovm?.solcVersion;
        if (ovmSolcVersion === undefined) {
            const message = `It looks like you are verifying an OVM contract, but do not have an OVM solcVersion specified in the hardhat config.`;
            throw new NomicLabsHardhatPluginError(pluginName, message);
        }
        contractInformation.solcVersion = `v${ovmSolcVersion}`; // Etherscan requires the leading `v` before the version string
    }

    const deployArgumentsEncoded = await encodeArguments(
        contractInformation.contract.abi,
        contractInformation.sourceName,
        contractInformation.contractName,
        constructorArguments,
    );

    // If OVM, the full version string was already read from the hardhat config. If solc, get the full version string
    const solcFullVersion = deployedBytecode.isOvmInferred()
        ? contractInformation.solcVersion
        : await getLongVersion(contractInformation.solcVersion);

    const minimumBuild: Build = await run(TASK_VERIFY_GET_MINIMUM_BUILD, {
        sourceName: contractInformation.sourceName,
    });

    const success: boolean = await run(TASK_VERIFY_VERIFY_MINIMUM_BUILD, {
        minimumBuild,
        contractInformation,
        etherscanAPIEndpoints,
        address,
        etherscanAPIKey,
        solcFullVersion,
        deployArgumentsEncoded,
    });

    if (success) {
        return;
    }

    // Fallback verification
    const verificationStatus = await attemptVerification(
        etherscanAPIEndpoints,
        contractInformation,
        address,
        etherscanAPIKey,
        contractInformation.compilerInput,
        solcFullVersion,
        deployArgumentsEncoded,
    );

    if (verificationStatus.isVerificationSuccess()) {
        const contractURL = buildContractUrl(etherscanAPIEndpoints.browserURL, address);

        console.log(
            `Successfully verified full build of contract ${contractInformation.contractName}.
  ${contractURL}`,
        );
        return;
    }

    let errorMessage = `The contract verification failed.
  Reason: ${verificationStatus.message}`;
    if (contractInformation.undetectableLibraries.length > 0) {
        const undetectableLibraryNames = contractInformation.undetectableLibraries
            .map(({ sourceName, libName }) => `${sourceName}:${libName}`)
            .map(x => `  * ${x}`)
            .join('\n');
        errorMessage += `
  This contract makes use of libraries whose addresses are undetectable by the plugin.
  Keep in mind that this verification failure may be due to passing in the wrong
  address for one of these libraries:
  ${undetectableLibraryNames}`;
    }
    throw new NomicLabsHardhatPluginError(pluginName, errorMessage);
};
