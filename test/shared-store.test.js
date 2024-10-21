import { before, describe, it } from '@applicvision/js-toolbox/test'
import expect from '@applicvision/js-toolbox/expect'
import { DeclarativeElement } from '../src/declarative-element.js'
import { getStore, unsubscribe } from '../src/store.js'
import { html } from '../src/dynamic-fragment.js'
import { addTestContainer } from './helpers.js'


/** @param {HTMLElement} element */
function shadowText(element) {
	return element.shadowRoot?.textContent ?? ''
}

describe('Shared store component', () => {
	const store = getStore({
		/** @type {{age: number, name: string}} */
		// @ts-ignore
		user: undefined
	})

	/** @type {ConnectedElement} */
	let element

	/** @type {HTMLElement} */
	let testContainer


	before(() => testContainer = addTestContainer())

	before(() => {
		store.user.insertWithId('1', { age: 1, name: 'nisse' })
	})

	class ConnectedElement extends DeclarativeElement {
		user = store.user.get('1', this)
		render() {
			return html`<div>age: ${this.user.age} name: ${this.user.name}<div>`
		}

		disconnectedCallback() {
			unsubscribe(store, this)
		}
	}

	before(() => {
		customElements.define('test-connected', ConnectedElement)
	})

	it('should render with value in store', async () => {
		/** @type {ConnectedElement} */
		// @ts-ignore
		element = document.createElement('test-connected')
		testContainer.replaceChildren(element)
		expect(shadowText(element)).to.equal('age: 1 name: nisse')
	})
	it('should update when store changes', async () => {
		store.user.update('1', { name: 'putte', age: 2 })
		await element.pendingUpdate

		expect(shadowText(element)).to.equal('age: 2 name: putte')
	})
})
