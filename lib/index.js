'use strict';

const JSONB = require('json-buffer');
const Keyv = require('keyv');
const mimicFn = require('mimic-fn');
const pAny = require('p-any');

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

	/**
	 * This can be better. Check:
	 * - https://github.com/lukechilds/keyv/issues/36
	 *
	 * @param {string}	key
	 * @return {Promise<object>} { expires:number, value:* }
	 */
	function getRaw(key) {
		const absKey = keyv._getKeyPrefix(key);
		const store = keyv.opts.store;
		return Promise.resolve()
			.then(() => store.get(absKey))
			.then(data => typeof data === 'string' ? JSONB.parse(data) : data)
		;
	}

	/**
	 * @param {string}	key
	 * @return {Promise<*>}
	 */
	function getFreshValue(args) {
		return Promise.resolve(func.apply(null, args));
	}

	/**
	 * @param {string}	key
	 * @return {Promise<*>}
	 * @throws if not found
	 */
	function getStoredValue(key) {
		return getRaw(key).then((data) => {
			if (!data || data.value === undefined) {
				throw new Error('Not found');
			}
			return data.value;
		});
	}

	/**
	 * @param {string}	key
	 * @param {*}				value
	 * @return {Promise}
	 */
	function updateStoredValue(key, value) {
		return keyv.set(key, value, ttl(value));
	}

	/**
	 * @return {Promise<*>}
	 */
	function memoized() {
		const args = Array.from(arguments);
		const key = resolver.apply(null, args);

		if (pending[key]) {
			return pAny([
				getStoredValue(key),
				pending[key],
			]);
		}

		pending[key] = getRaw(key).then(data => {
			if (!data || data.value === undefined) {
				return getFreshValue(args)
					.then((value) => updateStoredValue(key, value)
						.then(() => {
							pending[key] = null;
							return value;
						})
					)
				;
			}
			return data.value;
		});

		return pending[key];
	}

	mimicFn(memoized, func);

	return Object.assign(memoized, { keyv, resolver, ttl });
}

module.exports = memoize;
