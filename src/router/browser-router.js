import { BaseRouter } from './base-router.js'
import { FFOutlet, register } from './router-elements.js'

/**
 * @import {Route} from './base-router.js' 
 **/

export class Router extends BaseRouter {

	/** @type {Record<string, FFOutlet>} */
	#outlets = {}

	/** @param {FFOutlet} outlet */
	registerOutlet(outlet) {
		this.#outlets[outlet.owner] = outlet
		console.log('outlets', this.#outlets)
	}

	/** @param {FFOutlet} outlet */
	unregsiterOutlet(outlet) {
		delete this.#outlets[outlet.owner]
	}

	/**
	 * @param {NavigationHistoryEntry?} leavingEntry 
	 * @param {AbortSignal} signal
	 **/
	async #load(leavingEntry, signal) {

		if (!this.route) throw new Error('Can not load view because there is no current route')

		/** @type {FFOutlet|null} */
		let outlet = null
		/** @type {Route|null} */
		let route = this.route
		while (!outlet && route) {
			outlet = this.#outlets[route.path]
			route = route.parent
		}

		if (!outlet) throw new Error('Could not find outlet')

		const params = new URLSearchParams()

		params.set('query', this.query.toString())
		params.set('params', JSON.stringify(this.params))
		params.append('parent', outlet.owner)

		const response = await fetch(`${this.basePath}/_ff-router/view/${this.route.path}?${params}`, { signal })

		/** @type {{view: string, data: unknown}} */
		const { view, data } = await response.json()

		this.#clearOutlet(outlet, leavingEntry)

		this.setData(data)
		outlet.innerHTML = view
	}

	/**
	 * 
	 * @param {unknown} data
	 * @param {{ skipStore?: boolean }} [options]
	 */
	setData(data, options) {
		super.setData(data, options)
		const { currentEntry } = navigation
		if (currentEntry && !this.#dataCache.has(currentEntry.id)) {
			this.#dataCache.set(currentEntry.id, data)
			currentEntry.addEventListener('dispose', () => this.#dataCache.delete(currentEntry.id))
		}
		this.notifySubscribers()
	}

	/** @type {Map<string, {fragment:DocumentFragment, outlet: FFOutlet}>} */
	#domCache = new Map()

	/** @type {Map<string, unknown>} */
	#dataCache = new Map()

	/**
	 * @param {FFOutlet} outlet
	 * @param {NavigationHistoryEntry?} entry
	 */
	#clearOutlet(outlet, entry) {
		const range = document.createRange()
		range.selectNodeContents(outlet)
		const fragment = range.extractContents()
		if (entry) {
			this.#domCache.set(entry.id, { fragment, outlet })
			entry.addEventListener('dispose', () => this.#domCache.delete(entry.id), { once: true })
		}
	}

	/** @param {NavigateEvent} event */
	async #loadRouteData(event) {
		const cachedData = this.#dataCache.get(event.destination.id)
		if (cachedData) {
			console.log('using cache')
			// Do not set stale data to the store.
			// It might have been written to later.
			this.setData(cachedData, { skipStore: true })
		} else {
			const data = await this.loadRoute()
			if (event.signal.aborted) return
			this.setData(data)
		}
	}


	/** @param {{base?: string}|undefined} options */
	async mount(options = {}) {
		const dataTransfer = document.getElementById('ff-router-data')?.textContent

		/** @type {{data?: unknown} | null} */
		const initialData = dataTransfer ? JSON.parse(dataTransfer) : null

		super.mount({
			...options,
			client: {
				path: location.href,
				data: initialData?.data
			}
		})

		register(this)

		navigation.addEventListener('navigate', (event) => {

			if (
				!event.canIntercept ||
				event.hashChange ||
				event.downloadRequest != null
			) {
				return
			}

			const previousRoute = this.route

			this.resolveAndUpdate(new URL(event.destination.url))

			if (!this.route) return

			const leavingEntry = navigation.currentEntry

			event.intercept({
				handler: async () => {

					// Same route navigation
					if (previousRoute == this.route) {
						console.log('handling same route nav')
						await this.#loadRouteData(event)
						return
					}

					const cachedDom = this.#domCache.get(event.destination.id)

					if (cachedDom && cachedDom.outlet.isConnected) {
						const { fragment, outlet } = cachedDom
						this.#clearOutlet(outlet, leavingEntry)
						await this.#loadRouteData(event)
						outlet.appendChild(fragment)
						this.#domCache.delete(event.destination.id)
						return
					}

					try {
						await this.#load(leavingEntry, event.signal)
					} catch (err) {
						console.log(err)
					}
				}
			})
		})
	}
}

