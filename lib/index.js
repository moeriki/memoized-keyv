'use strict';

const Keyv = require('keyv');
const mimicFn = require('mimic-fn');

const constant = value => () => value;
const identity = arg0 => arg0;

function memoize(func, keyvOpts, opts) {
	const keyv = keyvOpts instanceof Keyv
		? keyvOpts
		: new Keyv(keyvOpts)
	;

	const resolver = (opts && opts.resolver) || identity;
	const ttl = opts && typeof opts.ttl === 'function'
		? opts.ttl
		: constant(opts ? opts.ttl : undefined)
	;

	function memoized() {
		const args = Array.from(arguments);
		const key = resolver.apply(null, args);
		return keyv.get(key).then(storedValue => storedValue === undefined
			? Promise.resolve(func.apply(null, args)).then(value => value === undefined
				? value
				: keyv.set(key, value, ttl(value)).then(() => value))
			: storedValue
		);
	}

	mimicFn(memoized, func);

	return Object.assign(memoized, { keyv, resolver, ttl });
}

module.exports = memoize;
