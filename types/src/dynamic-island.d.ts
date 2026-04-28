import { ResourceStore } from "./store.js";
import { DynamicFragment } from "./dynamic-fragment.js";
import { ElementReference } from "./special-attributes.js";
import { FFPlugin, PluginsState, PluginFactory } from "../type-utils.js";

type StateShape = object | string | number | boolean | null
type RefsShape = { [key: string]: ElementReference } | null
type PluginsShape = { [key: string]: PluginFactory<unknown> } | null

type RenderContext<State extends StateShape, Refs extends RefsShape, Plugins extends PluginsShape> =
	(State extends null ? {} : { state: State }) &
	(Refs extends null ? {} : { refs: Refs }) &
	(Plugins extends null ? {} : { plugins: PluginsState<Plugins> })

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
	State extends object | string | number | boolean,
	Refs extends { [key: string]: ElementReference },
	Plugins extends { [key: string]: PluginFactory<unknown> }
>(
	propertiesOrRender: () => DynamicFragment | { state?: State, refs?: Refs, plugins?: Plugins } | State,
	renderFunction?: (state: State) => DynamicFragment
): DynamicIsland<State, Refs, Plugins>
