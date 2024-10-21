/** @typedef {{routeChanged: () => void, routeSubscription: AnyRoute?}} RouteSubscriber */

import { parse } from '@applicvision/frontend-friends/parse-shape'


/** @import {AnyStore} from '@applicvision/frontend-friends/store' */

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

/**
 * @template {{[key: string]: StringConstructor|NumberConstructor}} T
 * @typedef {{[key in keyof T]: ReturnType<T[key]>}} ParamValue
 */

/**
 * @typedef {Route<any, any, any>} AnyRoute
 */


/**
 * @template {string} PathTemplate
 * @template {{[key: string]: StringConstructor|NumberConstructor}} [ParamTemplate={}]
 * @template {any|null} [DataShape=null]
 **/
export class Route {

	/** @type {AnyRoute[]} */
	children = []

	#active = false

	/** @type {AnyRoute|null} */
	parent = null

	/** @type {DataShape} */
	// @ts-ignore
	#data = null

	/**
	 * @type {ParamValue<ParamTemplate>}
	 **/
	// @ts-ignore
	#params = {}

	/** @type {ParamTemplate} */
	#paramsShape

	/** 
	 * @param {PathTemplate} path
	 * @param {{
	 * 	params?: ParamTemplate,
	 *	view: string,
	 *	load?: (get: typeof getJSON, params: ParamValue<ParamTemplate>, query: URLSearchParams) => Promise<DataShape>,
	 * 	}} config
	 **/
	constructor(path, { view, load, params }) {
		this.path = path
		if (path.includes(' ')) throw new Error('Path can not contain spaces')

		this.view = view
		this.loadData = load
		// @ts-ignore
		this.#paramsShape = params ?? {}

		/** @type {({type: 'constant', value: string} | {type: 'param', name: string})[]} */
		this.pathParts = path.split('/').filter(Boolean).map(part =>
			part.startsWith(':') ?
				{ type: 'param', name: part.slice(1) } :
				{ type: 'constant', value: part }
		)
	}

	/**
	 * @template {string} ChildPathTemplate
	 * @template {{[key: string]: StringConstructor|NumberConstructor}} [ChildParamTemplate={}]
	 * @template {any} [ChildDataShape=null]
	 * @param {ChildPathTemplate} path
	 * @param {{
		* params?: ChildParamTemplate,
		* view: string,
		* load?: (get: typeof getJSON, params: ParamValue<ChildParamTemplate & ParamTemplate>, query: URLSearchParams) => Promise<ChildDataShape>,
		* name?: string}} config
	*/
	child(path, { params, ...config }) {
		const combinedParams = { ...this.#paramsShape, ...params }
		const child = new Route(`${this.path}/${path}`, {
			...config,
			// @ts-ignore ts2322
			params: combinedParams
		})
		this.children.push(child)
		child.parent = this
		return child
	}

	/** @type {AnyRoute[]} */
	get routeList() {
		return [
			this,
			...this.children.flatMap(childRoute => childRoute.routeList)
		]
	}

	/** @type {Set<RouteSubscriber>} */
	#subscribers = new Set()

	/**
	 * @param {RouteSubscriber} subscriber
	 */
	subscribe(subscriber) {
		subscriber.routeSubscription = this
		this.#subscribers.add(subscriber)
	}

	/**
	 * @param {RouteSubscriber} subscriber
	 */
	unsubscribe(subscriber) {
		this.#subscribers.delete(subscriber)
	}

	/**
	 * @param {typeof getJSON} get
	 * @param {ParamValue<ParamTemplate>} params
	 * @param {URLSearchParams} query
	 */
	async load(get, params, query) {
		const data = await this.loadData?.(get, params, query)
		if (data) {
			this._setData(data)
		}
		return data ?? null
	}

	get data() {
		if (autoSubscriber) {
			this.subscribe(autoSubscriber)
		}
		return this.#data
	}

	/**
	 * @private
	 * @param {DataShape} data
	*/
	_setData(data) {
		this.#data = data
		this.#subscribers.forEach(subscriber => subscriber.routeChanged())
	}

	get params() {
		if (autoSubscriber) {
			this.subscribe(autoSubscriber)
		}
		return this.#params
	}

	/**
	 * @private
	 * @param {ParamValue<ParamTemplate>} params
	 */
	_setParams(params) {
		this.#params = params
		this.#subscribers.forEach(subscriber => subscriber.routeChanged())
	}

	/**
	 * @private
	 * @param {boolean} activeValue
	 */
	_setActive(activeValue) {
		this.#active = activeValue
		this.parent?._setActive(activeValue)
	}

	get active() {
		return this.#active
	}

	/**
	 * @type {AnyRoute[]}
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

		/** @type {ParamValue<ParamTemplate>} */
		// @ts-ignore
		const params = Object.fromEntries(Object.keys(this.params ?? {}).map(paramName => [paramName, undefined]))
		for (let index = 0; index < pathParts.length; index += 1) {
			const part = this.pathParts[index]
			if (part.type == 'constant' && part.value != pathParts[index]) {
				return null
			}
			if (part.type == 'param') {
				const typeFunction = this.#paramsShape[part.name]
				// @ts-ignore
				params[part.name] = typeFunction ? typeFunction(pathParts[index]) : pathParts[index]
			}
		}
		return { params }
	}

	/**
	 * @param {ParamValue<ParamTemplate>} paramValues
	 */
	linkWith(paramValues) {

		return Object.entries(paramValues).reduce(
			(path, [paramKey, paramValue]) =>
				path.replace(`:${paramKey}`, String(paramValue))
			,
			/** @type {string} */(this.path)
		)
	}
}


/** @template {{[key:string]: AnyStore}} T */
export class BaseRouter {

	/** @type {AnyRoute | null} */
	#activeRoute = null


	/** @type {{[key: string]: any}} */
	#activeParams = {}

	#activeQuery = new URLSearchParams()

	/** @type {string|null} */
	#activePath = null

	/** @type {AnyRoute[]|null} */
	#activeParentChain = null

	/**
	 * @param {{store: T, viewDirectory: string, baseView?: string, routerLocation?: string}} setup
	 * @param {AnyRoute[]} rootRoutes
	 */
	constructor(setup, rootRoutes) {
		this.store = setup.store
		this.viewDirectory = setup.viewDirectory.replace(/\/$/, '')
		this.routerLocation = setup.routerLocation
		this.baseView = setup.baseView
		this.routes = rootRoutes.flatMap(route => route.routeList)
		console.log('allroutes', this.routes)
	}

	/**
	 * @param {string} pathString
	 */
	resolve(pathString) {
		const [path, query] = pathString.split('?')
		const parts = path.split('/').filter(Boolean)

		// @ts-ignore
		this.#activeRoute?._setActive(false)

		for (const route of this.routes) {
			const match = route.match(parts)
			if (match) {
				this.#activeRoute = route
				// @ts-ignore
				route._setActive(true)
				// @ts-ignore
				route._setParams(match.params)
				this.#activeParams = match.params
				this.#activePath = pathString
				this.#activeQuery = new URLSearchParams(query)
				return true
			}
		}
		this.#activePath = null
		this.#activeParams = {}
		this.#activeRoute = null
		this.#activeParentChain = null
		this.#activeQuery = new URLSearchParams()
		return false
	}

	async render() {
		console.log('implemented by subclass')
		return ''
	}

	/**
	 * @abstract
	 * @param {string} destination
	 */
	async transitionTo(destination) { }

	/**
	 * @param {any=} args
	 */
	loadRoute(args) {
		return this.route?.load(this.getJSON, this.params, this.query)
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
		return this.#activeRoute
	}

	get params() {
		return this.#activeParams
	}

	get query() {
		return this.#activeQuery
	}

	get path() {
		return this.#activePath
	}

	get parentChain() {
		return this.#activeParentChain
	}
}

/** @type {RouteSubscriber | null} */
let autoSubscriber = null


/**
 * @template T
 * @param {RouteSubscriber} subscriber
 * @param {() => T} callback
 */
export function autoSubscribe(subscriber, callback) {
	autoSubscriber = subscriber
	const returnValue = callback()
	autoSubscriber = null
	return returnValue
}

/**
 * @template {string} PathTemplate
 * @template {{[key: string]: StringConstructor|NumberConstructor}} ParamTemplate
 * @param {PathTemplate} path
 * @param {{ params?: ParamTemplate, view: string, name?: string }} config
 */
export function route(path, config) {
	return new Route(path, config)
}
