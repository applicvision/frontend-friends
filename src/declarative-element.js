import { DynamicFragment, html } from '@applicvision/frontend-friends/dynamic-fragment'
import { deepWatch } from '@applicvision/frontend-friends/deep-watch'

/** @import {StoreSubscriber} from './store.js' */


/** @implements {StoreSubscriber} */
export class DeclarativeElement extends HTMLElement {

	constructor() {
		super()
		const shadowRoot = this.attachShadow({ mode: 'open' })
		/** @type {typeof DeclarativeElement} */
		// @ts-ignore
		const componentClass = this.constructor
		shadowRoot.adoptedStyleSheets = componentClass.stylesheets
	}

	/** @type {StyleDeclaration|StyleDeclaration[]} */
	static style = []

	/**
	 * @private
	 * @type {CSSStyleSheet[]}
	 **/
	static _stylesheets
	/** @private */
	static get stylesheets() {
		if (!this._stylesheets) {

			const styles = /** @type {StyleDeclaration[]} */([]).concat(this.style)
			this._stylesheets = styles.map(style => style.styleSheet)
		}
		return this._stylesheets
	}


	#mounted = false
	get isMounted() {
		return this.#mounted
	}

	connectedCallback() {
		this.#internalRender()
		this.#mounted = true
	}

	attributeChangedCallback() {
		if (this.isMounted) {
			this.invalidate()
		}
	}

	/** 
	 * Implement this function to generate content for your component
	 * @protected
	 **/
	render() {
		return html`override me 🌴`
	}

	/**
	 * @template {Object<string, any>} T
	 * @param {T} object
	 * @returns {T}
	 */
	reactive(object) {
		return deepWatch(object, () => this.invalidate())
	}

	/** @type {Promise<any>|null} */
	pendingUpdate = null
	invalidate() {
		this.pendingUpdate ??= Promise.resolve().then(() => {
			this.#internalRender()
			this.pendingUpdate = null
			this.componentDidUpdate()
		})
	}

	componentDidUpdate() { }

	storeChanged() {
		this.invalidate()
	}

	/** @type {DynamicFragment?} */
	#currentFragment = null

	/** @type {Map<TemplateStringsArray, DynamicFragment>} */
	#fragmentCache = new Map()

	#internalRender() {
		if (!this.shadowRoot) return

		const dynamicFragment = this.render()
		if (!this.#currentFragment) {
			dynamicFragment.mount(this.shadowRoot, this)
			this.#currentFragment = dynamicFragment
			return
		}
		if (dynamicFragment.strings == this.#currentFragment.strings) {
			// update values
			this.#currentFragment.values = dynamicFragment.values
		} else {

			// cache the previous dynamic fragment
			const range = document.createRange()
			range.selectNodeContents(this.shadowRoot)
			this.#currentFragment.saveFragment(range.extractContents())
			this.#fragmentCache.set(this.#currentFragment.strings, this.#currentFragment)

			// either restore from cache or mount new fragment
			const reusableFragment = this.#fragmentCache.get(dynamicFragment.strings)

			if (reusableFragment) {
				reusableFragment.restoreIn(this.shadowRoot)
				this.#currentFragment = reusableFragment
				this.#currentFragment.values = dynamicFragment.values
			} else {
				dynamicFragment.mount(this.shadowRoot, this)
				this.#currentFragment = dynamicFragment
			}
		}
	}
}

class StyleDeclaration {
	stringValue = ''

	/**
	 * @param {TemplateStringsArray} strings
	 * @param {(StyleDeclaration|InnerCSS)[]} nestedParts
	 */
	constructor(strings, nestedParts) {
		this.stringValue = strings.reduce((total, stringPart, index) => {
			const nestedPart = nestedParts[index - 1]
			if (nestedPart instanceof StyleDeclaration || nestedPart instanceof innerCSS) {
				return total + nestedPart.stringValue + stringPart
			}
			throw new Error('Must nest with css-tag, or innerCSS')
		})
	}

	/** @type {CSSStyleSheet?} */
	#stylesheet = null

	get styleSheet() {
		if (!this.#stylesheet) {
			this.#stylesheet = new CSSStyleSheet()
			this.#stylesheet.replaceSync(this.stringValue)
		}
		return this.#stylesheet
	}
}

class InnerCSS {

	/** @param {string} cssString */
	constructor(cssString) {
		this.stringValue = cssString
	}
}

/**
 * @param {TemplateStringsArray} strings
 * @param {(StyleDeclaration|InnerCSS)[]} values
 */
export function css(strings, ...values) {
	return new StyleDeclaration(strings, values)
}

/**
 * @param {string} cssString
 */
export function innerCSS(cssString) {
	return new InnerCSS(cssString)
}
