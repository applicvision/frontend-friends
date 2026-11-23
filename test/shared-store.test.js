import { before, describe, it } from '@applicvision/js-toolbox/test'
import expect from '@applicvision/js-toolbox/expect'
import { DeclarativeElement } from '@applicvision/frontend-friends'
import { getStore } from '../src/store.js'
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

	/** @type {ElementUsingStore} */
	let element

	/** @type {HTMLElement} */
	let testContainer


	before(() => testContainer = addTestContainer())

	before(() => {
		store.user.insertWithId('1', { age: 1, name: 'nisse' })
	})

	class ElementUsingStore extends DeclarativeElement {
		render() {
			const user = store.user.get('1')
			return html`<div>age: ${user.age} name: ${user.name}</div>`
		}
	}

	before(() => {
		customElements.define('test-store', ElementUsingStore)
	})

	it('should render with value in store', async () => {
		element = new ElementUsingStore
		testContainer.replaceChildren(element)
		expect(shadowText(element)).to.equal('age: 1 name: nisse')
	})
	it('should update when store changes', async () => {
		store.user.update('1', { name: 'putte', age: 2 })
		await element.pendingUpdate

		expect(shadowText(element)).to.equal('age: 2 name: putte')
	})
})
