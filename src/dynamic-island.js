import { html } from '@applicvision/frontend-friends/dynamic-fragment'
import { deepWatch } from '@applicvision/frontend-friends/deep-watch'
import { runWithPlugins, storePlugin } from './render-hooks.js'

/**
 * @import {DynamicFragment} from '../types/src/dynamic-fragment.js'
 * @import {RouteSubscriber, AnyRoute} from './router/base-router.js'
 * @import {FFPlugin} from '../types/type-utils.js'
 */

/**
 * @template {object|string|number|boolean|null} [T=null]
 * @implements {RouteSubscriber}
 **/
export class DynamicIsland extends EventTarget {

	/** @type {HTMLElement?} */
	#container = null

	/** @type {T} */
	#state

	/** @type {AnyRoute | null} */
	routeSubscription = null

	#render

	/**
	 * @param {T} state
	 * @param {((state: T) => ReturnType<html>)} renderFunction
	 */
	constructor(state, renderFunction) {
		super()
		this.#state = this.#watchedState(state)
		this.#render = renderFunction
		// this.registerHook(makeStoreHook())
	}

	/** @type {Promise<any>|null} */
	pendingUpdate = null
	invalidate() {
		return this.pendingUpdate ??= Promise.resolve().then(() => {
			this.#internalRender()
			this.pendingUpdate = null
			// TODO: maybe signal update
		})
	}

	routeChanged() {
		// const { state, ...otherProps } = this.#setup()
		// this.#renderProps = otherProps
		// this.state = state
		// this.#internalRender()
	}

	/** @type {{[key: string]: FFPlugin<any>}} */
	#plugins = {}


	/** @param {T} state */
	#watchedState(state) {
		return typeof state == 'object' && state != null ? deepWatch(state, (keypath, newValue, oldValue) => {
			if (newValue !== oldValue) {
				this.invalidate()
				this.dispatchEvent(new CustomEvent('statechange', { detail: { keypath } }))
			}
		}) : state
	}

	set state(state) {
		this.#state = this.#watchedState(state)
		if (this.isMounted) {
			this.invalidate()
		}
	}

	get state() {
		return this.#state
	}

	/** @param {HTMLElement} container */
	mount(container) {

		if (container == this.container) {
			return
		}
		if (this.container) {
			console.warn('already mounted somewehere else. Unmounting')
			this.unmount(true)
		}
		this.#container = container

		this.#plugins.store = storePlugin(this, container)

		this.#internalRender()
		this.dispatchEvent(new Event('mount'))
	}

	get container() {
		return this.#container
	}

	get isMounted() {
		return Boolean(this.container)
	}

	/**
	 * @param {HTMLElement} container
	 **/
	hydrate(container) {
		runWithPlugins(this.#plugins, (context) => {
			const dynamicFragment = this.#render(this.state)
			dynamicFragment.hydrate(container)
			this.#currentFragment = dynamicFragment
			this.#container = container
		})
	}

	get hydratable() {
		return this.#render(this.state).toString()
	}


	unmount(cacheFragment = false) {
		if (cacheFragment) {
			this.#cacheIsland()
		} else {
			this.#fragmentCache.clear()
		}

		// remove subscriptions
		this.routeSubscription?.unsubscribe(this)
		this.routeSubscription = null
		Object.values(this.#plugins).forEach(plugin => plugin.cleanup?.())

		if (this.container) {
			this.container.innerHTML = ''
			this.#container = null
			this.#currentFragment = null
		}
	}

	#cacheIsland() {
		if (!(this.container && this.#currentFragment)) return

		this.#fragmentCache.set(this.#currentFragment.strings, this.#currentFragment)
	}

	/** @type {Map<TemplateStringsArray, DynamicFragment>} */
	#fragmentCache = new Map()

	/** @type {DynamicFragment?} */
	#currentFragment = null
	#internalRender() {

		const { container } = this

		if (!container) return

		runWithPlugins(this.#plugins, (context) => {

			const dynamicFragment = this.#render(this.state)

			if (dynamicFragment.strings == this.#currentFragment?.strings) {
				// update values
				this.#currentFragment.values = dynamicFragment.values
			} else {
				this.#cacheIsland()

				const reusableFragment = this.#fragmentCache.get(dynamicFragment.strings)

				if (reusableFragment) {
					reusableFragment.restoreIn(container)
					this.#currentFragment = reusableFragment
					this.#currentFragment.values = dynamicFragment.values
				} else {
					dynamicFragment.mount(container)
					this.#currentFragment = dynamicFragment
				}
			}
		})
		this.dispatchEvent(new Event('update'))
	}
}

/**
 * @overload
 * @param {() => DynamicFragment} renderFunction
 * @returns {DynamicIsland}
 */

/**
 * @template {object|string|number|boolean} T
 * @overload
 * @param {T} initialState
 * @param {(state: T) => DynamicFragment} renderFunction
 * @returns {DynamicIsland<T>}
*/

/**
 * @template {object|string|number|boolean} T
 * @param {(() => DynamicFragment) | T} stateOrRender
 * @param {(state: T) => DynamicFragment} [renderFunction]
 */
export function island(stateOrRender, renderFunction) {
	if (typeof renderFunction == 'function' && typeof stateOrRender != 'function') {
		return new DynamicIsland(stateOrRender, renderFunction)
	}
	return new DynamicIsland(
		null,
		/** @type {(state: null) => DynamicFragment} */(stateOrRender)
	)
}

