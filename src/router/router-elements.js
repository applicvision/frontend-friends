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


	get isMounted() {
		return this.#internals.states.has('mounted')
	}

	get isHydratable() {
		return this.hasAttribute('hydratable')
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
			this.#load(newSrc)
		}
	}

	disconnectedCallback() {
		this.#island?.unmount(true)
	}

	connectedCallback() {
		if (this.isMounted) {
			this.#island?.mount(this)
		}
	}

	/**
	 * @param {string} islandSrc
	 */
	async #load(islandSrc) {

		const [filePath, exportName = 'default'] = islandSrc.split('?')

		/** @type {Record<string, DynamicIsland>} */
		const { [exportName]: island } = await import(`${router?.basePath ?? ''}/_ff-router/resource/${filePath}`)

		this.#island = island

		if (this.isHydratable) {
			island.hydrate(this)
			this.removeAttribute('hydratable')
		} else {
			island.mount(this)
		}
		this.#internals.states.add('mounted')
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
