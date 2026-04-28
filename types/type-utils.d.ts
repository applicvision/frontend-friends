import type { DynamicFragment, PropertySetter, } from './src/dynamic-fragment.d.ts'

export type SpecialAttribute<ValueType, ElementType extends Element> = {
	isElementValid?: (element: Element) => element is ElementType,
	isValueValid?: (value: unknown) => value is ValueType
	connect?: (element: ElementType, getCurrentValue: () => ValueType) => void,
	update: (element: ElementType, value: ValueType, previousValue?: ValueType) => void,
}


type TemplateTagFunction = (strings: TemplateStringsArray, ...values: (DynamicFragment | DynamicFragment[] | PropertySetter | string | number | boolean | Function | InnerHTML | object | null | undefined)[]) => DynamicFragment;

export class InnerHTML {

	constructor(htmlString: string)
	htmlString: string

	insertAfter(node: Comment): void
}

export class InnerCSS {
	constructor(cssString: string)
}

export class StyleDeclaration {
	constructor(strings: TemplateStringsArray, ...nestedParts: (StyleDeclaration | InnerCSS)[])
	get styleSheet(): CSSStyleSheet

	makeStyleSheetInContext(context: typeof globalThis): CSSStyleSheet
}

type BaseAttributeDescriptor = { attribute: string, attributeStart: number, elementName: string, quotemark: '"' | "'" | '', prefix: string, suffix: string }

export type InterpolationDescriptor =
	BaseAttributeDescriptor & { type: 'attribute' } |
	BaseAttributeDescriptor & { type: 'specialAttribute' } |
	BaseAttributeDescriptor & { type: 'eventhandler' } |
	BaseAttributeDescriptor & { type: 'attributeExtension', quotemark: '"' | "'" } |
	{ type: 'content' }


export type AttributeLocator =
	{ type: 'eventhandler', attribute: string, dataAttributeValue: string, index: number, event: string } |
	{ type: 'attributeExtension', index: number, associatedIndex: number, prefix: string, suffix: string, quotemark: '"' | "'" } |
	{ type: 'booleanAttribute', attribute: string, dataAttributeValue: string, index: number } |
	{ type: 'specialAttribute', attribute: string, dataAttributeValue: string, index: number } |
	{ type: 'attribute', attribute: string, dataAttributeValue: string, quotemark: '"' | "'" | '', index: number, prefix: string, suffix: string }

export type DynamicNode =
	{ type: 'content', start: Comment, end: Comment } |
	{ type: 'property', element: HTMLElement } |
	{ type: 'eventhandler' } |
	{ type: 'attributeExtension', prefix: string, suffix: string, associatedIndex: number } |
	{ type: 'attribute', attribute: string, prefix?: string, suffix?: string, node: Element } |
	{ type: 'specialAttribute', attribute: string, node: Element }

export type PredicateType<T> = T extends (arg: any) => arg is infer Type ? Type : never

export type TwowayBinding = { get: () => any, set: (newValue: any, event?: Event) => void }

export type CustomTwowayBindable = Element & { sharedStateBinding: TwowayBinding | object }

export type TwowayBindableElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | CustomTwowayBindable

export type KeyPath<T extends object> = T extends Map<any, any> ? [`Map[${string}]`] :
	T extends Set<any> | Date | URL | URLSearchParams ?
	[] :
	{ [K in keyof T]:
		[K, ...(T[K] extends object ? KeyPath<T[K]> : [])]
	}[keyof T]


export interface Invalidatable {
	invalidate: () => {}
}

export type PluginStateFromCreator<T> = T extends (...args: any[]) => FFPlugin<infer State> ? State : never

export type PluginsState<T> = { [K in keyof T as PluginStateFromCreator<T[K]> extends null ? never : K]: PluginStateFromCreator<T[K]> }

export type RenderContextForElement<ElementClass> = ElementClass extends { plugins: infer T } ? PluginsState<T> : never

export type PluginCreator<T = null> = (invalidate: () => void, element: Element) => FFPlugin<T>

export type PluginFactory<T> = (invalidatable: Invalidatable, element: Element) => FFPlugin<T>

export interface FFPlugin<T = unknown> {
	state?: T
	middleware?: (render: () => void) => void
	cleanup?: () => void
}

export class FFPluginClass<State> {
	constructor(invalidate: () => {}, element: Element)
	state?: State
	middleware?: (render: () => {}) => void
	cleanup?: () => void
}
