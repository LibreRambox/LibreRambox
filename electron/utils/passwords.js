'use strict';

const {
	argon2Sync,
	createHash,
	randomBytes,
	timingSafeEqual,
} = require('node:crypto');

// Argon2's memory parameter is expressed in KiB. Keep the format explicit so
// future parameter changes can be migrated without guessing from the digest.
const ARGON2_MEMORY_KIB = 32 * 1024;
const ARGON2_PASSES = 6;
const ARGON2_PARALLELISM = 4;
const ARGON2_TAG_LENGTH = 32;
const ARGON2_SALT_LENGTH = 16;
const ARGON2_PREFIX = `$argon2id$v=19$m=${ARGON2_MEMORY_KIB},t=${ARGON2_PASSES},p=${ARGON2_PARALLELISM}$`;

function requirePassword(password) {
	if ( typeof password !== 'string' ) throw new TypeError('Password must be a string');
}

function requireArgon2() {
	if ( typeof argon2Sync !== 'function' ) {
		throw new Error('Argon2id requires Node.js 24.7 or newer');
	}
}

function legacyMd5(password, encoding = 'legacy') {
	requirePassword(password);
	if ( encoding === 'utf8' ) return createHash('md5').update(password, 'utf8').digest('hex');

	// The former renderer implementation hashed one low byte per UTF-16 code
	// unit. Preserve that exact behavior only for migration of old values.
	const bytes = Buffer.alloc(password.length);
	for ( let i = 0; i < password.length; i++ ) bytes[i] = password.charCodeAt(i) & 0xff;
	return createHash('md5').update(bytes).digest('hex');
}

function safeEqualHex(left, right) {
	if ( !/^[a-f0-9]+$/i.test(left) || !/^[a-f0-9]+$/i.test(right) || left.length !== right.length ) return false;
	const leftBuffer = Buffer.from(left, 'hex');
	const rightBuffer = Buffer.from(right, 'hex');
	return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function derive(password, salt, memory, passes, parallelism) {
	requireArgon2();
	return argon2Sync('argon2id', {
		message: password,
		nonce: salt,
		memory,
		passes,
		parallelism,
		tagLength: ARGON2_TAG_LENGTH,
	});
}

function hashPassword(password) {
	requirePassword(password);
	const salt = randomBytes(ARGON2_SALT_LENGTH);
	const digest = derive(password, salt, ARGON2_MEMORY_KIB, ARGON2_PASSES, ARGON2_PARALLELISM);
	return `${ARGON2_PREFIX}${salt.toString('hex')}$${digest.toString('hex')}`;
}

function parseArgon2Hash(stored) {
	const match = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([a-f0-9]+)\$([a-f0-9]+)$/i.exec(stored);
	if ( !match ) return null;
	const memory = Number(match[1]);
	const passes = Number(match[2]);
	const parallelism = Number(match[3]);
	const salt = Buffer.from(match[4], 'hex');
	const digest = Buffer.from(match[5], 'hex');

	// Stored parameters are not trusted input. Only the configured profile is
	// accepted, preventing a tampered config from forcing an expensive KDF run.
	if (
		memory !== ARGON2_MEMORY_KIB ||
		passes !== ARGON2_PASSES ||
		parallelism !== ARGON2_PARALLELISM ||
		salt.length !== ARGON2_SALT_LENGTH ||
		digest.length !== ARGON2_TAG_LENGTH
	) return null;

	return { salt, digest };
}

function verifyPassword(stored, password) {
	if ( typeof stored !== 'string' || typeof password !== 'string' ) return { matches: false, migratedHash: null };

	const parsed = parseArgon2Hash(stored);
	if ( parsed ) {
		const digest = derive(password, parsed.salt, ARGON2_MEMORY_KIB, ARGON2_PASSES, ARGON2_PARALLELISM);
		return {
			matches: timingSafeEqual(digest, parsed.digest),
			migratedHash: null,
		};
	}

	// Existing master-password hashes were produced by both the old renderer
	// implementation and the main-process MD5 call. Accept either legacy
	// encoding, then immediately replace a successful match with Argon2id.
	const matches = safeEqualHex(stored, legacyMd5(password)) || safeEqualHex(stored, legacyMd5(password, 'utf8'));
	return {
		matches,
		migratedHash: matches ? hashPassword(password) : null,
	};
}

module.exports = {
	ARGON2_MEMORY_KIB,
	ARGON2_PASSES,
	ARGON2_PARALLELISM,
	hashPassword,
	verifyPassword,
};
