## `@applicvision/frontend-friends`

The main export exports the most commonly used functionality from the specific exports.

- [DeclarativeElement](#declarativeelement)
- html
- css
- island

## `@applicvision/frontend-friends/declarative-element`

### `DeclarativeElement`

```javascript
class DeclarativeElement extends HTMLElement
```

Base class for creating custom elements. Extend this class, and then register it in the customElements registry with an associated name.

```javascript
class MyCustomElement extends DeclarativeElement {}

customElements.define(MyCustomElement, 'custom-element')
```

#### Constructor

Instantiate your custom element either by adding it to your HTML-document,
```html
<my-custom-element></my-custom-element>
```

Or in JavaScript with `document.createElement('my-custom-element')` or `new MyCustomElement()`.


#### Static properties

>*You can set these static properties on the subclass in order to customize common appearance and behaviour of all instances.*

##### `static style: StyleDeclaration|StyleDeclaration[]`

Adds stylesheet(s) to your component's shadow DOM.

##### `static sharedStateName: string?`

Setting this to a valid string identifier will add it to the element's [custom state set](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals/states) when the [shared state](TODO: insert link to ff-share) is truthy.

##### `static observedAttributes: string[]`

Add the names of the attributes to which changes should trigger an re-render of the component.

#### Instance properties

##### `set sharedStateBinding: TwoWayBinding`

Set this property to a binding object to make the element's state two-way bound. If you want to use a [reactive](TODO:LINK) object as a shared state, the [`twoway`](TODO:link) function can be used here. But any object conforming to [`TwoWayBinding`](TODO:LINK) can be used.

##### `protected get sharedState`

Read the currently shared state. This will call the `get` function of the `sharedStateBinding`.

##### `protected set sharedState`

Update the shared state. This will call the `set` function of the `sharedStateBinding`.

#####  `pendingUpdate: Promise|null`

If an updating is awaiting, `pendingUpdate` is a promise which resolves when the update is complete. Otherwise it is `null`.


#### Instance methods

##### `render()` `=>` [`DynamicFragment`](TODO:link)

Implement the render function to visually represent the state of your component. Use the `html`-tag function to create a Dynamic Fragment. Please consult the section about the html tag function to get more usage information.

> Note: Do not manually call the render function. It will be called by the rendering logic when needed.

Example:
```javascript
render() {
	return html`<div>hello</div>`
}
```

##### `invalidate()` `=>` `Promise`

Call invalidate to request an asynchronous re-render of the component. The function returns a promise which resolves when the component has been updated.

`forwardSharedState()` `=>` [`TwoWayBinding`](TODO:link)

This function can be called in the render function to pass on the shared state to an inner element.
Example:
```javascript
class MyCoolInput extends DeclarativeElement {
	render() {
		return html`
		<div>
			<input ff-share=${this.forwardSharedState()}>
		</div>`
	}
}
```

##### `sharedStateChanged()`

This function can be overriden by your component class, if you want to customize the behaviour when the shared state changes. The default implementation calls `invalidate()` and 

##### `reactive<T extends Object<string, any>>(object: T, effect?: (keypath: string[]) => void)` `=>` `T`

Call `reactive` to convert an initial state object to a deep reactive object. Any subsequent change to the object will trigger the effect function. The default effect function simply trigger an update using [`invalidate()`](#invalidate--promise). To create reactivity, a JavaScript Proxy is used. The deep watch functionality is also available on its own, deepWatch.

**Example:**
```javascript
class StatefulComponent extends DeclarativeElement {
	state = this.reactive({
		initialValue: 1,
		nested: {
			value: 2
		}
	})

	handleChange() {
		// This will cause a re-render
		this.state.nested.value += 1
	}
}
```

### `css(strings: [String], ...values)`

Tag function for adding CSS to your component. The function returns an instance of `StyleDeclaration` which can be assigned to the component's [style](#static-style-styledeclarationstyledeclaration). The CSS will be added to the `adoptedStyleSheets` property of the shadow root. Thus, it will be isolated from 'outside' CSS. The tag function supports nesting and also other strings using the `innerCSS` function.

Example:
```javascript
class StyledComponent extends DeclaratitveElement {
	static style = css`
	button {
		background: yellow;
	}
	`
}
```

### `innerCSS(value: string)`

Use this function to add a variable CSS string to a style declaration.

>Note: Make sure you know the content of the string as it will be directly inserted into the stylesheet.

Example:
```javascript
const commonBackground = innerCSS('background: yellow;')
const style = css`
button {
	${commonBackground}
}
`
```

## `@applicvision/frontend-friends/dynamic-fragment`

