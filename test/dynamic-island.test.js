import { before, describe, it } from '@applicvision/js-toolbox/test'
import { spy } from '@applicvision/js-toolbox/function-spy'
import expect from '@applicvision/js-toolbox/expect'
import { html, ref } from '@applicvision/frontend-friends'
import { DynamicIsland, island } from '@applicvision/frontend-friends/island'
import { getStore } from '../src/store.js'
import { addTestContainer } from './helpers.js'
import { definePlugin } from '../src/render-hooks.js'

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

		const storeIsland = island(() => {
			const tuva = store.user.get('1')
			return html`<h2>name: ${tuva.name} age: ${tuva.age}</h2>`
		})

		storeIsland.mount(testContainer)

		expect(testContainer.textContent).to.equal('name: Tuva age: 0')

		store.user.update('1', { age: 1 })

		await storeIsland.pendingUpdate

		expect(testContainer.textContent).to.equal('name: Tuva age: 1')

		storeIsland.unmount()

		expect(testContainer.textContent).to.be.empty()
	})

	it('island with state', async () => {
		const anIsland = island({
			name: 'Tuva',
			age: 0
		}, (state) => html`<h2>name: ${state.name} age: ${state.age}</h2>`)

		anIsland.mount(testContainer)

		expect(testContainer.textContent).to.equal('name: Tuva age: 0')

		anIsland.state.age++

		await anIsland.pendingUpdate

		expect(testContainer.textContent).to.equal('name: Tuva age: 1')
	})

	it('island with primitive state', async () => {
		const anIsland = island(0, state => html`<p>count: ${state}`)

		anIsland.mount(testContainer)

		expect(testContainer.textContent).to.equal('count: 0')

		anIsland.state++

		anIsland.state++

		await anIsland.pendingUpdate

		expect(testContainer.textContent).to.equal('count: 2')
	})

	it('chained state', async () => {
		const state = { age: 0 }
		const island1 = island(state, (state) => html`<h2>${state.age}</h2>`
		)
		const island2 = island(island1.state, (state) => html`<h3>${state.age}</h3>`
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

		const anIsland = island({ loading: true },
			(state) => {
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

	it('island with refs', () => {
		const anIsland = island(
			{ refs: { diven: ref() } },
			({ refs }) => html`<div ff-ref=${refs.diven}>test</div>`
		)
		anIsland.mount(testContainer)

		expect(anIsland.refs.diven.elementOrThrow).to.equal(testContainer.querySelector('div'))
	})

	it('island with plugin', async () => {
		const middlewareSpy = spy()
		const cleanupSpy = spy()
		let changeState = () => { }
		const testPlugin = definePlugin((invalidate) => {
			const state = {
				count: 0
			}
			changeState = () => {
				state.count++
				invalidate()
			}
			return {
				middleware: (render) => {
					middlewareSpy()
					render()
				},
				state,
				cleanup: () => cleanupSpy()
			}
		})

		const pluginIsland = island({
			plugins: {
				test: testPlugin,
			}
		}, ({ plugins }) => html`<div>${plugins.test.count}</div>`)

		pluginIsland.mount(testContainer)

		expect(testContainer.textContent).to.equal('0')

		expect(middlewareSpy.calls).to.equal(1)

		changeState()

		await pluginIsland.pendingUpdate

		expect(middlewareSpy.calls).to.equal(2)
		expect(testContainer.textContent).to.equal('1')

		pluginIsland.unmount()

		expect(cleanupSpy.calls).to.equal(1)
	})
})
