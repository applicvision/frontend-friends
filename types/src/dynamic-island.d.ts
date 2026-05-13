import { DynamicFragment } from "./dynamic-fragment.js";
import { StateShape, RefsShape, PluginsShape, RenderContext } from "../type-utils.js";

type PlainIslandState<T> = T extends object ? T & { refs?: never, plugins?: never } : T

export class DynamicIsland<State extends StateShape = undefined, Refs extends RefsShape = undefined, Plugins extends PluginsShape = undefined> extends EventTarget {
	constructor(
		properties: { state?: State, refs?: Refs, plugins?: Plugins },
		renderFunction: (context: RenderContext<State, Refs, Plugins>) => DynamicFragment)

	readonly pendingUpdate: Promise<any> | null
	invalidate(): Promise<any>

	set state(state: State)

	get state(): State

	get refs(): Refs

	mount(container: HTMLElement): void

	get isMounted(): Boolean

	get container(): HTMLElement | null

	hydrate(container: HTMLElement): void

	get hydratable(): string

	unmount(cacheFragment?: boolean): void
}

export function island(
	render: () => DynamicFragment
): DynamicIsland
export function island<
	State extends StateShape = undefined,
	Refs extends RefsShape = undefined,
	Plugins extends PluginsShape = undefined
>(
	properties: { state?: State, refs?: Refs, plugins?: Plugins },
	render: (context: RenderContext<State, Refs, Plugins>) => DynamicFragment

): DynamicIsland<State, Refs, Plugins>
export function island<T extends object | string | number | boolean>(
	initialState: PlainIslandState<T>,
	render: (state: T) => DynamicFragment
): DynamicIsland<T>
