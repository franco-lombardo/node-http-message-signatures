import { describe, expect, test } from '@jest/globals';
import httpSignature from '@peertube/http-signature';

import { genDraftSigningString, signAsDraftToRequest } from '@/draft/sign.js';
import { parseDraftRequest, parseDraftRequestSignatureHeader } from '@/draft/parse.js';
import { verifySignature } from '@/draft/verify.js';
import { parseRequest } from '@/parse.js';
import * as keys from './keys.js';
import { ClockSkewInvalidError } from '@/parse.js';

//#region data
const theDate = new Date('2024-02-28T17:44:06.000Z');

/**
 * Infiniteはエラーになるので1000年にしておく
 */
const ThousandYearsBySeconds = 60/*s*/ * 60/*m*/ * 24/*h*/ * 365/*d*/ * 1000/*y*/;

const getBasicOutgoingRequest = () => ({
	headers: {
		Date: theDate.toUTCString(),
		Host: 'example.com',
		Accept: '*/*',
	},
	method: 'GET',
	url: '/foo/bar',
});

const basicIncludeHeaders = ['(request-target)', 'host', 'date', 'accept'];
//#endregion

const errorLogger = (...e: any) => console.error(...e);

describe('draft', () => {
	describe('parse', () => {
		describe(parseDraftRequestSignatureHeader, () => {
			test('basic', () => {
				const header = 'keyId="test",algorithm="rsa-sha256",headers="(request-target) host date accept",signature="test"';
				const result = parseDraftRequestSignatureHeader(header);
				expect(result).toEqual({
					keyId: 'test',
					algorithm: 'rsa-sha256',
					headers: '(request-target) host date accept',
					signature: 'test'
				});
			});

			test('AP Like keyId', () => {
				const header = 'keyId="https://example.com/users/012345678abcdef#main-key",algorithm="rsa-sha256",headers="(request-target) host date accept",signature="test"';
				const result = parseDraftRequestSignatureHeader(header);
				expect(result).toEqual({
					keyId: 'https://example.com/users/012345678abcdef#main-key',
					algorithm: 'rsa-sha256',
					headers: '(request-target) host date accept',
					signature: 'test'
				});
			});
		});

		describe(parseDraftRequest, () => {
			test('basic sha256', () => {
				const request = {
					headers: {
						signature: 'keyId="test",algorithm="rsa-sha256",headers="(request-target) host date accept",signature="test"',
						date: theDate.toUTCString(),
						host: 'example.com',
						accept: '*/*',
					},
					method: 'GET',
					url: '/foo/bar',
				};
				const result = parseDraftRequest(request, { clockSkew: { now: theDate } });
				expect(result).toEqual({
					version: 'draft',
					value: {
						scheme: 'Signature',
						params: {
							keyId: 'test',
							algorithm: 'rsa-sha256',
							headers: ['(request-target)', 'host', 'date', 'accept'],
							signature: 'test'
						},
						keyId: 'test',
						algorithm: 'RSA-SHA256',
						signingString: `(request-target): get /foo/bar\nhost: example.com\ndate: ${theDate.toUTCString()}\naccept: */*`,
					},
				});
			});
		});
	});

	describe('sign', () => {
		describe(genDraftSigningString, () => {
			test('normal', () => {
				const request = getBasicOutgoingRequest();
				const result = genDraftSigningString(request, basicIncludeHeaders);
				expect(result).toBe('(request-target): get /foo/bar\nhost: example.com\ndate: Wed, 28 Feb 2024 17:44:06 GMT\naccept: */*');
			});
		});
	});

	describe('inegrated', () => {
		describe('rsa-sha256', () => {
			const request = getBasicOutgoingRequest();
			const key = {
				privateKeyPem: keys.rsa4096.privateKey,
				keyId: 'https://example.com/users/012345678abcdef#main-key',
			};
			test('sign', () => {
				signAsDraftToRequest(request, key, basicIncludeHeaders, { hashAlgorithm: 'sha256' });
				expect((request.headers as any)['Signature']).toBe('keyId="https://example.com/users/012345678abcdef#main-key",algorithm="rsa-sha256",headers="(request-target) host date accept",signature="ocCFDJtL100/4ug4nkfTVy17rV/H4gXKwrN9o82g89zEt2012ueg4RYlWwtF1waiRhEGXNXoiIbAsO2k0hFlD8/Vhm6BeRlqpgKzs0bd3XFKTRVIUACyg7efblKJ6o8DU+gdu6SlRx9V08n8i2ZEoLim2N0iMbjmDME9oh8rY8bM8uH3RnRIxpLwCmSLDSaPAop0rPQryZQQwoFhsTPvS9JhiyHmSqU1FiIX3Sz4ExcHFyO9MK/kvFmwMLQDJ3Z64npGACo155vBUahUH0RFe1mwRgHBZPyg3PJHomQXaGxc3Jb3PJL1zMQDAofw/hSB0YlN1WM5EApSUfJieOqdbbDeEf5qfpm3Vza3DVRpvQtSeok+X0TOBh6cPCfYmW7gIxKondxmwdP9d5g3pHXQuASE/bOmogh00+zFJGy7AS35j95rgzEUfjzuWOQDUs5pRnuAUDMQ2Q3+woWJGgp4C1YPdO8dL9pR2sBusZYeeIQieQRJIJib1wiXLyL8qgO3ukrECH8FPON6DKmlA3CcyQfUpFw4pVZUArukUKVGt3g4rH6BDJTVHdbeCvKyxG30tzI4jfbuMpj7Ekrj16gHjKwyhhH5vqcJ19ibeg2SoARmipUfRt+ufZGn3tZX3efaBEaTbOAkFGgG0voJjo1Q3+7EFwreHv2ABKXOJiSAIow="');
			});
			test('verify by itself', () => {
				const parsed = parseRequest(request, { clockSkew: { now: theDate } });
				const verifyResult = verifySignature(parsed.value, keys.rsa4096.publicKey, errorLogger);
				expect(verifyResult).toBe(true);
			});
			test('verify by http-signature', () => {
				const parsed = httpSignature.parseRequest(request, { clockSkew: ThousandYearsBySeconds });
				const verifyResult = httpSignature.verifySignature(parsed, keys.rsa4096.publicKey, errorLogger);
				expect(verifyResult).toBe(true);
			});
			test('verify by itself (failed)', () => {
				(request.headers as any)['signature'] = 'keyId="https://example.com/users/012345678abcdef#main-key",algorithm="rsa-sha256",headers="(request-target) host date accept",signature="aaaaaaaa"';
				const parsed = parseRequest(request, { clockSkew: { now: theDate } });
				const verifyResult = verifySignature(parsed.value, keys.rsa4096.publicKey, errorLogger);
				expect(verifyResult).toBe(false);
			});
			test('verify by http-signature (failed)', () => {
				(request.headers as any)['signature'] = 'keyId="https://example.com/users/012345678abcdef#main-key",algorithm="rsa-sha256",headers="(request-target) host date accept",signature="aaaaaaaa"';
				const parsed = httpSignature.parseRequest(request, { clockSkew: ThousandYearsBySeconds });
				const verifyResult = httpSignature.verifySignature(parsed, keys.rsa4096.publicKey, errorLogger);
				expect(verifyResult).toBe(false);
			});
		});

		describe('ed25519', () => {
			const request = getBasicOutgoingRequest();
			const key = {
				privateKeyPem: keys.ed25519.privateKey,
				keyId: 'https://example.com/users/012345678abcdef#ed25519-key',
			};
			test('sign', () => {
				signAsDraftToRequest(request, key, basicIncludeHeaders, { hashAlgorithm: null });
				expect((request.headers as any)['Signature']).toBe('keyId="https://example.com/users/012345678abcdef#ed25519-key",algorithm="ed25519-sha512",headers="(request-target) host date accept",signature="nFz8cgJ+p8ImwCokRbfcQj34d1GZn9uw1l+Fu+NvAn268kEvjMMgljtS/SZlnyY3dW0RaXf9Lmz0UVAA0bZXDQ=="');
			});
			test('verify by itself', () => {
				const parsed = parseRequest(request, { clockSkew: { now: theDate } });
				const verifyResult = verifySignature(parsed.value, keys.ed25519.publicKey, errorLogger);
				expect(verifyResult).toBe(true);
			});
			test('verify by http-signature', () => {
				const parsed = httpSignature.parseRequest(request, { clockSkew: ThousandYearsBySeconds });
				const verifyResult = httpSignature.verifySignature(parsed, keys.ed25519.publicKey, errorLogger);
				expect(verifyResult).toBe(true);
			});
			test('verify by itself (failed)', () => {
				(request.headers as any)['signature'] = `keyId="https://example.com/users/012345678abcdef#ed25519-key",algorithm="ed25519-sha512",headers="(request-target) host date accept",signature="${Array.from({ length: 86 }, () => 'A').join('')}=="`;
				// Check clock skew error
				expect(() => parseRequest(request)).toThrow(ClockSkewInvalidError);
				const parsed = parseRequest(request, { clockSkew: { now: theDate } });
				const verifyResult = verifySignature(parsed.value, keys.ed25519.publicKey, errorLogger);
				expect(verifyResult).toBe(false);
			});
			test('verify by http-signature (failed)', () => {
				// tweetnaclがバイト数でエラーを吐くため、signatureの長さをちゃんとしたものにしておく
				(request.headers as any)['signature'] = `keyId="https://example.com/users/012345678abcdef#ed25519-key",algorithm="ed25519-sha512",headers="(request-target) host date accept",signature="${Array.from({ length: 86 }, () => 'A').join('')}=="`;
				const parsed = httpSignature.parseRequest(request, { clockSkew: ThousandYearsBySeconds });
				const verifyResult = httpSignature.verifySignature(parsed, keys.ed25519.publicKey, errorLogger);
				expect(verifyResult).toBe(false);
			});
		});
	});
});
