import { describe, it } from 'node:test'
import assert from 'node:assert'
import { optional, parse, shape } from '@applicvision/frontend-friends/parse-shape'

describe('Parse shape', () => {
	it('Should parse simple object', () => {
		const simpleShape = shape({ prop1: Number, prop2: String, prop3: optional(Boolean) })
		const result = simpleShape.parse({ prop1: 123, prop2: 'hej' })

		assert.equal(typeof result.prop1, 'number')
		assert.equal(typeof result.prop2, 'string')
	})

	it('Should throw on shape mismatch', () => {
		const simpleShape = { prop1: Number, prop2: String, prop3: optional(Boolean) }

		assert.throws(() => parse(simpleShape, { prop1: 123 }))
	})
})
