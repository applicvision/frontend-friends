import { twoway, html } from '@applicvision/frontend-friends'
import { DynamicFragment } from '@applicvision/frontend-friends/dynamic-fragment'
import { deepWatch } from '@applicvision/frontend-friends/deep-watch'

/**
 * @import {StoreSubscriber} from './store.js'
 * @import {TwowayBinding, KeyPath} from './types.js'
 **/

/**
 * @type {(value: unknown) => value is TwowayBinding}
 */
function isTwowayBinding(value) {
	// @ts-ignore
	return typeof value?.get == 'function' && typeof value?.set == 'function'
}

/**
 * @param {unknown} binding
 * @param {unknown} newValue
 **/
function setToBindingOrThrow(binding, newValue) {
	if (!isTwowayBinding(binding)) throw new Error('Please use a two-way binding')

	return binding.set(newValue)
}


/**
 * @template [SharedState=null]
 * @abstract
 * @implements {StoreSubscriber}
 **/
export class DeclarativeElement extends (globalThis.HTMLElement ?? class { }) {

	constructor() {
		super()
		const shadowRoot = this.attachShadow({ mode: 'open' })


		const { stylesheets, sharedStateName } = this.#componentClass

		shadowRoot.adoptedStyleSheets = stylesheets

		if (sharedStateName) {
			this.#internals = this.attachInternals()
		}
	}


	get #componentClass() {
		return /** @type {typeof DeclarativeElement} */(this.constructor)
	}


	/**
	 * Setting this to a valid string identifier
	 * will add it to the element's custom state set when the shared state is truthy
	 * @type {string?}
	 **/
	static sharedStateName = null

	/** @type {ElementInternals?} */
	#internals = null

	/** @type {StyleDeclaration|StyleDeclaration[]} */
	static style = []

	/** @type {string[]} */
	static observedAttributes = []

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

	/** @type {TwowayBinding|object?} */
	#twowayBinding = null
	/**
	 * @param {TwowayBinding|object} binding
	 */
	set sharedStateBinding(binding) {
		const firstBinding = !this.#twowayBinding
		this.#twowayBinding = binding

		if (firstBinding || this.sharedState != this.#lastSharedState) {
			this.#lastSharedState = this.sharedState
			this.sharedStateChanged()
		}
	}

	/** @protected */
	forwardSharedState() {
		// A placeholder is needed because the generation of the html string checks the type passed to ff-share.
		// And at that time the binding has not been set
		return this.#twowayBinding ?? twowayPlaceholder
	}

	/** @protected */
	sharedStateChanged() {
		this.invalidate()
		const { sharedStateName } = this.#componentClass
		if (sharedStateName) {
			this.sharedState ?
				this.#internals?.states.add(sharedStateName) :
				this.#internals?.states.delete(sharedStateName)
		}
	}

	/**
	 * @type {SharedState?}
	 */
	#lastSharedState = null

	/**
	 * @protected
	 * @type {SharedState}
	 */
	get sharedState() {
		if (isTwowayBinding(this.#twowayBinding)) {
			return this.#twowayBinding.get()
		}
		// @ts-ignore
		return this.#twowayBinding
	}

	/**
	 * @protected
	 * @param {SharedState} newValue
	 */
	set sharedState(newValue) {
		setToBindingOrThrow(this.#twowayBinding, newValue)
	}

	connectedCallback() {
		if (!this.isMounted) {
			this.#internalRender()
			this.#mounted = true
		}
	}

	/**
	 * @param {string} attributeName
	 * @param {string} oldValue
	 * @param {string} newValue
	 */
	attributeChangedCallback(attributeName, oldValue, newValue) {
		if (this.isMounted) {
			this.invalidate()
		}
	}

	/**
	 * @protected
	 * @type {typeof twoway}
	 */
	twoway(state, property, toTransform, fromTransform) {
		return twoway(state, property, toTransform, fromTransform, this)
	}

	/** 
	 * Implement this function to generate content for your component
	 * @protected
	 **/
	render() {
		return html`override me 🌴`
	}

	/**
	 * @protected
	 * @template {object} T
	 * @param {T} object
	 * @param {(keypath: KeyPath<T>, newValue: unknown, oldValue: unknown) => void} effect
	 * @returns {T}
	 */
	reactive(object, effect = (keypath, newValue, oldValue) => { if (newValue !== oldValue) this.invalidate() }) {
		return deepWatch(object, effect)
	}

	/** @type {Promise<any>|null} */
	pendingUpdate = null
	invalidate() {
		return this.pendingUpdate ??= Promise.resolve().then(() => {
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
	#stringValue = ''

	/**
	 * @param {TemplateStringsArray} strings
	 * @param {(StyleDeclaration|InnerCSS)[]} nestedParts
	 */
	constructor(strings, nestedParts) {
		this.#stringValue = strings.reduce((total, stringPart, index) => {
			const nestedPart = nestedParts[index - 1]
			if (nestedPart instanceof StyleDeclaration) {
				return total + nestedPart + stringPart
			}
			if (nestedPart instanceof InnerCSS) {
				return total + nestedPart + stringPart
			}

			throw new Error('Must nest with css-tag, or innerCSS')
		})
	}

	/** @type {CSSStyleSheet?} */
	#stylesheet = null

	get styleSheet() {
		if (!this.#stylesheet) {
			this.#stylesheet = new CSSStyleSheet()
			this.#stylesheet.replaceSync(this.toString())
		}
		return this.#stylesheet
	}

	toString() {
		return this.#stringValue
	}
}

class InnerCSS {

	/** @type {string} */
	#stringValue

	/** @param {string} cssString */
	constructor(cssString) {
		this.#stringValue = cssString
	}

	toString() {
		return this.#stringValue
	}
}

/** @type {TwowayBinding} */
const twowayPlaceholder = {
	get: () => null,
	set: () => { }
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
