import { autoSubscribe, clearSubscriber } from '@applicvision/frontend-friends/store'
import { autoSubscribe as routerAutoSubscribe } from './router/base-router.js'
import { definePlugin } from './plugins.js'

/**
 * @import {FFPlugin} from '../types/type-utils.d.ts'
 * @import {BaseRouter} from './router/base-router.js'
 * @import {DynamicFragment} from '../types/src/dynamic-fragment.js'
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
			recursiveRunWithPlugins(plugins, render, pluginIndex + 1)
		}
	} else {
		render()
	}
}

/**
 * @param {{[key: string]: FFPlugin}} plugins
 * @param {(...args: any[]) => DynamicFragment} render
 * @param {any} [renderContext]
 * @param {any[]} renderArgs
 */
export function runWithPlugins(plugins, render, renderContext, ...renderArgs) {

	let fragment = /** @type {DynamicFragment | null} */(null)
	recursiveRunWithPlugins(Object.entries(plugins), () => {
		fragment = render.apply(renderContext, renderArgs)
	})

	if (!fragment) throw new Error('Render was not called')

	return fragment
}



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

export const routerPlugin = definePlugin((invalidate) => {
	const subscriber = {
		/** @type {BaseRouter|undefined} */
		router: undefined,
		routeChanged: invalidate
	}

	return {
		middleware(render) {
			routerAutoSubscribe(subscriber, render)
		},
		cleanup() {
			subscriber.router?.unsubscribe(subscriber)
			delete subscriber.router
		}
	}
})

