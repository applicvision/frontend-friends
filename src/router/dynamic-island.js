import { DynamicIsland } from '@applicvision/frontend-friends/island'

export class DynamicIslandContainer extends HTMLElement {
	static observedAttributes = ['href']

	/** @type {DynamicIsland<any>|null} */
	#island = null

	/**
	 * @param {string} attribute
	 * @param {string|null} oldHref
	 * @param {string|null} newHref
	 */
	attributeChangedCallback(attribute, oldHref, newHref) {
		if (attribute == 'href' && newHref) {
			this.hydrate(newHref)
		}
	}

	disconnectedCallback() {
		this.#island?.unmount()
	}

	/**
	 * @param {string} islandHref
	 */
	async hydrate(islandHref) {
		/** @type {{default: DynamicIsland<any>}} */
		const { default: island } = await import(viewDirectory + '/' + islandHref)

		this.#island = island
		const routerContainer = this.closest('router-outlet')

		if (routerContainer?.hasAttribute('dynamic')) {
			island.mount(this)
		} else {
			island.hydrate(this)
		}
	}
}

let viewDirectory = ''

/**
 * @param {string} viewDir
 */
export function register(viewDir, name = 'dynamic-island') {
	viewDirectory = viewDir
	customElements.define(name, DynamicIslandContainer)
}
