
import { parse } from '@applicvision/frontend-friends/parse-shape'

/**
 * @import {AnyStore} from '../../types/src/store.js'
 * @typedef {{layout?: string,  view?: string, load?: Function, store?: AnyStore, children?: { [key: string]: RouteConfig }}} RouteConfig
 * @typedef {{routeChanged: () => void, router?: BaseRouter}} RouteSubscriber
 */


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

/**  @param {string[]} pathParts */
function normalizedPath(...pathParts) {
	return '/' + pathParts
		.flatMap(part => part.split('/'))
		.filter(Boolean)
		.join('/')
}


export class Route {

	/** @type {Route[]} */
	children = []

	/** @type {Route|null} */
	parent = null

	/** @type {AnyStore | null} */
	store = null

	/**
	 * @param {string} path
	 * @param {string} [layout]
	 * @param {string} [view]
	 * @param {Function} [load]
	 * @param {AnyStore} [store]
	 */
	constructor(path, layout, view, load, store) {
		if (path.includes(' ')) throw new Error('Path can not contain spaces')

		if (!layout && !view && !load) throw new Error(`Empty route: ${path}`)

		this.path = path
		this.view = view
		this.layout = layout
		this.loadData = load
		this.store = store ?? null
	}

	/**
	 * @param {string} path
	 * @param {string} [layout]
	 * @param {string} [view]
	 * @param {Function} [load]
	 * @param {AnyStore} [store]
	 */
	childRoute(path, layout, view, load, store) {
		if (!path) throw new Error('A child route must add a path segment')
		const child = new Route([this.path, path].filter(Boolean).join('/'), layout, view, load, store)
		// Put constant routes first
		if (path.startsWith(':')) {
			this.children.push(child)
		} else {
			this.children.unshift(child)
		}
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
}

export class BaseRouter {

	/** @type {Route | null} */
	#activeRoute = null

	/** @type {Record<string, string>} */
	#activeParams = {}

	/** @type {unknown|null} */
	#activeRouteData = null

	get routeData() {
		return this.#activeRouteData
	}

	/**
	 * @protected
	 * @param {Route} route
	 * @param {unknown} data
	 * @param {Record<string, string>} params
	 * @param {URLSearchParams} query
	 * @param {() => void} syncCallback
	 */
	setDataForRendering(route, data, params, query, syncCallback) {
		this.#activeRoute = route
		this.setData(data)
		this.#activeParams = params
		this.#activeQuery = query

		try {
			syncCallback()
		} finally {
			this.route?.store?.clear()
			this.#activeRouteData = null
			this.#activeParams = {}
			this.#activeQuery = new URLSearchParams()
			this.#activeRoute = null
		}
	}

	/**
	 * @protected
	 * @param {unknown} data
	 */
	setData(data, { skipStore = false } = {}) {
		this.#activeRouteData = data
		if (!skipStore) {
			this.route?.store?.upsert(data)
		}
	}

	#activeQuery = new URLSearchParams()

	/** @type {string|null} */
	#activePath = null

	#basePath = ''
	get basePath() { return this.#basePath }

	/** @param {RouteConfig} config */
	constructor(config) {
		const { layout, view, load, children, store } = config
		const rootRoute = new Route('', layout, view, load, store)
		this.#addChildRoutes(rootRoute, children)
		this.routes = rootRoute.routeList

		this.routeMap = Object.fromEntries(this.routes.map(route => [route.path, route]))

	}

	/** @type {Map<Route, URLPattern>|null} */
	#routePatterns = null

	/**
	 * @param {Route} route
	 * @param {{[key: string]: RouteConfig}|undefined} childrenSpec
	 */
	#addChildRoutes(route, childrenSpec) {
		if (!childrenSpec) return
		for (const key in childrenSpec) {
			const { view, layout, load, children, store } = childrenSpec[key]
			const childRoute = route.childRoute(key, layout, view, load, store)
			this.#addChildRoutes(childRoute, children)
		}
	}

	/**
	 * @protected
	 * @param {URL} url 
	 **/
	resolveAndUpdate(url) {
		const resolved = this.resolve(url)

		this.#activePath = resolved ? url.pathname : null
		this.#activeRoute = resolved?.route ?? null
		this.#activeParams = resolved?.params ?? {}
		this.#activeQuery = resolved?.query ?? new URLSearchParams()
	}

	/**
	 * @protected
	 * @param {string|URL} pathOrUrl 
	 **/
	resolve(pathOrUrl) {
		const patterns = this.#routePatterns
		if (!patterns) throw new Error('Router not mounted')

		for (const [route, pattern] of patterns) {
			const match = pattern.exec(pathOrUrl)

			if (match) {

				// For now, optional params are not permitted. Maybe in the future...
				const params = /** @type {Record<string, string>} */ (match.pathname.groups)
				return {
					route,
					params,
					query: new URLSearchParams(match.search.input)
				}
			}
		}
	}

	/** @param {unknown[]} args  */
	loadRoute(...args) {
		return this.route?.load(this.getJSON, this.#activeParams, this.query)
	}

	/**
	 * @template T
	 * @protected
	 * @param {T} responseShape
	 * @param {string | URL | Request} input
	 * @param {RequestInit=} init
	 */
	async getJSON(responseShape, input, init) {
		// Subclass on server implements an alternative getJSON
		return getJSON(responseShape, input, init)
	}

	get isMounted() { return this.#routePatterns != null }

	/**
	 * @param {{directory?: string, base?: string, client?: {path: string, storeData?: unknown, routeData?: unknown }}} options
	 */
	mount(options = {}) {
		if (options.base) {
			this.#basePath = normalizedPath(options.base)
		}
		this.#routePatterns = new Map(this.routes.map(route => [
			route, new URLPattern({ pathname: normalizedPath(this.basePath, route.path) + '{/}?' })
		]))
		if (options.client) {
			const { path, routeData, storeData } = options.client

			const match = this.resolve(path)
			if (!match) throw new Error(`Route could not be mounted at location: ${path}`)

			this.#activeRoute = match.route
			this.route?.store?.insert(storeData)
			this.#activeParams = match.params
			this.setData(routeData)
		}
	}

	get route() {
		return this.#activeRoute
	}

	get params() {
		this.#handleSubscribers()
		return this.#activeParams
	}

	/** @param {string} path */
	paramsFor(path) {
		this.#handleSubscribers()
		if (path == this.route?.path) {
			return this.#activeParams
		}
		console.warn('Asking for params for inactive path. Throw?')
		return this.#activeParams
	}

	/**
	 * @param {string} path 
	 * @param {Record<string, string>} params
	 **/
	linkTo(path, params = {}) {
		if (!this.isMounted) throw new Error('Router is not mounted')
		return Object.entries(params)
			.reduce(
				(path, [pathParam, value]) => path.replace(`:${pathParam}`, value),
				normalizedPath(this.basePath, path)
			)
	}

	/** @type {Set<RouteSubscriber>} */
	#subscribers = new Set()
	#handleSubscribers() {
		const subscriber = autoSubscribers.at(-1)
		if (subscriber && !subscriber.router) {
			this.#subscribers.add(subscriber)
			subscriber.router = this
		}
	}

	/**
	 * @param {RouteSubscriber} subscriber
	 */
	unsubscribe(subscriber) {
		this.#subscribers.delete(subscriber)
	}

	/** @protected */
	notifySubscribers() {
		console.log('calling all subscribers', this.#subscribers)
		this.#subscribers.forEach(subscriber => subscriber.routeChanged())
	}

	/** @param {string} path */
	dataFor(path) {
		this.#handleSubscribers()
		if (path == this.route?.path) {
			return this.#activeRouteData
		}
		console.warn('Asking for data for inactive path. Throw?')
		return this.#activeRouteData
	}

	get query() {
		this.#handleSubscribers()
		return this.#activeQuery
	}

	get path() {
		return this.#activePath
	}

	static Route = Route

	/** @param {object} config */
	static create(config) {
		return new this(config)
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
