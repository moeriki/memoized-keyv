'use strict';

require('babel-polyfill'); // eslint-disable-line import/no-unassigned-import

const Keyv = require('keyv');

const memoize = require('../lib');

const deferred = () => {
	const defer = {};
	defer.promise = new Promise((resolve, reject) => {
		defer.resolve = resolve;
		defer.reject = reject;
	});
	return defer;
};

describe('memoizedKeyv', () => {
	let syncSum;
	let asyncSum;

	beforeEach(() => {
		syncSum = (...numbers) => numbers.reduce((sum, n) => sum + n, 0);
		asyncSum = jest.fn((...numbers) => numbers.reduce(
			(wait, n) => wait.then(sum => sum + n),
			Promise.resolve(0)
		));
	});

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

	it('should return pending result', async () => {
		const defer = deferred();
		const spy = jest.fn(() => defer.promise);
		const memoized = memoize(spy);
		const results = Promise.all([memoized('test'), memoized('test')]);
		defer.resolve('result');
		expect(await results).toEqual(['result', 'result']);
		expect(spy).toHaveBeenCalledTimes(1);
	});

	it('should return cached result', async () => {
		const memoized = memoize(asyncSum);
		await memoized.keyv.set('5', 5);
		await memoized(5);
		expect(asyncSum).not.toHaveBeenCalled();
	});

	it('should throw error', async () => {
		const error = new Error('NOPE');
		const memoized = memoize(() => Promise.reject(error));
		try {
			await memoized();
		} catch (err) {
			expect(err).toBe(error);
		}
		expect.assertions(1);
	});

	it('should not cache error', async () => {
		const spy = jest.fn(() => Promise.reject(new Error('NOPE')));
		const memoized = memoize(spy);
		await memoized().catch(() => { /* noop */ });
		await memoized().catch(() => { /* noop */ });
		expect(spy).toHaveBeenCalledTimes(2);
	});

	it('should return fresh result', async () => {
		const memoizedSum = memoize(asyncSum, null, { stale: 10 });
		memoizedSum.keyv.set('5', 5, 20);
		expect(await memoizedSum(5)).toBe(5);
		expect(asyncSum).not.toHaveBeenCalled();
	});

	it('should return stale result but refresh', async done => {
		const memoizedSum = memoize(asyncSum, null, { stale: 10 });
		await memoizedSum.keyv.set('1', 1, 5);
		const sum = await memoizedSum(1, 2);
		expect(sum).toBe(1);
		expect(asyncSum).toHaveBeenCalledWith(1, 2);
		memoizedSum.keyv.on('memoize.fresh.value', value => {
			expect(value).toBe(3);
			done();
		});
	});

	it('should emit on stale refresh error', async done => {
		asyncSum.mockImplementation(() => Promise.reject(new Error('NOPE')));
		const memoizedSum = memoize(asyncSum, null, { stale: 10 });
		await memoizedSum.keyv.set('1', 1, 5);
		memoizedSum(1);
		memoizedSum.keyv.on('memoize.fresh.error', err => {
			expect(err).toMatchSnapshot();
			done();
		});
	});

	it('should return cached result if a stale refresh is pending', async () => {
		const defer = deferred();
		asyncSum.mockImplementation(() => defer.promise);
		const memoizedSum = memoize(asyncSum, null, { stale: 10 });
		await memoizedSum.keyv.set('1', 1, 5);
		expect(await memoizedSum(1)).toBe(1);
		expect(await memoizedSum(1)).toBe(1);
		expect(asyncSum).toHaveBeenCalledTimes(1);
	});

	it('should delete expired result and return fresh result', async done => {
		const memoizedSum = memoize(asyncSum);
		await memoizedSum.keyv.set('1', 1, 1);
		setTimeout(async () => {
			expect(await memoizedSum(1, 2)).toBe(3);
			done();
		}, 5);
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
