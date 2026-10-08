
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
		this.path = path
		if (path.includes(' ')) throw new Error('Path can not contain spaces')

		this.view = view
		this.layout = layout
		this.loadData = load
		this.store = store ?? null

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
	 * @param {AnyStore} [store]
	 */
	childRoute(path, layout, view, load, store) {
		if (!path) throw new Error('A child route must add a path segment')
		const child = new Route([this.path, path].filter(Boolean).join('/'), layout, view, load, store)
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
	 * @param {Route} route
	 * @param {boolean} activeValue
	 */
	static updateActiveState(route, activeValue) {
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
		this.#activeRouteData = data
		this.#activeParams = params
		this.#activeQuery = query
		this.#activeRoute = route

		if (data) {
			route.store?.insert(data)
		}
		try {
			syncCallback()
		} finally {
			this.#activeRouteData = null
			route.store?.clear()
			this.#activeParams = {}
			this.#activeQuery = new URLSearchParams()
		}
	}

	/**
	 * @protected
	 * @param {unknown} data
	 */
	setData(data) {
		this.#activeRouteData = data
		// autoSubscribers.forEach(subscriber => subscriber.routeChanged())
	}

	#activeQuery = new URLSearchParams()

	/** @type {string|null} */
	#activePath = null

	#basePath = ''
	get basePath() { return this.#basePath }

	/**
	 * @param {string} basePath
	 * @param {RouteConfig} config
	 */
	constructor(basePath, config) {
		const { layout, view, load, children, store } = config
		const rootRoute = new Route(basePath, layout, view, load, store)
		this.#basePath = basePath
		this.#addChildRoutes(rootRoute, children)
		this.routes = rootRoute.routeList
	}

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

	/** @param {URL} url */
	resolveAndUpdate(url) {
		const resolved = this.resolve(url)

		this.#activePath = resolved ? url.pathname : null
		this.#activeRoute = resolved?.route ?? null
		this.#activeParams = resolved?.params ?? {}
		this.#activeQuery = resolved?.query ?? new URLSearchParams()
	}

	/** @param {string|URL} pathOrUrl */
	resolve(pathOrUrl) {
		console.log('resolving', pathOrUrl)
		let path = '', query = null

		if (typeof pathOrUrl == 'string') {
			const parts = pathOrUrl.split('?')
			path = parts[0]
			query = new URLSearchParams(parts[1])
		} else {
			path = pathOrUrl.pathname
			query = pathOrUrl.searchParams
		}

		const parts = path.split('/').filter(Boolean)

		for (const route of this.routes) {
			const match = route.match(parts)
			if (match) {
				return {
					route,
					params: match.params,
					query
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

	/**
	 * @param {{directory?: string, client?: {path: string, storeData?: unknown, routeData?: unknown }}} arg
	 */
	mount(arg) {
		if (arg.client) {
			const { path, routeData, storeData } = arg.client

			const match = this.resolve(path)
			if (!match) throw new Error(`Route could not be mounted at location: ${path}`)

			this.#activeRoute = match.route
			this.route?.store?.insert(storeData)
			this.#activeParams = match.params
			this.#activeRouteData = routeData
		}
	}

	get route() {
		return this.#_activeRoute
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
	linkTo(path, params) {
		return Object.entries(params)
			.reduce((path, [pathParam, value]) => path.replace(`:${pathParam}`, value), `${this.basePath}/${path}`)
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

	/**
	 * @param {string|object} baseOrConfig
	 * @param {object} [config]
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
