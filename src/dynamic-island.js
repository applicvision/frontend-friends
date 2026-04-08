import { html } from '@applicvision/frontend-friends/dynamic-fragment'
import { autoSubscribe as storeSubscribe } from '@applicvision/frontend-friends/store'
import { autoSubscribe as routeSubscribe } from '@applicvision/frontend-friends/base-router'
import { deepWatch } from '@applicvision/frontend-friends/deep-watch'
import { clearSubscriber } from './store.js'

/**
 * @import {DynamicFragment} from '../types/src/dynamic-fragment.js'
 * @import {AutoSubscriber, AnyStore as ResourceStore} from '../types/src/store.js'
 * @import {RouteSubscriber, AnyRoute} from './router/base-router.js'
 * @import {Invalidatable, RenderHook} from '../types/type-utils.js'
 */

/** @return {RenderHook} **/
function makeStoreHook() {

	/** @type {Invalidatable} */
	let invalidatable

	const subscriber = {
		subscriptions: new Map(),
		storeChanged() {
			invalidatable.invalidate()
		}
	}
	return {
		name: 'store',
		hook(context, render) {
			invalidatable ??= context
			storeSubscribe(subscriber, render)
		},
		cleanup() {
			clearSubscriber(subscriber)
		}
	}
}

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
		this.registerHook(makeStoreHook())
	}

	/** @type {Promise<any>|null} */
	pendingUpdate = null
	invalidate() {
		return this.pendingUpdate ??= Promise.resolve().then(() => {
			// console.time('render')
			this.#renderWithHooks()
			// console.timeEnd('render')
			this.pendingUpdate = null
			// TODO: maybe signal update
		})
	}

	storeChanged() {
		this.invalidate()
	}

	routeChanged() {
		// const { state, ...otherProps } = this.#setup()
		// this.#renderProps = otherProps
		// this.state = state
		// this.#internalRender()
	}

	/** @type {RenderHook[]} */
	#renderHooks = []

	/** @param {RenderHook} hook */
	registerHook(hook) {
		this.#renderHooks.push(hook)
	}

	/** @param {T} state */
	#watchedState(state) {
		return state && typeof state == 'object' ? deepWatch(state, (keypath, newValue, oldValue) => {
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

		this.#renderWithHooks()
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

		const dynamicFragment = this.#render(this.state)
		dynamicFragment.hydrate(container)
		this.#currentFragment = dynamicFragment
		this.#container = container
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
		this.#renderHooks.forEach(hook => hook.cleanup?.())

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

		if (!this.container) return

		const dynamicFragment = this.#render(this.state)

		if (dynamicFragment.strings == this.#currentFragment?.strings) {
			// update values
			this.#currentFragment.values = dynamicFragment.values
		} else {
			this.#cacheIsland()

			const reusableFragment = this.#fragmentCache.get(dynamicFragment.strings)

			if (reusableFragment) {
				reusableFragment.restoreIn(this.container)
				this.#currentFragment = reusableFragment
				this.#currentFragment.values = dynamicFragment.values
			} else {
				dynamicFragment.mount(this.container)
				this.#currentFragment = dynamicFragment
			}

		}
		this.dispatchEvent(new Event('update'))
	}

	#renderWithHooks(hookIndex = 0) {
		const hook = this.#renderHooks[hookIndex]
		let called = false
		if (hook) {
			hook.hook(this, () => {
				if (called) throw new Error('Render called multiple times in hook: ' + hook.name)
				called = true
				this.#renderWithHooks(hookIndex + 1)
			})
		} else {
			this.#internalRender()
		}
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
 * @template {object} T
 * @param {(() => DynamicFragment) | T} stateOrRender
 * @param {(state: T) => DynamicFragment} [renderFunction]
 */
export function island(stateOrRender, renderFunction) {
	if (typeof renderFunction == 'function' && typeof stateOrRender == 'object') {
		return new DynamicIsland(stateOrRender, renderFunction)
	}
	return new DynamicIsland(
		null,
		/** @type {(state: null) => DynamicFragment} */(stateOrRender)
	)
}

