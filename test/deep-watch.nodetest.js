import { describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'
import { deepWatch } from '@applicvision/frontend-friends/deep-watch'

describe('Deep watch', () => {
	it('Should watch deep object', () => {
		const spy = mock.fn()
		/** @type {{[key: string]: any}} */
		const watched = deepWatch({ a: 1, b: { c: 2 } }, spy)

		watched.a = 2
		assert.equal(spy.mock.callCount(), 1)
		assert.deepEqual(spy.mock.calls.at(-1)?.arguments, [['a'], 2, 1])

		watched.b.c = 3
		assert.equal(spy.mock.callCount(), 2)
		assert.deepEqual(spy.mock.calls.at(-1)?.arguments, [['b', 'c'], 3, 2])

		watched.b = null
		assert.equal(spy.mock.callCount(), 3)
		assert.deepEqual(spy.mock.calls.at(-1)?.arguments, [['b'], null, { c: 3 }])

		delete watched.a
		assert.equal(spy.mock.callCount(), 4)

		assert.deepEqual(spy.mock.calls.at(-1)?.arguments, [['a'], undefined, 2])
	})

	it('Should not touch original', () => {
		const original = { test: 1, anArray: [1, 2, 3] }

		const shallowCopy = { ...original }

		deepWatch(original, mock.fn())

		for (const key in original) {
			// @ts-ignore
			assert.equal(original[key], shallowCopy[key])
		}
	})

	it('Can be nested', () => {
		const outerWatcher = mock.fn()
		const innerWatcher = mock.fn()

		const innerWatched = deepWatch({ test: { innermost: 'original' } }, innerWatcher)

		const outerWatched = deepWatch({ other: 'only-outer', inner: innerWatched }, outerWatcher)

		outerWatched.inner.test.innermost = 'by outer'

		assert.equal(outerWatcher.mock.callCount(), 1)
		assert.equal(innerWatcher.mock.callCount(), 1)

		innerWatched.test.innermost = 'by inner'

		assert.equal(innerWatcher.mock.callCount(), 2)
		assert.equal(outerWatcher.mock.callCount(), 1)
	})

	it('Should watch new object properties', () => {
		const spy = mock.fn()

		const watched = deepWatch(
			/** @type {{[key: string]: {name: string}}} */
			({ id1: { name: 'Test' } }),
			spy
		)

		watched['id1'].name = 'Test-updated'

		assert.equal(spy.mock.callCount(), 1)

		assert.deepEqual(spy.mock.calls[0].arguments, [['id1', 'name'], 'Test-updated', 'Test'])

		watched.id2 = { name: 'Test 2' }

		assert.equal(spy.mock.callCount(), 2)
		assert.deepEqual(spy.mock.calls.at(-1)?.arguments, [['id2'], { name: 'Test 2' }, undefined])

	})

	it('Should watch an array', () => {
		const spy = mock.fn()
		const watched = deepWatch([{ a: 1 }, { a: 2 }], spy)

		watched.unshift({ a: 3 })
		assert.equal(spy.mock.callCount(), 4)

		watched.pop()

		assert.equal(spy.mock.callCount(), 6)

		watched.push({ a: 10 })
		assert.equal(spy.mock.callCount(), 8)

		watched.reverse()
		assert.equal(spy.mock.callCount(), 10)

		watched.length = 0
		assert.equal(spy.mock.callCount(), 11)

	})

	it('Should watch custom class instance', () => {
		class DemoClass {
			name = 'test'
			items = ['apple']

			/** @type {{[key: string]: string}} */
			attributes = {}

			modifier() {
				this.name = 'modified-test'
			}
		}

		const spy = mock.fn()
		const watched = deepWatch(new DemoClass(), spy)

		assert.ok(watched instanceof DemoClass)

		watched.name += 'updated'
		assert.equal(spy.mock.callCount(), 1)
		assert.deepEqual(spy.mock.calls.at(-1)?.arguments[0], ['name'])

		watched.items.push('extra')
		assert.equal(spy.mock.callCount(), 3)
		assert.deepEqual(spy.mock.calls.at(-1)?.arguments[0], ['items', 'length'])

		watched.attributes['test'] = 'value'
		assert.equal(spy.mock.callCount(), 4)
		assert.deepEqual(spy.mock.calls.at(-1)?.arguments[0], ['attributes', 'test'])

		watched.modifier()
		assert.equal(watched.name, 'modified-test')
		assert.equal(spy.mock.callCount(), 5)

		spy.mock.resetCalls()
		const watched2 = deepWatch({ inner: new DemoClass() }, spy)
		watched2.inner.attributes['inner'] = 'testagain'
		assert.equal(spy.mock.callCount(), 1)
		assert.deepEqual(spy.mock.calls.at(-1)?.arguments[0], ['inner', 'attributes', 'inner'])

	})

	it('Should watch a map', () => {
		const spy = mock.fn()
		const watched = deepWatch({
			map: new Map([
				['key1', 'value1'],
				['key2', 'value2']
			])
		}, spy)

		watched.map.set('key1', 'newvalue')

		assert.equal(spy.mock.callCount(), 1)
		assert.deepEqual(spy.mock.calls.at(-1)?.arguments, [['map', 'Map[key1]'], 'newvalue', 'value1'])

		watched.map.set('newkey', 'newvalue')

		assert.equal(watched.map.size, 3)

		assert.equal(spy.mock.callCount(), 2)
		assert.deepEqual(spy.mock.calls.at(-1)?.arguments[0], ['map', 'Map[newkey]'])

		assert.equal(watched.map.delete('newkey'), true)
		assert.equal(spy.mock.callCount(), 3)
		assert.deepEqual(spy.mock.calls.at(-1)?.arguments[0], ['map', 'Map[newkey]'])

		assert.equal(watched.map.delete('newkey'), false)
		assert.equal(spy.mock.callCount(), 3)

		watched.map.clear()
		assert.equal(spy.mock.callCount(), 4)
		assert.deepEqual(spy.mock.calls.at(-1)?.arguments[0], ['map'])

	})

	it('Should watch map with objects', () => {
		const spy = mock.fn()
		const watched = deepWatch(new Map([
			['key1', { name: 'test1' }],
			['key2', { name: 'test2' }]
		]), spy)

		const item = watched.get('key1')

		if (item) {
			item.name += '-updated'
		}

		assert.equal(spy.mock.callCount(), 1)
		assert.deepEqual(spy.mock.calls[0].arguments[0], ['Map[key1]', 'name'])
	})

	it('Should watch a set', () => {
		const aSet = new Set(['item1'])
		const spy = mock.fn()
		const watched = deepWatch(aSet, spy)
		watched.add('test')
		assert.equal(spy.mock.callCount(), 1)

		assert.deepEqual(spy.mock.calls[0].arguments, [[], aSet])
		watched.add('test')
		assert.equal(spy.mock.callCount(), 2)
		assert.equal(watched.size, 2)
		watched.delete('item1')
		assert.equal(spy.mock.callCount(), 3)
		assert.equal(watched.size, 1)
		watched.clear()
		assert.equal(watched.size, 0)
		assert.equal(spy.mock.callCount(), 4)

		spy.mock.resetCalls()

		const watchedNested = deepWatch({ aSet: new Set(['item-a', 'item-b']) }, spy)

		watchedNested.aSet.add('item-c')
		assert.equal(watchedNested.aSet.size, 3)
		assert.equal(spy.mock.callCount(), 1)

		watchedNested.aSet.delete('item-d')
		assert.equal(spy.mock.callCount(), 1)

		watchedNested.aSet.delete('item-a')
		assert.equal(spy.mock.callCount(), 2)

	})

	it('Shuold watch dates', () => {
		const spy = mock.fn()
		const firstDate = new Date()
		const watched = deepWatch(firstDate, spy)

		assert(watched instanceof Date)
		watched.setFullYear(2020, 1, 1)
		assert.equal(watched.getFullYear(), 2020)
		assert.equal(spy.mock.callCount(), 1)
		assert.deepEqual(spy.mock.calls[0].arguments, [[], firstDate])

		spy.mock.resetCalls()

		const anotherDate = new Date()
		const watchedNested = deepWatch({ date: anotherDate }, spy)

		assert(watchedNested.date instanceof Date)
		watchedNested.date.setFullYear(2020, 1, 1)
		assert.equal(watchedNested.date.getFullYear(), 2020)
		assert.equal(spy.mock.callCount(), 1)
		assert.deepEqual(spy.mock.calls[0].arguments, [['date'], anotherDate])
	})

	it('Should watch URLs and URLSearchParams', () => {
		const spy = mock.fn()

		const url = new URL('http://test.com')

		const watched = deepWatch({ theUrl: url }, spy)

		assert(watched.theUrl instanceof URL)

		watched.theUrl.protocol = 'https'
		assert.equal(watched.theUrl.protocol, 'https:')

		assert.equal(spy.mock.callCount(), 1)
		assert.deepEqual(spy.mock.calls[0].arguments, [['theUrl'], url])

		watched.theUrl.hash = 'fragment'
		assert.equal(spy.mock.callCount(), 2)

		watched.theUrl.searchParams.append('filter', 'value')
		assert.equal(spy.mock.callCount(), 3)

		assert.equal(watched.theUrl.href, 'https://test.com/?filter=value#fragment')


		const searchParamsSpy = mock.fn()
		const params = deepWatch(new URLSearchParams('initial=value'), searchParamsSpy)

		params.append('search', 'test')
		params.append('order', 'asc')

		assert.equal(params.toString(), 'initial=value&search=test&order=asc')
		assert.equal(searchParamsSpy.mock.callCount(), 2)

		params.sort()
		assert.equal(searchParamsSpy.mock.callCount(), 3)
		assert.equal(params.toString(), 'initial=value&order=asc&search=test')
	})
})
