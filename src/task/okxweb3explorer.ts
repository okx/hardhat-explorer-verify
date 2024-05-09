import { task, types } from 'hardhat/config';

import { TASK_VERIFY } from './constants';
import { verify } from './lib';
import './subtask';

task(TASK_VERIFY, 'Verifies contract')
    .addOptionalPositionalParam('address', 'Address of the smart contract to verify')
    .addOptionalParam(
        'constructorArgs',
        'File path to a javascript module that exports the list of arguments.',
        undefined,
        types.inputFile,
    )
    .addOptionalParam(
        'contract',
        'Fully qualified name of the contract to verify. ' +
        'Skips automatic detection of the contract. ' +
        'Use if the deployed bytecode matches more than one contract in your project.',
    )
    .addOptionalParam(
        'libraries',
        'File path to a javascript module that exports the dictionary of library addresses for your contract. ' +
        'Use if there are undetectable library addresses in your contract. ' +
        'Library addresses are undetectable if they are only used in the constructor for your contract.',
        undefined,
        types.inputFile,
    )
    .addOptionalVariadicPositionalParam(
        'constructorArgsParams',
        'Contract constructor arguments. Ignored if the --constructor-args option is used.',
        [],
    )
    .addFlag('proxy', "Verify Proxy Contract or not")
    .addFlag('listNetworks', 'Print the list of supported networks')
    .addFlag('noCompile', "Don't compile before running this task")
    .setAction(verify);
