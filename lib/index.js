'use strict';

const Keyv = require('keyv');
const mimicFn = require('mimic-fn');
const pAny = require('p-any');

const constant = (value) => () => value;
const identity = (argument0) => argument0;

function memoize(func, keyvOptions, options) {
	const keyv =
		keyvOptions instanceof Keyv ? keyvOptions : new Keyv(keyvOptions);
	const pending = {};
	const resolver = (options && options.resolver) || identity;
	const ttl =
		options && typeof options.ttl === 'function'
			? options.ttl
			: constant(options ? options.ttl : undefined);
	const stale =
		options && typeof options.stale === 'number' ? options.stale : undefined;

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
			.then((data) =>
				typeof data === 'string' ? keyv.opts.deserialize(data) : data
			);
	}

	/**
	 * @param {*[]} arguments_
	 * @return {Promise<*>} value
	 */
	function getFreshValue(arguments_) {
		return Promise.resolve(func.apply(null, arguments_));
	}

	/**
	 * @param {string}	key
	 * @return {Promise<*>} value
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
	 * @param {string} key
	 * @param {*[]} arguments_
	 * @return {Promise<*>} value
	 */
	function refreshValue(key, arguments_) {
		return getFreshValue(arguments_).then((value) =>
			updateStoredValue(key, value)
		);
	}

	/**
	 * @param {string}	key
	 * @param {*}				value
	 * @return {Promise} resolves when updated
	 */
	function updateStoredValue(key, value) {
		return keyv.set(key, value, ttl(value)).then(() => value);
	}

	/**
	 * @return {Promise<*>}
	 */
	function memoized() {
		const arguments_ = Array.from(arguments);
		const key = resolver.apply(null, arguments_);

		if (pending[key] !== undefined) {
			return pAny([getStoredValue(key), pending[key]]);
		}

		pending[key] = getRaw(key).then((data) => {
			const hasValue = data ? data.value !== undefined : false;
			const hasExpires = hasValue && typeof data.expires === 'number';
			const ttlValue = hasExpires ? data.expires - Date.now() : undefined;
			const isExpired = stale === undefined && hasExpires && ttlValue < 0;
			const isStale = stale !== undefined && hasExpires && ttlValue < stale;

			if (hasValue && !isExpired && !isStale) {
				pending[key] = undefined;
				return data.value;
			}

			const pendingRefresh = Promise.resolve(
				isExpired ? keyv.delete(key) : undefined
			).then(() => refreshValue(key, arguments_));

			if (isStale) {
				/* eslint-disable promise/always-return */
				pendingRefresh
					.then((value) => {
						keyv.emit('memoize.fresh.value', value);
					})
					.catch((error) => {
						keyv.emit('memoize.fresh.error', error);
					});
				return data.value;
			}

			return pendingRefresh
				.catch((error) => {
					pending[key] = undefined;
					throw error;
				})
				.then((value) => {
					pending[key] = undefined;
					return value;
				});
		});

		return pending[key];
	}

	mimicFn(memoized, func);

	return Object.assign(memoized, { keyv, resolver, ttl });
}

module.exports = memoize;
