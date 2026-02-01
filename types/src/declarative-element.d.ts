import { StoreSubscriber } from "./store.js";
import { InnerCSS, KeyPath, StyleDeclaration, TwowayBinding } from "../type-utils.js";
import { DynamicFragment } from "./dynamic-fragment.js";
import { twoway as TwowayFunc } from "./special-attributes.js";

export abstract class DeclarativeElement<SharedState = null> extends HTMLElement implements StoreSubscriber {
	constructor()

	static sharedStateName: string | null

	static style: StyleDeclaration | StyleDeclaration[]

	static observedAttributes: string[]

	protected abstract render(): DynamicFragment

	protected forwardSharedState(): object | TwowayBinding

	protected sharedStateChanged(): void

	storeChanged(): void

	get isRendering(): boolean

	protected componentDidUpdate(): void

	reactive<T extends object>(object: T, effect?: (keypath: KeyPath<T>, newValue: unknown, oldValue: unknown) => void): T

	readonly pendingUpdate: Promise<any> | null

	protected twoway: typeof TwowayFunc

	get sharedState(): SharedState

	set sharedState(newValue: SharedState)

	connectedCallback(): void

	attributeChangedCallback(attributeName: string, oldValue: string | null, newValue: string | null): void

	invalidate(): Promise<any>
}

export function css(strings: TemplateStringsArray, ...nestedParts: (StyleDeclaration | InnerCSS)[]): StyleDeclaration

export function innerCSS(cssString: string): InnerCSS
