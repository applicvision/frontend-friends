import { DeclarativeElement, html } from '@applicvision/frontend-friends'

/**
 * @import { DynamicIsland } from '@applicvision/frontend-friends/island'
 * @import {Router} from './browser-router.js'
 */

export class RouteIslandContainer extends HTMLElement {
	static observedAttributes = ['src']

	/** @type {DynamicIsland<any>|null} */
	#island = null

	/** @type {ElementInternals} */
	#internals


	get isHydrated() {
		return this.#internals.states.has('hydrated')
	}

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
			// Islands which are part of the initial page are hydrated.
			// Islands added later, by client side navigation, are mounted since the
			// client state (for instance a store) may differ from the state used on the server.
			this.#load(newSrc, isInitialPage)
		}
	}

	disconnectedCallback() {
		this.#island?.unmount(true)
	}

	connectedCallback() {
		if (this.isHydrated) {
			this.#island?.mount(this)
		}
	}

	/**
	 * @param {string} islandSrc
	 * @param {boolean} hydrate
	 */
	async #load(islandSrc, hydrate) {

		const [filePath, exportName = 'default'] = islandSrc.split('?')

		/** @type {Record<string, DynamicIsland>} */
		const { [exportName]: island } = await import(`${router?.basePath ?? ''}/_ff-router/resource/${filePath}`)

		this.#island = island

		if (hydrate) {
			island.hydrate(this)
		} else {
			island.mount(this)
		}
		this.#internals.states.add('hydrated')
	}
}

export class FFOutlet extends DeclarativeElement {

	get owner() {
		return this.getAttribute('owner') ?? ''
	}

	connectedCallback() {
		super.connectedCallback()
		router?.registerOutlet(this)

	}

	disconnectedCallback() {
		router?.unregsiterOutlet(this)
	}

	render() {
		return html`<slot></slot>`
	}
}

/** @type {Router|null} */
let router = null

/** True while the elements already in the document are upgraded */
let isInitialPage = false

/**
 * @param {Router} _router
 */
export function register(_router) {
	router = _router
	isInitialPage = true
	try {
		customElements.define('ff-island', RouteIslandContainer)
		customElements.define('ff-outlet', FFOutlet)
	} finally {
		isInitialPage = false
	}
}
