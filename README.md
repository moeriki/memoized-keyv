<p align="center">
  <a href="https://github.com/lukechilds/keyv">
    <img width="100" src="https://rawgit.com/lukechilds/keyv/master/media/logo.svg" alt="keyv">
  </a>
  <h3 align="center">memoized-keyv 🗃</h3>
  <p align="center">Memoize using <a href="https://github.com/lukechilds/keyv">keyv</a> as storage backend.<p>
  <p align="center">
    <a href="https://www.npmjs.com/package/memoized-keyv">
      <img src="https://img.shields.io/npm/v/memoized-keyv.svg" alt="npm version">
    </a>
    <a href="https://travis-ci.org/Moeriki/memoized-keyv">
      <img src="https://travis-ci.org/Moeriki/memoized-keyv.svg?branch=master" alt="Build Status"></img>
    </a>
    <a href="https://coveralls.io/github/Moeriki/memoized-keyv?branch=master">
      <img src="https://coveralls.io/repos/github/Moeriki/memoized-keyv/badge.svg?branch=master" alt="Coverage Status"></img>
    </a>
    <a href="https://david-dm.org/moeriki/memoized-keyv">
      <img src="https://david-dm.org/moeriki/memoized-keyv/status.svg" alt="dependencies Status"></img>
    </a>
  </p>
</p>

## Quick start

```
npm install --save keyv memoized-keyv
```

```js
const memoize = require('memoized-keyv');

const memoizedRequest = memoize(request);

memoizedRequest('http://example.com').then(resp => { /* from request */ });
// later
memoizedRequest('http://example.com').then(resp => { /* from cache */ });
```

## Usage

You can pass an options `object`, uri `string`, or [keyv](https://github.com/lukechilds/keyv) instance as second argument.

```js
memoize(request, { store: new Map() });
memoize(request, 'redis://user:pass@localhost:6379');
memoize(request, new Keyv());
```

### Resolver

By default the first argument of your function call is used as cache key. You can use a resolver if you want to change the key. The resolver is called with the same arguments as the function.

```js
const sum = (n1, n2) => n1 + n2;
const memoized = memoize(sum, new Keyv(), {
  resolver: (n1, n2) => `${n1}+${n2}`
});

memoized(1, 2); // cached as { '1+2': 3 }
```

### TTL

Set `ttl` to a `number` for a static TTL value.

```js
const memoizedRequest = memoize(request, new Keyv(), { ttl: 60000 });

memoizedRequest('http://example.com'); // cached for 60 seconds
```

Set `ttl` to a `function` for a dynamic TTL value.

```js
const memoizedRequest = memoize(request, new Keyv(), {
  ttl: (resp) => resp.statusCode === 200 ? 60000 : 0
});

memoizedRequest('http://example.com'); // cached for 60 seconds only if response was 200 OK
```

## API

### `memoize(func[, keyv[, options]]) :function`

* func `:function`
* keyv `:object|string`
* options `:object`
* options.ttl `:function|number`
* options.resolver `:function`
