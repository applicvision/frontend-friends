import { BaseRouter } from './base-router.js'
import './route-island.js'

/** @import {Route} from './base-router.js' */

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

	/**
	 * @param {Route?} previousRoute
	 */
	async loadView(previousRoute) {

		if (!this.route) throw new Error('Can not load view because there is no current route')

		/** @type {Route|null} */
		let commonParent = null
		let index = 0
		while (
			previousRoute &&
			index < this.route.parentChain.length &&
			index < previousRoute.parentChain.length &&
			previousRoute.parentChain[index] == this.route.parentChain[index]
		) {
			commonParent = this.route.parentChain[index]
			index += 1
		}

		/** @type {Element?} */
		let container = null
		/** @type {Route[]?} */
		let routeChainToLoad = null

		if (commonParent) {
			container = document.querySelector(`router-outlet[owner="${commonParent.view}"]`)
			routeChainToLoad = this.route.parentChain.slice(index).concat(this.route)
		} else if (this.baseView) {
			container = document.querySelector(`router-outlet[owner="${this.baseView}"]`)
			routeChainToLoad = this.route.parentChain.concat(this.route)
		}

		if (!(container && routeChainToLoad)) {
			// console.log('Ooops, dont know where to put view')
			throw new Error('Can not render')

		}
		const viewHtml = await Promise.all(routeChainToLoad.map(route => this.#loadViewFile(route.view)))

		const transition = document.startViewTransition(() => {

			container.innerHTML = ''

			container.toggleAttribute('dynamic', true)
			const template = document.createElement('template')
			/** @type {Element?} */
			let nextOutlet = container
			viewHtml.forEach((view, index) => {
				template.innerHTML = view
				let routerOutlet = null
				if (index < viewHtml.length - 1) {
					routerOutlet = template.content.querySelector('router-outlet')

					routerOutlet?.setAttribute('owner', routeChainToLoad[index].view)
					routerOutlet?.toggleAttribute('dynamic', true)
				}
				nextOutlet?.appendChild(template.content)
				nextOutlet = routerOutlet
			})
		})

		await transition.finished
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

					await this.loadView(previousRoute)
				}
			})
		})
	}
}

