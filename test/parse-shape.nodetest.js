import { describe, it } from 'node:test'
import assert from 'node:assert'
import { optional, parse, shape } from '@applicvision/frontend-friends/parse-shape'

describe('Parse shape', () => {
	it('Should parse simple object', () => {
		const simpleShape = shape({
			prop1: Number,
			prop2: String,
			nested: {
				aDate: Date,
				aURL: URL
			},
			prop3: optional(Boolean),
			prop4: optional(Boolean)
		})
		const result = simpleShape.parse({
			prop1: 123,
			prop2: 'hello',
			prop3: false,
			nested: {
				aDate: 1744220000000,
				aURL: 'https://applicvision.com'
			}
		})

		assert.equal(typeof result.prop1, 'number')
		assert.equal(typeof result.prop2, 'string')
		assert.equal(typeof result.prop3, 'boolean')

		assert.equal(result.nested.aDate.getFullYear(), 2025)
		assert.equal(result.nested.aURL.hostname, 'applicvision.com')
	})

	it('Should throw on shape mismatch', () => {
		const simpleShape = { prop1: Number, prop2: String, prop3: optional(Boolean) }

		assert.throws(() => parse(simpleShape, { prop1: 123 }))
	})
})
