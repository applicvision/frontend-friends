import { deepWatch } from '@applicvision/frontend-friends/deep-watch'
import { runWithPlugins, storePlugin } from './render-hooks.js'

/**
 * @import {DynamicFragment} from '../types/src/dynamic-fragment.js'
 * @import {RouteSubscriber, AnyRoute} from './router/base-router.js'
 * @import {FFPlugin, StateShape, RefsShape, PluginsShape, RenderContext} from '../types/type-utils.js'
 */

/**
 * @template {StateShape} [State=null]
 * @template {RefsShape} [Refs=null]
 * @template {PluginsShape} [Plugins=null]
 * @implements {RouteSubscriber}
 **/
export class DynamicIsland extends EventTarget {

	/** @type {HTMLElement?} */
	#container = null

	/** @type {State} */
	#state

	/** @type {Refs} */
	#refs

	/** @type {{[key: string]: FFPlugin}} */
	#plugins = {}

	/** @type {Plugins} */
	#pluginFactories

	/** @type {AnyRoute | null} */
	routeSubscription = null

	#render

	/**
	 * @param {{state?: State, refs?: Refs, plugins?: Plugins}} init
	 * @param {((context: RenderContext<State, Refs, Plugins>) => DynamicFragment)} renderFunction
	 */
	constructor(init, renderFunction) {
		super()
		this.#state = this.#watchedState(init.state)
		this.#refs = init.refs
		this.#pluginFactories = init.plugins
		this.#render = renderFunction
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


	/** @param {State} state */
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

	get refs() {
		return this.#refs
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

		for (const pluginName in this.#pluginFactories) {
			this.#plugins[pluginName] = this.#pluginFactories[pluginName](this, container)
		}
		this.#plugins._store = storePlugin(this, container)

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
		runWithPlugins(this.#plugins, () => {
			// @ts-ignore
			const dynamicFragment = this.#render(this.#renderArg)
			dynamicFragment.hydrate(container)
			this.#currentFragment = dynamicFragment
			this.#container = container
		})
	}

	get #renderArg() {

		let pluginState,
			refs = this.#refs

		if (this.#pluginFactories) {
			for (const pluginName in this.#pluginFactories) {
				const { state } = this.#plugins[pluginName]
				if (state !== undefined) {

					pluginState ??= /** @type {Record<string, any>} */({})
					pluginState[pluginName] = state
				}
			}
		}

		if (!pluginState && !refs) return this.state

		/** @type {{state: unknown, plugins?: unknown, refs?: unknown}} */
		const arg = { state: this.state }

		if (pluginState) {
			arg.plugins = pluginState
		}

		if (refs) {
			arg.refs = refs
		}

		return arg
	}

	get hydratable() {
		// @ts-ignore
		return this.#render(this.#renderArg).toString()
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
		Object.values(this.#plugins ?? {}).forEach(plugin => plugin.cleanup?.())
		this.#plugins = {}

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

		runWithPlugins(this.#plugins, () => {

			// @ts-ignore
			const dynamicFragment = this.#render(this.#renderArg)

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
 * @param {{ state?: StateShape, refs?: RefsShape, plugins?: PluginsShape } | (() => DynamicFragment)} propertiesOrRender
 * @param {(context: unknown) => DynamicFragment} [renderFunction]
 */
export function island(propertiesOrRender, renderFunction) {
	if (typeof renderFunction == 'function') {
		if (typeof propertiesOrRender == 'object' && ('state' in propertiesOrRender || 'refs' in propertiesOrRender || 'plugins' in propertiesOrRender)) {
			return new DynamicIsland(propertiesOrRender, renderFunction)
		}
		return new DynamicIsland({ state: propertiesOrRender, plugins: null, refs: null }, renderFunction)
	}
	if (typeof propertiesOrRender == 'function') {
		return new DynamicIsland({}, propertiesOrRender)
	}
	throw new Error('Invalid arguments')
}

