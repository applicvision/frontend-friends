import { before, describe, it } from '@applicvision/js-toolbox/test'
import expect from '@applicvision/js-toolbox/expect'
import { DeclarativeElement } from '../src/declarative-element.js'
import { html } from '../src/dynamic-fragment.js'
import { addTestContainer } from './helpers.js'

/**
 * @param {HTMLElement} element
 */
function shadowText(element) {
	return element.shadowRoot?.textContent ?? ''
}

describe('Stateful component', () => {

	/** @type {HTMLElement} */
	let testContainer

	before(() => testContainer = addTestContainer())

	class Stateful extends DeclarativeElement {
		renders = 0
		state = this.reactive({ name: 'state', value: 0 })
		render() {
			this.renders++
			return html`<div>string: ${this.state.name} value: ${this.state.value}<div>`
		}
		changeStringState() {
			this.state.name = 'newstate'
		}

		changeNumberState() {
			this.state.value++
		}
	}

	class Alternating extends DeclarativeElement {
		state = this.reactive({ loading: true })
		render() {
			if (this.state.loading) {
				return html`<div>loading...</div>`
			}
			return html`<h2>loaded</h2>`
		}
	}

	before(() => {
		customElements.define('test-stateful', Stateful)
		customElements.define('test-alternating', Alternating)
	})

	it('should update string state', async () => {
		/** @type {Stateful} */
		// @ts-ignore
		const element = document.createElement('test-stateful')
		testContainer.replaceChildren(element)
		expect(shadowText(element)).to.equal('string: state value: 0')

		element.changeStringState()
		await element.pendingUpdate

		expect(shadowText(element)).to.equal('string: newstate value: 0')
	})
	it('should update number state', async () => {
		/** @type {Stateful} */
		// @ts-ignore
		const element = document.createElement('test-stateful')
		testContainer.replaceChildren(element)
		expect(shadowText(element)).to.equal('string: state value: 0')

		element.changeNumberState()
		await element.pendingUpdate

		expect(shadowText(element)).to.equal('string: state value: 1')
	})

	it('should only rerender once', async () => {
		/** @type {Stateful} */
		// @ts-ignore
		const element = document.createElement('test-stateful')
		testContainer.replaceChildren(element)
		expect(shadowText(element)).to.equal('string: state value: 0')
		expect(element.renders).to.equal(1)

		element.changeNumberState()
		element.changeStringState()
		await element.pendingUpdate

		expect(element.renders).to.equal(2)

		expect(shadowText(element)).to.equal('string: newstate value: 1')
	})

	it('should reuse previously rendered content', async () => {
		/** @type {Alternating} */
		// @ts-ignore
		const element = document.createElement('test-alternating')
		testContainer.replaceChildren(element)

		expect(shadowText(element)).to.equal('loading...')

		const firstRendered = element.shadowRoot.firstElementChild

		element.state.loading = !element.state.loading
		await element.pendingUpdate

		expect(shadowText(element)).to.equal('loaded')

		expect(firstRendered).not.to.equal(element.shadowRoot.firstElementChild)

		element.state.loading = !element.state.loading
		await element.pendingUpdate

		expect(firstRendered).to.equal(element.shadowRoot.firstElementChild)
	})
})
