import { seedStore } from '@applicvision/frontend-friends/store'
import { BaseRouter } from '@applicvision/frontend-friends/base-router'
import { register as registerIslandComponent } from '@applicvision/frontend-friends/router/dynamic-island'
import { register as registerRouterLink } from '@applicvision/frontend-friends/router/router-link'

/** @import {AnyRoute} from '@applicvision/frontend-friends/base-router' */

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
	 * @param {PopStateEvent} event
	 */
	async #handlePopState(event) {
		const { route: previousRoute } = this
		this.resolve(location.pathname)
		if (this.route != previousRoute) {
			await this.loadView(previousRoute)
		}
		// @ts-ignore
		this.route._setData(event.state)
	}

	/**
	 * @param {string} destination
	 */
	async transitionTo(destination) {
		const { route: previousRoute, path: previousPath } = this

		if (!this.resolve(destination)) {
			console.log('not found, handle')
			return
		}

		if (previousPath != destination) {
			history.pushState(null, '', destination)
		}

		if (previousRoute != this.route) {
			await this.loadView(previousRoute)
		}
		const routeData = await this.loadRoute()

		history.replaceState(routeData, '')
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
			console.log('Ooops, dont know where to put view')
			throw new Error('Can not render')

		}

		container.innerHTML = ''

		container.toggleAttribute('dynamic', true)
		const viewHtml = await Promise.all(routeChainToLoad.map(route => this.#loadViewFile(route.view)))
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
		registerIslandComponent(this.viewDirectory)
		registerRouterLink(this)
		seedStore(this.store, initialData.store)
		onpopstate = this.#handlePopState.bind(this)
		history.replaceState(initialData.route, '')
	}
}

