import type { SignInfo, SignatureHashAlgorithmUpperSnake } from './types.js';
import { ParsedAlgorithmIdentifier } from './pem/spki.js';
/**
 * Convert object keys to lowercase
 */
export declare function lcObjectKey<T extends Record<string, any>>(src: T): T;
/**
 * Get value from object, key is case-insensitive
 */
export declare function lcObjectGet<T extends Record<string, any>>(src: T, key: string): T[keyof T] | undefined;
/**
 *  Get the Set of keys of the object, lowercased
 */
export declare function objectLcKeys<T extends Record<string, any>>(src: T): Set<string>;
/**
 * convert number to Uint8Array, for ASN.1 length field
 */
export declare function numberToUint8Array(num: number | bigint): Uint8Array;
/**
 * Generate ASN.1 length field
 * @param length Length of the content
 * @returns ASN.1 length field
 */
export declare function genASN1Length(length: number | bigint): Uint8Array;
/**
 * ArrayBuffer to base64
 */
export declare function encodeArrayBufferToBase64(buffer: ArrayBuffer): string;
/**
 * base64 to Uint8Array
 */
export declare function decodeBase64ToUint8Array(base64: string): Uint8Array;
export declare class KeyValidationError extends Error {
    constructor(message: string);
}
export declare function genSignInfo(parsed: ParsedAlgorithmIdentifier, defaults?: {
    hash: SignatureHashAlgorithmUpperSnake;
    ec: 'DSA' | 'DH';
}): SignInfo;
export declare function splitPer64Chars(str: string): string[];
