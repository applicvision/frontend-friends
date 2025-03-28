## `@applicvision/frontend-friends`

The main module exports the most commonly used functionality from the other exported modules.

- [`DeclarativeElement`](#declarativeelement)
- [`html`](#htmlstrings-string-values--dynamicfragment)
- [`css`](#cssstrings-string-values)
- [`island`](#island)

## `@applicvision/frontend-friends/declarative-element`

This is the module for working with custom elements. It exports the following:

- [`DeclarativeElement`](#declarativeelement)
- [`css`](#cssstrings-string-values)
- [`innerCSS`](#innercssvalue-string)

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

You can set these static properties on the subclass in order to customize appearance and behaviour common to all instances of the element.

##### `static observedAttributes: string[]`

Add the names of the attributes to which changes should trigger a re-rendering of the component. This property is inherited from `HTMLElement`. More info [here](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements#responding_to_attribute_changes).

##### `static style: StyleDeclaration|StyleDeclaration[]`

Adds stylesheet(s) to your component's shadow DOM. See [`css`](#cssstrings-string-values) for more info and example.

##### `static sharedStateName: string?`

Setting this to a valid string identifier will add it to the element's [custom state set](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals/states) when the [shared state](#protected-get-sharedstate) is truthy.


#### Instance properties

#####  `pendingUpdate: Promise|null`

If an update is awaiting, `pendingUpdate` is a promise which resolves when the update is complete. Otherwise it is `null`.


##### `protected get sharedState`

Read the currently shared state. This will call the `get` function of the `sharedStateBinding`.


##### `protected set sharedState`

Update the shared state. This will call the `set` function of the `sharedStateBinding`.


##### `set sharedStateBinding:` [`TwoWayBinding`](#twowaybinding)

Set this property to a binding object to make the element's state two-way bound. If you want to use a property of a [reactive](#reactivet-extends-objectobject-t-effect-keypath-string--void--t) object as a shared state, the [`twoway`](#twowayt-extends-objectstate-t-property-keyof-t-twowaybinding) function can be used here. But any object conforming to [`TwoWayBinding`](#twowaybinding) can be used. 

Please check the example in the [`twoway`](#twowayt-extends-objectstate-t-property-keyof-t-twowaybinding) section to see how to conveniently use shared state in a `DynamicFragment`.


#### Instance methods

##### `forwardSharedState()` `=>` [`TwoWayBinding`](#twowaybinding)

Passes on the shared state to an inner element. This can be used in the render function.

*Example:*
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


##### `invalidate()` `=>` `Promise`

Requests an asynchronous re-rendering of the component. A promise is returned, which resolves when the component has been updated.

##### `reactive<T extends object>(object: T, effect?: (keypath: string[]) => void)` `=>` `T`

Call `reactive` to convert an initial state object to a deep reactive object. Any subsequent mutation to the object will trigger the effect function. The default effect function simply triggers an update using [`invalidate()`](#invalidate--promise). To monitor objects for changes, a JavaScript Proxy is used. The deep watch functionality is also available on its own, [`deepWatch`](#applicvisionfrontend-friendsdeep-watch).

*Example:*
```javascript
class StatefulComponent extends DeclarativeElement {
    state = this.reactive({
        initialValue: 1,
        nested: {
            value: 2
        }
    })

    handleChange() {
        // This will cause a re-rendering
        this.state.nested.value += 1
    }
}
```


##### `render()` `=>` [`DynamicFragment`](#dynamicfragment)

Implement the render function to visually represent the state of your component. Use the `html`-tag function to create a `DynamicFragment`. Please consult the section about the [`html`](#htmlstrings-string-values--dynamicfragment) tag function to get more usage information.

> [!Note]
> Do not manually call the render function. It will be called by the rendering logic when needed.

*Example:*
```javascript
render() {
    return html`<div>hello</div>`
}
```

##### `protected sharedStateChanged()`

This function can be overriden by your component class, if you want to customize the behaviour when the shared state changes. The default implementation calls `invalidate()` and if applicable updates the [internal state](#static-sharedstatename-string) of the element. So remember to call `super.sharedStateChanged()` if overriding.



### `css(strings: string[], ...values)`

Tag function for adding CSS to your component. The function returns an instance of `StyleDeclaration` which can be assigned to the component's [style](#static-style-styledeclarationstyledeclaration). The CSS will be added to the `adoptedStyleSheets` property of the shadow root. Thus, it will be isolated from 'outside' CSS. The tag function supports nesting of ``` css`` ```-expressions as in the following example.

*Example:*
```javascript
class StyledComponent extends DeclarativeElement {
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

Adds a variable CSS string to a style declaration.

> [!CAUTION]
> Note: Beware of CSS injection. Make sure you know the content of the string as it will be directly inserted into the stylesheet.

*Example:*
```javascript
const commonBackground = innerCSS('background: yellow;')
const style = css`
button {
    ${commonBackground}
}
`
```

## `@applicvision/frontend-friends/island`

This is the module for working with pieces of dynamic content or interactivity, so-called interactive islands. This module can also be used in a NodeJS environment for server-side rendering.

Note that this is not the place to go for making a component based architecture. For that you would use [DeclarativeElement](#applicvisionfrontend-friendsdeclarative-element).

The module exports a factory function for creating islands and the underlying class.

* [`island`](#island)
* [`DynamicIsland`](#dynamicisland)


### `island()`

Factory function to create islands. It can be used in two ways.

#### Island without reactive state

Firstly, you can pass it just one argument, a render function. In this case the island will not have any reactive state, and updates need to be triggered manually with [`.invalidate()`](#invalidate--promise-1).

The signature of this function is:
```typescript
island(renderFunction: () => DynamicFragment): DynamicIsland<{}>
```

*Example:*
```javascript
const externalState = { value: 'hello' }

const myIsland = island(
    () => html`<div>${externalState.value}</div>`
)

// a later state change
externalState.value = 'goodbye'

// trigger update
myIsland.invalidate()
```


#### Island with reactive state

The other way to use the `island` function is to pass it two arguments; a setup function and a render function.

The function signature for that is:

```typescript
island<T extends { state?: object }>(
    setup: () => T,
    renderFunction: (islandContext: T) => DynamicFragment
): DynamicIsland<T>
```

The first argument in this case is a function that is called before initial mount. It should return an object which can be regarded as the 'context' object for the island. If that object includes an object on the key `state`, that object will be made reactive using [`deepWatch()`](#deepwatcht-extends-objecttarget-t-modificationcallback-keypath-string--void-t). That state will later be accessible and mutable as a property of the island.

> [!Note]
> The reason for the extra nesting of the `state` object is that in the future there might be additions to the context object.

The second argument is the render function, which will be called every time a rendering is needed. When using islands with a setup function, the render function gets called with the context object as the only argument.

*Example:*
```javascript
const helloIsland = island(
    // Setup (called initially)
    () => ({state: {name: 'unknown'}}),

    // Render (called on every state change)
    ({ state }) => html`<h1>Hello ${state.name}</h1>`
)

helloIsland.mount(document.body)

// Changing state triggers update
helloIsland.state.name = 'World'
```


### `DynamicIsland`

```javascript
class DynamicIsland extends EventTarget
```

Underlying class for islands. It is similar to `DeclarativeElement` in the sense that it manages its own rendering.

#### Constructor

The recommended way to create instances of `DynamicIsland` is to use the [island](#island) function.

#### instance properties

##### `get hydratable: string`

Returns a string representation of the island for server-side rendering. Similar to [`mount()`](#mountcontainer-htmlelement), this will call the setup- and render function, but it will not setup reactivity.

#####  `pendingUpdate: Promise|null`

If an update is awaiting, `pendingUpdate` is a promise which resolves when the update is complete. Otherwise it is `null`.

##### `get state`

This is the current reactive state of the island. Changes to the state will cause the island to update.

*Example:*
```javascript
const anIsland = island(
    // setup
    () => ({ state: { value: 1 } }),

    // render
    ({ state }) => html`${state.value}`
)

setInterval(() => anIsland.state.value++, 1000)
```


#### instance methods

##### `hydrate(container: HTMLElement)`

If `.hydratable` has been used on the server to send HTML to the client, `.hydrate()` can be used to prepare the island for interactivity. Pass the container which contains the hydratable HTML. See [`.hydrate()`](#hydratecontainer-htmlelementshadowroot-eventhandlercontext-unknown) for more details.

##### `invalidate()` `=>` `Promise`

Requests an asynchronous re-rendering of the island. A promise is returned, which resolves when the island has been updated.

##### `mount(container: HTMLElement)`

Mounts the island in the given container. This method will call your setup and render functions respectively to collect information about the initial content of the island.

##### `unmount(cacheFragment: boolean)`

Unmounts the island, and optionally caches the current fragment in memory for later reuse. By default, the fragment cache is cleared on unmount.

## `@applicvision/frontend-friends/dynamic-fragment`

This is the module for creating dynamic pieces of HTML. It is used in both [DeclarativeElement](#declarativeelement) and islands. It exports the following:

- [`html`](#html--dynamicfragment)
- [`DynamicFragment`](#dynamicfragment) 
- [`twoway`](#twowayt-extends-objectstate-t-property-keyof-t-twowaybinding)
- [`innerHTML`](#innerhtml)
- [`PropertySetter`](#propertysetter)
- [`TwowayBinding`](#twowaybinding)

### `html(strings: string[], ...values)` `=>` [`DynamicFragment`](#dynamicfragment)

This is the fundamental function to create dynamic HTML content.

Pass valid HTML to the tag function, as the string will later be passed to the [innerHTML](https://developer.mozilla.org/en-US/docs/Web/API/Element/innerHTML) setter of the mount point.

*Example:*
```javascript
html`<div>hello</div>`.mount(document.body)
```

Using expressions within `${}`, dynamic parts can be added to the HTML. It can be attributes:

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

For more complex attribute compositions, the [`tokens`](#tokensdefinitionparts-object--string--object--string-string) helper can be used.

#### *Boolean attributes*
```javascript
const isOpen = true
html`<details open=${isOpen}>hello</details>`
```

The type of the expression decides whether the attribute is treated as an ordinary string value attribute or a [boolean attribute](https://developer.mozilla.org/en-US/docs/Glossary/Boolean/HTML).

>[!Note]
>In the case of input elements, changing the value or checked attribute in the dynamic fragment causes the property with the same name to be set rather than the attribute, since that is usually desirable.

The expressions can also be event handlers. The attributes for event handlers should start with 'on' followed by the event name.

#### *Event Handlers*

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

If for some reason, more dynamic HTML is needed, there is more info in the [innerHTML](#innerhtml) section.

In case the value of the expression is `null`, `false` or `undefined` nothing will be output.

```javascript
const person = {firstname: 'Alice', lastname: null}
html`Hello ${person.firstname} ${person.lastname}`
// => Hello Alice
```

Array expressions are also accepted. Note that all array items must be `DynamicFramgent` instances, i.e. created with the ``` html`` ```-function.

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

* [ff-share](#twowaybinding) (two-way binding)
* [PropertySetter](#propertysetter)
* [InnerHTML](#innerhtml)
* [keyed Array items](#keykey-stringnumber)

### `html.key(key: string|number) => (strings: string[], ...values)` `=>` [`DynamicFragment`](#dynamicfragment)

Associates a given key with the `DynamicFragment`. More info [here](#keykey-stringnumber).

*Example:*

```javascript
html.key(item.id)`<li>${item.title}</li>`

// equivalent to
html`<li>${item.title}</li>`.key(item.id)
```

### `twoway<T extends object>(state: T, property: keyof T):` [`TwowayBinding`](#twowaybinding)

`DynamicFragment` offers a convenient way to work with data which can change, for example by a user entering text in a text field. A special attribute named `ff-share` can be used to pass a two way binding to HTMLInputElements and custom elements which can change data somehow.

The twoway function can help with creating a [`TwowayBinding`](#twowaybinding), which is simply an object with a `get` and `set` function respectively.

A common scenario would be having a state with a string that should be edited by the user. And then perform some logic on that string for every change by the user. Here is an island demonstrating that.

*Example:*
```javascript
island(
    // setup
    () => ({ state: { text: '' } }),

    // render
    ({ state }) => html`
        <input ff-share=${twoway(state, 'text')}>
        <div>length: ${state.text.length}</div>
    `
)
```

`ff-share` can also be used together with DeclarativeElement. The `DynamicFragment` automatically assigns the twoway binding to [`sharedStateBinding`](#set-sharedstatebinding-twowaybinding).

*Example:*
```javascript
class ToggleButton {
    render() {
        return html`
            <button onclick=${this.sharedState = !this.sharedState}>
            ${this.sharedState ? 'on' : 'off'}
            </button>
            `
    }
}

// Given a state of {active: boolean}, shared state would be passed like this to the ToggleButton
html`<toggle-button ff-share=${twoway(state, 'active')}></toggle-button>`
```

### `TwoWayBinding`

A simple type which two-way bindings should implement.

```typescript
type TwowayBinding<T> = {
    get: () => T;
    set: (newValue: T, event?: Event) => void;
}
```


### `innerHTML`

Adds a raw HTML string to the fragment.

*Example:*
```javascript
const htmlString = '<h1>Hello header</h1><p>Hello first paragraph</p>'

html`<section>${innerHTML(htmlString)}</section>`
```

> [!CAUTION]
> Beware of XSS vulnerability! Inserting unknown HTML is a security risk. Make sure you know the content of the string as it will be directly inserted into the HTML document.


### `PropertySetter`

Simple class which is used to set properties on elements in a `DynamicFragment`, when attributes do not exist or are not suitable. This could be when passing a function or a JavaScript object.

Imagine we have a custom element which has a property which is an object.

```typescript
class PersonInfo extends DeclarativeElement {
    #info?: {name: string, age: number}

    get info() { return this.#info }
    
    // Custom setter to trigger update when the property is set
    set info(info) {
        this.#info = info
        this.invalidate()
    }
}
customElements.define('person-info', PersonInfo)
```

Attributes in HTML are strings (or booleans), so to pass an object to a person-info element we need to use the property of the element instance.

```javascript
personInfo.info = { name: 'Alice', age: 20 }
```

> [!Note]
> In this case we could get away with atrributes using `JSON.stringify()` and `JSON.parse()` in the component, but imagine we wanted to set a function as a property instead.

The way setting properties is achieved in `DynamicFragment`, is by creating an instance of PropertySetter and pass that as a 'child' to the element.

```javascript
html`<person-info>${
    new PropertySetter('info', {name: 'Alice', age: 20})
}</person-info>`
```

To make this a little more convenient, a helper function can be written by the component author:

```typescript
export function info(personInfo: {name: string, age: number}) {
    return new PropertySetter('info', personInfo)
}
```

Which would then result in the following template:

```javascript
html`<person-info>${info({name: 'Alice', age: 20})}</person-info>`
```

Multiple properties can be passed as children, also alongside other content. Here is an example with slotted content and a so called render property.

```javascript
html`
<person-info>
    <div>I'm in the slot</div>
    ${info({name, age})}
    ${renderName(name => html`<h1>${name}</h1>`)}
</person-info>
`
```

`DynamicFragment` will only set properties which have been declared in the class. If trying to attach an arbitrary property to an element nothing will be set.

### `DynamicFragment`

Class which manages portions of HTML with dynamic parts such as attributes and text content. This is the low level implementation of the Frontend Friends suite. Although perfectly possible, there is usually no need to manually manage instances of `DynamicFragment`. Instead use it through `DeclarativeElement` or islands.

#### Constructor

Do not instantiate `DynamicFragment` using the constructor. Instead use the [tag function](#htmlstrings-string-values--dynamicfragment). The class is primarily exported for type checking. But one thing to note is that creating `DynamicFragment` is a very cheap operation. It does not touch the document, or construct an html string when created. Only when mounted, or when `.toString()` is called, does it form the HTML string, adds it to the document and attaches event listeners.

> [!Note]
> Depending on what you put in the expessions, `${}`, the ``` html`` ``` statement can be heavy, but that is not really part of the `DynamicFragment` creation.

#### instance properties

##### `values: (DynamicFragment|DynamicFragment[]|PropertySetter|string|number|boolean|Function|InnerHTML|TwowayBinding|null|undefined)[]`

The `values` array represents the current dynamic pieces in the tagged template, that is the content inside of `${}`-blocks in the string. Setting the values array causes a synchronous DOM update. That is what [DeclarativeElement](#declarativeelement) and islands do when re-rendering.

#### Instance methods

##### `hydrate(container: HTMLElement|ShadowRoot, eventHandlerContext?: unknown)`

Attaches event listeners and collects references to DOM nodes which might later be updated, that is at the locations of the `${}` expressions. Similar to [`.mount()`](#mountcontainer-htmlelementshadowroot-eventhandlercontext-unknown), an event handler context can be passed to the hydrate method. In fact, the `.mount()` method is simply a combination of `.toString` and `.hydrate()`:

```javascript
mount(container, eventHandlerContext) {
    container.innerHTML = this.toString()
    this.hydrate(container, eventHandlerContext)
}
```


##### `key(key: string|number): this`

Sets a key as identifier for the fragment, and returns the fragment. This can be used for more effectively updating array content, but is not required.

*Example:*
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


##### `mount(container: HTMLElement|ShadowRoot, eventHandlerContext?: unknown)`

Mounts the fragment in the given container. If not already generated, this method creates the HTML content and attaches event listeners. If an event handler context is passed to mount, that will be the value of `this` inside any event handler.

##### `restoreIn(container: HTMLElement|ShadowRoot)`

Restores the fragment in given container. This can be used on fragments that have been unmounted. It is used by `DeclarativeElement` and `island` to reuse cached fragments.


##### `toString()`

Puts together the HTML string from the tagged template. This can be used on the server to send initial HTML to the client. The HTML content is ready for rendering but contains some special attributes and comments which are removed during the [hydration](#hydratecontainer-htmlelementshadowroot-eventhandlercontext-unknown) step.


## `@applicvision/frontend-friends/deep-watch`

Utility module for wathching objects for changes. Used internally to create reactivity in [islands](#island) and [`DeclarativeElement`](#declarativeelement).

It uses [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) in order to detect changes to an initial state object. For that reason, if changes are made to the initial object passed in, no effect will be triggered.

The module exports two functions:

* [`deepWatch`](#deepwatcht-extends-objecttarget-t-modificationcallback-keypath-string--void--t)
* [`effect`](#effectt-extends-objecttarget-t-effect-target-t--void-t)

### `deepWatch<T extends object>(target: T, modificationCallback: (keypath: string[]) => void): T`

Pass in a target object to get a deep copy back which will be watched for changes. For every change to the returned object, the `modificationCallback` will be called synchronously with the keypath of the changed property as argument.

*Example:*
```javascript
const watched = deepWatch(
    {outer: { inner: 'Hello' }},
    (keyPath) => console.log(keyPath)
)
watched.outer.inner = 'World'
// Will log ['outer', 'inner']
```

### `effect<T extends object>(target: T, effect: (target: T) => void): T`

Similar to [`deepWatch`](#deepwatcht-extends-objecttarget-t-modificationcallback-keypath-string--void-t), but calls the effect callback function asynchronously on changes to the watched object. This is the logic used by `island` and `DeclarativeElement` for re-rendering.

This function is useful to aggregate several changes into one effect. For example, array manipulations such as prepending or removing the first element cause a lot of changes to the underlying object (keys are shifted for every item), so then it is a good idea to aggregate those changes into one callback.

*Example:*
```javascript
const watchedArray = effect([1, 2, 3], (array) => console.log(array))
watchedArray.unshift(0)
// will eventually log [0, 1, 2, 3]
```

## `@applicvision/frontend-friends/attribute-helpers`

Utility module to work with attributes. It exports one function:

* [`tokens`](#tokensdefinitionparts-object--string--object--string-string)

### `tokens(...definitionParts: (object | string | (object | string)[])[]): string`

Pass an arbitrary number of arguments consisting of strings, objects or arrays of strings or objects. The arguments passed will be 'flattened' to one space separated string of unique tokens which can be passed to attributes expecting space separated values, such as `class`.

Object arguments will have their keys passed to the resulting string if their values are truthy.

*Example:*
```javascript
const isActive = false
const loading = true
const classes = tokens('base', { active: isActive, loading })
// classes => 'base loading'
html`<button class=${classes}>...</button>`

const classes2 = tokens('alfa beta', [{ 'gamma': true }], 'beta ', { 'beta alfa': true })
// classes2 => 'alfa beta gamma'
```
