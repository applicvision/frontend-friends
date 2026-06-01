import { seedStore } from '@applicvision/frontend-friends/store'
import { BaseRouter } from './base-router.js'
import { register as registerIslandComponent } from '@applicvision/frontend-friends/router/dynamic-island'

/** @import {AnyRoute} from './base-router.js' */

/** @extends BaseRouter<any> */
export class Router extends BaseRouter {

	/** @type {{[key: string]: string}} */
	#viewCache = {}

	/**
	 * @param {string} view
	 */
	async #loadViewFile(view) {
		if (!this.#viewCache[view]) {
			const path = `${this.viewDirectory}/${view}`
			const response = await fetch(path)

			this.#viewCache[view] = await response.text()
		}
		return this.#viewCache[view]
	}

	/**
	 * @param {AnyRoute?} previousRoute
	 */
	async loadView(previousRoute) {

		if (!this.route) throw new Error('Can not load view because there is no current route')

		/** @type {AnyRoute|null} */
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
		/** @type {AnyRoute[]?} */
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

	/**
	 * @param {string} path
	 */
	async mount(path) {
		this.resolve(path)
		/** @type {{route: any, store: any}} */
		const initialData = JSON.parse(document.getElementById('routedata')?.textContent ?? '')
		// @ts-ignore
		this.route._setData(initialData.route)
		navigation.updateCurrentEntry({ state: initialData.route })
		registerIslandComponent(this.viewDirectory)
		seedStore(this.store, initialData.store)
		navigation.addEventListener('navigate', (event) => {

			if (
				!event.canIntercept ||
				event.hashChange ||
				event.downloadRequest != null
			) {
				return
			}

			const url = new URL(event.destination.url)

			const previousRoute = this.route

			const routeExists = this.resolve(url.pathname)

			if (!routeExists) return


			const isTraversal = event.navigationType == 'traverse'
			const lastState = event.destination.getState()

			event.intercept({
				handler: async () => {
					if (isTraversal && lastState) {

						// @ts-ignore
						this.route._setData(lastState)
					} else {

						const data = await this.loadRoute()
						navigation.updateCurrentEntry({ state: data })
					}
					if (this.route != previousRoute) {
						await this.loadView(previousRoute)
					}
				}
			})
		})
	}
}

