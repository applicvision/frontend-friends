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
		assert.deepEqual(spy.mock.calls.at(-1)?.arguments[0], ['a'])

		watched.b.c = 3
		assert.equal(spy.mock.callCount(), 2)
		assert.deepEqual(spy.mock.calls.at(-1)?.arguments[0], ['b', 'c'])
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

		watched.id2 = { name: 'Test 2' }

		assert.equal(spy.mock.callCount(), 2)
		assert.deepEqual(spy.mock.calls.at(-1)?.arguments[0], ['id2'])

	})

	it('Should watch an array', () => {
		const spy = mock.fn()
		const watched = deepWatch([{ a: 1 }, { a: 2 }], spy)

		watched.unshift({ a: 3 })
		assert.equal(spy.mock.callCount(), 4)

		watched.pop()
		assert.equal(spy.mock.callCount(), 5)

		watched.push({ a: 10 })
		assert.equal(spy.mock.callCount(), 7)

		watched.reverse()
		assert.equal(spy.mock.callCount(), 9)

		watched.length = 0
		assert.equal(spy.mock.callCount(), 10)

	})

	it('Should watch custom class instance', () => {
		class DemoClass {
			name = 'test'
			items = ['apple']

			/** @type {{[key: string]: string}} */
			attributes = {}
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
		assert.deepEqual(spy.mock.calls.at(-1)?.arguments[0], ['map', 'Map[key1]'])

		watched.map.set('newkey', 'newvalue')

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
		const spy = mock.fn()
		const watched = deepWatch(new Set(['item1']), spy)
		watched.add('test')
		assert.equal(spy.mock.callCount(), 1)
		watched.add('test')
		assert.equal(spy.mock.callCount(), 2)
		assert.equal(watched.size, 2)
		watched.delete('item1')
		assert.equal(spy.mock.callCount(), 3)
		assert.equal(watched.size, 1)
		watched.clear()
		assert.equal(watched.size, 0)
		assert.equal(spy.mock.callCount(), 4)
	})
	it('Should watch set with objects', () => {
		const spy = mock.fn()
		const watched = deepWatch(new Set([{ name: 'test' }]), spy)
		watched.forEach(entry => entry.name += 'updated')
		assert.equal(spy.mock.callCount(), 1)
		assert.deepEqual(spy.mock.calls[0].arguments[0], ['[Set]', 'name'])
	})
})
