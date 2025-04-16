import { DynamicFragment, html } from '@applicvision/frontend-friends/dynamic-fragment'
import { autoSubscribe as storeSubscribe } from '@applicvision/frontend-friends/store'
import { autoSubscribe as routeSubscribe } from '@applicvision/frontend-friends/base-router'
import { deepWatch } from '@applicvision/frontend-friends/deep-watch'

/**
 * @import {AutoSubscriber, AnyStore as ResourceStore} from './store.js'
 * @import {RouteSubscriber, AnyRoute} from './router/base-router.js'
 */

/**
 * @template {{[key: string]: any, state?: object}} T
 * @implements {AutoSubscriber}
 * @implements {RouteSubscriber}
 **/
export class DynamicIsland extends EventTarget {

	/** @type {HTMLElement?} */
	#container = null

	/** @type {Omit<T, "state">?} */
	#renderProps = null

	/** @type {T['state']?} */
	#state = null

	/** @type {Set<ResourceStore>} */
	subscriptions = new Set()

	/** @type {AnyRoute | null} */
	routeSubscription = null

	#render

	#setup

	/**
	 * @param {() => T} setup
	 * @param {((state: T) => ReturnType<html>)} renderFunction
	 */
	constructor(setup, renderFunction) {
		super()
		this.#render = renderFunction
		this.#setup = setup
	}

	/** @type {Promise<any>|null} */
	pendingUpdate = null
	invalidate() {
		return this.pendingUpdate ??= Promise.resolve().then(() => {
			// console.time('render')
			this.#internalRender()
			// console.timeEnd('render')
			this.pendingUpdate = null
			// TODO: maybe signal update
		})
	}

	storeChanged() {
		this.invalidate()
	}

	routeChanged() {
		const { state, ...otherProps } = this.#setup()
		this.#renderProps = otherProps
		this.state = state
		this.#internalRender()
	}

	set state(state) {
		this.#state = deepWatch(state ?? {}, (keypath, newValue, oldValue) => {
			if (newValue !== oldValue) {
				this.invalidate()
			}
		})
	}

	/** @type {T['state']} */
	get state() {
		// @ts-ignore
		return this.#state
	}

	#reactiveSetup() {
		const { state, ...otherProps } = routeSubscribe(
			this,
			() => storeSubscribe(this, this.#setup))

		this.#renderProps = otherProps
		this.state = state
	}

	/** @param {HTMLElement} container */
	mount(container) {

		this.#reactiveSetup()

		this.#container = container
		if (this.#currentFragment) {
			/** @type {T} */
			// @ts-ignore
			const renderArg = { ...this.#renderProps, state: this.state }

			this.#restoreFromCache(this.#render(renderArg))
		} else {
			// console.time('initial render')
			this.#internalRender()
			// console.timeEnd('initial render')
		}
		this.dispatchEvent(new Event('mount'))
	}

	/**
	 * @param {HTMLElement} container
	 **/
	hydrate(container) {

		this.#reactiveSetup()

		/** @type {T} */
		// @ts-ignore
		const renderArg = { ...this.#renderProps, state: this.state }

		const dynamicFragment = this.#render(renderArg)
		dynamicFragment.hydrate(container)
		this.#currentFragment = dynamicFragment
		this.#container = container
	}

	get hydratable() {
		return this.#render(this.#setup()).toString()
	}

	/**
	 * @param {boolean} cacheFragment
	 */
	unmount(cacheFragment) {
		if (cacheFragment) {
			this.#cacheIsland()
		} else {
			this.#fragmentCache.clear()
		}

		// remove subscriptions
		this.subscriptions.forEach(store => store.unsubscribeAll(this))
		this.routeSubscription?.unsubscribe(this)
		this.subscriptions.clear()
		this.routeSubscription = null

		if (this.#container) {
			this.#container.innerHTML = ''
			this.#container = null
		}
	}

	#cacheIsland() {
		if (!(this.#container && this.#currentFragment)) return

		this.#fragmentCache.set(this.#currentFragment.strings, this.#currentFragment)
	}

	/**
	 * @param {DynamicFragment} dynamicFragment
	 */
	#restoreFromCache(dynamicFragment) {
		if (!this.#container) return

		const reusableFragment = this.#fragmentCache.get(dynamicFragment.strings)

		if (reusableFragment) {
			reusableFragment.restoreIn(this.#container)
			this.#currentFragment = reusableFragment
			this.#currentFragment.values = dynamicFragment.values
		} else {
			dynamicFragment.mount(this.#container)
			this.#currentFragment = dynamicFragment
		}
	}

	/** @type {Map<TemplateStringsArray, DynamicFragment>} */
	#fragmentCache = new Map()

	/** @type {DynamicFragment?} */
	#currentFragment = null
	#internalRender() {
		if (!this.#container) return

		/** @type {T} */
		// @ts-ignore
		const renderArg = { ...this.#renderProps, state: this.state }

		const dynamicFragment = this.#render(renderArg)
		if (!this.#currentFragment) {
			dynamicFragment.mount(this.#container)
			this.#currentFragment = dynamicFragment
			return
		}
		if (dynamicFragment.strings == this.#currentFragment.strings) {
			// update values
			this.#currentFragment.values = dynamicFragment.values
		} else {
			this.#cacheIsland()

			this.#restoreFromCache(dynamicFragment)
		}
	}
}


/**
 * @overload
 * @param {() => DynamicFragment} renderFunction
 * @returns {DynamicIsland<{}>}
 */

/**
 * @template {{state?: object}} T
 * @overload
 * @param {() => T} setup
 * @param {(state: T) => DynamicFragment} renderFunction
 * @returns {DynamicIsland<T>}
*/

/**
 * @template {{state?: object}} T
 * @param {() => DynamicFragment | (() => T)} setupOrRender
 * @param {(state: T) => DynamicFragment} [renderFunction]
 */
export function island(setupOrRender, renderFunction) {
	if (renderFunction) {
		// const setup = setupOrRender
		return new DynamicIsland(setupOrRender, renderFunction)
	}
	return new DynamicIsland(() => ({}), setupOrRender)
}


