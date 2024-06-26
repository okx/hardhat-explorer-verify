import { NomicLabsHardhatPluginError } from 'hardhat/plugins';

import { pluginName } from '../task/constants';

import {
    isABIArgumentLengthError,
    isABIArgumentOverflowError,
    isABIArgumentTypeError,
} from './ABITypes';

export async function encodeArguments(
    abi: any,
    sourceName: string,
    contractName: string,
    constructorArguments: any[],
) {
    const { Interface } = await import('@ethersproject/abi');

    const contractInterface = new Interface(abi);
    let deployArgumentsEncoded;
    try {
        // TODO: need to check
        const constructorArgType = contractInterface.deploy.inputs?.map(ci => ci?.type);
        constructorArguments?.forEach((item, index) => {
            if (typeof item !== constructorArgType[index] && constructorArgType[index] === 'string') throw new NomicLabsHardhatPluginError(pluginName, `Invalid type for argument ${item}`);
        })

        deployArgumentsEncoded = contractInterface
            .encodeDeploy(constructorArguments)
            .replace('0x', '');
    } catch (error) {
        if (isABIArgumentLengthError(error)) {
            // TODO: add a list of types and constructor arguments to the error message?
            const message = `The constructor for ${sourceName}:${contractName} has ${error.count.types} parameters
but ${error.count.values} arguments were provided instead.`;
            throw new NomicLabsHardhatPluginError(pluginName, message, error);
        }
        if (isABIArgumentTypeError(error)) {
            const message = `Value ${error.value} cannot be encoded for the parameter ${error.argument}.
Encoder error reason: ${error.reason}`;
            throw new NomicLabsHardhatPluginError(pluginName, message, error);
        }
        if (isABIArgumentOverflowError(error)) {
            const message = `Value ${error.value} is not a safe integer and cannot be encoded.
Use a string instead of a plain number.
Encoder error reason: ${error.fault} fault in ${error.operation}`;
            throw new NomicLabsHardhatPluginError(pluginName, message, error);
        }
        // Should be unreachable.
        throw error;
    }

    return deployArgumentsEncoded;
}
