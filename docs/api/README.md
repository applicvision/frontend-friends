## `@applicvision/frontend-friends`

The main module exports the most commonly used functionality from the other exported modules.

- [DeclarativeElement](#declarativeelement)
- [html](#htmlstrings-string-values--dynamicfragment)
- [css](#cssstrings-string-values)
- island

## `@applicvision/frontend-friends/declarative-element`

This is the module for working with custom elements. It exports the following:

- [DeclarativeElement](#declarativeelement)
- [css](#cssstrings-string-values)
- [innerCSS](#innercssvalue-string)

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

Instantiate your custom element either by adding it to your HTML document:
```html
<my-custom-element></my-custom-element>
```

Or in JavaScript:

```javascript
 const instance1 = document.createElement('my-custom-element')
 // OR
 const instance2 = new MyCustomElement()
```


#### Static properties

You can set these static properties on the subclass in order to customize common appearance and behaviour of all instances.

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

##### `render()` `=>` [`DynamicFragment`](#dynamicfragment)

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

##### `forwardSharedState()` `=>` [`TwoWayBinding`](TODO:link)

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

##### `protected sharedStateChanged()`

This function can be overriden by your component class, if you want to customize the behaviour when the shared state changes. The default implementation calls `invalidate()` and if applicable updates the [internal state](#static-sharedstatename-string) of the element. So remember to call `super.sharedStateChanged()` if overriding.

##### `reactive<T extends object>(object: T, effect?: (keypath: string[]) => void)` `=>` `T`

Call `reactive` to convert an initial state object to a deep reactive object. Any subsequent mutation to the object will trigger the effect function. The default effect function simply triggers an update using [`invalidate()`](#invalidate--promise). To create reactivity, a JavaScript Proxy is used. The deep watch functionality is also available on its own, deepWatch.

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

### `css(strings: string[], ...values)`

Tag function for adding CSS to your component. The function returns an instance of `StyleDeclaration` which can be assigned to the component's [style](#static-style-styledeclarationstyledeclaration). The CSS will be added to the `adoptedStyleSheets` property of the shadow root. Thus, it will be isolated from 'outside' CSS. The tag function supports nesting of ``` css`` ```-expressions as in the following example.

Example:
```javascript
class StyledComponent extends DeclaratitveElement {
    static style = css`
    button {
        background: yellow;
    }
    ${css`
    div {
        margin: 10px;
    }
    `}
    `
}
```

### `innerCSS(value: string)`

Use this function to add a variable CSS string to a style declaration.

> [!IMPORTANT]
> Note: Beware of CSS injection. Make sure you know the content of the string as it will be directly inserted into the stylesheet.

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

This is the module for creating dynamic pieces of HTML. It is used in both [DeclarativeElement](#declarativeelement) and islands. It exports the following:

- [html](#html--dynamicfragment)
- [DynamicFragment](#dynamicfragment) 
- twoway
- innerHTML
- PropertySetter
- TwowayBinding

### `html(strings: string[], ...values)` `=>` [`DynamicFragment`](#dynamicfragment)

This is the fundamental function to create dynamic HTML content.

Pass valid HTML to the tag function, as the string will later be passed to the [innerHTML](https://developer.mozilla.org/en-US/docs/Web/API/Element/innerHTML) setter of the mount point.

Example:
```javascript
html`<div>hello</div>`.mount(document.body)
```

Using expressions within `${}`, dynamic parts can be added to the html. It can be attributes:

#### *String attributes*
```javascript
const introClass = 'intro'
const anotherClass = 'extra-padding'

// simple string. No quotemarks needed.
html`<div class=${introClass}>introduction</div>`

// String with prefix or suffix. Quotemarks required!
html`<div class="base ${introClass}">welcome</div>`

// Multiple strings. Quotemarks required!
html`<div class="${anotherClass} ${introClass} footer">Goodbye</div>`
```

For more complex attribute compositions, the [tokens](TODO:link) helper can be used.

#### *Boolean attributes*
```javascript
const isOpen = true
html`<details checked=${isOpen}>hello</details>`
```

The type of the expression decides whether the attribute is treated as an ordinary string value attribute or a [boolean attribute](https://developer.mozilla.org/en-US/docs/Glossary/Boolean/HTML).

>[!Note]
>In the case of input elements, changing the value or checked attribute in the dynamic fragment causes the property with the same name to be set rather than the attribute, since that is usually desirable.

The expressions can also be event handlers. The attributes for event handlers should start with 'on' followed by the event name.

#### *Event Handler*

```javascript
html`<button onclick=${(event) => console.log('click', event)}>Click me!</button>`
```

This might seem to go against all [recommendations](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/Events#inline_event_handlers_%E2%80%94_dont_use_these), but under the hood the event handler is added with `addEventListener`, and no inline event handler attribute is added to the HTML. For [DeclarativeElement](#declarativeelement), the event handler is called with the component instance as `this`, so no need for manual binding.

Dynamic parts can also be content.

#### *Content*

```javascript
html`<h1>Welcome ${firstname} ${lastname}</h1>`
```

Note that content will always be inserted as text. So it cannot be used to insert dynamic html.

```javascript
html`<section>${'<h2>Hello</h2>'}</section>`

// Will not create an h2-element, but rather the text '<h2>Hello</h2>'
```

Instead, in order to have HTML in the expressions, use a nested ``` html`` ```-expression:

```javascript
html`<section>${ html`<h2>${'Hello'}</h2>` }</section>`
// Will create a header with text 'Hello'
```

If for some reason, more dynamic HTML is needed, there is more info in the [innerHTML](#todo) section.

In case the value of the expression is `null`, `false` or `undefined` nothing will be output.

```javascript
const person = {firstname: 'Alice', lastname: null}
html`Hello ${person.firstname} ${person.lastname}`
// => Hello Alice
```

Array expressions are also accepted. Note that all array items must be DynamicFramgent instances, i.e. created with the ``` html`` ```-function.

```javascript
const items = ['Apple', 'Banana', 'Orange']
html`<ul>${items.map(item => html`<li>${item}</li>`)}</ul>`

// Multiple children items are also OK
const items = [{term: 'Term1', def: 'Def1'}, {term: 'Term2', def: 'Def2'}]
html`
<dl>${items.map(item => html`
    <dt>${item.term}</dt>
    <dd>${item.def}</dd>`)}
</dl>`
```

In addition to these types of expressions, there are some specials. More info on their respective section:

* ff-share (two-way binding)
* PropertySetter
* InnerHTML
* keyed Array items

### `DynamicFragment`

Class which manages portions of HTML which dynamic parts such as attributes and text content. This is the low level implementation of the Frontend Friends suite. Although perfectly possible, there is usually no need to manually manage instances of `DynamicFragment`. Instead use it through `DeclarativeElement` or islands.

#### Constructor

Do not instantiate `DynamicFragment` using the constructor. Instead use the [tag function](#htmlstrings-string-values--dynamicfragment). The class is primarily exported for type checking. But one thing to note is that creating `DynamicFragment` is a very cheap operation. It does not touch the document, or construct an html string when created. Only when mounted, or when `.toString()` is called, does it form the HTML string, adds it to the document and attaches event listeners.

> [!Note]
> Depending on what you put in the expessions, `${}`, the ``` html`` ``` statement can be heavy, but that is not really part of the `DynamicFragment` creation.

#### instance properties

##### `values: (DynamicFragment|DynamicFragment[]|PropertySetter|string|number|boolean|Function|InnerHTML|TwowayBinding|null|undefined)[]`

The `values` array represents the current dynamic pieces in the tagged template, that is the content inside of `${}`-blocks in the string. Setting the values array causes a synchronous DOM update. That is what [DeclarativeElement](#declarativeelement) and islands do when re-rendering.

#### Instance methods

##### `mount(container: HTMLElement|ShadowRoot, eventHandlerContext?: any)`

Mounts the fragment in the given container. If not already generated, this method creates the HTML content and attaches event listeners. If an event handler context is passed to mount, that will be the value of `this` inside any event handler.

##### `restoreIn(container: HTMLElement|ShadowRoot)`

Restores the fragment in given container. This can be used on fragments that have been unmounted. It is used by `DeclarativeElement` and `island` to reuse cached fragments.


##### `key(key: string|number)`

Sets a key as identifier for the fragment. This can be used for more effectively updating array content, but is not required.
Example:
```javascript
const animals = [{id: 1, name: 'dog'}, {id: 2, name: 'cat'}, {id: 3, name: 'horse'}]

html`<ul>
    ${animals.map(animal => html`
        <li>${animal.name}</li>`.key(animal.id)
    )}
</ul>`

// Or, alternative syntax:
html`<ul>
    ${animals.map(animal => html.key(animal.id)`
        <li>${animal.name}</li>`
    )}
</ul>`
```

##### `toString()`

Puts together the HTML string from the tagged template. This can be used on the server to send initial HTML to the client. The HTML content is ready for rendering but contains some special attributes and comments which are removed during the [hydration](#hydratecontainer-htmlelementshadowroot-eventhandlercontext-any) step.

##### `hydrate(container: HTMLElement|ShadowRoot, eventHandlerContext?: any)`

Attaches event listeners and collects references to DOM nodes which might later be updated, that is at the locations of the `${}` expressions. Similar to [`.mount()`](#mountcontainer-htmlelementshadowroot-eventhandlercontext-any), an event handler context can be passed to the hydrate method. In fact, the `.mount()` method is simply a combination of `.toString` and `.hydrate()`:

```javascript
mount(container, eventHandlerContext) {
    container.innerHTML = this.toString()
    this.hydrate(container, eventHandlerContext)
}
```
