import { before, describe, it } from '@applicvision/js-toolbox/test'
import expect from '@applicvision/js-toolbox/expect'
import { spy } from '@applicvision/js-toolbox/function-spy'
import { DeclarativeElement, css, innerCSS } from '../src/declarative-element.js'
import { html } from '../src/dynamic-fragment.js'
import { addTestContainer, shadowText } from './helpers.js'


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


	class TopLevelDynamic extends DeclarativeElement {
		state = this.reactive({ active: false })
		render() {
			return html`
			${this.state.active ?
					html`<button onclick=${() => this.state.active = false}>off</button>` :
					html`<button onclick=${() => this.state.active = true}>on</button>`
				}
			`
		}
	}

	/** @extends {DeclarativeElement<boolean>} */
	class ReactiveArrayElement extends DeclarativeElement {

		static sharedStateName = 'active'

		state = this.reactive(['a'])

		/**
		 * @param {string} value
		 */
		addToState(value) {
			this.state.push(value)
		}

		get selection() {
			return Array.from(
				this.shadowRoot?.querySelector('select')?.selectedOptions ?? []
			).map(option => option.value)
		}

		render() {
			return html`
				<select multiple ff-share=${this.state}>
					<option value="a">option a</option>
					<option value="b">option b</option>
					<option value="c">option c</option>
				</select>
				`
		}
	}

	before(() => {
		customElements.define('test-styled', ColorfulElement)
		customElements.define('test-attributes', AttributedElement)
		customElements.define('test-toplevel-dynamic', TopLevelDynamic)
		customElements.define('test-reactive-array', ReactiveArrayElement)
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


	it('can change top level dynamic content', async () => {
		const element = new TopLevelDynamic
		testContainer.replaceChildren(element)

		expect(shadowText(element)).to.equal('on')

		firstShadowElement(element).click()
		await element.pendingUpdate

		expect(shadowText(element)).to.equal('off')
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
				<div id="rendering">${this.isRendering}</div>
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

		expect(element.isRendering).to.be.false()
		expect(element.shadowRoot?.getElementById('rendering')?.textContent).to.equal('true')
	})

	it('top level array state', async () => {
		const element = new ReactiveArrayElement
		testContainer.replaceChildren(element)

		expect(element.selection).to.deepEqual(['a'])

		element.addToState('b')

		await element.pendingUpdate
		expect(element.selection).to.deepEqual(['a', 'b'])
	})
})
