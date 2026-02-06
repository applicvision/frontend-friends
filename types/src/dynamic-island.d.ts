import { AutoSubscriber, ResourceStore } from "./store.js";
import { DynamicFragment } from "./dynamic-fragment.js";

export class DynamicIsland<T extends { [key: string]: any, state?: object }> extends EventTarget implements AutoSubscriber {
	constructor(setup: () => T, renderFunction: (state: T) => DynamicFragment)

	readonly pendingUpdate: Promise<any> | null
	invalidate(): Promise<any>

	storeChanged: (store: ResourceStore<any>) => void

	subscriptions: Set<ResourceStore<any>>

	set state(state: T['state'])

	get state(): T['state']

	mount(container: HTMLElement): void

	get container(): HTMLElement | null

	hydrate(container: HTMLElement): void

	get hydratable(): string

	unmount(cacheFragment?: boolean): void

}

export function island(
	render: () => DynamicFragment
): DynamicIsland<{}>
export function island<T extends { state?: object }>(
	setup: () => T,
	render: (state: T) => DynamicFragment
): DynamicIsland<T>
export function island<T extends { state?: object }>(
	setupOrRender: () => DynamicFragment | (() => T),
	renderFunction?: (state: T) => DynamicFragment
): DynamicIsland<T>
