import { specialAttributes } from '@applicvision/frontend-friends/special-attributes'

const attributeRegex = /(?<attribute>[a-zA-Z0-9-]+)\s*=\s*((?<quotemark>["'])(?<prefix>[^"']*))?$/
const elementForAttributeRegex = /<(?<element>[a-zA-Z-]+)\s+([a-zA-Z0-9-]+(=|(\s*=\s*"[^"]*")|(\s*=\s*'[^']*')|(=[^'"\s]+))?\s+)*$/

const commentPrefix = 'dynamic-fragment'
const contentCommentPrefix = `${commentPrefix}:content:`
const arrayContentCommentPrefix = `${commentPrefix}:array-content:`
const arrayItemSeparatorCommentPrefix = `${commentPrefix}:array-item:`
const propertyCommentPrefix = `${commentPrefix}:property:`

const attributePrefix = 'data-reactive'

/**
 * @import {AttributeLocator, DynamicNode, InterpolationDescriptor} from './types.js'
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
 * @param {(DynamicFragment|DynamicFragment[]|PropertySetter|string|number|boolean|Function|InnerHTML|object|null|undefined)[]} values
 */
export function html(strings, ...values) {
	return new DynamicFragment(strings, values)
}

/**
 * @param {TemplateStringsArray} strings
 * @param {(DynamicFragment|DynamicFragment[]|PropertySetter|string|number|boolean|Function|InnerHTML|object|null|undefined)[]} values
 */
export function svg(strings, ...values) {
	return new DynamicFragment(strings, values, true)
}

html.key = svg.key = function (/** @type {string | number} */ key) {
	/**
	* @param {TemplateStringsArray} strings
	* @param {(DynamicFragment|DynamicFragment[]|PropertySetter|string|number|boolean|Function|InnerHTML|object|null|undefined)[]} values
	*/
	return (strings, ...values) => this(strings, ...values).key(key)
}

/**
 * @param {Comment} itemStart 
 * @param {string} itemIndexPath
 **/
function nodesInItem(itemStart, itemIndexPath) {

	const itemNodes = []
	/** @type {Node|null} */
	let next = itemStart
	while (next = next.nextSibling) {

		if (next instanceof Comment) {

			const commentText = next.textContent?.trim() ?? ''

			if (commentText == `${contentCommentPrefix}${itemIndexPath}` ||
				commentText.startsWith(`${arrayItemSeparatorCommentPrefix}${itemIndexPath}:`)
			) {
				break
			}
		}

		itemNodes.push(next)
	}
	if (!next) {
		console.warn('Unexpectedly reached end of child list without finding end of item', 'indexPath:', itemIndexPath)
	}

	return itemNodes
}

/** @param {TemplateStringsArray|readonly string[]} strings */
export function interpolationDescriptors(strings) {
	/** @type {InterpolationDescriptor[]} */
	const descriptors = []

	for (let index = 0; index < strings.length - 1; index++) {

		const part = strings[index]
		const previousDescriptor = descriptors[index - 1]

		if (
			(previousDescriptor?.type == 'attributeExtension' || previousDescriptor?.type == 'attribute') &&
			previousDescriptor.quotemark && !part.includes(previousDescriptor.quotemark)) {

			const nextPart = strings[index + 1]
			const endOfQuote = nextPart.indexOf(previousDescriptor.quotemark)

			const suffix = endOfQuote == -1 ? '' : nextPart.slice(0, endOfQuote)

			descriptors.push({
				type: 'attributeExtension',
				attribute: previousDescriptor.attribute,
				attributeStart: previousDescriptor.attributeStart,
				elementName: previousDescriptor.elementName,
				quotemark: previousDescriptor.quotemark,
				prefix: part,
				suffix
			})
			continue
		}

		/** @type {RegExpMatchArray & {groups: {attribute: string, quotemark: '"'|"'"|'', prefix: string}}|null} */
		// @ts-ignore
		const attributeMatch = part.match(attributeRegex)


		/** @type {string|undefined} */
		let elementForAttribute
		if (attributeMatch) {
			const precedingString = strings
				.slice(0, index + 1)
				.join('')
				.slice(0, -attributeMatch[0].length)

			/** @type {RegExpMatchArray & {groups: {element: string}}|null} */
			// @ts-ignore
			const result = precedingString.match(elementForAttributeRegex)
			elementForAttribute = result?.groups.element
		}

		if (attributeMatch && elementForAttribute) {
			const { quotemark = '', prefix = '' } = attributeMatch.groups
			const attribute = attributeMatch.groups.attribute.toLowerCase()

			let suffix = ''
			if (quotemark) {
				const nextPart = strings[index + 1]
				const endOfQuote = nextPart.indexOf(quotemark)
				if (endOfQuote != -1) {
					suffix = nextPart.slice(0, endOfQuote)
				}
			}
			const type =
				attribute.startsWith('ff-') ? 'specialAttribute' :
					attribute.startsWith('on') ? 'eventhandler' :
						'attribute'

			descriptors.push({
				type,
				attribute,
				attributeStart: part.length - (attributeMatch.index ?? 0),
				quotemark,
				elementName: elementForAttribute,
				prefix,
				suffix
			})
		} else {
			descriptors.push({ type: 'content' })
		}

	}
	return descriptors
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

export class DynamicFragment {

	/**
	 * @type {DynamicNode[]}
	 **/
	#dynamicNodes = []

	/**
	 * @type {null | AttributeLocator[]}
	 **/
	#attributeLocators = null

	strings

	#values

	#isSvg = false

	/** @type {unknown} */
	#eventHandlerContext

	/**
	 * @param {TemplateStringsArray} strings
	 * @param  {(DynamicFragment|DynamicFragment[]|PropertySetter|string|number|boolean|Function|InnerHTML|object|null|undefined)[]} values
	 */
	constructor(strings, values, isSvg = false) {
		this.strings = strings
		this.#values = values
		this.#isSvg = isSvg
	}


	#getHtmlString(indexPathPrefix = '') {

		const { strings, values } = this

		let htmlResult = ''

		let insideComment = false

		/** @type {AttributeLocator[]} */
		const attributeLocators = []

		const descriptors = interpolationDescriptors(strings)

		values.forEach((value, index) => {
			let part = strings.raw[index]

			if (part.lastIndexOf('<!--') > part.lastIndexOf('-->')) {
				htmlResult += part
				insideComment = true
				return
			}
			if (insideComment && part.includes('-->')) {
				const endOfComment = part.indexOf('-->') + 3
				htmlResult += part.slice(0, endOfComment)
				part = part.slice(endOfComment)
				insideComment = false
			}

			if (insideComment) {
				htmlResult += part
				return
			}

			if (value instanceof PropertySetter) {
				htmlResult += part
				htmlResult += `<!-- ${propertyCommentPrefix}${indexPathPrefix}${index} -->`
				return
			}


			const interpolationDescriptor = descriptors[index]

			if (interpolationDescriptor.type == 'attributeExtension') {
				let associatedIndex = index - 1
				while (descriptors[associatedIndex].type != 'attribute') associatedIndex -= 1

				const { prefix, suffix, type, quotemark } = interpolationDescriptor
				attributeLocators[index] = { type, prefix, suffix, index, quotemark, associatedIndex }
				htmlResult += part + escapeHtml(String(value ?? ''))
				return
			}

			if (interpolationDescriptor.type == 'attribute' ||
				interpolationDescriptor.type == 'specialAttribute' ||
				interpolationDescriptor.type == 'eventhandler') {
				const { type, attributeStart, attribute, quotemark, prefix, suffix } = interpolationDescriptor

				// add the content up to the attribute. attributeStart is counted from the end of the string
				htmlResult += part.slice(0, -attributeStart)

				const dataAttributeValue = indexPathPrefix + index
				const locatorAttribute = `${attributePrefix}-${attribute}=${quotemark}${dataAttributeValue}`

				if (type == 'specialAttribute') {

					const specialAttribute = specialAttributes.get(attribute)
					if (!specialAttribute) {
						throw new Error(`Unknown special attribute: ${attribute}. Is it registered?`)
					}
					const { isValueValid } = specialAttribute
					if (prefix || suffix) {
						throw new Error(`Special attribute ${attribute} can not have prefix/suffix`)
					}

					if (isValueValid && !isValueValid(value)) throw new Error(`Invalid value for ${attribute}`)

					htmlResult += locatorAttribute
					attributeLocators[index] = { type, attribute, index, dataAttributeValue }
					return
				}
				if (type == 'eventhandler') {
					if (typeof value != 'function') {
						throw new Error('Only functions are supported as event handlers')
					}
					if (prefix || suffix) {
						throw new Error('Event handler attributes can not have prefix/suffix')
					}
					const eventName = attribute.slice(2)

					htmlResult += locatorAttribute
					attributeLocators[index] = { type, attribute, index, event: eventName, dataAttributeValue }
					return
				}


				if (typeof value == 'boolean') {
					if (prefix || suffix) {
						throw new Error('Boolean attributes can not have prefix/suffix')
					}
					if (quotemark) {
						throw new Error('Unexpected quotemark for boolean attribute.')
					}
					htmlResult += locatorAttribute
					if (value) {
						htmlResult += ` ${attribute}`
					}

					attributeLocators[index] = {
						type: 'booleanAttribute',
						index,
						attribute,
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
					} else if (attributeValue == '') {
						attributeValue = '""'
					} else if (attributeValue.includes(' ')) {
						attributeValue = `"${attributeValue.replaceAll('"', quoteEscape['"'])}"`
					}
					htmlResult += ` ${attribute}=${quotemark}${attributeValue}`

					attributeLocators[index] = {
						type,
						attribute,
						quotemark,
						index,
						prefix,
						suffix,
						dataAttributeValue
					}
				} else {
					throw new Error(`Illegal attribute value: ${value}, type: ${typeof value}, constructor: ${value?.constructor?.name}`)
				}
				return
			}

			// Treat as dynamic content
			htmlResult += part

			const isArray = Array.isArray(value)

			// insert a comment to track position to enter content
			htmlResult += `<!-- ${isArray ? arrayContentCommentPrefix : contentCommentPrefix}${indexPathPrefix}${index} -->`

			if (isArray) {
				value.forEach((dynamicFragment, arrayIndex) => {
					if (dynamicFragment instanceof DynamicFragment) {
						htmlResult += dynamicFragment.#getHtmlString(indexPathPrefix + index + '-' + arrayIndex + '-')
						if (arrayIndex < value.length - 1) {
							htmlResult += `<!-- ${arrayItemSeparatorCommentPrefix}${indexPathPrefix}${index}:${arrayIndex + 1} -->`
						}
					} else {
						throw new Error('Array item must be declared with html')
					}
				})
			} else if (value instanceof DynamicFragment) {
				htmlResult += value.#getHtmlString(indexPathPrefix + index + '-')
			} else if (value instanceof InnerHTML) {
				htmlResult += value.htmlString
			} else if (value || value === 0) {
				htmlResult += escapeHtml(value.toString())
			} else {
				// falsy content (except 0) does not render anything
			}
			htmlResult += `<!-- ${contentCommentPrefix}${indexPathPrefix}${index} -->`

		})
		htmlResult += strings[strings.length - 1]

		this.#attributeLocators = attributeLocators

		return htmlResult
	}

	/**
	 * @param {unknown} eventHandlerContext
	 */
	#connectAttributes(eventHandlerContext) {

		// first traverse children
		this.#dynamicNodes.forEach((node, index) => {
			if (node.type == 'content') {

				const dynamicPart = this.values[index]

				if (Array.isArray(dynamicPart)) {
					for (const arrayNode of dynamicPart) {
						arrayNode.#connectAttributes(eventHandlerContext)
					}

				} else if (dynamicPart instanceof DynamicFragment) {

					dynamicPart.#connectAttributes(eventHandlerContext)
				}
			}
		})

		this.#attributeLocators?.forEach(locator => {
			if (locator.type == 'attributeExtension') {
				this.#dynamicNodes[locator.index] = { type: 'attributeExtension', prefix: locator.prefix, suffix: locator.suffix, associatedIndex: locator.associatedIndex }
				return
			}

			const element = this.#locateElement(locator)

			if (!element) {
				throw new Error(`Could not connect attribute of type: ${locator.type}`)
			}

			if (locator.type == 'specialAttribute') {
				const value = this.values[locator.index]

				const attributeSpecification = specialAttributes.get(locator.attribute)

				if (!attributeSpecification) throw new Error('Unknown attribute')

				const { isValueValid, connect, update } = attributeSpecification

				if (isValueValid && !isValueValid(value)) {
					throw new Error(`Invalid value for ${locator.attribute}`)
				}

				connect?.(element, () => this.values[locator.index])
				update(element, value)

				this.#dynamicNodes[locator.index] = { type: 'specialAttribute', attribute: locator.attribute, node: element }
			} else if (locator.type == 'attribute') {
				this.#dynamicNodes[locator.index] = { type: 'attribute', prefix: locator.prefix, suffix: locator.suffix, attribute: locator.attribute, node: element }
			} else if (locator.type == 'booleanAttribute') {
				this.#dynamicNodes[locator.index] = { type: 'attribute', attribute: locator.attribute, node: element }
			} else {
				this.#dynamicNodes[locator.index] = {
					type: 'eventhandler'
				}

				element.addEventListener(locator.event, (event) => {
					const handler = this.values[locator.index]

					if (typeof handler !== 'function') throw new Error('Must pass function as event handler')

					handler?.call(eventHandlerContext || element, event)
				})
			}
		})

		// this array is no longer needed
		this.#attributeLocators = null
	}

	/**
	 * @param {Exclude<AttributeLocator, {type: 'attributeExtension'}>} locator
	 */
	#locateElement(locator) {
		if (!this.#nodes) {
			throw new Error('Can not locate element when fragment is not mounted')
		}

		const dataAttribute = `${attributePrefix}-${locator.attribute}`

		/** @type {Element?} */
		let element = null

		const elementNodes = this.#nodes.filter(node => node instanceof Element)
		if (elementNodes.length == 1) {
			const onlyElement = elementNodes[0]
			element = onlyElement.getAttribute(dataAttribute) == locator.dataAttributeValue ?
				onlyElement : onlyElement.querySelector(`[${dataAttribute}="${locator.dataAttributeValue}"]`)
		} else {
			const parent = this.#nodes[0].parentNode
			element = parent?.querySelector(`[${dataAttribute}="${locator.dataAttributeValue}"]`) ?? null
		}
		element?.removeAttribute(dataAttribute)

		return element
	}

	/**
	 * @param {Element|DocumentFragment|ShadowRoot} container
	 * @param {unknown=} eventHandlerContext
	 */
	hydrate(container, eventHandlerContext) {
		this.#nodes = [...container.childNodes]
		if (!this.#attributeLocators) {
			// parse the html once to find attributes
			this.#getHtmlString()
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

			/** @type {[string, ('content'|'array-content'|'array-item'|'property'), string, string]} */
			// @ts-ignore
			const [_, type, indexPathString, arrayIndex] = currentNode.textContent?.trim().split(':') ?? ['', '', '', '']

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
					const subFragment = currentValue.values[Number(index)]
					if (!(Array.isArray(subFragment) || subFragment instanceof DynamicFragment)) {
						throw new Error('Unexpected nesting')
					}
					return subFragment
				}, this)

			const currentValue = dynamicFragment.values[dynamicNodeIndex]

			if (type == 'property' && currentNode.parentElement && currentValue instanceof PropertySetter) {

				const element = currentNode.parentElement
				dynamicFragment.#dynamicNodes[dynamicNodeIndex] = { type: 'property', element }
				if (currentValue.key in element) {
					// @ts-ignore
					element[currentValue.key] = currentValue.value
				} else {
					console.warn('Unknown property', currentValue.key, ' for element', element)
				}
			}
			else if (type == 'array-content' && Array.isArray(currentValue)) {

				dynamicFragment.#dynamicNodes[dynamicNodeIndex] = {
					type: 'content',
					start: currentNode,
					// This is not really the end, but set it for now (prevents ts-warning)
					end: currentNode,
				}
				if (currentValue.length > 0) {
					currentValue[0].#nodes = nodesInItem(currentNode, indexPathString)
				}
			} else if (type == 'array-item' && Array.isArray(currentValue)) {

				currentValue[Number(arrayIndex)].#nodes = nodesInItem(currentNode, indexPathString)

				currentNode.remove()
			} else {
				/** @type {Extract<DynamicNode, {type: 'content'}> | undefined} */
				// @ts-ignore
				const node = dynamicFragment.#dynamicNodes[dynamicNodeIndex]
				if (!node) {
					dynamicFragment.#dynamicNodes[dynamicNodeIndex] = {
						type: 'content',
						start: currentNode,
						end: currentNode
					}
					if (currentValue instanceof DynamicFragment) {
						currentValue.#nodes = nodesInItem(currentNode, indexPathString)
					}
				} else {
					node.end = currentNode
				}
			}

			// clear the content of the comment. We just need the reference to it from here
			currentNode.textContent = ''
		}

		this.#connectAttributes(eventHandlerContext)

		this.#eventHandlerContext = eventHandlerContext
	}

	/** @type {Node[]?} */
	#nodes = null

	/**
	 * @param {HTMLElement|ShadowRoot} container 
	 * @param {unknown=} eventHandlerContext
	 **/
	mount(container, eventHandlerContext) {
		container.innerHTML = this.toString()
		this.hydrate(container, eventHandlerContext)
	}

	#unmount() {
		if (!this.#nodes) return
		const parent = this.#nodes[0]?.parentNode
		for (const node of this.#nodes) {
			parent?.removeChild(node)
		}
	}

	/** @param {DynamicFragment} fragment */
	#replaceWith(fragment) {
		if (!this.#nodes) throw new Error('Can not replace something that is not mounted')

		const parent = this.#nodes[0]?.parentElement
		if (!parent) throw new Error('No parent element found')

		const newNodes = fragment.#nodes
		if (!newNodes) throw new Error('Can not replace with something that has no nodes')

		this.#nodes.forEach((node, index, array) => {
			if (index == array.length - 1) {
				const newFragment = document.createDocumentFragment()
				newFragment.append(...newNodes)
				parent.replaceChild(newFragment, node)
			} else {
				parent.removeChild(node)
			}
		})
	}

	/** @param {DynamicFragment} fragment */
	#after(fragment) {
		if (!this.#nodes) throw new Error('Can not add something after an unmounted fragment')
		if (!fragment.#nodes) throw new Error('Can not add something that has no nodes')

		const lastNode = this.#nodes.at(-1)
		if (lastNode instanceof CharacterData || lastNode instanceof Element) {
			lastNode.after(...fragment.#nodes)
		} else {
			throw new Error(`Unexpected node type: ${lastNode}`)
		}
	}

	/**
	 * @param {unknown=} eventHandlerContext
	 */
	#buildFragment(eventHandlerContext) {
		/** @type {DocumentFragment} */
		let fragment
		if (this.#isSvg) {
			const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'g')
			wrapper.innerHTML = this.#getHtmlString()
			fragment = document.createDocumentFragment()
			fragment.append(...wrapper.childNodes)
		} else {
			const template = document.createElement('template')
			template.innerHTML = this.#getHtmlString()

			// This upgrades custom elements
			fragment = document.importNode(template.content, true)
		}

		this.hydrate(fragment, eventHandlerContext)
		return fragment
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

		let newValue = prefix.trimStart() + (newValues[index] ?? '') + suffix

		for (let node = this.#dynamicNodes[++index];
			node?.type == 'attributeExtension';
			node = this.#dynamicNodes[++index]) {
			newValue += node.prefix + (newValues[index] ?? '') + node.suffix.trimEnd()
		}

		if (attribute == 'value' && node instanceof HTMLInputElement) {
			node.value = newValue
		} else {
			node.setAttribute(attribute, newValue)
		}
	}

	/**
	 * @param {Extract<DynamicNode, {type: 'attribute'}>} dynamicNode
	 * @param {boolean} newValue
	 */
	#updateBooleanAttribute({ attribute, node }, newValue) {
		// set property instead of updating attribute for native inputs
		if (node instanceof HTMLInputElement && attribute == 'checked') {
			node.checked = newValue
		} else {
			node.toggleAttribute(attribute, newValue)
		}

	}

	set values(newValues) {

		/** @type {Set<number>} */
		const updatedAttributes = new Set()

		this.#values = newValues.map((value, index) => {
			const previousValue = this.values[index]
			const dynamicNode = this.#dynamicNodes[index]

			if (dynamicNode.type == 'specialAttribute') {
				const specialAttribute = specialAttributes.get(dynamicNode.attribute)
				specialAttribute?.update(dynamicNode.node, value, previousValue)

				return value
			}

			if (value == previousValue) {
				return value
			}

			if (value instanceof InnerHTML && previousValue instanceof InnerHTML &&
				value.htmlString == previousValue.htmlString) {
				return value
			}


			switch (dynamicNode?.type) {
				case 'attribute':
					if (typeof value == 'boolean') {
						this.#updateBooleanAttribute(dynamicNode, value)
					} else {
						this.#updateStringAttribute(index, newValues)
						updatedAttributes.add(index)
					}
					return value
				case 'attributeExtension':
					if (!updatedAttributes.has(dynamicNode.associatedIndex)) {
						this.#updateStringAttribute(index, newValues)
						updatedAttributes.add(dynamicNode.associatedIndex)
					}
					return value
				case 'property':

					if (!(value instanceof PropertySetter)) throw new Error('Expected instance of PropertyStter')

					const { key, value: newPropertyValue } = value

					if (!(previousValue instanceof PropertySetter) ||
						previousValue.key != key || previousValue.value != newPropertyValue
					) {
						// @ts-ignore
						dynamicNode.element[key] = newPropertyValue
					}
					return value
				case 'content':
					if (
						value instanceof DynamicFragment &&
						previousValue instanceof DynamicFragment &&
						previousValue.strings == value.strings) {
						// strings are the same. Just move the values
						previousValue.values = value.values

						// Keep the previous value since no replacement has been made
						return previousValue
					}
					const range = document.createRange()
					range.setStartAfter(dynamicNode.start)
					range.setEndBefore(dynamicNode.end)


					if (Array.isArray(previousValue)) {
						if (Array.isArray(value)) { // array => array

							if (value.some((value, index) => value == previousValue[index])) {
								console.warn('Detected identical item in array. Please recreate dynamic fragments for every list rendering')
								return value
							}

							if (value.length && previousValue.length &&
								previousValue.every(fragment => fragment.#key) &&
								value.every(fragment => fragment.#key)) {

								return this.#keyedListUpdate(previousValue, value, dynamicNode)
							}
							return this.#simpleListUpdate(previousValue, value, dynamicNode)
						}

						// array => simple content

						// Clear array content
						this.#simpleListUpdate(previousValue, [], dynamicNode)

						return this.#updateWithContent(value, dynamicNode)

					}

					if (previousValue instanceof DynamicFragment) {
						// store previous fragment
						previousValue.#unmount()
						this.#cacheFragment(previousValue)
					} else {
						range.deleteContents()
					}

					if (value instanceof Array) {
						return this.#simpleListUpdate([], value, dynamicNode)
					}

					return this.#updateWithContent(value, dynamicNode)

				default: return value
			}
		})
	}

	/**
	 * @param {any} value
	 * @param {Extract<DynamicNode, {type: 'content'}>} dynamicNode
	 */
	#updateWithContent(value, dynamicNode) {
		// TODO: Range is probably not needed when there are dom references
		const range = document.createRange()
		range.setStartAfter(dynamicNode.start)
		range.setEndBefore(dynamicNode.end)
		if (value instanceof DynamicFragment) {

			const reusableFragment = this.#getCached(value)
			if (reusableFragment) {
				// restore previous, and update its values
				reusableFragment.restoreIn(range)
				reusableFragment.values = value.values
				return reusableFragment
			}
			range.insertNode(value.#buildFragment(this.#eventHandlerContext))
			return value
		}

		if (value instanceof InnerHTML) {
			value.insertAfter(dynamicNode.start)
		} else {
			const textNode = new Text((value == null || value === false) ? '' : value.toString())
			range.insertNode(textNode)
		}
		return value
	}

	/**
	 * @param {DynamicFragment[]} previousArray
	 * @param {DynamicFragment[]} nextArray
	 * @param {Extract<DynamicNode, {type: 'content'}>} dynamicNode
	 */
	#simpleListUpdate(previousArray, nextArray, dynamicNode) {

		// Remove and cache fragments when array is shorter
		while (previousArray.length > nextArray.length) {

			const activeFragment = previousArray.pop()

			if (!activeFragment) throw new Error('Unexpected Error: Did not find active fragment to cache')

			activeFragment.#unmount()
			this.#cacheFragment(activeFragment)
		}

		const updatedExistingItems = previousArray.map((activeFragment, index) => {
			const newFragment = nextArray[index]

			if (activeFragment.strings == newFragment.strings) {
				// strings are the same, update values
				activeFragment.values = newFragment.values
				return activeFragment
			}

			this.#cacheFragment(activeFragment)

			const cachedFragment = this.#getCached(newFragment)
			if (cachedFragment) {
				activeFragment.#replaceWith(cachedFragment)

				cachedFragment.values = newFragment.values
				nextArray[index] = cachedFragment
				return cachedFragment

			}
			newFragment.#buildFragment(this.#eventHandlerContext)
			activeFragment.#replaceWith(newFragment)
			return newFragment
		})

		/** @type {DocumentFragment?} */
		let fragmentToInsert = null

		const newItems = nextArray.slice(previousArray.length).map((newFragment) => {
			const cachedFragment = this.#getCached(newFragment)
			fragmentToInsert ??= document.createDocumentFragment()
			if (cachedFragment) {
				if (!cachedFragment.#nodes) throw new Error('no nodes found??')

				fragmentToInsert.append(...cachedFragment.#nodes)

				// and update its values, to update its contents
				cachedFragment.values = newFragment.values

				return cachedFragment
			}
			fragmentToInsert.append(newFragment.#buildFragment(this.#eventHandlerContext))
			return newFragment
		})

		if (fragmentToInsert) {
			dynamicNode.end.before(fragmentToInsert)
		}

		return updatedExistingItems.concat(newItems)
	}

	/**
	 * @param {DynamicFragment[]} currentFragments
	 * @param {DynamicFragment[]} nextArray
	 * @param {Extract<DynamicNode, {type: 'content'}>} dynamicNode
	 */
	#keyedListUpdate(currentFragments, nextArray, dynamicNode) {

		/** @type {Map<number, number>} */
		const indexMapping = new Map()

		/** @type {DynamicFragment?} */
		let currentFragment = null

		for (let index = 0; index < currentFragments.length; index++) {
			const fragment = currentFragments[index]
			const nextIndex = nextArray.findIndex(nextFragment => nextFragment.#key == fragment.#key && nextFragment.strings == fragment.strings)
			if (nextIndex == -1) {
				fragment.#unmount()
				this.#cacheFragment(fragment)
				currentFragments.splice(index, 1)
				index -= 1
			} else {
				indexMapping.set(nextIndex, index)
			}
		}

		const mappedNext = nextArray.map((nextFragment, index) => {

			const previousIndex = indexMapping.get(index) ?? -1

			/** @type {DynamicFragment} */
			let fragmentToAppend

			if (previousIndex != -1) {
				const previousFragment = currentFragments[previousIndex]
				previousFragment.values = nextFragment.values
				if (index == previousIndex) {
					currentFragment = previousFragment
					return previousFragment
				}
				fragmentToAppend = previousFragment

			} else {
				const cachedFragment = this.#getCached(nextFragment)

				if (cachedFragment && nextFragment.#key) {
					cachedFragment.key(nextFragment.#key)
					cachedFragment.values = nextFragment.values
					fragmentToAppend = cachedFragment
				} else {
					nextFragment.#buildFragment(this.#eventHandlerContext)
					fragmentToAppend = nextFragment
				}
			}

			if (currentFragment) {
				currentFragment.#after(fragmentToAppend)
			} else {
				dynamicNode.start.after(...fragmentToAppend.#nodes ?? [])
			}
			currentFragment = fragmentToAppend
			return fragmentToAppend
		})

		return mappedNext
	}

	/** @type {string?} */
	#key = null

	/** @param {string|number} key */
	key(key) {
		this.#key = String(key)
		return this
	}

	/**
	 * @param {Range|HTMLElement|ShadowRoot} location
	 **/
	restoreIn(location) {

		if (!this.#nodes) throw new Error('No nodes to insert. Was this fragment ever mounted?')

		if (location instanceof Range) {
			const fragment = document.createDocumentFragment()
			fragment.append(...this.#nodes)
			location.insertNode(fragment)

		} else {
			location.replaceChildren(...this.#nodes)
		}
	}

	/** @type {Map<TemplateStringsArray, DynamicFragment[]>} */
	#fragmentCache = new Map()

	/** @param {DynamicFragment} fragment */
	#getCached(fragment) {
		return this.#fragmentCache.get(fragment.strings)?.pop()
	}

	/** @param {DynamicFragment} fragment */
	#cacheFragment(fragment) {
		let cacheArray = this.#fragmentCache.get(fragment.strings)
		if (!cacheArray) {
			cacheArray = []
			this.#fragmentCache.set(fragment.strings, cacheArray)
		}
		cacheArray.push(fragment)
	}

	get values() {
		return this.#values
	}

	toString() {
		return this.#getHtmlString()
	}

	/** @type {string} */
	get staticHtmlString() {

		return this.strings.reduce((total, nextStringLiteral, index) => {

			const value = index < this.values.length ? this.values[index] : ''

			if (Array.isArray(value)) {
				return total + nextStringLiteral + value.map((/** @type {unknown} */item) => {
					if (item instanceof DynamicFragment) {
						return item.staticHtmlString
					}
					console.warn('Unexpected array item when creating static html string', item)
					return `${item}`
				}).join('\n')
			}
			if (value instanceof DynamicFragment) {
				return total + nextStringLiteral + value.staticHtmlString
			}

			if (typeof value == 'string' || typeof value == 'number') {
				return total + nextStringLiteral + value
			}

			if (typeof value == 'boolean') {
				/** @type {RegExpMatchArray & {groups: {attribute: string, quotemark: '"'|"'"|'', prefix: string}}|null} */
				// @ts-expect-error
				const attributeMatch = nextStringLiteral.match(attributeRegex)
				if (attributeMatch && !attributeMatch.groups.quotemark && !attributeMatch.groups.prefix) {
					return total + nextStringLiteral.slice(0, value ? -1 : -(2 + attributeMatch.groups.attribute.length))
				}

			}

			console.warn('Unexpected value skipped when building static html string: ', value, 'Last string:', nextStringLiteral)
			return total + nextStringLiteral

		}, '')
	}
}
