import { before, describe, it } from '@applicvision/js-toolbox/test'
import expect from '@applicvision/js-toolbox/expect'
import { spy } from '@applicvision/js-toolbox/function-spy'
import { DeclarativeElement, css, innerCSS } from '../src/declarative-element.js'
import { html } from '../src/dynamic-fragment.js'
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

	class InternalStateElement extends DeclarativeElement {
		state = this.reactive({ text: '' })

		emitChangeEvent() {
			this.dispatchEvent(new CustomEvent('statechange'))
		}

		emitClick() {
			this.dispatchEvent(new CustomEvent('clicked'))
		}
		/** @protected */
		render() {
			return html`
				<input ff-share=${this.twoway(this.state, 'text').withEffect(this.emitChangeEvent)}>
				<button type="button" onclick=${this.emitClick}>click me</button>
			`
		}
	}

	before(() => {
		customElements.define('internal-state-element', InternalStateElement)
	})

	it('bound event handler and effects', () => {
		const element = new InternalStateElement
		testContainer.replaceChildren(element)

		const statechangeSpy = spy()
		const clickedSpy = spy()
		// @ts-ignore
		element.addEventListener('statechange', statechangeSpy)
		// @ts-ignore
		element.addEventListener('clicked', clickedSpy)

		const input = element.shadowRoot?.querySelector('input')

		input?.setRangeText('new value', 0, 8)
		input?.dispatchEvent(new Event('input'))

		// change text
		expect(statechangeSpy.calls).to.equal(1)
		expect(clickedSpy.calls).to.equal(0)

		// push button
		const button = element.shadowRoot?.querySelector('button')
		button?.click()

		expect(statechangeSpy.calls).to.equal(1)
		expect(clickedSpy.calls).to.equal(1)

	})
})
