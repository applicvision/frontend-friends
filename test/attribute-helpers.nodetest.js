import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { tokens, style } from '@applicvision/frontend-friends/attribute-helpers'

describe('Attribte helpers', () => {


	describe('Token list', () => {
		it('Should create token list from simple argument', () => {
			/** @type {string} */
			let classes
			classes = tokens('alfa beta')
			assert.equal(classes, 'alfa beta')

			classes = tokens('alfa   beta alfa  gamma')
			assert.equal(classes, 'alfa beta gamma')
		})

		it('Should create token list from object argument', () => {
			const classes = tokens('alfa beta', { gamma: false, delta: true, 'beta alfa': true })
			assert.equal(classes, 'alfa beta delta')
		})

		it('Should handle null', () => {
			// @ts-expect-error
			const classes = tokens(null, 'valid-class')
			assert.equal(classes, 'valid-class')
		})

		it('Should create token list from array argument', () => {
			/** @type {string} */
			let classes

			classes = tokens(['alfa beta'], ['gamma', { 'delta': true }])
			assert.equal(classes, 'alfa beta gamma delta')

			classes = tokens('alfa beta', [{ 'gamma': true }], 'beta ', { 'beta alfa': true })
			assert.equal(classes, 'alfa beta gamma')
		})
	})

	describe('style', () => {
		it('Should CSS Declaration map to valid css string', () => {
			assert.equal(
				style({ display: 'flex', justifyContent: 'center', webkitLineClamp: 'none' }),
				'display: flex; justify-content: center; -webkit-line-clamp: none'
			)
		})

		it('Should remove falsy entries, except 0', () => {
			assert.equal(
				style({ minWidth: 0, opacity: '', webkitLineClamp: null, animationDuration: 2.3 }),
				'min-width: 0; animation-duration: 2.3'
			)
		})
	})

})
