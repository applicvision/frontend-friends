import { DynamicIsland } from '@applicvision/frontend-friends/island'

export class RouteIslandContainer extends HTMLElement {
	static observedAttributes = ['src']

	/** @type {DynamicIsland<any>|null} */
	#island = null

	/** @type {ElementInternals} */
	#internals

	constructor() {
		super()
		this.#internals = this.attachInternals()
	}

	/**
	 * @param {string} attribute
	 * @param {string|null} oldSrc
	 * @param {string|null} newSrc
	 */
	attributeChangedCallback(attribute, oldSrc, newSrc) {
		if (attribute == 'src' && newSrc) {
			this.hydrate(newSrc)
		}
	}

	disconnectedCallback() {
		// Should it really unmount
		this.#island?.unmount()
	}

	/**
	 * @param {string} islandSrc
	 */
	async hydrate(islandSrc) {
		/** @type {{default: DynamicIsland<any>}} */
		const { default: island } = await import(`/_ff-router/resource/${islandSrc}`)

		this.#island = island

		island.hydrate(this)
		this.#internals.states.add('hydrated')

		console.log(this.#internals.states, this.matches('route-island:state(hydrated)'))


	}

	static {
		customElements.define('route-island', RouteIslandContainer)
	}
}
