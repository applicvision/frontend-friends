import { ResourceStore } from "./store.js";
import { DynamicFragment } from "./dynamic-fragment.js";
import { StateShape, RefsShape, PluginsShape, RenderContext } from "../type-utils.js";

export class DynamicIsland<State extends StateShape = null, Refs extends RefsShape = null, Plugins extends PluginsShape = null> extends EventTarget {
	constructor(
		properties: { state?: State, refs?: Refs, plugins?: Plugins },
		renderFunction: (context: RenderContext<State, Refs, Plugins>) => DynamicFragment)

	readonly pendingUpdate: Promise<any> | null
	invalidate(): Promise<any>

	storeChanged: (store: ResourceStore<any>) => void

	set state(state: State)

	get state(): State

	get refs(): Refs

	mount(container: HTMLElement): void

	get container(): HTMLElement | null

	hydrate(container: HTMLElement): void

	get hydratable(): string

	unmount(cacheFragment?: boolean): void
}

export function island(
	render: () => DynamicFragment
): DynamicIsland
export function island<
	State extends StateShape = null,
	Refs extends RefsShape = null,
	Plugins extends PluginsShape = null
>(
	properties: { state?: State, refs?: Refs, plugins?: Plugins },
	render: (context: RenderContext<State, Refs, Plugins>) => DynamicFragment

): DynamicIsland<State, Refs, Plugins>
export function island<T extends object | string | number | boolean>(
	initialState: T,
	render: (state: T) => DynamicFragment
): DynamicIsland<T>
export function island<
	State extends StateShape = null,
	Refs extends RefsShape = null,
	Plugins extends PluginsShape = null
>(
	propertiesOrRender: () => DynamicFragment | { state?: State, refs?: Refs, plugins?: Plugins } | State,
	renderFunction?: (state: State) => DynamicFragment
): DynamicIsland<State, Refs, Plugins>
