import { autoSubscribe, clearSubscriber } from '@applicvision/frontend-friends/store'

/**
 * @import {AutoSubscriber} from '../types/src/store.js'
 * @import {Invalidatable, FFPlugin, PluginCreator, PluginFactory} from '../types/type-utils.js'
 */

/**
 * @param {[string, FFPlugin][]} plugins
 * @param {() => void} render
 */
function recursiveRunWithPlugins(plugins, render, pluginIndex = 0) {
	const pluginAndKey = plugins[pluginIndex]
	let called = false
	if (pluginAndKey) {
		const [key, plugin] = pluginAndKey
		if (plugin.middleware) {
			plugin.middleware(() => {
				if (called) throw new Error('Render called multiple times in hook: ' + key)
				called = true
				recursiveRunWithPlugins(plugins, render, pluginIndex + 1)
			})
		} else {
			render()
		}
	} else {
		render()
	}
}

/**
 * @param {{[key: string]: FFPlugin}} plugins
 * @param {(context: unknown) => void} render
 */
export function runWithPlugins(plugins, render) {

	const entries = Object.entries(plugins)
	const pluginsState = Object.fromEntries(entries.map(([name, plugin]) => [name, plugin.state]))
	recursiveRunWithPlugins(entries, () => render(pluginsState))
}


export class RenderHookOld {
	/** @type {(() => void)|null} */
	cleanupFunction = null

	/** @type {(render: () => void) => void} */
	hook = () => {
		throw new Error('No hook function implemented')
	}

	/**
	 * @param {string} name
	 * @param {(context: Invalidatable, registerCleanup: (cleanup: () => void) => void) => (render: () => void) => void} setupFunction
	 **/
	constructor(name, setupFunction) {
		this.name = name
		this.setup = setupFunction
	}

	/**
	 * @param {Invalidatable} invalidatable
	 */
	init(invalidatable) {
		const hook = this.setup(invalidatable, (cleanup) => this.cleanupFunction = cleanup)
		if (typeof hook == 'function') {
			this.hook = hook
		}
	}
}


/**
 * @template [State=null]
 * @abstract
 */
export class Friend {

	/** @type {State} */
	state = null

	/** 
	 * @param {Invalidatable} invalidatable
	 * @param {Element} element
	 */
	constructor(invalidatable, element) {
		this.invalidatable = invalidatable
		this.element = element
	}
	/**
	 * @param {unknown} context
	 * @param {(context: unknown) => void} render 
	 **/
	middleware(context, render) {
		render(context)
	}

	/** @abstract */
	cleanup() { }
}

/** 
 * @implements {AutoSubscriber}
 **/
export class StoreFriend extends Friend {

	subscriptions = new Map()

	storeChanged() {
		this.invalidatable.invalidate()
	}

	/** @type {Friend['middleware']} */
	middleware(context, render) {
		clearSubscriber(this)
		autoSubscribe(this, render.bind(null, context))
	}

	cleanup() {
		clearSubscriber(this)
	}
}

// export const storeHook = renderHook('store', (invalidatable, cleanup) => {
// 	const subscriber = {
// 		subscriptions: new Map(),
// 		storeChanged() {
// 			invalidatable.invalidate()
// 		}
// 	}

// 	cleanup(() => clearSubscriber(subscriber))

// 	return (render) => {
// 		clearSubscriber(subscriber)
// 		autoSubscribe(subscriber, render)
// 	}
// })

/**
 * @template [State=null]
 * @param {PluginCreator<State>} pluginCreator
 * @return {PluginFactory<State>}
 **/
export function definePlugin(pluginCreator) {
	return (invalidatable, element) =>
		pluginCreator(invalidatable.invalidate.bind(invalidatable), element)
}


export const mousemovePlugin = definePlugin((invalidate) => {

	const state = { x: 0, y: 0 }

	const abort = new AbortController()
	document.addEventListener('mousemove', (event) => {
		console.log('doc mouse move')
		state.x = event.clientX
		state.y = event.clientY
		invalidate()
	}, { signal: abort.signal })

	return {
		state,
		cleanup: () => abort.abort()
	}
})

const loggerPlugin = definePlugin(() => ({
	middleware(render) {
		console.time('Render time')
		render()
		console.timeEnd('Render time')
	}
}))


export const storePlugin = definePlugin((invalidate) => {
	const subscriber = {
		subscriptions: new Map(),
		storeChanged: invalidate
	}

	return {
		middleware(render) {
			clearSubscriber(subscriber)
			autoSubscribe(subscriber, render)
		},
		cleanup() {
			clearSubscriber(subscriber)
		}
	}
})

/** @return {RenderHook} **/
// export function makeStoreHook() {

// 	/** @type {Invalidatable} */
// 	let invalidatable

// 	const subscriber = {
// 		subscriptions: new Map(),
// 		storeChanged() {
// 			invalidatable.invalidate()
// 		}
// 	}
// 	return {
// 		name: 'store',
// 		hook(context, render) {
// 			invalidatable ??= context
// 			clearSubscriber(subscriber)
// 			autoSubscribe(subscriber, render)
// 		},
// 		cleanup() {
// 			clearSubscriber(subscriber)
// 		}
// 	}
// }
