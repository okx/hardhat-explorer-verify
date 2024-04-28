import {
    ABIArgumentLengthError,
    ABIArgumentOverflowError,
    ABIArgumentTypeError,
} from '../types/type';

export function isABIArgumentOverflowError(error: any): error is ABIArgumentOverflowError {
    return (
        error.code === 'NUMERIC_FAULT' &&
        error.fault === 'overflow' &&
        typeof error.operation === 'string' &&
        'value' in error &&
        error instanceof Error
    );
}

export function isABIArgumentTypeError(error: any): error is ABIArgumentTypeError {
    return (
        error.code === 'INVALID_ARGUMENT' &&
        typeof error.argument === 'string' &&
        'value' in error &&
        error instanceof Error
    );
}

export function isABIArgumentLengthError(error: any): error is ABIArgumentLengthError {
    return (
        error.code === 'INVALID_ARGUMENT' &&
        error.count !== undefined &&
        typeof error.count.types === 'number' &&
        typeof error.count.values === 'number' &&
        error.value !== undefined &&
        typeof error.value.types === 'object' &&
        typeof error.value.values === 'object' &&
        error instanceof Error
    );
}
