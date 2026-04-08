import { ResourceStore } from "./store.js";
import { DynamicFragment } from "./dynamic-fragment.js";

export class DynamicIsland<T extends object | string | number | boolean | null = null> extends EventTarget {
	constructor(initialState: T, renderFunction: (state: T) => DynamicFragment)

	readonly pendingUpdate: Promise<any> | null
	invalidate(): Promise<any>

	storeChanged: (store: ResourceStore<any>) => void

	set state(state: T)

	get state(): T

	mount(container: HTMLElement): void

	get container(): HTMLElement | null

	hydrate(container: HTMLElement): void

	get hydratable(): string

	unmount(cacheFragment?: boolean): void

}

export function island(
	render: () => DynamicFragment
): DynamicIsland
export function island<T extends object | string | number | boolean>(
	initialState: T,
	render: (state: T) => DynamicFragment
): DynamicIsland<T>
export function island<T extends { state?: object }>(
	stateOrRender: () => DynamicFragment | (() => T),
	renderFunction?: (state: T) => DynamicFragment
): DynamicIsland<T>
