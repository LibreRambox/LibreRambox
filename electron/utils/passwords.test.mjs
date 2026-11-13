import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './passwords.js';

describe('password migration', () => {
	it('creates and verifies an Argon2id hash', () => {
		const stored = hashPassword('correct horse battery staple');
		expect(stored).toMatch(/^\$argon2id\$v=19\$m=32768,t=6,p=4\$/);
		expect(verifyPassword(stored, 'correct horse battery staple')).toEqual({ matches: true, migratedHash: null });
		expect(verifyPassword(stored, 'wrong password').matches).toBe(false);
	});

	it('migrates an old ASCII MD5 hash', () => {
		const legacy = createHash('md5').update('old password', 'utf8').digest('hex');
		const result = verifyPassword(legacy, 'old password');
		expect(result.matches).toBe(true);
		expect(result.migratedHash).toMatch(/^\$argon2id\$v=19\$m=32768,t=6,p=4\$/);
		expect(verifyPassword(result.migratedHash, 'old password').matches).toBe(true);
	});

	it('keeps compatibility with the old low-byte Unicode behavior', () => {
		const legacy = createHash('md5').update(Buffer.from([0x61])).digest('hex');
		expect(verifyPassword(legacy, '\u0161').matches).toBe(true);
	});
});
