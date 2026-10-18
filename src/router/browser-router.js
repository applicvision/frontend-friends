import { BaseRouter } from './base-router.js'
import { FFOutlet, register } from './router-elements.js'

/**
 * @import {Route} from './base-router.js' 
 **/

export class Router extends BaseRouter {

	/** @type {{[key: string]: string}} */
	#viewCache = {}

	/**
	 * @param {string} view
	 */
	async #loadViewFile(view) {
		if (!this.#viewCache[view]) {
			const path = `__route-view/${view}`
			const response = await fetch(path)

			this.#viewCache[view] = await response.text()
		}
		return this.#viewCache[view]
	}

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

	async loadView() {

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


		const response = await fetch(`/_ff-router/view/${this.route.path}?${params}`)

		/** @type {{view: string, data: unknown}} */
		const { view, data } = await response.json()

		this.setData(data)
		outlet.innerHTML = view
	}


	async mount(options = {}) {
		const dataTransfer = document.getElementById('ff-router-data')?.textContent

		/** @type {{data?: unknown, store?: unknown} | null} */
		const initialData = dataTransfer ? JSON.parse(dataTransfer) : null

		super.mount({
			client: {
				path: location.pathname + location.search,
				storeData: initialData?.store,
				routeData: initialData?.data
			}
		})

		navigation.updateCurrentEntry({ state: initialData })

		register(this)

		// seedStore(this.store, initialData.store)
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

			event.intercept({
				handler: async () => {
					if (isTraversal && lastState) {
						// TODO: handle page change too
						this.setData(lastState)
						this.notifySubscribers()
						return
					}

					if (previousRoute == this.route) {
						const data = await this.loadRoute()
						this.route?.store?.insert(data)
						this.setData(data)
						navigation.updateCurrentEntry({ state: data })
						this.notifySubscribers()
						return
					}

					await this.loadView()
				}
			})
		})
	}
}

