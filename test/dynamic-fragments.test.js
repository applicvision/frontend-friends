import { before, describe, it } from '@applicvision/js-toolbox/test'
import expect from '@applicvision/js-toolbox/expect'

import { twoway, html, ref } from '@applicvision/frontend-friends'

import { innerHTML, svg } from '../src/dynamic-fragment.js'

import { addTestContainer, property } from './helpers.js'


/**
 * @param {string} text
 */
function normalizeMarkupText(text) {
	return text.replaceAll(/\s+/g, ' ').trim()
}

describe('Dynamic fragments', () => {

	/** @type {HTMLElement} */
	let testContainer

	before(() => testContainer = addTestContainer())

	it('only dynamic', () => {
		const fragment = html`${'test'}`

		fragment.mount(testContainer)

		expect(testContainer.textContent).to.equal('test')
	})

	it('Should create dynamic fragment', () => {
		const fragment = html`<div class="${'test'}">hello ${123}</div>`
		fragment.mount(testContainer)

		expect(testContainer.firstElementChild?.className).to.equal('test')
		expect(testContainer.firstElementChild?.tagName).to.equal('DIV')
		expect(testContainer.innerText).to.equal('hello 123')

		fragment.values = ['test2', 321]

		expect(testContainer.firstElementChild?.className).to.equal('test2')
		expect(testContainer.firstElementChild?.tagName).to.equal('DIV')
		expect(testContainer.innerText).to.equal('hello 321')
	})

	it('Attributes without quotes', () => {
		const fragment = html`<div class=${'test'}>hello ${123}</div>`
		fragment.mount(testContainer)

		expect(testContainer.firstElementChild?.className).to.equal('test')

		fragment.values = ['test2']

		expect(testContainer.firstElementChild?.className).to.equal('test2')
	})

	it('Attributes with numbers', () => {
		const fragment = html`<svg width=100 height=100>
			<line x1=${5} x2=${50} y1=${20} y2=${20} stroke="black" stroke-width=5 />
		</svg>`
		fragment.mount(testContainer)

		const line = testContainer.querySelector('line')

		expect(line?.x1.baseVal.value).to.equal(5)
		expect(line?.x2.baseVal.value).to.equal(50)
		expect(line?.y1.baseVal.value).to.equal(20)
		expect(line?.y2.baseVal.value).to.equal(20)

		fragment.values = [20, 20, 10, 30]

		expect(line?.x1.baseVal.value).to.equal(20)
		expect(line?.x2.baseVal.value).to.equal(20)
		expect(line?.y1.baseVal.value).to.equal(10)
		expect(line?.y2.baseVal.value).to.equal(30)
	})

	it('content which looks like attributes', () => {
		const fragment = html`<div>attribute=${'value'}</div>`
		fragment.mount(testContainer)
		expect(testContainer.textContent).to.equal('attribute=value')

		const fragment2 = html`<div class="${'class'}">attribute=${'value'}</div>`
		fragment2.mount(testContainer)
		expect(testContainer.textContent).to.equal('attribute=value')


		expect(testContainer.querySelector('.class')).to.be.a(HTMLDivElement)

		const fragment3 = html`<div
			class="prefix ${'class'}" 
			role=dialog
			id=${'element_id'}
			>div attribute=${'value'}></div>`
		fragment3.mount(testContainer)
		const element = testContainer.querySelector('#element_id')

		expect(element?.role).to.equal('dialog')
		expect(element?.className).to.equal('prefix class')
		expect(element).to.equal(testContainer.querySelector('.class'))

		const fragment4 = html`<p
			data-content="test<a class='inner-content'>hello</a>"
			id='single-${'quote'}'
			disabled
			class=${'class'}
			>< test="${'value'}</p>`

		fragment4.mount(testContainer)

		expect(testContainer.textContent).to.equal('< test="value')
	})

	it('Comments in fragment', () => {
		let fragment = html`<!-- only a comment -->`
		fragment.mount(testContainer)
		expect(testContainer.textContent).to.be.empty()
		fragment = html`${'visible'}<!-- ${'not rendered'} --> back ${'again'}`
		fragment.mount(testContainer)
		expect(testContainer.textContent).to.equal('visible back again')
		fragment = html`
			<div>
				<!-- startcomment -->
				 <h2>hello</h2>
				<!-- <div class=${'test'}>not here</div> -->
				 <span>${'here'}</span>
			</div>`
		fragment.mount(testContainer)
		expect(testContainer.innerText?.trim()).to.equal('hello\nhere')

		fragment = html`<!-- <!-- -->double start ${'comment'}`
		fragment.mount(testContainer)
		expect(testContainer.textContent).to.equal('double start comment')

		fragment = html`--><!-- double end ${'comment'}-->`;
		fragment.mount(testContainer)
		expect(testContainer.textContent).to.equal('-->')

	})

	it('update fragment with comments', () => {
		const fragment = html`
            <div>${'test'}</div>
            <!-- <div>${'commented'}</div> -->
            <div>${'after comment'}</div>
        `
		fragment.mount(testContainer)

		expect(testContainer.innerText.trim()).to.equal('test\nafter comment')

		fragment.values = ['update', 'still commented', 'update after']
		expect(testContainer.innerText.trim()).to.equal('update\nupdate after')
	})

	it('Attributes with fixed beginning', () => {
		const fragment = html`<div class="beforeclass ${'test'}">hello</div>`
		fragment.mount(testContainer)

		expect(testContainer.firstElementChild?.className).to.equal('beforeclass test')
		fragment.values = ['test2']

		expect(testContainer.firstElementChild?.className).to.equal('beforeclass test2')
	})

	it('Static fragment', () => {
		const staticFragment = html`<h1>Static</h1>`
		expect(staticFragment.isStatic).to.be.true()

		const fragment = html`<section>${staticFragment}</section>`
		fragment.mount(testContainer)

		// This should not result in warning, since fragment is static
		fragment.values = [staticFragment]

		/** @param {string} title */
		function makeDynamicFragment(title) {
			return html`<h1>${title}</h2>`
		}

		const dyn1 = makeDynamicFragment('Dyn1')
		const dyn2 = makeDynamicFragment('Dyn2')

		expect(dyn1.isStatic).to.be.false()

		fragment.values = [dyn1]

		// This results in modification of dyn1
		fragment.values = [dyn2]
		expect(dyn1.values).to.deepEqual(dyn2.values)

		// This should result in a warning
		fragment.values = [dyn1]

		expect(testContainer.textContent).to.equal('Dyn2')
	})

	it('Attributes with fixed end', () => {
		const fragment = html`<div class="${'test'} afterclass">hello</div>`
		fragment.mount(testContainer)

		expect(testContainer.firstElementChild?.className).to.equal('test afterclass')
		fragment.values = ['test2']

		expect(testContainer.firstElementChild?.className).to.equal('test2 afterclass')
	})

	it('Attributes with both fixed start and end', () => {
		const fragment = html`<div class="beforeclass ${'test'} afterclass">hello</div>`
		fragment.mount(testContainer)

		expect(testContainer.firstElementChild?.className).to.equal('beforeclass test afterclass')
		fragment.values = ['test2']

		expect(testContainer.firstElementChild?.className).to.equal('beforeclass test2 afterclass')
	})

	it('Attributes with both fixed start and end again', () => {
		const fragment = html`<a href="https://${'domain'}.test/welcome">hello</a>`
		fragment.mount(testContainer)

		const link = testContainer.querySelector('a')
		expect(link?.href).to.equal('https://domain.test/welcome')
		fragment.values = ['otherdomain']

		expect(link?.href).to.equal('https://otherdomain.test/welcome')
	})

	it('Attributes with extensions', () => {
		const fragment = html`<div class="${'first'} ${'second'}">hello</div>`
		fragment.mount(testContainer)

		const element = testContainer.firstElementChild
		expect(element?.className).to.equal('first second')
		fragment.values = ['first2', 'second']

		expect(element?.className).to.equal('first2 second')

		fragment.values = ['first2', 'second2']

		expect(element?.className).to.equal('first2 second2')

		fragment.values = ['first3', 'second3']
		expect(element?.className).to.equal('first3 second3')
	})

	it('Attributes with extension and fixed parts', () => {
		const fragment2 = html`<div class="a ${'1'} b ${'2'} c ${'3'} d">hello</div>`
		fragment2.mount(testContainer)
		const element2 = testContainer.firstElementChild
		expect(element2?.className).to.equal('a 1 b 2 c 3 d')

		fragment2.values = ['11', '22', '33']
		expect(element2?.className).to.equal('a 11 b 22 c 33 d')
	})

	it('boolean attributes', () => {
		const fragment = html`<div hidden=${true}>hello</div>`
		fragment.mount(testContainer)

		let theDiv = testContainer.querySelector('div')

		expect(theDiv?.hidden).to.be.true()
		fragment.values = [false]

		expect(theDiv?.hidden).to.be.false()
	})

	it('handling null value attributes', () => {
		const fragment = html`<div class=${null}>hello</div>`
		fragment.mount(testContainer)

		/** @type {HTMLDivElement} */
		// @ts-ignore
		let theDiv = testContainer.firstElementChild

		expect(theDiv.getAttribute('class')).to.equal('')
		fragment.values = ['the-class']

		expect(theDiv.className).to.equal('the-class')

		fragment.values = [null]

		expect(theDiv.className).to.equal('')
	})

	it('event handler', () => {
		let clicked = false
		const clickHandler = () => clicked = true
		const fragment = html`<button onclick=${clickHandler}>tryck</button>${null}`
		fragment.mount(testContainer)

		testContainer.querySelector('button')?.click()
		expect(clicked).to.be.true()

		let anotherClicked = false
		const clickHandler2 = () => anotherClicked = true

		fragment.values = [clickHandler2]
		testContainer.querySelector('button')?.click()
		expect(anotherClicked).to.be.true()

		anotherClicked = false
		const clickHandler3 = () => anotherClicked = true

		fragment.values = [() => { }, html`<button onclick=${clickHandler3}>nested</button>`]

		testContainer.querySelectorAll('button')[1]?.click()

		expect(anotherClicked).to.be.true()

	})

	it('event handler with set context', () => {
		let valueToCheck = ''
		let innerValueToCheck = ''

		const context = {
			value: 'it works'
		}

		const clickHandler = /** @this {typeof context} */ function () { valueToCheck = this.value }
		const innerClickHandler = /** @this {typeof context} */ function () { innerValueToCheck = this.value }

		const fragment = html`
			<button class="outer" onclick=${clickHandler}>tryck</button>
			<div>${html`
				<button class="nested" onclick=${innerClickHandler}>inner</button>
			`}
			</div>
		`

		fragment.mount(testContainer, context)

		// @ts-ignore
		testContainer.querySelector('button.outer')?.click()

		expect(valueToCheck).to.equal('it works')

		// @ts-ignore
		testContainer.querySelector('button.nested')?.click()

		expect(innerValueToCheck).to.equal('it works')
	})

	it('nested', () => {
		let cycle = 0
		const getChild = () => html`<div>inner:${cycle}</div>`

		const fragment = html`<div>outer:${0}${getChild()}outer:${cycle}</div>`

		fragment.mount(testContainer)

		expect(testContainer.textContent).to.equal('outer:0inner:0outer:0')

		cycle++
		fragment.values = [0, getChild(), cycle]

		expect(testContainer.textContent).to.equal('outer:0inner:1outer:1')
	})

	it('alternating nested', () => {

		let isOn = false
		let counter = 0

		/** @param {boolean} newState */
		function updateState(newState) {
			counter++
			isOn = newState
			fragment.values = [isOn ? onState() : offState()]
		}

		const offState = () => html`<button onclick=${() => updateState(true)}>on ${counter}</button>`
		const onState = () => html`<button onclick=${() => updateState(false)}>off ${counter}</button>`

		const fragment = html`<div>outer ${isOn ? onState() : offState()}</div>`

		fragment.mount(testContainer)

		expect(testContainer.textContent).to.equal('outer on 0')

		testContainer.querySelector('button')?.click()

		expect(testContainer.textContent).to.equal('outer off 1')

		testContainer.querySelector('button')?.click()

		expect(testContainer.textContent).to.equal('outer on 2')
	})

	it('list', () => {
		const list = [{ name: 'alpha' }, { name: 'beta' }, { name: 'gamma' }]

		const getLis = () => list.map((person, index) => html`<li>${person.name}</li>`)

		const fragment = html`<ul><li>Always here</li>${getLis()}</ul>`

		fragment.mount(testContainer)

		expect(testContainer.innerText).to.equal('Always here\nalpha\nbeta\ngamma')

		list[0].name = 'nytt namn'
		fragment.values = [getLis()]

		expect(testContainer.innerText).to.equal('Always here\nnytt namn\nbeta\ngamma')

		list.push({ name: 'extra' }, { name: 'extra igen' })
		fragment.values = [getLis()]

		expect(testContainer.innerText).to.equal('Always here\nnytt namn\nbeta\ngamma\nextra\nextra igen')

		list.shift()
		fragment.values = [getLis()]

		expect(testContainer.innerText).to.equal('Always here\nbeta\ngamma\nextra\nextra igen')
	})

	it('nested list', () => {
		const list = [{ name: 'alpha' }, { name: 'beta' }, { name: 'gamma' }]

		const nestedList = () => html`<ul><li>Always here</li>${list.map((person, index) => html`<li>${person.name}</li>`)}</ul>`

		const fragment = html`<h2>outer</h2>${list.at(-1)?.name}${nestedList()}`

		fragment.mount(testContainer)


		expect(testContainer.innerText).to.equal('outer\ngamma\nAlways here\nalpha\nbeta\ngamma')

		list[1].name = 'omega'
		fragment.values = [list.at(-1)?.name, nestedList()]

		expect(testContainer.innerText).to.equal('outer\ngamma\nAlways here\nalpha\nomega\ngamma')
	})

	it('list with alternative item state', () => {
		const list = [{ name: 'alpha', showDetailed: true }, { name: 'beta' }, { name: 'gamma' }]

		const getLis = () => list.map((person, index) => {
			if (person.showDetailed) {
				return html`<li>index: ${index} details:${person.name}</li>`
			}
			return html`<li>${person.name}</li>`
		})

		const fragment = html`<ul>${getLis()}</ul>`

		fragment.mount(testContainer)

		expect(testContainer.innerText).to.equal('index: 0 details:alpha\nbeta\ngamma')

		const firstLi = testContainer.querySelector('li')

		list[0].showDetailed = false
		fragment.values = [getLis()]

		expect(testContainer.innerText).to.equal('alpha\nbeta\ngamma')

		list[0].showDetailed = true
		fragment.values = [getLis()]

		expect(testContainer.innerText).to.equal('index: 0 details:alpha\nbeta\ngamma')

		// This verifies that the cache has been used
		expect(testContainer.querySelector('li')).to.equal(firstLi)
	})

	it('list of items with multiple elements', () => {
		const list = [{ term: 'term1', def: 'def1' }, { term: 'term2', def: 'def2' }]

		const dtClass = 'dt-class'
		const ddClass = 'dd-class'

		const getEntries = () => list.map(({ term, def }) => html`<dt class=${dtClass}>${term}</dt><dd class=${ddClass}>${def}</dd>`)

		const fragment = html`<dl>
			${getEntries()}
		</dl>`

		fragment.mount(testContainer)

		expect(testContainer.innerText).to.equal('term1\ndef1\nterm2\ndef2')

		list.pop()

		fragment.values = [getEntries()]

		expect(testContainer.innerText).to.equal('term1\ndef1')

		list.push({ term: 'new term', def: 'new def' })

		fragment.values = [getEntries()]

		expect(testContainer.innerText).to.equal('term1\ndef1\nnew term\nnew def')
	})

	it('list with keyed items', () => {
		const list = [
			{ id: '123', name: 'test 1' },
			{ id: '456', name: 'test 2' },
			{ id: '789', name: 'test 3' },
		]

		const getEntries = () => list.map(({ id, name }) => html`<li>${name}</li>`.key(id))

		const fragment = html`<ul>${getEntries()}</ul>`

		fragment.mount(testContainer)

		expect(testContainer.innerText).to.equal('test 1\ntest 2\ntest 3')

		list.splice(1, 0, { id: 'new', name: 'inserted' })

		fragment.values = [getEntries()]

		expect(testContainer.innerText).to.equal('test 1\ninserted\ntest 2\ntest 3')

		const first = list.shift()
		if (first) {
			first.name = 'update test 1'
			list.splice(1, 0, first)
		}

		fragment.values = [getEntries()]
		expect(testContainer.innerText).to.equal('inserted\nupdate test 1\ntest 2\ntest 3')
	})

	it('svg content', () => {
		const fragment = html`
		<div>Some svg:</div>
		<svg width=100 height=100 style="border:1px solid black">
			<circle cx=50 cy=50 r=${10}></circle>
		</svg>`

		fragment.mount(testContainer)

		const circle = testContainer.querySelector('circle')
		expect(circle?.cx.baseVal.value).to.equal(50)
		expect(circle?.r.baseVal.value).to.equal(10)

		fragment.values = [20]

		expect(circle?.r.baseVal.value).to.equal(20)
	})

	it('svg fragments', () => {
		const getCircle = (rad = 10) => svg`<circle cx=50 cy=50 r=${rad}></circle>`
		const getRect = () => svg`<rect x=30 y=20 width=30 height=10></rect>`
		const fragment = html`<svg width=100 height=100>${getCircle()}</svg>`
		fragment.mount(testContainer)
		const circle = testContainer.querySelector('circle')
		expect(circle?.r.baseVal.value).to.equal(10)

		fragment.values = [getRect()]
		const rect = testContainer.querySelector('rect')
		expect(rect?.width.baseVal.value).to.equal(30)
		expect(rect?.isConnected)
		expect(circle?.isConnected).to.be.false()

		fragment.values = [getCircle(20)]
		expect(circle?.r.baseVal.value).to.equal(20)
		expect(circle?.isConnected)
	})

	it('svg array', () => {

		const getList = (length = 3) => Array.from({ length }, (_, index) => svg.key(index)
			`<line x1=${10} x2=${20 + 20 * index} y1=${15 * (1 + index)} y2=${15 * (1 + index)} stroke="black" stroke-width=5 />`)
		const fragment = html`<svg width=100 height=100>${getList(3)}</svg>`
		fragment.mount(testContainer)

		let firstLine = testContainer.querySelector('line')
		expect(firstLine instanceof SVGLineElement)
		fragment.values = [getList(4)]
		fragment.values = [getList(2)]
		fragment.values = [getList(5)]

		firstLine = testContainer.querySelector('line')
		expect(firstLine instanceof SVGLineElement)
	})

	it('switch between array and content', () => {
		const getList = () => [1, 2, 3].map(item => html`<div>${item}</div>`)

		const fragment = html`${html`<div>loading</div>`}`

		fragment.mount(testContainer)

		expect(testContainer.textContent).to.equal('loading')

		fragment.values = [getList()]

		expect(testContainer.textContent).to.equal('123')

		fragment.values = [html`<div>loading again</div>`]

		expect(testContainer.textContent).to.equal('loading again')
	})

	it('only text', () => {
		const fragment = html`hej`

		fragment.mount(testContainer)

		expect(testContainer.textContent).to.equal('hej')
	})

	it('with innerHTML', () => {

		const fragment = html`hej <div>${innerHTML('<span>hello <b>friend</b></span>')}</div>`

		fragment.mount(testContainer)

		expect(testContainer.textContent).to.equal('hej hello friend')

		const fragment2 = html`hej <div>${'<span>hello <b>friend</b></span>'}</div>`

		fragment2.mount(testContainer)

		expect(testContainer.textContent).to.equal('hej <span>hello <b>friend</b></span>')
	})

	it('try to inject with attributes', () => {

		const fragment2 = html`<div id="${'"><input placeholder="oops"><div id="'}">hej</div>`
		fragment2.mount(testContainer)

		expect(testContainer.firstElementChild?.innerHTML).to.equal('hej')
	})

	it('inline style', () => {
		const fragment2 = html`<q style="${`background: #F00; quotes: '"' '"';`}">quotation</q>`
		fragment2.mount(testContainer)
		// @ts-ignore
		const { backgroundColor, quotes } = getComputedStyle(testContainer.firstElementChild)

		expect(quotes).to.equal('"\\"" "\\""')
		expect(backgroundColor).to.equal('rgb(255, 0, 0)')
	})

	it('primitive types', () => {
		const fragment = html`test: ${false && 'here'}`
		fragment.mount(testContainer)
		expect(testContainer.textContent).to.equal('test: ')

		fragment.values = [true && 'here']
		expect(testContainer.textContent).to.equal('test: here')

		fragment.values = [0]
		expect(testContainer.textContent).to.equal('test: 0')

		fragment.values = [null]
		expect(testContainer.textContent).to.equal('test: ')

		fragment.values = [undefined]
		expect(testContainer.textContent).to.equal('test: ')
	})

	it('Properties', () => {
		const fragment = html`<details>${property('open', true)}<summary>Test</summary></details>`
		fragment.mount(testContainer)
		/** @type {HTMLDetailsElement} */
		// @ts-ignore
		const details = testContainer.firstElementChild
		expect(details.open).to.be.true()

		fragment.values = [property('open', false)]
		expect(details.open).to.be.false()
	})

	it('Shared state', () => {
		const state = { value: 'initial' }
		const fragment = html`<input ff-share=${twoway(state, 'value')}>`
		fragment.mount(testContainer)

		const input = testContainer.querySelector('input')

		expect(input?.value).to.equal('initial')

		input?.setRangeText('new value', 0, 8)
		input?.dispatchEvent(new Event('input'))

		expect(input?.value).to.equal('new value')

		expect(state.value).to.equal('new value')
	})

	it('Shared state, object binding', async () => {
		const state = ['a', 'b', 'other']

		const fragment = html`
		<form>
			<label><input type="checkbox" name="checks" value="a" ff-share=${state}>A</label>
			<label><input type="checkbox" name="checks" value="b" ff-share=${state}>B</label>
			<label><input type="checkbox" name="checks" value="c" ff-share=${state}>C</label>
			<label><input type="checkbox" name="other" ff-share=${state}>Other</label>
		</form>
		`
		fragment.mount(testContainer)

		/** @type {HTMLInputElement[]} */
		const [aInput, bInput, cInput] = testContainer.querySelector('form')?.checks

		/** @type {HTMLInputElement} */
		const otherInput = testContainer.querySelector('form')?.other

		expect(aInput.checked).to.be.true()
		expect(bInput.checked).to.be.true()
		expect(cInput.checked).to.be.false()
		expect(otherInput.checked).to.be.true()

		let formData = new FormData(testContainer.querySelector('form') ?? undefined)
		expect(formData.getAll('checks')).to.deepEqual(['a', 'b'])
		expect(formData.get('other')).to.equal('on')

		// user interaction
		bInput.checked = false
		bInput?.dispatchEvent(new Event('input'))

		cInput.checked = true
		cInput?.dispatchEvent(new Event('input'))


		formData = new FormData(testContainer.querySelector('form') ?? undefined)
		expect(formData.getAll('checks')).to.deepEqual(['a', 'c'])
		expect(formData.get('other')).to.equal('on')

		expect(state).to.deepEqual(['a', 'other', 'c'])

		// programmatic updates
		state.splice(state.indexOf('other'), 1)

		expect(state).to.deepEqual(['a', 'c'])
		fragment.values = [state, state, state, state]

		formData = new FormData(testContainer.querySelector('form') ?? undefined)
		expect(formData.getAll('checks')).to.deepEqual(['a', 'c'])

		expect(otherInput.checked).to.be.false()
	})

	it('Static string', () => {
		const arrayOfFragments = ['one', 'two', 'three'].map(content => html`<p>${content}</p>`)
		const subFragment = html`<h2 hidden=${true}>Inner</h2>`
		const fragment = html`
			<h1 hidden=${false}>Outer</h1>
			${subFragment}
			<section>
				<h3>${'List'}</h3>
				${arrayOfFragments}
			</section>
		`
		testContainer.innerHTML = fragment.staticHtmlString

		expect(normalizeMarkupText(fragment.staticHtmlString)).to.equal(normalizeMarkupText(`
		<h1>Outer</h1>
		<h2 hidden>Inner</h2>
		<section>
			<h3>List</h3>
			<p>one</p>
			<p>two</p>
			<p>three</p>
		</section>
		 `))

	})

	it('ff-ref', () => {
		const aRef = ref()
		const fragment = html`<div ff-ref=${aRef}>test</div>`

		expect(aRef.element).to.equal(null)

		fragment.mount(testContainer)


		expect(aRef.element?.isConnected).to.be.true()
		expect(aRef.element?.textContent).to.equal('test')
		expect(aRef.element).to.equal(testContainer.querySelector('div'))

		fragment.values = [aRef]

		expect(aRef.element).to.equal(testContainer.querySelector('div'))

		testContainer.innerHTML = ''

		expect(aRef.element?.isConnected).to.be.false()
	})

	it('typed ff-ref', () => {
		const aButtonRef = ref(HTMLButtonElement)
		const fragment = html`<button ff-ref=${aButtonRef}>test</button>`

		expect(aButtonRef.element).to.equal(null)

		fragment.mount(testContainer)

		expect(aButtonRef.element).to.be.a(HTMLButtonElement)

		const anotherFragment = html`<div ff-ref=${aButtonRef}>test2</div>`

		/** @type {Error?} */
		let error = null
		try {
			anotherFragment.mount(testContainer)
		} catch (err) {
			if (err instanceof Error) error = err
		}
		expect(error).to.be.an(Error)
		expect(error?.message).to.equal('Unexpected element type')
	})

	it('ff-ref elementOrThrow', () => {
		const imageRef = ref(HTMLImageElement)
		const fragment = html`<img ff-ref=${imageRef}>`

		/** @type {Error?} */
		let error = null
		try {
			imageRef.elementOrThrow
		} catch (e) {
			if (e instanceof Error) error = e
		}
		expect(error).to.be.an(Error)
		expect(error?.message).to.equal('Missing element reference')

		fragment.mount(testContainer)

		expect(imageRef.elementOrThrow).to.be.an(HTMLImageElement)
	})
})
