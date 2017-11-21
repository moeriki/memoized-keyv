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
	const stale = opts && typeof opts.stale === 'number'
		? opts.stale
		: undefined
	;

	/**
	 * This can be better. Check:
	 * - https://github.com/lukechilds/keyv/issues/36
	 *
	 * @param {string}	key
	 * @return {Promise<object>} { expires:number, value:* }
	 */
	function getRaw(key) {
		return Promise.resolve()
			.then(() => keyv.opts.store.get(keyv._getKeyPrefix(key)))
			.then(data => typeof data === 'string' ? JSONB.parse(data) : data)
		;
	}

	/**
	 * @param {string}	key
	 * @return {Promise<*>} value
	 */
	function getFreshValue(args) {
		return Promise.resolve(func.apply(null, args));
	}

	/**
	 * @param {string}	key
	 * @return {Promise<*>} value
	 * @throws if not found
	 */
	function getStoredValue(key) {
		return getRaw(key).then(data => {
			if (!data || data.value === undefined) {
				throw new Error('Not found');
			}
			return data.value;
		});
	}

	/**
	 * @param {string} key
	 * @param {Array<*>} args
	 * @return {Promise<*>} value
	*/
	function refreshValue(key, args) {
		return getFreshValue(args).then(value =>
			updateStoredValue(key, value).then(() => value)
		);
	}

	/**
	 * @param {string}	key
	 * @param {*}				value
	 * @return {Promise} resolves when updated
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

		if (pending[key] !== undefined) {
			return pAny([
				getStoredValue(key),
				pending[key]
			]);
		}

		pending[key] = getRaw(key).then(data => {
			const hasValue = data ? data.value !== undefined : false;
			const hasExpires = hasValue && typeof data.expires === 'number';
			const ttl = hasExpires ? data.expires - Date.now() : undefined;
			const isExpired = stale === undefined && hasExpires && ttl < 0;
			const isStale = stale !== undefined && hasExpires && ttl < stale;
			if (hasValue && !isExpired && !isStale) {
				pending[key] = undefined;
				return data.value;
			}
			return Promise.resolve(isExpired ? keyv.delete(key) : undefined).then(() => {
				const pendingRefresh = refreshValue(key, args);
				if (isStale) {
					pendingRefresh
						.then(value => {
							keyv.emit('memoize.fresh.value', value);
						})
						.catch(err => {
							keyv.emit('memoize.fresh.error', err);
						})
					;
					return data.value;
				}
				return pendingRefresh.then(value => {
					pending[key] = undefined;
					return value;
				});
			});
		});

		return pending[key];
	}

	mimicFn(memoized, func);

	return Object.assign(memoized, { keyv, resolver, ttl });
}

module.exports = memoize;
