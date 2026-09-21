/** @typedef {{routeChanged: () => void}} RouteSubscriber */

import { parse } from '@applicvision/frontend-friends/parse-shape'

/** 
 * @import {RouteConfig, AllroutePaths, RouteData} from '../../types/type-utils.js'
 **/

/**
 * @typedef {{layout?: string,  view?: string, load?: Function, children?: { [key: string]: SimplifiedConfig }}} SimplifiedConfig
 */

/**
 * @template T
 * @param {RouteConfig<T>} routerSpecification
 */
export function router(routerSpecification) {

}



/**
 * @template T
 * @param {T} responseShape
 * @param {string | URL | Request} input
 * @param {RequestInit=} init
 */
export async function getJSON(responseShape, input, init) {
	const response = await fetch(input, init)
	if (!response.ok) {
		throw new Error('Unexpected response: ' + response.status)
	}
	const rawResponse = await response.json()
	return parse(responseShape, rawResponse)
}


export class Route {

	/** @type {Route[]} */
	children = []

	#active = false

	/** @type {Route|null} */
	parent = null

	/**
	 * @param {string} path
	 * @param {string} [layout]
	 * @param {string} [view]
	 * @param {Function} [load]
	 */
	constructor(path, layout, view, load) {
		this.path = path
		if (path.includes(' ')) throw new Error('Path can not contain spaces')

		this.view = view
		this.layout = layout
		this.loadData = load

		if (!layout && !view && !load) throw new Error(`Empty route: ${path}`)

		/** @type {({type: 'constant', value: string} | {type: 'param', name: string})[]} */
		this.pathParts = path.split('/').filter((part) => part.length > 0).map(part =>
			part.startsWith(':') ?
				{ type: 'param', name: part.slice(1) } :
				{ type: 'constant', value: part }
		)
	}

	/**
	 * @param {string} path
	 * @param {string} [layout]
	 * @param {string} [view]
	 * @param {Function} [load]
	 */
	childRoute(path, layout, view, load) {
		if (!path) throw new Error('A child route must add a path segment')
		const child = new Route(`${this.path}/${path}`, layout, view, load)
		this.children.push(child)
		child.parent = this
		return child
	}

	/** @type {Route[]} */
	get routeList() {
		return [
			this,
			...this.children.flatMap(childRoute => childRoute.routeList)
		]
	}

	/**
	 * @param {typeof getJSON} get
	 * @param {Record<string, string>} params
	 * @param {URLSearchParams} query
	 */
	async load(get, params, query) {
		return this.loadData?.(get, params, query)
	}

	/**
	 * @param {boolean} activeValue
	 */
	#setActive(activeValue) {
		this.#active = activeValue
		if (this.parent) {
			this.parent.#setActive(activeValue)
		}
	}

	/**
	 * @param {Route} route
	 * @param {boolean} activeValue
	 */
	static updateActiveState(route, activeValue) {
		route.#setActive(activeValue)
	}

	get active() {
		return this.#active
	}

	/**
	 * @type {Route[]}
	 */
	get parentChain() {
		if (this.parent) {
			return [this.parent.parentChain, this.parent].flat()
		}
		return []
	}

	/**
	 * @param {string[]} pathParts
	 **/
	match(pathParts) {

		if (this.pathParts.length != pathParts.length) return null


		/** @type {Record<string, string>} */
		const params = {}
		for (let index = 0; index < pathParts.length; index += 1) {
			const routePart = this.pathParts[index]
			const actualPathPart = pathParts[index]
			if (routePart.type == 'constant' && routePart.value != actualPathPart) {
				return null
			}
			if (routePart.type == 'param') {
				params[routePart.name] = actualPathPart
			}
		}
		return { params }
	}
}


/** 
 * @template [Config=any] 
 */
export class BaseRouter {

	/** @type {Route | null} */
	#_activeRoute = null

	/** @param {Route|null} route */
	set #activeRoute(route) {
		if (this.#_activeRoute) {
			Route.updateActiveState(this.#_activeRoute, false)
		}
		if (route) Route.updateActiveState(route, true)
		this.#_activeRoute = route
	}

	/** @type {{[key: string]: any}} */
	#activeParams = {}

	/** @type {unknown|null} */
	#activeRouteData = null

	get routeData() {
		return this.#activeRouteData
	}

	/**
	 * @template {AllroutePaths<Config>} Path
	 * @param {Path} routePath
	 * @return {RouteData<Config,Path>}
	 */
	routeDataFor(routePath) {
		return this.routeData
	}

	/**
	 * @protected
	 * @param {unknown} data
	 */
	setCurrentRouteData(data) {
		this.#activeRouteData = data
	}

	#activeQuery = new URLSearchParams()

	/** @type {string|null} */
	#activePath = null

	#basePath = '/'
	get basePath() { return this.#basePath }

	/**
	 * @param {string} basePath
	 * @param {SimplifiedConfig} config
	 */
	constructor(basePath, config) {
		const { layout, view, load, children } = config
		const rootRoute = new Route(basePath, layout, view, load)
		this.#basePath = basePath
		this.#addChildRoutes(rootRoute, children)
		this.routes = rootRoute.routeList
	}

	/**
	 * @param {Route} route
	 * @param {{[key: string]: SimplifiedConfig}|undefined} childrenSpec
	 */
	#addChildRoutes(route, childrenSpec) {
		if (!childrenSpec) return
		for (const key in childrenSpec) {
			const { view, layout, load, children } = childrenSpec[key]
			const childRoute = route.childRoute(key, layout, view, load)
			this.#addChildRoutes(childRoute, children)
		}
	}

	/**
	 * @param {string} pathString
	 */
	resolve(pathString) {
		const [path, query] = pathString.split('?')
		const parts = path.split('/').filter(Boolean)

		for (const route of this.routes) {
			const match = route.match(parts)
			if (match) {
				this.#activeRoute = route
				this.#activeParams = match.params
				this.#activePath = pathString
				this.#activeQuery = new URLSearchParams(query)
				return true
			}
		}
		this.#activePath = null
		this.#activeParams = {}
		this.#activeRoute = null
		this.#activeQuery = new URLSearchParams()
		return false
	}

	/** @param {unknown} [arg]  */
	loadRoute(arg) {
		return this.route?.load(this.getJSON, this.#activeParams, this.query)
	}

	/**
	 * @template T
	 * @param {T} responseShape
	 * @param {string | URL | Request} input
	 * @param {RequestInit=} init
	 */
	async getJSON(responseShape, input, init) {
		// Subclass on server implements an alternative getJSON
		return getJSON(responseShape, input, init)
	}

	/**
	 * @param {any[]} args
	 */
	mount(...args) {
		console.warn('Mount should be implemented in subclass')
	}


	get route() {
		return this.#_activeRoute
	}

	get params() {
		return this.#activeParams
	}

	paramsFor(path) {

	}

	get query() {
		return this.#activeQuery
	}

	get path() {
		return this.#activePath
	}

	static Route = Route

	/**
	 * @template T
	 * @overload
	 * @param {RouteConfig<T>} config
	 * @return {BaseRouter<T>}
	*/

	/**
	 * @template T
	 * @overload
	 * @param {string|RouteConfig<T>} base
	 * @param {RouteConfig<T>} config
	 * @return {BaseRouter<T>}
	 */

	/**
	 * @template T
	 * @param {string|RouteConfig<T>} baseOrConfig
	 * @param {RouteConfig<T>} [config]
	 */
	static create(baseOrConfig, config) {
		if (typeof baseOrConfig == 'string') {
			if (typeof config == 'object') {
				return new this(baseOrConfig, config)
			}
			throw new Error('Missing config')
		}
		return new this('', baseOrConfig)
	}
}

/** @type {RouteSubscriber[]} */
const autoSubscribers = []


/**
 * @template T
 * @param {RouteSubscriber} subscriber
 * @param {() => T} callback
 */
export function autoSubscribe(subscriber, callback) {
	autoSubscribers.push(subscriber)
	try {
		return callback()
	} finally {
		autoSubscribers.pop()
	}
}




BaseRouter.create({
	layout: 'index.html',
	view: 'start.html',
	children: {
		users: {
			layout: 'usercommon.html',
			view: 'userlist.html',
			async load() { },
			children: {
				new: {
					view: 'newuser.html'
				},
				':id': {
					view: 'user.html',
					async load(get, params) {
					},
					children: {
						':idd': {
							view: '',
							async load(get, params) {
							}
						}
					}
				}
			}
		}
	}
})
