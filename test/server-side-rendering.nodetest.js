import { describe, it } from 'node:test'
import assert from 'node:assert'
import { island, html, definePlugin } from '@applicvision/frontend-friends'

describe('Server side rendering', () => {
	it('Should render a string', () => {
		const result = html`<h1>hello ${'name'}</h1>`.toString()
		assert.equal(result, '<h1>hello <!-- dynamic-fragment:content:0 -->name<!-- dynamic-fragment:content:0 --></h1>')
	})

	it('should render an island', () => {
		const test = island(() => html`test ${'name'}`)
		assert.equal(test.hydratable, 'test <!-- dynamic-fragment:content:0 -->name<!-- dynamic-fragment:content:0 -->')
	})

	it('should handle an island with plugins', () => {
		const testPlugin = definePlugin(() => {
			const state = {
				value: 0
			}
			return {
				state
			}
		})
		const testWithPlugins = island({ plugins: { testPlugin } }, (context) => {
			const { value } = context.plugins.testPlugin
			return html`value: ${value}`
		})

		const { hydratable } = testWithPlugins
		assert.equal(hydratable, 'value: <!-- dynamic-fragment:content:0 -->0<!-- dynamic-fragment:content:0 -->')
	})
})
