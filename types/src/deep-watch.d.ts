import { KeyPath } from "../type-utils.js";

/**
 * Deep watches an object. Callback is called for every time something is set somewhere in the object, 
 * with the key path of the changed value along with the new and old value.
 * Please note that newValue and oldValue might be the same.
 */
export function deepWatch<T extends object>(
	target: T,
	modificationCallback: (keyPath: KeyPath<T>, newValue: unknown, oldValue?: unknown) => void
): T


/**
 * Deep watches an object to deep watch. The `effect` function is called asynchronously on changes.
 * It aggregates synchronous changes to the object, and effect is only called once.
 */
export function effect<T extends object>(
	target: T,
	effect: (target: T) => void
): T
