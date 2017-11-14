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

	const pending = {};
	const resolver = (opts && opts.resolver) || identity;
	const ttl = opts && typeof opts.ttl === 'function'
		? opts.ttl
		: constant(opts ? opts.ttl : undefined)
	;

	function memoized() {
		const args = Array.from(arguments);
		const key = resolver.apply(null, args);
		if (pending[key]) {
			return pending[key];
		}
		pending[key] = keyv.get(key).then(storedValue => {
			if (storedValue === undefined) {
				return Promise.resolve(func.apply(null, args)).then(value => {
					if (value === undefined) {
						return value;
					}
					return keyv.set(key, value, ttl(value))
						.then(() => {
							pending[key] = null;
							return value;
						})
					;
				});
			}
			return storedValue;
		});
		return pending[key];
	}

	mimicFn(memoized, func);

	return Object.assign(memoized, { keyv, resolver, ttl });
}

module.exports = memoize;
