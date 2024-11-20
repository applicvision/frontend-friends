import { DeclarativeElement } from '@applicvision/frontend-friends'

const attributeRegex = /(?<attribute>[a-zA-Z-]+)=((?<quotemark>["'])(?<prefix>[^"']*))?$/

const commentPrefix = 'dynamic-fragment'
const valueStartCommentPrefix = `${commentPrefix}:content:start:`
const valueEndCommentPrefix = `${commentPrefix}:content:end:`
const arrayContentStartCommentPrefix = `${commentPrefix}:array:start:`
const arrayContentEndCommentPrefix = `${commentPrefix}:array:end:`
const propertyCommentPrefix = `${commentPrefix}:property:_:`

const attributePrefix = 'data-reactive'

const sharedStateAttributeName = 'ff-share'

/**
 * @typedef {{type: 'eventhandler', attribute: string, dataAttributeValue: string, index: number, event: string } |
 * {type: 'attributeExtension', index: number, associatedIndex: number, prefix: string, suffix: string, quotemark: '"'|"'"} |
 * {type: 'booleanAttribute', attribute: string, dataAttributeValue: string, index: number } |
 * {type: 'sharedState', attribute: typeof sharedStateAttributeName, dataAttributeValue: string, index: number } |
 * {type: 'attribute', attribute: string, dataAttributeValue: string, quotemark: '"'|"'"|'', index: number, prefix: string, suffix: string}} AttributeLocator
*/

/**
 * @typedef {{get: () => any, set: (newValue: any, event?: Event) => void}} TwowayBinding
 * @typedef {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement|DeclarativeElement} TwowayBindableElement
 */

/**
 * @param {string} inputString
 */
function escapeHtml(inputString) {
	return escapeEntries.reduce(
		(string, [character, replacement]) => string.replaceAll(character, replacement),
		inputString
	)
}

const quoteEscape = {
	'"': '&quot;',
	"'": '&#39;'
}

const escapeCharacters = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;'
}
const escapeEntries = Object.entries(escapeCharacters)

/**
 * @param {TemplateStringsArray} strings
 * @param {(DynamicFragment|DynamicFragment[]|PropertySetter|string|number|boolean|Function|InnerHTML|TwowayBinding|null|undefined)[]} values
 */
export function html(strings, ...values) {
	return new DynamicFragment(strings, values)
}

class InnerHTML {

	/**
	 * @param {string} htmlString
	 */
	constructor(htmlString) {
		this.htmlString = htmlString
	}

	/**
	 * @param {Comment} node
	 */
	insertAfter(node) {
		const template = document.createElement('template')
		template.innerHTML = this.htmlString
		node.after(template.content)
	}
}

/**
 * @param {string} htmlString
 */
export function innerHTML(htmlString) {
	return new InnerHTML(htmlString)
}

export class PropertySetter {
	/** 
	 * @param {string} key 
	 * @param {any} value
	 **/
	constructor(key, value) {
		this.key = key
		this.value = value
	}
}


/** @type {Map<object, Map<string|number|symbol, TwowayBinding>>} */
// cache?
// const twowayBindingCache = new Map()

/** 
 * @template {{[key: string]: any}} T 
 * @implements {TwowayBinding}
 **/
class Twoway {

	/** @type {T} */
	#stateContainer

	/** @type {keyof T} */
	#property

	/**
	 * @param {T} state
	 * @param {keyof T} property
	 */
	constructor(state, property) {
		this.#stateContainer = state
		this.#property = property
	}

	get() {
		return this.#stateContainer[this.#property]
	}
	/** @param {any} newValue */
	set(newValue) {
		this.#stateContainer[this.#property] = newValue
	}
}

/**
 * @template {{[key: string]: any}} T
 * @param {T} state
 * @param {keyof state} property
 * @return {TwowayBinding}
 */
export function twoway(state, property) {
	return new Twoway(state, property)
}

/**
 * @param {TwowayBindableElement} element
 * @param {TwowayBinding} sharedState
 **/
function updateElementWithSharedState(element, sharedState) {
	// document.activeElement == element
	if (element instanceof DeclarativeElement) {
		// @ts-ignore
		return element.__twowayBinding = sharedState
	}
	const newValue = sharedState.get()
	if (element instanceof HTMLInputElement && element.type == 'checkbox') {

		if (typeof newValue == 'boolean') {
			element.checked = newValue
		} else if (newValue instanceof Set) {
			element.checked = newValue.has(element.name)
		} else if (newValue instanceof Array) {
			element.checked = newValue.includes(element.name)
		}
	} else if (element instanceof HTMLInputElement && element.type == 'radio') {
		element.checked = newValue == element.value
	} else if (element instanceof HTMLSelectElement && element.type == 'select-multiple') {
		for (const option of element.options) {
			/** @type {Array<string>} */
			const selectedOptions = newValue
			option.selected = selectedOptions.includes(option.value)
		}
	} else {
		element.value = sharedState.get()
	}
}


/**
 * @param {Element|DocumentFragment|ShadowRoot|null} referenceElement
 * @param {Exclude<AttributeLocator, {type: 'attributeExtension'}>} locator
 */
function locateElement(referenceElement, locator) {
	const dataAttribute = `${attributePrefix}-${locator.attribute}`


	if (referenceElement instanceof HTMLElement &&
		referenceElement.getAttribute(dataAttribute) == locator.dataAttributeValue) {

		referenceElement.removeAttribute(dataAttribute)
		return referenceElement
	}
	const element = referenceElement?.querySelector(`[${dataAttribute}="${locator.dataAttributeValue}"]`)
	element?.removeAttribute(dataAttribute)

	return element
}

export class DynamicFragment {

	/**
	 * @type {(
	 * 	{type: 'content', start: Comment, end: Comment, currentFragment?: DynamicFragment} |
	 * 	{type: 'array', start: Comment, end: Comment, current: DynamicFragment[]} |
	 * 	{type: 'property', element: HTMLElement} |
	 * 	{type: 'sharedState', node: TwowayBindableElement} |
	 * 	{type: 'eventhandler', handler: (event: Event) => void} |
	 * 	{type: 'eventhandler', handler: (event: Event) => void} |
	 * 	{type: 'attributeExtension', prefix: string, suffix: string, associatedIndex: number} |
	 * 	{type: 'attribute', attribute: string, prefix?: string, suffix?: string, node: Element})[]}
	 **/
	#dynamicNodes = []

	/**
	 * @type {null | AttributeLocator[]}
	 **/
	#attributeLocators = null

	/** @type {TemplateStringsArray} */
	strings

	/** @type {(DynamicFragment|DynamicFragment[]|PropertySetter|string|number|boolean|Function|InnerHTML|TwowayBinding|null|undefined)[]} */
	#values

	/** @type {any} */
	#eventHandlerContext

	/**
	 * @param {TemplateStringsArray} strings
	 * @param  {(DynamicFragment|DynamicFragment[]|PropertySetter|string|number|boolean|Function|InnerHTML|TwowayBinding|null|undefined)[]} values
	 */
	constructor(strings, values) {
		this.strings = strings
		this.#values = values
	}

	copy() {
		return new DynamicFragment(this.strings, this.values)
	}

	getHtmlString(indexPathPrefix = '') {

		const { strings, values } = this

		let htmlResult = ''

		/** @type {AttributeLocator[]} */
		const attributeLocators = []

		values.forEach((value, index) => {
			const part = strings[index]


			if (value instanceof Array) {
				htmlResult += part
				htmlResult += `<!-- ${arrayContentStartCommentPrefix}${indexPathPrefix}${index} -->`
				value.forEach((dynamicFragment, arrayIndex) => {
					if (dynamicFragment instanceof DynamicFragment) {
						htmlResult += dynamicFragment.getHtmlString(indexPathPrefix + index + '-' + arrayIndex + '-')
					} else {
						throw new Error('Array item must be declared with html')
					}
				})
				htmlResult += `<!-- ${arrayContentEndCommentPrefix}${indexPathPrefix}${index} -->`
				return
			}

			if (value instanceof PropertySetter) {
				htmlResult += part
				htmlResult += `<!-- ${propertyCommentPrefix}${indexPathPrefix}${index} -->`
				return
			}

			const attributeMatch = part.match(attributeRegex)

			const previousAttributeLocator = attributeLocators[index - 1]

			if ((previousAttributeLocator?.type == 'attributeExtension' || previousAttributeLocator?.type == 'attribute') && previousAttributeLocator.quotemark && !part.includes(previousAttributeLocator.quotemark)) {

				const nextPart = strings[index + 1]
				const endOfQuote = nextPart.indexOf(previousAttributeLocator.quotemark)

				const suffix = endOfQuote == -1 ? '' : nextPart.slice(0, endOfQuote)

				const associatedIndex = previousAttributeLocator.type == 'attributeExtension' ? previousAttributeLocator.associatedIndex : index - 1

				attributeLocators[index] = { type: 'attributeExtension', index, prefix: part, suffix, quotemark: previousAttributeLocator.quotemark, associatedIndex }

				htmlResult += part + escapeHtml(String(value ?? ''))

				return
			}

			if (attributeMatch) {
				/** @type {{attribute: string, quotemark: '"'|"'"|'', prefix: string}} */
				// @ts-ignore
				const { attribute, quotemark = '', prefix = '' } = attributeMatch.groups

				let suffix = ''
				if (quotemark) {
					const nextPart = strings[index + 1]
					const endOfQuote = nextPart.indexOf(quotemark)
					if (endOfQuote != -1) {
						suffix = nextPart.slice(0, endOfQuote)
					}
				}

				if (attribute == sharedStateAttributeName) {
					if (typeof value?.get != 'function' || typeof value?.set != 'function') {
						throw new Error(`${sharedStateAttributeName} must use a two way binding (get and set function)`)
					}
					htmlResult += part.slice(0, -attributeMatch[0].length)

					const dataAttributeValue = indexPathPrefix + index

					htmlResult += `${attributePrefix}-${attribute}=${quotemark ?? ''}${dataAttributeValue}`
					attributeLocators[index] = { type: 'sharedState', attribute, index, dataAttributeValue }
					return
				}

				if (attribute.startsWith('on')) {
					if (typeof value != 'function') {
						throw new Error('Only functions are supported as event handlers')
					}
					const eventName = attribute.slice(2)
					htmlResult += part.slice(0, -attributeMatch[0].length)

					const dataAttributeValue = indexPathPrefix + index

					htmlResult += `${attributePrefix}-${attribute}=${quotemark ?? ''}${dataAttributeValue}`
					attributeLocators[index] = { type: 'eventhandler', attribute, index, event: eventName, dataAttributeValue }
					return
				}

				// add the content up to the attribute
				htmlResult += part.slice(0, -attributeMatch[0].length)

				if (typeof value == 'boolean') {
					if (prefix || suffix) {
						throw new Error('Boolean attributes can not have prefix/suffix')
					}
					if (quotemark) {
						console.warn('Unexpected quotemark for boolean attribute.')
					}
					if (value) {
						htmlResult += attribute
					}
					const dataAttributeValue = indexPathPrefix + index
					htmlResult += ` ${attributePrefix}-${attribute}=${quotemark || ''}${dataAttributeValue}`

					attributeLocators[index] = {
						type: 'booleanAttribute',
						index,
						attribute: attribute.toLowerCase(),
						dataAttributeValue
					}
				} else if (typeof value == 'number' || typeof value == 'string' || value == null) {
					if (value == null) {
						console.warn('Passed', value, 'to attribute', attribute)
					}
					const dataAttributeValue = indexPathPrefix + index
					htmlResult += `${attributePrefix}-${attribute}=${dataAttributeValue}`
					let attributeValue = prefix + escapeHtml(String(value ?? ''))
					if (quotemark) {
						attributeValue = attributeValue.replaceAll(quotemark, quoteEscape[quotemark])
					} else if (attributeValue.includes(' ')) {
						attributeValue = `"${attributeValue.replaceAll('"', quoteEscape['"'])}"`
					}
					htmlResult += ` ${attribute}=${quotemark}${attributeValue}`

					attributeLocators[index] = {
						type: 'attribute',
						attribute: attribute.toLowerCase(),
						quotemark,
						index,
						prefix,
						suffix,
						dataAttributeValue
					}
				} else {
					throw new Error(`Illegal attribute value: ${value}, type: ${typeof value}, constructor: ${value?.constructor?.name}`)
				}
			} else {
				htmlResult += part
				// insert a comment to track position to enter content
				htmlResult += `<!-- ${valueStartCommentPrefix}${indexPathPrefix}${index} -->`
				if (value instanceof DynamicFragment) {
					htmlResult += value.getHtmlString(indexPathPrefix + index + '-')
				} else if (value instanceof InnerHTML) {
					htmlResult += value.htmlString
				} else if (value || value === 0) {

					htmlResult += escapeHtml(value.toString())
				}
				htmlResult += `<!-- ${valueEndCommentPrefix}${indexPathPrefix}${index} -->`
			}

		})
		htmlResult += strings[strings.length - 1]

		this.#attributeLocators = attributeLocators

		return htmlResult
	}

	/**
	 * @private
	 * @param {number} index
	 * @param {{start?: Comment, end?: Comment, currentFragment?: DynamicFragment}} data
	 */
	_registerDynamicContent(index, data) {
		// @ts-ignore we need to build this object piece by piece
		const node = this.#dynamicNodes[index] ??= { type: 'content' }
		Object.assign(node, data)
	}

	/**
	 * @private
	 * @param {number} index
	 * @param {{start?: Comment, end?: Comment, current?: DynamicFragment}} data
	 */
	_registerDynamicArrayContent(index, data) {
		// @ts-ignore we need to build this object piece by piece
		const node = this.#dynamicNodes[index] ??= { type: 'array' }
		Object.assign(node, data)
	}

	/**
	 * @private
	 * @param {number} index
	 * @param {HTMLElement} element
	 */
	_registerDynamicProperty(index, element) {
		this.#dynamicNodes[index] = { type: 'property', element }
	}

	/**
	 * @private
	 * @template {Element|null} SelfElementTemplate
	 * @param {SelfElementTemplate extends Element ? null : Element|ShadowRoot|DocumentFragment} container
	 * @param {SelfElementTemplate} selfElement
	 * @param {any=} eventHandlerContext
	 */
	_connectAttributes(container, selfElement, eventHandlerContext) {

		// first traverse children
		this.#dynamicNodes.forEach((node) => {
			if (node.type == 'array') {
				/** @type {Element} */
				// @ts-ignore (There should be an element for every item in the array)
				let currentElement = node.start.nextElementSibling
				for (const arrayNode of node.current) {

					arrayNode._connectAttributes(null, currentElement, eventHandlerContext)
					// @ts-ignore (There should be an element for every item in the array)
					currentElement = currentElement.nextElementSibling
				}
			} else if (node.type == 'content' && node.currentFragment) {
				/** @type {Element|ShadowRoot|DocumentFragment} */
				// @ts-ignore
				const parent = node.start.parentNode
				node.currentFragment._connectAttributes(parent, null, eventHandlerContext)
			}
		})

		this.#attributeLocators?.forEach(locator => {
			if (locator.type == 'attributeExtension') {
				this.#dynamicNodes[locator.index] = { type: 'attributeExtension', prefix: locator.prefix, suffix: locator.suffix, associatedIndex: locator.associatedIndex }
				return
			}

			const element = locateElement(selfElement ?? container, locator)

			if (!element) {
				throw new Error(`Could not connect attribute of type: ${locator.type}`)
			}

			if (locator.type == 'sharedState') {
				/** @type {TwowayBinding} */
				const binding = this.values[locator.index]

				if (!(element instanceof HTMLInputElement ||
					element instanceof HTMLSelectElement ||
					element instanceof HTMLTextAreaElement ||
					element instanceof DeclarativeElement)) {
					throw new Error(`Can only use ${sharedStateAttributeName} with input, select, text-area, or custom element`)
				}

				if (!(element instanceof DeclarativeElement)) {
					element.addEventListener('input', (event) => this.#handleNativeInputEvent(locator, element, event))
				}

				updateElementWithSharedState(element, binding)

				this.#dynamicNodes[locator.index] = { type: 'sharedState', node: element }

			} else if (locator.type == 'attribute') {
				this.#dynamicNodes[locator.index] = { type: 'attribute', prefix: locator.prefix, suffix: locator.suffix, attribute: locator.attribute, node: element }
			} else if (locator.type == 'booleanAttribute') {
				this.#dynamicNodes[locator.index] = { type: 'attribute', attribute: locator.attribute, node: element }
			} else {
				this.#dynamicNodes[locator.index] = {
					type: 'eventhandler',
					handler: this.values[locator.index]
				}

				element.addEventListener(locator.event, (event) => {
					const handler = this.values[locator.index]
					handler.call(eventHandlerContext || element, event)
				})
			}
		})

		// this array is no longer needed
		this.#attributeLocators = null
	}

	/**
	 * @param {AttributeLocator} locator
	 * @param {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} element
	 * @param {Event} event
	 */
	#handleNativeInputEvent(locator, element, event) {
		/** @type {TwowayBinding} */
		const binding = this.values[locator.index]

		if (element instanceof HTMLInputElement && element.type == 'checkbox') {
			const valueBefore = binding.get()
			if (valueBefore instanceof Set) {
				const newSet = new Set(valueBefore)
				element.checked ?
					newSet.add(element.name) :
					newSet.delete(element.name)
				return binding.set(newSet, event)
			}
			if (valueBefore instanceof Array) {
				const indexBefore = valueBefore.indexOf(element.name)
				const newArrayValue = element.checked ?
					valueBefore.concat(element.name) :
					valueBefore.toSpliced(indexBefore, 1)
				return binding.set(newArrayValue, event)
			}
			binding.set(element.checked, event)
		} else if (element instanceof HTMLSelectElement && element.type == 'select-multiple') {
			const selected = []
			for (const option of element.selectedOptions) {
				selected.push(option.value)
			}
			binding.set(selected, event)
		} else {
			binding.set(element.value, event)
		}
	}

	/**
	 * @param {Element|DocumentFragment|ShadowRoot} container
	 * @param {any=} eventHandlerContext
	 */
	hydrate(container, eventHandlerContext) {
		if (!this.#attributeLocators) {
			// parse the html once to find attributes
			this.getHtmlString()
		}

		const commentIterator = document.createNodeIterator(
			container,
			NodeFilter.SHOW_COMMENT,
			(comment) => comment
				.textContent?.trim()
				.startsWith(commentPrefix) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
		)

		/** @type {Comment | null} */
		let currentNode
		// @ts-ignore
		while ((currentNode = commentIterator.nextNode())) {

			const [_, type, position, indexPathString] = currentNode.textContent?.split(':') ?? []

			const indexPath = indexPathString.split('-')
			const dynamicNodeIndex = Number(indexPath.pop())
			/** @type {DynamicFragment} */
			// @ts-ignore
			const dynamicFragment = indexPath.reduce(
				/** 
				 * @param {DynamicFragment | DynamicFragment[]} currentValue 
				 * @param {string} index
				 **/
				(currentValue, index) => {
					if (currentValue instanceof Array) {
						return currentValue[Number(index)]
					}
					return currentValue.values[Number(index)]
				}, this)

			const currentValue = dynamicFragment.values[dynamicNodeIndex]

			if (type == 'property' && currentNode.parentElement) {
				/** @type {PropertySetter} */
				const propertySetter = currentValue
				const element = currentNode.parentElement
				dynamicFragment._registerDynamicProperty(dynamicNodeIndex, element)
				if (propertySetter.key in element) {
					// @ts-ignore
					element[propertySetter.key] = propertySetter.value
				} else {
					console.warn('Unknown property', propertySetter.key, ' for element', element)
				}
			}
			else if (type == 'array') {
				dynamicFragment._registerDynamicArrayContent(dynamicNodeIndex, {
					[position]: currentNode,
					current: currentValue
				})
			} else {
				dynamicFragment._registerDynamicContent(dynamicNodeIndex, {
					[position]: currentNode,
					currentFragment: currentValue instanceof DynamicFragment ? currentValue : undefined
				})
			}

			// clear the content of the comment. We just need the reference to it from here
			currentNode.textContent = ''
		}

		this._connectAttributes(container, null, eventHandlerContext)

		this.#eventHandlerContext = eventHandlerContext
	}

	/**
	 * @param {HTMLElement|ShadowRoot} container 
	 * @param {any=} eventHandlerContext
	 **/
	mount(container, eventHandlerContext) {
		const htmlString = this.getHtmlString()
		container.innerHTML = htmlString
		this.hydrate(container, eventHandlerContext)
	}

	/**
	 * @private
	 * @param {any=} eventHandlerContext
	 */
	buildFragment(eventHandlerContext) {
		const template = document.createElement('template')
		template.innerHTML = this.getHtmlString()
		this.hydrate(template.content, eventHandlerContext)
		return template.content
	}

	/** 
	 * @param {number} index
	 * @param {any[]} newValues
	 **/
	#updateStringAttribute(index, newValues) {
		const originalNode = this.#dynamicNodes[index]

		if (originalNode.type == 'attributeExtension') {
			index = originalNode.associatedIndex
		}

		const attributeNode = this.#dynamicNodes[index]

		if (attributeNode.type != 'attribute') throw new Error('Unexpected update of attribute')

		const { node, attribute, prefix = '', suffix = '' } = attributeNode

		let newValue = (prefix + (newValues[index] ?? '') + suffix).trim()

		for (let node = this.#dynamicNodes[++index];
			node?.type == 'attributeExtension';
			node = this.#dynamicNodes[++index]) {
			newValue += node.prefix + (newValues[index] ?? '') + node.suffix.trimEnd()
		}

		if (attribute == 'value' && node instanceof HTMLInputElement) {
			node.value = newValue
		}

		node.setAttribute(attribute, newValue)
	}

	/** @param {any[]} newValues */
	set values(newValues) {
		const oldValues = this.values
		this.#values = newValues

		/** @type {Set<number>} */
		const updatedAttributes = new Set()

		newValues.forEach((value, index) => {
			const previousValue = oldValues[index]

			if (value == previousValue) {
				return
			}

			if (value instanceof InnerHTML && previousValue instanceof InnerHTML &&
				value.htmlString == previousValue.htmlString) {
				return
			}

			const dynamicNode = this.#dynamicNodes[index]

			switch (dynamicNode.type) {
				case 'sharedState':
					updateElementWithSharedState(dynamicNode.node, value)
					break
				case 'attribute':
					if (typeof value == 'boolean') {
						dynamicNode.node.toggleAttribute(dynamicNode.attribute, value)
					} else {
						this.#updateStringAttribute(index, newValues)
						updatedAttributes.add(index)
					}
					break
				case 'attributeExtension':
					if (!updatedAttributes.has(dynamicNode.associatedIndex)) {
						this.#updateStringAttribute(index, newValues)
						updatedAttributes.add(dynamicNode.associatedIndex)
					}
					break
				case 'property':
					/** @type {PropertySetter} */
					const { key, value: newValue } = value

					if (previousValue instanceof PropertySetter &&
						previousValue.key == key && previousValue.value == newValue
					) {
						console.log('skip update, nothing changed')
						return
					}
					// @ts-ignore
					dynamicNode.element[key] = newValue
					break;
				case 'content':
					if (value instanceof DynamicFragment && dynamicNode.currentFragment?.strings == value.strings) {
						// strings are the same. Just move the values
						dynamicNode.currentFragment.values = value.values
						break
					}
					const range = document.createRange()
					range.setStartAfter(dynamicNode.start)
					range.setEndBefore(dynamicNode.end)

					if (value instanceof DynamicFragment) {

						if (dynamicNode.currentFragment) {
							// store previous nested
							dynamicNode.currentFragment.saveFragment(range.extractContents())
							this.#fragmentCache.set(dynamicNode.currentFragment.strings, dynamicNode.currentFragment)
						} else {
							range.deleteContents()
						}

						const reusableFragment = this.#fragmentCache.get(value.strings)
						if (reusableFragment) {
							reusableFragment.restoreIn(range)
							// restore previous, and update its values
							dynamicNode.currentFragment = reusableFragment
							dynamicNode.currentFragment.values = value.values
							// remove it from the cache
							this.#fragmentCache.delete(value.strings)
						} else {
							range.insertNode(value.buildFragment(this.#eventHandlerContext))
							dynamicNode.currentFragment = value
						}
					} else {

						if (dynamicNode.currentFragment) {
							// store previous nested
							dynamicNode.currentFragment.saveFragment(range.extractContents())
							this.#fragmentCache.set(dynamicNode.currentFragment.strings, dynamicNode.currentFragment)
						} else {
							range.deleteContents()
						}
						delete dynamicNode.currentFragment
						if (value instanceof InnerHTML) {
							value.insertAfter(dynamicNode.start)
						} else {
							const textNode = new Text((value == null || value === false) ? '' : value.toString())
							range.insertNode(textNode)
						}
					}
					break
				case 'array':
					const activeFragments = dynamicNode.current

					/** @type {DynamicFragment[]} */
					const nextArray = value

					/** @type {DynamicFragment[]} */
					const previousArray = previousValue

					// compare length
					if (previousArray.length > nextArray.length) {
						let removedElements = 0

						while (removedElements < previousArray.length - nextArray.length) {

							dynamicNode.end.previousElementSibling?.remove()
							removedElements++
						}
					} else if (previousArray.length < nextArray.length) {

						const fragmentToInsert = document.createDocumentFragment()
						for (let index = previousArray.length; index < nextArray.length; index += 1) {
							const newFragment = nextArray[index]

							fragmentToInsert.append(newFragment.buildFragment(this.#eventHandlerContext))
							dynamicNode.current[index] = newFragment
						}
						dynamicNode.end.parentNode?.insertBefore(fragmentToInsert, dynamicNode.end)
					}

					let currentNode = dynamicNode.start.nextSibling
					for (let index = 0; index < Math.min(previousArray.length, nextArray.length); index += 1) {
						const activeFragment = activeFragments[index]
						const next = nextArray[index]

						const nextNode = currentNode?.nextSibling

						if (!nextNode) throw new Error('Array content is malformed. Document does not match data source.')

						if (activeFragment.strings == next.strings) {
							// strings are the same, update values
							activeFragment.values = next.values
						} else {

							/** @type {Element} */
							// @ts-ignore
							const nodeToCache = currentNode.parentElement.removeChild(currentNode)

							activeFragment.saveFragment(nodeToCache)
							this.#fragmentCache.set(activeFragment.strings, activeFragment)

							const cachedFragment = this.#fragmentCache.get(next.strings)
							if (cachedFragment) {
								if (!cachedFragment.#fragment) throw new Error('No associated fragment found. Was saveFragment called?')

								// restore previous fragment
								nextNode.before(cachedFragment.#fragment)
								activeFragments[index] = cachedFragment
								// and update its values, to update its contents
								cachedFragment.values = next.values

								// remove it from the cache
								this.#fragmentCache.delete(activeFragment.strings)
							} else {
								const fragment = next.buildFragment(this.#eventHandlerContext)
								nextNode.before(fragment)
								activeFragments[index] = next
							}

						}
						currentNode = nextNode
					}
			}
		})
	}

	/** @type {DocumentFragment|Element|null} */
	#fragment = null

	/**
	 * @param {DocumentFragment|Element} fragment
	 **/
	saveFragment(fragment) {
		this.#fragment = fragment
	}

	/**
	 * @param {Range|HTMLElement|ShadowRoot} location
	 **/
	restoreIn(location) {

		if (!this.#fragment) throw new Error('No associated fragment found. Was saveFragment called?')

		if (location instanceof Range) {
			location.insertNode(this.#fragment)
		} else {
			location.replaceChildren(this.#fragment)
		}
	}

	/** @type {Map<TemplateStringsArray, DynamicFragment>} */
	#fragmentCache = new Map()

	get values() {
		return this.#values
	}

	toString() {
		return this.getHtmlString()
	}
}
