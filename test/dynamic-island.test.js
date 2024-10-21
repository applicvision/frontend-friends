import { before, describe, it } from '@applicvision/js-toolbox/test'
import { html } from '../src/dynamic-fragment.js'
import expect from '@applicvision/js-toolbox/expect'
import { DynamicIsland, island } from '@applicvision/frontend-friends/island'
import { getStore } from '../src/store.js'
import { addTestContainer } from './helpers.js'

describe('Dynamic island', () => {

	const store = getStore({
		/** @type {{age: number, name: string}} */
		// @ts-ignore
		user: undefined
	})

	/** @type {HTMLElement} */
	let testContainer

	before(() => testContainer = addTestContainer())

	before(() => {
		store.user.insertWithId('1', { age: 0, name: 'Tuva' })
	})

	it('island connected to store', async () => {

		const island = new DynamicIsland(() => ({
			tuva: store.user.get('1')
		}), (state) => html`<h2>name: ${state.tuva.name} age: ${state.tuva.age}</h2>`)

		island.mount(testContainer)

		expect(testContainer.textContent).to.equal('name: Tuva age: 0')

		store.user.update('1', { age: 1 })

		await island.pendingUpdate

		expect(testContainer.textContent).to.equal('name: Tuva age: 1')

		island.unmout()
	})

	it('island with state', async () => {
		const island = new DynamicIsland(() => ({
			state: {
				name: 'Tuva',
				age: 0
			}
		}),
			({ state }) => html`<h2>name: ${state.name} age: ${state.age}</h2>`
		)

		island.mount(testContainer)

		expect(testContainer.textContent).to.equal('name: Tuva age: 0')

		island.state.age++

		await island.pendingUpdate

		expect(testContainer.textContent).to.equal('name: Tuva age: 1')
	})

	it('chained state', async () => {
		const state = { age: 0 }
		const island1 = island(
			() => ({ state }), ({ state }) => html`<h2>${state.age}</h2>`
		)
		const island2 = island(
			() => ({ state: island1.state }), ({ state }) => html`<h3>${state.age}</h3>`
		)
		const div1 = document.createElement('div')
		const div2 = document.createElement('div')
		testContainer.replaceChildren(div1, div2)

		island1.mount(div1)
		island2.mount(div2)


		expect(testContainer.textContent).to.equal('00')

		island2.state.age++

		await island1.pendingUpdate && await island2.pendingUpdate

		expect(testContainer.textContent).to.equal('11')

		island1.state.age++

		await island1.pendingUpdate && await island2.pendingUpdate

		expect(testContainer.textContent).to.equal('21')
	})

	it('alternating fragments uses cache', async () => {

		const anIsland = island(
			() => ({ state: { loading: true } }),
			({ state }) => {
				if (state.loading) {
					return html`<div>loading...</div>`
				}
				return html`<h2>loaded</h2>`
			})

		anIsland.mount(testContainer)

		expect(testContainer.textContent).to.equal('loading...')

		const firstRendered = testContainer.firstElementChild

		anIsland.state.loading = false
		await anIsland.pendingUpdate

		expect(testContainer.textContent).to.equal('loaded')

		anIsland.state.loading = true
		await anIsland.pendingUpdate

		expect(testContainer.textContent).to.equal('loading...')

		expect(firstRendered).to.equal(testContainer.firstElementChild)
	})
})
