import type { TemplateTagFunction, InterpolationDescriptor, InnerHTML } from "../type-utils.js"

export const html: TemplateTagFunction & {
    key(this: typeof html, key: string | number): TemplateTagFunction
}

export const svg: typeof html

export function interpolationDescriptors(strings: TemplateStringsArray | readonly string[]): InterpolationDescriptor[]

export function innerHTML(htmlString: string): InnerHTML

export class PropertySetter {

    constructor(key: string, value: any)
    key: string
    value: any
}

export class DynamicFragment {
    constructor(strings: TemplateStringsArray, values: (DynamicFragment | DynamicFragment[] | PropertySetter | string | number | boolean | Function | InnerHTML | object | null | undefined)[], isSvg?: boolean)

    get strings(): TemplateStringsArray

    /**
     * Attaches event listeners and collects dom references for dynamic updates of content.
     */
    hydrate(container: Element | DocumentFragment | ShadowRoot, eventHandlerContext?: unknown | undefined): void

    /**
     * Mounts a fragment in a container element, and prepares it for dynamic updates.
     */
    mount(container: HTMLElement | ShadowRoot, eventHandlerContext?: unknown | undefined): void

    set values(newValues: (string | number | boolean | object | Function | DynamicFragment | PropertySetter | InnerHTML | DynamicFragment[] | null | undefined)[])

    /**
     * The current interpolation values of the fragment.
     */
    get values(): (string | number | boolean | object | Function | DynamicFragment | PropertySetter | InnerHTML | DynamicFragment[] | null | undefined)[]

    /**
     * Associates a key with the fragment for more effective updates of lists. Only relevant in arrays of fragments.
     */
    key(key: string | number): DynamicFragment

    restoreIn(location: Range | HTMLElement | ShadowRoot): void

    /**
     * If the fragment consists only of one string literal it's considered static, otherwise not.
     */
    get isStatic(): boolean

    /**
     * Creates an HTML string from the fragment. Can be called on the server for server side rendering.
     * Later the fragment can be hydrated by calling `hydrate`.
     */
    toString(): string

    /**
     * A static HTML string for the fragment. This content represents a frozen state and can not be hydrated. 
     */
    get staticHtmlString(): string

}

