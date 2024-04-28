import path from 'path';

import semver from 'semver';
import { subtask, types } from 'hardhat/config';
import { chainConfig } from 'config/ChainConfig';
import { NomicLabsHardhatPluginError } from 'hardhat/plugins';
import { isFullyQualifiedName, parseFullyQualifiedName } from 'hardhat/utils/contract-names';

import { getEtherscanEndpoints } from '../network/prober';
import { extractMatchingContractInformation } from '../solc/bytecode';
import { getLibraryLinks } from '../solc/libraries';
import {
    Libraries,
    GetContractInformationArgs,
    ExtendedContractInformation,
    VerifyMinimumBuildArgs,
} from '../types/type';
import { buildContractUrl } from '../util';

import {
    TASK_VERIFY_GET_COMPILER_VERSIONS,
    TASK_VERIFY_GET_CONSTRUCTOR_ARGUMENTS,
    TASK_VERIFY_GET_CONTRACT_INFORMATION,
    TASK_VERIFY_GET_ETHERSCAN_ENDPOINT,
    TASK_VERIFY_GET_LIBRARIES,
    TASK_VERIFY_GET_MINIMUM_BUILD,
    TASK_VERIFY_VERIFY,
    TASK_VERIFY_VERIFY_MINIMUM_BUILD,
    pluginName,
} from './constants';
import {
    isVersionRange,
    inferContract,
    attemptVerification,
    getMinimumBuild,
    verifySubtask,
} from './lib';

subtask(TASK_VERIFY_GET_CONSTRUCTOR_ARGUMENTS)
    .addParam('constructorArgsParams', undefined, undefined, types.any)
    .addOptionalParam('constructorArgsModule', undefined, undefined, types.inputFile)
    .setAction(
        async ({
            constructorArgsModule,
            constructorArgsParams,
        }: {
            constructorArgsModule?: string;
            constructorArgsParams: string[];
        }) => {
            if (typeof constructorArgsModule !== 'string') {
                return constructorArgsParams;
            }

            const constructorArgsModulePath = path.resolve(process.cwd(), constructorArgsModule);

            try {
                const constructorArguments = (await import(constructorArgsModulePath)).default;

                if (!Array.isArray(constructorArguments)) {
                    throw new NomicLabsHardhatPluginError(
                        pluginName,
                        `The module ${constructorArgsModulePath} doesn't export a list. The module should look like this:
  
    module.exports = [ arg1, arg2, ... ];`,
                    );
                }

                return constructorArguments;
            } catch (error: any) {
                throw new NomicLabsHardhatPluginError(
                    pluginName,
                    `Importing the module for the constructor arguments list failed.
  Reason: ${error.message}`,
                    error,
                );
            }
        },
    );

subtask(TASK_VERIFY_GET_LIBRARIES)
    .addOptionalParam('librariesModule', undefined, undefined, types.inputFile)
    .setAction(async ({ librariesModule }: { librariesModule?: string }): Promise<Libraries> => {
        if (typeof librariesModule !== 'string') {
            return {};
        }

        const librariesModulePath = path.resolve(process.cwd(), librariesModule);

        try {
            const libraries = (await import(librariesModulePath)).default;

            if (typeof libraries !== 'object' || Array.isArray(libraries)) {
                throw new NomicLabsHardhatPluginError(
                    pluginName,
                    `The module ${librariesModulePath} doesn't export a dictionary. The module should look like this:
  
    module.exports = { lib1: "0x...", lib2: "0x...", ... };`,
                );
            }

            return libraries;
        } catch (error: any) {
            throw new NomicLabsHardhatPluginError(
                pluginName,
                `Importing the module for the libraries dictionary failed.
  Reason: ${error.message}`,
                error,
            );
        }
    });

subtask(TASK_VERIFY_GET_COMPILER_VERSIONS).setAction(async (_, { config }): Promise<string[]> => {
    const compilerVersions = config.solidity.compilers.map(c => c.version);
    if (config.solidity.overrides !== undefined) {
        for (const { version } of Object.values(config.solidity.overrides)) {
            compilerVersions.push(version);
        }
    }

    // Etherscan only supports solidity versions higher than or equal to v0.4.11.
    // See https://etherscan.io/solcversions
    const supportedSolcVersionRange = '>=0.4.11';
    if (
        compilerVersions.some(version => {
            return !semver.satisfies(version, supportedSolcVersionRange);
        })
    ) {
        throw new NomicLabsHardhatPluginError(
            pluginName,
            `Etherscan only supports compiler versions 0.4.11 and higher.
  See https://etherscan.io/solcversions for more information.`,
        );
    }

    return compilerVersions;
});

subtask(TASK_VERIFY_GET_ETHERSCAN_ENDPOINT).setAction(async (_, { config, network }) =>
    getEtherscanEndpoints(
        network.provider,
        network.name,
        chainConfig,
        config.etherscan.customChains,
    ),
);

subtask(TASK_VERIFY_GET_CONTRACT_INFORMATION)
    .addParam('deployedBytecode', undefined, undefined, types.any)
    .addParam('matchingCompilerVersions', undefined, undefined, types.any)
    .addParam('libraries', undefined, undefined, types.any)
    .addOptionalParam('contractFQN', undefined, undefined, types.string)
    .setAction(
        async (
            {
                contractFQN,
                deployedBytecode,
                matchingCompilerVersions,
                libraries,
            }: GetContractInformationArgs,
            { network, artifacts },
        ): Promise<ExtendedContractInformation> => {
            let contractInformation;
            if (contractFQN !== undefined) {
                // Check this particular contract
                if (!isFullyQualifiedName(contractFQN)) {
                    throw new NomicLabsHardhatPluginError(
                        pluginName,
                        `A valid fully qualified name was expected. Fully qualified names look like this: "contracts/AContract.sol:TheContract"
  Instead, this name was received: ${contractFQN}`,
                    );
                }

                if (!(await artifacts.artifactExists(contractFQN))) {
                    throw new NomicLabsHardhatPluginError(
                        pluginName,
                        `The contract ${contractFQN} is not present in your project.`,
                    );
                }

                // Process BuildInfo here to check version and throw an error if unexpected version is found.
                const buildInfo = await artifacts.getBuildInfo(contractFQN);

                if (buildInfo === undefined) {
                    throw new NomicLabsHardhatPluginError(
                        pluginName,
                        `The contract ${contractFQN} is present in your project, but we couldn't find its sources.
  Please make sure that it has been compiled by Hardhat and that it is written in Solidity.`,
                    );
                }

                if (
                    !matchingCompilerVersions.includes(buildInfo.solcVersion) &&
                    !deployedBytecode.isOvmInferred()
                ) {
                    const inferredSolcVersion = deployedBytecode.getInferredSolcVersion();
                    let versionDetails;
                    if (isVersionRange(inferredSolcVersion)) {
                        versionDetails = `a solidity version in the range ${inferredSolcVersion}`;
                    } else {
                        versionDetails = `the solidity version ${inferredSolcVersion}`;
                    }

                    throw new NomicLabsHardhatPluginError(
                        pluginName,
                        `The contract ${contractFQN} is being compiled with ${buildInfo.solcVersion}.
  However, the contract found in the address provided as argument has its bytecode marked with ${versionDetails}.
  
  Possible causes are:
    - Solidity compiler version settings were modified after the deployment was executed.
    - The given address is wrong.
    - The selected network (${network.name}) is wrong.`,
                    );
                }

                const { sourceName, contractName } = parseFullyQualifiedName(contractFQN);
                contractInformation = await extractMatchingContractInformation(
                    sourceName,
                    contractName,
                    buildInfo,
                    deployedBytecode,
                );

                if (contractInformation === null) {
                    throw new NomicLabsHardhatPluginError(
                        pluginName,
                        `The address provided as argument contains a contract, but its bytecode doesn't match the contract ${contractFQN}.
  
  Possible causes are:
    - Contract code changed after the deployment was executed. This includes code for seemingly unrelated contracts.
    - A solidity file was added, moved, deleted or renamed after the deployment was executed. This includes files for seemingly unrelated contracts.
    - Solidity compiler settings were modified after the deployment was executed (like the optimizer, target EVM, etc.).
    - The given address is wrong.
    - The selected network (${network.name}) is wrong.`,
                    );
                }
            } else {
                // Infer the contract
                contractInformation = await inferContract(
                    artifacts,
                    network,
                    matchingCompilerVersions,
                    deployedBytecode,
                );
            }

            const { libraryLinks, undetectableLibraries } = await getLibraryLinks(
                contractInformation,
                libraries,
            );
            return {
                ...contractInformation,
                libraryLinks,
                undetectableLibraries,
            };
        },
    );

subtask(TASK_VERIFY_VERIFY_MINIMUM_BUILD)
    .addParam('minimumBuild', undefined, undefined, types.any)
    .addParam('contractInformation', undefined, undefined, types.any)
    .addParam('etherscanAPIEndpoints', undefined, undefined, types.any)
    .addParam('address', undefined, undefined, types.string)
    .addParam('etherscanAPIKey', undefined, undefined, types.string)
    .addParam('solcFullVersion', undefined, undefined, types.string)
    .addParam('deployArgumentsEncoded', undefined, undefined, types.string)
    .setAction(
        async ({
            minimumBuild,
            contractInformation,
            etherscanAPIEndpoints,
            address,
            etherscanAPIKey,
            solcFullVersion,
            deployArgumentsEncoded,
        }: VerifyMinimumBuildArgs): Promise<boolean> => {
            const minimumBuildContractBytecode =
                minimumBuild.output.contracts[contractInformation.sourceName][
                    contractInformation.contractName
                ].evm.deployedBytecode.object;

            const matchedBytecode =
                contractInformation.compilerOutput.contracts[contractInformation.sourceName][
                    contractInformation.contractName
                ].evm.deployedBytecode.object;

            if (minimumBuildContractBytecode === matchedBytecode) {
                const minimumBuildVerificationStatus = await attemptVerification(
                    etherscanAPIEndpoints,
                    contractInformation,
                    address,
                    etherscanAPIKey,
                    minimumBuild.input,
                    solcFullVersion,
                    deployArgumentsEncoded,
                );

                if (minimumBuildVerificationStatus.isVerificationSuccess()) {
                    const contractURL = buildContractUrl(etherscanAPIEndpoints.browserURL, address);
                    console.log(
                        `Successfully verified contract ${contractInformation.contractName} on Etherscan.
  ${contractURL}`,
                    );
                    return true;
                }

                console.log(
                    `We tried verifying your contract ${contractInformation.contractName} without including any unrelated one, but it failed.
  Trying again with the full solc input used to compile and deploy it.
  This means that unrelated contracts may be displayed on Etherscan...
  `,
                );
            } else {
                console.log(
                    `Compiling your contract excluding unrelated contracts did not produce identical bytecode.
  Trying again with the full solc input used to compile and deploy it.
  This means that unrelated contracts may be displayed on Etherscan...
  `,
                );
            }

            return false;
        },
    );

subtask(TASK_VERIFY_GET_MINIMUM_BUILD)
    .addParam('sourceName', undefined, undefined, types.string)
    .setAction(getMinimumBuild);

subtask(TASK_VERIFY_VERIFY)
    .addParam('address', undefined, undefined, types.string)
    .addOptionalParam('constructorArguments', undefined, [], types.any)
    .addOptionalParam('contract', undefined, undefined, types.string)
    .addOptionalParam('libraries', undefined, {}, types.any)
    .addFlag('noCompile', undefined)
    .setAction(verifySubtask);
