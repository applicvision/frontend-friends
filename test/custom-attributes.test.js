import { before, describe, it } from '@applicvision/js-toolbox/test'
import expect from '@applicvision/js-toolbox/expect'
import { html } from '../src/index.js'
import { addTestContainer } from './helpers.js'
import { registerSpecialAttribute, unregisterSpecialAttribute } from '@applicvision/frontend-friends/special-attributes'
import { style } from '../src/attribute-helpers.js'


describe('Custom attributes', () => {

	/** @type {HTMLElement} */
	let testContainer

	before(() => testContainer = addTestContainer())

	it('can not override included special attributes', () => {
		['ff-share', 'ff-ref'].forEach(builtIn => {
			let error = null
			try {
				// @ts-ignore
				registerSpecialAttribute(builtIn, {
					update(element) { }
				})
			} catch (e) {
				error = e
			}
			expect(error).to.be.an(Error)
		})
	})
	it('must follow name rules', () => {
		['class', 'including spaces', '<div>', 'fftest', 'ff--special', 'ff-a <script>'].forEach(attributeName => {
			let error = null
			try {
				// @ts-expect-error
				registerSpecialAttribute(attributeName, {})

			} catch (e) {
				error = e
			}
			expect(error).to.be.an(Error)
		})
	})

	it('register a special attribute', () => {

		/** @type {{rect: DOMRect|null}} */
		const rectContainer = { rect: null }

		registerSpecialAttribute('ff-rect', {
			/** @type {(value: unknown) => value is typeof rectContainer} */
			isValueValid: value => typeof value == 'object',
			update(element, rectRef) {
				rectRef.rect = element.getBoundingClientRect()
			}
		})

		const template = html`<div 
			ff-rect=${rectContainer} 
			style=${style({ width: '70px', height: '50px', background: 'purple' })}>
			</div>`

		template.mount(testContainer)

		expect(rectContainer.rect?.width).to.equal(70)
		expect(rectContainer.rect?.height).to.equal(50)

		expect(unregisterSpecialAttribute('ff-rect')).to.be.true()
	})
})
