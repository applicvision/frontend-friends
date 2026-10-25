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

	/** @param {NavigationHistoryEntry?} leavingEntry */
	async #load(leavingEntry) {

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

		const response = await fetch(`${this.basePath}/_ff-router/view/${this.route.path}?${params}`)

		/** @type {{view: string, data: unknown}} */
		const { view, data } = await response.json()

		if (leavingEntry) {
			const range = document.createRange()
			range.selectNodeContents(outlet)
			this.#cache.set(leavingEntry.id, {
				fragment: range.extractContents(),
				outlet,
				data: this.routeData
			})
			leavingEntry.addEventListener('dispose', () => {
				this.#cache.delete(leavingEntry.id)
			}, { once: true })
		}

		this.setData(data)
		outlet.innerHTML = view
	}

	/** @type {Map<string, {fragment:DocumentFragment, data: unknown, outlet: FFOutlet}>} */
	#cache = new Map()


	/** @param {{base?: string}|undefined} options */
	async mount(options = {}) {
		const dataTransfer = document.getElementById('ff-router-data')?.textContent

		/** @type {{data?: unknown, store?: unknown} | null} */
		const initialData = dataTransfer ? JSON.parse(dataTransfer) : null

		super.mount({
			...options,
			client: {
				path: location.pathname + location.search,
				storeData: initialData?.store,
				routeData: initialData?.data
			}
		})

		navigation.updateCurrentEntry({ state: initialData })

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

			const isTraversal = event.navigationType == 'traverse'
			const lastState = event.destination.getState()

			const leavingEntry = navigation.currentEntry

			event.intercept({
				handler: async () => {
					if (isTraversal) {
						const cached = this.#cache.get(event.destination.id)
						if (cached && cached.outlet.isConnected) {

							if (this.route == previousRoute) {
								this.setData(cached.data)
							} else {
								const range = document.createRange()
								range.selectNodeContents(cached.outlet)
								const fragment = range.extractContents()
								if (leavingEntry) {
									this.#cache.set(leavingEntry.id, {
										fragment,
										// TODO: not sure this is the right outlet
										outlet: cached.outlet,
										data: this.routeData
									})
								}
								// Do not set stale data to the store.
								// It might have been written to later.
								this.setData(cached.data, { skipStore: true })
								cached.outlet.appendChild(cached.fragment)
							}
							this.#cache.delete(event.destination.id)
							this.notifySubscribers()
							return
						}
					}

					if (previousRoute == this.route) {
						console.log('handling same route navigation')
						const data = await this.loadRoute()
						this.setData(data)
						navigation.updateCurrentEntry({ state: data })
						this.notifySubscribers()
						return
					}

					try {
						await this.#load(leavingEntry)
					} catch (err) {
						console.log(err)
					}
				}
			})
		})
	}
}

