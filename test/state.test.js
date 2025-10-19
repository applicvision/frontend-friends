import { before, describe, it } from '@applicvision/js-toolbox/test'
import expect from '@applicvision/js-toolbox/expect'
import { DeclarativeElement } from '../src/declarative-element.js'
import { html, twoway, island } from '../src/index.js'
import { addTestContainer, normalizeMarkupText, shadowText } from './helpers.js'


/**
 * @param {HTMLElement} element
 * @return {HTMLElement}
 */
function firstShadowElement(element) {
	// @ts-ignore
	return element.shadowRoot?.firstElementChild
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
			return html`<div>string: ${this.state.name} value: ${this.state.value}</div>`
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

	/** @extends {DeclarativeElement<boolean>} */
	class TwoWayElement extends DeclarativeElement {

		static sharedStateName = 'active'

		// Expose the protected method
		sharedStateChanged() {
			super.sharedStateChanged()
		}

		render() {
			return html`<button
				onclick=${() => this.sharedState = !this.sharedState}
				>inside: ${this.sharedState ? 'active' : 'inactive'}</button>`
		}
	}

	before(() => {
		customElements.define('test-stateful', Stateful)
		customElements.define('test-alternating', Alternating)
		customElements.define('test-twoway', TwoWayElement)
	})

	it('should update string state', async () => {

		const element = new Stateful
		testContainer.replaceChildren(element)
		expect(shadowText(element)).to.equal('string: state value: 0')

		element.changeStringState()
		expect(element.pendingUpdate).to.be.a(Promise)
		await element.pendingUpdate

		expect(shadowText(element)).to.equal('string: newstate value: 0')
		expect(element.pendingUpdate).to.equal(null)

		// Calling the change function again should not cause rerendering, since nothing changes now
		element.changeStringState()
		expect(element.pendingUpdate).to.equal(null)
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

		const firstRendered = firstShadowElement(element)

		element.state.loading = !element.state.loading
		await element.pendingUpdate

		expect(shadowText(element)).to.equal('loaded')

		expect(firstRendered).not.to.equal(firstShadowElement(element))

		element.state.loading = !element.state.loading
		await element.pendingUpdate

		expect(firstRendered).to.equal(firstShadowElement(element))
	})

	it('should handle shared state when passed through dynamic fragment', async () => {
		const anIsland = island(
			() => ({ state: { active: false } }),
			({ state }) => html`
				<button onclick=${() => state.active = !state.active}>outside: ${String(state.active)}</button>
				<test-twoway ff-share=${twoway(state, 'active')}></test-twoway>
			`
		)

		anIsland.mount(testContainer)

		/** @type {TwoWayElement} */
		// @ts-ignore
		const twowayElement = testContainer.querySelector('test-twoway')

		const getText = () => normalizeMarkupText(testContainer.textContent + shadowText(twowayElement))

		expect(getText()).to.equal('outside: false inside: inactive')

		testContainer.querySelector('button')?.click()

		await anIsland.pendingUpdate

		expect(getText()).to.equal('outside: true inside: active')

		expect(twowayElement.matches(':state(active)')).to.be.true()

		twowayElement.shadowRoot?.querySelector('button')?.click()

		await anIsland.pendingUpdate

		expect(getText()).to.equal('outside: false inside: inactive')

		expect(twowayElement.matches(':state(active)')).to.be.false()
	})

	it('should handle shared state when set as property', async () => {

		const element = new TwoWayElement
		testContainer.replaceChildren(element)

		let value = true

		let setterCalled = false
		element.sharedStateBinding = {
			get() {
				return value
			},
			set(newValue) {
				setterCalled = true
				value = newValue
				element.sharedStateChanged()
			}
		}

		await element.pendingUpdate

		expect(shadowText(element)).to.equal('inside: active')

		expect(element.matches(':state(active)')).to.be.true()

		element.shadowRoot?.querySelector('button')?.click()

		expect(setterCalled).to.be.true()
		expect(value).to.be.false()
		await element.pendingUpdate

		expect(shadowText(element)).to.equal('inside: inactive')
		expect(element.matches(':state(active)')).to.be.false()
	})

})
