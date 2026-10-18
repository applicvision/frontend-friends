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
			this.hydrate(newSrc)
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
	 */
	async hydrate(islandSrc) {

		// TODO: fix basepath
		/** @type {{default: DynamicIsland<any>}} */
		const { default: island } = await import(`/_ff-router/resource/${islandSrc}`)

		this.#island = island

		island.hydrate(this)
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

/**
 * @param {Router} _router
 */
export function register(_router) {
	router = _router
	customElements.define('ff-island', RouteIslandContainer)
	customElements.define('ff-outlet', FFOutlet)
}
