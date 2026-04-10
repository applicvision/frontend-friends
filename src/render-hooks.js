import { autoSubscribe, clearSubscriber } from '@applicvision/frontend-friends/store'

/**
 * @import {Invalidatable, RenderHook} from '../types/type-utils.js'
 */

/**
 * @param {Invalidatable} context
 * @param {RenderHook[]} hooks
 * @param {() => void} render
 */
function recursiveRunWithHooks(context, hooks, render, hookIndex = 0) {
	const hook = hooks[hookIndex]
	let called = false
	if (hook) {
		hook.hook(context, () => {
			if (called) throw new Error('Render called multiple times in hook: ' + hook.name)
			called = true
			recursiveRunWithHooks(context, hooks, render, hookIndex + 1)
		})
	} else {
		render.call(context)
	}
}

/**
 * @param {Invalidatable} context
 * @param {RenderHook[]} hooks
 * @param {() => void} render
 */
export function runWithHooks(context, hooks, render) {
	recursiveRunWithHooks(context, hooks, render)
}

/** @return {RenderHook} **/
export function makeStoreHook() {

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
			clearSubscriber(subscriber)
			autoSubscribe(subscriber, render)
		},
		cleanup() {
			clearSubscriber(subscriber)
		}
	}
}
