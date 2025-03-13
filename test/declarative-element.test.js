import { before, describe, it } from '@applicvision/js-toolbox/test'
import expect from '@applicvision/js-toolbox/expect'
import { DeclarativeElement, css, innerCSS } from '../src/declarative-element.js'
import { html, innerHTML } from '../src/dynamic-fragment.js'
import { addTestContainer } from './helpers.js'


/** @param {HTMLElement} element */
function shadowText(element) {
	return element.shadowRoot?.textContent ?? ''
}

/**
 * @param {HTMLElement} element
 * @return {HTMLElement}
 */
function firstShadowElement(element) {
	// @ts-ignore
	return element.shadowRoot?.firstElementChild
}

describe('Declarative Element component', () => {

	/** @type {HTMLElement} */
	let testContainer


	before(() => testContainer = addTestContainer())

	class ColorfulElement extends DeclarativeElement {
		static style = css`
			div {
				background: green;
				color: yellow;
			}
			${css`
				div {
					margin: ${innerCSS('5px;')}
				}
			`}
		`
		render() {
			return html`<div>colorful</div>`
		}
	}

	class AttributedElement extends DeclarativeElement {
		static observedAttributes = ['attr-one', 'attr-two']

		render() {
			const attrOne = this.getAttribute('attr-one') ?? 'no attr one'
			const attrTwo = this.getAttribute('attr-two') ?? 'no attr two'
			return html`<div>${attrOne}, ${attrTwo}</div>`
		}
	}

	before(() => {
		customElements.define('test-styled', ColorfulElement)
		customElements.define('test-attributes', AttributedElement)
	})

	it('Should be styled', () => {
		const element = new ColorfulElement
		testContainer.replaceChildren(element)
		expect(getComputedStyle(firstShadowElement(element)).backgroundColor).to.equal('rgb(0, 128, 0)')
		expect(getComputedStyle(firstShadowElement(element)).color).to.equal('rgb(255, 255, 0)')
		expect(getComputedStyle(firstShadowElement(element)).margin).to.equal('5px')
	})


	it('attributes', async () => {

		const testelement = new AttributedElement
		testContainer.replaceChildren(testelement)
		expect(shadowText(testelement)).to.equal('no attr one, no attr two')
		testelement.setAttribute('attr-one', 'attr one value')

		await testelement.pendingUpdate
		expect(shadowText(testelement)).to.equal('attr one value, no attr two')

		testelement.setAttribute('attr-two', 'Second attribute')
		testelement.removeAttribute('attr-one')

		await testelement.pendingUpdate
		expect(shadowText(testelement)).to.equal('no attr one, Second attribute')
	})
})
