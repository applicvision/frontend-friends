import { autoSubscribe, clearSubscriber } from '@applicvision/frontend-friends/store'

/**
 * @import {FFPlugin, PluginCreator, PluginFactory} from '../types/type-utils.js'
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
 * @param {{[key: string]: FFPlugin}|null} plugins
 * @param {() => void} render
 */
export function runWithPlugins(plugins, render) {
	if (plugins) {
		recursiveRunWithPlugins(Object.entries(plugins), () => render())
	} else {
		render()
	}
}


/**
 * @template [State=undefined]
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

