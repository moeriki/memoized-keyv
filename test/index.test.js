'use strict';

require('babel-polyfill'); // eslint-disable-line import/no-unassigned-import

const delay = require('delay');
const Keyv = require('keyv');

const memoize = require('../lib');

const asyncSum = (...numbers) => numbers.reduce(
	(wait, n) => wait.then(sum => delay(n).then(() => sum + n)),
	Promise.resolve(0)
);

const syncSum = (...numbers) => numbers.reduce((sum, n) => sum + n, 0);

describe('memoizedKeyv', () => {
	it('should store result as arg0', async () => {
		const memoizedSum = memoize(asyncSum);
		await memoizedSum(1, 2);
		expect(await memoizedSum.keyv.get('1')).toBe(3);
	});

	it('should store result as resolver result', async () => {
		const memoizedSum = memoize(asyncSum, null, { resolver: syncSum });
		await memoizedSum(1, 2, 3);
		expect(await memoizedSum.keyv.get('6')).toBe(6);
	});

	it('should return result', async () => {
		const memoized = memoize(asyncSum);
		expect(await memoized(1, 2)).toBe(3);
	});

	it('should return cached result', async () => {
		const spy = jest.fn(asyncSum);
		const memoized = memoize(spy);
		await memoized.keyv.set('5', 5);
		await memoized(5);
		expect(spy).not.toHaveBeenCalled();
	});

	it('should not store result if undefined', async () => {
		const mock = jest.fn(() => Promise.resolve());
		const memoizedSum = memoize(mock);
		await memoizedSum(5);
		expect(await memoizedSum.keyv.opts.store.has('5')).toBe(false);
	});

	it('should use existing Keyv instance', () => {
		const keyv = new Keyv();
		const memoizedSum = memoize(asyncSum, keyv);
		expect(memoizedSum.keyv).toBe(keyv);
	});

	it('should create new Keyv instance', () => {
		const store = new Map();
		const memoizedSum = memoize(asyncSum, { store });
		expect(memoizedSum.keyv).toBeInstanceOf(Keyv);
		expect(memoizedSum.keyv.opts.store).toBe(store);
	});

	it('should store result with static ttl', async () => {
		const memoizedSum = memoize(asyncSum, null, { ttl: 5 });
		memoizedSum.keyv.set = jest.fn(memoizedSum.keyv.set.bind(memoizedSum.keyv));
		await memoizedSum(1, 2);
		expect(memoizedSum.keyv.set).toHaveBeenCalledWith(1, 3, 5);
	});

	it('should store result with dynamic ttl', async () => {
		const memoizedSum = memoize(asyncSum, null, { ttl: syncSum });
		memoizedSum.keyv.set = jest.fn(memoizedSum.keyv.set.bind(memoizedSum.keyv));
		await memoizedSum(1, 2, 3);
		expect(memoizedSum.keyv.set).toHaveBeenCalledWith(1, 6, 6);
	});
});
